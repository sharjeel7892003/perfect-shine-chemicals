import React, { useState } from 'react';
import { 
  X, 
  FileCheck, 
  Receipt, 
  Building2, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Layers
} from 'lucide-react';
import { Quotation, Sale, SaleItem, PaymentStatus, PaymentMethod } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatPKR, formatDate, getTodayDateString, formatBoxBreakdown } from '../../utils/formatters';

interface ConvertToInvoiceModalProps {
  quotation: Quotation;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sale: Sale) => void;
}

export const ConvertToInvoiceModal: React.FC<ConvertToInvoiceModalProps> = ({
  quotation,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { customers, createSale, updateQuotationStatus } = useApp();
  const { currentUser } = useAuth();

  const isStandard = quotation.quotation_type === 'standard_unit_price';

  // Customer selection
  const matchedCustomer = customers.find(c => 
    c.id === quotation.customer_id || 
    c.name.trim().toLowerCase() === quotation.customer_name.trim().toLowerCase()
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(matchedCustomer?.id || quotation.customer_id || '');
  const [invoiceDate, setInvoiceDate] = useState<string>(getTodayDateString());
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState<string>(`Converted from Quotation #${quotation.quotation_number}`);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate items and total amount
  const calculatedItems: SaleItem[] = quotation.items.map(item => {
    if (isStandard) {
      const ur = Number(item.unit_rate !== undefined ? item.unit_rate : (item.quoted_price_per_unit || 0));
      const qBottles = Math.max(1, Number(item.quantity_bottles || 1));
      const bpb = Number(item.bottles_per_box || 0);
      const subtotal = Number((qBottles * ur).toFixed(2));

      return {
        product_name: item.product_name,
        pack_size_name: item.size || 'Standard',
        quantity: qBottles,
        bottle_qty: qBottles,
        bottles_per_box: bpb > 0 ? bpb : undefined,
        box_qty: bpb > 0 ? Number((qBottles / bpb).toFixed(2)) : undefined,
        unit_price: ur,
        unit_cost: ur,
        base_quantity: qBottles,
        subtotal: subtotal,
      };
    }

    // Private Label items
    const quotedUnit = Number(item.quoted_price_per_unit || item.total_cost_per_unit || 0);
    return {
      product_name: item.product_name,
      pack_size_name: item.size || 'Standard',
      is_private_label: true,
      quantity: 1,
      bottle_qty: 1,
      unit_price: quotedUnit,
      unit_cost: Number(item.total_cost_per_unit || 0),
      base_quantity: 1,
      subtotal: quotedUnit,
    };
  });

  const subtotal = calculatedItems.reduce((sum, it) => sum + it.subtotal, 0);
  const totalAmount = subtotal;

  const handleStatusChange = (newStatus: PaymentStatus) => {
    setPaymentStatus(newStatus);
    if (newStatus === 'paid') {
      setAmountPaid(totalAmount);
    } else if (newStatus === 'unpaid' || newStatus === 'credit') {
      setAmountPaid(0);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const activeCustomer = customers.find(c => c.id === selectedCustomerId);
      const finalCustomerName = activeCustomer?.name || quotation.customer_name || 'Customer';

      const newSale = await createSale({
        customer_id: activeCustomer ? activeCustomer.id : undefined,
        customer_name: finalCustomerName,
        date: invoiceDate,
        items: calculatedItems,
        subtotal: subtotal,
        discount: 0,
        tax: 0,
        total_amount: totalAmount,
        amount_paid: Number(amountPaid || 0),
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        salesperson_id: currentUser?.id,
        salesperson_name: currentUser ? currentUser.name : 'Sharjeel Ahmad',
        invoice_type: isStandard ? 'standard' : 'private_label',
        is_private_label: !isStandard,
        client_brand_name: quotation.company_name || undefined,
        notes: notes.trim(),
      });

      // Update quotation status to accepted
      if (quotation.status !== 'accepted') {
        await updateQuotationStatus(quotation.id, 'accepted');
      }

      onSuccess(newSale);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to convert quotation to invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">
                Convert Quotation to Sales Invoice
              </h2>
              <p className="text-[11px] text-slate-400">
                Quotation #{quotation.quotation_number} • {quotation.customer_name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConvert} className="p-4 sm:p-5 space-y-4 text-xs text-slate-200">
          
          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quotation Summary Card */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-400 uppercase text-[10px]">
                {isStandard ? 'Standard Unit Price Proposal' : 'Private Label Proposal'}
              </span>
              <span className="font-mono font-bold text-white text-xs">
                {quotation.quotation_number}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {quotation.items.map((item, idx) => {
                const bpb = Number(item.bottles_per_box || 0);
                const ur = Number(item.unit_rate !== undefined ? item.unit_rate : (item.quoted_price_per_unit || 0));
                const qBottles = Number(item.quantity_bottles || 1);
                const lineTot = isStandard 
                  ? Number((qBottles * ur).toFixed(2)) 
                  : ur;

                return (
                  <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-white">{item.product_name}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        {item.size ? `(${item.size})` : ''}
                      </span>
                      {isStandard && (
                        <span className="text-[10px] text-cyan-400 ml-2 font-mono">
                          {qBottles} btls {bpb > 0 ? `(${formatBoxBreakdown(qBottles, bpb)})` : ''} @ {formatPKR(ur)}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatPKR(lineTot)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-300">Total Invoice Amount:</span>
              <span className="font-mono font-black text-emerald-400 text-sm">
                {formatPKR(totalAmount)}
              </span>
            </div>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="text-[11px] text-slate-400 font-semibold block mb-1">
              Link to Registered Customer:
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">-- Unregistered / Walk-in ({quotation.customer_name}) --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} • {c.phone} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                Invoice Date:
              </label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                Payment Status:
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => handleStatusChange(e.target.value as PaymentStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold capitalize focus:border-emerald-500 focus:outline-none"
              >
                <option value="unpaid">Unpaid (Receivable)</option>
                <option value="credit">Credit (On Account)</option>
                <option value="paid">Paid in Full</option>
                <option value="partial">Partial Payment</option>
              </select>
            </div>
          </div>

          {/* Payment Method & Amount Paid (if paid/partial) */}
          {(paymentStatus === 'paid' || paymentStatus === 'partial') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div>
                <label className="text-[11px] text-emerald-400 font-semibold block mb-1">
                  Payment Method:
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold capitalize focus:border-emerald-500 focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-emerald-400 font-semibold block mb-1">
                  Amount Received (PKR):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountPaid === 0 ? '' : amountPaid}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-white font-mono font-bold text-right focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Invoice Notes */}
          <div>
            <label className="text-[11px] text-slate-400 font-semibold block mb-1">
              Invoice Remarks / Notes:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating Invoice...' : 'Generate Sales Invoice'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
