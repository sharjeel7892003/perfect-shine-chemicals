import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Product, 
  Customer, 
  Supplier, 
  RawMaterial, 
  ProductFormulation, 
  ProductionBatch, 
  Sale, 
  Purchase, 
  Payment, 
  StockMovement, 
  RawMaterialMovement, 
  DeletionAuditLog, 
  Profile 
} from '../types';
import { ensureUUID, isValidUUID } from '../utils/uuid';

function assertOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }
}

export const supabaseService = {
  // ============================================================================
  // FETCH ALL DATA (INITIAL LOAD & MULTI-DEVICE REALTIME SYNC)
  // ============================================================================
  async fetchAll() {
    if (!isSupabaseConfigured || !supabase) return null;

    try {
      assertOnline();
      const [
        prodRes,
        custRes,
        suppRes,
        rmRes,
        formRes,
        batchRes,
        salesRes,
        purchRes,
        payRes,
        smRes,
        rmmRes,
        logsRes,
        profRes
      ] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
        supabase.from('raw_materials').select('*').order('created_at', { ascending: false }),
        supabase.from('product_formulations').select('*').order('created_at', { ascending: false }),
        supabase.from('production_batches').select('*').order('date', { ascending: false }),
        supabase.from('sales').select('*').order('date', { ascending: false }),
        supabase.from('purchases').select('*').order('date', { ascending: false }),
        supabase.from('payments').select('*').order('date', { ascending: false }),
        supabase.from('stock_movements').select('*').order('date', { ascending: false }),
        supabase.from('raw_material_movements').select('*').order('date', { ascending: false }),
        supabase.from('deletion_audit_logs').select('*').order('date', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false })
      ]);

      const normalizedBatches = batchRes.data ? (batchRes.data as any[]).map(b => ({
        ...b,
        raw_materials_consumed: b.raw_materials_consumed || b.consumed_materials || []
      })) : null;

      return {
        products: (prodRes.data as Product[]) || [],
        customers: (custRes.data as Customer[]) || [],
        suppliers: (suppRes.data as Supplier[]) || [],
        rawMaterials: (rmRes.data as RawMaterial[]) || [],
        formulations: (formRes.data as ProductFormulation[]) || [],
        productionBatches: (normalizedBatches as ProductionBatch[]) || [],
        sales: (salesRes.data as Sale[]) || [],
        purchases: (purchRes.data as Purchase[]) || [],
        payments: (payRes.data as Payment[]) || [],
        stockMovements: (smRes.data as StockMovement[]) || [],
        rawMaterialMovements: (rmmRes.data as RawMaterialMovement[]) || [],
        deletionLogs: (logsRes.data as DeletionAuditLog[]) || [],
        profiles: (profRes.data as Profile[]) || [],
      };
    } catch (err: any) {
      console.error('Failed to fetch from Supabase:', err);
      throw err;
    }
  },

  // ============================================================================
  // PRODUCTS
  // ============================================================================
  async upsertProduct(product: Product): Promise<Product> {
    if (!isSupabaseConfigured || !supabase) return product;
    assertOnline();

    const validId = ensureUUID(product.id);
    product.id = validId;

    const payload = {
      id: validId,
      name: product.name,
      sku: product.sku,
      category: product.category,
      unit: product.unit,
      base_unit: product.base_unit || product.unit,
      cost_price: Number(product.cost_price || 0),
      selling_price: Number(product.selling_price || 0),
      current_stock: Number(product.current_stock || 0),
      reorder_level: Number(product.reorder_level || 0),
      description: product.description || '',
      pack_sizes: product.pack_sizes || [],
      is_active: product.is_active !== false,
      is_archived: Boolean(product.is_archived),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('products').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertProduct error:', error);
      throw new Error(`Product database write failed: ${error.message}`);
    }
    return (data as Product) || product;
  },

  async deleteProduct(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteProduct error:', error);
      throw new Error(`Product deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // CUSTOMERS
  // ============================================================================
  async upsertCustomer(customer: Customer): Promise<Customer> {
    if (!isSupabaseConfigured || !supabase) return customer;
    assertOnline();

    const validId = ensureUUID(customer.id);
    customer.id = validId;

    const payload = {
      id: validId,
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || 'Lahore',
      customer_type: customer.customer_type || 'retail',
      credit_limit: Number(customer.credit_limit || 0),
      current_balance: Number(customer.current_balance || 0),
      notes: customer.notes || '',
      is_active: customer.is_active !== false,
      is_archived: Boolean(customer.is_archived),
      updated_at: new Date().toISOString()
    };

    console.log('[Supabase Customer Write] Inserting into table "customers", payload ID:', validId);
    const { data, error } = await supabase.from('customers').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertCustomer error:', error);
      throw new Error(`Customer database write failed: ${error.message} (${error.code || 'PGRST'})`);
    }
    return (data as Customer) || customer;
  },

  async deleteCustomer(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteCustomer error:', error);
      throw new Error(`Customer deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // SUPPLIERS
  // ============================================================================
  async upsertSupplier(supplier: Supplier): Promise<Supplier> {
    if (!isSupabaseConfigured || !supabase) return supplier;
    assertOnline();

    const validId = ensureUUID(supplier.id);
    supplier.id = validId;

    const payload = {
      id: validId,
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || 'Lahore',
      raw_material_type: supplier.raw_material_type || '',
      current_balance: Number(supplier.current_balance || 0),
      notes: supplier.notes || '',
      is_active: supplier.is_active !== false,
      is_archived: Boolean(supplier.is_archived),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('suppliers').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertSupplier error:', error);
      throw new Error(`Supplier database write failed: ${error.message}`);
    }
    return (data as Supplier) || supplier;
  },

  async deleteSupplier(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteSupplier error:', error);
      throw new Error(`Supplier deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // RAW MATERIALS
  // ============================================================================
  async upsertRawMaterial(rm: RawMaterial): Promise<RawMaterial> {
    if (!isSupabaseConfigured || !supabase) return rm;
    assertOnline();

    const validId = ensureUUID(rm.id);
    rm.id = validId;

    const payload = {
      id: validId,
      name: rm.name,
      category: rm.category,
      unit: rm.unit,
      current_stock: Number(rm.current_stock || 0),
      reorder_level: Number(rm.reorder_level || 0),
      cost_per_unit: Number(rm.cost_per_unit || 0),
      description: rm.description || '',
      is_active: rm.is_active !== false,
      is_archived: Boolean(rm.is_archived),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('raw_materials').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertRawMaterial error:', error);
      throw new Error(`Raw material database write failed: ${error.message}`);
    }
    return (data as RawMaterial) || rm;
  },

  async deleteRawMaterial(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('raw_materials').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteRawMaterial error:', error);
      throw new Error(`Raw material deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // PRODUCT FORMULATIONS (BOM)
  // ============================================================================
  async upsertFormulation(formulation: ProductFormulation): Promise<ProductFormulation> {
    if (!isSupabaseConfigured || !supabase) return formulation;
    assertOnline();

    const validId = ensureUUID(formulation.id);
    formulation.id = validId;

    const payload: any = {
      id: validId,
      product_id: isValidUUID(formulation.product_id) ? formulation.product_id : ensureUUID(formulation.product_id),
      product_name: formulation.product_name,
      base_unit: formulation.base_unit || 'liter',
      yield_quantity: Number(formulation.yield_quantity || 1.0),
      instructions: formulation.instructions || '',
      is_archived: Boolean(formulation.is_archived),
      updated_at: new Date().toISOString()
    };

    if (formulation.items) {
      payload.items = formulation.items;
    }

    let { data, error } = await supabase.from('product_formulations').upsert(payload).select().single();
    if (error && error.code === 'PGRST204' && String(error.message).includes('items')) {
      delete payload.items;
      const retry = await supabase.from('product_formulations').upsert(payload).select().single();
      error = retry.error;
      data = retry.data;
    }

    if (error) {
      console.error('Supabase upsertFormulation error:', error);
      throw new Error(`Formulation database write failed: ${error.message}`);
    }
    return (data as ProductFormulation) || formulation;
  },

  async deleteFormulation(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('product_formulations').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteFormulation error:', error);
      throw new Error(`Formulation deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // PRODUCTION BATCHES
  // ============================================================================
  async upsertProductionBatch(batch: ProductionBatch): Promise<ProductionBatch> {
    if (!isSupabaseConfigured || !supabase) return batch;
    assertOnline();

    const validId = ensureUUID(batch.id);
    batch.id = validId;
    const consumed = batch.raw_materials_consumed || (batch as any).consumed_materials || [];

    const payload = {
      id: validId,
      batch_number: batch.batch_number,
      product_id: isValidUUID(batch.product_id) ? batch.product_id : null,
      product_name: batch.product_name,
      quantity_produced: Number(batch.quantity_produced || 0),
      base_unit: batch.base_unit || 'liter',
      date: batch.date || new Date().toISOString(),
      supervisor_name: batch.supervisor_name || '',
      total_batch_cost: Number(batch.total_batch_cost || 0),
      cost_per_base_unit: Number(batch.cost_per_base_unit || 0),
      raw_materials_consumed: consumed,
      consumed_materials: consumed,
      notes: batch.notes || ''
    };

    const { data, error } = await supabase.from('production_batches').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertProductionBatch error:', error);
      throw new Error(`Production batch database write failed: ${error.message}`);
    }
    return (data as ProductionBatch) || batch;
  },

  async deleteProductionBatch(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('production_batches').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteProductionBatch error:', error);
      throw new Error(`Production batch deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // SALES (INVOICES)
  // ============================================================================
  async upsertSale(sale: Sale): Promise<Sale> {
    if (!isSupabaseConfigured || !supabase) return sale;
    assertOnline();

    const validId = ensureUUID(sale.id);
    sale.id = validId;

    const payload = {
      id: validId,
      invoice_number: sale.invoice_number,
      customer_id: isValidUUID(sale.customer_id) ? sale.customer_id : null,
      customer_name: sale.customer_name,
      date: sale.date || new Date().toISOString(),
      items: sale.items || [],
      subtotal: Number(sale.subtotal || 0),
      discount: Number(sale.discount || 0),
      tax: Number(sale.tax || 0),
      total_amount: Number(sale.total_amount || 0),
      amount_paid: Number(sale.amount_paid || 0),
      payment_status: sale.payment_status || 'unpaid',
      payment_method: sale.payment_method || 'cash',
      salesperson_id: isValidUUID(sale.salesperson_id) ? sale.salesperson_id : null,
      salesperson_name: sale.salesperson_name || '',
      notes: sale.notes || ''
    };

    const { data, error } = await supabase.from('sales').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertSale error:', error);
      throw new Error(`Sale database write failed: ${error.message}`);
    }
    return (data as Sale) || sale;
  },

  async deleteSale(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteSale error:', error);
      throw new Error(`Sale deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // PURCHASES (PURCHASE ORDERS)
  // ============================================================================
  async upsertPurchase(purchase: Purchase): Promise<Purchase> {
    if (!isSupabaseConfigured || !supabase) return purchase;
    assertOnline();

    const validId = ensureUUID(purchase.id);
    purchase.id = validId;

    const payload = {
      id: validId,
      invoice_number: purchase.invoice_number,
      supplier_id: isValidUUID(purchase.supplier_id) ? purchase.supplier_id : null,
      supplier_name: purchase.supplier_name,
      date: purchase.date || new Date().toISOString(),
      items: purchase.items || [],
      total_amount: Number(purchase.total_amount || 0),
      amount_paid: Number(purchase.amount_paid || 0),
      payment_status: purchase.payment_status || 'unpaid',
      payment_method: purchase.payment_method || 'cash',
      notes: purchase.notes || ''
    };

    const { data, error } = await supabase.from('purchases').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertPurchase error:', error);
      throw new Error(`Purchase database write failed: ${error.message}`);
    }
    return (data as Purchase) || purchase;
  },

  async deletePurchase(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) {
      console.error('Supabase deletePurchase error:', error);
      throw new Error(`Purchase deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // PAYMENTS & VOUCHERS
  // ============================================================================
  async upsertPayment(payment: Payment): Promise<Payment> {
    if (!isSupabaseConfigured || !supabase) return payment;
    assertOnline();

    const validId = ensureUUID(payment.id);
    payment.id = validId;

    const payload = {
      id: validId,
      related_to: payment.related_to,
      reference_id: payment.reference_id || '',
      reference_no: payment.reference_no || '',
      customer_id: isValidUUID(payment.customer_id) ? payment.customer_id : null,
      customer_name: payment.customer_name || '',
      supplier_id: isValidUUID(payment.supplier_id) ? payment.supplier_id : null,
      supplier_name: payment.supplier_name || '',
      amount: Number(payment.amount || 0),
      payment_method: payment.payment_method || 'cash',
      transaction_ref: payment.transaction_ref || '',
      notes: payment.notes || '',
      date: payment.date || new Date().toISOString(),
      created_by: payment.created_by || ''
    };

    const { data, error } = await supabase.from('payments').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertPayment error:', error);
      throw new Error(`Payment database write failed: ${error.message}`);
    }
    return (data as Payment) || payment;
  },

  // ============================================================================
  // STOCK MOVEMENTS
  // ============================================================================
  async upsertStockMovement(movement: StockMovement): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    assertOnline();

    const validId = ensureUUID(movement.id);
    movement.id = validId;

    const payload: any = {
      id: validId,
      product_id: isValidUUID(movement.product_id) ? movement.product_id : null,
      movement_type: movement.movement_type,
      quantity: Number(movement.quantity || 0),
      previous_stock: Number(movement.previous_stock || 0),
      new_stock: Number(movement.new_stock || 0),
      reference_id: movement.reference_id || '',
      notes: movement.notes || '',
      date: movement.date || new Date().toISOString(),
      created_by_name: movement.created_by_name || ''
    };

    if (movement.product_name) {
      payload.product_name = movement.product_name;
    }

    let { error } = await supabase.from('stock_movements').upsert(payload);
    if (error && error.code === 'PGRST204' && String(error.message).includes('product_name')) {
      delete payload.product_name;
      const retry = await supabase.from('stock_movements').upsert(payload);
      error = retry.error;
    }

    if (error) {
      console.error('Supabase upsertStockMovement error:', error);
      throw new Error(`Stock movement database write failed: ${error.message}`);
    }
  },

  async upsertRawMaterialMovement(movement: RawMaterialMovement): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    assertOnline();

    const validId = ensureUUID(movement.id);
    movement.id = validId;

    const payload = {
      id: validId,
      raw_material_id: isValidUUID(movement.raw_material_id) ? movement.raw_material_id : null,
      raw_material_name: movement.raw_material_name || '',
      movement_type: movement.movement_type,
      quantity: Number(movement.quantity || 0),
      previous_stock: Number(movement.previous_stock || 0),
      new_stock: Number(movement.new_stock || 0),
      reference_id: movement.reference_id || '',
      notes: movement.notes || '',
      date: movement.date || new Date().toISOString(),
      created_by_name: movement.created_by_name || ''
    };

    const { error } = await supabase.from('raw_material_movements').upsert(payload);
    if (error) {
      console.error('Supabase upsertRawMaterialMovement error:', error);
      throw new Error(`Raw material movement database write failed: ${error.message}`);
    }
  },

  // ============================================================================
  // DELETION LOGS
  // ============================================================================
  async upsertDeletionLog(log: DeletionAuditLog): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    assertOnline();

    const validId = ensureUUID(log.id);
    log.id = validId;

    const payload = {
      id: validId,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      entity_title: log.entity_title,
      action_type: log.action_type,
      impact_summary: log.impact_summary || '',
      performed_by: log.performed_by,
      performed_by_role: log.performed_by_role,
      reversal_details: log.reversal_details || {},
      date: log.date || new Date().toISOString()
    };

    const { error } = await supabase.from('deletion_audit_logs').upsert(payload);
    if (error) {
      console.error('Supabase upsertDeletionLog error:', error);
      throw new Error(`Audit log database write failed: ${error.message}`);
    }
  },

  // ============================================================================
  // PROFILES (STAFF USERS)
  // ============================================================================
  async upsertProfile(profile: Profile): Promise<Profile> {
    if (!isSupabaseConfigured || !supabase) return profile;
    assertOnline();

    const validId = ensureUUID(profile.id);
    profile.id = validId;

    const payload = {
      id: validId,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      phone: profile.phone || '',
      is_active: profile.is_active !== false,
      is_deactivated: Boolean(profile.is_deactivated),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertProfile error:', error);
      throw new Error(`Profile database write failed: ${error.message}`);
    }
    return (data as Profile) || profile;
  },

  async deleteProfile(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteProfile error:', error);
      throw new Error(`Profile deletion failed: ${error.message}`);
    }
  }
};
