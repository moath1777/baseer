import type { D1Database } from "@cloudflare/workers-types";
import bcrypt from "bcryptjs";
import {
  AppError,
  roleNames,
  canRead,
  canWrite,
  parseNode,
  validateNode,
  visibleGraph,
  type Account,
  type Domain,
  type StructureLink,
  type Grant,
} from "../lib/foundation.ts";
import { graphFor, commitGraph, auditStatement } from "./db.ts";
import { passwordValid } from "./auth.ts";

export function parseDomain(value: unknown): Domain {
  if (value !== "program" && value !== "ministry")
    throw new AppError("INVALID_DOMAIN");
  return value;
}
export async function graphAction(
  db: D1Database,
  account: Account,
  body: Record<string, unknown>,
) {
  const domain = parseDomain(body.domain);
  if (!account.grants.some((g) => g.domain === domain))
    throw new AppError("FORBIDDEN", 403);
  const graph = await graphFor(db, domain);
  if (body.revision !== graph.revision) throw new AppError("CONFLICT", 409);
  if (body.action === "save") {
    if (!body.node || typeof body.node !== "object" || Array.isArray(body.node))
      throw new AppError("INVALID_FIELD");
    const raw = body.node as Record<string, unknown>;
    const id =
      typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID();
    const before = graph.nodes.find((n) => n.id === id) || null;
    if (raw.id && !before) throw new AppError("NOT_FOUND", 404);
    const node = parseNode(raw, domain, id);
    validateNode(node, graph, account);
    const statement = before
      ? db
          .prepare(
            "UPDATE nodes SET code=?,parent_id=?,unit_id=?,restricted=?,data=? WHERE id=? AND domain=?",
          )
          .bind(
            node.code,
            node.parentId,
            node.unitId,
            +node.restricted,
            JSON.stringify(node),
            id,
            domain,
          )
      : db
          .prepare(
            "INSERT INTO nodes(id,domain,kind,code,parent_id,unit_id,restricted,data) VALUES(?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            domain,
            node.kind,
            node.code,
            node.parentId,
            node.unitId,
            +node.restricted,
            JSON.stringify(node),
          );
    await commitGraph(db, graph, [
      statement,
      auditStatement(
        db,
        account,
        domain,
        before ? "structure.updated" : "structure.created",
        id,
        before,
        node,
      ),
    ]);
  } else if (body.action === "delete") {
    const node = graph.nodes.find((n) => n.id === body.id);
    if (!node || !canRead(account, node, graph.nodes))
      throw new AppError("NOT_FOUND", 404);
    if (!canWrite(account, node, graph.nodes))
      throw new AppError("FORBIDDEN", 403);
    if (
      graph.nodes.some((n) => n.parentId === node.id || n.unitId === node.id) ||
      graph.links.some((l) => l.sourceId === node.id || l.targetId === node.id)
    )
      throw new AppError("HAS_DEPENDENCIES", 409);
    await commitGraph(db, graph, [
      db
        .prepare("DELETE FROM nodes WHERE id=? AND domain=?")
        .bind(node.id, domain),
      auditStatement(
        db,
        account,
        domain,
        "structure.deleted",
        node.id,
        node,
        null,
      ),
    ]);
  } else if (body.action === "link" || body.action === "unlink") {
    let link: StructureLink;
    if (body.action === "unlink") {
      const found = graph.links.find((l) => l.id === body.id);
      if (!found) throw new AppError("NOT_FOUND", 404);
      link = found;
    } else {
      if (
        typeof body.sourceId !== "string" ||
        typeof body.targetId !== "string"
      )
        throw new AppError("INVALID_RELATION");
      link = {
        id: crypto.randomUUID(),
        sourceId: body.sourceId,
        targetId: body.targetId,
      };
    }
    const source = graph.nodes.find((n) => n.id === link.sourceId),
      target = graph.nodes.find((n) => n.id === link.targetId);
    if (
      !source ||
      !target ||
      !canWrite(account, source, graph.nodes) ||
      !canWrite(account, target, graph.nodes)
    )
      throw new AppError("FORBIDDEN", 403);
    if (
      source.kind !== "objective" ||
      !["indicator", "initiative"].includes(target.kind)
    )
      throw new AppError("INVALID_RELATION");
    if (source.restricted !== target.restricted)
      throw new AppError("RESTRICTED_PARENT");
    if (
      body.action === "link" &&
      graph.links.some(
        (l) => l.sourceId === link.sourceId && l.targetId === link.targetId,
      )
    )
      throw new AppError("DUPLICATE_LINK", 409);
    await commitGraph(db, graph, [
      body.action === "link"
        ? db
            .prepare(
              "INSERT INTO links(id,domain,source_id,target_id) VALUES(?,?,?,?)",
            )
            .bind(link.id, domain, link.sourceId, link.targetId)
        : db.prepare("DELETE FROM links WHERE id=?").bind(link.id),
      auditStatement(
        db,
        account,
        domain,
        body.action === "link" ? "link.created" : "link.deleted",
        link.id,
        body.action === "unlink" ? link : null,
        body.action === "link" ? link : null,
      ),
    ]);
  } else throw new AppError("INVALID_ACTION");
  return visibleGraph(account, await graphFor(db, domain));
}
export async function listUsers(db: D1Database, account: Account) {
  if (!account.admin) throw new AppError("FORBIDDEN", 403);
  const users = await db
    .prepare(
      "SELECT id,email,name,active,admin,must_change_password AS mustChangePassword FROM users ORDER BY created_at DESC",
    )
    .all<{
      id: string;
      email: string;
      name: string;
      active: number;
      admin: number;
      mustChangePassword: number;
    }>();
  const grants = await db
    .prepare(
      "SELECT id,user_id AS userId,domain,role,unit_id AS unitId,restricted FROM grants",
    )
    .all<Grant & { userId: string }>();
  return users.results.map((u) => ({
    ...u,
    active: !!u.active,
    admin: !!u.admin,
    mustChangePassword: !!u.mustChangePassword,
    grants: grants.results
      .filter((g) => g.userId === u.id)
      .map((g) => ({ ...g, restricted: !!g.restricted })),
  }));
}
export async function userAction(
  db: D1Database,
  account: Account,
  body: Record<string, unknown>,
) {
  if (!account.admin) throw new AppError("FORBIDDEN", 403);
  const target = typeof body.userId === "string" ? body.userId : "";
  const users = await listUsers(db, account);
  const before = users.find((u) => u.id === target);
  if (!before) throw new AppError("NOT_FOUND", 404);
  if (target === account.id) throw new AppError("SELF_CHANGE_FORBIDDEN");
  if (body.action === "access") {
    if (
      !Array.isArray(body.grants) ||
      body.grants.length > 30 ||
      typeof body.active !== "boolean" ||
      typeof body.admin !== "boolean"
    )
      throw new AppError("INVALID_FIELD");
    const grants: Grant[] = [];
    for (const raw of body.grants as Record<string, unknown>[]) {
      const domain = parseDomain(raw.domain);
      if (
        typeof raw.role !== "string" ||
        !Object.hasOwn(roleNames, raw.role) ||
        typeof raw.restricted !== "boolean" ||
        (raw.unitId !== null && typeof raw.unitId !== "string")
      )
        throw new AppError("INVALID_FIELD");
      if (raw.unitId) {
        const unit = await db
          .prepare(
            "SELECT id FROM nodes WHERE id=? AND domain=? AND kind='unit'",
          )
          .bind(raw.unitId, domain)
          .first();
        if (!unit) throw new AppError("INVALID_RELATION");
      }
      grants.push({
        id: crypto.randomUUID(),
        domain,
        role: raw.role as Grant["role"],
        unitId: raw.unitId as string | null,
        restricted: raw.restricted,
      });
    }
    await db.batch([
      db
        .prepare("UPDATE users SET active=?,admin=? WHERE id=?")
        .bind(+body.active, +body.admin, target),
      db.prepare("DELETE FROM grants WHERE user_id=?").bind(target),
      ...grants.map((g) =>
        db
          .prepare(
            "INSERT INTO grants(id,user_id,domain,role,unit_id,restricted) VALUES(?,?,?,?,?,?)",
          )
          .bind(g.id, target, g.domain, g.role, g.unitId, +g.restricted),
      ),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(target),
      auditStatement(
        db,
        account,
        null,
        "account.access_changed",
        target,
        before,
        { active: body.active, admin: body.admin, grants },
      ),
    ]);
  } else if (body.action === "reset-password") {
    if (!passwordValid(body.password)) throw new AppError("INVALID_PASSWORD");
    await db.batch([
      db
        .prepare(
          "UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?",
        )
        .bind(await bcrypt.hash(body.password, 12), target),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(target),
      auditStatement(
        db,
        account,
        null,
        "account.password_reset",
        target,
        null,
        null,
      ),
    ]);
  } else throw new AppError("INVALID_ACTION");
  return { ok: true };
}
