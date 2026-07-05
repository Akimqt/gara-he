import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { History as HistoryIcon, CalendarDays, TrendingUp, Receipt } from "lucide-react";
import { useSales } from "@/lib/pos-store";
import { peso, pesoDec, dayKey, dayLabel } from "@/lib/format";
import { OrdersList, StatCard } from "./today";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { sales, removeSale } = useSales();
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 14 | 30>(7);

  const byDay = useMemo(() => {
    const map = new Map<string, { key: string; revenue: number; count: number }>();
    sales.forEach((s) => {
      const k = dayKey(s.timestamp);
      const cur = map.get(k) ?? { key: k, revenue: 0, count: 0 };
      cur.revenue += s.total;
      cur.count += 1;
      map.set(k, cur);
    });
    return map;
  }, [sales]);

  const chartData = useMemo(() => {
    const days: { key: string; label: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const k = dayKey(d.getTime());
      days.push({
        key: k,
        label: d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
        revenue: byDay.get(k)?.revenue ?? 0,
      });
    }
    return days;
  }, [byDay, range]);

  const dayList = useMemo(() => {
    return Array.from(byDay.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [byDay]);

  const selectedSales = selected
    ? sales.filter((s) => dayKey(s.timestamp) === selected)
    : [];
  const selectedRevenue = selectedSales.reduce((s, x) => s + x.total, 0);
  const selectedCash = selectedSales
    .filter((s) => s.paymentMethod === "cash")
    .reduce((s, x) => s + x.total, 0);
  const selectedGcash = selectedSales
    .filter((s) => s.paymentMethod === "gcash")
    .reduce((s, x) => s + x.total, 0);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-terracotta/15 text-terracotta">
          <HistoryIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-moka">Reports</p>
          <h1 className="font-display text-2xl font-black text-espresso sm:text-3xl">Sales History</h1>
        </div>
      </div>

      <div className="dotted-frame bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-espresso">Daily Revenue</h2>
          <div className="flex gap-1">
            {[7, 14, 30].map((n) => (
              <button
                key={n}
                onClick={() => setRange(n as 7 | 14 | 30)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-medium transition-all ease-spring active:scale-95 sm:py-1",
                  range === n
                    ? "border-terracotta bg-terracotta text-primary-foreground shadow-warm"
                    : "border-moka/30 text-moka hover:border-moka",
                )}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--color-moka)" opacity={0.25} />
              <XAxis dataKey="label" tick={{ fill: "var(--color-moka)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-moka)", fontSize: 11 }} axisLine={false} tickLine={false} width={50}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
              <Tooltip
                cursor={{ fill: "var(--color-moka)", opacity: 0.08 }}
                contentStyle={{
                  background: "var(--color-paper)",
                  border: "1.5px dotted var(--color-moka)",
                  borderRadius: 12,
                  fontFamily: "var(--font-mono)",
                }}
                formatter={(v: number) => [peso(v), "Revenue"]}
              />
              <Bar dataKey="revenue" fill="var(--color-terracotta)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:mt-6 sm:gap-5 lg:grid-cols-[320px_1fr]">
        <div className="dotted-frame bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-espresso">
            <CalendarDays className="h-4 w-4 text-moka" />
            Days
          </h2>
          {dayList.length === 0 ? (
            <p className="text-sm text-moka">No sales recorded yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {dayList.map((d) => (
                <li key={d.key}>
                  <button
                    onClick={() => setSelected(d.key)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition-all ease-spring active:scale-[0.98] sm:py-2",
                      selected === d.key
                        ? "border-terracotta bg-terracotta/10"
                        : "border-moka/25 hover:border-moka",
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold text-espresso">{dayLabel(d.key)}</p>
                      <p className="text-[11px] text-moka">{d.count} orders</p>
                    </div>
                    <span className="num font-bold text-terracotta">{peso(d.revenue)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {selected ? (
            <>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:grid-cols-2">
                <StatCard label={dayLabel(selected)} value={pesoDec(selectedRevenue)} icon={TrendingUp} accent />
                <StatCard label="Transactions" value={String(selectedSales.length)} icon={Receipt} />
              </div>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:grid-cols-2">
                <StatCard label="Cash" value={pesoDec(selectedCash)} />
                <StatCard label="GCash" value={pesoDec(selectedGcash)} />
              </div>
              <OrdersList sales={selectedSales} onVoid={removeSale} />
            </>
          ) : (
            <div className="dotted-frame flex h-full min-h-[200px] items-center justify-center bg-card p-8 text-moka">
              Select a day to view orders.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
