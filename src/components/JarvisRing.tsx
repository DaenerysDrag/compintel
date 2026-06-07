// JarvisRing — SVG-based ring inspired by the classic Iron Man J.A.R.V.I.S. HUD.
//
// Reference: Frontend/design-references/jarvis-classic.jpeg
// Signature elements:
//   - Concentric broken-arc rings (NOT full circles)
//   - Thin radial tick marks around the outer ring
//   - One yellow indicator arc that rotates around the ring
//   - Wide-spaced uppercase text in the center
//   - Subtle glow + 3D shading on the main ring

import { motion } from "framer-motion";
import { type ReactNode, useMemo } from "react";
import Lottie from "lottie-react";

interface JarvisRingProps {
  active: boolean;
  failed: boolean;
  centerLabel: string;
  centerDetail?: string;
  /** When true, adds an orange/yellow particle-burst overlay (Image-2 inspired, for Part 3) */
  burstMode?: boolean;
  /** Optional Lottie JSON to render inside the ring, behind the text */
  lottieData?: object;
  /** Size of the SVG. Default 280. */
  size?: number;
}

// ── Tick-mark generator ────────────────────────────────────────────────────────

function TickMarks({ count, inner, outer, color, strong = false }: {
  count: number;
  inner: number;
  outer: number;
  color: string;
  strong?: boolean;
}) {
  // Generate `count` lines arrayed radially from `inner` to `outer` radius.
  // Every 5th tick is brighter (clock-face style).
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360 - 90;
        const rad = (angle * Math.PI) / 180;
        const x1 = 150 + inner * Math.cos(rad);
        const y1 = 150 + inner * Math.sin(rad);
        const x2 = 150 + outer * Math.cos(rad);
        const y2 = 150 + outer * Math.sin(rad);
        const isMajor = i % 5 === 0;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={isMajor ? 1.6 : 0.8}
            opacity={strong ? (isMajor ? 0.9 : 0.5) : isMajor ? 0.55 : 0.25}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

// ── Broken-arc helper ──────────────────────────────────────────────────────────
// Renders an arc that spans `startDeg` to `endDeg` of a circle at radius `r`.
function Arc({
  r,
  startDeg,
  endDeg,
  stroke,
  strokeWidth = 2,
  opacity = 1,
}: {
  r: number;
  startDeg: number;
  endDeg: number;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  const startRad = ((startDeg - 90) * Math.PI) / 180;
  const endRad = ((endDeg - 90) * Math.PI) / 180;
  const x1 = 150 + r * Math.cos(startRad);
  const y1 = 150 + r * Math.sin(startRad);
  const x2 = 150 + r * Math.cos(endRad);
  const y2 = 150 + r * Math.sin(endRad);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return (
    <path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      opacity={opacity}
      strokeLinecap="round"
    />
  );
}

// ── Compute-burst particles (Image 2 style) ───────────────────────────────────

function ComputeBurst({ active }: { active: boolean }) {
  // 24 radial streaks animating outward — inspired by the orange Vision-birth shot.
  const streaks = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => ({
        angle: (i / 24) * 360,
        delay: (i % 6) * 0.15,
        length: 60 + (i % 5) * 12,
      })),
    [],
  );

  if (!active) return null;

  return (
    <g opacity={0.85}>
      <defs>
        <radialGradient id="burstFalloff" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8c00" stopOpacity="0.0" />
          <stop offset="40%" stopColor="#ff8c00" stopOpacity="0.0" />
          <stop offset="60%" stopColor="#ffcc00" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ff8c00" stopOpacity="0.0" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="150" r="115" fill="url(#burstFalloff)" />
      {streaks.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180;
        const x1 = 150 + 75 * Math.cos(rad);
        const y1 = 150 + 75 * Math.sin(rad);
        const x2 = 150 + (75 + s.length) * Math.cos(rad);
        const y2 = 150 + (75 + s.length) * Math.sin(rad);
        return (
          <motion.line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#ffcc00"
            strokeWidth={1.5}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{
              duration: 1.4,
              delay: s.delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        );
      })}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function JarvisRing({
  active,
  failed,
  centerLabel,
  centerDetail,
  burstMode = false,
  lottieData,
  size = 280,
}: JarvisRingProps) {
  const primary = failed ? "#ff4444" : "#00c8ff";
  const accent  = "#ffcc00"; // yellow indicator — fixed regardless of state
  const dim     = failed ? "#ff444466" : "#00c8ff44";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Optional Lottie animation as background centerpiece */}
      {lottieData && (
        <div
          className="absolute pointer-events-none opacity-60"
          style={{ width: size * 0.7, height: size * 0.7 }}
        >
          <Lottie animationData={lottieData} loop autoplay />
        </div>
      )}

      <svg
        viewBox="0 0 300 300"
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ overflow: "visible" }}
      >
        {/* Glow filter */}
        <defs>
          <filter id="jarvis-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="mainRingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={primary} stopOpacity="0.9" />
            <stop offset="50%" stopColor={primary} stopOpacity="0.5" />
            <stop offset="100%" stopColor={primary} stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Compute burst — only when Part 3 is active */}
        <ComputeBurst active={burstMode && active} />

        {/* ── Outermost faint full ring ─────────────────────────────────────── */}
        <circle cx="150" cy="150" r="135" fill="none" stroke={dim} strokeWidth="0.5" />

        {/* ── Outer tick ring + the yellow indicator together — they share a
              rotation group so the yellow ALWAYS sits cleanly on the tick ring,
              not floating over the main thick cyan ring below. ──────────────── */}
        <motion.g
          animate={active ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 150px" }}
        >
          <TickMarks count={60} inner={126} outer={136} color={primary} />
          {/* Yellow indicator lives on the OUTER tick ring (r≈131) — not on the
              main thick cyan ring (r=108). Short bright arc + soft glow. */}
          <g filter="url(#jarvis-glow)">
            <Arc r={131} startDeg={-6} endDeg={6} stroke={accent} strokeWidth={5} opacity={0.95} />
            <Arc r={131} startDeg={-4} endDeg={4} stroke="#fff8c4" strokeWidth={2} opacity={0.9} />
          </g>
          {/* Two tiny "carrier" dots either side of the yellow indicator —
              matches the reference's bright dots near the indicator. */}
          <circle cx={150 + 131 * Math.cos((-18 - 90) * Math.PI / 180)}
                  cy={150 + 131 * Math.sin((-18 - 90) * Math.PI / 180)}
                  r="1.6" fill={accent} opacity="0.7" />
          <circle cx={150 + 131 * Math.cos(( 18 - 90) * Math.PI / 180)}
                  cy={150 + 131 * Math.sin(( 18 - 90) * Math.PI / 180)}
                  r="1.6" fill={accent} opacity="0.7" />
        </motion.g>

        {/* ── Main bright broken ring — counter-rotates slowly ──────────────── */}
        <motion.g
          animate={active ? { rotate: -360 } : { rotate: 0 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 150px" }}
          filter="url(#jarvis-glow)"
        >
          {/* Two large arcs with smaller gaps at top (354-6°) and bottom (174-186°) */}
          <Arc r={108} startDeg={8}   endDeg={172} stroke="url(#mainRingGrad)" strokeWidth={5} />
          <Arc r={108} startDeg={188} endDeg={352} stroke="url(#mainRingGrad)" strokeWidth={5} />
        </motion.g>

        {/* ── Inner mid ring with subtle ticks ──────────────────────────────── */}
        <motion.g
          animate={active ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 150px" }}
        >
          <circle cx="150" cy="150" r="86" fill="none" stroke={primary} strokeWidth="0.6" opacity="0.5" />
          <TickMarks count={36} inner={78} outer={84} color={primary} strong />
        </motion.g>

        {/* ── Innermost broken arc ──────────────────────────────────────────── */}
        <motion.g
          animate={active ? { rotate: -360 } : { rotate: 0 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "150px 150px" }}
        >
          <Arc r={62} startDeg={20} endDeg={160}  stroke={primary} strokeWidth={1.5} opacity={0.7} />
          <Arc r={62} startDeg={200} endDeg={340} stroke={primary} strokeWidth={1.5} opacity={0.7} />
        </motion.g>

        {/* ── Pulsing innermost ring ────────────────────────────────────────── */}
        <motion.circle
          cx="150"
          cy="150"
          r="48"
          fill="none"
          stroke={primary}
          strokeWidth="0.5"
          animate={active ? { opacity: [0.3, 0.8, 0.3], r: [48, 50, 48] } : { opacity: 0.3 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>

      {/* ── Center text overlay ─────────────────────────────────────────────── */}
      <div className="relative z-10 text-center px-6 select-none pointer-events-none">
        <div
          className="text-[9px] font-mono tracking-[5px] mb-1"
          style={{ color: failed ? "#ff4444" : burstMode ? "#ffcc00" : "#6a8aaa" }}
        >
          {failed ? "● FAILED" : burstMode ? "● COMPUTING" : active ? "● ACTIVE" : "○ IDLE"}
        </div>
        <div
          className="font-bold leading-tight"
          style={{
            color: failed ? "#ff4444" : "#ffffff",
            fontSize: centerLabel.length > 12 ? "13px" : "16px",
            letterSpacing: centerLabel.length > 12 ? "1px" : "3px",
            textShadow: active ? `0 0 8px ${primary}99` : "none",
          }}
        >
          {centerLabel.toUpperCase()}
        </div>
        {centerDetail && (
          <div className="text-[10px] mt-2 text-text-dim max-w-[160px] mx-auto line-clamp-2 font-mono tracking-wide">
            {centerDetail}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper type re-export so consumers can pass children if they ever wrap us
export type { ReactNode };
