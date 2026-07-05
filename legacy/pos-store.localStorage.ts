import { useEffect, useState, useCallback, useRef } from "react";
import { SEED_MENU, SEED_CATEGORIES, type MenuItem, type Size } from "./menu-data";
import { dayKey } from "./format";

const KEYS = {
  menu: "garahe.menu.v1",
  sales: "garahe.sales.v1",
  settings: "garahe.settings.v1",
  ledger: "garahe.ledger.v1",
  categories: "garahe.categories.v1",
};

export type CartLine = {
  id: string; // line id
  itemId: string;
  name: string;
  size: Size;
  unitPrice: number;
  qty: number;
  // How many units of THIS line are the senior/PWD's own item(s).
  // Must be <= qty. The discount applies only to these units, so if
  // e.g. 2 of the same drink are on one line and only 1 belongs to a
  // senior/PWD, only that 1 unit is discounted.
  discountedQty?: number;
};

export type PaymentMethod = "cash" | "gcash";

export type Sale = {
  id: string;
  timestamp: number; // epoch ms
  lines: CartLine[];
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived: number;
  change: number;
};

export type Settings = {
  seniorDiscountPct: number;
};

export type ExpenseEntry = {
  id: string;
  label: string;
  amount: number;
};

export type DailyLedger = {
  pettyCash: number;
  expenses: ExpenseEntry[];
};

const DEFAULT_LEDGER: DailyLedger = { pettyCash: 0, expenses: [] };

const DEFAULT_SETTINGS: Settings = { seniorDiscountPct: 10 };

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// simple event bus for cross-hook sync
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function useStore<T>(key: string, fallback: T): [T, (updater: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(fallback);
  const stateRef = useRef<T>(fallback);

  useEffect(() => {
    const initial = read(key, fallback);
    stateRef.current = initial;
    setState(initial);
    const unsub = subscribe(() => {
      const next = read(key, fallback);
      stateRef.current = next;
      setState(next);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        const next = read(key, fallback);
        stateRef.current = next;
        setState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Side effects (persisting + cross-component notify) happen exactly once
  // per call, computed from the latest known value via a ref — NOT inside
  // the function passed to setState, which React may invoke more than
  // once per update and would otherwise replay the write/notify and can
  // double-apply array-append updates (e.g. adding a sale or menu item).
  const set = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const prev = stateRef.current;
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      stateRef.current = next;
      write(key, next);
      setState(next);
      notify();
    },
    [key],
  );

  return [state, set];
}

export function useMenu() {
  const [menu, setMenu] = useStore<MenuItem[]>(KEYS.menu, SEED_MENU);

  // Seed on first mount if empty
  useEffect(() => {
    if (!isBrowser()) return;
    const raw = window.localStorage.getItem(KEYS.menu);
    if (!raw) write(KEYS.menu, SEED_MENU);
  }, []);

  return { menu, setMenu };
}

export function useSales() {
  const [sales, setSales] = useStore<Sale[]>(KEYS.sales, []);
  const addSale = useCallback(
    (sale: Sale) => setSales((prev) => [sale, ...prev]),
    [setSales],
  );
  // Void/delete a single sale (e.g. a mis-rung or duplicate order) without
  // touching any other recorded sale. This is the per-sale counterpart to
  // the "Clear all sales" nuke in Settings.
  const removeSale = useCallback(
    (id: string) => setSales((prev) => prev.filter((s) => s.id !== id)),
    [setSales],
  );
  return { sales, setSales, addSale, removeSale };
}

export function useSettings() {
  const [settings, setSettings] = useStore<Settings>(KEYS.settings, DEFAULT_SETTINGS);
  return { settings, setSettings };
}

// Categories shown as tabs on the Register and Admin pages. Seeded from
// SEED_CATEGORIES on first run, but editable thereafter (add/remove from
// Admin) — no code change needed to add a new category like "Pastries".
export function useCategories() {
  const [categories, setCategories] = useStore<string[]>(KEYS.categories, SEED_CATEGORIES);

  useEffect(() => {
    if (!isBrowser()) return;
    const raw = window.localStorage.getItem(KEYS.categories);
    if (!raw) write(KEYS.categories, SEED_CATEGORIES);
  }, []);

  const addCategory = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      let added = true;
      setCategories((prev) => {
        if (prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
          added = false;
          return prev;
        }
        return [...prev, trimmed];
      });
      return added;
    },
    [setCategories],
  );

  const removeCategory = useCallback(
    (name: string) => {
      setCategories((prev) => prev.filter((c) => c !== name));
    },
    [setCategories],
  );

  return { categories, setCategories, addCategory, removeCategory };
}

// All daily ledgers keyed by day (e.g. "2026-07-04"), stored as one blob.
// `sales` (optional) enables auto carry-over of yesterday's ending cash
// into today's starting float — see the effect below.
export function useDailyLedger(day: string, sales: Sale[] = []) {
  const [all, setAll] = useStore<Record<string, DailyLedger>>(KEYS.ledger, {});
  const exists = Object.prototype.hasOwnProperty.call(all, day);
  const ledger = all[day] ?? DEFAULT_LEDGER;
  const carriedRef = useRef(false);

  // If today doesn't have a ledger yet, seed its starting float with
  // yesterday's (or the most recent prior day's) ending cash instead of
  // ₱0, so the cashier doesn't have to remember and retype it every
  // morning. This only fires once per mount and never overwrites a
  // ledger that already exists for `day` — even if its pettyCash is 0,
  // that 0 was deliberately set (or already carried over) and is left
  // alone.
  useEffect(() => {
    if (exists || carriedRef.current) return;
    const priorDayKeys = new Set<string>(Object.keys(all).filter((k) => k < day));
    sales.forEach((s) => {
      const k = dayKey(s.timestamp);
      if (k < day) priorDayKeys.add(k);
    });
    if (priorDayKeys.size === 0) return;
    const prevDay = Array.from(priorDayKeys).sort().pop()!;
    const prevLedger = all[prevDay] ?? DEFAULT_LEDGER;
    const prevCashSales = sales
      .filter((s) => dayKey(s.timestamp) === prevDay && s.paymentMethod === "cash")
      .reduce((sum, s) => sum + s.total, 0);
    const prevExpenses = prevLedger.expenses.reduce((sum, e) => sum + e.amount, 0);
    const endingCash = Math.max(0, prevLedger.pettyCash + prevCashSales - prevExpenses);
    carriedRef.current = true;
    setAll((prev) => ({
      ...prev,
      [day]: { ...(prev[day] ?? DEFAULT_LEDGER), pettyCash: endingCash },
    }));
  }, [exists, all, sales, day, setAll]);

  const setPettyCash = useCallback(
    (amount: number) => {
      setAll((prev) => ({
        ...prev,
        [day]: { ...(prev[day] ?? DEFAULT_LEDGER), pettyCash: amount },
      }));
    },
    [day, setAll],
  );

  const addExpense = useCallback(
    (label: string, amount: number) => {
      setAll((prev) => {
        const cur = prev[day] ?? DEFAULT_LEDGER;
        const entry: ExpenseEntry = { id: `exp-${Date.now()}`, label, amount };
        return { ...prev, [day]: { ...cur, expenses: [...cur.expenses, entry] } };
      });
    },
    [day, setAll],
  );

  const removeExpense = useCallback(
    (id: string) => {
      setAll((prev) => {
        const cur = prev[day] ?? DEFAULT_LEDGER;
        return { ...prev, [day]: { ...cur, expenses: cur.expenses.filter((e) => e.id !== id) } };
      });
    },
    [day, setAll],
  );

  return { ledger, exists, setPettyCash, addExpense, removeExpense };
}

// ---------------------------------------------------------------------
// Backup / restore — all app data lives only in this browser's
// localStorage, so it's one "clear site data" or device swap away from
// being gone forever. These let the cashier export everything to a JSON
// file (and re-import it, e.g. on a new device or after a wipe).
// ---------------------------------------------------------------------

export type BackupData = {
  version: 1;
  exportedAt: string;
  menu: MenuItem[];
  sales: Sale[];
  settings: Settings;
  ledger: Record<string, DailyLedger>;
  categories: string[];
};

export function exportAllData(): string {
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    menu: read(KEYS.menu, SEED_MENU),
    sales: read(KEYS.sales, [] as Sale[]),
    settings: read(KEYS.settings, DEFAULT_SETTINGS),
    ledger: read(KEYS.ledger, {} as Record<string, DailyLedger>),
    categories: read(KEYS.categories, SEED_CATEGORIES),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(json: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Unrecognized backup file format." };
  }
  const data = parsed as Partial<BackupData>;
  if (
    !Array.isArray(data.menu) &&
    !Array.isArray(data.sales) &&
    !data.settings &&
    !data.ledger &&
    !Array.isArray(data.categories)
  ) {
    return { ok: false, error: "This file doesn't look like a GARA-HE backup." };
  }
  if (Array.isArray(data.menu)) write(KEYS.menu, data.menu);
  if (Array.isArray(data.sales)) write(KEYS.sales, data.sales);
  if (data.settings) write(KEYS.settings, data.settings);
  if (data.ledger) write(KEYS.ledger, data.ledger);
  if (Array.isArray(data.categories)) write(KEYS.categories, data.categories);
  // Tell every mounted hook instance to re-read from localStorage now.
  notify();
  return { ok: true };
}
