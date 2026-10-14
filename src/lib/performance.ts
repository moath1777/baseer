import type { KPI, Locale, Period, Store, Text } from "./domain";
import { performanceBand, scoreFor } from "./domain.ts";

export const levelNames: Record<NonNullable<KPI["level"]>, Text> = {
  strategic: { ar: "استراتيجي", en: "Strategic" },
  "sub-strategic": { ar: "استراتيجي فرعي", en: "Sub-strategic" },
  operational: { ar: "تشغيلي", en: "Operational" },
  "composite-operational": { ar: "تشغيلي مركب", en: "Composite operational" },
  "sub-operational": { ar: "تشغيلي فرعي", en: "Sub-operational" },
};
export const frequencyNames = {
  quarterly: { ar: "ربع سنوي", en: "Quarterly" },
  semiannual: { ar: "نصف سنوي", en: "Semiannual" },
  annual: { ar: "سنوي", en: "Annual" },
};
export function kpiLevel(k: KPI) {
  return (
    k.level ??
    (k.type === "composite" || k.domain === "ministry"
      ? "strategic"
      : "operational")
  );
}
export function kpiUnit(k: KPI) {
  return k.organizationalUnit ?? k.owner;
}
export const emptyFilters = {
  query: "",
  level: "all",
  type: "all",
  frequency: "all",
  status: "all",
  owner: "all",
  sector: "all",
  unit: "all",
  objective: "all",
};
export type PerformanceFilters = typeof emptyFilters;
export function filterIndicators(
  items: KPI[],
  filters: PerformanceFilters,
  period: Period,
  store: Store,
) {
  const q = filters.query.trim().toLocaleLowerCase();
  return items.filter((k) => {
    const status = performanceBand(scoreFor(k, period, store));
    return (
      (!q ||
        [k.name.ar, k.name.en, k.code, k.owner.ar, k.owner.en].some((v) =>
          v.toLocaleLowerCase().includes(q),
        )) &&
      (filters.level === "all" ||
        (filters.level === "strategic"
          ? kpiLevel(k).includes("strategic")
          : kpiLevel(k).includes("operational"))) &&
      (filters.type === "all" || filters.type === k.type) &&
      (filters.frequency === "all" ||
        filters.frequency === (k.frequency ?? "quarterly")) &&
      (filters.status === "all" || filters.status === status) &&
      (filters.owner === "all" || filters.owner === k.owner.ar) &&
      (filters.sector === "all" || filters.sector === k.sector.ar) &&
      (filters.unit === "all" || filters.unit === kpiUnit(k).ar) &&
      (filters.objective === "all" || filters.objective === k.objective)
    );
  });
}

export type Initiative = {
  id: string;
  name: Text;
  description: Text;
  domain: KPI["domain"];
  objective: string;
  sector: Text;
  owner: Text;
  progress: number;
  status: "on-track" | "delayed" | "complete";
  due: string;
};
export const initiatives: Initiative[] = [
  {
    id: "INIT-001",
    name: { ar: "تطوير الخدمات الرقمية", en: "Digital services development" },
    description: {
      ar: "توحيد قنوات تقديم الخدمات وأتمتة الإجراءات ذات الأولوية.",
      en: "Unify service channels and automate priority processes.",
    },
    domain: "program",
    objective: "digital",
    sector: { ar: "التحول الرقمي", en: "Digital transformation" },
    owner: { ar: "إدارة التحول الرقمي", en: "Digital Transformation Dept." },
    progress: 74,
    status: "on-track",
    due: "2026-12-31",
  },
  {
    id: "INIT-002",
    name: {
      ar: "تنمية القدرات المهنية",
      en: "Professional capability development",
    },
    description: {
      ar: "تنفيذ مسارات تأهيل وتطوير الكفاءات المؤسسية.",
      en: "Deliver institutional training and development tracks.",
    },
    domain: "program",
    objective: "people",
    sector: { ar: "رأس المال البشري", en: "Human capital" },
    owner: { ar: "إدارة تطوير الكفاءات", en: "Capability Development Dept." },
    progress: 48,
    status: "delayed",
    due: "2026-11-30",
  },
  {
    id: "INIT-003",
    name: { ar: "تحسين جودة الخدمات", en: "Service quality improvement" },
    description: {
      ar: "مراجعة معايير الخدمة وتحسين تجربة المستفيد.",
      en: "Review service standards and improve beneficiary experience.",
    },
    domain: "ministry",
    objective: "excellence",
    sector: { ar: "الجودة والتطوير", en: "Quality and development" },
    owner: { ar: "إدارة الجودة", en: "Quality Dept." },
    progress: 100,
    status: "complete",
    due: "2026-09-30",
  },
];

export function csvCell(value: string | number) {
  const safe = String(value).replace(/^[=+@\-\t\r]/, "'$&");
  return `"${safe.replaceAll('"', '""')}"`;
}
export function indicatorsCsv(
  items: KPI[],
  store: Store,
  period: Period,
  locale: Locale,
) {
  const headers =
    locale === "ar"
      ? [
          "الرمز",
          "المؤشر",
          "المستوى",
          "القطاع",
          "الوحدة التنظيمية",
          "المالك",
          "الدورية",
          "الفترة",
          "المستهدف",
          "نسبة التحقيق المعتمدة",
        ]
      : [
          "Code",
          "Indicator",
          "Level",
          "Sector",
          "Unit",
          "Owner",
          "Frequency",
          "Period",
          "Target",
          "Approved achievement",
        ];
  return (
    "\uFEFF" +
    [
      headers,
      ...items.map((k) => [
        k.code,
        k.name[locale],
        levelNames[kpiLevel(k)][locale],
        k.sector[locale],
        kpiUnit(k)[locale],
        k.owner[locale],
        frequencyNames[k.frequency ?? "quarterly"][locale],
        period,
        k.periodicTargets?.[period] ?? k.target,
        scoreFor(k, period, store)?.toFixed(2) ?? "",
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}
