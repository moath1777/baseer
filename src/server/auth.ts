import bcrypt from "bcryptjs";
import type { D1Database } from "@cloudflare/workers-types";
import { AppError, type Account, type Grant } from "../lib/foundation.ts";
import { auditStatement } from "./db.ts";

export const sessionCookie = "baseer_session";
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function passwordValid(password: unknown): password is string {
  return (
    typeof password === "string" &&
    password.length > 0 &&
    new TextEncoder().encode(password).length <= 72
  );
}
export function loginPasswordValid(password: unknown): password is string {
  return (
    typeof password === "string" &&
    password.length > 0 &&
    new TextEncoder().encode(password).length <= 72
  );
}
export async function accountFor(
  db: D1Database,
  id: string,
): Promise<Account | null> {
  const u = await db
    .prepare(
      "SELECT id,email,name,admin,active,must_change_password FROM users WHERE id=?",
    )
    .bind(id)
    .first<{
      id: string;
      email: string;
      name: string;
      admin: number;
      active: number;
      must_change_password: number;
    }>();
  if (!u || !u.active) return null;
  const grants = await db
    .prepare(
      "SELECT id,domain,role,unit_id AS unitId,restricted FROM grants WHERE user_id=?",
    )
    .bind(id)
    .all<Grant>();
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    admin: !!u.admin,
    active: !!u.active,
    mustChangePassword: !!u.must_change_password,
    grants: grants.results.map((g) => ({ ...g, restricted: !!g.restricted })),
  };
}
export async function currentAccount(
  db: D1Database,
  cookie: string | null,
): Promise<Account | null> {
  const token = cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${sessionCookie}=`))
    ?.slice(sessionCookie.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db
    .prepare("SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?")
    .bind(await digest(token), Date.now())
    .first<{ user_id: string }>();
  return session ? accountFor(db, session.user_id) : null;
}
export function checkOrigin(request: Request) {
  const url = new URL(request.url);
  // Next's development adapter may use localhost internally for a 127.0.0.1 request.
  // Host is the received authority; do not trust client-supplied forwarded-host headers.
  const expected = `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (request.headers.get("origin") !== expected)
    throw new AppError("INVALID_ORIGIN", 403);
}
export async function rateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowMs = 15 * 60 * 1000,
) {
  const now = Date.now();
  const value = await db
    .prepare(
      "INSERT INTO rate_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts",
    )
    .bind(await digest(key), now + windowMs, now, now)
    .first<{ attempts: number }>();
  if (!value || value.attempts > limit) throw new AppError("RATE_LIMITED", 429);
}
export async function authenticate(
  db: D1Database,
  request: Request,
  body: Record<string, unknown>,
  signup: boolean,
) {
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body.password;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    !(signup ? passwordValid(password) : loginPasswordValid(password))
  )
    throw new AppError("INVALID_CREDENTIAL_FIELDS");
  if (signup && (name.length < 2 || name.length > 100))
    throw new AppError("INVALID_NAME");
  await rateLimit(
    db,
    `auth:ip:${request.headers.get("cf-connecting-ip") || "local"}`,
    60,
  );
  await rateLimit(db, `auth:email:${email}`, 10);
  let id: string;
  if (signup) {
    id = crypto.randomUUID();
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            id,
            email,
            name,
            await bcrypt.hash(password, 12),
            new Date().toISOString(),
          ),
        auditStatement(db, { id, name }, null, "account.created", id, null, {
          email,
          name,
        }),
      ]);
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new AppError("ACCOUNT_UNAVAILABLE", 409);
      throw error;
    }
  } else {
    const u = await db
      .prepare("SELECT id,password_hash,active FROM users WHERE email=?")
      .bind(email)
      .first<{ id: string; password_hash: string; active: number }>();
    // A fixed-cost dummy comparison prevents revealing account existence through timing.
    const matches = await bcrypt.compare(
      password,
      u?.password_hash ||
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
    if (!u || !u.active || !matches)
      throw new AppError("INVALID_CREDENTIALS", 401);
    id = u.id;
  }
  const account = await accountFor(db, id);
  if (!account) throw new AppError("INVALID_CREDENTIALS", 401);
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(Date.now()),
    db
      .prepare(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
      )
      .bind(await digest(token), id, Date.now() + 8 * 60 * 60 * 1000),
    auditStatement(db, account, null, "session.login", id, null, null),
  ]);
  return { account, token };
}
export function cookieHeader(token: string, request: Request, clear = false) {
  return `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 28800}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
