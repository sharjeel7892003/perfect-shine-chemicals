import React from 'react';
import { 
  TrendingUp, 
  ShoppingCart, 
  Truck, 
  AlertTriangle, 
  Users, 
  ArrowUpRight, 
  Plus, 
  CheckCircle2,
  Package,
  Layers,
  FlaskConical,
  Factory,
  DollarSign,
  Receipt
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatPKR, formatDate } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { ActiveTab } from '../layout/Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { 
    products, 
    rawMaterials,
    sales, 
    purchases, 
    customers, 
    suppliers, 
    lowStockProducts,
    lowStockRawMaterials,
    totalRawMaterialsValuation,
    totalProductsValuation,
    productionBatches,
    expenses,
    thisMonthExpenses
  } = useApp();
  
  const { currentUser, isOwner, canCreateSale, canManagePurchases, canRecordProduction } = useAuth();

  // Metrics calculations
  const totalSalesRevenue = sales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
  const totalCOGS = sales.reduce((acc, s) => 
    acc + (s.items || []).reduce((iAcc, item) => iAcc + ((item.unit_cost || 0) * (item.quantity || 0)), 0), 0
  );
  const grossProfit = totalSalesRevenue - totalCOGS;
  const totalExpensesAmount = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const netProfit = grossProfit - totalExpensesAmount;

  // This month metrics
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonthSales = sales.filter(s => s.date && s.date.startsWith(currentMonthKey));
  const thisMonthRevenue = thisMonthSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
  const thisMonthCOGS = thisMonthSales.reduce((acc, s) => 
    acc + (s.items || []).reduce((iAcc, item) => iAcc + ((item.unit_cost || 0) * (item.quantity || 0)), 0), 0
  );
  const thisMonthGrossProfit = thisMonthRevenue - thisMonthCOGS;
  const thisMonthNetProfit = thisMonthGrossProfit - thisMonthExpenses;

  const totalReceivables = customers.reduce((acc, c) => acc + (c.current_balance || 0), 0);
  const totalPayables = suppliers.reduce((acc, s) => acc + (s.current_balance || 0), 0);
  const combinedFactoryValuation = totalProductsValuation + totalRawMaterialsValuation;

  // Recent 5 sales
  const recentSales = sales.slice(0, 5);

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/20 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Factory Operations • Lahore Manufacturing Plant
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome, {currentUser.name}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Chemical formulations, single base-unit inventories, manufacturing batch runs & customer accounts are active.
            </p>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex flex-wrap items-center gap-2.5">
            {canCreateSale && (
              <button
                onClick={() => onNavigate('sales')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                <span>New POS Invoice</span>
              </button>
            )}
            {canRecordProduction && (
              <button
                onClick={() => onNavigate('production')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-all active:scale-95"
              >
                <Factory className="w-4 h-4 text-emerald-400" />
                <span>Run Production Batch</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Sales Revenue */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sales Invoiced</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-3">{formatPKR(totalSalesRevenue)}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>{sales.length} orders billed</span>
            <span className="text-emerald-400 font-medium">Base stock auto-deducted</span>
          </div>
        </div>

        {/* Finished Goods Valuation */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Finished Goods Stock</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-3">{formatPKR(totalProductsValuation)}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>{products.filter(p => !p.is_archived).length} Products (L & kg)</span>
            <button onClick={() => onNavigate('inventory')} className="text-blue-400 hover:underline flex items-center gap-0.5">
              Stock <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Raw Materials Inventory Valuation */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Raw Material Inventory</span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-teal-400 mt-3">{formatPKR(totalRawMaterialsValuation)}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>{rawMaterials.length} Raw Chemicals</span>
            <button onClick={() => onNavigate('raw_materials')} className="text-teal-400 hover:underline flex items-center gap-0.5">
              Chemicals <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Total Receivables */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Receivables</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-400 mt-3">{formatPKR(totalReceivables)}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>Client ledger credit</span>
            <button onClick={() => onNavigate('customers')} className="text-amber-400 hover:underline flex items-center gap-0.5">
              Ledger <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* This Month's Expenses */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month's Overheads</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400 mt-3 font-mono">{formatPKR(thisMonthExpenses)}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>Operating expenses</span>
            <button onClick={() => onNavigate('expenses')} className="text-rose-400 hover:underline flex items-center gap-0.5 font-medium">
              Expenses <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Financial Performance Strip: Gross Profit vs Net Profit (after expenses) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Financial Performance • Gross Profit vs. Net Profit
            </h3>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View Full P&L Statement</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Gross Profit */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold uppercase text-[10px]">Gross Profit (All Time)</span>
              <span className="text-[10px] text-slate-400">Revenue − COGS</span>
            </div>
            <p className="text-xl font-black text-white font-mono">{formatPKR(grossProfit)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Direct production margin</p>
          </div>

          {/* Operating Overheads */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold uppercase text-[10px]">Total Operating Expenses</span>
              <span className="text-[10px] text-rose-400 font-mono">- Overheads</span>
            </div>
            <p className="text-xl font-black text-rose-400 font-mono">- {formatPKR(totalExpensesAmount)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Rent, labor, utilities, maintenance</p>
          </div>

          {/* Net Profit (All Time) */}
          <div className={`p-3.5 rounded-xl border ${
            netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`font-bold uppercase text-[10px] ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Net Profit (After Expenses)
              </span>
              <Badge variant={netProfit >= 0 ? 'emerald' : 'rose'} size="sm">
                {netProfit >= 0 ? 'Profitable' : 'Deficit'}
              </Badge>
            </div>
            <p className={`text-xl font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPKR(netProfit)}
            </p>
            <p className="text-[11px] text-slate-300 mt-1">Gross Profit − Operating Overheads</p>
          </div>

          {/* This Month's Net Profit */}
          <div className={`p-3.5 rounded-xl border ${
            thisMonthNetProfit >= 0 ? 'bg-slate-800/80 border-slate-700' : 'bg-rose-500/10 border-rose-500/20'
          }`}>
            <div className="flex items-center justify-between mb-1 text-slate-400">
              <span className="font-semibold uppercase text-[10px]">This Month's Net Profit</span>
              <span className="text-[10px] text-emerald-400 font-medium">Current Month</span>
            </div>
            <p className={`text-xl font-black font-mono ${thisMonthNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPKR(thisMonthNetProfit)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Gross ({formatPKR(thisMonthGrossProfit)}) − Overheads ({formatPKR(thisMonthExpenses)})
            </p>
          </div>
        </div>
      </div>

      {/* Low-Stock Alerts Row (Finished Goods & Raw Materials) */}
      {(lowStockProducts.length > 0 || lowStockRawMaterials.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Finished Goods Alerts */}
          {lowStockProducts.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs">
              <div className="flex items-center justify-between font-bold text-rose-400 mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{lowStockProducts.length} Finished Product(s) Below Reorder Level</span>
                </div>
                <button
                  onClick={() => onNavigate('production')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold hover:bg-rose-400 transition-colors"
                >
                  Schedule Production
                </button>
              </div>
              <div className="space-y-1 text-slate-300">
                {lowStockProducts.map(p => (
                  <p key={p.id}>• <strong>{p.name}</strong>: {p.current_stock} {p.base_unit || p.unit} (Reorder at {p.reorder_level})</p>
                ))}
              </div>
            </div>
          )}

          {/* Raw Materials Alerts */}
          {lowStockRawMaterials.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-400 mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{lowStockRawMaterials.length} Raw Material(s) Low in Stock</span>
                </div>
                <button
                  onClick={() => onNavigate('purchases')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors"
                >
                  Purchase PO
                </button>
              </div>
              <div className="space-y-1 text-slate-300">
                {lowStockRawMaterials.map(rm => (
                  <p key={rm.id}>• <strong>{rm.name}</strong>: {rm.current_stock} {rm.unit} (Threshold: {rm.reorder_level} {rm.unit})</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Split: Inventory Stock Levels & Recent Production / Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Chemical Finished Goods Stock (Base Units) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <span>Finished Chemical Stock Levels (Single Base Unit)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Single source of truth inventory in liters & kilograms
                </p>
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                Manage Catalog <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {products.filter(p => !p.is_archived).slice(0, 5).map((product) => {
                const baseUnit = product.base_unit || product.unit || 'liter';
                const stock = Number(product.current_stock);
                const reorder = Number(product.reorder_level);
                const isLow = stock <= reorder;
                const percentage = Math.min(100, Math.round((stock / (reorder * 3)) * 100));

                return (
                  <div key={product.id} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{product.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-800">
                          {product.sku}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">
                          {stock} <span className="text-slate-400 font-normal uppercase">{baseUnit}</span>
                        </span>
                        {isLow ? (
                          <Badge variant="rose">Low Stock</Badge>
                        ) : (
                          <Badge variant="emerald">Available</Badge>
                        )}
                      </div>
                    </div>
                    {/* Stock Progress Bar */}
                    <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isLow ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(5, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Combined Total Factory Asset Valuation:</span>
            <span className="text-sm font-black font-mono text-emerald-400">
              {formatPKR(combinedFactoryValuation)}
            </span>
          </div>
        </div>

        {/* Right Col: Recent Sales & Production Batches */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Latest Activity</h3>
                <p className="text-xs text-slate-400 mt-0.5">Recent dispatches & production</p>
              </div>
              <button
                onClick={() => onNavigate('sales')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                View Sales <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Production Run Card */}
              {productionBatches.length > 0 && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
                  <div className="flex items-center justify-between font-bold text-purple-300">
                    <span className="flex items-center gap-1.5">
                      <Factory className="w-3.5 h-3.5" />
                      <span>Latest Batch Output</span>
                    </span>
                    <span className="font-mono text-[11px]">{productionBatches[0].batch_number}</span>
                  </div>
                  <p className="text-white font-semibold mt-1">
                    {productionBatches[0].product_name} (+{productionBatches[0].quantity_produced} {productionBatches[0].base_unit})
                  </p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Logged by {productionBatches[0].supervisor_name}
                  </p>
                </div>
              )}

              {/* Recent Sales List */}
              {recentSales.slice(0, 3).map((sale) => (
                <div
                  key={sale.id}
                  className="p-3 rounded-xl bg-slate-800/50 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-white">{sale.customer_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {sale.invoice_number} • {formatDate(sale.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold font-mono text-emerald-400">{formatPKR(sale.total_amount)}</p>
                    <div className="mt-1">
                      <Badge
                        variant={sale.payment_status === 'paid' ? 'emerald' : sale.payment_status === 'partial' ? 'amber' : 'rose'}
                        size="sm"
                      >
                        {sale.payment_status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Registered Clients:</span>
            <span className="font-bold text-white">{customers.length} Accounts</span>
          </div>
        </div>
      </div>
    </div>
  );
};
