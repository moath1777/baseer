"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import {
  Plus,
  ClipboardList,
  GitPullRequest,
  History,
  CalendarDays,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { roles, type WorkRequest } from "@/lib/domain";
import { Badge, Dialog, Empty } from "./ui";

export function TaskCenter({
  measurement,
  approvals,
  create,
  initialTab = "measurement",
}: {
  measurement: ReactNode;
  approvals: ReactNode;
  create: ReactNode;
  initialTab?: string;
}) {
  const { store, save, role, locale, domain, period } = useWorkspace();
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const [tab, setTab] = useState(initialTab);
  const [dialog, setDialog] = useState(false);
  const [selected, setSelected] = useState<WorkRequest | null>(null);
  const [comment, setComment] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "change",
    title: "",
    detail: "",
    kpiId: "",
    replacement: "",
    start: "",
    end: "",
  });
  const requests = (store.requests ?? []).filter((r) => r.domain === domain);
  const shown = requests.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (type === "all" || r.type === type) &&
      `${r.title} ${r.detail}`.includes(search),
  );
  const names = {
    change: T("طلب تغيير", "Change request"),
    corrective: T("خطة تصحيحية", "Corrective plan"),
    delegation: T("طلب تفويض", "Delegation request"),
  };
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!store.kpis.some((k) => k.id === form.kpiId && k.domain === domain)) {
      setError(
        T(
          "اختر مؤشرًا من الجهة الحالية.",
          "Choose an indicator from the current organization.",
        ),
      );
      return;
    }
    if (
      form.type === "delegation" &&
      (!form.start || !form.end || form.end < form.start)
    ) {
      setError(
        T(
          "يجب أن يكون تاريخ النهاية مساويًا لتاريخ البداية أو بعده.",
          "End date must be on or after the start date.",
        ),
      );
      return;
    }
    const request: WorkRequest = {
      ...form,
      type: form.type as WorkRequest["type"],
      id: crypto.randomUUID(),
      domain,
      status: "submitted",
      createdAt: new Date().toISOString(),
      actor: role,
      comment: "",
    };
    save({
      ...store,
      requests: [request, ...(store.requests ?? [])],
      events: [
        {
          id: crypto.randomUUID(),
          kpiId: request.kpiId,
          action: {
            ar: "تقديم طلب في مركز المهام",
            en: "Task center request submitted",
          },
          actor: roles[role],
          at: request.createdAt,
          detail: request.title,
        },
        ...store.events,
      ],
    });
    setDialog(false);
    setTab("requests");
    setForm({
      type: "change",
      title: "",
      detail: "",
      kpiId: "",
      replacement: "",
      start: "",
      end: "",
    });
  }
  function decide(next: "approved" | "returned") {
    if (
      !selected ||
      !["owner", "performance"].includes(role) ||
      selected.status !== "submitted"
    )
      return;
    if (next === "returned" && !comment.trim()) {
      setError(T("أدخل سبب الإعادة.", "Enter a return reason."));
      return;
    }
    save({
      ...store,
      requests: (store.requests ?? []).map((r) =>
        r.id === selected.id ? { ...r, status: next, comment } : r,
      ),
      events: [
        {
          id: crypto.randomUUID(),
          kpiId: selected.kpiId,
          action:
            next === "approved"
              ? {
                  ar: "اعتماد الطلب في المحاكاة",
                  en: "Request approved in simulation",
                }
              : { ar: "إعادة الطلب للاستكمال", en: "Request returned" },
          actor: roles[role],
          at: new Date().toISOString(),
          detail: `${selected.title} — ${comment}`,
        },
        ...store.events,
      ],
    });
    setSelected(null);
    setComment("");
    setError("");
  }
  const isTeam = role === "performance";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{roles[role][locale]}</div>
          <h1>{T("مركز المهام", "Task center")}</h1>
          <p>
            {T(
              "دورة القياس والطلبات والموافقات في مكان واحد.",
              "Measurements, requests and approvals in one place.",
            )}
          </p>
        </div>
        <div className="button-group">
          {create}
          {role !== "viewer" && (
            <button
              className="button secondary"
              onClick={() => {
                setDialog(true);
                setError("");
              }}
            >
              <Plus size={17} />
              {T("إنشاء طلب", "New request")}
            </button>
          )}
        </div>
      </div>
      <div className="tabs section-tabs">
        {[
          ["measurement", T("دورة القياس", "Measurements"), ClipboardList],
          ["requests", T("الطلبات", "Requests"), GitPullRequest],
          ["approvals", T("الموافقات", "Approvals"), GitPullRequest],
          ["history", T("سجل الإجراءات", "Activity"), History],
          ...(isTeam
            ? [["team", T("فريق الأداء", "Performance team"), CalendarDays]]
            : []),
        ].map(([id, label, Icon]) => {
          const TabIcon = Icon as typeof History;
          return (
            <button
              key={id as string}
              className={tab === id ? "active" : ""}
              aria-pressed={tab === id}
              onClick={() => setTab(id as string)}
            >
              <TabIcon size={16} />
              {label as string}
            </button>
          );
        })}
      </div>
      <div className="task-content">
        {tab === "measurement" ? (
          measurement
        ) : tab === "approvals" ? (
          approvals
        ) : tab === "requests" ? (
          <>
            <div className="panel explorer-filters">
              <div className="filter-grid">
                <label>
                  {T("بحث في الطلبات", "Search requests")}
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  {T("نوع الطلب", "Request type")}
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="all">{T("الكل", "All")}</option>
                    {Object.entries(names).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {T("الحالة", "Status")}
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">{T("الكل", "All")}</option>
                    <option value="submitted">
                      {T("بانتظار المراجعة", "In review")}
                    </option>
                    <option value="approved">{T("معتمد", "Approved")}</option>
                    <option value="returned">
                      {T("معاد للاستكمال", "Returned")}
                    </option>
                  </select>
                </label>
              </div>
            </div>
            <div className="performance-grid">
              {shown.map((r) => (
                <button
                  className="panel performance-card initiative-card"
                  key={r.id}
                  onClick={() => {
                    setSelected(r);
                    setComment("");
                    setError("");
                  }}
                >
                  <div className="eyebrow">{names[r.type]}</div>
                  <h3>{r.title}</h3>
                  <p>
                    {store.kpis.find((k) => k.id === r.kpiId)?.name[locale]}
                  </p>
                  <div className="card-bottom">
                    <Badge status={r.status} locale={locale} />
                    <span>
                      {new Date(r.createdAt).toLocaleDateString(
                        locale === "ar" ? "ar-SA-u-ca-gregory" : "en-GB",
                      )}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {!shown.length && (
              <Empty
                title={T("لا توجد طلبات مطابقة", "No matching requests")}
                detail={T(
                  "ستظهر طلبات التغيير والخطط التصحيحية والتفويض هنا عند إنشائها.",
                  "Change requests, corrective plans and delegations appear here once created.",
                )}
              />
            )}
            <p className="integration-note">
              {T(
                "محاكاة دورة الطلب: لا يغيّر اعتماد الطلب بيانات المؤشر أو صلاحيات المستخدمين تلقائيًا في هذه المرحلة.",
                "Request workflow simulation: approval does not automatically alter KPI data or user permissions at this stage.",
              )}
            </p>
          </>
        ) : tab === "team" && isTeam ? (
          <section className="panel team-panel">
            <h2>
              {T("متابعة أعمال فريق الأداء", "Performance team workload")}
            </h2>
            <p>
              {T(
                "ملخص المتابعة للجهة والفترة المحددتين",
                "Summary for the selected organization and period",
              )}{" "}
              · <bdi>{period}</bdi>
            </p>
            <div className="performance-grid">
              {[
                ...new Map(
                  store.kpis
                    .filter((k) => k.domain === domain)
                    .map((k) => [k.ambassador.ar, k.ambassador]),
                ).values(),
              ].map((a) => {
                const owned = store.kpis.filter(
                  (k) =>
                    k.domain === domain &&
                    k.ambassador.ar === a.ar &&
                    k.type === "standalone",
                );
                const ms = store.measurements.filter(
                  (m) =>
                    m.period === period && owned.some((k) => k.id === m.kpiId),
                );
                return (
                  <div className="panel performance-card" key={a.ar}>
                    <h3>{a[locale]}</h3>
                    <p>
                      {owned.length} {T("مؤشرات مسندة", "assigned indicators")}
                    </p>
                    <strong>
                      {ms.filter((m) => m.status === "approved").length}{" "}
                      {T("معتمد", "approved")}
                    </strong>
                    <p>
                      {owned.length -
                        ms.filter((m) => m.status === "approved").length}{" "}
                      {T("تتطلب متابعة", "require follow-up")}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-heading">
              <h2>{T("سجل الإجراءات", "Activity history")}</h2>
            </div>
            {store.events
              .filter((e) =>
                store.kpis.some((k) => k.id === e.kpiId && k.domain === domain),
              )
              .map((e) => (
                <div className="timeline-event" key={e.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{e.action[locale]}</strong>
                    <p>
                      {e.actor[locale]} ·{" "}
                      {new Date(e.at).toLocaleString(
                        locale === "ar" ? "ar-SA-u-ca-gregory" : "en-GB",
                      )}
                    </p>
                    <p>{e.detail}</p>
                  </div>
                </div>
              ))}
            {!store.events.some((e) =>
              store.kpis.some((k) => k.id === e.kpiId && k.domain === domain),
            ) && (
              <Empty
                title={T("لا توجد إجراءات مسجلة بعد", "No activity yet")}
                detail={T(
                  "يظهر هنا من أنشأ أو راجع قياسًا أو طلبًا ووقت الإجراء.",
                  "This records who created or reviewed a measurement or request, and when.",
                )}
              />
            )}
          </section>
        )}
      </div>
      {dialog && (
        <Dialog
          title={T("إنشاء طلب", "New request")}
          locale={locale}
          onClose={() => setDialog(false)}
        >
          <form onSubmit={submit}>
            <div className="dialog-body form-grid">
              <label className="field full">
                {T("نوع الطلب", "Request type")}
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {Object.entries(names).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field full">
                {T("المؤشر المرتبط", "Linked indicator")}
                <select
                  required
                  value={form.kpiId}
                  onChange={(e) => setForm({ ...form, kpiId: e.target.value })}
                >
                  <option value="">
                    {T("اختر المؤشر", "Choose indicator")}
                  </option>
                  {store.kpis
                    .filter((k) => k.domain === domain)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name[locale]}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field full">
                {T("عنوان الطلب", "Request title")}
                <input
                  required
                  maxLength={160}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="field full">
                {form.type === "corrective"
                  ? T(
                      "الإجراءات التصحيحية والمسؤول والموعد",
                      "Corrective actions, owner and deadline",
                    )
                  : T("تفاصيل الطلب ومبرراته", "Details and justification")}
                <textarea
                  required
                  rows={4}
                  maxLength={3000}
                  value={form.detail}
                  onChange={(e) => setForm({ ...form, detail: e.target.value })}
                />
              </label>
              {form.type === "delegation" && (
                <>
                  <label className="field full">
                    {T("المفوض له والدور", "Delegate and role")}
                    <input
                      required
                      value={form.replacement}
                      onChange={(e) =>
                        setForm({ ...form, replacement: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    {T("تاريخ البداية", "Start date")}
                    <input
                      type="date"
                      required
                      value={form.start}
                      onChange={(e) =>
                        setForm({ ...form, start: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    {T("تاريخ النهاية", "End date")}
                    <input
                      type="date"
                      min={form.start}
                      required
                      value={form.end}
                      onChange={(e) =>
                        setForm({ ...form, end: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
              {error && (
                <p role="alert" className="form-error full">
                  {error}
                </p>
              )}
            </div>
            <div className="dialog-footer">
              <button className="button primary" type="submit">
                {T("إرسال للمراجعة", "Submit for review")}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {selected && (
        <Dialog
          title={selected.title}
          locale={locale}
          onClose={() => setSelected(null)}
        >
          <div className="dialog-body">
            <Badge status={selected.status} locale={locale} />
            <p>{selected.detail}</p>
            {selected.type === "delegation" && (
              <p>
                {selected.replacement} · {selected.start} — {selected.end}
              </p>
            )}
            <p>
              {T("مقدم الطلب", "Submitted by")}: {roles[selected.actor][locale]}
            </p>
            {selected.comment && <blockquote>{selected.comment}</blockquote>}
            {selected.status === "submitted" &&
              ["performance", "owner"].includes(role) && (
                <>
                  <label className="field">
                    {T("ملاحظات المراجعة", "Review comments")}
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                    />
                  </label>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="button-group">
                    <button
                      className="button primary"
                      onClick={() => decide("approved")}
                    >
                      {T("اعتماد تجريبي", "Approve in simulation")}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => decide("returned")}
                    >
                      {T("إعادة للاستكمال", "Return")}
                    </button>
                  </div>
                </>
              )}
          </div>
        </Dialog>
      )}
    </>
  );
}
