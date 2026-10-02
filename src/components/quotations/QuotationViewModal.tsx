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
  Info
} from 'lucide-react';
import { Quotation, QuotationLineItem } from '../../types';
import { formatPKR, formatDate } from '../../utils/formatters';
import { printElement } from '../../utils/printHelper';

interface QuotationViewModalProps {
  quotation: Quotation;
  onClose: () => void;
  onEdit?: (quotation: Quotation) => void;
}

export const QuotationViewModal: React.FC<QuotationViewModalProps> = ({
  quotation,
  onClose,
  onEdit,
}) => {
  // Mode: 'customer' (breakdown + total) vs 'internal' (full cost, labour & margins)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Control Bar (Screen only, completely hidden on print) */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 no-print flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">Quotation #{quotation.quotation_number}</h3>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(quotation.status)}`}>
                  {quotation.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {quotation.customer_name} {quotation.company_name ? `• ${quotation.company_name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Customer PDF vs Internal Cost Sheet */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('customer')}
                className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === 'customer'
                    ? 'bg-emerald-500 text-slate-950 shadow font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Customer-facing proposal: Shows itemized breakdown (Liquid, Bottle, Cap, Label, Box, Transport) & Total Price"
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
        {viewMode === 'customer' && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2 no-print">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              <strong>Customer Proposal View:</strong> Itemized component breakdown (Liquid, Bottle, Cap, Label, Box, Transport) summing to Total Unit Price.
            </span>
          </div>
        )}

        {viewMode === 'internal' && (
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
                {viewMode === 'internal' ? 'Confidential Cost Sheet' : 'Commercial Price Quotation'}
              </div>
              <p className="text-sm font-bold font-mono text-slate-950">
                Quote #: {quotation.quotation_number}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Date: <span className="font-semibold text-slate-900">{formatDate(quotation.date)}</span>
              </p>
              <p className="text-[11px] text-emerald-800 font-bold mt-0.5">
                Validity: <span>{quotation.validity_period}</span>
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
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Standard MOQ: <strong className="text-slate-900">{quotation.moq}</strong>
                </p>
                {quotation.repeat_order_moq && (
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
          {viewMode === 'customer' ? (
            /* 1. CUSTOMER-FACING VIEW (Itemized Cost Breakdown + Total Price Per Unit) */
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
                    <th className="py-2 px-1.5 text-right whitespace-nowrap">Transport</th>
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
                            <span>•</span>
                            <span>MOQ: <strong className="text-slate-700">{item.moq || quotation.moq}</strong></span>
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
                        <td className="py-2.5 px-1.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatPKR(item.transport_cost || 0)}
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
            /* 2. CONFIDENTIAL INTERNAL VIEW (Shows Complete Cost Breakdown & Margins) */
            <div className="mb-4 overflow-x-auto">
              <div className="mb-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900 font-bold uppercase tracking-wider text-center">
                🔒 Confidential Factory Costing Breakdown (Internal Review Only)
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-1.5 px-1.5">#</th>
                    <th className="py-1.5 px-1.5">Product & Size</th>
                    <th className="py-1.5 px-1.5 text-right">Liquid</th>
                    <th className="py-1.5 px-1.5 text-right">Bottle</th>
                    <th className="py-1.5 px-1.5 text-right">Cap/Pump</th>
                    <th className="py-1.5 px-1.5 text-right">Label</th>
                    <th className="py-1.5 px-1.5 text-right">Carton</th>
                    <th className="py-1.5 px-1.5 text-right">Transport</th>
                    <th className="py-1.5 px-1.5 text-right">Labour</th>
                    <th className="py-1.5 px-1.5 text-right bg-slate-200/80 font-black">Total Cost</th>
                    <th className="py-1.5 px-1.5 text-right bg-emerald-100/70 font-black">Quoted Price</th>
                    <th className="py-1.5 px-1.5 text-right font-black">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[10px]">
                  {quotation.items.map((item, idx) => {
                    const margin = Number((item.quoted_price_per_unit - item.total_cost_per_unit).toFixed(2));
                    const marginPct = item.total_cost_per_unit > 0 
                      ? Math.round((margin / item.total_cost_per_unit) * 100) 
                      : 0;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-1.5 text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-1.5 px-1.5 font-sans font-bold text-slate-900">
                          <div>{item.product_name}</div>
                          <span className="text-[9px] text-slate-500 font-normal">{item.size || 'Standard'}</span>
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-600">{formatPKR(item.product_cost)}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-600">{formatPKR(item.bottle_cost)}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-600">{formatPKR(item.cap_cost)}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-600">{formatPKR(item.label_cost)}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-600">{formatPKR(item.carton_cost)}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-600">{formatPKR(item.transport_cost || 0)}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-600">{formatPKR(item.labour_cost)}</td>
                        <td className="py-1.5 px-1.5 text-right font-black text-slate-900 bg-slate-50">
                          {formatPKR(item.total_cost_per_unit)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-black text-emerald-800 bg-emerald-50">
                          {formatPKR(item.quoted_price_per_unit)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-black">
                          <span className={margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {formatPKR(margin)}
                            <span className="block text-[8px] font-normal">({marginPct}%)</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================================= */}
          {/* COMMERCIAL TERMS & PARAMETERS GRID (Compact A4 page layout)              */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3.5 [break-inside:avoid] print:[break-inside:avoid]">
            {/* Left Box: Terms & Operations */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <Package className="w-3 h-3 text-emerald-700" />
                <span>Commercial Terms & Order Quantities</span>
              </h4>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div>
                  <span className="text-slate-500 block">Initial Order MOQ:</span>
                  <span className="font-bold text-slate-900">{quotation.moq || '1,000 Units'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Repeat Order MOQ:</span>
                  <span className="font-bold text-slate-900">{quotation.repeat_order_moq || '500 Units'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sample Cost:</span>
                  <span className="font-bold text-slate-900">{quotation.sample_cost || 'PKR 2,500'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sample Lead Time:</span>
                  <span className="font-bold text-slate-900">{quotation.sample_lead_time || '3-5 Working Days'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block">Delivery & Logistics:</span>
                  <span className="font-bold text-slate-900">{quotation.delivery_charges || 'Ex-Factory Lahore / Freight at actual'}</span>
                </div>
                {quotation.available_fragrances && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Available Fragrances:</span>
                    <span className="font-bold text-slate-900">{quotation.available_fragrances}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Box: Specifications & Quality Control */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                <span>Formulation & Quality Specifications</span>
              </h4>
              <div className="space-y-1 text-[10px]">
                {quotation.formula_specifications ? (
                  <div>
                    <span className="text-slate-500 block">Technical Specs:</span>
                    <p className="font-medium text-slate-800 whitespace-pre-wrap">{quotation.formula_specifications}</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-500 block">Technical Specs:</span>
                    <p className="font-medium text-slate-800">Custom pH-balanced formulation engineered with industrial-grade surfactants & stabilizers.</p>
                  </div>
                )}
                {quotation.batch_mfg_expiry_info && (
                  <div className="pt-0.5">
                    <span className="text-slate-500 block">Batch, MFG & Expiry:</span>
                    <p className="font-medium text-slate-800 whitespace-pre-wrap">{quotation.batch_mfg_expiry_info}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* General Notes / Payment Terms */}
          {quotation.terms_conditions && (
            <div className="mb-3.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] [break-inside:avoid] print:[break-inside:avoid]">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px] block mb-0.5">
                Payment & Contract Terms:
              </span>
              <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                {quotation.terms_conditions}
              </p>
            </div>
          )}

          {/* Signatures & Quotation Acceptance Block */}
          <div className="mt-6 pt-4 border-t-2 border-slate-200 grid grid-cols-2 gap-6 text-xs [break-inside:avoid] print:[break-inside:avoid]">
            <div>
              <p className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-6">
                Authorized Signatory (Perfect Shine Chemicals):
              </p>
              <div className="border-t border-slate-400 w-44 pt-1">
                <p className="font-bold text-slate-900 text-xs">Muhammad Sharjeel</p>
                <p className="text-[9px] text-slate-500">Managing Partner / Operations</p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <p className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-6">
                Client Acceptance Signature & Stamp:
              </p>
              <div className="border-t border-slate-400 w-44 pt-1 text-right">
                <p className="font-bold text-slate-900 text-xs">{quotation.customer_name}</p>
                <p className="text-[9px] text-slate-500">Date: _______________</p>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[9px] text-slate-400 [break-inside:avoid] print:[break-inside:avoid]">
            This is an official commercial price quotation from Perfect Shine Chemicals • Valid until {quotation.validity_period}
          </div>
        </div>
      </div>
    </div>
  );
};
