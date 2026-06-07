// Centralized motion tokens so every animation in the app feels coherent.
// Use these instead of one-off durations/easings scattered across components.

import type { Transition } from "framer-motion";

// Default "snappy but soft" spring used for most enter/exit + hover lifts.
export const SPRING_SOFT: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.6,
};

// Tighter spring for indicators that should snap into place (tab indicator, etc.)
export const SPRING_SNAP: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 30,
  mass: 0.4,
};

// Slower spring for big celebratory moments (done state, milestone counters)
export const SPRING_LOOSE: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 0.9,
};

// Linear durations for rotations + repeating ticks (where springs don't apply)
export const ROTATE_SLOW   = { duration: 30, repeat: Infinity, ease: "linear" } as const;
export const ROTATE_MEDIUM = { duration: 22, repeat: Infinity, ease: "linear" } as const;
export const ROTATE_FAST   = { duration: 12, repeat: Infinity, ease: "linear" } as const;

// Standard quick fade — used when a spring would feel wrong (icons, opacity-only swaps)
export const FADE_QUICK: Transition = { duration: 0.18, ease: "easeOut" };
