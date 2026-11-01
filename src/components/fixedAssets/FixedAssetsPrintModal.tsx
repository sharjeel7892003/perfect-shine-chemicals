import React, { useState } from 'react';
import { Printer, X, Download, FileText, CheckCircle2, Building2, Coins, ArrowRight } from 'lucide-react';
import { FixedAsset, Partner } from '../../types';
import { formatPKR, formatDate, formatDateTime, getTodayDateString } from '../../utils/formatters';
import { 
  calculateMonthlyDepreciation, 
  calculateAccumulatedDepreciation, 
  calculateCurrentBookValue,
  PartnerCapitalSummary
} from '../../utils/assetCalculations';
import { printElement } from '../../utils/printHelper';

export interface FixedAssetsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: 'asset_register' | 'partner_capital_summary' | 'partner_ledger';
  isLoading?: boolean;
  // Asset Register Data
  assets?: FixedAsset[];
  totalAssetsCost?: number;
  totalAccumulatedDepreciation?: number;
  totalBookValue?: number;
  activeFilterSummary?: string;
  // Partner Capital Data
  partnerSummaries?: PartnerCapitalSummary[];
  totalEquityCapital?: number;
  totalPartnerLoans?: number;
  selectedPartner?: PartnerCapitalSummary;
  partnerLedgerRows?: {
    date: string;
    ref: string;
    description: string;
    type: string;
    credit: number;
    debit: number;
    balance: number;
  }[];
  generatedByName?: string;
}

export const FixedAssetsPrintModal: React.FC<FixedAssetsPrintModalProps> = ({
  isOpen,
  onClose,
  reportType,
  isLoading = false,
  assets = [],
  totalAssetsCost = 0,
  totalAccumulatedDepreciation = 0,
  totalBookValue = 0,
  activeFilterSummary = 'All Records',
  partnerSummaries = [],
  totalEquityCapital = 0,
  totalPartnerLoans = 0,
  selectedPartner,
  partnerLedgerRows = [],
  generatedByName = 'Admin / Accounts'
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    reportType === 'asset_register' ? 'landscape' : 'portrait'
  );
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  if (!isOpen) return null;

  const getReportTitle = () => {
    switch (reportType) {
      case 'asset_register':
        return 'Company Fixed Assets & Equipment Register';
      case 'partner_capital_summary':
        return 'Partner Capital & Contributed Equity Summary';
      case 'partner_ledger':
        return `Partner Capital Ledger — ${selectedPartner?.partnerName || 'Partner'}`;
      default:
        return 'Fixed Assets & Partner Capital Report';
    }
  };

  const getDocumentCode = () => {
    switch (reportType) {
      case 'asset_register':
        return `FAR-${getTodayDateString().replace(/-/g, '')}`;
      case 'partner_capital_summary':
        return `PCS-${getTodayDateString().replace(/-/g, '')}`;
      case 'partner_ledger':
        return `PCL-${(selectedPartner?.partnerName || 'PTR').slice(0, 3).toUpperCase()}-${getTodayDateString().replace(/-/g, '')}`;
      default:
        return `REP-${Date.now().toString().slice(-6)}`;
    }
  };

  const rowCount = reportType === 'asset_register'
    ? assets.length
    : reportType === 'partner_capital_summary'
    ? partnerSummaries.length
    : partnerLedgerRows.length;

  const handlePrint = async () => {
    if (isLoading || rowCount === 0) return;
    setIsPrinting(true);
    try {
      const docTitle = `PSC_${getReportTitle().replace(/[^a-zA-Z0-9]/g, '_')}_${getTodayDateString()}`;
      await printElement('printable-fixed-assets-report', docTitle, {
        orientation,
      });
    } catch (err) {
      console.error('[FixedAssetsPrintModal error]:', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl shadow-black/80 flex flex-col max-h-[96vh]">
        {/* Top Control Bar (Hidden from print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Print & PDF Preview</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/20">
                  {rowCount} Rows to Print
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact on-screen filtered records formatted for A4 {orientation} printing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Orientation Toggle */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  orientation === 'portrait'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  orientation === 'landscape'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Landscape
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              disabled={isLoading || isPrinting}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${
                isLoading || isPrinting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              <Printer className="w-4 h-4 stroke-[2.5px]" />
              <span>{isPrinting ? 'Preparing Print...' : 'Print / Save as PDF'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper Area (Rendered in clean white background for WYSIWYG preview & isolated printing) */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-950/40 flex-1 flex justify-center">
          <div 
            id="printable-fixed-assets-report"
            className={`w-full bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-xl transition-all min-h-[500px] print:min-h-0 ${
              orientation === 'landscape' ? 'max-w-[1100px]' : 'max-w-[850px]'
            }`}
          >
            {/* 1. OFFICIAL COMPANY HEADER (IDENTICAL TO INVOICES, NO TAX FIELDS) */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-4">
              <div className="flex items-start gap-4">
                <img 
                  src="/assets/logo.png" 
                  alt="Perfect Shine Chemicals" 
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" 
                />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
                    PERFECT SHINE CHEMICALS
                  </h1>
                  <p className="text-xs text-slate-700 font-semibold mt-1">
                    Industrial & Commercial Cleaning Solutions Manufacturer
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore, Pakistan
                  </p>
                  <p className="text-xs text-slate-800 font-bold mt-0.5">
                    Tel / WhatsApp: <span className="font-mono text-slate-900">0327-4549485</span>
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider mb-1.5">
                  {reportType === 'asset_register' ? 'Asset Register' : 'Partner Equity'}
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  Doc Ref: <span className="font-mono font-bold text-slate-800">{getDocumentCode()}</span>
                </p>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Generated: <span className="font-bold text-slate-800">{formatDateTime(new Date().toISOString())}</span>
                </p>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Prepared By: <span className="font-semibold text-slate-800">{generatedByName}</span>
                </p>
              </div>
            </div>

            {/* 2. REPORT TITLE & ACTIVE SCOPE BANNER */}
            <div className="my-5 p-3.5 rounded-xl bg-slate-100 border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                  {getReportTitle()}
                </h2>
                <p className="text-slate-600 mt-0.5">
                  Active Filter Scope: <strong className="text-slate-900">{activeFilterSummary}</strong>
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="font-mono font-bold text-slate-800">
                  Total Records: {rowCount}
                </span>
                <span className="text-slate-500 block text-[11px]">
                  All rows matching on-screen criteria
                </span>
              </div>
            </div>

            {/* 3. EXECUTIVE KPI CARDS */}
            {reportType === 'asset_register' && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Historical Cost
                  </span>
                  <p className="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {formatPKR(totalAssetsCost)}
                  </p>
                  <p className="text-[10px] text-slate-500">Gross asset acquisition cost</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                    Accumulated Depreciation
                  </span>
                  <p className="text-lg font-black font-mono text-rose-700 mt-0.5">
                    -{formatPKR(totalAccumulatedDepreciation)}
                  </p>
                  <p className="text-[10px] text-slate-500">Non-cash straight-line written down</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Current Net Book Value
                  </span>
                  <p className="text-lg font-black font-mono text-emerald-700 mt-0.5">
                    {formatPKR(totalBookValue)}
                  </p>
                  <p className="text-[10px] text-slate-500">Balance sheet asset valuation</p>
                </div>
              </div>
            )}

            {reportType === 'partner_capital_summary' && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Total Contributed Equity
                  </span>
                  <p className="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {formatPKR(totalEquityCapital)}
                  </p>
                  <p className="text-[10px] text-slate-500">Partner capital & asset contributions</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                    Repayable Partner Loans
                  </span>
                  <p className="text-lg font-black font-mono text-amber-700 mt-0.5">
                    {formatPKR(totalPartnerLoans)}
                  </p>
                  <p className="text-[10px] text-slate-500">Company loan liabilities to partners</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Active Partner Accounts
                  </span>
                  <p className="text-lg font-black font-mono text-emerald-700 mt-0.5">
                    {partnerSummaries.length} Partners
                  </p>
                  <p className="text-[10px] text-slate-500">Administered in ownership registry</p>
                </div>
              </div>
            )}

            {reportType === 'partner_ledger' && selectedPartner && (
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Total Contributed
                  </span>
                  <p className="text-base font-black font-mono text-emerald-700 mt-0.5">
                    +{formatPKR(selectedPartner.totalContributedCapital)}
                  </p>
                  <p className="text-[10px] text-slate-500">Capital injections & assets</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                    Drawings / Withdrawals
                  </span>
                  <p className="text-base font-black font-mono text-rose-700 mt-0.5">
                    -{formatPKR(selectedPartner.withdrawals)}
                  </p>
                  <p className="text-[10px] text-slate-500">Personal drawings</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 block">
                    Net Capital Balance
                  </span>
                  <p className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {formatPKR(selectedPartner.netCapitalBalance)}
                  </p>
                  <p className="text-[10px] text-slate-500">Current equity stake</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Contributed Share %
                  </span>
                  <p className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {selectedPartner.shareOfTotalCapitalPercent.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-slate-500">Share of total capital</p>
                </div>
              </div>
            )}

            {/* 4. MAIN DATA TABLE (UNCLIPPED WITH REPEATING THEAD FOR MULTI-PAGE FLOW) */}
            <div className="border border-slate-300 rounded-xl overflow-hidden mb-6 print:overflow-visible print:border-none print:rounded-none">
              {/* TAB 1: ASSET REGISTER TABLE */}
              {reportType === 'asset_register' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-2.5 px-3 border-r border-slate-800">Code</th>
                      <th className="py-2.5 px-3 border-r border-slate-800">Asset Name & Category</th>
                      <th className="py-2.5 px-3 border-r border-slate-800">Vendor</th>
                      <th className="py-2.5 px-3 border-r border-slate-800">Purchase Date</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-center">Life (Yrs)</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Cost (PKR)</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Monthly Dep</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Accum Dep</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Book Value</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {assets.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-slate-500 font-medium">
                          No fixed assets found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      assets.map((asset) => {
                        const monthly = calculateMonthlyDepreciation(asset);
                        const accum = calculateAccumulatedDepreciation(asset);
                        const bookVal = calculateCurrentBookValue(asset);

                        return (
                          <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                              {asset.asset_code}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200">
                              <p className="font-bold text-slate-900">{asset.name}</p>
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                                {asset.category}
                              </span>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                              {asset.vendor || '-'}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                              {formatDate(asset.purchase_date)}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-700">
                              {asset.useful_life_years}y ({asset.useful_life_years * 12}m)
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                              {formatPKR(asset.total_cost)}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-slate-700">
                              {formatPKR(monthly)}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-rose-700">
                              -{formatPKR(accum)}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                              {formatPKR(bookVal)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                asset.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : asset.status === 'disposed'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {asset.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-bold text-slate-900 text-[11px]">
                    <tr>
                      <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider">
                        Total Asset Register Valuations:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-950 font-black">
                        {formatPKR(totalAssetsCost)}
                      </td>
                      <td className="py-2.5 px-3"></td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-black">
                        -{formatPKR(totalAccumulatedDepreciation)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 font-black">
                        {formatPKR(totalBookValue)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* TAB 2: PARTNER CAPITAL SUMMARY TABLE */}
              {reportType === 'partner_capital_summary' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-2.5 px-3 border-r border-slate-800">Partner Name</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Initial Capital</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Cash Additions</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Asset Additions</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Total Contributed</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Drawings (-)</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Net Balance PKR</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Capital Share %</th>
                      <th className="py-2.5 px-3 text-right">Partner Loans</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {partnerSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-500 font-medium">
                          No partners found in the registry.
                        </td>
                      </tr>
                    ) : (
                      partnerSummaries.map((summary) => (
                        <tr key={summary.partnerId} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-slate-200">
                            {summary.partnerName}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-700">
                            {formatPKR(summary.initialCapital)}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-700">
                            +{formatPKR(summary.cashContributions)}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-700">
                            +{formatPKR(summary.assetContributions)}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                            {formatPKR(summary.totalContributedCapital)}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-rose-700">
                            -{formatPKR(summary.withdrawals)}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-black text-slate-950">
                            {formatPKR(summary.netCapitalBalance)}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                            {summary.shareOfTotalCapitalPercent.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-semibold">
                            {summary.loanContributions > 0 ? formatPKR(summary.loanContributions) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-bold text-slate-900 text-[11px]">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider">
                        Total Contributed Capital:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950">
                        {formatPKR(totalEquityCapital)}
                      </td>
                      <td></td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950">
                        {formatPKR(totalEquityCapital)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">100.0%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                        {formatPKR(totalPartnerLoans)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* TAB 3: INDIVIDUAL PARTNER LEDGER TABLE */}
              {reportType === 'partner_ledger' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-2.5 px-3 border-r border-slate-800">Date</th>
                      <th className="py-2.5 px-3 border-r border-slate-800">Ref #</th>
                      <th className="py-2.5 px-3 border-r border-slate-800">Transaction Particulars</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-center">Type</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Debit / Drawings</th>
                      <th className="py-2.5 px-3 border-r border-slate-800 text-right">Credit / Additions</th>
                      <th className="py-2.5 px-3 text-right">Running Balance PKR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {partnerLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-500 font-medium">
                          No transactions recorded for this partner account.
                        </td>
                      </tr>
                    ) : (
                      partnerLedgerRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                            {formatDate(row.date)}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {row.ref}
                          </td>
                          <td className="py-2 px-3 text-slate-800 border-r border-slate-200">
                            {row.description}
                          </td>
                          <td className="py-2 px-3 text-center border-r border-slate-200">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {row.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-rose-700 border-r border-slate-200">
                            {row.debit > 0 ? `-${formatPKR(row.debit)}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700 border-r border-slate-200 font-semibold">
                            {row.credit > 0 ? `+${formatPKR(row.credit)}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatPKR(row.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {selectedPartner && (
                    <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-bold text-slate-900 text-[11px]">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider">
                          Net Equity Balance for {selectedPartner.partnerName}:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                          -{formatPKR(selectedPartner.withdrawals)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          +{formatPKR(selectedPartner.totalContributedCapital)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950">
                          {formatPKR(selectedPartner.netCapitalBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>

            {/* 5. OFFICIAL SIGNATURES & VERIFICATION BLOCK */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-xs">
              <div className="flex flex-col sm:flex-row justify-between items-end gap-8 pt-6">
                <div className="w-full sm:w-64 border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-900">Prepared By (Accounts Officer)</p>
                  <p className="text-[10px] text-slate-500">Perfect Shine Chemicals</p>
                </div>

                <div className="w-full sm:w-64 border-t border-slate-400 pt-2 text-center">
                  <p className="font-bold text-slate-900">
                    {reportType === 'partner_ledger'
                      ? `Partner Signature (${selectedPartner?.partnerName || 'Partner'})`
                      : 'Managing Partner / Owner Approval'}
                  </p>
                  <p className="text-[10px] text-slate-500">Stamp & Authorization</p>
                </div>
              </div>

              {/* Computer Generated Footer Note */}
              <div className="mt-8 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-1">
                <span>
                  Official audit document generated by Perfect Shine Chemicals Management System • Lahore
                </span>
                <span className="font-mono">
                  Document ID: {getDocumentCode()} • Page 1 of 1 (Flows to multiple pages if required)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
