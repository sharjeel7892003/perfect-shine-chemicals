import React, { useState } from 'react';
import { 
  DollarSign, 
  Plus, 
  Calendar, 
  Filter, 
  Repeat, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Search, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Building2, 
  Zap, 
  Users, 
  Wrench, 
  Truck, 
  Boxes, 
  Tag, 
  Clock,
  ArrowDownRight,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Expense, ExpenseCategory, PaymentMethod, RecurringExpense } from '../../types';
import { formatPKR, formatDate, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

const PREDEFINED_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Electricity',
  'Labor/Salaries',
  'Maintenance',
  'Transport',
  'Raw Material Handling',
  'Other'
];

export const ExpensesModule: React.FC = () => {
  const { 
    expenses, 
    recurringExpenses, 
    addExpense, 
    deleteExpense, 
    addRecurringExpense, 
    updateRecurringExpense, 
    deleteRecurringExpense, 
    confirmAndPostRecurringExpense 
  } = useApp();
  
  const { currentUser, isOwner, canManageExpenses } = useAuth();

  // Active View Tab: 'list' | 'recurring'
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'recurring'>('list');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal States
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddRecurringModalOpen, setIsAddRecurringModalOpen] = useState(false);
  const [isSqlHelpModalOpen, setIsSqlHelpModalOpen] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isConfirmingPostId, setIsConfirmingPostId] = useState<string | null>(null);
  const [postingCustomAmount, setPostingCustomAmount] = useState<number>(0);
  const [postingCustomMethod, setPostingCustomMethod] = useState<PaymentMethod>('bank');

  // Add Expense Form State
  const [expenseDate, setExpenseDate] = useState<string>(getTodayDateString());
  const [expenseCategory, setExpenseCategory] = useState<string>('Rent');
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethod>('bank');
  const [expenseIsRecurring, setExpenseIsRecurring] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Recurring Template Form State
  const [recCategory, setRecCategory] = useState<string>('Rent');
  const [recCustomCategory, setRecCustomCategory] = useState<string>('');
  const [recDescription, setRecDescription] = useState<string>('');
  const [recAmount, setRecAmount] = useState<number | ''>('');
  const [recPaymentMethod, setRecPaymentMethod] = useState<PaymentMethod>('bank');

  // Quick Date Range Presets
  const handleQuickDate = (type: 'this_month' | 'today' | 'this_year' | 'all') => {
    const today = new Date();
    if (type === 'today') {
      const d = today.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (type === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (type === 'this_year') {
      const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Date filtering logic
  const isDateInRange = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    const d = new Date(dateStr);
    if (startDate && d < new Date(startDate + 'T00:00:00')) return false;
    if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
    return true;
  };

  // Extract all distinct categories (predefined + any custom ones created)
  const allKnownCategories = Array.from(
    new Set([
      ...PREDEFINED_CATEGORIES,
      ...expenses.map(e => e.category),
      ...recurringExpenses.map(r => r.category)
    ])
  ).filter(Boolean);

  // Filtered Expense Records
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = 
      (e.description && e.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.category && e.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.recorded_by_name && e.recorded_by_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategoryFilter === 'all' || e.category === selectedCategoryFilter;
    const matchesMethod = selectedPaymentMethodFilter === 'all' || e.payment_method === selectedPaymentMethodFilter;
    const matchesDate = isDateInRange(e.date);

    return matchesSearch && matchesCategory && matchesMethod && matchesDate;
  });

  // Current Month Key for Recurring logic
  const currentMonthKey = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Identify recurring expenses that are active and NOT YET confirmed/posted for this month
  const pendingRecurringExpenses = recurringExpenses.filter(r => {
    return r.is_active && r.last_posted_month !== currentMonthKey;
  });

  // Metrics Calculations
  const currentMonthExpensesTotal = expenses
    .filter(e => e.date && e.date.startsWith(currentMonthKey))
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const filteredExpensesTotal = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  // Calculate top category spend
  const categoryTotals: Record<string, number> = {};
  filteredExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount || 0);
  });
  let topCategory = 'None';
  let topCategoryAmount = 0;
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    if (amt > topCategoryAmount) {
      topCategory = cat;
      topCategoryAmount = amt;
    }
  });

  const totalMonthlyRecurringCommitment = recurringExpenses
    .filter(r => r.is_active)
    .reduce((acc, r) => acc + Number(r.amount || 0), 0);

  // Category Icon & Badge Helper
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'rent': return <Building2 className="w-4 h-4 text-amber-400" />;
      case 'electricity': return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'labor/salaries': return <Users className="w-4 h-4 text-emerald-400" />;
      case 'maintenance': return <Wrench className="w-4 h-4 text-blue-400" />;
      case 'transport': return <Truck className="w-4 h-4 text-purple-400" />;
      case 'raw material handling': return <Boxes className="w-4 h-4 text-teal-400" />;
      default: return <Tag className="w-4 h-4 text-slate-400" />;
    }
  };

  const getCategoryBadgeVariant = (category: string): 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'slate' => {
    switch (category.toLowerCase()) {
      case 'rent': return 'amber';
      case 'electricity': return 'amber';
      case 'labor/salaries': return 'emerald';
      case 'maintenance': return 'blue';
      case 'transport': return 'purple';
      case 'raw material handling': return 'blue';
      default: return 'slate';
    }
  };

  // Submit Add Expense Form
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const finalCategory = expenseCategory === 'custom' ? customCategoryInput.trim() : expenseCategory;
    if (!finalCategory) {
      setFormError('Please select or specify a valid category.');
      return;
    }

    const amt = Number(expenseAmount);
    if (!amt || amt <= 0) {
      setFormError('Please enter a valid expense amount in PKR.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addExpense(
        {
          date: formatSelectedDateToIso(expenseDate),
          category: finalCategory,
          description: expenseDescription.trim(),
          amount: amt,
          payment_method: expensePaymentMethod,
          is_recurring: expenseIsRecurring,
        },
        currentUser
      );

      // Reset form
      setIsAddExpenseModalOpen(false);
      setExpenseDate(getTodayDateString());
      setExpenseDescription('');
      setExpenseAmount('');
      setCustomCategoryInput('');
      setExpenseIsRecurring(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Add Recurring Template Form
  const handleSubmitRecurringTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = recCategory === 'custom' ? recCustomCategory.trim() : recCategory;
    if (!finalCategory) {
      alert('Please specify a category.');
      return;
    }

    const amt = Number(recAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid monthly amount.');
      return;
    }

    try {
      await addRecurringExpense({
        category: finalCategory,
        description: recDescription.trim() || `${finalCategory} Monthly Overhead`,
        amount: amt,
        payment_method: recPaymentMethod,
        is_active: true,
        created_by: currentUser.name,
      });

      setIsAddRecurringModalOpen(false);
      setRecDescription('');
      setRecAmount('');
      setRecCustomCategory('');
    } catch (err: any) {
      alert(err.message || 'Failed to save recurring template.');
    }
  };

  // Open confirmation for posting a recurring item
  const handleOpenConfirmPost = (rec: RecurringExpense) => {
    setIsConfirmingPostId(rec.id);
    setPostingCustomAmount(rec.amount);
    setPostingCustomMethod(rec.payment_method);
  };

  // Execute confirmation of recurring item posting
  const handleConfirmPostRecurring = async (recId: string) => {
    try {
      await confirmAndPostRecurringExpense(
        recId, 
        postingCustomAmount, 
        postingCustomMethod, 
        currentUser
      );
      setIsConfirmingPostId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to post recurring expense.');
    }
  };

  // Quick Post All Due Recurring Expenses
  const handlePostAllDueRecurring = async () => {
    if (!confirm(`Post all ${pendingRecurringExpenses.length} recurring expenses for ${currentMonthName}? Total: ${formatPKR(pendingRecurringExpenses.reduce((a, b) => a + b.amount, 0))}`)) {
      return;
    }

    for (const rec of pendingRecurringExpenses) {
      try {
        await confirmAndPostRecurringExpense(rec.id, rec.amount, rec.payment_method, currentUser);
      } catch (err) {
        console.error('Error auto-posting:', rec.description, err);
      }
    }
  };

  const sqlSnippet = `-- PERFECT SHINE CHEMICALS — EXPENSES & RECURRING EXPENSES MIGRATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    recorded_by TEXT,
    recorded_by_name TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create recurring_expenses template table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_posted_month TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Update payments check constraint so automated cashbook expense payments succeed
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_related_to_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_related_to_check 
  CHECK (related_to IN ('sale', 'purchase', 'customer_balance', 'supplier_balance', 'expense'));

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Expenses read" ON public.expenses;
CREATE POLICY "Expenses read" ON public.expenses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Expenses manage" ON public.expenses;
CREATE POLICY "Expenses manage" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Recurring read" ON public.recurring_expenses;
CREATE POLICY "Recurring read" ON public.recurring_expenses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Recurring manage" ON public.recurring_expenses;
CREATE POLICY "Recurring manage" ON public.recurring_expenses FOR ALL USING (true) WITH CHECK (true);

-- 6. Add to Realtime publication
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses, public.recurring_expenses;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSnippet);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Factory Overheads & Operating Expenses</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Factory Expenses & Costs
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Track manufacturing facility rent, electricity utilities, staff payroll, maintenance, and freight overheads. Integrated with Cash Book and P&L.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsSqlHelpModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="View Supabase table migration script"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Supabase SQL</span>
            </button>

            {canManageExpenses && (
              <>
                <button
                  onClick={() => setIsAddRecurringModalOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Repeat className="w-4 h-4 text-amber-400" />
                  <span>+ Recurring Template</span>
                </button>

                <button
                  onClick={() => {
                    setExpenseDate(getTodayDateString());
                    setIsAddExpenseModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  <span>Record Expense</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🔔 MONTHLY RECURRING EXPENSES QUICK-ADD REMINDER PROMPT BANNER */}
      {/* ========================================================================= */}
      {pendingRecurringExpenses.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 text-xs shadow-lg shadow-amber-500/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Repeat className="w-4 h-4 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Recurring Overheads Due for Confirmation ({currentMonthName})</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                    {pendingRecurringExpenses.length} Pending
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  These monthly items (rent, salaries, etc.) require confirmation before posting to the live factory accounts.
                </p>
              </div>
            </div>

            {canManageExpenses && pendingRecurringExpenses.length > 1 && (
              <button
                onClick={handlePostAllDueRecurring}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5px]" />
                <span>Confirm & Post All ({formatPKR(pendingRecurringExpenses.reduce((a, b) => a + b.amount, 0))})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {pendingRecurringExpenses.map(rec => (
              <div 
                key={rec.id} 
                className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-xs truncate">{rec.description}</span>
                    <Badge variant={getCategoryBadgeVariant(rec.category)} size="sm">
                      {rec.category}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-base font-black text-amber-400 font-mono">
                      {formatPKR(rec.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase">
                      Via {rec.payment_method}
                    </span>
                  </div>
                </div>

                {canManageExpenses ? (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50">
                    <button
                      onClick={() => handleOpenConfirmPost(rec)}
                      className="flex-1 py-1 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors border border-emerald-500/30"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Post</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Skip recurring reminder for "${rec.description}" for ${currentMonthName}?`)) {
                          await updateRecurringExpense(rec.id, { last_posted_month: currentMonthKey });
                        }
                      }}
                      className="py-1 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-[11px] transition-colors"
                      title="Skip this month"
                    >
                      Skip
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">Requires Admin or Accounts Staff confirmation</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* This Month's Expenses */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month's Overheads</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-400 mt-3 font-mono">{formatPKR(currentMonthExpensesTotal)}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>{currentMonthName}</span>
            <span className="text-amber-400 font-medium">Overhead outflow</span>
          </div>
        </div>

        {/* Filtered Expenses Total */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selected Period Expenses</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-3 font-mono">{formatPKR(filteredExpensesTotal)}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>{filteredExpenses.length} Expense Records</span>
            <span className="text-slate-400">Filtered view</span>
          </div>
        </div>

        {/* Top Expense Category */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Spend Category</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-400 mt-3 truncate">{topCategory}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>Spend: {formatPKR(topCategoryAmount)}</span>
            <span className="text-blue-400 font-medium">Largest cost driver</span>
          </div>
        </div>

        {/* Recurring Commitment */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Recurring Budget</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-400 mt-3 font-mono">{formatPKR(totalMonthlyRecurringCommitment)}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>{recurringExpenses.filter(r => r.is_active).length} Active Templates</span>
            <button 
              onClick={() => setActiveSubTab('recurring')}
              className="text-purple-400 hover:underline flex items-center gap-0.5"
            >
              Templates →
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs: Expenses List vs. Recurring Templates */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'list'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            All Recorded Expenses ({expenses.length})
          </button>
          <button
            onClick={() => setActiveSubTab('recurring')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'recurring'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Recurring Templates ({recurringExpenses.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          {activeSubTab === 'list' 
            ? `Showing ${filteredExpenses.length} of ${expenses.length} records`
            : `${recurringExpenses.length} monthly scheduled templates`
          }
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: EXPENSES LIST */}
      {/* ========================================================================= */}
      {activeSubTab === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search description, category, or recorder..."
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category Filter */}
              <div className="w-full md:w-52">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Categories</option>
                  {allKnownCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div className="w-full md:w-44">
                <select
                  value={selectedPaymentMethodFilter}
                  onChange={(e) => setSelectedPaymentMethodFilter(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Payment Channels</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                </select>
              </div>
            </div>

            {/* Date Range Preset Buttons & Inputs */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px] mr-1">Timeframe:</span>
                <button
                  onClick={() => handleQuickDate('this_month')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                >
                  This Month
                </button>
                <button
                  onClick={() => handleQuickDate('today')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => handleQuickDate('this_year')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                >
                  This Year
                </button>
                <button
                  onClick={() => handleQuickDate('all')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                >
                  All Time
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-[11px] text-rose-400 hover:underline ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px] bg-slate-900/80">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description / Notes</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-right">Amount (PKR)</th>
                    <th className="py-3 px-4">Recorded By</th>
                    {canManageExpenses && <th className="py-3 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-semibold">No expense records found</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {expenses.length === 0 
                            ? 'Record your first factory overhead (rent, electricity, salaries, etc.)'
                            : 'Try adjusting your filters or date range.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {formatDate(exp.date)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {getCategoryIcon(exp.category)}
                            <Badge variant={getCategoryBadgeVariant(exp.category)} size="sm">
                              {exp.category}
                            </Badge>
                            {exp.is_recurring && (
                              <span title="Monthly Recurring">
                                <Repeat className="w-3 h-3 text-amber-400" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white font-medium max-w-xs truncate">
                          {exp.description || '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                          <span className="capitalize font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px]">
                            {exp.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-400 text-sm whitespace-nowrap">
                          - {formatPKR(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {exp.recorded_by_name || 'Staff'}
                        </td>
                        {canManageExpenses && (
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={async () => {
                                if (confirm(`Delete expense "${exp.category}" of ${formatPKR(exp.amount)}? Associated cashbook payment will be reversed.`)) {
                                  await deleteExpense(exp.id, currentUser);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            {filteredExpenses.length > 0 && (
              <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold uppercase">Total Filtered Operating Overheads</span>
                <span className="text-base font-black text-rose-400 font-mono">
                  - {formatPKR(filteredExpensesTotal)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: RECURRING EXPENSES TEMPLATES */}
      {/* ========================================================================= */}
      {activeSubTab === 'recurring' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Monthly Scheduled Expense Templates</h3>
              <p className="text-xs text-slate-400">
                These templates generate monthly reminders at the start of each month so overheads don't need manual re-entry.
              </p>
            </div>
            {canManageExpenses && (
              <button
                onClick={() => setIsAddRecurringModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Template</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recurringExpenses.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 rounded-2xl bg-slate-900 border border-slate-800">
                <Repeat className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">No recurring templates set up</p>
                <p className="text-xs text-slate-500 mt-1">
                  Add regular expenses like Factory Rent, Salaries, Electricity, or Internet.
                </p>
              </div>
            ) : (
              recurringExpenses.map(rec => {
                const isPostedThisMonth = rec.last_posted_month === currentMonthKey;
                return (
                  <div 
                    key={rec.id}
                    className={`p-5 rounded-2xl bg-slate-900 border transition-all flex flex-col justify-between gap-4 ${
                      rec.is_active ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge variant={getCategoryBadgeVariant(rec.category)} size="sm">
                          {rec.category}
                        </Badge>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPostedThisMonth 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {isPostedThisMonth ? 'Posted This Month' : 'Due for Confirmation'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white mt-3">{rec.description}</h4>
                      <p className="text-2xl font-black text-amber-400 font-mono mt-1">
                        {formatPKR(rec.amount)}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                        <span>Payment: <strong className="text-slate-200 capitalize">{rec.payment_method}</strong></span>
                        <span>Freq: Monthly</span>
                      </div>
                    </div>

                    {canManageExpenses && (
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800 text-xs">
                        <button
                          onClick={() => updateRecurringExpense(rec.id, { is_active: !rec.is_active })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                            rec.is_active 
                              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {rec.is_active ? 'Pause' : 'Activate'}
                        </button>

                        <div className="flex items-center gap-1.5">
                          {!isPostedThisMonth && rec.is_active && (
                            <button
                              onClick={() => handleOpenConfirmPost(rec)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-colors"
                            >
                              Post Now
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (confirm(`Delete recurring template "${rec.description}"?`)) {
                                await deleteRecurringExpense(rec.id);
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD EXPENSE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddExpenseModalOpen}
        onClose={() => setIsAddExpenseModalOpen(false)}
        title="Record Operating Expense"
      >
        <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Expense Date *</label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Category *</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                {PREDEFINED_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                {allKnownCategories
                  .filter(c => !PREDEFINED_CATEGORIES.includes(c))
                  .map(cat => (
                    <option key={cat} value={cat}>{cat} (Custom)</option>
                  ))
                }
                <option value="custom">+ Add Custom Category...</option>
              </select>
            </div>
          </div>

          {/* Custom Category Input (if chosen) */}
          {expenseCategory === 'custom' && (
            <div>
              <label className="block text-slate-400 font-medium mb-1">Specify Custom Category Name *</label>
              <input
                type="text"
                required
                value={customCategoryInput}
                onChange={(e) => setCustomCategoryInput(e.target.value)}
                placeholder="e.g. Chemical Lab Testing, Legal Fees, Generator Diesel"
                className="w-full bg-slate-800 border border-amber-500/50 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          {/* Amount & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Amount (PKR) *</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 50000"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Payment Method *</label>
              <select
                value={expensePaymentMethod}
                onChange={(e) => setExpensePaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="cash">Cash in Hand</option>
                <option value="bank">Bank Transfer (Meezan / HBL)</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={expenseDescription}
              onChange={(e) => setExpenseDescription(e.target.value)}
              placeholder="e.g. Paid factory monthly rent for September 2026 to Landlord."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Recurring Checkbox */}
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="is_recurring_check"
              checked={expenseIsRecurring}
              onChange={(e) => setExpenseIsRecurring(e.target.checked)}
              className="mt-0.5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
            />
            <label htmlFor="is_recurring_check" className="cursor-pointer">
              <span className="font-semibold text-white block">Mark as Monthly Recurring Expense</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Will automatically remind you at the start of each month with a 1-click confirmation prompt. Does NOT auto-post silently.
              </span>
            </label>
          </div>

          {/* Notice of automatic Cashbook integration */}
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Posting will record a matching cash outflow voucher in the factory Cash Book.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsAddExpenseModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>{isSubmitting ? 'Posting...' : 'Save & Post Expense'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRM & QUICK POST RECURRING ITEM */}
      {/* ========================================================================= */}
      {isConfirmingPostId && (
        <Modal
          isOpen={true}
          onClose={() => setIsConfirmingPostId(null)}
          title={`Confirm Monthly Overhead: ${recurringExpenses.find(r => r.id === isConfirmingPostId)?.description}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">
              Confirm and post this scheduled monthly overhead for <strong>{currentMonthName}</strong>. You can adjust the amount or payment channel before posting.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Confirm Amount (PKR) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={postingCustomAmount}
                  onChange={(e) => setPostingCustomAmount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Confirm Payment Method *</label>
                <select
                  value={postingCustomMethod}
                  onChange={(e) => setPostingCustomMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmingPostId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmPostRecurring(isConfirmingPostId)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4 stroke-[3px]" />
                <span>Confirm & Post Now</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD RECURRING TEMPLATE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddRecurringModalOpen}
        onClose={() => setIsAddRecurringModalOpen(false)}
        title="Create Monthly Recurring Expense Template"
      >
        <form onSubmit={handleSubmitRecurringTemplate} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Category *</label>
            <select
              value={recCategory}
              onChange={(e) => setRecCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
            >
              {PREDEFINED_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="custom">+ Custom Category...</option>
            </select>
          </div>

          {recCategory === 'custom' && (
            <div>
              <label className="block text-slate-400 font-medium mb-1">Custom Category Name *</label>
              <input
                type="text"
                required
                value={recCustomCategory}
                onChange={(e) => setRecCustomCategory(e.target.value)}
                placeholder="e.g. Internet & Phone, Security Guard"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-400 font-medium mb-1">Template Title / Description *</label>
            <input
              type="text"
              required
              value={recDescription}
              onChange={(e) => setRecDescription(e.target.value)}
              placeholder="e.g. Factory Premises Monthly Rent, Labor Shift Payroll"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Default Monthly Amount (PKR) *</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 80000"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Default Payment Method *</label>
              <select
                value={recPaymentMethod}
                onChange={(e) => setRecPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsAddRecurringModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Repeat className="w-4 h-4" />
              <span>Save Template</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: SUPABASE SQL MIGRATION HELPER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isSqlHelpModalOpen}
        onClose={() => setIsSqlHelpModalOpen(false)}
        title="Supabase Cloud SQL Migration Script"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-300">
            To enable cloud persistence and real-time multi-device sync for Expenses, run this script once in your <strong>Supabase SQL Editor</strong>:
          </p>

          <div className="relative">
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56 select-all">
              {sqlSnippet}
            </pre>
            <button
              onClick={copySqlToClipboard}
              className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow transition-colors"
            >
              {sqlCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{sqlCopied ? 'Copied!' : 'Copy SQL'}</span>
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400 text-[11px]">
            💡 If the tables are not yet created, the application will automatically maintain expenses in the active session and sync them once the database tables exist.
          </div>
        </div>
      </Modal>
    </div>
  );
};
