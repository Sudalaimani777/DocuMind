import { Link } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';

interface PhaseRoutePlaceholderProps {
  title: string;
  phaseLabel: string;
  description: string;
}

/**
 * Clean workspace view for upcoming Phase 2–4 routes inside AppShell.
 */
export function PhaseRoutePlaceholder({
  title,
  phaseLabel,
  description,
}: PhaseRoutePlaceholderProps) {
  return (
    <section className="bg-surface border border-outline rounded-card p-32 flex flex-col items-start gap-15">
      <span className="px-2.5 py-0.5 rounded-pill bg-surface-accent-subtle text-secondary font-t05 text-t05">
        {phaseLabel}
      </span>
      <h1 className="font-t00 text-t00 text-on-surface">{title}</h1>
      <p className="font-t04 text-t04 text-on-surface-variant max-w-xl text-pretty">
        {description}
      </p>
      <Link
        to="/library"
        className="inline-flex items-center gap-2 px-20 py-15 rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary hover:text-on-primary transition-colors duration-instant ease-instant"
      >
        <FolderOpen className="w-4 h-4" aria-hidden="true" />
        <span>Return to Document Library</span>
      </Link>
    </section>
  );
}
