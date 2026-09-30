import React, { useState, useMemo } from 'react';
import { Product, PackSize, RawMaterial } from '../../types';
import { formatPKR, formatDate, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Package, 
  FlaskConical, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Sparkles,
  Calendar,
  User,
  Calculator,
  ArrowRight
} from 'lucide-react';

interface PackingRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
  initialPackSizeId?: string;
}

export const PackingRunModal: React.FC<PackingRunModalProps> = ({
  isOpen,
  onClose,
  initialProductId,
  initialPackSizeId,
}) => {
  const { products, rawMaterials, recordPackingRun } = useApp();
  const { currentUser } = useAuth();

  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || (products.length > 0 ? products[0].id : '')
  );

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const availablePackSizes = useMemo(
    () => (selectedProduct?.pack_sizes || []).filter(ps => ps.size_in_base_unit > 0),
    [selectedProduct]
  );

  const [selectedPackSizeId, setSelectedPackSizeId] = useState<string>(() => {
    if (initialPackSizeId && availablePackSizes.some(ps => ps.id === initialPackSizeId)) {
      return initialPackSizeId;
    }
    const def = availablePackSizes.find(ps => ps.is_default);
    return def ? def.id : (availablePackSizes[0]?.id || '');
  });

  const selectedPackSize = useMemo(
    () => availablePackSizes.find(ps => ps.id === selectedPackSizeId) || availablePackSizes[0],
    [availablePackSizes, selectedPackSizeId]
  );

  const [quantityToPack, setQuantityToPack] = useState<number | ''>(10);
  const [packingDate, setPackingDate] = useState<string>(getTodayDateString());
  const [operatorName, setOperatorName] = useState<string>(currentUser?.name || 'Staff');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculations for required materials and validation
  const baseUnit = selectedProduct?.base_unit || selectedProduct?.unit || 'liter';
  const packMultiplier = selectedPackSize ? Number(selectedPackSize.size_in_base_unit || 1) : 1;
  const numBottles = Number(quantityToPack || 0);

  const requiredBulkLiquid = Number((numBottles * packMultiplier).toFixed(4));
  const availableBulkStock = Number(selectedProduct?.current_stock || 0);
  const isBulkInsufficient = requiredBulkLiquid > availableBulkStock;

  const packagingRecipe = selectedPackSize?.packaging_items || [];

  const packagingRequirements = useMemo(() => {
    return packagingRecipe.map(item => {
      const rm = rawMaterials.find(r => r.id === item.raw_material_id);
      const totalNeeded = Number((numBottles * Number(item.quantity || 0)).toFixed(4));
      const available = rm ? Number(rm.current_stock || 0) : 0;
      const unitCost = rm ? Number(rm.cost_per_unit || 0) : Number(item.cost_per_unit || 0);
      const lineCost = Number((totalNeeded * unitCost).toFixed(4));
      const isShort = totalNeeded > available;

      return {
        item,
        rm,
        totalNeeded,
        available,
        unitCost,
        lineCost,
        isShort,
      };
    });
  }, [packagingRecipe, rawMaterials, numBottles]);

  const hasShortage = isBulkInsufficient || packagingRequirements.some(r => r.isShort);

  // Cost breakdown
  const bulkChemicalCostPerUnit = Number(selectedProduct?.cost_price || 0);
  const bulkLiquidTotalCost = Number((requiredBulkLiquid * bulkChemicalCostPerUnit).toFixed(4));
  const packagingTotalCost = Number(packagingRequirements.reduce((sum, r) => sum + r.lineCost, 0).toFixed(4));
  const totalRunCost = Number((bulkLiquidTotalCost + packagingTotalCost).toFixed(4));

  const chemicalCostPerBottle = numBottles > 0 ? Number((bulkLiquidTotalCost / numBottles).toFixed(4)) : 0;
  const packagingCostPerBottle = numBottles > 0 ? Number((packagingTotalCost / numBottles).toFixed(4)) : 0;
  const trueCostPerBottle = numBottles > 0 ? Number((totalRunCost / numBottles).toFixed(4)) : 0;

  const handleProductChange = (newProdId: string) => {
    setSelectedProductId(newProdId);
    const prod = products.find(p => p.id === newProdId);
    const packs = prod?.pack_sizes || [];
    const def = packs.find(ps => ps.is_default);
    setSelectedPackSizeId(def ? def.id : (packs[0]?.id || ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProduct || !selectedPackSize) {
      setErrorMsg('Please select a product and packaging size.');
      return;
    }

    if (!numBottles || numBottles <= 0) {
      setErrorMsg('Please enter a valid quantity of bottles to pack.');
      return;
    }

    if (hasShortage) {
      setErrorMsg('Cannot proceed: Insufficient bulk liquid or packaging materials in warehouse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordPackingRun({
        productId: selectedProduct.id,
        packSizeId: selectedPackSize.id,
        quantityPacked: numBottles,
        date: formatSelectedDateToIso(packingDate),
        operatorName: operatorName.trim() || 'Staff',
        notes: notes.trim(),
      });

      if (!result.success) {
        setErrorMsg(result.message);
        setIsSubmitting(false);
        return;
      }

      alert(result.message);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record packing run.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pack Bottles (Bottling Run)"
      subtitle="Fill bulk chemical liquid into bottles with caps, labels & packaging to produce sellable packed stock."
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="whitespace-pre-line text-xs font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Top Controls: Product, Pack Size, Quantity, Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
              1. Select Chemical Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-semibold"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Bulk: {p.current_stock} {p.base_unit || p.unit} @ PKR {p.cost_price}/{p.base_unit || p.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
              2. Select Pack Size Variant
            </label>
            <select
              value={selectedPackSizeId}
              onChange={(e) => setSelectedPackSizeId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 font-semibold"
            >
              {availablePackSizes.map(ps => (
                <option key={ps.id} value={ps.id}>
                  {ps.name} ({ps.size_in_base_unit} {baseUnit}) — In Stock: {ps.packed_stock || 0} {ps.unit_label}s
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
              3. Quantity of Bottles / Packs to Fill
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="1"
                required
                value={quantityToPack}
                onChange={(e) => setQuantityToPack(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="e.g. 10 or 150"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold text-right focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-slate-400 font-mono text-xs uppercase shrink-0">
                {selectedPackSize?.unit_label || 'bottles'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>4. Bottling Run Date</span>
            </label>
            <input
              type="date"
              required
              value={packingDate}
              onChange={(e) => setPackingDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Live Stock & Requirements Verification */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Required Inventory Deductions
            </h4>
            <span className="text-[11px] text-slate-400">
              Target Output: <strong className="text-white font-mono">{numBottles}</strong> {selectedPackSize?.name || 'Bottles'}
            </span>
          </div>

          {/* Bulk Liquid Check */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            isBulkInsufficient 
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' 
              : 'bg-slate-900/80 border-slate-800 text-slate-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <FlaskConical className={`w-5 h-5 ${isBulkInsufficient ? 'text-rose-400' : 'text-teal-400'}`} />
              <div>
                <p className="font-bold text-white text-xs">
                  Bulk Liquid: {selectedProduct?.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  Formula: {numBottles} bottles × {packMultiplier} {baseUnit} = <strong className="text-white font-mono">{requiredBulkLiquid} {baseUnit}</strong>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase">Warehouse Bulk Stock</span>
              <span className={`font-mono font-bold text-xs ${isBulkInsufficient ? 'text-rose-400' : 'text-emerald-400'}`}>
                {availableBulkStock} {baseUnit} available
              </span>
              {isBulkInsufficient && (
                <span className="text-[10px] text-rose-400 block font-semibold mt-0.5">
                  Short by {(requiredBulkLiquid - availableBulkStock).toFixed(2)} {baseUnit}
                </span>
              )}
            </div>
          </div>

          {/* Packaging Materials List */}
          <div className="space-y-1.5">
            {packagingRequirements.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
                No packaging materials assigned to this size yet. You can still pack, but packaging cost will be PKR 0.
              </div>
            ) : (
              packagingRequirements.map((req, rIdx) => (
                <div
                  key={rIdx}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    req.isShort 
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' 
                      : 'bg-slate-900/80 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className={`w-4 h-4 ${req.isShort ? 'text-rose-400' : 'text-emerald-400'}`} />
                    <div>
                      <span className="font-bold text-white">{req.rm?.name || req.item.raw_material_name}</span>
                      <span className="text-slate-400 text-[11px] ml-2">
                        ({req.item.quantity} {req.item.unit} / bottle)
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-xs">
                      Need: <strong className="text-white">{req.totalNeeded} {req.item.unit}</strong> | In Stock: <span className={req.isShort ? 'text-rose-400 font-bold' : 'text-emerald-400 font-mono'}>{req.available} {req.item.unit}</span>
                    </span>
                    <span className="text-slate-400 text-[10px] block font-mono">
                      PKR {req.unitCost}/{req.item.unit} = {formatPKR(req.lineCost)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* EXACT TRUE COST BREAKDOWN CARD (THE USER'S FORMULA VERIFICATION) */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-4 h-4" /> Exact True Cost Breakdown (Per Bottle & Batch)
            </span>
            <span className="text-[10px] text-slate-400">
              Batch Scale: {numBottles} units
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Chemical Portion</span>
              <p className="text-sm font-bold font-mono text-white">{formatPKR(chemicalCostPerBottle)}</p>
              <span className="text-[10px] text-slate-500 block">Total: {formatPKR(bulkLiquidTotalCost)}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Packaging Portion</span>
              <p className="text-sm font-bold font-mono text-white">{formatPKR(packagingCostPerBottle)}</p>
              <span className="text-[10px] text-slate-500 block">Total: {formatPKR(packagingTotalCost)}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-0.5">TRUE Cost / Bottle</span>
              <p className="text-base font-black font-mono text-emerald-400">{formatPKR(trueCostPerBottle)}</p>
              <span className="text-[10px] text-emerald-300/80 block">Batch Total: {formatPKR(totalRunCost)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Expected Selling Price: <strong className="text-white font-mono">{formatPKR(selectedPackSize?.selling_price || 0)}</strong>
            </span>
            <span>
              Real Profit / Bottle: <strong className="text-emerald-400 font-mono">
                {formatPKR(Math.max(0, (selectedPackSize?.selling_price || 0) - trueCostPerBottle))}
              </strong>
            </span>
          </div>
        </div>

        {/* Operator & Notes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Operator / Supervisor
            </label>
            <input
              type="text"
              required
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Morning bottling shift"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || hasShortage}
            className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2 ${
              hasShortage
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {isSubmitting ? (
              <span>Recording Packing Run...</span>
            ) : (
              <>
                <span>Confirm & Pack {numBottles} Bottles</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
