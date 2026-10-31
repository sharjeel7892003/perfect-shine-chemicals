import React, { useState } from 'react';
import { Archive, AlertTriangle, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { FixedAsset } from '../../types';
import { formatPKR, getTodayDateString } from '../../utils/formatters';
import { calculateCurrentBookValue, calculateAccumulatedDepreciation } from '../../utils/assetCalculations';
import { Modal } from '../common/Modal';

interface AssetDisposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAsset | null;
  onConfirm: (disposalData: {
    status: 'disposed' | 'archived';
    disposal_date: string;
    disposal_amount: number;
    disposal_notes: string;
  }) => Promise<void>;
}

export const AssetDisposalModal: React.FC<AssetDisposalModalProps> = ({
  isOpen,
  onClose,
  asset,
  onConfirm,
}) => {
  if (!asset) return null;

  const currentBookValue = calculateCurrentBookValue(asset);
  const accumDep = calculateAccumulatedDepreciation(asset);

  const [status, setStatus] = useState<'disposed' | 'archived'>('disposed');
  const [disposalDate, setDisposalDate] = useState<string>(getTodayDateString());
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onConfirm({
        status,
        disposal_date: disposalDate,
        disposal_amount: Number(amountReceived || 0),
        disposal_notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      console.error('Failed to dispose asset:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Dispose / Archive Asset: ${asset.name} (${asset.asset_code})`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <Archive className="w-4 h-4 shrink-0" />
            <span>Preserve Asset History & Depreciation Trail</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Archiving or disposing this asset retains all prior historical purchase records, partner capital contributions, and accumulated depreciation vouchers without deleting past financial history.
          </p>
        </div>

        {/* Current Financial Snapshot */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center font-mono">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-sans">Initial Cost</span>
            <p className="text-sm font-bold text-white mt-0.5">{formatPKR(asset.total_cost)}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-sans">Accum. Dep</span>
            <p className="text-sm font-bold text-cyan-400 mt-0.5">{formatPKR(accumDep)}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-sans">Current Book Value</span>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">{formatPKR(currentBookValue)}</p>
          </div>
        </div>

        {/* Status Selection */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">Target Status</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStatus('disposed')}
              className={`p-3 rounded-xl border text-center font-bold transition-all ${
                status === 'disposed'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Disposed (Sold / Scrapped)
            </button>
            <button
              type="button"
              onClick={() => setStatus('archived')}
              className={`p-3 rounded-xl border text-center font-bold transition-all ${
                status === 'archived'
                  ? 'bg-slate-800 border-slate-600 text-slate-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Archived (Decommissioned)
            </button>
          </div>
        </div>

        {/* Disposal Date */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">
            Effective Date <span className="text-rose-400">*</span>
          </label>
          <input
            type="date"
            required
            value={disposalDate}
            onChange={e => setDisposalDate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Amount Received */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">
            Amount Received / Scrap Recovery Proceeds (PKR)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amountReceived === 0 ? '' : amountReceived}
            onChange={e => setAmountReceived(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-bold font-mono focus:border-emerald-500 focus:outline-none"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Cash or scrap recovery received upon disposing this equipment.
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">Disposal Reason & Notes</label>
          <textarea
            rows={2}
            placeholder="e.g. Sold to scrap dealer; replaced with high-capacity digital scale"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5px]" />
            <span>{isSubmitting ? 'Updating...' : `Confirm ${status === 'disposed' ? 'Disposal' : 'Archiving'}`}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
