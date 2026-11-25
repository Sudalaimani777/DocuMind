import { FileSpreadsheet, FileText, FileType, Presentation } from 'lucide-react';
import { cn } from '../../../core/lib/utils';

interface FormatConfig {
  label: string;
  pillClass: string;
  iconClass: string;
  Icon: typeof FileText;
}

const FORMAT_MAP: Record<string, FormatConfig> = {
  pdf: {
    label: 'PDF',
    pillClass: 'bg-pdf-bg text-pdf-text border-pdf-border',
    iconClass: 'text-pdf-text',
    Icon: FileText,
  },
  docx: {
    label: 'DOCX',
    pillClass: 'bg-docx-bg text-docx-text border-docx-border',
    iconClass: 'text-docx-text',
    Icon: FileType,
  },
  xlsx: {
    label: 'XLSX',
    pillClass: 'bg-xlsx-bg text-xlsx-text border-xlsx-border',
    iconClass: 'text-xlsx-text',
    Icon: FileSpreadsheet,
  },
  pptx: {
    label: 'PPTX',
    pillClass: 'bg-pptx-bg text-pptx-text border-pptx-border',
    iconClass: 'text-pptx-text',
    Icon: Presentation,
  },
};

export function FormatIcon({ fileType }: { fileType: string }) {
  const cfg = FORMAT_MAP[fileType.toLowerCase()] ?? FORMAT_MAP.pdf;
  const Icon = cfg.Icon;
  return <Icon className={cn('w-4 h-4 shrink-0', cfg.iconClass)} aria-hidden="true" />;
}

export function FormatBadge({ fileType }: { fileType: string }) {
  const cfg = FORMAT_MAP[fileType.toLowerCase()] ?? {
    label: fileType.toUpperCase(),
    pillClass: 'bg-surface-subtle text-on-surface border-outline',
    iconClass: 'text-on-surface',
    Icon: FileText,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-pill border font-t05 text-t05',
        cfg.pillClass
      )}
    >
      {cfg.label}
    </span>
  );
}
