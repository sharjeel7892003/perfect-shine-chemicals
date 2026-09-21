import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Search,
  Calendar,
  Filter,
  Download,
  Printer,
  TrendingDown,
  TrendingUp,
  Building2,
  Package,
  Layers,
  Sparkles,
  ArrowUpDown,
  History,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
  Info,
  DollarSign
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatPKR, formatDate, formatQuantity } from '../../utils/formatters';
import { exportToCSV } from '../../utils/batchNumber';
import { Badge } from '../common/Badge';
import { Purchase, PurchaseItem, RawMaterial, Supplier } from '../../types';

interface RawMaterialPurchaseReportViewProps {
  initialRawMaterialId?: string;
  initialSupplierId?: string;
  embedded?: boolean;
}

export interface ItemizedPurchaseRow {
  purchaseId: string;
  invoiceNumber: string;
  date: string;
  supplierId?: string;
  supplierName: string;
  rawMaterialId: string;
  rawMaterialName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  landedCost: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  paymentMethod: string;
  notes?: string;
}

export const RawMaterialPurchaseReportView: React.FC<RawMaterialPurchaseReportViewProps> = ({
  initialRawMaterialId = 'all',
  initialSupplierId = 'all',
  embedded = false,
}) => {
  const { purchases, rawMaterials, suppliers } = useApp();

  // Filters State
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string>(initialRawMaterialId);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>(initialSupplierId);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'log' | 'vendors' | 'materials_overview'>('log');

  // Quick Date Range Handler
  const handleQuickDate = (type: 'today' | 'this_week' | 'this_month' | 'this_year' | 'all') => {
    const today = new Date();
    const toDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (type === 'today') {
      const d = toDateStr(today);
      setStartDate(d);
      setEndDate(d);
    } else if (type === 'this_week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const first = new Date(d.setDate(diff));
      setStartDate(toDateStr(first));
      setEndDate(toDateStr(today));
    } else if (type === 'this_month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(toDateStr(first));
      setEndDate(toDateStr(last));
    } else if (type === 'this_year') {
      const first = new Date(today.getFullYear(), 0, 1);
      const last = new Date(today.getFullYear(), 11, 31);
      setStartDate(toDateStr(first));
      setEndDate(toDateStr(last));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // 1. Flatten all purchase items and identify raw material purchases
  const allRawMaterialPurchaseRows = useMemo<ItemizedPurchaseRow[]>(() => {
    const rows: ItemizedPurchaseRow[] = [];

    purchases.forEach((p: Purchase) => {
      if (!p.items || p.items.length === 0) return;

      p.items.forEach((item: PurchaseItem) => {
        // Intelligently identify if this item is a raw material
        const matchingRM = rawMaterials.find((rm: RawMaterial) => {
          if (item.raw_material_id && rm.id === item.raw_material_id) return true;
          if (item.product_or_material_name && rm.name.toLowerCase().trim() === item.product_or_material_name.toLowerCase().trim()) return true;
          return false;
        });

        const isExplicitRM = item.item_type === 'raw_material';
        const hasRMId = Boolean(item.raw_material_id);
        const hasNoProdId = !item.product_id;

        if (isExplicitRM || hasRMId || matchingRM || hasNoProdId) {
          const rawMaterialId = matchingRM ? matchingRM.id : (item.raw_material_id || 'unlinked-' + item.product_or_material_name);
          const rawMaterialName = matchingRM ? matchingRM.name : item.product_or_material_name;
          const unit = item.unit || (matchingRM ? matchingRM.unit : 'kg');
          const qty = Number(item.quantity || 0);
          const unitCost = Number(item.unit_cost || 0);
          const subtotal = Number(item.subtotal || (qty * unitCost));
          
          // Landed cost calculation (including allocated freight if available, or base purchase unit cost)
          const allocatedFreight = Number((item as any).allocated_freight || 0);
          const landedCost = qty > 0 ? Number((unitCost + (allocatedFreight / qty)).toFixed(2)) : unitCost;

          rows.push({
            purchaseId: p.id,
            invoiceNumber: p.invoice_number,
            date: p.date,
            supplierId: p.supplier_id,
            supplierName: p.supplier_name || 'Unknown Supplier',
            rawMaterialId,
            rawMaterialName,
            unit,
            quantity: qty,
            unitCost,
            subtotal,
            landedCost,
            paymentStatus: p.payment_status || 'unpaid',
            paymentMethod: p.payment_method || 'cash',
            notes: p.notes,
          });
        }
      });
    });

    // Sort descending by date
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchases, rawMaterials]);

  // 2. Filter rows by material, supplier, date range, and search query
  const filteredRows = useMemo(() => {
    return allRawMaterialPurchaseRows.filter(row => {
      // Material filter
      if (selectedMaterialFilter !== 'all' && row.rawMaterialId !== selectedMaterialFilter) {
        return false;
      }

      // Supplier filter
      if (selectedSupplierFilter !== 'all' && row.supplierId !== selectedSupplierFilter) {
        return false;
      }

      // Date range filter
      if (startDate) {
        const d = new Date(row.date);
        if (d < new Date(startDate + 'T00:00:00')) return false;
      }
      if (endDate) {
        const d = new Date(row.date);
        if (d > new Date(endDate + 'T23:59:59')) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = row.rawMaterialName.toLowerCase().includes(q);
        const matchesSupplier = row.supplierName.toLowerCase().includes(q);
        const matchesInv = row.invoiceNumber.toLowerCase().includes(q);
        const matchesNotes = row.notes ? row.notes.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesSupplier && !matchesInv && !matchesNotes) return false;
      }

      return true;
    });
  }, [allRawMaterialPurchaseRows, selectedMaterialFilter, selectedSupplierFilter, startDate, endDate, searchQuery]);

  // 3. Analytics & Summary Metrics for Selected Raw Material (or Overall)
  const materialAnalytics = useMemo(() => {
    const isSingleMaterial = selectedMaterialFilter !== 'all';
    const activeRM = isSingleMaterial ? rawMaterials.find(m => m.id === selectedMaterialFilter) : null;

    const purchaseCount = filteredRows.length;
    const totalQuantity = filteredRows.reduce((sum, r) => sum + r.quantity, 0);
    const totalSpent = filteredRows.reduce((sum, r) => sum + r.subtotal, 0);

    // Weighted average price per unit
    const weightedAveragePrice = totalQuantity > 0 ? Number((totalSpent / totalQuantity).toFixed(2)) : 0;

    // Minimum and Maximum prices paid with vendor and date
    let minRecord: ItemizedPurchaseRow | null = null;
    let maxRecord: ItemizedPurchaseRow | null = null;

    if (filteredRows.length > 0) {
      minRecord = filteredRows.reduce((min, cur) => cur.unitCost < min.unitCost ? cur : min, filteredRows[0]);
      maxRecord = filteredRows.reduce((max, cur) => cur.unitCost > max.unitCost ? cur : max, filteredRows[0]);
    }

    const currentCost = activeRM ? Number(activeRM.cost_per_unit || 0) : 0;
    const commonUnit = activeRM ? activeRM.unit : (filteredRows[0]?.unit || 'kg');

    // Price spread / variance
    const minPrice = minRecord ? minRecord.unitCost : 0;
    const maxPrice = maxRecord ? maxRecord.unitCost : 0;
    const priceSpread = maxPrice - minPrice;
    const priceSpreadPercent = minPrice > 0 ? Number(((priceSpread / minPrice) * 100).toFixed(1)) : 0;

    return {
      isSingleMaterial,
      activeRM,
      commonUnit,
      purchaseCount,
      totalQuantity,
      totalSpent,
      weightedAveragePrice,
      currentCost,
      minRecord,
      maxRecord,
      priceSpread,
      priceSpreadPercent
    };
  }, [filteredRows, selectedMaterialFilter, rawMaterials]);

  // 4. Summary per Vendor / Supplier
  const vendorSummaries = useMemo(() => {
    const map = new Map<string, {
      supplierId: string;
      supplierName: string;
      orderCount: number;
      totalSpent: number;
      materialMap: Map<string, {
        materialName: string;
        unit: string;
        totalQty: number;
        totalCost: number;
        minCost: number;
        maxCost: number;
        purchaseCount: number;
      }>;
      lastPurchaseDate: string;
    }>();

    filteredRows.forEach(row => {
      const suppKey = row.supplierId || row.supplierName;
      if (!map.has(suppKey)) {
        map.set(suppKey, {
          supplierId: row.supplierId || '',
          supplierName: row.supplierName,
          orderCount: 0,
          totalSpent: 0,
          materialMap: new Map(),
          lastPurchaseDate: row.date,
        });
      }

      const suppData = map.get(suppKey)!;
      suppData.totalSpent += row.subtotal;
      if (new Date(row.date) > new Date(suppData.lastPurchaseDate)) {
        suppData.lastPurchaseDate = row.date;
      }

      // Material breakdown under this supplier
      const matKey = row.rawMaterialName;
      if (!suppData.materialMap.has(matKey)) {
        suppData.materialMap.set(matKey, {
          materialName: row.rawMaterialName,
          unit: row.unit,
          totalQty: 0,
          totalCost: 0,
          minCost: row.unitCost,
          maxCost: row.unitCost,
          purchaseCount: 0,
        });
      }

      const matData = suppData.materialMap.get(matKey)!;
      matData.totalQty += row.quantity;
      matData.totalCost += row.subtotal;
      matData.purchaseCount += 1;
      if (row.unitCost < matData.minCost) matData.minCost = row.unitCost;
      if (row.unitCost > matData.maxCost) matData.maxCost = row.unitCost;
    });

    // Count distinct POs per supplier
    map.forEach((data, key) => {
      const distinctPOs = new Set(
        filteredRows.filter(r => (r.supplierId || r.supplierName) === key).map(r => r.invoiceNumber)
      );
      data.orderCount = distinctPOs.size;
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filteredRows]);

  // 5. Materials Comparative Overview (When viewing all materials)
  const materialsComparativeSummary = useMemo(() => {
    const map = new Map<string, {
      materialId: string;
      materialName: string;
      unit: string;
      purchaseCount: number;
      totalQty: number;
      totalSpent: number;
      minPrice: number;
      minSupplier: string;
      minDate: string;
      maxPrice: number;
      maxSupplier: string;
      maxDate: string;
      currentRate: number;
    }>();

    filteredRows.forEach(row => {
      const key = row.rawMaterialId;
      const matchingRM = rawMaterials.find(m => m.id === row.rawMaterialId);

      if (!map.has(key)) {
        map.set(key, {
          materialId: row.rawMaterialId,
          materialName: row.rawMaterialName,
          unit: row.unit,
          purchaseCount: 0,
          totalQty: 0,
          totalSpent: 0,
          minPrice: row.unitCost,
          minSupplier: row.supplierName,
          minDate: row.date,
          maxPrice: row.unitCost,
          maxSupplier: row.supplierName,
          maxDate: row.date,
          currentRate: matchingRM ? Number(matchingRM.cost_per_unit || 0) : row.unitCost,
        });
      }

      const item = map.get(key)!;
      item.purchaseCount += 1;
      item.totalQty += row.quantity;
      item.totalSpent += row.subtotal;

      if (row.unitCost < item.minPrice) {
        item.minPrice = row.unitCost;
        item.minSupplier = row.supplierName;
        item.minDate = row.date;
      }
      if (row.unitCost > item.maxPrice) {
        item.maxPrice = row.unitCost;
        item.maxSupplier = row.supplierName;
        item.maxDate = row.date;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filteredRows, rawMaterials]);

  // CSV Export Handler
  const handleExportCSV = () => {
    const materialLabel = selectedMaterialFilter !== 'all' 
      ? rawMaterials.find(m => m.id === selectedMaterialFilter)?.name.replace(/[^a-zA-Z0-9]/g, '_') || 'Chemical'
      : 'All_Raw_Materials';
    const dateLabel = startDate && endDate ? `${startDate}_to_${endDate}` : 'All_Time';

    if (activeSubTab === 'vendors') {
      const headers = ['Supplier Name', 'Total Orders', 'Total Spent (PKR)', 'Materials Supplied', 'Last Purchase Date'];
      const rows = vendorSummaries.map(v => [
        v.supplierName,
        v.orderCount,
        v.totalSpent,
        Array.from(v.materialMap.values()).map(m => `${m.materialName} (Avg: ${formatPKR(m.totalCost / (m.totalQty || 1))}/${m.unit})`).join('; '),
        formatDate(v.lastPurchaseDate)
      ]);
      exportToCSV(`PSC_RM_Vendor_Summary_${materialLabel}_${dateLabel}`, headers, rows);
    } else if (activeSubTab === 'materials_overview') {
      const headers = ['Chemical / Raw Material', 'Unit', 'Purchases Count', 'Total Qty Procured', 'Total Spent (PKR)', 'Weighted Avg Price (PKR)', 'Lowest Price (PKR)', 'Lowest Vendor', 'Lowest Date', 'Highest Price (PKR)', 'Highest Vendor', 'Highest Date', 'Current Tracked Rate (PKR)'];
      const rows = materialsComparativeSummary.map(m => [
        m.materialName,
        m.unit,
        m.purchaseCount,
        m.totalQty,
        m.totalSpent,
        (m.totalSpent / (m.totalQty || 1)).toFixed(2),
        m.minPrice,
        m.minSupplier,
        formatDate(m.minDate),
        m.maxPrice,
        m.maxSupplier,
        formatDate(m.maxDate),
        m.currentRate
      ]);
      exportToCSV(`PSC_Chemical_Procurement_Summary_${dateLabel}`, headers, rows);
    } else {
      const headers = ['Date', 'PO / Invoice #', 'Supplier / Vendor', 'Raw Material Name', 'Quantity', 'Unit', 'Price per Unit (PKR)', 'Landed Cost (PKR)', 'Total Amount (PKR)', 'Payment Status', 'Payment Method', 'Notes'];
      const rows = filteredRows.map(r => [
        r.date.slice(0, 10),
        r.invoiceNumber,
        r.supplierName,
        r.rawMaterialName,
        r.quantity,
        r.unit,
        r.unitCost,
        r.landedCost,
        r.subtotal,
        r.paymentStatus,
        r.paymentMethod,
        r.notes || ''
      ]);
      exportToCSV(`PSC_RM_Purchase_Log_${materialLabel}_${dateLabel}`, headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-400" />
              <span>Raw Material Purchase History & Procurement Intelligence</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical purchase logs, weighted average costs, price extremes (min/max), and vendor pricing analytics.
            </p>
          </div>

          <div className="no-print flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Export current view to CSV"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Print Raw Material Purchase Report"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Print Report</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Interactive Filter Controls */}
      <div className="no-print p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5">
        {/* Quick Date Range Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Date Presets:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: 'All Time', type: 'all' },
              { label: 'Today', type: 'today' },
              { label: 'This Week', type: 'this_week' },
              { label: 'This Month', type: 'this_month' },
              { label: 'This Year', type: 'this_year' },
            ].map(pill => (
              <button
                key={pill.type}
                onClick={() => handleQuickDate(pill.type as any)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition-colors border border-slate-700/60"
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Chemical / Raw Material Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
              <span>Raw Material / Chemical</span>
            </label>
            <select
              value={selectedMaterialFilter}
              onChange={(e) => setSelectedMaterialFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">🧪 All Raw Materials ({rawMaterials.length})</option>
              {rawMaterials.map(rm => (
                <option key={rm.id} value={rm.id}>
                  {rm.name} ({rm.unit}) — Current: PKR {rm.cost_per_unit}/{rm.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier / Vendor Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vendor / Supplier</span>
            </label>
            <select
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">🏢 All Vendors / Suppliers ({suppliers.length})</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.city ? `(${s.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Start & End */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quick Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="PO #, chemical, vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Summary Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-medium">Active Scope:</span>
          {selectedMaterialFilter !== 'all' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[11px] font-semibold">
              🧪 {rawMaterials.find(m => m.id === selectedMaterialFilter)?.name || 'Selected Chemical'}
              <button onClick={() => setSelectedMaterialFilter('all')} className="ml-1 hover:text-white">✕</button>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[11px]">All Chemicals</span>
          )}

          {selectedSupplierFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-[11px] font-semibold">
              🏢 {suppliers.find(s => s.id === selectedSupplierFilter)?.name || 'Selected Vendor'}
              <button onClick={() => setSelectedSupplierFilter('all')} className="ml-1 hover:text-white">✕</button>
            </span>
          )}

          {(startDate || endDate) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 text-[11px] font-semibold">
              📅 {startDate ? formatDate(startDate) : 'Start'} → {endDate ? formatDate(endDate) : 'Present'}
              <button onClick={() => { setStartDate(''); setEndDate(''); }} className="ml-1 hover:text-white">✕</button>
            </span>
          )}

          <div className="ml-auto text-xs text-slate-400 font-mono">
            Matched: <strong className="text-white">{filteredRows.length}</strong> purchase line items
          </div>
        </div>
      </div>

      {/* 3. Analytical Summary Cards */}
      {materialAnalytics.isSingleMaterial ? (
        /* SINGLE MATERIAL ANALYTICS (When one chemical like LABSA is selected) */
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <FlaskConical className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold text-white">{materialAnalytics.activeRM?.name || 'Chemical'}</h4>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono font-medium border border-slate-700">
                    {materialAnalytics.commonUnit}
                  </span>
                  <Badge variant="emerald">{materialAnalytics.activeRM?.category || 'Chemical Raw Material'}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Procurement performance across {materialAnalytics.purchaseCount} historical purchases
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Inventory Stock</span>
                <span className="text-base font-black text-white font-mono">
                  {formatQuantity(materialAnalytics.activeRM?.current_stock || 0, materialAnalytics.commonUnit)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Master Rate</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {formatPKR(materialAnalytics.currentCost)} / {materialAnalytics.commonUnit}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Total Quantity & Spend */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Quantity Purchased</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">
                {formatQuantity(materialAnalytics.totalQuantity, materialAnalytics.commonUnit)}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Total Spend: <strong className="text-emerald-400">{formatPKR(materialAnalytics.totalSpent)}</strong>
              </p>
            </div>

            {/* 2. Weighted Average Price */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Weighted Average Price Paid</span>
              <p className="text-xl font-black text-emerald-400 mt-1.5 font-mono">
                {formatPKR(materialAnalytics.weightedAveragePrice)} <span className="text-xs font-normal text-slate-400">/{materialAnalytics.commonUnit}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Based on exact volume-weighted formula
              </p>
            </div>

            {/* 3. Lowest Price Paid (Min) */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Lowest Price Paid</span>
                </span>
              </div>
              {materialAnalytics.minRecord ? (
                <>
                  <p className="text-xl font-black text-emerald-300 mt-1.5 font-mono">
                    {formatPKR(materialAnalytics.minRecord.unitCost)} <span className="text-xs font-normal text-slate-400">/{materialAnalytics.commonUnit}</span>
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1 truncate">
                    Vendor: <strong className="text-white">{materialAnalytics.minRecord.supplierName}</strong>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Date: {formatDate(materialAnalytics.minRecord.date)} (PO #{materialAnalytics.minRecord.invoiceNumber})
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500 mt-3">No purchases recorded</p>
              )}
            </div>

            {/* 4. Highest Price Paid (Max) */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Highest Price Paid</span>
                </span>
              </div>
              {materialAnalytics.maxRecord ? (
                <>
                  <p className="text-xl font-black text-rose-400 mt-1.5 font-mono">
                    {formatPKR(materialAnalytics.maxRecord.unitCost)} <span className="text-xs font-normal text-slate-400">/{materialAnalytics.commonUnit}</span>
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1 truncate">
                    Vendor: <strong className="text-white">{materialAnalytics.maxRecord.supplierName}</strong>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Date: {formatDate(materialAnalytics.maxRecord.date)} (PO #{materialAnalytics.maxRecord.invoiceNumber})
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500 mt-3">No purchases recorded</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ALL RAW MATERIALS OVERVIEW METRICS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Raw Material Spend</span>
            <p className="text-xl font-black text-emerald-400 mt-1.5 font-mono">
              {formatPKR(materialAnalytics.totalSpent)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">{filteredRows.length} Itemized purchases</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Volume Procured</span>
            <p className="text-xl font-black text-white mt-1.5 font-mono">
              {materialAnalytics.totalQuantity.toLocaleString()} Units
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Across all chemicals</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Distinct Chemicals Procured</span>
            <p className="text-xl font-black text-white mt-1.5 font-mono">
              {materialsComparativeSummary.length} Chemicals
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">With recorded purchases</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Active Supply Vendors</span>
            <p className="text-xl font-black text-cyan-400 mt-1.5 font-mono">
              {vendorSummaries.length} Vendors
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Supplying raw materials</p>
          </div>
        </div>
      )}

      {/* 4. Sub-Navigation Tabs */}
      <div className="no-print flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('log')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'log'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Detailed Purchase Log ({filteredRows.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('vendors')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'vendors'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Summary per Vendor ({vendorSummaries.length})</span>
        </button>

        {!materialAnalytics.isSingleMaterial && (
          <button
            onClick={() => setActiveSubTab('materials_overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'materials_overview'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Chemical Price Comparison ({materialsComparativeSummary.length})</span>
          </button>
        )}
      </div>

      {/* 5. VIEW A: Detailed Purchase Log View */}
      {activeSubTab === 'log' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Detailed Raw Material Purchase Ledger</span>
                <span className="text-xs font-mono text-slate-400 font-normal">({filteredRows.length} transactions)</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Every individual raw material intake with unit price, landed cost, and supplier information.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">PO / Invoice #</th>
                  <th className="py-2.5 px-3">Supplier / Vendor</th>
                  <th className="py-2.5 px-3">Raw Material / Chemical</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Price / Unit</th>
                  <th className="py-2.5 px-3 text-right">Landed Cost</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FlaskConical className="w-8 h-8 text-slate-600" />
                        <p>No raw material purchases found matching the active filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={`${row.purchaseId}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-white whitespace-nowrap">
                        {row.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">
                        {row.supplierName}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{row.rawMaterialName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({row.unit})</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                        {formatQuantity(row.quantity, row.unit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                        {formatPKR(row.unitCost)} <span className="text-[10px] text-slate-500">/{row.unit}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-cyan-300 whitespace-nowrap">
                        {formatPKR(row.landedCost)} <span className="text-[10px] text-slate-500">/{row.unit}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                        {formatPKR(row.subtotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <Badge variant={row.paymentStatus === 'paid' ? 'emerald' : row.paymentStatus === 'partial' ? 'amber' : 'rose'}>
                          {row.paymentStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. VIEW B: Summary per Vendor / Supplier */}
      {activeSubTab === 'vendors' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Vendor Procurement & Pricing Evaluation</span>
              <span className="text-xs font-mono text-slate-400 font-normal">({vendorSummaries.length} vendors)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparison of total spend, orders count, and average unit pricing charged by each supplier over time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {vendorSummaries.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                No vendor data found for the selected filters.
              </div>
            ) : (
              vendorSummaries.map(vendor => (
                <div key={vendor.supplierName} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                    <div>
                      <h5 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{vendor.supplierName}</span>
                        <Badge variant="blue">{vendor.orderCount} POs</Badge>
                      </h5>
                      <span className="text-[11px] text-slate-400">
                        Last Purchase: <strong className="text-slate-300 font-mono">{formatDate(vendor.lastPurchaseDate)}</strong>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Spend with Vendor</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        {formatPKR(vendor.totalSpent)}
                      </span>
                    </div>
                  </div>

                  {/* Materials supplied by this vendor */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Chemicals Supplied & Pricing:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {Array.from(vendor.materialMap.values()).map(mat => {
                        const avgRate = mat.totalQty > 0 ? mat.totalCost / mat.totalQty : mat.minCost;
                        return (
                          <div key={mat.materialName} className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/40 text-xs">
                            <div className="font-bold text-white truncate">{mat.materialName}</div>
                            <div className="flex items-center justify-between mt-1 text-slate-300 font-mono text-[11px]">
                              <span>Volume: {formatQuantity(mat.totalQty, mat.unit)}</span>
                              <span className="text-emerald-400 font-bold">Avg: {formatPKR(avgRate)}/{mat.unit}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>Min: {formatPKR(mat.minCost)}</span>
                              <span>Max: {formatPKR(mat.maxCost)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 7. VIEW C: Materials Price Comparison (When All Materials is selected) */}
      {activeSubTab === 'materials_overview' && !materialAnalytics.isSingleMaterial && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Chemical Procurement & Price Trend Overview</span>
              <span className="text-xs font-mono text-slate-400 font-normal">({materialsComparativeSummary.length} chemicals)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Side-by-side comparison of weighted average purchase rates, lowest and highest prices ever paid, and current tracked inventory rates.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Raw Material / Chemical</th>
                  <th className="py-2.5 px-3 text-center">Orders</th>
                  <th className="py-2.5 px-3 text-right">Total Volume</th>
                  <th className="py-2.5 px-3 text-right">Total Spend</th>
                  <th className="py-2.5 px-3 text-right">Weighted Avg Price</th>
                  <th className="py-2.5 px-3 text-right">Lowest Paid</th>
                  <th className="py-2.5 px-3 text-right">Highest Paid</th>
                  <th className="py-2.5 px-3 text-right">Current Tracked Rate</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {materialsComparativeSummary.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      No raw material purchase data available for the selected filters.
                    </td>
                  </tr>
                ) : (
                  materialsComparativeSummary.map(m => {
                    const weightedAvg = m.totalQty > 0 ? m.totalSpent / m.totalQty : m.minPrice;
                    return (
                      <tr key={m.materialId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{m.materialName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({m.unit})</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                          {m.purchaseCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          {formatQuantity(m.totalQty, m.unit)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-200">
                          {formatPKR(m.totalSpent)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatPKR(weightedAvg)} <span className="text-[10px] text-slate-500">/{m.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-300">
                          <div>{formatPKR(m.minPrice)}</div>
                          <div className="text-[9px] text-slate-500 truncate max-w-[120px] ml-auto">{m.minSupplier}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                          <div>{formatPKR(m.maxPrice)}</div>
                          <div className="text-[9px] text-slate-500 truncate max-w-[120px] ml-auto">{m.maxSupplier}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300">
                          {formatPKR(m.currentRate)} <span className="text-[10px] text-slate-500">/{m.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedMaterialFilter(m.materialId);
                              setActiveSubTab('log');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 transition-colors inline-flex items-center gap-1"
                          >
                            <span>Filter</span>
                            <ChevronRight className="w-3 h-3" />
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
    </div>
  );
};
