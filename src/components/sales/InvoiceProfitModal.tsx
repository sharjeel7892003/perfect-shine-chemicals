import React, { useState, useMemo } from 'react';
import { Sale, SaleItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatPKR, formatDate, formatDateTime } from '../../utils/formatters';
import { printElement } from '../../utils/printHelper';
import { 
  X, 
  Printer, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ShieldAlert, 
  Award, 
  Package, 
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface InvoiceProfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

export interface LineItemProfitBreakdown {
  id: string;
  name: string;
  packSizeName?: string;
  isPrivateLabel?: boolean;
  quantity: number;
  unit: string;
  unitSellingPrice: number;
  lineRevenue: number;
  unitCost: number;
  totalCost: number;
  profit: number;
  marginPercent: number;
  markupPercent: number;
  costSource: string;
  chemicalPortion?: number;
  packagingPortion?: number;
}

export const InvoiceProfitModal: React.FC<InvoiceProfitModalProps> = ({
  isOpen,
  onClose,
  sale,
}) => {
  const { products, rawMaterials } = useApp();
  const [isPrinting, setIsPrinting] = useState(false);

  // Compute detailed profit and margin analysis
  const analysis = useMemo(() => {
    if (!sale) return null;

    const isPL = sale.invoice_type === 'private_label' || sale.is_private_label || sale.items.some(i => i.is_private_label);
    const labourTotal = Number(sale.labour_total_amount || 0);
    const labourBottles = Number(sale.labour_bottle_qty || 0);
    const labourRate = Number(sale.labour_rate_per_bottle || 0);
    const discount = Number(sale.discount || 0);

    const lineBreakdowns: LineItemProfitBreakdown[] = sale.items.map((item, idx) => {
      const qty = Number(item.quantity || item.pack_quantity || 1);
      const unitSelling = Number(item.unit_price || 0);
      const lineRev = Number(item.subtotal !== undefined ? item.subtotal : (qty * unitSelling).toFixed(2));

      // Resolve Cost Basis
      let resolvedUnitCost = Number(item.unit_cost || 0);
      let costSource = 'Invoice Snapshot';
      let chemicalPortion: number | undefined = undefined;
      let packagingPortion: number | undefined = undefined;

      const prod = products.find(p => p.id === item.product_id || p.name.toLowerCase() === item.product_name.toLowerCase());
      const pack = prod?.pack_sizes?.find(ps => ps.id === item.pack_size_id || ps.name === item.pack_size_name);

      if (prod && pack) {
        chemicalPortion = Number(((pack.size_in_base_unit || item.size_in_base_unit || 1) * Number(prod.cost_price || 0)).toFixed(2));
        packagingPortion = Number(
          (pack.packaging_items || []).reduce((sum, pi) => {
            const rm = rawMaterials.find(r => r.id === pi.raw_material_id);
            const rate = rm ? Number(rm.cost_per_unit || 0) : Number(pi.cost_per_unit || 0);
            return sum + (Number(pi.quantity || 0) * rate);
          }, 0).toFixed(2)
        );
      }

      if (resolvedUnitCost <= 0) {
        if (item.raw_material_id) {
          const rm = rawMaterials.find(r => r.id === item.raw_material_id);
          resolvedUnitCost = rm ? Number(rm.cost_per_unit || 0) : 0;
          costSource = 'Raw Material Cost';
        } else if (pack?.true_cost && pack.true_cost > 0) {
          resolvedUnitCost = Number(pack.true_cost);
          costSource = 'Pack True Cost';
        } else if (chemicalPortion !== undefined && packagingPortion !== undefined && (chemicalPortion + packagingPortion) > 0) {
          resolvedUnitCost = Number((chemicalPortion + packagingPortion).toFixed(2));
          costSource = 'Recipe True Cost';
        } else if (prod?.cost_price && prod.cost_price > 0) {
          resolvedUnitCost = Number((Number(prod.cost_price) * (item.size_in_base_unit || pack?.size_in_base_unit || 1)).toFixed(2));
          costSource = 'Formula Cost Base';
        }
      }

      const totalCost = Number((resolvedUnitCost * qty).toFixed(2));
      const profit = Number((lineRev - totalCost).toFixed(2));
      const marginPercent = lineRev > 0 ? Number(((profit / lineRev) * 100).toFixed(1)) : 0;
      const markupPercent = totalCost > 0 ? Number(((profit / totalCost) * 100).toFixed(1)) : 0;

      return {
        id: item.id || String(idx),
        name: item.product_name,
        packSizeName: item.pack_size_name,
        isPrivateLabel: item.is_private_label || isPL,
        quantity: qty,
        unit: item.unit || 'units',
        unitSellingPrice: unitSelling,
        lineRevenue: lineRev,
        unitCost: resolvedUnitCost,
        totalCost,
        profit,
        marginPercent,
        markupPercent,
        costSource,
        chemicalPortion,
        packagingPortion
      };
    });

    const productsRevenue = lineBreakdowns.reduce((acc, it) => acc + it.lineRevenue, 0);
    const totalCost = lineBreakdowns.reduce((acc, it) => acc + it.totalCost, 0);
    const productsProfit = Number((productsRevenue - totalCost).toFixed(2));

    // Grand totals including Labour & Discount
    const grandRevenue = Number((productsRevenue + labourTotal - discount).toFixed(2));
    const netProfit = Number((grandRevenue - totalCost).toFixed(2));
    const overallMarginPercent = grandRevenue > 0 ? Number(((netProfit / grandRevenue) * 100).toFixed(1)) : 0;
    const overallMarkupPercent = totalCost > 0 ? Number(((netProfit / totalCost) * 100).toFixed(1)) : 0;

    return {
      isPrivateLabel: isPL,
      lineBreakdowns,
      productsRevenue,
      labourTotal,
      labourBottles,
      labourRate,
      discount,
      grandRevenue,
      totalCost,
      productsProfit,
      netProfit,
      overallMarginPercent,
      overallMarkupPercent
    };
  }, [sale, products, rawMaterials]);

  if (!isOpen || !sale || !analysis) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printElement(
        'printable-profit-report',
        `Profit_Report_${sale.invoice_number}_${sale.customer_name?.replace(/[^a-zA-Z0-9]/g, '_')}`
      );
    } catch (e) {
      console.error('Print failed, falling back:', e);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const getMarginBadge = (margin: number) => {
    if (margin >= 30) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    } else if (margin >= 15) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    } else if (margin >= 0) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    } else {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:static print:inset-auto print:p-0 print:bg-white print:overflow-visible print:block">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh] my-auto print:static print:w-full print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:overflow-visible print:bg-white print:block">
        
        {/* Controls Bar (Always hidden during print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 font-bold text-xs border border-purple-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Profit Breakdown & Margin Audit</span>
            </span>

            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono font-semibold">
              {sale.invoice_number}
            </span>

            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              <ShieldAlert className="w-3 h-3" />
              <span>Confidential / Internal View Only</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Print Internal Profit Report or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>{isPrinting ? 'Printing...' : 'Print Report'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Report Sheet Area */}
        <div 
          className="overflow-y-auto p-6 sm:p-8 bg-slate-900 text-slate-100 flex-1 print:bg-white print:text-slate-900 print:overflow-visible print:p-0 print:block"
          id="printable-profit-report"
        >
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-800 pb-5 gap-4 print:border-b-2 print:border-slate-900">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-white tracking-tight leading-none print:text-slate-900">
                  INVOICE PROFIT & MARGIN REPORT
                </h2>
                {analysis.isPrivateLabel && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 print:border-slate-800 print:text-slate-800">
                    Private Label
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 print:text-slate-600">
                Customer / Client: <strong className="text-white print:text-slate-900">{sale.customer_name || 'Walk-in Retail'}</strong>
                {sale.client_brand_name && <span className="ml-2 text-cyan-400 print:text-slate-800 font-semibold">(Brand: {sale.client_brand_name})</span>}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 print:text-slate-500">
                Invoice Date: <span className="font-mono text-slate-300 print:text-slate-800">{formatDate(sale.date)}</span> | Generated: {formatDateTime(sale.created_at || sale.date)}
              </p>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block print:text-slate-500">
                Invoice Reference #
              </span>
              <p className="text-lg font-black font-mono text-emerald-400 print:text-slate-900">
                {sale.invoice_number}
              </p>
              <p className="text-[11px] text-slate-400 print:text-slate-600">
                Payment Status: <span className="font-bold uppercase text-slate-200 print:text-slate-900">{sale.payment_status}</span> ({sale.payment_method})
              </p>
            </div>
          </div>

          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
            {/* 1. Total Revenue */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 print:bg-slate-50 print:border-slate-300">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 print:text-slate-600">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-700" /> Total Revenue
              </span>
              <p className="text-lg sm:text-xl font-black font-mono text-emerald-400 mt-1 print:text-emerald-700">
                {formatPKR(analysis.grandRevenue)}
              </p>
              <p className="text-[10px] text-slate-500 print:text-slate-500">
                Billed to customer
              </p>
            </div>

            {/* 2. Total Cost */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 print:bg-slate-50 print:border-slate-300">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 print:text-slate-600">
                <Layers className="w-3.5 h-3.5 text-rose-400 print:text-rose-700" /> Total Cost (COGS)
              </span>
              <p className="text-lg sm:text-xl font-black font-mono text-rose-400 mt-1 print:text-rose-700">
                {formatPKR(analysis.totalCost)}
              </p>
              <p className="text-[10px] text-slate-500 print:text-slate-500">
                Liquid + Packaging basis
              </p>
            </div>

            {/* 3. Net Profit */}
            <div className={`p-3.5 rounded-2xl border ${
              analysis.netProfit >= 0 
                ? 'bg-emerald-950/20 border-emerald-800/40 print:bg-emerald-50 print:border-emerald-300' 
                : 'bg-rose-950/20 border-rose-800/40 print:bg-rose-50 print:border-rose-300'
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-slate-400 print:text-slate-600">
                {analysis.netProfit >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                )}
                Net Profit
              </span>
              <p className={`text-lg sm:text-xl font-black font-mono mt-1 ${
                analysis.netProfit >= 0 ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'
              }`}>
                {formatPKR(analysis.netProfit)}
              </p>
              <p className="text-[10px] text-slate-500 print:text-slate-500">
                Revenue − Total Cost
              </p>
            </div>

            {/* 4. Profit Margin */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 print:bg-slate-50 print:border-slate-300">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 print:text-slate-600">
                <Percent className="w-3.5 h-3.5 text-purple-400 print:text-purple-700" /> Profit Margin %
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-lg sm:text-xl font-black font-mono ${
                  analysis.overallMarginPercent >= 0 ? 'text-purple-400 print:text-purple-700' : 'text-rose-400 print:text-rose-700'
                }`}>
                  {analysis.overallMarginPercent}%
                </p>
                <span className="text-[10px] text-slate-500 print:text-slate-600">
                  ({analysis.overallMarkupPercent}% markup)
                </span>
              </div>
              <p className="text-[10px] text-slate-500 print:text-slate-500">
                Margin on total billed
              </p>
            </div>
          </div>

          {/* Line Items Profit Breakdown Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden mb-6 print:border-slate-300 print:bg-white">
            <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between print:bg-slate-100 print:border-slate-300">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider print:text-slate-800">
                Per-Item Line Profit Breakdown ({analysis.lineBreakdowns.length} SKUs)
              </span>
              <span className="text-[11px] text-slate-400 print:text-slate-600">
                All values in PKR (Rs.)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] print:bg-slate-100 print:border-slate-300 print:text-slate-700">
                    <th className="py-3 px-3 w-8">#</th>
                    <th className="py-3 px-3">Product / Item Description</th>
                    <th className="py-3 px-3 text-right">Qty Sold</th>
                    <th className="py-3 px-3 text-right">Selling Price</th>
                    <th className="py-3 px-3 text-right">Line Revenue</th>
                    <th className="py-3 px-3 text-right">Unit Cost</th>
                    <th className="py-3 px-3 text-right">Total Cost</th>
                    <th className="py-3 px-3 text-right">Line Profit</th>
                    <th className="py-3 px-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 text-slate-300 print:text-slate-800">
                  {analysis.lineBreakdowns.map((line, idx) => {
                    const isProfitPositive = line.profit >= 0;
                    return (
                      <tr 
                        key={line.id}
                        className="hover:bg-slate-800/30 transition-colors print:hover:bg-transparent"
                      >
                        <td className="py-3 px-3 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white print:text-slate-900">
                            {line.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {line.packSizeName && (
                              <span className="text-[11px] text-emerald-400 print:text-emerald-700 font-medium">
                                {line.packSizeName}
                              </span>
                            )}
                            {line.chemicalPortion !== undefined && line.packagingPortion !== undefined && (
                              <span className="text-[10px] text-slate-500 print:text-slate-600 font-mono">
                                • (Liq: {formatPKR(line.chemicalPortion)} + Pack: {formatPKR(line.packagingPortion)})
                              </span>
                            )}
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 print:border print:border-slate-300">
                              {line.costSource}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white print:text-slate-900">
                          {line.quantity}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300 print:text-slate-800">
                          {formatPKR(line.unitSellingPrice)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white print:text-slate-900">
                          {formatPKR(line.lineRevenue)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400 print:text-slate-700">
                          {formatPKR(line.unitCost)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400 print:text-slate-700">
                          {formatPKR(line.totalCost)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={isProfitPositive ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}>
                            {formatPKR(line.profit)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getMarginBadge(line.marginPercent)} print:border-none print:p-0`}>
                            {line.marginPercent}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Special Elements (Private Label Labour / Discount) & Final Totals Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800 print:border-t-2 print:border-slate-900">
            {/* Left Column: Cost Basis Context & Notes */}
            <div className="space-y-3">
              {analysis.isPrivateLabel && analysis.labourTotal > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs print:bg-slate-50 print:border-slate-300">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300 print:text-slate-900">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Private Label Contract Packing Labour</span>
                  </div>
                  <p className="text-slate-300 print:text-slate-700 mt-1 leading-relaxed">
                    Billed to client: <strong className="text-white print:text-slate-900">{analysis.labourBottles} bottles</strong> filled at <strong className="text-white print:text-slate-900">PKR {analysis.labourRate}/bottle</strong> = <strong className="text-emerald-400 print:text-slate-900">{formatPKR(analysis.labourTotal)}</strong>.
                  </p>
                  <p className="text-[11px] text-slate-400 print:text-slate-500 mt-0.5">
                    This labour charge is billed as pure manufacturing revenue and contributes directly to invoice gross profit.
                  </p>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 print:bg-slate-50 print:border-slate-300 print:text-slate-600">
                <span className="font-bold text-slate-300 print:text-slate-800 block mb-1">Cost Valuation Basis:</span>
                <p className="leading-relaxed">
                  • <strong>Own Brand:</strong> True Unit Cost combining bulk formulation liquid and packaging items (bottles, caps, cartons).
                </p>
                <p className="leading-relaxed mt-0.5">
                  • <strong>Private Label:</strong> Component-based cost structure (chemical bulk liquid + packaging containers) saved at invoice generation.
                </p>
              </div>
            </div>

            {/* Right Column: Invoice Grand Totals Summary Box */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs print:bg-slate-50 print:border-slate-300">
              <div className="flex justify-between text-slate-400 print:text-slate-600">
                <span>Products Subtotal (Revenue):</span>
                <span className="font-mono font-bold text-slate-200 print:text-slate-900">{formatPKR(analysis.productsRevenue)}</span>
              </div>

              {analysis.labourTotal > 0 && (
                <div className="flex justify-between text-amber-300 print:text-slate-800 font-semibold">
                  <span>Packing Labour ({analysis.labourBottles} bottles @ PKR {analysis.labourRate}):</span>
                  <span className="font-mono text-emerald-400 print:text-emerald-700">+{formatPKR(analysis.labourTotal)}</span>
                </div>
              )}

              {analysis.discount > 0 && (
                <div className="flex justify-between text-rose-400 print:text-rose-700 font-semibold">
                  <span>Invoice Discount Deducted:</span>
                  <span className="font-mono">-{formatPKR(analysis.discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400 print:text-slate-600 border-t border-slate-800 print:border-slate-200 pt-1.5">
                <span>Total Cost of Goods (COGS):</span>
                <span className="font-mono font-bold text-rose-400 print:text-rose-700">-{formatPKR(analysis.totalCost)}</span>
              </div>

              <div className="flex justify-between text-base font-black text-white print:text-slate-900 border-t-2 border-slate-700 print:border-slate-400 pt-2">
                <span>Total Net Profit:</span>
                <span className={`font-mono ${analysis.netProfit >= 0 ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}`}>
                  {formatPKR(analysis.netProfit)}
                </span>
              </div>

              <div className="flex justify-between text-xs font-bold pt-1">
                <span className="text-slate-400 print:text-slate-600">Overall Profit Margin:</span>
                <span className={`font-mono ${analysis.overallMarginPercent >= 0 ? 'text-purple-400 print:text-purple-700' : 'text-rose-400 print:text-rose-700'}`}>
                  {analysis.overallMarginPercent}%
                </span>
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 print:text-slate-500 pt-0.5">
                <span>Overall Markup on Cost:</span>
                <span className="font-mono font-semibold text-slate-400 print:text-slate-600">
                  {analysis.overallMarkupPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Footer Timestamp for Auditing */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center print:border-slate-300 print:text-slate-500">
            <span>Perfect Shine Chemicals POS & Factory ERP • Confidential Management Audit</span>
            <span>Printed on: {formatDateTime(new Date().toISOString())}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
