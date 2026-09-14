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
      const { error } = await supabase.from('products').upsert({
        id: product.id,
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
      });
      if (error) console.error('Supabase upsertProduct error:', error);
    } catch (err) {
      console.error('Supabase upsertProduct exception:', err);
    }
  },

  async deleteProduct(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      const { error } = await supabase.from('customers').upsert({
        id: customer.id,
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
      });
      if (error) console.error('Supabase upsertCustomer error:', error);
    } catch (err) {
      console.error('Supabase upsertCustomer exception:', err);
    }
  },

  async deleteCustomer(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      const { error } = await supabase.from('suppliers').upsert({
        id: supplier.id,
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
      });
      if (error) console.error('Supabase upsertSupplier error:', error);
    } catch (err) {
      console.error('Supabase upsertSupplier exception:', err);
    }
  },

  async deleteSupplier(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      const { error } = await supabase.from('raw_materials').upsert({
        id: rm.id,
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
      });
      if (error) console.error('Supabase upsertRawMaterial error:', error);
    } catch (err) {
      console.error('Supabase upsertRawMaterial exception:', err);
    }
  },

  async deleteRawMaterial(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      const { error } = await supabase.from('product_formulations').upsert({
        id: formulation.id,
        product_id: formulation.product_id,
        product_name: formulation.product_name,
        base_unit: formulation.base_unit || 'liter',
        yield_quantity: Number(formulation.yield_quantity || 1.0),
        items: formulation.items || [],
        instructions: formulation.instructions || '',
        is_archived: Boolean(formulation.is_archived),
        updated_at: new Date().toISOString()
      });
      if (error) console.error('Supabase upsertFormulation error:', error);
    } catch (err) {
      console.error('Supabase upsertFormulation exception:', err);
    }
  },

  async deleteFormulation(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      const consumed = batch.raw_materials_consumed || (batch as any).consumed_materials || [];
      const { error } = await supabase.from('production_batches').upsert({
        id: batch.id,
        batch_number: batch.batch_number,
        product_id: batch.product_id,
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
      });
      if (error) console.error('Supabase upsertProductionBatch error:', error);
    } catch (err) {
      console.error('Supabase upsertProductionBatch exception:', err);
    }
  },

  async deleteProductionBatch(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      const { error } = await supabase.from('sales').upsert({
        id: sale.id,
        invoice_number: sale.invoice_number,
        customer_id: sale.customer_id || null,
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
        salesperson_id: sale.salesperson_id || null,
        salesperson_name: sale.salesperson_name || '',
        notes: sale.notes || ''
      });
      if (error) console.error('Supabase upsertSale error:', error);
    } catch (err) {
      console.error('Supabase upsertSale exception:', err);
    }
  },

  async deleteSale(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      const { error } = await supabase.from('purchases').upsert({
        id: purchase.id,
        invoice_number: purchase.invoice_number,
        supplier_id: purchase.supplier_id || null,
        supplier_name: purchase.supplier_name,
        date: purchase.date || new Date().toISOString(),
        items: purchase.items || [],
        total_amount: Number(purchase.total_amount || 0),
        amount_paid: Number(purchase.amount_paid || 0),
        payment_status: purchase.payment_status || 'unpaid',
        payment_method: purchase.payment_method || 'cash',
        notes: purchase.notes || ''
      });
      if (error) console.error('Supabase upsertPurchase error:', error);
    } catch (err) {
      console.error('Supabase upsertPurchase exception:', err);
    }
  },

  async deletePurchase(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      const { error } = await supabase.from('payments').upsert({
        id: payment.id,
        related_to: payment.related_to,
        reference_id: payment.reference_id || null,
        reference_no: payment.reference_no || '',
        customer_id: payment.customer_id || null,
        customer_name: payment.customer_name || '',
        supplier_id: payment.supplier_id || null,
        supplier_name: payment.supplier_name || '',
        amount: Number(payment.amount || 0),
        payment_method: payment.payment_method || 'cash',
        transaction_ref: payment.transaction_ref || '',
        notes: payment.notes || '',
        date: payment.date || new Date().toISOString(),
        created_by: payment.created_by || ''
      });
      if (error) console.error('Supabase upsertPayment error:', error);
    } catch (err) {
      console.error('Supabase upsertPayment exception:', err);
    }
  },

  async deletePayment(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
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
      await supabase.from('stock_movements').upsert({
        id: movement.id,
        product_id: movement.product_id,
        product_name: movement.product_name || '',
        movement_type: movement.movement_type,
        quantity: Number(movement.quantity || 0),
        previous_stock: Number(movement.previous_stock || 0),
        new_stock: Number(movement.new_stock || 0),
        reference_id: movement.reference_id || '',
        notes: movement.notes || '',
        date: movement.date || new Date().toISOString(),
        created_by_name: movement.created_by_name || ''
      });
    } catch (err) {
      console.error('Supabase upsertStockMovement exception:', err);
    }
  },

  async upsertRawMaterialMovement(movement: RawMaterialMovement) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from('raw_material_movements').upsert({
        id: movement.id,
        raw_material_id: movement.raw_material_id,
        raw_material_name: movement.raw_material_name || '',
        movement_type: movement.movement_type,
        quantity: Number(movement.quantity || 0),
        previous_stock: Number(movement.previous_stock || 0),
        new_stock: Number(movement.new_stock || 0),
        reference_id: movement.reference_id || '',
        notes: movement.notes || '',
        date: movement.date || new Date().toISOString(),
        created_by_name: movement.created_by_name || ''
      });
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
      await supabase.from('deletion_audit_logs').upsert({
        id: log.id,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        entity_title: log.entity_title,
        action_type: log.action_type,
        impact_summary: log.impact_summary || '',
        performed_by: log.performed_by,
        performed_by_role: log.performed_by_role,
        reversal_details: log.reversal_details || {},
        date: log.date || new Date().toISOString()
      });
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
      await supabase.from('profiles').upsert({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        phone: profile.phone || '',
        is_active: profile.is_active !== false,
        is_deactivated: Boolean(profile.is_deactivated),
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Supabase upsertProfile exception:', err);
    }
  },

  async deleteProfile(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase deleteProfile exception:', err);
    }
  }
};
