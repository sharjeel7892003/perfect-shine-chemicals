import React, { useState } from 'react';
import { 
  CreditCard, 
  Search, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Wallet,
  BookOpen,
  Calendar,
  Building2,
  Users,
  Printer,
  FileText,
  CheckCircle2,
  Landmark,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Payment, PaymentMethod } from '../../types';
import { formatPKR, formatDate, formatDateTime, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { calculateFinancialMetrics, calculateCustomerFinancials, calculateSupplierFinancials } from '../../utils/financialEngine';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { CustomerStatementModal } from '../customers/CustomerStatementModal';
import { SupplierStatementModal } from '../suppliers/SupplierStatementModal';

export const PaymentsModule: React.FC = () => {
  const { 
    payments, 
    customers, 
    suppliers, 
    sales, 
    purchases, 
    expenses, 
    recordPayment,
    recordCapitalInjection,
    recordOwnerWithdrawal,
    recordCustomerAdvance 
  } = useApp();
  const { isOwner, canManagePurchases } = useAuth();

  const [activeTab, setActiveTab] = useState<'vouchers' | 'customer_ledger' | 'supplier_ledger'>('vouchers');
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal States
  const [isCustomerPayModalOpen, setIsCustomerPayModalOpen] = useState(false);
  const [isSupplierPayModalOpen, setIsSupplierPayModalOpen] = useState(false);
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);

  // Customer Payment Form State
  const [custPaymentDate, setCustPaymentDate] = useState<string>(getTodayDateString());
  const [selectedCustId, setSelectedCustId] = useState('');
  const [linkedSaleId, setLinkedSaleId] = useState('');
  const [custPayAmount, setCustPayAmount] = useState<number>(0);
  const [custPayMethod, setCustPayMethod] = useState<PaymentMethod>('cash');
  const [custPayRef, setCustPayRef] = useState('');
  const [custPayNotes, setCustPayNotes] = useState('');

  // Supplier Payment Form State
  const [suppPaymentDate, setSuppPaymentDate] = useState<string>(getTodayDateString());
  const [selectedSuppId, setSelectedSuppId] = useState('');
  const [linkedPurchaseId, setLinkedPurchaseId] = useState('');
  const [suppPayAmount, setSuppPayAmount] = useState<number>(0);
  const [suppPayMethod, setSuppPayMethod] = useState<PaymentMethod>('bank');
  const [suppPayRef, setSuppPayRef] = useState('');
  const [suppPayNotes, setSuppPayNotes] = useState('');

  // Owner Capital Injection Form State
  const [capitalDate, setCapitalDate] = useState<string>(getTodayDateString());
  const [capitalAmount, setCapitalAmount] = useState<number>(0);
  const [capitalMethod, setCapitalMethod] = useState<PaymentMethod>('bank');
  const [capitalRef, setCapitalRef] = useState('');
  const [capitalNotes, setCapitalNotes] = useState('');

  // Owner Withdrawal Form State
  const [withdrawalDate, setWithdrawalDate] = useState<string>(getTodayDateString());
  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(0);
  const [withdrawalMethod, setWithdrawalMethod] = useState<PaymentMethod>('bank');
  const [withdrawalRef, setWithdrawalRef] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');

  // Customer Advance Payment Form State
  const [advanceDate, setAdvanceDate] = useState<string>(getTodayDateString());
  const [advanceCustId, setAdvanceCustId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('bank');
  const [advanceRef, setAdvanceRef] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');

  // Ledger state
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string>(customers[0]?.id || '');
  const [ledgerSupplierId, setLedgerSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('');
  const [isCustStatementOpen, setIsCustStatementOpen] = useState<boolean>(false);
  const [isSuppStatementOpen, setIsSuppStatementOpen] = useState<boolean>(false);

  // Authoritative cashflow calculations from central financialEngine
  const financialMetrics = calculateFinancialMetrics({
    sales,
    purchases,
    payments,
    expenses,
    customers,
    suppliers,
  });

  const totalInflow = financialMetrics.totalCashCollected;
  const totalOutflow = financialMetrics.totalDisbursements;
  const netCashPosition = financialMetrics.netCashPosition;

  // Selected customer/supplier helpers
  const currentSelectedCustomer = customers.find(c => c.id === selectedCustId);
  const customerUnpaidSales = selectedCustId 
    ? sales.filter(s => s.customer_id === selectedCustId && s.payment_status !== 'paid') 
    : [];

  const currentSelectedSupplier = suppliers.find(s => s.id === selectedSuppId);
  const supplierUnpaidPurchases = selectedSuppId 
    ? purchases.filter(p => p.supplier_id === selectedSuppId && p.payment_status !== 'paid') 
    : [];

  // When customer changes in modal, autofill
  const handleCustomerSelect = (custId: string) => {
    setSelectedCustId(custId);
    setLinkedSaleId('');
    const target = customers.find(c => c.id === custId);
    if (target) {
      const summary = calculateCustomerFinancials(target, sales, payments);
      setCustPayAmount(summary.outstandingReceivable);
    } else {
      setCustPayAmount(0);
    }
  };

  // When sale selected in customer pay modal
  const handleSaleSelect = (saleId: string) => {
    setLinkedSaleId(saleId);
    if (saleId) {
      const sale = sales.find(s => s.id === saleId);
      if (sale) {
        const due = Math.max(0, sale.total_amount - sale.amount_paid);
        setCustPayAmount(due);
      }
    } else {
      if (currentSelectedCustomer) {
        const summary = calculateCustomerFinancials(currentSelectedCustomer, sales, payments);
        setCustPayAmount(summary.outstandingReceivable);
      }
    }
  };

  // When supplier changes in modal
  const handleSupplierSelect = (suppId: string) => {
    setSelectedSuppId(suppId);
    setLinkedPurchaseId('');
    const target = suppliers.find(s => s.id === suppId);
    if (target) {
      const summary = calculateSupplierFinancials(target, purchases, payments);
      setSuppPayAmount(summary.outstandingPayable);
    } else {
      setSuppPayAmount(0);
    }
  };

  const handlePurchaseSelect = (poId: string) => {
    setLinkedPurchaseId(poId);
    if (poId) {
      const po = purchases.find(p => p.id === poId);
      if (po) {
        const due = Math.max(0, po.total_amount - po.amount_paid);
        setSuppPayAmount(due);
      }
    } else {
      if (currentSelectedSupplier) {
        setSuppPayAmount(currentSelectedSupplier.current_balance || 0);
      }
    }
  };

  // Submit Customer Payment
  const handleSubmitCustomerPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustId || custPayAmount <= 0) {
      alert('Please select a customer and enter a valid amount.');
      return;
    }

    const cust = customers.find(c => c.id === selectedCustId);
    const sale = sales.find(s => s.id === linkedSaleId);

    recordPayment({
      related_to: linkedSaleId ? 'sale' : 'customer_balance',
      reference_id: linkedSaleId || undefined,
      reference_no: sale ? sale.invoice_number : undefined,
      customer_id: selectedCustId,
      customer_name: cust?.name,
      amount: custPayAmount,
      payment_method: custPayMethod,
      transaction_ref: custPayRef,
      notes: custPayNotes || (linkedSaleId ? `Settlement for invoice ${sale?.invoice_number}` : 'General customer credit balance settlement'),
      date: formatSelectedDateToIso(custPaymentDate),
    });

    setIsCustomerPayModalOpen(false);
    setSelectedCustId('');
    setLinkedSaleId('');
    setCustPayAmount(0);
    setCustPayRef('');
    setCustPayNotes('');
    setCustPaymentDate(getTodayDateString());
  };

  // Submit Supplier Payment
  const handleSubmitSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuppId || suppPayAmount <= 0) {
      alert('Please select a supplier and enter a valid amount.');
      return;
    }

    const supp = suppliers.find(s => s.id === selectedSuppId);
    const po = purchases.find(p => p.id === linkedPurchaseId);

    recordPayment({
      related_to: linkedPurchaseId ? 'purchase' : 'supplier_balance',
      reference_id: linkedPurchaseId || undefined,
      reference_no: po ? po.invoice_number : undefined,
      supplier_id: selectedSuppId,
      supplier_name: supp?.name,
      amount: suppPayAmount,
      payment_method: suppPayMethod,
      transaction_ref: suppPayRef,
      notes: suppPayNotes || (linkedPurchaseId ? `Payment for PO ${po?.invoice_number}` : 'Supplier balance settlement'),
      date: formatSelectedDateToIso(suppPaymentDate),
    });

    setIsSupplierPayModalOpen(false);
    setSelectedSuppId('');
    setLinkedPurchaseId('');
    setSuppPayAmount(0);
    setSuppPayRef('');
    setSuppPayNotes('');
    setSuppPaymentDate(getTodayDateString());
  };

  // Submit Capital Injection
  const handleSubmitCapital = (e: React.FormEvent) => {
    e.preventDefault();
    if (capitalAmount <= 0) {
      alert('Please enter a valid capital injection amount.');
      return;
    }

    recordCapitalInjection({
      amount: capitalAmount,
      payment_method: capitalMethod,
      transaction_ref: capitalRef,
      notes: capitalNotes || 'Owner personal capital injection into business',
      date: formatSelectedDateToIso(capitalDate),
    });

    setIsCapitalModalOpen(false);
    setCapitalAmount(0);
    setCapitalRef('');
    setCapitalNotes('');
    setCapitalDate(getTodayDateString());
  };

  // Submit Owner Withdrawal
  const handleSubmitWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawalAmount <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }

    recordOwnerWithdrawal({
      amount: withdrawalAmount,
      payment_method: withdrawalMethod,
      transaction_ref: withdrawalRef,
      notes: withdrawalNotes || 'Owner drawings / withdrawal for personal use',
      date: formatSelectedDateToIso(withdrawalDate),
    });

    setIsWithdrawalModalOpen(false);
    setWithdrawalAmount(0);
    setWithdrawalRef('');
    setWithdrawalNotes('');
    setWithdrawalDate(getTodayDateString());
  };

  // Submit Customer Advance
  const handleSubmitAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceCustId || advanceAmount <= 0) {
      alert('Please select a customer and enter a valid advance amount.');
      return;
    }

    const cust = customers.find(c => c.id === advanceCustId);

    recordCustomerAdvance({
      customer_id: advanceCustId,
      customer_name: cust?.name || 'Customer',
      amount: advanceAmount,
      payment_method: advanceMethod,
      transaction_ref: advanceRef,
      notes: advanceNotes || `Customer advance deposit from ${cust?.name || 'Customer'}`,
      date: formatSelectedDateToIso(advanceDate),
    });

    setIsAdvanceModalOpen(false);
    setAdvanceCustId('');
    setAdvanceAmount(0);
    setAdvanceRef('');
    setAdvanceNotes('');
    setAdvanceDate(getTodayDateString());
  };

  // Filtered Vouchers List
  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      (p.customer_name && p.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.reference_no && p.reference_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.transaction_ref && p.transaction_ref.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesChannel = channelFilter === 'all' || p.payment_method === channelFilter;
    const matchesType = 
      typeFilter === 'all' || 
      (typeFilter === 'inflow' && (p.related_to === 'sale' || p.related_to === 'customer_balance' || p.related_to === 'capital_injection' || p.related_to === 'customer_advance')) ||
      (typeFilter === 'outflow' && (p.related_to === 'purchase' || p.related_to === 'supplier_balance' || p.related_to === 'expense' || p.related_to === 'owner_withdrawal')) ||
      (typeFilter === 'capital' && p.related_to === 'capital_injection') ||
      (typeFilter === 'drawings' && p.related_to === 'owner_withdrawal') ||
      (typeFilter === 'advance' && p.related_to === 'customer_advance') ||
      (typeFilter === 'expense' && p.related_to === 'expense');

    return matchesSearch && matchesChannel && matchesType;
  });

  // ================= GENERATE CUSTOMER LEDGER TRANSACTIONS =================
  const selectedLedgerCustomer = customers.find(c => c.id === ledgerCustomerId);
  
  const getCustomerLedgerRows = () => {
    if (!selectedLedgerCustomer) return [];

    const rows: {
      date: string;
      ref: string;
      description: string;
      method?: string;
      debit: number;   // Sales amount increases receivable
      credit: number;  // Payment decreases receivable
      balance: number; // Running balance
    }[] = [];

    // Get all sales for this customer
    const custSales = sales.filter(s => s.customer_id === ledgerCustomerId);
    custSales.forEach(sale => {
      rows.push({
        date: sale.date,
        ref: sale.invoice_number,
        description: `Sale Invoice (${sale.items.length} items)`,
        debit: sale.total_amount,
        credit: 0,
        balance: 0,
      });
      // If sale had immediate payment at checkout
      if (sale.amount_paid > 0) {
        rows.push({
          date: sale.date,
          ref: `${sale.invoice_number} (Pay)`,
          description: `Payment received at invoice generation`,
          method: sale.payment_method,
          debit: 0,
          credit: sale.amount_paid,
          balance: 0,
        });
      }
    });

    // Get all direct payments recorded (balance settlements & advances)
    const custPayments = payments.filter(p => p.customer_id === ledgerCustomerId && (p.related_to === 'customer_balance' || p.related_to === 'customer_advance'));
    custPayments.forEach(pay => {
      rows.push({
        date: pay.date,
        ref: pay.transaction_ref || pay.reference_no || (pay.related_to === 'customer_advance' ? 'ADV' : 'REC'),
        description: pay.notes || (pay.related_to === 'customer_advance' ? 'Customer advance deposit' : 'Payment receipt voucher'),
        method: pay.payment_method,
        debit: 0,
        credit: pay.amount,
        balance: 0,
      });
    });

    // Sort chronologically ascending to calculate running balance
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    rows.forEach(r => {
      running = running + r.debit - r.credit;
      r.balance = running;
    });

    // Apply date filters if any
    return rows.filter(r => {
      if (ledgerStartDate && new Date(r.date) < new Date(ledgerStartDate)) return false;
      if (ledgerEndDate && new Date(r.date) > new Date(ledgerEndDate + 'T23:59:59')) return false;
      return true;
    });
  };

  // ================= GENERATE SUPPLIER LEDGER TRANSACTIONS =================
  const selectedLedgerSupplier = suppliers.find(s => s.id === ledgerSupplierId);

  const getSupplierLedgerRows = () => {
    if (!selectedLedgerSupplier) return [];

    const rows: {
      date: string;
      ref: string;
      description: string;
      method?: string;
      debit: number;   // Payment made decreases factory payable
      credit: number;  // Purchase bill increases factory payable
      balance: number; // Running balance
    }[] = [];

    const suppPurchases = purchases.filter(p => p.supplier_id === ledgerSupplierId);
    suppPurchases.forEach(po => {
      rows.push({
        date: po.date,
        ref: po.invoice_number,
        description: `Purchase Order (${po.items.map(i => i.product_or_material_name).join(', ')})`,
        debit: 0,
        credit: po.total_amount,
        balance: 0,
      });

      if (po.amount_paid > 0) {
        rows.push({
          date: po.date,
          ref: `${po.invoice_number} (Paid)`,
          description: `Disbursement at purchase order entry`,
          method: po.payment_method,
          debit: po.amount_paid,
          credit: 0,
          balance: 0,
        });
      }
    });

    const suppPayments = payments.filter(p => p.supplier_id === ledgerSupplierId && p.related_to === 'supplier_balance');
    suppPayments.forEach(pay => {
      rows.push({
        date: pay.date,
        ref: pay.transaction_ref || pay.reference_no || 'DISB',
        description: pay.notes || 'Supplier settlement payment',
        method: pay.payment_method,
        debit: pay.amount,
        credit: 0,
        balance: 0,
      });
    });

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    rows.forEach(r => {
      running = running + r.credit - r.debit;
      r.balance = running;
    });

    return rows.filter(r => {
      if (ledgerStartDate && new Date(r.date) < new Date(ledgerStartDate)) return false;
      if (ledgerEndDate && new Date(r.date) > new Date(ledgerEndDate + 'T23:59:59')) return false;
      return true;
    });
  };

  const customerLedgerRows = getCustomerLedgerRows();
  const supplierLedgerRows = getSupplierLedgerRows();

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Quick Entry Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            <span>Payments & Account Ledgers</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit customer receipts, supplier disbursements, and cumulative running balance statements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setCustPaymentDate(getTodayDateString());
              setIsCustomerPayModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Receive Payment</span>
          </button>

          <button
            onClick={() => {
              setAdvanceDate(getTodayDateString());
              setIsAdvanceModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all active:scale-95 shadow-sm"
          >
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <span>Customer Advance (+)</span>
          </button>

          {canManagePurchases && (
            <button
              onClick={() => {
                setSuppPaymentDate(getTodayDateString());
                setIsSupplierPayModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-all active:scale-95"
            >
              <ArrowUpRight className="w-4 h-4 text-rose-400" />
              <span>Pay Supplier Bill</span>
            </button>
          )}

          {isOwner && (
            <>
              <button
                onClick={() => {
                  setCapitalDate(getTodayDateString());
                  setIsCapitalModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold border border-indigo-500/30 transition-all active:scale-95 shadow-sm"
              >
                <Landmark className="w-4 h-4 text-indigo-400" />
                <span>Capital Injection (+)</span>
              </button>

              <button
                onClick={() => {
                  setWithdrawalDate(getTodayDateString());
                  setIsWithdrawalModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all active:scale-95 shadow-sm"
              >
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
                <span>Owner Drawings (-)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top Level Tab Navigation */}
      <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('vouchers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'vouchers'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Vouchers ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('customer_ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'customer_ledger'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customer Running Ledger</span>
        </button>

        {canManagePurchases && (
          <button
            onClick={() => setActiveTab('supplier_ledger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'supplier_ledger'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Supplier Running Ledger</span>
          </button>
        )}
      </div>

      {/* ================= VIEW 1: VOUCHERS LIST ================= */}
      {activeTab === 'vouchers' && (
        <div className="space-y-6">
          {/* Cashflow Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Inflow */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cash Inflow</p>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5 stroke-[2.5px]" />
                </div>
              </div>
              <p className="text-xl font-black text-emerald-400 mt-2 font-mono">{formatPKR(totalInflow)}</p>
              <div className="text-[10px] text-slate-400 mt-1.5 flex flex-wrap gap-x-2">
                <span>Sales: <strong className="text-slate-300 font-mono">{formatPKR(financialMetrics.salesCashCollected)}</strong></span>
                {financialMetrics.capitalInjected > 0 && (
                  <span>• Cap: <strong className="text-indigo-400 font-mono">{formatPKR(financialMetrics.capitalInjected)}</strong></span>
                )}
                {financialMetrics.customerAdvancesReceived > 0 && (
                  <span>• Adv: <strong className="text-cyan-400 font-mono">{formatPKR(financialMetrics.customerAdvancesReceived)}</strong></span>
                )}
              </div>
            </div>

            {/* Total Outflow */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cash Outflow</p>
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 stroke-[2.5px]" />
                </div>
              </div>
              <p className="text-xl font-black text-rose-400 mt-2 font-mono">{formatPKR(totalOutflow)}</p>
              <div className="text-[10px] text-slate-400 mt-1.5 flex flex-wrap gap-x-2">
                <span>Purchases: <strong className="text-slate-300 font-mono">{formatPKR(financialMetrics.purchaseDisbursements)}</strong></span>
                <span>• Exp: <strong className="text-amber-300 font-mono">{formatPKR(financialMetrics.operatingExpenses)}</strong></span>
                {financialMetrics.ownerWithdrawals > 0 && (
                  <span>• Draw: <strong className="text-rose-400 font-mono">{formatPKR(financialMetrics.ownerWithdrawals)}</strong></span>
                )}
              </div>
            </div>

            {/* Outstanding Customer Advances (Liability) */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Advances Held</p>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xl font-black text-cyan-400 mt-2 font-mono">{formatPKR(financialMetrics.totalOutstandingAdvances)}</p>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Unallocated advance liability owed to customers
              </p>
            </div>

            {/* Net Cash Position */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Cash Position</p>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <p className={`text-xl font-black mt-2 font-mono ${netCashPosition >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPKR(netCashPosition)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1.5">
                All Cash In − All Cash Out (Liquid Bank & Cash)
              </p>
            </div>
          </div>

          {/* Vouchers Table Card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search reference, client, or TID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="all">All Inflow & Outflow</option>
                  <option value="inflow">All Inflow (Sales, Capital, Advances)</option>
                  <option value="outflow">All Outflow (Suppliers, Expenses, Drawings)</option>
                  <option value="capital">Owner Capital Injections (+)</option>
                  <option value="drawings">Owner Withdrawals (-)</option>
                  <option value="advance">Customer Advances (+)</option>
                  <option value="expense">Operating Overheads (-)</option>
                </select>

                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="all">All Payment Channels</option>
                  <option value="cash">Cash Counter</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Party / Account</th>
                    <th className="py-3 px-3">Transaction Type</th>
                    <th className="py-3 px-3">Channel / Method</th>
                    <th className="py-3 px-3">Reference / Notes</th>
                    <th className="py-3 px-3 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No payment vouchers found
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const isCapital = p.related_to === 'capital_injection';
                      const isWithdrawal = p.related_to === 'owner_withdrawal';
                      const isAdvance = p.related_to === 'customer_advance';
                      const isInflow = p.related_to === 'sale' || p.related_to === 'customer_balance' || isCapital || isAdvance;
                      const isExpense = p.related_to === 'expense';

                      const partyName = isCapital
                        ? 'Owner Equity (Capital Injection)'
                        : isWithdrawal
                        ? 'Owner Drawings (Personal Withdrawal)'
                        : isAdvance
                        ? `${p.customer_name || 'Customer'} (Advance Deposit)`
                        : isExpense 
                        ? `Overhead: ${p.reference_no || 'Expense'}` 
                        : (p.customer_name || p.supplier_name || 'Walk-in Retail');

                      const badgeVariant = isCapital 
                        ? 'blue' 
                        : isWithdrawal 
                        ? 'amber' 
                        : isAdvance 
                        ? 'blue' 
                        : isExpense 
                        ? 'amber' 
                        : (isInflow ? 'emerald' : 'rose');

                      const badgeText = isCapital 
                        ? 'Capital (+)' 
                        : isWithdrawal 
                        ? 'Drawings (-)' 
                        : isAdvance 
                        ? 'Advance (+)' 
                        : isExpense 
                        ? 'Expense (-)' 
                        : (isInflow ? 'Receipt (+)' : 'Disbursement (-)');

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 text-slate-400 font-mono">{formatDateTime(p.date)}</td>
                          <td className="py-3 px-3 font-bold text-white">
                            <span className={isCapital ? 'text-indigo-300' : isAdvance ? 'text-cyan-300' : isWithdrawal ? 'text-amber-300' : isExpense ? 'text-amber-300' : 'text-white'}>
                              {partyName}
                            </span>
                          </td>
                          <td className="py-3 px-3 capitalize">
                            <Badge variant={badgeVariant}>
                              {badgeText}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 capitalize text-slate-300 font-medium">
                            {p.payment_method}
                          </td>
                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                            {p.reference_no ? <strong className="text-white mr-1">{p.reference_no}</strong> : null}
                            {p.transaction_ref ? <span className="font-mono text-emerald-400 mr-1">[{p.transaction_ref}]</span> : null}
                            {p.notes || '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                            <span className={isInflow ? 'text-emerald-400' : 'text-rose-400'}>
                              {isInflow ? '+' : '-'}{formatPKR(p.amount)}
                            </span>
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

      {/* ================= VIEW 2: CUSTOMER LEDGER STATEMENT ================= */}
      {activeTab === 'customer_ledger' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
          {/* Customer Picker & Date Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Customer / Client
              </label>
              <select
                value={ledgerCustomerId}
                onChange={(e) => setLedgerCustomerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customer_type}) • Outstanding: {formatPKR(c.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">From Date</label>
              <input
                type="date"
                value={ledgerStartDate}
                onChange={(e) => setLedgerStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">To Date</label>
              <input
                type="date"
                value={ledgerEndDate}
                onChange={(e) => setLedgerEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          {/* Customer Summary Header */}
          {selectedLedgerCustomer && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-950/60 border border-slate-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">{selectedLedgerCustomer.name}</h3>
                  <Badge variant="blue">{selectedLedgerCustomer.customer_type}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Phone: <span className="font-mono text-slate-200">{selectedLedgerCustomer.phone}</span> | Location: {selectedLedgerCustomer.address}, {selectedLedgerCustomer.city}
                </p>
              </div>

              <div className="flex items-center gap-4 text-right">
                <button
                  type="button"
                  onClick={() => setIsCustStatementOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all active:scale-95"
                  title="Print Customer Statement or Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Statement</span>
                </button>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Credit Limit</span>
                  <p className="text-sm font-mono text-slate-300">{formatPKR(selectedLedgerCustomer.credit_limit)}</p>
                </div>
                <div className="pl-4 border-l border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Current Outstanding Balance</span>
                  <p className={`text-xl font-black font-mono ${selectedLedgerCustomer.current_balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {formatPKR(selectedLedgerCustomer.current_balance)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chronological Ledger Table with Running Balance */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Ref / Invoice #</th>
                  <th className="py-3 px-3">Description / Mode</th>
                  <th className="py-3 px-3 text-right">Debit (+) / Invoiced</th>
                  <th className="py-3 px-3 text-right">Credit (-) / Paid</th>
                  <th className="py-3 px-3 text-right">Running Balance (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customerLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No ledger transactions found for the selected period.
                    </td>
                  </tr>
                ) : (
                  customerLedgerRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono">{formatDate(row.date)}</td>
                      <td className="py-3 px-3 font-mono font-bold text-white">{row.ref}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {row.description}
                        {row.method && <span className="ml-2 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{row.method}</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                        {row.debit > 0 ? formatPKR(row.debit) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">
                        {row.credit > 0 ? formatPKR(row.credit) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-sm">
                        <span className={row.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          {formatPKR(row.balance)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW 3: SUPPLIER LEDGER STATEMENT ================= */}
      {activeTab === 'supplier_ledger' && canManagePurchases && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
          {/* Supplier Picker & Date Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Supplier / Vendor
              </label>
              <select
                value={ledgerSupplierId}
                onChange={(e) => setLedgerSupplierId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.raw_material_type}) • Factory Due: {formatPKR(s.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">From Date</label>
              <input
                type="date"
                value={ledgerStartDate}
                onChange={(e) => setLedgerStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">To Date</label>
              <input
                type="date"
                value={ledgerEndDate}
                onChange={(e) => setLedgerEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          {/* Supplier Summary Header */}
          {selectedLedgerSupplier && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-950/60 border border-slate-800 gap-4">
              <div>
                <h3 className="text-lg font-black text-white">{selectedLedgerSupplier.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Raw Material: <span className="text-slate-200">{selectedLedgerSupplier.raw_material_type}</span> | Phone: {selectedLedgerSupplier.phone}
                </p>
              </div>

              <div className="flex items-center gap-4 text-right">
                <button
                  type="button"
                  onClick={() => setIsSuppStatementOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-all active:scale-95"
                  title="Print Supplier Statement or Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Statement</span>
                </button>
                <div className="pl-4 border-l border-slate-800 text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Factory Total Payable</span>
                  <p className={`text-xl font-black font-mono ${selectedLedgerSupplier.current_balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatPKR(selectedLedgerSupplier.current_balance)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Supplier Chronological Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Ref / PO #</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3 text-right">Debit (-) / Paid Out</th>
                  <th className="py-3 px-3 text-right">Credit (+) / Purchase Billed</th>
                  <th className="py-3 px-3 text-right">Payable Balance (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {supplierLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No purchase or payment history found for this supplier in the selected period.
                    </td>
                  </tr>
                ) : (
                  supplierLedgerRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono">{formatDate(row.date)}</td>
                      <td className="py-3 px-3 font-mono font-bold text-white">{row.ref}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {row.description}
                        {row.method && <span className="ml-2 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{row.method}</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-rose-400">
                        {row.debit > 0 ? formatPKR(row.debit) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                        {row.credit > 0 ? formatPKR(row.credit) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-sm">
                        <span className={row.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          {formatPKR(row.balance)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECEIVE CUSTOMER PAYMENT ================= */}
      <Modal
        isOpen={isCustomerPayModalOpen}
        onClose={() => setIsCustomerPayModalOpen(false)}
        title="Record Customer Payment Receipt"
        subtitle="Collect cash, bank transfer, JazzCash or EasyPaisa against an invoice or account balance"
      >
        <form onSubmit={handleSubmitCustomerPayment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Payment Date *</span>
              </label>
              <input
                type="date"
                required
                value={custPaymentDate}
                onChange={(e) => setCustPaymentDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Customer / Client *
              </label>
              <select
                required
                value={selectedCustId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                <option value="">Select customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customer_type}) • Total Due: {formatPKR(c.current_balance)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCustId && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Link to Specific Invoice (Optional)
              </label>
              <select
                value={linkedSaleId}
                onChange={(e) => handleSaleSelect(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">General Account Credit (No specific invoice)</option>
                {customerUnpaidSales.map(s => {
                  const unpaid = s.total_amount - s.amount_paid;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.invoice_number} ({formatDate(s.date)}) — Total: {formatPKR(s.total_amount)} (Unpaid: {formatPKR(unpaid)})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Amount Received (PKR)
              </label>
              <input
                type="number"
                min="1"
                required
                value={custPayAmount || ''}
                onChange={(e) => setCustPayAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Payment Channel
              </label>
              <select
                value={custPayMethod}
                onChange={(e) => setCustPayMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="cash">Cash Counter Receipt</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="bank">Bank Transfer (HBL / MCB)</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                TID / Cheque / Slip Ref
              </label>
              <input
                type="text"
                value={custPayRef}
                onChange={(e) => setCustPayRef(e.target.value)}
                placeholder="e.g. JC-889921 or Chq #409"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Notes
              </label>
              <input
                type="text"
                value={custPayNotes}
                onChange={(e) => setCustPayNotes(e.target.value)}
                placeholder="e.g. Partial clearing from Anarkali shop"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCustomerPayModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all"
            >
              Confirm Receipt ({formatPKR(custPayAmount)})
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: PAY SUPPLIER ================= */}
      <Modal
        isOpen={isSupplierPayModalOpen}
        onClose={() => setIsSupplierPayModalOpen(false)}
        title="Record Supplier Outgoing Payment"
        subtitle="Disburse funds to chemical or packaging suppliers via Bank, Cash, or Digital wallet"
      >
        <form onSubmit={handleSubmitSupplierPayment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Payment Date *</span>
              </label>
              <input
                type="date"
                required
                value={suppPaymentDate}
                onChange={(e) => setSuppPaymentDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Supplier / Vendor *
              </label>
              <select
                required
                value={selectedSuppId}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.raw_material_type}) • Total Due: {formatPKR(s.current_balance)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSuppId && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Link to Purchase Order (Optional)
              </label>
              <select
                value={linkedPurchaseId}
                onChange={(e) => handlePurchaseSelect(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">General Supplier Balance (No specific PO)</option>
                {supplierUnpaidPurchases.map(p => {
                  const unpaid = p.total_amount - p.amount_paid;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.invoice_number} ({formatDate(p.date)}) — Total: {formatPKR(p.total_amount)} (Unpaid: {formatPKR(unpaid)})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Payment Amount (PKR)
              </label>
              <input
                type="number"
                min="1"
                required
                value={suppPayAmount || ''}
                onChange={(e) => setSuppPayAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Payment Method
              </label>
              <select
                value={suppPayMethod}
                onChange={(e) => setSuppPayMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="bank">Bank Transfer (HBL Online)</option>
                <option value="cash">Cash Voucher</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="cheque">Bank Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Cheque # / Online Bank Ref
              </label>
              <input
                type="text"
                value={suppPayRef}
                onChange={(e) => setSuppPayRef(e.target.value)}
                placeholder="e.g. HBL-FT-99120"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Notes
              </label>
              <input
                type="text"
                value={suppPayNotes}
                onChange={(e) => setSuppPayNotes(e.target.value)}
                placeholder="e.g. LABSA 96% raw material batch payment"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsSupplierPayModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-lg transition-all"
            >
              Confirm Disbursement ({formatPKR(suppPayAmount)})
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: OWNER CAPITAL INJECTION ================= */}
      <Modal
        isOpen={isCapitalModalOpen}
        onClose={() => setIsCapitalModalOpen(false)}
        title="Record Owner Capital Injection"
        subtitle="Deposit owner personal funds into business bank account or cash register to boost liquidity"
      >
        <form onSubmit={handleSubmitCapital} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Deposit Date *</span>
              </label>
              <input
                type="date"
                required
                value={capitalDate}
                onChange={(e) => setCapitalDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Deposit Account / Channel *
              </label>
              <select
                value={capitalMethod}
                onChange={(e) => setCapitalMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="bank">Business Bank Account (HBL / MCB)</option>
                <option value="cash">Factory Cash Drawer</option>
                <option value="jazzcash">JazzCash Business</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="cheque">Bank Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Capital Amount (PKR) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={capitalAmount || ''}
                onChange={(e) => setCapitalAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Bank Deposit Slip / Reference
              </label>
              <input
                type="text"
                value={capitalRef}
                onChange={(e) => setCapitalRef(e.target.value)}
                placeholder="e.g. HBL-DEP-001842"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Description / Notes
            </label>
            <input
              type="text"
              value={capitalNotes}
              onChange={(e) => setCapitalNotes(e.target.value)}
              placeholder="e.g. Owner equity injection for raw materials working capital"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
            <p className="font-semibold flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-indigo-400" />
              <span>Cash Flow Impact:</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-300">
              This will increase your Net Cash Position as liquid money in, clearly classified as owner capital equity (distinct from sales revenue).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCapitalModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black shadow-lg shadow-indigo-500/20 transition-all"
            >
              Confirm Capital Deposit ({formatPKR(capitalAmount)})
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: OWNER WITHDRAWAL / DRAWINGS ================= */}
      <Modal
        isOpen={isWithdrawalModalOpen}
        onClose={() => setIsWithdrawalModalOpen(false)}
        title="Record Owner Drawings / Withdrawal"
        subtitle="Withdraw money from business funds for owner personal use"
      >
        <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Withdrawal Date *</span>
              </label>
              <input
                type="date"
                required
                value={withdrawalDate}
                onChange={(e) => setWithdrawalDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Disbursing Account / Method *
              </label>
              <select
                value={withdrawalMethod}
                onChange={(e) => setWithdrawalMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-semibold"
              >
                <option value="bank">Business Bank Transfer</option>
                <option value="cash">Cash From Counter / Drawer</option>
                <option value="cheque">Owner Cheque</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Withdrawal Amount (PKR) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={withdrawalAmount || ''}
                onChange={(e) => setWithdrawalAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Cheque / Reference No
              </label>
              <input
                type="text"
                value={withdrawalRef}
                onChange={(e) => setWithdrawalRef(e.target.value)}
                placeholder="e.g. Chq #90112"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
              Purpose / Notes
            </label>
            <input
              type="text"
              value={withdrawalNotes}
              onChange={(e) => setWithdrawalNotes(e.target.value)}
              placeholder="e.g. Owner monthly personal drawings"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <p className="font-semibold flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
              <span>Cash Flow Impact:</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-300">
              Drawings reduce your Net Cash Position as money out, but are tracked separately from operational business expenses so they don't distort factory profit.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsWithdrawalModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all"
            >
              Confirm Withdrawal ({formatPKR(withdrawalAmount)})
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: CUSTOMER ADVANCE PAYMENT ================= */}
      <Modal
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        title="Record Customer Advance Payment"
        subtitle="Accept upfront advance funds from a customer before an invoice is issued"
      >
        <form onSubmit={handleSubmitAdvance} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Receipt Date *</span>
              </label>
              <input
                type="date"
                required
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Select Customer *
              </label>
              <select
                required
                value={advanceCustId}
                onChange={(e) => setAdvanceCustId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-semibold"
              >
                <option value="">Choose customer...</option>
                {customers.map(c => {
                  const summary = calculateCustomerFinancials(c, sales, payments);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customer_type}) {summary.advanceBalance > 0 ? `• Held Advance: ${formatPKR(summary.advanceBalance)}` : summary.outstandingReceivable > 0 ? `• Due: ${formatPKR(summary.outstandingReceivable)}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Advance Amount (PKR) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={advanceAmount || ''}
                onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Payment Channel *
              </label>
              <select
                value={advanceMethod}
                onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-semibold"
              >
                <option value="bank">Bank Transfer (HBL / MCB)</option>
                <option value="cash">Cash Counter Receipt</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                TID / Slip / Cheque Ref
              </label>
              <input
                type="text"
                value={advanceRef}
                onChange={(e) => setAdvanceRef(e.target.value)}
                placeholder="e.g. ADV-9921 or Online Ref"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Notes
              </label>
              <input
                type="text"
                value={advanceNotes}
                onChange={(e) => setAdvanceNotes(e.target.value)}
                placeholder="e.g. Advance deposit for upcoming 1000L car shampoo order"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
            <p className="font-semibold flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <span>Advance Tracking:</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-300">
              Immediately recorded as Cash In to your Net Cash Position and credited to customer's account as an advance balance. When creating a POS invoice later, you will be prompted to apply this advance balance!
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdvanceModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black shadow-lg shadow-cyan-500/20 transition-all"
            >
              Confirm Advance Receipt ({formatPKR(advanceAmount)})
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Customer Ledger Statement Modal */}
      <CustomerStatementModal
        isOpen={isCustStatementOpen}
        onClose={() => setIsCustStatementOpen(false)}
        customer={selectedLedgerCustomer || null}
        sales={sales}
        payments={payments}
        isOwner={isOwner}
      />

      {/* Printable Supplier Ledger Statement Modal */}
      <SupplierStatementModal
        isOpen={isSuppStatementOpen}
        onClose={() => setIsSuppStatementOpen(false)}
        supplier={selectedLedgerSupplier || null}
        purchases={purchases}
        payments={payments}
        isOwner={isOwner}
      />
    </div>
  );
};
