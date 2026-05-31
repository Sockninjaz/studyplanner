/**
 * File parsing utilities for extracting text from various document types.
 * Supports: PDF, Word (.docx), PowerPoint (.pptx), plain text.
 */


import mammoth from 'mammoth';
import JSZip from 'jszip';

export interface ParsedDocument {
  text: string;
  fileName: string;
  fileType: string;
  pageCount?: number;
}

/**
 * Main entry point — detects file type and delegates to the right parser.
 */
export async function parseDocument(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  
  switch (ext) {
    case 'pdf':
      return parsePDF(buffer, fileName);
    case 'docx':
      return parseDocx(buffer, fileName);
    case 'pptx':
      return parsePptx(buffer, fileName);
    case 'txt':
    case 'md':
      return parseText(buffer, fileName);
    case 'html':
    case 'htm':
      return parseHtml(buffer, fileName);
    case 'json':
      return parseJson(buffer, fileName);
    case 'zip':
      return parseZip(buffer, fileName);
    default:
      throw new Error(`Unsupported file type: .${ext}. Supported: .pdf, .docx, .pptx, .txt, .md, .html, .json, .zip`);
  }
}

async function parseHtml(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const html = buffer.toString('utf-8');
  // Simple tag stripping while keeping some structure
  const text = html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    text,
    fileName,
    fileType: 'html',
  };
}

async function parseJson(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  try {
    const obj = JSON.parse(buffer.toString('utf-8'));
    return {
      text: JSON.stringify(obj, null, 2),
      fileName,
      fileType: 'json',
    };
  } catch (err) {
    return parseText(buffer, fileName);
  }
}

async function parseZip(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const results: string[] = [];
  
  const files = Object.entries(zip.files).filter(([name, file]) => !file.dir && !name.startsWith('__MACOSX') && !name.includes('.DS_Store'));

  for (const [name, file] of files) {
    try {
      const fileBuffer = await file.async('nodebuffer');
      // Recursively parse files inside the zip
      const parsed = await parseDocument(fileBuffer, name);
      results.push(`[FILE: ${name}]\n${parsed.text}\n[END FILE: ${name}]`);
    } catch (err) {
      // Just skip files that we can't parse or aren't supported
      console.log(`Skipping file in zip: ${name}`);
    }
  }
  
  if (results.length === 0) {
    throw new Error('ZIP file contains no supported text documents.');
  }

  return {
    text: results.join('\n\n'),
    fileName,
    fileType: 'zip',
  };
}

async function parsePDF(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PdfReader } = require('pdfreader');

  return new Promise((resolve, reject) => {
    let fullText = '';
    let lastPage = 0;

    new PdfReader().parseBuffer(buffer, (err: any, item: any) => {
      if (err) {
        reject(err);
      } else if (!item) {
        // End of file
        resolve({
          text: fullText.trim(),
          fileName,
          fileType: 'pdf',
          pageCount: lastPage,
        });
      } else if (item.page) {
        lastPage = item.page;
        fullText += '\n\n';
      } else if (item.text) {
        fullText += item.text + ' ';
      }
    });
  });
}

async function parseDocx(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    fileName,
    fileType: 'docx',
  };
}

async function parsePptx(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  // PowerPoint .pptx files are ZIP archives containing XML slides.
  // We extract text from each slide's XML.
  const zip = await JSZip.loadAsync(buffer);
  const slideTexts: string[] = [];

  // Slides are stored as ppt/slides/slide1.xml, slide2.xml, etc.
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
      return numA - numB;
    });

  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async('text');
    // Extract all text between <a:t> tags (PowerPoint text runs)
    const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const slideText = textMatches
        .map(match => match.replace(/<\/?a:t>/g, ''))
        .join(' ');
      slideTexts.push(slideText);
    }
  }

  return {
    text: slideTexts.join('\n\n--- Slide Break ---\n\n'),
    fileName,
    fileType: 'pptx',
    pageCount: slideFiles.length,
  };
}

function parseText(buffer: Buffer, fileName: string): ParsedDocument {
  return {
    text: buffer.toString('utf-8'),
    fileName,
    fileType: 'txt',
  };
}
