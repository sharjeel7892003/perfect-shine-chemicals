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

export const supabaseService = {
  // ============================================================================
  // FETCH ALL DATA (INITIAL LOAD & MULTI-DEVICE SYNC)
  // ============================================================================
  async fetchAll() {
    if (!isSupabaseConfigured || !supabase) return null;

    try {
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
        products: prodRes.data ? (prodRes.data as Product[]) : null,
        customers: custRes.data ? (custRes.data as Customer[]) : null,
        suppliers: suppRes.data ? (suppRes.data as Supplier[]) : null,
        rawMaterials: rmRes.data ? (rmRes.data as RawMaterial[]) : null,
        formulations: formRes.data ? (formRes.data as ProductFormulation[]) : null,
        productionBatches: normalizedBatches as ProductionBatch[] | null,
        sales: salesRes.data ? (salesRes.data as Sale[]) : null,
        purchases: purchRes.data ? (purchRes.data as Purchase[]) : null,
        payments: payRes.data ? (payRes.data as Payment[]) : null,
        stockMovements: smRes.data ? (smRes.data as StockMovement[]) : null,
        rawMaterialMovements: rmmRes.data ? (rmmRes.data as RawMaterialMovement[]) : null,
        deletionLogs: logsRes.data ? (logsRes.data as DeletionAuditLog[]) : null,
        profiles: profRes.data ? (profRes.data as Profile[]) : null,
      };
    } catch (err) {
      console.error('Failed to fetch from Supabase:', err);
      return null;
    }
  },

  // ============================================================================
  // PRODUCTS
  // ============================================================================
  async upsertProduct(product: Product) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      const { error } = await supabase.from('products').upsert(payload);
      if (error) {
        console.error('Supabase upsertProduct error:', error);
      } else {
        console.log('Supabase upsertProduct success:', validId, product.name);
      }
    } catch (err) {
      console.error('Supabase upsertProduct exception:', err);
    }
  },

  async deleteProduct(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('products').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteProduct exception:', err);
    }
  },

  // ============================================================================
  // CUSTOMERS
  // ============================================================================
  async upsertCustomer(customer: Customer) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      const { error } = await supabase.from('customers').upsert(payload);
      if (error) {
        console.error('Supabase upsertCustomer error:', error);
      } else {
        console.log('Supabase upsertCustomer success:', validId, customer.name);
      }
    } catch (err) {
      console.error('Supabase upsertCustomer exception:', err);
    }
  },

  async deleteCustomer(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('customers').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteCustomer exception:', err);
    }
  },

  // ============================================================================
  // SUPPLIERS
  // ============================================================================
  async upsertSupplier(supplier: Supplier) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      const { error } = await supabase.from('suppliers').upsert(payload);
      if (error) {
        console.error('Supabase upsertSupplier error:', error);
      } else {
        console.log('Supabase upsertSupplier success:', validId, supplier.name);
      }
    } catch (err) {
      console.error('Supabase upsertSupplier exception:', err);
    }
  },

  async deleteSupplier(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('suppliers').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteSupplier exception:', err);
    }
  },

  // ============================================================================
  // RAW MATERIALS
  // ============================================================================
  async upsertRawMaterial(rm: RawMaterial) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      const { error } = await supabase.from('raw_materials').upsert(payload);
      if (error) {
        console.error('Supabase upsertRawMaterial error:', error);
      } else {
        console.log('Supabase upsertRawMaterial success:', validId, rm.name);
      }
    } catch (err) {
      console.error('Supabase upsertRawMaterial exception:', err);
    }
  },

  async deleteRawMaterial(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('raw_materials').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteRawMaterial exception:', err);
    }
  },

  // ============================================================================
  // PRODUCT FORMULATIONS (BOM)
  // ============================================================================
  async upsertFormulation(formulation: ProductFormulation) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      let { error } = await supabase.from('product_formulations').upsert(payload);
      if (error && error.code === 'PGRST204' && String(error.message).includes('items')) {
        // Table created without items column; upsert without it
        delete payload.items;
        const retry = await supabase.from('product_formulations').upsert(payload);
        error = retry.error;
      }

      if (error) {
        console.error('Supabase upsertFormulation error:', error);
      } else {
        console.log('Supabase upsertFormulation success:', validId, formulation.product_name);
      }
    } catch (err) {
      console.error('Supabase upsertFormulation exception:', err);
    }
  },

  async deleteFormulation(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('product_formulations').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteFormulation exception:', err);
    }
  },

  // ============================================================================
  // PRODUCTION BATCHES
  // ============================================================================
  async upsertProductionBatch(batch: ProductionBatch) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      const { error } = await supabase.from('production_batches').upsert(payload);
      if (error) {
        console.error('Supabase upsertProductionBatch error:', error);
      } else {
        console.log('Supabase upsertProductionBatch success:', validId, batch.batch_number);
      }
    } catch (err) {
      console.error('Supabase upsertProductionBatch exception:', err);
    }
  },

  async deleteProductionBatch(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('production_batches').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteProductionBatch exception:', err);
    }
  },

  // ============================================================================
  // SALES (INVOICES)
  // ============================================================================
  async upsertSale(sale: Sale) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      const { error } = await supabase.from('sales').upsert(payload);
      if (error) {
        console.error('Supabase upsertSale error:', error);
      } else {
        console.log('Supabase upsertSale success:', validId, sale.invoice_number);
      }
    } catch (err) {
      console.error('Supabase upsertSale exception:', err);
    }
  },

  async deleteSale(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('sales').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteSale exception:', err);
    }
  },

  // ============================================================================
  // PURCHASES (PURCHASE ORDERS)
  // ============================================================================
  async upsertPurchase(purchase: Purchase) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      const { error } = await supabase.from('purchases').upsert(payload);
      if (error) {
        console.error('Supabase upsertPurchase error:', error);
      } else {
        console.log('Supabase upsertPurchase success:', validId, purchase.invoice_number);
      }
    } catch (err) {
      console.error('Supabase upsertPurchase exception:', err);
    }
  },

  async deletePurchase(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('purchases').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deletePurchase exception:', err);
    }
  },

  // ============================================================================
  // PAYMENTS & VOUCHERS
  // ============================================================================
  async upsertPayment(payment: Payment) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const validId = ensureUUID(payment.id);
      payment.id = validId;

      const payload = {
        id: validId,
        related_to: payment.related_to,
        reference_id: isValidUUID(payment.reference_id) ? payment.reference_id : null,
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

      const { error } = await supabase.from('payments').upsert(payload);
      if (error) {
        console.error('Supabase upsertPayment error:', error);
      } else {
        console.log('Supabase upsertPayment success:', validId, payment.amount);
      }
    } catch (err) {
      console.error('Supabase upsertPayment exception:', err);
    }
  },

  async deletePayment(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('payments').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deletePayment exception:', err);
    }
  },

  // ============================================================================
  // STOCK MOVEMENTS
  // ============================================================================
  async upsertStockMovement(movement: StockMovement) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      if (error) console.error('Supabase upsertStockMovement error:', error);
    } catch (err) {
      console.error('Supabase upsertStockMovement exception:', err);
    }
  },

  async upsertRawMaterialMovement(movement: RawMaterialMovement) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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
      if (error) console.error('Supabase upsertRawMaterialMovement error:', error);
    } catch (err) {
      console.error('Supabase upsertRawMaterialMovement exception:', err);
    }
  },

  // ============================================================================
  // DELETION LOGS
  // ============================================================================
  async upsertDeletionLog(log: DeletionAuditLog) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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
      if (error) console.error('Supabase upsertDeletionLog error:', error);
    } catch (err) {
      console.error('Supabase upsertDeletionLog exception:', err);
    }
  },

  // ============================================================================
  // PROFILES (STAFF USERS)
  // ============================================================================
  async upsertProfile(profile: Profile) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
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

      const { error } = await supabase.from('profiles').upsert(payload);
      if (error) console.error('Supabase upsertProfile error:', error);
    } catch (err) {
      console.error('Supabase upsertProfile exception:', err);
    }
  },

  async deleteProfile(id: string) {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteProfile exception:', err);
    }
  }
};
