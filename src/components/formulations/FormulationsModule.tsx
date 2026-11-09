import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Plus,
  Edit3,
  Trash2,
  Lock,
  Unlock,
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
  RefreshCw,
  Loader2,
  History,
  CheckCircle2,
  Clock,
  Eye,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ProductFormulation, FormulationItem, BaseUnit } from '../../types';
import { formatPKR, formatDate as formatDatePK } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { BatchCalculatorView } from './BatchCalculatorView';

interface FormulationsModuleProps {
  onStartProductionBatchFromCalculator?: () => void;
}

export const FormulationsModule: React.FC<FormulationsModuleProps> = ({
  onStartProductionBatchFromCalculator,
}) => {
  const {
    products,
    rawMaterials,
    formulations,
    saveFormulation,
    lockFormulation,
    unlockFormulationToNewVersion,
    allowStaffBatchSheetAccess,
    updateStaffBatchSheetAccess,
    deleteOrArchiveFormulation,
    unarchiveFormulation,
    checkFormulationHasHistory,
  } = useApp();
  const { currentUser, isOwner, canManageFormulations } = useAuth();

  // Confidential Access Guard: Sales & Accounts staff must NEVER see formulations
  const isAllowedViewer =
    isOwner || (currentUser?.role === 'general_staff' && allowStaffBatchSheetAccess);

  const [activeSubTab, setActiveSubTab] = useState<'recipes' | 'calculator'>('recipes');
  const [calculatorProductId, setCalculatorProductId] = useState<string | undefined>(undefined);

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedFormulation, setSelectedFormulation] = useState<ProductFormulation | null>(null);
  const [deleteConfirmFormulation, setDeleteConfirmFormulation] = useState<ProductFormulation | null>(null);
  const [historyProductModal, setHistoryProductModal] = useState<{ productId: string; productName: string } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [togglingStaffAccess, setTogglingStaffAccess] = useState(false);

  // Formulation Editor State
  const [formProductId, setFormProductId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [recipeItems, setRecipeItems] = useState<FormulationItem[]>([]);

  if (!isAllowedViewer || !currentUser) {
    return (
      <div className="p-8 bg-slate-900 border border-rose-500/30 rounded-2xl text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Confidential Formulations Restricted</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Product formulations and batch sheets are confidential intellectual property. Only Admin (and Production Staff when authorized by Admin) can access this module.
        </p>
      </div>
    );
  }

  const openNewFormulationModal = () => {
    const unconfigured = products.find(
      p => !formulations.some(f => f.product_id === p.id && !f.is_historical_version)
    );
    const targetProd = unconfigured || products[0];

    if (!targetProd) return;

    setFormProductId(targetProd.id);
    setInstructions('');
    setRecipeItems([
      {
        raw_material_id: rawMaterials[0]?.id || '',
        raw_material_name: rawMaterials[0]?.name || '',
        quantity: rawMaterials[0]?.unit === 'pcs' ? 1 : 0.1,
        unit: rawMaterials[0]?.unit || 'kg',
        cost_per_unit: rawMaterials[0]?.cost_per_unit || 0,
      },
    ]);
    setSelectedFormulation(null);
    setSubmitError(null);
    setIsEditModalOpen(true);
  };

  const openEditFormulationModal = (formulation: ProductFormulation) => {
    if (formulation.is_locked) {
      alert(
        `Formulation v${formulation.version || 1} is LOCKED and cannot be edited directly. Click "Unlock (Create v${(formulation.version || 1) + 1})" to create a new editable version while preserving v${formulation.version || 1} in history.`
      );
      return;
    }
    setSelectedFormulation(formulation);
    setFormProductId(formulation.product_id);
    setInstructions(formulation.instructions || '');
    setRecipeItems(formulation.items.map(item => ({ ...item })));
    setSubmitError(null);
    setIsEditModalOpen(true);
  };

  const handleLockFormulation = async (formulation: ProductFormulation) => {
    if (!isOwner || !currentUser) return;
    setLockingId(formulation.id);
    try {
      await lockFormulation(formulation.id, currentUser);
    } catch (err: any) {
      alert(err?.message || 'Failed to lock formulation.');
    } finally {
      setLockingId(null);
    }
  };

  const handleUnlockToNewVersion = async (formulation: ProductFormulation) => {
    if (!isOwner || !currentUser) return;
    const currentVer = Number(formulation.version || 1);
    const nextVer = currentVer + 1;
    const confirmed = window.confirm(
      `Unlock "${formulation.product_name}" (v${currentVer}) to make changes?\n\n` +
        `• Version v${currentVer} will remain safely preserved in history for all past production batches.\n` +
        `• A new editable Version v${nextVer} will be created and opened for editing.`
    );
    if (!confirmed) return;

    setLockingId(formulation.id);
    try {
      const newVersionFormulation = await unlockFormulationToNewVersion(formulation.id, currentUser);
      openEditFormulationModal(newVersionFormulation);
    } catch (err: any) {
      alert(err?.message || 'Failed to create new formulation version.');
    } finally {
      setLockingId(null);
    }
  };

  const handleToggleStaffBatchAccess = async () => {
    if (!isOwner || !currentUser) return;
    setTogglingStaffAccess(true);
    try {
      await updateStaffBatchSheetAccess(!allowStaffBatchSheetAccess, currentUser);
    } catch (err: any) {
      alert(err?.message || 'Failed to update setting in Supabase.');
    } finally {
      setTogglingStaffAccess(false);
    }
  };

  const handleAddRecipeRow = () => {
    if (rawMaterials.length === 0) return;
    const defaultRm = rawMaterials[0];
    setRecipeItems(prev => [
      ...prev,
      {
        raw_material_id: defaultRm.id,
        raw_material_name: defaultRm.name,
        quantity: defaultRm.unit === 'pcs' ? 1 : 0.05,
        unit: defaultRm.unit,
        cost_per_unit: defaultRm.cost_per_unit,
      },
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
    const unitCost = rm ? rm.cost_per_unit : item.cost_per_unit || 0;
    return acc + Number(item.quantity || 0) * unitCost;
  }, 0);

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId || recipeItems.length === 0) {
      alert('Please select a product and add at least one raw material to the formulation.');
      return;
    }

    const prod = products.find(p => p.id === formProductId);
    if (!prod) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await saveFormulation({
        id: selectedFormulation?.id,
        product_id: prod.id,
        product_name: prod.name,
        base_unit: (prod.base_unit || 'liter') as BaseUnit,
        yield_quantity: 1.0, // standard per 1 base unit
        version: selectedFormulation?.version || 1,
        is_locked: false,
        parent_formulation_id: selectedFormulation?.parent_formulation_id,
        items: recipeItems.map(i => ({
          ...i,
          quantity: parseFloat(String(i.quantity)) || 0,
        })),
        instructions,
      });

      setIsEditModalOpen(false);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to save formulation. Please check your internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Active vs Historical/Archived filtering
  const filteredFormulations = formulations.filter(f => {
    if (showArchived) {
      if (!f.is_archived && !f.is_historical_version) return false;
    } else {
      if (f.is_archived || f.is_historical_version) return false;
    }
    const matchesSearch =
      f.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.items.some(i => i.raw_material_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  // Group versions by product_id for version history modal
  const getVersionsForProduct = (productId: string) => {
    return formulations
      .filter(f => f.product_id === productId)
      .sort((a, b) => Number(b.version || 1) - Number(a.version || 1));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Top Navigation Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-400" />
            <span>Formulations (BOM), Version Lock & Batch Calculator</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Confidential chemical formulations per 1 base unit (1 kg or 1 liter), version control, and production batch sheet calculator
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sub-Tab Switcher: Formulations vs Batch Calculator */}
          <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setActiveSubTab('recipes')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'recipes'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Formulations & Versions</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('calculator')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'calculator'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Batch Calculator & Print Sheet</span>
            </button>
          </div>

          {canManageFormulations && activeSubTab === 'recipes' && (
            <button
              onClick={openNewFormulationModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>Create Product Recipe</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Confidentiality & Production Staff Access Control Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white flex items-center gap-2">
              <span>Formulation Basis & Confidentiality Policy</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                Per 1.0 kg / 1.0 liter Output
              </span>
            </p>
            <p className="text-slate-300 leading-relaxed">
              Every formulation defines the exact raw material quantities required per <strong>1.0 {baseUnitLabel}</strong> of finished product. Sales and Accounts staff are strictly blocked (UI & RLS).
            </p>
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl shrink-0">
            <div className="text-right">
              <p className="font-bold text-slate-200 text-xs">Production Staff Batch Sheet Access</p>
              <p className="text-[10px] text-slate-400">
                {allowStaffBatchSheetAccess
                  ? 'Enabled: Plant staff can view & print batch sheets'
                  : 'Admin Only: Plant staff cannot view formulations'}
              </p>
            </div>
            <button
              type="button"
              disabled={togglingStaffAccess}
              onClick={handleToggleStaffBatchAccess}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                allowStaffBatchSheetAccess ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
              title="Toggle Production Staff access to view & print batch sheets"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allowStaffBatchSheetAccess ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* SUB-TAB 2: BATCH CALCULATOR SCREEN */}
      {activeSubTab === 'calculator' ? (
        <BatchCalculatorView
          initialProductId={calculatorProductId}
          onStartProductionBatch={() => {
            if (onStartProductionBatchFromCalculator) {
              onStartProductionBatchFromCalculator();
            }
          }}
        />
      ) : (
        <>
          {/* Search Bar & Archive / Version History Toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search formulations or raw materials..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  showArchived
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>
                  {showArchived
                    ? 'Viewing Prior Versions & Archived'
                    : 'Show Prior Versions & Archived'}
                </span>
              </button>
            </div>
          </div>

          {/* Formulations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredFormulations.map(formulation => {
              const product = products.find(p => p.id === formulation.product_id);
              const baseUnit =
                formulation.base_unit || product?.base_unit || product?.unit || 'liter';
              const versionNum = Number(formulation.version || 1);
              const isLocked = Boolean(formulation.is_locked);
              const allVersionsForProd = getVersionsForProduct(formulation.product_id);
              const totalIngredientWeightPerUnit = formulation.items
                .filter(i => i.unit !== 'pcs')
                .reduce((acc, i) => acc + Number(i.quantity || 0), 0);

              // Compute theoretical BOM cost per 1 base unit using latest landed Active Master Rate
              const costPerUnit = formulation.items.reduce((acc, item) => {
                const rm = rawMaterials.find(m => m.id === item.raw_material_id);
                const unitCost = rm ? rm.cost_per_unit : item.cost_per_unit || 0;
                return acc + Number(item.quantity || 0) * unitCost;
              }, 0);

              return (
                <div
                  key={formulation.id}
                  className={`rounded-2xl bg-slate-900 border p-5 flex flex-col justify-between transition-all shadow-md ${
                    isLocked
                      ? 'border-emerald-500/30 hover:border-emerald-500/50'
                      : 'border-slate-800 hover:border-purple-500/40'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-extrabold text-white">
                            {formulation.product_name}
                          </h3>
                          {/* Version Number Badge */}
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            v{versionNum}
                          </span>
                          {/* Lock Status Badge */}
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <Lock className="w-3 h-3" />
                              Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Unlock className="w-3 h-3" />
                              Unlocked Draft
                            </span>
                          )}
                          {formulation.is_historical_version && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              Historical Version
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                          <span className="font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                            BOM per 1.0 {baseUnit}
                          </span>
                          <span>•</span>
                          <span>
                            Total inputs: <strong className="text-slate-200 font-mono">{Number(totalIngredientWeightPerUnit.toFixed(4))} kg</strong>
                          </span>
                          <span>•</span>
                          <span>
                            {isLocked ? 'Locked:' : 'Updated:'}{' '}
                            <strong className="text-slate-300">
                              {formatDatePK(
                                formulation.locked_at ||
                                  formulation.updated_at ||
                                  formulation.created_at
                              )}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          Est. Formula Cost
                        </span>
                        <p className="text-base font-black font-mono text-purple-400 leading-none mt-0.5">
                          {formatPKR(costPerUnit)}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">/{baseUnit}</span>
                        </p>
                      </div>
                    </div>

                    {/* Raw Material Recipe Items Table */}
                    <div className="mt-4 space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex justify-between">
                        <span>Raw Material ({formulation.items.length})</span>
                        <span>Qty per 1 {baseUnit}</span>
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {formulation.items.map((item, idx) => {
                          const rm = rawMaterials.find(m => m.id === item.raw_material_id);
                          const currentRmStock = rm ? rm.current_stock : 0;
                          const isLow = rm ? currentRmStock <= rm.reorder_level : false;
                          const qtyNum = Number(item.quantity || 0);

                          return (
                            <div
                              key={idx}
                              className="p-2 rounded-xl bg-slate-800/50 border border-slate-800/80 flex items-center justify-between text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-white truncate">
                                  {item.raw_material_name}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                  <span>
                                    Landed Rate:{' '}
                                    {formatPKR(rm ? rm.cost_per_unit : item.cost_per_unit || 0)}/
                                    {item.unit}
                                  </span>
                                  <span>•</span>
                                  <span
                                    className={
                                      isLow ? 'text-rose-400 font-semibold' : 'text-slate-400'
                                    }
                                  >
                                    Stock: {currentRmStock} {item.unit}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right pl-2">
                                <span className="font-mono font-bold text-white text-xs">
                                  {qtyNum} {item.unit}
                                  {item.unit === 'kg' && qtyNum > 0 && qtyNum < 1 && (
                                    <span className="text-[10px] text-indigo-300 ml-1">
                                      ({Number((qtyNum * 1000).toFixed(1))} g)
                                    </span>
                                  )}
                                </span>
                                <p className="text-[10px] font-mono text-purple-300">
                                  {formatPKR(
                                    qtyNum * (rm ? rm.cost_per_unit : item.cost_per_unit || 0)
                                  )}
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
                        <span className="font-bold text-purple-400 block mb-0.5">
                          Mixing Procedure:
                        </span>
                        <p className="line-clamp-2">{formulation.instructions}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Open in Batch Calculator if locked */}
                      {isLocked && !formulation.is_historical_version && (
                        <button
                          type="button"
                          onClick={() => {
                            setCalculatorProductId(formulation.product_id);
                            setActiveSubTab('calculator');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>Batch Calculator</span>
                        </button>
                      )}

                      {/* Version History Button if product has >1 version */}
                      {allVersionsForProd.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setHistoryProductModal({
                              productId: formulation.product_id,
                              productName: formulation.product_name,
                            })
                          }
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                        >
                          <History className="w-3.5 h-3.5 text-purple-400" />
                          <span>History ({allVersionsForProd.length})</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {/* Lock / Unlock Version Controls (Admin Only) */}
                      {isOwner && !formulation.is_historical_version && !formulation.is_archived && (
                        <>
                          {!isLocked ? (
                            <>
                              <button
                                type="button"
                                disabled={lockingId === formulation.id}
                                onClick={() => handleLockFormulation(formulation)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                                title="Lock this formulation version so it cannot be edited directly and can be used in the Batch Calculator"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>
                                  {lockingId === formulation.id ? 'Locking...' : `Lock v${versionNum}`}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditFormulationModal(formulation)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Recipe</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={lockingId === formulation.id}
                              onClick={() => handleUnlockToNewVersion(formulation)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                              title={`Locked v${versionNum} cannot be edited directly. Click to unlock into a new Version v${versionNum + 1} while preserving v${versionNum} in history.`}
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>
                                {lockingId === formulation.id
                                  ? 'Creating Version...'
                                  : `Unlock (Create v${versionNum + 1})`}
                              </span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Archive / Delete (only if unlocked or Admin archiving) */}
                      {!formulation.is_archived && !formulation.is_historical_version && isOwner && !isLocked && (
                        checkFormulationHasHistory(formulation.id) ? (
                          <button
                            onClick={() => setDeleteConfirmFormulation(formulation)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
                            title="Archive recipe (preserves production batch history)"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmFormulation(formulation)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                            title="Permanently delete recipe (0 batch runs)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}

                      {formulation.is_archived && !formulation.is_historical_version && isOwner && (
                        <button
                          onClick={() => unarchiveFormulation(formulation.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                          title="Restore Recipe to Active BOM Formulations"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Unarchive</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Version History Modal */}
      {historyProductModal && (
        <Modal
          isOpen={!!historyProductModal}
          onClose={() => setHistoryProductModal(null)}
          title={`Formulation Version History — ${historyProductModal.productName}`}
          subtitle="Locked historical versions are preserved permanently so past production batches retain their exact recipe record"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {getVersionsForProduct(historyProductModal.productId).map(ver => (
              <div
                key={ver.id}
                className={`p-4 rounded-xl border ${
                  ver.is_historical_version
                    ? 'bg-slate-900/70 border-slate-800'
                    : 'bg-indigo-950/20 border-indigo-500/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs">
                      Version v{ver.version || 1}
                    </span>
                    {ver.is_locked ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                        <Lock className="w-3.5 h-3.5" /> Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-semibold">
                        <Unlock className="w-3.5 h-3.5" /> Editable Draft
                      </span>
                    )}
                    {!ver.is_historical_version && !ver.is_archived && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                        Active Current Version
                      </span>
                    )}
                    {ver.is_historical_version && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold uppercase">
                        Superseded History
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {formatDatePK(ver.locked_at || ver.updated_at || ver.created_at)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {ver.items.map((it, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1.5 rounded bg-slate-950/70 border border-slate-800/80 text-xs flex items-center justify-between"
                    >
                      <span className="text-slate-300 truncate mr-2">{it.raw_material_name}</span>
                      <span className="font-mono font-bold text-white shrink-0">
                        {it.quantity} {it.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Edit Formulation Modal (Admin Only) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={
          selectedFormulation
            ? `Edit Recipe: ${selectedFormulation.product_name} (v${selectedFormulation.version || 1})`
            : 'Create New Product Recipe (v1)'
        }
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
              onChange={e => setFormProductId(e.target.value)}
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
                <div
                  key={idx}
                  className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/80 grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-7">
                    <select
                      value={item.raw_material_id}
                      onChange={e => handleRecipeItemChange(idx, 'raw_material_id', e.target.value)}
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
                      step="any"
                      min="0.0001"
                      required
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={e => handleRecipeItemChange(idx, 'quantity', e.target.value)}
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
            <span className="text-xs text-slate-300">
              Theoretical Material Cost per 1 {baseUnitLabel} (Landed Master Rates):
            </span>
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
              onChange={e => setInstructions(e.target.value)}
              placeholder="e.g. Add acid slowly to water, never water to acid. Maintain vessel temperature below 45°C."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2 ml-auto">
              {submitError && <span className="text-xs text-rose-400 mr-2">{submitError}</span>}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Saving Recipe...' : 'Save Recipe Formulation'}</span>
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
            title={
              hasHistory
                ? `Archive Recipe: ${deleteConfirmFormulation.product_name}`
                : `Delete Recipe: ${deleteConfirmFormulation.product_name}`
            }
            subtitle={
              hasHistory
                ? 'System safe archive: preserves production batch traceability'
                : 'Permanent removal of unproduced formulation'
            }
          >
            <div className="space-y-4 text-xs">
              <p className="text-slate-300">
                Are you sure you want to {hasHistory ? 'archive' : 'permanently delete'} the recipe for{' '}
                <strong>{deleteConfirmFormulation.product_name}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirmFormulation(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const res = await deleteOrArchiveFormulation(
                        deleteConfirmFormulation.id,
                        currentUser
                      );
                      alert(res.message);
                      setDeleteConfirmFormulation(null);
                    } catch (err: any) {
                      alert(err?.message || 'Failed to delete/archive recipe');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60 ${
                    hasHistory ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isDeleting
                      ? 'Processing...'
                      : hasHistory
                      ? 'Confirm & Archive Recipe'
                      : 'Confirm Permanent Deletion'}
                  </span>
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
