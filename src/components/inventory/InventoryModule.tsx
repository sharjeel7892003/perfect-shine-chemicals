import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  Sliders, 
  History, 
  Check, 
  X,
  Sparkles,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Box,
  Archive,
  RefreshCw,
  Layers
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product, StockMovementType, ProductUnit, BaseUnit, PackSize } from '../../types';
import { formatPKR, formatDate, formatDateTime } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { PackSizesModal } from './PackSizesModal';

export const InventoryModule: React.FC = () => {
  const { 
    products, 
    stockMovements, 
    lowStockProducts, 
    addProduct, 
    updateProduct, 
    deleteOrArchiveProduct,
    unarchiveProduct,
    checkProductHasHistory,
    adjustStock,
    updateProductPackSizes 
  } = useApp();
  
  const { currentUser, isOwner, canManageProducts, canAdjustStock } = useAuth();

  const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products');
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form states for Add/Edit
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Dishwashing',
    unit: 'liter' as ProductUnit,
    base_unit: 'liter' as BaseUnit,
    cost_price: 0,
    selling_price: 0,
    current_stock: 0,
    reorder_level: 50,
    description: '',
    is_active: true,
  });

  // Form states for Stock Adjustment
  const [adjustData, setAdjustData] = useState({
    productId: '',
    qtyDiff: 10,
    type: 'production' as StockMovementType,
    notes: '',
  });

  const openAddModal = () => {
    setFormData({
      name: '',
      sku: `PSC-${Math.floor(100 + Math.random() * 900)}`,
      category: 'Dishwashing',
      unit: 'liter',
      base_unit: 'liter',
      cost_price: 0,
      selling_price: 0,
      current_stock: 0,
      reorder_level: 50,
      description: '',
      is_active: true,
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category || 'General',
      unit: product.unit,
      base_unit: product.base_unit || (product.unit === 'kg' ? 'kg' : 'liter'),
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      current_stock: product.current_stock,
      reorder_level: product.reorder_level,
      description: product.description || '',
      is_active: product.is_active,
    });
    setIsEditModalOpen(true);
  };

  const openAdjustModal = (product?: Product) => {
    const target = product || products[0];
    if (!target) return;
    setSelectedProduct(target);
    setAdjustData({
      productId: target.id,
      qtyDiff: 10,
      type: 'production',
      notes: '',
    });
    setIsAdjustModalOpen(true);
  };

  const openPackModal = (product: Product) => {
    setSelectedProduct(product);
    setIsPackModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditModalOpen && selectedProduct) {
      updateProduct(selectedProduct.id, formData);
      setIsEditModalOpen(false);
    } else {
      addProduct(formData);
      setIsAddModalOpen(false);
    }
  };

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustData.productId || adjustData.qtyDiff === 0) return;

    adjustStock(
      adjustData.productId,
      adjustData.qtyDiff,
      adjustData.type,
      adjustData.notes,
      currentUser.name
    );
    setIsAdjustModalOpen(false);
  };

  const handleDeleteOrArchive = (product: Product) => {
    const res = deleteOrArchiveProduct(product.id, currentUser);
    alert(res.message);
    setDeleteConfirmProduct(null);
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const isArchivedMatch = showArchived ? p.is_archived : !p.is_archived;
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return isArchivedMatch && matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(products.map(p => p.category || 'General')));

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            <span>Finished Goods Chemical Inventory</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Single base-unit stock tracking (liters & kg), packaging variants & batch adjustments
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canAdjustStock && (
            <button
              onClick={() => openAdjustModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Stock Adjustment</span>
            </button>
          )}

          {canManageProducts && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>Add Finished Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Archive Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => { setActiveTab('products'); setShowArchived(false); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'products' && !showArchived ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Products ({products.filter(p => !p.is_archived).length})
          </button>
          <button
            onClick={() => { setActiveTab('products'); setShowArchived(true); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'products' && showArchived ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Archived Catalog ({products.filter(p => p.is_archived).length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'movements' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Movement Trail ({stockMovements.length})
          </button>
        </div>

        {lowStockProducts.length > 0 && activeTab === 'products' && !showArchived && (
          <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{lowStockProducts.length} Finished Product(s) Below Base Reorder Threshold</span>
          </div>
        )}
      </div>

      {activeTab === 'products' ? (
        /* ================= PRODUCT CATALOG TABLE ================= */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by product name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="all">All Product Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Product Name & SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-center">Base Unit</th>
                  <th className="py-3 px-3">Sales Packaging Options</th>
                  {isOwner && <th className="py-3 px-3 text-right">Cost Rate</th>}
                  <th className="py-3 px-3 text-right">Selling Rate</th>
                  <th className="py-3 px-3 text-right">Current Stock (Base)</th>
                  <th className="py-3 px-3 text-right">Reorder Level</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      {showArchived ? 'No archived products found' : 'No active products match search criteria'}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const baseUnit = p.base_unit || p.unit || 'liter';
                    const isLow = Number(p.current_stock) <= Number(p.reorder_level);
                    const packCount = p.pack_sizes?.length || 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-bold text-white text-sm">{p.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{p.sku}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono text-emerald-400 uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            {baseUnit}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => openPackModal(p)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors text-[11px]"
                            title="Configure Pack Sizes"
                          >
                            <Box className="w-3.5 h-3.5 text-teal-400" />
                            <span>{packCount} Pack Sizes</span>
                          </button>
                        </td>
                        {isOwner && (
                          <td className="py-3 px-3 text-right font-mono text-slate-400">
                            {formatPKR(p.cost_price)}/{baseUnit}
                          </td>
                        )}
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatPKR(p.selling_price)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-mono font-black text-sm ${isLow && !p.is_archived ? 'text-rose-400' : 'text-white'}`}>
                            {p.current_stock} <span className="text-[11px] font-normal text-slate-400">{baseUnit}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {p.reorder_level} {baseUnit}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {p.is_archived ? (
                            <Badge variant="amber">Archived</Badge>
                          ) : isLow ? (
                            <Badge variant="rose">Low Stock</Badge>
                          ) : (
                            <Badge variant="emerald">In Stock</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!p.is_archived ? (
                              <>
                                {canAdjustStock && (
                                  <button
                                    onClick={() => openAdjustModal(p)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                                    title="Quick Stock Adjustment"
                                  >
                                    <Sliders className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canManageProducts && (
                                  <button
                                    onClick={() => openEditModal(p)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                    title="Edit Product"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isOwner ? (
                                  checkProductHasHistory(p.id) ? (
                                    <button
                                      onClick={() => setDeleteConfirmProduct(p)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
                                      title="Archive product (protects sales and batch history)"
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                      <span>Archive</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmProduct(p)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                                      title="Permanently delete product (0 transaction history)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Delete</span>
                                    </button>
                                  )
                                ) : (
                                  <button
                                    disabled
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/40 text-slate-600 border border-slate-800 text-xs cursor-not-allowed opacity-50"
                                    title="Admin role required to delete or archive"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    <span>Archive</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              isOwner && (
                                <button
                                  onClick={() => unarchiveProduct(p.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                                  title="Restore Product to Active Catalog"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Unarchive</span>
                                </button>
                              )
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
      ) : (
        /* ================= MOVEMENT AUDIT TRAIL ================= */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Finished Goods Stock Movement Audit Log (Single Base Unit)</span>
            </h3>
            <span className="text-xs text-slate-400">{stockMovements.length} Total Logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-right">Base Qty Change</th>
                  <th className="py-3 px-3 text-right">Base Stock Level</th>
                  <th className="py-3 px-3">Notes & Reference</th>
                  <th className="py-3 px-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stockMovements.map((sm) => {
                  const isPositive = sm.quantity > 0;
                  return (
                    <tr key={sm.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono">{formatDateTime(sm.date)}</td>
                      <td className="py-3 px-3 font-bold text-white">{sm.product_name || 'Chemical Product'}</td>
                      <td className="py-3 px-3 capitalize">
                        <Badge
                          variant={
                            sm.movement_type === 'purchase_in' || sm.movement_type === 'production'
                              ? 'emerald'
                              : sm.movement_type === 'sale_out'
                              ? 'blue'
                              : 'amber'
                          }
                        >
                          {sm.movement_type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPositive ? `+${sm.quantity}` : sm.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {sm.previous_stock !== undefined && sm.new_stock !== undefined ? (
                          <span>{sm.previous_stock} → <strong className="text-white">{sm.new_stock}</strong></span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{sm.notes || '-'}</td>
                      <td className="py-3 px-3 text-slate-400">{sm.created_by_name || 'System Admin'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
        title={isEditModalOpen ? 'Edit Finished Chemical Product' : 'Add New Chemical Product'}
        subtitle="Configures single source of truth base unit (kg or liter) and sales rates"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Product Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dishwashing Liquid (Lemon Action)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">SKU / Code</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="PSC-DWL"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="Dishwashing">Dishwashing</option>
                <option value="Hand Hygiene">Hand Hygiene</option>
                <option value="Restroom Cleaners">Restroom Cleaners</option>
                <option value="Floor Care">Floor Care</option>
                <option value="Laundry & Sanitation">Laundry & Sanitation</option>
                <option value="Industrial Descalers">Industrial Descalers</option>
                <option value="Laundry Care">Laundry Care</option>
                <option value="General">General</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Single Base Unit (Source of Truth)
              </label>
              <select
                value={formData.base_unit}
                onChange={(e) => {
                  const u = e.target.value as BaseUnit;
                  setFormData({ ...formData, base_unit: u, unit: u });
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase font-bold"
              >
                <option value="liter">Liter (Liter / L)</option>
                <option value="kg">Kilogram (Kg)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cost Rate (PKR/Base Unit)</label>
              <input
                type="number"
                min="0"
                required
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Selling Rate (PKR/Base Unit)</label>
              <input
                type="number"
                min="0"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            {!isEditModalOpen && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Opening Base Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Reorder Level Threshold</label>
              <input
                type="number"
                min="1"
                required
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-colors"
            >
              {isEditModalOpen ? 'Save Changes' : 'Create Finished Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manual Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Stock Adjustment / Batch In"
        subtitle="Log manufacturing batch outputs, physical audit count, or factory spillage"
      >
        <form onSubmit={handleApplyAdjustment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Chemical Product</label>
            <select
              value={adjustData.productId}
              onChange={(e) => setAdjustData({ ...adjustData, productId: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.current_stock} {p.base_unit || p.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Adjustment Reason</label>
              <select
                value={adjustData.type}
                onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value as StockMovementType })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="production">Production Batch Output (+)</option>
                <option value="adjustment">Physical Inventory Audit (+ / -)</option>
                <option value="wastage">Factory Spillage / Wastage (-)</option>
                <option value="return">Customer Return (+)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Quantity Change (+ or -)
              </label>
              <input
                type="number"
                required
                value={adjustData.qtyDiff}
                onChange={(e) => setAdjustData({ ...adjustData, qtyDiff: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. +50 or -5"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes / Batch #</label>
            <textarea
              rows={2}
              value={adjustData.notes}
              onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
              placeholder="e.g. Completed 100L batch output in storage tank #1"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-colors"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Pack Sizes Configuration Modal */}
      {isPackModalOpen && selectedProduct && (
        <PackSizesModal
          product={selectedProduct}
          isOpen={isPackModalOpen}
          onClose={() => setIsPackModalOpen(false)}
          onSave={updateProductPackSizes}
        />
      )}

      {/* Delete / Archive Confirmation Modal */}
      {deleteConfirmProduct && (() => {
        const hasHistory = checkProductHasHistory(deleteConfirmProduct.id);
        return (
          <Modal
            isOpen={!!deleteConfirmProduct}
            onClose={() => setDeleteConfirmProduct(null)}
            title={hasHistory ? `Archive Product: ${deleteConfirmProduct.name}` : `Delete Product: ${deleteConfirmProduct.name}`}
            subtitle={hasHistory ? "System safe archive: preserves historical ledger & batch data" : "System permanent deletion: 0 history found"}
          >
            <div className="space-y-4 text-xs">
              {hasHistory ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-400">
                    <Archive className="w-4 h-4 shrink-0" />
                    <span>Transaction History Detected (Soft Archive):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This product is referenced in sales invoices, supplier purchase orders, or production batches. To protect ledger accounting, audit trails, and financial statements, it <strong>cannot be permanently deleted</strong>.
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px] mt-1.5">
                    It will be <strong>archived</strong>: hidden from POS sales counters and production forms, but all past transaction records and reporting will remain intact. You can unarchive it anytime from the archived tab.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Zero History Detected (Permanent Delete):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This product has <strong>0 historical transactions</strong> (no sales, purchases, or production runs). It will be <strong>permanently deleted</strong> from the factory database.
                  </p>
                </div>
              )}

              <p className="text-slate-300">
                Are you sure you want to {hasHistory ? 'archive' : 'permanently delete'} <strong>{deleteConfirmProduct.name}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmProduct(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteOrArchive(deleteConfirmProduct)}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-colors ${
                    hasHistory ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {hasHistory ? 'Confirm & Archive Product' : 'Confirm Permanent Deletion'}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
