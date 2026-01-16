import { useState, useRef, useEffect, type FC } from 'react';

interface ReadingListDropdownProps {
  currentList: string | null;
  listNames: string[];
  onSelectList: (listName: string | null) => void;
}

export const ReadingListDropdown: FC<ReadingListDropdownProps> = ({ currentList, listNames, onSelectList }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => isOpen ? handleClose() : setIsOpen(true)}
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
          <div className="fixed inset-0 z-10" onClick={handleClose} />
          <div
            className={`absolute right-0 bottom-full mb-2 w-40 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl z-20 py-1
              transition-all duration-150 ease-out origin-bottom-right
              ${isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-1'}`}
          >
            {listNames.length > 0 ? (
              listNames.map(name => (
                <button
                  key={name}
                  onClick={() => {
                    onSelectList(name === currentList ? null : name);
                    handleClose();
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-700 ${
                    name === currentList ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400' : 'text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {name}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-stone-400">
                No lists yet
              </div>
            )}
            {currentList && (
              <button
                onClick={() => {
                  onSelectList(null);
                  handleClose();
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-stone-200 dark:border-stone-700 transition-colors"
              >
                Remove from list
              </button>
            )}
            <div className="border-t border-stone-200 dark:border-stone-700 mt-1 pt-1">
              <div className="px-3 py-1.5 text-[10px] text-stone-400 uppercase tracking-wider">Create in Settings</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
