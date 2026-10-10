import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  FileText, 
  Eye, 
  EyeOff, 
  Building2, 
  Calendar, 
  Clock, 
  Phone, 
  Mail, 
  Package, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  Info,
  DollarSign,
  FileCheck
} from 'lucide-react';
import { Quotation, QuotationLineItem } from '../../types';
import { formatPKR, formatDate, formatBoxBreakdown } from '../../utils/formatters';
import { printElement } from '../../utils/printHelper';

interface QuotationViewModalProps {
  quotation: Quotation;
  onClose: () => void;
  onEdit?: (quotation: Quotation) => void;
  onConvertToInvoice?: (quotation: Quotation) => void;
}

export const QuotationViewModal: React.FC<QuotationViewModalProps> = ({
  quotation,
  onClose,
  onEdit,
  onConvertToInvoice,
}) => {
  const isStandard = quotation.quotation_type === 'standard_unit_price';

  // Mode: 'customer' vs 'internal' (only applicable for Private Label)
  const [viewMode, setViewMode] = useState<'customer' | 'internal'>('customer');

  const handlePrint = () => {
    printElement('printable-quotation', `Quotation_${quotation.quotation_number}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'rejected':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'expired':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  // Grand Total calculation
  const grandTotal = quotation.items.reduce((sum, item) => {
    if (isStandard) {
      const ur = Number(item.unit_rate !== undefined ? item.unit_rate : (item.quoted_price_per_unit || 0));
      const qBottles = Number(item.quantity_bottles || 0);
      return sum + (item.line_total !== undefined ? Number(item.line_total) : (qBottles * ur));
    }
    return sum + Number(item.quoted_price_per_unit || item.total_cost_per_unit || 0);
  }, 0);

  const totalBottlesQuoted = quotation.items.reduce((sum, item) => {
    return sum + Number(item.quantity_bottles || 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Control Bar (Screen only, completely hidden on print) */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 no-print flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isStandard 
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400' 
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            }`}>
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">Quotation #{quotation.quotation_number}</h3>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(quotation.status)}`}>
                  {quotation.status}
                </span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  isStandard
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                }`}>
                  {isStandard ? 'Standard Unit Price' : 'Private Label'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {quotation.customer_name} {quotation.company_name ? `• ${quotation.company_name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Only shown for Private Label quotes */}
            {!isStandard && (
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('customer')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    viewMode === 'customer'
                      ? 'bg-emerald-500 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Customer-facing proposal: Shows itemized breakdown & Total Price"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Customer Proposal (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('internal')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    viewMode === 'internal'
                      ? 'bg-amber-500 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                  title="Internal Cost Sheet: Shows factory cost breakdown, labour & profit margins"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Internal Cost Sheet
                </button>
              </div>
            )}

            {/* Convert to Invoice Button (if accepted) */}
            {onConvertToInvoice && quotation.status === 'accepted' && (
              <button
                type="button"
                onClick={() => onConvertToInvoice(quotation)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                title="Convert this accepted quotation to a sales invoice"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Convert to Invoice</span>
              </button>
            )}

            {onEdit && (
              <button
                onClick={() => onEdit(quotation)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              >
                Edit
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informational banner when viewing Customer mode */}
        {!isStandard && viewMode === 'customer' && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2 no-print">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              <strong>Customer Proposal View:</strong> Itemized component breakdown (Liquid, Bottle, Cap, Label, Box) summing to Total Unit Price.
            </span>
          </div>
        )}

        {!isStandard && viewMode === 'internal' && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-300 flex items-center gap-2 no-print">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Confidential Internal Mode:</strong> Showing full unit cost breakdown and calculated profit margins. Do not send this view to prospective clients.
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Printable Quotation Document (A4 proportioned, clean typography & margins)*/}
        {/* ========================================================================= */}
        <div 
          id="printable-quotation" 
          className="overflow-y-auto p-6 sm:p-8 print:p-0 print:m-0 bg-white text-slate-900 font-sans text-xs leading-normal"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-4 gap-4">
            <div className="flex items-start gap-3.5">
              <img 
                src="/assets/logo.png" 
                alt="Perfect Shine Chemicals" 
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0" 
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-none">
                  PERFECT SHINE CHEMICALS
                </h1>
                <p className="text-[11px] text-slate-600 font-medium mt-1">
                  Industrial & Commercial Cleaning Solutions Manufacturer • Private Label Specialists
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore, Pakistan
                </p>
                <p className="text-[10px] text-slate-700 font-medium mt-0.5">
                  Contact: <span className="font-mono font-bold text-slate-900">0327-4549485</span> • Email: <span className="font-mono">perfectshinechemicals@gmail.com</span>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="inline-block px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider mb-1.5 bg-slate-950 text-white">
                {isStandard 
                  ? 'Commercial Price Quotation' 
                  : (viewMode === 'internal' ? 'Confidential Cost Sheet' : 'Commercial Price Quotation')}
              </div>
              <p className="text-sm font-bold font-mono text-slate-950">
                Quote #: {quotation.quotation_number}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Date: <span className="font-semibold text-slate-900">{formatDate(quotation.date)}</span>
              </p>
              <p className="text-[11px] text-emerald-800 font-bold mt-0.5">
                Validity: <span>{quotation.validity_period || 'Valid for 15 days'}</span>
              </p>
            </div>
          </div>

          {/* Quotation For / Prospective Client Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Quotation Prepared For:</p>
              <p className="text-sm font-black text-slate-950 mt-0.5">{quotation.customer_name}</p>
              {quotation.company_name && (
                <p className="text-[11px] font-bold text-emerald-800 mt-0.5 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  <span>{quotation.company_name}</span>
                </p>
              )}
              {quotation.phone && (
                <p className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span className="font-mono">{quotation.phone}</span>
                </p>
              )}
              {quotation.email && (
                <p className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>{quotation.email}</span>
                </p>
              )}
            </div>

            <div className="sm:text-right flex flex-col justify-between">
              <div>
                <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Proposal Summary:</p>
                <p className="text-[11px] font-bold text-slate-900 mt-0.5">
                  Products Included: {quotation.items.length} SKU(s)
                </p>
                {isStandard && totalBottlesQuoted > 0 && (
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Total Quantity: <strong className="text-slate-900">{totalBottlesQuoted.toLocaleString('en-PK')} Bottles</strong>
                  </p>
                )}
                {quotation.items.some(it => it.moq) ? (
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    MOQ: <strong className="text-slate-900">{
                      quotation.items.length === 1 
                        ? quotation.items[0].moq 
                        : 'Specified per SKU below'
                    }</strong>
                  </p>
                ) : quotation.moq ? (
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    MOQ: <strong className="text-slate-900">{quotation.moq}</strong>
                  </p>
                ) : null}
                {!isStandard && quotation.repeat_order_moq && (
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Repeat Order MOQ: <strong className="text-slate-900">{quotation.repeat_order_moq}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PRODUCT & PRICING TABLE                                                   */}
          {/* ========================================================================= */}
          {isStandard ? (
            /* ======================================================================= */
            /* 1. STANDARD UNIT PRICE TABLE                                            */
            /* Columns: Product | Pack Size | Bottles per Box | Unit Rate | Box Rate   */
            /*          | Quantity | Amount                                            */
            /* ======================================================================= */
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-2 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Product</th>
                    <th className="py-2.5 px-2.5 min-w-[90px]">Pack Size</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">Bottles / Box</th>
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Unit Rate</th>
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Box Rate</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap min-w-[130px]">Quantity</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-100/90 text-emerald-950 font-black whitespace-nowrap min-w-[105px]">
                      Amount (PKR)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quotation.items.map((item, idx) => {
                    const bpb = Number(item.bottles_per_box || 0);
                    const ur = Number(item.unit_rate !== undefined ? item.unit_rate : (item.quoted_price_per_unit || 0));
                    const boxRate = bpb > 0 ? Number((bpb * ur).toFixed(2)) : Number(item.box_rate || 0);
                    const qBottles = Number(item.quantity_bottles || 0);
                    const lineTotal = Number(item.line_total !== undefined ? item.line_total : (qBottles * ur).toFixed(2));
                    const boxBreakdown = formatBoxBreakdown(qBottles, bpb);

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-400 text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-black text-slate-950 text-xs block leading-tight">
                            {item.product_name}
                          </span>
                          {item.notes && (
                            <span className="text-[10px] text-slate-500 italic block mt-0.5">
                              {item.notes}
                            </span>
                          )}
                          {item.moq && (
                            <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                              MOQ: {item.moq}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2.5 font-medium text-slate-800">
                          {item.size || 'Standard'}
                        </td>
                        <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-900">
                          {bpb > 0 ? bpb : '-'}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatPKR(ur)}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                          {bpb > 0 ? formatPKR(boxRate) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="font-mono font-black text-slate-950 block text-xs">
                            {qBottles.toLocaleString('en-PK')} Bottles
                          </span>
                          {bpb > 0 && qBottles > 0 && (
                            <span className="text-[10px] font-semibold text-slate-600 block mt-0.5">
                              ({boxBreakdown})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right bg-emerald-50/70 whitespace-nowrap">
                          <span className="text-xs font-black font-mono text-emerald-950 block">
                            {formatPKR(lineTotal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-100 font-bold">
                    <td colSpan={6} className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-slate-800">
                      Grand Total:
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-xs text-slate-700">
                      {totalBottlesQuoted.toLocaleString('en-PK')} Bottles
                    </td>
                    <td className="py-3 px-3 text-right bg-emerald-200/90 text-emerald-950 font-black font-mono text-sm whitespace-nowrap">
                      {formatPKR(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : viewMode === 'customer' ? (
            /* ======================================================================= */
            /* 2. PRIVATE LABEL CUSTOMER VIEW (Itemized Cost Breakdown + Total Price)   */
            /* ======================================================================= */
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2 px-1.5 w-7 text-center">#</th>
                    <th className="py-2 px-2 min-w-[150px]">Product & Pack Size</th>
                    <th className="py-2 px-1.5 text-right whitespace-nowrap">Liquid Cost</th>
                    <th className="py-2 px-1.5 text-right whitespace-nowrap">Bottle</th>
                    <th className="py-2 px-1.5 text-right whitespace-nowrap">Cap/Pump</th>
                    <th className="py-2 px-1.5 text-right whitespace-nowrap">Label</th>
                    {quotation.items.some(it => (it.labour_cost || 0) > 0) && (
                      <th className="py-2 px-1.5 text-right whitespace-nowrap">Labour</th>
                    )}
                    <th className="py-2 px-1.5 text-right whitespace-nowrap">Box/Carton</th>
                    <th className="py-2 px-2 text-right bg-emerald-100/90 text-emerald-950 font-black whitespace-nowrap min-w-[95px]">
                      TOTAL PRICE
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quotation.items.map((item, idx) => {
                    const hasAnyLabour = quotation.items.some(it => (it.labour_cost || 0) > 0);
                    const totalUnit = item.quoted_price_per_unit || item.total_cost_per_unit;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-1.5 text-center font-mono font-bold text-slate-400 text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-slate-950 text-xs block leading-tight">
                            {item.product_name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-medium">
                            <span>Pack: <strong className="text-slate-700">{item.size || 'Standard'}</strong></span>
                            {(item.moq || quotation.moq) && (
                              <>
                                <span>•</span>
                                <span>MOQ: <strong className="text-slate-900 font-bold">{item.moq || quotation.moq}</strong></span>
                              </>
                            )}
                          </div>
                          {item.notes && (
                            <span className="text-[10px] text-slate-500 italic block mt-0.5">
                              {item.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatPKR(item.product_cost)}
                        </td>
                        <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatPKR(item.bottle_cost)}
                        </td>
                        <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatPKR(item.cap_cost)}
                        </td>
                        <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatPKR(item.label_cost)}
                        </td>
                        {hasAnyLabour && (
                          <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 whitespace-nowrap">
                            {formatPKR(item.labour_cost || 0)}
                          </td>
                        )}
                        <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatPKR(item.carton_cost)}
                        </td>
                        <td className="py-2.5 px-2 text-right bg-emerald-50/70 whitespace-nowrap">
                          <span className="text-xs font-black font-mono text-emerald-900 block">
                            {formatPKR(totalUnit)}
                          </span>
                          <span className="text-[8px] text-slate-500 uppercase font-bold block">
                            Per Unit Ex-Factory
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ======================================================================= */
            /* 3. CONFIDENTIAL INTERNAL VIEW (Shows Factory Breakdown & Margins)       */
            /* ======================================================================= */
            <div className="mb-4 overflow-x-auto">
              <div className="mb-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900 font-bold uppercase tracking-wider text-center">
                🔒 Confidential Factory Costing Breakdown (Internal Review Only)
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-1.5 px-1.5">#</th>
                    <th className="py-1.5 px-2 min-w-[130px]">Product</th>
                    <th className="py-1.5 px-1.5 text-right">Liquid</th>
                    <th className="py-1.5 px-1.5 text-right">Bottle</th>
                    <th className="py-1.5 px-1.5 text-right">Cap</th>
                    <th className="py-1.5 px-1.5 text-right">Label</th>
                    <th className="py-1.5 px-1.5 text-right">Labour</th>
                    <th className="py-1.5 px-1.5 text-right">Carton</th>
                    <th className="py-1.5 px-1.5 text-right bg-amber-100 font-bold">Total Cost</th>
                    <th className="py-1.5 px-1.5 text-right bg-emerald-100 font-bold">Quoted</th>
                    <th className="py-1.5 px-1.5 text-right bg-emerald-200 font-black">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quotation.items.map((item, idx) => {
                    const margin = Number((item.quoted_price_per_unit - item.total_cost_per_unit).toFixed(2));
                    const marginPct = item.total_cost_per_unit > 0 
                      ? Math.round((margin / item.total_cost_per_unit) * 100) 
                      : 0;

                    return (
                      <tr key={item.id || idx}>
                        <td className="py-2 px-1.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-2 font-bold text-slate-900">{item.product_name}</td>
                        <td className="py-2 px-1.5 text-right font-mono text-slate-700">{formatPKR(item.product_cost)}</td>
                        <td className="py-2 px-1.5 text-right font-mono text-slate-700">{formatPKR(item.bottle_cost)}</td>
                        <td className="py-2 px-1.5 text-right font-mono text-slate-700">{formatPKR(item.cap_cost)}</td>
                        <td className="py-2 px-1.5 text-right font-mono text-slate-700">{formatPKR(item.label_cost)}</td>
                        <td className="py-2 px-1.5 text-right font-mono text-slate-700">{formatPKR(item.labour_cost || 0)}</td>
                        <td className="py-2 px-1.5 text-right font-mono text-slate-700">{formatPKR(item.carton_cost)}</td>
                        <td className="py-2 px-1.5 text-right font-mono font-bold bg-amber-50">{formatPKR(item.total_cost_per_unit)}</td>
                        <td className="py-2 px-1.5 text-right font-mono font-bold bg-emerald-50 text-emerald-950">{formatPKR(item.quoted_price_per_unit)}</td>
                        <td className="py-2 px-1.5 text-right font-mono font-black bg-emerald-100 text-emerald-900 whitespace-nowrap">
                          {formatPKR(margin)} ({marginPct}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TERMS & CONDITIONS (COMMERCIAL SPECIFICATIONS)                            */}
          {/* ========================================================================= */}
          <div className="mt-4 border border-slate-300 rounded-xl overflow-hidden [break-inside:avoid] print:[break-inside:avoid]">
            <div className="bg-slate-900 text-white px-4 py-2 font-bold text-[10px] uppercase tracking-wider flex items-center justify-between">
              <span>Terms, Conditions & Quality Standards</span>
              <span className="text-[9px] text-slate-400 font-normal">Official Proposal Terms</span>
            </div>

            <div className="divide-y divide-slate-200 text-xs">
              
              {/* MOQ */}
              {(quotation.moq || quotation.items.some(it => it.moq)) && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 bg-slate-50/70 items-center">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Minimum Order Quantity (MOQ):
                  </span>
                  <div className="sm:col-span-8 font-semibold text-slate-900 text-xs">
                    {quotation.items.some(it => it.moq) ? (
                      quotation.items.length === 1 ? (
                        <span className="font-bold">{quotation.items[0].moq}</span>
                      ) : (
                        <div className="space-y-0.5">
                          {quotation.items.map((it, i) => it.moq ? (
                            <div key={i} className="text-slate-800 text-[11px]">
                              • <span className="font-semibold">{it.product_name}:</span> {it.moq}
                            </div>
                          ) : null)}
                        </div>
                      )
                    ) : (
                      <span className="font-bold">{quotation.moq}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Repeat Order MOQ (Private Label only) */}
              {!isStandard && quotation.repeat_order_moq && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 items-center">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Repeat Order MOQ:
                  </span>
                  <span className="sm:col-span-8 font-semibold text-slate-900 text-xs">
                    {quotation.repeat_order_moq}
                  </span>
                </div>
              )}

              {/* Validity Period */}
              {quotation.validity_period && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 bg-slate-50/70 items-center">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Quotation Validity:
                  </span>
                  <span className="sm:col-span-8 font-bold text-emerald-800 text-xs">
                    {quotation.validity_period}
                  </span>
                </div>
              )}

              {/* Sample Cost Note (Optional) */}
              {quotation.sample_cost && quotation.sample_cost.trim().length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 items-center">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Sample Cost & Refund Policy:
                  </span>
                  <span className="sm:col-span-8 font-semibold text-slate-900 text-xs">
                    {quotation.sample_cost}
                  </span>
                </div>
              )}

              {/* Sample Lead Time (Private Label only) */}
              {!isStandard && quotation.sample_lead_time && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 bg-slate-50/70 items-center">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Sample Lead Time:
                  </span>
                  <span className="sm:col-span-8 font-semibold text-slate-900 text-xs">
                    {quotation.sample_lead_time}
                  </span>
                </div>
              )}

              {/* Delivery & Logistics */}
              {quotation.delivery_charges && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 items-center">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Delivery & Freight Charges:
                  </span>
                  <span className="sm:col-span-8 font-semibold text-slate-900 text-xs">
                    {quotation.delivery_charges}
                  </span>
                </div>
              )}

              {/* Available Fragrances (Private Label only) */}
              {!isStandard && quotation.available_fragrances && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 bg-slate-50/70 items-start">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Available Fragrances:
                  </span>
                  <span className="sm:col-span-8 font-semibold text-slate-900 text-xs leading-relaxed">
                    {quotation.available_fragrances}
                  </span>
                </div>
              )}

              {/* Formula Specifications (Private Label only) */}
              {!isStandard && quotation.formula_specifications && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 items-start">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Formula Specifications:
                  </span>
                  <span className="sm:col-span-8 font-medium text-slate-900 text-xs whitespace-pre-wrap leading-relaxed">
                    {quotation.formula_specifications}
                  </span>
                </div>
              )}

              {/* Batch, MFG & Expiry Info (Private Label only) */}
              {!isStandard && quotation.batch_mfg_expiry_info && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 bg-slate-50/70 items-start">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Batch, MFG & Expiry Info:
                  </span>
                  <span className="sm:col-span-8 font-medium text-slate-900 text-xs whitespace-pre-wrap leading-relaxed">
                    {quotation.batch_mfg_expiry_info}
                  </span>
                </div>
              )}

              {/* Payment & Contract Terms */}
              {quotation.terms_conditions && (
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3.5 items-start">
                  <span className="sm:col-span-4 font-bold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-2 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Payment & Contract Terms:
                  </span>
                  <div className="sm:col-span-8 text-slate-900 font-medium text-xs whitespace-pre-wrap leading-relaxed">
                    {quotation.terms_conditions}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signatures & Quotation Acceptance Block */}
          <div className="mt-8 pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs [break-inside:avoid] print:[break-inside:avoid]">
            <div>
              <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-8">
                Authorized Signatory (Perfect Shine Chemicals):
              </p>
              <div className="border-t-2 border-slate-900 w-52 pt-1.5">
                <p className="font-black text-slate-950 text-xs">Sharjeel Ahmad</p>
                <p className="text-[10px] text-slate-600 font-medium mt-0.5">Managing Partner - Operations</p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-8">
                Client Acceptance Signature & Stamp:
              </p>
              <div className="border-t-2 border-slate-900 w-52 pt-1.5 text-right">
                <p className="font-black text-slate-950 text-xs">{quotation.customer_name}</p>
                <p className="text-[10px] text-slate-600 font-medium mt-0.5">Date: _______________</p>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[9px] text-slate-400 [break-inside:avoid] print:[break-inside:avoid]">
            This is an official commercial price quotation from Perfect Shine Chemicals • Valid until {quotation.validity_period || '15 days'}
          </div>
        </div>
      </div>
    </div>
  );
};
