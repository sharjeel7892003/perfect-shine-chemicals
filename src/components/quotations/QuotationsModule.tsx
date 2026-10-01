import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  EyeOff, 
  Copy, 
  Edit3, 
  Trash2, 
  Printer, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  FileText,
  DollarSign,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Quotation, QuotationStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatPKR, formatDate } from '../../utils/formatters';
import { QuotationModal } from './QuotationModal';
import { QuotationViewModal } from './QuotationViewModal';

export const QuotationsModule: React.FC = () => {
  const { 
    quotations, 
    updateQuotationStatus, 
    duplicateQuotation, 
    deleteQuotation 
  } = useApp();
  const { isOwner, currentUser } = useAuth();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuotationStatus>('all');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;

      const qLow = searchQuery.toLowerCase();
      const numMatch = q.quotation_number.toLowerCase().includes(qLow);
      const custMatch = q.customer_name.toLowerCase().includes(qLow);
      const compMatch = (q.company_name || '').toLowerCase().includes(qLow);
      const phoneMatch = (q.phone || '').includes(qLow);
      const itemsMatch = q.items.some(item => 
        item.product_name.toLowerCase().includes(qLow) || 
        (item.size || '').toLowerCase().includes(qLow)
      );

      return numMatch || custMatch || compMatch || phoneMatch || itemsMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [quotations, statusFilter, searchQuery]);

  // Metric summaries
  const stats = useMemo(() => {
    const total = quotations.length;
    const pending = quotations.filter(q => q.status === 'pending').length;
    const accepted = quotations.filter(q => q.status === 'accepted').length;
    const rejected = quotations.filter(q => q.status === 'rejected').length;
    const totalValue = quotations.reduce((sum, q) => {
      const qVal = q.items.reduce((iSum, it) => iSum + Number(it.quoted_price_per_unit || 0), 0);
      return sum + qVal;
    }, 0);

    return { total, pending, accepted, rejected, totalValue };
  }, [quotations]);

  const handleDuplicate = async (quotationId: string) => {
    try {
      setIsDuplicating(quotationId);
      const copied = await duplicateQuotation(quotationId);
      setIsDuplicating(null);
      // Open editor with copied quotation immediately
      setEditingQuotation(copied);
      setIsCreateModalOpen(true);
    } catch (err: any) {
      setIsDuplicating(null);
      alert(err?.message || 'Failed to duplicate quotation');
    }
  };

  const handleDelete = async (quotationId: string) => {
    try {
      await deleteQuotation(quotationId);
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete quotation');
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'accepted':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'rejected':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'expired':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      default:
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Price Quotations</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Commercial Proposals
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Create professional price quotes for prospects & private label clients with independent manual costing
          </p>
        </div>

        <button
          onClick={() => {
            setEditingQuotation(null);
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create Quotation</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Quotes</span>
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-black font-mono text-white">{stats.total}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Proposals Generated</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Pending / In Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black font-mono text-amber-400">{stats.pending}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Awaiting Decision</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Accepted Deals</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-400">{stats.accepted}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Converted to Orders</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Rejected / Expired</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black font-mono text-rose-400">{stats.rejected}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Closed / Expired</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by quote #, prospect name, company, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          {(['all', 'pending', 'accepted', 'rejected', 'expired'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {filteredQuotations.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 stroke-1 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-300">No Quotations Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your search query or status filter.'
                : 'Click "Create Quotation" to generate your first price quote for prospective clients.'}
            </p>
            {(!searchQuery && statusFilter === 'all') && (
              <button
                onClick={() => {
                  setEditingQuotation(null);
                  setIsCreateModalOpen(true);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Quotation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Quote # & Date</th>
                  <th className="py-3 px-4">Prospect / Client</th>
                  <th className="py-3 px-4">Quoted SKUs</th>
                  <th className="py-3 px-4 text-right">Quoted Unit Prices</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Quote # & Date */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-white text-xs">
                          {quotation.quotation_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{formatDate(quotation.date)}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-400 font-semibold">{quotation.validity_period}</span>
                      </div>
                    </td>

                    {/* Prospect / Client */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">
                        {quotation.customer_name}
                      </div>
                      {quotation.company_name && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{quotation.company_name}</span>
                        </div>
                      )}
                      {quotation.phone && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {quotation.phone}
                        </div>
                      )}
                    </td>

                    {/* Quoted SKUs */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {quotation.items.slice(0, 3).map((it, idx) => (
                          <div key={idx} className="text-xs text-slate-300 font-medium truncate max-w-xs">
                            • <strong>{it.product_name}</strong> {it.size ? `(${it.size})` : ''}
                          </div>
                        ))}
                        {quotation.items.length > 3 && (
                          <span className="text-[10px] text-slate-500 font-semibold italic">
                            +{quotation.items.length - 3} more SKU(s)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quoted Unit Prices */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="space-y-0.5 font-mono">
                        {quotation.items.map((it, idx) => (
                          <div key={idx} className="text-xs text-emerald-400 font-bold">
                            {formatPKR(it.quoted_price_per_unit)}
                            <span className="text-[10px] text-slate-500 font-normal"> /ea</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Status with quick switcher */}
                    <td className="py-3.5 px-4 text-center">
                      <select
                        value={quotation.status}
                        onChange={(e) => updateQuotationStatus(quotation.id, e.target.value as QuotationStatus)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-900 cursor-pointer focus:outline-none capitalize ${getStatusBadge(quotation.status)}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="expired">Expired</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View / Print PDF (Customer view) */}
                        <button
                          onClick={() => setViewingQuotation(quotation)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title="View / Print Customer Quotation PDF (Final prices only)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicate(quotation.id)}
                          disabled={isDuplicating === quotation.id}
                          className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
                          title="Duplicate Quotation (Creates a new copy for another quote)"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => {
                            setEditingQuotation(quotation);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Edit Quotation"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirmId(quotation.id)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Quotation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Delete Quotation?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Create/Edit Modal */}
      {isCreateModalOpen && (
        <QuotationModal
          isOpen={isCreateModalOpen}
          initialQuotation={editingQuotation}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingQuotation(null);
          }}
          onSaved={(savedQuot) => {
            setViewingQuotation(savedQuot);
          }}
        />
      )}

      {/* Quotation Viewer / PDF Modal */}
      {viewingQuotation && (
        <QuotationViewModal
          quotation={viewingQuotation}
          onClose={() => setViewingQuotation(null)}
          onEdit={(q) => {
            setViewingQuotation(null);
            setEditingQuotation(q);
            setIsCreateModalOpen(true);
          }}
        />
      )}
    </div>
  );
};
