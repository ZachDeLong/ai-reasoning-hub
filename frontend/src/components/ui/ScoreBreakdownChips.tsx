import type { FC } from 'react';
import { parseBreakdown } from '@/utils';

interface ScoreBreakdownChipsProps {
  breakdownString: string | null | undefined;
  compact?: boolean;
}

const BREAKDOWN_ITEMS = [
  { key: 'Novelty', label: 'N', max: 3, color: 'teal' },
  { key: 'Utility', label: 'U', max: 1, color: 'amber' },
  { key: 'Results', label: 'R', max: 2, color: 'emerald' },
  { key: 'Access', label: 'A', max: 1, color: 'blue' },
] as const;

const getColorClasses = (color: string, filled: boolean): string => {
  if (!filled) return 'bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500';
  const colors: Record<string, string> = {
    teal: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400',
    amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  };
  return colors[color] || colors.teal;
};

export const ScoreBreakdownChips: FC<ScoreBreakdownChipsProps> = ({ breakdownString, compact = false }) => {
  const breakdown = parseBreakdown(breakdownString);
  // Handle both old ("Impact") and new ("Utility") field names
  if (breakdown.Impact !== undefined && breakdown.Utility === undefined) {
    breakdown.Utility = breakdown.Impact;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {BREAKDOWN_ITEMS.map(({ key, label, max, color }) => {
          const score = breakdown[key] || 0;
          const filled = score > 0;
          return (
            <span
              key={key}
              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${getColorClasses(color, filled)}`}
              title={`${key}: ${score}/${max}`}
            >
              {label}{score}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {BREAKDOWN_ITEMS.map(({ key, label: _, max, color }) => {
        const score = breakdown[key] || 0;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 w-12">{key}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: max }).map((__, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < score
                      ? getColorClasses(color, true).replace('text-', 'border-').split(' ')[0]
                      : 'bg-stone-200 dark:bg-stone-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-semibold text-stone-600 dark:text-stone-300">{score}/{max}</span>
          </div>
        );
      })}
    </div>
  );
};
