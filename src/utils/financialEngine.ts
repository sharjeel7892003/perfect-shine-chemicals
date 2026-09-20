import { Sale, Purchase, Payment, Expense, Customer, Supplier } from '../types';

export interface CustomerFinancialSummary {
  customerId: string;
  customerName: string;
  totalSales: number;
  salesPaidOnInvoice: number;
  directAccountPayments: number;
  totalPaymentsCollected: number;
  outstandingReceivable: number;
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
  totalCashCollected: number;
  totalUncollectedCredit: number;
  totalPurchasesSpend: number;
  totalPurchaseDisbursements: number;
  totalOperatingExpenses: number;
  totalDisbursements: number;
  netCashflow: number;
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
 * Reconciles sales invoices and all payment vouchers (both checkout and account settlements).
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

  // Get all customer payments (both invoice-linked payments and direct account payments)
  const custPayments = payments.filter(
    p => p.customer_id === customer.id && (p.related_to === 'sale' || p.related_to === 'customer_balance')
  );

  const directAccountPayments = Number(
    custPayments
      .filter(p => p.related_to === 'customer_balance')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      .toFixed(2)
  );

  const totalPaymentsCollected = Number(
    custPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
  );

  // If customer has explicit sales or payments, calculate exact balance; otherwise fallback to stored current_balance
  let outstandingReceivable = 0;
  if (custSales.length > 0 || custPayments.length > 0) {
    outstandingReceivable = Math.max(0, Number((totalSales - totalPaymentsCollected).toFixed(2)));
  } else {
    outstandingReceivable = Math.max(0, Number(customer.current_balance || 0));
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    totalSales,
    salesPaidOnInvoice,
    directAccountPayments,
    totalPaymentsCollected,
    outstandingReceivable,
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
 * Guarantees that Total Sales, Cash Collected, Uncollected Credit, Purchases,
 * and Disbursements reconcile across every screen.
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

  // 3. Customer Summaries & Receivables
  // Exclude archived customers from active totals unless explicitly selected
  const activeCustomers = customers.filter(c => !c.is_archived || c.id === customerId);
  const customerSummaries = activeCustomers.map(c => calculateCustomerFinancials(c, sales, payments));

  // Determine Uncollected Credit & Cash Collected
  let totalCashCollected = 0;
  let totalUncollectedCredit = 0;

  if (customerId && customerId !== 'all') {
    // Specific customer view
    const custSummary = customerSummaries.find(cs => cs.customerId === customerId);
    if (startDate || endDate) {
      // In a specific period, count payments received in that period for this customer
      const periodPayments = payments.filter(
        p =>
          p.customer_id === customerId &&
          (p.related_to === 'sale' || p.related_to === 'customer_balance') &&
          isDateInBounds(p.date, startDate, endDate)
      );
      totalCashCollected = Number(
        periodPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
      );
      totalUncollectedCredit = Math.max(0, Number((totalSalesRevenue - totalCashCollected).toFixed(2)));
    } else {
      totalCashCollected = custSummary ? custSummary.totalPaymentsCollected : 0;
      totalUncollectedCredit = custSummary ? custSummary.outstandingReceivable : 0;
    }
  } else {
    // Global / All Customers view
    if (startDate || endDate) {
      // For a specific date window, sum incoming payments during that period
      const periodPayments = payments.filter(
        p =>
          (p.related_to === 'sale' || p.related_to === 'customer_balance') &&
          isDateInBounds(p.date, startDate, endDate)
      );
      totalCashCollected = Number(
        periodPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
      );
      // For the selected period's sales, uncollected portion
      totalUncollectedCredit = Math.max(0, Number((totalSalesRevenue - totalCashCollected).toFixed(2)));
    } else {
      // All-time: total cash collected from all inflow payment vouchers
      const allInflowPayments = payments.filter(
        p => p.related_to === 'sale' || p.related_to === 'customer_balance'
      );
      totalCashCollected = Number(
        allInflowPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
      );
      // Total uncollected credit across active customers
      totalUncollectedCredit = Number(
        customerSummaries.reduce((acc, c) => acc + c.outstandingReceivable, 0).toFixed(2)
      );
    }
  }

  // 4. Supplier Summaries & Payables
  const activeSuppliers = suppliers.filter(s => !s.is_archived || s.id === supplierId);
  const supplierSummaries = activeSuppliers.map(s => calculateSupplierFinancials(s, purchases, payments));

  // Determine Purchase Disbursements
  let totalPurchaseDisbursements = 0;
  if (supplierId && supplierId !== 'all') {
    const suppSummary = supplierSummaries.find(ss => ss.supplierId === supplierId);
    if (startDate || endDate) {
      const periodDisb = payments.filter(
        p =>
          p.supplier_id === supplierId &&
          (p.related_to === 'purchase' || p.related_to === 'supplier_balance') &&
          isDateInBounds(p.date, startDate, endDate)
      );
      totalPurchaseDisbursements = Number(
        periodDisb.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
      );
    } else {
      totalPurchaseDisbursements = suppSummary ? suppSummary.totalDisbursementsPaid : 0;
    }
  } else {
    const filteredDisb = payments.filter(
      p =>
        (p.related_to === 'purchase' || p.related_to === 'supplier_balance') &&
        isDateInBounds(p.date, startDate, endDate)
    );
    totalPurchaseDisbursements = Number(
      filteredDisb.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2)
    );
  }

  // 5. Operating Expenses
  const filteredExpenses = expenses.filter(e => isDateInBounds(e.date, startDate, endDate));
  const totalOperatingExpenses = Number(
    filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0).toFixed(2)
  );

  const totalDisbursements = Number(
    (totalPurchaseDisbursements + totalOperatingExpenses).toFixed(2)
  );

  const netCashflow = Number(
    (totalCashCollected - totalDisbursements).toFixed(2)
  );

  return {
    totalSalesRevenue,
    totalCashCollected,
    totalUncollectedCredit,
    totalPurchasesSpend,
    totalPurchaseDisbursements,
    totalOperatingExpenses,
    totalDisbursements,
    netCashflow,
    customerSummaries,
    supplierSummaries,
  };
};
