import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import type { Document } from '@langchain/core/documents';
import { readFile } from 'fs/promises';

export type SupportedFormat = 'txt' | 'md' | 'pdf' | 'docx' | 'json';

class CustomTextLoader extends BaseDocumentLoader {
  constructor(private filepath: string) {
    super();
  }

  async load(): Promise<Document[]> {
    let content = await readFile(this.filepath, 'utf-8');
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    return [{ pageContent: content, metadata: { source: this.filepath } }];
  }
}

class CustomJSONLoader extends BaseDocumentLoader {
  constructor(private filepath: string) {
    super();
  }

  async load(): Promise<Document[]> {
    const content = await readFile(this.filepath, 'utf-8');
    const parsed = JSON.parse(content);
    const text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    return [{ pageContent: text, metadata: { source: this.filepath } }];
  }
}

async function loadPdf(filepath: string): Promise<Document[]> {
  const { PDFParse } = await import('pdf-parse');
  const buffer = await readFile(filepath);
  const parser = new PDFParse({ data: new Uint8Array(buffer.buffer) });
  try {
    const textResult = await parser.getText();
    const docs: Document[] = [];
    for (const page of textResult.pages) {
      if (page.text && page.text.trim().length > 0) {
        docs.push({ pageContent: page.text, metadata: { source: filepath, pageNumber: page.num } });
      }
    }
    return docs;
  } finally {
    await parser.destroy();
  }
}

const MIME_MAP: Record<string, SupportedFormat> = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/json': 'json',
};

export function detectFormat(filename: string, mimeType?: string): SupportedFormat {
  if (mimeType && MIME_MAP[mimeType]) return MIME_MAP[mimeType];
  const ext = filename.split('.').pop()?.toLowerCase();
  const extMap: Record<string, SupportedFormat> = {
    txt: 'txt',
    md: 'md',
    markdown: 'md',
    pdf: 'pdf',
    docx: 'docx',
    json: 'json',
  };
  return extMap[ext ?? ''] ?? 'txt';
}

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    json: 'application/json',
  };
  return mimeMap[ext ?? ''] ?? 'application/octet-stream';
}

export async function parseFile(filepath: string, format: SupportedFormat): Promise<Document[]> {
  switch (format) {
    case 'txt':
    case 'md':
      return new CustomTextLoader(filepath).load();
    case 'pdf':
      return loadPdf(filepath);
    case 'docx':
      return new DocxLoader(filepath).load();
    case 'json':
      return new CustomJSONLoader(filepath).load();
    default:
      return new CustomTextLoader(filepath).load();
  }
}
