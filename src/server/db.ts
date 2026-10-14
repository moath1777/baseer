import { getCloudflareContext } from "@opennextjs/cloudflare";
import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import {
  AppError,
  type Account,
  type Domain,
  type Graph,
  type StructureNode,
  type StructureLink,
} from "../lib/foundation.ts";
export async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new AppError("DATABASE_UNAVAILABLE", 503);
  return db;
}
export async function graphFor(db: D1Database, domain: Domain): Promise<Graph> {
  const results = await db.batch([
    db.prepare("SELECT revision FROM organizations WHERE id=?").bind(domain),
    db
      .prepare("SELECT data FROM nodes WHERE domain=? ORDER BY code")
      .bind(domain),
    db
      .prepare(
        "SELECT id, source_id AS sourceId, target_id AS targetId FROM links WHERE domain=?",
      )
      .bind(domain),
  ]);
  return {
    domain,
    revision: (results[0].results[0] as { revision: number }).revision,
    nodes: (results[1].results as { data: string }[]).map(
      (n) => JSON.parse(n.data) as StructureNode,
    ),
    links: results[2].results as StructureLink[],
  };
}
export function auditStatement(
  db: D1Database,
  actor: Pick<Account, "id" | "name">,
  domain: Domain | null,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  return db
    .prepare(
      "INSERT INTO audit(id,domain,actor_id,actor_name,action,entity_id,before_json,after_json,at) VALUES(?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      domain,
      actor.id,
      actor.name,
      action,
      entityId,
      before === null ? null : JSON.stringify(before),
      after === null ? null : JSON.stringify(after),
      new Date().toISOString(),
    );
}
export async function commitGraph(
  db: D1Database,
  graph: Graph,
  statements: D1PreparedStatement[],
) {
  const guard = crypto.randomUUID();
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO write_guards(id,ok) VALUES(?,(SELECT revision=? FROM organizations WHERE id=?))",
        )
        .bind(guard, graph.revision, graph.domain),
      ...statements,
      db
        .prepare("UPDATE organizations SET revision=revision+1 WHERE id=?")
        .bind(graph.domain),
      db.prepare("DELETE FROM write_guards WHERE id=?").bind(guard),
    ]);
  } catch (error) {
    if (String(error).includes("CHECK constraint"))
      throw new AppError("CONFLICT", 409);
    if (String(error).includes("FOREIGN KEY"))
      throw new AppError("HAS_DEPENDENCIES", 409);
    throw error;
  }
}
