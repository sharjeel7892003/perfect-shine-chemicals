import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  Building2, 
  User, 
  Calendar, 
  Clock, 
  Package, 
  Layers, 
  DollarSign, 
  ShieldCheck, 
  FileText,
  HelpCircle,
  TrendingUp,
  Sparkles,
  Info
} from 'lucide-react';
import { Quotation, QuotationLineItem, QuotationStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatPKR } from '../../utils/formatters';

interface QuotationModalProps {
  initialQuotation?: Quotation | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (quotation: Quotation) => void;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  initialQuotation,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { customers, saveQuotation, quotations } = useApp();

  // Mode: Existing Customer vs New Prospect
  const [customerMode, setCustomerMode] = useState<'existing' | 'prospect'>('prospect');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // Header Info
  const [customerName, setCustomerName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [quotationNumber, setQuotationNumber] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [validityPeriod, setValidityPeriod] = useState<string>('Valid for 15 days');
  const [status, setStatus] = useState<QuotationStatus>('pending');

  // Product Line Items (Cost Breakdown Section - 100% manual entry)
  const [items, setItems] = useState<QuotationLineItem[]>([
    {
      id: 'item-1',
      product_name: 'Premium Car Wash Shampoo',
      size: '500ml Bottle',
      product_cost: 45,
      bottle_cost: 22,
      cap_cost: 8,
      label_cost: 6,
      labour_cost: 0,
      carton_cost: 5,
      total_cost_per_unit: 86,
      quoted_price_per_unit: 86,
      moq: '1,000 Bottles',
      notes: ''
    }
  ]);

  // Additional Quotation Fields
  const [moq, setMoq] = useState<string>('1,000 Units per SKU');
  const [repeatOrderMoq, setRepeatOrderMoq] = useState<string>('500 Units');
  const [sampleCost, setSampleCost] = useState<string>('PKR 2,500 (100% Refundable against confirmed bulk order)');
  const [sampleLeadTime, setSampleLeadTime] = useState<string>('3-5 Working Days');
  const [deliveryCharges, setDeliveryCharges] = useState<string>('Ex-Factory Lahore / Freight at actual to destination');
  const [availableFragrances, setAvailableFragrances] = useState<string>('Lemon Fresh, Ocean Breeze, Wild Strawberry, Royal Jasmine, Lavender, Green Apple');
  const [formulaSpecifications, setFormulaSpecifications] = useState<string>('Industrial-grade pH balanced 6.5–7.5, high-foaming biodegradable surfactants, paint & clearcoat safe, anti-swirl lubricated polymers.');
  const [batchMfgExpiryInfo, setBatchMfgExpiryInfo] = useState<string>('24 Months shelf life from Manufacturing Date. Unique batch code and laser-printed MFG/EXP dates on each bottle & master carton.');
  const [termsConditions, setTermsConditions] = useState<string>('• 50% advance payment upon sample approval & order confirmation, 50% prior to dispatch.\n• Lead time for initial private label run: 10–14 working days from artwork finalization.\n• Quotation rates are valid for 15 days from issue date.');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    if (initialQuotation) {
      if (initialQuotation.customer_id) {
        setCustomerMode('existing');
        setSelectedCustomerId(initialQuotation.customer_id);
      } else {
        setCustomerMode('prospect');
        setSelectedCustomerId('');
      }
      setCustomerName(initialQuotation.customer_name || '');
      setCompanyName(initialQuotation.company_name || '');
      setPhone(initialQuotation.phone || '');
      setEmail(initialQuotation.email || '');
      setQuotationNumber(initialQuotation.quotation_number || '');
      setDate(initialQuotation.date || new Date().toISOString().split('T')[0]);
      setValidityPeriod(initialQuotation.validity_period || 'Valid for 15 days');
      setStatus(initialQuotation.status || 'pending');
      setItems(initialQuotation.items && initialQuotation.items.length > 0 ? initialQuotation.items : [
        {
          id: 'item-1',
          product_name: '',
          size: '500ml',
          product_cost: 0,
          bottle_cost: 0,
          cap_cost: 0,
          label_cost: 0,
          labour_cost: 0,
          carton_cost: 0,
          total_cost_per_unit: 0,
          quoted_price_per_unit: 0,
        }
      ]);
      setMoq(initialQuotation.moq || '1,000 Units per SKU');
      setRepeatOrderMoq(initialQuotation.repeat_order_moq || '500 Units');
      setSampleCost(initialQuotation.sample_cost || 'PKR 2,500');
      setSampleLeadTime(initialQuotation.sample_lead_time || '3-5 Working Days');
      setDeliveryCharges(initialQuotation.delivery_charges || 'Ex-Factory Lahore / Freight at actual');
      setAvailableFragrances(initialQuotation.available_fragrances || '');
      setFormulaSpecifications(initialQuotation.formula_specifications || '');
      setBatchMfgExpiryInfo(initialQuotation.batch_mfg_expiry_info || '');
      setTermsConditions(initialQuotation.terms_conditions || '');
      setNotes(initialQuotation.notes || '');
    } else {
      // New quotation defaults
      const year = new Date().getFullYear();
      const nextNum = `QT-${year}-${String(quotations.length + 1).padStart(4, '0')}`;
      setQuotationNumber(nextNum);
      setCustomerMode('prospect');
      setSelectedCustomerId('');
      setCustomerName('');
      setCompanyName('');
      setPhone('');
      setEmail('');
      setDate(new Date().toISOString().split('T')[0]);
      setValidityPeriod('Valid for 15 days');
      setStatus('pending');
      setItems([
        {
          id: 'item-1',
          product_name: 'Premium Car Wash Shampoo',
          size: '500ml Bottle',
          product_cost: 45,
          bottle_cost: 22,
          cap_cost: 8,
          label_cost: 6,
          labour_cost: 0,
          carton_cost: 5,
          total_cost_per_unit: 86,
          quoted_price_per_unit: 86,
          moq: '1,000 Bottles',
          notes: ''
        }
      ]);
    }
  }, [initialQuotation, isOpen]);

  // Handle existing customer selection
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find(c => c.id === customerId);
    if (cust) {
      setCustomerName(cust.name);
      setCompanyName((cust as any).company_name || cust.city || '');
      setPhone(cust.phone || '');
      setEmail((cust as any).email || '');
    }
  };

  // Line item manipulation
  const updateLineItem = (index: number, field: keyof QuotationLineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Auto-sum the cost breakdown items into total_cost_per_unit (Liquid + Bottle + Cap + Label + Box + Labour)
      const pCost = Number(item.product_cost || 0);
      const bCost = Number(item.bottle_cost || 0);
      const capCost = Number(item.cap_cost || 0);
      const lCost = Number(item.label_cost || 0);
      const labCost = Number(item.labour_cost || 0);
      const cCost = Number(item.carton_cost || 0);
      const sum = Number((pCost + bCost + capCost + lCost + labCost + cCost).toFixed(2));
      item.total_cost_per_unit = sum;

      // Keep quoted_price_per_unit synced if user hasn't explicitly customized it
      if (field !== 'quoted_price_per_unit' && (!item.quoted_price_per_unit || item.quoted_price_per_unit === updated[index].total_cost_per_unit)) {
        item.quoted_price_per_unit = sum;
      }

      updated[index] = item;
      return updated;
    });
  };

  const addLineItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        product_name: '',
        size: '500ml Bottle',
        product_cost: 0,
        bottle_cost: 0,
        cap_cost: 0,
        label_cost: 0,
        labour_cost: 0,
        carton_cost: 0,
        total_cost_per_unit: 0,
        quoted_price_per_unit: 0,
        moq: moq,
        notes: ''
      }
    ]);
  };

  const removeLineItem = (index: number) => {
    if (items.length <= 1) {
      alert('A quotation must contain at least one line item.');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage('Please enter the customer or prospect name.');
      return;
    }

    if (items.length === 0 || !items.some(it => it.product_name.trim())) {
      setErrorMessage('Please add at least one product with a valid name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const saved = await saveQuotation({
        id: initialQuotation?.id,
        quotation_number: quotationNumber,
        customer_id: customerMode === 'existing' && selectedCustomerId ? selectedCustomerId : undefined,
        customer_name: customerName.trim(),
        company_name: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        date,
        validity_period: validityPeriod,
        status,
        items,
        moq,
        repeat_order_moq: repeatOrderMoq,
        sample_cost: sampleCost,
        sample_lead_time: sampleLeadTime,
        delivery_charges: deliveryCharges,
        available_fragrances: availableFragrances,
        formula_specifications: formulaSpecifications,
        batch_mfg_expiry_info: batchMfgExpiryInfo,
        terms_conditions: termsConditions,
        notes,
      });

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save quotation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {initialQuotation ? `Edit Quotation #${initialQuotation.quotation_number}` : 'Create Commercial Price Quotation'}
              </h2>
              <p className="text-xs text-slate-400">
                100% standalone cost breakdown • Does NOT alter live production or inventory BOM data
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 text-slate-200">
          
          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 1: PROSPECT / CUSTOMER & PROPOSAL DETAILS                        */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  1. Prospect / Customer Details
                </h3>
              </div>

              {/* Toggle Existing vs New Prospect */}
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setCustomerMode('prospect')}
                  className={`px-2.5 py-1 rounded font-semibold transition-all ${
                    customerMode === 'prospect'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  New Prospect / Lead
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`px-2.5 py-1 rounded font-semibold transition-all ${
                    customerMode === 'existing'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Existing Customer
                </button>
              </div>
            </div>

            {customerMode === 'existing' && (
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Select Existing Customer:
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Choose registered customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} • {c.phone} {c.city ? `(${c.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Contact Person / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asim Raza"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Company / Brand Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Auto Detailing"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Phone / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0300-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. buyer@apex.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quotation Date, Validity, Number, Status */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-800/80">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Quotation Number
                </label>
                <input
                  type="text"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Quotation Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Validity Period
                </label>
                <input
                  type="text"
                  placeholder="e.g. Valid for 15 days"
                  value={validityPeriod}
                  onChange={(e) => setValidityPeriod(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Proposal Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QuotationStatus)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-emerald-500 focus:outline-none capitalize"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: COST BREAKDOWN & PRICING TABLE (100% MANUAL ENTRY)            */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    2. Product Cost Breakdown & Quoted Price (Per Unit)
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Type in individual component costs. They auto-SUM into Total Unit Cost. Enter your final Quoted Price to show customer.
                </p>
              </div>

              <button
                type="button"
                onClick={addLineItem}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product / Size</span>
              </button>
            </div>

            {/* Line Items Container */}
            <div className="space-y-3">
              {items.map((item, idx) => {
                const margin = Number((item.quoted_price_per_unit - item.total_cost_per_unit).toFixed(2));
                const marginPct = item.total_cost_per_unit > 0 
                  ? Math.round((margin / item.total_cost_per_unit) * 100) 
                  : 0;

                return (
                  <div 
                    key={item.id || idx}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                  >
                    {/* Item Title, Size, Notes & Remove Button */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Product Description / SKU #{idx + 1} *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Ultra Foam Snow Shampoo"
                            value={item.product_name}
                            onChange={(e) => updateLineItem(idx, 'product_name', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:border-cyan-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Pack Size / Container
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 500ml Bottle / 1L Can"
                            value={item.size || ''}
                            onChange={(e) => updateLineItem(idx, 'size', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0 mt-3"
                        title="Remove product line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Cost Inputs Grid (Cost Components) */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 truncate" title="Liquid chemical product bulk cost per unit">
                          Liquid Cost
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.product_cost === 0 ? '' : item.product_cost}
                            onChange={(e) => updateLineItem(idx, 'product_cost', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 truncate" title="Empty bottle cost per unit">
                          Bottle Cost
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.bottle_cost === 0 ? '' : item.bottle_cost}
                          onChange={(e) => updateLineItem(idx, 'bottle_cost', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 truncate" title="Cap / spray trigger / pump cost">
                          Cap/Pump Cost
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.cap_cost === 0 ? '' : item.cap_cost}
                          onChange={(e) => updateLineItem(idx, 'cap_cost', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 truncate" title="Front & back label sticker cost">
                          Label Cost
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.label_cost === 0 ? '' : item.label_cost}
                          onChange={(e) => updateLineItem(idx, 'label_cost', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 truncate" title="Master shipper carton / box cost per unit">
                          Box/Carton
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.carton_cost === 0 ? '' : item.carton_cost}
                          onChange={(e) => updateLineItem(idx, 'carton_cost', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5 truncate" title="Filling, induction sealing & bottling labour">
                          Labour Cost
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.labour_cost === 0 ? '' : item.labour_cost}
                          onChange={(e) => updateLineItem(idx, 'labour_cost', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Cost Summary & Final Quoted Price Row */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      {/* Left: Total Unit Cost (Sum) */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Total Unit Cost:</span>
                        <span className="font-mono font-bold text-white text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          {formatPKR(item.total_cost_per_unit)}
                        </span>
                      </div>

                      {/* Right: Quoted Price Per Unit & Profit Margin */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] uppercase font-bold text-emerald-400">
                            Quoted Price Per Unit *:
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">Rs</span>
                            <input
                              type="number"
                              required
                              min="0"
                              step="any"
                              value={item.quoted_price_per_unit === 0 ? '' : item.quoted_price_per_unit}
                              onChange={(e) => updateLineItem(idx, 'quoted_price_per_unit', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-28 bg-slate-900 border border-emerald-500/50 rounded-lg pl-7 pr-2 py-1 text-xs text-right font-mono font-black text-emerald-400 focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Internal Margin Display */}
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          <span className="text-slate-500">Net Profit:</span>
                          <span className={`font-bold ${margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPKR(margin)} ({marginPct}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: ADDITIONAL QUOTATION PARAMETERS                                */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                3. Commercial Terms & Quality Specifications
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Minimum Order Quantity (MOQ)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1,000 Units per SKU"
                  value={moq}
                  onChange={(e) => setMoq(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Repeat Order MOQ
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 Units"
                  value={repeatOrderMoq}
                  onChange={(e) => setRepeatOrderMoq(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Delivery / Freight Charges
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ex-Factory Lahore / Freight at actual"
                  value={deliveryCharges}
                  onChange={(e) => setDeliveryCharges(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Sample Cost
                </label>
                <input
                  type="text"
                  placeholder="e.g. PKR 2,500 (Refundable upon order)"
                  value={sampleCost}
                  onChange={(e) => setSampleCost(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Sample Lead Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3-5 Working Days"
                  value={sampleLeadTime}
                  onChange={(e) => setSampleLeadTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Available Fragrances
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lemon, Ocean Breeze, Strawberry, Jasmine"
                  value={availableFragrances}
                  onChange={(e) => setAvailableFragrances(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Formula Specifications & Batch Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Formula Specifications & Quality Standards
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. pH balanced 6.5–7.5, high foam active matter > 14%, biodegradable surfactants, paint & clearcoat safe."
                  value={formulaSpecifications}
                  onChange={(e) => setFormulaSpecifications(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-purple-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Batch / MFG / Expiry Info
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. 24 Months shelf life from MFG Date. Batch code and MFG/EXP laser-printed on each bottle & master box."
                  value={batchMfgExpiryInfo}
                  onChange={(e) => setBatchMfgExpiryInfo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-purple-500 focus:outline-none leading-relaxed"
                />
              </div>
            </div>

            {/* General Terms & Conditions */}
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                Payment Terms & Conditions
              </label>
              <textarea
                rows={2}
                placeholder="Payment terms, delivery schedules, deposit requirements..."
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-purple-500 focus:outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: PRIVATE INTERNAL NOTES                                         */}
          {/* ========================================================================= */}
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs">
            <label className="text-[11px] text-slate-400 font-semibold block mb-1">
              Private Internal Notes (Kept secret - not printed on customer PDF)
            </label>
            <input
              type="text"
              placeholder="e.g. Client mentioned they can increase to 2,500 units if we discount PKR 5 per bottle on next run."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving Quotation...' : 'Save & View Quotation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
