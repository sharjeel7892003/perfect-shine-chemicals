import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  CreditCard, 
  Edit3, 
  Trash2, 
  BookOpen,
  DollarSign,
  Printer,
  Archive,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier, PaymentMethod } from '../../types';
import { formatPKR, formatDate } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

export const SuppliersModule: React.FC = () => {
  const { 
    suppliers, 
    purchases, 
    payments, 
    addSupplier, 
    updateSupplier, 
    deleteOrArchiveSupplier,
    unarchiveSupplier,
    checkSupplierHasHistory, 
    recordPayment 
  } = useApp();
  const { currentUser, isOwner } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<Supplier | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: 'Lahore',
    raw_material_type: '',
    current_balance: 0,
    notes: '',
    is_active: true,
  });

  // Outgoing payment state
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [linkedPurchaseId, setLinkedPurchaseId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const openAddModal = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      city: 'Lahore',
      raw_material_type: '',
      current_balance: 0,
      notes: '',
      is_active: true,
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setFormData({
      name: s.name,
      phone: s.phone || '',
      address: s.address || '',
      city: s.city || 'Lahore',
      raw_material_type: s.raw_material_type || '',
      current_balance: s.current_balance || 0,
      notes: s.notes || '',
      is_active: s.is_active,
    });
    setIsEditModalOpen(true);
  };

  const openLedgerModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setIsLedgerModalOpen(true);
  };

  const openPaymentModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setLinkedPurchaseId('');
    setPaymentAmount(s.current_balance > 0 ? s.current_balance : 0);
    setPaymentRef('');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditModalOpen && selectedSupplier) {
      updateSupplier(selectedSupplier.id, formData);
      setIsEditModalOpen(false);
    } else {
      addSupplier(formData);
      setIsAddModalOpen(false);
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || paymentAmount <= 0) return;

    const po = purchases.find(p => p.id === linkedPurchaseId);

    recordPayment({
      related_to: linkedPurchaseId ? 'purchase' : 'supplier_balance',
      reference_id: linkedPurchaseId || undefined,
      reference_no: po ? po.invoice_number : undefined,
      supplier_id: selectedSupplier.id,
      supplier_name: selectedSupplier.name,
      amount: paymentAmount,
      payment_method: paymentMethod,
      transaction_ref: paymentRef,
      notes: paymentNotes || (linkedPurchaseId ? `Payment for PO ${po?.invoice_number}` : 'Supplier balance settlement payment'),
      date: new Date().toISOString(),
    });

    setIsPaymentModalOpen(false);
  };

  const filteredSuppliers = suppliers.filter(s => {
    const isArchivedMatch = showArchived ? s.is_archived : !s.is_archived;
    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.raw_material_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.city.toLowerCase().includes(searchTerm.toLowerCase());
    return isArchivedMatch && matchesSearch;
  });

  // Calculate chronological supplier ledger
  const getSupplierLedgerRows = () => {
    if (!selectedSupplier) return [];

    const rows: {
      date: string;
      ref: string;
      description: string;
      method?: string;
      debit: number;
      credit: number;
      balance: number;
    }[] = [];

    const suppPurchases = purchases.filter(p => p.supplier_id === selectedSupplier.id);
    suppPurchases.forEach(po => {
      rows.push({
        date: po.date,
        ref: po.invoice_number,
        description: `Purchase Order (${po.items.map(i => i.product_or_material_name).join(', ')})`,
        debit: 0,
        credit: po.total_amount,
        balance: 0,
      });

      if (po.amount_paid > 0) {
        rows.push({
          date: po.date,
          ref: `${po.invoice_number} (Paid)`,
          description: `Disbursement at purchase order entry`,
          method: po.payment_method,
          debit: po.amount_paid,
          credit: 0,
          balance: 0,
        });
      }
    });

    const suppPayments = payments.filter(p => p.supplier_id === selectedSupplier.id && p.related_to === 'supplier_balance');
    suppPayments.forEach(pay => {
      rows.push({
        date: pay.date,
        ref: pay.transaction_ref || pay.reference_no || 'DISB',
        description: pay.notes || 'Supplier settlement payment',
        method: pay.payment_method,
        debit: pay.amount,
        credit: 0,
        balance: 0,
      });
    });

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    rows.forEach(r => {
      running = running + r.credit - r.debit;
      r.balance = running;
    });

    return rows;
  };

  const supplierLedgerRows = getSupplierLedgerRows();
  const supplierUnpaidPurchases = selectedSupplier ? purchases.filter(p => p.supplier_id === selectedSupplier.id && p.payment_status !== 'paid') : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-400" />
            <span>Supplier & Vendor Accounts</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Raw material chemical suppliers, bottle manufacturers and fragrance vendors
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3px]" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor name, material or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                showArchived
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'Viewing Archived' : 'Show Archived'}</span>
            </button>
            <span className="text-xs text-slate-400">{suppliers.length} Registered Suppliers</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Supplier / Vendor</th>
                <th className="py-3 px-3">Raw Material Supplied</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">City / Area</th>
                <th className="py-3 px-3 text-right">Factory Dues (PKR)</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSuppliers.map((s) => {
                const hasBalance = (s.current_balance || 0) > 0;
                return (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-white text-sm">{s.name}</td>
                    <td className="py-3 px-3 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {s.raw_material_type || 'General Chemicals'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{s.phone || '-'}</td>
                    <td className="py-3 px-3 text-slate-400">{s.city}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={hasBalance ? 'text-rose-400 font-black' : 'text-emerald-400'}>
                        {formatPKR(s.current_balance || 0)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openLedgerModal(s)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition-colors"
                          title="View Ledger Statement"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Ledger</span>
                        </button>
                        {hasBalance && (
                          <button
                            onClick={() => openPaymentModal(s)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                            title="Pay Supplier"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Pay Dues</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Edit Supplier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {!s.is_archived ? (
                          isOwner ? (
                            checkSupplierHasHistory(s.id) ? (
                              <button
                                onClick={() => setDeleteConfirmSupplier(s)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
                                title="Archive supplier (protects purchase orders & payable ledger)"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Archive</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmSupplier(s)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                                title="Permanently delete supplier (0 purchase orders & 0 balance)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )
                          ) : (
                            <button
                              disabled
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/40 text-slate-600 border border-slate-800 text-xs cursor-not-allowed opacity-50"
                              title="Admin role required to delete or archive"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Archive</span>
                            </button>
                          )
                        ) : (
                          isOwner && (
                            <button
                              onClick={() => unarchiveSupplier(s.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                              title="Restore Supplier to Active Accounts"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Unarchive</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
        title={isEditModalOpen ? 'Edit Supplier' : 'Add New Supplier / Vendor'}
        subtitle="Vendor contacts & raw material supply agreements"
      >
        <form onSubmit={handleSaveSupplier} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Company / Supplier Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Pak Chemicals & Surfactants Ltd"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Raw Material Category</label>
              <input
                type="text"
                required
                value={formData.raw_material_type}
                onChange={(e) => setFormData({ ...formData, raw_material_type: e.target.value })}
                placeholder="e.g. LABSA 96%, SLES 70%, 5L Plastic Cans & Caps"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone / Landline</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="042-35889900"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">City / Industrial Zone</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Sundar Estate, Lahore"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-colors"
            >
              {isEditModalOpen ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier Ledger Modal */}
      <Modal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        title={`Supplier Account: ${selectedSupplier?.name || ''}`}
        subtitle={`Current Factory Payable: ${formatPKR(selectedSupplier?.current_balance || 0)}`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-xs">
            <div>
              <p className="text-slate-500">Raw Material Supplied</p>
              <p className="font-semibold text-white">{selectedSupplier?.raw_material_type || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="font-semibold text-white font-mono">{selectedSupplier?.phone || '-'}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Full Purchase & Payment Transaction Statement
              </h4>
              <button
                onClick={() => window.print()}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Print Statement
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Ref #</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (-) / Paid</th>
                    <th className="py-2.5 px-3 text-right">Credit (+) / Billed</th>
                    <th className="py-2.5 px-3 text-right">Payable Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {supplierLedgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">No purchase or payment history found</td>
                    </tr>
                  ) : (
                    supplierLedgerRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{formatDate(row.date)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{row.ref}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {row.description}
                          {row.method && <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">{row.method}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-400">
                          {row.debit > 0 ? formatPKR(row.debit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-200">
                          {row.credit > 0 ? formatPKR(row.credit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black">
                          <span className={row.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            {formatPKR(row.balance)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedSupplier && isOwner && (
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setIsLedgerModalOpen(false);
                  setDeleteConfirmSupplier(selectedSupplier);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  checkSupplierHasHistory(selectedSupplier.id)
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
                }`}
              >
                {checkSupplierHasHistory(selectedSupplier.id) ? (
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
                onClick={() => setIsLedgerModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close Statement
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Direct Payment to Supplier Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Pay Supplier Dues"
        subtitle={`Settling payable for ${selectedSupplier?.name}`}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {supplierUnpaidPurchases.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Link to Purchase Order (Optional)
              </label>
              <select
                value={linkedPurchaseId}
                onChange={(e) => {
                  setLinkedPurchaseId(e.target.value);
                  if (e.target.value) {
                    const po = purchases.find(p => p.id === e.target.value);
                    if (po) {
                      setPaymentAmount(Math.max(0, po.total_amount - po.amount_paid));
                    }
                  } else {
                    setPaymentAmount(selectedSupplier?.current_balance || 0);
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="">General Supplier Balance</option>
                {supplierUnpaidPurchases.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.invoice_number} ({formatDate(p.date)}) — Due: {formatPKR(p.total_amount - p.amount_paid)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Payment Amount (PKR)
            </label>
            <input
              type="number"
              min="1"
              required
              value={paymentAmount || ''}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base text-white font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="bank">Bank Transfer (HBL / MCB)</option>
              <option value="cash">Cash Voucher</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="cheque">Bank Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Reference / Cheque #
            </label>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. Cheque #499201 or HBL Online Ref"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-md transition-colors"
            >
              Confirm Supplier Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete / Archive Supplier Confirmation Modal */}
      {deleteConfirmSupplier && (() => {
        const hasHistory = checkSupplierHasHistory(deleteConfirmSupplier.id);
        return (
          <Modal
            isOpen={!!deleteConfirmSupplier}
            onClose={() => setDeleteConfirmSupplier(null)}
            title={hasHistory ? `Archive Supplier: ${deleteConfirmSupplier.name}` : `Delete Supplier: ${deleteConfirmSupplier.name}`}
            subtitle={hasHistory ? "System safe archive: preserves purchase order history & payable ledger" : "Permanent removal of vendor with zero transactions"}
          >
            <div className="space-y-4 text-xs">
              {hasHistory ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-400">
                    <Archive className="w-4 h-4 shrink-0" />
                    <span>Transaction History Detected (Soft Archive):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This supplier has recorded purchase orders, raw material shipments, or an outstanding payable due ({formatPKR(deleteConfirmSupplier.current_balance || 0)}). To protect ledger accounting, audit trails, and inventory cost records, it <strong>cannot be permanently deleted</strong>.
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px] mt-1.5">
                    It will be <strong>archived</strong>: hidden from active PO creation forms, while all historical purchase orders and payment ledger vouchers remain preserved. You can unarchive this vendor anytime.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Zero History Detected (Permanent Delete):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This supplier has <strong>0 purchase orders and 0 payable balance</strong>. The vendor record will be <strong>permanently deleted</strong> from the directory.
                  </p>
                </div>
              )}

              <p className="text-slate-300">
                Are you sure you want to {hasHistory ? 'archive' : 'permanently delete'} <strong>{deleteConfirmSupplier.name}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmSupplier(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = deleteOrArchiveSupplier(deleteConfirmSupplier.id, currentUser);
                    alert(res.message);
                    setDeleteConfirmSupplier(null);
                  }}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-colors ${
                    hasHistory ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {hasHistory ? 'Confirm & Archive Supplier' : 'Confirm Permanent Deletion'}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
