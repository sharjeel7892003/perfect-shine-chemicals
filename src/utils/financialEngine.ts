import { Sale, Purchase, Payment, Expense, Customer, Supplier } from '../types';

export interface CustomerFinancialSummary {
  customerId: string;
  customerName: string;
  totalSales: number;
  salesPaidOnInvoice: number;
  directAccountPayments: number;
  totalPaymentsCollected: number;
  outstandingReceivable: number;
  advanceBalance: number;
  salesCount: number;
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
  totalDisbursements: number; // Sum of all Outflows: purchaseDisbursements + operatingExpenses + ownerWithdrawals
  
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
  payments: Payment[]
): CustomerFinancialSummary => {
  const custSales = sales.filter(s => s.customer_id === customer.id);
  const totalSales = Number(
    custSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0).toFixed(2)
  );
  const salesPaidOnInvoice = Number(
    custSales.reduce((acc, s) => acc + (Number(s.amount_paid) || 0), 0).toFixed(2)
  );

  // Get all customer payments (invoice-linked, balance settlements, and advance deposits)
  const custPayments = payments.filter(
    p =>
      p.customer_id === customer.id &&
      (p.related_to === 'sale' || p.related_to === 'customer_balance' || p.related_to === 'customer_advance')
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

  let outstandingReceivable = 0;
  let advanceBalance = 0;

  if (custSales.length > 0 || custPayments.length > 0) {
    const netDifference = Number((totalSales - totalPaymentsCollected).toFixed(2));
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
    salesPaidOnInvoice,
    directAccountPayments,
    totalPaymentsCollected,
    outstandingReceivable,
    advanceBalance,
    salesCount: custSales.length,
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
  filters?: FinancialFilterOptions;
}): OverallFinancialMetrics => {
  const {
    sales,
    purchases,
    payments,
    expenses,
    customers,
    suppliers,
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

  const totalSalesRevenue = Number(
    filteredSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0).toFixed(2)
  );

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
  const customerSummaries = activeCustomers.map(c => calculateCustomerFinancials(c, sales, payments));

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
  const filteredExpenses = expenses.filter(e => isDateInBounds(e.date, startDate, endDate));
  const operatingExpenses = Number(
    filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0).toFixed(2)
  );

  // Total Disbursements = Purchases Paid + Operating Expenses + Owner Withdrawals
  const totalDisbursements = Number(
    (purchaseDisbursements + operatingExpenses + ownerWithdrawals).toFixed(2)
  );

  // Net Cash Position = Total Cash Collected - Total Disbursements
  const netCashPosition = Number(
    (totalCashCollected - totalDisbursements).toFixed(2)
  );

  return {
    totalSalesRevenue,
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
    totalDisbursements,
    netCashPosition,
    netCashflow: netCashPosition,
    customerSummaries,
    supplierSummaries,
  };
};
