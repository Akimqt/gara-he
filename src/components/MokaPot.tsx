export function MokaPot({
  className = "",
  animated = false,
  happy = false,
}: {
  className?: string;
  /** Loop a subtle steam wisp for idle/empty states. */
  animated?: boolean;
  /** Play a one-shot happy bounce (e.g. after a completed sale). */
  happy?: boolean;
}) {
  return (
    <svg
      viewBox="-20 -20 160 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[className, happy && "animate-pot-happy"].filter(Boolean).join(" ")}
      aria-hidden
      style={{ overflow: "visible" }}
    >
      {/* Lid */}
      <path d="M40 22 L80 22 L82 30 L38 30 Z" />
      {/* Knob */}
      <circle cx="60" cy="16" r="5" />
      <line x1="60" y1="11" x2="60" y2="6" />
      {/* Top chamber */}
      <path d="M34 30 L86 30 L82 66 L38 66 Z" />
      {/* Spout */}
      <path d="M82 40 L96 36 L94 46 L82 48" />
      {/* Middle band */}
      <path d="M30 66 L90 66 L92 74 L28 74 Z" />
      {/* Handle */}
      <path d="M92 74 C 112 78, 112 108, 92 112" />
      <path d="M92 84 C 104 88, 104 102, 92 104" />
      {/* Bottom chamber */}
      <path d="M32 74 L88 74 L82 132 L38 132 Z" />
      {/* Base */}
      <path d="M36 132 L84 132 L80 140 L40 140 Z" />

      {/* Steam — primary wisps */}
      <g className={animated || happy ? "animate-steam" : ""} style={{ transformOrigin: "60px 4px" }}>
        <path d="M52 4 C 48 -2, 56 -6, 52 -12" opacity=".55" />
        <path d="M68 4 C 72 -2, 64 -6, 68 -12" opacity=".55" />
        <path d="M60 2 C 56 -4, 64 -8, 60 -14" opacity=".45" />
      </g>

      {/* Secondary ambient wisps — fire alongside on happy, offset for depth. */}
      {happy && (
        <>
          <g
            className="animate-steam"
            style={{ transformOrigin: "45px 4px", animationDelay: "120ms", animationDuration: "2000ms" }}
          >
            <path d="M44 6 C 40 0, 48 -4, 44 -10" opacity=".35" strokeWidth="1.6" />
          </g>
          <g
            className="animate-steam"
            style={{ transformOrigin: "76px 4px", animationDelay: "260ms", animationDuration: "2200ms" }}
          >
            <path d="M76 6 C 80 0, 72 -4, 76 -10" opacity=".35" strokeWidth="1.6" />
          </g>

          {/* Celebratory sparkles — tiny stars that pop alongside the bounce. */}
          <g className="animate-sparkle-pop" style={{ transformOrigin: "22px 40px", animationDelay: "120ms" }}>
            <path
              d="M22 34 L23.2 39 L28 40 L23.2 41 L22 46 L20.8 41 L16 40 L20.8 39 Z"
              fill="currentColor"
              stroke="none"
              opacity=".7"
            />
          </g>
          <g className="animate-sparkle-pop" style={{ transformOrigin: "104px 56px", animationDelay: "220ms" }}>
            <path
              d="M104 50 L105 54 L109 55 L105 56 L104 60 L103 56 L99 55 L103 54 Z"
              fill="currentColor"
              stroke="none"
              opacity=".65"
            />
          </g>
          <g className="animate-sparkle-pop" style={{ transformOrigin: "16px 96px", animationDelay: "320ms" }}>
            <circle cx="16" cy="96" r="2.2" fill="currentColor" stroke="none" opacity=".55" />
          </g>
          <g className="animate-sparkle-pop" style={{ transformOrigin: "110px 108px", animationDelay: "80ms" }}>
            <circle cx="110" cy="108" r="1.8" fill="currentColor" stroke="none" opacity=".55" />
          </g>
        </>
      )}
    </svg>
  );
}
