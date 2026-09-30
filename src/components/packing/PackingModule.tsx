import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product, PackSize, PackingRun } from '../../types';
import { formatPKR, formatDate } from '../../utils/formatters';
import { 
  Package, 
  FlaskConical, 
  Plus, 
  RotateCcw, 
  Boxes, 
  Eye, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  History,
  Layers,
  Sparkles,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { PackingRunModal } from './PackingRunModal';
import { PackSizesModal } from '../inventory/PackSizesModal';
import { Modal } from '../common/Modal';

export const PackingModule: React.FC = () => {
  const { products, packingRuns, deletePackingRun, updateProductPackSizes } = useApp();
  const { currentUser, isOwner } = useAuth();

  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Modals
  const [isPackModalOpen, setIsPackModalOpen] = useState<boolean>(false);
  const [selectedProductForPack, setSelectedProductForPack] = useState<string | undefined>();
  const [selectedPackSizeForPack, setSelectedPackSizeForPack] = useState<string | undefined>();

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState<boolean>(false);
  const [productForRecipe, setProductForRecipe] = useState<Product | null>(null);

  const [selectedRunDetails, setSelectedRunDetails] = useState<PackingRun | null>(null);

  // Quick stats calculations
  const totalBulkLiquidLiters = useMemo(() => {
    return products.reduce((acc, p) => acc + Number(p.current_stock || 0), 0);
  }, [products]);

  const totalPackedUnits = useMemo(() => {
    return products.reduce((acc, p) => {
      const pPacked = (p.pack_sizes || []).reduce((sum, ps) => sum + Number(ps.packed_stock || 0), 0);
      return acc + pPacked;
    }, 0);
  }, [products]);

  const totalPackedValuation = useMemo(() => {
    return products.reduce((acc, p) => {
      const pVal = (p.pack_sizes || []).reduce((sum, ps) => {
        const cost = Number(ps.true_cost || (p.cost_price * ps.size_in_base_unit) || 0);
        return sum + (Number(ps.packed_stock || 0) * cost);
      }, 0);
      return acc + pVal;
    }, 0);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      !p.is_archived && (
        p.name.toLowerCase().includes(term) || 
        p.sku.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
      )
    );
  }, [products, searchTerm]);

  // Filtered runs
  const filteredRuns = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return packingRuns.filter(r => 
      r.run_number?.toLowerCase().includes(term) ||
      r.product_name?.toLowerCase().includes(term) ||
      r.pack_size_name?.toLowerCase().includes(term) ||
      r.operator_name?.toLowerCase().includes(term)
    );
  }, [packingRuns, searchTerm]);

  const openPackingModal = (productId?: string, packSizeId?: string) => {
    setSelectedProductForPack(productId);
    setSelectedPackSizeForPack(packSizeId);
    setIsPackModalOpen(true);
  };

  const openRecipeModal = (prod: Product) => {
    setProductForRecipe(prod);
    setIsRecipeModalOpen(true);
  };

  const handleReverseRun = async (run: PackingRun) => {
    if (!currentUser) return;
    const confirmMsg = `Are you sure you want to reverse Packing Run "${run.run_number}"?\n\nThis will:\n• Deduct ${run.quantity_packed} bottles from ${run.pack_size_name} packed stock\n• Restore ${run.bulk_liquid_consumed} bulk liquid to warehouse stock\n• Restore all consumed packaging materials (bottles, caps, labels, cotton)`;
    if (!window.confirm(confirmMsg)) return;

    const res = await deletePackingRun(run.id, currentUser);
    alert(res.message);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Boxes className="w-6 h-6 text-emerald-400" />
              Bottling & Packing Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Production to Sales Bridge
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fill bulk chemical liquids into bottles with packaging materials, track TRUE combined unit costs, and manage packed inventory.
          </p>
        </div>

        <button
          onClick={() => openPackingModal()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Pack Bottles (Bottling Run)</span>
        </button>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bulk Liquid Unpacked</span>
            <FlaskConical className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-lg font-black text-white font-mono mt-1">
            {totalBulkLiquidLiters.toFixed(2)} <span className="text-xs font-normal text-slate-400">Liters/Kg</span>
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">Sits in bulk chemical tanks</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Packed Ready to Sell</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-emerald-400 font-mono mt-1">
            {totalPackedUnits.toLocaleString()} <span className="text-xs font-normal text-slate-400">Units / Bottles</span>
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">Ready in finished goods storage</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bottled Inventory Value</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-lg font-black text-white font-mono mt-1">
            {formatPKR(totalPackedValuation)}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">At true combined cost (liquid + packaging)</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Bottling Runs</span>
            <History className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-lg font-black text-white font-mono mt-1">
            {packingRuns.length} <span className="text-xs font-normal text-slate-400">Batches</span>
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">Historical packaging runs logged</span>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white bg-slate-900/50'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Packed Products & Recipes ({filteredProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white bg-slate-900/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Bottling Run History ({filteredRuns.length})</span>
          </button>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={activeTab === 'inventory' ? "Search products..." : "Search runs, products, operators..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tab 1: Packed Inventory & Recipes Overview */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {filteredProducts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-xs">
              No products found matching your search.
            </div>
          ) : (
            filteredProducts.map(product => {
              const baseUnit = product.base_unit || product.unit || 'liter';
              const packSizes = product.pack_sizes || [];

              return (
                <div 
                  key={product.id}
                  className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-sm"
                >
                  {/* Product Header */}
                  <div className="p-4 bg-slate-900 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm">{product.name}</h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {product.sku}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-teal-400">
                            {product.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Unpacked Bulk Liquid in Tanks: <strong className="text-white font-mono">{product.current_stock} {baseUnit}</strong>
                          <span className="text-slate-500 ml-2">(Chemical Bulk Cost: PKR {product.cost_price}/{baseUnit})</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openRecipeModal(product)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700/60 transition-colors flex items-center gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5 text-teal-400" />
                        <span>Packaging Recipes</span>
                      </button>

                      <button
                        onClick={() => openPackingModal(product.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-xs border border-emerald-500/30 transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Pack Bottles</span>
                      </button>
                    </div>
                  </div>

                  {/* Pack Sizes Grid */}
                  <div className="p-4">
                    {packSizes.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        No packaging sizes defined yet for this product. Click "Packaging Recipes" to add sizes (e.g. 1L, 500ml).
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {packSizes.map(pack => {
                          const chemicalPortion = Number(((pack.size_in_base_unit || 1) * Number(product.cost_price || 0)).toFixed(2));
                          const packagingPortion = Number(
                            (pack.packaging_items || []).reduce((sum, item) => {
                              return sum + (Number(item.quantity || 0) * Number(item.cost_per_unit || 0));
                            }, 0).toFixed(2)
                          );
                          const recordedTrueCost = Number((pack.true_cost || (chemicalPortion + packagingPortion)).toFixed(2));
                          const profitMargin = Math.max(0, Number((pack.selling_price - recordedTrueCost).toFixed(2)));

                          return (
                            <div 
                              key={pack.id}
                              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5 relative"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                                    <Package className="w-4 h-4 text-emerald-400" />
                                    {pack.name}
                                  </h4>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Size: {pack.size_in_base_unit} {baseUnit} | Label: {pack.unit_label}
                                  </span>
                                </div>

                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block uppercase">Packed Stock</span>
                                  <span className="font-mono font-black text-sm text-emerald-400">
                                    {pack.packed_stock || 0} <span className="text-[10px] font-normal text-slate-400">{pack.unit_label}s</span>
                                  </span>
                                </div>
                              </div>

                              {/* Recipe Summary */}
                              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/60 text-[11px] space-y-1">
                                <div className="flex justify-between text-slate-400">
                                  <span>Chemical Cost:</span>
                                  <span className="font-mono text-slate-300">{formatPKR(chemicalPortion)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Packaging Materials:</span>
                                  <span className="font-mono text-slate-300">
                                    {formatPKR(packagingPortion)} ({pack.packaging_items?.length || 0} items)
                                  </span>
                                </div>
                                <div className="pt-1 border-t border-slate-800 flex justify-between font-bold">
                                  <span className="text-emerald-400">TRUE Unit Cost:</span>
                                  <span className="font-mono text-emerald-400 text-xs">{formatPKR(recordedTrueCost)}</span>
                                </div>
                              </div>

                              {/* Sales & Profit Preview */}
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span>Selling Price: <strong className="text-white font-mono">{formatPKR(pack.selling_price)}</strong></span>
                                <span>Profit: <strong className="text-emerald-400 font-mono">{formatPKR(profitMargin)}</strong></span>
                              </div>

                              {/* Action */}
                              <button
                                onClick={() => openPackingModal(product.id, pack.id)}
                                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-slate-700/60"
                              >
                                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Pack "{pack.name}"</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Bottling Run History Table */}
      {activeTab === 'history' && (
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px] bg-slate-950/60">
                  <th className="py-3 px-3">Run #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Product & Pack Size</th>
                  <th className="py-3 px-3 text-right">Bottles Packed</th>
                  <th className="py-3 px-3 text-right">Bulk Consumed</th>
                  <th className="py-3 px-3 text-right">Packaging Cost</th>
                  <th className="py-3 px-3 text-right">Total Batch Cost</th>
                  <th className="py-3 px-3 text-right">TRUE Cost / Unit</th>
                  <th className="py-3 px-3">Operator</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No packing runs recorded yet. Click "+ Pack Bottles" to log your first run.
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map(run => (
                    <tr key={run.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-white text-xs">
                        {run.run_number}
                      </td>
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        {formatDate(run.date)}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-white">{run.product_name}</p>
                        <p className="text-[11px] text-teal-400">{run.pack_size_name}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                        {run.quantity_packed}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {run.bulk_liquid_consumed} <span className="text-[10px] text-slate-500">({formatPKR(run.bulk_total_cost)})</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {formatPKR(run.packaging_total_cost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">
                        {formatPKR(run.total_cost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                        {formatPKR(run.true_cost_per_unit)}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {run.operator_name || 'Staff'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedRunDetails(run)}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                            title="View Cost Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isOwner && (
                            <button
                              onClick={() => handleReverseRun(run)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                              title="Reverse & Delete Run"
                            >
                              <RotateCcw className="w-4 h-4" />
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

      {/* Modal: Pack Bottles Run */}
      {isPackModalOpen && (
        <PackingRunModal
          isOpen={isPackModalOpen}
          onClose={() => setIsPackModalOpen(false)}
          initialProductId={selectedProductForPack}
          initialPackSizeId={selectedPackSizeForPack}
        />
      )}

      {/* Modal: Pack Sizes & Recipes Editor */}
      {isRecipeModalOpen && productForRecipe && (
        <PackSizesModal
          isOpen={isRecipeModalOpen}
          onClose={() => {
            setIsRecipeModalOpen(false);
            setProductForRecipe(null);
          }}
          product={productForRecipe}
          onSave={updateProductPackSizes}
        />
      )}

      {/* Modal: View Run Details & Full Cost Breakdown */}
      {selectedRunDetails && (
        <Modal
          isOpen={Boolean(selectedRunDetails)}
          onClose={() => setSelectedRunDetails(null)}
          title={`Packing Run Breakdown: ${selectedRunDetails.run_number}`}
          subtitle={`Packed ${selectedRunDetails.quantity_packed} bottles of ${selectedRunDetails.product_name} (${selectedRunDetails.pack_size_name}) on ${formatDate(selectedRunDetails.date)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Run summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block mb-0.5">Bulk Chemical Liquid</span>
                <p className="text-sm font-bold font-mono text-white">
                  {selectedRunDetails.bulk_liquid_consumed} units
                </p>
                <span className="text-[10px] text-teal-400 font-mono block mt-0.5">
                  {formatPKR(selectedRunDetails.bulk_total_cost)} (PKR {(selectedRunDetails.bulk_total_cost / selectedRunDetails.quantity_packed).toFixed(2)}/bottle)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block mb-0.5">Packaging Materials</span>
                <p className="text-sm font-bold font-mono text-white">
                  {selectedRunDetails.packaging_materials_consumed?.length || 0} items
                </p>
                <span className="text-[10px] text-teal-400 font-mono block mt-0.5">
                  {formatPKR(selectedRunDetails.packaging_total_cost)} (PKR {(selectedRunDetails.packaging_total_cost / selectedRunDetails.quantity_packed).toFixed(2)}/bottle)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-0.5">TRUE Cost / Bottle</span>
                <p className="text-base font-black font-mono text-emerald-400">
                  {formatPKR(selectedRunDetails.true_cost_per_unit)}
                </p>
                <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                  Total: {formatPKR(selectedRunDetails.total_cost)}
                </span>
              </div>
            </div>

            {/* Consumed materials list */}
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Materials Consumed in this Bottling Run
              </h4>
              <div className="divide-y divide-slate-800 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
                {/* Bulk Liquid line */}
                <div className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-400" />
                    <div>
                      <span className="font-bold text-white">Bulk {selectedRunDetails.product_name} Liquid</span>
                      <span className="text-slate-400 text-[10px] ml-2 font-mono">
                        ({selectedRunDetails.size_in_base_unit} L/bottle)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-white">{selectedRunDetails.bulk_liquid_consumed} Liters</span>
                    <span className="text-slate-400 text-[10px] block font-mono">
                      @ PKR {selectedRunDetails.bulk_unit_cost}/L = {formatPKR(selectedRunDetails.bulk_total_cost)}
                    </span>
                  </div>
                </div>

                {/* Packaging Items */}
                {(selectedRunDetails.packaging_materials_consumed || []).map((m, mIdx) => (
                  <div key={mIdx} className="p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-white">{m.raw_material_name}</span>
                        <span className="text-slate-400 text-[10px] ml-2 font-mono">
                          ({m.quantity_per_unit} {m.unit}/bottle)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-white">{m.total_quantity} {m.unit}</span>
                      <span className="text-slate-400 text-[10px] block font-mono">
                        @ PKR {m.unit_cost}/{m.unit} = {formatPKR(m.total_cost)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedRunDetails.notes && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs">
                <strong>Notes:</strong> {selectedRunDetails.notes}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRunDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
