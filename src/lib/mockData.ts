import { 
  Product, 
  Customer, 
  Supplier, 
  Sale, 
  Purchase, 
  StockMovement, 
  Payment, 
  Profile, 
  RawMaterial, 
  ProductFormulation, 
  ProductionBatch, 
  RawMaterialMovement 
} from '../types';

// ==============================================================================
// 1. RAW MATERIALS INITIAL DATA (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_RAW_MATERIALS: RawMaterial[] = [];

// ==============================================================================
// 2. FINISHED PRODUCTS (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_PRODUCTS: Product[] = [];

// ==============================================================================
// 3. PRODUCT FORMULATIONS / BOM (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_FORMULATIONS: ProductFormulation[] = [];

// ==============================================================================
// 4. PRODUCTION BATCHES (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_PRODUCTION_BATCHES: ProductionBatch[] = [];

// ==============================================================================
// 5. RAW MATERIAL STOCK MOVEMENTS (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_RAW_MATERIAL_MOVEMENTS: RawMaterialMovement[] = [];

// ==============================================================================
// 6. CUSTOMERS (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_CUSTOMERS: Customer[] = [];

// ==============================================================================
// 7. SUPPLIERS (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_SUPPLIERS: Supplier[] = [];

// ==============================================================================
// 8. FACTORY USER PROFILES & AUTHENTICATION ROLES
// ==============================================================================
export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001',
    name: 'Haji Muhammad Sharjeel (Owner)',
    email: 'owner@perfectshine.pk',
    role: 'owner',
    phone: '0300-8400001',
    is_active: true,
    created_at: '2026-01-01',
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000002',
    name: 'Usman Tariq (Sales Lead)',
    email: 'sales@perfectshine.pk',
    role: 'sales_staff',
    phone: '0321-4500002',
    is_active: true,
    created_at: '2026-01-15',
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000003',
    name: 'Farhan Sheikh (Accounts & Ledger)',
    email: 'accounts@perfectshine.pk',
    role: 'accounts_staff',
    phone: '0333-6700003',
    is_active: true,
    created_at: '2026-02-01',
  },
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-000000000004',
    name: 'Bilal Ahmed (Plant Supervisor)',
    email: 'plant@perfectshine.pk',
    role: 'general_staff',
    phone: '0315-9900004',
    is_active: true,
    created_at: '2026-02-10',
  },
];

// ==============================================================================
// 9. SALES INVOICES (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_SALES: Sale[] = [];

// ==============================================================================
// 10. PURCHASES & POs (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_PURCHASES: Purchase[] = [];

// ==============================================================================
// 11. STOCK MOVEMENTS (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];

// ==============================================================================
// 12. PAYMENTS & CASHBOOK (CLEAN SLATE: 0 ITEMS)
// ==============================================================================
export const INITIAL_PAYMENTS: Payment[] = [];
