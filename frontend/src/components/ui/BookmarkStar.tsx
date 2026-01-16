import type { FC } from 'react';

interface BookmarkStarProps {
  isBookmarked: boolean;
  onClick: () => void;
}

export const BookmarkStar: FC<BookmarkStarProps> = ({ isBookmarked, onClick }) => (
  <button
    onClick={onClick}
    className={`p-1.5 rounded-full transition-all ${
      isBookmarked
        ? 'text-yellow-500 hover:text-yellow-600'
        : 'text-gray-400 hover:text-yellow-500'
    }`}
    title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={isBookmarked ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  </button>
);
