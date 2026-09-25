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
  Profile,
  Expense,
  RecurringExpense
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
        profRes,
        expRes,
        recExpRes
      ] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
        supabase.from('raw_materials').select('*').order('created_at', { ascending: false }),
        supabase.from('product_formulations').select('*, formulation_items(*)').order('created_at', { ascending: false }),
        supabase.from('production_batches').select('*').order('date', { ascending: false }),
        supabase.from('sales').select('*, sale_items(*)').order('date', { ascending: false }),
        supabase.from('purchases').select('*, purchase_items(*)').order('date', { ascending: false }),
        supabase.from('payments').select('*').order('date', { ascending: false }),
        supabase.from('stock_movements').select('*').order('date', { ascending: false }),
        supabase.from('raw_material_movements').select('*').order('date', { ascending: false }),
        supabase.from('deletion_audit_logs').select('*').order('date', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        Promise.resolve(supabase.from('expenses').select('*').order('date', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('recurring_expenses').select('*').order('created_at', { ascending: false })).catch(() => ({ data: [], error: null } as any))
      ]);


      // 0. Normalized Raw Materials (check for [unit:pcs] and [sellable:RATE] fallback tags)
      const normalizedRawMaterials: RawMaterial[] = (rmRes.data || []).map((rm: any) => {
        let unit = rm.unit;
        let desc = rm.description || '';
        let is_sellable = Boolean(rm.is_sellable);
        let selling_price = Number(rm.selling_price || 0);

        if (typeof desc === 'string') {
          if (desc.includes('[unit:pcs]')) {
            unit = 'pcs';
            desc = desc.replace(/\[unit:pcs\]\s*/g, '').trim();
          }
          const sellableMatch = desc.match(/\[sellable:([0-9.]+)\]/);
          if (sellableMatch) {
            is_sellable = true;
            selling_price = parseFloat(sellableMatch[1]) || 0;
            desc = desc.replace(/\[sellable:[0-9.]+\]\s*/g, '').trim();
          }
        }
        return {
          ...rm,
          unit,
          description: desc,
          is_sellable,
          selling_price
        };
      });

      // Maps for enriching relational names in memory for UI presentation
      const prodMap = new Map((prodRes.data || []).map((p: any) => [p.id, p.name]));
      const custMap = new Map((custRes.data || []).map((c: any) => [c.id, c.name]));
      const suppMap = new Map((suppRes.data || []).map((s: any) => [s.id, s.name]));
      const rmMap = new Map(normalizedRawMaterials.map((r: any) => [r.id, r]));
      const profMap = new Map((profRes.data || []).map((pr: any) => [pr.id, pr.name]));

      // 1. Normalized Formulations (extract formulation_items into .items, enriched with correct rm.unit)
      const normalizedFormulations = (formRes.data || []).map((f: any) => {
        const rawItems = (f.formulation_items && f.formulation_items.length > 0) ? f.formulation_items : (f.items || []);
        const enrichedItems = rawItems.map((item: any) => {
          const linkedRm = item.raw_material_id ? rmMap.get(item.raw_material_id) : null;
          return {
            ...item,
            unit: linkedRm ? linkedRm.unit : (item.unit || 'kg'),
          };
        });
        return {
          ...f,
          items: enrichedItems
        };
      });

      // 2. Normalized Batches
      const normalizedBatches = (batchRes.data || []).map((b: any) => ({
        ...b,
        raw_materials_consumed: b.raw_materials_consumed || (b as any).consumed_materials || []
      }));

      // 3. Normalized Sales (extract sale_items into .items, resolve raw_material_id if unmigrated)
      const normalizedSales = (salesRes.data || []).map((s: any) => ({
        ...s,
        items: (s.sale_items || []).map((item: any) => {
          let item_type = item.item_type || (item.raw_material_id ? 'raw_material' : 'finished_product');
          let raw_material_id = item.raw_material_id;
          if (!item.product_id && !raw_material_id) {
            const matchedRm = normalizedRawMaterials.find(r => r.name.toLowerCase() === (item.product_name || '').toLowerCase());
            if (matchedRm) {
              item_type = 'raw_material';
              raw_material_id = matchedRm.id;
            }
          }
          return {
            ...item,
            item_type,
            raw_material_id
          };
        }),
        salesperson_name: s.salesperson_id ? (profMap.get(s.salesperson_id) || 'Staff') : 'Staff'
      }));

      // 4. Normalized Purchases (extract purchase_items into .items)
      const normalizedPurchases = (purchRes.data || []).map((p: any) => ({
        ...p,
        items: p.purchase_items || []
      }));

      // 5. Normalized Payments (enrich customer/supplier names and detect tagged categories)
      const normalizedPayments = (payRes.data || []).map((p: any) => {
        let related_to = p.related_to;
        if (p.notes?.includes('[Capital Injection]')) {
          related_to = 'capital_injection';
        } else if (p.notes?.includes('[Owner Withdrawal]')) {
          related_to = 'owner_withdrawal';
        } else if (p.notes?.includes('[Customer Advance]')) {
          related_to = 'customer_advance';
        }

        return {
          ...p,
          related_to,
          customer_name: p.customer_id ? custMap.get(p.customer_id) || '' : '',
          supplier_name: p.supplier_id ? suppMap.get(p.supplier_id) || '' : '',
        };
      });

      // 6. Normalized Stock Movements (enrich product_name & created_by_name)
      const normalizedStockMovements = (smRes.data || []).map((sm: any) => ({
        ...sm,
        product_name: sm.product_id ? prodMap.get(sm.product_id) || 'Chemical Product' : 'Chemical Product',
        created_by_name: sm.created_by ? profMap.get(sm.created_by) || 'Staff' : (sm.created_by_name || 'Staff')
      }));

      // 7. Normalized Raw Material Movements
      const normalizedRawMovements = (rmmRes.data || []).map((rmm: any) => {
        let movement_type = rmm.movement_type;
        if (movement_type === 'adjustment' && rmm.notes?.includes('[Direct Sale]')) {
          movement_type = 'sale_out';
        }
        return {
          ...rmm,
          movement_type,
          raw_material_name: rmm.raw_material_id ? rmMap.get(rmm.raw_material_id) || rmm.raw_material_name : (rmm.raw_material_name || 'Raw Material'),
          created_by_name: rmm.created_by ? profMap.get(rmm.created_by) || 'Staff' : (rmm.created_by_name || 'Staff')
        };
      });

      return {
        products: (prodRes.data as Product[]) || [],
        customers: (custRes.data as Customer[]) || [],
        suppliers: (suppRes.data as Supplier[]) || [],
        rawMaterials: normalizedRawMaterials,
        formulations: (normalizedFormulations as ProductFormulation[]) || [],
        productionBatches: (normalizedBatches as ProductionBatch[]) || [],
        sales: (normalizedSales as Sale[]) || [],
        purchases: (normalizedPurchases as Purchase[]) || [],
        payments: (normalizedPayments as Payment[]) || [],
        stockMovements: (normalizedStockMovements as StockMovement[]) || [],
        rawMaterialMovements: (normalizedRawMovements as RawMaterialMovement[]) || [],
        deletionLogs: (logsRes.data as DeletionAuditLog[]) || [],
        profiles: (profRes.data as Profile[]) || [],
        expenses: (expRes?.data as Expense[]) || [],
        recurringExpenses: (recExpRes?.data as RecurringExpense[]) || [],
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

    // Sync pack sizes to relational pack_sizes table to satisfy foreign key constraints
    if (product.pack_sizes && product.pack_sizes.length > 0) {
      const packRows = product.pack_sizes.map(ps => ({
        id: ensureUUID(ps.id),
        product_id: validId,
        name: ps.name || 'Pack Size',
        size_in_base_unit: Number(ps.size_in_base_unit || 1),
        unit_label: ps.unit_label || 'pack',
        selling_price: Number(ps.selling_price || 0),
        is_default: Boolean(ps.is_default)
      }));
      await supabase.from('pack_sizes').upsert(packRows);
    }

    return (data as Product) || product;
  },

  async deleteProduct(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    await supabase.from('pack_sizes').delete().eq('product_id', id);
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

    const payload: any = {
      id: validId,
      name: rm.name,
      category: rm.category,
      unit: rm.unit,
      current_stock: Number(rm.current_stock || 0),
      reorder_level: Number(rm.reorder_level || 0),
      cost_per_unit: Number(rm.cost_per_unit || 0),
      is_sellable: Boolean(rm.is_sellable),
      selling_price: Number(rm.selling_price || 0),
      description: rm.description || '',
      is_active: rm.is_active !== false,
      is_archived: Boolean(rm.is_archived),
      updated_at: new Date().toISOString()
    };

    let { data, error } = await supabase.from('raw_materials').upsert(payload).select().single();
    if (error && (
      error.message?.includes('is_sellable') || 
      error.message?.includes('selling_price') || 
      error.message?.includes('raw_materials_unit_check') || 
      error.code === '23514' || 
      error.code === 'PGRST204'
    )) {
      // Graceful fallback: If columns is_sellable/selling_price or unit constraint unmigrated in DB
      let safeDesc = payload.description || '';
      if (payload.unit === 'pcs' && !safeDesc.includes('[unit:pcs]')) {
        safeDesc = `[unit:pcs] ${safeDesc}`.trim();
      }
      if (rm.is_sellable && !safeDesc.includes('[sellable:')) {
        safeDesc = `[sellable:${Number(rm.selling_price || 0)}] ${safeDesc}`.trim();
      }

      const fallbackPayload: any = {
        id: validId,
        name: rm.name,
        category: rm.category,
        unit: (error.message?.includes('raw_materials_unit_check') || error.code === '23514') ? 'kg' : payload.unit,
        current_stock: payload.current_stock,
        reorder_level: payload.reorder_level,
        cost_per_unit: payload.cost_per_unit,
        description: safeDesc,
        is_active: payload.is_active,
        is_archived: payload.is_archived,
        updated_at: payload.updated_at
      };
      const retryRes = await supabase.from('raw_materials').upsert(fallbackPayload).select().single();
      if (retryRes.error) {
        console.error('Supabase upsertRawMaterial fallback error:', retryRes.error);
        throw new Error(`Raw material database write failed: ${retryRes.error.message}`);
      }
      data = { ...retryRes.data, unit: rm.unit, is_sellable: rm.is_sellable, selling_price: rm.selling_price, description: rm.description };
    } else if (error) {
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
  // PRODUCT FORMULATIONS (BOM) & FORMULATION ITEMS
  // ============================================================================
  async upsertFormulation(formulation: ProductFormulation): Promise<ProductFormulation> {
    if (!isSupabaseConfigured || !supabase) return formulation;
    assertOnline();

    const validId = ensureUUID(formulation.id);
    formulation.id = validId;

    const payload: any = {
      id: validId,
      product_id: isValidUUID(formulation.product_id) ? formulation.product_id : null,
      product_name: formulation.product_name,
      base_unit: formulation.base_unit || 'liter',
      yield_quantity: Number(formulation.yield_quantity || 1.0),
      instructions: formulation.instructions || '',
      is_archived: Boolean(formulation.is_archived),
      updated_at: new Date().toISOString()
    };

    let { error: formError } = await supabase.from('product_formulations').upsert(payload);
    if (formError && formError.message?.includes('is_archived')) {
      delete payload.is_archived;
      const retry = await supabase.from('product_formulations').upsert(payload);
      formError = retry.error;
    }
    if (formError) {
      console.error('Supabase upsertFormulation error:', formError);
      throw new Error(`Formulation database write failed: ${formError.message}`);
    }

    // Line items: delete old items and insert fresh
    await supabase.from('formulation_items').delete().eq('formulation_id', validId);

    if (formulation.items && formulation.items.length > 0) {
      const itemsToInsert = formulation.items.map(item => ({
        id: ensureUUID((item as any).id),
        formulation_id: validId,
        raw_material_id: isValidUUID(item.raw_material_id) ? item.raw_material_id : null,
        raw_material_name: item.raw_material_name || '',
        quantity: Number(item.quantity || 0),
        unit: item.unit || 'kg',
        cost_per_unit: Number(item.cost_per_unit || 0)
      }));

      const { error: itemsError } = await supabase.from('formulation_items').insert(itemsToInsert);
      if (itemsError && (itemsError.message?.includes('formulation_items_unit_check') || itemsError.code === '23514')) {
        // Fallback for unmigrated formulation_items constraint: store 'kg' in relational table while JSONB keeps exact unit
        const fallbackItems = itemsToInsert.map(i => ({
          ...i,
          unit: i.unit === 'pcs' ? 'kg' : i.unit
        }));
        const retryRes = await supabase.from('formulation_items').insert(fallbackItems);
        if (retryRes.error) {
          console.warn('Supabase formulation_items fallback warning:', retryRes.error);
        }
      } else if (itemsError) {
        console.error('Supabase formulation_items insert error:', itemsError);
        throw new Error(`Formulation items write failed: ${itemsError.message}`);
      }
    }

    return formulation;
  },

  async deleteFormulation(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    // 1. Delete items first
    await supabase.from('formulation_items').delete().eq('formulation_id', id);

    // 2. Delete parent
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

    const basePayload = {
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
      notes: batch.notes || ''
    };

    const payloadWithFormulationSize = {
      ...basePayload,
      formulation_batch_size: Number(batch.formulation_batch_size || batch.quantity_produced || 0)
    };

    let { data, error } = await supabase.from('production_batches').upsert(payloadWithFormulationSize).select().single();
    if (error && (error.message?.includes('formulation_batch_size') || error.code === '42703')) {
      const retry = await supabase.from('production_batches').upsert(basePayload).select().single();
      data = retry.data;
      error = retry.error;
    }

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
  // SALES (INVOICES) & SALE ITEMS
  // ============================================================================
  async upsertSale(sale: Sale): Promise<Sale> {
    if (!isSupabaseConfigured || !supabase) return sale;
    assertOnline();

    const validId = ensureUUID(sale.id);
    sale.id = validId;

    // 1. Insert parent sale
    const payload = {
      id: validId,
      invoice_number: sale.invoice_number,
      customer_id: isValidUUID(sale.customer_id) ? sale.customer_id : null,
      customer_name: sale.customer_name,
      date: sale.date || new Date().toISOString(),
      // CRITICAL: Do NOT add 'items' here! The live 'sales' table does NOT have an 'items' column.
      // All line items are normalized and inserted into 'sale_items' below.
      subtotal: Number(sale.subtotal || 0),
      discount: Number(sale.discount || 0),
      tax: Number(sale.tax || 0),
      total_amount: Number(sale.total_amount || 0),
      amount_paid: Number(sale.amount_paid || 0),
      payment_status: sale.payment_status || 'unpaid',
      payment_method: sale.payment_method || 'cash',
      salesperson_id: isValidUUID(sale.salesperson_id) ? sale.salesperson_id : null,
      notes: sale.notes || ''
    };

    const { error: saleError } = await supabase.from('sales').upsert(payload);
    if (saleError) {
      console.error('Supabase upsertSale error:', saleError);
      throw new Error(`Sale database write failed: ${saleError.message}`);
    }

    // 2. Insert line items
    await supabase.from('sale_items').delete().eq('sale_id', validId);

    if (sale.items && sale.items.length > 0) {
      // Ensure any selected pack size exists in pack_sizes table to prevent FK constraint violations
      for (const item of sale.items) {
        if (item.pack_size_id && item.pack_size_id !== 'bulk' && isValidUUID(item.pack_size_id)) {
          const prodId = isValidUUID(item.product_id) ? item.product_id : null;
          if (prodId) {
            await supabase.from('pack_sizes').upsert({
              id: item.pack_size_id,
              product_id: prodId,
              name: item.pack_size_name || 'Standard Pack',
              size_in_base_unit: Number(item.size_in_base_unit || 1),
              unit_label: item.unit || 'pack',
              selling_price: Number(item.unit_price || 0)
            });
          }
        }
      }

      const itemsToInsert = sale.items.map(item => {
        // Only pass pack_size_id if it's a real pack size UUID (bulk/loose must be NULL)
        const isPack = Boolean(item.pack_size_id && item.pack_size_id !== 'bulk' && isValidUUID(item.pack_size_id));
        const isRawMaterial = Boolean(item.raw_material_id || item.item_type === 'raw_material');
        return {
          id: ensureUUID(item.id),
          sale_id: validId,
          item_type: isRawMaterial ? 'raw_material' : 'finished_product',
          raw_material_id: isRawMaterial && isValidUUID(item.raw_material_id) ? item.raw_material_id : null,
          product_id: (!isRawMaterial && isValidUUID(item.product_id)) ? item.product_id : null,
          product_name: item.product_name || '',
          pack_size_id: isPack ? item.pack_size_id : null,
          pack_size_name: item.pack_size_name || null,
          pack_quantity: item.pack_quantity ? Number(item.pack_quantity) : null,
          size_in_base_unit: item.size_in_base_unit ? Number(item.size_in_base_unit) : null,
          base_quantity: item.base_quantity ? Number(item.base_quantity) : Number(item.quantity || 0),
          quantity: Number(item.quantity || 0),
          unit_cost: Number(item.unit_cost || 0),
          unit_price: Number(item.unit_price || 0),
          subtotal: Number(item.subtotal || 0)
        };
      });

      let { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
      if (itemsError && (
        itemsError.message?.includes('raw_material_id') || 
        itemsError.message?.includes('item_type') || 
        itemsError.code === 'PGRST204'
      )) {
        // Fallback for unmigrated sale_items table: omit raw_material_id and item_type, keeping product_id: null
        const fallbackItems = itemsToInsert.map(({ raw_material_id, item_type, ...rest }) => rest);
        const retryRes = await supabase.from('sale_items').insert(fallbackItems);
        if (retryRes.error) {
          console.error('Supabase sale_items fallback insert error:', retryRes.error);
          throw new Error(`Sale items write failed: ${retryRes.error.message}`);
        }
      } else if (itemsError) {
        console.error('Supabase sale_items insert error:', itemsError);
        throw new Error(`Sale items write failed: ${itemsError.message}`);
      }
    }

    return sale;
  },

  async deleteSale(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    // 1. Delete items first
    await supabase.from('sale_items').delete().eq('sale_id', id);

    // 2. Delete parent
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteSale error:', error);
      throw new Error(`Sale deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // PURCHASES (PURCHASE ORDERS) & PURCHASE ITEMS
  // ============================================================================
  async upsertPurchase(purchase: Purchase): Promise<Purchase> {
    if (!isSupabaseConfigured || !supabase) return purchase;
    assertOnline();

    const validId = ensureUUID(purchase.id);
    purchase.id = validId;

    // 1. Insert parent purchase
    const payload = {
      id: validId,
      invoice_number: purchase.invoice_number,
      supplier_id: isValidUUID(purchase.supplier_id) ? purchase.supplier_id : null,
      supplier_name: purchase.supplier_name,
      date: purchase.date || new Date().toISOString(),
      total_amount: Number(purchase.total_amount || 0),
      amount_paid: Number(purchase.amount_paid || 0),
      payment_status: purchase.payment_status || 'unpaid',
      payment_method: purchase.payment_method || 'cash',
      notes: purchase.notes || ''
    };

    const { error: purchError } = await supabase.from('purchases').upsert(payload);
    if (purchError) {
      console.error('Supabase upsertPurchase error:', purchError);
      throw new Error(`Purchase database write failed: ${purchError.message}`);
    }

    // 2. Insert line items
    await supabase.from('purchase_items').delete().eq('purchase_id', validId);

    if (purchase.items && purchase.items.length > 0) {
      const itemsToInsert = purchase.items.map(item => ({
        id: ensureUUID(item.id),
        purchase_id: validId,
        item_type: item.item_type || 'raw_material',
        raw_material_id: isValidUUID(item.raw_material_id) ? item.raw_material_id : null,
        product_id: isValidUUID(item.product_id) ? item.product_id : null,
        product_or_material_name: item.product_or_material_name || '',
        quantity: Number(item.quantity || 0),
        unit_cost: Number(item.unit_cost || 0),
        subtotal: Number(item.subtotal || 0)
      }));

      const { error: itemsError } = await supabase.from('purchase_items').insert(itemsToInsert);
      if (itemsError) {
        console.error('Supabase purchase_items insert error:', itemsError);
        throw new Error(`Purchase items write failed: ${itemsError.message}`);
      }
    }

    return purchase;
  },

  async deletePurchase(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    // 1. Delete items first
    await supabase.from('purchase_items').delete().eq('purchase_id', id);

    // 2. Delete parent
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
      reference_id: isValidUUID(payment.reference_id) ? payment.reference_id : null,
      customer_id: isValidUUID(payment.customer_id) ? payment.customer_id : null,
      supplier_id: isValidUUID(payment.supplier_id) ? payment.supplier_id : null,
      amount: Number(payment.amount || 0),
      payment_method: payment.payment_method || 'cash',
      transaction_ref: payment.transaction_ref || '',
      notes: payment.notes || '',
      date: payment.date || new Date().toISOString(),
      created_by: isValidUUID(payment.created_by) ? payment.created_by : null
    };

    let { data, error } = await supabase.from('payments').upsert(payload).select().single();
    if (error) {
      // Fallback: If payments_related_to_check constraint rejects new types, retry with compatible related_to and tagged notes
      if (error.code === '23514') {
        let fallbackRelatedTo = '';
        let prefix = '';

        if (payload.related_to === 'expense') {
          fallbackRelatedTo = 'supplier_balance';
          prefix = `[Expense Outflow: ${payment.reference_no || 'Overhead'}]`;
        } else if (payload.related_to === 'capital_injection') {
          fallbackRelatedTo = 'customer_balance';
          prefix = '[Capital Injection]';
        } else if (payload.related_to === 'owner_withdrawal') {
          fallbackRelatedTo = 'supplier_balance';
          prefix = '[Owner Withdrawal]';
        } else if (payload.related_to === 'customer_advance') {
          fallbackRelatedTo = 'customer_balance';
          prefix = '[Customer Advance]';
        }

        if (fallbackRelatedTo) {
          console.warn(`payments_related_to_check rejected "${payload.related_to}". Retrying with fallback "${fallbackRelatedTo}"...`);
          const fallbackPayload = {
            ...payload,
            related_to: fallbackRelatedTo,
            notes: `${prefix} ${payload.notes}`.trim()
          };
          const retryRes = await supabase.from('payments').upsert(fallbackPayload).select().single();
          if (!retryRes.error) {
            return {
              ...(retryRes.data as Payment),
              related_to: payment.related_to // retain high-level related_to in local memory
            };
          }
        }
      }
      console.error('Supabase upsertPayment error:', error);
      throw new Error(`Payment database write failed: ${error.message}`);
    }
    return (data as Payment) || payment;
  },

  async deletePayment(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) {
      console.error('Supabase deletePayment error:', error);
      throw new Error(`Payment deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // STOCK MOVEMENTS
  // ============================================================================
  async upsertStockMovement(movement: StockMovement): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    assertOnline();

    const validId = ensureUUID(movement.id);
    movement.id = validId;

    const notes = movement.created_by_name && !movement.notes?.includes(movement.created_by_name)
      ? `[By ${movement.created_by_name}] ${movement.notes || ''}`.trim()
      : (movement.notes || '');

    const payload = {
      id: validId,
      product_id: isValidUUID(movement.product_id) ? movement.product_id : null,
      movement_type: movement.movement_type,
      quantity: Number(movement.quantity || 0),
      previous_stock: Number(movement.previous_stock || 0),
      new_stock: Number(movement.new_stock || 0),
      reference_id: movement.reference_id || '',
      notes: notes,
      date: movement.date || new Date().toISOString(),
      created_by: isValidUUID((movement as any).created_by) ? (movement as any).created_by : null
    };

    const { error } = await supabase.from('stock_movements').upsert(payload);
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

    const notes = movement.created_by_name && !movement.notes?.includes(movement.created_by_name)
      ? `[By ${movement.created_by_name}] ${movement.notes || ''}`.trim()
      : (movement.notes || '');

    const payload = {
      id: validId,
      raw_material_id: isValidUUID(movement.raw_material_id) ? movement.raw_material_id : null,
      raw_material_name: movement.raw_material_name || '',
      movement_type: movement.movement_type,
      quantity: Number(movement.quantity || 0),
      previous_stock: Number(movement.previous_stock || 0),
      new_stock: Number(movement.new_stock || 0),
      reference_id: movement.reference_id || '',
      notes: notes,
      date: movement.date || new Date().toISOString(),
      created_by: isValidUUID((movement as any).created_by) ? (movement as any).created_by : null
    };

    let { error } = await supabase.from('raw_material_movements').upsert(payload);
    if (error && error.message?.includes('raw_material_movements_movement_type_check')) {
      // The live database check constraint has not yet been migrated to include 'sale_out' / 'resale_out'.
      // Fallback to 'adjustment' so sales never fail, and tag notes with [Direct Sale]
      const fallbackPayload = {
        ...payload,
        movement_type: 'adjustment',
        notes: `[Direct Sale] ${notes}`.trim()
      };
      const retry = await supabase.from('raw_material_movements').upsert(fallbackPayload);
      if (retry.error) {
        console.error('Supabase upsertRawMaterialMovement fallback error:', retry.error);
        throw new Error(`Raw material movement database write failed: ${retry.error.message}`);
      }
    } else if (error) {
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
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertProfile error:', error);
      if (error.code === '23503' && String(error.message).includes('profiles_id_fkey')) {
        throw new Error(
          'Supabase profiles table has a foreign key constraint to auth.users. Please run: ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey; in Supabase SQL Editor.'
        );
      }
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
  },

  // ============================================================================
  // EXPENSES (OVERHEAD COSTS)
  // ============================================================================
  async upsertExpense(expense: Expense): Promise<Expense> {
    if (!isSupabaseConfigured || !supabase) return expense;
    assertOnline();

    const validId = ensureUUID(expense.id);
    expense.id = validId;

    const payload = {
      id: validId,
      date: expense.date || new Date().toISOString(),
      category: expense.category,
      description: expense.description || '',
      amount: Number(expense.amount || 0),
      payment_method: expense.payment_method || 'cash',
      recorded_by: expense.recorded_by || null,
      recorded_by_name: expense.recorded_by_name || '',
      is_recurring: Boolean(expense.is_recurring),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('expenses').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertExpense error:', error);
      throw new Error(`Expense database write failed: ${error.message} (${error.code || 'PGRST'})`);
    }
    return (data as Expense) || expense;
  },

  async deleteExpense(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteExpense error:', error);
      throw new Error(`Expense deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // RECURRING EXPENSES TEMPLATES
  // ============================================================================
  async upsertRecurringExpense(item: RecurringExpense): Promise<RecurringExpense> {
    if (!isSupabaseConfigured || !supabase) return item;
    assertOnline();

    const validId = ensureUUID(item.id);
    item.id = validId;

    const payload = {
      id: validId,
      category: item.category,
      description: item.description,
      amount: Number(item.amount || 0),
      payment_method: item.payment_method || 'cash',
      is_active: item.is_active !== false,
      last_posted_month: item.last_posted_month || null,
      created_by: item.created_by || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('recurring_expenses').upsert(payload).select().single();
    if (error) {
      console.error('Supabase upsertRecurringExpense error:', error);
      throw new Error(`Recurring expense database write failed: ${error.message} (${error.code || 'PGRST'})`);
    }
    return (data as RecurringExpense) || item;
  },

  async deleteRecurringExpense(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteRecurringExpense error:', error);
      throw new Error(`Recurring expense deletion failed: ${error.message}`);
    }
  },

  // ============================================================================
  // RESET ALL DATABASE DATA (CLEAN SLATE IN REVERSE FOREIGN KEY ORDER)
  // ============================================================================
  async resetAllDatabaseData(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    assertOnline();

    const dummyZeroUUID = '00000000-0000-0000-0000-000000000000';

    const tablesToWipe = [
      'deletion_audit_logs',
      'payments',
      'expenses',
      'recurring_expenses',
      'stock_movements',
      'raw_material_movements',
      'sale_items',
      'sales',
      'purchase_items',
      'purchases',
      'production_batches',
      'formulation_items',
      'product_formulations',
      'products',
      'raw_materials',
      'customers',
      'suppliers'
    ];

    for (const table of tablesToWipe) {
      try {
        const { error } = await supabase.from(table).delete().neq('id', dummyZeroUUID);
        if (error) {
          console.warn(`Warning while wiping table ${table}:`, error.message);
        }
      } catch (err) {
        console.warn(`Exception wiping table ${table}:`, err);
      }
    }
  }
};
