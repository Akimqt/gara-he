// Row shapes as they come back from Postgres/PostgREST, and the mapping
// functions between those rows and the app-facing types already used
// throughout the app (MenuItem, Sale, Settings, DailyLedger, ...).
//
// Kept separate from pos-store.ts so the hooks file stays readable.

import type { MenuItem } from "./menu-data";
import type { CartLine, Sale, Settings, ExpenseEntry, DailyLedger } from "./pos-store";

export type MenuItemRow = {
  id: string;
  name: string;
  category: string;
  sizes: { size: string; price: number }[];
  best_seller: boolean;
  available: boolean;
};

export function rowToMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sizes: row.sizes as MenuItem["sizes"],
    bestSeller: row.best_seller || undefined,
    available: row.available,
  };
}

export function menuItemToRow(item: MenuItem): MenuItemRow {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    sizes: item.sizes,
    best_seller: !!item.bestSeller,
    available: item.available,
  };
}

export type SaleRow = {
  id: string;
  timestamp: number | string;
  lines: CartLine[];
  subtotal: number | string;
  discount_pct: number | string;
  discount_amount: number | string;
  total: number | string;
  payment_method: string;
  cash_received: number | string;
  change: number | string;
};

export function rowToSale(row: SaleRow): Sale {
  return {
    id: row.id,
    timestamp: Number(row.timestamp),
    lines: row.lines,
    subtotal: Number(row.subtotal),
    discountPct: Number(row.discount_pct),
    discountAmount: Number(row.discount_amount),
    total: Number(row.total),
    paymentMethod: row.payment_method as Sale["paymentMethod"],
    cashReceived: Number(row.cash_received),
    change: Number(row.change),
  };
}

export function saleToRow(sale: Sale): SaleRow {
  return {
    id: sale.id,
    timestamp: sale.timestamp,
    lines: sale.lines,
    subtotal: sale.subtotal,
    discount_pct: sale.discountPct,
    discount_amount: sale.discountAmount,
    total: sale.total,
    payment_method: sale.paymentMethod,
    cash_received: sale.cashReceived,
    change: sale.change,
  };
}

export type SettingsRow = { id: 1; senior_discount_pct: number | string };

export function rowToSettings(row: SettingsRow): Settings {
  return { seniorDiscountPct: Number(row.senior_discount_pct) };
}

export function settingsToRow(settings: Settings): SettingsRow {
  return { id: 1, senior_discount_pct: settings.seniorDiscountPct };
}

export type LedgerRow = { day: string; petty_cash: number | string; expenses: ExpenseEntry[] };

export function rowToLedger(row: LedgerRow): DailyLedger {
  return { pettyCash: Number(row.petty_cash), expenses: row.expenses };
}

export function ledgerToRow(day: string, ledger: DailyLedger): LedgerRow {
  return { day, petty_cash: ledger.pettyCash, expenses: ledger.expenses };
}

export type CategoryRow = { name: string; position: number };
