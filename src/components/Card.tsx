import { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  accent?: "cyan" | "green" | "yellow" | "orange" | "purple" | "red";
  className?: string;
  children: ReactNode;
}

const accentBorder = {
  cyan:   "border-cyan/30 shadow-glow-cyan",
  green:  "border-green/30 shadow-glow-green",
  yellow: "border-yellow/30 shadow-glow-yellow",
  orange: "border-orange/30",
  purple: "border-purple/30 shadow-glow-purple",
  red:    "border-red/30",
};

const accentText = {
  cyan:   "text-cyan",
  green:  "text-green",
  yellow: "text-yellow",
  orange: "text-orange",
  purple: "text-purple",
  red:    "text-red",
};

export function Card({ title, subtitle, accent, className = "", children }: CardProps) {
  const border = accent ? accentBorder[accent] : "border-cyan/15";
  return (
    <div className={`glass rounded-xl border ${border} p-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-baseline gap-3">
          <h3 className={`text-sm font-semibold ${accent ? accentText[accent] : "text-text"}`}>
            {title}
          </h3>
          {subtitle && (
            <span className="text-[11px] text-text-dim">{subtitle}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string | number;
  accent?: "cyan" | "green" | "yellow" | "red" | "default";
  sub?: string;
}

const statColor = {
  cyan: "text-cyan",
  green: "text-green",
  yellow: "text-yellow",
  red: "text-red",
  default: "text-white",
};

export function Stat({ label, value, accent = "default", sub }: StatProps) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">{label}</div>
      <div className={`text-2xl font-bold ${statColor[accent]}`}>{value}</div>
      {sub && <div className="text-[11px] text-text-dim mt-1">{sub}</div>}
    </div>
  );
}

export function Pill({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "green" | "yellow" | "red" | "cyan";
}) {
  const variants = {
    default: "border-white/10 text-text-dim bg-white/[0.02]",
    green:   "border-green/30 text-green bg-green/10",
    yellow:  "border-yellow/30 text-yellow bg-yellow/10",
    red:     "border-red/30 text-red bg-red/10",
    cyan:    "border-cyan/30 text-cyan bg-cyan/10",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${variants[variant]}`}>
      {children}
    </span>
  );
}
