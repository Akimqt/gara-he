import { useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase-client";
import {
  rowToMenuItem,
  menuItemToRow,
  rowToSale,
  saleToRow,
  rowToSettings,
  settingsToRow,
  rowToLedger,
  ledgerToRow,
  type MenuItemRow,
  type SaleRow,
  type SettingsRow,
  type LedgerRow,
  type CategoryRow,
} from "./supabase-types";
import { SEED_MENU, SEED_CATEGORIES, type MenuItem, type Size } from "./menu-data";
import { dayKey } from "./format";

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

// ---------------------------------------------------------------------
// Realtime: whenever another device/tab writes to one of these tables,
// invalidate the matching query so every mounted hook refetches. This is
// the cross-device equivalent of the old `window.addEventListener("storage")`
// listener — except it now also fires across different devices/registers,
// not just other tabs on the same browser.
// ---------------------------------------------------------------------
function useRealtimeInvalidate(table: string, queryKey: unknown[]) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}

// Every Supabase write in this file is fire-and-forget from the caller's
// point of view (the UI already updated optimistically via setQueryData).
// That's fine for responsiveness, but errors must not vanish silently —
// wrap every write through this so a failed insert/upsert/delete at least
// shows up loudly in the console instead of just quietly not persisting.
function logIfError(label: string) {
  return (result: { error: { message: string } | null }) => {
    if (result.error) {
      console.error(`[pos-store] ${label} failed:`, result.error.message);
    }
    return result;
  };
}

// Diffs a previous vs. next id-keyed array and applies the minimal set of
// upserts/deletes needed to make the table match `next`. Shared by
// useMenu/useCategories/useSales, all of which hand back a whole new
// array from their setter (same contract the old localStorage version had).
async function syncRows<Row>(
  table: string,
  idField: keyof Row,
  prevRows: Row[],
  nextRows: Row[],
) {
  const prevIds = new Set(prevRows.map((r) => r[idField]));
  const nextIds = new Set(nextRows.map((r) => r[idField]));
  const toDelete = [...prevIds].filter((id) => !nextIds.has(id));
  if (toDelete.length > 0) {
    await supabase
      .from(table)
      .delete()
      .in(idField as string, toDelete as string[])
      .then(logIfError(`${table} delete`));
  }
  if (nextRows.length > 0) {
    await supabase
      .from(table)
      .upsert(nextRows as unknown as Record<string, unknown>[])
      .then(logIfError(`${table} upsert`));
  }
}

// =======================================================================
// Menu
// =======================================================================
async function fetchMenu(): Promise<MenuItem[]> {
  const { data, error } = await supabase.from("menu_items").select("*");
  if (error) throw error;
  return (data as MenuItemRow[]).map(rowToMenuItem);
}

export function useMenu() {
  const queryClient = useQueryClient();
  useRealtimeInvalidate("menu_items", ["menu"]);
  const { data: menu = [], isSuccess } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });

  // Seed on first run if the table is empty.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!isSuccess || seededRef.current || menu.length > 0) return;
    seededRef.current = true;
    void supabase
      .from("menu_items")
      .upsert(SEED_MENU.map(menuItemToRow))
      .then(logIfError("menu seed"))
      .then(() => queryClient.invalidateQueries({ queryKey: ["menu"] }));
  }, [isSuccess, menu.length, queryClient]);

  const setMenu = useCallback(
    (updater: MenuItem[] | ((prev: MenuItem[]) => MenuItem[])) => {
      const prev = queryClient.getQueryData<MenuItem[]>(["menu"]) ?? menu;
      const next = typeof updater === "function" ? (updater as (p: MenuItem[]) => MenuItem[])(prev) : updater;
      queryClient.setQueryData(["menu"], next);
      void syncRows("menu_items", "id", prev.map(menuItemToRow), next.map(menuItemToRow));
    },
    [menu, queryClient],
  );

  return { menu, setMenu };
}

// =======================================================================
// Sales
// =======================================================================
async function fetchSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return (data as SaleRow[]).map(rowToSale);
}

export function useSales() {
  const queryClient = useQueryClient();
  useRealtimeInvalidate("sales", ["sales"]);
  const { data: sales = [] } = useQuery({ queryKey: ["sales"], queryFn: fetchSales });

  const setSales = useCallback(
    (updater: Sale[] | ((prev: Sale[]) => Sale[])) => {
      const prev = queryClient.getQueryData<Sale[]>(["sales"]) ?? sales;
      const next = typeof updater === "function" ? (updater as (p: Sale[]) => Sale[])(prev) : updater;
      queryClient.setQueryData(["sales"], next);
      void syncRows("sales", "id", prev.map(saleToRow), next.map(saleToRow));
    },
    [sales, queryClient],
  );

  const addSale = useCallback(
    (sale: Sale) => {
      const prev = queryClient.getQueryData<Sale[]>(["sales"]) ?? sales;
      queryClient.setQueryData(["sales"], [sale, ...prev]);
      void supabase.from("sales").insert(saleToRow(sale)).then(logIfError("sales insert"));
    },
    [sales, queryClient],
  );

  // Void/delete a single sale (e.g. a mis-rung or duplicate order) without
  // touching any other recorded sale. This is the per-sale counterpart to
  // the "Clear all sales" nuke in Settings.
  const removeSale = useCallback(
    (id: string) => {
      const prev = queryClient.getQueryData<Sale[]>(["sales"]) ?? sales;
      queryClient.setQueryData(["sales"], prev.filter((s) => s.id !== id));
      void supabase.from("sales").delete().eq("id", id).then(logIfError("sales delete"));
    },
    [sales, queryClient],
  );

  return { sales, setSales, addSale, removeSale };
}

// =======================================================================
// Settings (single row)
// =======================================================================
async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data ? rowToSettings(data as SettingsRow) : DEFAULT_SETTINGS;
}

export function useSettings() {
  const queryClient = useQueryClient();
  useRealtimeInvalidate("settings", ["settings"]);
  const { data: settings = DEFAULT_SETTINGS } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const setSettings = useCallback(
    (updater: Settings | ((prev: Settings) => Settings)) => {
      const prev = queryClient.getQueryData<Settings>(["settings"]) ?? settings;
      const next = typeof updater === "function" ? (updater as (p: Settings) => Settings)(prev) : updater;
      queryClient.setQueryData(["settings"], next);
      void supabase.from("settings").upsert(settingsToRow(next)).then(logIfError("settings upsert"));
    },
    [settings, queryClient],
  );

  return { settings, setSettings };
}

// =======================================================================
// Categories — tabs shown on Register and Admin pages. Seeded from
// SEED_CATEGORIES on first run, editable thereafter (add/remove in Admin).
// =======================================================================
async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase.from("categories").select("*").order("position");
  if (error) throw error;
  return (data as CategoryRow[]).map((r) => r.name);
}

export function useCategories() {
  const queryClient = useQueryClient();
  useRealtimeInvalidate("categories", ["categories"]);
  const { data: categories = [], isSuccess } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const seededRef = useRef(false);
  useEffect(() => {
    if (!isSuccess || seededRef.current || categories.length > 0) return;
    seededRef.current = true;
    void supabase
      .from("categories")
      .upsert(SEED_CATEGORIES.map((name, position) => ({ name, position })))
      .then(logIfError("categories seed"))
      .then(() => queryClient.invalidateQueries({ queryKey: ["categories"] }));
  }, [isSuccess, categories.length, queryClient]);

  const setCategories = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      const prev = queryClient.getQueryData<string[]>(["categories"]) ?? categories;
      const next = typeof updater === "function" ? (updater as (p: string[]) => string[])(prev) : updater;
      queryClient.setQueryData(["categories"], next);
      const prevRows = prev.map((name, position) => ({ name, position }));
      const nextRows = next.map((name, position) => ({ name, position }));
      void syncRows("categories", "name", prevRows, nextRows);
    },
    [categories, queryClient],
  );

  const addCategory = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      const prev = queryClient.getQueryData<string[]>(["categories"]) ?? categories;
      if (prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return false;
      setCategories([...prev, trimmed]);
      return true;
    },
    [categories, queryClient, setCategories],
  );

  const removeCategory = useCallback(
    (name: string) => {
      const prev = queryClient.getQueryData<string[]>(["categories"]) ?? categories;
      setCategories(prev.filter((c) => c !== name));
    },
    [categories, queryClient, setCategories],
  );

  return { categories, setCategories, addCategory, removeCategory };
}

// =======================================================================
// Daily ledger — all days kept as one Record<day, DailyLedger> in the
// query cache (small table; a shop generates one row per calendar day),
// so the "carry over yesterday's ending cash" logic below reads exactly
// like the old localStorage version. Writes only ever touch the row for
// the current `day`, so mutations upsert just that one row.
// =======================================================================
async function fetchAllLedgers(): Promise<Record<string, DailyLedger>> {
  const { data, error } = await supabase.from("ledgers").select("*");
  if (error) throw error;
  const out: Record<string, DailyLedger> = {};
  for (const row of data as LedgerRow[]) out[row.day] = rowToLedger(row);
  return out;
}

export function useDailyLedger(day: string, sales: Sale[] = []) {
  const queryClient = useQueryClient();
  useRealtimeInvalidate("ledgers", ["ledgers"]);
  const { data: all = {} } = useQuery({ queryKey: ["ledgers"], queryFn: fetchAllLedgers });

  const exists = Object.prototype.hasOwnProperty.call(all, day);
  const ledger = all[day] ?? DEFAULT_LEDGER;
  const carriedRef = useRef(false);

  const persistDay = useCallback(
    (targetDay: string, nextLedger: DailyLedger) => {
      void supabase.from("ledgers").upsert(ledgerToRow(targetDay, nextLedger)).then(logIfError("ledgers upsert"));
    },
    [],
  );

  // If today doesn't have a ledger yet, seed its starting float with
  // yesterday's (or the most recent prior day's) ending cash instead of
  // ₱0, so the cashier doesn't have to remember and retype it every
  // morning. This only fires once per mount and never overwrites a
  // ledger that already exists for `day`.
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
    const next: DailyLedger = { ...(all[day] ?? DEFAULT_LEDGER), pettyCash: endingCash };
    queryClient.setQueryData(["ledgers"], { ...all, [day]: next });
    persistDay(day, next);
  }, [exists, all, sales, day, queryClient, persistDay]);

  const setPettyCash = useCallback(
    (amount: number) => {
      const cur = all[day] ?? DEFAULT_LEDGER;
      const next: DailyLedger = { ...cur, pettyCash: amount };
      queryClient.setQueryData(["ledgers"], { ...all, [day]: next });
      persistDay(day, next);
    },
    [all, day, queryClient, persistDay],
  );

  const addExpense = useCallback(
    (label: string, amount: number) => {
      const cur = all[day] ?? DEFAULT_LEDGER;
      const entry: ExpenseEntry = { id: `exp-${Date.now()}`, label, amount };
      const next: DailyLedger = { ...cur, expenses: [...cur.expenses, entry] };
      queryClient.setQueryData(["ledgers"], { ...all, [day]: next });
      persistDay(day, next);
    },
    [all, day, queryClient, persistDay],
  );

  const removeExpense = useCallback(
    (id: string) => {
      const cur = all[day] ?? DEFAULT_LEDGER;
      const next: DailyLedger = { ...cur, expenses: cur.expenses.filter((e) => e.id !== id) };
      queryClient.setQueryData(["ledgers"], { ...all, [day]: next });
      persistDay(day, next);
    },
    [all, day, queryClient, persistDay],
  );

  return { ledger, exists, setPettyCash, addExpense, removeExpense };
}

// ---------------------------------------------------------------------
// Backup / restore — now reads/writes Supabase directly (not the React
// Query cache), so these work as plain async functions from anywhere,
// e.g. a Settings page button. After a restore, reload the page so
// mounted hooks pick up the change (see settings.tsx).
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

export async function exportAllData(): Promise<string> {
  const [menu, sales, settings, allLedgers, categories] = await Promise.all([
    fetchMenu(),
    fetchSales(),
    fetchSettings(),
    fetchAllLedgers(),
    fetchCategories(),
  ]);
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    menu,
    sales,
    settings,
    ledger: allLedgers,
    categories,
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(
  json: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  try {
    if (Array.isArray(data.menu)) {
      await supabase.from("menu_items").delete().neq("id", "");
      if (data.menu.length > 0) await supabase.from("menu_items").upsert(data.menu.map(menuItemToRow));
    }
    if (Array.isArray(data.sales)) {
      await supabase.from("sales").delete().neq("id", "");
      if (data.sales.length > 0) await supabase.from("sales").upsert(data.sales.map(saleToRow));
    }
    if (data.settings) {
      await supabase.from("settings").upsert(settingsToRow(data.settings));
    }
    if (data.ledger) {
      const entries = Object.entries(data.ledger);
      await supabase.from("ledgers").delete().neq("day", "");
      if (entries.length > 0) {
        await supabase.from("ledgers").upsert(entries.map(([day, ledger]) => ledgerToRow(day, ledger)));
      }
    }
    if (Array.isArray(data.categories)) {
      await supabase.from("categories").delete().neq("name", "");
      if (data.categories.length > 0) {
        await supabase
          .from("categories")
          .upsert(data.categories.map((name, position) => ({ name, position })));
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Restore failed partway through." };
  }

  return { ok: true };
}
