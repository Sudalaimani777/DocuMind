import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';

interface BrandMarkProps {
  to?: string;
}

/**
 * DocuMind editorial brand mark used across authentication views and app navigation.
 */
export function BrandMark({ to = '/' }: BrandMarkProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-15 self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
    >
      <span className="w-9 h-9 rounded-md bg-secondary text-on-secondary flex items-center justify-center shrink-0">
        <Layers className="w-5 h-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span className="font-t03 text-t03 text-on-surface leading-none">DocuMind</span>
        <span className="font-t05 text-t05 text-on-surface-variant">Enterprise RAG</span>
      </span>
    </Link>
  );
}
