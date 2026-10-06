export type Locale = "ar" | "en";
export type Text = { ar: string; en: string };
export type Role = "performance" | "ambassador" | "owner" | "viewer";
export type Period = "2026-Q3" | "2026-Q2" | "2026-Q1";
export type Status = "draft" | "submitted" | "returned" | "approved";
export type Direction = "positive" | "negative";
export type Measurement = {
  id: string;
  kpiId: string;
  period: Period;
  value: number;
  status: Status;
  observation: string;
  evidence: string[];
  comment: string;
  updatedAt: string;
};
export type KPI = {
  id: string;
  code: string;
  name: Text;
  description: Text;
  domain: "program" | "ministry";
  objective: string;
  sector: Text;
  owner: Text;
  ambassador: Text;
  unit: "percent" | "days";
  direction: Direction;
  target: number;
  baseline: number;
  type: "standalone" | "composite";
  children: { id: string; weight: number }[];
  createdAt: string;
};
export type AuditEvent = {
  id: string;
  kpiId: string;
  action: Text;
  actor: Text;
  at: string;
  detail: string;
};
export type Store = {
  version: 1;
  kpis: KPI[];
  measurements: Measurement[];
  events: AuditEvent[];
};

export const roles: Record<Role, Text> = {
  performance: { ar: "فريق الأداء", en: "Performance team" },
  ambassador: { ar: "سفير الأداء", en: "Performance ambassador" },
  owner: { ar: "مالك المؤشر", en: "KPI owner" },
  viewer: { ar: "القيادة · اطلاع", en: "Leadership · read only" },
};
export const statusNames: Record<Status | "missing", Text> = {
  approved: { ar: "معتمد", en: "Approved" },
  submitted: { ar: "بانتظار المراجعة", en: "In review" },
  draft: { ar: "مسودة", en: "Draft" },
  returned: { ar: "معاد للاستكمال", en: "Returned" },
  missing: { ar: "لم يُدخل", en: "Not entered" },
};
export const objectives = [
  {
    id: "digital",
    name: {
      ar: "تسريع التحول الرقمي",
      en: "Accelerate digital transformation",
    },
    description: {
      ar: "خدمات مترابطة وإجراءات أكثر كفاءة",
      en: "Connected services and more efficient processes",
    },
  },
  {
    id: "people",
    name: {
      ar: "تنمية القدرات المؤسسية",
      en: "Develop institutional capabilities",
    },
    description: {
      ar: "كفاءات مؤهلة وجاهزية مستدامة",
      en: "Skilled teams and lasting readiness",
    },
  },
  {
    id: "excellence",
    name: {
      ar: "تعزيز التميز المؤسسي",
      en: "Advance institutional excellence",
    },
    description: {
      ar: "جودة أعلى ونتائج قابلة للقياس",
      en: "Better quality and measurable outcomes",
    },
  },
];
export function achievement(
  value: number,
  target: number,
  direction: Direction,
): number | null {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(target) ||
    target <= 0 ||
    value < 0
  )
    return null;
  if (direction === "negative" && value === 0) return null;
  return direction === "positive"
    ? (value / target) * 100
    : (target / value) * 100;
}
export function scoreFor(
  kpi: KPI,
  period: Period,
  store: Store,
  visited: Set<string> = new Set(),
): number | null {
  if (visited.has(kpi.id)) return null;
  if (kpi.type === "standalone") {
    const m = store.measurements.find(
      (m) => m.kpiId === kpi.id && m.period === period,
    );
    return m?.status === "approved"
      ? achievement(m.value, kpi.target, kpi.direction)
      : null;
  }
  if (!kpi.children.length) return null;
  const next = new Set(visited).add(kpi.id);
  let result = 0,
    total = 0;
  for (const child of kpi.children) {
    const target = store.kpis.find(
      (k) => k.id === child.id && k.domain === kpi.domain,
    );
    if (!target || !Number.isFinite(child.weight) || child.weight <= 0)
      return null;
    const score = scoreFor(target, period, store, next);
    if (score === null) return null;
    result += score * child.weight;
    total += child.weight;
  }
  return total > 0 ? result / total : null;
}
export function performanceBand(
  score: number | null,
): "good" | "watch" | "risk" | "neutral" {
  return score === null
    ? "neutral"
    : score >= 100
      ? "good"
      : score >= 85
        ? "watch"
        : "risk";
}
export function transition(
  measurement: Measurement,
  action: "submit" | "approve" | "return",
  role: Role,
  comment = "",
): Measurement {
  if (measurement.period !== "2026-Q3") throw new Error("PERIOD_LOCKED");
  if (action === "submit") {
    if (
      !["ambassador", "performance"].includes(role) ||
      !["draft", "returned"].includes(measurement.status)
    )
      throw new Error("INVALID_TRANSITION");
    if (!Number.isFinite(measurement.value) || measurement.value < 0)
      throw new Error("INVALID_VALUE");
    return {
      ...measurement,
      status: "submitted",
      updatedAt: new Date().toISOString(),
    };
  }
  if (
    !["owner", "performance"].includes(role) ||
    measurement.status !== "submitted"
  )
    throw new Error("INVALID_TRANSITION");
  if (action === "return" && !comment.trim())
    throw new Error("COMMENT_REQUIRED");
  return {
    ...measurement,
    status: action === "approve" ? "approved" : "returned",
    comment: comment.trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function isStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const s = value as Store;
  return (
    s.version === 1 &&
    Array.isArray(s.kpis) &&
    Array.isArray(s.measurements) &&
    Array.isArray(s.events) &&
    s.kpis.every(
      (k) =>
        k &&
        typeof k.id === "string" &&
        typeof k.name?.ar === "string" &&
        typeof k.name?.en === "string" &&
        typeof k.description?.ar === "string" &&
        typeof k.description?.en === "string" &&
        typeof k.sector?.ar === "string" &&
        typeof k.sector?.en === "string" &&
        typeof k.owner?.ar === "string" &&
        typeof k.owner?.en === "string" &&
        typeof k.ambassador?.ar === "string" &&
        typeof k.ambassador?.en === "string" &&
        ["program", "ministry"].includes(k.domain) &&
        ["standalone", "composite"].includes(k.type) &&
        ["positive", "negative"].includes(k.direction) &&
        ["percent", "days"].includes(k.unit) &&
        Number.isFinite(k.target) &&
        k.target > 0 &&
        Number.isFinite(k.baseline) &&
        Array.isArray(k.children) &&
        k.children.every(
          (c) =>
            typeof c.id === "string" &&
            Number.isFinite(c.weight) &&
            c.weight > 0,
        ),
    ) &&
    s.measurements.every(
      (m) =>
        m &&
        typeof m.id === "string" &&
        typeof m.kpiId === "string" &&
        ["2026-Q3", "2026-Q2", "2026-Q1"].includes(m.period) &&
        ["draft", "submitted", "returned", "approved"].includes(m.status) &&
        Number.isFinite(m.value) &&
        m.value >= 0 &&
        typeof m.observation === "string" &&
        typeof m.comment === "string" &&
        Array.isArray(m.evidence) &&
        m.evidence.every((e) => typeof e === "string"),
    ) &&
    s.events.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.kpiId === "string" &&
        typeof e.action?.ar === "string" &&
        typeof e.action?.en === "string" &&
        typeof e.actor?.ar === "string" &&
        typeof e.actor?.en === "string" &&
        typeof e.at === "string" &&
        typeof e.detail === "string",
    )
  );
}
