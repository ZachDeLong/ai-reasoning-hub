import type { FC } from 'react';

interface CustomSwitchProps {
  label: string;
  isChecked: boolean;
  onChange: () => void;
}

export const CustomSwitch: FC<CustomSwitchProps> = ({ label, isChecked, onChange }) => {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        onClick={onChange}
        className={`${isChecked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
      >
        <span
          aria-hidden="true"
          className={`${isChecked ? 'translate-x-5' : 'translate-x-0'
            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
    </label>
  );
};
