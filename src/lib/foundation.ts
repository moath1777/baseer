export const roleNames = {
  admin: { ar: "مدير النظام", en: "System administrator" },
  performance: { ar: "فريق الأداء", en: "Performance team" },
  strategy: { ar: "فريق الاستراتيجية", en: "Strategy team" },
  ambassador: { ar: "سفير الأداء", en: "Performance ambassador" },
  department: { ar: "إدارات الأداء", en: "Performance department" },
  owner: { ar: "مالك المؤشر", en: "Indicator owner" },
  director: { ar: "المدير العام لإدارة الأداء", en: "Performance director" },
  viewer: { ar: "مجموعات الاطلاع", en: "Leadership / read only" },
  strategy_head: {
    ar: "المسؤول الأول بقطاع الاستراتيجية",
    en: "Head of strategy",
  },
} as const;
export type AppRole = keyof typeof roleNames;
export type Domain = "program" | "ministry";
export const kindNames = {
  unit: { ar: "وحدة تنظيمية", en: "Organizational unit" },
  strategy: { ar: "استراتيجية", en: "Strategy" },
  plan: { ar: "خطة تشغيلية", en: "Operational plan" },
  objective: { ar: "هدف", en: "Objective" },
  indicator: { ar: "ارتباط مؤشر", en: "Indicator reference" },
  initiative: { ar: "مبادرة", en: "Initiative" },
} as const;
export type NodeKind = keyof typeof kindNames;
export type Grant = {
  id: string;
  domain: Domain;
  role: AppRole;
  unitId: string | null;
  restricted: boolean;
};
export type Account = {
  id: string;
  email: string;
  name: string;
  admin: boolean;
  active: boolean;
  mustChangePassword: boolean;
  grants: Grant[];
};
export type StructureNode = {
  id: string;
  domain: Domain;
  kind: NodeKind;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  parentId: string | null;
  unitId: string | null;
  restricted: boolean;
  level: "strategic" | "operational";
  owner: string;
  visionAr: string;
  visionEn: string;
  missionAr: string;
  missionEn: string;
  valuesAr: string;
  valuesEn: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
};
export type StructureLink = { id: string; sourceId: string; targetId: string };
export type Graph = {
  domain: Domain;
  revision: number;
  nodes: StructureNode[];
  links: StructureLink[];
};
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function descendants(id: string, nodes: StructureNode[]): Set<string> {
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes)
      if (n.parentId && result.has(n.parentId) && !result.has(n.id)) {
        result.add(n.id);
        changed = true;
      }
  }
  return result;
}
export function canRead(
  account: Account,
  node: StructureNode,
  nodes: StructureNode[],
) {
  return account.grants.some(
    (g) =>
      g.domain === node.domain &&
      (!node.restricted || g.restricted) &&
      (!g.unitId ||
        descendants(
          g.unitId,
          nodes.filter((n) => n.kind === "unit"),
        ).has(node.kind === "unit" ? node.id : node.unitId || "")),
  );
}
export function canWrite(
  account: Account,
  node: StructureNode,
  nodes: StructureNode[],
) {
  return account.grants.some((g) => {
    const scoped = { ...account, grants: [g] };
    if (!canRead(scoped, node, nodes)) return false;
    return (
      g.role === "admin" ||
      g.role === "strategy" ||
      (g.role === "performance" &&
        ["plan", "objective", "indicator", "initiative"].includes(node.kind) &&
        node.level === "operational")
    );
  });
}
export function visibleGraph(account: Account, graph: Graph): Graph {
  const nodes = graph.nodes.filter((n) => canRead(account, n, graph.nodes));
  const ids = new Set(nodes.map((n) => n.id));
  return {
    ...graph,
    nodes: nodes.map((n) => ({
      ...n,
      parentId: n.parentId && ids.has(n.parentId) ? n.parentId : null,
      unitId: n.unitId && ids.has(n.unitId) ? n.unitId : null,
    })),
    links: graph.links.filter(
      (l) => ids.has(l.sourceId) && ids.has(l.targetId),
    ),
  };
}
export const allowedParents: Record<NodeKind, NodeKind[]> = {
  unit: ["unit"],
  strategy: ["strategy"],
  plan: ["strategy", "plan"],
  objective: ["strategy", "plan", "objective"],
  indicator: ["objective"],
  initiative: ["objective"],
};
export function parseNode(
  raw: Record<string, unknown>,
  domain: Domain,
  id: string,
): StructureNode {
  const text = (key: string, max = 2000) => {
    const value = raw[key] ?? "";
    if (typeof value !== "string" || value.length > max)
      throw new AppError("INVALID_FIELD");
    return value.trim();
  };
  const kind = text("kind") as NodeKind;
  if (!Object.hasOwn(kindNames, kind)) throw new AppError("INVALID_KIND");
  const nameAr = text("nameAr", 160),
    nameEn = text("nameEn", 160),
    code = text("code", 40);
  if (!nameAr || !nameEn || !/^[\w.-]{1,40}$/.test(code))
    throw new AppError("INVALID_NAME_CODE");
  const startDate = text("startDate", 10),
    endDate = text("endDate", 10);
  for (const date of [startDate, endDate])
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw new AppError("INVALID_DATE");
  if (startDate && endDate && startDate > endDate)
    throw new AppError("INVALID_DATE");
  if (raw.level !== "strategic" && raw.level !== "operational")
    throw new AppError("INVALID_LEVEL");
  if (typeof raw.restricted !== "boolean") throw new AppError("INVALID_FIELD");
  return {
    id,
    domain,
    kind,
    code,
    nameAr,
    nameEn,
    descriptionAr: text("descriptionAr"),
    descriptionEn: text("descriptionEn"),
    parentId: text("parentId", 100) || null,
    unitId: text("unitId", 100) || null,
    restricted: raw.restricted,
    level: raw.level,
    owner: text("owner", 160),
    visionAr: text("visionAr"),
    visionEn: text("visionEn"),
    missionAr: text("missionAr"),
    missionEn: text("missionEn"),
    valuesAr: text("valuesAr"),
    valuesEn: text("valuesEn"),
    startDate,
    endDate,
    updatedAt: new Date().toISOString(),
  };
}
export function validateNode(
  node: StructureNode,
  graph: Graph,
  account: Account,
) {
  const old = graph.nodes.find((n) => n.id === node.id);
  if (old && old.kind !== node.kind) throw new AppError("KIND_IMMUTABLE");
  if (
    !canWrite(account, node, [
      ...graph.nodes.filter((n) => n.id !== node.id),
      node,
    ]) ||
    (old && !canWrite(account, old, graph.nodes))
  )
    throw new AppError("FORBIDDEN", 403);
  // Moving a scope anchor, or changing confidentiality, must not expose hidden descendants.
  if (
    old &&
    (old.parentId !== node.parentId ||
      old.unitId !== node.unitId ||
      old.restricted !== node.restricted)
  ) {
    const affected = descendants(old.id, graph.nodes);
    const related = graph.nodes.filter(
      (n) =>
        affected.has(n.id) ||
        (old.kind === "unit" && n.unitId && affected.has(n.unitId)),
    );
    if (related.some((n) => !canWrite(account, n, graph.nodes)))
      throw new AppError("FORBIDDEN", 403);
    if (
      old.kind === "unit" &&
      !account.grants.some(
        (g) =>
          g.domain === node.domain &&
          !g.unitId &&
          ["admin", "strategy"].includes(g.role),
      )
    )
      throw new AppError("FORBIDDEN", 403);
  }
  if (
    graph.nodes.some(
      (n) =>
        n.id !== node.id && n.code.toLowerCase() === node.code.toLowerCase(),
    )
  )
    throw new AppError("DUPLICATE_CODE", 409);
  if (!node.parentId && !["unit", "strategy"].includes(node.kind))
    throw new AppError("PARENT_REQUIRED");
  for (const [id, relation] of [
    [node.parentId, "parent"],
    [node.unitId, "unit"],
  ] as const) {
    if (!id) continue;
    const target = graph.nodes.find((n) => n.id === id);
    if (!target || !canRead(account, target, graph.nodes))
      throw new AppError("INVALID_RELATION");
    if (
      relation === "unit"
        ? target.kind !== "unit"
        : !allowedParents[node.kind].includes(target.kind)
    )
      throw new AppError("INVALID_RELATION");
    if (target.restricted && !node.restricted)
      throw new AppError("RESTRICTED_PARENT");
  }
  if (node.kind === "unit" && node.unitId)
    throw new AppError("INVALID_RELATION");
  if (node.parentId && descendants(node.id, graph.nodes).has(node.parentId))
    throw new AppError("CYCLE");
  if (
    node.restricted &&
    graph.nodes.some(
      (n) => (n.parentId === node.id || n.unitId === node.id) && !n.restricted,
    )
  )
    throw new AppError("RESTRICTED_CHILDREN");
}
