import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Trash2, 
  Printer, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  ArrowRight,
  Box,
  Layers,
  ChevronDown,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Sale, SaleItem, PaymentMethod, PaymentStatus, Product, PackSize } from '../../types';
import { formatPKR, formatDate } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { InvoiceModal } from './InvoiceModal';

export const SalesModule: React.FC = () => {
  const { products, customers, sales, createSale, deleteSaleInvoice } = useApp();
  const { currentUser, isOwner, canCreateSale } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history'>('pos');
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<Sale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // POS State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [salesNotes, setSalesNotes] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected pack size per product card in POS terminal
  const [selectedPackByProduct, setSelectedPackByProduct] = useState<Record<string, string>>({});

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Cart Calculations
  const subtotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setAmountPaid(totalAmount);
    } else if (status === 'unpaid' || status === 'credit') {
      setAmountPaid(0);
    }
  };

  const getSelectedPackForProduct = (product: Product): {
    packId: string;
    packName: string;
    multiplier: number;
    price: number;
    unitLabel: string;
  } => {
    const baseUnit = product.base_unit || product.unit || 'liter';
    const packs = product.pack_sizes && product.pack_sizes.length > 0 ? product.pack_sizes : [];
    const chosenId = selectedPackByProduct[product.id];

    if (chosenId === 'bulk' || (!chosenId && packs.length === 0)) {
      return {
        packId: 'bulk',
        packName: `Bulk / Loose (${baseUnit})`,
        multiplier: 1.0,
        price: product.selling_price,
        unitLabel: baseUnit,
      };
    }

    const matched = packs.find(p => p.id === chosenId) || packs.find(p => p.is_default) || packs[0];
    if (matched) {
      return {
        packId: matched.id,
        packName: matched.name,
        multiplier: matched.size_in_base_unit,
        price: matched.selling_price,
        unitLabel: matched.unit_label,
      };
    }

    return {
      packId: 'bulk',
      packName: `Bulk / Loose (${baseUnit})`,
      multiplier: 1.0,
      price: product.selling_price,
      unitLabel: baseUnit,
    };
  };

  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const baseStock = Number(product.current_stock);
    if (baseStock <= 0) {
      alert(`Cannot add ${product.name}: Out of stock in warehouse!`);
      return;
    }

    const packInfo = getSelectedPackForProduct(product);
    const neededBaseQty = packInfo.multiplier;

    if (neededBaseQty > baseStock) {
      alert(`Insufficient stock! ${packInfo.packName} requires ${neededBaseQty} ${product.base_unit || product.unit}, but only ${baseStock} available.`);
      return;
    }

    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.product_id === productId && (item.pack_size_id === packInfo.packId || (!item.pack_size_id && packInfo.packId === 'bulk')));

      if (existingIdx !== -1) {
        const currentItem = prev[existingIdx];
        const nextPackQty = currentItem.quantity + 1;
        const totalBaseRequired = nextPackQty * packInfo.multiplier;

        if (totalBaseRequired > baseStock) {
          alert(`Maximum available stock reached! Only ${baseStock} ${product.base_unit || product.unit} in storage.`);
          return prev;
        }

        const updated = [...prev];
        updated[existingIdx] = {
          ...currentItem,
          quantity: nextPackQty,
          pack_quantity: nextPackQty,
          base_quantity: totalBaseRequired,
          subtotal: nextPackQty * currentItem.unit_price,
        };
        return updated;
      }

      const newItem: SaleItem = {
        product_id: product.id,
        product_name: product.name,
        unit: product.base_unit || product.unit,
        pack_size_id: packInfo.packId,
        pack_size_name: packInfo.packName,
        pack_quantity: 1,
        size_in_base_unit: packInfo.multiplier,
        base_quantity: packInfo.multiplier,
        quantity: 1,
        unit_cost: product.cost_price * packInfo.multiplier,
        unit_price: packInfo.price,
        subtotal: packInfo.price,
      };

      return [...prev, newItem];
    });
  };

  const updateQuantity = (index: number, newQty: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (!item) return prev;

      if (newQty <= 0) {
        return prev.filter((_, idx) => idx !== index);
      }

      const product = products.find(p => p.id === item.product_id);
      const baseStock = product ? Number(product.current_stock) : 99999;
      const multiplier = item.size_in_base_unit || 1.0;
      const totalBaseNeeded = newQty * multiplier;

      if (totalBaseNeeded > baseStock) {
        alert(`Only ${baseStock} ${item.unit} available in warehouse.`);
        newQty = Math.floor(baseStock / multiplier) || 1;
      }

      const updated = [...prev];
      updated[index] = {
        ...item,
        quantity: newQty,
        pack_quantity: newQty,
        base_quantity: newQty * multiplier,
        subtotal: newQty * item.unit_price,
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    setCartItems([]);
    setDiscountAmount(0);
    setAmountPaid(0);
    setSelectedCustomerId('');
    setSalesNotes('');
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      alert('Please add products to the invoice before checkout.');
      return;
    }

    const customerName = selectedCustomer ? selectedCustomer.name : 'Counter Walk-in Retail';
    const finalAmountPaid = paymentStatus === 'paid' ? totalAmount : amountPaid;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const newSale = await createSale({
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName,
        date: new Date().toISOString(),
        items: cartItems,
        subtotal,
        discount: discountAmount,
        tax: 0,
        total_amount: totalAmount,
        amount_paid: finalAmountPaid,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        salesperson_name: currentUser.name,
        notes: salesNotes,
      });

      clearCart();
      setSelectedInvoice(newSale);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to complete sale. Please check your connection.');
      alert(err?.message || 'Failed to complete sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteSale = async () => {
    if (!deleteConfirmSale) return;
    setIsDeleting(true);
    try {
      const res = await deleteSaleInvoice(deleteConfirmSale.id, currentUser);
      alert(res.message);
      setDeleteConfirmSale(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete sale invoice');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter products in POS (Only active & non-archived)
  const filteredProducts = products.filter(p =>
    p.is_active && !p.is_archived &&
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  // Filter sales history
  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.invoice_number.toLowerCase().includes(historySearch.toLowerCase()) ||
      s.customer_name.toLowerCase().includes(historySearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-400" />
            <span>Sales Dispatch & POS Terminal</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sell by bottle/can pack sizes or wholesale bulk, auto-converting to single base-unit inventory
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveSubTab('pos')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'pos'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            New POS Billing
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'history'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Invoice History ({sales.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'pos' ? (
        /* =================== POS TERMINAL VIEW =================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Columns: Product Selection Grid with Pack Size Dropdown */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search chemical product name or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[620px] overflow-y-auto pr-1">
              {filteredProducts.map((product) => {
                const baseUnit = product.base_unit || product.unit || 'liter';
                const isOutOfStock = product.current_stock <= 0;
                const isLow = product.current_stock <= product.reorder_level;
                const packInfo = getSelectedPackForProduct(product);
                const packSizes = product.pack_sizes || [];

                const defaultPack = packSizes.find(p => p.is_default) || packSizes[0];
                const estPacksAvailable = defaultPack && defaultPack.size_in_base_unit > 0
                  ? Math.floor(product.current_stock / defaultPack.size_in_base_unit)
                  : 0;

                return (
                  <div
                    key={product.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isOutOfStock
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                        : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-white text-sm leading-tight">{product.name}</h4>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{product.sku}</p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase">
                          {baseUnit}
                        </span>
                      </div>

                      <div className="mt-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block">Warehouse Stock:</span>
                          <span className={`font-mono font-black ${isLow ? 'text-rose-400' : 'text-white'}`}>
                            {product.current_stock} {baseUnit}
                          </span>
                        </div>
                        {defaultPack && (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase block">Pack Estimate:</span>
                            <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                              ≈ {estPacksAvailable} {defaultPack.unit_label}s
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          Select Packaging for Sale:
                        </label>
                        <select
                          value={selectedPackByProduct[product.id] || (defaultPack?.id || 'bulk')}
                          onChange={(e) => setSelectedPackByProduct({
                            ...selectedPackByProduct,
                            [product.id]: e.target.value,
                          })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-500"
                        >
                          {packSizes.map(pk => (
                            <option key={pk.id} value={pk.id}>
                              {pk.name} ({pk.size_in_base_unit} {baseUnit}) • {formatPKR(pk.selling_price)}
                            </option>
                          ))}
                          <option value="bulk">
                            Bulk / Loose Wholesale (Per 1 {baseUnit}) • {formatPKR(product.selling_price)}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase">Rate:</span>
                        <p className="text-base font-black font-mono text-emerald-400 leading-none mt-0.5">
                          {formatPKR(packInfo.price)}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => addToCart(product.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                        <span>Add to Bill</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 5 Columns: Billing Order Cart */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between shadow-xl">
            <form onSubmit={handleCheckout} className="space-y-4 flex flex-col h-full">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select Customer / Client
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Counter Walk-in Retail Customer</option>
                  {customers.filter(c => !c.is_archived).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customer_type}) {c.current_balance > 0 ? `• Due: ${formatPKR(c.current_balance)}` : ''}
                    </option>
                  ))}
                </select>

                {selectedCustomer && selectedCustomer.current_balance > 0 && (
                  <div className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center justify-between">
                    <span>Previous Outstanding Balance:</span>
                    <span className="font-bold font-mono">{formatPKR(selectedCustomer.current_balance)}</span>
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="flex-1 border border-slate-800 rounded-xl p-3 bg-slate-950/40 overflow-y-auto max-h-56 space-y-2.5">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-500">
                    <ShoppingCart className="w-8 h-8 stroke-1 mb-2" />
                    <p className="text-xs">No products in current invoice</p>
                    <p className="text-[11px]">Select items & pack sizes from left grid</p>
                  </div>
                ) : (
                  cartItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{item.product_name}</p>
                        <p className="text-[10px] text-emerald-400 font-medium">
                          Packaging: {item.pack_size_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 1)}
                            className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-center text-white font-mono"
                          />
                          <span className="text-[10px] text-slate-400">
                            × {formatPKR(item.unit_price)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({item.base_quantity} {item.unit} total)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-emerald-400">
                          {formatPKR(item.subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Discount & Totals */}
              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Subtotal ({cartItems.length} items):</span>
                  <span className="font-mono font-bold text-white">{formatPKR(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Discount (PKR):</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-xs text-white font-mono focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                  <span>Net Total:</span>
                  <span className="font-mono text-emerald-400">{formatPKR(totalAmount)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => handlePaymentStatusChange(e.target.value as PaymentStatus)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="paid">Full Paid</option>
                    <option value="partial">Partial Payment</option>
                    <option value="credit">Credit / Unpaid</option>
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
                    <option value="cash">Cash Counter</option>
                    <option value="bank">Bank Transfer (HBL)</option>
                    <option value="jazzcash">JazzCash</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {paymentStatus === 'partial' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Amount Received Now (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalAmount}
                    value={amountPaid || ''}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    placeholder="Enter cash received"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              )}

              {/* Checkout Action Buttons */}
              {submitError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                  {submitError}
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={clearCart}
                  className="px-3 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || cartItems.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>{isSubmitting ? 'Syncing to Cloud...' : `Generate Invoice (${formatPKR(totalAmount)})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* =================== INVOICES HISTORY VIEW =================== */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice # or client..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="all">All Payment Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="credit">Credit / Unpaid</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Items / Packaging</th>
                  <th className="py-3 px-3 text-right">Total (PKR)</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No matching sales records found
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-white">{sale.invoice_number}</td>
                      <td className="py-3 px-3 text-slate-400">{formatDate(sale.date)}</td>
                      <td className="py-3 px-3 font-medium text-slate-200">{sale.customer_name}</td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                        {sale.items.map(i => `${i.quantity}x ${i.pack_size_name || i.product_name}`).join(', ')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatPKR(sale.total_amount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {formatPKR(sale.amount_paid)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant={sale.payment_status === 'paid' ? 'emerald' : sale.payment_status === 'partial' ? 'amber' : 'rose'}
                        >
                          {sale.payment_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(sale)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
                            title="Print or Download PDF Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print / PDF</span>
                          </button>

                          {isOwner ? (
                            <button
                              onClick={() => setDeleteConfirmSale(sale)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                              title="Delete Sale Invoice & Reverse Stock/Balances"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/40 text-slate-600 border border-slate-800 text-xs cursor-not-allowed opacity-50"
                              title="Admin role required to delete invoice"
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

      {/* Printable Invoice Modal */}
      {selectedInvoice && (
        <InvoiceModal
          sale={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onDelete={isOwner ? () => {
            const target = selectedInvoice;
            setSelectedInvoice(null);
            setDeleteConfirmSale(target);
          } : undefined}
        />
      )}

      {/* Delete Sale Invoice & Reversal Confirmation Modal */}
      {deleteConfirmSale && (
        <Modal
          isOpen={!!deleteConfirmSale}
          onClose={() => setDeleteConfirmSale(null)}
          title={`Delete & Reverse Invoice: ${deleteConfirmSale.invoice_number}`}
          subtitle="Admin Automated Inventory & Customer Balance Reversal"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Automatic Transaction Reversal Actions:</span>
              </div>
              <ul className="space-y-1.5 text-slate-200 text-[11px] list-disc pl-5">
                <li>
                  <strong>Stock Restoration:</strong> Sold quantities will be automatically added back into warehouse base stock:
                  <div className="mt-1 font-mono text-emerald-400">
                    {deleteConfirmSale.items.map(i => `• ${i.product_name}: +${i.base_quantity || i.quantity} ${i.unit || 'L'}`).join(', ')}
                  </div>
                </li>
                {deleteConfirmSale.customer_id && (deleteConfirmSale.total_amount - deleteConfirmSale.amount_paid) > 0 && (
                  <li>
                    <strong>Customer Debt Reversal:</strong> Customer <em>"{deleteConfirmSale.customer_name}"</em> balance will be reduced by <strong>{formatPKR(deleteConfirmSale.total_amount - deleteConfirmSale.amount_paid)}</strong>.
                  </li>
                )}
                {deleteConfirmSale.amount_paid > 0 && (
                  <li>
                    <strong>Payment Reversal:</strong> Linked cash/bank receipts of <strong>{formatPKR(deleteConfirmSale.amount_paid)}</strong> will be removed from cashbook.
                  </li>
                )}
              </ul>
            </div>

            <p className="text-slate-300">
              Are you sure you want to delete invoice <strong>{deleteConfirmSale.invoice_number}</strong>? An audit log entry will be permanently saved.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmSale(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteSale}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'Reversing...' : 'Confirm Deletion & Execute Reversals'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
