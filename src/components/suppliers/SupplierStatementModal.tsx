import React, { useState, useMemo } from 'react';
import { Supplier, Purchase, Payment } from '../../types';
import { formatPKR, formatDate, formatDateTime, getTodayDateString } from '../../utils/formatters';
import { 
  Printer, 
  X, 
  Calendar, 
  Archive, 
  Trash2, 
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet
} from 'lucide-react';

interface SupplierStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  purchases: Purchase[];
  payments: Payment[];
  onArchive?: () => void;
  onDelete?: () => void;
  hasHistory?: boolean;
  isOwner?: boolean;
}

export interface SupplierLedgerRow {
  date: string;
  ref: string;
  description: string;
  method?: string;
  debit: number;   // Payment made decreases factory payable
  credit: number;  // Purchase bill increases factory payable
  balance: number; // Running balance
  isBroughtForward?: boolean;
}

export const SupplierStatementModal: React.FC<SupplierStatementModalProps> = ({
  isOpen,
  onClose,
  supplier,
  purchases,
  payments,
  onArchive,
  onDelete,
  hasHistory,
  isOwner,
}) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const { allRows, displayedRows, totals } = useMemo(() => {
    if (!supplier) {
      return {
        allRows: [],
        displayedRows: [],
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

    const suppPurchases = purchases.filter(p => p.supplier_id === supplier.id);
    suppPurchases.forEach(po => {
      rawRows.push({
        date: po.date,
        ref: po.invoice_number,
        description: `Purchase Order (${po.items?.map(i => i.product_or_material_name).join(', ') || 'Items'})`,
        debit: 0,
        credit: Number(po.total_amount || 0),
      });

      if (Number(po.amount_paid || 0) > 0) {
        rawRows.push({
          date: po.date,
          ref: `${po.invoice_number} (Paid)`,
          description: `Disbursement at purchase order entry`,
          method: po.payment_method,
          debit: Number(po.amount_paid || 0),
          credit: 0,
        });
      }
    });

    const suppPayments = payments.filter(
      p => p.supplier_id === supplier.id && p.related_to === 'supplier_balance'
    );
    suppPayments.forEach(pay => {
      rawRows.push({
        date: pay.date,
        ref: pay.transaction_ref || pay.reference_no || 'DISB',
        description: pay.notes || 'Supplier settlement payment',
        method: pay.payment_method,
        debit: Number(pay.amount || 0),
        credit: 0,
      });
    });

    if (rawRows.length === 0 && Number(supplier.current_balance || 0) !== 0) {
      const startBal = Number(supplier.current_balance || 0);
      rawRows.push({
        date: supplier.created_at || new Date().toISOString(),
        ref: 'OPENING',
        description: 'Account Opening / Starting Payable Balance',
        debit: startBal < 0 ? Math.abs(startBal) : 0,
        credit: startBal > 0 ? startBal : 0,
      });
    }

    rawRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const computedAllRows: SupplierLedgerRow[] = rawRows.map(r => {
      running = running + r.credit - r.debit;
      return {
        ...r,
        balance: running,
      };
    });

    let bfBal = 0;
    let filtered: SupplierLedgerRow[] = [];

    if (startDate || endDate) {
      const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : -Infinity;
      const endMs = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

      const beforeStartRows = computedAllRows.filter(r => new Date(r.date).getTime() < startMs);
      if (beforeStartRows.length > 0) {
        bfBal = beforeStartRows[beforeStartRows.length - 1].balance;
      }

      const inRangeRows = computedAllRows.filter(r => {
        const time = new Date(r.date).getTime();
        return time >= startMs && time <= endMs;
      });

      if (bfBal !== 0 && startDate) {
        filtered = [
          {
            date: startDate,
            ref: 'B/F',
            description: 'Payable Balance Brought Forward (Prior Transactions)',
            debit: bfBal < 0 ? Math.abs(bfBal) : 0,
            credit: bfBal > 0 ? bfBal : 0,
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

    const totalDebit = filtered.reduce((acc, r) => acc + (r.isBroughtForward ? 0 : r.debit), 0);
    const totalCredit = filtered.reduce((acc, r) => acc + (r.isBroughtForward ? 0 : r.credit), 0);
    const closingBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : bfBal;

    return {
      allRows: computedAllRows,
      displayedRows: filtered,
      totals: {
        totalDebit,
        totalCredit,
        closingBalance,
      },
    };
  }, [supplier, purchases, payments, startDate, endDate]);

  if (!isOpen || !supplier) return null;

  const handlePrint = () => {
    setIsPrinting(true);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh] my-auto">
        
        {/* Controls Bar (Always hidden during print) */}
        <div className="no-print flex flex-col gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Supplier Ledger Statement</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {supplier.name}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Full purchase bills, disbursements, and factory payable statement
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

        {/* Printable Statement Sheet Area */}
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
                Supplier Payable Statement
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
                Vendor ID: <span className="font-bold text-slate-800">{supplier.id.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
          </div>

          {/* Supplier Profile & Balance Snapshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Supplier / Vendor:</p>
              <p className="text-base font-black text-slate-900 mt-0.5">{supplier.name}</p>
              <p className="text-slate-600 font-medium mt-0.5">
                Phone: <span className="font-mono font-bold text-slate-800">{supplier.phone || 'N/A'}</span>
              </p>
              <p className="text-slate-600 mt-0.5">
                Raw Material / Specialty: <span className="font-bold text-slate-900">{supplier.raw_material_type || '-'}</span>
              </p>
              <p className="text-slate-600 mt-0.5 truncate">
                Address: <span className="font-semibold text-slate-800">{supplier.address || '-'}, {supplier.city || 'Lahore'}</span>
              </p>
            </div>

            <div className="sm:text-right flex flex-col justify-between sm:items-end">
              <div className="p-3 rounded-lg border bg-white shadow-sm inline-block sm:text-right mt-2 sm:mt-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Current Factory Payable
                </span>
                <p className={`text-xl font-black font-mono leading-tight mt-0.5 ${
                  totals.closingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {formatPKR(Math.max(0, totals.closingBalance))}
                </p>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  totals.closingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {totals.closingBalance > 0 ? '● Outstanding Factory Payable' : '● Account Fully Settled'}
                </span>
              </div>
            </div>
          </div>

          {/* Statement Financial Metrics Cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-slate-700" /> Total Billed (Credits)
              </span>
              <p className="text-base font-black font-mono text-slate-900 mt-1">
                {formatPKR(totals.totalCredit)}
              </p>
              <p className="text-[10px] text-slate-500">Total purchase orders invoiced</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 text-emerald-700" /> Total Paid (Debits)
              </span>
              <p className="text-base font-black font-mono text-emerald-700 mt-1">
                {formatPKR(totals.totalDebit)}
              </p>
              <p className="text-[10px] text-slate-500">Disbursements made to vendor</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-rose-700" /> Net Payable Due
              </span>
              <p className={`text-base font-black font-mono mt-1 ${
                totals.closingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {formatPKR(Math.max(0, totals.closingBalance))}
              </p>
              <p className="text-[10px] text-slate-500">
                {totals.closingBalance > 0 ? 'Outstanding Payable' : 'Fully Settled'}
              </p>
            </div>
          </div>

          {/* Chronological Ledger Transactions Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2.5 px-3 border-r border-slate-800">Date</th>
                  <th className="py-2.5 px-3 border-r border-slate-800">Ref / PO #</th>
                  <th className="py-2.5 px-3 border-r border-slate-800">Transaction Details</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-800">Debit (-) Paid PKR</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-800">Credit (+) Billed PKR</th>
                  <th className="py-2.5 px-3 text-right">Payable Balance PKR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                      No purchase order or payment records found for this supplier in the selected period.
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
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700 border-r border-slate-200 whitespace-nowrap">
                        {row.debit > 0 ? formatPKR(row.debit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {row.credit > 0 ? formatPKR(row.credit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black whitespace-nowrap">
                        <span className={row.balance > 0 ? 'text-rose-800' : 'text-emerald-800'}>
                          {formatPKR(Math.max(0, row.balance))}
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
                    Period Total / Closing Payable:
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-rose-800 border-r border-slate-300 whitespace-nowrap">
                    {formatPKR(totals.totalDebit)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-slate-950 border-r border-slate-300 whitespace-nowrap">
                    {formatPKR(totals.totalCredit)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-sm whitespace-nowrap">
                    <span className={totals.closingBalance > 0 ? 'text-rose-800' : 'text-emerald-800'}>
                      {formatPKR(Math.max(0, totals.closingBalance))}
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
                <p className="font-bold text-slate-800">Factory Accounts Officer</p>
                <p className="text-[10px] text-slate-500">Perfect Shine Chemicals</p>
              </div>

              <div className="w-full sm:w-64 border-t border-slate-400 pt-2 text-center">
                <p className="font-bold text-slate-800">Vendor / Supplier Acknowledgment</p>
                <p className="text-[10px] text-slate-500">Stamp & Authorized Signatory</p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 text-[10px] text-slate-500 text-center">
              This is a computer-generated statement of accounts issued by Perfect Shine Chemicals Management System.
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
                  <span>Archive Supplier</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Supplier</span>
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
