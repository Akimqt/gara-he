import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { UtensilsCrossed, RotateCcw, Star, Plus, X, Trash2, Tag } from "lucide-react";
import { useMenu, useCategories } from "@/lib/pos-store";
import { SEED_MENU, SEED_CATEGORIES, type MenuItem, type Size } from "@/lib/menu-data";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ALL_SIZES: Size[] = ["12oz", "16oz", "20oz", "single"];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function AvailabilityToggle({
  available,
  onChange,
}: {
  available: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 select-none">
      <span
        className={cn(
          "text-xs font-bold uppercase tracking-wide",
          available ? "text-sage" : "text-rust",
        )}
      >
        {available ? "On" : "Sold Out"}
      </span>
      <span className="relative inline-flex items-center py-2">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={available}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-sage" />
        <span className="absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-card shadow transition-transform ease-spring peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function BestSellerToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all ease-spring active:scale-95",
        checked
          ? "border-gold bg-gold/20 text-espresso"
          : "border-moka/25 text-moka hover:border-moka/50",
      )}
    >
      <Star className={cn("h-3.5 w-3.5", checked && "fill-gold text-gold")} strokeWidth={checked ? 0 : 2} />
      Best Seller
    </button>
  );
}

function AddItemForm({
  category,
  onAdd,
  onCancel,
}: {
  category: string;
  onAdd: (item: MenuItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [prices, setPrices] = useState<Partial<Record<Size, string>>>({});
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const toggleSize = (size: Size) => {
    setPrices((prev) => {
      const next = { ...prev };
      if (size in next) {
        delete next[size];
      } else {
        next[size] = "";
      }
      return next;
    });
  };

  function submit() {
    if (submittingRef.current) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a product name.");
      return;
    }
    const sizes = (Object.entries(prices) as [Size, string][])
      .map(([size, p]) => ({ size, price: Number(p) || 0 }))
      .filter((s) => s.price > 0);
    if (sizes.length === 0) {
      setError("Pick at least one size and enter a price above ₱0.");
      return;
    }
    submittingRef.current = true;
    const id = `${slugify(category)}-${slugify(trimmedName)}-${Date.now().toString(36)}`;
    onAdd({ id, name: trimmedName, category, sizes, available: true });
    setName("");
    setPrices({});
    setError("");
    // Form unmounts (list re-key) or stays open for another item; either
    // way release the lock on the next tick so a genuine second add works.
    setTimeout(() => {
      submittingRef.current = false;
    }, 0);
  }

  return (
    <div className="dotted-frame mb-4 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-base font-bold text-espresso">
          Add Item to {category}
        </p>
        <button
          onClick={onCancel}
          className="grid h-8 w-8 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-rust/10 hover:text-rust active:scale-90"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="block text-[11px] uppercase tracking-wider text-moka">
        Product name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Matcha Cloud"
        className="mt-1 w-full rounded-xl border border-moka/40 bg-paper px-3 py-2.5 font-semibold text-espresso focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
      />

      <label className="mt-3 block text-[11px] uppercase tracking-wider text-moka">
        Sizes & prices
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {ALL_SIZES.map((size) => {
          const active = size in prices;
          return (
            <div
              key={size}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-2.5 py-2 transition-colors",
                active ? "border-terracotta bg-terracotta/10" : "border-moka/25 bg-paper/70",
              )}
            >
              <button
                type="button"
                onClick={() => toggleSize(size)}
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider",
                  active ? "text-terracotta" : "text-moka",
                )}
              >
                {size === "single" ? "Price" : size}
              </button>
              {active && (
                <>
                  <span className="num text-moka">₱</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={prices[size]}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [size]: e.target.value }))
                    }
                    placeholder="0"
                    className="num w-16 bg-transparent text-right font-bold text-espresso focus:outline-none"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-rust">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          className="flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-warm transition-all ease-spring hover:brightness-110 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-moka/30 px-4 py-2.5 text-sm font-medium text-moka transition-all ease-spring hover:border-moka active:scale-95"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AdminPage() {
  const { menu, setMenu } = useMenu();
  const { categories, setCategories, addCategory, removeCategory } = useCategories();
  const [cat, setCat] = useState<string>(categories[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const items = menu.filter((m) => m.category === cat);

  function submitNewCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryError("Enter a category name.");
      return;
    }
    const added = addCategory(trimmed);
    if (!added) {
      setCategoryError("That category already exists.");
      return;
    }
    setCat(trimmed);
    setNewCategoryName("");
    setCategoryError("");
    setShowAddCategory(false);
  }

  function handleRemoveCategory(name: string) {
    const itemsInCategory = menu.filter((m) => m.category === name).length;
    if (itemsInCategory > 0) {
      alert(
        `"${name}" still has ${itemsInCategory} item${itemsInCategory === 1 ? "" : "s"}. Remove or move those items first.`,
      );
      return;
    }
    if (!confirm(`Remove the "${name}" category?`)) return;
    removeCategory(name);
    if (cat === name) {
      const remaining = categories.filter((c) => c !== name);
      setCat(remaining[0] ?? "");
    }
  }

  function updateItem(id: string, patch: Partial<MenuItem>) {
    setMenu((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function updateSizePrice(id: string, size: string, price: number) {
    setMenu((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, sizes: m.sizes.map((s) => (s.size === size ? { ...s, price } : s)) }
          : m,
      ),
    );
  }

  function addItem(item: MenuItem) {
    setMenu((prev) => [...prev, item]);
    setShowAddForm(false);
  }

  function removeItem(id: string) {
    if (!confirm("Remove this item from the menu?")) return;
    setMenu((prev) => prev.filter((m) => m.id !== id));
  }

  function resetToSeed() {
    if (
      !confirm(
        "Reset menu to default? This replaces the ENTIRE menu — including any custom items " +
          "and categories you've added, and any name/price/availability edits — with the " +
          "original default menu. Custom items and categories will be permanently deleted. " +
          "This cannot be undone.",
      )
    ) {
      return;
    }
    setMenu(SEED_MENU);
    setCategories(SEED_CATEGORIES);
    setCat(SEED_CATEGORIES[0]);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-terracotta/15 text-terracotta">
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-moka">Admin</p>
            <h1 className="font-display text-2xl font-black text-espresso sm:text-3xl">Menu Management</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-terracotta px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-warm transition-all ease-spring hover:brightness-110 active:scale-95 sm:py-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
          <button
            onClick={resetToSeed}
            className="flex items-center gap-1.5 rounded-lg border border-rust/40 px-3 py-2.5 text-sm text-rust transition-all ease-spring hover:bg-rust/10 active:scale-95 sm:py-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </button>
        </div>
      </div>

      {showAddForm && (
        <AddItemForm key={cat} category={cat} onAdd={addItem} onCancel={() => setShowAddForm(false)} />
      )}

      <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2.5 text-sm font-medium transition-all ease-spring active:scale-95 sm:py-1.5",
              cat === c
                ? "border-terracotta bg-terracotta text-primary-foreground shadow-warm"
                : "border-moka/30 text-moka hover:border-moka",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Category management — categories are no longer a fixed code list;
          add or remove them here, e.g. a new "Pastries" category. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {showAddCategory ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-moka/25 bg-paper/60 p-2">
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => {
                setNewCategoryName(e.target.value);
                setCategoryError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submitNewCategory()}
              placeholder="New category name"
              className="min-w-0 rounded-lg border border-moka/40 bg-paper px-2.5 py-1.5 text-sm text-espresso focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
            <button
              onClick={submitNewCategory}
              className="rounded-lg bg-terracotta px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-warm transition-all ease-spring hover:brightness-110 active:scale-95"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddCategory(false);
                setNewCategoryName("");
                setCategoryError("");
              }}
              className="rounded-lg border border-moka/30 px-3 py-1.5 text-xs font-medium text-moka transition-all ease-spring hover:border-moka active:scale-95"
            >
              Cancel
            </button>
            {categoryError && <p className="w-full text-xs font-medium text-rust">{categoryError}</p>}
          </div>
        ) : (
          <button
            onClick={() => setShowAddCategory(true)}
            className="flex items-center gap-1.5 rounded-lg border border-moka/30 px-3 py-2 text-xs font-medium text-moka transition-all ease-spring hover:border-terracotta hover:text-terracotta active:scale-95"
          >
            <Tag className="h-3.5 w-3.5" />
            Add Category
          </button>
        )}
        {cat && (
          <button
            onClick={() => handleRemoveCategory(cat)}
            className="flex items-center gap-1.5 rounded-lg border border-moka/30 px-3 py-2 text-xs font-medium text-moka transition-all ease-spring hover:border-rust/50 hover:text-rust active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove "{cat}"
          </button>
        )}
      </div>

      {/* Mobile: stacked cards — the table below is unusable at narrow widths */}
      <ul className="space-y-3 sm:hidden">
        {items.map((item) => (
          <li key={item.id} className="dotted-frame bg-card p-3.5">
            <div className="flex items-start justify-between gap-3">
              <input
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-display text-base font-bold text-espresso focus:border-moka/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
              <AvailabilityToggle
                available={item.available}
                onChange={(v) => updateItem(item.id, { available: v })}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {item.sizes.map((s) => (
                <label
                  key={s.size}
                  className="flex items-center gap-1.5 rounded-xl border border-moka/25 bg-paper/70 px-2.5 py-2"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-moka">
                    {s.size === "single" ? "Price" : s.size}
                  </span>
                  <span className="num text-moka">₱</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={s.price}
                    onChange={(e) =>
                      updateSizePrice(item.id, s.size, Number(e.target.value) || 0)
                    }
                    className="num w-14 bg-transparent text-right font-bold text-espresso focus:outline-none"
                  />
                </label>
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <BestSellerToggle
                checked={!!item.bestSeller}
                onChange={(v) => updateItem(item.id, { bestSeller: v })}
              />
              <button
                onClick={() => removeItem(item.id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-rust/10 hover:text-rust active:scale-90"
                aria-label="Remove item"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop / tablet: dense table */}
      <div className="dotted-frame hidden overflow-hidden bg-card sm:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-[11px] uppercase tracking-wider text-moka">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Sizes & Prices (₱)</th>
              <th className="px-4 py-2">Best Seller</th>
              <th className="px-4 py-2 text-right">Available</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-moka/15 transition-colors hover:bg-secondary/20">
                <td className="px-4 py-3">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-semibold text-espresso focus:border-moka/40 focus:outline-none focus:ring-1 focus:ring-terracotta/40"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {item.sizes.map((s) => (
                      <label key={s.size} className="flex items-center gap-1.5">
                        <span className="text-[11px] uppercase tracking-wider text-moka">
                          {s.size}
                        </span>
                        <input
                          type="number"
                          value={s.price}
                          onChange={(e) =>
                            updateSizePrice(item.id, s.size, Number(e.target.value) || 0)
                          }
                          className="num w-20 rounded-md border border-moka/30 bg-paper px-2 py-1 text-right font-bold text-espresso focus:border-terracotta focus:outline-none"
                        />
                        <span className="num text-[11px] text-moka">
                          ({peso(s.price)})
                        </span>
                      </label>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={!!item.bestSeller}
                    onChange={(e) => updateItem(item.id, { bestSeller: e.target.checked })}
                    className="h-4 w-4 accent-[color:var(--color-gold)]"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <AvailabilityToggle
                    available={item.available}
                    onChange={(v) => updateItem(item.id, { available: v })}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="grid h-8 w-8 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-rust/10 hover:text-rust active:scale-90"
                    aria-label="Remove item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
