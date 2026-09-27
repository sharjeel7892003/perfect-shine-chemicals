import React from 'react';
import { SalesReturn } from '../../types';
import { formatPKR, formatDate, formatDateTime } from '../../utils/formatters';
import { Printer, X, Trash2, RotateCcw, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CreditNoteModalProps {
  creditNote: SalesReturn | null;
  onClose: () => void;
  onDelete?: () => void;
}

export const CreditNoteModal: React.FC<CreditNoteModalProps> = ({ creditNote, onClose, onDelete }) => {
  const { allUsers } = useAuth();
  if (!creditNote) return null;

  const handlePrint = () => {
    window.print();
  };

  const getIssuedByName = () => {
    if (creditNote.created_by) {
      const match = allUsers.find(u => u.id === creditNote.created_by);
      if (match) return match.name;
    }
    return creditNote.created_by_name || 'Staff';
  };

  const getSettlementLabel = () => {
    switch (creditNote.refund_method) {
      case 'cash_refund':
        return `Cash Refund Paid Out (${(creditNote.payment_method || 'cash').toUpperCase()})`;
      case 'customer_advance':
        return 'Customer Advance / Store Credit';
      case 'reduce_receivable':
      default:
        return 'Reduced Customer Outstanding Balance';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Controls Bar (Hidden during print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>Credit Note Preview</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-mono font-bold">
              {creditNote.credit_note_number}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold text-xs transition-colors"
                title="Reverse sales return, re-deduct stock and adjust customer ledger"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete & Reverse</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-md transition-colors"
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

        {/* Printable Credit Note Sheet */}
        <div className="overflow-y-auto p-6 sm:p-8 bg-white text-slate-900" id="printable-credit-note">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-6 gap-4">
            <div className="flex items-start gap-3.5">
              <img 
                src="/assets/logo.png" 
                alt="Perfect Shine Chemicals" 
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" 
              />
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  PERFECT SHINE CHEMICALS
                </h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Industrial & Commercial Cleaning Solutions Manufacturer
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore, Pakistan
                </p>
                <p className="text-xs text-slate-700 font-medium mt-0.5">
                  Contact: <span className="font-mono font-bold text-slate-900">0327-4549485</span>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="inline-block px-3 py-1 rounded bg-rose-600 text-white text-xs font-black uppercase tracking-wider mb-2">
                Credit Note / Sales Return
              </div>
              <p className="text-sm font-bold font-mono text-slate-900">
                CRN #: {creditNote.credit_note_number}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Original Invoice #: <span className="font-mono font-bold text-slate-900">{creditNote.invoice_number}</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Date: {formatDate(creditNote.date)}
              </p>
              <p className="text-xs text-slate-700 font-medium">
                Authorized By: <span className="font-semibold text-slate-900">{getIssuedByName()}</span>
              </p>
            </div>
          </div>

          {/* Customer & Settlement Information */}
          <div className="grid grid-cols-2 gap-4 my-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Customer / Account Holder:</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{creditNote.customer_name}</p>
              {creditNote.reason && (
                <p className="text-rose-700 font-semibold mt-1">
                  Reason for Return: <span className="font-normal text-slate-800">{creditNote.reason}</span>
                </p>
              )}
              {creditNote.notes && (
                <p className="text-slate-600 text-[11px] mt-0.5 italic">
                  Notes: {creditNote.notes}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Financial Settlement Method:</p>
              <p className="font-bold text-slate-900 mt-1">
                {getSettlementLabel()}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Original Sale Reference: <span className="font-mono font-bold">{creditNote.invoice_number}</span>
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Inventory Stock: <span className="font-bold text-emerald-800">Restored to warehouse</span>
              </p>
            </div>
          </div>

          {/* Returned Items Table */}
          <table className="w-full text-left text-xs mb-6">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5">#</th>
                <th className="py-2.5">Returned Item & Packaging</th>
                <th className="py-2.5 text-center">Returned Qty</th>
                <th className="py-2.5 text-center">Restored Volume/Weight</th>
                <th className="py-2.5 text-right">Invoiced Rate</th>
                <th className="py-2.5 text-right">Credit Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creditNote.items.map((item, idx) => (
                <tr key={idx} className="py-2">
                  <td className="py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2.5 font-medium text-slate-900">
                    <div>
                      <span>{item.product_name}</span>
                      {item.pack_size_name && (
                        <span className="block text-[11px] text-rose-700 font-normal">
                          Packaging: {item.pack_size_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-mono font-bold text-rose-600">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 text-center font-mono text-slate-600">
                    +{item.base_quantity || item.quantity} {item.unit || 'L'}
                  </td>
                  <td className="py-2.5 text-right font-mono">{formatPKR(item.unit_price)}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                    {formatPKR(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-800">
                <td colSpan={4}></td>
                <td className="py-3 text-right font-black uppercase text-slate-900 text-xs">Total Credit Allowed:</td>
                <td className="py-3 text-right font-mono text-base font-black text-rose-600 whitespace-nowrap">
                  {formatPKR(creditNote.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Official Verification & Signatures Block */}
          <div className="mt-10 pt-4 border-t border-slate-200 text-xs">
            <div className="flex flex-col sm:flex-row justify-between items-end gap-8 pt-8">
              <div className="w-full sm:w-64 border-t border-slate-400 pt-2 text-center">
                <p className="font-bold text-slate-800">Authorized Officer (Factory Accounts)</p>
                <p className="text-[10px] text-slate-500">Perfect Shine Chemicals</p>
              </div>

              <div className="w-full sm:w-64 border-t border-slate-400 pt-2 text-center">
                <p className="font-bold text-slate-800">Customer Signature & Acknowledgment</p>
                <p className="text-[10px] text-slate-500">Stamp / Received By</p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 text-[10px] text-slate-500 text-center">
              This credit note certifies that the goods specified above have been received back into warehouse stock and customer account has been credited accordingly.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
