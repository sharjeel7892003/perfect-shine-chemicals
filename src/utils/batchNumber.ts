import { ProductionBatch, Product } from '../types';

/**
 * Generates a clean, concise, uppercase product short code for batch numbering.
 * Example:
 * - "Dishwashing Liquid - Economical High-Visc (1)" -> "DWL1"
 * - "Dishwashing Liquid - Economical High-Visc (2)" -> "DWL2"
 * - "Hand Wash" -> "HW"
 * - "Bleach Concentrated" -> "BC"
 */
export const generateProductShortCode = (product?: { name: string; sku?: string }): string => {
  if (!product || !product.name) return 'PROD';

  const name = product.name.trim();

  // 1. Check if SKU contains a clean short code (e.g. PSC-DW-D1 -> DW1 or PSC-DWL-D2 -> DWL2)
  if (product.sku) {
    const cleanSku = product.sku.trim().toUpperCase().replace(/^PSC-/, '');
    // If SKU is like DW-D1 or DWL-D2, extract letters and last digit
    const skuMatch = cleanSku.match(/^([A-Z]+)[-_]?[A-Z]*(\d+)?$/);
    if (skuMatch) {
      const letters = skuMatch[1];
      const num = skuMatch[2] || '';
      if (letters.length >= 2 && letters.length <= 6) {
        return `${letters}${num}`;
      }
    }
  }

  // 2. Derive intelligently from product name
  // Extract any trailing/parenthesized number, e.g. (1), (2), Type 1, Type 2
  let suffixNumber = '';
  const numMatch = name.match(/(?:type\s*|#|\(|\b)(\d+)(?:\)|\b)?$/i) || name.match(/\((\d+)\)/);
  if (numMatch) {
    suffixNumber = numMatch[1];
  }

  // Clean words (exclude numbers and special characters)
  const words = name
    .replace(/\(.*?\)/g, '') // remove parenthetical content
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return `PRD${suffixNumber}`;

  // Recognize key chemical factory terminology
  const codeParts: string[] = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    if (lower === 'dishwashing' || lower === 'dishwash') {
      codeParts.push('DW');
    } else if (lower === 'liquid') {
      codeParts.push('L');
    } else if (lower === 'cleaner') {
      codeParts.push('C');
    } else if (lower === 'economical' || lower === 'type' || lower === 'high' || lower === 'visc') {
      // Secondary descriptor words can be skipped unless no prefix yet
      continue;
    } else {
      // Take first character of the word
      codeParts.push(word.charAt(0).toUpperCase());
    }
  }

  let baseCode = codeParts.join('');
  if (!baseCode) {
    baseCode = words.map(w => w.charAt(0).toUpperCase()).join('').slice(0, 4);
  }

  // Limit length of base code
  baseCode = baseCode.slice(0, 5);

  return `${baseCode}${suffixNumber}`;
};

/**
 * Calculates the next sequential batch number for a specific product.
 * Format: [Product Short Code]-Batch[Number]
 * Isolation: Numbering is strictly PER PRODUCT.
 * Existing batches are analyzed, taking the maximum of:
 * 1) The highest number parsed from any existing [Prefix]-Batch[N] batch for this product
 * 2) Total existing batch count for this product
 * Thus, if 1 batch exists, next is Batch 2.
 */
export const getNextBatchNumberForProduct = (
  productId: string,
  batches: ProductionBatch[],
  product?: Product | { name: string; sku?: string }
): string => {
  const shortCode = generateProductShortCode(product);

  // Filter batches for this specific product
  const productBatches = batches.filter(b => {
    if (b.product_id && productId && b.product_id === productId) return true;
    if (product?.name && b.product_name && b.product_name.toLowerCase() === product.name.toLowerCase()) return true;
    return false;
  });

  let maxBatchIndex = 0;

  // Inspect existing batch numbers for this product
  for (const batch of productBatches) {
    const bNum = batch.batch_number || '';

    // Match e.g. "DWL1-Batch3", "Batch-3", "Batch3", "BATCH_4"
    const match = bNum.match(/Batch[-_]?(\d+)/i) || bNum.match(/-(\d+)$/);
    if (match) {
      const parsedNum = parseInt(match[1], 10);
      if (!isNaN(parsedNum) && parsedNum > maxBatchIndex) {
        maxBatchIndex = parsedNum;
      }
    }
  }

  // Ensure sequence advances past both highest parsed index and total count of batches for this product
  const count = productBatches.length;
  const nextNum = Math.max(count, maxBatchIndex) + 1;

  return `${shortCode}-Batch${nextNum}`;
};

/**
 * Helper to export data to a CSV file in browser.
 */
export const exportToCSV = (
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void => {
  const escapeCell = (cell: string | number | boolean | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map(row => row.map(escapeCell).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
