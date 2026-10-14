"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  Download,
  FileText,
  Layers,
  LayoutDashboard,
  ListTree,
  Network,
  Search,
  Target,
} from "lucide-react";
import {
  objectives,
  scoreFor,
  performanceBand,
  type KPI,
  type Locale,
} from "@/lib/domain";
import {
  emptyFilters,
  filterIndicators,
  frequencyNames,
  indicatorsCsv,
  initiatives,
  kpiLevel,
  kpiUnit,
  levelNames,
  type PerformanceFilters,
  type Initiative,
} from "@/lib/performance";
import { useWorkspace } from "./workspace-provider";
import { Badge, Dialog, Empty, Progress, Score } from "./ui";

function downloadCsv(content: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8;" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function IndicatorFilters({
  items,
  filters,
  onChange,
  locale,
}: {
  items: KPI[];
  filters: PerformanceFilters;
  onChange: (f: PerformanceFilters) => void;
  locale: Locale;
}) {
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const set = (key: keyof PerformanceFilters, value: string) =>
    onChange({ ...filters, [key]: value });
  const unique = (get: (k: KPI) => { ar: string; en: string }) =>
    [...new Map(items.map((k) => [get(k).ar, get(k)])).values()].map((v) => [
      v.ar,
      v[locale],
    ]);
  const selects: [keyof PerformanceFilters, string, string[][]][] = [
    [
      "level",
      T("المستوى", "Level"),
      [
        ["strategic", T("استراتيجي", "Strategic")],
        ["operational", T("تشغيلي", "Operational")],
      ],
    ],
    [
      "type",
      T("تركيب المؤشر", "Composition"),
      [
        ["standalone", T("مستقل", "Standalone")],
        ["composite", T("مركب", "Composite")],
      ],
    ],
    [
      "frequency",
      T("دورية القياس", "Frequency"),
      Object.entries(frequencyNames).map(([id, name]) => [id, name[locale]]),
    ],
    [
      "status",
      T("حالة الأداء", "Performance status"),
      [
        ["good", T("محقق", "Achieved")],
        ["watch", T("قريب من المستهدف", "Near target")],
        ["risk", T("يتطلب متابعة", "Needs attention")],
        ["neutral", T("دون نتيجة معتمدة", "No approved result")],
      ],
    ],
    ["owner", T("مالك المؤشر", "Owner"), unique((k) => k.owner)],
    ["sector", T("القطاع", "Sector"), unique((k) => k.sector)],
    ["unit", T("الوحدة التنظيمية", "Organizational unit"), unique(kpiUnit)],
    [
      "objective",
      T("الهدف", "Objective"),
      objectives.map((o) => [o.id, o.name[locale]]),
    ],
  ];
  return (
    <section
      className="panel explorer-filters"
      aria-label={T("تصفية الأداء", "Performance filters")}
    >
      <label className="explorer-search">
        <Search size={18} />
        <input
          aria-label={T("البحث في الأداء", "Search performance")}
          placeholder={T(
            "ابحث بالاسم أو الرمز أو المالك",
            "Search by name, code or owner",
          )}
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
        />
      </label>
      <div className="filter-grid">
        {selects.map(([key, label, options]) => (
          <label key={key}>
            {label}
            <select
              value={filters[key]}
              onChange={(e) => set(key, e.target.value)}
            >
              <option value="all">{T("الكل", "All")}</option>
              {options.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {Object.entries(filters).some(
        ([key, value]) =>
          value !== emptyFilters[key as keyof PerformanceFilters],
      ) && (
        <button
          className="text-link"
          onClick={() => onChange({ ...emptyFilters })}
        >
          {T("مسح عوامل التصفية", "Clear filters")}
        </button>
      )}
    </section>
  );
}

function KpiCard({ kpi }: { kpi: KPI }) {
  const { store, period, locale } = useWorkspace();
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const score = scoreFor(kpi, period, store);
  const m = store.measurements.find(
    (m) => m.kpiId === kpi.id && m.period === period,
  );
  return (
    <Link
      className={`panel performance-card band-${performanceBand(score)}`}
      href={`/indicators/${kpi.id}`}
    >
      <div className="card-topline">
        <span
          className={`kpi-symbol ${kpi.type === "composite" ? "composite" : ""}`}
        >
          {kpi.type === "composite" ? (
            <Layers size={19} />
          ) : (
            <ChartNoAxesCombined size={19} />
          )}
        </span>
        <span>{levelNames[kpiLevel(kpi)][locale]}</span>
        <bdi>{kpi.code}</bdi>
      </div>
      <h3>{kpi.name[locale]}</h3>
      <p>{kpi.owner[locale]}</p>
      <div className="card-result">
        <Score value={score} locale={locale} />
        <span>{T("التحقيق المعتمد", "Approved achievement")}</span>
      </div>
      <Progress value={score ?? 0} />
      <dl className="card-facts">
        <div>
          <dt>{T("المستهدف", "Target")}</dt>
          <dd>
            {kpi.periodicTargets?.[period] ?? kpi.target}
            {kpi.unit === "percent" ? "%" : T(" أيام", " days")}
          </dd>
        </div>
        <div>
          <dt>{T("الدورية", "Frequency")}</dt>
          <dd>{frequencyNames[kpi.frequency ?? "quarterly"][locale]}</dd>
        </div>
      </dl>
      <div className="card-bottom">
        <span className="muted">
          {kpi.type === "composite"
            ? T("مؤشر مركب", "Composite")
            : T("مؤشر مستقل", "Standalone")}
        </span>
        {kpi.type === "standalone" ? (
          <Badge status={m?.status ?? "missing"} locale={locale} />
        ) : (
          <span>{T("احتساب آلي", "Calculated")}</span>
        )}
      </div>
    </Link>
  );
}

export function PerformanceExplorer({
  initialTab = "structure",
}: {
  initialTab?: "structure" | "tracking";
}) {
  const { locale, domain, period, store } = useWorkspace();
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const [tab, setTab] = useState(initialTab);
  const [view, setView] = useState("map");
  const [content, setContent] = useState("indicators");
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const items = store.kpis.filter((k) => k.domain === domain);
  const filtered = filterIndicators(items, filters, period, store);
  const filteredInitiatives = initiatives.filter(
    (i) =>
      i.domain === domain &&
      (!filters.query.trim() ||
        `${i.name.ar} ${i.name.en} ${i.id} ${i.owner.ar} ${i.owner.en}`
          .toLowerCase()
          .includes(filters.query.trim().toLowerCase())) &&
      (filters.objective === "all" || i.objective === filters.objective) &&
      (filters.sector === "all" || i.sector.ar === filters.sector),
  );
  const groups =
    view === "organization"
      ? [...new Set(filtered.map((k) => kpiUnit(k).ar))].map((id) => ({
          id,
          name: kpiUnit(filtered.find((k) => kpiUnit(k).ar === id)!)[locale],
          items: filtered.filter((k) => kpiUnit(k).ar === id),
        }))
      : objectives
          .map((o) => ({
            id: o.id,
            name: o.name[locale],
            items: filtered.filter((k) => k.objective === o.id),
          }))
          .filter(
            (g) =>
              g.items.length > 0 ||
              filteredInitiatives.some((i) => i.objective === g.id),
          );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {T("الاستراتيجية والأداء", "STRATEGY & PERFORMANCE")}
          </div>
          <h1>
            {tab === "tracking"
              ? T("متابعة الأداء", "Performance tracking")
              : T("الهيكل الاستراتيجي", "Strategy structure")}
          </h1>
          <p>
            {T(
              "استعرض الأهداف والمؤشرات والمبادرات من منظور يناسبك.",
              "Explore objectives, indicators and initiatives from your preferred perspective.",
            )}
          </p>
        </div>
      </div>
      <div className="tabs section-tabs">
        <button
          className={tab === "structure" ? "active" : ""}
          aria-pressed={tab === "structure"}
          onClick={() => setTab("structure")}
        >
          <Network size={17} />
          {T("الهيكل الاستراتيجي", "Structure")}
        </button>
        <button
          className={tab === "tracking" ? "active" : ""}
          aria-pressed={tab === "tracking"}
          onClick={() => setTab("tracking")}
        >
          <ChartNoAxesCombined size={17} />
          {T("متابعة الأداء", "Performance tracking")}
        </button>
      </div>
      {content === "indicators" || tab === "structure" ? (
        <IndicatorFilters
          items={items}
          filters={filters}
          onChange={setFilters}
          locale={locale}
        />
      ) : (
        <div className="panel explorer-filters">
          <label className="explorer-search">
            <Search size={18} />
            <input
              aria-label={T("البحث في المبادرات", "Search initiatives")}
              value={filters.query}
              onChange={(e) =>
                setFilters({ ...filters, query: e.target.value })
              }
              placeholder={T("ابحث في المبادرات", "Search initiatives")}
            />
          </label>
          <div className="filter-grid">
            <label>
              {T("الهدف", "Objective")}
              <select
                value={filters.objective}
                onChange={(e) =>
                  setFilters({ ...filters, objective: e.target.value })
                }
              >
                <option value="all">{T("الكل", "All")}</option>
                {objectives.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {T("القطاع", "Sector")}
              <select
                value={filters.sector}
                onChange={(e) =>
                  setFilters({ ...filters, sector: e.target.value })
                }
              >
                <option value="all">{T("الكل", "All")}</option>
                {[
                  ...new Map(
                    initiatives
                      .filter((i) => i.domain === domain)
                      .map((i) => [i.sector.ar, i.sector]),
                  ).values(),
                ].map((s) => (
                  <option key={s.ar} value={s.ar}>
                    {s[locale]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
      {tab === "tracking" ? (
        <>
          <div className="view-toolbar">
            <div className="segmented">
              <button
                aria-pressed={content === "indicators"}
                className={content === "indicators" ? "active" : ""}
                onClick={() => setContent("indicators")}
              >
                {T("المؤشرات", "Indicators")} · {filtered.length}
              </button>
              <button
                aria-pressed={content === "initiatives"}
                className={content === "initiatives" ? "active" : ""}
                onClick={() => setContent("initiatives")}
              >
                {T("المبادرات", "Initiatives")} · {filteredInitiatives.length}
              </button>
            </div>
          </div>
          {content === "indicators" ? (
            <div className="performance-grid">
              {filtered.map((k) => (
                <KpiCard key={k.id} kpi={k} />
              ))}
              {!filtered.length && (
                <Empty
                  title={T("لا توجد مؤشرات مطابقة", "No matching indicators")}
                />
              )}
            </div>
          ) : (
            <>
              <p className="integration-note">
                {T(
                  "مبادرات توضيحية لمراجعة العرض. لم يتم الربط بنظام المشاريع بعد.",
                  "Illustrative initiatives for design review. Project system integration is not connected yet.",
                )}
              </p>
              <div className="performance-grid">
                {filteredInitiatives.map((i) => (
                  <button
                    className="panel performance-card initiative-card"
                    key={i.id}
                    onClick={() => setInitiative(i)}
                  >
                    <div className="card-topline">
                      <Target size={20} />
                      <bdi>{i.id}</bdi>
                    </div>
                    <h3>{i.name[locale]}</h3>
                    <p>{i.owner[locale]}</p>
                    <div className="card-result">
                      <strong>{i.progress}%</strong>
                      <span>{T("نسبة الإنجاز", "Completion")}</span>
                    </div>
                    <Progress value={i.progress} />
                    <div className="card-bottom">
                      <span
                        className={`badge ${i.status === "delayed" ? "status-returned" : "status-approved"}`}
                      >
                        {i.status === "delayed"
                          ? T("متأخرة", "Delayed")
                          : i.status === "complete"
                            ? T("مكتملة", "Complete")
                            : T("على المسار", "On track")}
                      </span>
                      <span>{T("عرض البطاقة", "View card")}</span>
                    </div>
                  </button>
                ))}
                {!filteredInitiatives.length && (
                  <Empty
                    title={T(
                      "لا توجد مبادرات مطابقة",
                      "No matching initiatives",
                    )}
                  />
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="view-toolbar">
            <div className="segmented view-switcher">
              {[
                ["map", T("الخريطة الاستراتيجية", "Strategy map"), Network],
                [
                  "organization",
                  T("الهيكل التنظيمي", "Organization"),
                  Building2,
                ],
                ["tree", T("العرض الشجري", "Tree view"), ListTree],
                ["dashboard", T("لوح المعلومات", "Dashboard"), LayoutDashboard],
              ].map(([id, label, Icon]) => {
                const ViewIcon = Icon as typeof Network;
                return (
                  <button
                    key={id as string}
                    aria-pressed={view === id}
                    className={view === id ? "active" : ""}
                    onClick={() => setView(id as string)}
                  >
                    <ViewIcon size={16} />
                    {label as string}
                  </button>
                );
              })}
            </div>
            <span className="muted">
              {filtered.length} {T("مؤشر", "indicators")}
            </span>
          </div>
          {view === "dashboard" ? (
            <div className="performance-grid">
              {groups.map((g) => {
                const values = g.items
                  .map((k) => scoreFor(k, period, store))
                  .filter((v): v is number => v !== null);
                const average = values.length
                  ? values.reduce((a, b) => a + b, 0) / values.length
                  : null;
                return (
                  <section className="panel performance-card" key={g.id}>
                    <div className="eyebrow">
                      {T("تحقيق الهدف", "OBJECTIVE ACHIEVEMENT")}
                    </div>
                    <h3>{g.name}</h3>
                    <div className="card-result">
                      <Score value={average} locale={locale} />
                    </div>
                    <Progress value={average ?? 0} />
                    <p>
                      {values.length} / {g.items.length}{" "}
                      {T("نتائج معتمدة", "approved results")}
                    </p>
                    <button
                      className="text-link"
                      onClick={() => {
                        setFilters({ ...filters, objective: g.id });
                        setTab("tracking");
                        setContent("indicators");
                      }}
                    >
                      {T("الاطلاع على التفاصيل", "Drill into details")}
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className={`strategy-explorer ${view}`}>
              {groups.map((g) => (
                <section className="panel strategy-group" key={g.id}>
                  <div className="strategy-group-heading">
                    <Target size={19} />
                    <h2>{g.name}</h2>
                    <span className="count-pill">{g.items.length}</span>
                  </div>
                  <div className="strategy-nodes">
                    {g.items.map((k) => (
                      <Link
                        key={k.id}
                        className={`strategy-node band-${performanceBand(scoreFor(k, period, store))}`}
                        href={`/indicators/${k.id}`}
                      >
                        <bdi>{k.code}</bdi>
                        <strong>{k.name[locale]}</strong>
                        <span>
                          {T("المستهدف", "Target")}:{" "}
                          {k.periodicTargets?.[period] ?? k.target}
                          {k.unit === "percent" ? "%" : T(" أيام", " days")}
                        </span>
                        <Score
                          value={scoreFor(k, period, store)}
                          locale={locale}
                        />
                      </Link>
                    ))}
                  </div>
                  {view !== "organization" &&
                    filteredInitiatives
                      .filter((i) => i.objective === g.id)
                      .map((i) => (
                        <button
                          key={i.id}
                          className="strategy-initiative"
                          onClick={() => setInitiative(i)}
                        >
                          <Target size={15} />
                          <span>
                            {T("مبادرة توضيحية", "Sample initiative")} ·{" "}
                            {i.name[locale]}
                          </span>
                          <bdi>{i.progress}%</bdi>
                        </button>
                      ))}
                </section>
              ))}
            </div>
          )}
          {!groups.length && (
            <Empty
              title={T("لا توجد نتائج مطابقة", "No matching results")}
              detail={T(
                "عدّل عوامل التصفية لعرض عناصر الهيكل.",
                "Adjust filters to show structure elements.",
              )}
            />
          )}
        </>
      )}
      {initiative && (
        <Dialog
          locale={locale}
          title={initiative.name[locale]}
          onClose={() => setInitiative(null)}
        >
          <div className="dialog-body">
            <p>{initiative.description[locale]}</p>
            <dl className="definition-list">
              <div>
                <dt>{T("المالك", "Owner")}</dt>
                <dd>{initiative.owner[locale]}</dd>
              </div>
              <div>
                <dt>{T("القطاع", "Sector")}</dt>
                <dd>{initiative.sector[locale]}</dd>
              </div>
              <div>
                <dt>{T("الهدف المرتبط", "Linked objective")}</dt>
                <dd>
                  {
                    objectives.find((o) => o.id === initiative.objective)?.name[
                      locale
                    ]
                  }
                </dd>
              </div>
              <div>
                <dt>{T("الإنجاز", "Completion")}</dt>
                <dd>{initiative.progress}%</dd>
              </div>
              <div>
                <dt>{T("تاريخ الإنجاز المتوقع", "Expected completion")}</dt>
                <dd>{initiative.due}</dd>
              </div>
              <div>
                <dt>{T("مصدر البيانات", "Data source")}</dt>
                <dd>
                  {T(
                    "نموذج توضيحي — التكامل غير متصل",
                    "Illustrative example — integration not connected",
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function ReportsPage() {
  const { locale, store, domain, period, role } = useWorkspace();
  const [filters, setFilters] = useState({ ...emptyFilters });
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const items = store.kpis.filter((k) => k.domain === domain);
  const filtered = filterIndicators(items, filters, period, store);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {T("نتائج الأداء", "PERFORMANCE RESULTS")}
          </div>
          <h1>{T("التقارير", "Reports")}</h1>
          <p>
            {T(
              "معاينة تقرير الأداء وفق الجهة والفترة وعوامل التصفية المختارة.",
              "Preview performance for the selected organization, period and filters.",
            )}
          </p>
        </div>
        <div className="button-group no-print">
          {role === "performance" && (
            <button
              className="button secondary"
              onClick={() =>
                downloadCsv(
                  indicatorsCsv(filtered, store, period, locale),
                  `Baseer-${domain}-${period}.csv`,
                )
              }
            >
              <Download size={17} />
              {T("تصدير CSV لـ Excel", "Export CSV for Excel")}
            </button>
          )}
          <button className="button primary" onClick={() => window.print()}>
            <FileText size={17} />
            {T("طباعة / حفظ PDF", "Print / save PDF")}
          </button>
        </div>
      </div>
      <div className="no-print">
        <IndicatorFilters
          items={items}
          filters={filters}
          onChange={setFilters}
          locale={locale}
        />
      </div>
      <section className="panel report-sheet">
        <div className="report-heading">
          <h2>{T("تقرير متابعة الأداء", "Performance monitoring report")}</h2>
          <p>
            {domain === "program"
              ? T(
                  "برنامج تطوير وزارة الحرس الوطني",
                  "National Guard Development Program",
                )
              : T("وزارة الحرس الوطني", "Ministry of National Guard")}{" "}
            · <bdi>{period}</bdi>
          </p>
          <span className="badge status-draft">
            {T(
              "معاينة تجريبية · ليس تقريرًا صادرًا معتمدًا",
              "Prototype preview · not an officially issued report",
            )}
          </span>
        </div>
        {filtered.map((k) => (
          <article key={k.id} className="report-row">
            <div>
              <bdi>{k.code}</bdi>
              <h3>{k.name[locale]}</h3>
              <p>
                {k.owner[locale]} ·{" "}
                {frequencyNames[k.frequency ?? "quarterly"][locale]}
              </p>
            </div>
            <div>
              <span>{T("المستهدف", "Target")}</span>
              <strong>
                {k.periodicTargets?.[period] ?? k.target}
                {k.unit === "percent" ? "%" : T(" أيام", " days")}
              </strong>
            </div>
            <div>
              <span>{T("التحقيق المعتمد", "Approved achievement")}</span>
              <Score value={scoreFor(k, period, store)} locale={locale} />
            </div>
          </article>
        ))}
        {!filtered.length && (
          <Empty title={T("لا توجد نتائج للتقرير", "No report results")} />
        )}
        <p className="report-note">
          {T(
            "يعرض التقرير النتائج المعتمدة في النموذج فقط. إصدار التقارير الرسمي ومكتبة التقارير المعتمدة يتطلبان ربط مسار الاعتماد وقاعدة البيانات.",
            "Only measurements approved in the prototype contribute to this preview. Official issuance and the approved report library require the approval service and database.",
          )}
        </p>
      </section>
    </>
  );
}
