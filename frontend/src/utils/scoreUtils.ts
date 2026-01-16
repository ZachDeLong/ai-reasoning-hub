/**
 * Gets earthy color class based on the score
 */
export const getScoreColor = (s: number): string => {
  if (s >= 7) return "text-teal-700 dark:text-teal-400";
  if (s >= 6) return "text-emerald-700 dark:text-emerald-400";
  if (s >= 5) return "text-green-700 dark:text-green-400";
  if (s >= 4) return "text-amber-700 dark:text-amber-400";
  if (s >= 3) return "text-orange-700 dark:text-orange-400";
  if (s >= 2) return "text-rose-700 dark:text-rose-400";
  return "text-stone-400 dark:text-stone-500";
};

export interface ScoreBreakdown {
  Novelty?: number;
  Utility?: number;
  Impact?: number;
  Results?: number;
  Access?: number;
  [key: string]: number | undefined;
}

/**
 * Parses the breakdown string "Novelty: 3, Impact: 4" into an object
 */
export const parseBreakdown = (breakdown: string | null | undefined): ScoreBreakdown => {
  const parts: ScoreBreakdown = {};
  if (!breakdown) return parts;

  breakdown.split(",").forEach(kv => {
    if (kv.includes(":")) {
      const [k, v] = kv.split(":");
      try {
        parts[k.trim()] = parseInt(v.trim(), 10);
      } catch {
        parts[k.trim()] = 0;
      }
    }
  });
  return parts;
};
