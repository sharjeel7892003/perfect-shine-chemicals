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
export const generateInvoiceNumber = (prefix: 'INV' | 'PO' | 'PAY' | 'ADJ' | 'TRIP' = 'INV'): string => {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${rand}`;
};

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Safely converts a YYYY-MM-DD date picker string to an ISO string.
 * If the selected date is today, it preserves the current exact time.
 * If backdated or future, it sets the time to noon local time so that
 * date comparisons and UTC conversions do not shift into adjacent calendar days.
 */
export const formatSelectedDateToIso = (dateStr?: string): string => {
  if (!dateStr) return new Date().toISOString();
  const todayStr = getTodayDateString();
  const now = new Date();
  if (dateStr === todayStr) {
    return now.toISOString();
  }
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const [year, month, day] = parts;
    const targetDate = new Date(year, month - 1, day, 12, 0, 0);
    return targetDate.toISOString();
  }
  return new Date().toISOString();
};

/**
 * Format quantity with consistent decimal precision
 * Avoids floating-point noise (e.g. 51.50000000001) while preserving exact decimals.
 * E.g. 51.5 -> "51.5 kg", 360.5 -> "360.500 L", or without unit.
 */
export const formatQuantity = (
  quantity: number | null | undefined, 
  unit?: string,
  minDecimals: number = 0,
  maxDecimals: number = 3
): string => {
  if (quantity === null || quantity === undefined || isNaN(quantity)) {
    return `0${unit ? ` ${unit}` : ''}`;
  }
  const formatted = Number(quantity).toLocaleString('en-PK', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
  return unit ? `${formatted} ${unit}` : formatted;
};


