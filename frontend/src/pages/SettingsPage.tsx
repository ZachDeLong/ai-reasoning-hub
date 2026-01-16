import { useState, type FC } from 'react';
import type { ReadingLists } from '@/hooks';

interface SettingsPageProps {
  themePreference: string;
  setThemePreference: (pref: string) => void;
  defaultSort: string;
  setDefaultSort: (sort: string) => void;
  defaultMinScore: number;
  setDefaultMinScore: (score: number) => void;
  keyboardEnabled: boolean;
  setKeyboardEnabled: (enabled: boolean) => void;
  onClearBookmarks: () => void;
  onClearLists: () => void;
  bookmarkCount: number;
  bookmarks: Set<string>;
  readingLists: ReadingLists;
}

export const SettingsPage: FC<SettingsPageProps> = ({
  themePreference,
  setThemePreference,
  defaultSort,
  setDefaultSort,
  defaultMinScore,
  setDefaultMinScore,
  keyboardEnabled,
  setKeyboardEnabled,
  onClearBookmarks,
  onClearLists,
  bookmarkCount,
  bookmarks,
  readingLists,
}) => {
  const [exportStatus, setExportStatus] = useState('');

  const handleExport = () => {
    const data = {
      bookmarks: Array.from(bookmarks),
      readingLists: readingLists,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reasoning-hub-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus('Exported!');
    setTimeout(() => setExportStatus(''), 2000);
  };

  const ToggleSwitch: FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-amber-600' : 'bg-stone-300 dark:bg-stone-600'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          enabled ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  );

  const OptionButton: FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({
    selected,
    onClick,
    children,
  }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
        selected
          ? 'bg-amber-600 text-white'
          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">
        Settings
      </h1>

      <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Appearance</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">Theme</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Choose your preferred color scheme</p>
            </div>
            <div className="flex gap-1">
              <OptionButton selected={themePreference === 'system'} onClick={() => setThemePreference('system')}>
                System
              </OptionButton>
              <OptionButton selected={themePreference === 'light'} onClick={() => setThemePreference('light')}>
                Light
              </OptionButton>
              <OptionButton selected={themePreference === 'dark'} onClick={() => setThemePreference('dark')}>
                Dark
              </OptionButton>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Default Filters</h2>
        </div>
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">Sort Order</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Default sorting when you open the app</p>
            </div>
            <div className="flex gap-1">
              <OptionButton selected={defaultSort === 'score'} onClick={() => setDefaultSort('score')}>
                By Score
              </OptionButton>
              <OptionButton selected={defaultSort === 'newest'} onClick={() => setDefaultSort('newest')}>
                Newest
              </OptionButton>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">Minimum Score</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Only show papers with this score or higher</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="7"
                value={defaultMinScore}
                onChange={(e) => setDefaultMinScore(parseInt(e.target.value, 10))}
                className="w-24 accent-amber-600"
              />
              <span className="text-sm font-medium text-stone-900 dark:text-stone-100 w-4 text-center">
                {defaultMinScore}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Keyboard</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">Keyboard Shortcuts</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Use j/k to navigate, Enter to expand, s to save</p>
            </div>
            <ToggleSwitch enabled={keyboardEnabled} onChange={setKeyboardEnabled} />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Data Management</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">Bookmarks</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{bookmarkCount} papers saved</p>
            </div>
            <button
              onClick={onClearBookmarks}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">Reading Lists</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Your curated paper collections</p>
            </div>
            <button
              onClick={onClearLists}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">Export Data</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Download bookmarks and lists as JSON</p>
            </div>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-xs bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors"
            >
              {exportStatus || 'Export'}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">About</h2>
        </div>
        <div className="p-5">
          <p className="text-stone-600 dark:text-stone-400 text-sm mb-3">
            Reasoning Hub helps researchers track the latest AI reasoning papers.
          </p>
          <a
            href="/about"
            className="text-sm text-amber-700 dark:text-amber-500 hover:underline"
          >
            Learn more about scoring methodology →
          </a>
        </div>
      </section>
    </div>
  );
};
