import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Trash2, 
  Printer, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  ArrowRight,
  Box,
  Layers,
  ChevronDown,
  AlertTriangle,
  Loader2,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Sale, SaleItem, PaymentMethod, PaymentStatus, Product, PackSize, SalesReturn } from '../../types';
import { formatPKR, formatDate, formatDateTime, getTodayDateString, formatSelectedDateToIso } from '../../utils/formatters';
import { getRateDifferenceInfo, saleHasCustomRates } from '../../utils/pricing';
import { calculateCustomerFinancials } from '../../utils/financialEngine';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { InvoiceModal } from './InvoiceModal';
import { CreditNoteModal } from './CreditNoteModal';
import { ProcessReturnModal } from './ProcessReturnModal';

export const SalesModule: React.FC = () => {
  const { products, rawMaterials, customers, sales, salesReturns, payments, createSale, deleteSaleInvoice, deleteSalesReturnRecord } = useApp();
  const { currentUser, allUsers, isOwner, canCreateSale } = useAuth();

  // Dynamically resolve staff member name by looking up salesperson_id in profiles
  const getSalespersonName = (sale: Sale) => {
    if (sale.salesperson_id) {
      const match = allUsers.find(u => u.id === sale.salesperson_id);
      if (match) return match.name;
    }
    return sale.salesperson_name || 'Staff';
  };

  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history' | 'returns'>('pos');
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<Sale | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnTargetSale, setReturnTargetSale] = useState<Sale | null>(null);
  const [selectedCreditNote, setSelectedCreditNote] = useState<SalesReturn | null>(null);
  const [deleteConfirmReturn, setDeleteConfirmReturn] = useState<SalesReturn | null>(null);
  const [returnsSearch, setReturnsSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // POS State
  const [saleDate, setSaleDate] = useState<string>(getTodayDateString());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [applyCustomerAdvance, setApplyCustomerAdvance] = useState(false);
  const [advanceAmountToApply, setAdvanceAmountToApply] = useState<number>(0);
  const [salesNotes, setSalesNotes] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [posCatalogFilter, setPosCatalogFilter] = useState<'all' | 'products' | 'raw_materials'>('all');

  // Selected pack size per product card in POS terminal
  const [selectedPackByProduct, setSelectedPackByProduct] = useState<Record<string, string>>({});

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerFinancials = selectedCustomer ? calculateCustomerFinancials(selectedCustomer, sales, payments, salesReturns) : null;
  const availableAdvance = customerFinancials ? customerFinancials.advanceBalance : 0;

  // Private Label Order State
  const [isPrivateLabelOrder, setIsPrivateLabelOrder] = useState<boolean>(false);
  const [clientBrandName, setClientBrandName] = useState<string>('');
  const [labourRatePerBottle, setLabourRatePerBottle] = useState<number>(3.5);

  const isPrivateLabelSale = isPrivateLabelOrder || cartItems.some(i => i.is_private_label);
  const totalBottles = isPrivateLabelSale 
    ? cartItems.reduce((acc, item) => acc + (item.bottle_qty !== undefined ? item.bottle_qty : (item.quantity || 0)), 0)
    : 0;
  const labourAmount = isPrivateLabelSale
    ? Number((totalBottles * labourRatePerBottle).toFixed(2))
    : 0;
  const productsSubtotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  const subtotal = isPrivateLabelSale 
    ? Number((productsSubtotal + labourAmount).toFixed(2))
    : productsSubtotal;
  const totalAmount = Math.max(0, subtotal - discountAmount);

  // Sync amount paid when payment status is full paid
  React.useEffect(() => {
    if (paymentStatus === 'paid') {
      setAmountPaid(totalAmount);
    }
  }, [totalAmount, paymentStatus]);

  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status === 'paid') {
      setAmountPaid(totalAmount);
    } else if (status === 'unpaid' || status === 'credit') {
      setAmountPaid(0);
    }
  };

  const getSelectedPackForProduct = (product: Product): {
    packId: string;
    packName: string;
    multiplier: number;
    price: number;
    unitLabel: string;
    isPackedSize: boolean;
    packedStock: number;
    trueCost: number;
    bottlesPerBox: number;
  } => {
    const baseUnit = product.base_unit || product.unit || 'liter';
    const packs = product.pack_sizes && product.pack_sizes.length > 0 ? product.pack_sizes : [];
    const chosenId = selectedPackByProduct[product.id];

    if (chosenId === 'bulk' || (!chosenId && packs.length === 0)) {
      return {
        packId: 'bulk',
        packName: `Bulk / Loose (${baseUnit})`,
        multiplier: 1.0,
        price: product.selling_price,
        unitLabel: baseUnit,
        isPackedSize: false,
        packedStock: 0,
        trueCost: product.cost_price,
        bottlesPerBox: 1,
      };
    }

    const matched = packs.find(p => p.id === chosenId) || packs.find(p => p.is_default) || packs[0];
    if (matched) {
      const isPacked = matched.id !== 'bulk';
      const chemicalPortion = Number(((matched.size_in_base_unit || 1) * Number(product.cost_price || 0)).toFixed(4));
      const packagingPortion = Number(
        (matched.packaging_items || []).reduce((sum, item) => {
          const rm = rawMaterials.find(r => r.id === item.raw_material_id);
          const rate = rm ? Number(rm.cost_per_unit || 0) : Number(item.cost_per_unit || 0);
          return sum + (Number(item.quantity || 0) * rate);
        }, 0).toFixed(4)
      );
      const computedTrueCost = Number((chemicalPortion + packagingPortion).toFixed(4));
      const effectiveTrueCost = matched.true_cost && matched.true_cost > 0 ? Number(matched.true_cost) : computedTrueCost;
      const bPerBox = matched.bottles_per_box !== undefined ? Number(matched.bottles_per_box) : (matched.size_in_base_unit <= 0.35 ? 24 : 12);

      return {
        packId: matched.id,
        packName: matched.name,
        multiplier: matched.size_in_base_unit,
        price: matched.selling_price,
        unitLabel: matched.unit_label,
        isPackedSize: isPacked,
        packedStock: Number(matched.packed_stock || 0),
        trueCost: effectiveTrueCost,
        bottlesPerBox: bPerBox,
      };
    }

    return {
      packId: 'bulk',
      packName: `Bulk / Loose (${baseUnit})`,
      multiplier: 1.0,
      price: product.selling_price,
      unitLabel: baseUnit,
      isPackedSize: false,
      packedStock: 0,
      trueCost: product.cost_price,
      bottlesPerBox: 1,
    };
  };

  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const isProductPL = Boolean(product.is_private_label) || product.category === 'Private Label';
    const isPL = isProductPL || isPrivateLabelOrder;

    if (isProductPL && !isPrivateLabelOrder) {
      setIsPrivateLabelOrder(true);
      if (product.client_brand_name && !clientBrandName) {
        setClientBrandName(product.client_brand_name);
      }
      if (product.default_labour_rate) {
        setLabourRatePerBottle(product.default_labour_rate);
      }
    }

    const packInfo = getSelectedPackForProduct(product);

    if (packInfo.isPackedSize) {
      // Validate packed bottle stock!
      const availablePacked = packInfo.packedStock;
      if (availablePacked <= 0) {
        const proceed = confirm(`Warning: ${product.name} (${packInfo.packName}) currently has 0 packed stock in inventory. Proceed with adding to order?`);
        if (!proceed) return;
      }
    } else {
      // Validate bulk liquid stock!
      const baseStock = Number(product.current_stock);
      if (baseStock <= 0) {
        const proceed = confirm(`Warning: ${product.name} currently has 0 bulk stock in warehouse. Proceed with adding to order?`);
        if (!proceed) return;
      }
    }

    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.product_id === productId && (item.pack_size_id === packInfo.packId || (!item.pack_size_id && packInfo.packId === 'bulk')));

      if (existingIdx !== -1) {
        const currentItem = prev[existingIdx];
        if (isPL) {
          const nextBoxes = (currentItem.box_qty || 1) + 1;
          const bPerBox = currentItem.bottles_per_box || packInfo.bottlesPerBox || 24;
          const bottleSize = currentItem.size_in_base_unit || packInfo.multiplier;
          const nextBottles = Math.round(nextBoxes * bPerBox);
          const nextLiters = Number((nextBottles * bottleSize).toFixed(2));
          const rateL = currentItem.rate_per_liter || (product.selling_price > 0 ? product.selling_price : 170);
          const nextSubtotal = Number((nextLiters * rateL).toFixed(2));
          const nextUnitPrice = nextBottles > 0 ? Number((nextSubtotal / nextBottles).toFixed(4)) : 0;

          const updated = [...prev];
          updated[existingIdx] = {
            ...currentItem,
            box_qty: nextBoxes,
            bottles_per_box: bPerBox,
            bottle_qty: nextBottles,
            quantity: nextBottles,
            pack_quantity: nextBottles,
            liters_qty: nextLiters,
            base_quantity: nextLiters,
            rate_per_liter: rateL,
            unit_price: nextUnitPrice,
            subtotal: nextSubtotal,
          };
          return updated;
        } else {
          const nextPackQty = currentItem.quantity + 1;
          const updated = [...prev];
          updated[existingIdx] = {
            ...currentItem,
            quantity: nextPackQty,
            pack_quantity: nextPackQty,
            base_quantity: nextPackQty * packInfo.multiplier,
            subtotal: nextPackQty * currentItem.unit_price,
          };
          return updated;
        }
      }

      if (isPL) {
        const bPerBox = packInfo.bottlesPerBox || (packInfo.multiplier <= 0.35 ? 24 : 12);
        const initialBoxes = 1;
        const initialBottles = bPerBox;
        const initialLiters = Number((initialBottles * packInfo.multiplier).toFixed(2));
        const ratePerLiter = product.selling_price > 0 ? product.selling_price : 170;
        const initialSubtotal = Number((initialLiters * ratePerLiter).toFixed(2));

        const newItem: SaleItem = {
          product_id: product.id,
          product_name: product.name,
          unit: product.base_unit || product.unit,
          pack_size_id: packInfo.packId === 'bulk' ? undefined : packInfo.packId,
          pack_size_name: packInfo.packName,
          pack_quantity: initialBottles,
          size_in_base_unit: packInfo.multiplier,
          base_quantity: initialLiters,
          quantity: initialBottles,
          unit_cost: packInfo.trueCost,
          unit_price: initialBottles > 0 ? Number((initialSubtotal / initialBottles).toFixed(4)) : ratePerLiter,
          default_unit_price: ratePerLiter,
          subtotal: initialSubtotal,
          is_private_label: true,
          box_qty: initialBoxes,
          bottles_per_box: bPerBox,
          bottle_qty: initialBottles,
          liters_qty: initialLiters,
          rate_per_liter: ratePerLiter,
        };
        return [...prev, newItem];
      }

      const newItem: SaleItem = {
        product_id: product.id,
        product_name: product.name,
        unit: product.base_unit || product.unit,
        pack_size_id: packInfo.packId === 'bulk' ? undefined : packInfo.packId,
        pack_size_name: packInfo.packName,
        pack_quantity: 1,
        size_in_base_unit: packInfo.multiplier,
        base_quantity: packInfo.multiplier,
        quantity: 1,
        unit_cost: packInfo.trueCost,
        unit_price: packInfo.price,
        default_unit_price: packInfo.price,
        subtotal: packInfo.price,
      };

      return [...prev, newItem];
    });
  };

  const addRawMaterialToCart = (rawMaterialId: string) => {
    const rm = rawMaterials.find(r => r.id === rawMaterialId);
    if (!rm) return;

    const currentStock = Number(rm.current_stock || 0);
    if (currentStock <= 0) {
      alert(`Cannot add ${rm.name}: Out of stock in warehouse!`);
      return;
    }

    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.raw_material_id === rawMaterialId);
      const sellingPrice = Number(rm.selling_price || 0) > 0 ? Number(rm.selling_price) : Number(rm.cost_per_unit || 0);

      if (existingIdx !== -1) {
        const currentItem = prev[existingIdx];
        const nextQty = currentItem.quantity + 1;

        if (nextQty > currentStock) {
          alert(`Maximum available stock reached! Only ${currentStock} ${rm.unit} in storage.`);
          return prev;
        }

        const updated = [...prev];
        updated[existingIdx] = {
          ...currentItem,
          quantity: nextQty,
          base_quantity: nextQty,
          subtotal: nextQty * currentItem.unit_price,
        };
        return updated;
      }

      const newItem: SaleItem = {
        item_type: 'raw_material',
        raw_material_id: rm.id,
        product_name: rm.name,
        unit: rm.unit,
        base_quantity: 1,
        quantity: 1,
        unit_cost: Number(rm.cost_per_unit || 0),
        unit_price: sellingPrice,
        default_unit_price: sellingPrice,
        subtotal: sellingPrice,
      };

      return [...prev, newItem];
    });
  };

  const updateUnitPrice = (index: number, newPrice: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (!item) return prev;

      const validPrice = Math.max(0, isNaN(newPrice) ? 0 : newPrice);
      const updated = [...prev];
      updated[index] = {
        ...item,
        unit_price: validPrice,
        subtotal: item.quantity * validPrice,
      };
      return updated;
    });
  };

  const updateQuantity = (index: number, newQty: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (!item) return prev;

      if (newQty <= 0) {
        return prev.filter((_, idx) => idx !== index);
      }

      const multiplier = Number(item.size_in_base_unit || 1);
      const isPacked = Boolean(item.pack_size_id && item.pack_size_id !== 'bulk');
      const isDecimalAllowed = !isPacked;

      let baseStock = 99999;
      let unitLabel = item.unit || 'unit';
      if (item.raw_material_id) {
        const rm = rawMaterials.find(r => r.id === item.raw_material_id);
        baseStock = rm ? Number(rm.current_stock) : 99999;
        unitLabel = rm?.unit || unitLabel;
        if (newQty > baseStock) {
          alert(`Only ${baseStock} ${unitLabel} available in warehouse.`);
          newQty = baseStock;
        }
      } else {
        const product = products.find(p => p.id === item.product_id);
        const matchedPack = isPacked ? product?.pack_sizes?.find(ps => ps.id === item.pack_size_id) : undefined;

        if (isPacked && matchedPack) {
          baseStock = Number(matchedPack.packed_stock || 0);
          unitLabel = matchedPack.unit_label || 'bottles';
          if (newQty > baseStock) {
            alert(`Only ${baseStock} ${unitLabel} available in packed stock.`);
            newQty = baseStock;
          }
        } else {
          baseStock = product ? Number(product.current_stock) : 99999;
          unitLabel = product?.base_unit || product?.unit || unitLabel;
          const totalBaseNeeded = Number((newQty * multiplier).toFixed(4));
          if (totalBaseNeeded > baseStock) {
            alert(`Only ${baseStock} ${unitLabel} available in warehouse.`);
            newQty = isDecimalAllowed ? Number((baseStock / multiplier).toFixed(4)) : (Math.floor(baseStock / multiplier) || 1);
          }
        }
      }

      const validQty = isDecimalAllowed ? Number(newQty.toFixed(4)) : Math.round(newQty);
      const updated = [...prev];
      updated[index] = {
        ...item,
        quantity: validQty,
        pack_quantity: item.raw_material_id ? undefined : validQty,
        base_quantity: Number((validQty * multiplier).toFixed(4)),
        subtotal: Number((validQty * item.unit_price).toFixed(2)),
      };
      return updated;
    });
  };

  // Dedicated Cross-Conversion Handlers for Private Label
  const updatePrivateLabelBottleSize = (index: number, newSizeL: number, packName?: string, packId?: string) => {
    setCartItems(prev => {
      const item = prev[index];
      if (!item) return prev;
      const safeSize = Math.max(0.001, isNaN(newSizeL) ? 0.5 : newSizeL);
      const bottles = item.bottle_qty !== undefined ? item.bottle_qty : item.quantity;
      const liters = Number((bottles * safeSize).toFixed(2));
      const rateL = item.rate_per_liter !== undefined ? item.rate_per_liter : 170;
      const subtotal = Number((liters * rateL).toFixed(2));
      const unitPrice = bottles > 0 ? Number((subtotal / bottles).toFixed(4)) : 0;

      const updated = [...prev];
      updated[index] = {
        ...item,
        is_private_label: true,
        pack_size_id: packId !== undefined ? packId : item.pack_size_id,
        pack_size_name: packName !== undefined ? packName : item.pack_size_name,
        size_in_base_unit: safeSize,
        bottle_qty: bottles,
        quantity: bottles,
        pack_quantity: bottles,
        liters_qty: liters,
        base_quantity: liters,
        rate_per_liter: rateL,
        unit_price: unitPrice,
        subtotal
      };
      return updated;
    });
  };

  const updatePrivateLabelBottlesPerBox = (index: number, newBPerBox: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (!item) return prev;
      const safeBPerBox = Math.max(0, isNaN(newBPerBox) ? 0 : newBPerBox);
      const boxes = item.box_qty !== undefined ? item.box_qty : 0;
      const bottleSize = item.size_in_base_unit || 1;
      const bottles = Math.round(boxes * safeBPerBox);
      const liters = Number((bottles * bottleSize).toFixed(2));
      const rateL = item.rate_per_liter !== undefined ? item.rate_per_liter : 170;
      const subtotal = Number((liters * rateL).toFixed(2));
      const unitPrice = bottles > 0 ? Number((subtotal / bottles).toFixed(4)) : 0;

      const updated = [...prev];
      updated[index] = {
        ...item,
        is_private_label: true,
        bottles_per_box: safeBPerBox,
        box_qty: boxes,
        bottle_qty: bottles,
        quantity: bottles,
        pack_quantity: bottles,
        liters_qty: liters,
        base_quantity: liters,
        rate_per_liter: rateL,
        unit_price: unitPrice,
        subtotal
      };
      return updated;
    });
  };

  const updatePrivateLabelBoxes = (index: number, newBoxes: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (!item) return prev;
      const safeBoxes = Math.max(0, isNaN(newBoxes) ? 0 : newBoxes);
      const bPerBox = item.bottles_per_box !== undefined ? item.bottles_per_box : 0;
      const bottleSize = item.size_in_base_unit || 1;
      const bottles = Math.round(safeBoxes * bPerBox);
      const liters = Number((bottles * bottleSize).toFixed(2));
      const rateL = item.rate_per_liter !== undefined ? item.rate_per_liter : 170;
      const subtotal = Number((liters * rateL).toFixed(2));
      const unitPrice = bottles > 0 ? Number((subtotal / bottles).toFixed(4)) : 0;

      const updated = [...prev];
      updated[index] = {
        ...item,
        is_private_label: true,
        box_qty: safeBoxes,
        bottle_qty: bottles,
        quantity: bottles,
        pack_quantity: bottles,
        liters_qty: liters,
        base_quantity: liters,
        rate_per_liter: rateL,
        unit_price: unitPrice,
        subtotal
      };
      return updated;
    });
  };

  const updatePrivateLabelBottles = (index: number, newBottles: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (!item) return prev;
      const safeBottles = Math.max(0, isNaN(newBottles) ? 0 : newBottles);
      const bPerBox = item.bottles_per_box !== undefined ? item.bottles_per_box : 0;
      const bottleSize = item.size_in_base_unit || 1;
      const boxes = bPerBox > 0 ? Number((safeBottles / bPerBox).toFixed(2)) : (item.box_qty || 0);
      const liters = Number((safeBottles * bottleSize).toFixed(2));
      const rateL = item.rate_per_liter !== undefined ? item.rate_per_liter : 170;
      const subtotal = Number((liters * rateL).toFixed(2));
      const unitPrice = safeBottles > 0 ? Number((subtotal / safeBottles).toFixed(4)) : 0;

      const updated = [...prev];
      updated[index] = {
        ...item,
        is_private_label: true,
        box_qty: boxes,
        bottle_qty: safeBottles,
        quantity: safeBottles,
        pack_quantity: safeBottles,
        liters_qty: liters,
        base_quantity: liters,
        rate_per_liter: rateL,
        unit_price: unitPrice,
        subtotal
      };
      return updated;
    });
  };

  const updatePrivateLabelRatePerLiter = (index: number, newRate: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (!item) return prev;
      const safeRate = Math.max(0, isNaN(newRate) ? 0 : newRate);
      const liters = item.liters_qty !== undefined ? item.liters_qty : (item.base_quantity || 0);
      const bottles = item.bottle_qty !== undefined ? item.bottle_qty : item.quantity;
      const subtotal = Number((liters * safeRate).toFixed(2));
      const unitPrice = bottles > 0 ? Number((subtotal / bottles).toFixed(4)) : 0;

      const updated = [...prev];
      updated[index] = {
        ...item,
        is_private_label: true,
        rate_per_liter: safeRate,
        unit_price: unitPrice,
        subtotal
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    setCartItems([]);
    setDiscountAmount(0);
    setAmountPaid(0);
    setApplyCustomerAdvance(false);
    setAdvanceAmountToApply(0);
    setSelectedCustomerId('');
    setSalesNotes('');
    setSaleDate(getTodayDateString());
    setIsPrivateLabelOrder(false);
    setClientBrandName('');
    setLabourRatePerBottle(3.5);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      alert('Please add products to the invoice before checkout.');
      return;
    }

    const customerName = selectedCustomer ? selectedCustomer.name : 'Counter Walk-in Retail';
    const advanceApplied = (applyCustomerAdvance && availableAdvance > 0)
      ? Math.min(advanceAmountToApply > 0 ? advanceAmountToApply : availableAdvance, availableAdvance, totalAmount)
      : 0;

    let finalAmountPaid = paymentStatus === 'paid' ? totalAmount : amountPaid;
    if (advanceApplied > 0 && finalAmountPaid < advanceApplied) {
      finalAmountPaid = advanceApplied;
    }

    const finalPaymentMethod: PaymentMethod = 
      (advanceApplied >= totalAmount && totalAmount > 0)
        ? 'advance'
        : paymentMethod;

    const isPLSale = isPrivateLabelSale || cartItems.some(i => i.is_private_label);
    const effectiveClientBrand = clientBrandName || (selectedCustomer ? selectedCustomer.name : 'Private Label Client');

    // Look up advance payment date if advance is applied
    let advanceDate: string | undefined = undefined;
    if (advanceApplied > 0 && selectedCustomerId) {
      const advPayment = payments
        .filter(p => p.customer_id === selectedCustomerId && (p.related_to === 'customer_advance' || (p.notes && p.notes.includes('[Customer Advance]'))))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (advPayment) {
        advanceDate = advPayment.date;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const newSale = await createSale({
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName,
        date: formatSelectedDateToIso(saleDate),
        items: cartItems.map(item => ({
          ...item,
          is_private_label: isPLSale ? true : item.is_private_label,
          box_qty: item.box_qty,
          bottles_per_box: item.bottles_per_box,
          bottle_qty: item.bottle_qty || item.quantity,
          liters_qty: item.liters_qty || item.base_quantity,
          rate_per_liter: item.rate_per_liter || item.unit_price,
        })),
        subtotal,
        discount: discountAmount,
        tax: 0,
        total_amount: totalAmount,
        amount_paid: finalAmountPaid,
        advance_amount_applied: advanceApplied,
        advance_received_date: advanceDate,
        payment_status: paymentStatus,
        payment_method: finalPaymentMethod,
        salesperson_id: currentUser.id,
        notes: salesNotes,
        invoice_type: isPLSale ? 'private_label' : 'standard',
        is_private_label: isPLSale,
        client_brand_name: isPLSale ? effectiveClientBrand : undefined,
        labour_rate_per_bottle: isPLSale ? labourRatePerBottle : undefined,
        labour_bottle_qty: isPLSale ? totalBottles : undefined,
        labour_total_amount: isPLSale ? labourAmount : undefined,
      });

      clearCart();
      setSelectedInvoice(newSale);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to complete sale. Please check your connection.');
      alert(err?.message || 'Failed to complete sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteSale = async () => {
    if (!deleteConfirmSale) return;
    setIsDeleting(true);
    try {
      const res = await deleteSaleInvoice(deleteConfirmSale.id, currentUser);
      alert(res.message);
      setDeleteConfirmSale(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete sale invoice');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteReturn = async () => {
    if (!deleteConfirmReturn) return;
    setIsDeleting(true);
    try {
      const res = await deleteSalesReturnRecord(deleteConfirmReturn.id, currentUser || { id: 'admin', name: 'Admin', role: 'owner' } as any);
      alert(res.message);
      setDeleteConfirmReturn(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to reverse sales return');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter products in POS (Only active & non-archived)
  const filteredProducts = products.filter(p =>
    p.is_active && !p.is_archived &&
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  // Filter sales history
  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.invoice_number.toLowerCase().includes(historySearch.toLowerCase()) ||
      s.customer_name.toLowerCase().includes(historySearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-400" />
            <span>Sales Dispatch & POS Terminal</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sell by bottle/can pack sizes or wholesale bulk, auto-converting to single base-unit inventory
          </p>
        </div>

        {/* Tab Switcher & Quick Process Return Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setReturnTargetSale(null);
              setIsReturnModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all active:scale-95"
            title="Record Sales Return & Issue Credit Note"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Process Return</span>
          </button>

          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveSubTab('pos')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'pos'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              New POS Billing
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'history'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Invoices ({sales.length})
            </button>
            <button
              onClick={() => setActiveSubTab('returns')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'returns'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Returns & Credit Notes</span>
              {salesReturns.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                  activeSubTab === 'returns' ? 'bg-rose-700 text-white' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {salesReturns.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'pos' ? (
        /* =================== POS TERMINAL VIEW =================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Columns: Product & Sellable Raw Materials Selection Grid */}
          <div className="lg:col-span-7 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search chemical products, SKUs, or resale raw materials..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Filter Tabs between Finished Goods and Sellable Raw Materials */}
            {(() => {
              const sellableRMs = rawMaterials.filter(rm =>
                Boolean(rm.is_sellable) &&
                !rm.is_archived &&
                rm.is_active !== false &&
                (!productSearch.trim() ||
                  rm.name.toLowerCase().includes(productSearch.toLowerCase().trim()) ||
                  (rm.category && rm.category.toLowerCase().includes(productSearch.toLowerCase().trim())))
              );
              return (
                <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-800 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPosCatalogFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      posCatalogFilter === 'all'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Items ({filteredProducts.length + sellableRMs.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setPosCatalogFilter('products')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      posCatalogFilter === 'products'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📦 Finished Products ({filteredProducts.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setPosCatalogFilter('raw_materials')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      posCatalogFilter === 'raw_materials'
                        ? 'bg-teal-500 text-slate-950 shadow font-bold'
                        : 'text-teal-400 hover:text-teal-300'
                    }`}
                  >
                    🧪 Raw Materials Resale ({sellableRMs.length})
                  </button>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {/* 1. Finished Products */}
              {(posCatalogFilter === 'all' || posCatalogFilter === 'products') &&
                filteredProducts.map((product) => {
                  const baseUnit = product.base_unit || product.unit || 'liter';
                  const isOutOfStock = product.current_stock <= 0;
                  const isLow = product.current_stock <= product.reorder_level;
                  const packInfo = getSelectedPackForProduct(product);
                  const packSizes = product.pack_sizes || [];

                  const defaultPack = packSizes.find(p => p.is_default) || packSizes[0];
                  const estPacksAvailable = defaultPack && defaultPack.size_in_base_unit > 0
                    ? Math.floor(product.current_stock / defaultPack.size_in_base_unit)
                    : 0;

                  return (
                    <div
                      key={`prod-${product.id}`}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        isOutOfStock
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                          : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-white text-sm leading-tight">{product.name}</h4>
                              {product.is_private_label && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ⭐ Private Label
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{product.sku}</p>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase">
                            {baseUnit}
                          </span>
                        </div>

                        <div className="mt-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">
                              {packInfo.isPackedSize ? 'Packed Stock:' : 'Bulk Liquid Stock:'}
                            </span>
                            <span className={`font-mono font-black ${
                              packInfo.isPackedSize
                                ? (packInfo.packedStock <= 0 ? 'text-rose-400' : 'text-emerald-400')
                                : (isLow ? 'text-rose-400' : 'text-white')
                            }`}>
                              {packInfo.isPackedSize 
                                ? `${packInfo.packedStock} ${packInfo.unitLabel}s`
                                : `${product.current_stock} ${baseUnit}`
                              }
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase block">True Cost:</span>
                            <span className="font-mono text-[11px] text-slate-300 font-semibold">
                              {formatPKR(packInfo.trueCost)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                            Select Packaging for Sale:
                          </label>
                          <select
                            value={selectedPackByProduct[product.id] || (defaultPack?.id || 'bulk')}
                            onChange={(e) => setSelectedPackByProduct({
                              ...selectedPackByProduct,
                              [product.id]: e.target.value,
                            })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-500"
                          >
                            {packSizes.map(pk => (
                              <option key={pk.id} value={pk.id}>
                                {pk.name} • {pk.packed_stock || 0} in stock • {formatPKR(pk.selling_price)}
                              </option>
                            ))}
                            <option value="bulk">
                              Bulk / Loose Wholesale (Per 1 {baseUnit}) • {formatPKR(product.selling_price)}
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase">Rate:</span>
                          <p className="text-base font-black font-mono text-emerald-400 leading-none mt-0.5">
                            {formatPKR(packInfo.price)}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={packInfo.isPackedSize ? packInfo.packedStock <= 0 : isOutOfStock}
                          onClick={() => addToCart(product.id)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{packInfo.isPackedSize && packInfo.packedStock <= 0 ? 'Out of Packed Stock' : 'Add to Cart'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

              {/* 2. Direct Resale Raw Materials */}
              {(posCatalogFilter === 'all' || posCatalogFilter === 'raw_materials') &&
                rawMaterials
                  .filter(rm =>
                    Boolean(rm.is_sellable) &&
                    !rm.is_archived &&
                    rm.is_active !== false &&
                    (!productSearch.trim() ||
                      rm.name.toLowerCase().includes(productSearch.toLowerCase().trim()) ||
                      (rm.category && rm.category.toLowerCase().includes(productSearch.toLowerCase().trim())))
                  )
                  .map((rm) => {
                    const isOutOfStock = Number(rm.current_stock || 0) <= 0;
                    const isLow = Number(rm.current_stock || 0) <= Number(rm.reorder_level || 0);
                    const resaleRate = Number(rm.selling_price || 0) > 0 ? Number(rm.selling_price) : Number(rm.cost_per_unit || 0);

                    return (
                      <div
                        key={`rm-${rm.id}`}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          isOutOfStock
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                            : 'bg-slate-900 border-teal-500/25 hover:border-teal-400/50 shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                                  🧪 Raw Material Resale
                                </span>
                              </div>
                              <h4 className="font-bold text-white text-sm leading-tight mt-1.5">{rm.name}</h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">{rm.category}</p>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 font-bold uppercase">
                              {rm.unit}
                            </span>
                          </div>

                          <div className="mt-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase block">Warehouse Stock (Shared):</span>
                              <span className={`font-mono font-black ${isLow ? 'text-rose-400' : 'text-teal-400'}`}>
                                {rm.current_stock} {rm.unit}
                              </span>
                            </div>
                            <div className="text-right text-[11px] text-slate-400">
                              Cost: <span className="font-mono text-slate-300">{formatPKR(rm.cost_per_unit)}/{rm.unit}</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-400 mt-2 line-clamp-1 italic">
                            Direct resale to customer. Deducts from production raw stock.
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase">Resale Rate:</span>
                            <p className="text-base font-black font-mono text-teal-400 leading-none mt-0.5">
                              {formatPKR(resaleRate)} <span className="text-[10px] text-slate-400 font-normal">/{rm.unit}</span>
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => addRawMaterialToCart(rm.id)}
                            className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

              {/* Empty state */}
              {(() => {
                const sellableCount = rawMaterials.filter(rm =>
                  Boolean(rm.is_sellable) && !rm.is_archived && rm.is_active !== false &&
                  (!productSearch.trim() || rm.name.toLowerCase().includes(productSearch.toLowerCase().trim()))
                ).length;
                const showEmpty = (posCatalogFilter === 'products' && filteredProducts.length === 0) ||
                  (posCatalogFilter === 'raw_materials' && sellableCount === 0) ||
                  (posCatalogFilter === 'all' && filteredProducts.length === 0 && sellableCount === 0);

                return showEmpty ? (
                  <div className="col-span-2 py-12 text-center text-slate-500 text-xs">
                    No products or sellable raw materials match your search criteria.
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Right 5 Columns: Billing Order Cart */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between shadow-xl">
            <form onSubmit={handleCheckout} className="space-y-4 flex flex-col h-full">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select Customer / Client
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Counter Walk-in Retail Customer</option>
                  {customers.filter(c => !c.is_archived).map((c) => {
                    const cFin = calculateCustomerFinancials(c, sales, payments, salesReturns);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customer_type}) {cFin.advanceBalance > 0 ? `• Held Advance: ${formatPKR(cFin.advanceBalance)}` : cFin.outstandingReceivable > 0 ? `• Due: ${formatPKR(cFin.outstandingReceivable)}` : ''}
                      </option>
                    );
                  })}
                </select>

                {selectedCustomer && availableAdvance > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-cyan-400" />
                        <span>Customer Advance Credit:</span>
                      </span>
                      <span className="font-mono font-black text-cyan-200 text-sm">{formatPKR(availableAdvance)}</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-1.5 border-t border-cyan-500/20 select-none">
                      <input
                        type="checkbox"
                        checked={applyCustomerAdvance}
                        onChange={(e) => {
                          setApplyCustomerAdvance(e.target.checked);
                          if (e.target.checked) {
                            setAdvanceAmountToApply(Math.min(availableAdvance, totalAmount));
                          }
                        }}
                        className="rounded border-cyan-400 text-cyan-500 focus:ring-0 w-4 h-4"
                      />
                      <span className="text-white text-xs font-semibold">Apply advance credit against this invoice</span>
                    </label>
                  </div>
                )}

                {selectedCustomer && availableAdvance === 0 && selectedCustomer.current_balance > 0 && (
                  <div className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center justify-between">
                    <span>Previous Outstanding Balance:</span>
                    <span className="font-bold font-mono">{formatPKR(selectedCustomer.current_balance)}</span>
                  </div>
                )}

                {/* Sale Mode Selector (Standard Retail vs Private Label Contract) */}
                <div className="mt-3 p-1.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrivateLabelOrder(false)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      !isPrivateLabelSale
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Standard Retail
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrivateLabelOrder(true);
                      if (!clientBrandName && selectedCustomer) {
                        setClientBrandName(selectedCustomer.name);
                      }
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isPrivateLabelSale
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow'
                        : 'text-slate-400 hover:text-amber-300'
                    }`}
                  >
                    <span>⭐ Private Label</span>
                  </button>
                </div>

                {/* Private Label Header Inputs when in Private Label Mode */}
                {isPrivateLabelSale && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1">
                        <span>🏭 Contract Client Brand:</span>
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono uppercase font-bold">Private Label</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-300 block mb-0.5">Client Brand Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Neo Clean"
                          value={clientBrandName}
                          onChange={(e) => setClientBrandName(e.target.value)}
                          className="w-full bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-300 block mb-0.5">Packing Labour (PKR/btl)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="3.50"
                          value={labourRatePerBottle}
                          onChange={(e) => setLabourRatePerBottle(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-xs text-white font-mono text-right font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="flex-1 border border-slate-800 rounded-xl p-3 bg-slate-950/40 overflow-y-auto max-h-56 space-y-2.5">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-500">
                    <ShoppingCart className="w-8 h-8 stroke-1 mb-2" />
                    <p className="text-xs">No products in current invoice</p>
                    <p className="text-[11px]">Select items & pack sizes from left grid</p>
                  </div>
                ) : (
                  cartItems.map((item, idx) => {
                    const rateInfo = getRateDifferenceInfo(item, products, rawMaterials);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="font-bold text-white text-xs leading-tight">{item.product_name}</h5>
                              {item.item_type === 'raw_material' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                                  🧪 Raw Material
                                </span>
                              )}
                              {rateInfo.isCustom && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                    rateInfo.isDiscount
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                      : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                  }`}
                                  title={`Catalog default rate: ${formatPKR(rateInfo.standardPrice)}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${rateInfo.isDiscount ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
                                  {rateInfo.isDiscount ? 'Discount Rate' : 'Premium Rate'}
                                </span>
                              )}
                            </div>
                            {item.pack_size_name ? (
                              <p className="text-[10px] text-emerald-400 font-medium">
                                Packaging: {item.pack_size_name}
                              </p>
                            ) : item.item_type === 'raw_material' ? (
                              <p className="text-[10px] text-teal-400 font-medium">
                                Direct Resale ({item.unit})
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold font-mono text-emerald-400">
                              {formatPKR(item.subtotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFromCart(idx)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Dedicated Item Editor: Private Label vs Standard Retail */}
                        {(item.is_private_label || isPrivateLabelSale) ? (
                          <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-2">
                            {/* Row 1: Bottle Size Selector & Size in Liters */}
                            <div className="flex items-center justify-between gap-2 bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <span className="text-[10px] text-emerald-400 font-bold shrink-0">Bottle Size:</span>
                                <select
                                  value={item.pack_size_id || (item.size_in_base_unit ? `custom_${item.size_in_base_unit}` : 'custom_0.5')}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val.startsWith('custom_')) {
                                      const size = parseFloat(val.replace('custom_', ''));
                                      updatePrivateLabelBottleSize(idx, size, `${size >= 1 ? size + 'L' : (size * 1000) + 'ml'}`);
                                    } else {
                                      const prod = products.find(p => p.id === item.product_id);
                                      const ps = prod?.pack_sizes?.find(p => p.id === val);
                                      if (ps) {
                                        updatePrivateLabelBottleSize(idx, ps.size_in_base_unit, ps.name, ps.id);
                                        if (ps.bottles_per_box && (!item.bottles_per_box || item.bottles_per_box === 12 || item.bottles_per_box === 24)) {
                                          updatePrivateLabelBottlesPerBox(idx, ps.bottles_per_box);
                                        }
                                      }
                                    }
                                  }}
                                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-500 truncate flex-1"
                                >
                                  {/* Defined product pack sizes if any */}
                                  {products.find(p => p.id === item.product_id)?.pack_sizes?.map(ps => (
                                    <option key={ps.id} value={ps.id}>
                                      {ps.name} ({ps.size_in_base_unit}L)
                                    </option>
                                  ))}
                                  {/* Standard preset bottle sizes */}
                                  <option value="custom_0.25">250ml (0.25L)</option>
                                  <option value="custom_0.275">275ml (0.275L)</option>
                                  <option value="custom_0.5">500ml (0.50L)</option>
                                  <option value="custom_1.0">1000ml / 1L (1.00L)</option>
                                  <option value="custom_5.0">5000ml / 5L (5.00L)</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] text-slate-400">Size:</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  value={item.size_in_base_unit !== undefined ? item.size_in_base_unit : 0.5}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val > 0) {
                                      updatePrivateLabelBottleSize(idx, val, `${val >= 1 ? val + 'L' : (val * 1000) + 'ml'}`);
                                    }
                                  }}
                                  className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-center text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                                  title="Bottle size in Liters (e.g. 0.5 for 500ml)"
                                />
                                <span className="text-[10px] text-slate-400 font-mono">L</span>
                              </div>
                            </div>

                            {/* Row 2: 4 Inputs - Qty (Box), Bottles/Box, Qty (Bottles), Rate (PKR/L) */}
                            <div className="grid grid-cols-4 gap-1.5 items-end">
                              {/* Qty Box */}
                              <div>
                                <label className="text-[10px] text-cyan-400 font-bold block mb-0.5 truncate" title="Boxes sold">
                                  Qty (Box)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.box_qty !== undefined ? (item.box_qty === 0 ? '' : item.box_qty) : (item.bottles_per_box ? (item.quantity / item.bottles_per_box) : '')}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    updatePrivateLabelBoxes(idx, isNaN(val) ? 0 : val);
                                  }}
                                  placeholder="0"
                                  className="w-full bg-slate-950 border border-cyan-500/40 rounded px-1 py-1 text-xs text-center text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-400"
                                />
                              </div>

                              {/* Bottles Per Box (MANUAL PER-INVOICE ENTRY) */}
                              <div>
                                <label className="text-[10px] text-purple-400 font-bold block mb-0.5 truncate" title="Bottles per box for THIS invoice (e.g. 6, 12, 24)">
                                  Bottles/Box
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.bottles_per_box !== undefined ? (item.bottles_per_box === 0 ? '' : item.bottles_per_box) : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    updatePrivateLabelBottlesPerBox(idx, isNaN(val) ? 0 : val);
                                  }}
                                  placeholder="e.g. 6"
                                  className="w-full bg-slate-950 border border-purple-500/40 rounded px-1 py-1 text-xs text-center text-purple-300 font-mono font-bold focus:outline-none focus:border-purple-400"
                                />
                              </div>

                              {/* Qty Bottles */}
                              <div>
                                <label className="text-[10px] text-slate-300 font-semibold block mb-0.5 truncate" title="Total bottles = Box × Bottles/Box">
                                  Qty (Bottles)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.bottle_qty !== undefined ? (item.bottle_qty === 0 ? '' : item.bottle_qty) : item.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    updatePrivateLabelBottles(idx, isNaN(val) ? 0 : val);
                                  }}
                                  placeholder="0"
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs text-center text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              {/* Rate per Liter */}
                              <div>
                                <label className="text-[10px] text-amber-400 font-bold block mb-0.5 truncate" title="Rate per Liter (PKR/L)">
                                  Rate (PKR/L)
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={item.rate_per_liter !== undefined ? (item.rate_per_liter === 0 ? '' : item.rate_per_liter) : (item.liters_qty ? Number((item.subtotal / item.liters_qty).toFixed(2)) : '')}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                      updatePrivateLabelRatePerLiter(idx, isNaN(val) ? 0 : val);
                                    }}
                                    placeholder="170"
                                    className="w-full bg-slate-950 border border-amber-500/40 rounded px-1 py-1 text-xs text-right text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Live calculation formula display */}
                            <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] flex items-center justify-between text-slate-400 font-mono flex-wrap gap-1">
                              <span>
                                <strong className="text-cyan-300">{item.bottle_qty ?? item.quantity} btl</strong> × {Number((item.size_in_base_unit || 0.5).toFixed(3))}L = <strong className="text-white">{(item.liters_qty ?? item.base_quantity ?? 0).toFixed(2)} Liters</strong>
                              </span>
                              <span>
                                @ <strong className="text-amber-300">{formatPKR(item.rate_per_liter || 170)}/L</strong> = <strong className="text-emerald-400">{formatPKR(item.subtotal)}</strong>
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* Standard Retail Quantity & Editable Unit Price Row */
                          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/60 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">Qty:</span>
                                {(() => {
                                  const isDecimalAllowed = item.item_type === 'raw_material' || !item.pack_size_id || item.pack_size_id === 'bulk';
                                  return (
                                    <input
                                      type="number"
                                      min={isDecimalAllowed ? "0.0001" : "1"}
                                      step={isDecimalAllowed ? "any" : "1"}
                                      value={item.quantity === 0 ? '' : item.quantity}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                          updateQuantity(idx, 0);
                                          return;
                                        }
                                        const num = isDecimalAllowed ? parseFloat(val) : parseInt(val, 10);
                                        updateQuantity(idx, isNaN(num) ? 0 : num);
                                      }}
                                      className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-center text-white font-mono focus:border-emerald-500 focus:outline-none"
                                    />
                                  );
                                })()}
                              </div>

                              <span className="text-slate-500 text-xs font-mono">×</span>

                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">Rate:</span>
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">Rs</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={item.unit_price === 0 ? '' : item.unit_price}
                                    onChange={(e) => updateUnitPrice(idx, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    placeholder="0"
                                    className={`w-20 bg-slate-900 border rounded pl-6 pr-1.5 py-0.5 text-xs text-right font-mono focus:outline-none transition-colors ${
                                      rateInfo.isCustom
                                        ? rateInfo.isDiscount
                                          ? 'border-amber-500/60 text-amber-300 focus:border-amber-400'
                                          : 'border-indigo-500/60 text-indigo-300 focus:border-indigo-400'
                                        : 'border-slate-700 text-white focus:border-emerald-500'
                                    }`}
                                    title={`Default: ${formatPKR(rateInfo.standardPrice)}. Edit rate for this sale.`}
                                  />
                                </div>
                                {rateInfo.isCustom && rateInfo.standardPrice !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => updateUnitPrice(idx, rateInfo.standardPrice!)}
                                    className="text-[9px] px-1.5 py-0.5 rounded text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                                    title={`Reset to default catalog rate (${formatPKR(rateInfo.standardPrice)})`}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>

                            <span className="text-[10px] text-slate-500 font-mono">
                              ({item.base_quantity} {item.unit} total)
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Discount & Totals */}
              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                {isPrivateLabelSale && (
                  <>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Products Subtotal ({cartItems.length} items):</span>
                      <span className="font-mono font-bold text-white">{formatPKR(productsSubtotal)}</span>
                    </div>

                    {/* Automatic Labour row */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      <div>
                        <span className="font-bold block">Labour (Packing & Bottling):</span>
                        <span className="text-[10px] text-amber-400 font-mono">
                          {totalBottles} bottles × PKR {labourRatePerBottle}/btl
                        </span>
                      </div>
                      <span className="font-mono font-black text-amber-200 text-sm">
                        + {formatPKR(labourAmount)}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between text-slate-400">
                  <span>Invoice Subtotal:</span>
                  <span className="font-mono font-bold text-white">{formatPKR(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Discount (PKR):</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-xs text-white font-mono focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                  <span>Net Total:</span>
                  <span className="font-mono text-emerald-400">{formatPKR(totalAmount)}</span>
                </div>
              </div>

              {/* Sale Date & Payment Details */}
              <div className="pt-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sale / Invoice Date</span>
                </label>
                <input
                  type="date"
                  required
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {applyCustomerAdvance && availableAdvance > 0 && (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 font-bold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Advance Amount to Apply:</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-mono text-[11px]">PKR</span>
                      <input
                        type="number"
                        min="1"
                        max={Math.min(availableAdvance, totalAmount)}
                        value={advanceAmountToApply || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setAdvanceAmountToApply(Math.min(val, availableAdvance, totalAmount));
                        }}
                        className="w-28 bg-slate-900 border border-cyan-500/40 rounded-lg px-2 py-1 text-right text-xs text-cyan-200 font-mono font-bold focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-cyan-500/20">
                    <span>Remaining Fresh Cash Due:</span>
                    <span className="font-bold font-mono text-emerald-400 text-xs">
                      {formatPKR(Math.max(0, totalAmount - Math.min(advanceAmountToApply > 0 ? advanceAmountToApply : availableAdvance, availableAdvance, totalAmount)))}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => handlePaymentStatusChange(e.target.value as PaymentStatus)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="paid">Full Paid</option>
                    <option value="partial">Partial Payment</option>
                    <option value="credit">Credit / Unpaid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="cash">Cash Counter</option>
                    <option value="bank">Bank Transfer (HBL)</option>
                    <option value="advance">Customer Advance</option>
                    <option value="jazzcash">JazzCash</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {paymentStatus === 'partial' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Amount Received Now (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalAmount}
                    value={amountPaid || ''}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    placeholder="Enter cash received"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              )}

              {/* Checkout Action Buttons */}
              {submitError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                  {submitError}
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={clearCart}
                  className="px-3 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || cartItems.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>{isSubmitting ? 'Syncing to Cloud...' : `Generate Invoice (${formatPKR(totalAmount)})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : activeSubTab === 'history' ? (
        /* =================== INVOICES HISTORY VIEW =================== */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice # or client..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="all">All Payment Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="credit">Credit / Unpaid</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Sold By</th>
                  <th className="py-3 px-3">Items / Packaging</th>
                  <th className="py-3 px-3 text-right">Total (PKR)</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No matching sales records found
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-white">{sale.invoice_number}</td>
                      <td className="py-3 px-3 text-slate-400">{formatDate(sale.date)}</td>
                      <td className="py-3 px-3 font-medium text-slate-200">{sale.customer_name}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-200 font-medium text-[11px] border border-slate-700/60 whitespace-nowrap">
                          {getSalespersonName(sale)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">
                            {sale.items.map(i => `${i.quantity}x ${i.pack_size_name || i.product_name}`).join(', ')}
                          </span>
                          {(sale.invoice_type === 'private_label' || sale.is_private_label) && (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap"
                              title={`Private Label invoice for ${sale.client_brand_name || 'Client'}`}
                            >
                              ⭐ Private Label
                            </span>
                          )}
                          {saleHasCustomRates(sale, products, rawMaterials) && (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap"
                              title="This invoice contains custom negotiated rates"
                            >
                              <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                              Custom Rate
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatPKR(sale.total_amount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {formatPKR(sale.amount_paid)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant={sale.payment_status === 'paid' ? 'emerald' : sale.payment_status === 'partial' ? 'amber' : 'rose'}
                        >
                          {sale.payment_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setReturnTargetSale(sale);
                              setIsReturnModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                            title="Process Sales Return & Credit Note for this invoice"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Return</span>
                          </button>

                          <button
                            onClick={() => setSelectedInvoice(sale)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
                            title="Print or Download PDF Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print / PDF</span>
                          </button>

                          {isOwner ? (
                            <button
                              onClick={() => setDeleteConfirmSale(sale)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                              title="Delete Sale Invoice & Reverse Stock/Balances"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/40 text-slate-600 border border-slate-800 text-xs cursor-not-allowed opacity-50"
                              title="Admin role required to delete invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =================== RETURNS & CREDIT NOTES VIEW =================== */
        <div className="space-y-4">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Credit Notes
              </span>
              <p className="text-2xl font-black text-rose-400 mt-1 font-mono">
                {salesReturns.length}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Processed return records</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Value Credited
              </span>
              <p className="text-2xl font-black text-white mt-1 font-mono">
                {formatPKR(salesReturns.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0))}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Inventory stock restored</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Cash Refunds Disbursed
              </span>
              <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                {formatPKR(
                  salesReturns
                    .filter(r => r.refund_method === 'cash_refund')
                    .reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0)
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Cash outflow payments</p>
            </div>
          </div>

          {/* Returns Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>Sales Returns & Credit Notes Register</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Audit trail of all returned customer goods, restocked warehouse inventory, and ledger adjustments
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search CRN #, invoice, customer..."
                    value={returnsSearch}
                    onChange={(e) => setReturnsSearch(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  onClick={() => {
                    setReturnTargetSale(null);
                    setIsReturnModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-md transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Process Return</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Credit Note #</th>
                    <th className="py-3 px-3">Original Invoice #</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Items Returned</th>
                    <th className="py-3 px-3 text-right">Credit Value</th>
                    <th className="py-3 px-3 text-center">Settlement Method</th>
                    <th className="py-3 px-3">Reason</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {salesReturns.filter(ret => {
                    if (!returnsSearch) return true;
                    const q = returnsSearch.toLowerCase();
                    return (
                      ret.credit_note_number.toLowerCase().includes(q) ||
                      ret.invoice_number.toLowerCase().includes(q) ||
                      ret.customer_name.toLowerCase().includes(q) ||
                      (ret.reason && ret.reason.toLowerCase().includes(q))
                    );
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500">
                        No sales returns or credit notes recorded yet.
                      </td>
                    </tr>
                  ) : (
                    salesReturns
                      .filter(ret => {
                        if (!returnsSearch) return true;
                        const q = returnsSearch.toLowerCase();
                        return (
                          ret.credit_note_number.toLowerCase().includes(q) ||
                          ret.invoice_number.toLowerCase().includes(q) ||
                          ret.customer_name.toLowerCase().includes(q) ||
                          (ret.reason && ret.reason.toLowerCase().includes(q))
                        );
                      })
                      .map((ret) => {
                        const itemsSummary = ret.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');
                        const methodVariant = ret.refund_method === 'cash_refund' ? 'amber' : ret.refund_method === 'customer_advance' ? 'blue' : 'emerald';
                        const methodText = ret.refund_method === 'cash_refund' ? 'Cash Refund' : ret.refund_method === 'customer_advance' ? 'Store Credit' : 'Balance Reduced';

                        return (
                          <tr key={ret.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">
                              {formatDate(ret.date)}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-rose-400 whitespace-nowrap">
                              {ret.credit_note_number}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                              {ret.invoice_number}
                            </td>
                            <td className="py-3 px-3 font-bold text-white">
                              {ret.customer_name}
                            </td>
                            <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={itemsSummary}>
                              {itemsSummary}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-rose-400 whitespace-nowrap">
                              {formatPKR(ret.total_amount)}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <Badge variant={methodVariant}>
                                {methodText}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px] max-w-xs truncate">
                              {ret.reason || 'General Return'}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedCreditNote(ret)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                                  title="View and Print Credit Note Document"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Print / PDF</span>
                                </button>

                                {isOwner && (
                                  <button
                                    onClick={() => setDeleteConfirmReturn(ret)}
                                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                                    title="Reverse & Delete Credit Note"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {selectedInvoice && (
        <InvoiceModal
          sale={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onDelete={isOwner ? () => {
            const target = selectedInvoice;
            setSelectedInvoice(null);
            setDeleteConfirmSale(target);
          } : undefined}
        />
      )}

      {/* Printable Credit Note Modal */}
      {selectedCreditNote && (
        <CreditNoteModal
          creditNote={selectedCreditNote}
          onClose={() => setSelectedCreditNote(null)}
          onDelete={isOwner ? () => {
            const target = selectedCreditNote;
            setSelectedCreditNote(null);
            setDeleteConfirmReturn(target);
          } : undefined}
        />
      )}

      {/* Process Sales Return Modal */}
      <ProcessReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnTargetSale(null);
        }}
        initialSale={returnTargetSale}
        onSuccess={(creditNote) => {
          setSelectedCreditNote(creditNote);
        }}
      />

      {/* Delete Sale Invoice & Reversal Confirmation Modal */}
      {deleteConfirmSale && (
        <Modal
          isOpen={!!deleteConfirmSale}
          onClose={() => setDeleteConfirmSale(null)}
          title={`Delete & Reverse Invoice: ${deleteConfirmSale.invoice_number}`}
          subtitle="Admin Automated Inventory & Customer Balance Reversal"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Automatic Transaction Reversal Actions:</span>
              </div>
              <ul className="space-y-1.5 text-slate-200 text-[11px] list-disc pl-5">
                <li>
                  <strong>Stock Restoration:</strong> Sold quantities will be automatically added back into warehouse base stock:
                  <div className="mt-1 font-mono text-emerald-400">
                    {deleteConfirmSale.items.map(i => `• ${i.product_name}: +${i.base_quantity || i.quantity} ${i.unit || 'L'}`).join(', ')}
                  </div>
                </li>
                {deleteConfirmSale.customer_id && (deleteConfirmSale.total_amount - deleteConfirmSale.amount_paid) > 0 && (
                  <li>
                    <strong>Customer Debt Reversal:</strong> Customer <em>"{deleteConfirmSale.customer_name}"</em> balance will be reduced by <strong>{formatPKR(deleteConfirmSale.total_amount - deleteConfirmSale.amount_paid)}</strong>.
                  </li>
                )}
                {deleteConfirmSale.amount_paid > 0 && (
                  <li>
                    <strong>Payment Reversal:</strong> Linked cash/bank receipts of <strong>{formatPKR(deleteConfirmSale.amount_paid)}</strong> will be removed from cashbook.
                  </li>
                )}
              </ul>
            </div>

            <p className="text-slate-300">
              Are you sure you want to delete invoice <strong>{deleteConfirmSale.invoice_number}</strong>? An audit log entry will be permanently saved.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmSale(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteSale}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'Reversing...' : 'Confirm Deletion & Execute Reversals'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete / Reverse Credit Note Confirmation Modal */}
      {deleteConfirmReturn && (
        <Modal
          isOpen={!!deleteConfirmReturn}
          onClose={() => setDeleteConfirmReturn(null)}
          title={`Reverse Credit Note: ${deleteConfirmReturn.credit_note_number}`}
          subtitle="Admin Automated Stock & Ledger Reversal"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Reversal Impact Details:</span>
              </div>
              <ul className="space-y-1.5 text-slate-200 text-[11px] list-disc pl-5">
                <li>
                  <strong>Stock Deduction:</strong> Returned items will be deducted back out of stock:
                  <div className="mt-1 font-mono text-rose-400">
                    {deleteConfirmReturn.items.map(i => `• ${i.product_name}: -${i.base_quantity || i.quantity} ${i.unit || 'L'}`).join(', ')}
                  </div>
                </li>
                <li>
                  <strong>Customer Ledger:</strong> Customer <em>"{deleteConfirmReturn.customer_name}"</em> balance will be adjusted back by <strong>{formatPKR(deleteConfirmReturn.total_amount)}</strong>.
                </li>
                {deleteConfirmReturn.refund_payment_id && (
                  <li>
                    <strong>Cash Refund Reversal:</strong> Linked cash refund outflow payment will be permanently deleted from cashbook.
                  </li>
                )}
              </ul>
            </div>

            <p className="text-slate-300">
              Are you sure you want to reverse credit note <strong>{deleteConfirmReturn.credit_note_number}</strong>? An audit log entry will be saved.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmReturn(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteReturn}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'Reversing...' : 'Confirm Reversal & Adjust Records'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
