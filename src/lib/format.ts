export const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const pesoDec = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export const timeLabel = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

// Sanitizes a free-typed money amount as the user types: strips anything
// that isn't a digit or a decimal point, then collapses any decimal
// points after the first one. This means something like "12.34.56" can
// never actually be typed/pasted into the field in the first place —
// it becomes "12.3456" — instead of silently producing NaN (and a quiet
// fallback to ₱0) once it reaches `Number(...)`.
export function sanitizeAmountInput(raw: string): string {
  const digitsAndDots = raw.replace(/[^0-9.]/g, "");
  const firstDot = digitsAndDots.indexOf(".");
  if (firstDot === -1) return digitsAndDots;
  return (
    digitsAndDots.slice(0, firstDot + 1) +
    digitsAndDots.slice(firstDot + 1).replace(/\./g, "")
  );
}
