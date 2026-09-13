import React, { useState } from 'react';
import { 
  FlaskConical, 
  Plus, 
  Edit3, 
  Trash2, 
  Lock, 
  ShieldAlert, 
  Layers, 
  Sparkles, 
  Calculator, 
  Info, 
  FileText, 
  Check, 
  X,
  Search,
  ArrowRight,
  Archive,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ProductFormulation, FormulationItem, BaseUnit } from '../../types';
import { formatPKR } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

export const FormulationsModule: React.FC = () => {
  const { 
    products, 
    rawMaterials, 
    formulations, 
    saveFormulation, 
    deleteOrArchiveFormulation,
    unarchiveFormulation,
    checkFormulationHasHistory 
  } = useApp();
  const { currentUser, isOwner, canManageFormulations } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedFormulation, setSelectedFormulation] = useState<ProductFormulation | null>(null);
  const [deleteConfirmFormulation, setDeleteConfirmFormulation] = useState<ProductFormulation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Formulation Editor State
  const [formProductId, setFormProductId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [recipeItems, setRecipeItems] = useState<FormulationItem[]>([]);

  const openNewFormulationModal = () => {
    // Find first product without a formulation
    const unconfigured = products.find(p => !formulations.some(f => f.product_id === p.id));
    const targetProd = unconfigured || products[0];
    
    if (!targetProd) return;

    setFormProductId(targetProd.id);
    setInstructions('');
    setRecipeItems([
      {
        raw_material_id: rawMaterials[0]?.id || '',
        raw_material_name: rawMaterials[0]?.name || '',
        quantity: 0.1,
        unit: rawMaterials[0]?.unit || 'kg',
        cost_per_unit: rawMaterials[0]?.cost_per_unit || 0,
      }
    ]);
    setSelectedFormulation(null);
    setIsEditModalOpen(true);
  };

  const openEditFormulationModal = (formulation: ProductFormulation) => {
    setSelectedFormulation(formulation);
    setFormProductId(formulation.product_id);
    setInstructions(formulation.instructions || '');
    setRecipeItems(formulation.items.map(item => ({ ...item })));
    setIsEditModalOpen(true);
  };

  const handleAddRecipeRow = () => {
    if (rawMaterials.length === 0) return;
    const defaultRm = rawMaterials[0];
    setRecipeItems(prev => [
      ...prev,
      {
        raw_material_id: defaultRm.id,
        raw_material_name: defaultRm.name,
        quantity: 0.05,
        unit: defaultRm.unit,
        cost_per_unit: defaultRm.cost_per_unit,
      }
    ]);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipeItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleRecipeItemChange = (index: number, field: keyof FormulationItem, value: any) => {
    setRecipeItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'raw_material_id') {
        const rm = rawMaterials.find(m => m.id === value);
        if (rm) {
          item.raw_material_name = rm.name;
          item.unit = rm.unit;
          item.cost_per_unit = rm.cost_per_unit;
        }
      }

      updated[index] = item;
      return updated;
    });
  };

  const currentSelectedProduct = products.find(p => p.id === formProductId);
  const baseUnitLabel = currentSelectedProduct?.base_unit || currentSelectedProduct?.unit || 'liter';

  // Calculate theoretical batch cost per 1 base unit
  const estimatedCostPerBaseUnit = recipeItems.reduce((acc, item) => {
    const rm = rawMaterials.find(m => m.id === item.raw_material_id);
    const unitCost = rm ? rm.cost_per_unit : (item.cost_per_unit || 0);
    return acc + (Number(item.quantity || 0) * unitCost);
  }, 0);

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId || recipeItems.length === 0) {
      alert('Please select a product and add at least one raw material to the formulation.');
      return;
    }

    const prod = products.find(p => p.id === formProductId);
    if (!prod) return;

    saveFormulation({
      id: selectedFormulation?.id,
      product_id: prod.id,
      product_name: prod.name,
      base_unit: (prod.base_unit || 'liter') as BaseUnit,
      yield_quantity: 1.0, // standard per 1 base unit
      items: recipeItems.map(i => ({
        ...i,
        quantity: parseFloat(String(i.quantity)) || 0,
      })),
      instructions,
    });

    setIsEditModalOpen(false);
  };

  const filteredFormulations = formulations.filter(f => {
    const isArchivedMatch = showArchived ? f.is_archived : !f.is_archived;
    const matchesSearch = 
      f.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.items.some(i => i.raw_material_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return isArchivedMatch && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-400" />
            <span>Formulations & Bill of Materials (BOM)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Standard chemical recipes per 1 base unit (1 kg or 1 liter) for factory production
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageFormulations ? (
            <button
              onClick={openNewFormulationModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>Create Product Recipe</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Recipe editing is Admin-only</span>
            </div>
          )}
        </div>
      </div>

      {/* Admin Privilege Info Banner */}
      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3 text-xs">
        <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white">
            Single Source of Truth: Base-Unit Formulations
          </p>
          <p className="text-slate-300 leading-relaxed">
            All formulations define the exact raw materials required to manufacture <strong>1 Liter (or 1 Kg)</strong> of finished chemical. When recording production batches, the system automatically multiplies these recipe ratios by batch size and deducts from raw material stock.
          </p>
        </div>
      </div>

      {/* Search Bar & Archive Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search formulations or raw materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
          />
        </div>

        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
            showArchived
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>{showArchived ? 'Viewing Archived Recipes' : 'Show Archived Recipes'}</span>
        </button>
      </div>

      {/* Formulations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredFormulations.map((formulation) => {
          const product = products.find(p => p.id === formulation.product_id);
          const baseUnit = formulation.base_unit || product?.base_unit || product?.unit || 'liter';

          // Compute theoretical BOM cost per 1 base unit
          const costPerUnit = formulation.items.reduce((acc, item) => {
            const rm = rawMaterials.find(m => m.id === item.raw_material_id);
            const unitCost = rm ? rm.cost_per_unit : (item.cost_per_unit || 0);
            return acc + (Number(item.quantity || 0) * unitCost);
          }, 0);

          return (
            <div
              key={formulation.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-md"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-extrabold text-white">{formulation.product_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                        BOM per 1.0 {baseUnit}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formulation.items.length} raw materials required
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Formula Cost</span>
                    <p className="text-base font-black font-mono text-purple-400 leading-none mt-0.5">
                      {formatPKR(costPerUnit)} <span className="text-[10px] text-slate-400 font-normal">/{baseUnit}</span>
                    </p>
                  </div>
                </div>

                {/* Raw Material Recipe Items Table */}
                <div className="mt-4 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex justify-between">
                    <span>Raw Material</span>
                    <span>Qty per 1 {baseUnit}</span>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {formulation.items.map((item, idx) => {
                      const rm = rawMaterials.find(m => m.id === item.raw_material_id);
                      const currentRmStock = rm ? rm.current_stock : 0;
                      const isLow = rm ? currentRmStock <= rm.reorder_level : false;

                      return (
                        <div
                          key={idx}
                          className="p-2 rounded-xl bg-slate-800/50 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white truncate">{item.raw_material_name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span>Rate: {formatPKR(rm ? rm.cost_per_unit : item.cost_per_unit || 0)}/{item.unit}</span>
                              <span>•</span>
                              <span className={isLow ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                                Stock: {currentRmStock} {item.unit}
                              </span>
                            </div>
                          </div>

                          <div className="text-right pl-2">
                            <span className="font-mono font-bold text-white text-xs">
                              {item.quantity} {item.unit}
                            </span>
                            <p className="text-[10px] font-mono text-purple-300">
                              {formatPKR((item.quantity * (rm ? rm.cost_per_unit : item.cost_per_unit || 0)))}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Instructions */}
                {formulation.instructions && (
                  <div className="mt-4 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300">
                    <span className="font-bold text-purple-400 block mb-0.5">Mixing Procedure:</span>
                    <p className="line-clamp-2">{formulation.instructions}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Linked Product ID: <code className="font-mono text-slate-400">{formulation.product_id}</code>
                </span>

                <div className="flex items-center gap-2">
                  {canManageFormulations && !formulation.is_archived && (
                    <button
                      onClick={() => openEditFormulationModal(formulation)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Recipe</span>
                    </button>
                  )}

                  {!formulation.is_archived ? (
                    isOwner ? (
                      checkFormulationHasHistory(formulation.id) ? (
                        <button
                          onClick={() => setDeleteConfirmFormulation(formulation)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
                          title="Archive recipe (preserves production batch history)"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmFormulation(formulation)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                          title="Permanently delete recipe (0 batch runs)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )
                    ) : (
                      <button
                        disabled
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/40 text-slate-600 border border-slate-800 text-xs cursor-not-allowed opacity-50"
                        title="Admin role required to delete or archive"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive</span>
                      </button>
                    )
                  ) : (
                    isOwner && (
                      <button
                        onClick={() => unarchiveFormulation(formulation.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                        title="Restore Recipe to Active BOM Formulations"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Unarchive</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Formulation Modal (Admin Only) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedFormulation ? `Edit Recipe: ${selectedFormulation.product_name}` : 'Create New Product Recipe'}
        subtitle="Configure the exact raw materials required to yield 1.0 base unit (Liter or Kg)"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveRecipe} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Finished Chemical Product
            </label>
            <select
              required
              disabled={!!selectedFormulation}
              value={formProductId}
              onChange={(e) => setFormProductId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Base Unit: {p.base_unit || p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Recipe Breakdown Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Raw Materials per 1 {baseUnitLabel} Produced
              </label>
              <button
                type="button"
                onClick={handleAddRecipeRow}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Raw Material
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {recipeItems.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/80 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-7">
                    <select
                      value={item.raw_material_id}
                      onChange={(e) => handleRecipeItemChange(idx, 'raw_material_id', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      {rawMaterials.map(rm => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} ({rm.unit}) • {formatPKR(rm.cost_per_unit)}/{rm.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3 flex items-center gap-1">
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      required
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleRecipeItemChange(idx, 'quantity', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono"
                    />
                    <span className="text-[11px] text-slate-400 font-mono uppercase">{item.unit}</span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end">
                    {recipeItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeRow(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-700 transition-colors"
                        title="Remove ingredient"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Theoretical Cost Summary */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-300">Theoretical Material Cost per 1 {baseUnitLabel}:</span>
            <span className="text-sm font-black font-mono text-purple-400">
              {formatPKR(estimatedCostPerBaseUnit)} / {baseUnitLabel}
            </span>
          </div>

          {/* Manufacturing Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Mixing & Safety Instructions
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Add acid slowly to water, never water to acid. Maintain vessel temperature below 45°C."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-800">
            {selectedFormulation && isOwner && (
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setDeleteConfirmFormulation(selectedFormulation);
                }}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  checkFormulationHasHistory(selectedFormulation.id)
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
                }`}
              >
                {checkFormulationHasHistory(selectedFormulation.id) ? (
                  <>
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive Recipe</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Recipe</span>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-md transition-colors"
              >
                Save Recipe Formulation
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete / Archive Formulation Confirmation Modal */}
      {deleteConfirmFormulation && (() => {
        const hasHistory = checkFormulationHasHistory(deleteConfirmFormulation.id);
        return (
          <Modal
            isOpen={!!deleteConfirmFormulation}
            onClose={() => setDeleteConfirmFormulation(null)}
            title={hasHistory ? `Archive Recipe: ${deleteConfirmFormulation.product_name}` : `Delete Recipe: ${deleteConfirmFormulation.product_name}`}
            subtitle={hasHistory ? "System safe archive: preserves production batch traceability" : "Permanent removal of unproduced formulation"}
          >
            <div className="space-y-4 text-xs">
              {hasHistory ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-400">
                    <Archive className="w-4 h-4 shrink-0" />
                    <span>Production Batch History Detected (Soft Archive):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This product formulation has recorded chemical production batch runs in the factory ledger. To preserve manufacturing batch traceability and BOM audit history, it <strong>cannot be permanently deleted</strong>.
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px] mt-1.5">
                    It will be <strong>archived</strong>: hidden from the production batch recipe picker, while preserving past batch records and chemical usage logs. You can unarchive it anytime.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Zero Production Runs (Permanent Delete):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This formulation has <strong>0 recorded production runs</strong>. It will be <strong>permanently deleted</strong> from the recipe catalog.
                  </p>
                </div>
              )}

              <p className="text-slate-300">
                Are you sure you want to {hasHistory ? 'archive' : 'permanently delete'} the recipe for <strong>{deleteConfirmFormulation.product_name}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmFormulation(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = deleteOrArchiveFormulation(deleteConfirmFormulation.id, currentUser);
                    alert(res.message);
                    setDeleteConfirmFormulation(null);
                  }}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-colors ${
                    hasHistory ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {hasHistory ? 'Confirm & Archive Recipe' : 'Confirm Permanent Deletion'}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
