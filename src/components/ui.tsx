"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowUpLeft, ArrowUpRight, Inbox } from "lucide-react";
import {
  performanceBand,
  statusNames,
  type Locale,
  type Status,
} from "@/lib/domain";

export function DirectionArrow({
  locale,
  size = 16,
}: {
  locale: Locale;
  size?: number;
}) {
  return locale === "ar" ? (
    <ArrowUpLeft size={size} />
  ) : (
    <ArrowUpRight size={size} />
  );
}
export function Badge({
  status,
  locale,
}: {
  status: Status | "missing";
  locale: Locale;
}) {
  return (
    <span className={`badge status-${status}`}>
      <span className="status-dot" />
      {statusNames[status][locale]}
    </span>
  );
}
export function Score({
  value,
  locale,
}: {
  value: number | null;
  locale: Locale;
}) {
  return (
    <span className={`score score-${performanceBand(value)}`}>
      {value === null
        ? locale === "ar"
          ? "غير مكتمل"
          : "Incomplete"
        : `${value.toFixed(1)}%`}
    </span>
  );
}
export function Progress({
  value,
  tone = "green",
}: {
  value: number;
  tone?: string;
}) {
  return (
    <div className={`progress-track ${tone}`} aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={30} strokeWidth={1.3} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
  locale,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  locale: Locale;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">
            {locale === "ar" ? "بصير / إدارة الأداء" : "BASEER / PERFORMANCE"}
          </span>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={locale === "ar" ? "إغلاق" : "Close"}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
