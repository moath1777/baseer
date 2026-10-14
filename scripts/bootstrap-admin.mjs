import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const args = process.argv.slice(2);
const arg = (name) => args[args.indexOf(name) + 1];
const email = args.includes("--email")
  ? arg("--email").trim().toLowerCase()
  : "";
const name = args.includes("--name")
  ? arg("--name").trim()
  : "Baseer administrator";
if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !args.some((a) => a === "--local" || a === "--remote")
)
  throw new Error(
    'Usage: node scripts/bootstrap-admin.mjs --email name@example.com --name "Name" --local|--remote',
  );
const remote = args.includes("--remote");
const mustChangePassword = !args.includes("--password-stdin");
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const id = randomUUID(),
  password = args.includes("--password-stdin")
    ? readFileSync(0, "utf8").trimEnd()
    : randomBytes(21).toString("base64url");
if (password.length < 1 || Buffer.byteLength(password, "utf8") > 72)
  throw new Error("The password must be non-empty and at most 72 bytes.");
const hash = await bcrypt.hash(password, 12),
  now = new Date().toISOString();
mkdirSync("artifacts/m2", { recursive: true });
const sqlPath = `artifacts/m2/bootstrap-${id}.sql`;
const credentialPath = `artifacts/m2/admin-${remote ? "remote" : "local"}-${Date.now()}.txt`;
const sql = `INSERT INTO users(id,email,name,password_hash,admin,must_change_password,created_at) VALUES(${q(id)},${q(email)},${q(name)},${q(hash)},1,${Number(mustChangePassword)},${q(now)});
INSERT INTO grants(id,user_id,domain,role,restricted) VALUES(${q(randomUUID())},${q(id)},'program','admin',1),(${q(randomUUID())},${q(id)},'ministry','admin',1);
INSERT INTO audit(id,actor_id,actor_name,action,entity_id,after_json,at) VALUES(${q(randomUUID())},'operator','Deployment operator','account.bootstrap',${q(id)},${q(JSON.stringify({ email, admin: true, domains: ["program", "ministry"], mustChangePassword }))},${q(now)});`;
writeFileSync(sqlPath, sql, { mode: 0o600 });
try {
  execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "baseer-m2",
      remote ? "--remote" : "--local",
      "--file",
      sqlPath,
    ],
    { stdio: "pipe" },
  );
  writeFileSync(
    credentialPath,
    `Baseer ${remote ? "remote" : "local"} administrator\nEmail: ${email}\n${mustChangePassword ? "Temporary password" : "Password"}: ${password}\n${mustChangePassword ? "Change this password on first sign-in." : "Owner-chosen password; no first-sign-in change required."} This file is excluded from Git.\n`,
    { mode: 0o600 },
  );
  console.log(
    `Administrator created. Credentials saved privately to ${credentialPath}.`,
  );
} catch (error) {
  throw new Error(
    "Administrator setup failed. The email may already exist or database access is unavailable. Existing accounts were not overwritten.",
    { cause: error },
  );
} finally {
  unlinkSync(sqlPath);
}
