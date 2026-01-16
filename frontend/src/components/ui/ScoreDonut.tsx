import type { FC } from 'react';
import { getScoreColor } from '@/utils';

interface ScoreDonutProps {
  score: number;
}

export const ScoreDonut: FC<ScoreDonutProps> = ({ score }) => {
  if (score === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <span className="text-3xl font-bold text-gray-400 dark:text-gray-500">—</span>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">N/A</span>
      </div>
    );
  }

  const colorClasses = getScoreColor(score);

  return (
    <div className={`flex flex-col items-center justify-center w-24 h-24 rounded-full border-8 bg-white dark:bg-gray-800 flex-shrink-0 ${colorClasses}`}>
      <span className="text-3xl font-bold">{score}</span>
      <span className="text-xs font-medium -mt-1">/ 7</span>
    </div>
  );
};
