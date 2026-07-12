// pdf-parse is imported through its library entry point instead of the
// package root: the root index.js runs a debug self-test that reads a
// bundled sample file when it detects no parent module, which breaks in
// some execution environments. The lib entry point avoids that path.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  buffer: Buffer,
  options?: Record<string, unknown>,
) => Promise<{ numpages: number; text: string }>;

export interface ParsedPdf {
  pages: number;
  /** Extracted plain text per page, index 0 is page 1. */
  pageTexts: string[];
}

interface PdfTextItem {
  str: string;
}

interface PdfPageData {
  getTextContent: (options: Record<string, unknown>) => Promise<{ items: PdfTextItem[] }>;
}

/**
 * Parses a PDF buffer and returns the plain text of each page.
 *
 * A custom page renderer collects per-page text so chunks can carry an
 * accurate page number for citations.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const pageTexts: string[] = [];

  const pagerender = async (pageData: PdfPageData): Promise<string> => {
    const textContent = await pageData.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });
    const text = textContent.items.map((item) => item.str).join(' ');
    pageTexts.push(text);
    return text;
  };

  const result = await pdfParse(buffer, { pagerender });

  return { pages: result.numpages, pageTexts };
}

/** Returns true when the buffer starts with the PDF file signature. */
export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}
