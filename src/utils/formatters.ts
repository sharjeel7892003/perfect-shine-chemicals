/**
 * PKR Currency Formatter
 * Formats numbers into Pakistani Rupee (PKR / Rs.) format with proper comma separators
 */
export const formatPKR = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'PKR 0';
  return 'PKR ' + Number(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/**
 * Format standard date (e.g. 04 Sep 2026)
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

/**
 * Format date & time (e.g. 04 Sep 2026, 02:30 PM)
 */
export const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
};

/**
 * Generate sequential-like invoice numbers with prefix
 */
export const generateInvoiceNumber = (prefix: 'INV' | 'PO' | 'PAY' | 'ADJ' = 'INV'): string => {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${rand}`;
};
