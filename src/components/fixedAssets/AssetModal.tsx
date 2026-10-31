import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  DollarSign, 
  Calendar, 
  Tag, 
  FileText, 
  User, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  FixedAsset, 
  FixedAssetFunding, 
  AssetCategory, 
  PaymentMethod, 
  Partner, 
  PartnerContributionType,
  FundingType 
} from '../../types';
import { formatPKR, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { calculateMonthlyDepreciation } from '../../utils/assetCalculations';
import { Modal } from '../common/Modal';

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assetData: {
    asset: Omit<FixedAsset, 'id' | 'asset_code' | 'created_at' | 'updated_at'>;
    fundings: Omit<FixedAssetFunding, 'id' | 'asset_id' | 'created_at'>[];
  }) => Promise<void>;
  partners: Partner[];
  initialAsset?: FixedAsset | null;
}

interface PartnerFundingRow {
  partner_id: string;
  partner_name: string;
  partner_contribution_type: PartnerContributionType;
  amount: number;
}

export const AssetModal: React.FC<AssetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  partners,
  initialAsset,
}) => {
  const isEditing = Boolean(initialAsset);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('Machinery');
  const [purchaseDate, setPurchaseDate] = useState<string>(getTodayDateString());
  const [vendor, setVendor] = useState('');
  const [totalCost, setTotalCost] = useState<number>(0);
  const [usefulLifeYears, setUsefulLifeYears] = useState<number>(5);
  const [salvageValue, setSalvageValue] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Funding split state
  const [businessAmount, setBusinessAmount] = useState<number>(0);
  const [businessPaymentMethod, setBusinessPaymentMethod] = useState<PaymentMethod>('bank');
  
  const [partnerRows, setPartnerRows] = useState<PartnerFundingRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (initialAsset) {
      setName(initialAsset.name);
      setCategory(initialAsset.category);
      setPurchaseDate(initialAsset.purchase_date);
      setVendor(initialAsset.vendor || '');
      setTotalCost(Number(initialAsset.total_cost || 0));
      setUsefulLifeYears(Number(initialAsset.useful_life_years || 5));
      setSalvageValue(Number(initialAsset.salvage_value || 0));
      setNotes(initialAsset.notes || '');

      // Load fundings
      const existingFundings = initialAsset.fundings || [];
      const biz = existingFundings.find(f => f.funding_type === 'business');
      setBusinessAmount(biz ? Number(biz.business_amount || 0) : 0);
      setBusinessPaymentMethod(biz?.payment_method || 'bank');

      const pRows: PartnerFundingRow[] = existingFundings
        .filter(f => f.funding_type === 'partner')
        .map(f => ({
          partner_id: f.partner_id || '',
          partner_name: f.partner_name || '',
          partner_contribution_type: f.partner_contribution_type || 'capital',
          amount: Number(f.partner_amount || 0),
        }));

      setPartnerRows(pRows);
    } else {
      setName('');
      setCategory('Machinery');
      setPurchaseDate(getTodayDateString());
      setVendor('');
      setTotalCost(0);
      setUsefulLifeYears(5);
      setSalvageValue(0);
      setNotes('');
      setBusinessAmount(0);
      setBusinessPaymentMethod('bank');
      setPartnerRows([]);
    }
    setErrorMsg(null);
  }, [initialAsset, isOpen]);

  // Total allocated funding calculation
  const totalPartnerFunding = partnerRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const totalAllocatedFunding = Number((Number(businessAmount || 0) + totalPartnerFunding).toFixed(2));
  const fundingDifference = Number((Number(totalCost || 0) - totalAllocatedFunding).toFixed(2));
  const isSplitBalanced = Math.abs(fundingDifference) < 0.01 && Number(totalCost || 0) > 0;

  // Monthly depreciation preview
  const monthlyDepreciation = calculateMonthlyDepreciation({
    total_cost: totalCost,
    salvage_value: salvageValue,
    useful_life_years: usefulLifeYears
  });

  const handleAddPartnerRow = () => {
    const activePartners = partners.filter(p => p.is_active);
    const defaultPartner = activePartners[0] || partners[0];
    if (!defaultPartner) {
      alert('Please add at least one partner in the Partners tab first.');
      return;
    }

    // Default remaining amount to fill the difference if positive
    const remaining = Math.max(0, fundingDifference);

    setPartnerRows(prev => [
      ...prev,
      {
        partner_id: defaultPartner.id,
        partner_name: defaultPartner.name,
        partner_contribution_type: 'capital',
        amount: remaining,
      }
    ]);
  };

  const handleUpdatePartnerRow = (index: number, updates: Partial<PartnerFundingRow>) => {
    setPartnerRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, ...updates };
      if (updates.partner_id) {
        const p = partners.find(part => part.id === updates.partner_id);
        if (p) updated.partner_name = p.name;
      }
      return updated;
    }));
  };

  const handleRemovePartnerRow = (index: number) => {
    setPartnerRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleAutoFillBusiness = () => {
    const remaining = Math.max(0, Number(totalCost || 0) - totalPartnerFunding);
    setBusinessAmount(remaining);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter an asset name.');
      return;
    }

    if (totalCost <= 0) {
      setErrorMsg('Total asset cost must be greater than 0.');
      return;
    }

    if (usefulLifeYears <= 0) {
      setErrorMsg('Useful life must be greater than 0 years.');
      return;
    }

    if (salvageValue < 0) {
      setErrorMsg('Salvage value cannot be negative.');
      return;
    }

    if (salvageValue >= totalCost) {
      setErrorMsg('Salvage value must be strictly less than the total asset cost.');
      return;
    }

    if (!isSplitBalanced) {
      setErrorMsg(
        `Funding split total (PKR ${formatPKR(totalAllocatedFunding)}) does not equal the asset cost (PKR ${formatPKR(totalCost)}). Difference: PKR ${formatPKR(Math.abs(fundingDifference))}. Please balance before saving.`
      );
      return;
    }

    // Prepare fundings
    const fundings: Omit<FixedAssetFunding, 'id' | 'asset_id' | 'created_at'>[] = [];

    if (businessAmount > 0) {
      fundings.push({
        funding_type: 'business',
        business_amount: Number(businessAmount),
        payment_method: businessPaymentMethod,
        partner_amount: 0,
        notes: `Business payment for ${name.trim()}`
      });
    }

    for (const pr of partnerRows) {
      if (pr.amount > 0) {
        fundings.push({
          funding_type: 'partner',
          business_amount: 0,
          partner_id: pr.partner_id,
          partner_name: pr.partner_name,
          partner_contribution_type: pr.partner_contribution_type,
          partner_amount: Number(pr.amount),
          notes: `${pr.partner_contribution_type === 'loan' ? 'Partner Loan' : 'Partner Capital Contribution'} by ${pr.partner_name} for ${name.trim()}`
        });
      }
    }

    try {
      setIsSubmitting(true);
      await onSave({
        asset: {
          name: name.trim(),
          category,
          purchase_date: formatSelectedDateToIso(purchaseDate).split('T')[0],
          vendor: vendor.trim() || undefined,
          total_cost: Number(totalCost),
          useful_life_years: Number(usefulLifeYears),
          salvage_value: Number(salvageValue),
          status: initialAsset?.status || 'active',
          notes: notes.trim() || undefined,
        },
        fundings
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to save asset:', err);
      setErrorMsg(err.message || 'Failed to save asset. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Fixed Asset: ${initialAsset?.asset_code}` : 'Record New Fixed Asset'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* SECTION 1: ASSET SPECIFICATIONS */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              1. Asset Specifications & Valuation
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Asset Name */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Asset Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Weighing Scale Machine, Liquid Storage Tank"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as AssetCategory)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="Machinery">Machinery (Pumps, Mixers, Filling)</option>
                <option value="Equipment">Equipment (Weighing Scales, Lab meters)</option>
                <option value="Vehicle">Vehicle (Transport Van, Delivery Truck)</option>
                <option value="Furniture">Furniture & Fixtures</option>
                <option value="Other">Other Factory Assets</option>
              </select>
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Purchase Date (Past Date Allowed) <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Vendor (Optional) */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">Vendor / Supplier (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Al-Madina Machinery Works"
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Total Cost */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Total Asset Cost (PKR) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={totalCost === 0 ? '' : totalCost}
                onChange={e => setTotalCost(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-bold font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Useful Life (Years) */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Useful Life (Years) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                placeholder="e.g. 5"
                value={usefulLifeYears === 0 ? '' : usefulLifeYears}
                onChange={e => setUsefulLifeYears(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Salvage Value */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Salvage / Scrap Value (Default 0)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={salvageValue === 0 ? '' : salvageValue}
                onChange={e => setSalvageValue(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Depreciation Preview Card */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" /> Straight-Line Monthly Depreciation
              </span>
              <p className="text-base font-black text-cyan-300 font-mono mt-0.5">
                {formatPKR(monthlyDepreciation)} <span className="text-xs font-normal text-slate-400">/ month</span>
              </p>
              <p className="text-[10px] text-slate-400">
                Formula: ({totalCost} - {salvageValue}) / ({usefulLifeYears} × 12)
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="text-xs">
            <label className="block text-slate-400 font-medium mb-1">Asset Notes & Description</label>
            <input
              type="text"
              placeholder="e.g. Serial # 984210, Installed in Bottling hall"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* SECTION 2: FUNDING SOURCE (THE MAIN SPLIT REQUIREMENT) */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                2. Funding Source Split (How Was This Paid?)
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">
              Must sum to exactly: <strong className="text-white font-mono">{formatPKR(totalCost)}</strong>
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Specify how the payment was split across <strong>Business Money</strong> (creates an outflow voucher in Cash Book) and <strong>Partner Contributions</strong> (directly credits that partner's capital account without reducing business cash).
          </p>

          {/* A. Business Money Outflow */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                A) Business Money (Paid from Factory Cash/Bank)
              </span>
              <button
                type="button"
                onClick={handleAutoFillBusiness}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline"
              >
                Auto-fill Remaining
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Business Amount (PKR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={businessAmount === 0 ? '' : businessAmount}
                  onChange={e => setBusinessAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Payment Method</label>
                <select
                  value={businessPaymentMethod}
                  onChange={e => setBusinessPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="bank">Bank Transfer / Online</option>
                  <option value="cash">Cash in Hand</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            {businessAmount > 0 && (
              <p className="text-[11px] text-slate-400 italic">
                ℹ Creates a cash outflow voucher in Cash Book labeled <strong className="text-slate-300">"Fixed Asset Purchase"</strong> of {formatPKR(businessAmount)}. Net Cash Position drops by exactly this amount.
              </p>
            )}
          </div>

          {/* B. Partner Direct Contributions */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                B) Partner Direct Contributions (Direct Payment by Partner)
              </span>
              <button
                type="button"
                onClick={handleAddPartnerRow}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Partner Split</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Increases the partner's capital account. Does <strong>NOT</strong> create a business cash outflow and does <strong>NOT</strong> reduce Net Cash Position.
            </p>

            {partnerRows.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                No partner direct contribution added. Click &quot;Add Partner Split&quot; if partners paid part or all of this asset.
              </div>
            ) : (
              <div className="space-y-2.5">
                {partnerRows.map((row, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                    {/* Partner Selector */}
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Partner</label>
                      <select
                        value={row.partner_id}
                        onChange={e => handleUpdatePartnerRow(idx, { partner_id: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                      >
                        {partners.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.is_active ? '' : '(Inactive)'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Contribution Type */}
                    <div className="w-full sm:w-44">
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Type</label>
                      <select
                        value={row.partner_contribution_type}
                        onChange={e => handleUpdatePartnerRow(idx, { partner_contribution_type: e.target.value as PartnerContributionType })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="capital">Capital (Equity)</option>
                        <option value="loan">Loan (Repayable)</option>
                      </select>
                    </div>

                    {/* Amount */}
                    <div className="w-full sm:w-36">
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Amount (PKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={row.amount === 0 ? '' : row.amount}
                        onChange={e => handleUpdatePartnerRow(idx, { amount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-indigo-300 font-bold font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Delete row */}
                    <div className="sm:self-end pb-0.5">
                      <button
                        type="button"
                        onClick={() => handleRemovePartnerRow(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove partner split"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* C. Live Reconciliation & Split Verification Box */}
          <div className={`p-4 rounded-xl border text-xs transition-all ${
            isSplitBalanced 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                {isSplitBalanced ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Funding Balanced & Verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Funding Split Mismatch — Saving Blocked</span>
                  </>
                )}
              </div>

              <div className="font-mono text-xs flex items-center gap-3">
                <span>Total Cost: <strong>{formatPKR(totalCost)}</strong></span>
                <span>• Allocated: <strong>{formatPKR(totalAllocatedFunding)}</strong></span>
                <span>
                  • Difference: <strong className={isSplitBalanced ? 'text-emerald-400' : 'text-rose-400 font-black'}>
                    {fundingDifference > 0 ? `+${formatPKR(fundingDifference)} remaining` : fundingDifference < 0 ? `-${formatPKR(Math.abs(fundingDifference))} over-split` : 'PKR 0.00'}
                  </strong>
                </span>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-400 flex flex-wrap gap-x-3">
              <span>Business Outflow: <strong className="text-white">{formatPKR(businessAmount)}</strong></span>
              {partnerRows.map((r, i) => (
                <span key={i}>
                  • {r.partner_name || 'Partner'}: <strong className="text-indigo-300">{formatPKR(r.amount)}</strong> ({r.partner_contribution_type})
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !isSplitBalanced}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 ${
              isSplitBalanced && !isSubmitting
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {isSubmitting ? (
              <span>Saving Asset & Vouchers...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.5px]" />
                <span>{isEditing ? 'Update Asset & Reapply Splits' : 'Record Fixed Asset'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
