import { useState, type FC, type ReactNode } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface ExpandableSectionProps {
  title: string;
  children: ReactNode | string;
  startOpen?: boolean;
}

export const ExpandableSection: FC<ExpandableSectionProps> = ({ title, children, startOpen = false }) => {
  const [isOpen, setIsOpen] = useState(startOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-medium text-amber-800 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-400 transition-colors underline underline-offset-2 decoration-amber-800/30 dark:decoration-amber-500/30"
      >
        {isOpen ? `Hide ${title}` : `Read ${title}`}
      </button>
      {isOpen && (
        <div className="mt-3 p-4 bg-stone-100 dark:bg-stone-800/50 rounded-lg prose prose-stone dark:prose-invert prose-sm max-w-none">
          {typeof children === 'string' ? (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(children) as string) }} />
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
};
