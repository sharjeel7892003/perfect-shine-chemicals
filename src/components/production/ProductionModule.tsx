import React, { useState, useEffect } from 'react';
import { 
  Factory, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Calendar, 
  Clock, 
  User, 
  Eye, 
  Sparkles, 
  ArrowRight,
  ShieldAlert,
  Info,
  ChevronRight,
  Trash2,
  Loader2,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ProductionBatch, ProductFormulation, ConsumedRawMaterial } from '../../types';
import { formatPKR, formatDate, formatDateTime, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { getNextBatchNumberForProduct } from '../../utils/batchNumber';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ProductionReportView } from '../reports/ProductionReportView';

interface ProductionModuleProps {
  onNavigateToReports?: () => void;
}

export const ProductionModule: React.FC<ProductionModuleProps> = ({ onNavigateToReports }) => {
  const { 
    products, 
    rawMaterials, 
    formulations, 
    productionBatches, 
    recordProductionBatch,
    deleteProductionBatch 
  } = useApp();
  
  const { currentUser, isOwner, canRecordProduction } = useAuth();

  const [activeView, setActiveView] = useState<'batches' | 'report'>('batches');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<ProductionBatch | null>(null);
  const [deleteConfirmBatch, setDeleteConfirmBatch] = useState<ProductionBatch | null>(null);
  const [negativeStockWarning, setNegativeStockWarning] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityProduced, setQuantityProduced] = useState<number>(100);
  const [batchNumber, setBatchNumber] = useState('');
  const [productionDate, setProductionDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');

  // Auto-sync initial product and batch number
  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
      const nextBatch = getNextBatchNumberForProduct(products[0].id, productionBatches, products[0]);
      setBatchNumber(nextBatch);
    }
  }, [products, selectedProductId, productionBatches]);

  const openRecordModal = () => {
    const prodId = selectedProductId || (products[0] ? products[0].id : '');
    const prod = products.find(p => p.id === prodId) || products[0];
    setSelectedProductId(prodId);
    setQuantityProduced(100);
    const initialBatchNum = prod
      ? getNextBatchNumberForProduct(prod.id, productionBatches, prod)
      : 'DW-D1-Batch1';
    setBatchNumber(initialBatchNum);
    setProductionDate(getTodayDateString());
    setNotes('');
    setSubmitError(null);
    setIsRecordModalOpen(true);
  };

  const handleProductChange = (newProductId: string) => {
    setSelectedProductId(newProductId);
    const targetProd = products.find(p => p.id === newProductId);
    if (targetProd) {
      const nextBatchNum = getNextBatchNumberForProduct(newProductId, productionBatches, targetProd);
      setBatchNumber(nextBatchNum);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedFormulation = formulations.find(f => f.product_id === selectedProductId);
  const baseUnit = selectedProduct?.base_unit || selectedProduct?.unit || 'liter';

  // Calculate live raw materials needed for current input quantity
  const requiredMaterialsCalculations = selectedFormulation?.items.map(item => {
    const rm = rawMaterials.find(m => m.id === item.raw_material_id);
    const totalNeeded = Number((item.quantity * quantityProduced).toFixed(4));
    const availableStock = rm ? Number(rm.current_stock) : 0;
    const isSufficient = availableStock >= totalNeeded;
    const unitCost = rm ? rm.cost_per_unit : (item.cost_per_unit || 0);
    const estimatedCost = totalNeeded * unitCost;

    return {
      item,
      rm,
      totalNeeded,
      availableStock,
      isSufficient,
      unitCost,
      estimatedCost,
    };
  }) || [];

  const hasAnyShortage = requiredMaterialsCalculations.some(r => !r.isSufficient);
  const totalEstimatedBatchCost = requiredMaterialsCalculations.reduce((acc, r) => acc + r.estimatedCost, 0);

  const handleRecordProductionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || quantityProduced <= 0) {
      alert('Please enter a valid product and quantity to manufacture.');
      return;
    }

    if (!selectedFormulation) {
      alert('No formulation recipe exists for this product. Please define recipe in Formulations first.');
      return;
    }

    if (hasAnyShortage) {
      alert('Cannot proceed: Insufficient raw materials in stock. Please replenish raw materials first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await recordProductionBatch({
        productId: selectedProductId,
        quantityProduced: Number(quantityProduced),
        batchNumber,
        date: formatSelectedDateToIso(productionDate),
        supervisorName: currentUser.name,
        notes,
      });

      if (result.success) {
        setIsRecordModalOpen(false);
        if (result.batch) {
          setSelectedBatchDetails(result.batch);
        }
      } else {
        setSubmitError(result.message);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to record production batch. Please check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBatches = productionBatches.filter(b =>
    b.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.supervisor_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Factory className="w-6 h-6 text-emerald-400" />
            <span>Chemical Manufacturing & Production Batches</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Log factory batch output, automate BOM raw material consumption & increase finished base stock
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (onNavigateToReports) {
                onNavigateToReports();
              } else {
                setActiveView(activeView === 'batches' ? 'report' : 'batches');
              }
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              activeView === 'report'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Toggle Production Batches Report"
          >
            <BarChart3 className="w-4 h-4" />
            <span>{activeView === 'report' ? 'View Batch Records' : 'Dedicated Production Report'}</span>
          </button>

          {canRecordProduction && (
            <button
              onClick={openRecordModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>Record Production Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* Top View Selector Tabs */}
      <div className="no-print flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          onClick={() => setActiveView('batches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeView === 'batches'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Factory className="w-4 h-4" />
          <span>Production Runs & Batch Records</span>
        </button>

        <button
          onClick={() => setActiveView('report')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeView === 'report'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Dedicated Production Batches Report</span>
        </button>
      </div>

      {activeView === 'report' ? (
        <ProductionReportView embedded={true} />
      ) : (
        /* Production History Table Card */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search batch # or chemical product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <span className="text-xs text-slate-400">{productionBatches.length} Completed Production Runs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Batch Number</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Product Manufactured</th>
                <th className="py-3 px-3 text-right">Quantity Output</th>
                <th className="py-3 px-3 text-right">Batch Total Cost</th>
                <th className="py-3 px-3 text-right">Cost / Base Unit</th>
                <th className="py-3 px-3">Plant Supervisor</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No production batch logs recorded yet.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">{batch.batch_number}</td>
                    <td className="py-3 px-3 text-slate-400">{formatDate(batch.date)}</td>
                    <td className="py-3 px-3 font-bold text-white">{batch.product_name}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      +{batch.quantity_produced} <span className="text-[11px] font-normal text-slate-400">{batch.base_unit}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {formatPKR(batch.total_batch_cost)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      {formatPKR(batch.cost_per_base_unit)}/{batch.base_unit}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{batch.supervisor_name}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedBatchDetails(batch)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                          title="View Consumed Raw Materials"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>BOM Breakdown</span>
                        </button>
                        {isOwner ? (
                          <button
                            onClick={() => {
                              setDeleteConfirmBatch(batch);
                              setNegativeStockWarning(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                            title="Delete Batch & Reverse Stock"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/40 text-slate-600 border border-slate-800 text-xs cursor-not-allowed opacity-50"
                            title="Admin role required to reverse and delete batches"
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
      )}

      {/* Record Production Batch Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Chemical Production Batch"
        subtitle="Auto-calculates BOM consumption, deducts raw materials, and adds to finished base stock"
        maxWidth="2xl"
      >
        <form onSubmit={handleRecordProductionSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Product to Manufacture
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current Stock: {p.current_stock} {p.base_unit || p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Batch Output Quantity ({baseUnit})
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantityProduced}
                onChange={(e) => setQuantityProduced(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 500"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-400 uppercase">
                  Batch Identification Code *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const prod = products.find(p => p.id === selectedProductId) || products[0];
                    if (prod) {
                      setBatchNumber(getNextBatchNumberForProduct(prod.id, productionBatches, prod));
                    }
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
                  title="Auto-calculate next sequential number for this product"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Re-Generate Next</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. DW-D1-Batch1"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Sequential for this product: count of existing batches + 1 (Format: [SKU]-Batch[N])
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-400 uppercase">
                  Production Date *
                </label>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  Selected: {formatDate(productionDate)}
                </span>
              </div>
              <input
                type="date"
                required
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Select any date (past, today, or future); exact date will be saved to Supabase.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Supervisor / Logged By
              </label>
              <input
                type="text"
                disabled
                value={currentUser.name}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-400"
              />
            </div>
          </div>

          {/* BOM Materials Consumption Forecast & Availability Check */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Raw Materials Required for {quantityProduced} {baseUnit}</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Est. Cost: <strong className="text-emerald-400">{formatPKR(totalEstimatedBatchCost)}</strong>
              </span>
            </div>

            {!selectedFormulation ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                ⚠️ No recipe defined for this product. Please configure formulation in the Formulations module.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {requiredMaterialsCalculations.map((req, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      req.isSufficient
                        ? 'bg-slate-800/60 border-slate-700/60'
                        : 'bg-rose-500/10 border-rose-500/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {req.isSufficient ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-semibold text-white truncate">{req.item.raw_material_name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 ml-5.5 mt-0.5">
                        Current In-Stock: <span className={req.isSufficient ? 'text-slate-300' : 'text-rose-400 font-bold'}>{req.availableStock} {req.item.unit}</span>
                      </p>
                    </div>

                    <div className="text-right pl-3">
                      <span className="font-mono font-bold text-white text-xs block">
                        Deduct: -{req.totalNeeded} {req.item.unit}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {formatPKR(req.estimatedCost)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warnings & Block Alerts */}
          {hasAnyShortage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-300 font-semibold">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <span>
                Production is blocked: Factory lacks sufficient raw material stock for this batch quantity.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Production Batch Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tank vessel #2 run, tested viscosity & pH"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {submitError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsRecordModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || hasAnyShortage || !selectedFormulation}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Recording Batch to Cloud...' : 'Confirm Batch & Deduct Raw Materials'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* View Batch Details Modal */}
      {selectedBatchDetails && (
        <Modal
          isOpen={!!selectedBatchDetails}
          onClose={() => setSelectedBatchDetails(null)}
          title={`Batch Record: ${selectedBatchDetails.batch_number}`}
          subtitle={`Manufactured on ${formatDate(selectedBatchDetails.date)} by ${selectedBatchDetails.supervisor_name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px] uppercase">Product</span>
                <p className="font-bold text-white">{selectedBatchDetails.product_name}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase">Output Qty</span>
                <p className="font-bold font-mono text-emerald-400 text-sm">
                  +{selectedBatchDetails.quantity_produced} {selectedBatchDetails.base_unit}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase">Batch Total Cost</span>
                <p className="font-bold font-mono text-white text-sm">
                  {formatPKR(selectedBatchDetails.total_batch_cost)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase">Cost / Unit</span>
                <p className="font-bold font-mono text-emerald-400 text-sm">
                  {formatPKR(selectedBatchDetails.cost_per_base_unit)}/{selectedBatchDetails.base_unit}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">
                Raw Materials Consumed in this Batch
              </h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {selectedBatchDetails.raw_materials_consumed.map((rm, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-white">{rm.raw_material_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Cost Rate: {formatPKR(rm.unit_cost)}/{rm.unit}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-rose-400 text-xs">
                        -{rm.quantity_consumed} {rm.unit}
                      </span>
                      <p className="text-[11px] font-mono text-slate-300">
                        {formatPKR(rm.total_cost)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedBatchDetails.notes && (
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-300">
                <span className="font-bold text-slate-400 block text-[10px] uppercase mb-1">Supervisor Notes</span>
                <p>{selectedBatchDetails.notes}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedBatchDetails;
                    setSelectedBatchDetails(null);
                    setDeleteConfirmBatch(target);
                    setNegativeStockWarning(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold text-xs transition-colors"
                  title="Reverse batch and return consumed materials to stock"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete & Reverse Batch</span>
                </button>
              )}

              <button
                onClick={() => setSelectedBatchDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Production Batch Confirmation Modal */}
      {deleteConfirmBatch && (
        <Modal
          isOpen={!!deleteConfirmBatch}
          onClose={() => {
            setDeleteConfirmBatch(null);
            setNegativeStockWarning(null);
          }}
          title={`Delete & Reverse Batch: ${deleteConfirmBatch.batch_number}`}
          subtitle="Admin Automated Raw Material Restoration & Finished Stock Deduction"
        >
          <div className="space-y-4 text-xs">
            {/* Warning Block */}
            {negativeStockWarning && (
              <div className="p-3.5 rounded-xl bg-rose-500/20 border-2 border-rose-500/40 text-rose-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-400 text-sm">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>CRITICAL: Finished Goods Stock Warning!</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Reversing this production run will deduct finished goods that have already been dispatched or sold to customers on invoices:
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
                  <span>Automatic Production Reversal Actions:</span>
                </div>
                <ul className="space-y-1.5 text-slate-200 text-[11px] list-disc pl-5">
                  <li>
                    <strong>Raw Material Restoration:</strong> Consumed ingredients will be restored back to factory raw inventory:
                    <div className="mt-1 font-mono text-emerald-400">
                      {deleteConfirmBatch.raw_materials_consumed?.map(i => `• ${i.raw_material_name}: +${i.quantity_consumed} ${i.unit}`).join(', ')}
                    </div>
                  </li>
                  <li>
                    <strong>Finished Goods Deduction:</strong> Manufactured output will be subtracted from product warehouse inventory:
                    <div className="mt-1 font-mono text-rose-400">
                      • {deleteConfirmBatch.product_name}: -{deleteConfirmBatch.quantity_produced} {deleteConfirmBatch.base_unit}
                    </div>
                  </li>
                </ul>
              </div>
            )}

            <p className="text-slate-300">
              Are you sure you want to permanently cancel and delete production run <strong>{deleteConfirmBatch.batch_number}</strong>? An audit log entry will be saved.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteConfirmBatch(null);
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
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const res = await deleteProductionBatch(deleteConfirmBatch.id, currentUser, true);
                      alert(res.message);
                      setDeleteConfirmBatch(null);
                      setNegativeStockWarning(null);
                    } catch (err: any) {
                      alert(err?.message || 'Failed to delete batch');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? 'Reversing...' : 'Force Delete (Allow Negative Stock)'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const res = await deleteProductionBatch(deleteConfirmBatch.id, currentUser, false);
                      if (res.hasNegativeStockWarning && res.warningDetails) {
                        setNegativeStockWarning(res.warningDetails);
                      } else {
                        alert(res.message);
                        setDeleteConfirmBatch(null);
                      }
                    } catch (err: any) {
                      alert(err?.message || 'Failed to delete batch');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? 'Reversing...' : 'Confirm Deletion & Reverse Batch'}</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
