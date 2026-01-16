import type { FC } from 'react';

interface SortOption {
  value: string;
  label: string;
}

interface SortToggleProps {
  options: SortOption[];
  selected: string;
  onChange: (value: string) => void;
}

export const SortToggle: FC<SortToggleProps> = ({ options, selected, onChange }) => {
  return (
    <div className="flex w-full rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-all
           ${selected === opt.value
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
         `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
