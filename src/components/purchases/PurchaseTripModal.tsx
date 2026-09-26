import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  Scale, 
  CheckCircle2, 
  Info,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PaymentMethod, RawMaterialUnit, Supplier, RawMaterial } from '../../types';
import { formatPKR, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { allocateTripFreight, isWeightOrLiquidUnit } from '../../utils/freightAllocation';

interface PurchaseTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripCreated?: () => void;
}

interface TripLineFormItem {
  id: string;
  supplier_id: string;
  raw_material_id: string;
  raw_material_name: string;
  unit: RawMaterialUnit;
  quantity: number;
  unit_cost: number;
}

export const PurchaseTripModal: React.FC<PurchaseTripModalProps> = ({
  isOpen,
  onClose,
  onTripCreated,
}) => {
  const { suppliers, rawMaterials, createPurchaseTrip } = useApp();
  const { currentUser } = useAuth();

  const activeSuppliers = useMemo(() => suppliers.filter(s => !s.is_archived && s.is_active), [suppliers]);
  const activeRawMaterials = useMemo(() => rawMaterials.filter(rm => !rm.is_archived && rm.is_active), [rawMaterials]);

  // Form State
  const [tripDate, setTripDate] = useState(getTodayDateString());
  const [vehicleOrDriver, setVehicleOrDriver] = useState('');
  const [transportNotes, setTransportNotes] = useState('');
  const [totalTransportCost, setTotalTransportCost] = useState<number>(0);
  const [transportPaymentMethod, setTransportPaymentMethod] = useState<PaymentMethod>('cash');
  const [includePcs, setIncludePcs] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initial Line Items (starts with 2 items to prompt multi-item trip)
  const [lineItems, setLineItems] = useState<TripLineFormItem[]>([
    { id: '1', supplier_id: '', raw_material_id: '', raw_material_name: '', unit: 'kg', quantity: 1, unit_cost: 0 },
    { id: '2', supplier_id: '', raw_material_id: '', raw_material_name: '', unit: 'kg', quantity: 1, unit_cost: 0 },
  ]);

  const handleAddRow = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        supplier_id: '',
        raw_material_id: '',
        raw_material_name: '',
        unit: 'kg',
        quantity: 1,
        unit_cost: 0,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index: number, field: keyof TripLineFormItem, value: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'raw_material_id') {
        const rm = activeRawMaterials.find(m => m.id === value);
        if (rm) {
          item.raw_material_name = rm.name;
          item.unit = rm.unit;
          item.unit_cost = rm.cost_per_unit || 0;
        }
      }

      updated[index] = item;
      return updated;
    });
  };

  // Real-time Freight Allocation Calculation
  const allocationCalculation = useMemo(() => {
    const formattedForAllocation = lineItems.map(it => {
      const supp = activeSuppliers.find(s => s.id === it.supplier_id);
      return {
        id: it.id,
        supplier_id: it.supplier_id,
        supplier_name: supp ? supp.name : 'Unknown Vendor',
        raw_material_id: it.raw_material_id,
        raw_material_name: it.raw_material_name || 'Select Material',
        unit: it.unit,
        quantity: Number(it.quantity) || 0,
        unit_cost: Number(it.unit_cost) || 0,
        subtotal: Number(((Number(it.quantity) || 0) * (Number(it.unit_cost) || 0)).toFixed(2)),
      };
    });

    return allocateTripFreight(formattedForAllocation, totalTransportCost, includePcs);
  }, [lineItems, totalTransportCost, includePcs, activeSuppliers]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!tripDate) errors.push('Please choose a trip date.');

    const validItems = lineItems.filter(it => it.raw_material_id && it.quantity > 0 && it.supplier_id);
    if (validItems.length === 0) {
      errors.push('Add at least one raw material line item with vendor, quantity, and cost.');
    }

    const unassignedVendors = lineItems.some(it => it.raw_material_id && !it.supplier_id);
    if (unassignedVendors) {
      errors.push('Please select a supplier/vendor for each line item.');
    }

    return errors;
  }, [tripDate, lineItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationErrors.length > 0) {
      setSubmitError(validationErrors[0]);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const itemsToSave = allocationCalculation.allocatedItems.map(it => {
        const supp = activeSuppliers.find(s => s.id === it.supplier_id);
        return {
          id: it.id || Math.random().toString(36).substring(2, 9),
          supplier_id: it.supplier_id || '',
          supplier_name: supp ? supp.name : (it.supplier_name || 'Vendor'),
          raw_material_id: it.raw_material_id || '',
          raw_material_name: it.raw_material_name || '',
          unit: (it.unit as RawMaterialUnit) || 'kg',
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          subtotal: it.subtotal,
          is_weight_allocated: it.is_weight_allocated,
          allocation_percentage: it.allocation_percentage,
          allocated_freight: it.allocated_freight,
          landed_cost: it.landed_cost,
          total_landed_cost: it.total_landed_cost,
        };
      });

      await createPurchaseTrip({
        date: formatSelectedDateToIso(tripDate),
        total_transport_cost: Number(totalTransportCost) || 0,
        transport_payment_method: transportPaymentMethod,
        transport_notes: transportNotes,
        vehicle_or_driver: vehicleOrDriver,
        include_pcs_in_weight_allocation: includePcs,
        total_material_cost: allocationCalculation.totalMaterialCost,
        total_weight_kg_liter: allocationCalculation.totalAllocatableWeight,
        grand_total: allocationCalculation.grandTotal,
        items: itemsToSave,
        created_by: currentUser?.name || 'Factory Staff',
      });

      // Reset and close
      onClose();
      if (onTripCreated) onTripCreated();
    } catch (err: any) {
      console.error('Error creating purchase trip:', err);
      setSubmitError(err?.message || 'Failed to save purchase trip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start New Purchase Trip (Shared Transport)"
      subtitle="Group purchases from multiple vendors in one hired trip. Transport costs are automatically distributed by weight."
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Trip Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950/40 rounded-2xl border border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Trip Date *</span>
            </label>
            <input
              type="date"
              required
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vehicle / Transporter Details</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Suzuki Pickup - Driver Aslam"
              value={vehicleOrDriver}
              onChange={(e) => setVehicleOrDriver(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Trip Notes / Route</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Shah Alam Market run + Korangi"
              value={transportNotes}
              onChange={(e) => setTransportNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500"
            />
          </div>
        </div>

        {/* Step 2: Line Items (Multiple vendors & materials) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Trip Raw Material Purchases</span>
                <span className="text-[11px] text-slate-400 font-normal">({lineItems.length} items)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Add every material bought during this trip, selecting its vendor and unit purchase price.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Purchase Item</span>
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {lineItems.map((item, idx) => (
              <div 
                key={item.id} 
                className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl hover:border-slate-700 transition-all space-y-2"
              >
                <div className="grid grid-cols-12 gap-2 items-center">
                  {/* Vendor / Supplier */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Vendor / Supplier *
                    </label>
                    <select
                      required
                      value={item.supplier_id}
                      onChange={(e) => handleRowChange(idx, 'supplier_id', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select Vendor...</option>
                      {activeSuppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.raw_material_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Raw Material Chemical */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Raw Material / Chemical *
                    </label>
                    <select
                      required
                      value={item.raw_material_id}
                      onChange={(e) => handleRowChange(idx, 'raw_material_id', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select Material...</option>
                      {activeRawMaterials.map(rm => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} ({rm.unit}) • {rm.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-6 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Quantity ({item.unit})
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        required
                        value={item.quantity || ''}
                        onChange={(e) => handleRowChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Base Unit Cost */}
                  <div className="col-span-5 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Rate / {item.unit} (PKR)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={item.unit_cost || ''}
                        onChange={(e) => handleRowChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtotal line */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-400">
                    {item.raw_material_name ? item.raw_material_name : 'No material chosen'}
                    {isWeightOrLiquidUnit(item.unit) ? (
                      <span className="ml-1 text-emerald-400 font-medium">✓ Weight allocatable ({item.unit})</span>
                    ) : (
                      <span className="ml-1 text-amber-400/90 font-medium">⚠️ {item.unit} item (excluded by default)</span>
                    )}
                  </span>
                  <span className="font-mono text-slate-300">
                    Subtotal: <strong>{formatPKR((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0))}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 3: Transportation Cost & Allocation Settings */}
        <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 rounded-2xl border border-emerald-500/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Hired Trip Transportation Cost</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                One lump-sum hired vehicle fee to allocate across all materials transported.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includePcs}
                  onChange={(e) => setIncludePcs(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400"
                />
                <span className="font-medium">Include "pcs" items in transport allocation</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Total Transportation Cost (PKR) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 5000"
                  value={totalTransportCost || ''}
                  onChange={(e) => setTotalTransportCost(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-12 py-2.5 text-base font-bold text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 uppercase">
                  PKR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Total freight paid to transporter for picking up goods from all vendors.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Transport Payment Method
              </label>
              <select
                value={transportPaymentMethod}
                onChange={(e) => setTransportPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="cash">Cash Voucher (Driver paid in cash)</option>
                <option value="bank">Bank Transfer (HBL Factory Account)</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Auto-records an expense under "Transport" to balance factory cash books.
              </p>
            </div>
          </div>

          {/* Allocation Preview Table */}
          {allocationCalculation.allocatedItems.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Calculated Cost Allocation Breakdown</span>
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-normal">
                  Total Allocatable: {allocationCalculation.totalAllocatableWeight.toFixed(2)} kg/L
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-semibold">
                      <th className="py-2 px-3">Vendor & Chemical</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                      <th className="py-2 px-3 text-right">Base Price</th>
                      <th className="py-2 px-3 text-right">Weight Share %</th>
                      <th className="py-2 px-3 text-right">Allocated Freight</th>
                      <th className="py-2 px-3 text-right">Final Landed Rate</th>
                      <th className="py-2 px-3 text-right">Total Landed Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {allocationCalculation.allocatedItems.map((alloc, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-sans">
                          <div className="font-semibold text-white">{alloc.raw_material_name}</div>
                          <div className="text-[10px] text-slate-400">{alloc.supplier_name}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200">
                          {alloc.quantity} {alloc.unit}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300">
                          {formatPKR(alloc.unit_cost)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {alloc.is_weight_allocated ? (
                            <span className="text-cyan-400 font-semibold">{alloc.allocation_percentage}%</span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Excluded (pcs)</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-400 font-semibold">
                          +{formatPKR(alloc.allocated_freight)}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                          {formatPKR(alloc.landed_cost)}/{alloc.unit}
                        </td>
                        <td className="py-2 px-3 text-right text-white font-bold">
                          {formatPKR(alloc.total_landed_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {allocationCalculation.hasPcsExcluded && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-800/40 p-2 rounded-xl">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Packaging materials ("pcs" units) are excluded from weight allocation. Transport cost is distributed purely among chemical kg/liter items. Check "Include 'pcs' items" above if you wish to allocate across packaging as well.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 4: Grand Totals Summary */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="text-slate-400 flex items-center gap-4">
              <span>Materials Subtotal: <strong className="text-white font-mono">{formatPKR(allocationCalculation.totalMaterialCost)}</strong></span>
              <span>•</span>
              <span>Transport Cost: <strong className="text-amber-400 font-mono">{formatPKR(totalTransportCost)}</strong></span>
            </div>
            <p className="text-[11px] text-slate-500">
              Each material's weighted average landed rate will be automatically updated across all formulations & production batches.
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Landed Investment</span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {formatPKR(allocationCalculation.grandTotal)}
            </span>
          </div>
        </div>

        {submitError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || validationErrors.length > 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <span>Saving Trip & Calculating Landed Costs...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Save Purchase Trip & Allocate Freight</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
