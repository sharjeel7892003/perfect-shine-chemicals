import { 
  Sale, 
  Product, 
  RawMaterial, 
  SalesReturn, 
  Expense, 
  Salesperson, 
  MonthlyCommissionSummary, 
  SalespersonCommissionDetail, 
  MonthlyCommissionClosure, 
  CommissionPayment 
} from '../types';
import { getLocalMonthBounds, isExpenseInCalendarMonth } from './financialEngine';

/**
 * Standardizes calculation of invoice gross profit (Revenue - COGS)
 * Exactly mirrors InvoiceProfitModal logic for consistency factory-wide.
 */
export const calculateInvoiceProfitBreakdown = (
  sale: Sale,
  products: Product[] = [],
  rawMaterials: RawMaterial[] = []
): { revenue: number; cogs: number; grossProfit: number } => {
  if (!sale) return { revenue: 0, cogs: 0, grossProfit: 0 };

  const isPL = sale.invoice_type === 'private_label' || sale.is_private_label || (sale.items || []).some(i => i.is_private_label);
  const labourTotal = Number(sale.labour_total_amount || 0);
  const discount = Number(sale.discount || 0);

  // Pre-index master product formulation costs
  const productMasterCostMap = new Map<string, number>();
  products.forEach(p => {
    const cPrice = Number(p.cost_price || 0);
    if (cPrice > 0) {
      if (p.id) productMasterCostMap.set(p.id, cPrice);
      const norm = (p.name || '').toLowerCase().replace(/[\(\)\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
      if (norm) productMasterCostMap.set(norm, cPrice);
    }
  });

  let productsRevenue = 0;
  let totalCost = 0;

  (sale.items || []).forEach(item => {
    const isItemPL = Boolean(item.is_private_label || isPL);
    const isRawMaterial = item.item_type === 'raw_material' || Boolean(item.raw_material_id);

    const prod = products.find(p => p.id === item.product_id || p.name.toLowerCase() === (item.product_name || '').toLowerCase());
    const pack = prod?.pack_sizes?.find(ps => ps.id === item.pack_size_id || ps.name === item.pack_size_name);

    const qty = Number(item.quantity || item.pack_quantity || 1);
    const unitSelling = Number(item.unit_price || 0);
    const lineRev = Number(item.subtotal !== undefined ? item.subtotal : (qty * unitSelling).toFixed(2));
    productsRevenue += lineRev;

    let resolvedUnitCost = Number(item.unit_cost || 0);

    if (isItemPL && !isRawMaterial) {
      const bottleCount = Number(item.bottle_qty || item.quantity || item.pack_quantity || 0);
      const sizeMultiplier = Number(item.size_in_base_unit || 1);

      let actualLiters = Number(item.liters_qty || 0);
      if (actualLiters <= 0 && Number(item.base_quantity || 0) > 0) {
        actualLiters = Number(item.base_quantity);
      }
      if (actualLiters <= 0 && bottleCount > 0 && sizeMultiplier > 0) {
        actualLiters = bottleCount * sizeMultiplier;
      }
      if (actualLiters <= 0) {
        actualLiters = Number(item.quantity || 1);
      }
      actualLiters = Number(actualLiters.toFixed(2));

      const normItemName = (item.product_name || '').toLowerCase().replace(/[\(\)\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
      const masterFormulationCost = (item.product_id && productMasterCostMap.get(item.product_id)) ||
                                    productMasterCostMap.get(normItemName) ||
                                    (prod && Number(prod.cost_price || 0) > 0 ? Number(prod.cost_price) : 0);

      if (masterFormulationCost > 0) {
        resolvedUnitCost = Number(masterFormulationCost.toFixed(2));
      } else if (resolvedUnitCost > 0) {
        if (sizeMultiplier > 0 && sizeMultiplier < 1) {
          resolvedUnitCost = Number((resolvedUnitCost / sizeMultiplier).toFixed(2));
        }
      }

      const lineCost = Number((resolvedUnitCost * actualLiters).toFixed(2));
      totalCost += lineCost;
    } else {
      let chemicalPortion: number | undefined;
      let packagingPortion: number | undefined;

      if (prod && pack) {
        chemicalPortion = Number(((pack.size_in_base_unit || item.size_in_base_unit || 1) * Number(prod.cost_price || 0)).toFixed(2));
        packagingPortion = Number(
          (pack.packaging_items || []).reduce((sum, pi) => {
            const rm = rawMaterials.find(r => r.id === pi.raw_material_id);
            const rate = rm ? Number(rm.cost_per_unit || 0) : Number(pi.cost_per_unit || 0);
            return sum + (Number(pi.quantity || 0) * rate);
          }, 0).toFixed(2)
        );
      }

      if (resolvedUnitCost <= 0) {
        if (item.raw_material_id) {
          const rm = rawMaterials.find(r => r.id === item.raw_material_id);
          resolvedUnitCost = rm ? Number(rm.cost_per_unit || 0) : 0;
        } else if (pack?.true_cost && pack.true_cost > 0) {
          resolvedUnitCost = Number(pack.true_cost);
        } else if (chemicalPortion !== undefined && packagingPortion !== undefined && (chemicalPortion + packagingPortion) > 0) {
          resolvedUnitCost = Number((chemicalPortion + packagingPortion).toFixed(2));
        } else if (prod?.cost_price && prod.cost_price > 0) {
          resolvedUnitCost = Number((Number(prod.cost_price) * (item.size_in_base_unit || pack?.size_in_base_unit || 1)).toFixed(2));
        }
      }

      const lineCost = Number((resolvedUnitCost * qty).toFixed(2));
      totalCost += lineCost;
    }
  });

  const grandRevenue = Number((productsRevenue + labourTotal - discount).toFixed(2));
  const grossProfit = Number((grandRevenue - totalCost).toFixed(2));

  return {
    revenue: grandRevenue,
    cogs: totalCost,
    grossProfit
  };
};

/**
 * Calculates profit reduction from a sales return / credit note.
 */
export const calculateReturnProfitBreakdown = (
  salesReturn: SalesReturn,
  products: Product[] = [],
  rawMaterials: RawMaterial[] = []
): { returnedRevenue: number; returnedCogs: number; grossProfitDeducted: number } => {
  let returnedRevenue = 0;
  let returnedCogs = 0;

  (salesReturn.items || []).forEach(item => {
    const rev = Number(item.subtotal || 0);
    returnedRevenue += rev;

    let unitCost = Number(item.unit_cost || 0);
    if (unitCost <= 0) {
      if (item.raw_material_id) {
        const rm = rawMaterials.find(m => m.id === item.raw_material_id);
        unitCost = rm ? Number(rm.cost_per_unit || 0) : 0;
      } else {
        const prod = products.find(p => p.id === item.product_id);
        unitCost = prod ? Number(prod.cost_price || 0) * (item.size_in_base_unit || 1) : 0;
      }
    }

    const qty = Number(item.base_quantity || item.quantity || 1);
    const cost = Number((unitCost * qty).toFixed(2));
    returnedCogs += cost;
  });

  returnedRevenue = Number(returnedRevenue.toFixed(2));
  returnedCogs = Number(returnedCogs.toFixed(2));
  const grossProfitDeducted = Number((returnedRevenue - returnedCogs).toFixed(2));

  return {
    returnedRevenue,
    returnedCogs,
    grossProfitDeducted
  };
};

/**
 * Tests whether a date falls within target month string 'YYYY-MM'
 */
export const isDateInMonthKey = (dateStr?: string, monthKey?: string): boolean => {
  if (!dateStr || !monthKey) return false;
  if (dateStr.slice(0, 7) === monthKey) return true;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return m === monthKey;
  }
  return false;
};

export interface CalculateMonthlyCommissionOptions {
  monthKey: string; // 'YYYY-MM' e.g. '2026-10'
  sales: Sale[];
  salesReturns: SalesReturn[];
  expenses: Expense[];
  salespersons: Salesperson[];
  commissionPayments?: CommissionPayment[];
  closure?: MonthlyCommissionClosure | null;
  products?: Product[];
  rawMaterials?: RawMaterial[];
  includeDepreciation?: boolean;
}

/**
 * Authoritative global calculation source for Monthly Sales Commission.
 * 
 * Rules:
 * - Gross profit per invoice = revenue - cost (reduced by sales returns in the month the return is recorded).
 * - Total Gross Profit = all invoices of the month (including those with no salesperson) minus all returns of that month.
 * - Monthly Expenses = total of expenses dated in that month (centralized overhead figure, excluding archived/deleted).
 *   Depreciation is excluded by default unless includeDepreciation is true.
 * - Coverage Factor = max(0, (Total Gross Profit - Monthly Expenses) / Total Gross Profit). If Total Gross Profit <= 0, factor = 0.
 * - Commission for each salesperson = rate x (their gross profit) x factor, never below zero.
 * - If expenses exceed total gross profit, all commissions are 0. No carry-forward of losses.
 * - Current/unclosed month is labeled "Provisional (month still open)".
 */
export const calculateMonthlyCommissionSummary = ({
  monthKey,
  sales,
  salesReturns,
  expenses,
  salespersons,
  commissionPayments = [],
  closure = null,
  products = [],
  rawMaterials = [],
  includeDepreciation = false,
}: CalculateMonthlyCommissionOptions): MonthlyCommissionSummary => {
  // If the month is closed and a snapshot is present, return closed figures unless asked to recalculate
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const dateObj = new Date(year, monthNum - 1, 1);
  const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

  // 1. Filter sales belonging to this month by invoice date
  const monthSales = (sales || []).filter(s => isDateInMonthKey(s.date, monthKey));

  // 2. Filter sales returns recorded in this calendar month
  const monthReturns = (salesReturns || []).filter(r => isDateInMonthKey(r.date || r.created_at, monthKey));

  // 3. Centralized monthly overhead expenses (excluding archived/deleted)
  const validExpenses = (expenses || []).filter(e => {
    if ((e as any).is_archived || (e as any).is_deleted) return false;
    if (!e.date || Number(e.amount || 0) <= 0) return false;
    if (!isExpenseInCalendarMonth(e.date, year, monthNum)) return false;

    // Check depreciation filter
    if (!includeDepreciation) {
      const isDepreciation = 
        (e as any).is_depreciation === true ||
        (e.category && e.category.toLowerCase().includes('depreciation')) ||
        (e.description && e.description.toLowerCase().includes('depreciation'));
      if (isDepreciation) return false;
    }
    return true;
  });

  const totalExpenses = Number(
    validExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0).toFixed(2)
  );

  // 4. Calculate Gross Profit per invoice and map to salesperson
  // Map of salesperson_id -> array of invoices
  const spInvoicesMap = new Map<string, Array<{
    sale: Sale;
    revenue: number;
    cogs: number;
    grossProfit: number;
  }>>();

  let allInvoicesRevenue = 0;
  let allInvoicesGrossProfit = 0;

  monthSales.forEach(sale => {
    const breakdown = calculateInvoiceProfitBreakdown(sale, products, rawMaterials);
    allInvoicesRevenue += breakdown.revenue;
    allInvoicesGrossProfit += breakdown.grossProfit;

    const spId = sale.salesperson_id ? sale.salesperson_id.trim() : 'unassigned';
    if (!spInvoicesMap.has(spId)) {
      spInvoicesMap.set(spId, []);
    }
    spInvoicesMap.get(spId)!.push({
      sale,
      revenue: breakdown.revenue,
      cogs: breakdown.cogs,
      grossProfit: breakdown.grossProfit,
    });
  });

  // 5. Calculate Gross Profit reduction for returns in this month and attribute to salesperson
  const spReturnsMap = new Map<string, Array<{
    salesReturn: SalesReturn;
    returnedRevenue: number;
    returnedCogs: number;
    grossProfitDeducted: number;
  }>>();

  let allReturnsGrossProfit = 0;

  monthReturns.forEach(ret => {
    const retBreakdown = calculateReturnProfitBreakdown(ret, products, rawMaterials);
    allReturnsGrossProfit += retBreakdown.grossProfitDeducted;

    // Resolve original sale to find salesperson
    const origSale = sales.find(s => s.id === ret.sale_id || s.invoice_number === ret.invoice_number);
    const spId = origSale?.salesperson_id ? origSale.salesperson_id.trim() : 'unassigned';

    if (!spReturnsMap.has(spId)) {
      spReturnsMap.set(spId, []);
    }
    spReturnsMap.get(spId)!.push({
      salesReturn: ret,
      returnedRevenue: retBreakdown.returnedRevenue,
      returnedCogs: retBreakdown.returnedCogs,
      grossProfitDeducted: retBreakdown.grossProfitDeducted,
    });
  });

  // 6. Authoritative Total Gross Profit of the month across ALL invoices (including unassigned)
  const totalGrossProfit = Number((allInvoicesGrossProfit - allReturnsGrossProfit).toFixed(2));

  // 7. Coverage Factor calculation:
  // Coverage factor = max(0, (Total Gross Profit - Monthly Expenses) / Total Gross Profit)
  // If Total Gross Profit <= 0, factor = 0
  let coverageFactor = 0;
  if (totalGrossProfit > 0 && totalGrossProfit > totalExpenses) {
    coverageFactor = Number(((totalGrossProfit - totalExpenses) / totalGrossProfit).toFixed(6));
  } else {
    coverageFactor = 0;
  }

  // 8. Build detailed breakdown per salesperson
  // Include all salespersons in the system (or in snapshot), plus any unassigned that had sales
  const allSpList: Salesperson[] = [...salespersons];

  // If closed snapshot exists, use its saved rates or salespeople
  const isClosed = Boolean(closure && closure.is_closed);

  const salespeopleDetails: SalespersonCommissionDetail[] = allSpList.map(sp => {
    const invList = spInvoicesMap.get(sp.id) || [];
    const retList = spReturnsMap.get(sp.id) || [];

    const invoiceCount = invList.length;
    const totalSales = Number(invList.reduce((acc, it) => acc + (it.sale.total_amount || 0), 0).toFixed(2));
    const grossProfitBeforeReturns = Number(invList.reduce((acc, it) => acc + it.grossProfit, 0).toFixed(2));
    const returnsGrossProfit = Number(retList.reduce((acc, it) => acc + it.grossProfitDeducted, 0).toFixed(2));
    const netGrossProfit = Number((grossProfitBeforeReturns - returnsGrossProfit).toFixed(2));

    const rate = Number(sp.commission_rate ?? 10.0); // e.g. 10%
    
    // Commission = rate% x (their gross profit) x coverageFactor, never below 0
    let commissionEarned = 0;
    if (netGrossProfit > 0 && coverageFactor > 0) {
      commissionEarned = Number(((rate / 100) * netGrossProfit * coverageFactor).toFixed(2));
    }
    commissionEarned = Math.max(0, commissionEarned);

    // Payments recorded for this salesperson for this month
    const paymentsForSp = (commissionPayments || []).filter(
      p => p.salesperson_id === sp.id && p.month === monthKey
    );
    const commissionPaid = Number(paymentsForSp.reduce((acc, p) => acc + Number(p.amount || 0), 0).toFixed(2));
    const commissionBalance = Math.max(0, Number((commissionEarned - commissionPaid).toFixed(2)));

    return {
      salesperson_id: sp.id,
      salesperson_name: sp.name,
      invoice_count: invoiceCount,
      total_sales: totalSales,
      gross_profit_before_returns: grossProfitBeforeReturns,
      returns_gross_profit: returnsGrossProfit,
      gross_profit: netGrossProfit,
      commission_rate: rate,
      coverage_factor: coverageFactor,
      commission_earned: commissionEarned,
      commission_paid: commissionPaid,
      commission_balance: commissionBalance,
      invoices: invList.map(it => ({
        sale_id: it.sale.id,
        invoice_number: it.sale.invoice_number,
        date: it.sale.date,
        customer_name: it.sale.customer_name,
        total_amount: it.sale.total_amount,
        revenue: it.revenue,
        cogs: it.cogs,
        gross_profit: it.grossProfit,
      })),
      returns: retList.map(it => ({
        return_id: it.salesReturn.id,
        credit_note_number: it.salesReturn.credit_note_number,
        date: it.salesReturn.date || it.salesReturn.created_at || '',
        invoice_number: it.salesReturn.invoice_number,
        returned_revenue: it.returnedRevenue,
        returned_cogs: it.returnedCogs,
        gross_profit_deducted: it.grossProfitDeducted,
      }))
    };
  });

  // Calculate totals
  const totalCommission = Number(
    salespeopleDetails.reduce((acc, sp) => acc + sp.commission_earned, 0).toFixed(2)
  );

  const profitBeforeCommission = Number((totalGrossProfit - totalExpenses).toFixed(2));
  const ownerRemainingProfit = Number((profitBeforeCommission - totalCommission).toFixed(2));

  // Determine provisional status
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const isProvisional = !isClosed;

  return {
    month: monthKey,
    monthName,
    is_closed: isClosed,
    is_provisional: isProvisional,
    closed_at: closure?.closed_at,
    closed_by_name: closure?.closed_by_name,
    total_invoices: monthSales.length,
    total_sales_amount: Number(monthSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0).toFixed(2)),
    total_gross_profit: totalGrossProfit,
    total_expenses: totalExpenses,
    profit_before_commission: profitBeforeCommission,
    coverage_factor: coverageFactor,
    total_commission: totalCommission,
    owner_remaining_profit: ownerRemainingProfit,
    include_depreciation: includeDepreciation,
    salespeople: salespeopleDetails,
  };
};
