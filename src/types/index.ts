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

export interface PackSize {
  id: string;
  product_id: string;
  name: string; // e.g. "500ml Bottle", "1L Bottle", "5L Can", "10kg Sack", "Bulk / Loose"
  size_in_base_unit: number; // e.g. 0.5 for 500ml, 1.0 for 1L, 5.0 for 5L
  unit_label: string; // "bottle", "can", "bag", "liter", "kg", "carton"
  selling_price: number; // Default selling rate for this packaging
  is_default?: boolean;
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
  quantity_produced: number; // In base unit (kg or liter)
  base_unit: BaseUnit;
  date: string;
  supervisor_name: string;
  raw_materials_consumed: ConsumedRawMaterial[];
  total_batch_cost: number;
  cost_per_base_unit: number;
  notes?: string;
  created_at?: string;
}

// RAW MATERIAL MOVEMENTS
export type RawMaterialMovementType = 'purchase_in' | 'production_out' | 'adjustment' | 'wastage' | 'return';

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
export type PaymentMethod = 'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'cheque' | 'credit';

export interface SaleItem {
  id?: string;
  product_id: string;
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
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  salesperson_id?: string;
  salesperson_name?: string;
  notes?: string;
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
  created_at?: string;
}

export type StockMovementType = 'purchase_in' | 'sale_out' | 'adjustment' | 'production' | 'wastage' | 'return';

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
  related_to: 'sale' | 'purchase' | 'customer_balance' | 'supplier_balance' | 'expense';
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
  entity_type: 'customer' | 'supplier' | 'product' | 'raw_material' | 'sale' | 'purchase' | 'formulation' | 'staff' | 'production_batch' | 'expense';
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

