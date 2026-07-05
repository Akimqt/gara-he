import { Link, useRouterState } from "@tanstack/react-router";
import {
  ShoppingBag,
  CalendarClock,
  History,
  UtensilsCrossed,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Register", icon: ShoppingBag },
  { to: "/today", label: "Today", icon: CalendarClock },
  { to: "/history", label: "History", icon: History },
  { to: "/admin", label: "Menu", icon: UtensilsCrossed },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-moka/25 bg-paper/80 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70 [padding-top:env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
        <Link
          to="/"
          className="press flex shrink-0 items-baseline gap-3 rounded-lg px-1"
        >
          <span className="font-display text-2xl font-black leading-none text-terracotta sm:text-3xl">
            GARA<span className="text-espresso">-</span>HE
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.25em] text-moka md:inline">
            コーヒー &amp; ペストリー
          </span>
        </Link>

        <nav className="no-scrollbar ml-auto flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-moka/25 bg-card/80 p-1 shadow-inset-soft backdrop-blur">
          {links.map((l) => {
            const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "group relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium ease-spring active:scale-[0.94] sm:px-4 sm:py-2",
                  active
                    ? "bg-terracotta text-primary-foreground shadow-warm"
                    : "text-moka hover:-translate-y-px hover:bg-moka/10 hover:text-espresso",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200 ease-spring",
                    "group-hover:scale-110 group-active:scale-95",
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
