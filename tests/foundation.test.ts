import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import {
  roleNames,
  parseNode,
  validateNode,
  visibleGraph,
  canRead,
  canWrite,
  type Account,
  type Graph,
  type StructureNode,
} from "../src/lib/foundation.ts";
import { graphFor, commitGraph, auditStatement } from "../src/server/db.ts";
import { graphAction, userAction, listUsers } from "../src/server/service.ts";
import {
  authenticate,
  accountFor,
  currentAccount,
  digest,
  checkOrigin,
  rateLimit,
  passwordValid,
  loginPasswordValid,
} from "../src/server/auth.ts";

let mf: Miniflare, db: D1Database;
const admin: Account = {
  id: "admin",
  email: "admin@example.test",
  name: "Test admin",
  active: true,
  admin: true,
  mustChangePassword: false,
  grants: [
    {
      id: "a",
      domain: "program",
      role: "admin",
      unitId: null,
      restricted: true,
    },
    {
      id: "b",
      domain: "ministry",
      role: "admin",
      unitId: null,
      restricted: true,
    },
  ],
};
const member = (
  role: keyof typeof roleNames,
  unitId: string | null = null,
  restricted = false,
): Account => ({
  ...admin,
  id: "member",
  admin: false,
  grants: [{ id: "r", domain: "program", role, unitId, restricted }],
});
const node = (
  id: string,
  kind: StructureNode["kind"] = "strategy",
  extra: Partial<StructureNode> = {},
): StructureNode =>
  parseNode(
    {
      kind,
      code: id,
      nameAr: `اختبار ${id}`,
      nameEn: `Test ${id}`,
      level: "strategic",
      restricted: false,
      ...extra,
    },
    "program",
    id,
  );
before(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch(){return new Response("test")} }',
      compatibilityDate: "2026-10-06",
      d1Databases: ["DB"],
    }),
  );
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const migration of (
    await readdir(new URL("../migrations/", import.meta.url))
  )
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(
      (
        await readFile(
          new URL(`../migrations/${migration}`, import.meta.url),
          "utf8",
        )
      ).replace(/\r?\n/g, " "),
    );
  await db
    .prepare(
      "INSERT INTO users(id,email,name,password_hash,admin,created_at) VALUES(?,?,?,?,?,?)",
    )
    .bind(
      "admin",
      admin.email,
      admin.name,
      "not-a-login-password",
      1,
      new Date().toISOString(),
    )
    .run();
});
after(async () => {
  await mf?.dispose();
});
test("all nine roles exist; only structure editors may write, and global account admin is not a content bypass", () => {
  assert.equal(Object.keys(roleNames).length, 9);
  const n = node("s");
  for (const role of Object.keys(roleNames) as (keyof typeof roleNames)[])
    assert.equal(
      canWrite(member(role), n, [n]),
      ["admin", "strategy"].includes(role),
    );
  assert.equal(
    canWrite(
      member("performance"),
      node("o", "objective", { level: "operational" }),
      [],
    ),
    true,
  );
  assert.equal(canRead({ ...admin, grants: [] }, n, [n]), false);
});
test("unit subtree and confidentiality isolate records and strip hidden links and parent identifiers", () => {
  const nodes = [
    node("u", "unit"),
    node("sub", "unit", { parentId: "u" }),
    node("other", "unit"),
    node("s", "strategy", { unitId: "sub" }),
    node("private", "strategy", { unitId: "sub", restricted: true }),
    node("outside", "strategy", { unitId: "other" }),
  ];
  const graph: Graph = {
    domain: "program",
    revision: 0,
    nodes,
    links: [{ id: "leak", sourceId: "s", targetId: "private" }],
  };
  const visible = visibleGraph(member("viewer", "u"), graph);
  assert.deepEqual(
    visible.nodes.map((n) => n.id),
    ["u", "sub", "s"],
  );
  assert.equal(visible.links.length, 0);
  assert.equal(canRead(member("viewer", "u", true), nodes[4], nodes), true);
  assert.equal(
    canRead(member("viewer"), { ...nodes[0], domain: "ministry" }, nodes),
    false,
  );
});
test("hierarchy rejects cycles, invalid parent types, invalid dates and hidden parent references", () => {
  const a = node("a"),
    b = node("b", "strategy", { parentId: "a" });
  const graph: Graph = {
    domain: "program",
    revision: 0,
    nodes: [a, b],
    links: [],
  };
  assert.throws(
    () => validateNode({ ...a, parentId: "b" }, graph, admin),
    /CYCLE/,
  );
  assert.throws(
    () => validateNode(node("u", "unit", { parentId: "a" }), graph, admin),
    /INVALID_RELATION/,
  );
  assert.throws(
    () => parseNode({ ...a, startDate: "2026-02-30" }, "program", "a"),
    /INVALID_DATE/,
  );
  assert.throws(
    () => validateNode(node("o", "objective"), graph, admin),
    /PARENT_REQUIRED/,
  );
});
test("scoped writers cannot move a scope anchor or change a record outside their scope", () => {
  const u = node("u", "unit"),
    s = node("s", "strategy", { unitId: "u" }),
    other = node("other", "unit");
  const graph: Graph = {
    domain: "program",
    revision: 0,
    nodes: [u, s, other],
    links: [],
  };
  assert.throws(
    () =>
      validateNode({ ...u, parentId: "other" }, graph, member("strategy", "u")),
    /FORBIDDEN/,
  );
  assert.throws(
    () =>
      validateNode({ ...s, unitId: "other" }, graph, member("strategy", "u")),
    /FORBIDDEN/,
  );
});
test("create, update, link and delete persist; each committed change has a before/after audit record", async () => {
  let graph = await graphFor(db, "program");
  graph = await graphAction(db, admin, {
    action: "save",
    domain: "program",
    revision: graph.revision,
    node: { ...node("STR"), id: undefined },
  });
  const strategy = graph.nodes.find((n) => n.code === "STR")!;
  graph = await graphAction(db, admin, {
    action: "save",
    domain: "program",
    revision: graph.revision,
    node: {
      ...node("OBJ", "objective", { parentId: strategy.id }),
      id: undefined,
    },
  });
  const objective = graph.nodes.find((n) => n.code === "OBJ")!;
  graph = await graphAction(db, admin, {
    action: "save",
    domain: "program",
    revision: graph.revision,
    node: {
      ...node("INIT", "initiative", { parentId: objective.id }),
      id: undefined,
    },
  });
  const initiative = graph.nodes.find((n) => n.code === "INIT")!;
  graph = await graphAction(db, admin, {
    action: "link",
    domain: "program",
    revision: graph.revision,
    sourceId: objective.id,
    targetId: initiative.id,
  });
  assert.equal(graph.links.length, 1);
  await assert.rejects(
    () =>
      graphAction(db, admin, {
        action: "delete",
        domain: "program",
        revision: graph.revision,
        id: objective.id,
      }),
    /HAS_DEPENDENCIES/,
  );
  graph = await graphAction(db, admin, {
    action: "save",
    domain: "program",
    revision: graph.revision,
    node: { ...initiative, nameEn: "Updated initiative" },
  });
  assert.equal(
    (await graphFor(db, "program")).nodes.find((n) => n.id === initiative.id)
      ?.nameEn,
    "Updated initiative",
  );
  const audit = await db
    .prepare(
      "SELECT before_json,after_json FROM audit WHERE action='structure.updated' AND entity_id=?",
    )
    .bind(initiative.id)
    .first<{ before_json: string; after_json: string }>();
  assert.equal(JSON.parse(audit!.before_json).nameEn, "Test INIT");
  assert.equal(JSON.parse(audit!.after_json).nameEn, "Updated initiative");
  graph = await graphAction(db, admin, {
    action: "unlink",
    domain: "program",
    revision: graph.revision,
    id: graph.links[0].id,
  });
  graph = await graphAction(db, admin, {
    action: "delete",
    domain: "program",
    revision: graph.revision,
    id: initiative.id,
  });
  assert.equal(
    graph.nodes.some((n) => n.id === initiative.id),
    false,
  );
});
test("direct server mutations reject read-only users and cross-organization IDs", async () => {
  const graph = await graphFor(db, "program");
  await assert.rejects(
    () =>
      graphAction(db, member("viewer"), {
        action: "delete",
        domain: "program",
        revision: graph.revision,
        id: graph.nodes[0].id,
      }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    () =>
      graphAction(db, member("strategy"), {
        action: "save",
        domain: "ministry",
        revision: 0,
        node: {},
      }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    () =>
      graphAction(db, admin, {
        action: "save",
        domain: "ministry",
        revision: 0,
        node: {
          ...node("cross", "objective", { parentId: graph.nodes[0].id }),
          id: undefined,
        },
      }),
    /INVALID_RELATION/,
  );
});
test("concurrent writes cannot silently overwrite: one transaction succeeds, one rolls back including its audit", async () => {
  const graph = await graphFor(db, "program");
  const results = await Promise.allSettled(
    [1, 2].map((i) =>
      commitGraph(db, graph, [
        auditStatement(db, admin, "program", `race.${i}`, `race-${i}`, null, {
          value: i,
        }),
      ]),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM audit WHERE action LIKE 'race.%'")
    .first<{ n: number }>();
  assert.equal(row?.n, 1);
});
test("failed transactional writes do not advance graph revisions or leave partial audit entries", async () => {
  const graph = await graphFor(db, "program");
  await assert.rejects(() =>
    commitGraph(db, graph, [
      auditStatement(db, admin, "program", "should.rollback", "x", null, null),
      db.prepare("INSERT INTO write_guards(id,ok) VALUES(?,0)").bind("fail"),
    ]),
  );
  assert.equal((await graphFor(db, "program")).revision, graph.revision);
  assert.equal(
    await db
      .prepare("SELECT id FROM audit WHERE action='should.rollback'")
      .first(),
    null,
  );
});
test("audit rows cannot be altered or deleted", async () => {
  await assert.rejects(
    () => db.prepare("UPDATE audit SET action='tampered'").run(),
    /AUDIT_IMMUTABLE/,
  );
  await assert.rejects(
    () => db.prepare("DELETE FROM audit").run(),
    /AUDIT_IMMUTABLE/,
  );
});
test("signup needs no email verification, grants no access, hashes passwords, and session tokens are stored hashed", async () => {
  const request = new Request("http://localhost/api/foundation/signup", {
    method: "POST",
    headers: { origin: "http://localhost" },
  });
  const password = "س";
  const { account, token } = await authenticate(
    db,
    request,
    {
      name: "Test member",
      email: "Member@example.test",
      password,
      admin: true,
      grants: admin.grants,
    },
    true,
  );
  const signedIn = await authenticate(
    db,
    request,
    { email: account.email, password },
    false,
  );
  assert.equal(signedIn.account.id, account.id);
  assert.equal(account.mustChangePassword, false);
  assert.equal(signedIn.account.mustChangePassword, false);
  assert.equal(account.admin, false);
  assert.equal(account.email, "member@example.test");
  assert.deepEqual(account.grants, []);
  const saved = await db
    .prepare("SELECT password_hash FROM users WHERE id=?")
    .bind(account.id)
    .first<{ password_hash: string }>();
  assert.notEqual(saved!.password_hash, password);
  assert.match(saved!.password_hash, /^\$2[ab]\$/);
  assert.ok(
    await db
      .prepare("SELECT user_id FROM sessions WHERE token_hash=?")
      .bind(await digest(token))
      .first(),
  );
  assert.equal(
    (await currentAccount(db, `baseer_session=${token}`))?.id,
    account.id,
  );
  await userAction(db, admin, {
    action: "access",
    userId: account.id,
    active: true,
    admin: false,
    grants: [
      { domain: "program", role: "viewer", unitId: null, restricted: false },
    ],
  });
  assert.equal(await currentAccount(db, `baseer_session=${token}`), null);
  const updated = await accountFor(db, account.id);
  assert.equal(updated?.grants[0].role, "viewer");
  await assert.rejects(() => listUsers(db, updated!), /FORBIDDEN/);
  await userAction(db, admin, {
    action: "access",
    userId: account.id,
    active: false,
    admin: false,
    grants: [],
  });
  assert.equal(await accountFor(db, account.id), null);
  await assert.rejects(
    () => authenticate(db, request, { email: account.email, password }, false),
    /INVALID_CREDENTIALS/,
  );
});
test("CSRF checks, password bounds, brute-force limits and last-admin guard are enforced", async () => {
  assert.throws(
    () =>
      checkOrigin(
        new Request("https://baseer.test/api", {
          headers: { origin: "https://evil.test" },
        }),
      ),
    /INVALID_ORIGIN/,
  );
  assert.throws(
    () => checkOrigin(new Request("https://baseer.test/api")),
    /INVALID_ORIGIN/,
  );
  checkOrigin(
    new Request("https://baseer.test/api", {
      headers: { origin: "https://baseer.test" },
    }),
  );
  assert.equal(passwordValid("short"), true);
  assert.equal(passwordValid(""), false);
  for (const value of ["a", "1", "!", "س"]) {
    assert.equal(passwordValid(value), true);
    assert.equal(loginPasswordValid(value), true);
  }
  assert.equal(loginPasswordValid("temporary"), true);
  assert.equal(passwordValid("a".repeat(73)), false);
  await rateLimit(db, "test-limiter", 1);
  await assert.rejects(() => rateLimit(db, "test-limiter", 1), /RATE_LIMITED/);
  await assert.rejects(
    () =>
      db.prepare("UPDATE users SET active=0 WHERE id=?").bind(admin.id).run(),
    /LAST_ADMIN/,
  );
});

test("account deletion is admin-only, revokes sessions and grants, and retains audit and work records", async () => {
  const request = new Request("http://localhost/api/foundation/signup", {
    method: "POST",
    headers: { origin: "http://localhost" },
  });
  const { account, token } = await authenticate(
    db,
    request,
    { email: "delete-test@example.test", password: "x", name: "Delete test" },
    true,
  );
  await db
    .prepare(
      "INSERT INTO grants(id,user_id,domain,role,restricted) VALUES(?,?, 'program','viewer',0)",
    )
    .bind(crypto.randomUUID(), account.id)
    .run();
  const graphBefore = await graphFor(db, "program");
  await assert.rejects(
    () =>
      userAction(db, member("viewer"), {
        action: "delete",
        userId: account.id,
      }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    () => userAction(db, admin, { action: "delete", userId: admin.id }),
    /SELF_CHANGE_FORBIDDEN/,
  );
  await userAction(db, admin, { action: "delete", userId: account.id });
  assert.equal(await accountFor(db, account.id), null);
  assert.equal(await currentAccount(db, `baseer_session=${token}`), null);
  for (const table of ["sessions", "grants"])
    assert.equal(
      (await db
        .prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id=?`)
        .bind(account.id)
        .first<{ total: number }>())!.total,
      0,
    );
  const audit = await db
    .prepare(
      "SELECT before_json,after_json FROM audit WHERE action='account.deleted' AND entity_id=?",
    )
    .bind(account.id)
    .first<{ before_json: string; after_json: string | null }>();
  assert.equal(JSON.parse(audit!.before_json).email, account.email);
  assert.equal(JSON.parse(audit!.before_json).grants.length, 1);
  assert.equal(audit!.after_json, null);
  assert.ok(
    await db
      .prepare(
        "SELECT id FROM audit WHERE action='account.created' AND entity_id=?",
      )
      .bind(account.id)
      .first(),
  );
  assert.deepEqual(await graphFor(db, "program"), graphBefore);
  await assert.rejects(
    () =>
      authenticate(db, request, { email: account.email, password: "x" }, false),
    /INVALID_CREDENTIALS/,
  );
  await assert.rejects(
    () => userAction(db, admin, { action: "delete", userId: account.id }),
    /NOT_FOUND/,
  );
});

test("deletion cannot remove the last active administrator and rolls back if audit persistence fails", async () => {
  await assert.rejects(
    () => db.prepare("DELETE FROM users WHERE id=?").bind(admin.id).run(),
    /LAST_ADMIN/,
  );
  assert.ok(await accountFor(db, admin.id));
  const request = new Request("http://localhost/api/foundation/signup", {
    method: "POST",
    headers: { origin: "http://localhost" },
  });
  const { account, token } = await authenticate(
    db,
    request,
    {
      email: "delete-rollback@example.test",
      password: "x",
      name: "Rollback test",
    },
    true,
  );
  await db.exec(
    "CREATE TRIGGER reject_delete_audit BEFORE INSERT ON audit WHEN NEW.action='account.deleted' BEGIN SELECT RAISE(ABORT,'TEST_AUDIT_FAILURE'); END;",
  );
  try {
    await assert.rejects(
      () => userAction(db, admin, { action: "delete", userId: account.id }),
      /TEST_AUDIT_FAILURE/,
    );
    assert.ok(await accountFor(db, account.id));
    assert.equal(
      (await currentAccount(db, `baseer_session=${token}`))?.id,
      account.id,
    );
    assert.equal(
      await db
        .prepare(
          "SELECT id FROM audit WHERE action='account.deleted' AND entity_id=?",
        )
        .bind(account.id)
        .first(),
      null,
    );
  } finally {
    await db.exec("DROP TRIGGER reject_delete_audit;");
  }
  await userAction(db, admin, { action: "delete", userId: account.id });
});
