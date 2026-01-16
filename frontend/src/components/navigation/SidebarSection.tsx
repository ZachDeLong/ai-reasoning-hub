import { useState, type FC, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/icons';

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export const SidebarSection: FC<SidebarSectionProps> = ({ title, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-stone-200 dark:border-stone-700 pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left mb-2"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          {title}
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
      </button>
      {isOpen && children}
    </div>
  );
};
