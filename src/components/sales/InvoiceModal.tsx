import React from 'react';
import { Sale } from '../../types';
import { formatPKR, formatDate } from '../../utils/formatters';
import { Printer, X, Trash2, Award } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { printElement } from '../../utils/printHelper';

interface InvoiceModalProps {
  sale: Sale | null;
  onClose: () => void;
  onDelete?: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ sale, onClose, onDelete }) => {
  const { allUsers } = useAuth();
  if (!sale) return null;

  const handlePrint = () => {
    printElement('printable-invoice', `Invoice_${sale.invoice_number}`);
  };

  // Dynamically resolve current staff name from profiles table by salesperson_id
  const getIssuedByName = () => {
    if (sale.salesperson_id) {
      const match = allUsers.find(u => u.id === sale.salesperson_id);
      if (match) return match.name;
    }
    return sale.salesperson_name || 'Staff';
  };

  // Determine if this is a Private Label invoice
  const isPrivateLabel = Boolean(
    sale.invoice_type === 'private_label' || 
    sale.is_private_label || 
    sale.items.some(i => i.is_private_label) ||
    (sale.notes && sale.notes.includes('<!--PL_DATA:'))
  );

  // Extract client brand name if private label
  const clientBrand = sale.client_brand_name || (() => {
    if (sale.notes) {
      const match = sale.notes.match(/\[Private Label Manufacturing for:\s*(.*?)\]/i);
      if (match) return match[1].trim();
    }
    return '';
  })();

  // Calculate bottles and labour
  const totalBottles = sale.labour_bottle_qty !== undefined
    ? Number(sale.labour_bottle_qty)
    : sale.items.reduce((sum, it) => sum + Number(it.bottle_qty || it.quantity || 0), 0);

  const labourRate = sale.labour_rate_per_bottle !== undefined
    ? Number(sale.labour_rate_per_bottle)
    : 3.5;

  const labourAmount = sale.labour_total_amount !== undefined
    ? Number(sale.labour_total_amount)
    : Number((totalBottles * labourRate).toFixed(2));

  const productsSubtotal = sale.items.reduce((sum, it) => sum + Number(it.subtotal || 0), 0);

  const advanceApplied = Number(sale.advance_amount_applied || 0);
  const remainingBalance = Math.max(0, sale.total_amount - sale.amount_paid);

  const advanceDateText = sale.advance_received_date 
    ? ` (dated ${formatDate(sale.advance_received_date)})` 
    : '';

  // Clean note string for human presentation (omitting raw metadata tag)
  const displayNotes = (sale.notes || '')
    .replace(/<!--PL_DATA:.*?-->/g, '')
    .trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Controls Bar (Hidden during print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">Invoice Preview</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
              {sale.invoice_number}
            </span>
            {isPrivateLabel && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-400" />
                <span>Private Label Invoice</span>
              </span>
            )}
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
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
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-5 gap-4">
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
              <div className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mb-2 ${
                isPrivateLabel ? 'bg-amber-600 text-white' : 'bg-slate-900 text-white'
              }`}>
                {isPrivateLabel ? 'Private Label Invoice' : 'Commercial Invoice'}
              </div>
              <p className="text-sm font-bold font-mono text-slate-900">
                Invoice #: {sale.invoice_number}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Date: {formatDate(sale.date)}
              </p>
              <p className="text-xs text-slate-700 font-medium">
                Issued By: <span className="font-semibold text-slate-900">{getIssuedByName()}</span>
              </p>
            </div>
          </div>

          {/* Prominent Private Label Client Banner */}
          {isPrivateLabel && clientBrand && (
            <div className="my-4 p-3 bg-amber-50 rounded-xl border border-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-amber-700 text-lg">🏷️</span>
                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">
                    Contract Manufacturing Note
                  </span>
                  <p className="text-sm font-black text-slate-950">
                    Private Label Manufacturing for: <span className="text-amber-800 uppercase tracking-wide underline font-extrabold">{clientBrand}</span>
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-200/70 text-amber-900 font-bold text-[11px] font-mono border border-amber-300">
                OEM Production
              </span>
            </div>
          )}

          {/* Billed To & Payment Meta */}
          <div className="grid grid-cols-2 gap-4 my-5 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Customer / Bill To:</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{sale.customer_name}</p>
              <p className="text-slate-600 mt-0.5">
                {isPrivateLabel ? `Private Label Client (${clientBrand || sale.customer_name})` : 'Commercial / Retail Cleaning Client'}
              </p>
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

          {/* Table Render: Dedicated Private Label Format vs Standard Retail Format */}
          {isPrivateLabel ? (
            /* DEDICATED PRIVATE LABEL INVOICE TABLE */
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800 bg-slate-100 text-slate-700 font-black uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Qty (Liters)</th>
                    <th className="py-2.5 px-3 text-center">Qty (Bottles)</th>
                    <th className="py-2.5 px-3 text-center">Qty (Box)</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sale.items.map((item, idx) => {
                    const liters = Number((item.liters_qty ?? item.base_quantity ?? 0).toFixed(2));
                    const bottles = Number(item.bottle_qty ?? item.quantity ?? 0);
                    const bPerBox = item.bottles_per_box !== undefined && item.bottles_per_box > 0 ? item.bottles_per_box : undefined;
                    const boxes = item.box_qty !== undefined 
                      ? item.box_qty 
                      : (bPerBox ? Number((bottles / bPerBox).toFixed(2)) : '-');
                    const rateL = item.rate_per_liter !== undefined 
                      ? item.rate_per_liter 
                      : (liters > 0 ? Number((item.subtotal / liters).toFixed(2)) : item.unit_price);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>
                            <span>{item.product_name}</span>
                            {item.pack_size_name && (
                              <span className="block text-[11px] text-slate-600 font-normal">
                                Pack Size: {item.pack_size_name} {item.size_in_base_unit ? `(${item.size_in_base_unit}L)` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                          {formatPKR(rateL)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {liters.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                          {bottles}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                          {boxes} {bPerBox ? <span className="text-[10px] text-slate-500">({bPerBox}/box)</span> : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                          {formatPKR(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* AUTOMATIC LABOUR LINE */}
                  <tr className="bg-amber-50/80 border-t-2 border-slate-300 font-semibold text-slate-900">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>Labour</span>
                        <span className="text-[10px] text-slate-600 font-normal">(Packing & Bottling)</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                      {formatPKR(labourRate)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">-</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                      {totalBottles}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">-</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-amber-950">
                      {formatPKR(labourAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            /* STANDARD RETAIL INVOICE TABLE */
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-2">#</th>
                    <th className="py-2.5 px-2">Item & Packaging Description</th>
                    <th className="py-2.5 px-2 text-center">Pack Qty</th>
                    <th className="py-2.5 px-2 text-center">Base Volume/Weight</th>
                    <th className="py-2.5 px-2 text-right">Unit Rate</th>
                    <th className="py-2.5 px-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-2 font-medium text-slate-900">
                        <div>
                          <span>{item.product_name}</span>
                          {item.pack_size_name && (
                            <span className="block text-[11px] text-emerald-700 font-normal">
                              Packaging: {item.pack_size_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold">{item.quantity}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                        {item.base_quantity || item.quantity} {item.unit || 'L'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">{formatPKR(item.unit_price)}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold">{formatPKR(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Calculation Summary */}
          <div className="flex justify-end pt-4 border-t-2 border-slate-200">
            <div className="w-72 space-y-1.5 text-xs">
              {isPrivateLabel && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Products Subtotal:</span>
                    <span className="font-mono font-semibold">{formatPKR(productsSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Packing Labour ({totalBottles} bottles):</span>
                    <span className="font-mono font-semibold">{formatPKR(labourAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Invoice Subtotal:</span>
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

              {/* Advance Received line */}
              {advanceApplied > 0 && (
                <div className="flex justify-between text-cyan-800 font-bold bg-cyan-50 p-1.5 rounded border border-cyan-200">
                  <span>Advance Received{advanceDateText}:</span>
                  <span className="font-mono">- {formatPKR(advanceApplied)}</span>
                </div>
              )}

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

          {/* Notes display */}
          {displayNotes && (
            <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              <span className="font-bold text-slate-700 block mb-0.5">Order / Delivery Notes:</span>
              <p className="whitespace-pre-wrap">{displayNotes}</p>
            </div>
          )}

          {/* Terms & Signature */}
          <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-[10px] text-slate-500">
            <div>
              <p className="font-bold text-slate-700 uppercase">Payment & Terms:</p>
              <p>• Goods once sold are non-returnable without batch authorization.</p>
              <p>• Make all cheques / online transfers payable to "Perfect Shine Chemicals".</p>
              <p>• For JazzCash / EasyPaisa verifications, WhatsApp receipt to 0327-4549485.</p>
            </div>
            <div className="text-right flex flex-col justify-end">
              <div className="border-t border-slate-400 w-44 ml-auto pt-1 text-center text-slate-700 font-semibold">
                Authorized Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
