import React, { useState, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Lock, 
  Unlock, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  CreditCard, 
  ChevronRight, 
  Printer, 
  Sliders, 
  Plus, 
  Edit3, 
  ArrowUpRight, 
  Layers, 
  FileText, 
  X, 
  ShieldCheck, 
  Check, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatPKR, formatDate } from '../../utils/formatters';
import { calculateMonthlyCommissionSummary } from '../../utils/commissionEngine';
import { printElement } from '../../utils/printHelper';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Salesperson, SalespersonCommissionDetail, PaymentMethod } from '../../types';

export const CommissionReportView: React.FC = () => {
  const { 
    sales, 
    salesReturns, 
    expenses, 
    salespersons, 
    monthlyCommissionClosures, 
    commissionPayments, 
    products, 
    rawMaterials,
    closeCommissionMonth,
    reopenCommissionMonth,
    paySalesCommission,
    addSalesperson,
    updateSalesperson
  } = useApp();

  const { currentUser, isOwner } = useAuth();

  // Selected Month (Default to current month 'YYYY-MM')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  const [includeDepreciation, setIncludeDepreciation] = useState<boolean>(false);
  const [drilldownSalesperson, setDrilldownSalesperson] = useState<SalespersonCommissionDetail | null>(null);

  // Month Close / Reopen Modals
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isClosingSubmitting, setIsClosingSubmitting] = useState(false);

  // Pay Commission Modal
  const [payingSalesperson, setPayingSalesperson] = useState<SalespersonCommissionDetail | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState<string>('');
  const [isPaySubmitting, setIsPaySubmitting] = useState(false);

  // Salespeople Management Modal
  const [isManageSalespeopleOpen, setIsManageSalespeopleOpen] = useState(false);
  const [editingSp, setEditingSp] = useState<Salesperson | null>(null);
  const [newSpName, setNewSpName] = useState('');
  const [newSpRate, setNewSpRate] = useState(10);
  const [isSavingSp, setIsSavingSp] = useState(false);

  // Look up closure record for this month if closed
  const existingClosure = useMemo(() => {
    return monthlyCommissionClosures.find(c => c.month === selectedMonth && c.is_closed) || null;
  }, [monthlyCommissionClosures, selectedMonth]);

  // Compute authoritative commission summary for selected month
  const reportSummary = useMemo(() => {
    return calculateMonthlyCommissionSummary({
      monthKey: selectedMonth,
      sales,
      salesReturns,
      expenses,
      salespersons,
      commissionPayments,
      closure: existingClosure,
      products,
      rawMaterials,
      includeDepreciation,
    });
  }, [
    selectedMonth, 
    sales, 
    salesReturns, 
    expenses, 
    salespersons, 
    commissionPayments, 
    existingClosure, 
    products, 
    rawMaterials, 
    includeDepreciation
  ]);

  // Handle Close Month submission
  const handleConfirmCloseMonth = async () => {
    if (!currentUser) return;
    setIsClosingSubmitting(true);
    try {
      await closeCommissionMonth({
        month: reportSummary.month,
        is_closed: true,
        closed_at: new Date().toISOString(),
        closed_by: currentUser.id,
        closed_by_name: currentUser.name,
        total_gross_profit: reportSummary.total_gross_profit,
        total_expenses: reportSummary.total_expenses,
        coverage_factor: reportSummary.coverage_factor,
        total_commission: reportSummary.total_commission,
        owner_remaining_profit: reportSummary.owner_remaining_profit,
        include_depreciation: reportSummary.include_depreciation,
        snapshots: reportSummary.salespeople,
        notes: `Month closed by ${currentUser.name} on ${new Date().toLocaleDateString()}`
      });
      setIsCloseModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to close month');
    } finally {
      setIsClosingSubmitting(false);
    }
  };

  // Handle Reopen Month submission
  const handleConfirmReopenMonth = async () => {
    try {
      await reopenCommissionMonth(selectedMonth);
      setIsReopenModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to reopen month');
    }
  };

  // Open Payment modal pre-filled
  const handleOpenPayModal = (spDetail: SalespersonCommissionDetail) => {
    setPayingSalesperson(spDetail);
    setPayAmount(spDetail.commission_balance > 0 ? spDetail.commission_balance : spDetail.commission_earned);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes(`Sales Commission payout for ${spDetail.salesperson_name} (${selectedMonth})`);
  };

  // Submit commission payment
  const handleConfirmPayCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSalesperson || !currentUser) return;
    if (payAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    setIsPaySubmitting(true);
    try {
      await paySalesCommission({
        salesperson_id: payingSalesperson.salesperson_id,
        salesperson_name: payingSalesperson.salesperson_name,
        month: selectedMonth,
        amount: Number(payAmount),
        payment_method: payMethod,
        payment_date: payDate,
        notes: payNotes,
        recorded_by: currentUser.id,
        recorded_by_name: currentUser.name,
      }, currentUser);

      setPayingSalesperson(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to process commission payment');
    } finally {
      setIsPaySubmitting(false);
    }
  };

  // Save new or edited salesperson
  const handleSaveSalesperson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpName.trim()) return;

    setIsSavingSp(true);
    try {
      if (editingSp) {
        await updateSalesperson(editingSp.id, {
          name: newSpName.trim(),
          commission_rate: Number(newSpRate),
        });
      } else {
        await addSalesperson({
          name: newSpName.trim(),
          commission_rate: Number(newSpRate),
          is_active: true,
        });
      }
      setEditingSp(null);
      setNewSpName('');
      setNewSpRate(10);
    } catch (err: any) {
      alert(err?.message || 'Failed to save salesperson');
    } finally {
      setIsSavingSp(false);
    }
  };

  // Quick toggle active flag
  const handleToggleActive = async (sp: Salesperson) => {
    try {
      await updateSalesperson(sp.id, { is_active: !sp.is_active });
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printElement('printable-commission-report', `Sales_Commission_Report_${selectedMonth}`);
    } catch (e) {
      console.error('Print failed, falling back to window.print():', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar (Hidden on print) */}
      <div className="no-print print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-400" />
              <span>Sales Commission Report</span>
            </h2>

            {reportSummary.is_closed ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-xs">
                <Lock className="w-3.5 h-3.5" />
                <span>Closed (Snapshot Saved)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-xs animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                <span>Provisional (month still open)</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-1">
            Authoritative net profit commission system. Calculated after monthly overhead coverage.
          </p>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-1.5 shadow-inner">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-xs font-bold font-mono focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setIsManageSalespeopleOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Salespeople ({salespersons.length})</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
            title="Print or export commission statement"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>{isPrinting ? 'Preparing Print...' : 'Print Report'}</span>
          </button>

          {isOwner && (
            reportSummary.is_closed ? (
              <button
                onClick={() => setIsReopenModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-colors shadow-sm"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Reopen Month</span>
              </button>
            ) : (
              <button
                onClick={() => setIsCloseModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Close Month</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Settings Bar (Include Depreciation Toggle & Notes) (Hidden on print) */}
      <div className="no-print print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeDepreciation}
            onChange={(e) => setIncludeDepreciation(e.target.checked)}
            className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
          />
          <span className="font-semibold text-slate-200">
            Include Depreciation in monthly expenses
          </span>
          <span className="text-[11px] text-slate-500 font-normal">
            (Default: No — cash overhead only)
          </span>
        </label>

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span>Formula:</span>
          <span className="font-mono bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
            Commission = Rate × Gross Profit × Coverage Factor
          </span>
        </div>
      </div>

      {/* Printable Area Starts */}
      <div id="printable-commission-report" className="space-y-6 print:space-y-4 print:p-2 print:bg-white print:text-slate-900">
        {/* Printable Statement Header (Visible only when printed) */}
        <div className="hidden print:flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 mb-4 gap-4 text-slate-900">
          <div className="flex items-start gap-4">
            <img 
              src="/assets/logo.png" 
              alt="Perfect Shine Chemicals" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" 
            />
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                PERFECT SHINE CHEMICALS
              </h2>
              <p className="text-xs text-slate-600 font-semibold mt-1">
                Industrial & Commercial Cleaning Solutions Manufacturer
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore, Pakistan
              </p>
              <p className="text-xs text-slate-700 font-semibold mt-0.5">
                Tel / WhatsApp: <span className="font-mono font-bold text-slate-900">0327-4549485</span>
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-black uppercase tracking-wider mb-1.5">
              Sales Commission & Profit Statement
            </div>
            <p className="text-sm font-bold text-slate-800">
              Period: {reportSummary.monthName} ({selectedMonth})
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Status: <strong className="uppercase font-mono">{reportSummary.is_closed ? 'Closed (Snapshot Locked)' : 'Provisional (Month Open)'}</strong>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Printed on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Month Summary KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Total Gross Profit */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md print:bg-slate-50 print:border-slate-300 print:shadow-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block print:text-slate-600">
              1. Total Gross Profit
            </span>
            <p className="text-lg font-black font-mono text-emerald-400 mt-1 print:text-slate-900">
              {formatPKR(reportSummary.total_gross_profit)}
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5 print:text-slate-600">
              All {reportSummary.total_invoices} invoices − returns
            </span>
          </div>

          {/* 2. Monthly Expenses */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md print:bg-slate-50 print:border-slate-300 print:shadow-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block print:text-slate-600">
              2. Monthly Expenses
            </span>
            <p className="text-lg font-black font-mono text-rose-400 mt-1 print:text-slate-900">
              - {formatPKR(reportSummary.total_expenses)}
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5 print:text-slate-600">
              Centralized factory overhead
            </span>
          </div>

          {/* 3. Profit Before Commission */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md print:bg-slate-50 print:border-slate-300 print:shadow-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block print:text-slate-600">
              3. Profit Before Comm.
            </span>
            <p className={`text-lg font-black font-mono mt-1 print:text-slate-900 ${
              reportSummary.profit_before_commission >= 0 ? 'text-cyan-400' : 'text-rose-400'
            }`}>
              {formatPKR(reportSummary.profit_before_commission)}
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5 print:text-slate-600">
              Gross Profit − Expenses
            </span>
          </div>

          {/* 4. Coverage Factor */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-800/40 shadow-md print:bg-slate-50 print:border-slate-300 print:shadow-none">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block print:text-slate-600">
              4. Coverage Factor
            </span>
            <p className="text-lg font-black font-mono text-indigo-300 mt-1 print:text-slate-900">
              {(reportSummary.coverage_factor * 100).toFixed(1)}%
            </p>
            <span className="text-[10px] text-indigo-400/80 block mt-0.5 print:text-slate-600">
              Factor = {reportSummary.coverage_factor.toFixed(4)}
            </span>
          </div>

          {/* 5. Total Commission Earned */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md print:bg-slate-50 print:border-slate-300 print:shadow-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block print:text-slate-600">
              5. Total Commission
            </span>
            <p className="text-lg font-black font-mono text-amber-400 mt-1 print:text-slate-900">
              {formatPKR(reportSummary.total_commission)}
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5 print:text-slate-600">
              All salespeople payouts
            </span>
          </div>

          {/* 6. Owner's Remaining Profit */}
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 shadow-md print:bg-slate-50 print:border-slate-300 print:shadow-none">
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block print:text-slate-600">
              6. Owner's Profit
            </span>
            <p className={`text-lg font-black font-mono mt-1 print:text-slate-900 ${
              reportSummary.owner_remaining_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatPKR(reportSummary.owner_remaining_profit)}
            </p>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5 print:text-slate-600">
              Net retained by factory
            </span>
          </div>
        </div>

        {/* Coverage Factor Explanation Alert if factor is 0 */}
        {reportSummary.coverage_factor === 0 && reportSummary.total_expenses > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-3 print:bg-slate-100 print:text-slate-800 print:border-slate-300">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 print:hidden" />
            <div>
              <strong className="font-bold">Overhead Expenses Exceed Gross Profit:</strong> Monthly expenses ({formatPKR(reportSummary.total_expenses)}) equal or exceed total gross profit ({formatPKR(reportSummary.total_gross_profit)}). The coverage factor is 0%, so all sales commissions are PKR 0.00 for this month. No carry-forward of losses.
            </div>
          </div>
        )}

        {/* Salespeople Breakdown Table */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl print:bg-white print:border-slate-300 print:shadow-none print:rounded-none">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 print:border-slate-300 print:bg-white">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 print:text-slate-900">
                <span>Salesperson Performance & Commission Payouts</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600">
                Calculated on invoice date basis. Returns deducted in the month recorded.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl print:text-slate-800 print:border-slate-300 print:bg-slate-100">
              {reportSummary.monthName} Statement
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px] print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                  <th className="py-3.5 px-4 print:border print:border-slate-300">Salesperson</th>
                  <th className="py-3.5 px-3 text-center print:border print:border-slate-300">Invoices</th>
                  <th className="py-3.5 px-3 text-right print:border print:border-slate-300">Total Sales</th>
                  <th className="py-3.5 px-3 text-right print:border print:border-slate-300">Gross Profit</th>
                  <th className="py-3.5 px-3 text-center print:border print:border-slate-300">Coverage</th>
                  <th className="py-3.5 px-3 text-center print:border print:border-slate-300">Rate</th>
                  <th className="py-3.5 px-4 text-right print:border print:border-slate-300">Commission Earned</th>
                  <th className="py-3.5 px-3 text-right print:border print:border-slate-300">Paid</th>
                  <th className="py-3.5 px-3 text-right print:border print:border-slate-300">Balance Due</th>
                  <th className="no-print print:hidden py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 print:text-slate-900 print:divide-slate-300">
                {reportSummary.salespeople.map((sp) => (
                  <tr key={sp.salesperson_id} className="hover:bg-slate-800/30 transition-colors print:border-b print:border-slate-200">
                    <td className="py-3.5 px-4 font-bold text-white print:text-slate-900 print:border-r print:border-slate-200">
                      <div className="flex items-center gap-2">
                        <div className="no-print print:hidden w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono font-bold text-xs shrink-0">
                          {sp.salesperson_name.charAt(0)}
                        </div>
                        <div>
                          <span>{sp.salesperson_name}</span>
                          {sp.returns_gross_profit > 0 && (
                            <span className="text-[10px] text-rose-400 block font-normal print:text-rose-700">
                              (Return GP: -{formatPKR(sp.returns_gross_profit)})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono print:text-slate-900 print:border-r print:border-slate-200">
                      {sp.invoice_count}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-slate-300 print:text-slate-900 print:border-r print:border-slate-200">
                      {formatPKR(sp.total_sales)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400 print:text-slate-900 print:border-r print:border-slate-200">
                      {formatPKR(sp.gross_profit)}
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono text-indigo-300 print:text-slate-900 print:border-r print:border-slate-200">
                      {(sp.coverage_factor * 100).toFixed(1)}%
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-200 print:text-slate-900 print:border-r print:border-slate-200">
                      {sp.commission_rate}%
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-black text-amber-400 text-sm print:text-slate-900 print:border-r print:border-slate-200">
                      {formatPKR(sp.commission_earned)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-slate-400 print:text-slate-900 print:border-r print:border-slate-200">
                      {formatPKR(sp.commission_paid)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold print:text-slate-900">
                      <span className={sp.commission_balance > 0 ? 'text-rose-400 print:text-slate-900' : 'text-emerald-400 print:text-slate-900'}>
                        {formatPKR(sp.commission_balance)}
                      </span>
                    </td>

                    <td className="no-print print:hidden py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDrilldownSalesperson(sp)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                          title="View Invoices Drill-down"
                        >
                          Invoices ({sp.invoice_count})
                        </button>

                        {isOwner && sp.commission_balance > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(sp)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-colors"
                            title="Record commission payout in Cash Book"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800 bg-slate-950/80 font-black text-white text-xs print:bg-slate-100 print:text-slate-900 print:border-slate-300">
                  <td className="py-3.5 px-4 print:border-r print:border-slate-300">Factory Total</td>
                  <td className="py-3.5 px-3 text-center font-mono print:border-r print:border-slate-300">
                    {reportSummary.total_invoices}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-300 print:text-slate-900 print:border-r print:border-slate-300">
                    {formatPKR(reportSummary.total_sales_amount)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-emerald-400 print:text-slate-900 print:border-r print:border-slate-300">
                    {formatPKR(reportSummary.total_gross_profit)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-indigo-300 print:text-slate-900 print:border-r print:border-slate-300">
                    {(reportSummary.coverage_factor * 100).toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-3 text-center print:border-r print:border-slate-300">-</td>
                  <td className="py-3.5 px-4 text-right font-mono text-amber-400 text-sm print:text-slate-900 print:border-r print:border-slate-300">
                    {formatPKR(reportSummary.total_commission)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-400 print:text-slate-900 print:border-r print:border-slate-300">
                    {formatPKR(reportSummary.salespeople.reduce((a, b) => a + b.commission_paid, 0))}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-rose-400 print:text-slate-900">
                    {formatPKR(reportSummary.salespeople.reduce((a, b) => a + b.commission_balance, 0))}
                  </td>
                  <td className="no-print print:hidden py-3.5 px-4 text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Formal Signature & Authorization Block (Visible only when printed) */}
        <div className="hidden print:grid grid-cols-3 gap-8 pt-6 mt-6 border-t-2 border-slate-900 text-slate-900 text-xs">
          <div>
            <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Prepared By</p>
            <div className="mt-8 border-b border-slate-400"></div>
            <p className="font-bold text-slate-800 mt-1.5">{currentUser?.name || 'Accounts Officer'}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Verified By</p>
            <div className="mt-8 border-b border-slate-400"></div>
            <p className="font-bold text-slate-800 mt-1.5">Internal Audit / Finance</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Approved By (Owner)</p>
            <div className="mt-8 border-b border-slate-400"></div>
            <p className="font-bold text-slate-800 mt-1.5">Managing Director / Partner</p>
          </div>
        </div>
      </div>
      {/* Printable Area Ends */}

      {/* 1. Drill-down Invoices Modal */}
      {drilldownSalesperson && (
        <Modal
          isOpen={Boolean(drilldownSalesperson)}
          onClose={() => setDrilldownSalesperson(null)}
          title={`Invoices Breakdown: ${drilldownSalesperson.salesperson_name} (${reportSummary.monthName})`}
        >
          <div className="space-y-4">
            <div id="printable-commission-drilldown" className="space-y-4 print:p-2 print:bg-white print:text-slate-900">
              {/* Printable Header for Individual Salesperson Statement */}
              <div className="hidden print:flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-4 mb-3 gap-3 text-slate-900">
                <div className="flex items-start gap-3">
                  <img 
                    src="/assets/logo.png" 
                    alt="Perfect Shine Chemicals" 
                    className="w-14 h-14 object-contain shrink-0" 
                  />
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                      PERFECT SHINE CHEMICALS
                    </h2>
                    <p className="text-xs text-slate-600 font-semibold mt-0.5">
                      Industrial & Commercial Cleaning Solutions Manufacturer
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore • 0327-4549485
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="inline-block px-2.5 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold uppercase mb-1">
                    Salesperson Commission Statement
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Staff: {drilldownSalesperson.salesperson_name}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Month: {reportSummary.monthName} ({selectedMonth})
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs print:bg-slate-50 print:border-slate-300 print:text-slate-900">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase print:text-slate-600">Commission Rate:</span>
                  <span className="font-bold text-white print:text-slate-900">{drilldownSalesperson.commission_rate}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase print:text-slate-600">Coverage Factor:</span>
                  <span className="font-bold text-indigo-400 print:text-slate-900">{(drilldownSalesperson.coverage_factor * 100).toFixed(1)}%</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase print:text-slate-600">Net Profit Base:</span>
                  <span className="font-mono font-bold text-emerald-400 print:text-slate-900">{formatPKR(drilldownSalesperson.gross_profit)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase print:text-slate-600">Commission Earned:</span>
                  <span className="font-mono font-black text-amber-400 print:text-slate-900">{formatPKR(drilldownSalesperson.commission_earned)}</span>
                </div>
              </div>

              {/* Invoices List */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 print:text-slate-800">
                  Invoices Credited ({drilldownSalesperson.invoices.length})
                </h4>
                {drilldownSalesperson.invoices.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center print:text-slate-600">No invoices recorded for this month.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 print:max-h-none print:overflow-visible print:border-slate-300">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px] print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3 text-right">Revenue</th>
                          <th className="py-2.5 px-3 text-right">COGS</th>
                          <th className="py-2.5 px-3 text-right">Gross Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                        {drilldownSalesperson.invoices.map((inv) => (
                          <tr key={inv.sale_id} className="hover:bg-slate-800/30 print:border-b print:border-slate-200">
                            <td className="py-2 px-3 font-mono font-bold text-white print:text-slate-900">{inv.invoice_number}</td>
                            <td className="py-2 px-3 text-slate-400 print:text-slate-800">{formatDate(inv.date)}</td>
                            <td className="py-2 px-3 text-slate-300 print:text-slate-800">{inv.customer_name}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300 print:text-slate-900">{formatPKR(inv.revenue)}</td>
                            <td className="py-2 px-3 text-right font-mono text-rose-400 print:text-slate-900">{formatPKR(inv.cogs)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400 print:text-slate-900">{formatPKR(inv.gross_profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Returns Deductions if any */}
              {drilldownSalesperson.returns.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 print:text-rose-700">
                    <RotateCcw className="w-3.5 h-3.5 no-print print:hidden" />
                    <span>Sales Returns Deductions ({drilldownSalesperson.returns.length})</span>
                  </h4>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-rose-900/40 bg-rose-950/10 print:max-h-none print:overflow-visible print:border-slate-300 print:bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-rose-900/40 bg-rose-950/40 text-rose-300 font-bold uppercase text-[10px] print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                          <th className="py-2.5 px-3">Credit Note #</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Inv Ref</th>
                          <th className="py-2.5 px-3 text-right">Returned Rev</th>
                          <th className="py-2.5 px-3 text-right">Reversed COGS</th>
                          <th className="py-2.5 px-3 text-right">GP Deducted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-900/20 print:divide-slate-200">
                        {drilldownSalesperson.returns.map((ret) => (
                          <tr key={ret.return_id} className="print:border-b print:border-slate-200">
                            <td className="py-2 px-3 font-mono font-bold text-rose-300 print:text-slate-900">{ret.credit_note_number}</td>
                            <td className="py-2 px-3 text-slate-400 print:text-slate-800">{formatDate(ret.date)}</td>
                            <td className="py-2 px-3 font-mono text-slate-400 print:text-slate-800">{ret.invoice_number}</td>
                            <td className="py-2 px-3 text-right font-mono text-rose-300 print:text-slate-900">-{formatPKR(ret.returned_revenue)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-400 print:text-slate-900">{formatPKR(ret.returned_cogs)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-400 print:text-slate-900">-{formatPKR(ret.gross_profit_deducted)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => printElement('printable-commission-drilldown', `Commission_${drilldownSalesperson.salesperson_name}_${selectedMonth}`)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                title="Print detailed statement for this salesperson"
              >
                <Printer className="w-3.5 h-3.5 text-slate-300" />
                <span>Print Breakdown</span>
              </button>

              <button
                type="button"
                onClick={() => setDrilldownSalesperson(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Close Drill-down
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Close Month Confirmation Modal */}
      {isCloseModalOpen && (
        <Modal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          title={`Close Month: ${reportSummary.monthName}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Month Close & Snapshot Lock</span>
              </div>
              <p>
                Closing the month saves an immutable snapshot of all commission calculations. Modifying or deleting any invoice or expense in <strong>{reportSummary.monthName}</strong> will subsequently display a warning and require reopening the month.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Total Gross Profit:</span>
                <span className="font-mono font-bold text-emerald-400">{formatPKR(reportSummary.total_gross_profit)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Total Expenses:</span>
                <span className="font-mono font-bold text-rose-400">{formatPKR(reportSummary.total_expenses)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Coverage Factor:</span>
                <span className="font-mono font-bold text-indigo-400">{(reportSummary.coverage_factor * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Total Commission Payout:</span>
                <span className="font-mono font-bold text-amber-400">{formatPKR(reportSummary.total_commission)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isClosingSubmitting}
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClosingSubmitting}
                onClick={handleConfirmCloseMonth}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-colors"
              >
                {isClosingSubmitting ? 'Locking Snapshot...' : 'Confirm Month Close'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 3. Reopen Month Modal */}
      {isReopenModalOpen && (
        <Modal
          isOpen={isReopenModalOpen}
          onClose={() => setIsReopenModalOpen(false)}
          title={`Reopen Month: ${reportSummary.monthName}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">
              Are you sure you want to reopen <strong>{reportSummary.monthName}</strong>? The closed snapshot will be unlocked and commission figures will return to live provisional calculation.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReopenMonth}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Pay Commission Modal */}
      {payingSalesperson && (
        <Modal
          isOpen={Boolean(payingSalesperson)}
          onClose={() => setPayingSalesperson(null)}
          title={`Pay Commission: ${payingSalesperson.salesperson_name}`}
        >
          <form onSubmit={handleConfirmPayCommission} className="space-y-4">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Earned for {reportSummary.monthName}:</span>
                <span className="font-mono font-bold text-amber-400">{formatPKR(payingSalesperson.commission_earned)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Unpaid Balance:</span>
                <span className="font-mono font-black text-rose-400">{formatPKR(payingSalesperson.commission_balance)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Payout Amount (PKR)
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="cash">Cash Counter</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Description / Cash Book Voucher Note
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                This creates an outgoing cash transaction in the Cash Book labeled "Sales Commission".
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isPaySubmitting}
                onClick={() => setPayingSalesperson(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPaySubmitting}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-colors"
              >
                {isPaySubmitting ? 'Recording Payout...' : 'Record Payout & Post to Cash Book'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Manage Salespeople Modal */}
      {isManageSalespeopleOpen && (
        <Modal
          isOpen={isManageSalespeopleOpen}
          onClose={() => {
            setIsManageSalespeopleOpen(false);
            setEditingSp(null);
            setNewSpName('');
            setNewSpRate(10);
          }}
          title="Salespeople Directory & Commission Rates"
        >
          <div className="space-y-5">
            {/* Form to add or edit salesperson */}
            <form onSubmit={handleSaveSalesperson} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                {editingSp ? `Edit: ${editingSp.name}` : 'Add New Salesperson'}
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Salesperson Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sharjeel, Aqeel, Ilyas"
                    value={newSpName}
                    onChange={(e) => setNewSpName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    required
                    value={newSpRate}
                    onChange={(e) => setNewSpRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {editingSp && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSp(null);
                      setNewSpName('');
                      setNewSpRate(10);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingSp}
                  className="px-4 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  {isSavingSp ? 'Saving...' : editingSp ? 'Update Rate' : 'Add Salesperson'}
                </button>
              </div>
            </form>

            {/* List of existing salespeople */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Current Salespeople ({salespersons.length})
              </span>

              <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                {salespersons.map(sp => (
                  <div key={sp.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400 font-mono">
                        {sp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{sp.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sp.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {sp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Rate: <strong className="text-indigo-300 font-bold">{sp.commission_rate}%</strong> of net gross profit
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSp(sp);
                          setNewSpName(sp.name);
                          setNewSpRate(sp.commission_rate);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Edit name or commission rate"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(sp)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          sp.is_active 
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20' 
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {sp.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsManageSalespeopleOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Close Directory
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
