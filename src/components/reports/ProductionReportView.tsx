import React, { useState } from 'react';
import {
  Factory,
  Search,
  Calendar,
  Filter,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Layers,
  Sparkles,
  BarChart3,
  BadgeAlert,
  AlertTriangle,
  Package,
  ArrowUpRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatPKR, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/batchNumber';
import { Badge } from '../common/Badge';

interface ProductionReportViewProps {
  embedded?: boolean;
}

export const ProductionReportView: React.FC<ProductionReportViewProps> = ({ embedded = false }) => {
  const { productionBatches, products, rawMaterials } = useApp();

  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState('all');
  const [batchSearch, setBatchSearch] = useState('');
  const [productionSubView, setProductionSubView] = useState<'batch' | 'period' | 'raw_materials'>('batch');
  const [periodGrouping, setPeriodGrouping] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

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

  // Date Range Checker
  const isDateInRange = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    const batchDateStr = dateStr.slice(0, 10);
    if (startDate && batchDateStr < startDate) return false;
    if (endDate && batchDateStr > endDate) return false;
    return true;
  };

  // Filtered Production Batches
  const filteredBatches = (productionBatches || []).filter(batch => {
    if (!isDateInRange(batch.date)) return false;
    if (selectedProductFilter !== 'all' && batch.product_id !== selectedProductFilter && batch.product_name !== selectedProductFilter) {
      return false;
    }
    if (batchSearch.trim()) {
      const q = batchSearch.trim().toLowerCase();
      const matchNum = batch.batch_number?.toLowerCase().includes(q);
      const matchProd = batch.product_name?.toLowerCase().includes(q);
      const matchSup = batch.supervisor_name?.toLowerCase().includes(q);
      if (!matchNum && !matchProd && !matchSup) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalBatchesRun = filteredBatches.length;
  const totalQuantityProduced = filteredBatches.reduce((acc, b) => acc + Number(b.quantity_produced || 0), 0);
  const totalProductionCost = filteredBatches.reduce((acc, b) => acc + Number(b.total_batch_cost || 0), 0);
  const avgCostPerUnit = totalQuantityProduced > 0 ? (totalProductionCost / totalQuantityProduced) : 0;

  // Period Summaries (Grouped by Day, Week, or Month)
  const periodSummaryMap: Record<string, {
    periodKey: string;
    periodLabel: string;
    productId: string;
    productName: string;
    baseUnit: string;
    batchCount: number;
    totalQuantity: number;
    totalCost: number;
  }> = {};

  filteredBatches.forEach(batch => {
    const d = new Date(batch.date);
    let pKey = '';
    let pLabel = '';

    if (periodGrouping === 'daily') {
      pKey = batch.date.slice(0, 10);
      pLabel = formatDate(batch.date);
    } else if (periodGrouping === 'weekly') {
      const year = d.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const pastDays = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNo = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
      pKey = `${year}-W${String(weekNo).padStart(2, '0')}`;
      pLabel = `Week ${weekNo}, ${year}`;
    } else {
      pKey = batch.date.slice(0, 7);
      pLabel = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    }

    const prodId = batch.product_id || batch.product_name;
    const compoundKey = `${pKey}___${prodId}`;

    if (!periodSummaryMap[compoundKey]) {
      periodSummaryMap[compoundKey] = {
        periodKey: pKey,
        periodLabel: pLabel,
        productId: prodId,
        productName: batch.product_name,
        baseUnit: batch.base_unit || 'liter',
        batchCount: 0,
        totalQuantity: 0,
        totalCost: 0,
      };
    }

    periodSummaryMap[compoundKey].batchCount += 1;
    periodSummaryMap[compoundKey].totalQuantity += Number(batch.quantity_produced || 0);
    periodSummaryMap[compoundKey].totalCost += Number(batch.total_batch_cost || 0);
  });

  const periodSummaryRows = Object.values(periodSummaryMap).sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  // Visual Trend Data (Grouped chronologically ascending by period)
  const trendMap: Record<string, { periodKey: string; periodLabel: string; totalQuantity: number; totalCost: number; batchCount: number }> = {};
  periodSummaryRows.forEach(row => {
    if (!trendMap[row.periodKey]) {
      trendMap[row.periodKey] = {
        periodKey: row.periodKey,
        periodLabel: row.periodLabel,
        totalQuantity: 0,
        totalCost: 0,
        batchCount: 0
      };
    }
    trendMap[row.periodKey].totalQuantity += row.totalQuantity;
    trendMap[row.periodKey].totalCost += row.totalCost;
    trendMap[row.periodKey].batchCount += row.batchCount;
  });

  const trendBars = Object.values(trendMap).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  const maxTrendQuantity = trendBars.reduce((max, t) => Math.max(max, t.totalQuantity), 0) || 1;

  // Raw Material Consumption Aggregation
  const rmConsumptionMap: Record<string, {
    id: string;
    name: string;
    category: string;
    unit: string;
    totalQuantity: number;
    totalCost: number;
    batchCount: number;
    currentStock: number;
    reorderLevel: number;
    isLowStock: boolean;
  }> = {};

  filteredBatches.forEach(batch => {
    (batch.raw_materials_consumed || []).forEach(item => {
      const rmId = item.raw_material_id || item.raw_material_name;
      if (!rmConsumptionMap[rmId]) {
        const masterRm = rawMaterials.find(r => r.id === item.raw_material_id || r.name.toLowerCase() === item.raw_material_name.toLowerCase());
        const currentStock = masterRm ? Number(masterRm.current_stock) : 0;
        const reorderLevel = masterRm ? Number(masterRm.reorder_level) : 0;
        rmConsumptionMap[rmId] = {
          id: rmId,
          name: item.raw_material_name,
          category: masterRm?.category || 'Chemical Material',
          unit: masterRm?.unit || item.unit || 'pcs',
          totalQuantity: 0,
          totalCost: 0,
          batchCount: 0,
          currentStock,
          reorderLevel,
          isLowStock: currentStock <= reorderLevel
        };
      }
      rmConsumptionMap[rmId].totalQuantity += Number(item.quantity_consumed || 0);
      rmConsumptionMap[rmId].totalCost += Number(item.total_cost || 0);
      rmConsumptionMap[rmId].batchCount += 1;
    });
  });

  const sortedRawMaterialConsumptions = Object.values(rmConsumptionMap).sort((a, b) => b.totalCost - a.totalCost);

  // CSV Export Handler
  const handleExportCSV = () => {
    const dateRangeLabel = `${startDate || 'all'}_to_${endDate || 'today'}`;

    if (productionSubView === 'batch') {
      const headers = [
        'Batch Number',
        'Date',
        'Chemical Product',
        'Recipe Scale',
        'Actual Output Produced',
        'Base Unit',
        'Total Batch Cost (PKR)',
        'Cost Per Unit (PKR)',
        'Plant Supervisor',
        'Raw Materials Consumed Breakdown',
        'Notes'
      ];
      const rows = filteredBatches.map(b => [
        b.batch_number,
        b.date.slice(0, 10),
        b.product_name,
        b.formulation_batch_size !== undefined ? b.formulation_batch_size : b.quantity_produced,
        b.quantity_produced,
        b.base_unit,
        b.total_batch_cost,
        b.cost_per_base_unit,
        b.supervisor_name || '',
        (b.raw_materials_consumed || []).map(m => `${m.raw_material_name}: ${m.quantity_consumed} ${m.unit} @ PKR ${m.unit_cost}`).join('; '),
        b.notes || ''
      ]);
      exportToCSV(`PSC_Production_Batches_${dateRangeLabel}`, headers, rows);
    } else if (productionSubView === 'period') {
      const headers = [
        'Period Interval',
        'Chemical Product',
        'Batches Run',
        'Total Output Produced',
        'Base Unit',
        'Total Raw Material Cost (PKR)',
        'Average Cost Per Unit (PKR)'
      ];
      const rows = periodSummaryRows.map(p => [
        p.periodLabel,
        p.productName,
        p.batchCount,
        p.totalQuantity,
        p.baseUnit,
        p.totalCost,
        p.totalQuantity > 0 ? Number((p.totalCost / p.totalQuantity).toFixed(2)) : 0
      ]);
      exportToCSV(`PSC_Production_Period_Summary_${periodGrouping}_${dateRangeLabel}`, headers, rows);
    } else {
      const headers = [
        'Raw Material Name',
        'Category',
        'Total Consumed',
        'Unit',
        'Total Cost (PKR)',
        'Avg Cost/Unit (PKR)',
        'Batches Used Count',
        'Warehouse Stock',
        'Reorder Threshold',
        'Inventory Status'
      ];
      const rows = sortedRawMaterialConsumptions.map(rm => [
        rm.name,
        rm.category,
        rm.totalQuantity,
        rm.unit,
        rm.totalCost,
        rm.totalQuantity > 0 ? Number((rm.totalCost / rm.totalQuantity).toFixed(2)) : 0,
        rm.batchCount,
        rm.currentStock,
        rm.reorderLevel,
        rm.isLowStock ? 'LOW STOCK - REORDER' : 'SUFFICIENT'
      ]);
      exportToCSV(`PSC_Raw_Material_Consumption_${dateRangeLabel}`, headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Production Batches Report</h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {totalBatchesRun} Batches
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manufacturing output analysis, per-batch raw material consumption, cost per base unit & period aggregations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            title="Download report data as CSV file"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            title="Print Production Batches Report"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter & Sub-View Switcher Toolbar */}
      <div className="no-print p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Row 1: Date Range Presets and Custom Inputs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-bold uppercase mr-1">Period:</span>
            <button
              onClick={() => handleQuickDate('today')}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => handleQuickDate('this_week')}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              This Week
            </button>
            <button
              onClick={() => handleQuickDate('this_month')}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => handleQuickDate('this_year')}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              This Year
            </button>
            <button
              onClick={() => handleQuickDate('all')}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              All Time
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Product Filter, Search, and View Switcher */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-800/80">
          {/* Product Filter */}
          <div className="md:col-span-4">
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
            >
              <option value="all">All Manufactured Products ({products.length})</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku || 'No SKU'})
                </option>
              ))}
            </select>
          </div>

          {/* Batch Search */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
              placeholder="Search by Batch # (e.g. DW-D1-Batch1) or Supervisor..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Sub-View Switcher Tabs */}
          <div className="md:col-span-4 flex items-center justify-end">
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
              <button
                onClick={() => setProductionSubView('batch')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  productionSubView === 'batch'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Batch-Wise
              </button>
              <button
                onClick={() => setProductionSubView('period')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  productionSubView === 'period'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Period Summary
              </button>
              <button
                onClick={() => setProductionSubView('raw_materials')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  productionSubView === 'raw_materials'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                RM Consumption
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase text-slate-400">Total Batches Run</span>
            <Factory className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {totalBatchesRun}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across selected date filter</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase text-slate-400">Total Output Produced</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {totalQuantityProduced.toLocaleString('en-PK')} <span className="text-sm font-normal text-slate-400">L/kg</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Finished chemical base volume</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase text-slate-400">Total Batch Cost</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {formatPKR(totalProductionCost)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total raw material expenditure</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase text-slate-400">Avg Cost / Unit</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {formatPKR(avgCostPerUnit)} <span className="text-xs font-normal text-slate-400">/unit</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Raw material cost per liter/kg</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: BATCH-WISE VIEW */}
      {/* ========================================================================= */}
      {productionSubView === 'batch' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Factory className="w-4 h-4 text-emerald-400" />
              <span>Batch-Wise Production Logs & Raw Material Breakdown</span>
            </h3>
            <span className="text-xs text-slate-400">
              Showing {filteredBatches.length} production runs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Batch Number</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Product Manufactured</th>
                  <th className="py-3 px-3 text-right">Output Produced</th>
                  <th className="py-3 px-3 text-right">Total RM Cost</th>
                  <th className="py-3 px-3 text-right">Cost / Unit</th>
                  <th className="py-3 px-3">Plant Supervisor</th>
                  <th className="py-3 px-3 text-center">BOM Materials</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No production batches found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map(batch => {
                    const isExpanded = expandedBatchId === batch.id;
                    const matCount = batch.raw_materials_consumed?.length || 0;
                    return (
                      <React.Fragment key={batch.id}>
                        <tr className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                            {batch.batch_number}
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-medium">
                            {formatDate(batch.date)}
                          </td>
                          <td className="py-3 px-3 font-bold text-white">
                            {batch.product_name}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white">
                            {batch.quantity_produced} <span className="text-[11px] font-normal text-slate-400">{batch.base_unit}</span>
                            {batch.formulation_batch_size !== undefined && Number(batch.formulation_batch_size) !== Number(batch.quantity_produced) && (
                              <div className="text-[10px] font-normal text-slate-400 font-mono">
                                Recipe: {batch.formulation_batch_size} {batch.base_unit}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                            {formatPKR(batch.total_batch_cost)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatPKR(batch.cost_per_base_unit)}/{batch.base_unit}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {batch.supervisor_name || 'Plant Staff'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                isExpanded
                                  ? 'bg-emerald-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                              title="Toggle ingredient consumption breakdown"
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              <span>{matCount} Materials</span>
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Consumed Raw Materials Sub-Table */}
                        {isExpanded && (
                          <tr className="bg-slate-950/60">
                            <td colSpan={8} className="p-4 border-y border-slate-800">
                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                                  <span className="font-bold text-slate-300 uppercase flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Raw Materials Consumed in Batch {batch.batch_number}</span>
                                  </span>
                                  {batch.notes && (
                                    <span className="text-slate-400 italic text-[11px]">
                                      Note: {batch.notes}
                                    </span>
                                  )}
                                </div>

                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-slate-400 text-[10px] uppercase border-b border-slate-800/80">
                                      <th className="py-1.5 px-2">Raw Material</th>
                                      <th className="py-1.5 px-2 text-right">Quantity Consumed</th>
                                      <th className="py-1.5 px-2 text-right">Unit Rate</th>
                                      <th className="py-1.5 px-2 text-right">Total Ingredient Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/40">
                                    {(!batch.raw_materials_consumed || batch.raw_materials_consumed.length === 0) ? (
                                      <tr>
                                        <td colSpan={4} className="py-3 text-center text-slate-500">
                                          No individual raw material breakdown recorded for this batch.
                                        </td>
                                      </tr>
                                    ) : (
                                      batch.raw_materials_consumed.map((rm, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/30">
                                          <td className="py-2 px-2 font-medium text-slate-200">
                                            {rm.raw_material_name}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono font-bold text-rose-400">
                                            -{rm.quantity_consumed} {rm.unit}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono text-slate-400">
                                            {formatPKR(rm.unit_cost)}/{rm.unit}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono font-semibold text-white">
                                            {formatPKR(rm.total_cost)}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t border-slate-800 font-bold">
                                      <td colSpan={3} className="py-2 px-2 text-right text-slate-400 uppercase text-[10px]">
                                        Total Batch Ingredient Cost:
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono text-emerald-400">
                                        {formatPKR(batch.total_batch_cost)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {filteredBatches.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-700 font-bold bg-slate-950/40 text-xs">
                    <td colSpan={3} className="py-3 px-3 text-white uppercase text-[11px]">Period Totals</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400">
                      {totalQuantityProduced.toLocaleString('en-PK')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-400">
                      {formatPKR(totalProductionCost)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400">
                      {formatPKR(avgCostPerUnit)}/avg
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: PERIOD SUMMARY VIEW (Day / Week / Month) */}
      {/* ========================================================================= */}
      {productionSubView === 'period' && (
        <div className="space-y-6">
          {/* Trend Bar Chart */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>Production Output Trend ({periodGrouping.toUpperCase()})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Output volume distribution across intervals
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setPeriodGrouping('daily')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    periodGrouping === 'daily' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setPeriodGrouping('weekly')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    periodGrouping === 'weekly' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setPeriodGrouping('monthly')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    periodGrouping === 'monthly' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            {trendBars.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No production batches recorded in this time range to display trend.
              </div>
            ) : (
              <div className="pt-4">
                <div className="flex items-end gap-3 h-48 overflow-x-auto pb-6 pt-2">
                  {trendBars.map(t => {
                    const heightPercent = Math.max(8, Math.round((t.totalQuantity / maxTrendQuantity) * 100));
                    return (
                      <div key={t.periodKey} className="flex flex-col items-center flex-1 min-w-[56px] group">
                        <div className="text-[10px] font-mono font-bold text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1 whitespace-nowrap">
                          {t.totalQuantity} L/kg
                        </div>
                        <div className="w-full bg-slate-800/80 rounded-t-lg h-36 flex items-end p-1 relative">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-md transition-all group-hover:from-emerald-500 group-hover:to-teal-300"
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 mt-2 truncate w-full text-center">
                          {t.periodLabel}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">
                          {t.batchCount} {t.batchCount === 1 ? 'run' : 'runs'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Period Summary Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Period Aggregation Breakdown Table
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Period ({periodGrouping})</th>
                    <th className="py-3 px-3">Product Name</th>
                    <th className="py-3 px-3 text-center">Batches Run</th>
                    <th className="py-3 px-3 text-right">Total Output</th>
                    <th className="py-3 px-3 text-right">Total RM Spend</th>
                    <th className="py-3 px-3 text-right">Average Cost / Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {periodSummaryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No batch data available for the selected period filter.
                      </td>
                    </tr>
                  ) : (
                    periodSummaryRows.map((p, idx) => {
                      const avgUnitCost = p.totalQuantity > 0 ? (p.totalCost / p.totalQuantity) : 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-semibold text-white">{p.periodLabel}</td>
                          <td className="py-3 px-3 text-slate-200">{p.productName}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">{p.batchCount}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white">
                            {p.totalQuantity} <span className="text-[11px] font-normal text-slate-400">{p.baseUnit}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                            {formatPKR(p.totalCost)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatPKR(avgUnitCost)}/{p.baseUnit}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: RAW MATERIAL CONSUMPTION SUMMARY */}
      {/* ========================================================================= */}
      {productionSubView === 'raw_materials' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Raw Material Factory Consumption & Inventory Balance</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total ingredients consumed in manufacturing across filtered batches vs current stock levels
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {sortedRawMaterialConsumptions.length} materials utilized
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Raw Material</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Total Consumed</th>
                  <th className="py-3 px-3 text-right">Total Cost</th>
                  <th className="py-3 px-3 text-right">Avg Unit Cost</th>
                  <th className="py-3 px-3 text-center">Batches Used</th>
                  <th className="py-3 px-3 text-right">Current Stock</th>
                  <th className="py-3 px-3 text-right">Reorder Threshold</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedRawMaterialConsumptions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      No raw material consumption recorded for the selected filter range.
                    </td>
                  </tr>
                ) : (
                  sortedRawMaterialConsumptions.map(rm => {
                    const avgCost = rm.totalQuantity > 0 ? (rm.totalCost / rm.totalQuantity) : 0;
                    return (
                      <tr key={rm.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-bold text-white text-sm">{rm.name}</td>
                        <td className="py-3 px-3 text-slate-400">{rm.category}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">
                          {rm.totalQuantity} <span className="text-[11px] font-normal text-slate-400">{rm.unit}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                          {formatPKR(rm.totalCost)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {formatPKR(avgCost)}/{rm.unit}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">
                          {rm.batchCount}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">
                          {rm.currentStock} <span className="text-[10px] text-slate-400">{rm.unit}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {rm.reorderLevel} <span className="text-[10px] text-slate-500">{rm.unit}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {rm.isLowStock ? (
                            <Badge variant="rose">Reorder Alert</Badge>
                          ) : (
                            <Badge variant="emerald">In Stock</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {sortedRawMaterialConsumptions.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-700 font-bold bg-slate-950/40 text-xs">
                    <td colSpan={3} className="py-3 px-3 text-white uppercase text-[11px]">Total Raw Material Spend</td>
                    <td className="py-3 px-3 text-right font-mono text-amber-400">
                      {formatPKR(totalProductionCost)}
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
