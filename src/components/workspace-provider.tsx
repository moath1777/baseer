"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { freshStore } from "@/lib/seed";
import {
  isStore,
  type Locale,
  type Period,
  type Role,
  type Store,
} from "@/lib/domain";

const STORAGE = "baseer:m1:workspace:v1";
const PREFERENCES = "baseer:m1:preferences:v1";

function useWorkspaceState() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [domain, setDomain] = useState<"program" | "ministry">("program");
  const [period, setPeriod] = useState<Period>("2026-Q3");
  const [role, setRole] = useState<Role>("performance");
  const [store, setStore] = useState<Store>(freshStore);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isStore(parsed)) setStore(parsed);
        else setStorageError(true);
      }
      const preferences = JSON.parse(
        localStorage.getItem(PREFERENCES) || "null",
      );
      if (preferences) {
        if (["ar", "en"].includes(preferences.locale))
          setLocale(preferences.locale);
        if (["program", "ministry"].includes(preferences.domain))
          setDomain(preferences.domain);
        if (["2026-Q1", "2026-Q2", "2026-Q3"].includes(preferences.period))
          setPeriod(preferences.period);
        if (
          ["performance", "ambassador", "owner", "viewer"].includes(
            preferences.role,
          )
        )
          setRole(preferences.role);
      }
    } catch {
      setStorageError(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    if (ready) {
      try {
        localStorage.setItem(
          PREFERENCES,
          JSON.stringify({ locale, domain, period, role }),
        );
      } catch {
        setStorageError(true);
      }
    }
  }, [locale, domain, period, role, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  function save(next: Store) {
    setStore(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  return {
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
  };
}

const WorkspaceContext = createContext<ReturnType<
  typeof useWorkspaceState
> | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaceState();
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceProvider is required");
  return context;
}
