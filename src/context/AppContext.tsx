import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Product, 
  Customer, 
  Supplier, 
  Sale, 
  Purchase, 
  StockMovement, 
  Payment, 
  StockMovementType, 
  RawMaterial, 
  ProductFormulation, 
  ProductionBatch, 
  RawMaterialMovement, 
  RawMaterialMovementType,
  PackSize,
  DeletionAuditLog,
  Profile,
  Expense,
  RecurringExpense,
  PaymentMethod
} from '../types';
import { generateInvoiceNumber, formatPKR } from '../utils/formatters';
import { getNextBatchNumberForProduct } from '../utils/batchNumber';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../lib/supabaseService';
import { generateId } from '../utils/uuid';
import { calculateCustomerFinancials, calculateSupplierFinancials } from '../utils/financialEngine';

interface AppContextType {
  // State
  products: Product[];
  rawMaterials: RawMaterial[];
  formulations: ProductFormulation[];
  productionBatches: ProductionBatch[];
  rawMaterialMovements: RawMaterialMovement[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  purchases: Purchase[];
  stockMovements: StockMovement[];
  payments: Payment[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  deletionLogs: DeletionAuditLog[];
  
  // Cloud & Connectivity Status
  isLoadingCloudData: boolean;
  cloudSyncError: string | null;
  isOnline: boolean;
  refreshCloudData: () => Promise<void>;

  // Derived alerts & valuation
  lowStockProducts: Product[];
  lowStockRawMaterials: RawMaterial[];
  totalRawMaterialsValuation: number;
  totalProductsValuation: number;
  thisMonthExpenses: number;
  totalExpenses: number;

  // Raw Materials Actions
  addRawMaterial: (material: Omit<RawMaterial, 'id' | 'created_at'>) => Promise<RawMaterial>;
  updateRawMaterial: (id: string, updates: Partial<RawMaterial>) => Promise<RawMaterial>;
  deleteOrArchiveRawMaterial: (id: string, user: Profile) => Promise<{ action: 'deleted' | 'archived'; message: string }>;
  unarchiveRawMaterial: (id: string) => Promise<void>;
  adjustRawMaterialStock: (rawMaterialId: string, qtyDiff: number, type: RawMaterialMovementType, notes: string, userName: string) => Promise<void>;

  // Formulation (BOM) Actions
  saveFormulation: (formulation: Omit<ProductFormulation, 'id' | 'created_at'> & { id?: string }) => Promise<ProductFormulation>;
  deleteOrArchiveFormulation: (id: string, user: Profile) => Promise<{ action: 'deleted' | 'archived'; message: string }>;
  unarchiveFormulation: (id: string) => Promise<void>;

  // Production Module Actions
  recordProductionBatch: (params: {
    productId: string;
    quantityProduced: number;
    batchNumber: string;
    date: string;
    supervisorName: string;
    notes?: string;
  }) => Promise<{ success: boolean; message: string; batch?: ProductionBatch }>;
  deleteProductionBatch: (
    batchId: string, 
    user: Profile, 
    forceAllowNegativeStock?: boolean
  ) => Promise<{ 
    success: boolean; 
    hasNegativeStockWarning?: boolean; 
    warningDetails?: string[]; 
    message: string 
  }>;

  // Safe Delete / Archive History Checkers
  checkProductHasHistory: (productId: string) => boolean;
  checkRawMaterialHasHistory: (rawMaterialId: string) => boolean;
  checkFormulationHasHistory: (formulationId: string) => boolean;
  checkCustomerHasHistory: (customerId: string) => boolean;
  checkSupplierHasHistory: (supplierId: string) => boolean;

  // Aliases for compatibility
  deleteCustomer: (id: string, user: Profile) => Promise<{ action: 'deleted' | 'archived'; message: string }>;
  deleteSupplier: (id: string, user: Profile) => Promise<{ action: 'deleted' | 'archived'; message: string }>;
  deleteFormulation: (id: string, user: Profile) => Promise<{ action: 'deleted' | 'archived'; message: string }>;

  // Product Actions
  addProduct: (product: Omit<Product, 'id' | 'created_at'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<Product>;
  deleteOrArchiveProduct: (id: string, user: Profile) => Promise<{ action: 'deleted' | 'archived'; message: string }>;
  unarchiveProduct: (id: string) => Promise<void>;
  adjustStock: (productId: string, qtyDiff: number, type: StockMovementType, notes: string, user: string) => Promise<void>;
  updateProductPackSizes: (productId: string, packSizes: PackSize[]) => Promise<void>;

  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'created_at'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<Customer>;
  deleteOrArchiveCustomer: (id: string, user: Profile) => Promise<{ action: 'deleted' | 'archived'; message: string }>;
  unarchiveCustomer: (id: string) => Promise<void>;

  // Supplier Actions
  addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at'>) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<Supplier>;
  deleteOrArchiveSupplier: (id: string, user: Profile) => Promise<{ action: 'deleted' | 'archived'; message: string }>;
  unarchiveSupplier: (id: string) => Promise<void>;

  // Transaction Actions
  createSale: (saleData: Omit<Sale, 'id' | 'invoice_number' | 'created_at'>) => Promise<Sale>;
  deleteSaleInvoice: (saleId: string, user: Profile) => Promise<{ success: boolean; message: string }>;
  
  createPurchase: (purchaseData: Omit<Purchase, 'id' | 'invoice_number' | 'created_at'>) => Promise<Purchase>;
  deletePurchaseInvoice: (purchaseId: string, user: Profile, forceAllowNegativeStock?: boolean) => Promise<{ 
    success: boolean; 
    hasNegativeStockWarning?: boolean; 
    warningDetails?: string[]; 
    message: string 
  }>;
  
  recordPayment: (paymentData: Omit<Payment, 'id' | 'created_at'>) => Promise<Payment>;
  deletePayment: (paymentId: string) => Promise<void>;

  // Expense Actions
  addExpense: (expenseData: Omit<Expense, 'id' | 'created_at'>, user: Profile) => Promise<Expense>;
  deleteExpense: (id: string, user: Profile) => Promise<{ success: boolean; message: string }>;
  addRecurringExpense: (data: Omit<RecurringExpense, 'id' | 'created_at'>) => Promise<RecurringExpense>;
  updateRecurringExpense: (id: string, updates: Partial<RecurringExpense>) => Promise<RecurringExpense>;
  deleteRecurringExpense: (id: string) => Promise<void>;
  confirmAndPostRecurringExpense: (recurringId: string, customAmount?: number, customPaymentMethod?: PaymentMethod, user?: Profile) => Promise<Expense>;

  // Helper
  resetToDefaultData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. One-time clean removal of stale localStorage data from users' browsers
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('psc_cloud_migrated_v3')) {
      const legacyKeys = [
        'psc_products', 'psc_raw_materials', 'psc_formulations', 'psc_production_batches',
        'psc_raw_movements', 'psc_customers', 'psc_suppliers', 'psc_sales', 'psc_purchases',
        'psc_stock_movements', 'psc_payments', 'psc_deletion_logs', 'psc_users',
        'psc_clean_slate_applied_v2'
      ];
      legacyKeys.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('psc_cloud_migrated_v3', 'true');
    }
  }, []);

  // 2. Cloud-Native State (Empty arrays initially; populated strictly from Supabase)
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [formulations, setFormulations] = useState<ProductFormulation[]>([]);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);
  const [rawMaterialMovements, setRawMaterialMovements] = useState<RawMaterialMovement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [deletionLogs, setDeletionLogs] = useState<DeletionAuditLog[]>([]);

  // Cloud status states
  const [isLoadingCloudData, setIsLoadingCloudData] = useState<boolean>(true);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Monitor online / offline connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch live records from Supabase Cloud on mount & subscribe to Realtime multi-device changes
  const loadCloudData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoadingCloudData(false);
      return;
    }

    try {
      setCloudSyncError(null);
      const cloudData = await supabaseService.fetchAll();
      if (cloudData) {
        // Defensive filter: exclude any orphaned payments whose parent sale or purchase order was deleted
        const validSalesIds = new Set((cloudData.sales || []).map(s => s.id));
        const validSalesInvs = new Set((cloudData.sales || []).map(s => s.invoice_number));
        const validPoIds = new Set((cloudData.purchases || []).map(p => p.id));
        const validPoInvs = new Set((cloudData.purchases || []).map(p => p.invoice_number));

        const sanitizedPayments = (cloudData.payments || []).filter(p => {
          if (p.related_to === 'sale') {
            if (p.reference_id && !validSalesIds.has(p.reference_id) && !validSalesInvs.has(p.reference_id)) {
              return false;
            }
            if (p.reference_no && !validSalesInvs.has(p.reference_no)) {
              return false;
            }
          }
          if (p.related_to === 'purchase') {
            if (p.reference_id && !validPoIds.has(p.reference_id) && !validPoInvs.has(p.reference_id)) {
              return false;
            }
            if (p.reference_no && !validPoInvs.has(p.reference_no)) {
              return false;
            }
          }
          return true;
        });

        // Auto-reconcile customer balances with authoritative financialEngine
        const reconciledCustomers = (cloudData.customers || []).map(cust => {
          const summary = calculateCustomerFinancials(cust, cloudData.sales || [], sanitizedPayments);
          const expectedBal = summary.outstandingReceivable;
          if (Math.abs(expectedBal - Number(cust.current_balance || 0)) > 0.01) {
            console.info(`Auto-reconciling customer "${cust.name}" balance: ${cust.current_balance} -> ${expectedBal}`);
            supabaseService.upsertCustomer({ ...cust, current_balance: expectedBal }).catch(err => {
              console.warn('Could not auto-sync reconciled customer balance to Supabase:', err);
            });
            return { ...cust, current_balance: expectedBal };
          }
          return cust;
        });

        // Auto-reconcile supplier balances with authoritative financialEngine
        const reconciledSuppliers = (cloudData.suppliers || []).map(supp => {
          const summary = calculateSupplierFinancials(supp, cloudData.purchases || [], sanitizedPayments);
          const expectedBal = summary.outstandingPayable;
          if (Math.abs(expectedBal - Number(supp.current_balance || 0)) > 0.01) {
            console.info(`Auto-reconciling supplier "${supp.name}" balance: ${supp.current_balance} -> ${expectedBal}`);
            supabaseService.upsertSupplier({ ...supp, current_balance: expectedBal }).catch(err => {
              console.warn('Could not auto-sync reconciled supplier balance to Supabase:', err);
            });
            return { ...supp, current_balance: expectedBal };
          }
          return supp;
        });

        setProducts(cloudData.products || []);
        setRawMaterials(cloudData.rawMaterials || []);
        setFormulations(cloudData.formulations || []);
        setProductionBatches(cloudData.productionBatches || []);
        setRawMaterialMovements(cloudData.rawMaterialMovements || []);
        setCustomers(reconciledCustomers);
        setSuppliers(reconciledSuppliers);
        setSales(cloudData.sales || []);
        setPurchases(cloudData.purchases || []);
        setStockMovements(cloudData.stockMovements || []);
        setPayments(sanitizedPayments);
        setExpenses(cloudData.expenses || []);
        setRecurringExpenses(cloudData.recurringExpenses || []);
        setDeletionLogs(cloudData.deletionLogs || []);
      }
    } catch (err: any) {
      console.error('Failed to load cloud data from Supabase:', err);
      setCloudSyncError(err?.message || 'Failed to sync with Supabase cloud database.');
    } finally {
      setIsLoadingCloudData(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadCloudData();

    // Supabase Realtime multi-device sync
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('psc-realtime-cloud')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          if (isMounted) {
            loadCloudData();
          }
        })
        .subscribe();

      return () => {
        isMounted = false;
        if (supabase) supabase.removeChannel(channel);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [loadCloudData]);

  const addDeletionLogEntry = async (entry: Omit<DeletionAuditLog, 'id' | 'date'>) => {
    const newLog: DeletionAuditLog = {
      ...entry,
      id: generateId(),
      date: new Date().toISOString(),
    };
    try {
      await supabaseService.upsertDeletionLog(newLog);
      setDeletionLogs(prev => [newLog, ...prev]);
    } catch (e) {
      console.error('Failed to log deletion audit:', e);
    }
  };

  // Derived low stock items & valuations
  const lowStockProducts = products.filter(
    p => p.is_active && !p.is_archived && Number(p.current_stock) <= Number(p.reorder_level)
  );

  const lowStockRawMaterials = rawMaterials.filter(
    rm => rm.is_active && !rm.is_archived && Number(rm.current_stock) <= Number(rm.reorder_level)
  );

  const totalRawMaterialsValuation = rawMaterials
    .filter(rm => rm.is_active && !rm.is_archived)
    .reduce((acc, rm) => acc + (Number(rm.current_stock || 0) * Number(rm.cost_per_unit || 0)), 0);

  const totalProductsValuation = products
    .filter(p => p.is_active && !p.is_archived)
    .reduce((acc, p) => acc + (Number(p.current_stock || 0) * Number(p.cost_price || 0)), 0);

  // Derived expenses metrics
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const thisMonthExpenses = expenses
    .filter(e => e.date && e.date.startsWith(currentMonthPrefix))
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  // ==============================================================================
  // RAW MATERIALS ACTIONS (SUPABASE-FIRST)
  // ==============================================================================
  const addRawMaterial = async (matData: Omit<RawMaterial, 'id' | 'created_at'>): Promise<RawMaterial> => {
    const newMat: RawMaterial = {
      ...matData,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    const saved = await supabaseService.upsertRawMaterial(newMat);
    setRawMaterials(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);

    if (saved.current_stock > 0) {
      const movement: RawMaterialMovement = {
        id: generateId(),
        raw_material_id: saved.id,
        raw_material_name: saved.name,
        movement_type: 'adjustment',
        quantity: saved.current_stock,
        previous_stock: 0,
        new_stock: saved.current_stock,
        notes: 'Initial opening raw material stock',
        date: new Date().toISOString(),
        created_by_name: 'Admin',
      };
      await supabaseService.upsertRawMaterialMovement(movement);
      setRawMaterialMovements(prev => [movement, ...prev]);
    }
    return saved;
  };

  const updateRawMaterial = async (id: string, updates: Partial<RawMaterial>): Promise<RawMaterial> => {
    const target = rawMaterials.find(r => r.id === id);
    if (!target) throw new Error('Raw material not found');
    const updated = { ...target, ...updates, updated_at: new Date().toISOString() };
    const saved = await supabaseService.upsertRawMaterial(updated);
    setRawMaterials(prev => prev.map(r => r.id === id ? saved : r));
    return saved;
  };

  const deleteOrArchiveRawMaterial = async (id: string, user: Profile): Promise<{ action: 'deleted' | 'archived'; message: string }> => {
    const target = rawMaterials.find(r => r.id === id);
    if (!target) return { action: 'deleted', message: 'Raw material not found.' };

    const isUsedInFormulations = formulations.some(f => f.items?.some(i => i.raw_material_id === id));
    const isUsedInPurchases = purchases.some(p => p.items?.some(i => i.raw_material_id === id));

    if (!isUsedInFormulations && !isUsedInPurchases) {
      await supabaseService.deleteRawMaterial(id);
      setRawMaterials(prev => prev.filter(r => r.id !== id));
      await addDeletionLogEntry({
        entity_type: 'raw_material',
        entity_id: id,
        entity_title: target.name,
        action_type: 'deleted',
        impact_summary: `Permanently deleted raw material "${target.name}" (0 formulations, 0 purchases).`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'deleted', message: `Raw material "${target.name}" had no formulation or purchase history and was deleted.` };
    } else {
      const archived = { ...target, is_archived: true, is_active: false, updated_at: new Date().toISOString() };
      await supabaseService.upsertRawMaterial(archived);
      setRawMaterials(prev => prev.map(r => r.id === id ? archived : r));
      await addDeletionLogEntry({
        entity_type: 'raw_material',
        entity_id: id,
        entity_title: target.name,
        action_type: 'archived',
        impact_summary: `Archived raw material "${target.name}" with formulation/purchase links to prevent broken recipe history.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Raw material "${target.name}" is linked to existing formulations/purchases and was safely archived.` };
    }
  };

  const unarchiveRawMaterial = async (id: string): Promise<void> => {
    const target = rawMaterials.find(r => r.id === id);
    if (!target) return;
    const unarchived = { ...target, is_archived: false, is_active: true, updated_at: new Date().toISOString() };
    await supabaseService.upsertRawMaterial(unarchived);
    setRawMaterials(prev => prev.map(r => r.id === id ? unarchived : r));
  };

  const adjustRawMaterialStock = async (
    rawMaterialId: string, 
    qtyDiff: number, 
    type: RawMaterialMovementType, 
    notes: string, 
    userName: string
  ): Promise<void> => {
    const target = rawMaterials.find(r => r.id === rawMaterialId);
    if (!target) return;

    const prevStock = Number(target.current_stock);
    const newStock = Math.max(0, prevStock + qtyDiff);

    const updatedRm = { ...target, current_stock: newStock, updated_at: new Date().toISOString() };
    await supabaseService.upsertRawMaterial(updatedRm);
    setRawMaterials(prev => prev.map(r => r.id === rawMaterialId ? updatedRm : r));

    const movement: RawMaterialMovement = {
      id: generateId(),
      raw_material_id: rawMaterialId,
      raw_material_name: target.name,
      movement_type: type,
      quantity: qtyDiff,
      previous_stock: prevStock,
      new_stock: newStock,
      notes: notes || `Manual ${type} adjustment`,
      date: new Date().toISOString(),
      created_by_name: userName,
    };

    await supabaseService.upsertRawMaterialMovement(movement);
    setRawMaterialMovements(prev => [movement, ...prev]);
  };

  // ==============================================================================
  // FORMULATION (BOM) ACTIONS (SUPABASE-FIRST)
  // ==============================================================================
  const saveFormulation = async (formData: Omit<ProductFormulation, 'id' | 'created_at'> & { id?: string }): Promise<ProductFormulation> => {
    if (formData.id) {
      const existing = formulations.find(f => f.id === formData.id);
      const updated = { ...(existing || {}), ...formData, id: formData.id, updated_at: new Date().toISOString() } as ProductFormulation;
      const saved = await supabaseService.upsertFormulation(updated);
      setFormulations(prev => prev.map(f => f.id === formData.id ? saved : f));
      return saved;
    } else {
      const newForm: ProductFormulation = {
        ...formData,
        id: generateId(),
        created_at: new Date().toISOString(),
      };
      const saved = await supabaseService.upsertFormulation(newForm);
      setFormulations(prev => [saved, ...prev]);
      return saved;
    }
  };

  const deleteOrArchiveFormulation = async (id: string, user: Profile): Promise<{ action: 'deleted' | 'archived'; message: string }> => {
    const target = formulations.find(f => f.id === id);
    if (!target) return { action: 'deleted', message: 'Formulation not found.' };

    const hasBatches = productionBatches.some(b => b.product_id === target.product_id);

    if (!hasBatches) {
      await supabaseService.deleteFormulation(id);
      setFormulations(prev => prev.filter(f => f.id !== id));
      await addDeletionLogEntry({
        entity_type: 'formulation',
        entity_id: id,
        entity_title: target.product_name,
        action_type: 'deleted',
        impact_summary: `Permanently deleted recipe formulation for "${target.product_name}" (0 batch runs).`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'deleted', message: `Formulation for "${target.product_name}" had no production batches and was deleted.` };
    } else {
      const archived = { ...target, is_archived: true, updated_at: new Date().toISOString() };
      await supabaseService.upsertFormulation(archived);
      setFormulations(prev => prev.map(f => f.id === id ? archived : f));
      await addDeletionLogEntry({
        entity_type: 'formulation',
        entity_id: id,
        entity_title: target.product_name,
        action_type: 'archived',
        impact_summary: `Archived formulation for "${target.product_name}" to preserve past production batch BOM records.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Formulation for "${target.product_name}" has production batch history and was safely archived.` };
    }
  };

  const unarchiveFormulation = async (id: string): Promise<void> => {
    const target = formulations.find(f => f.id === id);
    if (!target) return;
    const unarchived = { ...target, is_archived: false, updated_at: new Date().toISOString() };
    await supabaseService.upsertFormulation(unarchived);
    setFormulations(prev => prev.map(f => f.id === id ? unarchived : f));
  };

  // ==============================================================================
  // PRODUCTION MODULE ACTIONS (SUPABASE-FIRST)
  // ==============================================================================
  const recordProductionBatch = async (params: {
    productId: string;
    quantityProduced: number;
    batchNumber: string;
    date: string;
    supervisorName: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; batch?: ProductionBatch }> => {
    const targetProduct = products.find(p => p.id === params.productId);
    if (!targetProduct) return { success: false, message: 'Target product not found' };

    const formulation = formulations.find(f => f.product_id === targetProduct.id && !f.is_archived);
    if (!formulation) return { success: false, message: `No active formulation (BOM) found for ${targetProduct.name}` };

    const multiplier = params.quantityProduced / formulation.yield_quantity;
    const stockErrors: string[] = [];

    const requirements = formulation.items.map(item => {
      const needed = Number((item.quantity * multiplier).toFixed(4));
      const rm = rawMaterials.find(m => m.id === item.raw_material_id);
      const available = rm ? Number(rm.current_stock) : 0;
      if (available < needed) {
        stockErrors.push(`${item.raw_material_name}: Available ${available} ${item.unit}, Needed ${needed} ${item.unit}`);
      }
      return {
        item,
        rm,
        totalNeeded: needed,
        cost: Number((needed * (rm?.cost_per_unit || 0)).toFixed(2))
      };
    });

    if (stockErrors.length > 0) {
      return {
        success: false,
        message: `Insufficient raw materials stock:\n${stockErrors.join('\n')}`
      };
    }

    // Ensure unique batch number and prevent race conditions
    let finalBatchNumber = (params.batchNumber || '').trim();
    if (!finalBatchNumber) {
      finalBatchNumber = getNextBatchNumberForProduct(targetProduct.id, productionBatches, targetProduct);
    } else {
      let candidate = finalBatchNumber;
      let counter = 1;
      const isTaken = (bNum: string) => productionBatches.some(b => b.batch_number.toLowerCase() === bNum.toLowerCase());
      while (isTaken(candidate)) {
        const batchMatch = candidate.match(/^(.*-Batch)(\d+)$/i);
        if (batchMatch) {
          const nextIndex = parseInt(batchMatch[2], 10) + counter;
          candidate = `${batchMatch[1]}${nextIndex}`;
        } else {
          candidate = `${finalBatchNumber}-${counter}`;
        }
        counter++;
      }
      finalBatchNumber = candidate;
    }

    const now = new Date().toISOString();
    const effectiveDate = params.date || now;
    let totalBatchCost = 0;
    const consumedList: any[] = [];
    const newRawMovements: RawMaterialMovement[] = [];
    const updatedRawMaterials: RawMaterial[] = [...rawMaterials];

    for (const rmReq of requirements) {
      totalBatchCost += rmReq.cost;
      consumedList.push({
        raw_material_id: rmReq.item.raw_material_id,
        raw_material_name: rmReq.item.raw_material_name,
        quantity_consumed: rmReq.totalNeeded,
        unit: rmReq.item.unit,
        unit_cost: rmReq.rm?.cost_per_unit || 0,
        total_cost: rmReq.cost,
      });

      const rmIdx = updatedRawMaterials.findIndex(m => m.id === rmReq.item.raw_material_id);
      if (rmIdx !== -1) {
        const prevStk = Number(updatedRawMaterials[rmIdx].current_stock);
        const nextStk = Math.max(0, prevStk - rmReq.totalNeeded);
        const updatedRm = {
          ...updatedRawMaterials[rmIdx],
          current_stock: nextStk,
          updated_at: now,
        };
        updatedRawMaterials[rmIdx] = updatedRm;
        await supabaseService.upsertRawMaterial(updatedRm);

        const rmMovement: RawMaterialMovement = {
          id: generateId(),
          raw_material_id: rmReq.item.raw_material_id,
          raw_material_name: rmReq.item.raw_material_name,
          movement_type: 'production_out',
          quantity: -rmReq.totalNeeded,
          previous_stock: prevStk,
          new_stock: nextStk,
          reference_id: finalBatchNumber,
          notes: `Consumed in Batch ${finalBatchNumber} (${targetProduct.name} - ${params.quantityProduced} ${targetProduct.base_unit || targetProduct.unit})`,
          date: effectiveDate,
          created_by_name: params.supervisorName,
        };
        newRawMovements.push(rmMovement);
        await supabaseService.upsertRawMaterialMovement(rmMovement);
      }
    }

    setRawMaterials(updatedRawMaterials);
    setRawMaterialMovements(prev => [...newRawMovements, ...prev]);

    // Update finished product stock
    const prevProdStock = Number(targetProduct.current_stock);
    const nextProdStock = prevProdStock + Number(params.quantityProduced);
    const calculatedCostPerUnit = Number((totalBatchCost / params.quantityProduced).toFixed(2));

    const updatedTargetProd: Product = {
      ...targetProduct,
      current_stock: nextProdStock,
      cost_price: calculatedCostPerUnit > 0 ? calculatedCostPerUnit : targetProduct.cost_price,
      updated_at: now,
    };
    await supabaseService.upsertProduct(updatedTargetProd);
    setProducts(prev => prev.map(p => p.id === targetProduct.id ? updatedTargetProd : p));

    // Log finished product movement
    const prodStockMovement: StockMovement = {
      id: generateId(),
      product_id: targetProduct.id,
      product_name: targetProduct.name,
      movement_type: 'production',
      quantity: Number(params.quantityProduced),
      previous_stock: prevProdStock,
      new_stock: nextProdStock,
      reference_id: finalBatchNumber,
      notes: `Manufactured in Batch ${finalBatchNumber}`,
      date: effectiveDate,
      created_by_name: params.supervisorName,
    };
    await supabaseService.upsertStockMovement(prodStockMovement);
    setStockMovements(prev => [prodStockMovement, ...prev]);

    // Create production batch entry
    const newBatch: ProductionBatch = {
      id: generateId(),
      batch_number: finalBatchNumber,
      product_id: targetProduct.id,
      product_name: targetProduct.name,
      quantity_produced: Number(params.quantityProduced),
      base_unit: (targetProduct.base_unit || 'liter') as any,
      date: effectiveDate,
      supervisor_name: params.supervisorName,
      raw_materials_consumed: consumedList,
      total_batch_cost: Number(totalBatchCost.toFixed(2)),
      cost_per_base_unit: calculatedCostPerUnit,
      notes: params.notes,
    };

    const savedBatch = await supabaseService.upsertProductionBatch(newBatch);
    setProductionBatches(prev => [savedBatch, ...prev]);

    return {
      success: true,
      message: `Production Batch ${finalBatchNumber} recorded successfully. Produced ${params.quantityProduced} ${targetProduct.base_unit || targetProduct.unit} of ${targetProduct.name}.`,
      batch: savedBatch,
    };
  };

  const deleteProductionBatch = async (
    batchId: string, 
    user: Profile, 
    forceAllowNegativeStock: boolean = false
  ): Promise<{ success: boolean; hasNegativeStockWarning?: boolean; warningDetails?: string[]; message: string }> => {
    const targetBatch = productionBatches.find(b => b.id === batchId);
    if (!targetBatch) return { success: false, message: 'Production batch not found.' };

    const targetProduct = products.find(p => p.id === targetBatch.product_id);
    const currentProdStock = targetProduct ? Number(targetProduct.current_stock) : 0;
    const wouldBeProdStock = currentProdStock - targetBatch.quantity_produced;

    const warningDetails: string[] = [];
    if (wouldBeProdStock < 0) {
      warningDetails.push(
        `Finished Product "${targetBatch.product_name}": Current stock is ${currentProdStock} ${targetBatch.base_unit}, but this batch produced ${targetBatch.quantity_produced} ${targetBatch.base_unit}. Stock would become negative (${wouldBeProdStock} ${targetBatch.base_unit}). Output was likely already sold.`
      );
    }

    if (warningDetails.length > 0 && !forceAllowNegativeStock) {
      return {
        success: false,
        hasNegativeStockWarning: true,
        warningDetails,
        message: 'Reversing this production batch will cause negative finished stock balance.'
      };
    }

    const now = new Date().toISOString();

    // 1. Restore consumed raw materials
    if (targetBatch.raw_materials_consumed) {
      for (const consumed of targetBatch.raw_materials_consumed) {
        const rm = rawMaterials.find(m => m.id === consumed.raw_material_id);
        if (rm) {
          const prevStk = Number(rm.current_stock);
          const nextStk = prevStk + Number(consumed.quantity_consumed);
          const updatedRm = { ...rm, current_stock: nextStk, updated_at: now };
          await supabaseService.upsertRawMaterial(updatedRm);

          const rawMvt: RawMaterialMovement = {
            id: generateId(),
            raw_material_id: rm.id,
            raw_material_name: rm.name,
            movement_type: 'adjustment',
            quantity: Number(consumed.quantity_consumed),
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: targetBatch.batch_number,
            notes: `Restored raw material from reversed production batch ${targetBatch.batch_number}`,
            date: now,
            created_by_name: user.name,
          };
          await supabaseService.upsertRawMaterialMovement(rawMvt);
        }
      }
    }

    // 2. Deduct finished goods output
    if (targetProduct) {
      const prevStk = Number(targetProduct.current_stock);
      const nextStk = Math.max(0, prevStk - targetBatch.quantity_produced);
      const updatedProd = { ...targetProduct, current_stock: nextStk, updated_at: now };
      await supabaseService.upsertProduct(updatedProd);

      const prodMvt: StockMovement = {
        id: generateId(),
        product_id: targetProduct.id,
        product_name: targetProduct.name,
        movement_type: 'adjustment',
        quantity: -targetBatch.quantity_produced,
        previous_stock: prevStk,
        new_stock: nextStk,
        reference_id: targetBatch.batch_number,
        notes: `Deducted finished output of reversed production batch ${targetBatch.batch_number}`,
        date: now,
        created_by_name: user.name,
      };
      await supabaseService.upsertStockMovement(prodMvt);
    }

    // 3. Delete batch record from Supabase
    await supabaseService.deleteProductionBatch(batchId);
    setProductionBatches(prev => prev.filter(b => b.id !== batchId));

    await addDeletionLogEntry({
      entity_type: 'production_batch',
      entity_id: batchId,
      entity_title: `Batch ${targetBatch.batch_number} (${targetBatch.product_name})`,
      action_type: 'reversed_and_deleted',
      impact_summary: `Reversed Production Batch ${targetBatch.batch_number}: Restored raw materials, deducted ${targetBatch.quantity_produced} ${targetBatch.base_unit} finished output.`,
      performed_by: user.name,
      performed_by_role: user.role,
    });

    await loadCloudData();

    return {
      success: true,
      message: `Production Batch ${targetBatch.batch_number} reversed successfully. Consumed raw materials were restored to warehouse stock.`
    };
  };

  // Safe Delete History Checkers
  const checkProductHasHistory = (productId: string): boolean => {
    const hasSales = sales.some(s => s.items?.some(i => i.product_id === productId));
    const hasBatches = productionBatches.some(b => b.product_id === productId);
    const hasFormulation = formulations.some(f => f.product_id === productId);
    return hasSales || hasBatches || hasFormulation;
  };

  const checkRawMaterialHasHistory = (rawMaterialId: string): boolean => {
    const isUsedInFormulations = formulations.some(f => f.items?.some(i => i.raw_material_id === rawMaterialId));
    const isUsedInPurchases = purchases.some(p => p.items?.some(i => i.raw_material_id === rawMaterialId));
    return isUsedInFormulations || isUsedInPurchases;
  };

  const checkFormulationHasHistory = (formulationId: string): boolean => {
    const target = formulations.find(f => f.id === formulationId);
    if (!target) return false;
    return productionBatches.some(b => b.product_id === target.product_id);
  };

  const checkCustomerHasHistory = (customerId: string): boolean => {
    const target = customers.find(c => c.id === customerId);
    const hasSales = sales.some(s => s.customer_id === customerId);
    const hasBalance = target ? Number(target.current_balance || 0) > 0 : false;
    return hasSales || hasBalance;
  };

  const checkSupplierHasHistory = (supplierId: string): boolean => {
    const target = suppliers.find(s => s.id === supplierId);
    const hasPurchases = purchases.some(p => p.supplier_id === supplierId);
    const hasBalance = target ? Number(target.current_balance || 0) > 0 : false;
    return hasPurchases || hasBalance;
  };

  // ==============================================================================
  // PRODUCT ACTIONS (SUPABASE-FIRST)
  // ==============================================================================
  const addProduct = async (prodData: Omit<Product, 'id' | 'created_at'>): Promise<Product> => {
    const baseUnit = prodData.base_unit || (prodData.unit === 'kg' ? 'kg' : 'liter');
    const newProdId = generateId();
    const newProd: Product = {
      ...prodData,
      id: newProdId,
      base_unit: baseUnit,
      pack_sizes: prodData.pack_sizes || [
        {
          id: generateId(),
          product_id: newProdId,
          name: `Standard 1 ${baseUnit === 'kg' ? 'Kg' : 'L'}`,
          size_in_base_unit: 1.0,
          unit_label: baseUnit,
          selling_price: prodData.selling_price,
          is_default: true,
        }
      ],
      is_archived: false,
      created_at: new Date().toISOString(),
    };
    const saved = await supabaseService.upsertProduct(newProd);
    setProducts(prev => [saved, ...prev.filter(p => p.id !== saved.id)]);

    if (saved.current_stock > 0) {
      const movement: StockMovement = {
        id: generateId(),
        product_id: saved.id,
        product_name: saved.name,
        movement_type: 'adjustment',
        quantity: saved.current_stock,
        previous_stock: 0,
        new_stock: saved.current_stock,
        notes: `Initial opening stock (${saved.base_unit})`,
        date: new Date().toISOString(),
        created_by_name: 'Admin',
      };
      await supabaseService.upsertStockMovement(movement);
      setStockMovements(prev => [movement, ...prev]);
    }
    return saved;
  };

  const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product> => {
    const target = products.find(p => p.id === id);
    if (!target) throw new Error('Product not found');
    const updated = { ...target, ...updates, updated_at: new Date().toISOString() };
    const saved = await supabaseService.upsertProduct(updated);
    setProducts(prev => prev.map(p => p.id === id ? saved : p));
    return saved;
  };

  const deleteOrArchiveProduct = async (id: string, user: Profile): Promise<{ action: 'deleted' | 'archived'; message: string }> => {
    const target = products.find(p => p.id === id);
    if (!target) return { action: 'deleted', message: 'Product not found.' };

    const hasSales = sales.some(s => s.items?.some(i => i.product_id === id));
    const hasBatches = productionBatches.some(b => b.product_id === id);
    const hasFormulation = formulations.some(f => f.product_id === id);

    if (!hasSales && !hasBatches && !hasFormulation) {
      await supabaseService.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      await addDeletionLogEntry({
        entity_type: 'product',
        entity_id: id,
        entity_title: target.name,
        action_type: 'deleted',
        impact_summary: `Permanently deleted product "${target.name}" (0 sales, 0 production batches, 0 BOMs).`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'deleted', message: `Product "${target.name}" had no transaction or formulation history and was deleted.` };
    } else {
      const archived = { ...target, is_archived: true, is_active: false, updated_at: new Date().toISOString() };
      await supabaseService.upsertProduct(archived);
      setProducts(prev => prev.map(p => p.id === id ? archived : p));
      await addDeletionLogEntry({
        entity_type: 'product',
        entity_id: id,
        entity_title: target.name,
        action_type: 'archived',
        impact_summary: `Archived product "${target.name}" with sales/BOM links to preserve ledger & formula history.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Product "${target.name}" has sales or formulation history and was safely archived.` };
    }
  };

  const unarchiveProduct = async (id: string): Promise<void> => {
    const target = products.find(p => p.id === id);
    if (!target) return;
    const unarchived = { ...target, is_archived: false, is_active: true, updated_at: new Date().toISOString() };
    await supabaseService.upsertProduct(unarchived);
    setProducts(prev => prev.map(p => p.id === id ? unarchived : p));
  };

  const adjustStock = async (productId: string, qtyDiff: number, type: StockMovementType, notes: string, userName: string): Promise<void> => {
    const target = products.find(p => p.id === productId);
    if (!target) return;

    const prevStock = Number(target.current_stock);
    const newStock = Math.max(0, prevStock + qtyDiff);

    const updatedProd = { ...target, current_stock: newStock, updated_at: new Date().toISOString() };
    await supabaseService.upsertProduct(updatedProd);
    setProducts(prev => prev.map(p => p.id === productId ? updatedProd : p));

    const movement: StockMovement = {
      id: generateId(),
      product_id: productId,
      product_name: target.name,
      movement_type: type,
      quantity: qtyDiff,
      previous_stock: prevStock,
      new_stock: newStock,
      notes: notes || `Manual ${type} adjustment (${target.base_unit || target.unit})`,
      date: new Date().toISOString(),
      created_by_name: userName,
    };

    await supabaseService.upsertStockMovement(movement);
    setStockMovements(prev => [movement, ...prev]);
  };

  const updateProductPackSizes = async (productId: string, packSizes: PackSize[]): Promise<void> => {
    const target = products.find(p => p.id === productId);
    if (!target) return;
    const updated = { ...target, pack_sizes: packSizes, updated_at: new Date().toISOString() };
    await supabaseService.upsertProduct(updated);
    setProducts(prev => prev.map(p => p.id === productId ? updated : p));
  };

  // ==============================================================================
  // CUSTOMER ACTIONS (SUPABASE-FIRST)
  // ==============================================================================
  const addCustomer = async (custData: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> => {
    const newCust: Customer = {
      ...custData,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    const saved = await supabaseService.upsertCustomer(newCust);
    setCustomers(prev => [saved, ...prev.filter(c => c.id !== saved.id)]);
    return saved;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    const target = customers.find(c => c.id === id);
    if (!target) throw new Error('Customer not found');
    const updated = { ...target, ...updates, updated_at: new Date().toISOString() };
    const saved = await supabaseService.upsertCustomer(updated);
    setCustomers(prev => prev.map(c => c.id === id ? saved : c));
    return saved;
  };

  const deleteOrArchiveCustomer = async (id: string, user: Profile): Promise<{ action: 'deleted' | 'archived'; message: string }> => {
    const target = customers.find(c => c.id === id);
    if (!target) return { action: 'deleted', message: 'Customer not found.' };

    const hasSales = sales.some(s => s.customer_id === id);

    if (!hasSales) {
      await supabaseService.deleteCustomer(id);
      setCustomers(prev => prev.filter(c => c.id !== id));
      await addDeletionLogEntry({
        entity_type: 'customer',
        entity_id: id,
        entity_title: target.name,
        action_type: 'deleted',
        impact_summary: `Permanently deleted customer "${target.name}" (0 sales invoices).`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'deleted', message: `Customer "${target.name}" had no sales history and was deleted.` };
    } else {
      const archived = { ...target, is_archived: true, is_active: false, updated_at: new Date().toISOString() };
      await supabaseService.upsertCustomer(archived);
      setCustomers(prev => prev.map(c => c.id === id ? archived : c));
      await addDeletionLogEntry({
        entity_type: 'customer',
        entity_id: id,
        entity_title: target.name,
        action_type: 'archived',
        impact_summary: `Archived customer "${target.name}" with outstanding/historical sales to protect ledger integrity.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Customer "${target.name}" has sales invoice history and was safely archived.` };
    }
  };

  const unarchiveCustomer = async (id: string): Promise<void> => {
    const target = customers.find(c => c.id === id);
    if (!target) return;
    const unarchived = { ...target, is_archived: false, is_active: true, updated_at: new Date().toISOString() };
    await supabaseService.upsertCustomer(unarchived);
    setCustomers(prev => prev.map(c => c.id === id ? unarchived : c));
  };

  // ==============================================================================
  // SUPPLIER ACTIONS (SUPABASE-FIRST)
  // ==============================================================================
  const addSupplier = async (suppData: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> => {
    const newSupp: Supplier = {
      ...suppData,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    const saved = await supabaseService.upsertSupplier(newSupp);
    setSuppliers(prev => [saved, ...prev.filter(s => s.id !== saved.id)]);
    return saved;
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<Supplier> => {
    const target = suppliers.find(s => s.id === id);
    if (!target) throw new Error('Supplier not found');
    const updated = { ...target, ...updates, updated_at: new Date().toISOString() };
    const saved = await supabaseService.upsertSupplier(updated);
    setSuppliers(prev => prev.map(s => s.id === id ? saved : s));
    return saved;
  };

  const deleteOrArchiveSupplier = async (id: string, user: Profile): Promise<{ action: 'deleted' | 'archived'; message: string }> => {
    const target = suppliers.find(s => s.id === id);
    if (!target) return { action: 'deleted', message: 'Supplier not found.' };

    const hasPurchases = purchases.some(p => p.supplier_id === id);

    if (!hasPurchases) {
      await supabaseService.deleteSupplier(id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      await addDeletionLogEntry({
        entity_type: 'supplier',
        entity_id: id,
        entity_title: target.name,
        action_type: 'deleted',
        impact_summary: `Permanently deleted supplier "${target.name}" (0 purchase orders).`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'deleted', message: `Supplier "${target.name}" had no purchase history and was deleted.` };
    } else {
      const archived = { ...target, is_archived: true, is_active: false, updated_at: new Date().toISOString() };
      await supabaseService.upsertSupplier(archived);
      setSuppliers(prev => prev.map(s => s.id === id ? archived : s));
      await addDeletionLogEntry({
        entity_type: 'supplier',
        entity_id: id,
        entity_title: target.name,
        action_type: 'archived',
        impact_summary: `Archived supplier "${target.name}" with transaction history to preserve payables audit trail.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Supplier "${target.name}" has purchase history and was safely archived.` };
    }
  };

  const unarchiveSupplier = async (id: string): Promise<void> => {
    const target = suppliers.find(s => s.id === id);
    if (!target) return;
    const unarchived = { ...target, is_archived: false, is_active: true, updated_at: new Date().toISOString() };
    await supabaseService.upsertSupplier(unarchived);
    setSuppliers(prev => prev.map(s => s.id === id ? unarchived : s));
  };

  // ==============================================================================
  // TRANSACTIONS: SALE ENTRY & SALE DELETION (SUPABASE-FIRST)
  // ==============================================================================
  const createSale = async (saleData: Omit<Sale, 'id' | 'invoice_number' | 'created_at'>): Promise<Sale> => {
    const invoiceNum = generateInvoiceNumber('INV');
    const newSale: Sale = {
      ...saleData,
      id: generateId(),
      invoice_number: invoiceNum,
      created_at: new Date().toISOString(),
    };

    const savedSale = await supabaseService.upsertSale(newSale);
    setSales(prev => [savedSale, ...prev]);

    // Deduct stock for each sold product or raw material
    const movementsToAdd: StockMovement[] = [];
    const rawMovementsToAdd: RawMaterialMovement[] = [];
    const updatedRawMaterials: RawMaterial[] = [...rawMaterials];

    try {
      for (const item of savedSale.items) {
        if (item.raw_material_id || item.item_type === 'raw_material') {
          const rmId = item.raw_material_id!;
          const rmIdx = updatedRawMaterials.findIndex(m => m.id === rmId);
          if (rmIdx !== -1) {
            const rm = updatedRawMaterials[rmIdx];
            const deductQty = Number(item.quantity);
            const prevStk = Number(rm.current_stock);
            const nextStk = Math.max(0, Number((prevStk - deductQty).toFixed(4)));
            const updatedRm = { ...rm, current_stock: nextStk, updated_at: new Date().toISOString() };
            updatedRawMaterials[rmIdx] = updatedRm;
            await supabaseService.upsertRawMaterial(updatedRm);

            const rmMvt: RawMaterialMovement = {
              id: generateId(),
              raw_material_id: rm.id,
              raw_material_name: rm.name,
              movement_type: 'sale_out',
              quantity: -deductQty,
              previous_stock: prevStk,
              new_stock: nextStk,
              reference_id: savedSale.id,
              notes: `Sold directly via Invoice ${invoiceNum} (${deductQty} ${rm.unit})`,
              date: savedSale.date,
              created_by_name: savedSale.salesperson_name,
            };
            await supabaseService.upsertRawMaterialMovement(rmMvt);
            rawMovementsToAdd.push(rmMvt);
          }
        } else {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            const deductBaseQty = item.base_quantity || item.quantity;
            const prevStk = Number(prod.current_stock);
            const nextStk = Math.max(0, prevStk - deductBaseQty);
            const updatedProd = { ...prod, current_stock: nextStk, updated_at: new Date().toISOString() };
            await supabaseService.upsertProduct(updatedProd);

            const mvt: StockMovement = {
              id: generateId(),
              product_id: prod.id,
              product_name: prod.name,
              movement_type: 'sale_out',
              quantity: -deductBaseQty,
              previous_stock: prevStk,
              new_stock: nextStk,
              reference_id: savedSale.id,
              notes: `Sold via Invoice ${invoiceNum} (${item.pack_size_name ? `${item.quantity}x ${item.pack_size_name}` : `${deductBaseQty} ${prod.base_unit || prod.unit}`})`,
              date: savedSale.date,
              created_by_name: savedSale.salesperson_name,
            };
            await supabaseService.upsertStockMovement(mvt);
            movementsToAdd.push(mvt);
          }
        }
      }

      setStockMovements(prev => [...movementsToAdd, ...prev]);
      if (rawMovementsToAdd.length > 0) {
        setRawMaterials(updatedRawMaterials);
        setRawMaterialMovements(prev => [...rawMovementsToAdd, ...prev]);
      }
    } catch (stockErr) {
      console.warn('Error during inventory stock deduction for sale:', stockErr);
    }

    // Update customer balance if credit sale
    const unpaid = savedSale.total_amount - savedSale.amount_paid;
    if (savedSale.customer_id && unpaid > 0) {
      const cust = customers.find(c => c.id === savedSale.customer_id);
      if (cust) {
        const updatedCust = { ...cust, current_balance: Number(((cust.current_balance || 0) + unpaid).toFixed(2)), updated_at: new Date().toISOString() };
        await supabaseService.upsertCustomer(updatedCust);
        setCustomers(prev => prev.map(c => c.id === savedSale.customer_id ? updatedCust : c));
      }
    }

    // Log payment if paid
    if (savedSale.amount_paid > 0) {
      const pay: Payment = {
        id: generateId(),
        related_to: 'sale',
        reference_id: savedSale.id,
        reference_no: savedSale.invoice_number,
        customer_id: savedSale.customer_id,
        customer_name: savedSale.customer_name,
        amount: savedSale.amount_paid,
        payment_method: savedSale.payment_method,
        notes: `Received for invoice ${invoiceNum}`,
        date: savedSale.date,
        created_by: savedSale.salesperson_name,
        created_at: new Date().toISOString(),
      };
      const savedPay = await supabaseService.upsertPayment(pay);
      setPayments(prev => [savedPay, ...prev]);
    }

    return savedSale;
  };

  const deleteSaleInvoice = async (saleId: string, user: Profile): Promise<{ success: boolean; message: string }> => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) return { success: false, message: 'Sale invoice not found.' };

    const now = new Date().toISOString();

    // 1. Restore finished products and raw materials stock
    for (const item of targetSale.items) {
      if (item.raw_material_id || item.item_type === 'raw_material') {
        const rm = rawMaterials.find(m => m.id === item.raw_material_id);
        if (rm) {
          const addBackQty = Number(item.quantity);
          const prevStk = Number(rm.current_stock);
          const nextStk = Number((prevStk + addBackQty).toFixed(4));
          const updatedRm = { ...rm, current_stock: nextStk, updated_at: now };
          await supabaseService.upsertRawMaterial(updatedRm);

          const rmMvt: RawMaterialMovement = {
            id: generateId(),
            raw_material_id: rm.id,
            raw_material_name: rm.name,
            movement_type: 'return',
            quantity: addBackQty,
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: targetSale.invoice_number,
            notes: `Restored from deleted invoice ${targetSale.invoice_number}`,
            date: now,
            created_by_name: user.name,
          };
          await supabaseService.upsertRawMaterialMovement(rmMvt);
        }
      } else {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          const addBackBaseQty = item.base_quantity || item.quantity;
          const prevStk = Number(prod.current_stock);
          const nextStk = prevStk + addBackBaseQty;
          const updatedProd = { ...prod, current_stock: nextStk, updated_at: now };
          await supabaseService.upsertProduct(updatedProd);

          const mvt: StockMovement = {
            id: generateId(),
            product_id: prod.id,
            product_name: prod.name,
            movement_type: 'return',
            quantity: addBackBaseQty,
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: targetSale.invoice_number,
            notes: `Restored from deleted invoice ${targetSale.invoice_number}`,
            date: now,
            created_by_name: user.name,
          };
          await supabaseService.upsertStockMovement(mvt);
        }
      }
    }

    // 2. Reverse customer balance
    const unpaid = targetSale.total_amount - targetSale.amount_paid;
    if (targetSale.customer_id && unpaid > 0) {
      const cust = customers.find(c => c.id === targetSale.customer_id);
      if (cust) {
        const updatedCust = { ...cust, current_balance: Math.max(0, (cust.current_balance || 0) - unpaid), updated_at: now };
        await supabaseService.upsertCustomer(updatedCust);
      }
    }

    // 3. Delete associated payments/receipts from Supabase
    const associatedSalePayments = payments.filter(p => 
      (p.related_to === 'sale' && (p.reference_id === saleId || p.reference_no === targetSale.invoice_number || p.notes?.includes(targetSale.invoice_number))) ||
      p.reference_id === saleId ||
      (p.reference_no && p.reference_no === targetSale.invoice_number)
    );
    for (const pay of associatedSalePayments) {
      try {
        await supabaseService.deletePayment(pay.id);
      } catch (err) {
        console.warn('Could not auto-delete associated sale payment record:', err);
      }
    }
    setPayments(prev => prev.filter(p => !associatedSalePayments.some(ap => ap.id === p.id)));

    // 4. Delete sale invoice record from Supabase
    await supabaseService.deleteSale(saleId);
    setSales(prev => prev.filter(s => s.id !== saleId));

    await addDeletionLogEntry({
      entity_type: 'sale',
      entity_id: saleId,
      entity_title: `Invoice ${targetSale.invoice_number}`,
      action_type: 'deleted',
      impact_summary: `Deleted Invoice ${targetSale.invoice_number}: Restored finished goods inventory, adjusted customer balance.`,
      performed_by: user.name,
      performed_by_role: user.role,
    });

    await loadCloudData();

    return {
      success: true,
      message: `Invoice ${targetSale.invoice_number} successfully deleted. Inventory and customer balances were restored.`
    };
  };

  // ==============================================================================
  // TRANSACTIONS: PURCHASE ENTRY & PURCHASE DELETION (SUPABASE-FIRST)
  // ==============================================================================
  const createPurchase = async (purchaseData: Omit<Purchase, 'id' | 'invoice_number' | 'created_at'>): Promise<Purchase> => {
    const invoiceNum = generateInvoiceNumber('PO');
    const newPurchase: Purchase = {
      ...purchaseData,
      id: generateId(),
      invoice_number: invoiceNum,
      created_at: new Date().toISOString(),
    };

    const savedPurchase = await supabaseService.upsertPurchase(newPurchase);
    setPurchases(prev => [savedPurchase, ...prev]);

    // Raw Materials addition
    for (const item of savedPurchase.items) {
      if (item.raw_material_id) {
        const rm = rawMaterials.find(r => r.id === item.raw_material_id);
        if (rm) {
          const prevStk = Number(rm.current_stock);
          const nextStk = prevStk + Number(item.quantity);
          const updatedRm = { ...rm, current_stock: nextStk, cost_per_unit: item.unit_cost || rm.cost_per_unit, updated_at: new Date().toISOString() };
          await supabaseService.upsertRawMaterial(updatedRm);

          const rmMvt: RawMaterialMovement = {
            id: generateId(),
            raw_material_id: rm.id,
            raw_material_name: rm.name,
            movement_type: 'purchase_in',
            quantity: Number(item.quantity),
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: savedPurchase.invoice_number,
            notes: `Received from PO ${invoiceNum} (${savedPurchase.supplier_name})`,
            date: savedPurchase.date,
          };
          await supabaseService.upsertRawMaterialMovement(rmMvt);
        }
      }

      // Finished goods addition
      if (item.product_id) {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          const prevStk = Number(prod.current_stock);
          const nextStk = prevStk + Number(item.quantity);
          const updatedProd = { ...prod, current_stock: nextStk, cost_price: item.unit_cost || prod.cost_price, updated_at: new Date().toISOString() };
          await supabaseService.upsertProduct(updatedProd);

          const prodMvt: StockMovement = {
            id: generateId(),
            product_id: prod.id,
            product_name: prod.name,
            movement_type: 'purchase_in',
            quantity: Number(item.quantity),
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: savedPurchase.id,
            notes: `Received from PO ${invoiceNum} (${savedPurchase.supplier_name})`,
            date: savedPurchase.date,
          };
          await supabaseService.upsertStockMovement(prodMvt);
        }
      }
    }

    // Update supplier balance if unpaid
    const unpaid = savedPurchase.total_amount - savedPurchase.amount_paid;
    if (savedPurchase.supplier_id && unpaid > 0) {
      const supp = suppliers.find(s => s.id === savedPurchase.supplier_id);
      if (supp) {
        const updatedSupp = { ...supp, current_balance: (supp.current_balance || 0) + unpaid, updated_at: new Date().toISOString() };
        await supabaseService.upsertSupplier(updatedSupp);
        setSuppliers(prev => prev.map(s => s.id === savedPurchase.supplier_id ? updatedSupp : s));
      }
    }

    // Log payment made
    if (savedPurchase.amount_paid > 0) {
      const pay: Payment = {
        id: generateId(),
        related_to: 'purchase',
        reference_id: savedPurchase.id,
        reference_no: savedPurchase.invoice_number,
        supplier_id: savedPurchase.supplier_id,
        supplier_name: savedPurchase.supplier_name,
        amount: savedPurchase.amount_paid,
        payment_method: savedPurchase.payment_method,
        notes: `Paid to supplier for PO ${invoiceNum}`,
        date: savedPurchase.date,
        created_at: new Date().toISOString(),
      };
      const savedPay = await supabaseService.upsertPayment(pay);
      setPayments(prev => [savedPay, ...prev]);
    }

    return savedPurchase;
  };

  const deletePurchaseInvoice = async (
    purchaseId: string, 
    user: Profile, 
    forceAllowNegativeStock: boolean = false
  ): Promise<{ success: boolean; hasNegativeStockWarning?: boolean; warningDetails?: string[]; message: string }> => {
    const targetPurchase = purchases.find(p => p.id === purchaseId);
    if (!targetPurchase) return { success: false, message: 'Purchase order not found.' };

    const warningDetails: string[] = [];

    // Verify negative stock risks
    for (const item of targetPurchase.items) {
      if (item.raw_material_id) {
        const rm = rawMaterials.find(r => r.id === item.raw_material_id);
        const currentStk = rm ? Number(rm.current_stock) : 0;
        const wouldBeStk = currentStk - Number(item.quantity);
        if (wouldBeStk < 0) {
          warningDetails.push(`Raw Material "${item.product_or_material_name}": Current stock is ${currentStk} ${rm?.unit}, PO received ${item.quantity}. Stock would become negative (${wouldBeStk}).`);
        }
      }
      if (item.product_id) {
        const prod = products.find(p => p.id === item.product_id);
        const currentStk = prod ? Number(prod.current_stock) : 0;
        const wouldBeStk = currentStk - Number(item.quantity);
        if (wouldBeStk < 0) {
          warningDetails.push(`Product "${item.product_or_material_name}": Current stock is ${currentStk} ${prod?.base_unit || prod?.unit}, PO received ${item.quantity}. Stock would become negative (${wouldBeStk}).`);
        }
      }
    }

    if (warningDetails.length > 0 && !forceAllowNegativeStock) {
      return {
        success: false,
        hasNegativeStockWarning: true,
        warningDetails,
        message: 'Reversing this purchase order will cause negative inventory balances.'
      };
    }

    const now = new Date().toISOString();

    // 1. Subtract received inventory
    for (const item of targetPurchase.items) {
      if (item.raw_material_id) {
        const rm = rawMaterials.find(r => r.id === item.raw_material_id);
        if (rm) {
          const prevStk = Number(rm.current_stock);
          const nextStk = Math.max(0, prevStk - Number(item.quantity));
          const updatedRm = { ...rm, current_stock: nextStk, updated_at: now };
          await supabaseService.upsertRawMaterial(updatedRm);

          const rmMvt: RawMaterialMovement = {
            id: generateId(),
            raw_material_id: rm.id,
            raw_material_name: rm.name,
            movement_type: 'adjustment',
            quantity: -Number(item.quantity),
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: targetPurchase.invoice_number,
            notes: `Subtracted due to deleted PO ${targetPurchase.invoice_number}`,
            date: now,
            created_by_name: user.name,
          };
          await supabaseService.upsertRawMaterialMovement(rmMvt);
        }
      }

      if (item.product_id) {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          const prevStk = Number(prod.current_stock);
          const nextStk = Math.max(0, prevStk - Number(item.quantity));
          const updatedProd = { ...prod, current_stock: nextStk, updated_at: now };
          await supabaseService.upsertProduct(updatedProd);

          const prodMvt: StockMovement = {
            id: generateId(),
            product_id: prod.id,
            product_name: prod.name,
            movement_type: 'adjustment',
            quantity: -Number(item.quantity),
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: targetPurchase.invoice_number,
            notes: `Subtracted due to deleted PO ${targetPurchase.invoice_number}`,
            date: now,
            created_by_name: user.name,
          };
          await supabaseService.upsertStockMovement(prodMvt);
        }
      }
    }

    // 2. Reverse supplier balance
    const unpaid = targetPurchase.total_amount - targetPurchase.amount_paid;
    if (targetPurchase.supplier_id && unpaid > 0) {
      const supp = suppliers.find(s => s.id === targetPurchase.supplier_id);
      if (supp) {
        const updatedSupp = { ...supp, current_balance: Math.max(0, (supp.current_balance || 0) - unpaid), updated_at: now };
        await supabaseService.upsertSupplier(updatedSupp);
      }
    }

    // 3. Delete associated payments/disbursements from Supabase
    const associatedPurchPayments = payments.filter(p => 
      (p.related_to === 'purchase' && (p.reference_id === purchaseId || p.reference_no === targetPurchase.invoice_number || p.notes?.includes(targetPurchase.invoice_number))) ||
      p.reference_id === purchaseId ||
      (p.reference_no && p.reference_no === targetPurchase.invoice_number)
    );
    for (const pay of associatedPurchPayments) {
      try {
        await supabaseService.deletePayment(pay.id);
      } catch (err) {
        console.warn('Could not auto-delete associated purchase payment record:', err);
      }
    }
    setPayments(prev => prev.filter(p => !associatedPurchPayments.some(ap => ap.id === p.id)));

    // 4. Delete PO record from Supabase
    await supabaseService.deletePurchase(purchaseId);
    setPurchases(prev => prev.filter(p => p.id !== purchaseId));

    await addDeletionLogEntry({
      entity_type: 'purchase',
      entity_id: purchaseId,
      entity_title: `Purchase Order ${targetPurchase.invoice_number}`,
      action_type: 'deleted',
      impact_summary: `Deleted PO ${targetPurchase.invoice_number}: Deducted received warehouse items, adjusted supplier balance.`,
      performed_by: user.name,
      performed_by_role: user.role,
    });

    await loadCloudData();

    return {
      success: true,
      message: `Purchase order ${targetPurchase.invoice_number} successfully deleted. Inventory and supplier ledger adjusted.`
    };
  };

  // ==============================================================================
  // RECORD DIRECT PAYMENT (SUPABASE-FIRST)
  // ==============================================================================
  const recordPayment = async (paymentData: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> => {
    const newPayment: Payment = {
      ...paymentData,
      id: generateId(),
      created_at: new Date().toISOString(),
    };

    const savedPayment = await supabaseService.upsertPayment(newPayment);
    setPayments(prev => [savedPayment, ...prev]);

    // Customer payment
    if (newPayment.customer_id) {
      const cust = customers.find(c => c.id === newPayment.customer_id);
      if (cust) {
        const updatedCust = { ...cust, current_balance: Math.max(0, (cust.current_balance || 0) - newPayment.amount), updated_at: new Date().toISOString() };
        await supabaseService.upsertCustomer(updatedCust);
        setCustomers(prev => prev.map(c => c.id === newPayment.customer_id ? updatedCust : c));
      }

      if (newPayment.reference_id && newPayment.related_to === 'sale') {
        const sale = sales.find(s => s.id === newPayment.reference_id);
        if (sale) {
          const newPaid = Number(sale.amount_paid) + newPayment.amount;
          const status = newPaid >= sale.total_amount ? 'paid' : 'partial';
          const updatedSale: Sale = { ...sale, amount_paid: newPaid, payment_status: status };
          await supabaseService.upsertSale(updatedSale);
          setSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
        }
      }
    }

    // Supplier payment
    if (newPayment.supplier_id) {
      const supp = suppliers.find(s => s.id === newPayment.supplier_id);
      if (supp) {
        const updatedSupp = { ...supp, current_balance: Math.max(0, (supp.current_balance || 0) - newPayment.amount), updated_at: new Date().toISOString() };
        await supabaseService.upsertSupplier(updatedSupp);
        setSuppliers(prev => prev.map(s => s.id === newPayment.supplier_id ? updatedSupp : s));
      }

      if (newPayment.reference_id && newPayment.related_to === 'purchase') {
        const po = purchases.find(p => p.id === newPayment.reference_id);
        if (po) {
          const newPaid = Number(po.amount_paid) + newPayment.amount;
          const status = newPaid >= po.total_amount ? 'paid' : 'partial';
          const updatedPO: Purchase = { ...po, amount_paid: newPaid, payment_status: status };
          await supabaseService.upsertPurchase(updatedPO);
          setPurchases(prev => prev.map(p => p.id === po.id ? updatedPO : p));
        }
      }
    }

    return savedPayment;
  };

  const deletePayment = async (paymentId: string): Promise<void> => {
    const target = payments.find(p => p.id === paymentId);
    await supabaseService.deletePayment(paymentId);
    setPayments(prev => prev.filter(p => p.id !== paymentId));

    if (target) {
      // Revert sale amount_paid if this payment was for a specific sale
      if (target.related_to === 'sale' && target.reference_id) {
        const sale = sales.find(s => s.id === target.reference_id || s.invoice_number === target.reference_id);
        if (sale) {
          const newPaid = Math.max(0, Number(sale.amount_paid || 0) - Number(target.amount || 0));
          const status = newPaid === 0 ? 'unpaid' : (newPaid >= sale.total_amount ? 'paid' : 'partial');
          const updatedSale: Sale = { ...sale, amount_paid: newPaid, payment_status: status };
          await supabaseService.upsertSale(updatedSale);
          setSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
        }
      }
      // Revert customer balance if this payment was a balance credit
      if (target.customer_id && target.related_to === 'customer_balance') {
        const cust = customers.find(c => c.id === target.customer_id);
        if (cust) {
          const updatedCust = { ...cust, current_balance: Number(((cust.current_balance || 0) + Number(target.amount || 0)).toFixed(2)), updated_at: new Date().toISOString() };
          await supabaseService.upsertCustomer(updatedCust);
          setCustomers(prev => prev.map(c => c.id === cust.id ? updatedCust : c));
        }
      }
      // Revert purchase amount_paid if this payment was for a specific PO
      if (target.related_to === 'purchase' && target.reference_id) {
        const po = purchases.find(p => p.id === target.reference_id || p.invoice_number === target.reference_id);
        if (po) {
          const newPaid = Math.max(0, Number(po.amount_paid || 0) - Number(target.amount || 0));
          const status = newPaid === 0 ? 'unpaid' : (newPaid >= po.total_amount ? 'paid' : 'partial');
          const updatedPO: Purchase = { ...po, amount_paid: newPaid, payment_status: status };
          await supabaseService.upsertPurchase(updatedPO);
          setPurchases(prev => prev.map(p => p.id === po.id ? updatedPO : p));
        }
      }
      // Revert supplier balance if this payment was a balance disbursement
      if (target.supplier_id && target.related_to === 'supplier_balance') {
        const supp = suppliers.find(s => s.id === target.supplier_id);
        if (supp) {
          const updatedSupp = { ...supp, current_balance: Number(((supp.current_balance || 0) + Number(target.amount || 0)).toFixed(2)), updated_at: new Date().toISOString() };
          await supabaseService.upsertSupplier(updatedSupp);
          setSuppliers(prev => prev.map(s => s.id === supp.id ? updatedSupp : s));
        }
      }
    }
  };

  // ==============================================================================
  // EXPENSES ACTIONS (SUPABASE-FIRST + AUTOMATIC CASHBOOK OUTFLOW TRACKING)
  // ==============================================================================
  const addExpense = async (
    expenseData: Omit<Expense, 'id' | 'created_at'>, 
    user: Profile
  ): Promise<Expense> => {
    const newExpenseId = generateId();
    const newExpense: Expense = {
      ...expenseData,
      id: newExpenseId,
      amount: Number(expenseData.amount || 0),
      recorded_by: user.id,
      recorded_by_name: user.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const savedExpense = await supabaseService.upsertExpense(newExpense);
    setExpenses(prev => [savedExpense, ...prev.filter(e => e.id !== savedExpense.id)]);

    // Automatically log outgoing payment in Cash Book (payments table) so all factory money out is tracked together
    try {
      const paymentDesc = savedExpense.description 
        ? `${savedExpense.category}: ${savedExpense.description}` 
        : `Operating Expense (${savedExpense.category})`;

      const expensePayment: Payment = {
        id: generateId(),
        related_to: 'expense',
        reference_id: savedExpense.id,
        reference_no: savedExpense.category,
        amount: Number(savedExpense.amount),
        payment_method: savedExpense.payment_method,
        notes: paymentDesc,
        date: savedExpense.date || new Date().toISOString(),
        created_by: user.name,
        created_at: new Date().toISOString(),
      };
      const savedPayment = await supabaseService.upsertPayment(expensePayment);
      setPayments(prev => [savedPayment, ...prev.filter(p => p.id !== savedPayment.id)]);
    } catch (payErr) {
      console.warn('Could not auto-record expense cashbook voucher in payments:', payErr);
    }

    // If marked as recurring, ensure a template is saved or updated in recurring_expenses
    if (savedExpense.is_recurring) {
      const monthKey = savedExpense.date ? savedExpense.date.slice(0, 7) : new Date().toISOString().slice(0, 7);
      const existing = recurringExpenses.find(
        r => r.category.toLowerCase() === savedExpense.category.toLowerCase() && 
             r.description.toLowerCase() === (savedExpense.description || '').toLowerCase()
      );
      if (!existing) {
        const rec: RecurringExpense = {
          id: generateId(),
          category: savedExpense.category,
          description: savedExpense.description || `${savedExpense.category} Monthly Overhead`,
          amount: savedExpense.amount,
          payment_method: savedExpense.payment_method,
          is_active: true,
          last_posted_month: monthKey,
          created_by: user.name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const savedRec = await supabaseService.upsertRecurringExpense(rec);
        setRecurringExpenses(prev => [savedRec, ...prev]);
      } else {
        const updatedRec: RecurringExpense = { 
          ...existing, 
          last_posted_month: monthKey, 
          amount: savedExpense.amount,
          updated_at: new Date().toISOString() 
        };
        await supabaseService.upsertRecurringExpense(updatedRec);
        setRecurringExpenses(prev => prev.map(r => r.id === existing.id ? updatedRec : r));
      }
    }

    return savedExpense;
  };

  const deleteExpense = async (id: string, user: Profile): Promise<{ success: boolean; message: string }> => {
    const target = expenses.find(e => e.id === id);
    if (!target) return { success: false, message: 'Expense not found.' };

    await supabaseService.deleteExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id));

    // Also reverse and remove the associated cash outflow voucher in payments table
    const associatedPayment = payments.find(p => 
      (p.related_to === 'expense' || p.notes?.includes('[Expense Outflow:')) && p.reference_id === id
    );
    if (associatedPayment) {
      try {
        await supabaseService.deletePayment(associatedPayment.id);
        setPayments(prev => prev.filter(p => p.id !== associatedPayment.id));
      } catch (err) {
        console.warn('Could not auto-delete associated payment record:', err);
      }
    }

    await addDeletionLogEntry({
      entity_type: 'expense',
      entity_id: id,
      entity_title: `${target.category} - ${formatPKR(target.amount)}`,
      action_type: 'deleted',
      impact_summary: `Deleted operating expense "${target.category}" (PKR ${target.amount}). Outgoing cash voucher reversed.`,
      performed_by: user.name,
      performed_by_role: user.role,
    });

    return {
      success: true,
      message: `Expense "${target.category}" (${formatPKR(target.amount)}) removed and cash voucher reversed.`
    };
  };

  const addRecurringExpense = async (data: Omit<RecurringExpense, 'id' | 'created_at'>): Promise<RecurringExpense> => {
    const newRec: RecurringExpense = {
      ...data,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const saved = await supabaseService.upsertRecurringExpense(newRec);
    setRecurringExpenses(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
    return saved;
  };

  const updateRecurringExpense = async (id: string, updates: Partial<RecurringExpense>): Promise<RecurringExpense> => {
    const target = recurringExpenses.find(r => r.id === id);
    if (!target) throw new Error('Recurring expense template not found');
    const updated = { ...target, ...updates, updated_at: new Date().toISOString() };
    const saved = await supabaseService.upsertRecurringExpense(updated);
    setRecurringExpenses(prev => prev.map(r => r.id === id ? saved : r));
    return saved;
  };

  const deleteRecurringExpense = async (id: string): Promise<void> => {
    await supabaseService.deleteRecurringExpense(id);
    setRecurringExpenses(prev => prev.filter(r => r.id !== id));
  };

  const confirmAndPostRecurringExpense = async (
    recurringId: string, 
    customAmount?: number, 
    customPaymentMethod?: PaymentMethod,
    user?: Profile
  ): Promise<Expense> => {
    const rec = recurringExpenses.find(r => r.id === recurringId);
    if (!rec) throw new Error('Recurring expense template not found');

    const currentUserProfile = user || {
      id: 'system',
      name: 'Accounts Staff',
      email: '',
      role: 'accounts_staff',
      is_active: true,
      created_at: new Date().toISOString()
    };

    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7); // 'YYYY-MM'

    const expensePayload: Omit<Expense, 'id' | 'created_at'> = {
      date: now.toISOString(),
      category: rec.category,
      description: `${rec.description} (${now.toLocaleString('default', { month: 'long', year: 'numeric' })})`,
      amount: customAmount !== undefined ? customAmount : rec.amount,
      payment_method: customPaymentMethod || rec.payment_method || 'bank',
      is_recurring: true,
      recorded_by: currentUserProfile.id,
      recorded_by_name: currentUserProfile.name,
    };

    const savedExpense = await addExpense(expensePayload, currentUserProfile);

    // Update last_posted_month so reminder doesn't prompt again for this calendar month
    const updatedRec: RecurringExpense = {
      ...rec,
      last_posted_month: currentMonthKey,
      updated_at: now.toISOString()
    };
    await supabaseService.upsertRecurringExpense(updatedRec);
    setRecurringExpenses(prev => prev.map(r => r.id === rec.id ? updatedRec : r));

    return savedExpense;
  };

  // Helper: Reset / Clean Slate
  const resetToDefaultData = async () => {
    try {
      await supabaseService.resetAllDatabaseData();
    } catch (err) {
      console.error('Failed to reset cloud database tables:', err);
    }
    if (typeof window !== 'undefined') {
      const keys = [
        'psc_products', 'psc_raw_materials', 'psc_formulations', 'psc_production_batches',
        'psc_raw_movements', 'psc_customers', 'psc_suppliers', 'psc_sales', 'psc_purchases',
        'psc_stock_movements', 'psc_payments', 'psc_expenses', 'psc_recurring_expenses', 'psc_deletion_logs', 'psc_users'
      ];
      keys.forEach(k => localStorage.removeItem(k));
    }
    await loadCloudData();
  };

  return (
    <AppContext.Provider
      value={{
        products,
        rawMaterials,
        formulations,
        productionBatches,
        rawMaterialMovements,
        customers,
        suppliers,
        sales,
        purchases,
        stockMovements,
        payments,
        expenses,
        recurringExpenses,
        deletionLogs,
        isLoadingCloudData,
        cloudSyncError,
        isOnline,
        refreshCloudData: loadCloudData,
        lowStockProducts,
        lowStockRawMaterials,
        totalRawMaterialsValuation,
        totalProductsValuation,
        thisMonthExpenses,
        totalExpenses,
        addRawMaterial,
        updateRawMaterial,
        deleteOrArchiveRawMaterial,
        unarchiveRawMaterial,
        adjustRawMaterialStock,
        saveFormulation,
        deleteOrArchiveFormulation,
        unarchiveFormulation,
        recordProductionBatch,
        deleteProductionBatch,
        checkProductHasHistory,
        checkRawMaterialHasHistory,
        checkFormulationHasHistory,
        checkCustomerHasHistory,
        checkSupplierHasHistory,
        deleteCustomer: deleteOrArchiveCustomer,
        deleteSupplier: deleteOrArchiveSupplier,
        deleteFormulation: deleteOrArchiveFormulation,
        addProduct,
        updateProduct,
        deleteOrArchiveProduct,
        unarchiveProduct,
        adjustStock,
        updateProductPackSizes,
        addCustomer,
        updateCustomer,
        deleteOrArchiveCustomer,
        unarchiveCustomer,
        addSupplier,
        updateSupplier,
        deleteOrArchiveSupplier,
        unarchiveSupplier,
        createSale,
        deleteSaleInvoice,
        createPurchase,
        deletePurchaseInvoice,
        recordPayment,
        deletePayment,
        addExpense,
        deleteExpense,
        addRecurringExpense,
        updateRecurringExpense,
        deleteRecurringExpense,
        confirmAndPostRecurringExpense,
        resetToDefaultData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
