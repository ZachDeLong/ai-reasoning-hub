import { useState, type FC } from 'react';

interface ReadingListDropdownProps {
  currentList: string | null;
  listNames: string[];
  onSelectList: (listName: string | null) => void;
}

export const ReadingListDropdown: FC<ReadingListDropdownProps> = ({ currentList, listNames, onSelectList }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          currentList
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'
            : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        {currentList || '+ List'}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
            {listNames.map(name => (
              <button
                key={name}
                onClick={() => {
                  onSelectList(name === currentList ? null : name);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-700 ${
                  name === currentList ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400' : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                {name}
              </button>
            ))}
            {currentList && (
              <button
                onClick={() => {
                  onSelectList(null);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-700 border-t border-stone-200 dark:border-stone-700"
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
