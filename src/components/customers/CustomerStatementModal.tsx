import React, { useState, useMemo } from 'react';
import { Customer, Sale, Payment } from '../../types';
import { formatPKR, formatDate, formatDateTime, getTodayDateString } from '../../utils/formatters';
import { 
  Printer, 
  X, 
  Calendar, 
  Archive, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet
} from 'lucide-react';

interface CustomerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  sales: Sale[];
  payments: Payment[];
  onArchive?: () => void;
  onDelete?: () => void;
  hasHistory?: boolean;
  isOwner?: boolean;
}

export interface LedgerRow {
  date: string;
  ref: string;
  description: string;
  method?: string;
  debit: number;
  credit: number;
  balance: number;
  isBroughtForward?: boolean;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  isOpen,
  onClose,
  customer,
  sales,
  payments,
  onArchive,
  onDelete,
  hasHistory,
  isOwner,
}) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Compute chronological customer ledger rows with running balances
  const { allRows, displayedRows, broughtForwardBalance, totals } = useMemo(() => {
    if (!customer) {
      return {
        allRows: [],
        displayedRows: [],
        broughtForwardBalance: 0,
        totals: { totalDebit: 0, totalCredit: 0, closingBalance: 0 }
      };
    }

    const rawRows: {
      date: string;
      ref: string;
      description: string;
      method?: string;
      debit: number;
      credit: number;
    }[] = [];

    // Filter sales for this customer
    const custSales = sales.filter(s => s.customer_id === customer.id);
    custSales.forEach(sale => {
      rawRows.push({
        date: sale.date,
        ref: sale.invoice_number,
        description: `Sale Invoice (${sale.items?.length || 0} items)`,
        method: sale.payment_method,
        debit: Number(sale.total_amount || 0),
        credit: 0,
      });

      if (Number(sale.amount_paid || 0) > 0) {
        rawRows.push({
          date: sale.date,
          ref: `${sale.invoice_number} (Pay)`,
          description: `Payment received at invoice checkout`,
          method: sale.payment_method,
          debit: 0,
          credit: Number(sale.amount_paid || 0),
        });
      }
    });

    // Filter direct payments & advance deposits
    const custPayments = payments.filter(
      p => p.customer_id === customer.id && (p.related_to === 'customer_balance' || p.related_to === 'customer_advance')
    );
    custPayments.forEach(pay => {
      rawRows.push({
        date: pay.date,
        ref: pay.transaction_ref || pay.reference_no || (pay.related_to === 'customer_advance' ? 'ADV' : 'REC'),
        description: pay.notes || (pay.related_to === 'customer_advance' ? 'Customer advance deposit' : 'Payment receipt voucher'),
        method: pay.payment_method,
        debit: 0,
        credit: Number(pay.amount || 0),
      });
    });

    // If customer has no transactions recorded but has a legacy/starting balance
    if (rawRows.length === 0 && Number(customer.current_balance || 0) !== 0) {
      const startBal = Number(customer.current_balance || 0);
      rawRows.push({
        date: customer.created_at || new Date().toISOString(),
        ref: 'OPENING',
        description: 'Account Opening / Starting Balance',
        debit: startBal > 0 ? startBal : 0,
        credit: startBal < 0 ? Math.abs(startBal) : 0,
      });
    }

    // Sort chronologically ascending
    rawRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate full running balance
    let running = 0;
    const computedAllRows: LedgerRow[] = rawRows.map(r => {
      running = running + r.debit - r.credit;
      return {
        ...r,
        balance: running,
      };
    });

    // Handle date filtering
    let bfBal = 0;
    let filtered: LedgerRow[] = [];

    if (startDate || endDate) {
      const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : -Infinity;
      const endMs = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

      // Rows before startDate form Brought Forward Balance
      const beforeStartRows = computedAllRows.filter(r => new Date(r.date).getTime() < startMs);
      if (beforeStartRows.length > 0) {
        bfBal = beforeStartRows[beforeStartRows.length - 1].balance;
      }

      // Rows within range
      const inRangeRows = computedAllRows.filter(r => {
        const time = new Date(r.date).getTime();
        return time >= startMs && time <= endMs;
      });

      if (bfBal !== 0 && startDate) {
        filtered = [
          {
            date: startDate,
            ref: 'B/F',
            description: 'Balance Brought Forward (Prior Transactions)',
            debit: bfBal > 0 ? bfBal : 0,
            credit: bfBal < 0 ? Math.abs(bfBal) : 0,
            balance: bfBal,
            isBroughtForward: true,
          },
          ...inRangeRows,
        ];
      } else {
        filtered = inRangeRows;
      }
    } else {
      filtered = computedAllRows;
    }

    // Calculate totals for displayed view
    const totalDebit = filtered.reduce((acc, r) => acc + (r.isBroughtForward ? 0 : r.debit), 0);
    const totalCredit = filtered.reduce((acc, r) => acc + (r.isBroughtForward ? 0 : r.credit), 0);
    const closingBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : bfBal;

    return {
      allRows: computedAllRows,
      displayedRows: filtered,
      broughtForwardBalance: bfBal,
      totals: {
        totalDebit,
        totalCredit,
        closingBalance,
      },
    };
  }, [customer, sales, payments, startDate, endDate]);

  if (!isOpen || !customer) return null;

  const handlePrint = () => {
    setIsPrinting(true);
    // Allow DOM to flush rendering before invoking window.print()
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const setPresetRange = (preset: 'month' | '30days' | 'year') => {
    const today = new Date();
    const endStr = getTodayDateString();
    
    if (preset === 'month') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      setStartDate(`${year}-${month}-01`);
      setEndDate(endStr);
    } else if (preset === '30days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 30);
      const pastStr = past.toISOString().slice(0, 10);
      setStartDate(pastStr);
      setEndDate(endStr);
    } else if (preset === 'year') {
      const year = today.getFullYear();
      setStartDate(`${year}-01-01`);
      setEndDate(endStr);
    }
  };

  const currentOutstanding = totals.closingBalance;
  const isAdvance = currentOutstanding < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh] my-auto">
        
        {/* Controls Bar (Always hidden during print) */}
        <div className="no-print flex flex-col gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Customer Ledger Statement</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {customer.name}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Full transaction history, running balance, and account statement
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                title="Print Statement or Save as PDF"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'Preparing...' : 'Print / Save PDF'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                title="Close Statement"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Date Filters Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Filter Period:
              </span>
              <button
                onClick={handleResetFilter}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  !startDate && !endDate
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                All Time ({allRows.length})
              </button>
              <button
                onClick={() => setPresetRange('month')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                This Month
              </button>
              <button
                onClick={() => setPresetRange('30days')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setPresetRange('year')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                This Year
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                placeholder="From Date"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                placeholder="To Date"
              />
              {(startDate || endDate) && (
                <button
                  onClick={handleResetFilter}
                  className="text-xs text-slate-400 hover:text-rose-400 underline font-semibold ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Printable Statement Sheet Area (Visible on screen and on print) */}
        <div 
          className="overflow-y-auto p-6 sm:p-8 bg-white text-slate-900 flex-1" 
          id="printable-ledger"
        >
          {/* Company Branding & Statement Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-4">
            <div className="flex items-start gap-4">
              <img 
                src="/assets/logo.png" 
                alt="Perfect Shine Chemicals" 
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" 
              />
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  PERFECT SHINE CHEMICALS
                </h2>
                <p className="text-xs text-slate-600 font-semibold mt-1">
                  Industrial & Commercial Cleaning Solutions Manufacturer
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore, Pakistan
                </p>
                <p className="text-xs text-slate-700 font-semibold mt-0.5">
                  Tel / WhatsApp: <span className="font-mono font-bold text-slate-900">0327-4549485</span>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider mb-1.5">
                Customer Ledger Statement
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Statement Date: <span className="font-bold text-slate-800">{formatDateTime(new Date().toISOString())}</span>
              </p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Period: <span className="font-bold text-slate-800">
                  {startDate && endDate 
                    ? `${formatDate(startDate)} to ${formatDate(endDate)}`
                    : startDate 
                    ? `From ${formatDate(startDate)}`
                    : endDate 
                    ? `Up to ${formatDate(endDate)}`
                    : 'All Historical Records'}
                </span>
              </p>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                Customer ID: <span className="font-bold text-slate-800">{customer.id.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
          </div>

          {/* Customer Profile & Balance Snapshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Customer / Account Holder:</p>
              <p className="text-base font-black text-slate-900 mt-0.5">{customer.name}</p>
              <p className="text-slate-600 font-medium mt-0.5">
                Phone: <span className="font-mono font-bold text-slate-800">{customer.phone || 'N/A'}</span>
              </p>
              <p className="text-slate-600 mt-0.5 truncate">
                Address: <span className="font-semibold text-slate-800">{customer.address || '-'}, {customer.city || 'Lahore'}</span>
              </p>
              <p className="text-slate-600 mt-0.5">
                Customer Type: <span className="font-bold uppercase text-slate-900">{customer.customer_type}</span>
              </p>
            </div>

            <div className="sm:text-right flex flex-col justify-between sm:items-end">
              <div>
                <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Credit Facility:</p>
                <p className="text-slate-700 font-medium mt-0.5">
                  Limit: <span className="font-mono font-bold text-slate-900">{formatPKR(customer.credit_limit)}</span>
                </p>
              </div>

              <div className="mt-3 sm:mt-0 p-3 rounded-lg border bg-white shadow-sm inline-block sm:text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Current Account Position
                </span>
                <p className={`text-xl font-black font-mono leading-tight mt-0.5 ${
                  isAdvance 
                    ? 'text-cyan-700' 
                    : currentOutstanding > 0 
                    ? 'text-rose-700' 
                    : 'text-emerald-700'
                }`}>
                  {formatPKR(Math.abs(currentOutstanding))}
                </p>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isAdvance 
                    ? 'text-cyan-700' 
                    : currentOutstanding > 0 
                    ? 'text-rose-700' 
                    : 'text-emerald-700'
                }`}>
                  {isAdvance 
                    ? '● Customer Advance Balance (Credit)' 
                    : currentOutstanding > 0 
                    ? '● Outstanding Due (Receivable)' 
                    : '● Account Fully Settled'}
                </span>
              </div>
            </div>
          </div>

          {/* Statement Financial Metrics Cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-slate-700" /> Total Invoiced (Debits)
              </span>
              <p className="text-base font-black font-mono text-slate-900 mt-1">
                {formatPKR(totals.totalDebit)}
              </p>
              <p className="text-[10px] text-slate-500">Sales value in period</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 text-emerald-700" /> Total Paid (Credits)
              </span>
              <p className="text-base font-black font-mono text-emerald-700 mt-1">
                {formatPKR(totals.totalCredit)}
              </p>
              <p className="text-[10px] text-slate-500">Receipts & payments received</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-700" /> Net Balance
              </span>
              <p className={`text-base font-black font-mono mt-1 ${
                isAdvance ? 'text-cyan-700' : currentOutstanding > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {formatPKR(Math.abs(currentOutstanding))}
              </p>
              <p className="text-[10px] text-slate-500">
                {isAdvance ? 'Advance Credit' : currentOutstanding > 0 ? 'Receivable Due' : 'Zero Balance'}
              </p>
            </div>
          </div>

          {/* Chronological Ledger Transactions Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2.5 px-3 border-r border-slate-800">Date</th>
                  <th className="py-2.5 px-3 border-r border-slate-800">Ref / Voucher #</th>
                  <th className="py-2.5 px-3 border-r border-slate-800">Transaction Details</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-800">Debit (+) PKR</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-800">Credit (-) PKR</th>
                  <th className="py-2.5 px-3 text-right">Running Balance PKR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                      No transaction records found for this customer in the selected date period.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row, idx) => (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-50 transition-colors ${
                        row.isBroughtForward ? 'bg-amber-50/70 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {row.ref}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 border-r border-slate-200">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{row.description}</span>
                          {row.method && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase font-semibold">
                              {row.method}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {row.debit > 0 ? formatPKR(row.debit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 border-r border-slate-200 whitespace-nowrap">
                        {row.credit > 0 ? formatPKR(row.credit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black whitespace-nowrap">
                        <span className={row.balance > 0 ? 'text-amber-800' : row.balance < 0 ? 'text-cyan-800' : 'text-emerald-800'}>
                          {formatPKR(Math.abs(row.balance))} {row.balance < 0 ? '(Adv)' : ''}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Grand Total Summary Footer */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold text-slate-900 text-xs">
                  <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider font-black border-r border-slate-300">
                    Period Total / Closing Balance:
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-slate-950 border-r border-slate-300 whitespace-nowrap">
                    {formatPKR(totals.totalDebit)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-800 border-r border-slate-300 whitespace-nowrap">
                    {formatPKR(totals.totalCredit)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-sm whitespace-nowrap">
                    <span className={totals.closingBalance > 0 ? 'text-rose-800' : totals.closingBalance < 0 ? 'text-cyan-800' : 'text-emerald-800'}>
                      {formatPKR(Math.abs(totals.closingBalance))} {totals.closingBalance < 0 ? '(Advance)' : totals.closingBalance > 0 ? '(Due)' : ''}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Official Verification & Signatures Block */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-xs">
            <div className="flex flex-col sm:flex-row justify-between items-end gap-8 pt-6">
              <div className="w-full sm:w-64 border-t border-slate-400 pt-2 text-center">
                <p className="font-bold text-slate-800">Prepared By (Accounts Officer)</p>
                <p className="text-[10px] text-slate-500">Perfect Shine Chemicals</p>
              </div>

              <div className="w-full sm:w-64 border-t border-slate-400 pt-2 text-center">
                <p className="font-bold text-slate-800">Customer Acceptance & Signature</p>
                <p className="text-[10px] text-slate-500">Stamp / Received By</p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 text-[10px] text-slate-500 text-center">
              This is a computer-generated statement of accounts issued by Perfect Shine Chemicals Management System.
              Any discrepancies must be notified to our accounts department within 7 business days.
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden during print) */}
        {isOwner && onArchive && (
          <div className="no-print p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onArchive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                hasHistory
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
              }`}
            >
              {hasHistory ? (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Customer</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Customer</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Close Statement
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
