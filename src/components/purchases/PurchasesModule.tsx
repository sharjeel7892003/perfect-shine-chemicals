import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert,
  Calendar, 
  AlertCircle, 
  FlaskConical, 
  Package,
  Eye,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Purchase, PurchaseItem, PaymentMethod } from '../../types';
import { formatPKR, formatDate, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

export const PurchasesModule: React.FC = () => {
  const { suppliers, products, rawMaterials, purchases, createPurchase, deletePurchaseInvoice } = useApp();
  const { currentUser, isOwner, canManagePurchases } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<Purchase | null>(null);
  const [deleteConfirmPurchase, setDeleteConfirmPurchase] = useState<Purchase | null>(null);
  const [negativeStockWarning, setNegativeStockWarning] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active entities only for new purchases
  const activeSuppliers = suppliers.filter(s => !s.is_archived && s.is_active);
  const activeRawMaterials = rawMaterials.filter(rm => !rm.is_archived && rm.is_active);
  const activeProducts = products.filter(p => !p.is_archived && p.is_active);

  // New Purchase Form State
  const [purchaseDate, setPurchaseDate] = useState(getTodayDateString());
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('paid');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState<PurchaseItem[]>([
    { item_type: 'raw_material', raw_material_id: '', product_or_material_name: '', quantity: 1, unit_cost: 0, subtotal: 0 }
  ]);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const totalAmount = items.reduce((acc, item) => acc + item.subtotal, 0);

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { item_type: 'raw_material', raw_material_id: '', product_or_material_name: '', quantity: 1, unit_cost: 0, subtotal: 0 }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      
      // If selected a raw material
      if (field === 'raw_material_id') {
        const rm = rawMaterials.find(m => m.id === value);
        if (rm) {
          item.item_type = 'raw_material';
          item.product_or_material_name = rm.name;
          item.unit = rm.unit;
          item.unit_cost = rm.cost_per_unit;
        }
      }

      // If selected a finished product
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value);
        if (prod) {
          item.item_type = 'finished_product';
          item.product_or_material_name = prod.name;
          item.unit = prod.base_unit || prod.unit;
          item.unit_cost = prod.cost_price;
        }
      }

      if (field === 'quantity' || field === 'unit_cost') {
        item.subtotal = Number(item.quantity || 0) * Number(item.unit_cost || 0);
      }

      updated[index] = item;
      return updated;
    });
  };

  const handlePaymentStatusChange = (status: 'paid' | 'partial' | 'unpaid') => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setAmountPaid(totalAmount);
    } else if (status === 'unpaid') {
      setAmountPaid(0);
    }
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      alert('Please select a supplier');
      return;
    }
    if (items.length === 0 || totalAmount <= 0) {
      alert('Please add valid purchase items with quantities and unit costs');
      return;
    }

    const finalPaid = paymentStatus === 'paid' ? totalAmount : amountPaid;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createPurchase({
        supplier_id: supplierId,
        supplier_name: selectedSupplier ? selectedSupplier.name : 'Unknown Supplier',
        date: formatSelectedDateToIso(purchaseDate),
        items,
        total_amount: totalAmount,
        amount_paid: finalPaid,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        notes,
      });

      setIsModalOpen(false);
      // Reset form
      setSupplierId('');
      setPurchaseDate(getTodayDateString());
      setItems([{ item_type: 'raw_material', raw_material_id: '', product_or_material_name: '', quantity: 1, unit_cost: 0, subtotal: 0 }]);
      setAmountPaid(0);
      setNotes('');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to record purchase. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePurchase = async (force: boolean = false) => {
    if (!deleteConfirmPurchase) return;
    setIsDeleting(true);
    try {
      const res = await deletePurchaseInvoice(deleteConfirmPurchase.id, currentUser, force);

      if (res.hasNegativeStockWarning && !force) {
        setNegativeStockWarning(res.warningDetails || ['Low stock detected']);
        return;
      }

      alert(res.message);
      setDeleteConfirmPurchase(null);
      setNegativeStockWarning(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete purchase invoice');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPurchases = purchases.filter(p =>
    p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-400" />
            <span>Supplier Purchases & Raw Materials</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Record raw material procurement from vendors (LABSA, SLES, Fragrances) and finished goods
          </p>
        </div>

        {canManagePurchases && (
          <button
            onClick={() => {
              setPurchaseDate(getTodayDateString());
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Record New Purchase</span>
          </button>
        )}
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search PO # or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <span className="text-xs text-slate-400">{purchases.length} Purchase Orders Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">PO Number</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3 text-right">Items & Materials Received</th>
                <th className="py-3 px-3 text-right">Total Amount (PKR)</th>
                <th className="py-3 px-3 text-right">Paid</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Payment Method</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No purchase records found
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-white">{p.invoice_number}</td>
                    <td className="py-3 px-3 text-slate-400">{formatDate(p.date)}</td>
                    <td className="py-3 px-3 font-medium text-slate-200">{p.supplier_name}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400 max-w-xs truncate">
                      {p.items.map(i => `${i.quantity}x ${i.product_or_material_name}`).join(', ')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {formatPKR(p.total_amount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400">
                      {formatPKR(p.amount_paid)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant={p.payment_status === 'paid' ? 'emerald' : p.payment_status === 'partial' ? 'amber' : 'rose'}
                      >
                        {p.payment_status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-400">{p.payment_method}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedPurchaseDetails(p)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                          title="View PO Line Items Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>View</span>
                        </button>
                        {isOwner ? (
                          <button
                            onClick={() => {
                              setDeleteConfirmPurchase(p);
                              setNegativeStockWarning(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                            title="Delete PO & Reverse Raw Material/Product Stocks"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/40 text-slate-600 border border-slate-800 text-xs cursor-not-allowed opacity-50"
                            title="Admin role required to delete and reverse PO"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Purchase Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Supplier Purchase Order"
        subtitle="Purchasing raw materials or products auto-increases factory stock and updates supplier payable balance"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Supplier / Vendor *
              </label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Choose Supplier...</option>
                {activeSuppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.raw_material_type}) • Balance: {formatPKR(s.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Purchase / PO Date *</span>
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Itemized list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Purchase Items (Raw Materials or Products)
              </label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item Row
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <select
                        value={item.raw_material_id ? `rm-${item.raw_material_id}` : (item.product_id ? `prod-${item.product_id}` : '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('rm-')) {
                            handleItemChange(idx, 'raw_material_id', val.replace('rm-', ''));
                          } else if (val.startsWith('prod-')) {
                            handleItemChange(idx, 'product_id', val.replace('prod-', ''));
                          } else {
                            handleItemChange(idx, 'product_or_material_name', '');
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        <option value="">Select Raw Material / Product</option>
                        <optgroup label="🧪 Chemical Raw Materials">
                          {activeRawMaterials.map(rm => (
                            <option key={rm.id} value={`rm-${rm.id}`}>
                              {rm.name} ({rm.unit})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="📦 Finished Products">
                          {activeProducts.map(p => (
                            <option key={p.id} value={`prod-${p.id}`}>
                              {p.name} ({p.base_unit || p.unit})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Item Description"
                        required
                        value={item.product_or_material_name}
                        onChange={(e) => handleItemChange(idx, 'product_or_material_name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        required
                        value={item.quantity || ''}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                      />
                    </div>

                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="Rate"
                        required
                        value={item.unit_cost || ''}
                        onChange={(e) => handleItemChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment & Totals */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-sm font-bold text-white">
              <span>Total Purchase Cost:</span>
              <span className="font-mono text-emerald-400 text-base">{formatPKR(totalAmount)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => handlePaymentStatusChange(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="paid">Full Paid</option>
                  <option value="partial">Partial Payment</option>
                  <option value="unpaid">Credit / Unpaid</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="bank">Bank Transfer (HBL)</option>
                  <option value="cash">Cash Voucher</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            {paymentStatus === 'partial' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Amount Paid Now (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  value={amountPaid || ''}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
            )}
          </div>

          {submitError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Recording Purchase...' : 'Confirm Purchase & Receive Stock'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Purchase Order Detail View Modal */}
      {selectedPurchaseDetails && (
        <Modal
          isOpen={!!selectedPurchaseDetails}
          onClose={() => setSelectedPurchaseDetails(null)}
          title={`Purchase Order: ${selectedPurchaseDetails.invoice_number}`}
          subtitle={`Received from ${selectedPurchaseDetails.supplier_name} on ${formatDate(selectedPurchaseDetails.date)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800">
              <div>
                <p className="text-slate-500">Supplier</p>
                <p className="font-bold text-white text-sm">{selectedPurchaseDetails.supplier_name}</p>
              </div>
              <div>
                <p className="text-slate-500">Total Invoice</p>
                <p className="font-bold text-white font-mono text-sm">{formatPKR(selectedPurchaseDetails.total_amount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Payment Channel</p>
                <p className="font-semibold text-emerald-400 uppercase font-mono">{selectedPurchaseDetails.payment_method}</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">
                Purchased Inventory Items Received
              </h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {selectedPurchaseDetails.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-white">{item.product_or_material_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Rate: {formatPKR(item.unit_cost)}/{item.unit || 'unit'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        +{item.quantity} {item.unit || 'units'}
                      </span>
                      <p className="text-[11px] font-mono text-slate-300">
                        {formatPKR(item.subtotal)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedPurchaseDetails.notes && (
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-300">
                <span className="font-bold text-slate-400 block text-[10px] uppercase mb-1">Notes / Terms</span>
                <p>{selectedPurchaseDetails.notes}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedPurchaseDetails;
                    setSelectedPurchaseDetails(null);
                    setDeleteConfirmPurchase(target);
                    setNegativeStockWarning(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold text-xs transition-colors"
                  title="Delete purchase order and reverse warehouse inventory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete & Reverse PO</span>
                </button>
              )}

              <button
                onClick={() => setSelectedPurchaseDetails(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Purchase Order & Reversal Confirmation Modal */}
      {deleteConfirmPurchase && (
        <Modal
          isOpen={!!deleteConfirmPurchase}
          onClose={() => {
            setDeleteConfirmPurchase(null);
            setNegativeStockWarning(null);
          }}
          title={`Delete & Reverse Purchase: ${deleteConfirmPurchase.invoice_number}`}
          subtitle="Admin Automated Stock Reduction & Supplier Ledger Reversal"
        >
          <div className="space-y-4 text-xs">
            {/* Warning Block */}
            {negativeStockWarning && (
              <div className="p-3.5 rounded-xl bg-rose-500/20 border-2 border-rose-500/40 text-rose-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-400 text-sm">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>CRITICAL: Negative Stock Alert!</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Reversing this purchase will deduct items that have already been used in manufacturing or sold to customers:
                </p>
                <ul className="space-y-1 text-[11px] list-disc pl-5 font-mono text-rose-300">
                  {negativeStockWarning.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {!negativeStockWarning && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Automatic Purchase Reversal Effects:</span>
                </div>
                <ul className="space-y-1.5 text-slate-200 text-[11px] list-disc pl-5">
                  <li>
                    <strong>Inventory Deduction:</strong> Purchased stocks will be removed from warehouse:
                    <div className="mt-1 font-mono text-rose-400">
                      {deleteConfirmPurchase.items.map(i => `• ${i.product_or_material_name}: -${i.quantity} ${i.unit || 'units'}`).join(', ')}
                    </div>
                  </li>
                  {deleteConfirmPurchase.supplier_id && (deleteConfirmPurchase.total_amount - deleteConfirmPurchase.amount_paid) > 0 && (
                    <li>
                      <strong>Supplier Debt Reversal:</strong> Outstanding debt to <em>"{deleteConfirmPurchase.supplier_name}"</em> will be reduced by <strong>{formatPKR(deleteConfirmPurchase.total_amount - deleteConfirmPurchase.amount_paid)}</strong>.
                    </li>
                  )}
                  {deleteConfirmPurchase.amount_paid > 0 && (
                    <li>
                      <strong>Payment Records Reversal:</strong> Linked supplier payment entries totaling <strong>{formatPKR(deleteConfirmPurchase.amount_paid)}</strong> will be canceled.
                    </li>
                  )}
                </ul>
              </div>
            )}

            <p className="text-slate-300">
              Are you sure you want to permanently delete purchase order <strong>{deleteConfirmPurchase.invoice_number}</strong>? An audit log entry will be permanently recorded.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteConfirmPurchase(null);
                  setNegativeStockWarning(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              {negativeStockWarning ? (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeletePurchase(true)}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? 'Reversing...' : 'Force Delete (Allow Negative Stock)'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeletePurchase(false)}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? 'Reversing...' : 'Confirm Deletion & Reverse Stocks'}</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

