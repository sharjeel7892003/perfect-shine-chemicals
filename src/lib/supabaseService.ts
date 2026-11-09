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
  RecurringExpense,
  PurchaseTrip,
  PurchaseTripItem,
  SalesReturn,
  SalesReturnItem,
  PackingRun,
  Quotation,
  Salesperson,
  MonthlyCommissionClosure,
  CommissionPayment,
  FixedAsset,
  FixedAssetFunding,
  Partner,
  PartnerCapitalTransaction
} from '../types';
import { ensureUUID, isValidUUID } from '../utils/uuid';
import { allocateTripFreight } from '../utils/freightAllocation';


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
        recExpRes,
        tripRes,
        returnsRes,
        packingRes,
        quotRes,
        salespersonsRes,
        closuresRes,
        commPayRes,
        fixedAssetsRes,
        partnersRes,
        partnerTxnsRes
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
        Promise.resolve(supabase.from('recurring_expenses').select('*').order('created_at', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('purchase_trips').select('*, purchase_trip_items(*)').order('date', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('sales_returns').select('*, sales_return_items(*)').order('date', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('packing_runs').select('*').order('date', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('quotations').select('*, quotation_items(*)').order('created_at', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('salespersons').select('*').order('name', { ascending: true })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('monthly_commission_closures').select('*').order('month', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('commission_payments').select('*').order('payment_date', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('fixed_assets').select('*, fixed_asset_fundings(*)').order('purchase_date', { ascending: false })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('partners').select('*').order('name', { ascending: true })).catch(() => ({ data: [], error: null } as any)),
        Promise.resolve(supabase.from('partner_capital_transactions').select('*').order('date', { ascending: false })).catch(() => ({ data: [], error: null } as any))
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

      // 1. Normalized Formulations (extract formulation_items into .items, enriched with correct rm.unit and active landed cost_per_unit)
      let allowStaffBatchSheetAccess = false;
      const normalizedFormulations: ProductFormulation[] = [];

      for (const f of (formRes.data || []) as any[]) {
        let rawInstructions = typeof f.instructions === 'string' ? f.instructions : '';
        let bomMeta: any = null;
        if (rawInstructions.includes('<!--BOM_META:')) {
          try {
            const match = rawInstructions.match(/<!--BOM_META:(.*?)-->/);
            if (match && match[1]) {
              bomMeta = JSON.parse(match[1]);
              if (bomMeta.allow_staff_batch_sheets === true) {
                allowStaffBatchSheetAccess = true;
              }
            }
          } catch (e) {
            console.warn('Failed to parse BOM_META from formulation instructions:', e);
          }
          rawInstructions = rawInstructions.replace(/\s*<!--BOM_META:.*?-->/g, '').trim();
        }

        const rawItems = (f.formulation_items && f.formulation_items.length > 0) ? f.formulation_items : (f.items || []);
        const enrichedItems = rawItems.map((item: any) => {
          const linkedRm = item.raw_material_id ? rmMap.get(item.raw_material_id) : null;
          return {
            ...item,
            raw_material_name: linkedRm ? linkedRm.name : (item.raw_material_name || 'Raw Material'),
            unit: linkedRm ? linkedRm.unit : (item.unit || 'kg'),
            cost_per_unit: linkedRm ? Number(linkedRm.cost_per_unit || 0) : Number(item.cost_per_unit || 0),
          };
        });

        const version = f.version !== undefined && f.version !== null
          ? Number(f.version)
          : (bomMeta?.version !== undefined ? Number(bomMeta.version) : 1);
        const is_locked = f.is_locked !== undefined && f.is_locked !== null
          ? Boolean(f.is_locked)
          : Boolean(bomMeta?.is_locked);
        const locked_at = f.locked_at || bomMeta?.locked_at || undefined;
        const locked_by = f.locked_by || bomMeta?.locked_by || undefined;
        const parent_formulation_id = f.parent_formulation_id || bomMeta?.parent_formulation_id || undefined;
        const is_historical_version = f.is_historical_version !== undefined && f.is_historical_version !== null
          ? Boolean(f.is_historical_version)
          : Boolean(bomMeta?.is_historical_version);
        const is_archived = f.is_archived !== undefined && f.is_archived !== null
          ? Boolean(f.is_archived)
          : Boolean(bomMeta?.is_archived || is_historical_version);
        const resolvedProductId = f.product_id || bomMeta?.product_id || '';
        const versionHistory: any[] = Array.isArray(bomMeta?.version_history) ? bomMeta.version_history : [];

        normalizedFormulations.push({
          ...f,
          product_id: resolvedProductId,
          instructions: rawInstructions,
          version: version > 0 ? version : 1,
          is_locked,
          locked_at,
          locked_by,
          parent_formulation_id,
          is_historical_version,
          version_history: versionHistory,
          is_archived,
          items: enrichedItems
        });

        // Also unpack embedded version_history snapshots into historical formulation entries for full version history browsing
        for (const snap of versionHistory) {
          if (snap && snap.version) {
            const snapId = snap.id || `${f.id}_v${snap.version}`;
            const alreadySeparateRow = (formRes.data || []).some((row: any) => row.id === snapId);
            if (!alreadySeparateRow) {
              normalizedFormulations.push({
                id: snapId,
                product_id: resolvedProductId,
                product_name: f.product_name,
                base_unit: snap.base_unit || f.base_unit || 'kg',
                yield_quantity: Number(snap.yield_quantity || f.yield_quantity || 1),
                instructions: snap.instructions || '',
                version: Number(snap.version),
                is_locked: true,
                locked_at: snap.locked_at,
                locked_by: snap.locked_by,
                is_historical_version: true,
                is_archived: true,
                created_at: snap.created_at || f.created_at,
                updated_at: snap.updated_at || snap.locked_at || f.updated_at,
                items: (snap.items || []).map((it: any) => {
                  const linkedRm = it.raw_material_id ? rmMap.get(it.raw_material_id) : null;
                  return {
                    ...it,
                    raw_material_name: linkedRm ? linkedRm.name : (it.raw_material_name || 'Raw Material'),
                    unit: linkedRm ? linkedRm.unit : (it.unit || 'kg'),
                    cost_per_unit: Number(it.cost_per_unit || (linkedRm ? linkedRm.cost_per_unit : 0)),
                  };
                }),
              });
            }
          }
        }
      }

      // 2. Normalized Batches (extract formulation_id and formulation_version from columns or <!--BATCH_META:...--> in notes)
      const normalizedBatches = (batchRes.data || []).map((b: any) => {
        let rawNotes = typeof b.notes === 'string' ? b.notes : '';
        let batchMeta: any = null;
        if (rawNotes.includes('<!--BATCH_META:')) {
          try {
            const match = rawNotes.match(/<!--BATCH_META:(.*?)-->/);
            if (match && match[1]) {
              batchMeta = JSON.parse(match[1]);
            }
          } catch (e) {
            console.warn('Failed to parse BATCH_META from batch notes:', e);
          }
          rawNotes = rawNotes.replace(/\s*<!--BATCH_META:.*?-->/g, '').trim();
        }

        const formulation_id = b.formulation_id || batchMeta?.formulation_id || undefined;
        const formulation_version = b.formulation_version !== undefined && b.formulation_version !== null
          ? Number(b.formulation_version)
          : (batchMeta?.formulation_version !== undefined ? Number(batchMeta.formulation_version) : 1);
        const formulation_batch_size = b.formulation_batch_size !== undefined && b.formulation_batch_size !== null
          ? Number(b.formulation_batch_size)
          : (batchMeta?.formulation_batch_size !== undefined ? Number(batchMeta.formulation_batch_size) : Number(b.quantity_produced || 0));

        return {
          ...b,
          notes: rawNotes,
          formulation_id,
          formulation_version: formulation_version > 0 ? formulation_version : 1,
          formulation_batch_size,
          raw_materials_consumed: b.raw_materials_consumed || (b as any).consumed_materials || []
        };
      });

      // 3. Normalized Sales (extract sale_items into .items, resolve raw_material_id if unmigrated, restore Private Label metadata)
      const normalizedSales = (salesRes.data || []).map((s: any) => {
        let is_private_label = Boolean(s.is_private_label);
        let invoice_type: 'standard' | 'private_label' = s.invoice_type || (is_private_label ? 'private_label' : 'standard');
        let client_brand_name = s.client_brand_name || '';
        let labour_rate_per_bottle = s.labour_rate_per_bottle ? Number(s.labour_rate_per_bottle) : undefined;
        let labour_bottle_qty = s.labour_bottle_qty ? Number(s.labour_bottle_qty) : undefined;
        let labour_total_amount = s.labour_total_amount ? Number(s.labour_total_amount) : undefined;
        let advance_received_date = s.advance_received_date;
        const metaItemsMap: Record<string, any> = {};

        if (s.notes && typeof s.notes === 'string' && s.notes.includes('<!--PL_DATA:')) {
          try {
            const match = s.notes.match(/<!--PL_DATA:(.*?)-->/);
            if (match && match[1]) {
              const meta = JSON.parse(match[1]);
              is_private_label = true;
              invoice_type = 'private_label';
              if (meta.client_brand_name) client_brand_name = meta.client_brand_name;
              if (meta.labour_rate_per_bottle !== undefined) labour_rate_per_bottle = Number(meta.labour_rate_per_bottle);
              if (meta.labour_bottle_qty !== undefined) labour_bottle_qty = Number(meta.labour_bottle_qty);
              if (meta.labour_total_amount !== undefined) labour_total_amount = Number(meta.labour_total_amount);
              if (meta.advance_received_date) advance_received_date = meta.advance_received_date;
              if (Array.isArray(meta.items)) {
                meta.items.forEach((mItem: any, idx: number) => {
                  const key = mItem.pack_size_id || mItem.product_id || String(idx);
                  metaItemsMap[key] = mItem;
                });
              }
            }
          } catch (e) {
            console.warn('Failed to parse PL_DATA from sale note:', e);
          }
        }

        const enrichedItems = (s.sale_items || []).map((item: any, idx: number) => {
          let item_type = item.item_type || (item.raw_material_id ? 'raw_material' : 'finished_product');
          let raw_material_id = item.raw_material_id;
          if (!item.product_id && !raw_material_id) {
            const matchedRm = normalizedRawMaterials.find(r => r.name.toLowerCase() === (item.product_name || '').toLowerCase());
            if (matchedRm) {
              item_type = 'raw_material';
              raw_material_id = matchedRm.id;
            }
          }
          const mItem = metaItemsMap[item.pack_size_id] || metaItemsMap[item.product_id] || metaItemsMap[String(idx)];
          return {
            ...item,
            item_type,
            raw_material_id,
            is_private_label: mItem ? Boolean(mItem.is_private_label) : (is_private_label || Boolean(item.is_private_label)),
            box_qty: mItem?.box_qty !== undefined ? Number(mItem.box_qty) : item.box_qty,
            bottles_per_box: mItem?.bottles_per_box !== undefined ? Number(mItem.bottles_per_box) : item.bottles_per_box,
            bottle_qty: mItem?.bottle_qty !== undefined ? Number(mItem.bottle_qty) : (item.bottle_qty || item.quantity),
            liters_qty: mItem?.liters_qty !== undefined ? Number(mItem.liters_qty) : (item.liters_qty || item.base_quantity),
            rate_per_liter: mItem?.rate_per_liter !== undefined ? Number(mItem.rate_per_liter) : item.rate_per_liter,
          };
        });

        const spMap = new Map<string, string>();
        ((salespersonsRes?.data || []) as any[]).forEach(sp => {
          if (sp.id && sp.name) spMap.set(sp.id, sp.name);
        });

        const salespersonName = s.salesperson_id
          ? (spMap.get(s.salesperson_id) || profMap.get(s.salesperson_id) || 'Staff')
          : 'Staff';

        return {
          ...s,
          invoice_type,
          is_private_label,
          client_brand_name,
          labour_rate_per_bottle,
          labour_bottle_qty,
          labour_total_amount,
          advance_received_date,
          items: enrichedItems,
          salesperson_name: salespersonName
        };
      });

      // 4. Normalized Purchases (extract purchase_items into .items, preserve freight/landed cost even when DB columns are unmigrated)
      const normalizedPurchases = (purchRes.data || []).map((p: any) => {
        let rawNotes = typeof p.notes === 'string' ? p.notes : '';
        let poMeta: any = null;

        if (rawNotes.includes('<!--PO_FREIGHT_DATA:')) {
          try {
            const match = rawNotes.match(/<!--PO_FREIGHT_DATA:(.*?)-->/);
            if (match && match[1]) {
              poMeta = JSON.parse(match[1]);
            }
          } catch (e) {
            console.warn('Failed to parse PO_FREIGHT_DATA from purchase notes:', e);
          }
          rawNotes = rawNotes.replace(/\s*<!--PO_FREIGHT_DATA:.*?-->/g, '').trim();
        }

        let freightCost = Number(p.freight_cost || poMeta?.freight_cost || 0);
        let tripId = p.trip_id || poMeta?.trip_id || undefined;
        let tripNumber = p.trip_number || poMeta?.trip_number || undefined;

        if (freightCost <= 0 && rawNotes) {
          const singleMatch = rawNotes.match(/Includes single-purchase freight:\s*PKR\s*([0-9,]+(?:\.[0-9]+)?)/i);
          const tripAllocMatch = rawNotes.match(/Allocated Transport:\s*PKR\s*([0-9,]+(?:\.[0-9]+)?)/i);
          if (singleMatch && singleMatch[1]) {
            freightCost = parseFloat(singleMatch[1].replace(/,/g, '')) || 0;
          } else if (tripAllocMatch && tripAllocMatch[1]) {
            freightCost = parseFloat(tripAllocMatch[1].replace(/,/g, '')) || 0;
          }
        }

        if (!tripNumber && rawNotes) {
          const tripNoMatch = rawNotes.match(/Purchase Trip\s+(TRIP-[A-Z0-9-]+)/i);
          if (tripNoMatch && tripNoMatch[1]) {
            tripNumber = tripNoMatch[1];
          }
        }

        const metaItems: any[] = Array.isArray(poMeta?.items) ? poMeta.items : [];
        const rawPurchaseItems: any[] = p.purchase_items || [];

        let preliminaryItems = rawPurchaseItems.map((pi: any, idx: number) => {
          const linkedRm = pi.raw_material_id ? rmMap.get(pi.raw_material_id) : null;
          const mItem = metaItems.find((m: any) => m.idx === idx) || metaItems.find((m: any) => m.raw_material_id && m.raw_material_id === pi.raw_material_id);
          const unit = pi.unit || mItem?.unit || (linkedRm ? linkedRm.unit : 'kg');
          const qty = Number(pi.quantity || 0);
          const uCost = Number(pi.unit_cost || 0);
          const subtotal = pi.subtotal !== undefined && Number(pi.subtotal) > 0
            ? Number(pi.subtotal)
            : Number((qty * uCost).toFixed(2));
          const hasExplicitAlloc = pi.allocated_freight !== undefined || mItem?.allocated_freight !== undefined;
          const allocFreight = pi.allocated_freight !== undefined
            ? Number(pi.allocated_freight)
            : (mItem?.allocated_freight !== undefined ? Number(mItem.allocated_freight) : 0);
          const landedCost = pi.landed_cost !== undefined
            ? Number(pi.landed_cost)
            : (mItem?.landed_cost !== undefined
                ? Number(mItem.landed_cost)
                : (qty > 0 ? uCost + (allocFreight / qty) : uCost));

          return {
            ...pi,
            unit,
            quantity: qty,
            unit_cost: uCost,
            subtotal,
            _hasExplicitAlloc: hasExplicitAlloc,
            allocated_freight: allocFreight,
            landed_cost: Number(landedCost.toFixed(2)),
            trip_id: pi.trip_id || tripId || undefined,
            trip_number: pi.trip_number || tripNumber || undefined,
          };
        });

        const totalAllocatedSoFar = preliminaryItems.reduce((acc, it) => acc + Number(it.allocated_freight || 0), 0);
        const anyExplicitAlloc = preliminaryItems.some(it => it._hasExplicitAlloc && Number(it.allocated_freight || 0) > 0);

        if (freightCost > 0 && totalAllocatedSoFar <= 0 && !anyExplicitAlloc && preliminaryItems.length > 0) {
          const allocation = allocateTripFreight(
            preliminaryItems.map(it => ({
              raw_material_id: it.raw_material_id,
              product_or_material_name: it.product_or_material_name,
              unit: it.unit || 'kg',
              quantity: it.quantity,
              unit_cost: it.unit_cost,
              subtotal: it.subtotal,
            })),
            freightCost,
            true
          );

          preliminaryItems = preliminaryItems.map((it, idx) => {
            const alloc = allocation.allocatedItems[idx];
            const allocFreight = alloc ? Number(alloc.allocated_freight || 0) : 0;
            const landedCost = alloc
              ? Number(alloc.landed_cost || it.unit_cost)
              : (it.quantity > 0 ? it.unit_cost + (allocFreight / it.quantity) : it.unit_cost);
            return {
              ...it,
              allocated_freight: Number(allocFreight.toFixed(2)),
              landed_cost: Number(landedCost.toFixed(2)),
            };
          });
        }

        const finalItems = preliminaryItems.map(({ _hasExplicitAlloc, ...rest }) => rest);

        return {
          ...p,
          notes: rawNotes,
          freight_cost: freightCost,
          freight_payment_status: p.freight_payment_status || poMeta?.freight_payment_status || (freightCost > 0 ? 'paid' : undefined),
          freight_payment_method: p.freight_payment_method || poMeta?.freight_payment_method || (freightCost > 0 ? (p.payment_method || 'cash') : undefined),
          freight_amount_paid: p.freight_amount_paid !== undefined
            ? Number(p.freight_amount_paid)
            : (poMeta?.freight_amount_paid !== undefined ? Number(poMeta.freight_amount_paid) : (freightCost > 0 ? freightCost : 0)),
          freight_payment_date: p.freight_payment_date || poMeta?.freight_payment_date || p.date,
          trip_id: tripId,
          trip_number: tripNumber,
          items: finalItems,
        };
      });

      // 4B. Normalized Purchase Trips
      const normalizedPurchaseTrips: PurchaseTrip[] = (tripRes?.data || []).map((t: any) => ({
        ...t,
        total_transport_cost: Number(t.total_transport_cost || 0),
        transport_payment_status: t.transport_payment_status || 'paid',
        transport_payment_method: t.transport_payment_method || 'cash',
        transport_amount_paid: t.transport_amount_paid !== undefined ? Number(t.transport_amount_paid) : Number(t.total_transport_cost || 0),
        transport_payment_date: t.transport_payment_date || t.date,
        items: (t.purchase_trip_items || t.items || []).map((ti: any) => ({
          ...ti,
          payment_status: ti.payment_status || 'paid',
          amount_paid: ti.amount_paid !== undefined ? Number(ti.amount_paid) : Number(ti.subtotal || 0),
          payment_method: ti.payment_method || 'cash',
          payment_date: ti.payment_date || t.date,
          allocated_freight: Number(ti.allocated_freight || 0),
          landed_cost: Number(ti.landed_cost || 0),
          total_landed_cost: Number(ti.total_landed_cost || 0),
        }))
      }));

      // 5. Normalized Payments (enrich customer/supplier names and detect tagged categories)
      const normalizedPayments = (payRes.data || []).map((p: any) => {
        let related_to = p.related_to;
        let reference_no = p.reference_no || p.transaction_ref || undefined;
        let notes = p.notes || '';

        if (notes.includes('[Capital Injection]')) {
          related_to = 'capital_injection';
        } else if (notes.includes('[Owner Withdrawal]')) {
          related_to = 'owner_withdrawal';
        } else if (notes.includes('[Customer Advance]')) {
          related_to = 'customer_advance';
        } else if (notes.includes('[Sales Return Refund:')) {
          related_to = 'sales_return_refund';
        } else if (
          notes.includes('[Transport Outflow:') ||
          /^Freight\s*-\s*(PO-|TRIP-)/i.test(notes) ||
          /^Freight\s*-\s*(PO-|TRIP-)/i.test(p.transaction_ref || '')
        ) {
          related_to = 'transport';
          const match = notes.match(/\[Transport Outflow:\s*([^\]]+)\]/);
          if (match && match[1]) {
            reference_no = match[1].trim();
            notes = notes.replace(/\[Transport Outflow:\s*[^\]]+\]\s*/, '').trim();
          } else if (p.transaction_ref && /^Freight\s*-/i.test(p.transaction_ref)) {
            reference_no = p.transaction_ref;
          }
        } else if (notes.includes('[Expense Outflow:')) {
          related_to = 'expense';
          const match = notes.match(/\[Expense Outflow:\s*([^\]]+)\]/);
          if (match && match[1]) {
            reference_no = match[1].trim();
          }
        } else if (notes.includes('[Sales Commission:')) {
          related_to = 'sales_commission';
        } else if (notes.includes('[Fixed Asset Outflow:')) {
          related_to = 'fixed_asset';
        }

        return {
          ...p,
          related_to,
          reference_no,
          notes,
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

      // 7B. Normalized Sales Returns
      const normalizedSalesReturns: SalesReturn[] = ((returnsRes as any)?.data || []).map((ret: any) => ({
        id: ret.id,
        credit_note_number: ret.credit_note_number,
        sale_id: ret.sale_id,
        invoice_number: ret.invoice_number,
        customer_id: ret.customer_id,
        customer_name: ret.customer_name || (ret.customer_id ? custMap.get(ret.customer_id) || 'Customer' : 'Customer'),
        date: ret.date,
        total_amount: Number(ret.total_amount || 0),
        reason: ret.reason || '',
        notes: ret.notes || '',
        refund_method: ret.refund_method || 'reduce_receivable',
        payment_method: ret.payment_method,
        refund_payment_id: ret.refund_payment_id,
        created_by: ret.created_by,
        created_by_name: ret.created_by_name,
        created_at: ret.created_at,
        items: ((ret.sales_return_items || []) as any[]).map((item: any) => ({
          id: item.id,
          return_id: item.return_id,
          sale_item_id: item.sale_item_id,
          item_type: item.item_type || 'finished_product',
          product_id: item.product_id,
          raw_material_id: item.raw_material_id,
          product_name: item.product_name,
          unit: item.unit,
          pack_size_id: item.pack_size_id,
          pack_size_name: item.pack_size_name,
          size_in_base_unit: Number(item.size_in_base_unit || 1),
          quantity: Number(item.quantity || 1),
          base_quantity: Number(item.base_quantity || item.quantity || 1),
          unit_cost: Number(item.unit_cost || 0),
          unit_price: Number(item.unit_price || 0),
          subtotal: Number(item.subtotal || 0),
        }))
      }));

      // 0B. Normalized Products (extract density from column or fallback [density:X] in description)
      const normalizedProducts: Product[] = (prodRes.data || []).map((p: any) => {
        let density = Number(p.density);
        const desc = p.description || '';
        if (isNaN(density) || density <= 0) {
          const match = typeof desc === 'string' ? desc.match(/\[density:([0-9.]+)\]/) : null;
          if (match && match[1]) {
            density = parseFloat(match[1]);
          } else {
            density = 1.0;
          }
        }
        return {
          ...p,
          density: Number(density) || 1.0,
        };
      });

      return {
        products: normalizedProducts,
        customers: (custRes.data as Customer[]) || [],
        suppliers: (suppRes.data as Supplier[]) || [],
        rawMaterials: normalizedRawMaterials,
        formulations: (normalizedFormulations as ProductFormulation[]) || [],
        allowStaffBatchSheetAccess,
        productionBatches: (normalizedBatches as ProductionBatch[]) || [],
        sales: (normalizedSales as Sale[]) || [],
        salesReturns: normalizedSalesReturns,
        purchases: (normalizedPurchases as Purchase[]) || [],
        payments: (normalizedPayments as Payment[]) || [],
        stockMovements: (normalizedStockMovements as StockMovement[]) || [],
        rawMaterialMovements: (normalizedRawMovements as RawMaterialMovement[]) || [],
        deletionLogs: (logsRes.data as DeletionAuditLog[]) || [],
        profiles: (profRes.data as Profile[]) || [],
        expenses: (expRes?.data as Expense[]) || [],
        recurringExpenses: (recExpRes?.data as RecurringExpense[]) || [],
        purchaseTrips: normalizedPurchaseTrips,
        packingRuns: ((packingRes?.data || []) as PackingRun[]),
        quotations: ((quotRes?.data || []) as any[]).map((q: any) => ({
          ...q,
          quotation_type: q.quotation_type || 'private_label',
          items: (Array.isArray(q.quotation_items) && q.quotation_items.length > 0)
            ? q.quotation_items.map((it: any) => ({
                ...it,
                product_cost: Number(it.product_cost || 0),
                bottle_cost: Number(it.bottle_cost || 0),
                cap_cost: Number(it.cap_cost || 0),
                label_cost: Number(it.label_cost || 0),
                labour_cost: Number(it.labour_cost || 0),
                carton_cost: Number(it.carton_cost || 0),
                transport_cost: Number(it.transport_cost || 0),
                total_cost_per_unit: Number(it.total_cost_per_unit || 0),
                quoted_price_per_unit: Number(it.quoted_price_per_unit || 0),
                bottles_per_box: it.bottles_per_box != null ? Number(it.bottles_per_box) : undefined,
                unit_rate: it.unit_rate != null ? Number(it.unit_rate) : undefined,
                box_rate: it.box_rate != null ? Number(it.box_rate) : undefined,
                quantity_bottles: it.quantity_bottles != null ? Number(it.quantity_bottles) : undefined,
                quantity_boxes: it.quantity_boxes != null ? Number(it.quantity_boxes) : undefined,
                line_total: it.line_total != null ? Number(it.line_total) : undefined,
              }))
            : (Array.isArray(q.items) ? q.items : [])
        })),
        salespersons: ((salespersonsRes?.data || []) as Salesperson[]),
        monthlyCommissionClosures: ((closuresRes?.data || []) as MonthlyCommissionClosure[]),
        commissionPayments: ((commPayRes?.data || []) as CommissionPayment[]),
        fixedAssets: (((fixedAssetsRes as any)?.data || []) as any[]).map((fa: any) => ({
          ...fa,
          total_cost: Number(fa.total_cost || 0),
          useful_life_years: Number(fa.useful_life_years || 0),
          salvage_value: Number(fa.salvage_value || 0),
          disposal_amount: Number(fa.disposal_amount || 0),
          fundings: (Array.isArray(fa.fixed_asset_fundings) ? fa.fixed_asset_fundings : []).map((f: any) => ({
            ...f,
            business_amount: Number(f.business_amount || 0),
            partner_amount: Number(f.partner_amount || 0),
          }))
        })) as FixedAsset[],
        partners: (((partnersRes as any)?.data || []) as any[]).map((p: any) => ({
          ...p,
          initial_capital: Number(p.initial_capital || 0),
          is_active: p.is_active !== false,
        })) as Partner[],
        partnerCapitalTransactions: (((partnerTxnsRes as any)?.data || []) as any[]).map((t: any) => ({
          ...t,
          amount: Number(t.amount || 0),
        })) as PartnerCapitalTransaction[],
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
    const densityVal = Number(product.density) > 0 ? Number(product.density) : 1.0;

    let safeDescription = product.description || '';
    if (!safeDescription.includes('[density:')) {
      safeDescription = `[density:${densityVal}] ${safeDescription}`.trim();
    } else {
      safeDescription = safeDescription.replace(/\[density:[0-9.]+\]/, `[density:${densityVal}]`).trim();
    }

    const payload: any = {
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
      description: safeDescription,
      pack_sizes: product.pack_sizes || [],
      is_active: product.is_active !== false,
      is_archived: Boolean(product.is_archived),
      density: densityVal,
      updated_at: new Date().toISOString()
    };

    let { data, error } = await supabase.from('products').upsert(payload).select().single();
    if (error && (error.message?.includes('density') || error.code === 'PGRST204')) {
      // Graceful fallback if density column is not yet migrated in Supabase
      const fallbackPayload = { ...payload };
      delete fallbackPayload.density;
      const retryRes = await supabase.from('products').upsert(fallbackPayload).select().single();
      if (retryRes.error) {
        console.error('Supabase upsertProduct fallback error:', retryRes.error);
        throw new Error(`Product database write failed: ${retryRes.error.message}`);
      }
      data = { ...retryRes.data, density: densityVal, description: product.description };
    } else if (error) {
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

    // Keep formulation_items in Supabase synced with this raw material's active landed cost_per_unit
    try {
      await supabase
        .from('formulation_items')
        .update({ cost_per_unit: payload.cost_per_unit })
        .eq('raw_material_id', validId);
    } catch (e) {
      // Non-fatal if formulation_items table update fails
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
  async upsertFormulation(formulation: ProductFormulation, allowStaffBatchSheets?: boolean): Promise<ProductFormulation> {
    if (!isSupabaseConfigured || !supabase) return formulation;
    assertOnline();

    const validId = ensureUUID(formulation.id);
    formulation.id = validId;

    const versionNum = Number(formulation.version) > 0 ? Number(formulation.version) : 1;
    const isLocked = Boolean(formulation.is_locked);
    const isHistorical = Boolean(formulation.is_historical_version);
    const isArchived = Boolean(formulation.is_archived || isHistorical);

    let cleanInstructions = (formulation.instructions || '').replace(/\s*<!--BOM_META:.*?-->/g, '').trim();
    const bomMeta: Record<string, any> = {
      product_id: formulation.product_id || undefined,
      version: versionNum,
      is_locked: isLocked,
      locked_at: formulation.locked_at || undefined,
      locked_by: formulation.locked_by || undefined,
      parent_formulation_id: formulation.parent_formulation_id || undefined,
      is_historical_version: isHistorical,
      is_archived: isArchived,
      version_history: Array.isArray(formulation.version_history) ? formulation.version_history : undefined,
    };
    if (allowStaffBatchSheets !== undefined) {
      bomMeta.allow_staff_batch_sheets = Boolean(allowStaffBatchSheets);
    }

    const instructionsWithMeta = `${cleanInstructions}\n<!--BOM_META:${JSON.stringify(bomMeta)}-->`.trim();

    const basePayload: any = {
      id: validId,
      product_id: isValidUUID(formulation.product_id) ? formulation.product_id : null,
      product_name: formulation.product_name,
      base_unit: formulation.base_unit || 'liter',
      yield_quantity: Number(formulation.yield_quantity || 1.0),
      instructions: instructionsWithMeta,
      updated_at: new Date().toISOString()
    };

    const fullPayload: any = {
      ...basePayload,
      version: versionNum,
      is_locked: isLocked,
      locked_at: formulation.locked_at || null,
      locked_by: formulation.locked_by || null,
      parent_formulation_id: (formulation.parent_formulation_id && isValidUUID(formulation.parent_formulation_id))
        ? formulation.parent_formulation_id
        : null,
      is_historical_version: isHistorical,
      is_archived: isArchived,
    };

    let { error: formError } = await supabase.from('product_formulations').upsert(fullPayload);
    if (formError && (
      formError.code === 'PGRST204' ||
      formError.code === '42703' ||
      formError.message?.includes('is_archived') ||
      formError.message?.includes('version') ||
      formError.message?.includes('is_locked')
    )) {
      const retry = await supabase.from('product_formulations').upsert(basePayload);
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

    return {
      ...formulation,
      instructions: cleanInstructions,
      version: versionNum,
      is_locked: isLocked,
      is_historical_version: isHistorical,
      is_archived: isArchived,
    };
  },

  async updateStaffBatchSheetAccessInSupabase(allowed: boolean, formulationsList: ProductFormulation[], updatedBy?: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    assertOnline();

    // 1. Try updating app_settings table if migrated
    try {
      await supabase.from('app_settings').upsert({
        key: 'formulation_access',
        value: { allow_production_staff_batch_sheets: Boolean(allowed) },
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || 'Admin'
      });
    } catch (e) {
      // Ignore if app_settings table is not yet created
    }

    // 2. Also persist in BOM_META on formulations in Supabase so it works even before DDL migration
    for (const f of formulationsList) {
      if (f.is_historical_version) continue;
      let cleanInstructions = (f.instructions || '').replace(/\s*<!--BOM_META:.*?-->/g, '').trim();
      const bomMeta = {
        product_id: f.product_id || undefined,
        version: Number(f.version || 1),
        is_locked: Boolean(f.is_locked),
        locked_at: f.locked_at || undefined,
        locked_by: f.locked_by || undefined,
        parent_formulation_id: f.parent_formulation_id || undefined,
        is_historical_version: Boolean(f.is_historical_version),
        is_archived: Boolean(f.is_archived || f.is_historical_version),
        version_history: Array.isArray(f.version_history) ? f.version_history : undefined,
        allow_staff_batch_sheets: Boolean(allowed),
      };
      const instructionsWithMeta = `${cleanInstructions}\n<!--BOM_META:${JSON.stringify(bomMeta)}-->`.trim();
      await supabase
        .from('product_formulations')
        .update({ instructions: instructionsWithMeta })
        .eq('id', f.id);
    }
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
    const formVersion = Number(batch.formulation_version) > 0 ? Number(batch.formulation_version) : 1;
    const formBatchSize = Number(batch.formulation_batch_size || batch.quantity_produced || 0);

    let cleanNotes = (batch.notes || '').replace(/\s*<!--BATCH_META:.*?-->/g, '').trim();
    const batchMeta = {
      formulation_id: batch.formulation_id || undefined,
      formulation_version: formVersion,
      formulation_batch_size: formBatchSize,
    };
    const notesWithMeta = `${cleanNotes}\n<!--BATCH_META:${JSON.stringify(batchMeta)}-->`.trim();

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
      notes: notesWithMeta
    };

    const fullPayload = {
      ...basePayload,
      formulation_id: (batch.formulation_id && isValidUUID(batch.formulation_id)) ? batch.formulation_id : null,
      formulation_version: formVersion,
      formulation_batch_size: formBatchSize
    };

    let { data, error } = await supabase.from('production_batches').upsert(fullPayload).select().single();
    if (error && (
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      error.message?.includes('formulation_batch_size') ||
      error.message?.includes('formulation_id') ||
      error.message?.includes('formulation_version')
    )) {
      const retry = await supabase.from('production_batches').upsert(basePayload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Supabase upsertProductionBatch error:', error);
      throw new Error(`Production batch database write failed: ${error.message}`);
    }
    return {
      ...((data as ProductionBatch) || batch),
      notes: cleanNotes,
      formulation_id: batch.formulation_id,
      formulation_version: formVersion,
      formulation_batch_size: formBatchSize,
    };
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

  async reverseProductionBatch(batchId: string, userName: string, userRole: string): Promise<{ success: boolean; message: string; batch_number?: string } | null> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(batchId)) return null;
    assertOnline();

    const { data, error } = await supabase.rpc('reverse_and_delete_production_batch', {
      p_batch_id: batchId,
      p_user_name: userName,
      p_user_role: userRole
    });

    if (error) {
      // If PostgreSQL function does not exist yet (before migration is executed), return null so client-side atomic fallback runs
      if (error.code === '42883' || error.message?.includes('function') || error.code === 'PGRST202') {
        return null;
      }
      throw new Error(error.message);
    }
    return data;
  },

  // ============================================================================
  // SALES (INVOICES) & SALE ITEMS
  // ============================================================================
  async upsertSale(sale: Sale): Promise<Sale> {
    if (!isSupabaseConfigured || !supabase) return sale;
    assertOnline();

    const validId = ensureUUID(sale.id);
    sale.id = validId;

    // If Private Label, embed complete calculation metadata in notes
    let notesPayload = sale.notes || '';
    if (sale.invoice_type === 'private_label' || sale.is_private_label) {
      const plMetadata = {
        invoice_type: 'private_label',
        is_private_label: true,
        client_brand_name: sale.client_brand_name || '',
        labour_rate_per_bottle: Number(sale.labour_rate_per_bottle || 3.5),
        labour_bottle_qty: Number(sale.labour_bottle_qty || 0),
        labour_total_amount: Number(sale.labour_total_amount || 0),
        advance_received_date: sale.advance_received_date,
        items: (sale.items || []).map(it => ({
          product_id: it.product_id,
          pack_size_id: it.pack_size_id,
          product_name: it.product_name,
          box_qty: it.box_qty,
          bottles_per_box: it.bottles_per_box,
          bottle_qty: it.bottle_qty,
          liters_qty: it.liters_qty,
          rate_per_liter: it.rate_per_liter,
          subtotal: it.subtotal,
          is_private_label: true
        }))
      };

      notesPayload = notesPayload.replace(/<!--PL_DATA:.*?-->/g, '').trim();
      const clientNotice = sale.client_brand_name ? `[Private Label Manufacturing for: ${sale.client_brand_name}]` : '';
      if (clientNotice && !notesPayload.includes(clientNotice)) {
        notesPayload = `${clientNotice}\n${notesPayload}`.trim();
      }
      notesPayload = `${notesPayload}\n<!--PL_DATA:${JSON.stringify(plMetadata)}-->`.trim();
    }

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
      notes: notesPayload
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
  // SALES RETURNS & CREDIT NOTES
  // ============================================================================
  async upsertSalesReturn(salesReturn: SalesReturn): Promise<SalesReturn> {
    if (!isSupabaseConfigured || !supabase) return salesReturn;
    assertOnline();

    const validId = ensureUUID(salesReturn.id);
    salesReturn.id = validId;

    const payload = {
      id: validId,
      credit_note_number: salesReturn.credit_note_number,
      sale_id: ensureUUID(salesReturn.sale_id),
      invoice_number: salesReturn.invoice_number,
      customer_id: isValidUUID(salesReturn.customer_id) ? salesReturn.customer_id : null,
      customer_name: salesReturn.customer_name,
      date: salesReturn.date || new Date().toISOString(),
      total_amount: Number(salesReturn.total_amount || 0),
      reason: salesReturn.reason || '',
      notes: salesReturn.notes || '',
      refund_method: salesReturn.refund_method,
      payment_method: salesReturn.payment_method || null,
      refund_payment_id: isValidUUID(salesReturn.refund_payment_id) ? salesReturn.refund_payment_id : null,
      created_by: isValidUUID(salesReturn.created_by) ? salesReturn.created_by : null,
      created_by_name: salesReturn.created_by_name || null,
      created_at: salesReturn.created_at || new Date().toISOString()
    };

    try {
      const { error: retError } = await supabase.from('sales_returns').upsert(payload);
      if (retError) {
        if (retError.code === 'PGRST205' || retError.message?.includes('schema cache')) {
          console.warn('[Supabase Migration Notice] Table public.sales_returns does not exist yet in Supabase. Please run supabase/sales_returns_migration.sql in the Supabase SQL Editor.');
        } else {
          console.error('Supabase upsertSalesReturn error:', retError);
          throw new Error(`Sales return database write failed: ${retError.message} (${retError.code || 'DB'})`);
        }
      } else if (salesReturn.items && salesReturn.items.length > 0) {
        await supabase.from('sales_return_items').delete().eq('return_id', validId);
        const itemsToInsert = salesReturn.items.map(item => ({
          id: ensureUUID(item.id),
          return_id: validId,
          sale_item_id: isValidUUID(item.sale_item_id) ? item.sale_item_id : null,
          item_type: item.item_type || 'finished_product',
          product_id: (!item.raw_material_id && isValidUUID(item.product_id)) ? item.product_id : null,
          raw_material_id: isValidUUID(item.raw_material_id) ? item.raw_material_id : null,
          product_name: item.product_name,
          unit: item.unit || 'L',
          pack_size_id: isValidUUID(item.pack_size_id) ? item.pack_size_id : null,
          pack_size_name: item.pack_size_name || null,
          size_in_base_unit: Number(item.size_in_base_unit || 1),
          quantity: Number(item.quantity || 1),
          base_quantity: Number(item.base_quantity || item.quantity || 1),
          unit_cost: Number(item.unit_cost || 0),
          unit_price: Number(item.unit_price || 0),
          subtotal: Number(item.subtotal || 0)
        }));
        const { error: itemsError } = await supabase.from('sales_return_items').insert(itemsToInsert);
        if (itemsError && itemsError.code !== 'PGRST205' && !itemsError.message?.includes('schema cache')) {
          console.warn('Supabase sales_return_items insert warning:', itemsError.message);
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('Sales return database write failed')) {
        throw err;
      }
      console.warn('upsertSalesReturn error:', err);
    }

    return salesReturn;
  },

  async deleteSalesReturn(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    try {
      await supabase.from('sales_return_items').delete().eq('return_id', id);
      const { error } = await supabase.from('sales_returns').delete().eq('id', id);
      if (error) {
        console.warn('Supabase deleteSalesReturn warning:', error);
      }
    } catch (err) {
      console.warn('deleteSalesReturn error:', err);
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

    const cleanNotes = (purchase.notes || '').replace(/\s*<!--PO_FREIGHT_DATA:.*?-->/g, '').trim();
    purchase.notes = cleanNotes;

    const freightCostVal = Number(purchase.freight_cost || 0);
    const hasMetaToPersist =
      freightCostVal > 0 ||
      Boolean(purchase.trip_id) ||
      Boolean(purchase.trip_number) ||
      (purchase.items || []).some(it => Number(it.allocated_freight || 0) > 0 || Boolean(it.unit));

    let persistedNotes = cleanNotes;
    if (hasMetaToPersist) {
      const poMeta = {
        freight_cost: freightCostVal,
        freight_payment_status: purchase.freight_payment_status || (freightCostVal > 0 ? 'paid' : undefined),
        freight_payment_method: purchase.freight_payment_method || (freightCostVal > 0 ? (purchase.payment_method || 'cash') : undefined),
        freight_amount_paid: purchase.freight_amount_paid !== undefined
          ? Number(purchase.freight_amount_paid)
          : ( (purchase.freight_payment_status || 'paid') === 'paid' ? freightCostVal : 0 ),
        freight_payment_date: purchase.freight_payment_date || purchase.date,
        trip_id: purchase.trip_id || undefined,
        trip_number: purchase.trip_number || undefined,
        items: (purchase.items || []).map((it, idx) => ({
          idx,
          raw_material_id: it.raw_material_id || undefined,
          unit: it.unit || undefined,
          allocated_freight: Number(it.allocated_freight || 0),
          landed_cost: Number(it.landed_cost ?? it.unit_cost ?? 0),
        })),
      };
      persistedNotes = `${cleanNotes} <!--PO_FREIGHT_DATA:${JSON.stringify(poMeta)}-->`.trim();
    }

    // 1. Insert parent purchase
    const payload: any = {
      id: validId,
      invoice_number: purchase.invoice_number,
      supplier_id: isValidUUID(purchase.supplier_id) ? purchase.supplier_id : null,
      supplier_name: purchase.supplier_name,
      date: purchase.date || new Date().toISOString(),
      total_amount: Number(purchase.total_amount || 0),
      amount_paid: Number(purchase.amount_paid || 0),
      payment_status: purchase.payment_status || 'unpaid',
      payment_method: purchase.payment_method || 'cash',
      notes: persistedNotes
    };

    if (purchase.freight_cost) payload.freight_cost = Number(purchase.freight_cost);
    if (purchase.trip_id && isValidUUID(purchase.trip_id)) payload.trip_id = purchase.trip_id;
    if (purchase.trip_number) payload.trip_number = purchase.trip_number;

    let { error: purchError } = await supabase.from('purchases').upsert(payload);
    if (purchError && (purchError.message?.includes('freight_cost') || purchError.message?.includes('trip_id') || purchError.code === '42703')) {
      // Fallback if trip/freight columns not yet added to purchases table
      delete payload.freight_cost;
      delete payload.trip_id;
      delete payload.trip_number;
      const retry = await supabase.from('purchases').upsert(payload);
      purchError = retry.error;
    }

    if (purchError) {
      console.error('Supabase upsertPurchase error:', purchError);
      throw new Error(`Purchase database write failed: ${purchError.message}`);
    }

    // 2. Insert line items
    await supabase.from('purchase_items').delete().eq('purchase_id', validId);

    if (purchase.items && purchase.items.length > 0) {
      const itemsToInsertWithFreight = purchase.items.map(item => ({
        id: ensureUUID(item.id),
        purchase_id: validId,
        item_type: item.item_type || 'raw_material',
        raw_material_id: isValidUUID(item.raw_material_id) ? item.raw_material_id : null,
        product_id: isValidUUID(item.product_id) ? item.product_id : null,
        product_or_material_name: item.product_or_material_name || '',
        quantity: Number(item.quantity || 0),
        unit_cost: Number(item.unit_cost || 0),
        subtotal: Number(item.subtotal || 0),
        allocated_freight: Number(item.allocated_freight || 0),
        landed_cost: Number(item.landed_cost || item.unit_cost || 0),
        trip_id: isValidUUID(item.trip_id) ? item.trip_id : null,
      }));

      const { error: itemsError } = await supabase.from('purchase_items').insert(itemsToInsertWithFreight);
      if (itemsError && (itemsError.message?.includes('allocated_freight') || itemsError.message?.includes('landed_cost') || itemsError.code === '42703')) {
        // Fallback for unmigrated purchase_items table without freight columns
        const fallbackItems = itemsToInsertWithFreight.map(({ allocated_freight, landed_cost, trip_id, ...rest }) => rest);
        const retryRes = await supabase.from('purchase_items').insert(fallbackItems);
        if (retryRes.error) {
          console.error('Supabase purchase_items fallback insert error:', retryRes.error);
          throw new Error(`Purchase items write failed: ${retryRes.error.message}`);
        }
      } else if (itemsError) {
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
  // PURCHASE TRIPS (MULTI-VENDOR SHARED TRANSPORT RUNS)
  // ============================================================================
  async upsertPurchaseTrip(trip: PurchaseTrip): Promise<PurchaseTrip> {
    if (!isSupabaseConfigured || !supabase) return trip;
    assertOnline();

    const validId = ensureUUID(trip.id);
    trip.id = validId;

    const payload: any = {
      id: validId,
      trip_number: trip.trip_number,
      date: trip.date || new Date().toISOString(),
      total_transport_cost: Number(trip.total_transport_cost || 0),
      transport_payment_status: trip.transport_payment_status || 'paid',
      transport_payment_method: trip.transport_payment_method || 'cash',
      transport_amount_paid: Number(trip.transport_amount_paid !== undefined ? trip.transport_amount_paid : trip.total_transport_cost || 0),
      transport_payment_date: trip.transport_payment_date || trip.date || new Date().toISOString(),
      transport_notes: trip.transport_notes || '',
      vehicle_or_driver: trip.vehicle_or_driver || '',
      include_pcs_in_weight_allocation: Boolean(trip.include_pcs_in_weight_allocation),
      total_material_cost: Number(trip.total_material_cost || 0),
      total_weight_kg_liter: Number(trip.total_weight_kg_liter || 0),
      grand_total: Number(trip.grand_total || 0),
      created_by: trip.created_by || null,
      created_at: trip.created_at || new Date().toISOString()
    };

    try {
      let { error: tripError } = await supabase.from('purchase_trips').upsert(payload);
      if (tripError && (tripError.message?.includes('transport_payment') || tripError.code === '42703')) {
        // Fallback without extended payment columns if not yet migrated
        delete payload.transport_payment_status;
        delete payload.transport_amount_paid;
        delete payload.transport_payment_date;
        const retry = await supabase.from('purchase_trips').upsert(payload);
        tripError = retry.error;
      }
      if (tripError) {
        console.warn('Supabase upsertPurchaseTrip notice (table may need migration):', tripError.message);
        return trip;
      }

      await supabase.from('purchase_trip_items').delete().eq('trip_id', validId);

      if (trip.items && trip.items.length > 0) {
        const itemsToInsert = trip.items.map(item => ({
          id: ensureUUID(item.id),
          trip_id: validId,
          supplier_id: isValidUUID(item.supplier_id) ? item.supplier_id : null,
          supplier_name: item.supplier_name || '',
          raw_material_id: isValidUUID(item.raw_material_id) ? item.raw_material_id : null,
          raw_material_name: item.raw_material_name || '',
          unit: item.unit || 'kg',
          quantity: Number(item.quantity || 0),
          unit_cost: Number(item.unit_cost || 0),
          subtotal: Number(item.subtotal || 0),
          payment_status: item.payment_status || 'paid',
          amount_paid: Number(item.amount_paid !== undefined ? item.amount_paid : item.subtotal || 0),
          payment_method: item.payment_method || 'cash',
          payment_date: item.payment_date || trip.date || new Date().toISOString(),
          is_weight_allocated: Boolean(item.is_weight_allocated),
          allocation_percentage: Number(item.allocation_percentage || 0),
          allocated_freight: Number(item.allocated_freight || 0),
          landed_cost: Number(item.landed_cost || 0),
          total_landed_cost: Number(item.total_landed_cost || 0),
          purchase_id: isValidUUID(item.purchase_id) ? item.purchase_id : null
        }));

        let { error: itemsError } = await supabase.from('purchase_trip_items').insert(itemsToInsert);
        if (itemsError && (itemsError.message?.includes('payment') || itemsError.code === '42703')) {
          const fallbackItems = itemsToInsert.map(({ payment_status, amount_paid, payment_method, payment_date, ...rest }: any) => rest);
          const retryItems = await supabase.from('purchase_trip_items').insert(fallbackItems);
          itemsError = retryItems.error;
        }
        if (itemsError) {
          console.warn('Supabase purchase_trip_items insert warning:', itemsError.message);
        }
      }
    } catch (e: any) {
      console.warn('Supabase purchase trip write error:', e?.message || e);
    }

    return trip;
  },

  async deletePurchaseTrip(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    try {
      await supabase.from('purchase_trip_items').delete().eq('trip_id', id);
      const { error } = await supabase.from('purchase_trips').delete().eq('id', id);
      if (error) {
        console.warn('Supabase deletePurchaseTrip notice:', error.message);
      }
    } catch (e: any) {
      console.warn('Supabase deletePurchaseTrip error:', e?.message || e);
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
      transaction_ref: payment.transaction_ref || payment.reference_no || '',
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
        } else if (payload.related_to === 'transport') {
          fallbackRelatedTo = 'supplier_balance';
          const refLabel = payment.reference_no || payment.transaction_ref || 'Freight';
          prefix = `[Transport Outflow: ${refLabel}]`;
        } else if (payload.related_to === 'capital_injection') {
          fallbackRelatedTo = 'customer_balance';
          prefix = '[Capital Injection]';
        } else if (payload.related_to === 'owner_withdrawal') {
          fallbackRelatedTo = 'supplier_balance';
          prefix = '[Owner Withdrawal]';
        } else if (payload.related_to === 'customer_advance') {
          fallbackRelatedTo = 'customer_balance';
          prefix = '[Customer Advance]';
        } else if (payload.related_to === 'sales_return_refund') {
          fallbackRelatedTo = 'customer_balance';
          prefix = `[Sales Return Refund: ${payment.reference_no || 'CRN'}]`;
        } else if (payload.related_to === 'sales_commission') {
          fallbackRelatedTo = 'supplier_balance';
          prefix = `[Sales Commission: ${payment.reference_no || 'Commission'}]`;
        } else if (payload.related_to === 'fixed_asset') {
          fallbackRelatedTo = 'supplier_balance';
          prefix = `[Fixed Asset Outflow: ${payment.reference_no || 'Asset'}]`;
        }

        if (fallbackRelatedTo) {
          console.warn(`payments_related_to_check rejected "${payload.related_to}". Retrying with fallback "${fallbackRelatedTo}"...`);
          const cleanNote = (payload.notes || '').replace(/^\[Transport Outflow:[^\]]+\]\s*/, '').trim();
          const fallbackPayload = {
            ...payload,
            related_to: fallbackRelatedTo,
            notes: `${prefix} ${cleanNote}`.trim()
          };
          const retryRes = await supabase.from('payments').upsert(fallbackPayload).select().single();
          if (!retryRes.error) {
            return {
              ...(retryRes.data as Payment),
              related_to: payment.related_to, // retain high-level related_to in local memory
              reference_no: payment.reference_no || payment.transaction_ref || undefined,
              notes: payment.notes || '',
            };
          }
        }
      }
      console.error('Supabase upsertPayment error:', error);
      throw new Error(`Payment database write failed: ${error.message}`);
    }
    return {
      ...((data as Payment) || payment),
      reference_no: payment.reference_no || payment.transaction_ref || undefined,
    };
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

    const basePayload: any = {
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

    let payload = { ...basePayload, product_name: movement.product_name || '' };
    let { error } = await supabase.from('stock_movements').upsert(payload);
    if (error && (error.code === 'PGRST204' || error.message?.includes('product_name'))) {
      payload = basePayload;
      const res = await supabase.from('stock_movements').upsert(payload);
      error = res.error;
    }

    if (error && (error.code === '23514' || error.message?.includes('check'))) {
      const fallbackPayload = {
        ...payload,
        movement_type: 'adjustment',
        notes: `[${movement.movement_type === 'production_reversal' ? 'Production Reversal' : 'Adjustment'}] ${notes}`.trim()
      };
      const retry = await supabase.from('stock_movements').upsert(fallbackPayload);
      if (retry.error) {
        console.warn('Supabase upsertStockMovement fallback warning:', retry.error.message);
      }
    } else if (error) {
      console.warn('Supabase upsertStockMovement notice:', error.message);
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
    if (error && (error.message?.includes('raw_material_movements_movement_type_check') || error.code === '23514')) {
      const fallbackPayload = {
        ...payload,
        movement_type: 'adjustment',
        notes: `[${movement.movement_type === 'production_reversal' ? 'Production Reversal' : movement.movement_type}] ${notes}`.trim()
      };
      const retry = await supabase.from('raw_material_movements').upsert(fallbackPayload);
      if (retry.error) {
        console.warn('Supabase upsertRawMaterialMovement fallback error:', retry.error.message);
      }
    } else if (error) {
      console.warn('Supabase upsertRawMaterialMovement notice:', error.message);
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
  // PACKING RUNS (BOTTLING / PACKAGING RUNS)
  // ============================================================================
  async upsertPackingRun(run: PackingRun): Promise<PackingRun> {
    if (!isSupabaseConfigured || !supabase) return run;
    assertOnline();

    const validId = ensureUUID(run.id);
    const payload = {
      id: validId,
      run_number: run.run_number,
      product_id: isValidUUID(run.product_id) ? run.product_id : run.product_id,
      product_name: run.product_name,
      pack_size_id: run.pack_size_id,
      pack_size_name: run.pack_size_name,
      quantity_packed: Number(run.quantity_packed || 0),
      size_in_base_unit: Number(run.size_in_base_unit || 1),
      bulk_liquid_consumed: Number(run.bulk_liquid_consumed || 0),
      bulk_unit_cost: Number(run.bulk_unit_cost || 0),
      bulk_total_cost: Number(run.bulk_total_cost || 0),
      packaging_materials_consumed: run.packaging_materials_consumed || [],
      packaging_total_cost: Number(run.packaging_total_cost || 0),
      total_cost: Number(run.total_cost || 0),
      true_cost_per_unit: Number(run.true_cost_per_unit || 0),
      date: run.date || new Date().toISOString(),
      operator_name: run.operator_name || 'Staff',
      notes: run.notes || '',
      created_at: run.created_at || new Date().toISOString()
    };

    const { data, error } = await supabase.from('packing_runs').upsert(payload).select().single();
    if (error) {
      console.warn('Supabase upsertPackingRun warning (falling back to local):', error.message);
    }
    return (data as PackingRun) || { ...run, id: validId };
  },

  async deletePackingRun(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !isValidUUID(id)) return;
    assertOnline();

    const { error } = await supabase.from('packing_runs').delete().eq('id', id);
    if (error) {
      console.warn('Supabase deletePackingRun error:', error.message);
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
      'sales_return_items',
      'sales_returns',
      'purchase_trip_items',
      'purchase_trips',
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
      'packing_runs',
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
  },

  // ============================================================================
  // QUOTATIONS
  // ============================================================================
  async saveQuotation(quotation: Quotation): Promise<Quotation> {
    if (!isSupabaseConfigured || !supabase) return quotation;
    try {
      assertOnline();
      const validId = ensureUUID(quotation.id);
      const payload = {
        id: validId,
        quotation_number: quotation.quotation_number,
        quotation_type: quotation.quotation_type || 'private_label',
        customer_id: isValidUUID(quotation.customer_id) ? quotation.customer_id : null,
        customer_name: quotation.customer_name,
        company_name: quotation.company_name || null,
        phone: quotation.phone || null,
        email: quotation.email || null,
        date: quotation.date,
        validity_period: quotation.validity_period,
        status: quotation.status,
        items: quotation.items || [],
        moq: quotation.moq || null,
        repeat_order_moq: quotation.repeat_order_moq || null,
        sample_cost: quotation.sample_cost || null,
        sample_lead_time: quotation.sample_lead_time || null,
        delivery_charges: quotation.delivery_charges || null,
        available_fragrances: quotation.available_fragrances || null,
        formula_specifications: quotation.formula_specifications || null,
        batch_mfg_expiry_info: quotation.batch_mfg_expiry_info || null,
        terms_conditions: quotation.terms_conditions || null,
        notes: quotation.notes || null,
        created_by: isValidUUID(quotation.created_by) ? quotation.created_by : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('quotations').upsert(payload);
      if (error) {
        console.error('Supabase quotation upsert error:', error.message);
        throw new Error(`Failed to save quotation to Supabase: ${error.message}`);
      }

      // Also sync relational quotation_items
      if (Array.isArray(quotation.items) && quotation.items.length > 0) {
        await supabase.from('quotation_items').delete().eq('quotation_id', validId);
        const itemRows = quotation.items.map(item => ({
          id: ensureUUID(item.id),
          quotation_id: validId,
          product_name: item.product_name,
          size: item.size || null,
          product_cost: Number(item.product_cost || 0),
          bottle_cost: Number(item.bottle_cost || 0),
          cap_cost: Number(item.cap_cost || 0),
          label_cost: Number(item.label_cost || 0),
          labour_cost: Number(item.labour_cost || 0),
          carton_cost: Number(item.carton_cost || 0),
          transport_cost: Number(item.transport_cost || 0),
          total_cost_per_unit: Number(item.total_cost_per_unit || 0),
          quoted_price_per_unit: Number(item.quoted_price_per_unit || 0),
          moq: item.moq || null,
          notes: item.notes || null,
          bottles_per_box: item.bottles_per_box != null ? Number(item.bottles_per_box) : null,
          unit_rate: item.unit_rate != null ? Number(item.unit_rate) : null,
          box_rate: item.box_rate != null ? Number(item.box_rate) : null,
          quantity_bottles: item.quantity_bottles != null ? Number(item.quantity_bottles) : null,
          quantity_boxes: item.quantity_boxes != null ? Number(item.quantity_boxes) : null,
          line_total: item.line_total != null ? Number(item.line_total) : null,
        }));
        const { error: itemsError } = await supabase.from('quotation_items').insert(itemRows);
        if (itemsError) {
          console.warn('Notice saving relational quotation_items:', itemsError.message);
        }
      }
    } catch (e: any) {
      console.error('saveQuotation failed:', e);
      throw e;
    }
    return quotation;
  },

  async deleteQuotation(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      if (isValidUUID(id)) {
        const { error } = await supabase.from('quotations').delete().eq('id', id);
        if (error) {
          console.error('Failed to delete quotation from cloud:', error);
          throw new Error(`Failed to delete quotation: ${error.message}`);
        }
      }
    } catch (e: any) {
      console.error('deleteQuotation failed:', e);
      throw e;
    }
  },

  // ============================================================================
  // SALES COMMISSION SYSTEM: SALESPERSONS, CLOSURES & COMMISSION PAYMENTS
  // ============================================================================
  async upsertSalesperson(salesperson: Salesperson): Promise<Salesperson> {
    if (!isSupabaseConfigured || !supabase) return salesperson;
    try {
      assertOnline();
      const payload = {
        id: ensureUUID(salesperson.id),
        name: salesperson.name,
        commission_rate: Number(salesperson.commission_rate ?? 10.0),
        is_active: Boolean(salesperson.is_active),
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('salespersons').upsert(payload).select().single();
      if (error) {
        console.warn('Supabase upsertSalesperson notice:', error.message);
      } else if (data) {
        return data as Salesperson;
      }
    } catch (e) {
      console.warn('Local fallback active for salespersons:', e);
    }
    return salesperson;
  },

  async deleteSalesperson(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      await supabase.from('salespersons').delete().eq('id', id);
    } catch (e) {
      console.warn('Failed to delete salesperson from cloud:', e);
    }
  },

  async upsertMonthlyCommissionClosure(closure: MonthlyCommissionClosure): Promise<MonthlyCommissionClosure> {
    if (!isSupabaseConfigured || !supabase) return closure;
    try {
      assertOnline();
      const payload = {
        month: closure.month,
        is_closed: closure.is_closed,
        closed_at: closure.closed_at || new Date().toISOString(),
        closed_by: closure.closed_by || null,
        closed_by_name: closure.closed_by_name || null,
        total_gross_profit: Number(closure.total_gross_profit || 0),
        total_expenses: Number(closure.total_expenses || 0),
        coverage_factor: Number(closure.coverage_factor || 0),
        total_commission: Number(closure.total_commission || 0),
        owner_remaining_profit: Number(closure.owner_remaining_profit || 0),
        include_depreciation: Boolean(closure.include_depreciation),
        snapshots: closure.snapshots || [],
        notes: closure.notes || null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('monthly_commission_closures').upsert(payload).select().single();
      if (error) {
        console.warn('Supabase upsertMonthlyCommissionClosure notice:', error.message);
      } else if (data) {
        return data as MonthlyCommissionClosure;
      }
    } catch (e) {
      console.warn('Local fallback active for commission closure:', e);
    }
    return closure;
  },

  async deleteMonthlyCommissionClosure(month: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      await supabase.from('monthly_commission_closures').delete().eq('month', month);
    } catch (e) {
      console.warn('Failed to delete commission closure from cloud:', e);
    }
  },

  async upsertCommissionPayment(payment: CommissionPayment): Promise<CommissionPayment> {
    if (!isSupabaseConfigured || !supabase) return payment;
    try {
      assertOnline();
      const payload = {
        id: payment.id,
        salesperson_id: payment.salesperson_id,
        salesperson_name: payment.salesperson_name,
        month: payment.month,
        amount: Number(payment.amount || 0),
        payment_method: payment.payment_method || 'cash',
        payment_date: payment.payment_date,
        payment_id: payment.payment_id || null,
        notes: payment.notes || null,
        recorded_by: payment.recorded_by || null,
        recorded_by_name: payment.recorded_by_name || null
      };
      const { data, error } = await supabase.from('commission_payments').upsert(payload).select().single();
      if (error) {
        console.warn('Supabase upsertCommissionPayment notice:', error.message);
      } else if (data) {
        return data as CommissionPayment;
      }
    } catch (e) {
      console.warn('Local fallback active for commission payment:', e);
    }
    return payment;
  },

  async deleteCommissionPayment(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      await supabase.from('commission_payments').delete().eq('id', id);
    } catch (e) {
      console.warn('Failed to delete commission payment from cloud:', e);
    }
  },

  async updateSaleSalesperson(saleId: string, salespersonId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      await supabase.from('sales').update({
        salesperson_id: isValidUUID(salespersonId) ? salespersonId : null
      }).eq('id', saleId);
    } catch (e) {
      console.warn('Failed to update salesperson on sale:', e);
    }
  },

  // ============================================================================
  // PARTNERS & CAPITAL TRANSACTIONS
  // ============================================================================
  async upsertPartner(partner: Partner): Promise<Partner> {
    if (!isSupabaseConfigured || !supabase) return partner;
    try {
      assertOnline();
      const payload: any = {
        id: ensureUUID(partner.id),
        name: partner.name.trim(),
        phone: partner.phone || null,
        email: partner.email || null,
        initial_capital: Number(partner.initial_capital || 0),
        is_active: partner.is_active !== false,
        notes: partner.notes || null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('partners').upsert(payload).select().single();
      if (error) {
        console.error('Failed to upsert partner in Supabase:', error);
        throw new Error(error.message);
      }
      return data as Partner;
    } catch (e: any) {
      console.error('upsertPartner error:', e);
      throw e;
    }
  },

  async deletePartner(partnerId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      const { error } = await supabase.from('partners').delete().eq('id', partnerId);
      if (error) {
        console.error('Failed to delete partner:', error);
        throw new Error(error.message);
      }
    } catch (e: any) {
      console.error('deletePartner error:', e);
      throw e;
    }
  },

  async createPartnerCapitalTransaction(txn: PartnerCapitalTransaction): Promise<PartnerCapitalTransaction> {
    if (!isSupabaseConfigured || !supabase) return txn;
    try {
      assertOnline();
      const payload: any = {
        id: ensureUUID(txn.id),
        partner_id: txn.partner_id,
        partner_name: txn.partner_name,
        date: txn.date,
        transaction_type: txn.transaction_type,
        contribution_type: txn.contribution_type || 'capital',
        amount: Number(txn.amount || 0),
        reference_id: txn.reference_id || null,
        reference_no: txn.reference_no || null,
        reference_type: txn.reference_type || 'fixed_asset',
        notes: txn.notes || null,
        created_by: txn.created_by || null,
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('partner_capital_transactions').insert(payload).select().single();
      if (error) {
        console.error('Failed to record partner capital transaction:', error);
        throw new Error(error.message);
      }
      return data as PartnerCapitalTransaction;
    } catch (e: any) {
      console.error('createPartnerCapitalTransaction error:', e);
      throw e;
    }
  },

  async deletePartnerCapitalTransactionsByReference(referenceId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      const { error } = await supabase.from('partner_capital_transactions').delete().eq('reference_id', referenceId);
      if (error) {
        console.warn('deletePartnerCapitalTransactionsByReference notice:', error.message);
      }
    } catch (e) {
      console.warn('deletePartnerCapitalTransactionsByReference error:', e);
    }
  },

  // ============================================================================
  // FIXED ASSETS & FUNDINGS
  // ============================================================================
  async upsertFixedAsset(asset: FixedAsset, fundings: FixedAssetFunding[]): Promise<FixedAsset> {
    if (!isSupabaseConfigured || !supabase) return asset;
    try {
      assertOnline();
      const assetId = ensureUUID(asset.id);
      const assetPayload: any = {
        id: assetId,
        asset_code: asset.asset_code,
        name: asset.name.trim(),
        category: asset.category,
        purchase_date: asset.purchase_date,
        vendor: asset.vendor || null,
        total_cost: Number(asset.total_cost || 0),
        useful_life_years: Number(asset.useful_life_years || 0),
        salvage_value: Number(asset.salvage_value || 0),
        status: asset.status || 'active',
        disposal_date: asset.disposal_date || null,
        disposal_amount: Number(asset.disposal_amount || 0),
        disposal_notes: asset.disposal_notes || null,
        notes: asset.notes || null,
        created_by: asset.created_by || null,
        updated_at: new Date().toISOString()
      };

      const { data: savedAsset, error: assetErr } = await supabase
        .from('fixed_assets')
        .upsert(assetPayload)
        .select()
        .single();

      if (assetErr) {
        console.error('Failed to save fixed asset in Supabase:', assetErr);
        throw new Error(assetErr.message);
      }

      // Reapply fundings
      await supabase.from('fixed_asset_fundings').delete().eq('asset_id', assetId);

      if (fundings && fundings.length > 0) {
        const fundingRows = fundings.map(f => ({
          id: ensureUUID(f.id),
          asset_id: assetId,
          funding_type: f.funding_type,
          business_amount: Number(f.business_amount || 0),
          payment_method: f.payment_method || null,
          partner_id: f.partner_id || null,
          partner_name: f.partner_name || null,
          partner_contribution_type: f.partner_contribution_type || 'capital',
          partner_amount: Number(f.partner_amount || 0),
          notes: f.notes || null
        }));

        const { error: fundErr } = await supabase.from('fixed_asset_fundings').insert(fundingRows);
        if (fundErr) {
          console.error('Failed to insert fixed asset fundings:', fundErr);
          throw new Error(fundErr.message);
        }
      }

      return {
        ...savedAsset,
        fundings
      } as FixedAsset;
    } catch (e: any) {
      console.error('upsertFixedAsset error:', e);
      throw e;
    }
  },

  async deleteFixedAsset(assetId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      await supabase.from('fixed_asset_fundings').delete().eq('asset_id', assetId);
      const { error } = await supabase.from('fixed_assets').delete().eq('id', assetId);
      if (error) {
        console.error('Failed to delete fixed asset:', error);
        throw new Error(error.message);
      }
    } catch (e: any) {
      console.error('deleteFixedAsset error:', e);
      throw e;
    }
  },

  async archiveOrDisposeFixedAsset(
    assetId: string, 
    disposalData: { 
      status: 'disposed' | 'archived'; 
      disposal_date?: string; 
      disposal_amount?: number; 
      disposal_notes?: string; 
    }
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      assertOnline();
      const { error } = await supabase.from('fixed_assets').update({
        status: disposalData.status,
        disposal_date: disposalData.disposal_date || new Date().toISOString().split('T')[0],
        disposal_amount: Number(disposalData.disposal_amount || 0),
        disposal_notes: disposalData.disposal_notes || null,
        updated_at: new Date().toISOString()
      }).eq('id', assetId);

      if (error) {
        console.error('Failed to archive/dispose fixed asset:', error);
        throw new Error(error.message);
      }
    } catch (e: any) {
      console.error('archiveOrDisposeFixedAsset error:', e);
      throw e;
    }
  }
};

