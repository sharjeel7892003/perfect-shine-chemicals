import { Sale, Purchase, Payment, Expense, Customer, Supplier, SalesReturn } from '../types';

export interface CustomerFinancialSummary {
  customerId: string;
  customerName: string;
  totalSales: number;
  totalReturns: number;
  salesPaidOnInvoice: number;
  directAccountPayments: number;
  totalPaymentsCollected: number;
  outstandingReceivable: number;
  advanceBalance: number;
  salesCount: number;
  returnsCount: number;
  paymentsCount: number;
  isArchived: boolean;
}

export interface SupplierFinancialSummary {
  supplierId: string;
  supplierName: string;
  totalPurchases: number;
  purchasesPaidOnPO: number;
  directAccountDisbursements: number;
  totalDisbursementsPaid: number;
  outstandingPayable: number;
  purchasesCount: number;
  disbursementsCount: number;
  isArchived: boolean;
}

export interface FinancialFilterOptions {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  supplierId?: string;
  productId?: string;
}

export interface OverallFinancialMetrics {
  totalSalesRevenue: number;
  grossSalesRevenue?: number;
  totalSalesReturns?: number;
  
  // INFLOWS BREAKDOWN
  salesCashCollected: number;
  capitalInjected: number;
  customerAdvancesReceived: number;
  totalCashCollected: number; // Sum of all Inflows: salesCashCollected + capitalInjected + customerAdvancesReceived
  
  // OUTSTANDING BALANCES
  totalUncollectedCredit: number; // Factory Receivables (money owed by customers)
  totalOutstandingAdvances: number; // Factory Liability (customer advances not yet consumed by sales)
  
  // OUTFLOWS BREAKDOWN
  totalPurchasesSpend: number;
  purchaseDisbursements: number;
  operatingExpenses: number;
  ownerWithdrawals: number;
  salesReturnRefunds?: number;
  totalDisbursements: number; // Sum of all Outflows: purchaseDisbursements + operatingExpenses + ownerWithdrawals + salesReturnRefunds
  
  // NET CASH POSITION
  netCashPosition: number; // totalCashCollected - totalDisbursements
  netCashflow: number; // alias for backwards compatibility
  
  customerSummaries: CustomerFinancialSummary[];
  supplierSummaries: SupplierFinancialSummary[];
}

/**
 * Helper to test if a date string falls inside an optional [startDate, endDate] window.
 */
export const isDateInBounds = (dateStr?: string, startDate?: string, endDate?: string): boolean => {
  if (!dateStr) return false;
  if (!startDate && !endDate) return true;
  const d = new Date(dateStr);
  if (startDate && d < new Date(startDate + 'T00:00:00')) return false;
  if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
  return true;
};

/**
 * Calculates authoritative financial figures for a single customer.
 * Reconciles sales invoices and all payment vouchers (checkout, collections, and advances).
 * 
 * Net Balance = Total Sales Invoiced - Total Payments Received:
 * - If > 0: Customer owes the factory (Outstanding Receivable), Advance = 0
 * - If < 0: Customer has paid in advance (Advance Balance), Receivable = 0
 * - If = 0: Fully settled
 */
export const calculateCustomerFinancials = (
  customer: Customer,
  sales: Sale[],
  payments: Payment[],
  salesReturns: SalesReturn[] = []
): CustomerFinancialSummary => {
  const custSales = sales.filter(s => s.customer_id === customer.id);
  const totalSales = Number(
    custSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0).toFixed(2)
  );
  const salesPaidOnInvoice = Number(
    custSales.reduce((acc, s) => acc + (Number(s.amount_paid) || 0), 0).toFixed(2)
  );

  // Sales Returns for this customer
  const custReturns = (salesReturns || []).filter(r => r.customer_id === customer.id);
  const totalReturns = Number(
    custReturns.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0).toFixed(2)
  );

  // Net Invoiced = Total Sales - Total Returns
  const netInvoiced = Math.max(0, Number((totalSales - totalReturns).toFixed(2)));

  // Get all customer payments (invoice-linked, balance settlements, and advance deposits)
  const custPayments = payments.filter(
    p =>
      p.customer_id === customer.id &&
      (p.related_to === 'sale' || p.related_to === 'customer_balance' || p.related_to === 'customer_advance')
  );

  // Cash refunds paid out to customer for returns (outflows)
  const custCashRefunds = payments.filter(
    p => p.customer_id === customer.id && p.related_to === 'sales_return_refund'
  );

  const directAccountPayments = Number(
    custPayments
      .filter(p => p.related_to === 'customer_balance' || p.related_to === 'customer_advance')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      .toFixed(2)
  );

  const totalPaymentsCollected = Number(
    custPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
  );

  const totalCashRefunds = Number(
    custCashRefunds.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
  );

  // Net payments retained by factory from this customer
  const netPaymentsRetained = Math.max(0, Number((totalPaymentsCollected - totalCashRefunds).toFixed(2)));

  let outstandingReceivable = 0;
  let advanceBalance = 0;

  if (custSales.length > 0 || custPayments.length > 0 || custReturns.length > 0) {
    const netDifference = Number((netInvoiced - netPaymentsRetained).toFixed(2));
    if (netDifference > 0) {
      outstandingReceivable = netDifference;
      advanceBalance = 0;
    } else {
      outstandingReceivable = 0;
      advanceBalance = Math.abs(netDifference);
    }
  } else {
    // If customer has no sales or payments, check legacy current_balance
    const storedBal = Number(customer.current_balance || 0);
    if (storedBal > 0) {
      outstandingReceivable = storedBal;
      advanceBalance = 0;
    } else if (storedBal < 0) {
      outstandingReceivable = 0;
      advanceBalance = Math.abs(storedBal);
    }
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    totalSales,
    totalReturns,
    salesPaidOnInvoice,
    directAccountPayments,
    totalPaymentsCollected,
    outstandingReceivable,
    advanceBalance,
    salesCount: custSales.length,
    returnsCount: custReturns.length,
    paymentsCount: custPayments.length,
    isArchived: Boolean(customer.is_archived),
  };
};

/**
 * Calculates authoritative financial figures for a single supplier.
 * Reconciles POs and all disbursement vouchers.
 */
export const calculateSupplierFinancials = (
  supplier: Supplier,
  purchases: Purchase[],
  payments: Payment[]
): SupplierFinancialSummary => {
  const suppPurchases = purchases.filter(p => p.supplier_id === supplier.id);
  const totalPurchases = Number(
    suppPurchases.reduce((acc, p) => acc + (Number(p.total_amount) || 0), 0).toFixed(2)
  );
  const purchasesPaidOnPO = Number(
    suppPurchases.reduce((acc, p) => acc + (Number(p.amount_paid) || 0), 0).toFixed(2)
  );

  const suppPayments = payments.filter(
    p => p.supplier_id === supplier.id && (p.related_to === 'purchase' || p.related_to === 'supplier_balance')
  );

  const directAccountDisbursements = Number(
    suppPayments
      .filter(p => p.related_to === 'supplier_balance')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      .toFixed(2)
  );

  const totalDisbursementsPaid = Number(
    suppPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
  );

  let outstandingPayable = 0;
  if (suppPurchases.length > 0 || suppPayments.length > 0) {
    outstandingPayable = Math.max(0, Number((totalPurchases - totalDisbursementsPaid).toFixed(2)));
  } else {
    outstandingPayable = Math.max(0, Number(supplier.current_balance || 0));
  }

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    totalPurchases,
    purchasesPaidOnPO,
    directAccountDisbursements,
    totalDisbursementsPaid,
    outstandingPayable,
    purchasesCount: suppPurchases.length,
    disbursementsCount: suppPayments.length,
    isArchived: Boolean(supplier.is_archived),
  };
};

/**
 * Authoritative global calculation source for Reports, Ledgers, and Dashboard.
 * 
 * Formula:
 * Net Cash Position = (Capital Injected + Sales Payments Collected + Customer Advances)
 *                   - (Purchases Paid + Operating Expenses + Owner Withdrawals)
 */
export const calculateFinancialMetrics = (data: {
  sales: Sale[];
  purchases: Purchase[];
  payments: Payment[];
  expenses: Expense[];
  customers: Customer[];
  suppliers: Supplier[];
  salesReturns?: SalesReturn[];
  filters?: FinancialFilterOptions;
}): OverallFinancialMetrics => {
  const {
    sales,
    purchases,
    payments,
    expenses,
    customers,
    suppliers,
    salesReturns = [],
    filters = {},
  } = data;

  const { startDate, endDate, customerId, supplierId, productId } = filters;

  // 1. Filter Sales
  const filteredSales = sales.filter(s => {
    const dateMatch = isDateInBounds(s.date, startDate, endDate);
    const custMatch = !customerId || customerId === 'all' || s.customer_id === customerId;
    const prodMatch =
      !productId ||
      productId === 'all' ||
      s.items.some(i => i.product_id === productId || i.raw_material_id === productId);
    return dateMatch && custMatch && prodMatch;
  });

  const grossSalesRevenue = Number(
    filteredSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0).toFixed(2)
  );

  // 1B. Filter Sales Returns
  const filteredReturns = salesReturns.filter(r => {
    const dateMatch = isDateInBounds(r.date, startDate, endDate);
    const custMatch = !customerId || customerId === 'all' || r.customer_id === customerId;
    const prodMatch =
      !productId ||
      productId === 'all' ||
      r.items.some(i => i.product_id === productId || i.raw_material_id === productId);
    return dateMatch && custMatch && prodMatch;
  });

  const totalSalesReturns = Number(
    filteredReturns.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0).toFixed(2)
  );

  // Net Sales Revenue after returns
  const totalSalesRevenue = Math.max(0, Number((grossSalesRevenue - totalSalesReturns).toFixed(2)));

  // 2. Filter Purchases
  const filteredPurchases = purchases.filter(p => {
    const dateMatch = isDateInBounds(p.date, startDate, endDate);
    const suppMatch = !supplierId || supplierId === 'all' || p.supplier_id === supplierId;
    return dateMatch && suppMatch;
  });

  const totalPurchasesSpend = Number(
    filteredPurchases.reduce((acc, p) => acc + (Number(p.total_amount) || 0), 0).toFixed(2)
  );

  // 3. Customer Summaries, Receivables & Advances
  const activeCustomers = customers.filter(c => !c.is_archived || c.id === customerId);
  const customerSummaries = activeCustomers.map(c => calculateCustomerFinancials(c, sales, payments, salesReturns));

  // Inflow Breakdown
  let capitalInjected = 0;
  let ownerWithdrawals = 0;
  let customerAdvancesReceived = 0;
  let salesCashCollected = 0;
  let totalCashCollected = 0;
  let totalUncollectedCredit = 0;
  let totalOutstandingAdvances = 0;

  // Filter payments by date bounds
  const boundedPayments = payments.filter(p => isDateInBounds(p.date, startDate, endDate));

  // Owner Capital Injections (Cash In)
  capitalInjected = Number(
    boundedPayments
      .filter(p => p.related_to === 'capital_injection')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      .toFixed(2)
  );

  // Owner Withdrawals / Drawings (Cash Out)
  ownerWithdrawals = Number(
    boundedPayments
      .filter(p => p.related_to === 'owner_withdrawal')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      .toFixed(2)
  );

  // Sales Return Cash Refunds (Cash Out)
  const salesReturnRefunds = Number(
    boundedPayments
      .filter(p => p.related_to === 'sales_return_refund' && (!customerId || customerId === 'all' || p.customer_id === customerId))
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      .toFixed(2)
  );

  if (customerId && customerId !== 'all') {
    // Specific customer view
    const custSummary = customerSummaries.find(cs => cs.customerId === customerId);
    const custBoundedPayments = boundedPayments.filter(p => p.customer_id === customerId);

    customerAdvancesReceived = Number(
      custBoundedPayments
        .filter(p => p.related_to === 'customer_advance')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
        .toFixed(2)
    );

    salesCashCollected = Number(
      custBoundedPayments
        .filter(p => p.related_to === 'sale' || p.related_to === 'customer_balance')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
        .toFixed(2)
    );

    totalCashCollected = Number((salesCashCollected + customerAdvancesReceived).toFixed(2));
    totalUncollectedCredit = custSummary ? custSummary.outstandingReceivable : 0;
    totalOutstandingAdvances = custSummary ? custSummary.advanceBalance : 0;
  } else {
    // Global / All Customers view
    customerAdvancesReceived = Number(
      boundedPayments
        .filter(p => p.related_to === 'customer_advance')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
        .toFixed(2)
    );

    salesCashCollected = Number(
      boundedPayments
        .filter(p => p.related_to === 'sale' || p.related_to === 'customer_balance')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
        .toFixed(2)
    );

    totalCashCollected = Number(
      (salesCashCollected + capitalInjected + customerAdvancesReceived).toFixed(2)
    );

    totalUncollectedCredit = Number(
      customerSummaries.reduce((acc, c) => acc + c.outstandingReceivable, 0).toFixed(2)
    );

    totalOutstandingAdvances = Number(
      customerSummaries.reduce((acc, c) => acc + c.advanceBalance, 0).toFixed(2)
    );
  }

  // 4. Supplier Summaries & Payables
  const activeSuppliers = suppliers.filter(s => !s.is_archived || s.id === supplierId);
  const supplierSummaries = activeSuppliers.map(s => calculateSupplierFinancials(s, purchases, payments));

  // Determine Purchase Disbursements
  let purchaseDisbursements = 0;
  if (supplierId && supplierId !== 'all') {
    const suppBounded = boundedPayments.filter(p => p.supplier_id === supplierId);
    purchaseDisbursements = Number(
      suppBounded
        .filter(p => p.related_to === 'purchase' || p.related_to === 'supplier_balance')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
        .toFixed(2)
    );
  } else {
    purchaseDisbursements = Number(
      boundedPayments
        .filter(p => p.related_to === 'purchase' || p.related_to === 'supplier_balance')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
        .toFixed(2)
    );
  }

  // 5. Operating Expenses
  const filteredExpenses = expenses.filter(
    e => !(e as any).is_archived && !(e as any).is_deleted && isDateInBounds(e.date, startDate, endDate)
  );
  const operatingExpenses = Number(
    filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0).toFixed(2)
  );

  // Total Disbursements = Purchases Paid + Operating Expenses + Owner Withdrawals + Sales Return Cash Refunds
  const totalDisbursements = Number(
    (purchaseDisbursements + operatingExpenses + ownerWithdrawals + salesReturnRefunds).toFixed(2)
  );

  // Net Cash Position = Total Cash Collected - Total Disbursements
  const netCashPosition = Number(
    (totalCashCollected - totalDisbursements).toFixed(2)
  );

  return {
    totalSalesRevenue,
    grossSalesRevenue,
    totalSalesReturns,
    salesCashCollected,
    capitalInjected,
    customerAdvancesReceived,
    totalCashCollected,
    totalUncollectedCredit,
    totalOutstandingAdvances,
    totalPurchasesSpend,
    purchaseDisbursements,
    operatingExpenses,
    ownerWithdrawals,
    salesReturnRefunds,
    totalDisbursements,
    netCashPosition,
    netCashflow: netCashPosition,
    customerSummaries,
    supplierSummaries,
  };
};

/**
 * Authoritative helper to get the local calendar month key and bounds.
 * Always respects the user's local timezone (avoiding UTC day/month shift bugs).
 */
export const getLocalMonthBounds = (targetDate: Date = new Date()): {
  year: number;
  month: number; // 1-12
  monthKey: string; // 'YYYY-MM'
  monthName: string; // e.g. 'September 2026'
  startDate: string; // 'YYYY-MM-01'
  endDate: string; // 'YYYY-MM-DD' (last day of month)
} => {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = String(lastDay).padStart(2, '0');
  const monthName = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  return {
    year,
    month,
    monthKey,
    monthName,
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${lastDayStr}`,
  };
};

/**
 * Tests whether an expense date falls within a target calendar month (in local time).
 * Robust against ISO strings with timezones, YYYY-MM-DD strings, etc.
 */
export const isExpenseInCalendarMonth = (
  expenseDate?: string,
  targetYear?: number,
  targetMonth?: number // 1-12
): boolean => {
  if (!expenseDate) return false;

  const now = new Date();
  const year = targetYear ?? now.getFullYear();
  const month = targetMonth ?? (now.getMonth() + 1);
  const targetPrefix = `${year}-${String(month).padStart(2, '0')}`;

  // 1. Direct YYYY-MM prefix match (covers '2026-09-10...', '2026-09')
  if (expenseDate.slice(0, 7) === targetPrefix) {
    return true;
  }

  // 2. Parse Date object as fallback
  const d = new Date(expenseDate);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  }

  return false;
};

export interface MonthlyOverheadsSummary {
  total: number;
  expenses: Expense[];
  count: number;
  monthKey: string;
  monthName: string;
  startDate: string;
  endDate: string;
  categoryBreakdown: { category: string; amount: number; count: number; percentage: number }[];
}

/**
 * Authoritative global calculation source for "This Month's Overheads / Operating Expenses".
 * 
 * Sums all physical expense records (rent, electricity, salaries, maintenance, transport, etc.)
 * falling within the specified calendar month (defaulting to the current local month),
 * strictly excluding any archived or deleted expense entries.
 */
export const calculateMonthlyOverheads = (
  expenses: Expense[],
  targetDate: Date = new Date()
): MonthlyOverheadsSummary => {
  const bounds = getLocalMonthBounds(targetDate);

  const validExpenses = (expenses || []).filter(e => {
    // Exclude archived or soft-deleted entries
    if ((e as any).is_archived || (e as any).is_deleted) return false;
    // Exclude zero or invalid amounts
    if (!e.date || Number(e.amount || 0) <= 0) return false;
    return isExpenseInCalendarMonth(e.date, bounds.year, bounds.month);
  });

  const total = Number(
    validExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0).toFixed(2)
  );

  // Group by category
  const catMap: Record<string, { category: string; amount: number; count: number }> = {};
  validExpenses.forEach(e => {
    const cat = e.category || 'Other';
    if (!catMap[cat]) {
      catMap[cat] = { category: cat, amount: 0, count: 0 };
    }
    catMap[cat].amount += Number(e.amount || 0);
    catMap[cat].count += 1;
  });

  const categoryBreakdown = Object.values(catMap)
    .map(c => ({
      ...c,
      amount: Number(c.amount.toFixed(2)),
      percentage: total > 0 ? Number(((c.amount / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    total,
    expenses: validExpenses,
    count: validExpenses.length,
    monthKey: bounds.monthKey,
    monthName: bounds.monthName,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    categoryBreakdown,
  };
};

/**
 * Quick helper to get the single authoritative total for This Month's Overheads
 */
export const calculateCurrentMonthOverheads = (expenses: Expense[]): number => {
  return calculateMonthlyOverheads(expenses).total;
};
