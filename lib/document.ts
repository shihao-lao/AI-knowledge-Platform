import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import type { DocumentStatus, FileType } from '@/types';

export const uploadAccept = '.pdf,.md,.markdown,.txt,.csv,.xls,.xlsx,.doc,.docx';

export const fileTypeText: Record<FileType, string> = {
  pdf: 'PDF 文档',
  markdown: '标记文档',
  text: '纯文本文档',
  word: 'Word 文档',
  excel: 'Excel 表格',
};

export function formatSize(size: number) {
  return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024).toFixed(1)} KB`;
}

export function getFileType(fileName: string): FileType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'excel';
  return 'text';
}

function normalizePreview(text: string) {
  const cleanText = text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!cleanText) return '文件已导入，但暂未读取到可展示的正文内容。';
  return cleanText.length > 6000
    ? `${cleanText.slice(0, 6000)}\n\n……内容较长，已在前端预览中截取前 6000 字。`
    : cleanText;
}

function extractKeyPoints(text: string, fileName: string) {
  const lines = text
    .replace(/\|/g, '，')
    .split(/\n|。|；|;|\.|!|！|\?|？/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8);
  const uniqueLines = Array.from(new Set(lines));
  const points = uniqueLines.slice(0, 6);

  if (points.length) return points;
  return [
    `已导入《${fileName}》，系统将该文件保存为知识文档。`,
    '后续可接入后端解析与大模型摘要服务，生成更精确的关键点。',
  ];
}

async function readExcelContent(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return normalizePreview(await file.text());

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheetTexts: string[] = [];
  workbook.worksheets.slice(0, 5).forEach((sheet) => {
    const rows: string[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 80) return;
      const values = row.values as Array<unknown>;
      const cells = values
        .slice(1, 13)
        .map((value) => {
          if (value == null) return '';
          if (typeof value === 'object' && 'text' in value) return String((value as { text: unknown }).text);
          return String(value);
        })
        .filter(Boolean);
      if (cells.length) rows.push(cells.join('，'));
    });
    sheetTexts.push(`工作表：${sheet.name}\n${rows.join('\n')}`);
  });
  return normalizePreview(sheetTexts.join('\n\n'));
}

async function readWordContent(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'doc') {
    return normalizePreview(
      `文件《${file.name}》已导入。旧版 .doc 格式通常需要后端转换服务解析，建议上传 .docx 以在前端直接提取正文。`,
    );
  }
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return normalizePreview(result.value);
}

async function readUploadedContent(file: File, type: FileType) {
  if (type === 'pdf') {
    return normalizePreview(
      [
        `文件《${file.name}》已导入，当前模板先记录文件名、大小和处理状态。`,
        'PDF 正文解析通常需要后端或浏览器 PDF 解析器配合，后续接入解析服务后会在这里展示真实页内文本。',
      ].join('\n'),
    );
  }

  if (type === 'excel') return readExcelContent(file);
  if (type === 'word') return readWordContent(file);

  return normalizePreview(await file.text());
}

export function buildKeyPointDocument(file: File, type: FileType, parsedContent: string) {
  const sourceTitle = file.name.replace(/\.[^.]+$/, '');
  const points = extractKeyPoints(parsedContent, file.name);

  return [
    `# ${sourceTitle}：关键点文档`,
    '',
    `来源文件：${file.name}`,
    `文件类型：${fileTypeText[type]}`,
    `文件大小：${formatSize(file.size)}`,
    '',
    '## 提取关键点',
    ...points.map((point, index) => `${index + 1}. ${point}`),
    '',
    '## 原始内容预览',
    parsedContent,
  ].join('\n');
}

export async function parseUploadedFile(file: File) {
  const type = getFileType(file.name);
  const parsedContent = await readUploadedContent(file, type);
  const content = buildKeyPointDocument(file, type, parsedContent);
  const sourceTitle = file.name.replace(/\.[^.]+$/, '');
  return { type, sourceTitle, content };
}

export const documentProcessingStages: Array<[DocumentStatus, number, number]> = [
  ['parsing', 28, 450],
  ['chunking', 58, 950],
  ['embedding', 84, 1500],
  ['completed', 100, 2200],
];
