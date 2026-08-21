import { Business, Profile, Category, Product, Shift, Sale, Expense, InventoryMovement, AuditLog } from "@/types/database.types";

export const SEED_BUSINESS: Business = {
  id: "b0000000-0000-0000-0000-000000000001",
  name: "SOX POS Store",
  address: "General Santos City, SOCCSKSARGEN",
  phone: "0917-555-7890",
  tin: null,
  currency: "PHP",
  receipt_header: "Salamat sa pagpalit!",
  receipt_footer: "Salamat sa pagbisita! Please come again.",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const SEED_USERS: Profile[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    business_id: SEED_BUSINESS.id,
    role: "owner",
    full_name: "Store Owner",
    avatar_url: null,
    phone: "0917-555-7890",
    pin_code: "1234",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    business_id: SEED_BUSINESS.id,
    role: "staff",
    full_name: "Cashier Staff 1",
    avatar_url: null,
    phone: "0917-555-1111",
    pin_code: "1111",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    business_id: SEED_BUSINESS.id,
    role: "staff",
    full_name: "Cashier Staff 2",
    avatar_url: null,
    phone: "0917-555-2222",
    pin_code: "2222",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const SEED_CATEGORIES: Category[] = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    business_id: SEED_BUSINESS.id,
    name: "General Store Items",
    description: "Retail groceries, drinks, and snacks",
    is_active: true,
    is_kitchen: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000002",
    business_id: SEED_BUSINESS.id,
    name: "Kitchen Meals & Cooked Food",
    description: "Freshly cooked rice meals, silogs, sizzling dishes, and snacks",
    is_active: true,
    is_kitchen: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Clean empty database state ready for user's real business data
export const SEED_PRODUCTS: Product[] = [];
export const SEED_SHIFTS: Shift[] = [];
export const SEED_SALES: Sale[] = [];
export const SEED_MOVEMENTS: InventoryMovement[] = [];
export const SEED_EXPENSES: Expense[] = [];
export const SEED_AUDIT_LOGS: AuditLog[] = [];
