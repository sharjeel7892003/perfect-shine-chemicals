import { FixedAsset, Partner, PartnerCapitalTransaction, Payment } from '../types';

/**
 * Calculates the monthly straight-line depreciation for an asset.
 * Formula: (total_cost - salvage_value) / (useful_life_years * 12)
 */
export function calculateMonthlyDepreciation(asset: {
  total_cost: number;
  salvage_value?: number;
  useful_life_years: number;
}): number {
  const cost = Number(asset.total_cost || 0);
  const salvage = Number(asset.salvage_value || 0);
  const years = Number(asset.useful_life_years || 0);

  if (years <= 0 || cost <= salvage) return 0;

  const totalDepreciable = Math.max(0, cost - salvage);
  const totalMonths = years * 12;
  return Number((totalDepreciable / totalMonths).toFixed(2));
}

/**
 * Calculates the number of whole or pro-rated months elapsed between purchaseDate and asOfDate.
 */
export function getElapsedMonths(purchaseDateStr: string, asOfDateStr?: string): number {
  if (!purchaseDateStr) return 0;
  const pDate = new Date(purchaseDateStr + (purchaseDateStr.length === 10 ? 'T00:00:00' : ''));
  const asOf = asOfDateStr 
    ? new Date(asOfDateStr + (asOfDateStr.length === 10 ? 'T23:59:59' : ''))
    : new Date();

  if (asOf < pDate) return 0;

  let months = (asOf.getFullYear() - pDate.getFullYear()) * 12 + (asOf.getMonth() - pDate.getMonth());
  // If asOf day is before purchase day, subtract pro-rated fraction
  const dayDiff = asOf.getDate() - pDate.getDate();
  if (dayDiff < 0) {
    months = Math.max(0, months - 1 + Math.max(0, (30 + dayDiff) / 30));
  } else {
    months = months + Math.min(1, dayDiff / 30);
  }

  return Number(Math.max(0, months).toFixed(2));
}

/**
 * Calculates the accumulated depreciation of an asset up to a given date.
 * Will never exceed (total_cost - salvage_value).
 */
export function calculateAccumulatedDepreciation(asset: FixedAsset, asOfDateStr?: string): number {
  const cost = Number(asset.total_cost || 0);
  const salvage = Number(asset.salvage_value || 0);
  const maxDepreciation = Math.max(0, cost - salvage);
  const monthly = calculateMonthlyDepreciation(asset);

  if (monthly <= 0 || maxDepreciation <= 0) return 0;

  // If asset was disposed or archived, stop depreciation as of disposal date if available
  const effectiveEndDate = (asset.status === 'disposed' || asset.status === 'archived') && asset.disposal_date
    ? (asOfDateStr && asOfDateStr < asset.disposal_date ? asOfDateStr : asset.disposal_date)
    : asOfDateStr;

  const elapsed = getElapsedMonths(asset.purchase_date, effectiveEndDate);
  const accumulated = Math.min(maxDepreciation, elapsed * monthly);
  return Number(accumulated.toFixed(2));
}

/**
 * Calculates the current book value of an asset.
 * Book Value = Total Cost - Accumulated Depreciation.
 * Cannot drop below salvage_value for active assets.
 */
export function calculateCurrentBookValue(asset: FixedAsset, asOfDateStr?: string): number {
  const cost = Number(asset.total_cost || 0);
  const salvage = Number(asset.salvage_value || 0);
  
  if (asset.status === 'disposed') {
    // If disposed, the current active value is 0 (or disposal proceeds)
    return 0;
  }

  const accumDep = calculateAccumulatedDepreciation(asset, asOfDateStr);
  const bookValue = Math.max(salvage, cost - accumDep);
  return Number(bookValue.toFixed(2));
}

/**
 * Calculates the total depreciation expense across all assets during a specific date window (e.g. for P&L).
 * Straight-line monthly depreciation accrued per active asset within the period.
 */
export function calculateDepreciationExpenseForPeriod(
  assets: FixedAsset[],
  startDate?: string,
  endDate?: string
): number {
  if (!assets || assets.length === 0) return 0;

  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date(end.getFullYear(), end.getMonth(), 1);

  let totalExpense = 0;

  for (const asset of assets) {
    if (asset.status === 'archived') continue;

    const purchase = new Date(asset.purchase_date + 'T00:00:00');
    // If asset was purchased after the period ended, 0 depreciation
    if (purchase > end) continue;

    // If asset was disposed before period began, 0 depreciation
    if (asset.status === 'disposed' && asset.disposal_date) {
      const disposal = new Date(asset.disposal_date + 'T23:59:59');
      if (disposal < start) continue;
    }

    const monthly = calculateMonthlyDepreciation(asset);
    if (monthly <= 0) continue;

    // Determine overlap in months between period [start, end] and asset active lifetime [purchase, disposal/end]
    const effectiveStart = purchase > start ? purchase : start;
    let effectiveEnd = end;
    if (asset.status === 'disposed' && asset.disposal_date) {
      const disposal = new Date(asset.disposal_date + 'T23:59:59');
      if (disposal < end) effectiveEnd = disposal;
    }

    if (effectiveEnd > effectiveStart) {
      const days = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24);
      const months = days / 30.4375; // average days in a month

      // Check remaining depreciable capacity
      const maxDepreciable = Math.max(0, Number(asset.total_cost || 0) - Number(asset.salvage_value || 0));
      const priorAccum = calculateAccumulatedDepreciation(asset, effectiveStart.toISOString().split('T')[0]);
      const remainingDepreciable = Math.max(0, maxDepreciable - priorAccum);

      const periodDep = Math.min(remainingDepreciable, months * monthly);
      totalExpense += periodDep;
    }
  }

  return Number(totalExpense.toFixed(2));
}

export interface PartnerCapitalSummary {
  partnerId: string;
  partnerName: string;
  isActive: boolean;
  initialCapital: number;
  cashContributions: number; // From Payments with related_to: 'capital_injection'
  assetContributions: number; // From partner_capital_transactions (type: 'asset_contribution')
  otherContributions: number; // From other contributions
  totalContributedCapital: number; // Total equity capital
  loanContributions: number; // Loans provided (repayable)
  withdrawals: number; // Drawings / withdrawals
  netCapitalBalance: number; // Total Contributed Capital - Withdrawals
  shareOfTotalCapitalPercent: number; // (partner capital / total partners capital) * 100
  transactionsCount: number;
}

/**
 * Calculates authoritative partner capital balances and contribution shares.
 * Consolidates payments table (capital injections / withdrawals) and partner_capital_transactions.
 * Fully prevents double counting!
 */
export function calculatePartnerCapitalLedgers(
  partners: Partner[],
  capitalTransactions: PartnerCapitalTransaction[],
  payments: Payment[]
): {
  summaries: PartnerCapitalSummary[];
  totalEquityCapital: number;
  totalPartnerLoans: number;
} {
  let globalTotalContributed = 0;

  const baseSummaries = partners.map(partner => {
    // 1. Initial capital
    const initial = Number(partner.initial_capital || 0);

    // 2. Direct cash capital injections from Payments table
    // Match by depositor_name, created_by, or transaction notes containing partner name
    const matchingPayments = payments.filter(p => {
      if (p.related_to !== 'capital_injection' && p.related_to !== 'owner_withdrawal') return false;
      const notes = (p.notes || '').toLowerCase();
      const createdBy = (p.created_by || '').toLowerCase();
      const pName = partner.name.toLowerCase();
      return createdBy.includes(pName) || notes.includes(pName);
    });

    // Also check if any cash injections are already in partner_capital_transactions
    const partnerTxns = capitalTransactions.filter(t => t.partner_id === partner.id || t.partner_name.toLowerCase() === partner.name.toLowerCase());

    // Cash contributions from partner_capital_transactions
    const txnCashContributions = partnerTxns
      .filter(t => (t.transaction_type === 'contribution' || (t.transaction_type as string) === 'cash_injection') && t.contribution_type === 'capital')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // Cash payments from payments table (exclude ones that have an explicit reference in partnerTxns to avoid double counting)
    const directCashInjections = matchingPayments
      .filter(p => p.related_to === 'capital_injection')
      .filter(p => !partnerTxns.some(t => t.reference_id === p.id || (t.reference_no && t.reference_no === p.transaction_ref)))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const cashContributions = Number((txnCashContributions + directCashInjections).toFixed(2));

    // 3. Asset contributions (direct partner contribution toward fixed assets)
    const assetContributions = Number(
      partnerTxns
        .filter(t => t.transaction_type === 'asset_contribution' && t.contribution_type === 'capital')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        .toFixed(2)
    );

    // 4. Partner Loans (repayable liabilities, distinct from equity capital)
    const loanContributions = Number(
      partnerTxns
        .filter(t => t.contribution_type === 'loan' || t.transaction_type === 'loan_received')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        .toFixed(2)
    );

    // 5. Withdrawals / Drawings
    const txnWithdrawals = partnerTxns
      .filter(t => t.transaction_type === 'withdrawal' || t.transaction_type === 'loan_repayment')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const directWithdrawals = matchingPayments
      .filter(p => p.related_to === 'owner_withdrawal')
      .filter(p => !partnerTxns.some(t => t.reference_id === p.id || (t.reference_no && t.reference_no === p.transaction_ref)))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const totalWithdrawals = Number((txnWithdrawals + directWithdrawals).toFixed(2));

    // Total contributed capital (Equity)
    const totalContributed = Number((initial + cashContributions + assetContributions).toFixed(2));
    const netBalance = Number((totalContributed - totalWithdrawals).toFixed(2));

    globalTotalContributed += Math.max(0, netBalance);

    return {
      partnerId: partner.id,
      partnerName: partner.name,
      isActive: partner.is_active,
      initialCapital: initial,
      cashContributions,
      assetContributions,
      otherContributions: 0,
      totalContributedCapital: totalContributed,
      loanContributions,
      withdrawals: totalWithdrawals,
      netCapitalBalance: netBalance,
      shareOfTotalCapitalPercent: 0, // computed below
      transactionsCount: partnerTxns.length + matchingPayments.length,
    };
  });

  // Calculate percentage shares of total equity
  const summaries: PartnerCapitalSummary[] = baseSummaries.map(s => {
    const share = globalTotalContributed > 0
      ? Number(((Math.max(0, s.netCapitalBalance) / globalTotalContributed) * 100).toFixed(2))
      : 0;
    return {
      ...s,
      shareOfTotalCapitalPercent: share,
    };
  });

  const totalPartnerLoans = Number(
    summaries.reduce((acc, s) => acc + s.loanContributions, 0).toFixed(2)
  );

  return {
    summaries,
    totalEquityCapital: Number(globalTotalContributed.toFixed(2)),
    totalPartnerLoans,
  };
}

/**
 * Generates the next sequential asset code (AST-0001, AST-0002, etc.)
 */
export function getNextAssetCode(existingAssets: FixedAsset[] = []): string {
  let maxNum = 0;
  for (const a of existingAssets) {
    const match = (a.asset_code || '').match(/AST-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `AST-${String(maxNum + 1).padStart(4, '0')}`;
}

