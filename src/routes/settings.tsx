import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Settings as SettingsIcon, Percent, Database, Trash2, Download, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { useSettings, useSales, exportAllData, importAllData } from "@/lib/pos-store";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, setSettings } = useSettings();
  const { sales, setSales } = useSales();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function clearSales() {
    if (!confirm(`Delete all ${sales.length} recorded sales? This cannot be undone.`)) return;
    setSales([]);
  }

  async function handleExport() {
    const json = await exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `gara-he-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    setImportMessage(null);
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file again later
    if (!file) return;
    if (
      !confirm(
        "Restore from this backup? It will overwrite all current menu, sales, ledger, and settings data for everyone using this app. This cannot be undone.",
      )
    ) {
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = await importAllData(String(reader.result ?? ""));
      if (result.ok) {
        setImportMessage({ type: "success", text: "Backup restored successfully. Reloading…" });
        // Every hook's data is cached from Supabase; reload so all of them
        // refetch fresh instead of hand-rolling a full cache invalidation here.
        setTimeout(() => window.location.reload(), 800);
      } else {
        setImportMessage({ type: "error", text: result.error });
      }
    };
    reader.onerror = () => setImportMessage({ type: "error", text: "Couldn't read that file." });
    reader.readAsText(file);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-terracotta/15 text-terracotta">
          <SettingsIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-moka">Preferences</p>
          <h1 className="font-display text-2xl font-black text-espresso sm:text-3xl">Settings</h1>
        </div>
      </div>

      <div className="dotted-frame bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
          <Percent className="h-4 w-4 text-moka" />
          Discounts
        </h2>
        <p className="mt-1 text-sm text-moka">
          Applied when Senior / PWD toggle is enabled during checkout.
        </p>
        <label className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-espresso">Senior / PWD discount</span>
          <div className="flex items-center gap-2 rounded-xl border border-moka/40 bg-paper px-1">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              value={settings.seniorDiscountPct}
              onChange={(e) =>
                setSettings({ ...settings, seniorDiscountPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
              }
              className="num w-20 bg-transparent px-2 py-2.5 text-right font-bold text-espresso focus:outline-none"
            />
            <span className="pr-2 text-moka">%</span>
          </div>
        </label>
      </div>

      <div className="dotted-frame mt-4 bg-card p-5 sm:mt-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
          <Database className="h-4 w-4 text-moka" />
          Data
        </h2>
        <p className="mt-1 text-sm text-moka">
          All data is stored in your Supabase project and synced across every device using this app.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-moka/25 bg-paper/60 px-3 py-3">
          <div>
            <p className="text-sm font-semibold text-espresso">{sales.length} recorded sales</p>
            <p className="text-xs text-moka">Includes today's transactions and history</p>
          </div>
          <button
            onClick={clearSales}
            className="flex items-center gap-1.5 rounded-lg border border-rust/40 px-3 py-2.5 text-sm font-medium text-rust transition-all ease-spring hover:bg-rust/10 active:scale-95 sm:py-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all sales
          </button>
        </div>
      </div>

      <div className="dotted-frame mt-4 bg-card p-5 sm:mt-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
          <Download className="h-4 w-4 text-moka" />
          Backup &amp; Restore
        </h2>
        <p className="mt-1 text-sm text-moka">
          Data now lives in your Supabase project, so it's safe from any single device being
          wiped or lost. Still worth downloading a backup now and then and keeping it somewhere
          safe, in case the project itself is ever deleted or misconfigured.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg bg-terracotta px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-warm transition-all ease-spring hover:brightness-110 active:scale-95 sm:py-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download backup
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 rounded-lg border border-moka/30 px-3 py-2.5 text-sm font-medium text-moka transition-all ease-spring hover:border-terracotta hover:text-terracotta active:scale-95 sm:py-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Restore from file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
        {importMessage && (
          <p
            className={`mt-3 flex items-center gap-1.5 text-sm font-medium ${
              importMessage.type === "success" ? "text-sage" : "text-rust"
            }`}
          >
            {importMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {importMessage.text}
          </p>
        )}
      </div>
    </div>
  );
}
