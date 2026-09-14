import React, { createContext, useContext, useState, useEffect } from 'react';
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
  Profile
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_RAW_MATERIALS,
  INITIAL_FORMULATIONS,
  INITIAL_PRODUCTION_BATCHES,
  INITIAL_RAW_MATERIAL_MOVEMENTS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_PAYMENTS
} from '../lib/mockData';
import { generateInvoiceNumber } from '../utils/formatters';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../lib/supabaseService';
import { generateId } from '../utils/uuid';

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
  deletionLogs: DeletionAuditLog[];
  
  // Derived alerts & valuation
  lowStockProducts: Product[];
  lowStockRawMaterials: RawMaterial[];
  totalRawMaterialsValuation: number;
  totalProductsValuation: number;

  // Raw Materials Actions
  addRawMaterial: (material: Omit<RawMaterial, 'id' | 'created_at'>) => void;
  updateRawMaterial: (id: string, updates: Partial<RawMaterial>) => void;
  deleteOrArchiveRawMaterial: (id: string, user: Profile) => { action: 'deleted' | 'archived'; message: string };
  unarchiveRawMaterial: (id: string) => void;
  adjustRawMaterialStock: (rawMaterialId: string, qtyDiff: number, type: RawMaterialMovementType, notes: string, userName: string) => void;

  // Formulation (BOM) Actions
  saveFormulation: (formulation: Omit<ProductFormulation, 'id' | 'created_at'> & { id?: string }) => void;
  deleteOrArchiveFormulation: (id: string, user: Profile) => { action: 'deleted' | 'archived'; message: string };
  unarchiveFormulation: (id: string) => void;

  // Production Module Actions
  recordProductionBatch: (params: {
    productId: string;
    quantityProduced: number;
    batchNumber: string;
    date: string;
    supervisorName: string;
    notes?: string;
  }) => { success: boolean; message: string; batch?: ProductionBatch };
  deleteProductionBatch: (
    batchId: string, 
    user: Profile, 
    forceAllowNegativeStock?: boolean
  ) => { 
    success: boolean; 
    hasNegativeStockWarning?: boolean; 
    warningDetails?: string[]; 
    message: string 
  };

  // Safe Delete / Archive History Checkers
  checkProductHasHistory: (productId: string) => boolean;
  checkRawMaterialHasHistory: (rawMaterialId: string) => boolean;
  checkFormulationHasHistory: (formulationId: string) => boolean;
  checkCustomerHasHistory: (customerId: string) => boolean;
  checkSupplierHasHistory: (supplierId: string) => boolean;

  // Aliases for compatibility
  deleteCustomer: (id: string, user: Profile) => { action: 'deleted' | 'archived'; message: string };
  deleteSupplier: (id: string, user: Profile) => { action: 'deleted' | 'archived'; message: string };
  deleteFormulation: (id: string, user: Profile) => { action: 'deleted' | 'archived'; message: string };

  // Product Actions (Single Base Unit + Pack Sizes + Safe Delete/Archive)
  addProduct: (product: Omit<Product, 'id' | 'created_at'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteOrArchiveProduct: (id: string, user: Profile) => { action: 'deleted' | 'archived'; message: string };
  unarchiveProduct: (id: string) => void;
  adjustStock: (productId: string, qtyDiff: number, type: StockMovementType, notes: string, user: string) => void;
  updateProductPackSizes: (productId: string, packSizes: PackSize[]) => void;

  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'created_at'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteOrArchiveCustomer: (id: string, user: Profile) => { action: 'deleted' | 'archived'; message: string };
  unarchiveCustomer: (id: string) => void;

  // Supplier Actions
  addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at'>) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteOrArchiveSupplier: (id: string, user: Profile) => { action: 'deleted' | 'archived'; message: string };
  unarchiveSupplier: (id: string) => void;

  // Transaction Actions (with Automated Stock & Balance Reversals)
  createSale: (saleData: Omit<Sale, 'id' | 'invoice_number' | 'created_at'>) => Sale;
  deleteSaleInvoice: (saleId: string, user: Profile) => { success: boolean; message: string };
  
  createPurchase: (purchaseData: Omit<Purchase, 'id' | 'invoice_number' | 'created_at'>) => Purchase;
  deletePurchaseInvoice: (purchaseId: string, user: Profile, forceAllowNegativeStock?: boolean) => { 
    success: boolean; 
    hasNegativeStockWarning?: boolean; 
    warningDetails?: string[]; 
    message: string 
  };
  
  recordPayment: (paymentData: Omit<Payment, 'id' | 'created_at'>) => Payment;

  // Helper
  resetToDefaultData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core State with Local Storage persistence & optimistic updates
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('psc_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() => {
    const saved = localStorage.getItem('psc_raw_materials');
    return saved ? JSON.parse(saved) : INITIAL_RAW_MATERIALS;
  });

  const [formulations, setFormulations] = useState<ProductFormulation[]>(() => {
    const saved = localStorage.getItem('psc_formulations');
    return saved ? JSON.parse(saved) : INITIAL_FORMULATIONS;
  });

  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>(() => {
    const saved = localStorage.getItem('psc_production_batches');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTION_BATCHES;
  });

  const [rawMaterialMovements, setRawMaterialMovements] = useState<RawMaterialMovement[]>(() => {
    const saved = localStorage.getItem('psc_raw_movements');
    return saved ? JSON.parse(saved) : INITIAL_RAW_MATERIAL_MOVEMENTS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('psc_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('psc_suppliers');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('psc_sales');
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    const saved = localStorage.getItem('psc_purchases');
    return saved ? JSON.parse(saved) : INITIAL_PURCHASES;
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem('psc_stock_movements');
    return saved ? JSON.parse(saved) : INITIAL_STOCK_MOVEMENTS;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const saved = localStorage.getItem('psc_payments');
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });

  const [deletionLogs, setDeletionLogs] = useState<DeletionAuditLog[]>(() => {
    const saved = localStorage.getItem('psc_deletion_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch live records from Supabase Cloud on mount & subscribe to Realtime multi-device changes
  useEffect(() => {
    let isMounted = true;

    const loadCloudData = async () => {
      const cloudData = await supabaseService.fetchAll();
      if (cloudData && isMounted) {
        if (cloudData.products) setProducts(cloudData.products);
        if (cloudData.rawMaterials) setRawMaterials(cloudData.rawMaterials);
        if (cloudData.formulations) setFormulations(cloudData.formulations);
        if (cloudData.productionBatches) setProductionBatches(cloudData.productionBatches);
        if (cloudData.rawMaterialMovements) setRawMaterialMovements(cloudData.rawMaterialMovements);
        if (cloudData.customers) setCustomers(cloudData.customers);
        if (cloudData.suppliers) setSuppliers(cloudData.suppliers);
        if (cloudData.sales) setSales(cloudData.sales);
        if (cloudData.purchases) setPurchases(cloudData.purchases);
        if (cloudData.stockMovements) setStockMovements(cloudData.stockMovements);
        if (cloudData.payments) setPayments(cloudData.payments);
        if (cloudData.deletionLogs) setDeletionLogs(cloudData.deletionLogs);
      }
    };

    loadCloudData();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('psc-realtime-cloud')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          loadCloudData();
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
  }, []);

  // Cache to local storage for offline resilience
  useEffect(() => { localStorage.setItem('psc_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('psc_raw_materials', JSON.stringify(rawMaterials)); }, [rawMaterials]);
  useEffect(() => { localStorage.setItem('psc_formulations', JSON.stringify(formulations)); }, [formulations]);
  useEffect(() => { localStorage.setItem('psc_production_batches', JSON.stringify(productionBatches)); }, [productionBatches]);
  useEffect(() => { localStorage.setItem('psc_raw_movements', JSON.stringify(rawMaterialMovements)); }, [rawMaterialMovements]);
  useEffect(() => { localStorage.setItem('psc_customers', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('psc_suppliers', JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem('psc_sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('psc_purchases', JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem('psc_stock_movements', JSON.stringify(stockMovements)); }, [stockMovements]);
  useEffect(() => { localStorage.setItem('psc_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('psc_deletion_logs', JSON.stringify(deletionLogs)); }, [deletionLogs]);

  const addDeletionLogEntry = (entry: Omit<DeletionAuditLog, 'id' | 'date'>) => {
    const newLog: DeletionAuditLog = {
      ...entry,
      id: generateId(),
      date: new Date().toISOString(),
    };
    setDeletionLogs(prev => [newLog, ...prev]);
    supabaseService.upsertDeletionLog(newLog);
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

  // ==============================================================================
  // RAW MATERIALS ACTIONS (WITH USAGE & PURCHASE DEPENDENCY CHECK)
  // ==============================================================================
  const addRawMaterial = (matData: Omit<RawMaterial, 'id' | 'created_at'>) => {
    const newMat: RawMaterial = {
      ...matData,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    setRawMaterials(prev => [newMat, ...prev]);
    supabaseService.upsertRawMaterial(newMat);

    if (newMat.current_stock > 0) {
      const movement: RawMaterialMovement = {
        id: generateId(),
        raw_material_id: newMat.id,
        raw_material_name: newMat.name,
        movement_type: 'adjustment',
        quantity: newMat.current_stock,
        previous_stock: 0,
        new_stock: newMat.current_stock,
        notes: 'Initial opening raw material stock',
        date: new Date().toISOString(),
        created_by_name: 'Admin',
      };
      setRawMaterialMovements(prev => [movement, ...prev]);
      supabaseService.upsertRawMaterialMovement(movement);
    }
  };

  const updateRawMaterial = (id: string, updates: Partial<RawMaterial>) => {
    setRawMaterials(prev => prev.map(rm => {
      if (rm.id === id) {
        const updated = { ...rm, ...updates, updated_at: new Date().toISOString() };
        supabaseService.upsertRawMaterial(updated);
        return updated;
      }
      return rm;
    }));
  };

  const deleteOrArchiveRawMaterial = (id: string, user: Profile): { action: 'deleted' | 'archived'; message: string } => {
    const target = rawMaterials.find(rm => rm.id === id);
    if (!target) return { action: 'deleted', message: 'Raw material not found.' };

    const isUsedInFormulations = formulations.some(f => f.items.some(i => i.raw_material_id === id));
    const hasPurchaseHistory = purchases.some(p => p.items.some(i => i.raw_material_id === id));
    const hasProductionHistory = productionBatches.some(b => b.raw_materials_consumed.some(r => r.raw_material_id === id));

    if (!isUsedInFormulations && !hasPurchaseHistory && !hasProductionHistory) {
      // 0 history -> full hard delete
      setRawMaterials(prev => prev.filter(rm => rm.id !== id));
      supabaseService.deleteRawMaterial(id);
      addDeletionLogEntry({
        entity_type: 'raw_material',
        entity_id: id,
        entity_title: target.name,
        action_type: 'deleted',
        impact_summary: `Permanently removed raw material "${target.name}" (no formulation recipe or purchase history found).`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'deleted', message: `Raw material "${target.name}" was permanently deleted.` };
    } else {
      // Has history/recipes -> soft archive
      setRawMaterials(prev => prev.map(rm => {
        if (rm.id === id) {
          const archived = { ...rm, is_archived: true, is_active: false, updated_at: new Date().toISOString() };
          supabaseService.upsertRawMaterial(archived);
          return archived;
        }
        return rm;
      }));
      addDeletionLogEntry({
        entity_type: 'raw_material',
        entity_id: id,
        entity_title: target.name,
        action_type: 'archived',
        impact_summary: `Archived raw material "${target.name}" due to existing formulation recipes and production/purchase history.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Raw material "${target.name}" is used in product recipes or history and was safely archived.` };
    }
  };

  const unarchiveRawMaterial = (id: string) => {
    setRawMaterials(prev => prev.map(rm => {
      if (rm.id === id) {
        const unarchived = { ...rm, is_archived: false, is_active: true, updated_at: new Date().toISOString() };
        supabaseService.upsertRawMaterial(unarchived);
        return unarchived;
      }
      return rm;
    }));
  };

  const adjustRawMaterialStock = (
    rawMaterialId: string, 
    qtyDiff: number, 
    type: RawMaterialMovementType, 
    notes: string, 
    userName: string
  ) => {
    const target = rawMaterials.find(rm => rm.id === rawMaterialId);
    if (!target) return;

    const prevStock = Number(target.current_stock);
    const newStock = Math.max(0, prevStock + qtyDiff);

    updateRawMaterial(rawMaterialId, { current_stock: newStock });

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

    setRawMaterialMovements(prev => [movement, ...prev]);
    supabaseService.upsertRawMaterialMovement(movement);
  };

  // ==============================================================================
  // FORMULATION (BOM) ACTIONS (WITH PRODUCTION HISTORY CHECK)
  // ==============================================================================
  const saveFormulation = (formData: Omit<ProductFormulation, 'id' | 'created_at'> & { id?: string }) => {
    if (formData.id) {
      setFormulations(prev => prev.map(f => {
        if (f.id === formData.id) {
          const updated = { ...f, ...formData, updated_at: new Date().toISOString() };
          supabaseService.upsertFormulation(updated);
          return updated;
        }
        return f;
      }));
    } else {
      const newForm: ProductFormulation = {
        ...formData,
        id: generateId(),
        created_at: new Date().toISOString(),
      };
      setFormulations(prev => [newForm, ...prev]);
      supabaseService.upsertFormulation(newForm);
    }
  };

  const deleteOrArchiveFormulation = (id: string, user: Profile): { action: 'deleted' | 'archived'; message: string } => {
    const target = formulations.find(f => f.id === id);
    if (!target) return { action: 'deleted', message: 'Formulation not found.' };

    const hasProductionHistory = productionBatches.some(b => b.product_id === target.product_id);

    if (!hasProductionHistory) {
      setFormulations(prev => prev.filter(f => f.id !== id));
      supabaseService.deleteFormulation(id);
      addDeletionLogEntry({
        entity_type: 'formulation',
        entity_id: id,
        entity_title: `Recipe for ${target.product_name}`,
        action_type: 'deleted',
        impact_summary: `Permanently removed recipe formulation for "${target.product_name}" (0 production runs).`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'deleted', message: `Formulation recipe for "${target.product_name}" was deleted.` };
    } else {
      setFormulations(prev => prev.map(f => {
        if (f.id === id) {
          const archived = { ...f, is_archived: true, updated_at: new Date().toISOString() };
          supabaseService.upsertFormulation(archived);
          return archived;
        }
        return f;
      }));
      addDeletionLogEntry({
        entity_type: 'formulation',
        entity_id: id,
        entity_title: `Recipe for ${target.product_name}`,
        action_type: 'archived',
        impact_summary: `Archived formulation for "${target.product_name}" to preserve recipe history for past production batches.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Formulation for "${target.product_name}" has production batch history and was archived.` };
    }
  };

  const unarchiveFormulation = (id: string) => {
    setFormulations(prev => prev.map(f => {
      if (f.id === id) {
        const unarchived = { ...f, is_archived: false, updated_at: new Date().toISOString() };
        supabaseService.upsertFormulation(unarchived);
        return unarchived;
      }
      return f;
    }));
  };

  // ==============================================================================
  // PRODUCTION MODULE ACTION
  // ==============================================================================
  const recordProductionBatch = (params: {
    productId: string;
    quantityProduced: number;
    batchNumber: string;
    date: string;
    supervisorName: string;
    notes?: string;
  }): { success: boolean; message: string; batch?: ProductionBatch } => {
    const targetProduct = products.find(p => p.id === params.productId);
    if (!targetProduct) {
      return { success: false, message: 'Selected product not found.' };
    }

    const formulation = formulations.find(f => f.product_id === params.productId);
    if (!formulation || formulation.items.length === 0) {
      return { success: false, message: `No formulation recipe configured for ${targetProduct.name}. Please set up formulation first.` };
    }

    // 1. Calculate required raw materials
    const requiredMaterials = formulation.items.map(item => {
      const rm = rawMaterials.find(m => m.id === item.raw_material_id);
      const totalNeeded = Number((item.quantity * params.quantityProduced).toFixed(4));
      return {
        item,
        rm,
        totalNeeded,
        available: rm ? Number(rm.current_stock) : 0,
      };
    });

    // 2. Validate availability - BLOCK if insufficient
    const shortages = requiredMaterials.filter(rmReq => !rmReq.rm || rmReq.available < rmReq.totalNeeded);
    if (shortages.length > 0) {
      const shortageDetails = shortages
        .map(s => `${s.rm ? s.rm.name : s.item.raw_material_name}: Need ${s.totalNeeded} ${s.item.unit}, Have ${s.available} ${s.item.unit}`)
        .join('\n• ');
      return {
        success: false,
        message: `Cannot proceed with production batch! Insufficient raw material stock:\n• ${shortageDetails}`,
      };
    }

    // 3. Deduct raw materials & log raw material stock movements
    const consumedList: any[] = [];
    let totalBatchCost = 0;
    const now = params.date || new Date().toISOString();

    const updatedRawMaterials = [...rawMaterials];
    const newRawMovements: RawMaterialMovement[] = [];

    requiredMaterials.forEach(rmReq => {
      const rmIndex = updatedRawMaterials.findIndex(m => m.id === rmReq.item.raw_material_id);
      if (rmIndex !== -1) {
        const prevStk = Number(updatedRawMaterials[rmIndex].current_stock);
        const nextStk = Math.max(0, prevStk - rmReq.totalNeeded);
        const unitCost = Number(updatedRawMaterials[rmIndex].cost_per_unit || rmReq.item.cost_per_unit || 0);
        const itemTotalCost = Number((rmReq.totalNeeded * unitCost).toFixed(2));
        
        totalBatchCost += itemTotalCost;

        updatedRawMaterials[rmIndex] = {
          ...updatedRawMaterials[rmIndex],
          current_stock: nextStk,
          updated_at: now,
        };

        consumedList.push({
          raw_material_id: rmReq.item.raw_material_id,
          raw_material_name: rmReq.item.raw_material_name,
          quantity_consumed: rmReq.totalNeeded,
          unit: rmReq.item.unit,
          unit_cost: unitCost,
          total_cost: itemTotalCost,
        });

        newRawMovements.push({
          id: generateId(),
          raw_material_id: rmReq.item.raw_material_id,
          raw_material_name: rmReq.item.raw_material_name,
          movement_type: 'production_out',
          quantity: -rmReq.totalNeeded,
          previous_stock: prevStk,
          new_stock: nextStk,
          reference_id: params.batchNumber,
          notes: `Consumed in Batch ${params.batchNumber} (${targetProduct.name} - ${params.quantityProduced} ${targetProduct.base_unit || targetProduct.unit})`,
          date: now,
          created_by_name: params.supervisorName,
        });
      }
    });

    setRawMaterials(updatedRawMaterials);
    updatedRawMaterials.forEach(rm => supabaseService.upsertRawMaterial(rm));
    setRawMaterialMovements(prev => [...newRawMovements, ...prev]);
    newRawMovements.forEach(m => supabaseService.upsertRawMaterialMovement(m));

    // 4. Add produced quantity to Finished Product Single Base-Unit Stock
    const prevProdStock = Number(targetProduct.current_stock);
    const nextProdStock = prevProdStock + Number(params.quantityProduced);
    const calculatedCostPerUnit = Number((totalBatchCost / params.quantityProduced).toFixed(2));

    let updatedTargetProd: Product | null = null;
    setProducts(prevProds => prevProds.map(p => {
      if (p.id === targetProduct.id) {
        updatedTargetProd = {
          ...p,
          current_stock: nextProdStock,
          cost_price: calculatedCostPerUnit > 0 ? calculatedCostPerUnit : p.cost_price,
          updated_at: now,
        };
        return updatedTargetProd;
      }
      return p;
    }));
    if (updatedTargetProd) {
      supabaseService.upsertProduct(updatedTargetProd);
    }

    // 5. Log finished product stock movement
    const prodStockMovement: StockMovement = {
      id: generateId(),
      product_id: targetProduct.id,
      product_name: targetProduct.name,
      movement_type: 'production',
      quantity: Number(params.quantityProduced),
      previous_stock: prevProdStock,
      new_stock: nextProdStock,
      reference_id: params.batchNumber,
      notes: `Manufactured in Batch ${params.batchNumber}`,
      date: now,
      created_by_name: params.supervisorName,
    };
    setStockMovements(prev => [prodStockMovement, ...prev]);
    supabaseService.upsertStockMovement(prodStockMovement);

    // 6. Create production batch entry
    const newBatch: ProductionBatch = {
      id: generateId(),
      batch_number: params.batchNumber,
      product_id: targetProduct.id,
      product_name: targetProduct.name,
      quantity_produced: Number(params.quantityProduced),
      base_unit: (targetProduct.base_unit || 'liter') as any,
      date: now,
      supervisor_name: params.supervisorName,
      raw_materials_consumed: consumedList,
      total_batch_cost: Number(totalBatchCost.toFixed(2)),
      cost_per_base_unit: calculatedCostPerUnit,
      notes: params.notes,
      created_at: now,
    };

    setProductionBatches(prev => [newBatch, ...prev]);
    supabaseService.upsertProductionBatch(newBatch);

    return {
      success: true,
      message: `Batch ${params.batchNumber} logged successfully! Produced ${params.quantityProduced} ${targetProduct.base_unit || targetProduct.unit} of ${targetProduct.name}.`,
      batch: newBatch,
    };
  };

  const deleteProductionBatch = (
    batchId: string,
    user: Profile,
    forceAllowNegativeStock?: boolean
  ): { success: boolean; hasNegativeStockWarning?: boolean; warningDetails?: string[]; message: string } => {
    const targetBatch = productionBatches.find(b => b.id === batchId);
    if (!targetBatch) return { success: false, message: 'Production batch record not found.' };

    const targetProduct = products.find(p => p.id === targetBatch.product_id);
    const warnings: string[] = [];

    // Check if finished product stock is lower than batch output (already sold)
    if (targetProduct && targetProduct.current_stock < targetBatch.quantity_produced) {
      warnings.push(`Product "${targetProduct.name}" currently has ${targetProduct.current_stock} ${targetBatch.base_unit || targetProduct.base_unit || 'units'} in warehouse stock, but reversing batch ${targetBatch.batch_number} subtracts ${targetBatch.quantity_produced} (resulting in ${targetProduct.current_stock - targetBatch.quantity_produced}). Finished goods from this run were likely already sold.`);
    }

    if (warnings.length > 0 && !forceAllowNegativeStock) {
      return {
        success: false,
        hasNegativeStockWarning: true,
        warningDetails: warnings,
        message: 'Reversing this production batch would cause finished product inventory to drop below zero.',
      };
    }

    const now = new Date().toISOString();
    const rawMovementsToAdd: RawMaterialMovement[] = [];
    const stockReversedSummary: any[] = [];

    // 1. Restore consumed raw materials back to inventory
    setRawMaterials(prevRaw => {
      return prevRaw.map(rm => {
        const consumed = targetBatch.raw_materials_consumed?.find(c => c.raw_material_id === rm.id);
        if (consumed) {
          const prevStk = Number(rm.current_stock);
          const nextStk = prevStk + Number(consumed.quantity_consumed);

          rawMovementsToAdd.push({
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
          });

          stockReversedSummary.push({
            name: rm.name,
            quantity_reversed: Number(consumed.quantity_consumed),
            unit: rm.unit,
            previous_stock: prevStk,
            new_stock: nextStk,
          });

          const updatedRm = { ...rm, current_stock: nextStk, updated_at: now };
          supabaseService.upsertRawMaterial(updatedRm);
          return updatedRm;
        }
        return rm;
      });
    });

    if (rawMovementsToAdd.length > 0) {
      setRawMaterialMovements(prev => [...rawMovementsToAdd, ...prev]);
      rawMovementsToAdd.forEach(m => supabaseService.upsertRawMaterialMovement(m));
    }

    // 2. Subtract produced finished products from stock
    const prodMovementsToAdd: StockMovement[] = [];
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        if (p.id === targetBatch.product_id) {
          const prevStk = Number(p.current_stock);
          const nextStk = Math.max(0, prevStk - targetBatch.quantity_produced);

          prodMovementsToAdd.push({
            id: generateId(),
            product_id: p.id,
            product_name: p.name,
            movement_type: 'adjustment',
            quantity: -targetBatch.quantity_produced,
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: targetBatch.batch_number,
            notes: `Deducted finished output of reversed production batch ${targetBatch.batch_number}`,
            date: now,
            created_by_name: user.name,
          });

          const updatedProd = { ...p, current_stock: nextStk, updated_at: now };
          supabaseService.upsertProduct(updatedProd);
          return updatedProd;
        }
        return p;
      });
    });

    if (prodMovementsToAdd.length > 0) {
      setStockMovements(prev => [...prodMovementsToAdd, ...prev]);
      prodMovementsToAdd.forEach(m => supabaseService.upsertStockMovement(m));
    }

    // 3. Remove batch from production batches list
    setProductionBatches(prev => prev.filter(b => b.id !== batchId));
    supabaseService.deleteProductionBatch(batchId);

    // 4. Record deletion & reversal audit log
    addDeletionLogEntry({
      entity_type: 'production_batch',
      entity_id: targetBatch.id,
      entity_title: `Batch ${targetBatch.batch_number} (${targetBatch.product_name})`,
      action_type: 'reversed_and_deleted',
      impact_summary: `Reversed batch ${targetBatch.batch_number}: restored ${targetBatch.raw_materials_consumed?.length || 0} consumed raw materials to stock and deducted ${targetBatch.quantity_produced} ${targetBatch.base_unit} finished product from warehouse inventory.`,
      performed_by: user.name,
      performed_by_role: user.role,
      reversal_details: {
        stock_reversed: stockReversedSummary,
      },
    });

    return {
      success: true,
      message: `Production batch ${targetBatch.batch_number} reversed and removed. Consumed raw materials restored to stock.`,
    };
  };

  // Safe Delete vs Archive History Checks
  const checkProductHasHistory = (productId: string): boolean => {
    const hasSales = sales.some(s => s.items.some(i => i.product_id === productId));
    const hasPurchases = purchases.some(p => p.items.some(i => i.product_id === productId));
    const hasBatches = productionBatches.some(b => b.product_id === productId);
    return hasSales || hasPurchases || hasBatches;
  };

  const checkRawMaterialHasHistory = (rawMaterialId: string): boolean => {
    const isUsedInFormulations = formulations.some(f => f.items.some(item => item.raw_material_id === rawMaterialId));
    const hasRawMovements = rawMaterialMovements.some(m => m.raw_material_id === rawMaterialId && m.movement_type !== 'adjustment');
    const hasPurchases = purchases.some(p => p.items.some(i => i.raw_material_id === rawMaterialId));
    return isUsedInFormulations || hasRawMovements || hasPurchases;
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
  // PRODUCT ACTIONS (SINGLE BASE UNIT + PACK SIZES + DELETE VS ARCHIVE)
  // ==============================================================================
  const addProduct = (prodData: Omit<Product, 'id' | 'created_at'>) => {
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
    setProducts(prev => [newProd, ...prev]);
    supabaseService.upsertProduct(newProd);

    if (newProd.current_stock > 0) {
      const movement: StockMovement = {
        id: generateId(),
        product_id: newProd.id,
        product_name: newProd.name,
        movement_type: 'adjustment',
        quantity: newProd.current_stock,
        previous_stock: 0,
        new_stock: newProd.current_stock,
        notes: `Initial opening stock (${newProd.base_unit})`,
        date: new Date().toISOString(),
        created_by_name: 'Admin',
      };
      setStockMovements(prev => [movement, ...prev]);
      supabaseService.upsertStockMovement(movement);
    }
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updates, updated_at: new Date().toISOString() };
        supabaseService.upsertProduct(updated);
        return updated;
      }
      return p;
    }));
  };

  const updateProductPackSizes = (productId: string, packSizes: PackSize[]) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updated = { ...p, pack_sizes: packSizes, updated_at: new Date().toISOString() };
        supabaseService.upsertProduct(updated);
        return updated;
      }
      return p;
    }));
  };

  const deleteOrArchiveProduct = (id: string, user: Profile): { action: 'deleted' | 'archived'; message: string } => {
    const target = products.find(p => p.id === id);
    if (!target) return { action: 'deleted', message: 'Product not found.' };

    const hasSales = sales.some(s => s.items.some(i => i.product_id === id));
    const hasPurchases = purchases.some(p => p.items.some(i => i.product_id === id));
    const hasProduction = productionBatches.some(b => b.product_id === id);

    if (!hasSales && !hasPurchases && !hasProduction) {
      setProducts(prev => prev.filter(p => p.id !== id));
      setFormulations(prev => prev.filter(f => f.product_id !== id));
      supabaseService.deleteProduct(id);
      addDeletionLogEntry({
        entity_type: 'product',
        entity_id: id,
        entity_title: target.name,
        action_type: 'deleted',
        impact_summary: `Permanently deleted product "${target.name}" (no sales or production history).`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'deleted', message: `Product "${target.name}" had no transaction history and was permanently removed.` };
    } else {
      setProducts(prev => prev.map(p => {
        if (p.id === id) {
          const archived = { ...p, is_archived: true, is_active: false, updated_at: new Date().toISOString() };
          supabaseService.upsertProduct(archived);
          return archived;
        }
        return p;
      }));
      addDeletionLogEntry({
        entity_type: 'product',
        entity_id: id,
        entity_title: target.name,
        action_type: 'archived',
        impact_summary: `Archived product "${target.name}" to protect past sales invoices and production records.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Product "${target.name}" has historical records and was safely archived.` };
    }
  };

  const unarchiveProduct = (id: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const unarchived = { ...p, is_archived: false, is_active: true, updated_at: new Date().toISOString() };
        supabaseService.upsertProduct(unarchived);
        return unarchived;
      }
      return p;
    }));
  };

  const adjustStock = (productId: string, qtyDiff: number, type: StockMovementType, notes: string, userName: string) => {
    const target = products.find(p => p.id === productId);
    if (!target) return;

    const prevStock = Number(target.current_stock);
    const newStock = Math.max(0, prevStock + qtyDiff);

    updateProduct(productId, { current_stock: newStock });

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

    setStockMovements(prev => [movement, ...prev]);
    supabaseService.upsertStockMovement(movement);
  };

  // ==============================================================================
  // CUSTOMER ACTIONS (WITH SALES HISTORY PROTECTION)
  // ==============================================================================
  const addCustomer = (custData: Omit<Customer, 'id' | 'created_at'>) => {
    const newCust: Customer = {
      ...custData,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    setCustomers(prev => [newCust, ...prev]);
    supabaseService.upsertCustomer(newCust);
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, ...updates };
        supabaseService.upsertCustomer(updated);
        return updated;
      }
      return c;
    }));
  };

  const deleteOrArchiveCustomer = (id: string, user: Profile): { action: 'deleted' | 'archived'; message: string } => {
    const target = customers.find(c => c.id === id);
    if (!target) return { action: 'deleted', message: 'Customer not found.' };

    const hasSales = sales.some(s => s.customer_id === id);

    if (!hasSales) {
      setCustomers(prev => prev.filter(c => c.id !== id));
      supabaseService.deleteCustomer(id);
      addDeletionLogEntry({
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
      setCustomers(prev => prev.map(c => {
        if (c.id === id) {
          const archived = { ...c, is_archived: true, is_active: false };
          supabaseService.upsertCustomer(archived);
          return archived;
        }
        return c;
      }));
      addDeletionLogEntry({
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

  const unarchiveCustomer = (id: string) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === id) {
        const unarchived = { ...c, is_archived: false, is_active: true };
        supabaseService.upsertCustomer(unarchived);
        return unarchived;
      }
      return c;
    }));
  };

  // ==============================================================================
  // SUPPLIER ACTIONS (WITH PURCHASE HISTORY PROTECTION)
  // ==============================================================================
  const addSupplier = (suppData: Omit<Supplier, 'id' | 'created_at'>) => {
    const newSupp: Supplier = {
      ...suppData,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    setSuppliers(prev => [newSupp, ...prev]);
    supabaseService.upsertSupplier(newSupp);
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, ...updates };
        supabaseService.upsertSupplier(updated);
        return updated;
      }
      return s;
    }));
  };

  const deleteOrArchiveSupplier = (id: string, user: Profile): { action: 'deleted' | 'archived'; message: string } => {
    const target = suppliers.find(s => s.id === id);
    if (!target) return { action: 'deleted', message: 'Supplier not found.' };

    const hasPurchases = purchases.some(p => p.supplier_id === id);

    if (!hasPurchases) {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      supabaseService.deleteSupplier(id);
      addDeletionLogEntry({
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
      setSuppliers(prev => prev.map(s => {
        if (s.id === id) {
          const archived = { ...s, is_archived: true, is_active: false };
          supabaseService.upsertSupplier(archived);
          return archived;
        }
        return s;
      }));
      addDeletionLogEntry({
        entity_type: 'supplier',
        entity_id: id,
        entity_title: target.name,
        action_type: 'archived',
        impact_summary: `Archived supplier "${target.name}" with historical POs to protect ledger accounting.`,
        performed_by: user.name,
        performed_by_role: user.role,
      });
      return { action: 'archived', message: `Supplier "${target.name}" has purchase history and was safely archived.` };
    }
  };

  const unarchiveSupplier = (id: string) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id === id) {
        const unarchived = { ...s, is_archived: false, is_active: true };
        supabaseService.upsertSupplier(unarchived);
        return unarchived;
      }
      return s;
    }));
  };

  // ==============================================================================
  // TRANSACTIONS: SALE ENTRY & SALE DELETION (WITH FULL AUTOMATED REVERSAL)
  // ==============================================================================
  const createSale = (saleData: Omit<Sale, 'id' | 'invoice_number' | 'created_at'>): Sale => {
    const invoiceNum = generateInvoiceNumber('INV');
    const newSale: Sale = {
      ...saleData,
      id: generateId(),
      invoice_number: invoiceNum,
      created_at: new Date().toISOString(),
    };

    setSales(prev => [newSale, ...prev]);
    supabaseService.upsertSale(newSale);

    // Deduct stock
    const movementsToAdd: StockMovement[] = [];
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const item = newSale.items.find(i => i.product_id === prod.id);
        if (item) {
          const deductBaseQty = item.base_quantity || item.quantity;
          const prevStk = Number(prod.current_stock);
          const nextStk = Math.max(0, prevStk - deductBaseQty);

          movementsToAdd.push({
            id: generateId(),
            product_id: prod.id,
            product_name: prod.name,
            movement_type: 'sale_out',
            quantity: -deductBaseQty,
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: newSale.id,
            notes: `Sold via Invoice ${invoiceNum} (${item.pack_size_name ? `${item.quantity}x ${item.pack_size_name}` : `${deductBaseQty} ${prod.base_unit || prod.unit}`})`,
            date: newSale.date,
            created_by_name: newSale.salesperson_name,
          });

          const updatedProd = { ...prod, current_stock: nextStk };
          supabaseService.upsertProduct(updatedProd);
          return updatedProd;
        }
        return prod;
      });
    });

    if (movementsToAdd.length > 0) {
      setStockMovements(prev => [...movementsToAdd, ...prev]);
      movementsToAdd.forEach(m => supabaseService.upsertStockMovement(m));
    }

    // Update customer balance if unpaid credit
    const unpaid = newSale.total_amount - newSale.amount_paid;
    if (newSale.customer_id && unpaid > 0) {
      setCustomers(prev => prev.map(c => {
        if (c.id === newSale.customer_id) {
          const updatedCust = { ...c, current_balance: (c.current_balance || 0) + unpaid };
          supabaseService.upsertCustomer(updatedCust);
          return updatedCust;
        }
        return c;
      }));
    }

    // Log payment if paid
    if (newSale.amount_paid > 0) {
      const pay: Payment = {
        id: generateId(),
        related_to: 'sale',
        reference_id: newSale.id,
        reference_no: newSale.invoice_number,
        customer_id: newSale.customer_id,
        customer_name: newSale.customer_name,
        amount: newSale.amount_paid,
        payment_method: newSale.payment_method,
        notes: `Received for invoice ${invoiceNum}`,
        date: newSale.date,
        created_by: newSale.salesperson_name,
        created_at: new Date().toISOString(),
      };
      setPayments(prev => [pay, ...prev]);
      supabaseService.upsertPayment(pay);
    }

    return newSale;
  };

  // REVERSAL ON SALE DELETION
  const deleteSaleInvoice = (saleId: string, user: Profile): { success: boolean; message: string } => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) return { success: false, message: 'Sale invoice not found.' };

    const stockReversedSummary: any[] = [];
    const movementsToAdd: StockMovement[] = [];
    const now = new Date().toISOString();

    // 1. Restore finished products stock (Add back what was sold)
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const item = targetSale.items.find(i => i.product_id === prod.id);
        if (item) {
          const addBackBaseQty = item.base_quantity || item.quantity;
          const prevStk = Number(prod.current_stock);
          const nextStk = prevStk + addBackBaseQty;

          stockReversedSummary.push({
            name: prod.name,
            quantity_reversed: addBackBaseQty,
            unit: prod.base_unit || prod.unit,
            previous_stock: prevStk,
            new_stock: nextStk,
          });

          movementsToAdd.push({
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
          });

          const updatedProd = { ...prod, current_stock: nextStk };
          supabaseService.upsertProduct(updatedProd);
          return updatedProd;
        }
        return prod;
      });
    });

    if (movementsToAdd.length > 0) {
      setStockMovements(prev => [...movementsToAdd, ...prev]);
      movementsToAdd.forEach(m => supabaseService.upsertStockMovement(m));
    }

    // 2. Reverse customer receivable balance (Deduct unpaid amount)
    const unpaidAmount = targetSale.total_amount - targetSale.amount_paid;
    let custBalanceReversed: any = null;

    if (targetSale.customer_id && unpaidAmount > 0) {
      setCustomers(prev => prev.map(c => {
        if (c.id === targetSale.customer_id) {
          const prevBal = c.current_balance || 0;
          const nextBal = Math.max(0, prevBal - unpaidAmount);
          custBalanceReversed = {
            entity_name: c.name,
            amount_reversed: unpaidAmount,
            previous_balance: prevBal,
            new_balance: nextBal,
          };
          const updatedCust = { ...c, current_balance: nextBal };
          supabaseService.upsertCustomer(updatedCust);
          return updatedCust;
        }
        return c;
      }));
    }

    // 3. Reverse linked payments
    let reversedPaymentsCount = 0;
    const paymentsToDelete = payments.filter(p => p.reference_id === targetSale.id || p.reference_no === targetSale.invoice_number);
    paymentsToDelete.forEach(p => {
      reversedPaymentsCount++;
      supabaseService.deletePayment(p.id);
    });
    setPayments(prev => prev.filter(p => !paymentsToDelete.some(dp => dp.id === p.id)));

    // 4. Remove Sale from list
    setSales(prev => prev.filter(s => s.id !== saleId));
    supabaseService.deleteSale(saleId);

    // 5. Log audit trail
    addDeletionLogEntry({
      entity_type: 'sale',
      entity_id: targetSale.id,
      entity_title: `Invoice ${targetSale.invoice_number} (${targetSale.customer_name})`,
      action_type: 'reversed_and_deleted',
      impact_summary: `Reversed invoice ${targetSale.invoice_number}: restored sold product stock, adjusted customer receivable debt (-PKR ${unpaidAmount}), and removed linked payment vouchers.`,
      performed_by: user.name,
      performed_by_role: user.role,
      reversal_details: {
        stock_reversed: stockReversedSummary,
        balance_reversed: custBalanceReversed,
        payments_reversed_count: reversedPaymentsCount,
      },
    });

    return {
      success: true,
      message: `Invoice ${targetSale.invoice_number} deleted. Stock restored and customer balance reversed successfully.`,
    };
  };

  // ==============================================================================
  // TRANSACTIONS: PURCHASE ENTRY & PURCHASE DELETION (WITH AUTOMATED REVERSAL)
  // ==============================================================================
  const createPurchase = (purchaseData: Omit<Purchase, 'id' | 'invoice_number' | 'created_at'>): Purchase => {
    const invoiceNum = generateInvoiceNumber('PO');
    const newPurchase: Purchase = {
      ...purchaseData,
      id: generateId(),
      invoice_number: invoiceNum,
      created_at: new Date().toISOString(),
    };

    setPurchases(prev => [newPurchase, ...prev]);
    supabaseService.upsertPurchase(newPurchase);

    // Raw Materials addition
    const rawMovementsToAdd: RawMaterialMovement[] = [];
    setRawMaterials(prevRaw => {
      return prevRaw.map(rm => {
        const item = newPurchase.items.find(i => i.raw_material_id === rm.id);
        if (item) {
          const prevStk = Number(rm.current_stock);
          const nextStk = prevStk + Number(item.quantity);

          rawMovementsToAdd.push({
            id: generateId(),
            raw_material_id: rm.id,
            raw_material_name: rm.name,
            movement_type: 'purchase_in',
            quantity: Number(item.quantity),
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: newPurchase.invoice_number,
            notes: `Received from PO ${invoiceNum} (${newPurchase.supplier_name})`,
            date: newPurchase.date,
          });

          const updatedRm = { ...rm, current_stock: nextStk, cost_per_unit: item.unit_cost || rm.cost_per_unit };
          supabaseService.upsertRawMaterial(updatedRm);
          return updatedRm;
        }
        return rm;
      });
    });

    if (rawMovementsToAdd.length > 0) {
      setRawMaterialMovements(prev => [...rawMovementsToAdd, ...prev]);
      rawMovementsToAdd.forEach(m => supabaseService.upsertRawMaterialMovement(m));
    }

    // Finished Goods addition
    const movementsToAdd: StockMovement[] = [];
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const item = newPurchase.items.find(i => i.product_id === prod.id);
        if (item) {
          const prevStk = Number(prod.current_stock);
          const nextStk = prevStk + Number(item.quantity);

          movementsToAdd.push({
            id: generateId(),
            product_id: prod.id,
            product_name: prod.name,
            movement_type: 'purchase_in',
            quantity: Number(item.quantity),
            previous_stock: prevStk,
            new_stock: nextStk,
            reference_id: newPurchase.id,
            notes: `Received from PO ${invoiceNum} (${newPurchase.supplier_name})`,
            date: newPurchase.date,
          });

          const updatedProd = { ...prod, current_stock: nextStk, cost_price: item.unit_cost || prod.cost_price };
          supabaseService.upsertProduct(updatedProd);
          return updatedProd;
        }
        return prod;
      });
    });

    if (movementsToAdd.length > 0) {
      setStockMovements(prev => [...movementsToAdd, ...prev]);
      movementsToAdd.forEach(m => supabaseService.upsertStockMovement(m));
    }

    // Update supplier balance if unpaid
    const unpaid = newPurchase.total_amount - newPurchase.amount_paid;
    if (newPurchase.supplier_id && unpaid > 0) {
      setSuppliers(prev => prev.map(s => {
        if (s.id === newPurchase.supplier_id) {
          const updatedSupp = { ...s, current_balance: (s.current_balance || 0) + unpaid };
          supabaseService.upsertSupplier(updatedSupp);
          return updatedSupp;
        }
        return s;
      }));
    }

    // Log payment made
    if (newPurchase.amount_paid > 0) {
      const pay: Payment = {
        id: generateId(),
        related_to: 'purchase',
        reference_id: newPurchase.id,
        reference_no: newPurchase.invoice_number,
        supplier_id: newPurchase.supplier_id,
        supplier_name: newPurchase.supplier_name,
        amount: newPurchase.amount_paid,
        payment_method: newPurchase.payment_method,
        notes: `Paid to supplier for PO ${invoiceNum}`,
        date: newPurchase.date,
        created_at: new Date().toISOString(),
      };
      setPayments(prev => [pay, ...prev]);
      supabaseService.upsertPayment(pay);
    }

    return newPurchase;
  };

  // REVERSAL ON PURCHASE DELETION
  const deletePurchaseInvoice = (
    purchaseId: string, 
    user: Profile, 
    forceAllowNegativeStock?: boolean
  ): { success: boolean; hasNegativeStockWarning?: boolean; warningDetails?: string[]; message: string } => {
    const targetPurchase = purchases.find(p => p.id === purchaseId);
    if (!targetPurchase) return { success: false, message: 'Purchase record not found.' };

    // 1. Check for negative stock warnings
    const warnings: string[] = [];

    targetPurchase.items.forEach(item => {
      if (item.raw_material_id) {
        const rm = rawMaterials.find(m => m.id === item.raw_material_id);
        if (rm && rm.current_stock < item.quantity) {
          warnings.push(`Raw Material "${rm.name}" currently has ${rm.current_stock} ${rm.unit}, but reversing this purchase subtracts ${item.quantity} ${rm.unit} (resulting in ${rm.current_stock - item.quantity} ${rm.unit}). Stock was likely already used in production.`);
        }
      } else if (item.product_id) {
        const prod = products.find(p => p.id === item.product_id);
        if (prod && prod.current_stock < item.quantity) {
          warnings.push(`Product "${prod.name}" currently has ${prod.current_stock} ${prod.base_unit || prod.unit}, but reversing this purchase subtracts ${item.quantity} (resulting in ${prod.current_stock - item.quantity}). Stock was likely already sold.`);
        }
      }
    });

    if (warnings.length > 0 && !forceAllowNegativeStock) {
      return {
        success: false,
        hasNegativeStockWarning: true,
        warningDetails: warnings,
        message: 'Reversing this purchase would cause stock levels to go negative.',
      };
    }

    const stockReversedSummary: any[] = [];
    const rawMovementsToAdd: RawMaterialMovement[] = [];
    const prodMovementsToAdd: StockMovement[] = [];
    const now = new Date().toISOString();

    // 2. Subtract Raw Materials Stock
    setRawMaterials(prevRaw => {
      return prevRaw.map(rm => {
        const item = targetPurchase.items.find(i => i.raw_material_id === rm.id);
        if (item) {
          const prevStk = Number(rm.current_stock);
          const nextStk = Math.max(0, prevStk - Number(item.quantity));

          stockReversedSummary.push({
            name: rm.name,
            quantity_reversed: -Number(item.quantity),
            unit: rm.unit,
            previous_stock: prevStk,
            new_stock: nextStk,
          });

          rawMovementsToAdd.push({
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
          });

          const updatedRm = { ...rm, current_stock: nextStk };
          supabaseService.upsertRawMaterial(updatedRm);
          return updatedRm;
        }
        return rm;
      });
    });

    if (rawMovementsToAdd.length > 0) {
      setRawMaterialMovements(prev => [...rawMovementsToAdd, ...prev]);
      rawMovementsToAdd.forEach(m => supabaseService.upsertRawMaterialMovement(m));
    }

    // 3. Subtract Finished Goods Stock
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const item = targetPurchase.items.find(i => i.product_id === prod.id);
        if (item) {
          const prevStk = Number(prod.current_stock);
          const nextStk = Math.max(0, prevStk - Number(item.quantity));

          stockReversedSummary.push({
            name: prod.name,
            quantity_reversed: -Number(item.quantity),
            unit: prod.base_unit || prod.unit,
            previous_stock: prevStk,
            new_stock: nextStk,
          });

          prodMovementsToAdd.push({
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
          });

          const updatedProd = { ...prod, current_stock: nextStk };
          supabaseService.upsertProduct(updatedProd);
          return updatedProd;
        }
        return prod;
      });
    });

    if (prodMovementsToAdd.length > 0) {
      setStockMovements(prev => [...prodMovementsToAdd, ...prev]);
      prodMovementsToAdd.forEach(m => supabaseService.upsertStockMovement(m));
    }

    // 4. Reverse Supplier Balance (Deduct unpaid payable amount)
    const unpaidAmount = targetPurchase.total_amount - targetPurchase.amount_paid;
    let suppBalanceReversed: any = null;

    if (targetPurchase.supplier_id && unpaidAmount > 0) {
      setSuppliers(prev => prev.map(s => {
        if (s.id === targetPurchase.supplier_id) {
          const prevBal = s.current_balance || 0;
          const nextBal = Math.max(0, prevBal - unpaidAmount);
          suppBalanceReversed = {
            entity_name: s.name,
            amount_reversed: unpaidAmount,
            previous_balance: prevBal,
            new_balance: nextBal,
          };
          const updatedSupp = { ...s, current_balance: nextBal };
          supabaseService.upsertSupplier(updatedSupp);
          return updatedSupp;
        }
        return s;
      }));
    }

    // 5. Reverse linked payments
    let reversedPaymentsCount = 0;
    const paymentsToDelete = payments.filter(p => p.reference_id === targetPurchase.id || p.reference_no === targetPurchase.invoice_number);
    paymentsToDelete.forEach(p => {
      reversedPaymentsCount++;
      supabaseService.deletePayment(p.id);
    });
    setPayments(prev => prev.filter(p => !paymentsToDelete.some(dp => dp.id === p.id)));

    // 6. Remove Purchase from list
    setPurchases(prev => prev.filter(p => p.id !== purchaseId));
    supabaseService.deletePurchase(purchaseId);

    // 7. Log audit trail
    addDeletionLogEntry({
      entity_type: 'purchase',
      entity_id: targetPurchase.id,
      entity_title: `PO ${targetPurchase.invoice_number} (${targetPurchase.supplier_name})`,
      action_type: 'reversed_and_deleted',
      impact_summary: `Reversed PO ${targetPurchase.invoice_number}: subtracted purchased stock, adjusted supplier payable balance (-PKR ${unpaidAmount}), and removed linked payment vouchers.`,
      performed_by: user.name,
      performed_by_role: user.role,
      reversal_details: {
        stock_reversed: stockReversedSummary,
        balance_reversed: suppBalanceReversed,
        payments_reversed_count: reversedPaymentsCount,
      },
    });

    return {
      success: true,
      message: `Purchase Order ${targetPurchase.invoice_number} deleted. Stock subtracted and supplier balance reversed successfully.`,
    };
  };

  // ==============================================================================
  // RECORD DIRECT PAYMENT
  // ==============================================================================
  const recordPayment = (paymentData: Omit<Payment, 'id' | 'created_at'>): Payment => {
    const newPayment: Payment = {
      ...paymentData,
      id: generateId(),
      created_at: new Date().toISOString(),
    };

    setPayments(prev => [newPayment, ...prev]);
    supabaseService.upsertPayment(newPayment);

    // Customer payment
    if (newPayment.customer_id) {
      setCustomers(prev => prev.map(c => {
        if (c.id === newPayment.customer_id) {
          const updatedCust = { ...c, current_balance: Math.max(0, (c.current_balance || 0) - newPayment.amount) };
          supabaseService.upsertCustomer(updatedCust);
          return updatedCust;
        }
        return c;
      }));

      if (newPayment.reference_id && (newPayment.related_to === 'sale' || newPayment.related_to === 'customer_balance')) {
        setSales(prev => prev.map(s => {
          if (s.id === newPayment.reference_id || s.invoice_number === newPayment.reference_no) {
            const newPaid = (s.amount_paid || 0) + newPayment.amount;
            const newStatus = newPaid >= s.total_amount ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
            const updatedSale: Sale = {
              ...s,
              amount_paid: newPaid,
              payment_status: newStatus as any,
            };
            supabaseService.upsertSale(updatedSale);
            return updatedSale;
          }
          return s;
        }));
      }
    }

    // Supplier payment
    if (newPayment.supplier_id) {
      setSuppliers(prev => prev.map(s => {
        if (s.id === newPayment.supplier_id) {
          const updatedSupp = { ...s, current_balance: Math.max(0, (s.current_balance || 0) - newPayment.amount) };
          supabaseService.upsertSupplier(updatedSupp);
          return updatedSupp;
        }
        return s;
      }));

      if (newPayment.reference_id && (newPayment.related_to === 'purchase' || newPayment.related_to === 'supplier_balance')) {
        setPurchases(prev => prev.map(p => {
          if (p.id === newPayment.reference_id || p.invoice_number === newPayment.reference_no) {
            const newPaid = (p.amount_paid || 0) + newPayment.amount;
            const newStatus = newPaid >= p.total_amount ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');
            const updatedPurch: Purchase = {
              ...p,
              amount_paid: newPaid,
              payment_status: newStatus as any,
            };
            supabaseService.upsertPurchase(updatedPurch);
            return updatedPurch;
          }
          return p;
        }));
      }
    }

    return newPayment;
  };

  const resetToDefaultData = () => {
    const keys = [
      'psc_products',
      'psc_raw_materials',
      'psc_formulations',
      'psc_production_batches',
      'psc_raw_movements',
      'psc_customers',
      'psc_suppliers',
      'psc_sales',
      'psc_purchases',
      'psc_stock_movements',
      'psc_payments',
      'psc_deletion_logs'
    ];
    keys.forEach(k => localStorage.setItem(k, JSON.stringify([])));
    localStorage.setItem('psc_clean_slate_applied_v2', 'true');

    setProducts([]);
    setRawMaterials([]);
    setFormulations([]);
    setProductionBatches([]);
    setRawMaterialMovements([]);
    setCustomers([]);
    setSuppliers([]);
    setSales([]);
    setPurchases([]);
    setStockMovements([]);
    setPayments([]);
    setDeletionLogs([]);
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
        deletionLogs,
        lowStockProducts,
        lowStockRawMaterials,
        totalRawMaterialsValuation,
        totalProductsValuation,
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
        addProduct,
        updateProduct,
        deleteOrArchiveProduct,
        unarchiveProduct,
        adjustStock,
        updateProductPackSizes,
        addCustomer,
        updateCustomer,
        deleteOrArchiveCustomer,
        deleteCustomer: deleteOrArchiveCustomer,
        unarchiveCustomer,
        addSupplier,
        updateSupplier,
        deleteOrArchiveSupplier,
        deleteSupplier: deleteOrArchiveSupplier,
        unarchiveSupplier,
        deleteFormulation: deleteOrArchiveFormulation,
        createSale,
        deleteSaleInvoice,
        createPurchase,
        deletePurchaseInvoice,
        recordPayment,
        resetToDefaultData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
