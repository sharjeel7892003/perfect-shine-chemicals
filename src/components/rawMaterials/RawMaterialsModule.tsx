import React, { useState } from 'react';
import { 
  FlaskConical, 
  Plus, 
  Search, 
  Edit3, 
  Sliders, 
  History, 
  AlertTriangle, 
  TrendingDown, 
  CheckCircle,
  Package,
  Layers,
  Sparkles,
  Trash2,
  Archive,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { RawMaterial, RawMaterialMovementType, RawMaterialCategory } from '../../types';
import { formatPKR, formatDate, formatDateTime } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

export const RawMaterialsModule: React.FC = () => {
  const { 
    rawMaterials, 
    rawMaterialMovements, 
    lowStockRawMaterials, 
    totalRawMaterialsValuation,
    addRawMaterial, 
    updateRawMaterial, 
    deleteOrArchiveRawMaterial,
    unarchiveRawMaterial,
    checkRawMaterialHasHistory,
    adjustRawMaterialStock 
  } = useApp();
  
  const { currentUser, isOwner, canManageRawMaterials } = useAuth();

  const [activeTab, setActiveTab] = useState<'catalog' | 'movements'>('catalog');
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [deleteConfirmMaterial, setDeleteConfirmMaterial] = useState<RawMaterial | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);

  // Add / Edit Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Surfactants' as RawMaterialCategory,
    unit: 'kg' as 'kg' | 'liter',
    current_stock: 0,
    reorder_level: 50,
    cost_per_unit: 0,
    description: '',
    is_active: true,
  });

  // Adjust Stock Form State
  const [adjustData, setAdjustData] = useState({
    materialId: '',
    qtyDiff: 10,
    type: 'adjustment' as RawMaterialMovementType,
    notes: '',
  });

  const openAddModal = () => {
    setFormData({
      name: '',
      category: 'Surfactants',
      unit: 'kg',
      current_stock: 0,
      reorder_level: 50,
      cost_per_unit: 0,
      description: '',
      is_active: true,
    });
    setSubmitError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (mat: RawMaterial) => {
    setSelectedMaterial(mat);
    setFormData({
      name: mat.name,
      category: (mat.category || 'Surfactants') as RawMaterialCategory,
      unit: mat.unit,
      current_stock: mat.current_stock,
      reorder_level: mat.reorder_level,
      cost_per_unit: mat.cost_per_unit,
      description: mat.description || '',
      is_active: mat.is_active,
    });
    setSubmitError(null);
    setIsEditModalOpen(true);
  };

  const openAdjustModal = (mat?: RawMaterial) => {
    const target = mat || rawMaterials[0];
    if (!target) return;
    setSelectedMaterial(target);
    setAdjustData({
      materialId: target.id,
      qtyDiff: 10,
      type: 'adjustment',
      notes: '',
    });
    setIsAdjustModalOpen(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (isEditModalOpen && selectedMaterial) {
        await updateRawMaterial(selectedMaterial.id, formData);
        setIsEditModalOpen(false);
      } else {
        await addRawMaterial(formData);
        setIsAddModalOpen(false);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to save raw material. Please check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustData.materialId || adjustData.qtyDiff === 0) return;

    setIsSubmitting(true);
    try {
      await adjustRawMaterialStock(
        adjustData.materialId,
        adjustData.qtyDiff,
        adjustData.type,
        adjustData.notes,
        currentUser.name
      );
      setIsAdjustModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to apply adjustment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrArchiveMaterial = async (mat: RawMaterial) => {
    setIsDeleting(true);
    try {
      const res = await deleteOrArchiveRawMaterial(mat.id, currentUser);
      alert(res.message);
      setDeleteConfirmMaterial(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete/archive raw material');
    } finally {
      setIsDeleting(false);
    }
  };

  const categories = Array.from(new Set(rawMaterials.map(rm => rm.category || 'General')));

  const filteredMaterials = rawMaterials.filter(rm => {
    const isArchivedMatch = showArchived ? rm.is_archived : !rm.is_archived;
    const matchesSearch = rm.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || rm.category === categoryFilter;
    return isArchivedMatch && matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-teal-400" />
            <span>Raw Materials & Chemical Inventory</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track surfactants, acids, fragrances, salts, dyes & stock thresholds
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageRawMaterials && (
            <>
              <button
                onClick={() => openAdjustModal()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Adjust Raw Stock</span>
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-md shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                <span>Add Raw Material</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Raw Material Items</span>
          <p className="text-2xl font-black text-white mt-1">{rawMaterials.length} Types</p>
          <p className="text-xs text-slate-400 mt-1">Chemicals & components registered</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Raw Inventory Valuation</span>
          <p className="text-2xl font-black text-teal-400 mt-1">{formatPKR(totalRawMaterialsValuation)}</p>
          <p className="text-xs text-slate-400 mt-1">Based on active procurement unit costs</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Low Stock Warnings</span>
          <div className="flex items-center justify-between mt-1">
            <p className={`text-2xl font-black ${lowStockRawMaterials.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {lowStockRawMaterials.length} Low
            </p>
            {lowStockRawMaterials.length > 0 ? (
              <Badge variant="rose">Action Required</Badge>
            ) : (
              <Badge variant="emerald">Stock Healthy</Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Below critical production threshold</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'catalog' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Raw Materials List ({rawMaterials.length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'movements' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Consumption & Movement Trail ({rawMaterialMovements.length})
          </button>
        </div>

        {lowStockRawMaterials.length > 0 && activeTab === 'catalog' && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-rose-400 font-semibold px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{lowStockRawMaterials.length} Raw Material(s) Need Reordering</span>
          </div>
        )}
      </div>

      {activeTab === 'catalog' ? (
        /* ================= RAW MATERIALS CATALOG TABLE ================= */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search raw material name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
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
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="all">All Chemical Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Raw Material</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-center">Unit</th>
                  <th className="py-3 px-3 text-right">Cost Rate (PKR)</th>
                  <th className="py-3 px-3 text-right">Current Stock</th>
                  <th className="py-3 px-3 text-right">Reorder Level</th>
                  <th className="py-3 px-3 text-right">Stock Valuation</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                      No raw chemical materials found. Click "+ New Raw Material" above to add real factory stock.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((rm) => {
                  const isLow = Number(rm.current_stock) <= Number(rm.reorder_level);
                  const valuation = Number(rm.current_stock) * Number(rm.cost_per_unit);

                  return (
                    <tr key={rm.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <p className="font-bold text-white text-sm">{rm.name}</p>
                        {rm.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{rm.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                          {rm.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-400 uppercase font-bold">
                        {rm.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {formatPKR(rm.cost_per_unit)}/{rm.unit}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-mono font-black text-sm ${isLow ? 'text-rose-400' : 'text-white'}`}>
                          {rm.current_stock} <span className="text-[11px] font-normal text-slate-400">{rm.unit}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {rm.reorder_level} {rm.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-teal-400">
                        {formatPKR(valuation)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isLow ? (
                          <Badge variant="rose">Reorder Low</Badge>
                        ) : (
                          <Badge variant="emerald">Sufficient</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!rm.is_archived ? (
                            <>
                              {canManageRawMaterials && (
                                <>
                                  <button
                                    onClick={() => openAdjustModal(rm)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                                    title="Adjust Stock"
                                  >
                                    <Sliders className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => openEditModal(rm)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                    title="Edit Material"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {isOwner ? (
                                checkRawMaterialHasHistory(rm.id) ? (
                                  <button
                                    onClick={() => setDeleteConfirmMaterial(rm)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
                                    title="Archive chemical (used in recipes or purchase records)"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    <span>Archive</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirmMaterial(rm)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                                    title="Delete chemical permanently (0 recipe or purchase records)"
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
                              )}
                            </>
                          ) : (
                            isOwner && (
                              <button
                                onClick={() => unarchiveRawMaterial(rm.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                                title="Restore Raw Material to Active Catalog"
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
                }))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= MOVEMENT AUDIT TRAIL ================= */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-teal-400" />
              <span>Raw Material Inflow / Outflow Movement Trail</span>
            </h3>
            <span className="text-xs text-slate-400">{rawMaterialMovements.length} Total Logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Raw Material</th>
                  <th className="py-3 px-3">Movement Type</th>
                  <th className="py-3 px-3 text-right">Quantity Change</th>
                  <th className="py-3 px-3 text-right">Stock Flow</th>
                  <th className="py-3 px-3">Reference / Batch #</th>
                  <th className="py-3 px-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rawMaterialMovements.map((rmm) => {
                  const isPositive = rmm.quantity > 0;
                  return (
                    <tr key={rmm.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono">{formatDateTime(rmm.date)}</td>
                      <td className="py-3 px-3 font-bold text-white">{rmm.raw_material_name}</td>
                      <td className="py-3 px-3 capitalize">
                        <Badge
                          variant={
                            rmm.movement_type === 'purchase_in'
                              ? 'emerald'
                              : rmm.movement_type === 'production_out'
                              ? 'blue'
                              : 'amber'
                          }
                        >
                          {rmm.movement_type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPositive ? `+${rmm.quantity}` : rmm.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {rmm.previous_stock !== undefined && rmm.new_stock !== undefined ? (
                          <span>{rmm.previous_stock} → <strong className="text-white">{rmm.new_stock}</strong></span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate font-mono text-[11px]">
                        {rmm.reference_id || rmm.notes || '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{rmm.created_by_name || 'System Admin'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Raw Material Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
        title={isEditModalOpen ? 'Edit Raw Material' : 'Add New Chemical Raw Material'}
        subtitle="Configure chemical specifications, base unit, cost price & reorder threshold"
      >
        <form onSubmit={handleSaveMaterial} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Chemical / Material Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. LABSA 96% Surfactant"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as RawMaterialCategory })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="Surfactants">Surfactants</option>
                <option value="Acids & Alkalis">Acids & Alkalis</option>
                <option value="Fragrances & Perfumes">Fragrances & Perfumes</option>
                <option value="Dyes & Colorants">Dyes & Colorants</option>
                <option value="Salts & Fillers">Salts & Fillers</option>
                <option value="Packaging & Containers">Packaging & Containers</option>
                <option value="General">General Chemicals</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Stock Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value as 'kg' | 'liter' })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white uppercase font-mono"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="liter">Liter (liter)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cost Rate (PKR / Unit)</label>
              <input
                type="number"
                min="0"
                required
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            {!isEditModalOpen && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Opening Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Reorder Level Threshold</label>
              <input
                type="number"
                min="1"
                required
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description / Chemical Grade</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. 96% industrial active matter concentration"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {submitError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Saving Raw Material...' : (isEditModalOpen ? 'Save Changes' : 'Create Raw Material')}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Manual Raw Material Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Raw Material Stock Adjustment"
        subtitle="Log physical inventory audit, spillage, evaporation, or batch adjustments"
      >
        <form onSubmit={handleApplyAdjustment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Select Raw Material</label>
            <select
              value={adjustData.materialId}
              onChange={(e) => setAdjustData({ ...adjustData, materialId: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            >
              {rawMaterials.map(rm => (
                <option key={rm.id} value={rm.id}>
                  {rm.name} (Current: {rm.current_stock} {rm.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Adjustment Reason</label>
              <select
                value={adjustData.type}
                onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value as RawMaterialMovementType })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="adjustment">Physical Inventory Audit (+ / -)</option>
                <option value="wastage">Factory Spillage / Evaporation (-)</option>
                <option value="purchase_in">Direct Purchase / Inward (+)</option>
                <option value="return">Supplier Return (-)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Quantity Difference (+ or -)
              </label>
              <input
                type="number"
                required
                value={adjustData.qtyDiff}
                onChange={(e) => setAdjustData({ ...adjustData, qtyDiff: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. +25 or -10"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes / Reason</label>
            <textarea
              rows={2}
              value={adjustData.notes}
              onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
              placeholder="e.g. Verified monthly warehouse storage drum counts"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-colors"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete / Archive Raw Material Confirmation Modal */}
      {deleteConfirmMaterial && (() => {
        const hasHistory = checkRawMaterialHasHistory(deleteConfirmMaterial.id);
        return (
          <Modal
            isOpen={!!deleteConfirmMaterial}
            onClose={() => setDeleteConfirmMaterial(null)}
            title={hasHistory ? `Archive Chemical: ${deleteConfirmMaterial.name}` : `Delete Chemical: ${deleteConfirmMaterial.name}`}
            subtitle={hasHistory ? "System safe archive: preserves formulation recipes & purchase order history" : "Permanent removal of unused raw chemical"}
          >
            <div className="space-y-4 text-xs">
              {hasHistory ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-400">
                    <Archive className="w-4 h-4 shrink-0" />
                    <span>Usage & Transaction History Detected (Soft Archive):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This raw material is configured in product formulation recipes (BOM), supplier purchase orders, or inventory movement logs. To protect historical batch reproduction and accounting integrity, it <strong>cannot be permanently deleted</strong>.
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px] mt-1.5">
                    It will be <strong>archived</strong>: hidden from active formulation pickers and stock replenishment forms, while all past production runs and purchase history remain fully intact.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Zero Usage History Detected (Permanent Delete):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This raw material has <strong>0 historical usages</strong> (not used in any recipes or purchase orders). It will be <strong>permanently deleted</strong> from the inventory system.
                  </p>
                </div>
              )}

              <p className="text-slate-300">
                Are you sure you want to {hasHistory ? 'archive' : 'permanently delete'} <strong>{deleteConfirmMaterial.name}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirmMaterial(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeleteOrArchiveMaterial(deleteConfirmMaterial)}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60 ${
                    hasHistory ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? 'Processing...' : (hasHistory ? 'Confirm & Archive Material' : 'Confirm Permanent Deletion')}</span>
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
