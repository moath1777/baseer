import bcrypt from "bcryptjs";
import { AppError, visibleGraph, type Account } from "@/lib/foundation";
import { database, graphFor, auditStatement } from "@/server/db";
import {
  authenticate,
  checkOrigin,
  cookieHeader,
  currentAccount,
  passwordValid,
  loginPasswordValid,
  rateLimit,
} from "@/server/auth";
import {
  graphAction,
  listUsers,
  parseDomain,
  userAction,
} from "@/server/service";

export const dynamic = "force-dynamic";
const json = (
  value: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const action = path.join("/");
    const db = await database();
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      checkOrigin(request);
      if (!request.headers.get("content-type")?.includes("application/json"))
        throw new AppError("INVALID_CONTENT_TYPE", 415);
      const text = await request.text();
      if (text.length > 32768) throw new AppError("BODY_TOO_LARGE", 413);
      try {
        body = JSON.parse(text);
      } catch {
        throw new AppError("INVALID_JSON");
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new AppError("INVALID_JSON");
    }
    if (request.method === "POST" && ["login", "signup"].includes(action)) {
      const { account, token } = await authenticate(
        db,
        request,
        body,
        action === "signup",
      );
      return json({ account }, 200, {
        "Set-Cookie": cookieHeader(token, request),
      });
    }
    const account = await currentAccount(db, request.headers.get("cookie"));
    if (action === "session" && request.method === "GET")
      return json({ account });
    if (!account && action === "logout" && request.method === "POST")
      return json({ ok: true }, 200, {
        "Set-Cookie": cookieHeader("", request, true),
      });
    if (!account) throw new AppError("UNAUTHENTICATED", 401);
    if (action === "logout" && request.method === "POST") {
      // Log out every session on this account; revoked cookies cannot be replayed.
      await db.batch([
        db.prepare("DELETE FROM sessions WHERE user_id=?").bind(account.id),
        auditStatement(
          db,
          account,
          null,
          "session.logout",
          account.id,
          null,
          null,
        ),
      ]);
      return json({ ok: true }, 200, {
        "Set-Cookie": cookieHeader("", request, true),
      });
    }
    if (action === "password" && request.method === "POST") {
      await rateLimit(db, `password:${account.id}`, 10);
      const row = await db
        .prepare("SELECT password_hash FROM users WHERE id=?")
        .bind(account.id)
        .first<{ password_hash: string }>();
      if (
        !passwordValid(body.password) ||
        !loginPasswordValid(body.currentPassword) ||
        !row ||
        !(await bcrypt.compare(body.currentPassword, row.password_hash))
      )
        throw new AppError("INVALID_PASSWORD");
      await db.batch([
        db
          .prepare(
            "UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?",
          )
          .bind(await bcrypt.hash(body.password, 12), account.id),
        db.prepare("DELETE FROM sessions WHERE user_id=?").bind(account.id),
        auditStatement(
          db,
          account,
          null,
          "account.password_changed",
          account.id,
          null,
          null,
        ),
      ]);
      return json({ ok: true }, 200, {
        "Set-Cookie": cookieHeader("", request, true),
      });
    }
    if (account.mustChangePassword)
      throw new AppError("PASSWORD_CHANGE_REQUIRED", 403);
    if (action === "graph") {
      if (request.method === "POST")
        return json(await graphAction(db, account, body));
      const domain = parseDomain(
        new URL(request.url).searchParams.get("domain"),
      );
      if (!account.grants.some((g) => g.domain === domain))
        throw new AppError("FORBIDDEN", 403);
      return json(visibleGraph(account, await graphFor(db, domain)));
    }
    if (action === "users")
      return json(
        request.method === "GET"
          ? { users: await listUsers(db, account) }
          : await userAction(db, account, body),
      );
    if (action === "audit" && request.method === "GET") {
      // Audit snapshots can contain confidential/deleted data. Only explicit whole-domain,
      // confidential administrator grants may read them, never a UI role switch.
      const domainParam = new URL(request.url).searchParams.get("domain");
      const domain = domainParam ? parseDomain(domainParam) : null;
      if (
        domain
          ? !account.grants.some(
              (g) =>
                g.domain === domain &&
                g.role === "admin" &&
                !g.unitId &&
                g.restricted,
            )
          : !account.admin
      )
        throw new AppError("FORBIDDEN", 403);
      const rows = domain
        ? await db
            .prepare(
              "SELECT * FROM audit WHERE domain=? ORDER BY at DESC LIMIT 200",
            )
            .bind(domain)
            .all()
        : await db
            .prepare(
              "SELECT * FROM audit WHERE domain IS NULL ORDER BY at DESC LIMIT 200",
            )
            .all();
      return json({ events: rows.results });
    }
    throw new AppError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    console.error(
      "Foundation request failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
export const GET = handle;
export const POST = handle;
