import { PDFParse } from 'pdf-parse';

export interface ParsedPdf {
  pages: number;
  /** Extracted plain text per page, index 0 is page 1. */
  pageTexts: string[];
}

/**
 * Parses a PDF buffer and returns the plain text of each page.
 *
 * Page-level text is required so chunks can carry an accurate page
 * number for citations.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return {
      pages: result.total,
      pageTexts: result.pages.map((page) => page.text),
    };
  } finally {
    await parser.destroy();
  }
}

/** Returns true when the buffer starts with the PDF file signature. */
export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}
