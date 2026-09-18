import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Users, 
  Truck, 
  FileText, 
  Calendar,
  Layers,
  ArrowUpRight,
  ShoppingCart,
  Filter,
  Printer,
  Download,
  Factory,
  ChevronDown,
  ChevronUp,
  Search,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatPKR, formatDate, getTodayDateString } from '../../utils/formatters';
import { getRateDifferenceInfo, RateDifferenceInfo } from '../../utils/pricing';
import { exportToCSV } from '../../utils/batchNumber';
import { Badge } from '../common/Badge';
import { Sale, ProductionBatch, ConsumedRawMaterial } from '../../types';
import { ProductionReportView } from './ProductionReportView';

export type ReportType = 'sales' | 'purchases' | 'profit' | 'production' | 'receivables' | 'payables' | 'valuation';

interface ReportsModuleProps {
  initialReport?: ReportType;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ initialReport = 'sales' }) => {
  const { 
    sales, 
    purchases, 
    products, 
    customers, 
    suppliers, 
    expenses,
    productionBatches,
    rawMaterials
  } = useApp();
  const { isOwner, allUsers } = useAuth();

  const [activeReport, setActiveReport] = useState<ReportType>(initialReport);

  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');

  // Production Report Sub-View States
  const [productionSubView, setProductionSubView] = useState<'batch' | 'period' | 'raw_materials'>('batch');
  const [periodGrouping, setPeriodGrouping] = useState<'day' | 'week' | 'month'>('day');
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>('');
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  const toggleBatchExpanded = (id: string) => {
    setExpandedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Dynamically resolve staff member name from profiles
  const getStaffNameForSale = (s: Sale) => {
    if (s.salesperson_id) {
      const match = allUsers.find(u => u.id === s.salesperson_id);
      if (match) return match.name;
    }
    return s.salesperson_name || 'Staff';
  };

  // Date filtering helper
  const isDateInRange = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    const d = new Date(dateStr);
    if (startDate && d < new Date(startDate + 'T00:00:00')) return false;
    if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
    return true;
  };

  // Quick date ranges
  const handleSetQuickDate = (type: 'today' | 'this_month' | 'all') => {
    const today = new Date();
    if (type === 'today') {
      const formatted = getTodayDateString();
      setStartDate(formatted);
      setEndDate(formatted);
    } else if (type === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // ================= 1. SALES REPORT DATA =================
  const filteredSales = sales.filter(s => {
    const dateMatch = isDateInRange(s.date);
    const customerMatch = selectedCustomerFilter === 'all' || s.customer_id === selectedCustomerFilter;
    const productMatch = selectedProductFilter === 'all' || s.items.some(i => i.product_id === selectedProductFilter);
    return dateMatch && customerMatch && productMatch;
  });

  const totalSalesRevenue = filteredSales.reduce((acc, s) => acc + s.total_amount, 0);
  const totalSalesPaid = filteredSales.reduce((acc, s) => acc + s.amount_paid, 0);
  
  let totalSalesUnits = 0;
  const salesItemizedRows: {
    invoiceNo: string;
    date: string;
    customer: string;
    soldBy: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    rateInfo: RateDifferenceInfo;
  }[] = [];

  filteredSales.forEach(s => {
    s.items.forEach(item => {
      if (selectedProductFilter === 'all' || item.product_id === selectedProductFilter) {
        totalSalesUnits += item.quantity;
        const rateInfo = getRateDifferenceInfo(item, products);
        salesItemizedRows.push({
          invoiceNo: s.invoice_number,
          date: s.date,
          customer: s.customer_name,
          soldBy: getStaffNameForSale(s),
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.subtotal,
          rateInfo,
        });
      }
    });
  });

  // ================= 2. PURCHASE REPORT DATA =================
  const filteredPurchases = purchases.filter(p => {
    const dateMatch = isDateInRange(p.date);
    const supplierMatch = selectedSupplierFilter === 'all' || p.supplier_id === selectedSupplierFilter;
    return dateMatch && supplierMatch;
  });

  const totalPurchaseSpend = filteredPurchases.reduce((acc, p) => acc + p.total_amount, 0);
  const totalPurchasePaid = filteredPurchases.reduce((acc, p) => acc + p.amount_paid, 0);

  // ================= 3. PROFIT & LOSS REPORT DATA =================
  let profitRevenue = 0;
  let profitCOGS = 0;
  const productProfitMap: { [key: string]: { name: string; qtySold: number; revenue: number; cost: number; profit: number } } = {};

  filteredSales.forEach(sale => {
    profitRevenue += sale.total_amount;
    sale.items.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitCost = Number(item.unit_cost) > 0 
        ? Number(item.unit_cost) 
        : (prod ? Number(prod.cost_price || 0) * (item.size_in_base_unit || 1) : 0);
      const itemCost = unitCost * item.quantity;
      profitCOGS += itemCost;

      if (!productProfitMap[item.product_name]) {
        productProfitMap[item.product_name] = {
          name: item.product_name,
          qtySold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }

      productProfitMap[item.product_name].qtySold += item.quantity;
      productProfitMap[item.product_name].revenue += item.subtotal;
      productProfitMap[item.product_name].cost += itemCost;
      productProfitMap[item.product_name].profit += (item.subtotal - itemCost);
    });
  });

  const estimatedGrossProfit = profitRevenue - profitCOGS;
  const grossMarginPercent = profitRevenue > 0 ? ((estimatedGrossProfit / profitRevenue) * 100).toFixed(1) : '0';

  // Filter Operating Expenses in selected timeframe
  const filteredOperatingExpenses = expenses.filter(e => isDateInRange(e.date));
  const totalOperatingExpenses = filteredOperatingExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  // Group Operating Expenses by Category
  const expensesByCategoryMap: Record<string, { category: string; amount: number; count: number }> = {};
  filteredOperatingExpenses.forEach(e => {
    const cat = e.category || 'Other';
    if (!expensesByCategoryMap[cat]) {
      expensesByCategoryMap[cat] = { category: cat, amount: 0, count: 0 };
    }
    expensesByCategoryMap[cat].amount += Number(e.amount || 0);
    expensesByCategoryMap[cat].count += 1;
  });
  const sortedExpenseCategories = Object.values(expensesByCategoryMap).sort((a, b) => b.amount - a.amount);

  // NET PROFIT = Gross Profit - Operating Expenses
  const netProfit = estimatedGrossProfit - totalOperatingExpenses;
  const netMarginPercent = profitRevenue > 0 ? ((netProfit / profitRevenue) * 100).toFixed(1) : '0';


  // ================= 4. RECEIVABLES REPORT DATA =================
  const sortedDebtors = [...customers]
    .filter(c => (c.current_balance || 0) > 0)
    .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));
  const totalReceivables = sortedDebtors.reduce((acc, c) => acc + c.current_balance, 0);

  // ================= 5. PAYABLES REPORT DATA =================
  const sortedCreditors = [...suppliers]
    .filter(s => (s.current_balance || 0) > 0)
    .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));
  const totalPayables = sortedCreditors.reduce((acc, s) => acc + s.current_balance, 0);

  // ================= 6. STOCK VALUATION DATA =================
  const totalStockCostValue = products.reduce((acc, p) => acc + (p.current_stock * p.cost_price), 0);
  const totalStockRetailValue = products.reduce((acc, p) => acc + (p.current_stock * p.selling_price), 0);
  const unrealizedStockProfit = totalStockRetailValue - totalStockCostValue;
  const totalRawValuation = rawMaterials.reduce((acc, rm) => acc + (Number(rm.current_stock || 0) * Number(rm.cost_per_unit || 0)), 0);
  const totalCombinedValuation = totalStockCostValue + totalRawValuation;

  // ================= 6. PRODUCTION BATCHES REPORT DATA =================
  const filteredProductionBatches = productionBatches.filter(b => {
    const dateMatch = isDateInRange(b.date);
    const productMatch = selectedProductFilter === 'all' || b.product_id === selectedProductFilter;
    const searchMatch = !batchSearchTerm.trim() || 
      b.batch_number.toLowerCase().includes(batchSearchTerm.toLowerCase().trim()) ||
      b.product_name.toLowerCase().includes(batchSearchTerm.toLowerCase().trim()) ||
      (b.supervisor_name && b.supervisor_name.toLowerCase().includes(batchSearchTerm.toLowerCase().trim()));
    return dateMatch && productMatch && searchMatch;
  });

  const totalBatchesRun = filteredProductionBatches.length;
  const totalQuantityProduced = filteredProductionBatches.reduce((acc, b) => acc + Number(b.quantity_produced || 0), 0);
  const totalProductionCost = filteredProductionBatches.reduce((acc, b) => acc + Number(b.total_batch_cost || 0), 0);
  const averageCostPerUnit = totalQuantityProduced > 0 ? (totalProductionCost / totalQuantityProduced) : 0;

  // Period Summary Aggregation (Day / Week / Month)
  const periodSummaryMap: Record<string, {
    periodKey: string;
    periodLabel: string;
    productId: string;
    productName: string;
    baseUnit: string;
    batchCount: number;
    totalQuantity: number;
    totalCost: number;
    batches: ProductionBatch[];
  }> = {};

  filteredProductionBatches.forEach(batch => {
    const d = new Date(batch.date);
    let pKey = '';
    let pLabel = '';

    if (periodGrouping === 'day') {
      pKey = batch.date.slice(0, 10);
      pLabel = formatDate(batch.date);
    } else if (periodGrouping === 'week') {
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
        batches: []
      };
    }

    periodSummaryMap[compoundKey].batchCount += 1;
    periodSummaryMap[compoundKey].totalQuantity += Number(batch.quantity_produced || 0);
    periodSummaryMap[compoundKey].totalCost += Number(batch.total_batch_cost || 0);
    periodSummaryMap[compoundKey].batches.push(batch);
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
  const trendList = Object.values(trendMap).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  const maxTrendVolume = Math.max(1, ...trendList.map(t => t.totalQuantity));

  // Raw Material Consumption Aggregation across filtered batches
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

  filteredProductionBatches.forEach(batch => {
    const consumed = batch.raw_materials_consumed || [];
    consumed.forEach(item => {
      const rmId = item.raw_material_id || item.raw_material_name;
      if (!rmConsumptionMap[rmId]) {
        const masterRm = rawMaterials.find(m => m.id === item.raw_material_id || m.name.toLowerCase() === item.raw_material_name.toLowerCase());
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

    if (activeReport === 'production') {
      if (productionSubView === 'batch') {
        const headers = [
          'Batch Number',
          'Date',
          'Chemical Product',
          'Quantity Produced',
          'Base Unit',
          'Total Batch Cost (PKR)',
          'Cost Per Unit (PKR)',
          'Plant Supervisor',
          'Raw Materials Consumed Breakdown',
          'Notes'
        ];
        const rows = filteredProductionBatches.map(b => [
          b.batch_number,
          b.date.slice(0, 10),
          b.product_name,
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
      } else if (productionSubView === 'raw_materials') {
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
    } else if (activeReport === 'sales') {
      const headers = ['Invoice No', 'Date', 'Customer', 'Sold By', 'Product', 'Quantity', 'Unit Price (PKR)', 'Subtotal (PKR)'];
      const rows = salesItemizedRows.map(r => [r.invoiceNo, r.date.slice(0, 10), r.customer, r.soldBy, r.productName, r.quantity, r.unitPrice, r.subtotal]);
      exportToCSV(`PSC_Sales_Report_${dateRangeLabel}`, headers, rows);
    } else if (activeReport === 'purchases') {
      const headers = ['PO / Invoice No', 'Date', 'Supplier', 'Payment Status', 'Payment Method', 'Total Amount (PKR)', 'Amount Paid (PKR)'];
      const rows = filteredPurchases.map(p => [p.invoice_number, p.date.slice(0, 10), p.supplier_name, p.payment_status, p.payment_method, p.total_amount, p.amount_paid]);
      exportToCSV(`PSC_Purchases_Report_${dateRangeLabel}`, headers, rows);
    } else if (activeReport === 'valuation') {
      const headers = ['Item Type', 'Item Name', 'Category', 'Stock Unit', 'In-Stock Quantity', 'Cost Rate (PKR)', 'Selling Rate (PKR)', 'Cost Valuation (PKR)', 'Retail Valuation (PKR)'];
      const productRows = products.map(p => [
        'Finished Product',
        p.name,
        p.category || 'Finished Good',
        p.unit,
        p.current_stock,
        p.cost_price,
        p.selling_price,
        p.current_stock * p.cost_price,
        p.current_stock * p.selling_price
      ]);
      const rmRows = rawMaterials.map(rm => [
        'Raw Material / Packaging',
        rm.name,
        rm.category,
        rm.unit,
        rm.current_stock,
        rm.cost_per_unit,
        '-',
        rm.current_stock * rm.cost_per_unit,
        '-'
      ]);
      exportToCSV(`PSC_Stock_Valuation_${dateRangeLabel}`, headers, [...productRows, ...rmRows]);
    }
  };

  const getReportTitle = (type: ReportType) => {
    switch (type) {
      case 'sales': return 'Sales & Revenue Report';
      case 'purchases': return 'Purchases & Procurement Report';
      case 'profit': return 'Profit & Loss (P&L) Statement';
      case 'production':
        if (productionSubView === 'period') return `Production Period Summary (${periodGrouping.toUpperCase()})`;
        if (productionSubView === 'raw_materials') return 'Raw Material Consumption Audit Report';
        return 'Chemical Production Batches Report';
      case 'receivables': return 'Outstanding Receivables Report';
      case 'payables': return 'Outstanding Payables Report';
      case 'valuation': return 'Stock Asset Valuation Report';
      default: return 'Financial & Analytical Report';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Screen Header (Hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3.5">
          <img 
            src="/assets/logo.png" 
            alt="Perfect Shine Chemicals" 
            className="w-12 h-12 object-contain shrink-0 drop-shadow" 
          />
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <span>Financial & Analytical Intelligence</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore • Phone: <span className="font-mono text-slate-300">0327-4549485</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors w-fit"
            title="Download report data as CSV file"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors w-fit"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs for All 6 Reports (Hidden during print) */}
      <div className="no-print flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          onClick={() => setActiveReport('sales')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'sales' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Sales Report</span>
        </button>

        <button
          onClick={() => setActiveReport('purchases')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'purchases' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Purchase Report</span>
        </button>

        <button
          onClick={() => setActiveReport('profit')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'profit' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Profit & Loss (P&L)</span>
        </button>

        <button
          onClick={() => setActiveReport('production')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'production' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Factory className="w-4 h-4" />
          <span>Production Batches</span>
        </button>

        <button
          onClick={() => setActiveReport('receivables')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'receivables' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Outstanding Receivables</span>
        </button>

        <button
          onClick={() => setActiveReport('payables')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'payables' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2Icon className="w-4 h-4" />
          <span>Outstanding Payables</span>
        </button>

        <button
          onClick={() => setActiveReport('valuation')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReport === 'valuation' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Stock Valuation</span>
        </button>
      </div>

      {/* Filter Toolbar (Active for Sales, Purchases, Profit, Production) */}
      {(activeReport === 'sales' || activeReport === 'purchases' || activeReport === 'profit' || activeReport === 'production') && (
        <div className="no-print p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>

            {/* Quick date range presets */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSetQuickDate('today')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => handleSetQuickDate('this_month')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                This Month
              </button>
              <button
                onClick={() => handleSetQuickDate('all')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                All Time
              </button>
            </div>
          </div>

          {/* Module-specific entity filters */}
          <div className="flex flex-wrap items-center gap-2">
            {activeReport === 'sales' && (
              <>
                <select
                  value={selectedCustomerFilter}
                  onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="all">All Customers</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={selectedProductFilter}
                  onChange={(e) => setSelectedProductFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="all">All Products</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </>
            )}

            {activeReport === 'purchases' && (
              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            {activeReport === 'production' && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedProductFilter}
                  onChange={(e) => setSelectedProductFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="all">All Chemical Products</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search batch # or supervisor..."
                    value={batchSearchTerm}
                    onChange={(e) => setBatchSearchTerm(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-slate-500 text-xs w-52 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Sub-view switcher buttons */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setProductionSubView('batch')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      productionSubView === 'batch' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Batch-Wise
                  </button>
                  <button
                    onClick={() => setProductionSubView('period')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      productionSubView === 'period' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Period Summary
                  </button>
                  <button
                    onClick={() => setProductionSubView('raw_materials')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      productionSubView === 'raw_materials' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    RM Consumed
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Printable Report Area */}
      <div id="printable-report" className="space-y-6">
        {/* Printable Report Header (Visible when printed) */}
        <div className="hidden print:flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-4 mb-6 gap-4 text-slate-900">
          <div className="flex items-start gap-3.5">
            <img 
              src="/assets/logo.png" 
              alt="Perfect Shine Chemicals" 
              className="w-14 h-14 object-contain shrink-0" 
            />
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                PERFECT SHINE CHEMICALS
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Industrial & Commercial Cleaning Solutions Manufacturer
              </p>
              <p className="text-[11px] text-slate-500">
                Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore, Pakistan
              </p>
              <p className="text-xs text-slate-700 font-medium mt-0.5">
                Contact: <span className="font-mono font-bold text-slate-900">0327-4549485</span>
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider mb-1.5">
              {getReportTitle(activeReport)}
            </div>
            <p className="text-xs text-slate-600">
              Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            {(startDate || endDate) && (
              <p className="text-xs text-slate-600 font-medium">
                Filter: {startDate || 'Beginning'} &rarr; {endDate || 'Present'}
              </p>
            )}
          </div>
        </div>

      {/* ================= REPORT 1: SALES REPORT ================= */}
      {activeReport === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Total Sales Revenue</span>
              <p className="text-xl font-black text-emerald-400 mt-1 font-mono">{formatPKR(totalSalesRevenue)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{filteredSales.length} Orders Invoiced</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Total Quantity Sold</span>
              <p className="text-xl font-black text-white mt-1 font-mono">{totalSalesUnits} Units</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Across chemical catalog</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Cash Collected</span>
              <p className="text-xl font-black text-white mt-1 font-mono">{formatPKR(totalSalesPaid)}</p>
              <p className="text-[11px] text-emerald-400 mt-0.5">Cleared payments</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Uncollected Credit</span>
              <p className="text-xl font-black text-amber-400 mt-1 font-mono">{formatPKR(totalSalesRevenue - totalSalesPaid)}</p>
              <p className="text-[11px] text-amber-300 mt-0.5">Pending receivables</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Itemized Sales Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Sold By</th>
                    <th className="py-2.5 px-3">Product Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Rate</th>
                    <th className="py-2.5 px-3 text-right">Subtotal (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {salesItemizedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">No sales match the filter criteria</td>
                    </tr>
                  ) : (
                    salesItemizedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{formatDate(row.date)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{row.invoiceNo}</td>
                        <td className="py-2.5 px-3 text-slate-300">{row.customer}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-medium border border-slate-700/60 whitespace-nowrap">
                            {row.soldBy}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white">{row.productName}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-200">{row.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          <div className="flex items-center justify-end gap-1.5">
                            {row.rateInfo.isCustom && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  row.rateInfo.isDiscount ? 'bg-amber-400' : 'bg-indigo-400'
                                }`}
                                title={`${row.rateInfo.isDiscount ? 'Discounted Rate' : 'Premium Rate'} (Standard: ${formatPKR(row.rateInfo.standardPrice)})`}
                              />
                            )}
                            <span>{formatPKR(row.unitPrice)}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">{formatPKR(row.subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= REPORT 2: PURCHASE REPORT ================= */}
      {activeReport === 'purchases' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Total Spend on Raw Materials</span>
              <p className="text-xl font-black text-rose-400 mt-1 font-mono">{formatPKR(totalPurchaseSpend)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{filteredPurchases.length} Purchase Orders</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Paid Out to Suppliers</span>
              <p className="text-xl font-black text-white mt-1 font-mono">{formatPKR(totalPurchasePaid)}</p>
              <p className="text-[11px] text-emerald-400 mt-0.5">Disbursed funds</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Unpaid Supplier Dues</span>
              <p className="text-xl font-black text-rose-400 mt-1 font-mono">{formatPKR(totalPurchaseSpend - totalPurchasePaid)}</p>
              <p className="text-[11px] text-rose-300 mt-0.5">Accounts payable</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Purchase Orders Record</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">PO Number</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Materials Received</th>
                    <th className="py-2.5 px-3 text-right">Total Amount</th>
                    <th className="py-2.5 px-3 text-right">Amount Paid</th>
                    <th className="py-2.5 px-3 text-center">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">No purchases found for selected criteria</td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{formatDate(p.date)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{p.invoice_number}</td>
                        <td className="py-2.5 px-3 text-slate-200">{p.supplier_name}</td>
                        <td className="py-2.5 px-3 text-slate-300">{p.items.map(i => `${i.product_or_material_name} (${i.quantity})`).join(', ')}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{formatPKR(p.total_amount)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{formatPKR(p.amount_paid)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={p.payment_status === 'paid' ? 'emerald' : p.payment_status === 'partial' ? 'amber' : 'rose'}>
                            {p.payment_status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= REPORT 3: PROFIT & LOSS STATEMENT (P&L) ================= */}
      {activeReport === 'profit' && (
        <div className="space-y-6">
          {/* Executive P&L KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* 1. Revenue */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">1. Total Revenue</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">{formatPKR(profitRevenue)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{filteredSales.length} Sales Invoices</p>
            </div>

            {/* 2. COGS */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">2. Less: COGS</span>
              <p className="text-xl font-black text-slate-300 mt-1.5 font-mono">- {formatPKR(profitCOGS)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Raw chemicals & bottles</p>
            </div>

            {/* 3. Gross Profit */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">3. Gross Profit</span>
              <p className="text-xl font-black text-emerald-400 mt-1.5 font-mono">{formatPKR(estimatedGrossProfit)}</p>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">Margin: <strong>{grossMarginPercent}%</strong></p>
            </div>

            {/* 4. Operating Expenses */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">4. Less: Overheads</span>
              <p className="text-xl font-black text-rose-400 mt-1.5 font-mono">- {formatPKR(totalOperatingExpenses)}</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">{filteredOperatingExpenses.length} Expense items</p>
            </div>

            {/* 5. Net Profit */}
            <div className={`p-4 rounded-2xl border ${
              netProfit >= 0 
                ? 'bg-gradient-to-br from-emerald-950/80 to-slate-900 border-emerald-500/40' 
                : 'bg-gradient-to-br from-rose-950/80 to-slate-900 border-rose-500/40'
            }`}>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                5. Net Profit (Actual)
              </span>
              <p className={`text-xl font-black mt-1.5 font-mono ${
                netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {formatPKR(netProfit)}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Net Margin: <strong>{netMarginPercent}%</strong>
              </p>
            </div>
          </div>

          {/* Formal Income Statement Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Statement of Profit and Loss (Income Statement)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Accounting summary for Perfect Shine Chemicals manufacturing operations • Lahore
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 font-mono">
                  {startDate && endDate 
                    ? `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`
                    : 'Period: All Live Records'
                  }
                </span>
              </div>
            </div>

            {/* Structured Financial Breakdown */}
            <div className="space-y-4 text-xs">
              {/* SECTION A: REVENUE */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white uppercase tracking-wider text-[11px] bg-slate-800/60 p-2.5 rounded-xl">
                  <span>A. Operating Revenue (Sales Turnover)</span>
                  <span className="font-mono text-emerald-400 font-black">{formatPKR(profitRevenue)}</span>
                </div>
                <div className="px-4 py-1.5 flex items-center justify-between text-slate-400">
                  <span className="pl-3">• Gross Invoiced Billed Sales ({filteredSales.length} invoices)</span>
                  <span className="font-mono text-slate-300">{formatPKR(profitRevenue)}</span>
                </div>
              </div>

              {/* SECTION B: COST OF GOODS SOLD */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white uppercase tracking-wider text-[11px] bg-slate-800/60 p-2.5 rounded-xl">
                  <span>B. Cost of Goods Sold (COGS)</span>
                  <span className="font-mono text-rose-400 font-black">- {formatPKR(profitCOGS)}</span>
                </div>
                <div className="px-4 py-1.5 flex items-center justify-between text-slate-400">
                  <span className="pl-3">• Direct Chemical Raw Materials & Packaging Consumed</span>
                  <span className="font-mono text-slate-300">- {formatPKR(profitCOGS)}</span>
                </div>
              </div>

              {/* GROSS PROFIT SUB-TOTAL */}
              <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-white uppercase tracking-wider">Gross Operating Profit</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Gross Margin: {grossMarginPercent}%
                  </span>
                </div>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {formatPKR(estimatedGrossProfit)}
                </span>
              </div>

              {/* SECTION C: OPERATING OVERHEAD EXPENSES */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between font-bold text-white uppercase tracking-wider text-[11px] bg-slate-800/60 p-2.5 rounded-xl">
                  <span>C. Operating Overhead Expenses (Grouped by Category)</span>
                  <span className="font-mono text-rose-400 font-black">- {formatPKR(totalOperatingExpenses)}</span>
                </div>

                {sortedExpenseCategories.length === 0 ? (
                  <div className="px-4 py-3 text-slate-500 italic pl-6">
                    No operating overhead expenses recorded for this timeframe.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/40 pl-3">
                    {sortedExpenseCategories.map((item) => {
                      const pctOfExpenses = totalOperatingExpenses > 0 
                        ? ((item.amount / totalOperatingExpenses) * 100).toFixed(1) 
                        : '0';
                      return (
                        <div key={item.category} className="px-4 py-2 flex items-center justify-between text-slate-300 hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{item.category}</span>
                            <span className="text-[10px] text-slate-400">({item.count} recorded)</span>
                            <span className="text-[10px] text-slate-400">• {pctOfExpenses}% of overheads</span>
                          </div>
                          <span className="font-mono text-rose-400 font-semibold">
                            - {formatPKR(item.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* NET PROFIT FINAL TOTAL STATEMENT BANNER */}
              <div className={`p-5 rounded-2xl border flex items-center justify-between mt-6 ${
                netProfit >= 0 
                  ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-emerald-500/50 shadow-xl shadow-emerald-500/5' 
                  : 'bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border-rose-500/50 shadow-xl shadow-rose-500/5'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold uppercase tracking-wider text-white">
                      {netProfit >= 0 ? 'Net Operating Profit (After Expenses)' : 'Net Operating Loss'}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      netProfit >= 0 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      Net Margin: {netMarginPercent}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Calculated as: Total Revenue ({formatPKR(profitRevenue)}) − COGS ({formatPKR(profitCOGS)}) − Operating Overheads ({formatPKR(totalOperatingExpenses)})
                  </p>
                </div>

                <div className="text-right">
                  <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {formatPKR(netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Product Margin Contribution Breakdown */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <h3 className="text-sm font-bold text-white mb-3">
              Product-Level Gross Margin Contribution Breakdown <span className="text-xs font-normal text-slate-400">(Before Operating Overheads)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Chemical Product</th>
                    <th className="py-3 px-3 text-center">Units Sold</th>
                    <th className="py-3 px-3 text-right">Invoiced Revenue</th>
                    <th className="py-3 px-3 text-right">Production Cost (COGS)</th>
                    <th className="py-3 px-3 text-right">Gross Profit</th>
                    <th className="py-3 px-3 text-right">Gross Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Object.values(productProfitMap).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">No chemical product sales in the selected period</td>
                    </tr>
                  ) : (
                    Object.values(productProfitMap).map((item, idx) => {
                      const margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : '0';
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-bold text-white">{item.name}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-300">{item.qtySold}</td>
                          <td className="py-3 px-3 text-right font-mono text-white">{formatPKR(item.revenue)}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">{formatPKR(item.cost)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{formatPKR(item.profit)}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-300">{margin}%</td>
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

      {/* ================= REPORT: PRODUCTION BATCHES ================= */}
      {activeReport === 'production' && (
        <ProductionReportView />
      )}

      {/* ================= REPORT 4: RECEIVABLES REPORT ================= */}
      {activeReport === 'receivables' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Outstanding Customer Receivables (Sorted by Amount Owed)</h3>
              <p className="text-xs text-slate-400">Clients with unpaid balances and overdue credit</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Receivables:</span>
              <p className="text-xl font-black text-amber-400 font-mono">{formatPKR(totalReceivables)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Customer Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Market Address</th>
                  <th className="py-3 px-3 text-right">Credit Limit</th>
                  <th className="py-3 px-3 text-right">Amount Owed (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedDebtors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      All customer debts have been fully settled! 👍
                    </td>
                  </tr>
                ) : (
                  sortedDebtors.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-white text-sm">{c.name}</td>
                      <td className="py-3 px-3 capitalize">
                        <Badge variant={c.customer_type === 'distributor' ? 'purple' : 'blue'}>
                          {c.customer_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">{c.phone}</td>
                      <td className="py-3 px-3 text-slate-400">{c.address}, {c.city}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">{formatPKR(c.credit_limit)}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-amber-400 text-sm">
                        {formatPKR(c.current_balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= REPORT 5: PAYABLES REPORT ================= */}
      {activeReport === 'payables' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Outstanding Supplier Payables (Sorted by Amount Owed)</h3>
              <p className="text-xs text-slate-400">Factory commitments for raw materials, chemicals, and bottle packaging</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Factory Payables:</span>
              <p className="text-xl font-black text-rose-400 font-mono">{formatPKR(totalPayables)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Supplier / Vendor</th>
                  <th className="py-3 px-3">Raw Material Type</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3 text-right">Payable Balance (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedCreditors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      All supplier bills are cleared!
                    </td>
                  </tr>
                ) : (
                  sortedCreditors.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-white text-sm">{s.name}</td>
                      <td className="py-3 px-3 text-slate-300">{s.raw_material_type}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{s.phone}</td>
                      <td className="py-3 px-3 text-slate-400">{s.city}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-rose-400 text-sm">
                        {formatPKR(s.current_balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= REPORT 6: STOCK VALUATION REPORT ================= */}
      {activeReport === 'valuation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Finished Goods (Cost)</span>
              <p className="text-2xl font-black text-white mt-2 font-mono">{formatPKR(totalStockCostValue)}</p>
              <p className="text-xs text-slate-500 mt-1">Capital in finished inventory</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-teal-400 uppercase">Raw Materials & Packaging</span>
              <p className="text-2xl font-black text-teal-400 mt-2 font-mono">{formatPKR(totalRawValuation)}</p>
              <p className="text-xs text-slate-500 mt-1">Chemicals & pcs-based packaging</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-amber-400 uppercase">Total Factory Valuation</span>
              <p className="text-2xl font-black text-amber-400 mt-2 font-mono">{formatPKR(totalCombinedValuation)}</p>
              <p className="text-xs text-slate-500 mt-1">Combined warehouse capital</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Potential Retail Revenue</span>
              <p className="text-2xl font-black text-emerald-400 mt-2 font-mono">{formatPKR(totalStockRetailValue)}</p>
              <p className="text-xs text-slate-500 mt-1">Gross potential from finished goods</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <h3 className="text-base font-bold text-white mb-4">Stock Valuation Breakdown per Product</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Chemical Product</th>
                    <th className="py-3 px-3 text-center">Unit</th>
                    <th className="py-3 px-3 text-right">In-Stock Qty</th>
                    <th className="py-3 px-3 text-right">Cost Rate (PKR)</th>
                    <th className="py-3 px-3 text-right">Selling Rate (PKR)</th>
                    <th className="py-3 px-3 text-right">Total Cost Value</th>
                    <th className="py-3 px-3 text-right">Total Retail Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                        No products currently in factory stock. Stock asset valuation is PKR 0.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const costVal = p.current_stock * p.cost_price;
                      const retailVal = p.current_stock * p.selling_price;
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-bold text-white text-sm">{p.name}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-400 capitalize">{p.unit}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white">{p.current_stock}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">{formatPKR(p.cost_price)}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">{formatPKR(p.selling_price)}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-white">{formatPKR(costVal)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{formatPKR(retailVal)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Materials & Packaging Asset Valuation */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Raw Materials & Packaging Asset Valuation</h3>
                <p className="text-xs text-slate-400 mt-0.5">Chemicals (kg/liter) and packaging materials like bottles, caps, and cartons (pcs)</p>
              </div>
              <span className="text-sm font-black font-mono text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-xl">
                Valuation: {formatPKR(totalRawValuation)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Material / Packaging Name</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-center">Unit</th>
                    <th className="py-3 px-3 text-right">In-Stock Qty</th>
                    <th className="py-3 px-3 text-right">Cost Rate (PKR)</th>
                    <th className="py-3 px-3 text-right">Total Asset Value</th>
                    <th className="py-3 px-3 text-center">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rawMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                        No raw materials or packaging items recorded in factory stock.
                      </td>
                    </tr>
                  ) : (
                    rawMaterials.map((rm) => {
                      const costVal = Number(rm.current_stock || 0) * Number(rm.cost_per_unit || 0);
                      const isLow = Number(rm.current_stock || 0) <= Number(rm.reorder_level || 0);
                      return (
                        <tr key={rm.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-bold text-white text-sm">{rm.name}</td>
                          <td className="py-3 px-3 text-slate-400">{rm.category}</td>
                          <td className="py-3 px-3 text-center font-mono text-teal-400 font-semibold uppercase">{rm.unit}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white">
                            {rm.current_stock} <span className="text-[11px] font-normal text-slate-400">{rm.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">{formatPKR(rm.cost_per_unit)}/{rm.unit}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-teal-400">{formatPKR(costVal)}</td>
                          <td className="py-3 px-3 text-center">
                            {isLow ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">Low Stock</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">In Stock</span>
                            )}
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
      </div>
    </div>
  );
};

// Helper icon component
const Building2Icon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
    <path d="M10 6h4"/>
    <path d="M10 10h4"/>
    <path d="M10 14h4"/>
    <path d="M10 18h4"/>
  </svg>
);
