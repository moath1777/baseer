// Explicit operator-run acceptance check. Creates only synthetic data, then cleans it up.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
const args = process.argv.slice(2);
if (!args.includes("--url") || !args.includes("--remote"))
  throw new Error(
    "Usage: node scripts/smoke-deployed.mjs --url https://your-worker.workers.dev --remote",
  );
const origin = new URL(args[args.indexOf("--url") + 1]).origin;
const run = randomUUID();
const email = `acceptance-${run}@example.test`,
  password = `Acceptance-${randomUUID()}`;
let cookie = "",
  userId = "",
  graph = null;
const created = [];
mkdirSync("artifacts/m2", { recursive: true });
function sql(query) {
  const path = `artifacts/m2/smoke-${run}.sql`;
  writeFileSync(path, query, { mode: 0o600 });
  try {
    execFileSync(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "d1",
        "execute",
        "baseer-m2",
        "--remote",
        "--file",
        path,
      ],
      { stdio: "pipe" },
    );
  } finally {
    unlinkSync(path);
  }
}
async function request(path, body, expected = 200) {
  const response = await fetch(`${origin}/api/foundation/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(
    response.status,
    expected,
    `${path}: expected ${expected}, received ${response.status}: ${text.slice(0, 250)}`,
  );
  if (response.headers.get("set-cookie")) {
    const set = response.headers.get("set-cookie");
    assert.match(set, /HttpOnly/i);
    assert.match(set, /Secure/i);
    assert.match(set, /SameSite=Lax/i);
    cookie = set.split(";")[0];
  }
  return JSON.parse(text);
}
async function mutate(body) {
  graph = await request("graph", {
    domain: "program",
    revision: graph.revision,
    ...body,
  });
  return graph;
}
try {
  await request("graph?domain=program", undefined, 401);
  const signup = await request("signup", {
    email,
    password,
    name: "Synthetic M2 acceptance check",
  });
  userId = signup.account.id;
  assert.equal(signup.account.mustChangePassword, false);
  assert.deepEqual(signup.account.grants, []);
  assert.equal(signup.account.admin, false);
  await request("graph?domain=program", undefined, 403);
  sql(
    `INSERT INTO grants(id,user_id,domain,role,restricted) VALUES('${run}','${userId}','program','admin',1);`,
  );
  graph = await request("graph?domain=program");
  await request("graph?domain=ministry", undefined, 403);
  const base = {
    nameAr: "اختبار قبول مؤقت",
    nameEn: "Temporary acceptance test",
    level: "strategic",
    restricted: false,
  };
  await mutate({
    action: "save",
    node: { ...base, kind: "strategy", code: `QA-${run.slice(0, 8)}-S` },
  });
  const strategy = graph.nodes.find(
    (n) => n.code === `QA-${run.slice(0, 8)}-S`,
  );
  created.push(strategy.id);
  await mutate({
    action: "save",
    node: {
      ...base,
      kind: "objective",
      code: `QA-${run.slice(0, 8)}-O`,
      parentId: strategy.id,
    },
  });
  const objective = graph.nodes.find(
    (n) => n.code === `QA-${run.slice(0, 8)}-O`,
  );
  created.push(objective.id);
  await mutate({
    action: "save",
    node: {
      ...base,
      kind: "initiative",
      code: `QA-${run.slice(0, 8)}-I`,
      parentId: objective.id,
    },
  });
  const initiative = graph.nodes.find(
    (n) => n.code === `QA-${run.slice(0, 8)}-I`,
  );
  created.push(initiative.id);
  await mutate({
    action: "link",
    sourceId: objective.id,
    targetId: initiative.id,
  });
  const link = graph.links.find(
    (l) => l.sourceId === objective.id && l.targetId === initiative.id,
  );
  await mutate({
    action: "save",
    node: { ...objective, nameEn: "Updated acceptance objective" },
  });
  const reload = await request("graph?domain=program");
  assert.equal(
    reload.nodes.find((n) => n.id === objective.id).nameEn,
    "Updated acceptance objective",
  );
  await request(
    "graph",
    {
      domain: "program",
      revision: graph.revision - 1,
      action: "delete",
      id: initiative.id,
    },
    409,
  );
  const audit = await request("audit?domain=program");
  assert.ok(
    audit.events.some(
      (e) =>
        e.entity_id === objective.id &&
        e.action === "structure.updated" &&
        e.before_json &&
        e.after_json,
    ),
  );
  await mutate({ action: "unlink", id: link.id });
  for (const id of [...created].reverse())
    await mutate({ action: "delete", id });
  created.length = 0;
  await request("logout", {});
  await request("graph?domain=program", undefined, 401);
  console.log(
    "PASS: deployed signup/login session, no automatic grants, organization isolation, create/update/link/delete, persistence, conflict rejection, before/after audit and logout.",
  );
} finally {
  if (userId) {
    // Restrict cleanup strictly to the synthetic IDs from this run; audit records are retained.
    for (const id of [...created].reverse())
      sql(
        `DELETE FROM links WHERE source_id='${id}' OR target_id='${id}'; DELETE FROM nodes WHERE id='${id}';`,
      );
    sql(`DELETE FROM users WHERE id='${userId}' AND email='${email}';`);
    console.log(
      "Synthetic acceptance account and records removed; audit evidence retained.",
    );
  }
}
