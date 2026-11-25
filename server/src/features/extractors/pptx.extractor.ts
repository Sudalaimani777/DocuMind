import { OfficeParser, type OfficeContentNode, type SlideMetadata } from 'officeparser';
import type { ExtractedSegment, ExtractionResult } from './extractor.types.js';

type SlideNodeWithNotes = OfficeContentNode & {
  notes?: OfficeContentNode[];
};

function collectNodeText(node: OfficeContentNode): string {
  if (Array.isArray(node.children) && node.children.length > 0) {
    const childText = node.children
      .map(collectNodeText)
      .filter((t) => t.length > 0)
      .join('\n')
      .trim();

    if (childText.length > 0) {
      return childText;
    }
  }

  return typeof node.text === 'string' ? node.text.trim() : '';
}

/**
 * Extracts slide body text and speaker notes from a PPTX buffer with slideNumber coordinates.
 */
export async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  const ast = await OfficeParser.parseOffice(buffer, {
    ignoreNotes: false,
  });

  const notesById = new Map<string, string>();
  const slideNodes: SlideNodeWithNotes[] = [];

  const scanNodes = (nodes: OfficeContentNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'slide') {
        slideNodes.push(node as SlideNodeWithNotes);
      } else if (node.type === 'note') {
        const noteMeta = node.metadata as { noteId?: string } | undefined;
        const noteText = collectNodeText(node);
        if (noteMeta?.noteId && noteText.length > 0) {
          notesById.set(noteMeta.noteId, noteText);
        }
      }

      if (Array.isArray(node.children) && node.type !== 'slide') {
        scanNodes(node.children);
      }
    }
  };

  scanNodes(ast.content);

  const segments: ExtractedSegment[] = [];

  for (let i = 0; i < slideNodes.length; i++) {
    const slideNode = slideNodes[i];
    const meta = slideNode.metadata as SlideMetadata | undefined;
    const slideNumber = meta?.slideNumber ?? i + 1;

    const bodyChildren = (slideNode.children ?? []).filter((c) => c.type !== 'note');
    const attachedNotes = [
      ...(slideNode.notes ?? []),
      ...(slideNode.children ?? []).filter((c) => c.type === 'note'),
    ]
      .map(collectNodeText)
      .filter((t) => t.length > 0);

    const bodyText = bodyChildren
      .map(collectNodeText)
      .filter((t) => t.length > 0)
      .join('\n');

    const referencedNote = meta?.noteId ? notesById.get(meta.noteId) : undefined;
    const combinedNotes = [...attachedNotes, ...(referencedNote ? [referencedNote] : [])]
      .filter((n, idx, arr) => arr.indexOf(n) === idx)
      .join('\n');

    const contentParts: string[] = [];
    if (bodyText.length > 0) {
      contentParts.push(bodyText);
    }
    if (combinedNotes.length > 0) {
      contentParts.push(`Speaker Notes: ${combinedNotes}`);
    }

    const combined = contentParts.join('\n\n').trim();
    if (combined.length > 0) {
      segments.push({
        content: combined,
        coordinates: { slideNumber },
      });
    }
  }

  return {
    segments,
    isScanned: false,
    metadata: {
      slideCount: slideNodes.length,
    },
  };
}
