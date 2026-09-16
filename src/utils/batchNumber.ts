import { ProductionBatch, Product } from '../types';

/**
 * Generates a clean, uppercase product code or prefix for batch numbering using the product's SKU or name.
 * Examples:
 * - Product with SKU "PSC-DW-D1" -> "DW-D1"
 * - Product with SKU "PSC-DWL-D2" -> "DWL-D2"
 * - Product "Dishwashing Liquid - Economical High-Visc (1)" -> "DW-1"
 * - Product "Bleach Concentrated" -> "BC"
 */
export const generateProductShortCode = (product?: { name: string; sku?: string }): string => {
  if (!product || !product.name) return 'BATCH';

  // 1. If SKU is provided, strip common prefix like 'PSC-'
  if (product.sku && product.sku.trim()) {
    const cleanSku = product.sku.trim().replace(/^PSC[-_]?/i, '');
    if (cleanSku) {
      return cleanSku.toUpperCase();
    }
  }

  const name = product.name.trim();

  // 2. Extract any trailing/parenthesized number, e.g. (1), (2), Type 1
  let suffixNumber = '';
  const numMatch = name.match(/\((\d+)\)/) || name.match(/(\d+)$/);
  if (numMatch) {
    suffixNumber = numMatch[1];
  }

  // 3. Extract initials from primary words
  const words = name
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const codeParts: string[] = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    if (['and', 'for', 'the', 'with', 'type', 'high', 'visc', 'economical'].includes(lower)) {
      continue;
    }
    if (lower === 'dishwashing' || lower === 'dishwash') {
      codeParts.push('DW');
    } else if (lower === 'liquid') {
      codeParts.push('L');
    } else {
      codeParts.push(word.charAt(0).toUpperCase());
    }
  }

  const baseCode = (codeParts.length > 0 ? codeParts.join('') : words.map(w => w.charAt(0).toUpperCase()).join('')).slice(0, 5);
  return `${baseCode || 'PROD'}${suffixNumber ? `-${suffixNumber}` : ''}`;
};

/**
 * Calculates the next sequential batch number for a specific product.
 * Format: [Product SKU / Short Code]-Batch[Number] (e.g. DW-D1-Batch1, DW-D1-Batch2)
 *
 * Sequence is strictly PER PRODUCT:
 * - Counts existing production batches for that specific product
 * - Finds the highest sequential number in any existing batch for this product
 * - Sets the next batch number to (max(count, highest) + 1)
 */
export const getNextBatchNumberForProduct = (
  productId: string,
  batches: ProductionBatch[],
  product?: Product | { name: string; sku?: string }
): string => {
  const prefix = generateProductShortCode(product);

  // Filter batches for this specific product
  const productBatches = (batches || []).filter(b => {
    if (b.product_id && productId && b.product_id === productId) return true;
    if (product?.name && b.product_name && b.product_name.trim().toLowerCase() === product.name.trim().toLowerCase()) return true;
    return false;
  });

  let maxBatchIndex = 0;

  // Inspect existing batch numbers for this product
  for (const batch of productBatches) {
    const bNum = batch.batch_number || '';
    // Match e.g. "DW-D1-Batch3", "Batch-3", "Batch3", "BATCH_4", or trailing "-4"
    const match = bNum.match(/Batch[-_\s]?(\d+)/i) || bNum.match(/[-_](\d+)$/);
    if (match) {
      const parsedNum = parseInt(match[1], 10);
      if (!isNaN(parsedNum) && parsedNum > maxBatchIndex) {
        maxBatchIndex = parsedNum;
      }
    }
  }

  // Next sequence number is strictly sequential per product
  const nextNum = Math.max(productBatches.length, maxBatchIndex) + 1;

  return `${prefix}-Batch${nextNum}`;
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
