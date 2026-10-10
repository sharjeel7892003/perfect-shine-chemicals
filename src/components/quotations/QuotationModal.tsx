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
  Sparkles,
  Info,
  CheckCircle2,
  Boxes
} from 'lucide-react';
import { Quotation, QuotationLineItem, QuotationStatus, QuotationType } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatPKR, formatBoxBreakdown } from '../../utils/formatters';

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
  const { customers, saveQuotation, quotations, products } = useApp();

  // Quotation Type: 'private_label' vs 'standard_unit_price'
  const [quotationType, setQuotationType] = useState<QuotationType>('private_label');

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

  // Product Line Items
  const [items, setItems] = useState<QuotationLineItem[]>([
    {
      id: 'item-1',
      product_name: '',
      size: '',
      product_cost: 0,
      bottle_cost: 0,
      cap_cost: 0,
      label_cost: 0,
      labour_cost: 0,
      carton_cost: 0,
      total_cost_per_unit: 0,
      quoted_price_per_unit: 0,
      bottles_per_box: 0,
      unit_rate: 0,
      box_rate: 0,
      quantity_bottles: 0,
      quantity_boxes: 0,
      line_total: 0,
      moq: '',
      notes: ''
    }
  ]);

  // Additional Quotation Fields (Private Label Defaults)
  const [moq, setMoq] = useState<string>('');
  const [repeatOrderMoq, setRepeatOrderMoq] = useState<string>('');
  const [sampleCost, setSampleCost] = useState<string>('PKR 2,500 (100% Refundable against confirmed bulk order)');
  const [sampleLeadTime, setSampleLeadTime] = useState<string>('3-5 Working Days');
  const [deliveryCharges, setDeliveryCharges] = useState<string>('Ex-Factory Lahore / Freight at actual to destination');
  const [availableFragrances, setAvailableFragrances] = useState<string>('Lemon Fresh, Ocean Breeze, Wild Strawberry, Royal Jasmine, Lavender, Green Apple');
  const [formulaSpecifications, setFormulaSpecifications] = useState<string>('Industrial-grade pH balanced 6.5–7.5, high-foaming biodegradable surfactants, paint & clearcoat safe, anti-swirl lubricated polymers.');
  const [batchMfgExpiryInfo, setBatchMfgExpiryInfo] = useState<string>('24 Months shelf life from Manufacturing Date. Unique batch code and laser-printed MFG/EXP dates on each bottle & master carton.');
  const [termsConditions, setTermsConditions] = useState<string>('• 50% advance payment upon sample approval & order confirmation, 50% prior to dispatch.\n• Lead time for initial private label run: 10–14 working days from artwork finalization.\n• Quotation rates are valid for 15 days from issue date.');
  const [notes, setNotes] = useState<string>('');

  // Standard Unit Price Optional Terms State
  const [includeSamplePolicy, setIncludeSamplePolicy] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    if (initialQuotation) {
      setQuotationType(initialQuotation.quotation_type || 'private_label');
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
      setItems(initialQuotation.items && initialQuotation.items.length > 0 ? initialQuotation.items.map(it => {
        const bpb = Number(it.bottles_per_box || 0);
        const ur = Number(it.unit_rate !== undefined ? it.unit_rate : (it.quoted_price_per_unit || 0));
        const br = bpb > 0 ? Number((bpb * ur).toFixed(2)) : Number(it.box_rate || 0);
        const qBottles = Number(it.quantity_bottles || 0);
        const qBoxes = bpb > 0 ? Number((qBottles / bpb).toFixed(2)) : Number(it.quantity_boxes || 0);
        const lt = Number(it.line_total || (qBottles * ur).toFixed(2));
        return {
          ...it,
          bottles_per_box: bpb,
          unit_rate: ur,
          box_rate: br,
          quantity_bottles: qBottles,
          quantity_boxes: qBoxes,
          line_total: lt,
          moq: it.moq || ''
        };
      }) : [
        {
          id: 'item-1',
          product_name: '',
          size: '',
          product_cost: 0,
          bottle_cost: 0,
          cap_cost: 0,
          label_cost: 0,
          labour_cost: 0,
          carton_cost: 0,
          total_cost_per_unit: 0,
          quoted_price_per_unit: 0,
          bottles_per_box: 0,
          unit_rate: 0,
          box_rate: 0,
          quantity_bottles: 0,
          quantity_boxes: 0,
          line_total: 0,
          moq: '',
          notes: ''
        }
      ]);
      setMoq(initialQuotation.moq || '');
      setRepeatOrderMoq(initialQuotation.repeat_order_moq || '');
      setSampleCost(initialQuotation.sample_cost || '');
      setIncludeSamplePolicy(Boolean(initialQuotation.sample_cost && initialQuotation.sample_cost.trim().length > 0));
      setSampleLeadTime(initialQuotation.sample_lead_time || '');
      setDeliveryCharges(initialQuotation.delivery_charges || '');
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
      setQuotationType('private_label');
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
          product_name: '',
          size: '',
          product_cost: 0,
          bottle_cost: 0,
          cap_cost: 0,
          label_cost: 0,
          labour_cost: 0,
          carton_cost: 0,
          total_cost_per_unit: 0,
          quoted_price_per_unit: 0,
          bottles_per_box: 0,
          unit_rate: 0,
          box_rate: 0,
          quantity_bottles: 0,
          quantity_boxes: 0,
          line_total: 0,
          moq: '',
          notes: ''
        }
      ]);
      setMoq('');
      setRepeatOrderMoq('');
      setSampleCost('PKR 2,500 (100% Refundable against confirmed bulk order)');
      setIncludeSamplePolicy(false);
      setSampleLeadTime('3-5 Working Days');
      setDeliveryCharges('Ex-Factory Lahore / Freight at actual to destination');
      setAvailableFragrances('Lemon Fresh, Ocean Breeze, Wild Strawberry, Royal Jasmine, Lavender, Green Apple');
      setFormulaSpecifications('Industrial-grade pH balanced 6.5–7.5, high-foaming biodegradable surfactants, paint & clearcoat safe, anti-swirl lubricated polymers.');
      setBatchMfgExpiryInfo('24 Months shelf life from Manufacturing Date. Unique batch code and laser-printed MFG/EXP dates on each bottle & master carton.');
      setTermsConditions('• 50% advance payment upon sample approval & order confirmation, 50% prior to dispatch.\n• Lead time for initial private label run: 10–14 working days from artwork finalization.\n• Quotation rates are valid for 15 days from issue date.');
      setNotes('');
    }
  }, [initialQuotation, isOpen]);

  // Handle switching quotation types
  const handleTypeSwitch = (newType: QuotationType) => {
    if (newType === quotationType) return;
    setQuotationType(newType);

    if (newType === 'standard_unit_price') {
      // Clear terms to clean optional defaults if they had private-label text
      if (!initialQuotation) {
        setSampleCost('');
        setIncludeSamplePolicy(false);
        setDeliveryCharges('Ex-Factory Lahore / Freight at actual to destination');
        setTermsConditions('• Payment terms as agreed prior to dispatch.\n• Quotation rates are valid for 15 days from issue date.');
      }
    } else {
      // Switched back to private label
      if (!initialQuotation) {
        setSampleCost('PKR 2,500 (100% Refundable against confirmed bulk order)');
        setTermsConditions('• 50% advance payment upon sample approval & order confirmation, 50% prior to dispatch.\n• Lead time for initial private label run: 10–14 working days from artwork finalization.\n• Quotation rates are valid for 15 days from issue date.');
      }
    }
  };

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

  // Private Label Line item manipulation
  const updateLineItem = (index: number, field: keyof QuotationLineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Auto-sum the cost breakdown items into total_cost_per_unit
      const pCost = Number(item.product_cost || 0);
      const bCost = Number(item.bottle_cost || 0);
      const capCost = Number(item.cap_cost || 0);
      const lCost = Number(item.label_cost || 0);
      const labCost = Number(item.labour_cost || 0);
      const cCost = Number(item.carton_cost || 0);
      const sum = Number((pCost + bCost + capCost + lCost + labCost + cCost).toFixed(2));
      item.total_cost_per_unit = sum;

      if (field !== 'quoted_price_per_unit' && (!item.quoted_price_per_unit || item.quoted_price_per_unit === updated[index].total_cost_per_unit)) {
        item.quoted_price_per_unit = sum;
      }

      updated[index] = item;
      return updated;
    });
  };

  // Standard Unit Price Line item manipulation
  const updateStandardLineItem = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'product_name') {
        item.product_name = value;
        // If product matches an existing product and size is empty, suggest default pack size
        const matched = products.find(p => p.name.trim().toLowerCase() === String(value).trim().toLowerCase());
        if (matched && !item.size && matched.pack_sizes && matched.pack_sizes.length > 0) {
          item.size = matched.pack_sizes[0].name;
        }
      } else if (field === 'size') {
        item.size = value;
      } else if (field === 'bottles_per_box') {
        const bpb = Number(value) || 0;
        item.bottles_per_box = bpb;
        const rate = Number(item.unit_rate !== undefined ? item.unit_rate : (item.quoted_price_per_unit || 0));
        item.box_rate = bpb > 0 ? Number((bpb * rate).toFixed(2)) : 0;
        if (bpb > 0 && item.quantity_bottles) {
          item.quantity_boxes = Number((item.quantity_bottles / bpb).toFixed(2));
        }
      } else if (field === 'unit_rate') {
        const rate = parseFloat(value) || 0;
        item.unit_rate = rate;
        item.quoted_price_per_unit = rate;
        item.total_cost_per_unit = rate;
        const bpb = Number(item.bottles_per_box || 0);
        item.box_rate = bpb > 0 ? Number((bpb * rate).toFixed(2)) : 0;
        const qBottles = Number(item.quantity_bottles || 0);
        item.line_total = Number((qBottles * rate).toFixed(2));
      } else if (field === 'quantity_bottles') {
        const btls = Number(value) || 0;
        item.quantity_bottles = btls;
        const bpb = Number(item.bottles_per_box || 0);
        if (bpb > 0) {
          item.quantity_boxes = Number((btls / bpb).toFixed(2));
        }
        const rate = Number(item.unit_rate !== undefined ? item.unit_rate : (item.quoted_price_per_unit || 0));
        item.line_total = Number((btls * rate).toFixed(2));
      } else if (field === 'quantity_boxes') {
        const bxs = Number(value) || 0;
        item.quantity_boxes = bxs;
        const bpb = Number(item.bottles_per_box || 0);
        if (bpb > 0) {
          item.quantity_bottles = Math.round(bxs * bpb);
        }
        const rate = Number(item.unit_rate !== undefined ? item.unit_rate : (item.quoted_price_per_unit || 0));
        item.line_total = Number(((item.quantity_bottles || 0) * rate).toFixed(2));
      } else if (field === 'moq') {
        item.moq = value;
      } else if (field === 'notes') {
        item.notes = value;
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
        size: '',
        product_cost: 0,
        bottle_cost: 0,
        cap_cost: 0,
        label_cost: 0,
        labour_cost: 0,
        carton_cost: 0,
        total_cost_per_unit: 0,
        quoted_price_per_unit: 0,
        bottles_per_box: 0,
        unit_rate: 0,
        box_rate: 0,
        quantity_bottles: 0,
        quantity_boxes: 0,
        line_total: 0,
        moq: '',
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

  // Grand total for Standard Unit Price mode
  const grandTotalStandard = items.reduce((sum, it) => {
    const rate = Number(it.unit_rate !== undefined ? it.unit_rate : (it.quoted_price_per_unit || 0));
    const qty = Number(it.quantity_bottles || 0);
    return sum + (it.line_total !== undefined ? Number(it.line_total) : (qty * rate));
  }, 0);

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
      const isStandard = quotationType === 'standard_unit_price';

      const saved = await saveQuotation({
        id: initialQuotation?.id,
        quotation_number: quotationNumber,
        quotation_type: quotationType,
        customer_id: customerMode === 'existing' && selectedCustomerId ? selectedCustomerId : undefined,
        customer_name: customerName.trim(),
        company_name: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        date,
        validity_period: validityPeriod,
        status,
        items,
        moq: moq.trim() || undefined,
        repeat_order_moq: !isStandard ? (repeatOrderMoq.trim() || undefined) : undefined,
        sample_cost: isStandard 
          ? (includeSamplePolicy && sampleCost.trim() ? sampleCost.trim() : undefined)
          : (sampleCost.trim() || undefined),
        sample_lead_time: !isStandard ? (sampleLeadTime.trim() || undefined) : undefined,
        delivery_charges: deliveryCharges.trim() || undefined,
        available_fragrances: !isStandard ? (availableFragrances.trim() || undefined) : undefined,
        formula_specifications: !isStandard ? (formulaSpecifications.trim() || undefined) : undefined,
        batch_mfg_expiry_info: !isStandard ? (batchMfgExpiryInfo.trim() || undefined) : undefined,
        terms_conditions: termsConditions.trim() || undefined,
        notes: notes.trim() || undefined,
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
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              quotationType === 'standard_unit_price'
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  {initialQuotation ? `Edit Quotation #${initialQuotation.quotation_number}` : 'Create Price Quotation'}
                </h2>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  quotationType === 'standard_unit_price'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                }`}>
                  {quotationType === 'standard_unit_price' ? 'Standard Unit Price' : 'Private Label'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {quotationType === 'standard_unit_price' 
                  ? 'Simple direct rate quotation with bottles per box, box rate & quantities' 
                  : 'Standalone private label proposal with complete cost component breakdown'}
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
          {/* QUOTATION TYPE SELECTOR (Private Label vs Standard Unit Price)            */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Select Quotation Format:
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Choose the format suited for this client</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Private Label */}
              <button
                type="button"
                onClick={() => handleTypeSwitch('private_label')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  quotationType === 'private_label'
                    ? 'bg-purple-950/30 border-purple-500 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-400" />
                    Private Label Quotation
                  </span>
                  {quotationType === 'private_label' ? (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500 text-slate-950">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-semibold">Switch</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Full cost breakdown per unit: liquid formula, bottle container, cap/pump, label, labour & carton packing.
                </p>
              </button>

              {/* Option 2: Standard Unit Price */}
              <button
                type="button"
                onClick={() => handleTypeSwitch('standard_unit_price')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  quotationType === 'standard_unit_price'
                    ? 'bg-cyan-950/30 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-cyan-400" />
                    Standard Unit Price Quotation
                  </span>
                  {quotationType === 'standard_unit_price' ? (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500 text-slate-950">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-semibold">Switch</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Simple direct unit rates: pack size, bottles per box, unit rate (PKR), dual bottle/box quantities & auto totals.
                </p>
              </button>
            </div>
          </div>

          {/* Datalist for Product Suggestions (Allows Free Text OR Pick from Products) */}
          <datalist id="quotation-product-suggestions">
            {products.map(p => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>

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
          {/* SECTION 2: LINE ITEMS                                                     */}
          {/* ========================================================================= */}
          {quotationType === 'standard_unit_price' ? (
            /* ======================================================================= */
            /* 2A. STANDARD UNIT PRICE LINE ITEMS (NO BOM BREAKDOWN)                   */
            /* ======================================================================= */
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      2. Product Rates & Quantities (Standard Unit Price)
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pick a product or type free text. Enter bottles/box, unit rate, and quantity (in bottles or boxes). Automatic box rates & totals.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addLineItem}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {/* Standard Line Items List */}
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const bpb = Number(item.bottles_per_box || 0);
                  const ur = Number(item.unit_rate !== undefined ? item.unit_rate : (item.quoted_price_per_unit || 0));
                  const boxRate = bpb > 0 ? Number((bpb * ur).toFixed(2)) : 0;
                  const qBottles = Number(item.quantity_bottles || 0);
                  const lineTotal = Number(item.line_total !== undefined ? item.line_total : (qBottles * ur).toFixed(2));
                  const breakdownText = formatBoxBreakdown(qBottles, bpb);

                  return (
                    <div 
                      key={item.id || idx}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          
                          {/* Product Name (Free text OR pick from suggestions) */}
                          <div className="sm:col-span-4">
                            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                              Product Name #{idx + 1} * <span className="text-slate-500">(Pick or type free text)</span>
                            </label>
                            <input
                              type="text"
                              required
                              list="quotation-product-suggestions"
                              placeholder="e.g. Phenyl / Glass Cleaner"
                              value={item.product_name}
                              onChange={(e) => updateStandardLineItem(idx, 'product_name', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:border-cyan-500 focus:outline-none"
                            />
                          </div>

                          {/* Pack Size / Description */}
                          <div className="sm:col-span-3">
                            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                              Pack Size / Description
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 1 Liter / 500ml / Can"
                              value={item.size || ''}
                              onChange={(e) => updateStandardLineItem(idx, 'size', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                            />
                          </div>

                          {/* Bottles per Box (Manual per line, never default) */}
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-cyan-300 font-bold block mb-0.5 truncate" title="Bottles per Box (manually entered)">
                              Bottles / Box *
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              required
                              placeholder="e.g. 6"
                              value={item.bottles_per_box === 0 ? '' : item.bottles_per_box}
                              onChange={(e) => updateStandardLineItem(idx, 'bottles_per_box', e.target.value)}
                              className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-bold text-cyan-300 focus:border-cyan-400 focus:outline-none"
                            />
                          </div>

                          {/* Unit Rate (PKR per bottle, allows decimals) */}
                          <div className="sm:col-span-3">
                            <label className="text-[10px] text-emerald-400 font-bold block mb-0.5 truncate" title="Unit Rate (PKR per bottle)">
                              Unit Rate (PKR) *
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 font-mono">Rs</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                required
                                placeholder="e.g. 110.50"
                                value={item.unit_rate === 0 ? '' : item.unit_rate}
                                onChange={(e) => updateStandardLineItem(idx, 'unit_rate', e.target.value)}
                                className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-right font-mono font-black text-emerald-400 focus:border-emerald-400 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Remove line item button */}
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0 mt-3"
                          title="Remove product line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Calculations & Quantities Row */}
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/90 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                        {/* Box Rate (Auto-calculated: Bottles per Box x Unit Rate) */}
                        <div className="sm:col-span-3 flex items-center justify-between sm:justify-start gap-2 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Box Rate:</span>
                          <span className="font-mono font-black text-cyan-300 text-xs">
                            {formatPKR(boxRate)}
                          </span>
                        </div>

                        {/* Quantity Dual Inputs: Bottles OR Boxes */}
                        <div className="sm:col-span-5 flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">
                              Quantity (Bottles):
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="e.g. 200"
                              value={item.quantity_bottles === 0 ? '' : item.quantity_bottles}
                              onChange={(e) => updateStandardLineItem(idx, 'quantity_bottles', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-white focus:border-cyan-500 focus:outline-none"
                            />
                          </div>

                          <span className="text-slate-500 font-bold pt-3.5 text-xs">OR</span>

                          <div className="flex-1">
                            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">
                              Quantity (Boxes):
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              placeholder="e.g. 33"
                              value={item.quantity_boxes === 0 ? '' : item.quantity_boxes}
                              onChange={(e) => updateStandardLineItem(idx, 'quantity_boxes', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-slate-200 focus:border-cyan-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Breakdown Display & Line Total */}
                        <div className="sm:col-span-4 flex items-center justify-between sm:justify-end gap-3">
                          {/* Clear Box & Bottle breakdown badge (e.g. "33 boxes + 2 bottles") */}
                          {qBottles > 0 && bpb > 0 && (
                            <div className="bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold text-cyan-300 whitespace-nowrap">
                              📦 {breakdownText}
                            </div>
                          )}

                          <div className="text-right">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Line Total</span>
                            <span className="font-mono font-black text-emerald-400 text-sm">
                              {formatPKR(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Optional Notes/MOQ for this SKU */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        <input
                          type="text"
                          placeholder="Optional line notes (e.g. White bottle, induction sealed)"
                          value={item.notes || ''}
                          onChange={(e) => updateStandardLineItem(idx, 'notes', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Optional SKU MOQ (e.g. 50 boxes)"
                          value={item.moq || ''}
                          onChange={(e) => updateStandardLineItem(idx, 'moq', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grand Total Summary Bar */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Boxes className="w-4 h-4 text-cyan-400" />
                  <span>Total Products: <strong>{items.length} SKU(s)</strong></span>
                  <span>•</span>
                  <span>Total Bottles: <strong>{items.reduce((s, it) => s + Number(it.quantity_bottles || 0), 0)} Bottles</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-slate-400">Grand Total:</span>
                  <span className="text-lg font-black font-mono text-emerald-400 bg-slate-950 px-3 py-1 rounded-lg border border-emerald-500/30">
                    {formatPKR(grandTotalStandard)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================================= */
            /* 2B. PRIVATE LABEL LINE ITEMS (FULL COST BREAKDOWN)                      */
            /* ======================================================================= */
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
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
                  className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
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
                      {/* Item Title, Size, MOQ & Remove Button */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          <div className="sm:col-span-5">
                            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                              Product Description / SKU #{idx + 1} *
                            </label>
                            <input
                              type="text"
                              required
                              list="quotation-product-suggestions"
                              placeholder="e.g. Ultra Foam Snow Shampoo"
                              value={item.product_name}
                              onChange={(e) => updateLineItem(idx, 'product_name', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                              Pack Size / Container
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 500ml Bottle / 1L Can"
                              value={item.size || ''}
                              onChange={(e) => updateLineItem(idx, 'size', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="text-[10px] text-emerald-400 font-bold block mb-0.5">
                              MOQ (Per SKU)
                            </label>
                            <input
                              type="text"
                              placeholder="Enter MOQ"
                              value={item.moq || ''}
                              onChange={(e) => updateLineItem(idx, 'moq', e.target.value)}
                              className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:border-emerald-400 focus:outline-none"
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
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.product_cost === 0 ? '' : item.product_cost}
                            onChange={(e) => updateLineItem(idx, 'product_cost', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-purple-500 focus:outline-none"
                          />
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
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-purple-500 focus:outline-none"
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
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-purple-500 focus:outline-none"
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
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-purple-500 focus:outline-none"
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
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-purple-500 focus:outline-none"
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
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-semibold text-slate-200 focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Cost Summary & Final Quoted Price Row */}
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total Unit Cost:</span>
                          <span className="font-mono font-bold text-white text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            {formatPKR(item.total_cost_per_unit)}
                          </span>
                        </div>

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
          )}

          {/* ========================================================================= */}
          {/* SECTION 3: COMMERCIAL TERMS & CONDITIONS                                  */}
          {/* ========================================================================= */}
          {quotationType === 'standard_unit_price' ? (
            /* 3A. TERMS FOR STANDARD UNIT PRICE (CLEAN & OPTIONAL) */
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  3. Commercial Terms (All Optional)
                </h3>
              </div>
              <p className="text-[11px] text-slate-400">
                Leave empty anything that is not relevant. Only non-empty terms will be printed on the customer quotation.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Minimum Order Quantity (MOQ) - Optional
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50 Boxes / 500 Bottles (Leave blank if not applicable)"
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Delivery / Freight Charges - Optional
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ex-Factory Lahore / At actual (Leave blank if none)"
                    value={deliveryCharges}
                    onChange={(e) => setDeliveryCharges(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Optional Sample Policy Line */}
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold text-[11px]">
                    <input
                      type="checkbox"
                      checked={includeSamplePolicy}
                      onChange={(e) => {
                        setIncludeSamplePolicy(e.target.checked);
                        if (e.target.checked && !sampleCost) {
                          setSampleCost('PKR 2,500 (Refundable upon confirmed bulk order)');
                        }
                      }}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Include Sample Policy / Line in Terms</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Optional</span>
                </div>

                {includeSamplePolicy && (
                  <input
                    type="text"
                    placeholder="e.g. PKR 2,500 (Refundable upon order)"
                    value={sampleCost}
                    onChange={(e) => setSampleCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Payment Terms & Conditions */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Payment & Delivery Terms - Optional
                </label>
                <textarea
                  rows={2}
                  placeholder="Payment terms, delivery conditions, advance deposit requirements..."
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          ) : (
            /* 3B. TERMS FOR PRIVATE LABEL (FULL SPECIFICATIONS) */
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
                    General MOQ (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter MOQ"
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Repeat Order MOQ (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter repeat order MOQ"
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
          )}

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
              className={`px-6 py-2.5 rounded-xl text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
                quotationType === 'standard_unit_price'
                  ? 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
              }`}
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
