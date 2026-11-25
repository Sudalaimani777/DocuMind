import { X } from 'lucide-react';
import type { DocumentFormat } from '@documind/shared';

export type DatePreset = 'all' | '7d' | '30d' | '90d';

const FORMAT_CHECKBOXES: Array<{ value: DocumentFormat; label: string }> = [
  { value: 'pdf', label: 'PDF (.pdf)' },
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'pptx', label: 'PowerPoint (.pptx)' },
];

interface SearchFiltersSidebarProps {
  selectedFormats: DocumentFormat[];
  datePreset: DatePreset;
  minConfidence: number;
  documentId: string | undefined;
  onToggleFormat: (format: DocumentFormat) => void;
  onDatePresetChange: (preset: DatePreset) => void;
  onMinConfidenceChange: (value: number) => void;
  onClearDocumentScope: () => void;
  onResetAll: () => void;
}

/**
 * Left faceted filter rail for file format, ingestion date, match confidence, and document scope.
 */
export function SearchFiltersSidebar({
  selectedFormats,
  datePreset,
  minConfidence,
  documentId,
  onToggleFormat,
  onDatePresetChange,
  onMinConfidenceChange,
  onClearDocumentScope,
  onResetAll,
}: SearchFiltersSidebarProps) {
  return (
    <aside
      aria-label="Search Filters"
      className="bg-surface border border-outline rounded-card p-20 flex flex-col gap-20"
    >
      <div className="flex items-center justify-between border-b border-outline pb-15">
        <h2 className="font-t03 text-t03 text-on-surface">Filters</h2>
        <button
          type="button"
          onClick={onResetAll}
          className="font-t05 text-t05 text-secondary hover:underline"
        >
          Reset all
        </button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-t05 text-t05 text-on-surface-variant mb-1">File Format</legend>
        {FORMAT_CHECKBOXES.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 font-t04 text-t04 text-on-surface cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedFormats.includes(opt.value)}
              onChange={() => onToggleFormat(opt.value)}
              className="w-4 h-4 rounded-xs border-outline accent-secondary text-secondary focus:ring-outline-focus cursor-pointer"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2 pt-15 border-t border-outline">
        <label htmlFor="date-filter" className="font-t05 text-t05 text-on-surface-variant">
          Date Ingested
        </label>
        <select
          id="date-filter"
          value={datePreset}
          onChange={(e) => onDatePresetChange(e.target.value as DatePreset)}
          className="w-full px-3 py-2 rounded-md bg-surface border border-outline text-on-surface font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
        >
          <option value="all">Any time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      <div className="flex flex-col gap-2 pt-15 border-t border-outline">
        <label htmlFor="confidence-filter" className="font-t05 text-t05 text-on-surface-variant">
          Match Confidence
        </label>
        <select
          id="confidence-filter"
          value={String(minConfidence)}
          onChange={(e) => onMinConfidenceChange(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-md bg-surface border border-outline text-on-surface font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
        >
          <option value="0">All matches</option>
          <option value="90">90%+ High confidence</option>
          <option value="80">80%+ Strong match</option>
        </select>
      </div>

      {documentId ? (
        <div className="pt-15 border-t border-outline flex flex-col gap-2">
          <span className="font-t05 text-t05 text-on-surface-variant">Document Scope</span>
          <div className="inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-surface-accent-subtle border border-outline text-on-surface font-t05 text-t05">
            <span className="truncate">ID: {documentId.slice(0, 8)}...</span>
            <button
              type="button"
              onClick={onClearDocumentScope}
              aria-label="Clear document scope"
              className="text-secondary hover:text-on-surface"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
