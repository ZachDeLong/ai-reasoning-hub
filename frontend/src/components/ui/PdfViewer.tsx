import { FC, useState } from 'react';
import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

interface PdfViewerProps {
  arxivId: string;
  darkMode?: boolean;
}

export const PdfViewer: FC<PdfViewerProps> = ({ arxivId, darkMode = false }) => {
  const [hasError, setHasError] = useState(false);

  const arxivUrl = `https://arxiv.org/pdf/${arxivId}`;

  if (hasError) {
    return (
      <a
        href={arxivUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center h-full bg-stone-100 dark:bg-stone-800 rounded-lg p-8 min-h-[400px] hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
      >
        <p className="text-stone-500 dark:text-stone-400 mb-2 text-center">
          Unable to load PDF
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Click to open on arXiv →
        </p>
      </a>
    );
  }

  return (
    <a
      href={arxivUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block h-full rounded-lg overflow-hidden cursor-pointer ${darkMode ? 'pdf-dark' : 'pdf-light'}`}
    >
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer
          fileUrl={`/api/pdf/${arxivId}`}
          defaultScale={SpecialZoomLevel.PageFit}
          onDocumentLoad={() => setHasError(false)}
          renderError={() => {
            setHasError(true);
            return <></>;
          }}
          theme={darkMode ? 'dark' : 'light'}
        />
      </Worker>
    </a>
  );
};
