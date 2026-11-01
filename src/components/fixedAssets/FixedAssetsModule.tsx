import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Layers, 
  DollarSign, 
  Clock, 
  Archive, 
  Trash2, 
  Edit3, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Coins, 
  Briefcase, 
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart,
  Landmark,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { FixedAsset, Partner, AssetCategory, AssetStatus } from '../../types';
import { formatPKR, formatDate, formatDateTime, getTodayDateString } from '../../utils/formatters';
import { 
  calculateMonthlyDepreciation, 
  calculateAccumulatedDepreciation, 
  calculateCurrentBookValue,
  calculatePartnerCapitalLedgers,
  PartnerCapitalSummary
} from '../../utils/assetCalculations';
import { Badge } from '../common/Badge';
import { AssetModal } from './AssetModal';
import { AssetDisposalModal } from './AssetDisposalModal';
import { AssetDetailModal } from './AssetDetailModal';
import { PartnerModal } from './PartnerModal';
import { FixedAssetsPrintModal } from './FixedAssetsPrintModal';

export const FixedAssetsModule: React.FC = () => {
  const { 
    fixedAssets, 
    partners, 
    partnerCapitalTransactions, 
    payments,
    isLoadingCloudData,
    addFixedAsset, 
    updateFixedAsset, 
    deleteFixedAsset, 
    archiveOrDisposeFixedAsset,
    addPartner, 
    updatePartner, 
    deletePartner 
  } = useApp();

  const { currentUser, isOwner } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'register' | 'capital_ledger' | 'partners'>('register');

  // Filters for Asset Register
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal States
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailAsset, setSelectedDetailAsset] = useState<FixedAsset | null>(null);

  const [isDisposalModalOpen, setIsDisposalModalOpen] = useState(false);
  const [selectedDisposalAsset, setSelectedDisposalAsset] = useState<FixedAsset | null>(null);

  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  // Print Modal States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printReportType, setPrintReportType] = useState<'asset_register' | 'partner_capital_summary' | 'partner_ledger'>('asset_register');

  // Selected Partner for Capital Ledger
  const [selectedLedgerPartnerId, setSelectedLedgerPartnerId] = useState<string>(partners[0]?.id || '');

  // Calculate Authoritative Partner Capital Summaries
  const partnerCapitalData = calculatePartnerCapitalLedgers(partners, partnerCapitalTransactions, payments);
  const { summaries: partnerSummaries, totalEquityCapital, totalPartnerLoans } = partnerCapitalData;

  // Set default selected partner if empty
  const currentSelectedPartnerId = selectedLedgerPartnerId || partners[0]?.id || '';
  const currentPartnerSummary = partnerSummaries.find(s => s.partnerId === currentSelectedPartnerId) || partnerSummaries[0];

  // Derived Asset Register Totals
  const totalAssetsCost = fixedAssets.reduce((sum, a) => sum + Number(a.total_cost || 0), 0);
  const totalActiveBookValue = fixedAssets
    .filter(a => a.status === 'active')
    .reduce((sum, a) => sum + calculateCurrentBookValue(a), 0);
  const totalAccumulatedDepreciation = fixedAssets
    .reduce((sum, a) => sum + calculateAccumulatedDepreciation(a), 0);
  const activeAssetsCount = fixedAssets.filter(a => a.status === 'active').length;

  // Filtered Assets
  const filteredAssets = fixedAssets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.asset_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.vendor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Selected Partner Ledger Transactions
  const getPartnerLedgerRows = () => {
    if (!currentPartnerSummary) return [];

    const pId = currentPartnerSummary.partnerId;
    const pName = currentPartnerSummary.partnerName.toLowerCase();

    const rows: {
      date: string;
      ref: string;
      type: string;
      contribution_type: string;
      description: string;
      debit: number;   // Outflow / Withdrawal (decreases capital)
      credit: number;  // Inflow / Contribution (increases capital)
      balance: number;
    }[] = [];

    // 1. Initial Capital row if > 0
    if (currentPartnerSummary.initialCapital > 0) {
      rows.push({
        date: '2026-01-01',
        ref: 'FOUNDING',
        type: 'Initial Capital',
        contribution_type: 'Capital',
        description: `Founding initial contributed capital balance`,
        debit: 0,
        credit: currentPartnerSummary.initialCapital,
        balance: 0,
      });
    }

    // 2. Transactions from partner_capital_transactions table
    const txns = partnerCapitalTransactions.filter(
      t => t.partner_id === pId || t.partner_name.toLowerCase() === pName
    );

    txns.forEach(t => {
      const isOutflow = t.transaction_type === 'withdrawal' || t.transaction_type === 'loan_repayment';
      const typeLabel = 
        t.transaction_type === 'asset_contribution' ? 'Fixed Asset Contribution' :
        t.transaction_type === 'contribution' ? 'Direct Cash Injection' :
        t.transaction_type === 'loan_received' ? 'Partner Loan' :
        t.transaction_type === 'withdrawal' ? 'Drawing / Withdrawal' : 'Loan Repayment';

      rows.push({
        date: t.date,
        ref: t.reference_no || t.reference_type || 'TXN',
        type: typeLabel,
        contribution_type: t.contribution_type === 'loan' ? 'Loan' : 'Capital',
        description: t.notes || `${typeLabel} (${t.reference_type || 'manual'})`,
        debit: isOutflow ? Number(t.amount || 0) : 0,
        credit: isOutflow ? 0 : Number(t.amount || 0),
        balance: 0,
      });
    });

    // 3. Fallback matching cash injections/withdrawals from payments table (preventing double counting)
    const matchingPayments = payments.filter(p => {
      if (p.related_to !== 'capital_injection' && p.related_to !== 'owner_withdrawal') return false;
      const notes = (p.notes || '').toLowerCase();
      const createdBy = (p.created_by || '').toLowerCase();
      return (createdBy.includes(pName) || notes.includes(pName)) &&
             !txns.some(t => t.reference_id === p.id || (t.reference_no && t.reference_no === p.transaction_ref));
    });

    matchingPayments.forEach(p => {
      const isDrawing = p.related_to === 'owner_withdrawal';
      rows.push({
        date: p.date.split('T')[0],
        ref: p.transaction_ref || (isDrawing ? 'DRAWING' : 'CAP-INJ'),
        type: isDrawing ? 'Drawing / Withdrawal' : 'Direct Cash Injection',
        contribution_type: 'Capital',
        description: p.notes || (isDrawing ? 'Owner drawing from factory cash' : 'Cash injection into business'),
        debit: isDrawing ? Number(p.amount || 0) : 0,
        credit: isDrawing ? 0 : Number(p.amount || 0),
        balance: 0,
      });
    });

    // Sort chronologically ascending to calculate running balance
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    rows.forEach(r => {
      running = running + r.credit - r.debit;
      r.balance = Number(running.toFixed(2));
    });

    return rows.reverse(); // Display most recent first
  };

  const partnerLedgerRows = getPartnerLedgerRows();

  // Handlers
  const handleSaveAsset = async (assetData: {
    asset: Omit<FixedAsset, 'id' | 'asset_code' | 'created_at' | 'updated_at'>;
    fundings: any[];
  }) => {
    if (editingAsset) {
      await updateFixedAsset(editingAsset.id, assetData.asset, assetData.fundings, currentUser);
    } else {
      await addFixedAsset({ ...assetData, user: currentUser });
    }
  };

  const handleDeleteAsset = async (asset: FixedAsset) => {
    if (window.confirm(`Are you sure you want to permanently delete asset "${asset.name}" (${asset.asset_code})?\n\nThis will automatically reverse all linked cash outflows from the Cash Book and partner capital credits to maintain perfect ledger integrity.`)) {
      try {
        await deleteFixedAsset(asset.id, currentUser);
      } catch (err: any) {
        alert(err.message || 'Failed to delete asset.');
      }
    }
  };

  const handleSavePartner = async (partnerData: Omit<Partner, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingPartner) {
      await updatePartner(editingPartner.id, partnerData);
    } else {
      await addPartner(partnerData);
    }
  };

  const handleDeletePartner = async (partner: Partner) => {
    if (window.confirm(`Are you sure you want to delete partner "${partner.name}"?`)) {
      try {
        await deletePartner(partner.id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete partner.');
      }
    }
  };

  // CSV Export for Asset Register
  const exportAssetRegisterCSV = () => {
    const headers = [
      'Asset Code',
      'Name',
      'Category',
      'Purchase Date',
      'Vendor',
      'Total Cost (PKR)',
      'Useful Life (Years)',
      'Salvage Value (PKR)',
      'Accumulated Depreciation (PKR)',
      'Current Book Value (PKR)',
      'Status',
      'Notes'
    ];

    const rows = filteredAssets.map(a => [
      a.asset_code,
      `"${a.name.replace(/"/g, '""')}"`,
      a.category,
      a.purchase_date,
      `"${(a.vendor || '').replace(/"/g, '""')}"`,
      a.total_cost,
      a.useful_life_years,
      a.salvage_value,
      calculateAccumulatedDepreciation(a),
      calculateCurrentBookValue(a),
      a.status,
      `"${(a.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Asset_Register_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for Partner Capital
  const exportPartnerCapitalCSV = () => {
    if (!currentPartnerSummary) return;

    const headers = [
      'Date',
      'Reference',
      'Transaction Type',
      'Classification',
      'Description',
      'Money In / Credit (+)',
      'Money Out / Debit (-)',
      'Running Balance (PKR)'
    ];

    const rows = partnerLedgerRows.map(r => [
      r.date,
      r.ref,
      `"${r.type}"`,
      r.contribution_type,
      `"${r.description.replace(/"/g, '""')}"`,
      r.credit,
      r.debit,
      r.balance
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Partner_Capital_${currentPartnerSummary.partnerName}_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (activeTab === 'register') {
      setPrintReportType('asset_register');
    } else if (activeTab === 'capital_ledger') {
      setPrintReportType('partner_capital_summary');
    } else {
      setPrintReportType('partner_capital_summary');
    }
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Top Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
              Admin & Partner Management
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Fixed Assets & Partner Capital</h1>
          <p className="text-slate-300 text-xs mt-1 max-w-2xl">
            Company assets, weighing scales, and machinery records with split funding sources (business cash vs partner capital), straight-line depreciation, and authoritative partner capital ledgers.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'register' && (
            <button
              onClick={() => {
                setEditingAsset(null);
                setIsAssetModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>Record Fixed Asset</span>
            </button>
          )}

          {activeTab === 'partners' && (
            <button
              onClick={() => {
                setEditingPartner(null);
                setIsPartnerModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>Add New Partner</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            disabled={isLoadingCloudData}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-white font-semibold text-xs border border-slate-700 transition-all ${
              isLoadingCloudData
                ? 'bg-slate-800/50 opacity-60 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 active:scale-95'
            }`}
            title={isLoadingCloudData ? 'Loading data from cloud...' : 'Open print preview & PDF'}
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>
              {isLoadingCloudData
                ? 'Loading Data...'
                : activeTab === 'register'
                ? 'Print Asset Register'
                : activeTab === 'capital_ledger'
                ? 'Print Capital Report'
                : 'Print Partners Report'}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 print:hidden">
        <button
          onClick={() => setActiveTab('register')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'register'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Asset Register ({fixedAssets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('capital_ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'capital_ledger'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Partner Capital Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('partners')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'partners'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Partners List ({partners.length})</span>
        </button>
      </div>

      {/* TAB 1: ASSET REGISTER */}
      {activeTab === 'register' && (
        <div className="space-y-5">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Fixed Assets (Cost)</span>
              <p className="text-xl font-black text-white font-mono mt-1">{formatPKR(totalAssetsCost)}</p>
              <p className="text-[11px] text-slate-500 mt-1">{fixedAssets.length} recorded equipment items</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Accumulated Depreciation</span>
              <p className="text-xl font-black text-rose-400 font-mono mt-1">{formatPKR(totalAccumulatedDepreciation)}</p>
              <p className="text-[11px] text-slate-500 mt-1">Non-cash depreciation to date</p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-400">Current Net Book Value</span>
              <p className="text-xl font-black text-emerald-300 font-mono mt-1">{formatPKR(totalActiveBookValue)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Active balance sheet asset valuation</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Active Assets in Factory</span>
              <p className="text-xl font-black text-cyan-400 font-mono mt-1">{activeAssetsCount}</p>
              <p className="text-[11px] text-slate-500 mt-1">Operational plant & office machinery</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search assets by name, code, vendor..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="Machinery">Machinery</option>
                <option value="Equipment">Equipment</option>
                <option value="Vehicle">Vehicle</option>
                <option value="Furniture">Furniture</option>
                <option value="Other">Other</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="disposed">Disposed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportAssetRegisterCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => {
                  setPrintReportType('asset_register');
                  setIsPrintModalOpen(true);
                }}
                disabled={isLoadingCloudData}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isLoadingCloudData
                    ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700 active:scale-95'
                }`}
                title="Print filtered asset register preview & PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Register ({filteredAssets.length})</span>
              </button>
            </div>
          </div>

          {/* Assets Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Asset Code</th>
                  <th className="py-3.5 px-4">Asset Name & Category</th>
                  <th className="py-3.5 px-4">Purchase Date</th>
                  <th className="py-3.5 px-4 text-right">Total Cost</th>
                  <th className="py-3.5 px-4 text-center">Life / Monthly</th>
                  <th className="py-3.5 px-4 text-right">Accum. Dep</th>
                  <th className="py-3.5 px-4 text-right">Book Value</th>
                  <th className="py-3.5 px-4">Funding Split</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      No fixed assets found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map(asset => {
                    const monthly = calculateMonthlyDepreciation(asset);
                    const accum = calculateAccumulatedDepreciation(asset);
                    const bookVal = calculateCurrentBookValue(asset);

                    const bizFunding = (asset.fundings || []).find(f => f.funding_type === 'business');
                    const partnerFundings = (asset.fundings || []).filter(f => f.funding_type === 'partner');

                    return (
                      <tr key={asset.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Code */}
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {asset.asset_code}
                        </td>

                        {/* Name & Category */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-white text-xs">{asset.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                              {asset.category}
                            </span>
                            {asset.vendor && (
                              <span className="text-[10px] text-slate-500">• {asset.vendor}</span>
                            )}
                          </div>
                        </td>

                        {/* Purchase Date */}
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {formatDate(asset.purchase_date)}
                        </td>

                        {/* Total Cost */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {formatPKR(asset.total_cost)}
                        </td>

                        {/* Life & Monthly Dep */}
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="text-white font-semibold">{asset.useful_life_years}y</span>
                          <span className="block text-[10px] text-cyan-400">{formatPKR(monthly)}/mo</span>
                        </td>

                        {/* Accum Dep */}
                        <td className="py-3 px-4 text-right font-mono text-rose-400">
                          {formatPKR(accum)}
                        </td>

                        {/* Current Book Value */}
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-400">
                          {formatPKR(bookVal)}
                        </td>

                        {/* Funding Split Badges */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 text-[10px]">
                            {bizFunding && bizFunding.business_amount > 0 && (
                              <span className="text-emerald-400 font-mono">
                                • Business: {formatPKR(bizFunding.business_amount)}
                              </span>
                            )}
                            {partnerFundings.map((pf, i) => (
                              <span key={i} className="text-indigo-300 font-mono">
                                • {pf.partner_name || 'Partner'}: {formatPKR(pf.partner_amount)} ({pf.partner_contribution_type})
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {asset.status === 'active' && <Badge variant="emerald" size="sm">Active</Badge>}
                          {asset.status === 'disposed' && <Badge variant="amber" size="sm">Disposed</Badge>}
                          {asset.status === 'archived' && <Badge variant="rose" size="sm">Archived</Badge>}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right print:hidden">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedDetailAsset(asset);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              title="View details & funding split"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setEditingAsset(asset);
                                setIsAssetModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors"
                              title="Edit asset & rebalance split"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {asset.status === 'active' && (
                              <button
                                onClick={() => {
                                  setSelectedDisposalAsset(asset);
                                  setIsDisposalModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 transition-colors"
                                title="Dispose / Archive asset"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteAsset(asset)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition-colors"
                              title="Delete asset (reverses all linked transactions)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PARTNER CAPITAL LEDGER */}
      {activeTab === 'capital_ledger' && (
        <div className="space-y-6">
          {/* Top Equity Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
              <span className="text-[10px] uppercase font-bold text-indigo-400">Total Partners Equity Capital</span>
              <p className="text-xl font-black text-indigo-300 font-mono mt-1">{formatPKR(totalEquityCapital)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Net equity balance across all partners</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Partner Loans</span>
              <p className="text-xl font-black text-amber-300 font-mono mt-1">{formatPKR(totalPartnerLoans)}</p>
              <p className="text-[11px] text-slate-500 mt-1">Repayable partner liabilities</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Active Partners</span>
              <p className="text-xl font-black text-white font-mono mt-1">{partners.filter(p => p.is_active).length}</p>
              <p className="text-[11px] text-slate-500 mt-1">Founders & equity stakeholders</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Capital Ledger Policy</span>
              <p className="text-sm font-bold text-emerald-400 mt-1">100% Reconciled</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Asset purchases + cash injections tracked without double-count</p>
            </div>
          </div>

          {/* Partner Selection Cards with Share % */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Partner Capital Accounts & Equity Shares</span>
              </span>

              <button
                onClick={() => {
                  setPrintReportType('partner_capital_summary');
                  setIsPrintModalOpen(true);
                }}
                disabled={isLoadingCloudData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Print Capital Summary</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {partnerSummaries.map(summary => {
                const isSelected = summary.partnerId === currentSelectedPartnerId;
                return (
                  <div
                    key={summary.partnerId}
                    onClick={() => setSelectedLedgerPartnerId(summary.partnerId)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xl'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 font-black flex items-center justify-center text-sm">
                          {summary.partnerName.slice(0, 1)}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{summary.partnerName}</h4>
                          <span className="text-[10px] text-slate-400">
                            {summary.isActive ? 'Active Partner' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-400 font-mono">
                          {summary.shareOfTotalCapitalPercent}%
                        </span>
                        <span className="block text-[9px] text-slate-400 uppercase">Equity Share</span>
                      </div>
                    </div>

                    {/* Progress bar of equity share */}
                    <div className="w-full bg-slate-950 rounded-full h-1.5 mt-3 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, summary.shareOfTotalCapitalPercent)}%` }}
                      />
                    </div>

                    {/* Breakdown metrics */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-sans">Net Capital</span>
                        <p className="font-bold text-white mt-0.5">{formatPKR(summary.netCapitalBalance)}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 text-[10px] uppercase font-sans">Asset Contrib</span>
                        <p className="font-bold text-indigo-300 mt-0.5">{formatPKR(summary.assetContributions)}</p>
                      </div>

                      {summary.loanContributions > 0 && (
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-sans">Loans Held</span>
                          <p className="font-bold text-amber-300 mt-0.5">{formatPKR(summary.loanContributions)}</p>
                        </div>
                      )}

                      {summary.withdrawals > 0 && (
                        <div className="text-right">
                          <span className="text-slate-400 text-[10px] uppercase font-sans">Drawings</span>
                          <p className="font-bold text-rose-400 mt-0.5">- {formatPKR(summary.withdrawals)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Ledger for Selected Partner */}
          {currentPartnerSummary && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-indigo-400" />
                    <span>Statement of Partner Capital Account: {currentPartnerSummary.partnerName}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chronological audit trail of all direct asset purchase splits, cash injections, and personal drawings.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportPartnerCapitalCSV}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Statement CSV</span>
                  </button>

                  <button
                    onClick={() => {
                      setPrintReportType('partner_ledger');
                      setIsPrintModalOpen(true);
                    }}
                    disabled={isLoadingCloudData || !currentPartnerSummary}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                    title="Print formal partner capital account statement"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Partner Statement</span>
                  </button>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Ref #</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Classification</th>
                      <th className="py-3.5 px-4">Description / Notes</th>
                      <th className="py-3.5 px-4 text-right">Contribution (+)</th>
                      <th className="py-3.5 px-4 text-right">Drawing (-)</th>
                      <th className="py-3.5 px-4 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {partnerLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500">
                          No transactions recorded for this partner yet.
                        </td>
                      </tr>
                    ) : (
                      partnerLedgerRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors font-mono">
                          <td className="py-3 px-4 text-slate-400 font-sans text-[11px] whitespace-nowrap">
                            {formatDate(row.date)}
                          </td>
                          <td className="py-3 px-4 text-indigo-400 font-bold">
                            {row.ref}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold">
                              {row.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <Badge variant={row.contribution_type === 'Loan' ? 'amber' : 'emerald'} size="sm">
                              {row.contribution_type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-300 text-xs">
                            {row.description}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400">
                            {row.credit > 0 ? `+${formatPKR(row.credit)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-400">
                            {row.debit > 0 ? `-${formatPKR(row.debit)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-white text-xs">
                            {formatPKR(row.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PARTNERS MANAGEMENT */}
      {activeTab === 'partners' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Partners Directory ({partners.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Admin-managed list of founders and equity contributors for asset splits and capital injections.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingPartner(null);
                setIsPartnerModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/10 active:scale-95 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>Add Partner</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Partner Name</th>
                  <th className="py-3.5 px-4">Contact Phone</th>
                  <th className="py-3.5 px-4">Email Address</th>
                  <th className="py-3.5 px-4 text-right">Initial Capital</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {partners.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.phone || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.email || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">
                      {formatPKR(p.initial_capital || 0)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={p.is_active ? 'emerald' : 'rose'} size="sm">
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingPartner(p);
                            setIsPartnerModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors"
                          title="Edit partner"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePartner(p)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Delete partner"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {isAssetModalOpen && (
        <AssetModal
          isOpen={isAssetModalOpen}
          onClose={() => {
            setIsAssetModalOpen(false);
            setEditingAsset(null);
          }}
          onSave={handleSaveAsset}
          partners={partners}
          initialAsset={editingAsset}
        />
      )}

      {isDetailModalOpen && (
        <AssetDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedDetailAsset(null);
          }}
          asset={selectedDetailAsset}
          partners={partners}
        />
      )}

      {isDisposalModalOpen && (
        <AssetDisposalModal
          isOpen={isDisposalModalOpen}
          onClose={() => {
            setIsDisposalModalOpen(false);
            setSelectedDisposalAsset(null);
          }}
          asset={selectedDisposalAsset}
          onConfirm={async (data) => {
            if (selectedDisposalAsset) {
              await archiveOrDisposeFixedAsset(selectedDisposalAsset.id, data, currentUser);
            }
          }}
        />
      )}

      {isPartnerModalOpen && (
        <PartnerModal
          isOpen={isPartnerModalOpen}
          onClose={() => {
            setIsPartnerModalOpen(false);
            setEditingPartner(null);
          }}
          onSave={handleSavePartner}
          initialPartner={editingPartner}
        />
      )}

      {/* Fixed Assets & Partner Capital Multi-Page Print Modal */}
      {isPrintModalOpen && (
        <FixedAssetsPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          reportType={printReportType}
          isLoading={isLoadingCloudData}
          assets={filteredAssets}
          totalAssetsCost={filteredAssets.reduce((sum, a) => sum + Number(a.total_cost || 0), 0)}
          totalAccumulatedDepreciation={filteredAssets.reduce((sum, a) => sum + calculateAccumulatedDepreciation(a), 0)}
          totalBookValue={filteredAssets.reduce((sum, a) => sum + calculateCurrentBookValue(a), 0)}
          activeFilterSummary={
            printReportType === 'asset_register'
              ? [
                  searchTerm ? `Search: "${searchTerm}"` : null,
                  categoryFilter !== 'all' ? `Category: ${categoryFilter}` : null,
                  statusFilter !== 'all' ? `Status: ${statusFilter}` : null
                ].filter(Boolean).join(' • ') || 'All Assets (No Filters)'
              : printReportType === 'partner_ledger'
              ? `Partner: ${currentPartnerSummary?.partnerName || 'Selected'} • Full Historical Ledger`
              : 'All Partners • Full Contributed Equity & Drawings Summary'
          }
          partnerSummaries={partnerSummaries}
          totalEquityCapital={totalEquityCapital}
          totalPartnerLoans={totalPartnerLoans}
          selectedPartner={currentPartnerSummary}
          partnerLedgerRows={getPartnerLedgerRows()}
          generatedByName={currentUser.name}
        />
      )}
    </div>
  );
};
