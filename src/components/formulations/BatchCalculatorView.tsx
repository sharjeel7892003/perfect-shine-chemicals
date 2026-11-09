import React, { useState, useMemo, useEffect } from 'react';
import {
  Calculator,
  Printer,
  Play,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Beaker,
  Package,
  Info,
  X,
  FileText,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ProductFormulation, Product, RawMaterial } from '../../types';
import { getNextBatchNumberForProduct } from '../../utils/batchNumber';
import { formatDate as formatDatePK } from '../../utils/formatters';

export type CalculatorUnit = 'kg' | 'liter' | 'ton';

export interface CalculatedIngredientRow {
  raw_material_id: string;
  raw_material_name: string;
  unit: 'kg' | 'liter' | 'pcs';
  ratio_per_base_unit: number;
  required_quantity: number;
  required_grams: number | null; // Populated when unit === 'kg' and 0 < required_quantity < 1
  available_stock: number;
  is_short: boolean;
  shortage_quantity: number;
  active_master_rate: number;
  estimated_cost: number;
  max_possible_base_units: number;
}

export interface BatchCalculationResult {
  product: Product;
  formulation: ProductFormulation;
  targetInputQuantity: number;
  targetInputUnit: CalculatorUnit;
  densityUsed: number;
  isDensityConverted: boolean;
  targetInBaseUnit: number; // In product's base_unit ('kg' or 'liter')
  targetInKg: number; // Equivalent weight in kg of the target batch
  totalIngredientWeightKg: number; // Sum of all non-packaging ingredient weights in kg
  totalIngredientBaseSum: number; // Sum of all non-packaging ingredient quantities per recipe
  weightDifferenceKg: number; // totalIngredientWeightKg - targetInKg
  yieldRatioPercent: number; // (targetInBaseUnit / totalIngredientBaseSum) * 100
  ingredients: CalculatedIngredientRow[];
  packagingIngredients: CalculatedIngredientRow[];
  allRows: CalculatedIngredientRow[];
  maxBatchInBaseUnit: number;
  maxBatchInSelectedUnit: number;
  limitingIngredientName: string | null;
  estimatedTotalCost: number;
  estimatedCostPerBaseUnit: number;
  estimatedCostPerKg: number;
  suggestedBatchNumber: string;
}

/**
 * Pure calculation helper for the Batch Calculator so it can be verified both in UI and tests.
 * Performs ZERO database writes or stock movements.
 */
export function calculateBatchFromFormulation(params: {
  product: Product;
  formulation: ProductFormulation;
  targetQuantity: number;
  selectedUnit: CalculatorUnit;
  rawMaterials: RawMaterial[];
  existingBatchesCountOrList?: any[];
}): BatchCalculationResult {
  const { product, formulation, targetQuantity, selectedUnit, rawMaterials, existingBatchesCountOrList = [] } = params;
  const safeTargetQty = Math.max(0, Number(targetQuantity) || 0);
  const baseUnit = (formulation.base_unit || product.base_unit || 'kg') as 'kg' | 'liter';
  const yieldBasis = Number(formulation.yield_quantity) > 0 ? Number(formulation.yield_quantity) : 1.0;
  const densityUsed = Number(product.density) > 0 ? Number(product.density) : 1.0;

  // Step 1: Convert selected unit ('kg' | 'liter' | 'ton') into product's base_unit ('kg' | 'liter')
  // 1 ton = 1,000 kg
  const inputInKgOrLiter = selectedUnit === 'ton' ? safeTargetQty * 1000 : safeTargetQty;
  const effectiveInputUnit: 'kg' | 'liter' = selectedUnit === 'ton' ? 'kg' : selectedUnit;

  let targetInBaseUnit = inputInKgOrLiter;
  let isDensityConverted = false;

  if (baseUnit === 'liter' && effectiveInputUnit === 'kg') {
    // Product is measured in liters, user entered kg (or ton) -> liters = kg / density
    targetInBaseUnit = densityUsed > 0 ? inputInKgOrLiter / densityUsed : inputInKgOrLiter;
    isDensityConverted = true;
  } else if (baseUnit === 'kg' && effectiveInputUnit === 'liter') {
    // Product is measured in kg, user entered liters -> kg = liters * density
    targetInBaseUnit = inputInKgOrLiter * densityUsed;
    isDensityConverted = true;
  }

  // Target weight in kg (for comparing with total weight of ingredients)
  const targetInKg = baseUnit === 'kg' ? targetInBaseUnit : targetInBaseUnit * densityUsed;

  const scaleMultiplier = targetInBaseUnit / yieldBasis;

  const allRows: CalculatedIngredientRow[] = [];
  let totalIngredientWeightKg = 0;
  let totalIngredientBaseSum = 0;
  let estimatedTotalCost = 0;
  let maxBatchInBaseUnit = Infinity;
  let limitingIngredientName: string | null = null;

  for (const item of formulation.items || []) {
    const rm = rawMaterials.find(r => r.id === item.raw_material_id);
    const unit = (rm?.unit || item.unit || 'kg') as 'kg' | 'liter' | 'pcs';
    const ratioPerBaseUnit = Number(item.quantity || 0) / yieldBasis;
    const rawRequired = ratioPerBaseUnit * targetInBaseUnit;
    // Keep exact floating precision up to 6 decimals for ratio math, display formatted to 3 decimals
    const requiredQuantity = Number(rawRequired.toFixed(6));

    // For anything under 1 kg (0 < req < 1 and unit === 'kg'), also compute grams
    const requiredGrams =
      unit === 'kg' && requiredQuantity > 0 && requiredQuantity < 1
        ? Number((requiredQuantity * 1000).toFixed(3))
        : null;

    const availableStock = rm ? Number(rm.current_stock || 0) : 0;
    const shortageQuantity = requiredQuantity > availableStock
      ? Number((requiredQuantity - availableStock).toFixed(4))
      : 0;
    const isShort = shortageQuantity > 0;

    // Always use raw material's current Active Master Rate (latest landed cost)
    const activeMasterRate = rm ? Number(rm.cost_per_unit || 0) : Number(item.cost_per_unit || 0);
    const estimatedCost = Number((requiredQuantity * activeMasterRate).toFixed(2));
    estimatedTotalCost += estimatedCost;

    // Max batch possible from this ingredient
    let maxPossibleFromThis = Infinity;
    if (ratioPerBaseUnit > 0) {
      maxPossibleFromThis = Math.max(0, availableStock / ratioPerBaseUnit);
      if (maxPossibleFromThis < maxBatchInBaseUnit) {
        maxBatchInBaseUnit = maxPossibleFromThis;
        limitingIngredientName = rm?.name || item.raw_material_name;
      }
    }

    // Add to total ingredient weight if chemical/liquid (not packaging pcs)
    if (unit !== 'pcs') {
      totalIngredientBaseSum += requiredQuantity;
      // In chemical formulations, kg and liter raw materials (mostly aqueous/surfactants) contribute to batch mass
      totalIngredientWeightKg += requiredQuantity;
    }

    allRows.push({
      raw_material_id: item.raw_material_id,
      raw_material_name: rm?.name || item.raw_material_name,
      unit,
      ratio_per_base_unit: ratioPerBaseUnit,
      required_quantity: requiredQuantity,
      required_grams: requiredGrams,
      available_stock: availableStock,
      is_short: isShort,
      shortage_quantity: shortageQuantity,
      active_master_rate: activeMasterRate,
      estimated_cost: estimatedCost,
      max_possible_base_units: maxPossibleFromThis,
    });
  }

  if (!isFinite(maxBatchInBaseUnit)) {
    maxBatchInBaseUnit = 0;
  }

  // Convert maxBatchInBaseUnit into user's selectedUnit
  let maxBatchInSelectedUnit = maxBatchInBaseUnit;
  if (selectedUnit === 'ton') {
    const maxInKg = baseUnit === 'kg' ? maxBatchInBaseUnit : maxBatchInBaseUnit * densityUsed;
    maxBatchInSelectedUnit = maxInKg / 1000;
  } else if (selectedUnit === 'kg' && baseUnit === 'liter') {
    maxBatchInSelectedUnit = maxBatchInBaseUnit * densityUsed;
  } else if (selectedUnit === 'liter' && baseUnit === 'kg') {
    maxBatchInSelectedUnit = densityUsed > 0 ? maxBatchInBaseUnit / densityUsed : maxBatchInBaseUnit;
  }

  const estimatedCostPerBaseUnit = targetInBaseUnit > 0
    ? Number((estimatedTotalCost / targetInBaseUnit).toFixed(2))
    : 0;
  const estimatedCostPerKg = targetInKg > 0
    ? Number((estimatedTotalCost / targetInKg).toFixed(2))
    : 0;

  const weightDifferenceKg = Number((totalIngredientWeightKg - targetInKg).toFixed(4));
  const yieldRatioPercent = totalIngredientBaseSum > 0
    ? Number(((targetInBaseUnit / totalIngredientBaseSum) * 100).toFixed(2))
    : 100;

  const suggestedBatchNumber = getNextBatchNumberForProduct(
    product.id,
    existingBatchesCountOrList,
    product
  );

  return {
    product,
    formulation,
    targetInputQuantity: safeTargetQty,
    targetInputUnit: selectedUnit,
    densityUsed,
    isDensityConverted,
    targetInBaseUnit: Number(targetInBaseUnit.toFixed(4)),
    targetInKg: Number(targetInKg.toFixed(4)),
    totalIngredientWeightKg: Number(totalIngredientWeightKg.toFixed(4)),
    totalIngredientBaseSum: Number(totalIngredientBaseSum.toFixed(4)),
    weightDifferenceKg,
    yieldRatioPercent,
    ingredients: allRows.filter(r => r.unit !== 'pcs'),
    packagingIngredients: allRows.filter(r => r.unit === 'pcs'),
    allRows,
    maxBatchInBaseUnit: Number(maxBatchInBaseUnit.toFixed(3)),
    maxBatchInSelectedUnit: Number(maxBatchInSelectedUnit.toFixed(3)),
    limitingIngredientName,
    estimatedTotalCost: Number(estimatedTotalCost.toFixed(2)),
    estimatedCostPerBaseUnit,
    estimatedCostPerKg,
    suggestedBatchNumber,
  };
}

/**
 * Formats a quantity up to 3 decimal places (removing unnecessary trailing zeros only when exact integer,
 * or keeping 3 decimals for sub-kg precision).
 */
export function formatQty3(val: number): string {
  if (!isFinite(val)) return '0';
  const rounded = Number(val.toFixed(3));
  // Always show up to 3 decimals; if < 1 and > 0, show 3 decimals (e.g. 0.350)
  if (rounded > 0 && rounded < 1) {
    return rounded.toFixed(3);
  }
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 3,
    maximumFractionDigits: 3,
  });
}

interface BatchCalculatorViewProps {
  initialProductId?: string;
  onStartProductionBatch?: (productId: string, targetBaseQuantity: number, formulationVersion: number) => void;
}

export const BatchCalculatorView: React.FC<BatchCalculatorViewProps> = ({
  initialProductId,
  onStartProductionBatch,
}) => {
  const {
    products,
    rawMaterials,
    formulations,
    productionBatches,
    setPendingCalculatorBatch,
  } = useApp();
  const { currentUser } = useAuth();

  // Only products that have an active LOCKED formulation can be selected in the Batch Calculator
  const lockedFormulations = useMemo(() => {
    return formulations
      .filter(f => !f.is_archived && !f.is_historical_version && Boolean(f.is_locked))
      .sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [formulations]);

  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    if (initialProductId && lockedFormulations.some(f => f.product_id === initialProductId)) {
      return initialProductId;
    }
    return lockedFormulations[0]?.product_id || '';
  });

  useEffect(() => {
    if (initialProductId && lockedFormulations.some(f => f.product_id === initialProductId)) {
      setSelectedProductId(initialProductId);
    } else if (!selectedProductId && lockedFormulations.length > 0) {
      setSelectedProductId(lockedFormulations[0].product_id);
    }
  }, [initialProductId, lockedFormulations, selectedProductId]);

  const selectedFormulation = useMemo(() => {
    return lockedFormulations.find(f => f.product_id === selectedProductId) || null;
  }, [lockedFormulations, selectedProductId]);

  const selectedProduct = useMemo(() => {
    if (!selectedFormulation) return null;
    return products.find(p => p.id === selectedFormulation.product_id) || null;
  }, [products, selectedFormulation]);

  const [targetQuantityInput, setTargetQuantityInput] = useState<string>('100');
  const [selectedUnit, setSelectedUnit] = useState<CalculatorUnit>('kg');
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Sync default unit when product changes
  useEffect(() => {
    if (selectedFormulation) {
      setSelectedUnit(selectedFormulation.base_unit === 'liter' ? 'liter' : 'kg');
    }
  }, [selectedFormulation?.id]);

  const calculation = useMemo<BatchCalculationResult | null>(() => {
    if (!selectedProduct || !selectedFormulation) return null;
    const qty = parseFloat(targetQuantityInput);
    return calculateBatchFromFormulation({
      product: selectedProduct,
      formulation: selectedFormulation,
      targetQuantity: isNaN(qty) || qty < 0 ? 0 : qty,
      selectedUnit,
      rawMaterials,
      existingBatchesCountOrList: productionBatches,
    });
  }, [selectedProduct, selectedFormulation, targetQuantityInput, selectedUnit, rawMaterials, productionBatches]);

  const shortageCount = useMemo(() => {
    if (!calculation) return 0;
    return calculation.allRows.filter(r => r.is_short).length;
  }, [calculation]);

  const handleStartBatch = () => {
    if (!calculation) return;
    const version = Number(calculation.formulation.version || 1);
    setPendingCalculatorBatch({
      productId: calculation.product.id,
      targetQuantity: calculation.targetInBaseUnit,
      formulationVersion: version,
    });
    if (onStartProductionBatch) {
      onStartProductionBatch(calculation.product.id, calculation.targetInBaseUnit, version);
    }
  };

  const handlePrintSheet = () => {
    setShowPrintModal(true);
  };

  if (lockedFormulations.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white">No Locked Formulations Available</h3>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          The Batch Calculator only uses <strong className="text-slate-200">Locked Formulations</strong> to guarantee approved, tamper-proof ingredient ratios on the production floor.
          {currentUser?.role === 'owner'
            ? ' Switch to the "Formulations & Versions" tab and click "Lock Formulation" on a recipe to enable it here.'
            : ' Please ask the Admin to lock the product formulation first.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Read-Only Assurance Banner */}
      <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Calculator className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-200/90 space-y-1">
            <p className="font-semibold text-indigo-200">
              Simulation & Batch Sheet Calculator (Zero Stock Impact)
            </p>
            <p>
              Each stored formulation is defined per <strong className="text-white">1.0 {selectedFormulation?.base_unit || 'kg/liter'} of finished output</strong>.
              Calculating or printing a batch sheet here <strong className="text-emerald-300">never deducts stock or creates any database record</strong>.
              Stock only changes when you record an actual production batch.
            </p>
          </div>
        </div>
        {calculation && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintSheet}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4 text-indigo-400" />
              Print Batch Sheet
            </button>
            <button
              type="button"
              onClick={handleStartBatch}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-colors"
            >
              <Play className="w-4 h-4" />
              Start Production Batch
            </button>
          </div>
        )}
      </div>

      {/* Input Controls Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Product Selector (Locked formulations only) */}
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Product (Locked Formulations Only)
            </label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {lockedFormulations.map(f => {
                const prod = products.find(p => p.id === f.product_id);
                return (
                  <option key={f.id} value={f.product_id}>
                    {f.product_name} — v{f.version || 1} [Locked • Base: {f.base_unit.toUpperCase()}]
                    {prod?.sku ? ` (${prod.sku})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Target Quantity */}
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Batch Quantity
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={targetQuantityInput}
              onChange={e => setTargetQuantityInput(e.target.value)}
              placeholder="e.g. 70, 500, 1"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Target Unit */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Unit
            </label>
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value as CalculatorUnit)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="kg">kg (Kilograms)</option>
              <option value="liter">liter (Liters)</option>
              <option value="ton">ton (1 ton = 1,000 kg)</option>
            </select>
          </div>

          {/* Quick Presets */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Quick Presets
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTargetQuantityInput('70');
                  setSelectedUnit('kg');
                }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                  targetQuantityInput === '70' && selectedUnit === 'kg'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                70 kg
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetQuantityInput('500');
                  setSelectedUnit('kg');
                }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                  targetQuantityInput === '500' && selectedUnit === 'kg'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                500 kg
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetQuantityInput('1');
                  setSelectedUnit('ton');
                }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                  targetQuantityInput === '1' && selectedUnit === 'ton'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                1 ton
              </button>
            </div>
          </div>
        </div>

        {/* Formulation Metadata & Density Conversion Notice */}
        {calculation && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                Locked Formulation v{calculation.formulation.version || 1}
              </span>
              <span className="text-slate-400">
                Locked Date:{' '}
                <strong className="text-slate-200">
                  {formatDatePK(calculation.formulation.locked_at || calculation.formulation.updated_at || calculation.formulation.created_at)}
                </strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">
                Product Base Unit:{' '}
                <strong className="text-indigo-300 uppercase">{calculation.formulation.base_unit}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">
                Suggested Next Batch #:{' '}
                <strong className="text-amber-300 font-mono">{calculation.suggestedBatchNumber}</strong> (Preview)
              </span>
            </div>

            {/* Density info (always shown when converting between kg/ton and liter, and shown for reference) */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border font-medium ${
                  calculation.isDensityConverted
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                Density Used: <strong className="text-white font-mono">{calculation.densityUsed.toFixed(2)} kg/L</strong>
                {calculation.isDensityConverted && (
                  <span>
                    ({calculation.targetInputQuantity} {calculation.targetInputUnit} ={' '}
                    <strong className="text-white font-mono">
                      {formatQty3(calculation.targetInBaseUnit)} {calculation.formulation.base_unit}
                    </strong>
                    )
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {calculation && (
        <>
          {/* Summary KPI Strip: Target Output vs Total Ingredient Weight, Max Batch Possible, and Estimated Cost */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1. Target Output vs Total Weight of Ingredients */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-indigo-400" />
                  Target Output vs. Total Ingredient Weight
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  Basis: per 1 {calculation.formulation.base_unit} output
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-baseline mt-3">
                <div>
                  <p className="text-[11px] text-slate-400">Target Finished Batch</p>
                  <p className="text-lg font-bold font-mono text-white">
                    {formatQty3(calculation.targetInputQuantity)} {calculation.targetInputUnit}
                  </p>
                  {(calculation.targetInputUnit !== calculation.formulation.base_unit) && (
                    <p className="text-[11px] font-mono text-indigo-300">
                      = {formatQty3(calculation.targetInBaseUnit)} {calculation.formulation.base_unit}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Total Weight of Ingredients</p>
                  <p className="text-lg font-bold font-mono text-emerald-400">
                    {formatQty3(calculation.totalIngredientWeightKg)} kg
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ({formatQty3(calculation.totalIngredientWeightKg / (calculation.targetInBaseUnit || 1))} kg per 1 {calculation.formulation.base_unit})
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-3">
                  <p className="text-[11px] text-slate-400">Weight Difference / Yield</p>
                  <p
                    className={`text-sm font-bold font-mono ${
                      Math.abs(calculation.weightDifferenceKg) < 0.001
                        ? 'text-slate-300'
                        : calculation.weightDifferenceKg > 0
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    {calculation.weightDifferenceKg > 0 ? '+' : ''}
                    {formatQty3(calculation.weightDifferenceKg)} kg
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {Math.abs(calculation.weightDifferenceKg) < 0.001
                      ? 'Exact 100% mass match'
                      : calculation.weightDifferenceKg > 0
                      ? 'Inputs > target (yield/density > 1.0)'
                      : 'Inputs < target (add water / balance)'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Maximum Batch Possible with Current Stock */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Max Batch Possible (Stock)
                </span>
                {shortageCount > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-xl font-bold font-mono text-white mt-2">
                {formatQty3(calculation.maxBatchInSelectedUnit)} {calculation.targetInputUnit}
              </p>
              {calculation.targetInputUnit !== calculation.formulation.base_unit && (
                <p className="text-xs font-mono text-slate-400">
                  ({formatQty3(calculation.maxBatchInBaseUnit)} {calculation.formulation.base_unit})
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-1.5 truncate" title={calculation.limitingIngredientName || ''}>
                Limiting item:{' '}
                <strong className="text-amber-300">
                  {calculation.limitingIngredientName || 'None'}
                </strong>
              </p>
            </div>

            {/* 3. Estimated Batch Cost & Cost per kg (Marked as Estimate) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Estimated Batch Cost
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Estimate
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-2">
                PKR {calculation.estimatedTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-300 mt-1.5 pt-1.5 border-t border-slate-800/80">
                <span>
                  Est. Cost / kg:{' '}
                  <strong className="font-mono text-white">
                    PKR {calculation.estimatedCostPerKg.toFixed(2)}
                  </strong>
                </span>
                {calculation.formulation.base_unit === 'liter' && (
                  <span>
                    / L:{' '}
                    <strong className="font-mono text-indigo-300">
                      PKR {calculation.estimatedCostPerBaseUnit.toFixed(2)}
                    </strong>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Uses each raw material's latest landed Active Master Rate
              </p>
            </div>
          </div>

          {/* Shortage Warning Banner if any ingredient is short */}
          {shortageCount > 0 && (
            <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200 space-y-1">
                <p className="font-bold text-rose-300">
                  Stock Shortage Detected on {shortageCount} Ingredient{shortageCount > 1 ? 's' : ''}
                </p>
                <p>
                  Current warehouse stock is insufficient for a{' '}
                  <strong>
                    {formatQty3(calculation.targetInputQuantity)} {calculation.targetInputUnit}
                  </strong>{' '}
                  batch. Maximum possible batch with current stock is{' '}
                  <strong className="text-white font-mono">
                    {formatQty3(calculation.maxBatchInSelectedUnit)} {calculation.targetInputUnit}
                  </strong>{' '}
                  (limited by <strong className="text-white">{calculation.limitingIngredientName}</strong>).
                  You can still print the batch sheet or purchase the missing quantities highlighted below.
                </p>
              </div>
            </div>
          )}

          {/* Ingredient Requirements Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Beaker className="w-4 h-4 text-indigo-400" />
                  Required Formulation Ingredients — {calculation.product.name} (v{calculation.formulation.version || 1})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Formula Quantity = (Quantity per 1 {calculation.formulation.base_unit}) × {formatQty3(calculation.targetInBaseUnit)} {calculation.formulation.base_unit}. Quantities under 1 kg also show exact grams (g).
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {calculation.ingredients.length} Chemical Ingredient{calculation.ingredients.length !== 1 ? 's' : ''}
                {calculation.packagingIngredients.length > 0 &&
                  ` + ${calculation.packagingIngredients.length} Packaging Item(s)`}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Ingredient Name</th>
                    <th className="py-3 px-4 text-right">
                      Per 1 {calculation.formulation.base_unit}
                    </th>
                    <th className="py-3 px-4 text-right">Required Quantity</th>
                    <th className="py-3 px-4 text-center">Unit</th>
                    <th className="py-3 px-4 text-right">Available Stock</th>
                    <th className="py-3 px-4 text-center">Stock Status / Shortage</th>
                    <th className="py-3 px-4 text-right">Master Rate (Landed)</th>
                    <th className="py-3 px-4 text-right">Est. Line Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {calculation.ingredients.map((row, idx) => (
                    <tr
                      key={row.raw_material_id + idx}
                      className={
                        row.is_short
                          ? 'bg-rose-950/20 hover:bg-rose-950/30 transition-colors'
                          : 'hover:bg-slate-800/40 transition-colors'
                      }
                    >
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-white">
                        {row.raw_material_name}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">
                        {Number(row.ratio_per_base_unit.toFixed(4))} {row.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        <span>
                          {formatQty3(row.required_quantity)} {row.unit}
                        </span>
                        {row.required_grams !== null && (
                          <span className="ml-2 inline-block px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
                            = {Number(row.required_grams.toFixed(2))} g
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono uppercase">
                          {row.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatQty3(row.available_stock)} {row.unit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.is_short ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Short by {formatQty3(row.shortage_quantity)} {row.unit}
                            {row.unit === 'kg' && row.shortage_quantity < 1 && (
                              <span>({Number((row.shortage_quantity * 1000).toFixed(1))} g)</span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">
                        PKR {row.active_master_rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{row.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                        PKR {row.estimated_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {/* Packaging Materials (pcs) appear ONLY if they are part of this formulation */}
                  {calculation.packagingIngredients.length > 0 && (
                    <>
                      <tr className="bg-slate-950/90">
                        <td colSpan={9} className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-amber-400">
                          <div className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5" />
                            Packaging Materials Included in Formulation (pcs)
                          </div>
                        </td>
                      </tr>
                      {calculation.packagingIngredients.map((row, idx) => (
                        <tr
                          key={row.raw_material_id + '_pkg_' + idx}
                          className={
                            row.is_short
                              ? 'bg-rose-950/20 hover:bg-rose-950/30 transition-colors'
                              : 'hover:bg-slate-800/40 transition-colors'
                          }
                        >
                          <td className="py-3 px-4 text-xs font-mono text-slate-500">
                            P{idx + 1}
                          </td>
                          <td className="py-3 px-4 font-medium text-amber-200">
                            {row.raw_material_name}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">
                            {Number(row.ratio_per_base_unit.toFixed(4))} {row.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            {formatQty3(row.required_quantity)} {row.unit}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-xs font-mono uppercase">
                              {row.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">
                            {formatQty3(row.available_stock)} {row.unit}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {row.is_short ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Short by {formatQty3(row.shortage_quantity)} {row.unit}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">
                            PKR {row.active_master_rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{row.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                            PKR {row.estimated_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-950/90 border-t-2 border-slate-800 font-bold text-sm">
                    <td colSpan={3} className="py-3.5 px-4 text-slate-300">
                      Total Chemical Ingredient Weight vs. Target Output ({formatQty3(calculation.targetInputQuantity)} {calculation.targetInputUnit})
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                      {formatQty3(calculation.totalIngredientWeightKg)} kg
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs font-mono text-slate-400">
                      TOTAL
                    </td>
                    <td colSpan={2} className="py-3.5 px-4 text-center text-xs text-slate-400">
                      Max Batch Possible:{' '}
                      <strong className="text-white font-mono">
                        {formatQty3(calculation.maxBatchInSelectedUnit)} {calculation.targetInputUnit}
                      </strong>
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-amber-300 uppercase">
                      Est. Batch Cost:
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-base text-emerald-400">
                      PKR {calculation.estimatedTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Printable Batch Sheet Modal */}
      {showPrintModal && calculation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Toolbar (Hidden in print) */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Printable Production Batch Sheet — {calculation.product.name} (v{calculation.formulation.version || 1})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Clean one-page A4 floor sheet • Preview Batch #: {calculation.suggestedBatchNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print Sheet (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Sheet Content */}
            <div className="p-6 overflow-y-auto bg-slate-200/10 flex-1">
              <div
                id="printable-batch-sheet"
                className="bg-white text-slate-900 p-8 rounded-lg shadow mx-auto max-w-[210mm]"
              >
                {/* Header with Logo and Batch Metadata */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-5">
                  <div className="flex items-center gap-4">
                    <img
                      src="/assets/logo.png"
                      alt="Perfect Shine Chemicals"
                      className="w-16 h-16 object-contain"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div>
                      <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
                        Perfect Shine Chemicals
                      </h1>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Manufacturing Floor Batch Sheet & Weighing Checklist
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Formulation Basis: Standard per 1.0 {calculation.formulation.base_unit} finished output
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs space-y-1">
                    <div className="inline-block px-2.5 py-1 border border-slate-900 rounded font-mono font-bold text-sm text-slate-900">
                      {calculation.suggestedBatchNumber} (Preview)
                    </div>
                    <p className="text-slate-600">
                      <strong>Date:</strong> {formatDatePK(batchDate)}
                    </p>
                    <p className="text-slate-600">
                      <strong>Formulation Version:</strong> v{calculation.formulation.version || 1} (Locked)
                    </p>
                  </div>
                </div>

                {/* Batch Summary Box */}
                <div className="grid grid-cols-4 gap-3 mb-5 p-3.5 border border-slate-300 rounded-lg bg-slate-50 text-xs">
                  <div>
                    <span className="text-slate-500 block uppercase font-semibold text-[10px]">
                      Product Name
                    </span>
                    <strong className="text-sm text-slate-900 block mt-0.5">
                      {calculation.product.name}
                    </strong>
                    {calculation.product.sku && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        SKU: {calculation.product.sku}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-semibold text-[10px]">
                      Target Output Quantity
                    </span>
                    <strong className="text-sm font-mono text-slate-900 block mt-0.5">
                      {formatQty3(calculation.targetInputQuantity)} {calculation.targetInputUnit}
                    </strong>
                    {calculation.targetInputUnit !== calculation.formulation.base_unit && (
                      <span className="text-[11px] font-mono text-slate-600">
                        ({formatQty3(calculation.targetInBaseUnit)} {calculation.formulation.base_unit} @ {calculation.densityUsed.toFixed(2)} kg/L)
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-semibold text-[10px]">
                      Total Ingredient Weight
                    </span>
                    <strong className="text-sm font-mono text-slate-900 block mt-0.5">
                      {formatQty3(calculation.totalIngredientWeightKg)} kg
                    </strong>
                    <span className="text-[11px] text-slate-600">
                      Diff vs Target: {calculation.weightDifferenceKg > 0 ? '+' : ''}
                      {formatQty3(calculation.weightDifferenceKg)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-semibold text-[10px]">
                      Formulation Lock Status
                    </span>
                    <strong className="text-sm text-slate-900 block mt-0.5">
                      Version v{calculation.formulation.version || 1} — LOCKED
                    </strong>
                    <span className="text-[11px] text-slate-600">
                      Locked: {formatDatePK(calculation.formulation.locked_at || calculation.formulation.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Ingredients Checklist Table */}
                <table className="w-full border-collapse border border-slate-400 text-xs mb-6">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 uppercase text-[10px] tracking-wider">
                      <th className="border border-slate-400 py-2 px-2.5 text-center w-10">#</th>
                      <th className="border border-slate-400 py-2 px-3 text-left">
                        Raw Material / Ingredient
                      </th>
                      <th className="border border-slate-400 py-2 px-3 text-right w-28">
                        Per 1 {calculation.formulation.base_unit}
                      </th>
                      <th className="border border-slate-400 py-2 px-3 text-right w-44">
                        Required Quantity
                      </th>
                      <th className="border border-slate-400 py-2 px-2.5 text-center w-16">
                        Unit
                      </th>
                      <th className="border border-slate-400 py-2 px-2.5 text-center w-20">
                        Weighed (✓)
                      </th>
                      <th className="border border-slate-400 py-2 px-3 text-left w-36">
                        Floor Remarks / Lot #
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculation.allRows.map((row, idx) => (
                      <tr key={row.raw_material_id + '_print_' + idx}>
                        <td className="border border-slate-400 py-2 px-2.5 text-center font-mono">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-400 py-2 px-3 font-semibold text-slate-900">
                          {row.raw_material_name}
                          {row.unit === 'pcs' && (
                            <span className="ml-1.5 text-[10px] font-normal text-slate-600">
                              (Packaging)
                            </span>
                          )}
                        </td>
                        <td className="border border-slate-400 py-2 px-3 text-right font-mono text-slate-700">
                          {Number(row.ratio_per_base_unit.toFixed(4))}
                        </td>
                        <td className="border border-slate-400 py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatQty3(row.required_quantity)} {row.unit}
                          {row.required_grams !== null && (
                            <span className="block text-[11px] font-semibold text-slate-700">
                              ({Number(row.required_grams.toFixed(2))} g)
                            </span>
                          )}
                        </td>
                        <td className="border border-slate-400 py-2 px-2.5 text-center font-mono uppercase">
                          {row.unit}
                        </td>
                        <td className="border border-slate-400 py-2 px-2.5 text-center">
                          <span className="inline-block w-4 h-4 border-2 border-slate-800 rounded-sm" />
                        </td>
                        <td className="border border-slate-400 py-2 px-3"></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={3} className="border border-slate-400 py-2 px-3 text-right">
                        Total Chemical Ingredient Weight:
                      </td>
                      <td className="border border-slate-400 py-2 px-3 text-right font-mono">
                        {formatQty3(calculation.totalIngredientWeightKg)} kg
                      </td>
                      <td className="border border-slate-400 py-2 px-2.5 text-center font-mono">
                        KG
                      </td>
                      <td colSpan={2} className="border border-slate-400 py-2 px-3 text-[11px] text-slate-600">
                        Target Output: {formatQty3(calculation.targetInputQuantity)} {calculation.targetInputUnit}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Mixing Instructions if present */}
                {calculation.formulation.instructions && (
                  <div className="mb-6 p-3 border border-slate-300 rounded bg-slate-50 text-xs">
                    <p className="font-bold uppercase text-[10px] text-slate-600 mb-1">
                      Standard Mixing & Process Instructions:
                    </p>
                    <p className="text-slate-800 whitespace-pre-wrap">
                      {calculation.formulation.instructions}
                    </p>
                  </div>
                )}

                {/* Floor Completion & Sign-off Lines */}
                <div className="mt-8 pt-4 border-t border-slate-400 grid grid-cols-2 gap-8 text-xs">
                  <div className="space-y-5">
                    <div>
                      <span className="font-bold text-slate-800 block mb-2">
                        Actual Output Quantity Produced ({calculation.formulation.base_unit}):
                      </span>
                      <div className="border-b-2 border-slate-800 h-6 w-64" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-2">
                        Quality Check / pH / Viscosity Notes:
                      </span>
                      <div className="border-b border-slate-400 h-6 w-full" />
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <span className="font-bold text-slate-800 block mb-2">
                        Plant Supervisor Name & Signature:
                      </span>
                      <div className="border-b-2 border-slate-800 h-6 w-64" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-2">
                        Date & Completion Time:
                      </span>
                      <div className="border-b border-slate-400 h-6 w-64" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-200 pt-2">
                  <span>
                    Confidential — Perfect Shine Chemicals Formulation v{calculation.formulation.version || 1}
                  </span>
                  <span>
                    Note: This sheet is a calculation preview only. Record the completed batch in the ERP to update inventory.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
