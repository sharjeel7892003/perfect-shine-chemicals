import React from 'react';
import { Sale } from '../../types';
import { formatPKR, formatDate, formatDateTime } from '../../utils/formatters';
import { Printer, Download, X, Sparkles, CheckCircle2, Trash2 } from 'lucide-react';

interface InvoiceModalProps {
  sale: Sale | null;
  onClose: () => void;
  onDelete?: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ sale, onClose, onDelete }) => {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const remainingBalance = Math.max(0, sale.total_amount - sale.amount_paid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Controls Bar (Hidden during print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Tax Invoice Preview</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
              {sale.invoice_number}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold text-xs transition-colors"
                title="Delete invoice and reverse stock/balances"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete & Reverse</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="overflow-y-auto p-6 sm:p-8 bg-white text-slate-900" id="printable-invoice">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm">
                  PS
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  PERFECT SHINE CHEMICALS
                </h2>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1">
                Industrial & Commercial Cleaning Solutions Manufacturer
              </p>
              <p className="text-xs text-slate-500">
                Sundar Industrial Area / Multan Road, Lahore, Pakistan
              </p>
              <p className="text-xs text-slate-500 font-mono">
                Phone: +92 300 8400001 / +92 42 35889900 | NTN: 4892109-7
              </p>
            </div>

            <div className="text-left sm:text-right">
              <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider mb-2">
                Sales Tax Invoice
              </div>
              <p className="text-sm font-bold font-mono text-slate-900">
                Invoice #: {sale.invoice_number}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Date: {formatDate(sale.date)}
              </p>
              <p className="text-xs text-slate-600">
                Issued By: {sale.salesperson_name || 'Haji M. Sharjeel'}
              </p>
            </div>
          </div>

          {/* Billed To */}
          <div className="grid grid-cols-2 gap-4 my-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Customer / Bill To:</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{sale.customer_name}</p>
              <p className="text-slate-600 mt-0.5">Commercial / Retail Cleaning Client</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Payment Information:</p>
              <p className="font-semibold text-slate-800 capitalize mt-1">
                Method: {sale.payment_method}
              </p>
              <p className="font-semibold capitalize text-slate-800">
                Status: <span className={sale.payment_status === 'paid' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{sale.payment_status}</span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-xs mb-6">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5">#</th>
                <th className="py-2.5">Item & Packaging Description</th>
                <th className="py-2.5 text-center">Pack Qty</th>
                <th className="py-2.5 text-center">Base Volume/Weight</th>
                <th className="py-2.5 text-right">Unit Rate</th>
                <th className="py-2.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((item, idx) => (
                <tr key={idx} className="py-2">
                  <td className="py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2.5 font-medium text-slate-900">
                    <div>
                      <span>{item.product_name}</span>
                      {item.pack_size_name && (
                        <span className="block text-[11px] text-emerald-700 font-normal">
                          Packaging: {item.pack_size_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-mono font-bold">{item.quantity}</td>
                  <td className="py-2.5 text-center font-mono text-slate-600">
                    {item.base_quantity || item.quantity} {item.unit || 'L'}
                  </td>
                  <td className="py-2.5 text-right font-mono">{formatPKR(item.unit_price)}</td>
                  <td className="py-2.5 text-right font-mono font-bold">{formatPKR(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Calculation Summary */}
          <div className="flex justify-end pt-4 border-t-2 border-slate-200">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">{formatPKR(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount Applied:</span>
                  <span className="font-mono font-semibold">- {formatPKR(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-slate-950 border-t border-slate-300 pt-2">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-700">{formatPKR(sale.total_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-semibold pt-1">
                <span>Amount Paid:</span>
                <span className="font-mono">{formatPKR(sale.amount_paid)}</span>
              </div>
              {remainingBalance > 0 && (
                <div className="flex justify-between text-amber-700 font-bold bg-amber-50 p-1.5 rounded border border-amber-200">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatPKR(remainingBalance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-[10px] text-slate-500">
            <div>
              <p className="font-bold text-slate-700 uppercase">Payment & Terms:</p>
              <p>• Goods once sold are non-returnable without batch authorization.</p>
              <p>• Make all cheques / online transfers payable to "Perfect Shine Chemicals".</p>
              <p>• For JazzCash / EasyPaisa verifications, WhatsApp receipt to 0300-8400001.</p>
            </div>
            <div className="text-right flex flex-col justify-end">
              <div className="border-t border-slate-400 w-40 ml-auto pt-1 text-center text-slate-700 font-semibold">
                Authorized Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
