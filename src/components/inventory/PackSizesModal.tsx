import React, { useState } from 'react';
import { Product, PackSize, PackagingItem } from '../../types';
import { formatPKR } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Plus, Trash2, Box, ChevronDown, ChevronUp, PackageCheck, AlertCircle } from 'lucide-react';
import { generateId } from '../../utils/uuid';
import { useApp } from '../../context/AppContext';

interface PackSizesModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSave: (productId: string, packSizes: PackSize[]) => void;
}

export const PackSizesModal: React.FC<PackSizesModalProps> = ({
  product,
  isOpen,
  onClose,
  onSave,
}) => {
  const { rawMaterials } = useApp();
  const baseUnit = product.base_unit || product.unit || 'liter';
  const initialPackSizes = product.pack_sizes && product.pack_sizes.length > 0 
    ? product.pack_sizes 
    : [
        {
          id: generateId(),
          product_id: product.id,
          name: 'Standard 1 ' + (baseUnit === 'kg' ? 'Kg' : 'Liter'),
          size_in_base_unit: 1.0,
          unit_label: baseUnit,
          selling_price: product.selling_price,
          is_default: true,
          packaging_items: [],
          packed_stock: 0,
          true_cost: product.cost_price,
        }
      ];

  const [packSizes, setPackSizes] = useState<PackSize[]>(
    initialPackSizes.map(p => ({
      ...p,
      packaging_items: p.packaging_items ? p.packaging_items.map(pi => ({ ...pi })) : [],
      packed_stock: Number(p.packed_stock || 0),
      true_cost: Number(p.true_cost || 0),
      bottles_per_box: p.bottles_per_box !== undefined ? Number(p.bottles_per_box) : (p.size_in_base_unit <= 0.35 ? 24 : 12),
    }))
  );

  const [expandedRecipeIdx, setExpandedRecipeIdx] = useState<number | null>(0);

  const handleAddPackSize = () => {
    const newPack: PackSize = {
      id: generateId(),
      product_id: product.id,
      name: '1 Liter Bottle',
      size_in_base_unit: 1.0,
      unit_label: 'bottle',
      selling_price: product.selling_price,
      is_default: false,
      packaging_items: [],
      packed_stock: 0,
      true_cost: product.cost_price,
      bottles_per_box: 12,
    };
    setPackSizes(prev => [...prev, newPack]);
    setExpandedRecipeIdx(packSizes.length);
  };

  const handleRemovePackSize = (index: number) => {
    if (packSizes.length <= 1) {
      alert('A product must have at least one packaging or bulk sales reference.');
      return;
    }
    setPackSizes(prev => prev.filter((_, idx) => idx !== index));
    if (expandedRecipeIdx === index) {
      setExpandedRecipeIdx(null);
    }
  };

  const handleChangeField = (index: number, field: keyof PackSize, value: any) => {
    setPackSizes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSetDefault = (index: number) => {
    setPackSizes(prev => prev.map((p, idx) => ({
      ...p,
      is_default: idx === index,
    })));
  };

  // Packaging Recipe Handlers for a specific pack size
  const handleAddPackagingItem = (packIdx: number) => {
    if (rawMaterials.length === 0) {
      alert('No raw materials found. Please register packaging items (bottles, caps, labels) in Raw Materials first.');
      return;
    }

    // Default to first packaging material or first raw material
    const defaultRm = rawMaterials.find(r => r.category.toLowerCase().includes('pack')) || rawMaterials[0];
    const newItem: PackagingItem = {
      raw_material_id: defaultRm.id,
      raw_material_name: defaultRm.name,
      quantity: 1,
      unit: defaultRm.unit,
      cost_per_unit: defaultRm.cost_per_unit,
    };

    setPackSizes(prev => {
      const updated = [...prev];
      const items = updated[packIdx].packaging_items ? [...updated[packIdx].packaging_items!] : [];
      items.push(newItem);
      updated[packIdx] = { ...updated[packIdx], packaging_items: items };
      return updated;
    });
  };

  const handleRemovePackagingItem = (packIdx: number, itemIdx: number) => {
    setPackSizes(prev => {
      const updated = [...prev];
      const items = (updated[packIdx].packaging_items || []).filter((_, i) => i !== itemIdx);
      updated[packIdx] = { ...updated[packIdx], packaging_items: items };
      return updated;
    });
  };

  const handleChangePackagingItem = (packIdx: number, itemIdx: number, field: keyof PackagingItem, val: any) => {
    setPackSizes(prev => {
      const updated = [...prev];
      const items = [...(updated[packIdx].packaging_items || [])];
      
      if (field === 'raw_material_id') {
        const selectedRm = rawMaterials.find(r => r.id === val);
        if (selectedRm) {
          items[itemIdx] = {
            ...items[itemIdx],
            raw_material_id: selectedRm.id,
            raw_material_name: selectedRm.name,
            unit: selectedRm.unit,
            cost_per_unit: selectedRm.cost_per_unit,
          };
        }
      } else {
        items[itemIdx] = { ...items[itemIdx], [field]: val };
      }

      updated[packIdx] = { ...updated[packIdx], packaging_items: items };
      return updated;
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (packSizes.length === 0) {
      alert('Please add at least one packaging size');
      return;
    }

    // Recalculate true cost estimate for any pack with recipe
    const finalizedPackSizes = packSizes.map(pack => {
      const chemicalPortion = Number(((pack.size_in_base_unit || 1) * Number(product.cost_price || 0)).toFixed(4));
      const packagingPortion = Number(
        (pack.packaging_items || []).reduce((sum, item) => {
          const rm = rawMaterials.find(r => r.id === item.raw_material_id);
          const rate = rm ? Number(rm.cost_per_unit || 0) : Number(item.cost_per_unit || 0);
          return sum + (Number(item.quantity || 0) * rate);
        }, 0).toFixed(4)
      );
      const estimatedTrueCost = Number((chemicalPortion + packagingPortion).toFixed(4));

      return {
        ...pack,
        true_cost: pack.true_cost && pack.true_cost > 0 ? pack.true_cost : estimatedTrueCost,
        bottles_per_box: Number(pack.bottles_per_box || (pack.size_in_base_unit <= 0.35 ? 24 : 12))
      };
    });

    onSave(product.id, finalizedPackSizes);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Packaging & Recipes: ${product.name}`}
      subtitle={`Configure sales sizes, box definitions (bottles/box), and define packaging recipes to track TRUE unit cost.`}
      maxWidth="3xl"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Banner */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Box className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">
                Bulk Liquid Stock: <span className="font-mono text-emerald-400">{product.current_stock} {baseUnit} in warehouse</span>
                <span className="text-slate-400 text-xs ml-2 font-normal">(Bulk Chemical Cost: PKR {product.cost_price}/{baseUnit})</span>
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Define the packaging materials consumed per bottle. When you run a <strong>Bottling / Packing action</strong>, bulk liquid and packaging materials are deducted, and true cost per bottle is calculated automatically.
              </p>
            </div>
          </div>
        </div>

        {/* List of Pack Sizes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Sales Packaging Sizes, Box Types & Recipes
            </label>
            <button
              type="button"
              onClick={handleAddPackSize}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5" /> Add Pack Size
            </button>
          </div>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {packSizes.map((pack, idx) => {
              const chemicalPortion = Number(((pack.size_in_base_unit || 1) * Number(product.cost_price || 0)).toFixed(2));
              const packagingPortion = Number(
                (pack.packaging_items || []).reduce((sum, item) => {
                  const rm = rawMaterials.find(r => r.id === item.raw_material_id);
                  const rate = rm ? Number(rm.cost_per_unit || 0) : Number(item.cost_per_unit || 0);
                  return sum + (Number(item.quantity || 0) * rate);
                }, 0).toFixed(2)
              );
              const totalTrueCost = Number((chemicalPortion + packagingPortion).toFixed(2));
              const isExpanded = expandedRecipeIdx === idx;

              return (
                <div
                  key={pack.id || idx}
                  className="bg-slate-800/80 rounded-xl border border-slate-700/80 overflow-hidden shadow-sm"
                >
                  {/* Top Bar: Size Name, Size L, Bottles/Box, Selling Price */}
                  <div className="p-3 grid grid-cols-12 gap-2.5 items-center">
                    <div className="col-span-4">
                      <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Pack Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 275ml Bottle"
                        value={pack.name}
                        onChange={(e) => handleChangeField(idx, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Size ({baseUnit})</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          required
                          value={pack.size_in_base_unit}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleChangeField(idx, 'size_in_base_unit', val);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-cyan-400 uppercase font-bold block mb-0.5" title="Bottles per carton / box (e.g. 24 or 12)">
                        Bottles/Box
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={pack.bottles_per_box ?? (pack.size_in_base_unit <= 0.35 ? 24 : 12)}
                        onChange={(e) => handleChangeField(idx, 'bottles_per_box', parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-slate-900 border border-cyan-500/50 rounded-lg px-2 py-1.5 text-xs text-cyan-300 text-right font-mono font-bold focus:ring-1 focus:ring-cyan-400"
                        title="Bottles packed per carton box"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Rate (PKR)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={pack.selling_price}
                        onChange={(e) => handleChangeField(idx, 'selling_price', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono font-bold text-emerald-400"
                      />
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1.5 pt-4">
                      <button
                        type="button"
                        onClick={() => handleSetDefault(idx)}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                          pack.is_default
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                        title="Default in POS"
                      >
                        {pack.is_default ? 'Default' : 'Set Def'}
                      </button>

                      {packSizes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePackSize(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-700 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar: Live True Cost Breakdown & Recipe Toggle */}
                  <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <PackageCheck className="w-4 h-4 text-emerald-400" />
                        <span>Packed Stock: <strong className="text-white font-mono text-xs">{pack.packed_stock || 0}</strong> {pack.unit_label}s</span>
                      </div>
                      <div className="text-slate-400">
                        Chemical: <span className="font-mono text-slate-300">{formatPKR(chemicalPortion)}</span>
                        {' + '}
                        Packaging: <span className="font-mono text-slate-300">{formatPKR(packagingPortion)}</span>
                        {' = '}
                        <strong className="text-emerald-400 font-mono text-xs">True Cost: {formatPKR(totalTrueCost)}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedRecipeIdx(isExpanded ? null : idx)}
                      className="flex items-center gap-1 text-[11px] font-bold text-teal-400 hover:text-teal-300"
                    >
                      <span>Packaging Recipe ({pack.packaging_items?.length || 0} materials)</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Expandable Packaging Recipe Table */}
                  {isExpanded && (
                    <div className="p-3 bg-slate-950/70 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          Materials Required to Pack 1 Unit of "{pack.name}"
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddPackagingItem(idx)}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Packaging Material
                        </button>
                      </div>

                      {(!pack.packaging_items || pack.packaging_items.length === 0) ? (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-center text-[11px]">
                          No packaging recipe defined. Click <strong>"Add Packaging Material"</strong> to add bottle, cap, label, or cotton.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {pack.packaging_items.map((item, itemIdx) => {
                            const matchedRm = rawMaterials.find(r => r.id === item.raw_material_id);
                            const itemUnitCost = matchedRm ? Number(matchedRm.cost_per_unit || 0) : Number(item.cost_per_unit || 0);
                            const lineTotal = Number((Number(item.quantity || 0) * itemUnitCost).toFixed(2));

                            return (
                              <div
                                key={itemIdx}
                                className="grid grid-cols-12 gap-2 items-center bg-slate-900/90 p-2 rounded-lg border border-slate-800"
                              >
                                <div className="col-span-5">
                                  <select
                                    value={item.raw_material_id}
                                    onChange={(e) => handleChangePackagingItem(idx, itemIdx, 'raw_material_id', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                                  >
                                    {rawMaterials.map(rm => (
                                      <option key={rm.id} value={rm.id}>
                                        {rm.name} ({rm.unit}) - PKR {rm.cost_per_unit}/{rm.unit} [Stock: {rm.current_stock}]
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
                                    value={item.quantity}
                                    onChange={(e) => handleChangePackagingItem(idx, itemIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right font-mono"
                                  />
                                  <span className="text-slate-400 font-mono text-[10px] shrink-0">{item.unit}</span>
                                </div>

                                <div className="col-span-3 text-right">
                                  <span className="text-slate-400 text-[10px] block">Cost/unit: PKR {itemUnitCost}</span>
                                  <strong className="text-emerald-400 font-mono text-xs">{formatPKR(lineTotal)}</strong>
                                </div>

                                <div className="col-span-1 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePackagingItem(idx, itemIdx)}
                                    className="text-slate-500 hover:text-rose-400 p-1 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-colors"
          >
            Save Packaging & Recipe Setup
          </button>
        </div>
      </form>
    </Modal>
  );
};
