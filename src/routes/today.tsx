import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Plus, X, ArrowLeft, Wallet, Receipt, TrendingUp, Banknote, Smartphone, ClipboardList, Trash2,
} from "lucide-react";
import { useSales, useDailyLedger, type Sale } from "@/lib/pos-store";
import { peso, pesoDec, dayKey, timeLabel, sanitizeAmountInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

function TodayPage() {
  const { sales, removeSale } = useSales();
  const today = dayKey(Date.now());

  const todays = useMemo(
    () => sales.filter((s) => dayKey(s.timestamp) === today),
    [sales, today],
  );

  const revenue = todays.reduce((s, x) => s + x.total, 0);
  const count = todays.length;
  const cashRevenue = todays
    .filter((s) => s.paymentMethod === "cash")
    .reduce((s, x) => s + x.total, 0);
  const gcashRevenue = todays
    .filter((s) => s.paymentMethod === "gcash")
    .reduce((s, x) => s + x.total, 0);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-moka">Register</p>
          <h1 className="font-display text-2xl font-black text-espresso sm:text-3xl">Today</h1>
        </div>
        <Link
          to="/"
          className="-m-2 flex items-center gap-1.5 rounded-lg p-2 text-sm font-medium text-terracotta transition-all active:scale-95 hover:bg-terracotta/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to register
        </Link>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <StatCard label="Revenue" value={pesoDec(revenue)} icon={TrendingUp} accent />
        <StatCard label="Transactions" value={String(count)} icon={Receipt} />
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 md:grid-cols-2">
        <StatCard label="Cash" value={pesoDec(cashRevenue)} icon={Banknote} />
        <StatCard label="GCash" value={pesoDec(gcashRevenue)} icon={Smartphone} />
      </div>

      <h2 className="mt-7 mb-3 flex items-center gap-2 font-display text-lg font-bold text-espresso sm:mt-8 sm:text-xl">
        <Wallet className="h-4 w-4 text-moka" />
        Cash Reconciliation
      </h2>
      <CashReconciliation
        day={today}
        totalSales={revenue}
        cashSales={cashRevenue}
        gcashSales={gcashRevenue}
        sales={sales}
      />

      <h2 className="mt-7 mb-3 flex items-center gap-2 font-display text-lg font-bold text-espresso sm:mt-8 sm:text-xl">
        <ClipboardList className="h-4 w-4 text-moka" />
        Orders
      </h2>
      <OrdersList sales={todays} onVoid={removeSale} />
    </div>
  );
}

export function CashReconciliation({
  day,
  totalSales,
  cashSales,
  gcashSales,
  sales = [],
}: {
  day: string;
  totalSales: number;
  cashSales: number;
  gcashSales: number;
  sales?: Sale[];
}) {
  const { ledger, setPettyCash, addExpense, removeExpense } = useDailyLedger(day, sales);
  const [pettyInput, setPettyInput] = useState(String(ledger.pettyCash || ""));
  const [expLabel, setExpLabel] = useState("");
  const [expAmount, setExpAmount] = useState("");

  // Keep the petty cash text field in sync if the stored value changes
  // from elsewhere (e.g. loaded on mount, or day rolls over). The ledger
  // loads asynchronously from localStorage a moment after mount, so we
  // must react to ledger.pettyCash itself, not just to `day`.
  useEffect(() => {
    setPettyInput(String(ledger.pettyCash || ""));
  }, [day, ledger.pettyCash]);

  const totalExpenses = ledger.expenses.reduce((s, e) => s + e.amount, 0);
  const totalCashOnHand = ledger.pettyCash + cashSales;
  const moneyLeft = totalCashOnHand - totalExpenses;

  function commitPetty() {
    const n = Number(pettyInput) || 0;
    setPettyCash(n);
    setPettyInput(String(n));
  }

  function submitExpense() {
    const amt = Number(expAmount) || 0;
    if (amt <= 0) return;
    addExpense(expLabel.trim(), amt);
    setExpLabel("");
    setExpAmount("");
  }

  return (
    <div className="dotted-frame grid gap-5 bg-card p-5 lg:grid-cols-2">
      {/* Left: inputs — petty cash + expenses */}
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-moka">
            Petty Cash (starting float)
          </label>
          <input
            inputMode="decimal"
            value={pettyInput}
            onChange={(e) => setPettyInput(sanitizeAmountInput(e.target.value))}
            onBlur={commitPetty}
            placeholder="0"
            className="num mt-1 w-full rounded-xl border border-moka/40 bg-paper px-3 py-2.5 text-lg font-bold text-espresso transition-colors focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          />
          <p className="mt-1 text-[11px] text-moka">
            Auto-fills from yesterday's ending cash on a new day — adjust if it's not right.
          </p>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-moka">
            Expenses
          </label>
          <div className="mt-1 flex gap-1.5">
            <input
              value={expLabel}
              onChange={(e) => setExpLabel(e.target.value)}
              placeholder="Label (optional)"
              className="min-w-0 flex-1 rounded-xl border border-moka/40 bg-paper px-3 py-2 text-sm text-espresso focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
            <input
              inputMode="decimal"
              value={expAmount}
              onChange={(e) => setExpAmount(sanitizeAmountInput(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && submitExpense()}
              placeholder="Amount"
              className="num min-w-0 w-20 shrink rounded-xl border border-moka/40 bg-paper px-2.5 py-2 text-right text-sm font-bold text-espresso focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
            <button
              onClick={submitExpense}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-terracotta text-primary-foreground shadow-warm transition-all ease-spring hover:brightness-110 active:scale-90"
              aria-label="Add expense"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {ledger.expenses.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {ledger.expenses.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-moka/20 bg-paper/60 px-3 py-1.5 text-sm"
                >
                  <span className="truncate text-espresso">
                    {e.label || "Expense"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="num font-semibold text-espresso">{peso(e.amount)}</span>
                    <button
                      onClick={() => removeExpense(e.id)}
                      className="grid h-8 w-8 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-rust/10 hover:text-rust active:scale-90"
                      aria-label="Remove expense"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-moka">No expenses logged yet.</p>
          )}
        </div>
      </div>

      {/* Right: computed summary, mirrors the paper tally */}
      <div className="space-y-1.5 rounded-2xl border border-moka/20 bg-paper/50 p-4 text-sm">
        <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-moka/70">
          Sales Today
        </p>
        <SummaryRow label="Cash Sales" value={peso(cashSales)} />
        <SummaryRow label="GCash Sales" value={peso(gcashSales)} />
        <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-terracotta bg-terracotta/10 px-3 py-2.5">
          <span className="font-display text-base font-bold text-espresso">Total Sales</span>
          <span className="num text-2xl font-black text-espresso">{peso(totalSales)}</span>
        </div>

        <div className="receipt-perf my-3" />

        <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-moka/70">
          Cash Drawer
        </p>
        <SummaryRow label="Starting Float" value={peso(ledger.pettyCash)} />
        <SummaryRow label="Cash Sales" operator="+" value={peso(cashSales)} />
        <SummaryRow label="Total Cash on Hand" value={peso(totalCashOnHand)} bold />
        <SummaryRow label="Expenses" operator="−" value={peso(totalExpenses)} className="text-rust" />

        <div className="receipt-perf my-3" />

        <div className="flex items-center justify-between rounded-xl border-2 border-sage bg-sage/15 px-3 py-2.5">
          <span className="font-display text-base font-bold text-espresso">Money Left</span>
          <span
            className={cn(
              "num text-2xl font-black",
              moneyLeft < 0 ? "text-rust" : "text-espresso",
            )}
          >
            {peso(moneyLeft)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label, value, bold = false, className = "", operator,
}: { label: string; value: string; bold?: boolean; className?: string; operator?: "+" | "−" }) {
  return (
    <div className={cn("flex items-baseline justify-between px-1", className)}>
      <span className={cn("flex items-baseline gap-1.5 text-moka", bold && "font-semibold text-espresso")}>
        {operator && (
          <span className="w-3 text-center font-bold text-moka/60">{operator}</span>
        )}
        {label}
      </span>
      <span className={cn("num", bold ? "font-bold text-espresso" : "font-semibold")}>{value}</span>
    </div>
  );
}

export function StatCard({
  label, value, accent = false, icon: Icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="dotted-frame flex items-start justify-between gap-3 bg-card p-4 sm:p-5">
      <div className="min-w-0">
        <p className="truncate text-[11px] uppercase tracking-widest text-moka">{label}</p>
        <p className={cn("num mt-1.5 text-2xl font-black sm:mt-2 sm:text-3xl", accent ? "text-terracotta" : "text-espresso")}>
          {value}
        </p>
      </div>
      {Icon && (
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            accent ? "bg-terracotta/15 text-terracotta" : "bg-moka/10 text-moka",
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      )}
    </div>
  );
}

export function OrdersList({
  sales,
  onVoid,
}: {
  sales: Sale[];
  // Optional: when provided, each order gets a Void button that deletes
  // just that one sale (with a confirmation) instead of requiring the
  // "Clear all sales" nuke in Settings for a single mistaken order.
  onVoid?: (id: string) => void;
}) {
  if (sales.length === 0) {
    return (
      <div className="dotted-frame flex flex-col items-center gap-2 bg-card p-8 text-center text-moka">
        <p className="font-display text-lg text-espresso">No sales yet today</p>
        <p className="text-sm">Tap an item to start your first order.</p>
      </div>
    );
  }

  function handleVoid(s: Sale) {
    if (!onVoid) return;
    const items = s.lines.reduce((n, l) => n + l.qty, 0);
    if (
      !confirm(
        `Void this sale? ${items} item${items === 1 ? "" : "s"} totaling ${peso(s.total)} will be permanently deleted. This cannot be undone.`,
      )
    ) {
      return;
    }
    onVoid(s.id);
  }

  return (
    <ul className="space-y-2">
      {sales.map((s) => (
        <li key={s.id} className="rounded-xl border border-moka/25 bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-moka">
                {timeLabel(s.timestamp)} · {s.lines.reduce((n, l) => n + l.qty, 0)} items
              </p>
              <p className="mt-0.5 text-sm text-espresso">
                {s.lines
                  .map((l) => `${l.qty}× ${l.name}${l.size !== "single" ? ` (${l.size})` : ""}`)
                  .join(" · ")}
              </p>
              {s.discountAmount > 0 && (
                <p className="mt-0.5 text-xs text-sage">
                  Senior/PWD −{peso(s.discountAmount)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="num text-xl font-bold text-espresso">{pesoDec(s.total)}</p>
              <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-moka">
                <span
                  className={
                    s.paymentMethod === "gcash"
                      ? "rounded-full bg-sky-500/15 px-1.5 py-0.5 font-bold uppercase tracking-wide text-sky-600"
                      : "rounded-full bg-moka/10 px-1.5 py-0.5 font-bold uppercase tracking-wide text-moka"
                  }
                >
                  {s.paymentMethod === "gcash" ? "GCash" : "Cash"}
                </span>
                {s.paymentMethod === "cash" && (
                  <span className="num">
                    Cash {peso(s.cashReceived)} · Change {peso(s.change)}
                  </span>
                )}
              </p>
            </div>
          </div>
          {onVoid && (
            <div className="mt-2 flex justify-end border-t border-moka/15 pt-2">
              <button
                onClick={() => handleVoid(s)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-moka transition-all ease-spring hover:bg-rust/10 hover:text-rust active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Void sale
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
