import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Sale, SalesReturn, SalesReturnItem, SalesReturnRefundOption, PaymentMethod, Profile } from '../../types';
import { formatPKR, formatDate, getTodayDateString } from '../../utils/formatters';
import { 
  RotateCcw, 
  X, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  DollarSign, 
  Layers, 
  Package, 
  Info,
  Calendar,
  Wallet,
  Receipt
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface ProcessReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (creditNote: SalesReturn) => void;
  initialSale?: Sale | null;
  initialCustomerId?: string;
}

export const ProcessReturnModal: React.FC<ProcessReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSale,
  initialCustomerId,
}) => {
  const { customers, sales, salesReturns, processSalesReturn } = useApp();
  const { currentUser } = useAuth();

  // Step 1: Selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>(getTodayDateString());

  // Step 2: Line items return quantity state: { [sale_item_index_or_id]: returnQty }
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});

  // Step 3: Reason & Notes
  const [returnReason, setReturnReason] = useState<string>('Damaged Goods');
  const [customReason, setCustomReason] = useState<string>('');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Step 4: Financial Refund Option
  const [refundMethod, setRefundMethod] = useState<SalesReturnRefundOption>('reduce_receivable');
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<PaymentMethod>('cash');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize from props if provided
  useEffect(() => {
    if (initialSale) {
      setSelectedSaleId(initialSale.id);
      if (initialSale.customer_id) {
        setSelectedCustomerId(initialSale.customer_id);
      }
    } else if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialSale, initialCustomerId, isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setReturnDate(getTodayDateString());
      setReturnQuantities({});
      setReturnReason('Damaged Goods');
      setCustomReason('');
      setReturnNotes('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Available sales for the selected customer
  const customerSales = useMemo(() => {
    if (!selectedCustomerId) return [];
    return sales
      .filter(s => s.customer_id === selectedCustomerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, selectedCustomerId]);

  // Selected sale object
  const selectedSale = useMemo(() => {
    return sales.find(s => s.id === selectedSaleId) || null;
  }, [sales, selectedSaleId]);

  // Compute previously returned quantities for items in selectedSale
  const previouslyReturnedMap = useMemo(() => {
    if (!selectedSale) return {};
    const map: Record<string, number> = {};

    const linkedReturns = salesReturns.filter(
      r => r.sale_id === selectedSale.id || r.invoice_number === selectedSale.invoice_number
    );

    linkedReturns.forEach(ret => {
      ret.items.forEach(retItem => {
        const key = retItem.sale_item_id || retItem.product_name;
        map[key] = (map[key] || 0) + Number(retItem.quantity || 0);
      });
    });

    return map;
  }, [selectedSale, salesReturns]);

  // Auto-set the most appropriate refund method when invoice changes
  useEffect(() => {
    if (selectedSale) {
      const isUnpaidOrCredit = selectedSale.payment_status === 'unpaid' || 
        (selectedSale.total_amount - (selectedSale.amount_paid || 0) > 0.01);
      
      if (isUnpaidOrCredit) {
        setRefundMethod('reduce_receivable');
      } else {
        // Was fully paid in cash/advance
        setRefundMethod('customer_advance');
      }
    }
  }, [selectedSale]);

  // Calculate items being returned
  const returnItemsList: (SalesReturnItem & { maxAvailable: number; itemIndex: number })[] = useMemo(() => {
    if (!selectedSale) return [];

    return selectedSale.items.map((saleItem, idx) => {
      const itemKey = saleItem.id || saleItem.product_name;
      const prevReturned = previouslyReturnedMap[itemKey] || 0;
      const maxAvailable = Math.max(0, Number((saleItem.quantity - prevReturned).toFixed(4)));
      const returnQty = returnQuantities[idx] || 0;
      const unitPrice = Number(saleItem.unit_price || 0);
      const subtotal = Number((returnQty * unitPrice).toFixed(2));

      // Calculate proportional base quantity to return to stock
      let baseQtyToRestore = returnQty;
      if (saleItem.size_in_base_unit && saleItem.size_in_base_unit > 0) {
        baseQtyToRestore = Number((returnQty * saleItem.size_in_base_unit).toFixed(4));
      } else if (saleItem.base_quantity && saleItem.quantity > 0) {
        baseQtyToRestore = Number(((returnQty / saleItem.quantity) * saleItem.base_quantity).toFixed(4));
      }

      return {
        itemIndex: idx,
        sale_item_id: saleItem.id,
        item_type: saleItem.item_type || 'finished_product',
        product_id: saleItem.product_id,
        raw_material_id: saleItem.raw_material_id,
        product_name: saleItem.product_name,
        unit: saleItem.unit,
        pack_size_id: saleItem.pack_size_id,
        pack_size_name: saleItem.pack_size_name,
        size_in_base_unit: saleItem.size_in_base_unit,
        quantity: returnQty,
        base_quantity: baseQtyToRestore,
        unit_cost: Number(saleItem.unit_cost || 0),
        unit_price: unitPrice,
        subtotal: subtotal,
        maxAvailable: maxAvailable,
      };
    });
  }, [selectedSale, previouslyReturnedMap, returnQuantities]);

  // Active returned items (qty > 0)
  const activeReturnedItems = useMemo(() => {
    return returnItemsList.filter(item => item.quantity > 0);
  }, [returnItemsList]);

  // Total return value
  const totalReturnAmount = useMemo(() => {
    return Number(activeReturnedItems.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2));
  }, [activeReturnedItems]);

  // Outstanding preview
  const currentCustomerBalance = selectedCustomer ? Number(selectedCustomer.current_balance || 0) : 0;
  const newBalancePreview = useMemo(() => {
    if (refundMethod === 'reduce_receivable') {
      return Math.max(0, Number((currentCustomerBalance - totalReturnAmount).toFixed(2)));
    }
    return currentCustomerBalance;
  }, [currentCustomerBalance, totalReturnAmount, refundMethod]);

  if (!isOpen) return null;

  const handleQuantityChange = (idx: number, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, val));
    setReturnQuantities(prev => ({
      ...prev,
      [idx]: clamped
    }));
  };

  const handleSelectAllMax = () => {
    const newQtys: Record<number, number> = {};
    returnItemsList.forEach(item => {
      newQtys[item.itemIndex] = item.maxAvailable;
    });
    setReturnQuantities(newQtys);
  };

  const handleClearQuantities = () => {
    setReturnQuantities({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedSale) {
      setErrorMessage('Please select an invoice to return items from.');
      return;
    }
    if (activeReturnedItems.length === 0) {
      setErrorMessage('Please specify a return quantity of at least 1 item.');
      return;
    }
    if (totalReturnAmount <= 0) {
      setErrorMessage('Total return amount must be greater than zero.');
      return;
    }

    const finalReason = returnReason === 'Other' 
      ? (customReason.trim() || 'Other') 
      : returnReason;

    try {
      setIsSubmitting(true);
      const userProfile: Profile = currentUser || {
        id: 'admin',
        name: 'Accounts Staff',
        email: 'staff@perfectshine.pk',
        role: 'accounts_staff',
        is_active: true,
        created_at: new Date().toISOString()
      };

      const creditNote = await processSalesReturn({
        sale_id: selectedSale.id,
        invoice_number: selectedSale.invoice_number,
        customer_id: selectedSale.customer_id,
        customer_name: selectedSale.customer_name,
        date: returnDate,
        items: activeReturnedItems.map(({ maxAvailable, itemIndex, ...rest }) => rest),
        reason: finalReason,
        notes: returnNotes.trim(),
        refund_method: refundMethod,
        payment_method: refundMethod === 'cash_refund' ? refundPaymentMethod : undefined,
      }, userProfile);

      onSuccess(creditNote);
      onClose();
    } catch (err: any) {
      console.error('Error processing sales return:', err);
      setErrorMessage(err?.message || 'Failed to process sales return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh] my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Process Sales Return / Credit Note</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Stock & Ledger Reversal
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Select past invoice, choose return items, and adjust inventory & customer financial balance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Select Customer & Past Invoice */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
            {/* Customer Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                1. Select Customer <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setSelectedSaleId('');
                  setReturnQuantities({});
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                required
              >
                <option value="">-- Choose Customer --</option>
                {customers
                  .filter(c => !c.is_archived || c.id === selectedCustomerId)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.current_balance > 0 ? `(Owes ${formatPKR(c.current_balance)})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Invoice Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                2. Select Past Invoice <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedSaleId}
                onChange={(e) => {
                  setSelectedSaleId(e.target.value);
                  setReturnQuantities({});
                }}
                disabled={!selectedCustomerId || customerSales.length === 0}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 disabled:opacity-50"
                required
              >
                <option value="">
                  {customerSales.length === 0 
                    ? (selectedCustomerId ? 'No past invoices for this customer' : '-- Select customer first --')
                    : '-- Choose Sales Invoice --'}
                </option>
                {customerSales.map(s => {
                  const unpaidAmt = Math.max(0, s.total_amount - (s.amount_paid || 0));
                  const statusNote = s.payment_status === 'paid' 
                    ? 'Paid' 
                    : unpaidAmt > 0 
                    ? `Due: ${formatPKR(unpaidAmt)}` 
                    : s.payment_status;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.invoice_number} ({formatDate(s.date)}) — {formatPKR(s.total_amount)} [{statusNote}]
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Return Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Return Date <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Selected Invoice Overview Banner */}
          {selectedSale && (
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-700/60 flex items-center justify-center text-slate-300">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-mono">{selectedSale.invoice_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedSale.payment_status === 'paid' 
                        ? 'bg-emerald-500/15 text-emerald-400' 
                        : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {selectedSale.payment_status}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-0.5">
                    Date: {formatDate(selectedSale.date)} &bull; Method: <span className="capitalize">{selectedSale.payment_method}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Invoice Total</span>
                  <span className="font-bold font-mono text-white text-sm">{formatPKR(selectedSale.total_amount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Amount Paid</span>
                  <span className="font-bold font-mono text-emerald-400 text-sm">{formatPKR(selectedSale.amount_paid)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Unpaid Balance</span>
                  <span className={`font-bold font-mono text-sm ${
                    selectedSale.total_amount - selectedSale.amount_paid > 0 ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    {formatPKR(Math.max(0, selectedSale.total_amount - selectedSale.amount_paid))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Line Items Return Table */}
          {selectedSale && (
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60">
              <div className="p-3.5 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Select Product(s) & Return Quantities
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllMax}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline"
                  >
                    Return All Items (Max)
                  </button>
                  <span className="text-slate-600">&bull;</span>
                  <button
                    type="button"
                    onClick={handleClearQuantities}
                    className="text-xs text-slate-400 hover:text-slate-300 underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">Original Sold</th>
                    <th className="py-2.5 px-3 text-center">Already Returned</th>
                    <th className="py-2.5 px-3 text-center">Available To Return</th>
                    <th className="py-2.5 px-3 text-right">Selling Rate</th>
                    <th className="py-2.5 px-3 text-center w-36">Return Qty</th>
                    <th className="py-2.5 px-3 text-right">Credit Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {returnItemsList.map((item) => {
                    const isFullyReturned = item.maxAvailable <= 0;
                    return (
                      <tr 
                        key={item.itemIndex}
                        className={`hover:bg-slate-800/30 transition-colors ${
                          item.quantity > 0 ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <p className="font-bold text-white">{item.product_name}</p>
                          {item.pack_size_name && (
                            <span className="text-[11px] text-emerald-400 font-normal">
                              Packaging: {item.pack_size_name}
                            </span>
                          )}
                          {item.item_type === 'raw_material' && (
                            <span className="text-[10px] text-amber-400 font-normal block">
                              Raw Material Resale
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">
                          {selectedSale.items[item.itemIndex].quantity}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-amber-400">
                          {previouslyReturnedMap[item.sale_item_id || item.product_name] || 0}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                          {item.maxAvailable}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          {formatPKR(item.unit_price)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isFullyReturned ? (
                            <span className="text-[11px] text-slate-500 italic">Fully Returned</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={item.maxAvailable}
                                step="any"
                                value={item.quantity || ''}
                                onChange={(e) => handleQuantityChange(item.itemIndex, parseFloat(e.target.value) || 0, item.maxAvailable)}
                                placeholder="0"
                                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-white focus:outline-none focus:border-rose-500 font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.itemIndex, item.maxAvailable, item.maxAvailable)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 hover:text-white"
                                title="Set to Max"
                              >
                                Max
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">
                          {item.subtotal > 0 ? formatPKR(item.subtotal) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-950 border-t border-slate-800 font-bold text-xs">
                    <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-slate-400">
                      Total Credit Note Value:
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-right font-mono text-base font-black text-rose-400">
                      {formatPKR(totalReturnAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Step 3: Return Reason & Optional Notes */}
          {selectedSale && activeReturnedItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reason for Return
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Damaged Goods">Damaged Goods / Leakage</option>
                  <option value="Wrong Item Delivered">Wrong Item / Variant Delivered</option>
                  <option value="Quality Defect">Quality Defect / Off-Spec Formulation</option>
                  <option value="Customer Changed Mind">Customer Changed Mind / Over-ordered</option>
                  <option value="Expired / Near Expiry">Expired or Near Expiry</option>
                  <option value="Other">Other Reason (Specify below)</option>
                </select>

                {returnReason === 'Other' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter specific return reason..."
                    className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Internal Return Notes (Optional)
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Returned with batch verification, approved by manager"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Step 4: Financial Refund Option Selector */}
          {selectedSale && activeReturnedItems.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  Financial Settlement Method
                </span>
                <span className="text-[11px] text-slate-400">
                  Total Credited: <strong className="text-rose-400 font-mono">{formatPKR(totalReturnAmount)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Option A: Reduce Customer Receivable */}
                <label 
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    refundMethod === 'reduce_receivable'
                      ? 'bg-rose-500/10 border-rose-500 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="refund_method"
                          value="reduce_receivable"
                          checked={refundMethod === 'reduce_receivable'}
                          onChange={() => setRefundMethod('reduce_receivable')}
                          className="text-rose-500"
                        />
                        Reduce Outstanding Balance
                      </span>
                      {selectedCustomer && selectedCustomer.current_balance > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Decreases customer's unpaid balance directly. No physical cash leaves the drawer.
                    </p>
                  </div>
                  {selectedCustomer && (
                    <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono flex justify-between">
                      <span className="text-slate-500">New Bal:</span>
                      <span className="text-emerald-400 font-bold">{formatPKR(newBalancePreview)}</span>
                    </div>
                  )}
                </label>

                {/* Option B: Immediate Cash Refund */}
                <label 
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    refundMethod === 'cash_refund'
                      ? 'bg-rose-500/10 border-rose-500 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="refund_method"
                          value="cash_refund"
                          checked={refundMethod === 'cash_refund'}
                          onChange={() => setRefundMethod('cash_refund')}
                          className="text-rose-500"
                        />
                        Cash / Immediate Refund
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Physical money is refunded to customer right now. An outflow voucher is recorded in the Cash Book.
                    </p>
                  </div>
                  {refundMethod === 'cash_refund' && (
                    <div className="mt-3 pt-2 border-t border-slate-800/80">
                      <select
                        value={refundPaymentMethod}
                        onChange={(e) => setRefundPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                      >
                        <option value="cash">Cash Drawer (Cash Out)</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="jazzcash">JazzCash</option>
                        <option value="easypaisa">EasyPaisa</option>
                      </select>
                    </div>
                  )}
                </label>

                {/* Option C: Customer Advance / Store Credit */}
                <label 
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    refundMethod === 'customer_advance'
                      ? 'bg-rose-500/10 border-rose-500 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="refund_method"
                          value="customer_advance"
                          checked={refundMethod === 'customer_advance'}
                          onChange={() => setRefundMethod('customer_advance')}
                          className="text-rose-500"
                        />
                        Store Credit / Advance
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Stores the credit on customer's account as an Advance deposit to be applied to their next purchase.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-cyan-400 font-mono">
                    Credit added: {formatPKR(totalReturnAmount)}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || activeReturnedItems.length === 0 || totalReturnAmount <= 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {isSubmitting ? 'Processing Return...' : `Confirm Return & Issue Credit Note (${formatPKR(totalReturnAmount)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
