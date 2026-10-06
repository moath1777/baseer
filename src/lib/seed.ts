import type { KPI, Store, Period, Status } from "./domain";
const t = (ar: string, en: string) => ({ ar, en });
const base = {
  domain: "program" as const,
  unit: "percent" as const,
  direction: "positive" as const,
  type: "standalone" as const,
  children: [],
  createdAt: "2026-01-01T09:00:00Z",
};
export const seedKpis: KPI[] = [
  {
    ...base,
    id: "digital-services",
    code: "KPI-001",
    name: t("نسبة الخدمات المؤتمتة", "Automated services"),
    description: t(
      "نسبة الخدمات التي اكتملت أتمتتها من إجمالي الخدمات المستهدفة ضمن خطة التحول الرقمي.",
      "Share of fully automated services within the digital transformation plan.",
    ),
    objective: "digital",
    sector: t("التحول الرقمي", "Digital transformation"),
    owner: t("إدارة التحول الرقمي", "Digital Transformation Dept."),
    ambassador: t("أحمد العتيبي", "Ahmed Alotaibi"),
    target: 90,
    baseline: 65,
  },
  {
    ...base,
    id: "capabilities",
    code: "KPI-002",
    name: t(
      "نسبة إنجاز خطة تطوير الكفاءات",
      "Capability development plan completion",
    ),
    description: t(
      "نسبة البرامج التدريبية المنجزة من إجمالي البرامج المعتمدة للفترة.",
      "Completed training programmes as a share of the approved period plan.",
    ),
    objective: "people",
    sector: t("رأس المال البشري", "Human capital"),
    owner: t("إدارة تطوير الكفاءات", "Capability Development Dept."),
    ambassador: t("نورة القحطاني", "Noura Alqahtani"),
    target: 85,
    baseline: 60,
  },
  {
    ...base,
    id: "satisfaction",
    code: "KPI-003",
    name: t("رضا المستفيدين عن الخدمات", "Beneficiary satisfaction"),
    description: t(
      "متوسط نسبة رضا المستفيدين وفق استبيان جودة الخدمات المعتمد.",
      "Beneficiary satisfaction based on the approved service quality survey.",
    ),
    objective: "excellence",
    sector: t("التميز المؤسسي", "Institutional excellence"),
    owner: t("إدارة جودة الخدمات", "Service Quality Dept."),
    ambassador: t("سارة الدوسري", "Sara Aldosari"),
    target: 90,
    baseline: 78,
  },
  {
    ...base,
    id: "resolution",
    code: "KPI-004",
    name: t("متوسط زمن معالجة الطلبات", "Average request resolution time"),
    description: t(
      "متوسط عدد أيام العمل اللازمة لمعالجة الطلبات المكتملة. القيمة الأقل تعني أداءً أفضل.",
      "Average business days to resolve complete requests. Lower values indicate better performance.",
    ),
    objective: "digital",
    sector: t("التحول الرقمي", "Digital transformation"),
    owner: t("إدارة العمليات", "Operations Dept."),
    ambassador: t("أحمد العتيبي", "Ahmed Alotaibi"),
    target: 5,
    baseline: 12,
    direction: "negative",
    unit: "days",
  },
  {
    ...base,
    id: "compliance",
    code: "KPI-005",
    name: t("الالتزام بمتطلبات الحوكمة", "Governance compliance"),
    description: t(
      "نسبة متطلبات الحوكمة المستوفاة من إجمالي المتطلبات المطبقة على الجهة.",
      "Fulfilled governance requirements as a share of applicable requirements.",
    ),
    objective: "excellence",
    sector: t("الحوكمة والالتزام", "Governance and compliance"),
    owner: t("إدارة الحوكمة", "Governance Dept."),
    ambassador: t("خالد الحربي", "Khalid Alharbi"),
    target: 95,
    baseline: 80,
  },
  {
    ...base,
    id: "readiness",
    code: "KPI-006",
    name: t("مؤشر الجاهزية المؤسسية", "Institutional readiness index"),
    description: t(
      "متوسط موزون لنسب تحقيق مستهدفات الخدمات المؤتمتة وتطوير الكفاءات، بأوزان متساوية.",
      "Equally weighted achievement scores for automated services and capability development.",
    ),
    objective: "people",
    sector: t("الأداء المؤسسي", "Institutional performance"),
    owner: t("إدارة الأداء", "Performance Dept."),
    ambassador: t("نورة القحطاني", "Noura Alqahtani"),
    target: 100,
    baseline: 72,
    type: "composite",
    children: [
      { id: "digital-services", weight: 50 },
      { id: "capabilities", weight: 50 },
    ],
  },
  {
    ...base,
    id: "ministry-quality",
    code: "MNG-001",
    domain: "ministry",
    name: t("جودة الخدمات المؤسسية", "Institutional service quality"),
    description: t(
      "نسبة الخدمات المستوفية لمعايير الجودة المعتمدة.",
      "Services meeting the approved quality standards.",
    ),
    objective: "excellence",
    sector: t("الجودة والتطوير", "Quality and development"),
    owner: t("إدارة الجودة", "Quality Dept."),
    ambassador: t("محمد الشهري", "Mohammed Alshahri"),
    target: 95,
    baseline: 80,
  },
  {
    ...base,
    id: "ministry-training",
    code: "MNG-002",
    domain: "ministry",
    name: t("تغطية الاحتياج التدريبي", "Training needs coverage"),
    description: t(
      "نسبة الاحتياجات التدريبية التي تمت تغطيتها خلال الفترة.",
      "Share of identified training needs addressed in the period.",
    ),
    objective: "people",
    sector: t("الموارد البشرية", "Human resources"),
    owner: t("إدارة التدريب", "Training Dept."),
    ambassador: t("ريم الغامدي", "Reem Alghamdi"),
    target: 90,
    baseline: 68,
  },
];
export function freshStore(): Store {
  const rows: [string, number, Status][] = [
    ["digital-services", 92, "approved"],
    ["capabilities", 76, "approved"],
    ["satisfaction", 88, "submitted"],
    ["resolution", 7, "returned"],
    ["compliance", 97, "draft"],
    ["ministry-quality", 94, "approved"],
    ["ministry-training", 82, "submitted"],
  ];
  return {
    version: 1,
    kpis: structuredClone(seedKpis),
    measurements: rows.flatMap(([id, value, status]) =>
      (["2026-Q1", "2026-Q2", "2026-Q3"] as Period[]).map((period, index) => ({
        id: `${id}-${period}`,
        kpiId: id,
        period,
        value:
          index === 2
            ? value
            : id === "resolution"
              ? 10 - index * 2
              : Math.max(0, value - (2 - index) * 7),
        status: index === 2 ? status : "approved",
        observation:
          index === 2 && id === "satisfaction"
            ? "نتائج الاستبيان التجريبي للفترة، بعد استبعاد الردود غير المكتملة."
            : "",
        evidence: id === "satisfaction" ? ["نتائج استبيان المستفيدين.pdf"] : [],
        comment:
          id === "resolution" && index === 2
            ? "يرجى توضيح سبب ارتفاع زمن المعالجة وإرفاق خطة التحسين."
            : "",
        updatedAt: "2026-09-28T09:30:00Z",
      })),
    ),
    events: [],
  };
}
