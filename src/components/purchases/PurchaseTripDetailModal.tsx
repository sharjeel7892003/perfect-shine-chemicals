import React, { useState } from 'react';
import { 
  Truck, 
  Calendar, 
  Layers, 
  Trash2, 
  AlertTriangle, 
  FlaskConical, 
  CheckCircle2, 
  DollarSign, 
  CreditCard,
  Wallet,
  Check,
  X
} from 'lucide-react';
import { PurchaseTrip, PaymentMethod } from '../../types';
import { formatPKR, formatDate, formatDateTime, formatQuantity, getTodayDateString } from '../../utils/formatters';
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
  const { deletePurchaseTripRecord, markPurchasesAsPaid, markTripTransportAsPaid, purchases } = useApp();
  const { currentUser, isOwner } = useAuth();

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [negativeStockWarning, setNegativeStockWarning] = useState<string[] | null>(null);

  // Settlement Modal State
  const [isPayTransportModalOpen, setIsPayTransportModalOpen] = useState(false);
  const [transportPayMethod, setTransportPayMethod] = useState<PaymentMethod>('cash');
  const [transportPayDate, setTransportPayDate] = useState<string>(getTodayDateString());
  const [transportPayAmount, setTransportPayAmount] = useState<number>(0);

  const [isSettleItemModalOpen, setIsSettleItemModalOpen] = useState(false);
  const [settlePurchaseId, setSettlePurchaseId] = useState<string>('');
  const [settleItemName, setSettleItemName] = useState<string>('');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('cash');
  const [settleDate, setSettleDate] = useState<string>(getTodayDateString());

  if (!trip) return null;

  // Calculate payment totals for this trip
  const transportPaid = trip.transport_amount_paid !== undefined 
    ? Number(trip.transport_amount_paid) 
    : (trip.transport_payment_status === 'unpaid' ? 0 : Number(trip.total_transport_cost));
  const transportStatus = trip.transport_payment_status || (transportPaid >= trip.total_transport_cost ? 'paid' : transportPaid > 0 ? 'partial' : 'unpaid');
  const transportDue = Math.max(0, Number(trip.total_transport_cost) - transportPaid);

  const itemsTotalPaid = trip.items.reduce((sum, it) => {
    // If linked purchase exists, read its status from purchases state
    const linkedPO = purchases.find(p => p.id === it.purchase_id || (p.trip_id === trip.id && p.supplier_id === it.supplier_id));
    if (linkedPO) {
      return sum + Number(linkedPO.amount_paid || 0);
    }
    const status = it.payment_status || 'paid';
    if (status === 'unpaid') return sum;
    if (status === 'partial') return sum + Number(it.amount_paid || 0);
    return sum + (it.amount_paid !== undefined && Number(it.amount_paid) > 0 ? Number(it.amount_paid) : Number(it.subtotal));
  }, 0);

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

  const handleOpenPayTransport = () => {
    setTransportPayAmount(transportDue > 0 ? transportDue : Number(trip.total_transport_cost));
    setTransportPayMethod('cash');
    setTransportPayDate(getTodayDateString());
    setIsPayTransportModalOpen(true);
  };

  const handleConfirmPayTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await markTripTransportAsPaid(trip.id, transportPayMethod, transportPayDate, transportPayAmount);
      alert(res.message);
      setIsPayTransportModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to record transport payment');
    }
  };

  const handleOpenSettleItem = (purchaseId: string, itemName: string, due: number) => {
    setSettlePurchaseId(purchaseId);
    setSettleItemName(itemName);
    setSettleAmount(due);
    setSettleMethod('cash');
    setSettleDate(getTodayDateString());
    setIsSettleItemModalOpen(true);
  };

  const handleConfirmSettleItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlePurchaseId) return;
    try {
      const res = await markPurchasesAsPaid([settlePurchaseId], settleMethod, settleDate);
      alert(res.message);
      setIsSettleItemModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to settle purchase payment');
    }
  };

  const handleMarkAllTripItemsAsPaid = async () => {
    const linkedPOs = purchases.filter(p => p.trip_id === trip.id || p.trip_number === trip.trip_number);
    const unpaidPOs = linkedPOs.filter(p => p.payment_status !== 'paid');
    if (unpaidPOs.length === 0) {
      alert('All purchase orders in this trip are already fully paid.');
      return;
    }
    if (!confirm(`Mark all ${unpaidPOs.length} unpaid supplier purchase orders from this trip as Paid in Cash?`)) {
      return;
    }
    try {
      const res = await markPurchasesAsPaid(unpaidPOs.map(p => p.id), 'cash', trip.date);
      alert(res.message);
    } catch (err: any) {
      alert(err?.message || 'Failed to mark purchases as paid');
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Purchase Trip: ${trip.trip_number}`}
        subtitle={`Procured on ${formatDate(trip.date)} • Multi-vendor shared transportation breakdown & payment status`}
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
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Transport Cost</span>
              <span className="text-base font-bold text-amber-400 font-mono">{formatPKR(trip.total_transport_cost)}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={transportStatus === 'paid' ? 'emerald' : transportStatus === 'partial' ? 'amber' : 'rose'}>
                  {transportStatus} ({trip.transport_payment_method})
                </Badge>
                {transportDue > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenPayTransport}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline"
                  >
                    Pay
                  </button>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Material Cost</span>
              <span className="text-base font-bold text-cyan-400 font-mono">
                {formatPKR(trip.total_material_cost)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                Paid: {formatPKR(itemsTotalPaid)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Total Landed Investment</span>
              <span className="text-base font-black text-emerald-400 font-mono">{formatPKR(trip.grand_total)}</span>
              <span className="text-[10px] text-slate-400 block">
                {Number(trip.total_weight_kg_liter || 0).toFixed(2)} kg/L allocated
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
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Materials Purchased & Cost Distribution ({trip.items.length} items)</span>
              </h4>

              <button
                type="button"
                onClick={handleMarkAllTripItemsAsPaid}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark All Items as Paid</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-semibold">
                    <th className="py-2.5 px-3">Vendor / Supplier</th>
                    <th className="py-2.5 px-3">Chemical / Material</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Base Rate</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Allocated Freight</th>
                    <th className="py-2.5 px-3 text-right">Landed Rate</th>
                    <th className="py-2.5 px-3 text-center">Payment Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {trip.items.map((item, idx) => {
                    // Check linked PO status
                    const linkedPO = purchases.find(p => p.id === item.purchase_id || (p.trip_id === trip.id && p.supplier_id === item.supplier_id));
                    const status = linkedPO ? linkedPO.payment_status : (item.payment_status || 'paid');
                    const paidAmount = linkedPO ? linkedPO.amount_paid : (item.amount_paid !== undefined ? item.amount_paid : item.subtotal);
                    const due = Math.max(0, Number(item.subtotal) - Number(paidAmount || 0));

                    return (
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
                        <td className="py-2.5 px-3 text-right text-amber-400 font-bold">
                          +{formatPKR(item.allocated_freight)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-black">
                          {formatPKR(item.landed_cost)}/{item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <Badge variant={status === 'paid' ? 'emerald' : status === 'partial' ? 'amber' : 'rose'}>
                            {status}
                          </Badge>
                          {due > 0 && (
                            <span className="block text-[10px] text-amber-400/90 font-mono mt-0.5">
                              Due: {formatPKR(due)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          {due > 0 && linkedPO && (
                            <button
                              type="button"
                              onClick={() => handleOpenSettleItem(linkedPO.id, item.raw_material_name, due)}
                              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold transition-colors"
                            >
                              Mark Paid
                            </button>
                          )}
                          {status === 'paid' && (
                            <span className="text-emerald-400 text-[10px] font-medium">✓ Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
                    Deleting this trip will subtract the received raw materials from factory inventory, reverse vendor payable balances, and void all associated payment vouchers.
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

      {/* Settle Transport Payment Modal */}
      {isPayTransportModalOpen && (
        <Modal
          isOpen={isPayTransportModalOpen}
          onClose={() => setIsPayTransportModalOpen(false)}
          title={`Pay Transport Fee: ${trip.trip_number}`}
          subtitle="Record outflow payment voucher directly to transporter in Cash Book"
          maxWidth="md"
        >
          <form onSubmit={handleConfirmPayTransport} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Payment Amount (PKR)
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={transportPayAmount}
                onChange={(e) => setTransportPayAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Payment Method
              </label>
              <select
                value={transportPayMethod}
                onChange={(e) => setTransportPayMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="cash">Cash Counter</option>
                <option value="bank">Bank Transfer</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Payment Date
              </label>
              <input
                type="date"
                required
                value={transportPayDate}
                onChange={(e) => setTransportPayDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPayTransportModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
              >
                Confirm Payment & Record Outflow
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Settle Purchase Item Modal */}
      {isSettleItemModalOpen && (
        <Modal
          isOpen={isSettleItemModalOpen}
          onClose={() => setIsSettleItemModalOpen(false)}
          title={`Settle Vendor Bill: ${settleItemName}`}
          subtitle="Record payment disbursement voucher in Cash Book and clear vendor payable"
          maxWidth="md"
        >
          <form onSubmit={handleConfirmSettleItem} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Payment Amount (PKR)
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Payment Method
              </label>
              <select
                value={settleMethod}
                onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="cash">Cash Counter</option>
                <option value="bank">Bank Transfer</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Payment Date
              </label>
              <input
                type="date"
                required
                value={settleDate}
                onChange={(e) => setSettleDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSettleItemModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
              >
                Confirm Settlement
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
