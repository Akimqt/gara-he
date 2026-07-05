import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Star, X, Minus, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { type MenuItem, type Size } from "@/lib/menu-data";
import { useMenu, useSales, useSettings, useCategories, type CartLine, type Sale, type PaymentMethod } from "@/lib/pos-store";
import { peso, pesoDec, timeLabel, sanitizeAmountInput } from "@/lib/format";
import { MokaPot } from "@/components/MokaPot";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: RegisterPage,
});

function sizeLabel(s: Size) {
  return s === "single" ? "" : s;
}

function RegisterPage() {
  const { menu } = useMenu();
  const { addSale } = useSales();
  const { settings } = useSettings();
  const { categories } = useCategories();
  const isMobile = useIsMobile();

  const [activeCat, setActiveCat] = useState<string>(categories[0]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState<string>("");
  const [sizePickerFor, setSizePickerFor] = useState<MenuItem | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [addFlash, setAddFlash] = useState<string | null>(null);
  const [ripple, setRipple] = useState<{ id: string; x: number; y: number; ts: number } | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [chargeSuccess, setChargeSuccess] = useState(false);
  const [tearingOff, setTearingOff] = useState(false);

  // Keep the active tab valid if categories change underneath it (e.g. the
  // currently selected category was removed in Admin, or this is the very
  // first render before categories load from storage).
  useEffect(() => {
    if (categories.length === 0) return;
    if (!categories.includes(activeCat)) setActiveCat(categories[0]);
  }, [categories, activeCat]);

  const items = useMemo(
    () => menu.filter((m) => m.category === activeCat),
    [menu, activeCat],
  );

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  // Senior/PWD discount applies only to the specific unit(s) marked as the
  // senior/PWD's own item — not the whole line and not the whole order.
  const discountableAmount = cart.reduce(
    (s, l) => s + l.unitPrice * Math.min(l.discountedQty ?? 0, l.qty),
    0,
  );
  const discountPct = discountableAmount > 0 ? settings.seniorDiscountPct : 0;
  const discountAmount = Math.round((discountableAmount * discountPct) / 100);
  const total = subtotal - discountAmount;
  const cashReceived = paymentMethod === "gcash" ? total : Number(cashInput) || 0;
  const change = paymentMethod === "gcash" ? 0 : cashReceived - total;
  const cartCount = cart.reduce((n, l) => n + l.qty, 0);

  function addToCart(item: MenuItem, size: Size, price: number) {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (l) => l.itemId === item.id && l.size === size && !removingIds.has(l.id),
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], qty: next[existingIdx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          id: `${item.id}-${size}-${Date.now()}`,
          itemId: item.id,
          name: item.name,
          size,
          unitPrice: price,
          qty: 1,
          discountedQty: 0,
        },
      ];
    });
    setAddFlash(item.id);
    setTimeout(() => setAddFlash((f) => (f === item.id ? null : f)), 260);
  }

  function handleItemTap(item: MenuItem, e?: React.MouseEvent<HTMLButtonElement>) {
    if (!item.available) return;
    if (e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setRipple({
        id: item.id,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        ts: Date.now(),
      });
      setTimeout(() => setRipple((r) => (r?.id === item.id ? null : r)), 500);
    }
    if (item.sizes.length === 1) {
      addToCart(item, item.sizes[0].size, item.sizes[0].price);
    } else {
      setSizePickerFor(item);
    }
  }

  function updateQty(lineId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.id === lineId
            ? {
                ...l,
                qty: l.qty + delta,
                discountedQty: Math.min(l.discountedQty ?? 0, l.qty + delta),
              }
            : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  function setLineDiscountQty(lineId: string, delta: number) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next = Math.max(0, Math.min(l.qty, (l.discountedQty ?? 0) + delta));
        return { ...l, discountedQty: next };
      }),
    );
  }

  function removeLine(lineId: string) {
    setRemovingIds((s) => {
      const n = new Set(s);
      n.add(lineId);
      return n;
    });
    setTimeout(() => {
      setCart((prev) => prev.filter((l) => l.id !== lineId));
      setRemovingIds((s) => {
        const n = new Set(s);
        n.delete(lineId);
        return n;
      });
    }, 220);
  }

  function clearOrder() {
    setCart([]);
    setCashInput("");
    setPaymentMethod("cash");
  }

  // Handler for the manual "Clear" button in the order panel. Unlike the
  // automatic reset after a successful charge, a mis-tap here would wipe a
  // fully-built order with zero recourse — so confirm first.
  function requestClearOrder() {
    if (cart.length === 0) return;
    const count = cartCount;
    if (
      !confirm(
        `Clear this order? ${count} item${count === 1 ? "" : "s"} (${peso(subtotal)}) will be removed.`,
      )
    ) {
      return;
    }
    clearOrder();
  }

  function charge() {
    if (cart.length === 0 || cashReceived < total || tearingOff) return;
    const sale: Sale = {
      id: `sale-${Date.now()}`,
      timestamp: Date.now(),
      lines: cart,
      subtotal,
      discountPct,
      discountAmount,
      total,
      paymentMethod,
      cashReceived,
      change,
    };
    addSale(sale);
    setChargeSuccess(true);
    setTearingOff(true);
    // Reset order after the tear-off finishes; show the receipt modal.
    setTimeout(() => {
      setLastSale(sale);
      clearOrder();
      setTearingOff(false);
      setChargeSuccess(false);
      if (isMobile) setMobileSheetOpen(false);
    }, 780);
  }

  const orderPanelProps = {
    cart,
    subtotal,
    discountPct,
    seniorPct: settings.seniorDiscountPct,
    discountAmount,
    total,
    onToggleLineDiscount: setLineDiscountQty,
    paymentMethod,
    onPaymentMethodChange: setPaymentMethod,
    cashInput,
    onCashChange: setCashInput,
    change,
    cashReceived,
    onUpdateQty: updateQty,
    onRemove: removeLine,
    onClear: requestClearOrder,
    onCharge: charge,
    removingIds,
    chargeSuccess,
    tearingOff,
  };

  return (
    <div
      className={cn(
        "mx-auto grid max-w-[1600px] gap-5 px-4 sm:px-5 py-4 sm:py-5",
        "grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_420px]",
        isMobile && "pb-24",
      )}
    >
      {/* Item grid */}
      <section className="dotted-frame min-w-0 bg-card/50 p-3 sm:p-5">
        <CategoryTabs
          categories={categories}
          active={activeCat}
          onChange={setActiveCat}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              flash={addFlash === item.id}
              ripple={ripple && ripple.id === item.id ? ripple : null}
              onTap={(e) => handleItemTap(item, e)}
            />
          ))}
        </div>
      </section>

      {/* Desktop / tablet order panel */}
      {!isMobile && <OrderPanel {...orderPanelProps} />}

      {/* Mobile bottom bar + drawer */}
      {isMobile && (
        <>
          <MobileBottomBar
            count={cartCount}
            total={total}
            onOpen={() => setMobileSheetOpen(true)}
          />
          <Drawer open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <DrawerContent
              className={cn(
                "max-h-[92vh] border-0 bg-paper p-0",
                "rounded-t-3xl shadow-warm-lg",
              )}
            >
              <DrawerTitle className="sr-only">Current order</DrawerTitle>
              <div className="flex justify-center pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-moka/30" aria-hidden />
              </div>
              <div className="receipt-perf mx-4 mt-2.5" />
              <div className="max-h-[86vh] overflow-y-auto px-3 pb-6 pt-2">
                <OrderPanel {...orderPanelProps} embedded />
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}

      {/* Size picker modal */}
      {sizePickerFor && (
        <SizePicker
          item={sizePickerFor}
          onPick={(size, price) => {
            addToCart(sizePickerFor, size, price);
            setSizePickerFor(null);
          }}
          onClose={() => setSizePickerFor(null)}
        />
      )}

      {/* Receipt modal */}
      {lastSale && <ReceiptModal sale={lastSale} onClose={() => setLastSale(null)} />}
    </div>
  );
}

function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (c: string) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const el = refs.current[active];
    if (!el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth });
    // Ensure the active tab is visible on the horizontal scroll strip (mobile).
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [active, categories]);

  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-3 mb-4 bg-card/70 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:pb-3 sm:backdrop-blur-0",
      )}
    >
      <div className="no-scrollbar relative flex gap-1.5 overflow-x-auto">
        {pill && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 my-auto h-10 rounded-full bg-terracotta shadow-warm ease-spring sm:h-8"
            style={{
              left: pill.left,
              width: pill.width,
              transition: "left 320ms cubic-bezier(0.34, 1.35, 0.5, 1), width 320ms cubic-bezier(0.34, 1.35, 0.5, 1)",
            }}
          />
        )}
        {categories.map((c) => {
          const isActive = c === active;
          return (
            <button
              key={c}
              ref={(el) => {
                refs.current[c] = el;
              }}
              onClick={() => onChange(c)}
              className={cn(
                "relative z-10 shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta active:scale-95 sm:py-2",
                isActive
                  ? "text-primary-foreground"
                  : "text-moka hover:text-espresso",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  flash,
  ripple,
  onTap,
}: {
  item: MenuItem;
  flash: boolean;
  ripple: { x: number; y: number; ts: number } | null;
  onTap: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const startingPrice = item.sizes[0].price;
  const priceRange =
    item.sizes.length > 1
      ? `${peso(startingPrice)}–${peso(item.sizes[item.sizes.length - 1].price)}`
      : peso(startingPrice);

  return (
    <button
      onClick={onTap}
      disabled={!item.available}
      className={cn(
        "group relative flex min-h-32 flex-col justify-between gap-2 overflow-hidden rounded-2xl border border-moka/20 bg-card p-2.5 text-left shadow-warm transition-all duration-200 ease-spring focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta sm:p-3",
        item.available
          ? "hover:-translate-y-0.5 hover:border-terracotta/60 hover:shadow-warm-hover active:scale-[0.97]"
          : "soldout-diag cursor-not-allowed opacity-60",
        flash && "animate-card-press",
      )}
    >
      {/* Terracotta ripple from tap point */}
      {ripple && item.available && (
        <span
          key={ripple.ts}
          aria-hidden
          className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-terracotta/35 animate-ripple"
          style={{ left: ripple.x, top: ripple.y }}
        />
      )}

      {item.bestSeller && (
        <span className="absolute right-2 top-2 flex items-center gap-1 overflow-hidden rounded-full bg-gold/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-espresso shadow">
          <Star className="h-3 w-3 fill-espresso" strokeWidth={0} />
          Best
          {/* one-time shimmer sweep on first render */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-4 w-6 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-shimmer-once"
          />
        </span>
      )}

      {!item.available && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-2 border-rust bg-paper/90 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-rust">
          Sold Out
        </span>
      )}

      <div className="pr-14">
        <p className="truncate text-[10px] uppercase tracking-wider text-moka sm:text-[11px]">
          {item.category}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-tight text-espresso sm:text-base">
          {item.name}
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-2">
        <span className="text-[11px] text-moka">
          {item.sizes.length > 1
            ? item.sizes.map((s) => s.size).join(" · ")
            : "Single"}
        </span>
        <span className="num whitespace-nowrap text-base font-bold text-terracotta sm:text-lg">
          {priceRange}
        </span>
      </div>
    </button>
  );
}

function SizePicker({
  item,
  onPick,
  onClose,
}: {
  item: MenuItem;
  onPick: (size: Size, price: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Size | null>(null);
  const selectedEntry = item.sizes.find((s) => s.size === selected) ?? null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-sm animate-fade-up"
      onClick={onClose}
    >
      <div
        className="dotted-frame w-full max-w-sm bg-paper p-6 shadow-warm-lg animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-wider text-moka">Choose size</p>
        <h3 className="mb-4 font-display text-2xl font-bold text-espresso">{item.name}</h3>
        <div className="grid gap-2">
          {item.sizes.map((s) => {
            const isSelected = s.size === selected;
            return (
              <button
                key={s.size}
                onClick={() => setSelected(s.size)}
                aria-pressed={isSelected}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200 ease-spring focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta",
                  isSelected
                    ? "border-terracotta bg-terracotta text-primary-foreground shadow-warm-hover"
                    : "border-moka/30 bg-card hover:-translate-y-0.5 hover:border-terracotta/60 hover:shadow-warm",
                )}
              >
                <span className="font-semibold">{s.size}</span>
                <span className="num text-lg font-bold">{peso(s.price)}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => selectedEntry && onPick(selectedEntry.size, selectedEntry.price)}
          disabled={!selectedEntry}
          className={cn(
            "mt-4 w-full rounded-2xl py-3 text-sm font-bold uppercase tracking-wide transition-all ease-spring",
            selectedEntry
              ? "bg-terracotta text-primary-foreground shadow-warm hover:brightness-110 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          Add to Order{selectedEntry && ` — ${peso(selectedEntry.price)}`}
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-2xl border border-moka/30 py-2 text-sm text-moka transition-colors hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function MobileBottomBar({
  count,
  total,
  onOpen,
}: {
  count: number;
  total: number;
  onOpen: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-terracotta/40 bg-terracotta text-primary-foreground shadow-warm-lg [padding-bottom:env(safe-area-inset-bottom)]">
      <button
        onClick={onOpen}
        disabled={count === 0}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-transform ease-spring",
          count > 0 ? "active:scale-[0.99]" : "opacity-70",
        )}
        style={{ minHeight: 60 }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingBag className="h-5 w-5" />
          {count === 0 ? "0 items" : `${count} item${count === 1 ? "" : "s"}`}
        </span>
        <span className="flex items-center gap-3">
          <AnimatedTotal
            value={total}
            className="num text-xl font-black tracking-tight text-primary-foreground"
          />
          <span className="rounded-full bg-espresso/25 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            View Order
          </span>
        </span>
      </button>
    </div>
  );
}

function AnimatedTotal({ value, className = "" }: { value: number; className?: string }) {
  // Re-key on value change to replay the tick animation.
  return (
    <span className={cn("inline-block", className)}>
      <span key={value} className="inline-block animate-tick">
        {pesoDec(value)}
      </span>
    </span>
  );
}

function OrderPanel(props: {
  cart: CartLine[];
  subtotal: number;
  discountPct: number;
  seniorPct: number;
  discountAmount: number;
  total: number;
  onToggleLineDiscount: (lineId: string, delta: number) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  cashInput: string;
  onCashChange: (v: string) => void;
  change: number;
  cashReceived: number;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCharge: () => void;
  removingIds: Set<string>;
  chargeSuccess: boolean;
  tearingOff: boolean;
  embedded?: boolean;
}) {
  const {
    cart, subtotal, discountPct, seniorPct, discountAmount, total,
    onToggleLineDiscount, paymentMethod, onPaymentMethodChange,
    cashInput, onCashChange, change, cashReceived,
    onUpdateQty, onRemove, onClear, onCharge, removingIds, chargeSuccess, tearingOff, embedded,
  } = props;

  const canCharge = cart.length > 0 && cashReceived >= total && !tearingOff && !chargeSuccess;

  const quickCash = [
    { label: "Exact", value: total },
    { label: "₱100", value: 100 },
    { label: "₱200", value: 200 },
    { label: "₱500", value: 500 },
    { label: "₱1000", value: 1000 },
  ];

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-card p-4",
        embedded
          ? "rounded-none border-0 shadow-none"
          : "dotted-frame max-h-[calc(100vh-6rem)] shadow-warm lg:sticky lg:top-4",
        tearingOff && "animate-tear-off",
      )}
    >
      {/* Success sweep overlay */}
      {chargeSuccess && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]">
          <div className="absolute inset-y-0 -left-full w-full bg-sage/45 animate-success-sweep" />
          <Sparkles className="absolute right-6 top-6 h-5 w-5 text-gold animate-pop" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-xl font-bold text-espresso">
          Order
          {cart.length > 0 && (
            <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
          )}
        </h2>
        {cart.length > 0 && (
          <button
            onClick={onClear}
            className="-m-2 rounded-lg p-2 text-xs uppercase tracking-wider text-moka transition-all hover:bg-rust/10 hover:text-rust active:scale-95"
          >
            Clear
          </button>
        )}
      </div>
      <div className="receipt-perf my-3" />

      {/* Lines */}
      <div className="min-h-[120px] flex-1 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center text-moka">
            <MokaPot
              className="h-24 w-24 text-moka opacity-70"
              animated={!chargeSuccess}
              happy={chargeSuccess}
            />
            <p className="mt-3 font-display text-lg">Ready for the next order</p>
            <p className="mt-1 text-xs">Tap an item to begin</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cart.map((l) => {
              const removing = removingIds.has(l.id);
              return (
              <li
                key={l.id}
                className={cn(
                  "overflow-hidden rounded-xl border px-3 py-2 shadow-warm transition-all duration-200 ease-spring",
                  (l.discountedQty ?? 0) > 0
                    ? "border-sage/60 bg-sage/10"
                    : "border-moka/20 bg-paper/60",
                  !removing && "animate-line-in",
                  removing && "!my-0 max-h-0 !border-transparent !p-0 opacity-0",
                )}
                style={{ maxHeight: removing ? 0 : 220 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-espresso">{l.name}</p>
                    <p className="text-xs text-moka">
                      {sizeLabel(l.size) || "single"} · <span className="num">{peso(l.unitPrice)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(l.id)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-rust/10 hover:text-rust active:scale-90"
                    aria-label="Remove line"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-0.5 rounded-full border border-moka/25 bg-paper p-0.5">
                    <button
                      onClick={() => onUpdateQty(l.id, -1)}
                      className="grid h-9 w-9 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-terracotta/10 hover:text-terracotta active:scale-90"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span
                      key={l.qty}
                      className="num inline-block w-6 text-center font-bold text-espresso animate-tick"
                    >
                      {l.qty}
                    </span>
                    <button
                      onClick={() => onUpdateQty(l.id, 1)}
                      className="grid h-9 w-9 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-terracotta/10 hover:text-terracotta active:scale-90"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="num font-bold text-espresso">
                    <span key={l.unitPrice * l.qty} className="inline-block animate-tick">
                      {peso(l.unitPrice * l.qty)}
                    </span>
                  </span>
                </div>

                {/* Per-unit senior/PWD discount — only the marked unit(s)
                    within this line get the discount, e.g. 1 of 2 same drinks. */}
                <div
                  className={cn(
                    "mt-1.5 flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    (l.discountedQty ?? 0) > 0
                      ? "border-sage/60 bg-sage/20 text-espresso"
                      : "border-moka/20 bg-paper text-moka",
                  )}
                >
                  <span>
                    Senior/PWD {seniorPct > 0 && `(${seniorPct}%)`}
                    {(l.discountedQty ?? 0) > 0 && (
                      <span className="ml-1 text-sage">
                        · {l.discountedQty}/{l.qty}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleLineDiscount(l.id, -1)}
                      disabled={(l.discountedQty ?? 0) <= 0}
                      className="grid h-7 w-7 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-terracotta/10 hover:text-terracotta active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Remove one discounted unit"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="num w-4 text-center">{l.discountedQty ?? 0}</span>
                    <button
                      onClick={() => onToggleLineDiscount(l.id, 1)}
                      disabled={(l.discountedQty ?? 0) >= l.qty}
                      className="grid h-7 w-7 place-items-center rounded-full text-moka transition-all ease-spring hover:bg-terracotta/10 hover:text-terracotta active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Add one discounted unit"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </li>
            );})}
          </ul>
        )}
      </div>

      {/* Totals */}
      <div className="receipt-perf my-3" />
      <div className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={peso(subtotal)} />

        {discountAmount > 0 && (
          <Row
            label={`Senior/PWD Discount (${discountPct}%)`}
            value={`− ${peso(discountAmount)}`}
            className="text-sage"
          />
        )}
        {cart.length > 0 && discountAmount === 0 && (
          <p className="px-1 text-[11px] text-moka">
            Use the Senior/PWD +/- on a line to discount just that person's item.
          </p>
        )}
      </div>

      <div className="mt-3 border-t-4 border-double border-espresso/70 pt-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-lg font-bold text-espresso">TOTAL</span>
          <span className="num overflow-hidden text-2xl font-black text-espresso">
            <span key={total} className="inline-block animate-tick">{pesoDec(total)}</span>
          </span>
        </div>
      </div>

      {/* Payment method */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onPaymentMethodChange("cash")}
          className={cn(
            "rounded-xl border py-2.5 text-sm font-bold uppercase tracking-wide transition-all ease-spring",
            paymentMethod === "cash"
              ? "border-terracotta bg-terracotta text-primary-foreground shadow-warm"
              : "border-moka/25 bg-paper text-moka hover:border-terracotta/50",
          )}
        >
          Cash
        </button>
        <button
          onClick={() => onPaymentMethodChange("gcash")}
          className={cn(
            "rounded-xl border py-2.5 text-sm font-bold uppercase tracking-wide transition-all ease-spring",
            paymentMethod === "gcash"
              ? "border-sky-500 bg-sky-500 text-white shadow-warm"
              : "border-moka/25 bg-paper text-moka hover:border-sky-400/60",
          )}
        >
          GCash
        </button>
      </div>

      {/* Cash tender — only relevant when paying with cash */}
      {paymentMethod === "cash" ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] uppercase tracking-wider text-moka">
            Cash Received
          </label>
          <input
            inputMode="decimal"
            value={cashInput}
            onChange={(e) => onCashChange(sanitizeAmountInput(e.target.value))}
            placeholder="0"
            className="num w-full rounded-xl border border-moka/40 bg-paper px-3 py-3 text-right text-xl font-bold text-espresso transition-colors focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          />
          <div className="grid grid-cols-5 gap-1.5">
            {quickCash.map((q) => (
              <button
                key={q.label}
                onClick={() => onCashChange(String(q.value))}
                className="rounded-full border border-moka/25 bg-paper py-2 text-xs font-semibold text-moka transition-all ease-spring hover:-translate-y-0.5 hover:border-terracotta hover:text-terracotta hover:shadow-warm active:scale-95"
              >
                {q.label}
              </button>
            ))}
          </div>
          <div
            className={cn(
              "flex items-baseline justify-between rounded-xl px-3 py-2 transition-colors",
              change >= 0 && cashReceived > 0 && cart.length > 0
                ? "bg-sage/15"
                : "",
            )}
          >
            <span className="text-sm font-semibold text-moka">Change</span>
            <span
              className={cn(
                "num text-2xl font-black",
                change < 0 ? "text-rust" : "text-espresso",
              )}
            >
              <span key={Math.max(0, change)} className="inline-block animate-tick">
                {pesoDec(Math.max(0, change))}
              </span>
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3">
          <span className="text-sm font-semibold text-espresso">Paid via GCash</span>
          <span className="num text-lg font-black text-espresso">{pesoDec(total)}</span>
        </div>
      )}

      <button
        onClick={onCharge}
        disabled={!canCharge}
        className={cn(
          "mt-3 w-full rounded-2xl py-4 font-display text-xl font-bold tracking-wide transition-all duration-200 ease-spring",
          canCharge
            ? "bg-terracotta text-primary-foreground shadow-warm-lg hover:-translate-y-0.5 hover:brightness-110 hover:shadow-warm-hover active:scale-[0.98]"
            : "cursor-not-allowed bg-muted text-muted-foreground",
        )}
        style={{ minHeight: 56 }}
      >
        Charge {cart.length > 0 && <span className="num">{pesoDec(total)}</span>}
      </button>
    </aside>
  );
}




function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between px-1", className)}>
      <span className="text-moka">{label}</span>
      <span className="num font-semibold">{value}</span>
    </div>
  );
}

function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-paper p-6 shadow-2xl"
        style={{
          clipPath:
            "polygon(0% 8px, 6% 0%, 12% 8px, 18% 0%, 24% 8px, 30% 0%, 36% 8px, 42% 0%, 48% 8px, 54% 0%, 60% 8px, 66% 0%, 72% 8px, 78% 0%, 84% 8px, 90% 0%, 96% 8px, 100% 0%, 100% calc(100% - 8px), 96% 100%, 90% calc(100% - 8px), 84% 100%, 78% calc(100% - 8px), 72% 100%, 66% calc(100% - 8px), 60% 100%, 54% calc(100% - 8px), 48% 100%, 42% calc(100% - 8px), 36% 100%, 30% calc(100% - 8px), 24% 100%, 18% calc(100% - 8px), 12% 100%, 6% calc(100% - 8px), 0% 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="font-display text-2xl font-black text-terracotta">GARA-HE</p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-moka">
            コーヒー &amp; ペストリー
          </p>
          <p className="mt-1 text-xs text-moka">{new Date(sale.timestamp).toLocaleString("en-PH")}</p>
        </div>
        <div className="receipt-perf my-3" />
        <ul className="space-y-1 text-sm">
          {sale.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-2 num">
              <span className="truncate font-sans text-espresso">
                {l.qty}× {l.name} {l.size !== "single" && `(${l.size})`}
              </span>
              <span className="text-espresso">{peso(l.unitPrice * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="receipt-perf my-3" />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between num"><span className="font-sans text-moka">Subtotal</span><span>{peso(sale.subtotal)}</span></div>
          {sale.discountAmount > 0 && (
            <div className="flex justify-between num text-sage">
              <span className="font-sans">Senior/PWD ({sale.discountPct}%)</span>
              <span>− {peso(sale.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-double border-espresso/60 pt-1 num text-lg font-bold text-espresso">
            <span className="font-sans">TOTAL</span><span>{pesoDec(sale.total)}</span>
          </div>
          <div className="flex justify-between num">
            <span className="font-sans text-moka">Payment</span>
            <span className="font-sans">{sale.paymentMethod === "gcash" ? "GCash" : "Cash"}</span>
          </div>
          {sale.paymentMethod === "cash" && (
            <>
              <div className="flex justify-between num"><span className="font-sans text-moka">Cash</span><span>{pesoDec(sale.cashReceived)}</span></div>
              <div className="flex justify-between num font-bold"><span className="font-sans">Change</span><span>{pesoDec(sale.change)}</span></div>
            </>
          )}
        </div>
        <div className="mt-4 text-center text-[10px] uppercase tracking-widest text-moka">
          Salamat! · Thank you
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-espresso py-3 font-semibold text-paper hover:brightness-110"
        >
          Next Order
        </button>
        <p className="mt-2 text-center text-[10px] text-moka">
          Saved {timeLabel(sale.timestamp)}
        </p>
      </div>
    </div>
  );
}
