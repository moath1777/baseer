"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  ChartNoAxesCombined,
  ClipboardList,
  GitPullRequest,
  Settings2,
  Search,
  Bell,
  ChevronDown,
  Plus,
  ArrowLeft,
  ArrowRight,
  Layers,
  Target,
  Clock3,
  CircleCheck,
  CalendarDays,
  ShieldCheck,
  Menu,
  X,
  FileText,
  LockKeyhole,
  CheckCheck,
  Info,
  History,
  RotateCcw,
  Building2,
  ListTree,
} from "lucide-react";
import { freshStore } from "@/lib/seed";
import {
  type Locale,
  type KPI,
  type Period,
  type Role,
  type Measurement,
  type AuditEvent,
  type Text,
  scoreFor,
  objectives,
  roles,
  transition,
} from "@/lib/domain";
import { Badge, Score, Progress, Dialog, Empty, DirectionArrow } from "./ui";
import { CreateIndicator, MeasurementForm, ReviewForm } from "./workflows";
import { useWorkspace } from "./workspace-provider";

const navigation = [
  { id: "overview", icon: LayoutDashboard, ar: "نظرة عامة", en: "Overview" },
  {
    id: "strategy",
    icon: Network,
    ar: "الهيكل الاستراتيجي",
    en: "Strategy structure",
  },
  {
    id: "indicators",
    icon: ChartNoAxesCombined,
    ar: "مؤشرات الأداء",
    en: "Performance indicators",
  },
  {
    id: "measurements",
    icon: ClipboardList,
    ar: "دورة القياس",
    en: "Measurement cycle",
  },
  {
    id: "approvals",
    icon: GitPullRequest,
    ar: "الطلبات والموافقات",
    en: "Requests & approvals",
  },
];
const periodLabel = (period: Period, locale: Locale) =>
  locale === "ar"
    ? `الربع ${period === "2026-Q3" ? "الثالث" : period === "2026-Q2" ? "الثاني" : "الأول"} 2026`
    : `Q${period.slice(-1)} 2026`;
const domainLabel = (domain: string, locale: Locale) =>
  domain === "program"
    ? locale === "ar"
      ? "برنامج التطوير"
      : "Development program"
    : locale === "ar"
      ? "وزارة الحرس الوطني"
      : "Ministry of National Guard";

export function Workspace() {
  const path = usePathname();
  const router = useRouter();
  const section = path.split("/")[1] || "overview";
  const detailId = section === "indicators" ? path.split("/")[2] : undefined;
  const {
    locale,
    setLocale,
    domain,
    setDomain,
    period,
    setPeriod,
    role,
    setRole,
    store,
    ready,
    storageError,
    save,
    query,
    setQuery,
    kind,
    setKind,
    filter,
    setFilter,
    toast,
    setToast,
  } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dialog, setDialog] = useState<"create" | "search" | "reset" | null>(
    null,
  );
  const [measureKpi, setMeasureKpi] = useState<KPI | null>(null);
  const [review, setReview] = useState<Measurement | null>(null);
  const [strategyView, setStrategyView] = useState<
    "strategic" | "organizational"
  >("strategic");
  const [detailTab, setDetailTab] = useState("overview");
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const L = (text: Text) => text[locale];
  useEffect(() => {
    setMobileOpen(false);
    setDetailTab("overview");
  }, [path]);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);
  const kpis = store.kpis.filter((k) => k.domain === domain);
  const standalone = kpis.filter((k) => k.type === "standalone");
  const measurementFor = (kpi: KPI) =>
    store.measurements.find((m) => m.kpiId === kpi.id && m.period === period);
  const measurements = store.measurements.filter(
    (m) => m.period === period && kpis.some((k) => k.id === m.kpiId),
  );
  const pending = measurements.filter((m) => m.status === "submitted");
  const approved = measurements.filter((m) => m.status === "approved");
  const scores = standalone
    .map((k) => scoreFor(k, period, store))
    .filter((s): s is number => s !== null);
  const overall = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
  const completion = standalone.length
    ? (approved.length / standalone.length) * 100
    : 0;
  const canCreate = role === "performance";
  const canInput =
    ["performance", "ambassador"].includes(role) && period === "2026-Q3";
  const canReview =
    ["performance", "owner"].includes(role) && period === "2026-Q3";
  const selected = kpis.find((k) => k.id === detailId);
  const currentNav = navigation.find((n) => n.id === section);
  const newEvent = (kpiId: string, action: Text, detail = ""): AuditEvent => ({
    id: crypto.randomUUID(),
    kpiId,
    action,
    actor: roles[role],
    at: new Date().toISOString(),
    detail,
  });
  const displayDate = (date: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
      day: "numeric",
      month: "short",
      calendar: "gregory",
      numberingSystem: "latn",
    }).format(new Date(date));
  const createKpi = (kpi: KPI) => {
    save({
      ...store,
      kpis: [...store.kpis, kpi],
      events: [
        newEvent(kpi.id, { ar: "إنشاء بطاقة المؤشر", en: "KPI card created" }),
        ...store.events,
      ],
    });
    setDialog(null);
    router.push(`/indicators/${kpi.id}`);
    setToast(
      T("تم حفظ بطاقة المؤشر على هذا الجهاز", "KPI card saved on this device"),
    );
  };
  const saveMeasurement = (m: Measurement) => {
    save({
      ...store,
      measurements: [
        ...store.measurements.filter(
          (x) => !(x.kpiId === m.kpiId && x.period === m.period),
        ),
        m,
      ],
      events: [
        newEvent(
          m.kpiId,
          m.status === "submitted"
            ? { ar: "إرسال القياس للمراجعة", en: "Measurement submitted" }
            : { ar: "حفظ مسودة القياس", en: "Measurement draft saved" },
          m.observation,
        ),
        ...store.events,
      ],
    });
    setMeasureKpi(null);
    setToast(
      m.status === "submitted"
        ? T("تم إرسال القياس إلى قائمة المراجعة", "Measurement sent for review")
        : T("تم حفظ مسودة القياس", "Measurement draft saved"),
    );
  };
  const decide = (action: "approve" | "return", comment: string) => {
    if (!review) return;
    try {
      const changed = transition(review, action, role, comment);
      save({
        ...store,
        measurements: store.measurements.map((m) =>
          m.id === changed.id ? changed : m,
        ),
        events: [
          newEvent(
            changed.kpiId,
            action === "approve"
              ? { ar: "اعتماد القياس", en: "Measurement approved" }
              : { ar: "إعادة القياس للاستكمال", en: "Measurement returned" },
            comment,
          ),
          ...store.events,
        ],
      });
      setReview(null);
      setToast(
        action === "approve"
          ? T(
              "اعتمد القياس وانعكس على نتائج الأداء",
              "Measurement approved; performance updated",
            )
          : T(
              "أعيد القياس للاستكمال مع الملاحظات",
              "Measurement returned with feedback",
            ),
      );
    } catch {
      setToast(
        T(
          "تعذر تنفيذ الإجراء. تحقق من الدور وحالة القياس.",
          "Action unavailable. Check the role and measurement status.",
        ),
      );
    }
  };
  const filteredKpis = kpis.filter(
    (k) =>
      (!query ||
        `${k.name.ar} ${k.name.en} ${k.code} ${k.owner.ar} ${k.owner.en}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (kind === "all" || k.type === kind) &&
      (filter === "all" || measurementFor(k)?.status === filter),
  );

  function KpiTable({
    items,
    compact = false,
  }: {
    items: KPI[];
    compact?: boolean;
  }) {
    if (!items.length)
      return (
        <Empty
          title={T("لا توجد مؤشرات مطابقة", "No matching indicators")}
          detail={T(
            "جرّب تعديل البحث أو عوامل التصفية.",
            "Try a different search or filter.",
          )}
        />
      );
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{T("المؤشر", "Indicator")}</th>
              {!compact && <th>{T("الجهة المالكة", "Owner")}</th>}
              <th>{T("المستهدف", "Target")}</th>
              <th>{T("الفعلي", "Actual")}</th>
              <th>{T("نسبة التحقيق", "Achievement")}</th>
              <th>{T("حالة القياس", "Measurement")}</th>
              <th>
                <span className="sr-only">{T("التفاصيل", "Details")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => {
              const m = measurementFor(k);
              const score = scoreFor(k, period, store);
              return (
                <tr key={k.id}>
                  <td>
                    <Link className="kpi-name" href={`/indicators/${k.id}`}>
                      <span
                        className={`kpi-symbol ${k.type === "composite" ? "composite" : ""}`}
                      >
                        {k.type === "composite" ? (
                          <Layers size={17} />
                        ) : (
                          <ChartNoAxesCombined size={17} />
                        )}
                      </span>
                      <span>
                        <strong>{L(k.name)}</strong>
                        <small>
                          <bdi>{k.code}</bdi>
                          {k.type === "composite" &&
                            ` · ${T("مؤشر مركب", "Composite")}`}
                        </small>
                      </span>
                    </Link>
                  </td>
                  {!compact && <td className="muted">{L(k.owner)}</td>}
                  <td className="numeric">
                    {k.target}
                    {k.unit === "percent" ? "%" : T(" أيام", " days")}
                  </td>
                  <td className="numeric">
                    {k.type === "composite"
                      ? score === null
                        ? "—"
                        : `${score.toFixed(1)}%`
                      : m
                        ? `${m.value}${k.unit === "percent" ? "%" : ""}`
                        : "—"}
                  </td>
                  <td>
                    <Score value={score} locale={locale} />
                  </td>
                  <td>
                    {k.type === "composite" ? (
                      <span className="muted small">
                        {T("احتساب آلي", "Calculated")}
                      </span>
                    ) : (
                      <Badge status={m?.status ?? "missing"} locale={locale} />
                    )}
                  </td>
                  <td>
                    <Link
                      className="icon-button"
                      href={`/indicators/${k.id}`}
                      aria-label={`${T("عرض", "View")} ${L(k.name)}`}
                    >
                      <DirectionArrow locale={locale} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  function Heading({
    eyebrow,
    title,
    subtitle,
    action,
  }: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
  }) {
    return (
      <div className="page-heading">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="heading-actions">{action}</div>}
      </div>
    );
  }
  const createButton = canCreate ? (
    <button className="button primary" onClick={() => setDialog("create")}>
      <Plus size={17} />
      {T("إنشاء مؤشر", "Create indicator")}
    </button>
  ) : null;
  function TrendChart() {
    const periods: Period[] = ["2026-Q1", "2026-Q2", "2026-Q3"];
    const data = periods.slice(0, Number(period.slice(-1))).map((p) => {
      const vals = standalone
        .map((k) => scoreFor(k, p, store))
        .filter((s): s is number => s !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    const points = data.flatMap((v, i) =>
      v === null
        ? []
        : [{ x: 60 + i * 215, y: 190 - (Math.min(120, v) / 120) * 160, v, i }],
    );
    const line = points.map((p) => `${p.x},${p.y}`).join(" ");
    return (
      <div className="trend-chart">
        <svg
          viewBox="0 0 560 230"
          role="img"
          aria-label={T(
            "اتجاه متوسط تحقيق المؤشرات المعتمدة حسب الربع",
            "Average approved KPI achievement by quarter",
          )}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#447e6e" stopOpacity=".17" />
              <stop offset="100%" stopColor="#447e6e" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 60, 80, 100, 120].map((v) => (
            <g key={v}>
              <line
                x1="42"
                x2="515"
                y1={190 - (v / 120) * 160}
                y2={190 - (v / 120) * 160}
                stroke={v === 100 ? "#c4b58b" : "#edf0ed"}
                strokeDasharray={v === 100 ? "5 5" : undefined}
              />
              <text
                x="535"
                y={194 - (v / 120) * 160}
                fill="#8a948d"
                fontSize="11"
                textAnchor="middle"
              >
                {v}
              </text>
            </g>
          ))}
          {points.length > 1 && (
            <polygon
              points={`${points[0].x},190 ${line} ${points.at(-1)!.x},190`}
              fill="url(#chart-fill)"
            />
          )}
          {points.length > 1 && (
            <polyline
              points={line}
              fill="none"
              stroke="#34715e"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          )}
          {points.map((p) => (
            <g key={p.i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="#fff"
                stroke="#34715e"
                strokeWidth="3"
              />
              <text
                x={p.x}
                y={p.y - 15}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#245442"
              >
                {p.v.toFixed(1)}%
              </text>
            </g>
          ))}
          {periods.map((p, i) => (
            <text
              key={p}
              x={60 + i * 215}
              y="220"
              textAnchor="middle"
              fontSize="12"
              fill="#7a847f"
            >
              {T(`الربع ${["الأول", "الثاني", "الثالث"][i]}`, `Q${i + 1}`)}
            </text>
          ))}
        </svg>
      </div>
    );
  }
  const overview = (
    <>
      <Heading
        eyebrow={T(
          "الاستراتيجية والأداء المؤسسي",
          "STRATEGY & INSTITUTIONAL PERFORMANCE",
        )}
        title={T("نظرة على الأداء", "Performance at a glance")}
        subtitle={T(
          "كل ما تحتاجه لمتابعة التقدم واتخاذ الخطوة التالية.",
          "Track progress and focus on what needs your attention.",
        )}
        action={
          <Link className="button secondary" href="/strategy">
            <Network size={17} />
            {T("استعراض الاستراتيجية", "Explore strategy")}
          </Link>
        }
      />
      <div className="overview-top">
        <section className="performance-feature">
          <div className="feature-content">
            <span className="feature-eyebrow">
              <span className="live-dot" />
              {T("الأداء العام", "OVERALL PERFORMANCE")}
            </span>
            <div className="feature-score">
              {overall === null ? "—" : overall.toFixed(1)}
              <span>%</span>
            </div>
            <p>
              {T(
                "متوسط تحقيق المؤشرات المعتمدة",
                "Average approved KPI achievement",
              )}
            </p>
            <div className="feature-footer">
              <span>
                {approved.length} {T("من", "of")} {standalone.length}{" "}
                {T("مؤشرات مستقلة معتمدة", "standalone KPIs approved")}
              </span>
              <Link
                href="/indicators"
                aria-label={T("عرض المؤشرات", "View indicators")}
              >
                <DirectionArrow locale={locale} size={20} />
              </Link>
            </div>
          </div>
          <div className="feature-ring">
            <svg viewBox="0 0 160 160" aria-hidden="true">
              <circle
                cx="80"
                cy="80"
                r="63"
                fill="none"
                stroke="#ffffff18"
                strokeWidth="12"
              />
              <circle
                cx="80"
                cy="80"
                r="63"
                fill="none"
                stroke="#c8b077"
                strokeWidth="12"
                strokeDasharray={`${Math.min(overall ?? 0, 100) * 3.958} 396`}
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
              />
            </svg>
            <Target size={30} strokeWidth={1.2} />
          </div>
        </section>
        <section className="cycle-summary">
          <div className="panel-topline">
            <span className="eyebrow">
              {T("دورة القياس الحالية", "MEASUREMENT CYCLE")}
            </span>
            <span
              className={`badge ${period === "2026-Q3" ? "status-approved" : "status-draft"}`}
            >
              {period === "2026-Q3"
                ? T("مفتوحة", "Open")
                : T("مقفلة", "Locked")}
            </span>
          </div>
          <h2>{periodLabel(period, locale)}</h2>
          <p>
            {period === "2026-Q3"
              ? T("1 يوليو — 30 سبتمبر 2026", "1 July — 30 September 2026")
              : T("فترة سابقة · للاطلاع فقط", "Previous period · read only")}
          </p>
          <div className="cycle-progress-label">
            <span>{T("اكتمال الاعتماد", "Approval completion")}</span>
            <strong>{completion.toFixed(0)}%</strong>
          </div>
          <Progress value={completion} />
          <Link className="text-link" href="/measurements">
            {T("متابعة دورة القياس", "Open measurement cycle")}
            <DirectionArrow locale={locale} />
          </Link>
        </section>
      </div>
      <section
        className="metric-strip"
        aria-label={T("ملخص المؤشرات", "Indicator summary")}
      >
        {[
          {
            label: T("إجمالي المؤشرات", "Total indicators"),
            value: kpis.length,
            icon: ChartNoAxesCombined,
            note: T("ضمن النطاق الحالي", "In the current scope"),
            tone: "",
          },
          {
            label: T("حققت المستهدف", "Target achieved"),
            value: kpis.filter((k) => (scoreFor(k, period, store) ?? -1) >= 100)
              .length,
            icon: CircleCheck,
            note: T("من النتائج المعتمدة", "From approved results"),
            tone: "green",
          },
          {
            label: T("بانتظار المراجعة", "Awaiting review"),
            value: pending.length,
            icon: Clock3,
            note: T("قياسات تحتاج إجراء", "Measurements to review"),
            tone: "gold",
          },
          {
            label: T("تحتاج إلى متابعة", "Need attention"),
            value: measurements.filter((m) => m.status === "returned").length,
            icon: RotateCcw,
            note: T("قياسات معادة للاستكمال", "Returned measurements"),
            tone: "orange",
          },
        ].map((item) => (
          <div className="metric" key={item.label}>
            <div className={`metric-icon ${item.tone}`}>
              <item.icon size={20} strokeWidth={1.6} />
            </div>
            <div>
              <span>{item.label}</span>
              <strong>{item.value.toString().padStart(2, "0")}</strong>
              <small>{item.note}</small>
            </div>
          </div>
        ))}
      </section>
      <div className="insight-grid">
        <section className="panel trend-panel">
          <div className="panel-heading">
            <div>
              <h2>{T("اتجاه الأداء", "Performance trend")}</h2>
              <p>
                {T(
                  "متوسط نسبة التحقيق خلال عام 2026",
                  "Average achievement throughout 2026",
                )}
              </p>
            </div>
            <div className="chart-legend">
              <i />
              {T("الأداء الفعلي", "Achievement")}
              <i className="gold" />
              {T("المستهدف", "Target")}
            </div>
          </div>
          <TrendChart />
          <p className="chart-note">
            {T(
              "يُحتسب المتوسط من المؤشرات المستقلة المعتمدة في كل فترة؛ وقد تختلف تغطية البيانات بين الفترات.",
              "Averages use approved standalone KPIs in each period; coverage may vary between periods.",
            )}
          </p>
        </section>
        <section className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <h2>{T("يتطلب انتباهك", "Needs your attention")}</h2>
              <p>
                {T(
                  "الأعمال الأقرب إلى الخطوة التالية",
                  "Items ready for the next step",
                )}
              </p>
            </div>
            <span className="count-pill">
              {
                measurements.filter((m) =>
                  ["submitted", "returned", "draft"].includes(m.status),
                ).length
              }
            </span>
          </div>
          <div className="attention-list">
            {measurements
              .filter((m) => m.status !== "approved")
              .slice(0, 3)
              .map((m) => {
                const k = kpis.find((k) => k.id === m.kpiId)!;
                return (
                  <Link
                    className="attention-item"
                    href={
                      m.status === "submitted"
                        ? "/approvals"
                        : `/indicators/${k.id}`
                    }
                    key={m.id}
                  >
                    <span className={`attention-symbol ${m.status}`}>
                      <Clock3 size={18} />
                    </span>
                    <div>
                      <strong>{L(k.name)}</strong>
                      <span>
                        {m.status === "submitted"
                          ? T(
                              "بانتظار مراجعة القياس",
                              "Measurement awaiting review",
                            )
                          : m.status === "returned"
                            ? T(
                                "ملاحظات تحتاج إلى استكمال",
                                "Feedback requires a response",
                              )
                            : T(
                                "مسودة جاهزة للاستكمال",
                                "Draft ready to complete",
                              )}
                      </span>
                    </div>
                    <DirectionArrow locale={locale} />
                  </Link>
                );
              })}
            {measurements.every((m) => m.status === "approved") && (
              <Empty title={T("لا توجد أعمال معلّقة", "No pending items")} />
            )}
          </div>
          <Link href="/approvals" className="panel-bottom-link">
            {T("عرض مركز الموافقات", "Open approvals center")}
            <DirectionArrow locale={locale} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{T("مؤشرات تحت المتابعة", "Indicators in focus")}</h2>
            <p>
              {domainLabel(domain, locale)} · {periodLabel(period, locale)}
            </p>
          </div>
          <Link href="/indicators" className="text-link">
            {T("جميع المؤشرات", "All indicators")}
            <DirectionArrow locale={locale} />
          </Link>
        </div>
        <KpiTable items={kpis.slice(0, 4)} compact />
      </section>
    </>
  );

  const indicators = (
    <>
      <Heading
        eyebrow={T("القياس والمتابعة", "MEASUREMENT & MONITORING")}
        title={T("مؤشرات الأداء", "Performance indicators")}
        subtitle={T(
          "بطاقات المؤشرات ومستهدفاتها ونتائجها في مكان واحد.",
          "Indicator definitions, targets and results in one place.",
        )}
        action={createButton}
      />
      <section className="panel">
        <div className="list-toolbar">
          <div className="tabs" aria-label={T("نوع المؤشر", "Indicator type")}>
            {[
              ["all", T("جميع المؤشرات", "All indicators")],
              ["standalone", T("مستقلة", "Standalone")],
              ["composite", T("مركبة", "Composite")],
            ].map(([id, label]) => (
              <button
                aria-pressed={kind === id}
                className={kind === id ? "active" : ""}
                key={id}
                onClick={() => setKind(id)}
              >
                {label}
                <span>
                  {id === "all"
                    ? kpis.length
                    : kpis.filter((k) => k.type === id).length}
                </span>
              </button>
            ))}
          </div>
          <div className="filter-row">
            <div className="input-with-icon">
              <Search size={17} />
              <input
                aria-label={T("البحث في المؤشرات", "Search indicators")}
                placeholder={T(
                  "ابحث بالاسم أو الرمز…",
                  "Search by name or code…",
                )}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label={T("حالة القياس", "Measurement status")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{T("جميع الحالات", "All statuses")}</option>
              <option value="approved">{T("معتمد", "Approved")}</option>
              <option value="submitted">
                {T("بانتظار المراجعة", "In review")}
              </option>
              <option value="returned">
                {T("معاد للاستكمال", "Returned")}
              </option>
              <option value="draft">{T("مسودة", "Draft")}</option>
            </select>
          </div>
        </div>
        <KpiTable items={filteredKpis} />
        <div className="table-footer">
          <span>
            {T("عرض", "Showing")} {filteredKpis.length} {T("من", "of")}{" "}
            {kpis.length} {T("مؤشرات", "indicators")}
          </span>
          <span>
            <ShieldCheck size={14} />
            {T(
              "نسب التحقيق من القياسات المعتمدة فقط",
              "Achievement uses approved measurements only",
            )}
          </span>
        </div>
      </section>
    </>
  );

  const strategy = (
    <>
      <Heading
        eyebrow={domainLabel(domain, locale)}
        title={T("الهيكل الاستراتيجي", "Strategy structure")}
        subtitle={T(
          "من الأهداف إلى المؤشرات. رؤية واحدة للعلاقات والنتائج.",
          "Connect objectives to indicators and their results.",
        )}
        action={createButton}
      />
      <div className="strategy-layout">
        <aside className="strategy-context">
          <span className="eyebrow">
            {T("الاستراتيجية المؤسسية", "INSTITUTIONAL STRATEGY")}
          </span>
          <h2>
            {T("نحو أداء مؤسسي مستدام", "Towards sustainable performance")}
          </h2>
          <p>
            {T(
              "تحسين الخدمات وتنمية القدرات وتعزيز كفاءة العمل المؤسسي.",
              "Improve services, develop capabilities and advance institutional efficiency.",
            )}
          </p>
          <div className="strategy-years">
            2026 <span>—</span> 2030
          </div>
          <div className="strategy-facts">
            <div>
              <span>{T("الأهداف الاستراتيجية", "Strategic objectives")}</span>
              <strong>03</strong>
            </div>
            <div>
              <span>{T("مؤشرات الأداء", "Performance indicators")}</span>
              <strong>{kpis.length.toString().padStart(2, "0")}</strong>
            </div>
          </div>
          <div className="context-note">
            <Info size={17} />
            <span>
              {T(
                "هيكل وبيانات توضيحية لمراجعة تجربة الاستخدام.",
                "Illustrative structure and data for usability review.",
              )}
            </span>
          </div>
        </aside>
        <section>
          <div className="view-toolbar">
            <div className="segmented">
              <button
                className={strategyView === "strategic" ? "active" : ""}
                onClick={() => setStrategyView("strategic")}
              >
                <ListTree size={16} />
                {T("العرض الاستراتيجي", "Strategic view")}
              </button>
              <button
                className={strategyView === "organizational" ? "active" : ""}
                onClick={() => setStrategyView("organizational")}
              >
                <Building2 size={16} />
                {T("العرض التنظيمي", "Organization view")}
              </button>
            </div>
          </div>
          {(strategyView === "strategic"
            ? objectives.map((o) => ({
                id: o.id,
                name: o.name,
                description: o.description,
                items: kpis.filter((k) => k.objective === o.id),
              }))
            : [...new Set(kpis.map((k) => k.sector.ar))].map((sector) => ({
                id: sector,
                name: kpis.find((k) => k.sector.ar === sector)!.sector,
                description: {
                  ar: "المؤشرات المرتبطة بالوحدة التنظيمية",
                  en: "Indicators linked to this organizational unit",
                },
                items: kpis.filter((k) => k.sector.ar === sector),
              }))
          ).map((o, index) => (
            <details className="objective-card" key={o.id} open>
              <summary>
                <span className="objective-index">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <div>
                  <h3>{L(o.name)}</h3>
                  <p>{L(o.description)}</p>
                </div>
                <span className="count-pill">{o.items.length}</span>
                <ChevronDown size={17} />
              </summary>
              <div className="objective-children">
                {o.items.map((k) => (
                  <Link
                    href={`/indicators/${k.id}`}
                    className="tree-item"
                    key={k.id}
                  >
                    <span className="tree-connector" />
                    <ChartNoAxesCombined size={17} />
                    <div>
                      <strong>{L(k.name)}</strong>
                      <small>{k.code}</small>
                    </div>
                    <Score value={scoreFor(k, period, store)} locale={locale} />
                    <DirectionArrow locale={locale} />
                  </Link>
                ))}
                {!o.items.length && (
                  <p className="muted tree-empty">
                    {T(
                      "لا توجد مؤشرات مرتبطة بهذا الهدف بعد.",
                      "No indicators are linked to this objective yet.",
                    )}
                  </p>
                )}
              </div>
            </details>
          ))}
        </section>
      </div>
    </>
  );

  const measurementPage = (
    <>
      <Heading
        eyebrow={T("جمع البيانات والتحقق", "DATA COLLECTION & VALIDATION")}
        title={T("دورة القياس", "Measurement cycle")}
        subtitle={`${periodLabel(period, locale)} · ${domainLabel(domain, locale)}`}
      />
      <div className="cycle-banner">
        <div className="cycle-banner-icon">
          <CalendarDays size={24} />
        </div>
        <div>
          <h2>
            {period === "2026-Q3"
              ? T(
                  "الفترة مفتوحة لإدخال القياسات",
                  "This period is open for measurement",
                )
              : T("الفترة مقفلة", "This period is locked")}
          </h2>
          <p>
            {period === "2026-Q3"
              ? T(
                  "أكمل القيم ومشاهدات الأداء، ثم أرسلها إلى المراجعة.",
                  "Complete actual values and observations, then submit for review.",
                )
              : T(
                  "يمكن استعراض القياسات السابقة دون تعديلها.",
                  "Previous measurements are available in read-only mode.",
                )}
          </p>
        </div>
        <div className="cycle-banner-stat">
          <strong>
            {approved.length}/{standalone.length}
          </strong>
          <span>{T("قياسات معتمدة", "Approved measurements")}</span>
        </div>
      </div>
      <div className="measurement-grid">
        {standalone.map((k) => {
          const m = measurementFor(k);
          return (
            <article className="panel measurement-card" key={k.id}>
              <div className="measurement-card-top">
                <span className="code">{k.code}</span>
                <Badge status={m?.status ?? "missing"} locale={locale} />
              </div>
              <Link href={`/indicators/${k.id}`}>
                <h3>{L(k.name)}</h3>
              </Link>
              <p>{L(k.owner)}</p>
              <div className="measurement-values">
                <div>
                  <span>{T("المستهدف", "Target")}</span>
                  <strong>
                    {k.target}
                    <small>
                      {k.unit === "percent" ? "%" : T(" يوم", " days")}
                    </small>
                  </strong>
                </div>
                <div>
                  <span>{T("القيمة الفعلية", "Actual value")}</span>
                  <strong>
                    {m?.value ?? "—"}
                    <small>
                      {k.unit === "percent" ? "%" : T(" يوم", " days")}
                    </small>
                  </strong>
                </div>
              </div>
              {m?.status === "returned" && (
                <div className="return-note">{m.comment}</div>
              )}
              <div className="measurement-bottom">
                <span>{L(k.ambassador)}</span>
                {canInput &&
                (!m || ["draft", "returned"].includes(m.status)) ? (
                  <button
                    className="button secondary small-button"
                    onClick={() => setMeasureKpi(k)}
                  >
                    {m
                      ? T("استكمال القياس", "Complete measurement")
                      : T("إدخال القياس", "Enter measurement")}
                    <DirectionArrow locale={locale} />
                  </button>
                ) : (
                  <Link className="text-link" href={`/indicators/${k.id}`}>
                    {T("عرض التفاصيل", "View details")}
                    <DirectionArrow locale={locale} />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );

  const approvals = (
    <>
      <Heading
        eyebrow={T("مركز المهام", "TASK CENTER")}
        title={T("الطلبات والموافقات", "Requests & approvals")}
        subtitle={T(
          "راجع القياسات والأدلة واتخذ القرار مع توثيق الملاحظات.",
          "Review measurements and evidence, and record your decision.",
        )}
      />
      <div className="approval-summary">
        <div>
          <Clock3 size={21} />
          <strong>{pending.length}</strong>
          <span>{T("بانتظار المراجعة", "Awaiting review")}</span>
        </div>
        <div>
          <CheckCheck size={21} />
          <strong>{approved.length}</strong>
          <span>{T("قياسات معتمدة", "Approved measurements")}</span>
        </div>
        <div>
          <RotateCcw size={21} />
          <strong>
            {measurements.filter((m) => m.status === "returned").length}
          </strong>
          <span>{T("معادة للاستكمال", "Returned for completion")}</span>
        </div>
      </div>
      {!canReview && (
        <div className="inline-notice">
          <LockKeyhole size={17} />
          {T(
            "وضع الاطلاع. لمعاينة اتخاذ القرار اختر دور مالك المؤشر أو فريق الأداء.",
            "Read-only preview. Choose KPI owner or Performance team to preview decisions.",
          )}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{T("قائمة المراجعة", "Review queue")}</h2>
            <p>{periodLabel(period, locale)}</p>
          </div>
          <span className="count-pill">{pending.length}</span>
        </div>
        {pending.length ? (
          pending.map((m) => {
            const k = kpis.find((k) => k.id === m.kpiId)!;
            return (
              <div className="approval-row" key={m.id}>
                <div className="approval-file">
                  <FileText size={23} strokeWidth={1.4} />
                </div>
                <div className="approval-description">
                  <span className="eyebrow">
                    {k.code} · {T("اعتماد قياس", "MEASUREMENT APPROVAL")}
                  </span>
                  <h3>{L(k.name)}</h3>
                  <p>
                    {L(k.ambassador)} · {displayDate(m.updatedAt)}
                  </p>
                </div>
                <div className="approval-value">
                  <span>{T("القيمة المرفوعة", "Submitted value")}</span>
                  <strong>
                    {m.value}
                    {k.unit === "percent" ? "%" : T(" أيام", " days")}
                  </strong>
                </div>
                <button
                  className="button secondary"
                  onClick={() => setReview(m)}
                >
                  {canReview
                    ? T("مراجعة الطلب", "Review request")
                    : T("عرض الطلب", "View request")}
                  <DirectionArrow locale={locale} />
                </button>
              </div>
            );
          })
        ) : (
          <Empty
            title={T("اكتملت قائمة المراجعة", "Your review queue is clear")}
            detail={T(
              "ستظهر القياسات الجديدة هنا بعد إرسالها من دورة القياس.",
              "New measurements appear here once submitted from the measurement cycle.",
            )}
            action={
              <Link className="button secondary" href="/measurements">
                {T("فتح دورة القياس", "Open measurement cycle")}
              </Link>
            }
          />
        )}
      </section>
      <div className="supporting-note">
        <Info size={16} />
        {T(
          "المسار التجريبي: إدخال، مراجعة، اعتماد. مسارات الجهة التفصيلية تُحسم قبل تنفيذ محرك الموافقات.",
          "Prototype flow: enter, review, approve. Institutional approval routes remain to be confirmed.",
        )}
      </div>
    </>
  );

  function Detail({ kpi }: { kpi: KPI }) {
    const m = measurementFor(kpi);
    const score = scoreFor(kpi, period, store);
    return (
      <>
        <Link href="/indicators" className="back-link">
          {locale === "ar" ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}
          {T("مؤشرات الأداء", "Performance indicators")}
        </Link>
        <Heading
          eyebrow={`${kpi.code} / ${kpi.type === "composite" ? T("مؤشر مركب", "COMPOSITE KPI") : T("مؤشر مستقل", "STANDALONE KPI")}`}
          title={L(kpi.name)}
          subtitle={L(kpi.description)}
          action={
            canInput &&
            kpi.type === "standalone" &&
            (!m || ["draft", "returned"].includes(m.status)) ? (
              <button
                className="button primary"
                onClick={() => setMeasureKpi(kpi)}
              >
                <Plus size={17} />
                {T("إدخال القياس", "Enter measurement")}
              </button>
            ) : canReview && m?.status === "submitted" ? (
              <button className="button primary" onClick={() => setReview(m)}>
                {T("مراجعة القياس", "Review measurement")}
              </button>
            ) : undefined
          }
        />
        <div className="detail-metrics">
          <div>
            <span>{T("نسبة التحقيق المعتمدة", "Approved achievement")}</span>
            <Score value={score} locale={locale} />
          </div>
          <div>
            <span>{T("المستهدف", "Target")}</span>
            <strong>
              {kpi.target}
              {kpi.unit === "percent" ? "%" : T(" أيام", " days")}
            </strong>
          </div>
          <div>
            <span>{T("خط الأساس · 2025", "Baseline · 2025")}</span>
            <strong>
              {kpi.baseline}
              {kpi.unit === "percent" ? "%" : ""}
            </strong>
          </div>
          <div>
            <span>{T("حالة القياس", "Measurement status")}</span>
            {kpi.type === "standalone" ? (
              <Badge status={m?.status ?? "missing"} locale={locale} />
            ) : (
              <strong className="small">{T("احتساب آلي", "Calculated")}</strong>
            )}
          </div>
        </div>
        <div className="tabs detail-tabs">
          {[
            ["overview", T("نظرة عامة", "Overview")],
            ["measurements", T("القياسات", "Measurements")],
            ["history", T("سجل الإجراءات", "Activity history")],
          ].map(([id, label]) => (
            <button
              key={id}
              className={detailTab === id ? "active" : ""}
              aria-pressed={detailTab === id}
              onClick={() => setDetailTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {detailTab === "overview" && (
          <div className="detail-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>{T("بيانات المؤشر", "Indicator information")}</h2>
                <Target size={19} />
              </div>
              <dl className="definition-list">
                {[
                  [
                    T("الهدف الاستراتيجي", "Strategic objective"),
                    L(
                      objectives.find((o) => o.id === kpi.objective)?.name ?? {
                        ar: "—",
                        en: "—",
                      },
                    ),
                  ],
                  [T("الجهة المالكة", "Owner"), L(kpi.owner)],
                  [
                    T("سفير الأداء", "Performance ambassador"),
                    L(kpi.ambassador),
                  ],
                  [T("القطاع", "Sector"), L(kpi.sector)],
                  [T("دورية القياس", "Frequency"), T("ربع سنوية", "Quarterly")],
                  [
                    T("اتجاه المؤشر", "Direction"),
                    kpi.direction === "positive"
                      ? T("إيجابي · الأعلى أفضل", "Positive · higher is better")
                      : T("سلبي · الأقل أفضل", "Negative · lower is better"),
                  ],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="panel formula-panel">
              <div className="panel-heading">
                <h2>{T("طريقة الاحتساب", "Calculation method")}</h2>
                <ChartNoAxesCombined size={19} />
              </div>
              <div className="formula-block">
                {kpi.type === "composite"
                  ? T(
                      "مجموع (نسبة تحقيق المؤشر × وزنه) ÷ مجموع الأوزان",
                      "Sum (child achievement × weight) ÷ total weight",
                    )
                  : kpi.direction === "positive"
                    ? T(
                        "القيمة الفعلية ÷ المستهدف × 100",
                        "Actual ÷ target × 100",
                      )
                    : T(
                        "المستهدف ÷ القيمة الفعلية × 100",
                        "Target ÷ actual × 100",
                      )}
              </div>
              <p>
                {T(
                  "تُستخدم القياسات المعتمدة فقط. غياب البيانات لا يُعامل كقيمة صفرية.",
                  "Only approved measurements are used. Missing data is not treated as zero.",
                )}
              </p>
              {kpi.children.map((child) => {
                const linked = store.kpis.find((k) => k.id === child.id);
                return (
                  linked && (
                    <Link
                      key={child.id}
                      className="child-kpi"
                      href={`/indicators/${child.id}`}
                    >
                      <span>{L(linked.name)}</span>
                      <strong>{child.weight}%</strong>
                    </Link>
                  )
                );
              })}
            </section>
          </div>
        )}
        {detailTab === "measurements" && (
          <section className="panel">
            <div className="panel-heading">
              <h2>{T("سجل القياسات", "Measurement history")}</h2>
            </div>
            {kpi.type === "composite" ? (
              <div className="padded">
                <KpiTable
                  items={kpi.children.flatMap((c) =>
                    store.kpis.filter((k) => k.id === c.id),
                  )}
                  compact
                />
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{T("الفترة", "Period")}</th>
                      <th>{T("القيمة", "Value")}</th>
                      <th>{T("الحالة", "Status")}</th>
                      <th>{T("مشاهدات الأداء", "Observations")}</th>
                      <th>{T("ملاحظات المراجعة", "Review comments")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.measurements
                      .filter((x) => x.kpiId === kpi.id)
                      .sort((a, b) => b.period.localeCompare(a.period))
                      .map((x) => (
                        <tr key={x.id}>
                          <td>{periodLabel(x.period, locale)}</td>
                          <td>
                            {x.value}
                            {kpi.unit === "percent" ? "%" : ""}
                          </td>
                          <td>
                            <Badge status={x.status} locale={locale} />
                          </td>
                          <td className="long-cell">{x.observation || "—"}</td>
                          <td className="long-cell">{x.comment || "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!store.measurements.some((x) => x.kpiId === kpi.id) && (
                  <Empty
                    title={T("لم تُدخل قياسات بعد", "No measurements yet")}
                  />
                )}
              </div>
            )}
          </section>
        )}
        {detailTab === "history" && (
          <section className="panel">
            <div className="panel-heading">
              <h2>
                {T("سجل الإجراءات التجريبي", "Prototype activity history")}
              </h2>
              <History size={19} />
            </div>
            {store.events
              .filter((e) => e.kpiId === kpi.id)
              .map((e) => (
                <div className="timeline-event" key={e.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{L(e.action)}</strong>
                    <p>
                      {L(e.actor)} · {displayDate(e.at)}
                    </p>
                    {e.detail && <blockquote>{e.detail}</blockquote>}
                  </div>
                </div>
              ))}
            {!store.events.some((e) => e.kpiId === kpi.id) && (
              <Empty
                title={T(
                  "لا توجد إجراءات مسجلة بعد",
                  "No recorded activity yet",
                )}
                detail={T(
                  "ستظهر هنا الإجراءات التي تنفذها أثناء تجربة النموذج.",
                  "Actions you take in this prototype will appear here.",
                )}
              />
            )}
          </section>
        )}
      </>
    );
  }
  const settings = (
    <>
      <Heading
        eyebrow={T("إعدادات المعاينة", "PREVIEW SETTINGS")}
        title={T("مساحة التجربة", "Prototype workspace")}
        subtitle={T(
          "المرحلة الأولى · تجربة الاستخدام وقواعد العمل المقترحة",
          "Milestone 1 · User experience and proposed business rules",
        )}
      />
      <section className="panel settings-panel">
        <div className="setting-row">
          <div>
            <h3>
              {T("بيانات تجريبية على هذا الجهاز", "Sample data on this device")}
            </h3>
            <p>
              {T(
                "تُحفظ التغييرات محليًا في هذا المتصفح. لا يوجد اتصال بقاعدة بيانات مؤسسية أو نظام دخول فعلي.",
                "Changes are stored locally in this browser. Institutional database and authentication are not connected.",
              )}
            </p>
          </div>
          <span className="badge status-draft">M1</span>
        </div>
        <div className="setting-row">
          <div>
            <h3>{T("معاينة الأدوار", "Role preview")}</h3>
            <p>
              {T(
                "اختر دورًا لتجربة اختلاف الإجراءات المتاحة. هذا التبديل مخصص للتصميم وليس وسيلة للتحقق من الصلاحيات.",
                "Preview the actions available to each role. This switch is a design tool, not authorization.",
              )}
            </p>
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            aria-label={T("اختيار دور المعاينة", "Choose preview role")}
          >
            {Object.entries(roles).map(([id, name]) => (
              <option key={id} value={id}>
                {L(name)}
              </option>
            ))}
          </select>
        </div>
        <div className="setting-row">
          <div>
            <h3>{T("اللغة", "Language")}</h3>
            <p>
              {T(
                "العربية من اليمين إلى اليسار والإنجليزية من اليسار إلى اليمين.",
                "Arabic right-to-left and English left-to-right layouts.",
              )}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          >
            {locale === "ar" ? "English" : "العربية"}
          </button>
        </div>
        <div className="setting-row">
          <div>
            <h3>{T("إعادة بيانات التجربة", "Reset sample data")}</h3>
            <p>
              {T(
                "إزالة المؤشرات والإجراءات المحلية التي أضفتها وإعادة الأمثلة الأصلية.",
                "Remove locally created indicators and actions, and restore the original examples.",
              )}
            </p>
          </div>
          <button
            className="button danger-outline"
            onClick={() => setDialog("reset")}
          >
            <RotateCcw size={16} />
            {T("إعادة ضبط", "Reset")}
          </button>
        </div>
      </section>
    </>
  );

  return (
    <div className="app-shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <a className="skip-link" href="#main-content">
        {T("تجاوز إلى المحتوى", "Skip to content")}
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label={T("إغلاق القائمة", "Close navigation")}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
      >
        <Link href="/overview" className="brand">
          <Image
            src="/mngdp-logo.png"
            alt={T(
              "برنامج تطوير وزارة الحرس الوطني",
              "Ministry of National Guard Development Program",
            )}
            width={75}
            height={79}
            priority
          />
          <div>
            <strong>{T("بصير", "Baseer")}</strong>
            <span>
              {T("إدارة الأداء المؤسسي", "Institutional performance")}
            </span>
          </div>
        </Link>
        <div className="sidebar-label">{T("مساحة العمل", "WORKSPACE")}</div>
        <nav aria-label={T("القائمة الرئيسية", "Main navigation")}>
          {navigation.map((n) => (
            <Link
              key={n.id}
              href={`/${n.id}`}
              className={`nav-item ${section === n.id ? "active" : ""}`}
              aria-current={section === n.id ? "page" : undefined}
            >
              <n.icon size={19} strokeWidth={1.6} />
              <span>{n[locale]}</span>
              {n.id === "approvals" && pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-cycle">
          <div>
            <CalendarDays size={17} />
            <span>{periodLabel(period, locale)}</span>
          </div>
          <Progress value={completion} />
          <small>
            {completion.toFixed(0)}%{" "}
            {T("من القياسات معتمدة", "of measurements approved")}
          </small>
        </div>
        <div className="sidebar-bottom">
          <Link
            href="/settings"
            className={`nav-item ${section === "settings" ? "active" : ""}`}
          >
            <Settings2 size={19} strokeWidth={1.6} />
            <span>{T("إعدادات المعاينة", "Preview settings")}</span>
          </Link>
          <div className="prototype-note">
            <span className="prototype-dot" />
            <div>
              <strong>
                {T("نموذج تفاعلي · M1", "Interactive prototype · M1")}
              </strong>
              <small>
                {T(
                  "بيانات تجريبية محفوظة على جهازك",
                  "Sample data stored on your device",
                )}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="icon-button mobile-menu"
              aria-label={T("فتح القائمة", "Open navigation")}
              aria-expanded={mobileOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Menu size={22} />
            </button>
            <div className="breadcrumb">
              <span>{T("بصير", "Baseer")}</span>
              <span>/</span>
              <strong>
                {currentNav?.[locale] ??
                  T("إعدادات المعاينة", "Preview settings")}
              </strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="header-search"
              aria-label={T("بحث في المؤشرات", "Search indicators")}
              onClick={() => {
                setQuery("");
                setDialog("search");
              }}
            >
              <Search size={17} />
              <span>{T("بحث في المؤشرات", "Search indicators")}</span>
            </button>
            <button
              className="language-button"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              aria-label={
                locale === "ar" ? "Switch to English" : "التبديل إلى العربية"
              }
            >
              {locale === "ar" ? "EN" : "ع"}
            </button>
            <Link
              className="icon-button notification-button"
              href="/approvals"
              aria-label={T(
                "الطلبات التي تتطلب مراجعة",
                "Requests awaiting review",
              )}
            >
              <Bell size={19} />
              {pending.length > 0 && <i />}
            </Link>
            <div className="profile">
              <span className="avatar">
                {role === "viewer" ? (
                  <ShieldCheck size={18} />
                ) : (
                  <span>{T("أد", "PT")}</span>
                )}
              </span>
              <div>
                <small>{T("معاينة الدور", "PREVIEW ROLE")}</small>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  aria-label={T("معاينة الدور", "Preview role")}
                >
                  {Object.entries(roles).map(([id, name]) => (
                    <option key={id} value={id}>
                      {L(name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>
        <div className="scopebar">
          <div className="scope-controls">
            <label>
              <Building2 size={15} />
              <select
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value as "program" | "ministry");
                  if (detailId) router.push("/indicators");
                }}
                aria-label={T("الجهة", "Organization")}
              >
                <option value="program">
                  {T(
                    "برنامج تطوير وزارة الحرس الوطني",
                    "National Guard Development Program",
                  )}
                </option>
                <option value="ministry">
                  {T("وزارة الحرس الوطني", "Ministry of National Guard")}
                </option>
              </select>
            </label>
            <span className="scope-divider" />
            <label>
              <CalendarDays size={15} />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                aria-label={T("الفترة", "Period")}
              >
                {(["2026-Q3", "2026-Q2", "2026-Q1"] as Period[]).map((p) => (
                  <option key={p} value={p}>
                    {periodLabel(p, locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span className="sample-label">
            {T("بيانات توضيحية", "Sample data")}
          </span>
        </div>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {storageError && (
            <div role="alert" className="inline-notice warning">
              {T(
                "تعذر قراءة أو حفظ البيانات المحلية. قد لا تبقى تغييراتك بعد إغلاق الصفحة.",
                "Local data could not be read or saved. Changes may not survive closing the page.",
              )}
            </div>
          )}
          {!ready ? (
            <div className="loading-state" aria-live="polite">
              {T("جارٍ تجهيز مساحة العمل…", "Preparing your workspace…")}
            </div>
          ) : detailId ? (
            selected ? (
              <Detail kpi={selected} />
            ) : (
              <Empty
                title={T(
                  "المؤشر غير موجود في النطاق الحالي",
                  "Indicator not found in this scope",
                )}
                action={
                  <Link className="button secondary" href="/indicators">
                    {T("العودة إلى المؤشرات", "Back to indicators")}
                  </Link>
                }
              />
            )
          ) : section === "overview" ? (
            overview
          ) : section === "strategy" ? (
            strategy
          ) : section === "indicators" ? (
            indicators
          ) : section === "measurements" ? (
            measurementPage
          ) : section === "approvals" ? (
            approvals
          ) : (
            settings
          )}
          <footer className="page-footer">
            <span>
              {T(
                "بصير · إدارة الاستراتيجية والأداء المؤسسي",
                "Baseer · Strategy & institutional performance",
              )}
            </span>
            <span>
              {T(
                "المرحلة الأولى / نموذج تجربة الاستخدام",
                "Milestone 1 / User experience prototype",
              )}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={20} />
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label={T("إغلاق التنبيه", "Dismiss notification")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog === "create" && (
        <CreateIndicator
          locale={locale}
          domain={domain}
          kpis={kpis}
          onClose={() => setDialog(null)}
          onSave={createKpi}
        />
      )}
      {measureKpi && (
        <MeasurementForm
          locale={locale}
          kpi={measureKpi}
          period={period}
          role={role}
          existing={measurementFor(measureKpi)}
          onClose={() => setMeasureKpi(null)}
          onSave={saveMeasurement}
        />
      )}
      {review && (
        <ReviewForm
          locale={locale}
          measurement={review}
          kpi={store.kpis.find((k) => k.id === review.kpiId)!}
          canReview={canReview}
          onClose={() => setReview(null)}
          onDecide={decide}
        />
      )}
      {dialog === "search" && (
        <Dialog
          title={T("البحث في المؤشرات", "Search indicators")}
          locale={locale}
          onClose={() => setDialog(null)}
        >
          <div className="dialog-body">
            <div className="input-with-icon search-large">
              <Search size={19} />
              <input
                autoFocus
                aria-label={T("بحث", "Search")}
                placeholder={T(
                  "اسم المؤشر أو رمزه…",
                  "Indicator name or code…",
                )}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="search-results">
              {kpis
                .filter((k) =>
                  `${k.name.ar} ${k.name.en} ${k.code}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((k) => (
                  <button
                    key={k.id}
                    onClick={() => {
                      setDialog(null);
                      router.push(`/indicators/${k.id}`);
                    }}
                  >
                    <ChartNoAxesCombined size={18} />
                    <span>
                      {L(k.name)}
                      <small>{k.code}</small>
                    </span>
                    <DirectionArrow locale={locale} />
                  </button>
                ))}
            </div>
            {!kpis.some((k) =>
              `${k.name.ar} ${k.name.en} ${k.code}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && <Empty title={T("لا توجد نتائج", "No results")} />}
          </div>
        </Dialog>
      )}
      {dialog === "reset" && (
        <Dialog
          title={T("إعادة بيانات التجربة؟", "Reset sample data?")}
          locale={locale}
          onClose={() => setDialog(null)}
        >
          <div className="dialog-body">
            <p>
              {T(
                "ستُحذف المؤشرات والقياسات والإجراءات التي أضفتها محليًا، وتُعاد البيانات الأصلية للنموذج. لا يمكن التراجع عن هذا الإجراء.",
                "Locally added indicators, measurements and actions will be removed and original sample data restored. This cannot be undone.",
              )}
            </p>
          </div>
          <div className="dialog-footer">
            <button
              className="button secondary"
              onClick={() => setDialog(null)}
            >
              {T("إلغاء", "Cancel")}
            </button>
            <button
              className="button danger"
              onClick={() => {
                save(freshStore());
                setDialog(null);
                setToast(
                  T("تمت استعادة بيانات التجربة", "Sample data restored"),
                );
              }}
            >
              {T("إعادة البيانات", "Reset data")}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
