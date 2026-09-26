import React, { useState } from 'react';
import { 
  Truck, 
  Calendar, 
  Layers, 
  Trash2, 
  AlertTriangle, 
  Building2, 
  FlaskConical, 
  Scale, 
  CheckCircle2, 
  DollarSign, 
  Printer,
  X
} from 'lucide-react';
import { PurchaseTrip } from '../../types';
import { formatPKR, formatDate, formatDateTime, formatQuantity } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface PurchaseTripDetailModalProps {
  trip: PurchaseTrip | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseTripDetailModal: React.FC<PurchaseTripDetailModalProps> = ({
  trip,
  isOpen,
  onClose,
}) => {
  const { deletePurchaseTripRecord } = useApp();
  const { currentUser, isOwner } = useAuth();

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [negativeStockWarning, setNegativeStockWarning] = useState<string[] | null>(null);

  if (!trip) return null;

  const handleDelete = async (force: boolean = false) => {
    setIsDeleting(true);
    try {
      const res = await deletePurchaseTripRecord(trip.id, currentUser, force);
      if (res.hasNegativeStockWarning && !force) {
        setNegativeStockWarning(res.warningDetails || ['Materials already consumed in production']);
        return;
      }
      alert(res.message);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete purchase trip');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Purchase Trip: ${trip.trip_number}`}
      subtitle={`Procured on ${formatDate(trip.date)} • Multi-vendor shared transportation breakdown`}
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Header Overview Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/30 border border-emerald-500/20 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Trip Date</span>
            <span className="text-sm font-bold text-white font-mono">{formatDate(trip.date)}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Total Transport Cost</span>
            <span className="text-base font-bold text-amber-400 font-mono">{formatPKR(trip.total_transport_cost)}</span>
            <span className="text-[10px] text-slate-500 block uppercase">via {trip.transport_payment_method}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Allocated Weight</span>
            <span className="text-base font-bold text-cyan-400 font-mono">
              {Number(trip.total_weight_kg_liter || 0).toFixed(2)} kg/L
            </span>
            <span className="text-[10px] text-slate-500 block">
              {trip.include_pcs_in_weight_allocation ? 'Pcs included' : 'Pcs excluded from weight'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Total Landed Investment</span>
            <span className="text-base font-black text-emerald-400 font-mono">{formatPKR(trip.grand_total)}</span>
            <span className="text-[10px] text-slate-500 block font-mono">
              Mat: {formatPKR(trip.total_material_cost)}
            </span>
          </div>
        </div>

        {/* Transporter & Notes info */}
        {(trip.vehicle_or_driver || trip.transport_notes) && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex flex-wrap items-center gap-4">
            {trip.vehicle_or_driver && (
              <div>
                <span className="text-slate-400">Vehicle / Driver: </span>
                <span className="text-white font-medium">{trip.vehicle_or_driver}</span>
              </div>
            )}
            {trip.transport_notes && (
              <div>
                <span className="text-slate-400">Notes / Route: </span>
                <span className="text-slate-300">{trip.transport_notes}</span>
              </div>
            )}
          </div>
        )}

        {/* Detailed Line Items & Allocation Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Materials Purchased & Cost Distribution ({trip.items.length} items)</span>
          </h4>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-semibold">
                  <th className="py-2.5 px-3">Vendor / Supplier</th>
                  <th className="py-2.5 px-3">Chemical / Material</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Base Purchase Rate</th>
                  <th className="py-2.5 px-3 text-right">Material Subtotal</th>
                  <th className="py-2.5 px-3 text-right">Weight Share</th>
                  <th className="py-2.5 px-3 text-right">Allocated Freight</th>
                  <th className="py-2.5 px-3 text-right">Final Landed Rate</th>
                  <th className="py-2.5 px-3 text-right">Total Landed Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trip.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 font-mono">
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-semibold text-slate-200">{item.supplier_name}</div>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{item.raw_material_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({item.unit})</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200 font-bold">
                      {formatQuantity(item.quantity, item.unit)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {formatPKR(item.unit_cost)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300 font-semibold">
                      {formatPKR(item.subtotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {item.is_weight_allocated ? (
                        <span className="text-cyan-400 font-semibold">{item.allocation_percentage}%</span>
                      ) : (
                        <span className="text-slate-500 text-[10px] font-sans">Excluded (pcs)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-bold">
                      +{formatPKR(item.allocated_freight)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-black">
                      {formatPKR(item.landed_cost)}/{item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white font-bold">
                      {formatPKR(item.total_landed_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Warning / Confirm Dialog */}
        {showDeleteConfirm && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3">
            <div className="flex items-start gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs uppercase">Confirm Purchase Trip Deletion & Reversal</h5>
                <p className="text-xs text-rose-300/90 mt-0.5">
                  Deleting this trip will subtract the received raw materials from factory inventory, reverse vendor payable balances, and void the transport expense.
                </p>
              </div>
            </div>

            {negativeStockWarning && (
              <div className="p-3 bg-rose-950/50 rounded-xl border border-rose-800/60 text-xs text-rose-300 space-y-1 font-mono">
                <span className="font-bold block text-rose-400">⚠️ Negative Stock Warning:</span>
                {negativeStockWarning.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setNegativeStockWarning(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              {negativeStockWarning ? (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDelete(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                >
                  Force Delete & Allow Negative Stock
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDelete(false)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                >
                  Confirm Delete & Reverse Stock
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div>
            {isOwner && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Trip & Reverse Stock</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
