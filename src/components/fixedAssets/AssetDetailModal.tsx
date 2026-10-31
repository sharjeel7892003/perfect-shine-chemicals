import React from 'react';
import { 
  Building2, 
  Calendar, 
  DollarSign, 
  Clock, 
  Tag, 
  User, 
  Layers, 
  FileText, 
  ShieldCheck, 
  ArrowDownLeft, 
  Printer 
} from 'lucide-react';
import { FixedAsset, Partner } from '../../types';
import { formatPKR, formatDate } from '../../utils/formatters';
import { 
  calculateMonthlyDepreciation, 
  calculateAccumulatedDepreciation, 
  calculateCurrentBookValue,
  getElapsedMonths 
} from '../../utils/assetCalculations';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAsset | null;
  partners: Partner[];
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  isOpen,
  onClose,
  asset,
  partners,
}) => {
  if (!asset) return null;

  const monthlyDep = calculateMonthlyDepreciation(asset);
  const accumDep = calculateAccumulatedDepreciation(asset);
  const bookValue = calculateCurrentBookValue(asset);
  const elapsedMonths = getElapsedMonths(asset.purchase_date, asset.disposal_date);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="emerald">Active</Badge>;
      case 'disposed':
        return <Badge variant="amber">Disposed</Badge>;
      case 'archived':
        return <Badge variant="rose">Archived</Badge>;
      default:
        return <Badge variant="indigo">{status}</Badge>;
    }
  };

  const fundings = asset.fundings || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Asset Details — ${asset.name} (${asset.asset_code})`}
      size="lg"
    >
      <div className="space-y-6 text-xs">
        {/* Top Summary Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-emerald-400 font-bold">{asset.asset_code}</span>
              {getStatusBadge(asset.status)}
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-[10px]">
                {asset.category}
              </span>
            </div>
            <h3 className="text-lg font-black text-white">{asset.name}</h3>
            {asset.vendor && <p className="text-slate-400 text-xs mt-0.5">Vendor: {asset.vendor}</p>}
          </div>

          <div className="text-right sm:border-l sm:border-slate-800 sm:pl-4">
            <span className="text-[10px] uppercase font-bold text-slate-400">Current Net Book Value</span>
            <p className="text-2xl font-black text-emerald-400 font-mono">{formatPKR(bookValue)}</p>
            <span className="text-[11px] text-slate-400 font-mono">Original: {formatPKR(asset.total_cost)}</span>
          </div>
        </div>

        {/* 4 Financial Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Cost</span>
            <p className="text-sm font-black text-white font-mono mt-1">{formatPKR(asset.total_cost)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Purchased {formatDate(asset.purchase_date)}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Useful Life</span>
            <p className="text-sm font-black text-cyan-300 font-mono mt-1">{asset.useful_life_years} Years</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{asset.useful_life_years * 12} total months</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Monthly Depreciation</span>
            <p className="text-sm font-black text-amber-300 font-mono mt-1">{formatPKR(monthlyDep)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Accrued straight-line</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Accumulated Dep.</span>
            <p className="text-sm font-black text-rose-400 font-mono mt-1">{formatPKR(accumDep)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">~{elapsedMonths.toFixed(1)} months accrued</p>
          </div>
        </div>

        {/* FUNDING SOURCE SPLIT BREAKDOWN */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Funding Sources Breakdown
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              100% Funded ({formatPKR(asset.total_cost)})
            </span>
          </div>

          {fundings.length === 0 ? (
            <p className="text-slate-500 italic text-center py-2">
              No split records attached. Default full business fund.
            </p>
          ) : (
            <div className="space-y-2">
              {fundings.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${f.funding_type === 'business' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                    <div>
                      <p className="font-semibold text-white">
                        {f.funding_type === 'business' ? 'Business Money (Cash Book Outflow)' : `Partner: ${f.partner_name || 'Partner'}`}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {f.funding_type === 'business' 
                          ? `Payment Method: ${f.payment_method || 'Bank'}`
                          : `Contribution: ${f.partner_contribution_type === 'loan' ? 'Partner Loan (Repayable)' : 'Capital Equity'}`
                        }
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <p className={`font-bold ${f.funding_type === 'business' ? 'text-emerald-400' : 'text-indigo-300'}`}>
                      {formatPKR(f.funding_type === 'business' ? f.business_amount : f.partner_amount)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {(((f.funding_type === 'business' ? f.business_amount : f.partner_amount) / asset.total_cost) * 100).toFixed(1)}% of cost
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disposal / Archival Info if applicable */}
        {(asset.status === 'disposed' || asset.status === 'archived') && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5">
            <div className="flex items-center justify-between font-bold">
              <span>{asset.status === 'disposed' ? 'Disposal Record' : 'Decommission Record'}</span>
              <span>Effective Date: {formatDate(asset.disposal_date || asset.purchase_date)}</span>
            </div>
            {Number(asset.disposal_amount || 0) > 0 && (
              <p className="text-[11px] text-slate-300">
                Amount Received / Scrap Recovery: <strong className="text-emerald-400 font-mono">{formatPKR(asset.disposal_amount || 0)}</strong>
              </p>
            )}
            {asset.disposal_notes && (
              <p className="text-[11px] text-slate-400 italic">Notes: {asset.disposal_notes}</p>
            )}
          </div>
        )}

        {asset.notes && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Asset Description & Notes</span>
            <p>{asset.notes}</p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
