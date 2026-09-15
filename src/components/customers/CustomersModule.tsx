import React, { useState } from 'react';
import { 
  Users, 
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
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Customer, CustomerType, PaymentMethod } from '../../types';
import { formatPKR, formatDate, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

export const CustomersModule: React.FC = () => {
  const { 
    customers, 
    sales, 
    payments, 
    addCustomer, 
    updateCustomer, 
    deleteOrArchiveCustomer,
    unarchiveCustomer,
    checkCustomerHasHistory, 
    recordPayment 
  } = useApp();
  const { currentUser, isOwner } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<Customer | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: 'Lahore',
    customer_type: 'wholesale' as CustomerType,
    credit_limit: 100000,
    current_balance: 0,
    notes: '',
    is_active: true,
  });

  // Direct Payment Form State
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateString());
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [linkedSaleId, setLinkedSaleId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('jazzcash');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Form submission loading & error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openAddModal = () => {
    setSubmitError(null);
    setIsSubmitting(false);
    setFormData({
      name: '',
      phone: '',
      address: '',
      city: 'Lahore',
      customer_type: 'wholesale',
      credit_limit: 100000,
      current_balance: 0,
      notes: '',
      is_active: true,
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setSubmitError(null);
    setIsSubmitting(false);
    setSelectedCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || 'Lahore',
      customer_type: c.customer_type,
      credit_limit: c.credit_limit || 50000,
      current_balance: c.current_balance || 0,
      notes: c.notes || '',
      is_active: c.is_active,
    });
    setIsEditModalOpen(true);
  };

  const openLedgerModal = (c: Customer) => {
    setSelectedCustomer(c);
    setIsLedgerModalOpen(true);
  };

  const openPaymentModal = (c: Customer) => {
    setSubmitError(null);
    setIsSubmitting(false);
    setSelectedCustomer(c);
    setPaymentDate(getTodayDateString());
    setLinkedSaleId('');
    setPaymentAmount(c.current_balance > 0 ? c.current_balance : 0);
    setPaymentRef('');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (isEditModalOpen && selectedCustomer) {
        await updateCustomer(selectedCustomer.id, formData);
        setIsEditModalOpen(false);
      } else {
        await addCustomer(formData);
        setIsAddModalOpen(false);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to save customer to cloud database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentAmount <= 0) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const sale = sales.find(s => s.id === linkedSaleId);

      await recordPayment({
        related_to: linkedSaleId ? 'sale' : 'customer_balance',
        reference_id: linkedSaleId || undefined,
        reference_no: sale ? sale.invoice_number : undefined,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        amount: paymentAmount,
        payment_method: paymentMethod,
        transaction_ref: paymentRef,
        notes: paymentNotes || (linkedSaleId ? `Payment for invoice ${sale?.invoice_number}` : 'Customer ledger payment receipt'),
        date: formatSelectedDateToIso(paymentDate),
      });

      setIsPaymentModalOpen(false);
      setPaymentDate(getTodayDateString());
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to record payment in cloud database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const isArchivedMatch = showArchived ? c.is_archived : !c.is_archived;
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || c.customer_type === typeFilter;
    return isArchivedMatch && matchesSearch && matchesType;
  });

  // Calculate chronological customer ledger with running balance
  const getCustomerLedgerRows = () => {
    if (!selectedCustomer) return [];

    const rows: {
      date: string;
      ref: string;
      description: string;
      method?: string;
      debit: number;
      credit: number;
      balance: number;
    }[] = [];

    const custSales = sales.filter(s => s.customer_id === selectedCustomer.id);
    custSales.forEach(sale => {
      rows.push({
        date: sale.date,
        ref: sale.invoice_number,
        description: `Sale Invoice (${sale.items.length} items)`,
        debit: sale.total_amount,
        credit: 0,
        balance: 0,
      });
      if (sale.amount_paid > 0) {
        rows.push({
          date: sale.date,
          ref: `${sale.invoice_number} (Pay)`,
          description: `Payment at checkout`,
          method: sale.payment_method,
          debit: 0,
          credit: sale.amount_paid,
          balance: 0,
        });
      }
    });

    const custPayments = payments.filter(p => p.customer_id === selectedCustomer.id && p.related_to === 'customer_balance');
    custPayments.forEach(pay => {
      rows.push({
        date: pay.date,
        ref: pay.transaction_ref || pay.reference_no || 'REC',
        description: pay.notes || 'Payment receipt voucher',
        method: pay.payment_method,
        debit: 0,
        credit: pay.amount,
        balance: 0,
      });
    });

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    rows.forEach(r => {
      running = running + r.debit - r.credit;
      r.balance = running;
    });

    return rows;
  };

  const customerLedgerRows = getCustomerLedgerRows();
  const customerUnpaidSales = selectedCustomer ? sales.filter(s => s.customer_id === selectedCustomer.id && s.payment_status !== 'paid') : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Customer Directory & Running Ledgers</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage wholesale distributors, store accounts & track running credit balances over time
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3px]" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Main List */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer name, phone or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
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

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">All Customer Types</option>
              <option value="wholesale">Wholesale</option>
              <option value="distributor">Distributor</option>
              <option value="retail">Retail</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Customer Name</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-right">Credit Limit</th>
                <th className="py-3 px-3 text-right">Outstanding (PKR)</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCustomers.map((c) => {
                const hasBalance = (c.current_balance || 0) > 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-white text-sm">{c.name}</td>
                    <td className="py-3 px-3 capitalize">
                      <Badge variant={c.customer_type === 'distributor' ? 'purple' : c.customer_type === 'wholesale' ? 'blue' : 'slate'}>
                        {c.customer_type}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{c.phone || '-'}</td>
                    <td className="py-3 px-3 text-slate-400">{c.address ? `${c.address}, ${c.city}` : c.city}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400">{formatPKR(c.credit_limit)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={hasBalance ? 'text-amber-400 font-black' : 'text-emerald-400'}>
                        {formatPKR(c.current_balance || 0)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openLedgerModal(c)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition-colors"
                          title="View Statement & History"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Ledger</span>
                        </button>
                        {hasBalance && (
                          <button
                            onClick={() => openPaymentModal(c)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
                            title="Receive Payment"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Collect</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Edit Customer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {!c.is_archived ? (
                          isOwner ? (
                            checkCustomerHasHistory(c.id) ? (
                              <button
                                onClick={() => setDeleteConfirmCustomer(c)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
                                title="Archive customer (preserves invoice & debt ledger)"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Archive</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmCustomer(c)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                                title="Permanently delete customer (0 invoices & 0 balance)"
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
                              onClick={() => unarchiveCustomer(c.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                              title="Restore Customer to Active Directory"
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

      {/* Add/Edit Customer Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
        title={isEditModalOpen ? 'Edit Customer' : 'Register New Customer'}
        subtitle="Wholesale distributor and shop account details"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Customer / Store Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Al-Madina General Store"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone (Jazz / Telenor / Zong)</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0300-1234567"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Customer Type</label>
              <select
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value as CustomerType })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="wholesale">Wholesale</option>
                <option value="distributor">Distributor</option>
                <option value="retail">Retail Counter</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Market Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. Shop 14, Anarkali Commercial Market"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Credit Limit (PKR)</label>
              <input
                type="number"
                min="0"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Saving to Cloud...' : (isEditModalOpen ? 'Save Changes' : 'Add Customer')}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Account Ledger Statement Modal */}
      <Modal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        title={`Account Statement: ${selectedCustomer?.name || ''}`}
        subtitle={`Current Outstanding Due: ${formatPKR(selectedCustomer?.current_balance || 0)}`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-xs">
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="font-semibold text-white font-mono">{selectedCustomer?.phone || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Address</p>
              <p className="font-semibold text-white truncate">{selectedCustomer?.address}, {selectedCustomer?.city}</p>
            </div>
            <div>
              <p className="text-slate-500">Credit Limit</p>
              <p className="font-semibold text-emerald-400 font-mono">{formatPKR(selectedCustomer?.credit_limit)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Full Transaction Statement & Running Balance
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
                    <th className="py-2.5 px-3 text-right">Debit (+)</th>
                    <th className="py-2.5 px-3 text-right">Credit (-)</th>
                    <th className="py-2.5 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {customerLedgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">No ledger transactions found</td>
                    </tr>
                  ) : (
                    customerLedgerRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{formatDate(row.date)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{row.ref}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {row.description}
                          {row.method && <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">{row.method}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                          {row.debit > 0 ? formatPKR(row.debit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                          {row.credit > 0 ? formatPKR(row.credit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black">
                          <span className={row.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}>
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

          {selectedCustomer && isOwner && (
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setIsLedgerModalOpen(false);
                  setDeleteConfirmCustomer(selectedCustomer);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  checkCustomerHasHistory(selectedCustomer.id)
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
                }`}
              >
                {checkCustomerHasHistory(selectedCustomer.id) ? (
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
                onClick={() => setIsLedgerModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close Statement
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Record Direct Payment Receipt Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Receive Customer Debt Settlement"
        subtitle={`Collecting balance from ${selectedCustomer?.name}`}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Payment Date *</span>
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {customerUnpaidSales.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Link to Invoice (Optional)
              </label>
              <select
                value={linkedSaleId}
                onChange={(e) => {
                  setLinkedSaleId(e.target.value);
                  if (e.target.value) {
                    const sale = sales.find(s => s.id === e.target.value);
                    if (sale) {
                      setPaymentAmount(Math.max(0, sale.total_amount - sale.amount_paid));
                    }
                  } else {
                    setPaymentAmount(selectedCustomer?.current_balance || 0);
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="">General Account Credit</option>
                {customerUnpaidSales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.invoice_number} ({formatDate(s.date)}) — Due: {formatPKR(s.total_amount - s.amount_paid)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Payment Amount Received (PKR)
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
              <option value="cash">Cash Counter Receipt</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="bank">Bank Transfer (HBL / MCB)</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Transaction Notes / TID / Ref
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. JazzCash TID #998124 or Cash Voucher #12"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            />
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Recording Receipt...' : 'Save Receipt & Update Balance'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete / Archive Customer Confirmation Modal */}
      {deleteConfirmCustomer && (() => {
        const hasHistory = checkCustomerHasHistory(deleteConfirmCustomer.id);
        return (
          <Modal
            isOpen={!!deleteConfirmCustomer}
            onClose={() => setDeleteConfirmCustomer(null)}
            title={hasHistory ? `Archive Customer: ${deleteConfirmCustomer.name}` : `Delete Customer: ${deleteConfirmCustomer.name}`}
            subtitle={hasHistory ? "System safe archive: preserves sales invoice history & credit ledger" : "Permanent removal of customer with zero transactions"}
          >
            <div className="space-y-4 text-xs">
              {hasHistory ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-400">
                    <Archive className="w-4 h-4 shrink-0" />
                    <span>Transaction History Detected (Soft Archive):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This customer account has recorded sales invoices, payments, or an active balance ({formatPKR(deleteConfirmCustomer.current_balance || 0)}). To protect ledger accounting and invoice audit integrity, it <strong>cannot be permanently deleted</strong>.
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px] mt-1.5">
                    It will be <strong>archived</strong>: hidden from the active POS customer selection, while all invoice records and balance statements remain preserved in the ledger. You can unarchive this customer anytime.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Zero History Detected (Permanent Delete):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This customer has <strong>0 sales invoices and 0 balance</strong>. The record will be <strong>permanently deleted</strong> from the customer directory.
                  </p>
                </div>
              )}

              <p className="text-slate-300">
                Are you sure you want to {hasHistory ? 'archive' : 'permanently delete'} <strong>{deleteConfirmCustomer.name}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmCustomer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const res = await deleteOrArchiveCustomer(deleteConfirmCustomer.id, currentUser);
                      alert(res.message);
                      setDeleteConfirmCustomer(null);
                    } catch (err: any) {
                      alert(err?.message || 'Failed to delete or archive customer.');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 ${
                    hasHistory ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{hasHistory ? 'Confirm & Archive Customer' : 'Confirm Permanent Deletion'}</span>
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
