"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  ClipboardList,
  FileText,
  Settings2,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  ArrowUpRight,
  Pencil,
  Trash2,
  LockKeyhole,
  Layers,
  Building2,
  Target,
  ChevronDown,
} from "lucide-react";
import { Dialog } from "./ui";
import {
  roleNames,
  kindNames,
  allowedParents,
  canWrite,
  type Account,
  type Graph,
  type StructureNode,
  type Domain,
  type NodeKind,
  type Grant,
} from "@/lib/foundation";

type Locale = "ar" | "en";
const messages: Record<string, [string, string]> = {
  LAST_ADMIN: [
    "لا يمكن حذف آخر مدير نشط.",
    "The last active administrator cannot be deleted.",
  ],
  UNAUTHENTICATED: [
    "انتهت الجلسة. سجل الدخول مجددًا.",
    "Your session ended. Please sign in again.",
  ],
  INVALID_CREDENTIALS: [
    "البريد أو كلمة المرور غير صحيحة.",
    "The email or password is incorrect.",
  ],
  INVALID_CREDENTIAL_FIELDS: [
    "أدخل بريدًا صحيحًا وكلمة مرور غير فارغة (حتى 72 بايت).",
    "Enter a valid email and a non-empty password (up to 72 bytes).",
  ],
  INVALID_PASSWORD: [
    "تحقق من كلمة المرور الحالية. أدخل كلمة مرور جديدة غير فارغة (حتى 72 بايت).",
    "Check your current password. Enter a non-empty new password (up to 72 bytes).",
  ],
  ACCOUNT_UNAVAILABLE: [
    "تعذر إنشاء الحساب. إن كان لديك حساب فسجل الدخول.",
    "This account cannot be created. Sign in if you already have an account.",
  ],
  FORBIDDEN: [
    "لا تملك صلاحية هذا الإجراء أو النطاق.",
    "You do not have access to this action or scope.",
  ],
  CONFLICT: [
    "عُدلت البيانات من جلسة أخرى. حدّث الصفحة وراجع التغييرات قبل الحفظ.",
    "Another session changed this structure. Refresh and review the changes before saving.",
  ],
  HAS_DEPENDENCIES: [
    "احذف الروابط أو انقل العناصر التابعة وإسنادات المستخدمين أولًا.",
    "Remove links or move child records and user assignments first.",
  ],
  CYCLE: [
    "هذا الارتباط يسبب دورة في الهيكل. اختر عنصرًا آخر.",
    "This relationship creates a cycle. Choose another parent.",
  ],
  DUPLICATE_CODE: [
    "الرمز مستخدم داخل هذه الجهة.",
    "This code is already used in this organization.",
  ],
  DUPLICATE_LINK: ["هذا الارتباط موجود بالفعل.", "This link already exists."],
  INVALID_RELATION: [
    "الارتباط غير صالح أو خارج نطاق وصولك.",
    "This relationship is invalid or outside your access scope.",
  ],
  PARENT_REQUIRED: ["اختر العنصر الأب.", "Choose a parent record."],
  INVALID_NAME_CODE: [
    "أدخل الاسمين ورمزًا إنجليزيًا دون مسافات.",
    "Enter both names and a code using letters, numbers, dots or hyphens.",
  ],
  INVALID_DATE: [
    "تحقق من التواريخ وترتيب البداية والنهاية.",
    "Check the dates and their order.",
  ],
  RESTRICTED_PARENT: [
    "العنصر المرتبط مقيد؛ يجب تقييد هذا السجل أيضًا.",
    "The related record is restricted; this record must be restricted too.",
  ],
  RESTRICTED_CHILDREN: [
    "قيّد العناصر التابعة أولًا قبل تقييد هذا العنصر.",
    "Restrict dependent records before restricting this record.",
  ],
  RATE_LIMITED: [
    "محاولات كثيرة. حاول بعد 15 دقيقة.",
    "Too many attempts. Try again in 15 minutes.",
  ],
  SERVER_ERROR: [
    "تعذر إكمال العملية. تحقق من الاتصال وإعداد قاعدة البيانات ثم أعد المحاولة.",
    "The operation could not be completed. Check the connection and database setup, then retry.",
  ],
};
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/foundation/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "SERVER_ERROR");
  return result as T;
}
const errorText = (error: unknown, locale: Locale) =>
  messages[error instanceof Error ? error.message : "SERVER_ERROR"]?.[
    locale === "ar" ? 0 : 1
  ] || messages.SERVER_ERROR[locale === "ar" ? 0 : 1];
const domainName = (domain: Domain, locale: Locale) =>
  domain === "program"
    ? locale === "ar"
      ? "برنامج التطوير"
      : "Development program"
    : locale === "ar"
      ? "وزارة الحرس الوطني"
      : "Ministry of National Guard";
const label = (node: StructureNode, locale: Locale) =>
  locale === "ar" ? node.nameAr : node.nameEn;

export function FoundationWorkspace() {
  const path = usePathname();
  const section = path.split("/")[1] || "overview";
  const [locale, setLocale] = useState<Locale>("ar");
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<Domain>("program");
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<StructureNode | NodeKind | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [view, setView] = useState("map");
  const [selected, setSelected] = useState<StructureNode | null>(null);
  const [deleting, setDeleting] = useState<StructureNode | null>(null);
  const [busy, setBusy] = useState(false);
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  useEffect(() => {
    const value = localStorage.getItem("baseer:locale");
    if (value === "ar" || value === "en") setLocale(value);
    api<{ account: Account | null }>("session")
      .then((r) => {
        setAccount(r.account);
        if (r.account?.grants[0]) setDomain(r.account.grants[0].domain);
      })
      .catch((e) => setLoadError(errorText(e, "ar")))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("baseer:locale", locale);
    } catch {}
  }, [locale]);
  useEffect(() => {
    setGraph(null);
    setSelected(null);
    setQuery("");
    setKind("all");
    setLoadError("");
    if (
      !account?.grants.some((g) => g.domain === domain) ||
      account.mustChangePassword
    )
      return;
    let cancelled = false;
    api<Graph>(`graph?domain=${domain}`)
      .then((g) => {
        if (!cancelled) setGraph(g);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorText(e, locale));
      });
    return () => {
      cancelled = true;
    };
  }, [account, domain, locale]);
  const signedIn = (a: Account) => {
    setAccount(a);
    setDomain(a.grants[0]?.domain || "program");
    setLoadError("");
  };
  const logout = async () => {
    try {
      await api("logout", {});
      setAccount(null);
      setGraph(null);
    } catch (e) {
      setNotice(errorText(e, locale));
    }
  };
  if (loading)
    return (
      <div className="f-loading" role="status">
        {T("جارٍ فتح مساحة العمل…", "Opening workspace…")}
      </div>
    );
  if (!account)
    return (
      <AuthScreen
        locale={locale}
        setLocale={setLocale}
        onLogin={signedIn}
        initialError={loadError}
      />
    );
  const domains = [...new Set(account.grants.map((g) => g.domain))];
  const canManage = account.grants.some(
    (g) =>
      g.domain === domain &&
      ["admin", "strategy", "performance"].includes(g.role),
  );
  const nodes = graph?.nodes || [];
  const filtered = nodes.filter(
    (n) =>
      (kind === "all" || n.kind === kind) &&
      `${n.nameAr} ${n.nameEn} ${n.code} ${n.owner}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const nav = [
    {
      id: "overview",
      icon: LayoutDashboard,
      ar: "الصفحة الرئيسية",
      en: "Home",
    },
    {
      id: "strategy",
      icon: Network,
      ar: "الهيكل الاستراتيجي",
      en: "Strategy structure",
    },
    { id: "tasks", icon: ClipboardList, ar: "مركز المهام", en: "Task center" },
    { id: "reports", icon: FileText, ar: "التقارير", en: "Reports" },
  ];
  const update = async (body: Record<string, unknown>) => {
    if (!graph) return;
    const next = await api<Graph>("graph", {
      ...body,
      domain,
      revision: graph.revision,
    });
    setGraph(next);
    setSelected(null);
    setNotice(T("تم حفظ التغيير في سجل النظام.", "The change has been saved."));
  };
  const card = (node: StructureNode) => (
    <button className="f-node" onClick={() => setSelected(node)} key={node.id}>
      <span className="f-node-meta">
        <span>{kindNames[node.kind][locale]}</span>
        {node.restricted && (
          <LockKeyhole size={14} aria-label={T("مقيد", "Restricted")} />
        )}
      </span>
      <strong>{label(node, locale)}</strong>
      <span className="f-muted" dir="ltr">
        {node.code}
      </span>
      {node.parentId && nodes.some((n) => n.id === node.parentId) && (
        <span className="f-muted">
          {T("يتبع: ", "Parent: ")}
          {label(nodes.find((n) => n.id === node.parentId)!, locale)}
        </span>
      )}
      <span className="f-node-bottom">
        {node.owner || T("لم يحدد المسؤول", "Owner not assigned")}
        <ArrowUpRight size={16} />
      </span>
    </button>
  );
  const tree = (
    items: StructureNode[],
    parent: string | null,
    seen = new Set<string>(),
  ): ReactNode => (
    <ul className="f-tree">
      {items
        .filter(
          (n) =>
            n.parentId === parent ||
            (parent === null && !items.some((p) => p.id === n.parentId)),
        )
        .map((n) =>
          seen.has(n.id) ? null : (
            <li key={n.id}>
              {card(n)}
              {tree(items, n.id, new Set([...seen, n.id]))}
            </li>
          ),
        )}
    </ul>
  );
  return (
    <div className="f-app" dir={locale === "ar" ? "rtl" : "ltr"}>
      <aside className="f-sidebar">
        <Link href="/overview" className="f-brand">
          <Image
            src="/mngdp-logo.png"
            alt={T(
              "برنامج تطوير وزارة الحرس الوطني",
              "Ministry of National Guard Development Program",
            )}
            width={52}
            height={55}
          />
          <div>
            <strong>{T("بصير", "Baseer")}</strong>
            <small>
              {T("إدارة الاستراتيجية والأداء", "Strategy & performance")}
            </small>
          </div>
        </Link>
        <div className="f-nav-label">{T("مساحة العمل", "WORKSPACE")}</div>
        <nav aria-label={T("التنقل الرئيسي", "Main navigation")}>
          {nav.map((n) => (
            <Link
              key={n.id}
              href={`/${n.id}`}
              className={section === n.id ? "active" : ""}
              aria-current={section === n.id ? "page" : undefined}
            >
              <n.icon size={19} />
              {n[locale]}
            </Link>
          ))}
        </nav>
        <div className="f-sidebar-bottom">
          <Link
            href="/settings"
            className={section === "settings" ? "active" : ""}
          >
            <Settings2 size={18} />
            {T("الحساب وإدارة الوصول", "Account & access")}
          </Link>
          <div className="f-status">
            <span />
            {T("أساس النظام · M2", "Platform foundation · M2")}
          </div>
        </div>
      </aside>
      <div className="f-main">
        <header className="f-topbar">
          <span className="f-breadcrumb">
            {T("بصير", "Baseer")}
            <span>/</span>
            {nav.find((n) => n.id === section)?.[locale] ||
              T("الإعدادات", "Settings")}
          </span>
          <div className="f-top-actions">
            <button
              className="f-quiet"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            >
              {locale === "ar" ? "English" : "العربية"}
            </button>
            <span className="f-account">
              <span className="f-avatar">{account.name.slice(0, 1)}</span>
              {account.name}
            </span>
            <button
              className="f-quiet"
              onClick={logout}
              aria-label={T("تسجيل الخروج", "Sign out")}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="f-content">
          <div className="f-context">
            <span>
              <ShieldCheck size={15} />
              {T(
                "وصول حسب الصلاحيات المسندة",
                "Access follows your assigned permissions",
              )}
            </span>
            {domains.length > 0 && (
              <label>
                {T("الجهة", "Organization")}
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value as Domain)}
                >
                  {domains.map((d) => (
                    <option key={d} value={d}>
                      {domainName(d, locale)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {notice && (
            <div className="f-notice" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label={T("إغلاق التنبيه", "Dismiss notification")}
              >
                ×
              </button>
            </div>
          )}
          {account.mustChangePassword ? (
            <PasswordForm
              locale={locale}
              forced
              onDone={() => {
                setAccount(null);
                setGraph(null);
              }}
            />
          ) : section === "settings" ? (
            <Settings account={account} graph={graph} locale={locale} />
          ) : !domains.length ? (
            <div className="f-empty">
              <ShieldCheck size={36} />
              <h1>{T("حسابك جاهز", "Your account is ready")}</h1>
              <p>
                {T(
                  "يحتاج مدير النظام إلى إسناد دور ونطاق جهة قبل إتاحة البيانات.",
                  "An administrator must assign your role and organization before you can access data.",
                )}
              </p>
              <p dir="ltr">{account.email}</p>
              <button className="f-button" onClick={() => location.reload()}>
                {T("التحقق من صلاحيات الوصول", "Check access")}
              </button>
            </div>
          ) : loadError ? (
            <div className="f-empty" role="alert">
              <p>{loadError}</p>
              <button className="f-button" onClick={() => location.reload()}>
                {T("إعادة المحاولة", "Retry")}
              </button>
            </div>
          ) : !graph ? (
            <div className="f-loading" role="status">
              {T("جارٍ تحميل البيانات…", "Loading data…")}
            </div>
          ) : (
            <>
              {section === "overview" && (
                <>
                  <div className="f-heading">
                    <div>
                      <p className="f-eyebrow">{T("نظرة عامة", "OVERVIEW")}</p>
                      <h1>
                        {T(
                          "من الاستراتيجية إلى الأثر",
                          "From strategy to impact",
                        )}
                      </h1>
                      <p>
                        {T(
                          "نظرة على الهيكل والعلاقات المتاحة ضمن نطاقك.",
                          "An overview of the structure and relationships within your scope.",
                        )}
                      </p>
                    </div>
                    <Link className="f-button" href="/strategy">
                      {T("استعراض الهيكل", "Explore structure")}
                      <ArrowUpRight size={17} />
                    </Link>
                  </div>
                  <div className="f-stats">
                    {(
                      [
                        "strategy",
                        "objective",
                        "indicator",
                        "initiative",
                      ] as NodeKind[]
                    ).map((k) => (
                      <div key={k}>
                        <span>{kindNames[k][locale]}</span>
                        <strong>
                          {nodes.filter((n) => n.kind === k).length}
                        </strong>
                        <small>
                          {T("ضمن نطاق الوصول", "Within your access scope")}
                        </small>
                      </div>
                    ))}
                  </div>
                  <div className="f-overview-grid">
                    <section className="f-panel">
                      <div className="f-panel-title">
                        <h2>
                          {T("الاستراتيجيات والخطط", "Strategies & plans")}
                        </h2>
                        <Layers size={20} />
                      </div>
                      {nodes.some((n) =>
                        ["strategy", "plan"].includes(n.kind),
                      ) ? (
                        <div className="f-cards">
                          {nodes
                            .filter((n) =>
                              ["strategy", "plan"].includes(n.kind),
                            )
                            .map(card)}
                        </div>
                      ) : (
                        <Blank
                          locale={locale}
                          title={T(
                            "ابدأ ببناء الهيكل",
                            "Start with your structure",
                          )}
                          detail={T(
                            "أضف الوحدات التنظيمية والاستراتيجية، ثم اربط الأهداف والمبادرات.",
                            "Add organizational units and a strategy, then connect objectives and initiatives.",
                          )}
                        />
                      )}
                    </section>
                    <section className="f-panel f-access-summary">
                      <h2>
                        {T("صلاحياتك في هذه الجهة", "Your organization access")}
                      </h2>
                      {account.grants
                        .filter((g) => g.domain === domain)
                        .map((g) => (
                          <div key={g.id}>
                            <ShieldCheck size={18} />
                            <span>
                              <strong>{roleNames[g.role][locale]}</strong>
                              <small>
                                {g.unitId
                                  ? label(
                                      nodes.find((n) => n.id === g.unitId) ||
                                        ({
                                          nameAr: "وحدة محددة",
                                          nameEn: "Assigned unit",
                                        } as StructureNode),
                                      locale,
                                    )
                                  : T("نطاق الجهة", "Organization scope")}
                                {g.restricted
                                  ? T(
                                      " · يشمل السجلات المقيدة",
                                      " · Includes restricted records",
                                    )
                                  : ""}
                              </small>
                            </span>
                          </div>
                        ))}
                      <p className="f-muted">
                        {T(
                          "نتائج القياس والتقارير المعتمدة تضاف في مراحل التنفيذ التالية.",
                          "Measurement results and approved reports will be added in subsequent milestones.",
                        )}
                      </p>
                    </section>
                  </div>
                </>
              )}
              {section === "strategy" && (
                <>
                  <div className="f-heading">
                    <div>
                      <p className="f-eyebrow">
                        {T(
                          "الهيكل الاستراتيجي والتشغيلي",
                          "STRATEGIC & OPERATIONAL STRUCTURE",
                        )}
                      </p>
                      <h1>
                        {T(
                          "هيكل مترابط. اتجاه واضح.",
                          "Connected structure. Clear direction.",
                        )}
                      </h1>
                      <p>
                        {T(
                          "نظّم الاستراتيجيات والأهداف والوحدات واربطها بمبادرات التنفيذ.",
                          "Organize strategies, objectives and units, and connect delivery initiatives.",
                        )}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        className="f-button"
                        onClick={() => setEditor("strategy")}
                      >
                        <Plus size={17} />
                        {T("إضافة عنصر", "Add record")}
                      </button>
                    )}
                  </div>
                  <div className="f-toolbar">
                    <div className="f-search">
                      <Search size={18} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={T(
                          "ابحث بالاسم أو الرمز أو المسؤول",
                          "Search name, code or owner",
                        )}
                        aria-label={T("البحث في الهيكل", "Search structure")}
                      />
                    </div>
                    <select
                      aria-label={T("تصفية النوع", "Filter type")}
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option value="all">
                        {T("جميع الأنواع", "All types")}
                      </option>
                      {Object.entries(kindNames).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v[locale]}
                        </option>
                      ))}
                    </select>
                    <span className="f-muted">
                      {filtered.length} {T("عنصر", "records")}
                    </span>
                  </div>
                  <div
                    className="f-tabs"
                    role="group"
                    aria-label={T("طريقة عرض الهيكل", "Structure view")}
                  >
                    {[
                      ["map", "الخريطة الاستراتيجية", "Strategy map"],
                      ["organization", "الهيكل التنظيمي", "Organization"],
                      ["tree", "العرض الشجري", "Tree"],
                      ["dashboard", "لوحة الهيكل", "Structure dashboard"],
                    ].map(([id, ar, en]) => (
                      <button
                        key={id}
                        aria-pressed={view === id}
                        className={view === id ? "active" : ""}
                        onClick={() => setView(id)}
                      >
                        {T(ar, en)}
                      </button>
                    ))}
                  </div>
                  <section className="f-panel">
                    {!filtered.length ? (
                      <Blank
                        locale={locale}
                        title={
                          nodes.length
                            ? T("لا توجد نتائج مطابقة", "No matching records")
                            : T(
                                "الهيكل جاهز للبناء",
                                "Your structure is ready to build",
                              )
                        }
                        detail={
                          nodes.length
                            ? T(
                                "غيّر كلمات البحث أو نوع العنصر.",
                                "Try another search or record type.",
                              )
                            : T(
                                "أضف الاستراتيجية الأولى أو وحدة تنظيمية.",
                                "Add your first strategy or organizational unit.",
                              )
                        }
                      />
                    ) : view === "tree" ? (
                      tree(filtered, null)
                    ) : view === "organization" ? (
                      <>
                        {filtered.filter((n) => n.kind === "unit").length ? (
                          filtered
                            .filter((n) => n.kind === "unit")
                            .map((unit) => (
                              <div className="f-org" key={unit.id}>
                                {card(unit)}
                                <div className="f-cards">
                                  {filtered
                                    .filter((n) => n.unitId === unit.id)
                                    .map(card)}
                                </div>
                              </div>
                            ))
                        ) : (
                          <Blank
                            locale={locale}
                            title={T(
                              "لا توجد وحدات تنظيمية مطابقة",
                              "No matching organizational units",
                            )}
                            detail={T(
                              "أضف وحدة أو غيّر الفلاتر.",
                              "Add a unit or adjust the filters.",
                            )}
                          />
                        )}
                        <div className="f-cards">
                          {filtered
                            .filter((n) => n.kind !== "unit" && !n.unitId)
                            .map(card)}
                        </div>
                      </>
                    ) : view === "dashboard" ? (
                      <>
                        <div className="f-stats">
                          {Object.entries(kindNames).map(([k, v]) => (
                            <div key={k}>
                              <span>{v[locale]}</span>
                              <strong>
                                {filtered.filter((n) => n.kind === k).length}
                              </strong>
                            </div>
                          ))}
                        </div>
                        <p className="f-muted">
                          {T(
                            "تعكس الأعداد الهيكل المحفوظ والفلاتر الحالية؛ احتساب الأداء ضمن M3–M6.",
                            "Counts reflect saved structure and current filters; performance calculations follow in M3–M6.",
                          )}
                        </p>
                      </>
                    ) : (
                      <div className="f-map">
                        {(
                          [
                            "strategy",
                            "plan",
                            "objective",
                            "indicator",
                            "initiative",
                            "unit",
                          ] as NodeKind[]
                        )
                          .filter((k) => filtered.some((n) => n.kind === k))
                          .map((k) => (
                            <section key={k}>
                              <h2>{kindNames[k][locale]}</h2>
                              <div className="f-cards">
                                {filtered.filter((n) => n.kind === k).map(card)}
                              </div>
                            </section>
                          ))}
                      </div>
                    )}
                  </section>
                </>
              )}
              {section === "tasks" && (
                <>
                  <div className="f-heading">
                    <div>
                      <p className="f-eyebrow">
                        {T("مركز المهام", "TASK CENTER")}
                      </p>
                      <h1>
                        {T(
                          "تهيئة المؤشرات للربط",
                          "Prepare indicator references",
                        )}
                      </h1>
                      <p>
                        {T(
                          "سجل تعريف الارتباط بالهدف الآن. بطاقة المؤشر والحسابات تستكمل في M3.",
                          "Create an objective-linked reference now. Full indicator cards and calculations follow in M3.",
                        )}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        className="f-button"
                        onClick={() => setEditor("indicator")}
                      >
                        <Plus size={17} />
                        {T("إضافة ارتباط مؤشر", "Add indicator reference")}
                      </button>
                    )}
                  </div>
                  <section className="f-panel">
                    <div className="f-cards">
                      {nodes.filter((n) => n.kind === "indicator").map(card)}
                    </div>
                    {!nodes.some((n) => n.kind === "indicator") && (
                      <Blank
                        locale={locale}
                        title={T(
                          "لا توجد ارتباطات مؤشرات",
                          "No indicator references yet",
                        )}
                        detail={T(
                          "أنشئ استراتيجية وهدفًا أولًا، ثم أضف ارتباط المؤشر. مسارات القياس والموافقات تستكمل في M4.",
                          "Create a strategy and objective first, then add an indicator reference. Measurement and approval workflows follow in M4.",
                        )}
                      />
                    )}
                  </section>
                </>
              )}
              {section === "reports" && (
                <>
                  <div className="f-heading">
                    <div>
                      <p className="f-eyebrow">{T("التقارير", "REPORTS")}</p>
                      <h1>
                        {T(
                          "تقارير تستند إلى بيانات معتمدة",
                          "Reports built on approved data",
                        )}
                      </h1>
                    </div>
                  </div>
                  <section className="f-panel">
                    <Blank
                      locale={locale}
                      title={T(
                        "إصدار التقارير ضمن المرحلة السادسة",
                        "Report publishing is planned for M6",
                      )}
                      detail={T(
                        "يؤسس العمل الحالي الهيكل والصلاحيات. ستتوفر القوالب والإقرار والتصدير بعد تشغيل دورات القياس.",
                        "The current milestone establishes structure and access. Templates, approval and exports follow the implementation of measurement cycles.",
                      )}
                    />
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer className="f-footer">
          <span>
            {T(
              "بصير · برنامج تطوير وزارة الحرس الوطني",
              "Baseer · Ministry of National Guard Development Program",
            )}
          </span>
          <span>
            {T(
              "المرحلة الثانية · البيانات والهيكل والصلاحيات",
              "Milestone 2 · Data, structure & access",
            )}
          </span>
        </footer>
      </div>
      {editor && graph && (
        <NodeEditor
          locale={locale}
          graph={graph}
          initial={editor}
          account={account}
          onClose={() => setEditor(null)}
          onSave={async (node) => {
            await update({ action: "save", node });
            setEditor(null);
          }}
        />
      )}
      {selected && graph && (
        <NodeDetail
          locale={locale}
          node={selected}
          graph={graph}
          account={account}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditor(selected);
            setSelected(null);
          }}
          onDelete={() => {
            setDeleting(selected);
            setSelected(null);
          }}
          onAction={update}
        />
      )}
      {deleting && (
        <Dialog
          padded
          locale={locale}
          title={T("حذف العنصر", "Delete record")}
          onClose={() => !busy && setDeleting(null)}
        >
          <p>
            {T(
              "سيحذف هذا العنصر مع حفظ أثر العملية في سجل التدقيق. يمنع الحذف عند وجود عناصر أو صلاحيات مرتبطة.",
              "This removes the record and keeps an audit entry. Records with dependencies or access assignments cannot be deleted.",
            )}
          </p>
          <strong>{label(deleting, locale)}</strong>
          <div className="f-dialog-actions">
            <button
              className="f-button f-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await update({ action: "delete", id: deleting.id });
                  setDeleting(null);
                } catch (e) {
                  setNotice(errorText(e, locale));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {T("تأكيد الحذف", "Confirm deletion")}
            </button>
            <button
              className="f-secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              {T("إلغاء", "Cancel")}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Blank({
  locale,
  title,
  detail,
}: {
  locale: Locale;
  title: string;
  detail: string;
}) {
  return (
    <div className="f-empty">
      <Network size={32} />
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
function AuthScreen({
  locale,
  setLocale,
  onLogin,
  initialError,
}: {
  locale: Locale;
  setLocale: (l: Locale) => void;
  onLogin: (a: Account) => void;
  initialError: string;
}) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError);
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      const r = await api<{ account: Account }>(
        signup ? "signup" : "login",
        data,
      );
      onLogin(r.account);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="f-auth" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className="f-auth-brand">
        <Image
          src="/mngdp-logo.png"
          alt={T(
            "برنامج تطوير وزارة الحرس الوطني",
            "Ministry of National Guard Development Program",
          )}
          width={100}
          height={106}
        />
        <div>
          <p className="f-eyebrow">{T("بصير", "BASEER")}</p>
          <h1>
            {T(
              "رؤية أوضح.\nأداء يرتقي.",
              "Clearer vision.\nStronger performance.",
            )}
          </h1>
          <p>
            {T(
              "مساحة موحدة لإدارة الاستراتيجية ومتابعة الأهداف والأداء المؤسسي.",
              "One workspace for strategy, objectives and institutional performance.",
            )}
          </p>
        </div>
        <small>
          {T(
            "برنامج تطوير وزارة الحرس الوطني",
            "Ministry of National Guard Development Program",
          )}
        </small>
      </section>
      <section className="f-auth-form">
        <button
          className="f-quiet f-language"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          {locale === "ar" ? "English" : "العربية"}
        </button>
        <form onSubmit={submit}>
          <p className="f-eyebrow">
            {T("أهلًا بك في بصير", "WELCOME TO BASEER")}
          </p>
          <h2>
            {signup
              ? T("إنشاء حساب", "Create an account")
              : T("تسجيل الدخول", "Sign in")}
          </h2>
          <p className="f-muted">
            {signup
              ? T(
                  "أنشئ حسابك، ثم يسند مدير النظام صلاحيات الوصول.",
                  "Create your account. An administrator will assign your access.",
                )
              : T(
                  "أدخل بيانات حسابك للوصول إلى مساحة العمل.",
                  "Enter your account details to access your workspace.",
                )}
          </p>
          {signup && (
            <label>
              {T("الاسم الكامل", "Full name")}
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          )}
          <label>
            {T("البريد الإلكتروني", "Email address")}
            <input
              name="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              placeholder="name@example.com"
              required
              maxLength={254}
            />
          </label>
          <label>
            {T("كلمة المرور", "Password")}
            <input
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={1}
              maxLength={72}
              dir="ltr"
            />
            <small>
              {T(
                signup
                  ? "تُقبل كلمة مرور من رمز واحد أو أكثر. لا يُرسل رمز تحقق أو بريد إلكتروني."
                  : "استخدم كلمة مرور حسابك. لا يُرسل رمز تحقق.",
                signup
                  ? "One or more characters. No verification code or email is sent."
                  : "Use your account password. No verification code is sent.",
              )}
            </small>
          </label>
          {error && (
            <p className="f-error" role="alert">
              {error}
            </p>
          )}
          <button className="f-button" disabled={busy}>
            {busy
              ? T("جارٍ المتابعة…", "Please wait…")
              : signup
                ? T("إنشاء الحساب", "Create account")
                : T("دخول", "Sign in")}
          </button>
          <button
            className="f-quiet"
            type="button"
            disabled={busy}
            onClick={() => {
              setSignup(!signup);
              setError("");
            }}
          >
            {signup
              ? T("لديك حساب؟ سجل الدخول", "Already registered? Sign in")
              : T("حساب جديد؟ إنشاء حساب", "New here? Create an account")}
          </button>
          <p className="f-muted f-auth-help">
            {T(
              "نسيت كلمة المرور؟ تواصل مع مدير النظام لإعادة تعيينها.",
              "Forgot your password? Ask your administrator to reset it.",
            )}
          </p>
        </form>
      </section>
    </div>
  );
}

function NodeEditor({
  locale,
  graph,
  initial,
  account,
  onClose,
  onSave,
}: {
  locale: Locale;
  graph: Graph;
  initial: StructureNode | NodeKind;
  account: Account;
  onClose: () => void;
  onSave: (node: Record<string, unknown>) => Promise<void>;
}) {
  const editing = typeof initial !== "string";
  const [kind, setKind] = useState<NodeKind>(editing ? initial.kind : initial);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const n = editing ? initial : null;
  const scope = account.grants.find(
    (g) =>
      g.domain === graph.domain &&
      ["admin", "strategy", "performance"].includes(g.role),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      await onSave({
        ...data,
        kind,
        id: n?.id,
        restricted: data.restricted === "on",
      });
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setBusy(false);
    }
  }
  const input = (
    key: keyof StructureNode,
    ar: string,
    en: string,
    required = false,
    type = "text",
  ) => (
    <label>
      {T(ar, en)}
      <input
        name={key}
        defaultValue={String(n?.[key] || "")}
        required={required}
        type={type}
        maxLength={key === "code" ? 40 : 160}
        dir={key.endsWith("En") || key === "code" ? "ltr" : undefined}
      />
    </label>
  );
  const textarea = (key: keyof StructureNode, ar: string, en: string) => (
    <label>
      {T(ar, en)}
      <textarea
        name={key}
        defaultValue={String(n?.[key] || "")}
        maxLength={2000}
        rows={3}
        dir={key.endsWith("En") ? "ltr" : undefined}
      />
    </label>
  );
  return (
    <Dialog
      padded
      wide
      locale={locale}
      title={
        editing
          ? T("تعديل العنصر", "Edit record")
          : T("إضافة عنصر إلى الهيكل", "Add a structure record")
      }
      onClose={() => !busy && onClose()}
    >
      <form className="f-form" onSubmit={submit}>
        <div className="f-form-grid">
          <label>
            {T("نوع العنصر", "Record type")}
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as NodeKind)}
              disabled={editing || initial === "indicator"}
            >
              {Object.entries(kindNames)
                .filter(
                  ([k]) =>
                    k !== "indicator" ||
                    initial === "indicator" ||
                    n?.kind === "indicator",
                )
                .map(([k, v]) => (
                  <option value={k} key={k}>
                    {v[locale]}
                  </option>
                ))}
            </select>
          </label>
          {input("code", "الرمز *", "Code *", true)}
          {input("nameAr", "الاسم بالعربية *", "Arabic name *", true)}
          {input("nameEn", "الاسم بالإنجليزية *", "English name *", true)}
          <label>
            {T("العنصر الأب", "Parent record")}
            <select
              key={kind}
              name="parentId"
              defaultValue={n?.parentId || ""}
              required={!["unit", "strategy"].includes(kind)}
            >
              <option value="">{T("دون عنصر أب", "No parent")}</option>
              {graph.nodes
                .filter(
                  (p) =>
                    p.id !== n?.id && allowedParents[kind].includes(p.kind),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {label(p, locale)} · {p.code}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {T("المستوى", "Level")}
            <select
              name="level"
              defaultValue={
                n?.level ||
                (scope?.role === "performance" ? "operational" : "strategic")
              }
            >
              <option value="strategic">{T("استراتيجي", "Strategic")}</option>
              <option value="operational">{T("تشغيلي", "Operational")}</option>
            </select>
          </label>
          {kind !== "unit" && (
            <label>
              {T("الوحدة التنظيمية", "Organizational unit")}
              <select
                name="unitId"
                defaultValue={n?.unitId || scope?.unitId || ""}
              >
                <option value="">
                  {T("على مستوى الجهة", "Organization level")}
                </option>
                {graph.nodes
                  .filter((p) => p.kind === "unit")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {label(p, locale)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {input("owner", "المسؤول", "Responsible person")}
          {input("startDate", "تاريخ البداية", "Start date", false, "date")}
          {input("endDate", "تاريخ النهاية", "End date", false, "date")}
          {textarea("descriptionAr", "الوصف بالعربية", "Arabic description")}
          {textarea(
            "descriptionEn",
            "الوصف بالإنجليزية",
            "English description",
          )}
          {kind === "strategy" && (
            <>
              {textarea("visionAr", "الرؤية بالعربية", "Arabic vision")}
              {textarea("visionEn", "الرؤية بالإنجليزية", "English vision")}
              {textarea("missionAr", "الرسالة بالعربية", "Arabic mission")}
              {textarea("missionEn", "الرسالة بالإنجليزية", "English mission")}
              {textarea("valuesAr", "القيم بالعربية", "Arabic values")}
              {textarea("valuesEn", "القيم بالإنجليزية", "English values")}
            </>
          )}
        </div>
        <label className="f-check">
          <input
            type="checkbox"
            name="restricted"
            defaultChecked={n?.restricted || false}
          />
          {T(
            "سجل مقيد — يتطلب تصريحًا صريحًا للاطلاع",
            "Restricted record — requires explicit access",
          )}
        </label>
        {kind === "indicator" && (
          <p className="f-muted">
            {T(
              "هذا ارتباط هيكلي؛ إعداد المعادلات والقياسات ضمن M3 وM4.",
              "This is a structure reference; formulas and measurements follow in M3 and M4.",
            )}
          </p>
        )}
        {error && (
          <p className="f-error" role="alert">
            {error}
          </p>
        )}
        <div className="f-dialog-actions">
          <button className="f-button" disabled={busy}>
            {busy
              ? T("جارٍ الحفظ…", "Saving…")
              : T("حفظ العنصر", "Save record")}
          </button>
          <button
            className="f-secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {T("إلغاء", "Cancel")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function NodeDetail({
  locale,
  node,
  graph,
  account,
  onClose,
  onEdit,
  onDelete,
  onAction,
}: {
  locale: Locale;
  node: StructureNode;
  graph: Graph;
  account: Account;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAction: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const editable = canWrite(account, node, graph.nodes);
  const act = async (b: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await onAction(b);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      padded
      locale={locale}
      wide
      title={label(node, locale)}
      onClose={onClose}
    >
      <div className="f-detail">
        <span className="f-eyebrow">
          {kindNames[node.kind][locale]} · {node.code}
        </span>
        <p>{locale === "ar" ? node.descriptionAr : node.descriptionEn}</p>
        <dl>
          {[
            [
              T("العنصر الأب", "Parent"),
              graph.nodes.find((n) => n.id === node.parentId),
            ],
            [
              T("الوحدة", "Unit"),
              graph.nodes.find((n) => n.id === node.unitId),
            ],
          ].map(([name, n]) => (
            <div key={String(name)}>
              <dt>{String(name)}</dt>
              <dd>{n && typeof n !== "string" ? label(n, locale) : "—"}</dd>
            </div>
          ))}
          <div>
            <dt>{T("المسؤول", "Responsible person")}</dt>
            <dd>{node.owner || "—"}</dd>
          </div>
          <div>
            <dt>{T("الفترة", "Period")}</dt>
            <dd dir="ltr">
              {node.startDate || "—"} / {node.endDate || "—"}
            </dd>
          </div>
          <div>
            <dt>{T("الوصول", "Access")}</dt>
            <dd>
              {node.restricted
                ? T("مقيد", "Restricted")
                : T("حسب النطاق", "Within assigned scope")}
            </dd>
          </div>
        </dl>
        {node.kind === "strategy" &&
          [
            ["visionAr", "visionEn", "الرؤية", "Vision"],
            ["missionAr", "missionEn", "الرسالة", "Mission"],
            ["valuesAr", "valuesEn", "القيم", "Values"],
          ].map(([ar, en, titleAr, titleEn]) => (
            <section key={ar}>
              <h3>{T(titleAr, titleEn)}</h3>
              <p>
                {String(
                  node[(locale === "ar" ? ar : en) as keyof StructureNode] ||
                    "—",
                )}
              </p>
            </section>
          ))}
        <h3>{T("العناصر التابعة", "Child records")}</h3>
        <ul>
          {graph.nodes
            .filter((n) => n.parentId === node.id)
            .map((n) => (
              <li key={n.id}>
                {label(n, locale)} · {kindNames[n.kind][locale]}
              </li>
            ))}
        </ul>
        <h3>
          {T(
            "روابط الأهداف والمؤشرات والمبادرات",
            "Objective, indicator & initiative links",
          )}
        </h3>
        {graph.links
          .filter((l) => l.sourceId === node.id || l.targetId === node.id)
          .map((l) => (
            <div className="f-link-row" key={l.id}>
              <span>
                {label(
                  graph.nodes.find(
                    (n) =>
                      n.id ===
                      (l.sourceId === node.id ? l.targetId : l.sourceId),
                  )!,
                  locale,
                )}
              </span>
              {editable && (
                <button
                  className="f-quiet"
                  disabled={busy}
                  onClick={() => act({ action: "unlink", id: l.id })}
                >
                  {T("إزالة الرابط", "Remove link")}
                </button>
              )}
            </div>
          ))}
        {editable && node.kind === "objective" && (
          <form
            className="f-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void act({
                action: "link",
                sourceId: node.id,
                targetId: data.get("targetId"),
              });
            }}
          >
            <select
              name="targetId"
              required
              aria-label={T("المؤشر أو المبادرة", "Indicator or initiative")}
            >
              <option value="">
                {T(
                  "اختر مؤشرًا أو مبادرة",
                  "Choose an indicator or initiative",
                )}
              </option>
              {graph.nodes
                .filter(
                  (n) =>
                    ["indicator", "initiative"].includes(n.kind) &&
                    canWrite(account, n, graph.nodes),
                )
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {label(n, locale)}
                  </option>
                ))}
            </select>
            <button className="f-secondary" disabled={busy}>
              {T("ربط", "Link")}
            </button>
          </form>
        )}
        {error && (
          <p className="f-error" role="alert">
            {error}
          </p>
        )}
        {editable && (
          <div className="f-dialog-actions">
            <button className="f-button" onClick={onEdit}>
              <Pencil size={15} />
              {T("تعديل", "Edit")}
            </button>
            <button className="f-secondary" onClick={onDelete}>
              <Trash2 size={15} />
              {T("حذف", "Delete")}
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function PasswordForm({
  locale,
  onDone,
  forced = false,
}: {
  locale: Locale;
  onDone: () => void;
  forced?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  return (
    <section className="f-panel">
      <h2>
        {forced
          ? T("غيّر كلمة المرور المؤقتة", "Change your temporary password")
          : T("تغيير كلمة المرور", "Change password")}
      </h2>
      <form
        className="f-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError("");
          try {
            await api("password", data);
            onDone();
          } catch (e) {
            setError(errorText(e, locale));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="f-form-grid">
          <label>
            {T("كلمة المرور الحالية", "Current password")}
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              minLength={1}
            />
          </label>
          <label>
            {T("كلمة المرور الجديدة", "New password")}
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={1}
            />
          </label>
        </div>
        <p className="f-muted">
          {T(
            "يُطلب تسجيل الدخول مجددًا بعد التغيير.",
            "You will sign in again after changing your password.",
          )}
        </p>
        {error && (
          <p className="f-error" role="alert">
            {error}
          </p>
        )}
        <button className="f-button" disabled={busy}>
          {T("حفظ كلمة المرور", "Save password")}
        </button>
      </form>
    </section>
  );
}

function Settings({
  account,
  graph,
  locale,
}: {
  account: Account;
  graph: Graph | null;
  locale: Locale;
}) {
  const [users, setUsers] = useState<Account[]>([]),
    [selected, setSelected] = useState<Account | null>(null),
    [deletingUser, setDeletingUser] = useState<Account | null>(null),
    [error, setError] = useState("");
  const [events, setEvents] = useState<Record<string, unknown>[] | null>(null);
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const refresh = () =>
    api<{ users: Account[] }>("users").then((r) => setUsers(r.users));
  useEffect(() => {
    if (account.admin) refresh().catch((e) => setError(errorText(e, locale)));
  }, [account.admin, locale]);
  const auditAllowed =
    graph &&
    account.grants.some(
      (g) =>
        g.domain === graph.domain &&
        g.role === "admin" &&
        !g.unitId &&
        g.restricted,
    );
  return (
    <div className="f-settings">
      <div className="f-heading">
        <div>
          <p className="f-eyebrow">{T("إدارة الحساب", "ACCOUNT MANAGEMENT")}</p>
          <h1>{T("الحساب وصلاحيات الوصول", "Account & access")}</h1>
          <p>
            {account.name} · {account.email}
          </p>
        </div>
      </div>
      {account.admin && (
        <section className="f-panel">
          <div className="f-panel-title">
            <h2>{T("المستخدمون والأدوار", "Users & roles")}</h2>
            <button
              className="f-quiet"
              onClick={() =>
                refresh().catch((e) => setError(errorText(e, locale)))
              }
            >
              {T("تحديث القائمة", "Refresh list")}
            </button>
          </div>
          <p className="f-muted">
            {T(
              "الحسابات الجديدة دون صلاحيات. يسند المدير الأدوار والجهات والوحدات لكل مستخدم. تغيير الوصول يبطل جلسات المستخدم الحالية.",
              "New accounts have no access. Assign roles, organizations and units to each user. Access changes revoke their current sessions.",
            )}
          </p>
          <div className="f-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{T("المستخدم", "User")}</th>
                  <th>{T("الوصول", "Access")}</th>
                  <th>{T("الحالة", "Status")}</th>
                  <th>{T("الإجراء", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <small dir="ltr">{u.email}</small>
                    </td>
                    <td>
                      {u.grants.length
                        ? u.grants.map((g) => (
                            <span className="f-chip" key={g.id}>
                              {roleNames[g.role][locale]} ·{" "}
                              {domainName(g.domain, locale)}
                            </span>
                          ))
                        : T("بانتظار الإسناد", "Awaiting assignment")}
                      {u.admin && (
                        <span className="f-chip">
                          {T("إدارة الحسابات", "Account administrator")}
                        </span>
                      )}
                    </td>
                    <td>
                      {u.active ? T("نشط", "Active") : T("معطل", "Disabled")}
                    </td>
                    <td>
                      <div className="f-account-actions">
                        <button
                          className="f-secondary"
                          disabled={u.id === account.id}
                          onClick={() => setSelected(u)}
                        >
                          {u.id === account.id
                            ? T("حسابك", "Your account")
                            : T("إدارة الوصول", "Manage access")}
                        </button>
                        {u.id !== account.id && (
                          <button
                            className="f-secondary f-delete-account"
                            onClick={() => setDeletingUser(u)}
                          >
                            <Trash2 size={15} />
                            {T("حذف الحساب", "Delete account")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {(account.admin || auditAllowed) && (
        <section className="f-panel">
          <div className="f-panel-title">
            <h2>{T("سجل التدقيق", "Audit history")}</h2>
            <div className="f-inline-form">
              {account.admin && (
                <button
                  className="f-secondary"
                  onClick={() =>
                    api<{ events: Record<string, unknown>[] }>("audit")
                      .then((r) => setEvents(r.events))
                      .catch((e) => setError(errorText(e, locale)))
                  }
                >
                  {T("الحسابات", "Accounts")}
                </button>
              )}
              {auditAllowed && (
                <button
                  className="f-secondary"
                  onClick={() =>
                    api<{ events: Record<string, unknown>[] }>(
                      `audit?domain=${graph.domain}`,
                    )
                      .then((r) => setEvents(r.events))
                      .catch((e) => setError(errorText(e, locale)))
                  }
                >
                  {T("الهيكل الحالي", "Current structure")}
                </button>
              )}
            </div>
          </div>
          <p className="f-muted">
            {T(
              "آخر 200 حدث. تتضمن سجلات التغيير القيم قبل العملية وبعدها.",
              "Latest 200 events. Change records include before and after values.",
            )}
          </p>
          {events?.map((e) => (
            <details className="f-audit" key={String(e.id)}>
              <summary>
                <span>{String(e.action)}</span>
                <span>{String(e.actor_name)}</span>
                <time>
                  {new Date(String(e.at)).toLocaleString(
                    locale === "ar" ? "ar-SA" : "en-GB",
                    { calendar: "gregory" },
                  )}
                </time>
              </summary>
              <div className="f-form-grid">
                <div>
                  <h3>{T("قبل", "Before")}</h3>
                  <pre dir="ltr">
                    {e.before_json
                      ? JSON.stringify(
                          JSON.parse(String(e.before_json)),
                          null,
                          2,
                        )
                      : "—"}
                  </pre>
                </div>
                <div>
                  <h3>{T("بعد", "After")}</h3>
                  <pre dir="ltr">
                    {e.after_json
                      ? JSON.stringify(
                          JSON.parse(String(e.after_json)),
                          null,
                          2,
                        )
                      : "—"}
                  </pre>
                </div>
              </div>
            </details>
          ))}
        </section>
      )}
      {error && (
        <p className="f-error" role="alert">
          {error}
        </p>
      )}
      {selected && (
        <AccessEditor
          locale={locale}
          user={selected}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            await refresh();
            setSelected(null);
          }}
        />
      )}
      {deletingUser && (
        <DeleteAccountDialog
          locale={locale}
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={async () => {
            setDeletingUser(null);
            setEvents(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function DeleteAccountDialog({
  locale,
  user,
  onClose,
  onDeleted,
}: {
  locale: Locale;
  user: Account;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  return (
    <Dialog
      padded
      locale={locale}
      title={T("حذف الحساب", "Delete account")}
      onClose={() => !busy && onClose()}
    >
      <div className="f-detail">
        <p>
          {T(
            "سيُحذف الحساب نهائيًا وتُلغى صلاحياته وجلساته. ستبقى بيانات العمل وسجلات إجراءاته السابقة محفوظة. لا يمكن التراجع عن الحذف.",
            "This permanently deletes the account and revokes its access and sessions. Work records and its previous audit history will be retained. This cannot be undone.",
          )}
        </p>
        <div className="f-delete-identity">
          <strong>{user.name}</strong>
          <bdi dir="ltr">{user.email}</bdi>
        </div>
        {error && (
          <p className="f-error" role="alert">
            {error}
          </p>
        )}
        <div className="f-dialog-actions">
          <button
            className="f-button f-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("users", { action: "delete", userId: user.id });
                await onDeleted();
              } catch (e) {
                setError(errorText(e, locale));
              } finally {
                setBusy(false);
              }
            }}
          >
            {T("تأكيد حذف الحساب", "Confirm account deletion")}
          </button>
          <button className="f-secondary" disabled={busy} onClick={onClose}>
            {T("إلغاء", "Cancel")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function AccessEditor({
  locale,
  user,
  onClose,
  onSaved,
}: {
  locale: Locale;
  user: Account;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [grants, setGrants] = useState<Grant[]>(user.grants),
    [admin, setAdmin] = useState(user.admin),
    [active, setActive] = useState(user.active),
    [units, setUnits] = useState<StructureNode[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const T = (ar: string, en: string) => (locale === "ar" ? ar : en);
  useEffect(() => {
    let live = true;
    Promise.allSettled(
      (["program", "ministry"] as Domain[]).map((d) =>
        api<Graph>(`graph?domain=${d}`),
      ),
    ).then((rs) => {
      if (live)
        setUnits(
          rs.flatMap((r) =>
            r.status === "fulfilled"
              ? r.value.nodes.filter((n) => n.kind === "unit")
              : [],
          ),
        );
    });
    return () => {
      live = false;
    };
  }, []);
  const patch = (id: string, value: Partial<Grant>) =>
    setGrants((gs) => gs.map((g) => (g.id === id ? { ...g, ...value } : g)));
  return (
    <Dialog
      padded
      wide
      locale={locale}
      title={`${T("إدارة الوصول", "Manage access")} · ${user.name}`}
      onClose={() => !busy && onClose()}
    >
      <form
        className="f-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("users", {
              action: "access",
              userId: user.id,
              grants,
              admin,
              active,
            });
            await onSaved();
          } catch (e) {
            setError(errorText(e, locale));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="f-account-email">
          <bdi dir="ltr">{user.email}</bdi>
        </p>
        <label className="f-check">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          {T("الحساب نشط", "Account active")}
        </label>
        <label className="f-check">
          <input
            type="checkbox"
            checked={admin}
            onChange={(e) => setAdmin(e.target.checked)}
          />
          {T(
            "إدارة الحسابات والصلاحيات (لا تمنح وصولًا تلقائيًا لبيانات الجهات)",
            "Manage accounts and access (does not automatically grant organization data access)",
          )}
        </label>
        {grants.map((g) => (
          <div className="f-grant" key={g.id}>
            <label>
              {T("الجهة", "Organization")}
              <select
                value={g.domain}
                onChange={(e) =>
                  patch(g.id, {
                    domain: e.target.value as Domain,
                    unitId: null,
                  })
                }
              >
                {(["program", "ministry"] as Domain[]).map((d) => (
                  <option key={d} value={d}>
                    {domainName(d, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {T("الدور", "Role")}
              <select
                value={g.role}
                onChange={(e) =>
                  patch(g.id, { role: e.target.value as Grant["role"] })
                }
              >
                {Object.entries(roleNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {T("نطاق الوحدة", "Unit scope")}
              <select
                value={g.unitId || ""}
                onChange={(e) =>
                  patch(g.id, { unitId: e.target.value || null })
                }
              >
                <option value="">
                  {T("كامل الجهة", "Whole organization")}
                </option>
                {g.unitId && !units.some((n) => n.id === g.unitId) && (
                  <option value={g.unitId}>
                    {T("الوحدة المسندة الحالية", "Currently assigned unit")}
                  </option>
                )}
                {units
                  .filter((n) => n.domain === g.domain)
                  .map((n) => (
                    <option value={n.id} key={n.id}>
                      {label(n, locale)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="f-check">
              <input
                type="checkbox"
                checked={g.restricted}
                onChange={(e) => patch(g.id, { restricted: e.target.checked })}
              />
              {T("السجلات المقيدة", "Restricted records")}
            </label>
            <button
              type="button"
              className="f-quiet"
              onClick={() => setGrants((gs) => gs.filter((x) => x.id !== g.id))}
            >
              {T("إزالة", "Remove")}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="f-secondary"
          onClick={() =>
            setGrants((gs) => [
              ...gs,
              {
                id: crypto.randomUUID(),
                domain: "program",
                role: "viewer",
                unitId: null,
                restricted: false,
              },
            ])
          }
        >
          <Plus size={15} />
          {T("إضافة إسناد", "Add assignment")}
        </button>
        {error && (
          <p className="f-error" role="alert">
            {error}
          </p>
        )}
        <div className="f-dialog-actions">
          <button className="f-button" disabled={busy}>
            {T("حفظ الصلاحيات", "Save access")}
          </button>
          <button
            type="button"
            className="f-secondary"
            onClick={onClose}
            disabled={busy}
          >
            {T("إلغاء", "Cancel")}
          </button>
        </div>
      </form>
      <details className="f-password-reset">
        <summary>{T("إعادة تعيين كلمة المرور", "Reset password")}</summary>
        <form
          className="f-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              await api("users", {
                action: "reset-password",
                userId: user.id,
                password: data.get("password"),
              });
              setNotice(
                T(
                  "تم التعيين وإبطال الجلسات. شارك الكلمة المؤقتة مع صاحب الحساب؛ سيطلب منه تغييرها.",
                  "Password reset and sessions revoked. Share the temporary password with the user; they must change it.",
                ),
              );
              // The form remains available so the administrator can confirm the reset result.
            } catch (e) {
              setError(errorText(e, locale));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {T("كلمة مرور مؤقتة", "Temporary password")}
            <input
              type="password"
              name="password"
              required
              minLength={1}
              autoComplete="new-password"
            />
          </label>
          <button className="f-secondary" disabled={busy}>
            {T("تعيين كلمة مؤقتة", "Set temporary password")}
          </button>
          {notice && <p role="status">{notice}</p>}
        </form>
      </details>
    </Dialog>
  );
}
