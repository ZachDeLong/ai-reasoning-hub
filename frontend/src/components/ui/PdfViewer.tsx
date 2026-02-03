import { FC, useState } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PdfViewerProps {
  arxivId: string;
  darkMode?: boolean;
}

export const PdfViewer: FC<PdfViewerProps> = ({ arxivId, darkMode = false }) => {
  const [hasError, setHasError] = useState(false);

  // Default layout includes: toolbar, thumbnails sidebar, search, zoom, page nav
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => [
      defaultTabs[0], // Keep only thumbnails, remove attachments/bookmarks tabs
    ],
    toolbarPlugin: {
      fullScreenPlugin: {
        onEnterFullScreen: (zoom) => zoom(1),
        onExitFullScreen: (zoom) => zoom(1),
      },
    },
  });

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-stone-100 dark:bg-stone-800 rounded-lg p-8 min-h-[400px]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-stone-400 dark:text-stone-500 mb-4"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="12" y1="9" x2="12.01" y2="9" />
        </svg>
        <p className="text-stone-500 dark:text-stone-400 mb-4 text-center">
          Unable to load PDF
        </p>
        <a
          href={`https://arxiv.org/pdf/${arxivId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
        >
          Open on arXiv →
        </a>
      </div>
    );
  }

  return (
    <div className={`h-full ${darkMode ? 'pdf-viewer-dark' : 'pdf-viewer-light'}`}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer
          fileUrl={`/api/pdf/${arxivId}`}
          plugins={[defaultLayoutPluginInstance]}
          onDocumentLoad={() => setHasError(false)}
          renderError={() => {
            setHasError(true);
            return <></>;
          }}
          theme={darkMode ? 'dark' : 'light'}
          defaultScale={1}
        />
      </Worker>
    </div>
  );
};
