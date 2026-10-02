export type UserRole = 'owner' | 'sales_staff' | 'accounts_staff' | 'general_staff';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  is_deactivated?: boolean;
  created_at: string;
  updated_at?: string;
}

export type ProductUnit = 'liter' | 'kg' | 'pcs' | 'bottle' | 'can' | 'drum' | 'carton';
export type BaseUnit = 'liter' | 'kg';

export interface PackagingItem {
  raw_material_id: string;
  raw_material_name: string;
  quantity: number; // Quantity required to pack 1 unit of this size
  unit: RawMaterialUnit;
  cost_per_unit?: number;
}

export interface PackSize {
  id: string;
  product_id: string;
  name: string; // e.g. "500ml Bottle", "1L Bottle", "5L Can", "10kg Sack", "Bulk / Loose"
  size_in_base_unit: number; // e.g. 0.5 for 500ml, 1.0 for 1L, 5.0 for 5L
  unit_label: string; // "bottle", "can", "bag", "liter", "kg", "carton"
  selling_price: number; // Default selling rate for this packaging
  is_default?: boolean;
  packaging_items?: PackagingItem[]; // Packaging recipe per 1 unit of this size
  packed_stock?: number; // Physical bottles/packs filled and ready to sell
  true_cost?: number; // Combined cost per bottle (bulk liquid + packaging materials)
  bottles_per_box?: number; // Number of bottles in a full carton/box (e.g. 24 or 12)
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: ProductUnit;
  base_unit?: BaseUnit; // Single source of truth for stock (kg or liter)
  cost_price: number; // Cost per base unit (PKR/L or PKR/kg)
  selling_price: number; // Default selling rate per base unit or standard pack
  current_stock: number; // STRICTLY IN BASE UNIT (Liters or Kg)
  reorder_level: number; // In base unit
  description?: string;
  pack_sizes?: PackSize[]; // Packaging options for sales reference
  is_active: boolean;
  is_archived?: boolean; // Soft delete flag for products with historical transactions
  is_private_label?: boolean; // True if contract/private label product for a client
  client_brand_name?: string; // e.g. "Neo Clean", "Crown Chemicals"
  default_labour_rate?: number; // Default packaging labour per bottle (e.g. 3.5 PKR)
  created_at?: string;
  updated_at?: string;
}

// 1. RAW MATERIALS ENTITY
export type RawMaterialCategory = 'Surfactants' | 'Acids & Alkalis' | 'Fragrances & Perfumes' | 'Dyes & Colorants' | 'Salts & Fillers' | 'Packaging & Containers' | 'General';
export type RawMaterialUnit = 'kg' | 'liter' | 'pcs';

export interface RawMaterial {
  id: string;
  name: string; // e.g. "LABSA 96%", "SLES 70%", "Caustic Soda", "Phenyl Bottle 1L"
  category: string;
  unit: RawMaterialUnit;
  current_stock: number;
  reorder_level: number;
  cost_per_unit: number; // PKR per kg, liter, or piece
  description?: string;
  is_active: boolean;
  is_archived?: boolean;
  is_sellable?: boolean; // Whether this raw material can be sold directly to customers
  selling_price?: number; // Resale rate per unit (PKR)
  created_at?: string;
  updated_at?: string;
}

// 2. BILL OF MATERIALS (FORMULATION / RECIPE)
export interface FormulationItem {
  raw_material_id: string;
  raw_material_name: string;
  quantity: number; // Quantity required to produce 1 base unit (1 kg or 1 liter)
  unit: RawMaterialUnit;
  cost_per_unit?: number;
}

export interface ProductFormulation {
  id: string;
  product_id: string;
  product_name: string;
  base_unit: BaseUnit; // kg or liter
  yield_quantity: number; // Standard 1 (base unit)
  items: FormulationItem[];
  instructions?: string;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

// 3. PRODUCTION BATCH
export interface ConsumedRawMaterial {
  raw_material_id: string;
  raw_material_name: string;
  quantity_consumed: number;
  unit: RawMaterialUnit;
  unit_cost: number;
  total_cost: number;
}

export interface ProductionBatch {
  id: string;
  batch_number: string; // e.g. "BATCH-202609-001"
  product_id: string;
  product_name: string;
  formulation_batch_size?: number; // Theoretical recipe scale (e.g. 1.000 kg) determining raw material consumption
  quantity_produced: number; // Actual physical output produced (e.g. 1.500 kg)
  base_unit: BaseUnit;
  date: string;
  supervisor_name: string;
  raw_materials_consumed: ConsumedRawMaterial[];
  total_batch_cost: number;
  cost_per_base_unit: number;
  notes?: string;
  created_at?: string;
}

// 3B. PACKING RUN (BOTTLING / PACKAGING BATCH)
export interface ConsumedPackagingMaterial {
  raw_material_id: string;
  raw_material_name: string;
  quantity_per_unit: number;
  total_quantity: number;
  unit: RawMaterialUnit;
  unit_cost: number;
  total_cost: number;
}

export interface PackingRun {
  id: string;
  run_number: string; // e.g. "PACK-202609-001"
  product_id: string;
  product_name: string;
  pack_size_id: string;
  pack_size_name: string;
  quantity_packed: number; // Number of bottles/packs filled
  size_in_base_unit: number; // e.g. 1.0 for 1L
  bulk_liquid_consumed: number; // quantity_packed * size_in_base_unit
  bulk_unit_cost: number; // Chemical bulk cost per base unit
  bulk_total_cost: number;
  packaging_materials_consumed: ConsumedPackagingMaterial[];
  packaging_total_cost: number;
  total_cost: number; // bulk_total_cost + packaging_total_cost
  true_cost_per_unit: number; // total_cost / quantity_packed
  date: string;
  operator_name?: string;
  notes?: string;
  created_at?: string;
}

// RAW MATERIAL MOVEMENTS
export type RawMaterialMovementType = 'purchase_in' | 'production_out' | 'packaging_out' | 'sale_out' | 'resale_out' | 'adjustment' | 'wastage' | 'return';

export interface RawMaterialMovement {
  id: string;
  raw_material_id: string;
  raw_material_name: string;
  movement_type: RawMaterialMovementType;
  quantity: number; // +ve for addition, -ve for deduction
  previous_stock: number;
  new_stock: number;
  reference_id?: string; // Links to purchase PO # or Production Batch #
  notes?: string;
  date: string;
  created_by_name?: string;
}

export type CustomerType = 'retail' | 'wholesale' | 'distributor';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  customer_type: CustomerType;
  credit_limit: number;
  current_balance: number; // Positive = owes factory (Receivable)
  notes?: string;
  is_active: boolean;
  is_archived?: boolean;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  raw_material_type: string;
  current_balance: number; // Positive = factory owes supplier (Payable)
  notes?: string;
  is_active: boolean;
  is_archived?: boolean;
  created_at?: string;
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'credit';
export type PaymentMethod = 'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'cheque' | 'credit' | 'advance';

export interface SaleItem {
  id?: string;
  item_type?: 'finished_product' | 'raw_material';
  product_id?: string;
  raw_material_id?: string;
  product_name: string;
  unit?: string;
  // Packaging / Pack Size Details
  pack_size_id?: string;
  pack_size_name?: string; // e.g. "5L Can", "500ml Bottle", "Bulk / Loose"
  pack_quantity?: number; // Number of packs/bottles sold (e.g. 20)
  size_in_base_unit?: number; // Multiplier (e.g. 5.0 for 5L can)
  base_quantity: number; // Total quantity in product base unit deducted from stock (e.g. 100 Liters)
  quantity: number; // Display count (e.g. 20 cans or 100 liters)
  unit_cost: number;
  unit_price: number; // Actual selling rate used for this sale line item
  default_unit_price?: number; // Standard / catalog selling rate (for reference & comparison)
  subtotal: number;
  // Dedicated Private Label Fields
  is_private_label?: boolean;
  box_qty?: number; // Number of boxes sold (e.g. 26)
  bottles_per_box?: number; // e.g. 24 or 12
  bottle_qty?: number; // Total bottles = box_qty * bottles_per_box or entered (e.g. 624)
  liters_qty?: number; // Total liters = bottle_qty * size_in_base_unit (e.g. 171.60)
  rate_per_liter?: number; // Negotiated price per liter (e.g. 170.00)
}

export interface Sale {
  id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  amount_paid: number;
  advance_amount_applied?: number;
  advance_received_date?: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  salesperson_id?: string;
  salesperson_name?: string;
  notes?: string;
  // Dedicated Private Label Fields
  invoice_type?: 'standard' | 'private_label';
  is_private_label?: boolean;
  client_brand_name?: string;
  labour_rate_per_bottle?: number; // Packing labour cost per bottle (e.g. 3.5 PKR)
  labour_bottle_qty?: number; // Sum of all bottles across line items (e.g. 948)
  labour_total_amount?: number; // Total labour cost (e.g. 3,318 PKR)
  created_at?: string;
}

// ==============================================================================
// 2B. SALES RETURNS & CREDIT NOTES ENTITY
// ==============================================================================
export type SalesReturnRefundOption = 'reduce_receivable' | 'cash_refund' | 'customer_advance';

export interface SalesReturnItem {
  id?: string;
  return_id?: string;
  sale_item_id?: string;
  item_type?: 'finished_product' | 'raw_material';
  product_id?: string;
  raw_material_id?: string;
  product_name: string;
  unit?: string;
  pack_size_id?: string;
  pack_size_name?: string;
  size_in_base_unit?: number;
  quantity: number; // returned display count (e.g. 2 cans, or 10 kg)
  base_quantity: number; // base unit qty to return to inventory (e.g. 10 L)
  unit_cost: number; // original unit cost for reversing COGS
  unit_price: number; // unit selling price at which it was invoiced
  subtotal: number; // quantity * unit_price
}

export interface SalesReturn {
  id: string;
  credit_note_number: string; // e.g. "CRN-202609-001"
  sale_id: string; // linked original invoice ID
  invoice_number: string; // original invoice number e.g. "INV-..."
  customer_id?: string;
  customer_name: string;
  date: string;
  items: SalesReturnItem[];
  total_amount: number; // total value of returned items
  reason?: string; // e.g. "Damaged Goods", "Wrong Item Delivered", "Quality Defect", "Customer Changed Mind", "Other"
  notes?: string;
  refund_method: SalesReturnRefundOption; // 'reduce_receivable' | 'cash_refund' | 'customer_advance'
  payment_method?: PaymentMethod; // applicable if cash_refund
  refund_payment_id?: string; // ID of the cash refund payment voucher if cash_refund
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
}

export interface PurchaseItem {
  id?: string;
  item_type?: 'raw_material' | 'finished_product' | 'general';
  raw_material_id?: string;
  product_id?: string;
  product_or_material_name: string;
  unit?: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  allocated_freight?: number; // Allocated freight share in PKR
  landed_cost?: number; // Unit landed cost = unit_cost + (allocated_freight / quantity)
  trip_id?: string;
  trip_number?: string;
}

export interface Purchase {
  id: string;
  invoice_number: string;
  supplier_id?: string;
  supplier_name: string;
  date: string;
  items: PurchaseItem[];
  total_amount: number;
  amount_paid: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method: PaymentMethod;
  notes?: string;
  freight_cost?: number; // Freight or additional transport cost for single purchase
  trip_id?: string; // Associated PurchaseTrip ID if created via trip
  trip_number?: string;
  created_at?: string;
}

// ==============================================================================
// 3B. PURCHASE TRIPS (MULTI-VENDOR SHARED TRANSPORT RUNS)
// ==============================================================================
export interface PurchaseTripItem {
  id: string;
  trip_id?: string;
  supplier_id: string;
  supplier_name: string;
  raw_material_id: string;
  raw_material_name: string;
  unit: RawMaterialUnit;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  is_weight_allocated: boolean;
  allocation_percentage: number;
  allocated_freight: number;
  landed_cost: number;
  total_landed_cost: number;
  purchase_id?: string;
}

export interface PurchaseTrip {
  id: string;
  trip_number: string; // e.g. "TRIP-260925-1042"
  date: string;
  total_transport_cost: number;
  transport_payment_method: PaymentMethod;
  transport_notes?: string;
  vehicle_or_driver?: string;
  include_pcs_in_weight_allocation?: boolean;
  total_material_cost: number;
  total_weight_kg_liter: number;
  grand_total: number;
  items: PurchaseTripItem[];
  created_by?: string;
  created_at?: string;
}

export type StockMovementType = 'purchase_in' | 'sale_out' | 'adjustment' | 'production' | 'packaging_out' | 'wastage' | 'return';

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: StockMovementType;
  quantity: number; // +ve for additions, -ve for deductions in BASE UNIT
  previous_stock?: number;
  new_stock?: number;
  reference_id?: string;
  notes?: string;
  date: string;
  created_by_name?: string;
}

export type ExpenseCategory = 
  | 'Rent' 
  | 'Electricity' 
  | 'Labor/Salaries' 
  | 'Maintenance' 
  | 'Transport' 
  | 'Raw Material Handling' 
  | 'Other'
  | string;

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  payment_method: PaymentMethod;
  recorded_by?: string;
  recorded_by_name?: string;
  is_recurring?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RecurringExpense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  is_active: boolean;
  last_posted_month?: string; // Format: 'YYYY-MM' e.g. '2026-09'
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  id: string;
  related_to: 'sale' | 'purchase' | 'customer_balance' | 'supplier_balance' | 'expense' | 'capital_injection' | 'owner_withdrawal' | 'customer_advance' | 'sales_return_refund';
  reference_id?: string;
  reference_no?: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_ref?: string;
  notes?: string;
  date: string;
  created_by?: string;
  created_at?: string;
}

// ==============================================================================
// 4. DELETION & REVERSAL AUDIT LOG
// ==============================================================================
export interface DeletionAuditLog {
  id: string;
  entity_type: 'customer' | 'supplier' | 'product' | 'raw_material' | 'sale' | 'purchase' | 'formulation' | 'staff' | 'production_batch' | 'packing_run' | 'expense' | 'sales_return';
  entity_id: string;
  entity_title: string;
  action_type: 'deleted' | 'archived' | 'reversed_and_deleted' | 'deactivated';
  impact_summary: string;
  performed_by: string;
  performed_by_role: string;
  date: string;
  reversal_details?: {
    stock_reversed?: { name: string; quantity_reversed: number; unit: string; previous_stock: number; new_stock: number }[];
    balance_reversed?: { entity_name: string; amount_reversed: number; previous_balance: number; new_balance: number };
    payments_reversed_count?: number;
  };
}
// ==============================================================================
// 5. PRICE QUOTATIONS & PROPOSALS ENTITY
// ==============================================================================
export type QuotationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface QuotationLineItem {
  id: string;
  product_name: string; // Product / formula name (e.g. "Car Wash Shampoo")
  size?: string; // Pack size description (e.g. "500ml Bottle", "275ml Bottle", "1 Liter")
  // Fully manual cost breakdown fields (all uncoupled from BOM/system)
  product_cost: number; // Bulk chemical/formulation cost per unit
  bottle_cost: number; // Bottle container cost
  cap_cost: number; // Cap / trigger / pump cost
  label_cost: number; // Sticker label front/back cost
  labour_cost: number; // Filling, induction seal & packing labour cost
  carton_cost: number; // Master shipper carton cost per unit
  transport_cost?: number; // Transportation / delivery cost per unit
  total_cost_per_unit: number; // Auto-sum of the component cost elements
  quoted_price_per_unit: number; // Final selling price quoted to customer
  moq?: string; // Optional line-specific MOQ
  notes?: string;
}

export interface Quotation {
  id: string;
  quotation_number: string; // e.g. "QT-2026-0001"
  customer_id?: string; // Optional if existing customer selected
  customer_name: string; // Customer or prospect person name
  company_name?: string; // Company / Brand name
  phone?: string;
  email?: string;
  date: string; // Quotation date (YYYY-MM-DD)
  validity_period: string; // e.g. "Valid for 15 days"
  status: QuotationStatus; // 'pending' | 'accepted' | 'rejected' | 'expired'
  items: QuotationLineItem[];
  // Additional manual fields
  moq?: string; // Minimum Order Quantity (e.g. "1,000 Units per SKU" or optional per-SKU)
  repeat_order_moq?: string; // Repeat Order MOQ (e.g. "500 Units")
  sample_cost?: string; // Sample Cost (e.g. "PKR 2,500 (Refundable upon order)")
  sample_lead_time?: string; // Sample Lead Time (e.g. "3-5 Working Days")
  delivery_charges?: string; // Delivery Charges (e.g. "Ex-Factory Lahore / At actual")
  available_fragrances?: string; // Available Fragrances (e.g. "Lemon, Ocean Breeze, Strawberry, Jasmine")
  formula_specifications?: string; // Formula Specifications
  batch_mfg_expiry_info?: string; // Batch / MFG / Expiry Info
  terms_conditions?: string; // Payment & commercial terms
  notes?: string; // Private internal notes
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}
