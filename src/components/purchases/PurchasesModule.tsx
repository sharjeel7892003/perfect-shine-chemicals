import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert,
  Calendar, 
  AlertCircle, 
  FlaskConical, 
  Package,
  Eye,
  Loader2,
  Scale,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Purchase, PurchaseItem, PaymentMethod, PurchaseTrip } from '../../types';
import { formatPKR, formatDate, getTodayDateString, formatSelectedDateToIso, formatQuantity } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { PurchaseTripModal } from './PurchaseTripModal';
import { PurchaseTripDetailModal } from './PurchaseTripDetailModal';

export const PurchasesModule: React.FC = () => {
  const { suppliers, products, rawMaterials, purchases, purchaseTrips, createPurchase, deletePurchaseInvoice } = useApp();
  const { currentUser, isOwner, canManagePurchases } = useAuth();

  // Active view tab: 'pos' (individual purchase orders) or 'trips' (multi-vendor shared transport runs)
  const [activeTab, setActiveTab] = useState<'pos' | 'trips'>('pos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<Purchase | null>(null);
  const [selectedTripDetails, setSelectedTripDetails] = useState<PurchaseTrip | null>(null);
  const [deleteConfirmPurchase, setDeleteConfirmPurchase] = useState<Purchase | null>(null);
  const [negativeStockWarning, setNegativeStockWarning] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active entities only for new purchases
  const activeSuppliers = suppliers.filter(s => !s.is_archived && s.is_active);
  const activeRawMaterials = rawMaterials.filter(rm => !rm.is_archived && rm.is_active);
  const activeProducts = products.filter(p => !p.is_archived && p.is_active);

  // Single Purchase Form State
  const [purchaseDate, setPurchaseDate] = useState(getTodayDateString());
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'unpaid'>('paid');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [singleFreightCost, setSingleFreightCost] = useState<number>(0);
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState<PurchaseItem[]>([
    { item_type: 'raw_material', raw_material_id: '', product_or_material_name: '', quantity: 1, unit_cost: 0, subtotal: 0 }
  ]);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const totalMaterialAmount = items.reduce((acc, item) => acc + item.subtotal, 0);
  const totalLandedAmount = totalMaterialAmount + singleFreightCost;

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { item_type: 'raw_material', raw_material_id: '', product_or_material_name: '', quantity: 1, unit_cost: 0, subtotal: 0 }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      
      // If selected a raw material
      if (field === 'raw_material_id') {
        const rm = rawMaterials.find(m => m.id === value);
        if (rm) {
          item.item_type = 'raw_material';
          item.product_or_material_name = rm.name;
          item.unit = rm.unit;
          item.unit_cost = rm.cost_per_unit;
        }
      }

      // If selected a finished product
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value);
        if (prod) {
          item.item_type = 'finished_product';
          item.product_or_material_name = prod.name;
          item.unit = prod.base_unit || prod.unit;
          item.unit_cost = prod.cost_price;
        }
      }

      if (field === 'quantity' || field === 'unit_cost') {
        item.subtotal = Number(item.quantity || 0) * Number(item.unit_cost || 0);
      }

      updated[index] = item;
      return updated;
    });
  };

  const handlePaymentStatusChange = (status: 'paid' | 'partial' | 'unpaid') => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setAmountPaid(totalMaterialAmount);
    } else if (status === 'unpaid') {
      setAmountPaid(0);
    }
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      alert('Please select a supplier');
      return;
    }
    if (items.length === 0 || totalMaterialAmount <= 0) {
      alert('Please add valid purchase items with quantities and unit costs');
      return;
    }

    const finalPaid = paymentStatus === 'paid' ? totalMaterialAmount : amountPaid;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createPurchase({
        supplier_id: supplierId,
        supplier_name: selectedSupplier ? selectedSupplier.name : 'Unknown Supplier',
        date: formatSelectedDateToIso(purchaseDate),
        items,
        total_amount: totalMaterialAmount,
        amount_paid: finalPaid,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        freight_cost: singleFreightCost > 0 ? singleFreightCost : undefined,
        notes: singleFreightCost > 0 
          ? `${notes ? `${notes} • ` : ''}Includes single-purchase freight: PKR ${singleFreightCost}`
          : notes,
      });

      setIsModalOpen(false);
      // Reset form
      setSupplierId('');
      setPurchaseDate(getTodayDateString());
      setItems([{ item_type: 'raw_material', raw_material_id: '', product_or_material_name: '', quantity: 1, unit_cost: 0, subtotal: 0 }]);
      setAmountPaid(0);
      setSingleFreightCost(0);
      setNotes('');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to record purchase. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePurchase = async (force: boolean = false) => {
    if (!deleteConfirmPurchase) return;
    setIsDeleting(true);
    try {
      const res = await deletePurchaseInvoice(deleteConfirmPurchase.id, currentUser, force);

      if (res.hasNegativeStockWarning && !force) {
        setNegativeStockWarning(res.warningDetails || ['Low stock detected']);
        return;
      }

      alert(res.message);
      setDeleteConfirmPurchase(null);
      setNegativeStockWarning(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete purchase invoice');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPurchases = purchases.filter(p =>
    p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.trip_number && p.trip_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredTrips = purchaseTrips.filter(t =>
    t.trip_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.items.some(i => i.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    t.items.some(i => i.raw_material_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.vehicle_or_driver && t.vehicle_or_driver.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-400" />
            <span>Supplier Purchases & Procurement</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Procure raw materials, manage multi-vendor Purchase Trips with shared freight allocation, and track landed costs.
          </p>
        </div>

        {canManagePurchases && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsTripModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
            >
              <Truck className="w-4 h-4 stroke-[2.5]" />
              <span>Start Purchase Trip</span>
            </button>

            <button
              onClick={() => {
                setPurchaseDate(getTodayDateString());
                setSingleFreightCost(0);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Record Single Purchase</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pos'
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Purchase Orders & Invoices ({purchases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'trips'
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Purchase Trips & Freight Allocation ({purchaseTrips.length})</span>
          {purchaseTrips.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
              {purchaseTrips.length}
            </span>
          )}
        </button>
      </div>

      {/* VIEW A: Purchase Orders Table */}
      {activeTab === 'pos' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO #, supplier, trip #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <span className="text-xs text-slate-400">{filteredPurchases.length} POs Found</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">PO Number</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3 text-right">Items & Materials Received</th>
                  <th className="py-3 px-3 text-right">Material Cost</th>
                  <th className="py-3 px-3 text-right">Allocated Freight</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Payment Method</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No purchase records found
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => {
                    const totalAllocatedFreight = p.freight_cost || p.items.reduce((sum, it) => sum + (it.allocated_freight || 0), 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-white">{p.invoice_number}</div>
                          {p.trip_number && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/80 mt-0.5 font-sans font-medium">
                              <Truck className="w-2.5 h-2.5" />
                              <span>{p.trip_number}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono whitespace-nowrap">{formatDate(p.date)}</td>
                        <td className="py-3 px-3 font-medium text-slate-200">{p.supplier_name}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400 max-w-xs truncate">
                          {p.items.map(i => `${i.quantity}x ${i.product_or_material_name}`).join(', ')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                          {formatPKR(p.total_amount)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                          {totalAllocatedFreight > 0 ? (
                            <span className="text-amber-400 font-semibold">+{formatPKR(totalAllocatedFreight)}</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 whitespace-nowrap">
                          {formatPKR(p.amount_paid)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge
                            variant={p.payment_status === 'paid' ? 'emerald' : p.payment_status === 'partial' ? 'amber' : 'rose'}
                          >
                            {p.payment_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 capitalize text-slate-400">{p.payment_method}</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedPurchaseDetails(p)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                              title="View PO Line Items Breakdown"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              <span>View</span>
                            </button>
                            {isOwner ? (
                              <button
                                onClick={() => {
                                  setDeleteConfirmPurchase(p);
                                  setNegativeStockWarning(null);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                                title="Delete PO & Reverse Raw Material/Product Stocks"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            ) : (
                              <button
                                disabled
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/40 text-slate-600 border border-slate-800 text-xs cursor-not-allowed opacity-50"
                                title="Admin role required to delete and reverse PO"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW B: Purchase Trips Table */}
      {activeTab === 'trips' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Trip #, vendor, material, driver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{filteredTrips.length} Trips Recorded</span>
              {canManagePurchases && (
                <button
                  onClick={() => setIsTripModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start Trip</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Trip #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Vendors / Locations</th>
                  <th className="py-3 px-3">Materials Bought</th>
                  <th className="py-3 px-3 text-right">Allocated Weight</th>
                  <th className="py-3 px-3 text-right">Material Subtotal</th>
                  <th className="py-3 px-3 text-right">Transport Fee</th>
                  <th className="py-3 px-3 text-right">Total Landed Investment</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500 font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Truck className="w-8 h-8 text-slate-600" />
                        <p>No purchase trips recorded yet.</p>
                        <p className="text-xs text-slate-600">
                          Click "Start Purchase Trip" to record multiple purchases transported together.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip) => {
                    const uniqueVendors = Array.from(new Set(trip.items.map(i => i.supplier_name)));
                    return (
                      <tr key={trip.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                          {trip.trip_number}
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {formatDate(trip.date)}
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-200">
                          <div className="font-medium">{uniqueVendors.join(', ')}</div>
                          {trip.vehicle_or_driver && (
                            <div className="text-[10px] text-slate-500">{trip.vehicle_or_driver}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-300 max-w-xs truncate">
                          {trip.items.map(i => `${formatQuantity(i.quantity, i.unit)} ${i.raw_material_name}`).join(', ')}
                        </td>
                        <td className="py-3 px-3 text-right text-cyan-400 font-semibold whitespace-nowrap">
                          {Number(trip.total_weight_kg_liter || 0).toFixed(2)} kg/L
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300 whitespace-nowrap">
                          {formatPKR(trip.total_material_cost)}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-400 font-bold whitespace-nowrap">
                          {formatPKR(trip.total_transport_cost)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-400 font-black whitespace-nowrap">
                          {formatPKR(trip.grand_total)}
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <button
                            onClick={() => setSelectedTripDetails(trip)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all"
                            title="View Trip Breakdown and Landed Cost Per Material"
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>View Breakdown</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Purchase Order Modal (with Freight / Additional Cost field) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Single Supplier Purchase"
        subtitle="For single-vendor purchases with direct freight. Landed costs and stock balances update automatically."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Supplier / Vendor *
              </label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Choose Supplier...</option>
                {activeSuppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.raw_material_type}) • Balance: {formatPKR(s.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Purchase / PO Date *</span>
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Itemized list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Purchase Items (Raw Materials or Products)
              </label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item Row
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <select
                        value={item.raw_material_id ? `rm-${item.raw_material_id}` : (item.product_id ? `prod-${item.product_id}` : '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('rm-')) {
                            handleItemChange(idx, 'raw_material_id', val.replace('rm-', ''));
                          } else if (val.startsWith('prod-')) {
                            handleItemChange(idx, 'product_id', val.replace('prod-', ''));
                          } else {
                            handleItemChange(idx, 'product_or_material_name', '');
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        <option value="">Select Raw Material / Product</option>
                        <optgroup label="🧪 Chemical Raw Materials">
                          {activeRawMaterials.map(rm => (
                            <option key={rm.id} value={`rm-${rm.id}`}>
                              {rm.name} ({rm.unit})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="📦 Finished Products">
                          {activeProducts.map(p => (
                            <option key={p.id} value={`prod-${p.id}`}>
                              {p.name} ({p.base_unit || p.unit})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Item Description"
                        required
                        value={item.product_or_material_name}
                        onChange={(e) => handleItemChange(idx, 'product_or_material_name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="number"
                        min={item.unit === 'pcs' ? "1" : "0.001"}
                        step={item.unit === 'pcs' ? "1" : "any"}
                        placeholder="Qty"
                        required
                        value={item.quantity || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          handleItemChange(idx, 'quantity', item.unit === 'pcs' ? Math.round(val) : val);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                      />
                      {item.unit && (
                        <span className="text-[10px] font-mono text-slate-400 uppercase shrink-0">
                          {item.unit}
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="Rate"
                        required
                        value={item.unit_cost || ''}
                        onChange={(e) => handleItemChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Freight / Additional Transportation Cost */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Freight / Additional Transport Cost (PKR)</span>
              </label>
              <span className="text-[10px] text-slate-400">Direct delivery for this vendor</span>
            </div>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0 (e.g. 1500 for direct transport)"
              value={singleFreightCost || ''}
              onChange={(e) => setSingleFreightCost(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-mono focus:outline-none focus:border-amber-400 placeholder-slate-600"
            />
            {singleFreightCost > 0 && (
              <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-center justify-between font-mono">
                <span>Material: {formatPKR(totalMaterialAmount)} + Freight: {formatPKR(singleFreightCost)}</span>
                <span>Total Landed: <strong className="text-white">{formatPKR(totalLandedAmount)}</strong></span>
              </div>
            )}
          </div>

          {/* Payment & Totals */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-sm font-bold text-white">
              <span>Total Material Cost:</span>
              <span className="font-mono text-emerald-400 text-base">{formatPKR(totalMaterialAmount)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => handlePaymentStatusChange(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="paid">Full Paid</option>
                  <option value="partial">Partial Payment</option>
                  <option value="unpaid">Credit / Unpaid</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="bank">Bank Transfer (HBL)</option>
                  <option value="cash">Cash Voucher</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            {paymentStatus === 'partial' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Amount Paid Now (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalMaterialAmount}
                  value={amountPaid || ''}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
            )}
          </div>

          {submitError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Recording Purchase...' : 'Confirm Purchase & Receive Stock'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Purchase Order Detail View Modal */}
      {selectedPurchaseDetails && (
        <Modal
          isOpen={!!selectedPurchaseDetails}
          onClose={() => setSelectedPurchaseDetails(null)}
          title={`Purchase Order: ${selectedPurchaseDetails.invoice_number}`}
          subtitle={`Received from ${selectedPurchaseDetails.supplier_name} on ${formatDate(selectedPurchaseDetails.date)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {selectedPurchaseDetails.trip_number && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2 text-emerald-300">
                <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Grouped under Purchase Trip <strong>{selectedPurchaseDetails.trip_number}</strong>. Freight was shared across all materials in that trip.
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800">
              <div>
                <p className="text-slate-500">Supplier</p>
                <p className="font-bold text-white text-sm">{selectedPurchaseDetails.supplier_name}</p>
              </div>
              <div>
                <p className="text-slate-500">Total Invoice</p>
                <p className="font-bold text-white font-mono text-sm">{formatPKR(selectedPurchaseDetails.total_amount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Payment Channel</p>
                <p className="font-semibold text-emerald-400 uppercase font-mono">{selectedPurchaseDetails.payment_method}</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">
                Purchased Inventory Items Received
              </h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {selectedPurchaseDetails.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-white">{item.product_or_material_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Base Rate: {formatPKR(item.unit_cost)}/{item.unit || 'unit'}
                        {item.allocated_freight && item.allocated_freight > 0 ? (
                          <span className="text-amber-400 ml-2">
                            • Freight: +{formatPKR(item.allocated_freight)} (Landed: {formatPKR(item.landed_cost || (item.quantity > 0 ? item.unit_cost + (item.allocated_freight / item.quantity) : item.unit_cost))}/{item.unit})
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        +{item.quantity} {item.unit || 'units'}
                      </span>
                      <p className="text-[11px] font-mono text-slate-300">
                        {formatPKR(item.subtotal)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPurchaseDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Purchase Order Confirmation Modal */}
      {deleteConfirmPurchase && (
        <Modal
          isOpen={!!deleteConfirmPurchase}
          onClose={() => setDeleteConfirmPurchase(null)}
          title="Confirm PO Deletion & Inventory Reversal"
          subtitle={`Invoice ${deleteConfirmPurchase.invoice_number} from ${deleteConfirmPurchase.supplier_name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Authoritative Reversal Operation</p>
                <p className="text-rose-300/80 mt-1">
                  Deleting this purchase order will subtract the quantities from factory inventory, reverse supplier balances, and purge payments.
                </p>
              </div>
            </div>

            {negativeStockWarning && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 space-y-1 font-mono">
                <p className="font-bold flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="w-4 h-4" /> Potential Negative Stock Warning:
                </p>
                {negativeStockWarning.map((warn, i) => (
                  <p key={i} className="text-[11px]">{warn}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmPurchase(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              {negativeStockWarning ? (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeletePurchase(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Force Delete & Allow Negative Stock</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeletePurchase(false)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete & Reverse Inventory</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* New Purchase Trip Modal */}
      <PurchaseTripModal
        isOpen={isTripModalOpen}
        onClose={() => setIsTripModalOpen(false)}
        onTripCreated={() => {
          setActiveTab('trips');
        }}
      />

      {/* Purchase Trip Detail & Allocation Breakdown Modal */}
      <PurchaseTripDetailModal
        trip={selectedTripDetails}
        isOpen={!!selectedTripDetails}
        onClose={() => setSelectedTripDetails(null)}
      />
    </div>
  );
};
