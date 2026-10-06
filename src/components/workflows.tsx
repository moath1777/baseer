"use client";
import { useState, type FormEvent } from "react";
import {
  Check,
  ArrowLeft,
  ArrowRight,
  FileText,
  Upload,
  X,
  Info,
  CheckCheck,
  RotateCcw,
  Layers,
} from "lucide-react";
import { Dialog, Badge } from "./ui";
import {
  type Locale,
  type KPI,
  type Period,
  type Role,
  type Measurement,
  objectives,
  transition,
} from "@/lib/domain";

export function CreateIndicator({
  locale,
  domain,
  kpis,
  onClose,
  onSave,
}: {
  locale: Locale;
  domain: "program" | "ministry";
  kpis: KPI[];
  onClose: () => void;
  onSave: (kpi: KPI) => void;
}) {
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const initial = {
    nameAr: "",
    nameEn: "",
    description: "",
    objective: "digital",
    owner: "",
    ambassador: "",
    type: "standalone",
    target: "90",
    baseline: "60",
    unit: "percent",
    direction: "positive",
  };
  const draftKey = `baseer:m1:kpi-draft:${domain}`;
  const [form, setForm] = useState(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (
        parsed &&
        Object.keys(initial).every((k) => typeof parsed[k] === "string") &&
        objectives.some((o) => o.id === parsed.objective) &&
        ["standalone", "composite"].includes(parsed.type) &&
        ["percent", "days"].includes(parsed.unit) &&
        ["positive", "negative"].includes(parsed.direction)
      )
        return { ...initial, ...parsed } as typeof initial;
    } catch {}
    return initial;
  });
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [children, setChildren] = useState<{ id: string; weight: number }[]>(
    () => {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
        return Array.isArray(draft?.children)
          ? draft.children.filter(
              (c: { id: string; weight: number }) =>
                kpis.some((k) => k.id === c.id && k.type === "standalone") &&
                Number.isFinite(c.weight) &&
                c.weight >= 0,
            )
          : [];
      } catch {
        return [];
      }
    },
  );
  const set = (key: keyof typeof form, value: string) =>
    setForm({ ...form, [key]: value });
  const labels = [
    T("البيانات الأساسية", "Basic information"),
    T("المسؤوليات", "Responsibilities"),
    T("القياس والمستهدفات", "Measurement & targets"),
    T("المراجعة", "Review"),
  ];
  function next(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (step === 0 && (!form.nameAr.trim() || !form.description.trim()))
      return setError(
        T(
          "أكمل اسم المؤشر ووصفه.",
          "Complete the indicator name and description.",
        ),
      );
    if (step === 1 && (!form.owner.trim() || !form.ambassador.trim()))
      return setError(
        T("حدد مالك المؤشر وسفير الأداء.", "Specify the owner and ambassador."),
      );
    if (step === 2) {
      const target = Number(form.target),
        baseline = Number(form.baseline);
      if (
        !form.target.trim() ||
        !form.baseline.trim() ||
        !Number.isFinite(target) ||
        target <= 0 ||
        !Number.isFinite(baseline) ||
        baseline < 0 ||
        (form.unit === "percent" && (target > 100 || baseline > 100))
      )
        return setError(
          T(
            "أدخل مستهدفًا موجبًا وخط أساس صالحًا. النسبة المئوية بين 0 و100.",
            "Enter a positive target and valid baseline. Percentages must be between 0 and 100.",
          ),
        );
      if (
        form.type === "composite" &&
        (!children.length ||
          children.some((c) => c.weight <= 0) ||
          Math.abs(children.reduce((n, c) => n + c.weight, 0) - 100) > 0.001)
      )
        return setError(
          T(
            "اختر مؤشرات فرعية بأوزان موجبة مجموعها 100%.",
            "Choose child indicators with positive weights totalling 100%.",
          ),
        );
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    const codeNumber =
      kpis.reduce(
        (max, k) => Math.max(max, Number(k.code.split("-").at(-1)) || 0),
        0,
      ) + 1;
    const sector =
      form.objective === "digital"
        ? { ar: "التحول الرقمي", en: "Digital transformation" }
        : form.objective === "people"
          ? { ar: "رأس المال البشري", en: "Human capital" }
          : { ar: "التميز المؤسسي", en: "Institutional excellence" };
    const created: KPI = {
      id: crypto.randomUUID(),
      code: `${domain === "program" ? "KPI" : "MNG"}-${codeNumber.toString().padStart(3, "0")}`,
      name: {
        ar: form.nameAr.trim(),
        en: form.nameEn.trim() || form.nameAr.trim(),
      },
      description: { ar: form.description.trim(), en: form.description.trim() },
      domain,
      objective: form.objective,
      owner: { ar: form.owner.trim(), en: form.owner.trim() },
      ambassador: { ar: form.ambassador.trim(), en: form.ambassador.trim() },
      sector,
      target: form.type === "composite" ? 100 : Number(form.target),
      baseline: Number(form.baseline),
      unit: form.type === "composite" ? "percent" : (form.unit as KPI["unit"]),
      direction:
        form.type === "composite"
          ? "positive"
          : (form.direction as KPI["direction"]),
      type: form.type as KPI["type"],
      children: form.type === "composite" ? children : [],
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    onSave(created);
  }
  return (
    <Dialog
      title={T("إنشاء مؤشر أداء", "Create a performance indicator")}
      onClose={onClose}
      locale={locale}
      wide
    >
      <ol className="wizard-steps">
        {labels.map((label, index) => (
          <li
            className={
              index === step ? "current" : index < step ? "complete" : ""
            }
            key={label}
          >
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      <form onSubmit={next}>
        <div className="dialog-body wizard-body">
          <div className="step-title">
            <span>{T(`الخطوة ${step + 1} من 4`, `STEP ${step + 1} OF 4`)}</span>
            <h3>{labels[step]}</h3>
          </div>
          {step === 0 && (
            <div className="form-grid">
              <label className="field full">
                {T("اسم المؤشر بالعربية", "Indicator name in Arabic")}{" "}
                <span>*</span>
                <input
                  autoFocus
                  required
                  maxLength={140}
                  value={form.nameAr}
                  onChange={(e) => set("nameAr", e.target.value)}
                  placeholder={T(
                    "مثال: نسبة الخدمات المؤتمتة",
                    "e.g. نسبة الخدمات المؤتمتة",
                  )}
                />
              </label>
              <label className="field full">
                {T("اسم المؤشر بالإنجليزية", "Indicator name in English")}
                <input
                  dir="ltr"
                  maxLength={140}
                  value={form.nameEn}
                  onChange={(e) => set("nameEn", e.target.value)}
                  placeholder="e.g. Automated services"
                />
              </label>
              <label className="field full">
                {T("وصف المؤشر", "Description")} <span>*</span>
                <textarea
                  required
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder={T(
                    "ما الذي يقيسه هذا المؤشر؟",
                    "What does this indicator measure?",
                  )}
                />
              </label>
              <label className="field">
                {T("الهدف الاستراتيجي", "Strategic objective")}
                <select
                  value={form.objective}
                  onChange={(e) => set("objective", e.target.value)}
                >
                  {objectives.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name[locale]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {T("نوع المؤشر", "Indicator type")}
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                >
                  <option value="standalone">{T("مستقل", "Standalone")}</option>
                  <option value="composite">{T("مركب", "Composite")}</option>
                </select>
              </label>
            </div>
          )}
          {step === 1 && (
            <div className="form-grid">
              <label className="field full">
                {T("مالك المؤشر / الإدارة", "Indicator owner / department")}{" "}
                <span>*</span>
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={form.owner}
                  onChange={(e) => set("owner", e.target.value)}
                  placeholder={T(
                    "مثال: إدارة التحول الرقمي",
                    "e.g. Digital Transformation Dept.",
                  )}
                />
              </label>
              <label className="field full">
                {T("سفير الأداء", "Performance ambassador")} <span>*</span>
                <input
                  required
                  maxLength={100}
                  value={form.ambassador}
                  onChange={(e) => set("ambassador", e.target.value)}
                  placeholder={T(
                    "اسم المسؤول عن إدخال القياسات",
                    "Person responsible for entering measurements",
                  )}
                />
              </label>
              <div className="inline-notice full">
                <Info size={18} />
                <span>
                  {T(
                    "في النموذج التجريبي تُدخل المسؤوليات نصيًا. ربطها بمستخدمي الجهة وصلاحياتهم ضمن المرحلة الثانية.",
                    "Responsibilities are entered as text in this prototype. User accounts and scope permissions belong to milestone 2.",
                  )}
                </span>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="form-grid">
              <label className="field">
                {T("وحدة القياس", "Measurement unit")}
                <select
                  disabled={form.type === "composite"}
                  value={form.type === "composite" ? "percent" : form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                >
                  <option value="percent">
                    {T("نسبة مئوية", "Percentage")}
                  </option>
                  <option value="days">{T("أيام عمل", "Business days")}</option>
                </select>
              </label>
              <label className="field">
                {T("اتجاه المؤشر", "Direction")}
                <select
                  disabled={form.type === "composite"}
                  value={
                    form.type === "composite" ? "positive" : form.direction
                  }
                  onChange={(e) => set("direction", e.target.value)}
                >
                  <option value="positive">
                    {T("إيجابي · الأعلى أفضل", "Positive · higher is better")}
                  </option>
                  <option value="negative">
                    {T("سلبي · الأقل أفضل", "Negative · lower is better")}
                  </option>
                </select>
              </label>
              <label className="field">
                {T("المستهدف", "Target")} <span>*</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="any"
                  max={
                    form.unit === "percent" || form.type === "composite"
                      ? 100
                      : undefined
                  }
                  disabled={form.type === "composite"}
                  value={form.type === "composite" ? "100" : form.target}
                  onChange={(e) => set("target", e.target.value)}
                />
              </label>
              <label className="field">
                {T("خط الأساس · 2025", "Baseline · 2025")} <span>*</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  max={form.unit === "percent" ? 100 : undefined}
                  value={form.baseline}
                  onChange={(e) => set("baseline", e.target.value)}
                />
              </label>
              {form.type === "composite" && (
                <div className="full child-picker">
                  <h4>
                    {T(
                      "المؤشرات الفرعية والأوزان",
                      "Child indicators and weights",
                    )}
                  </h4>
                  {kpis
                    .filter((k) => k.type === "standalone")
                    .map((k) => {
                      const child = children.find((c) => c.id === k.id);
                      return (
                        <div key={k.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={!!child}
                              onChange={(e) =>
                                setChildren(
                                  e.target.checked
                                    ? [...children, { id: k.id, weight: 0 }]
                                    : children.filter((c) => c.id !== k.id),
                                )
                              }
                            />
                            {k.name[locale]}
                          </label>
                          {child && (
                            <input
                              aria-label={`${T("وزن", "Weight")} ${k.name[locale]}`}
                              type="number"
                              min="1"
                              max="100"
                              step="any"
                              value={child.weight}
                              onChange={(e) =>
                                setChildren(
                                  children.map((c) =>
                                    c.id === k.id
                                      ? { ...c, weight: Number(e.target.value) }
                                      : c,
                                  ),
                                )
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  <p>
                    {T("مجموع الأوزان", "Total weight")}:{" "}
                    <b>{children.reduce((n, c) => n + c.weight, 0)}%</b>
                  </p>
                </div>
              )}
              <div className="inline-notice full">
                <Info size={18} />
                <span>
                  {T(
                    "الدورية ربع سنوية في هذه التجربة. المستهدف ثابت عبر الفترات التجريبية؛ المستهدفات المرحلية والمعادلات المخصصة ضمن المرحلة الثالثة.",
                    "This prototype uses quarterly frequency and a fixed target. Period-specific targets and custom formulas belong to milestone 3.",
                  )}
                </span>
              </div>
            </div>
          )}
          {step === 3 && (
            <>
              <div className="review-kpi">
                <span className="kpi-symbol">
                  <Layers size={23} />
                </span>
                <h3>{form.nameAr}</h3>
                <p>{form.description}</p>
              </div>
              <dl className="definition-list compact">
                <div>
                  <dt>{T("الهدف", "Objective")}</dt>
                  <dd>
                    {
                      objectives.find((o) => o.id === form.objective)!.name[
                        locale
                      ]
                    }
                  </dd>
                </div>
                <div>
                  <dt>{T("المالك", "Owner")}</dt>
                  <dd>{form.owner}</dd>
                </div>
                <div>
                  <dt>{T("السفير", "Ambassador")}</dt>
                  <dd>{form.ambassador}</dd>
                </div>
                <div>
                  <dt>{T("المستهدف", "Target")}</dt>
                  <dd>
                    {form.type === "composite"
                      ? "100%"
                      : `${form.target}${form.unit === "percent" ? "%" : T(" أيام", " days")}`}
                  </dd>
                </div>
                <div>
                  <dt>{T("النوع", "Type")}</dt>
                  <dd>
                    {form.type === "composite"
                      ? T("مركب", "Composite")
                      : T("مستقل", "Standalone")}
                  </dd>
                </div>
              </dl>
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <div>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                try {
                  localStorage.setItem(
                    draftKey,
                    JSON.stringify({ ...form, children }),
                  );
                  onClose();
                } catch {
                  setError(
                    T(
                      "تعذر حفظ المسودة على هذا الجهاز.",
                      "Unable to save the draft on this device.",
                    ),
                  );
                }
              }}
            >
              {T("حفظ المسودة", "Save draft")}
            </button>
          </div>
          <div className="button-group">
            {step > 0 && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                {T("السابق", "Back")}
              </button>
            )}
            <button className="button primary" type="submit">
              {step === 3
                ? T("حفظ المؤشر", "Save indicator")
                : T("التالي", "Continue")}
              {step === 3 ? (
                <Check size={17} />
              ) : locale === "ar" ? (
                <ArrowLeft size={17} />
              ) : (
                <ArrowRight size={17} />
              )}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function MeasurementForm({
  locale,
  kpi,
  period,
  role,
  existing,
  onClose,
  onSave,
}: {
  locale: Locale;
  kpi: KPI;
  period: Period;
  role: Role;
  existing?: Measurement;
  onClose: () => void;
  onSave: (m: Measurement) => void;
}) {
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const [value, setValue] = useState(existing?.value.toString() ?? "");
  const [observation, setObservation] = useState(existing?.observation ?? "");
  const [files, setFiles] = useState<string[]>(existing?.evidence ?? []);
  const [error, setError] = useState("");
  function save(submit: boolean) {
    const number = Number(value);
    if (
      !value.trim() ||
      !Number.isFinite(number) ||
      number < 0 ||
      (kpi.direction === "negative" && number === 0) ||
      (kpi.unit === "percent" && number > 100)
    )
      return setError(
        T(
          "أدخل قيمة صالحة؛ النسبة بين 0 و100، والقيمة السلبية الاتجاه يجب أن تكون أكبر من صفر.",
          "Enter a valid value: percentages are 0–100; negative-direction values must be greater than zero.",
        ),
      );
    if (
      period !== "2026-Q3" ||
      !["performance", "ambassador"].includes(role) ||
      (existing && !["draft", "returned"].includes(existing.status))
    )
      return setError(
        T("هذا القياس غير متاح للتعديل.", "This measurement cannot be edited."),
      );
    const m: Measurement = {
      id: existing?.id ?? crypto.randomUUID(),
      kpiId: kpi.id,
      period,
      value: number,
      observation,
      evidence: files,
      status: "draft",
      comment: existing?.comment ?? "",
      updatedAt: new Date().toISOString(),
    };
    try {
      onSave(submit ? transition(m, "submit", role) : m);
    } catch {
      setError(T("تعذر إرسال القياس.", "Unable to submit measurement."));
    }
  }
  return (
    <Dialog
      title={T("إدخال قياس المؤشر", "Enter a measurement")}
      locale={locale}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(true);
        }}
      >
        <div className="dialog-body">
          <div className="form-context">
            <span className="code">{kpi.code}</span>
            <h3>{kpi.name[locale]}</h3>
            <p>
              {T("الربع الثالث 2026", "Q3 2026")} · {T("المستهدف", "Target")}:{" "}
              {kpi.target}
              {kpi.unit === "percent" ? "%" : T(" أيام", " days")}
            </p>
          </div>
          {existing?.status === "returned" && (
            <div className="return-note">{existing.comment}</div>
          )}
          <label className="field">
            {T("القيمة الفعلية", "Actual value")} <span>*</span>
            <div className="input-suffix">
              <input
                aria-label={T("القيمة الفعلية", "Actual value")}
                autoFocus
                required
                type="number"
                step="any"
                min={kpi.direction === "negative" ? "0.01" : "0"}
                max={kpi.unit === "percent" ? "100" : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <span>{kpi.unit === "percent" ? "%" : T("يوم", "days")}</span>
            </div>
          </label>
          <label className="field">
            {T("مشاهدات الأداء", "Performance observations")}
            <textarea
              value={observation}
              rows={4}
              maxLength={2000}
              onChange={(e) => setObservation(e.target.value)}
              placeholder={T(
                "فسّر النتيجة وأبرز العوامل المؤثرة…",
                "Explain the result and contributing factors…",
              )}
            />
          </label>
          <div className="field">
            <span>{T("الأدلة الداعمة", "Supporting evidence")}</span>
            <label className="upload-zone">
              <Upload size={21} />
              <strong>{T("اختيار ملفات", "Choose files")}</strong>
              <small>PDF, PNG, JPG, XLSX · 10 MB</small>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.xlsx"
                aria-label={T(
                  "اختيار الأدلة الداعمة",
                  "Choose supporting evidence",
                )}
                onChange={(e) => {
                  const picked = [...(e.target.files ?? [])];
                  if (
                    picked.some(
                      (f) =>
                        f.size > 10 * 1024 * 1024 ||
                        !/\.(pdf|png|jpe?g|xlsx)$/i.test(f.name),
                    )
                  ) {
                    setError(
                      T(
                        "اختر ملفات من الأنواع الموضحة، بحجم لا يتجاوز 10 ميجابايت لكل ملف.",
                        "Choose an allowed file type, up to 10 MB per file.",
                      ),
                    );
                    e.target.value = "";
                    return;
                  }
                  setError("");
                  setFiles([
                    ...new Set([...files, ...picked.map((f) => f.name)]),
                  ]);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="field-help">
              {T(
                "للتجربة: تُحفظ أسماء الملفات فقط، ولا يُرفع محتواها أو يُخزن.",
                "Prototype: only filenames are saved. File contents are not uploaded or stored.",
              )}
            </p>
            {files.map((f) => (
              <div className="file-item" key={f}>
                <FileText size={16} />
                <span>{f}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${T("إزالة", "Remove")} ${f}`}
                  onClick={() => setFiles(files.filter((x) => x !== f))}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <button
            type="button"
            className="button secondary"
            onClick={() => save(false)}
          >
            {T("حفظ مسودة", "Save draft")}
          </button>
          <button type="submit" className="button primary">
            {T("إرسال للمراجعة", "Submit for review")}
            <Check size={17} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function ReviewForm({
  locale,
  measurement: m,
  kpi,
  canReview,
  onClose,
  onDecide,
}: {
  locale: Locale;
  measurement: Measurement;
  kpi: KPI;
  canReview: boolean;
  onClose: () => void;
  onDecide: (action: "approve" | "return", comment: string) => void;
}) {
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog
      title={T("مراجعة قياس المؤشر", "Review measurement")}
      locale={locale}
      onClose={onClose}
      wide
    >
      <div className="dialog-body">
        <div className="review-title">
          <div>
            <span className="code">{kpi.code}</span>
            <h3>{kpi.name[locale]}</h3>
          </div>
          <Badge status={m.status} locale={locale} />
        </div>
        <div className="review-flow">
          <span className="done">
            <Check size={14} />
            {T("إدخال القياس", "Entry")}
          </span>
          <span className="current">{T("مراجعة القياس", "Review")}</span>
          <span>{T("الاعتماد", "Approval")}</span>
        </div>
        <div className="review-values">
          <div>
            <span>{T("القيمة المرفوعة", "Submitted value")}</span>
            <strong>
              {m.value}
              {kpi.unit === "percent" ? "%" : T(" أيام", " days")}
            </strong>
          </div>
          <div>
            <span>{T("المستهدف", "Target")}</span>
            <strong>
              {kpi.target}
              {kpi.unit === "percent" ? "%" : T(" أيام", " days")}
            </strong>
          </div>
          <div>
            <span>{T("مقدم القياس", "Submitted by")}</span>
            <strong className="person-name">{kpi.ambassador[locale]}</strong>
          </div>
        </div>
        <h4>{T("مشاهدات الأداء", "Performance observations")}</h4>
        <p className="observation-box">
          {m.observation ||
            T("لم تُضف مشاهدات لهذا القياس.", "No observations were added.")}
        </p>
        <h4>{T("الأدلة الداعمة", "Supporting evidence")}</h4>
        {m.evidence.length ? (
          m.evidence.map((f) => (
            <div className="file-item" key={f}>
              <FileText size={18} />
              <span>{f}</span>
              <small>{T("اسم ملف تجريبي", "Sample filename")}</small>
            </div>
          ))
        ) : (
          <p className="muted">{T("لا توجد مرفقات.", "No attachments.")}</p>
        )}
        <p className="field-help">
          {T(
            "هذه معاينة لأسماء المرفقات؛ الملفات الفعلية غير متاحة في النموذج.",
            "This prototype displays filenames; actual files are not available.",
          )}
        </p>
        {canReview && (
          <label className="field">
            {T("ملاحظات المراجعة", "Review comments")}
            <textarea
              maxLength={2000}
              rows={3}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setError("");
              }}
              placeholder={T(
                "الملاحظات إلزامية عند الإعادة للاستكمال…",
                "A comment is required when returning a measurement…",
              )}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
      <div className="dialog-footer">
        <button className="button secondary" onClick={onClose}>
          {T("إغلاق", "Close")}
        </button>
        {canReview && (
          <div className="button-group">
            <button
              className="button danger-outline"
              onClick={() => {
                if (!comment.trim()) {
                  setError(
                    T(
                      "اكتب سبب إعادة القياس للاستكمال.",
                      "Enter a reason for returning the measurement.",
                    ),
                  );
                  return;
                }
                onDecide("return", comment);
              }}
            >
              <RotateCcw size={16} />
              {T("إعادة للاستكمال", "Return")}
            </button>
            <button
              className="button primary"
              onClick={() => onDecide("approve", comment)}
            >
              <CheckCheck size={17} />
              {T("اعتماد القياس", "Approve measurement")}
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
