export type UserRole = 'owner' | 'staff';
export type ProductStatus = 'active' | 'archived';
export type ProductUnit = 'piece' | 'pack' | 'box' | 'bottle' | 'kilo' | 'gram' | 'liter' | 'can' | 'other';
export type MovementType = 'SALE' | 'STOCK_IN' | 'ADJUSTMENT' | 'DAMAGE' | 'RETURN' | 'CORRECTION' | 'VOID_RETURN';
export type ShiftType = 'morning' | 'night' | 'custom';
export type ShiftStatus = 'open' | 'closed';
export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'other';
export type SaleStatus = 'completed' | 'refunded' | 'cancelled' | 'voided';
export type ExpenseCategory = 'Supplies' | 'Utilities' | 'Rent' | 'Transportation' | 'Maintenance' | 'Salaries' | 'Other';

export interface Business {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  tin: string | null;
  currency: string;
  receipt_header: string | null;
  receipt_footer: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  business_id: string;
  role: UserRole;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  pin_code?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_kitchen?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: string | null;
  category_name?: string;
  name: string;
  description: string | null;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  minimum_stock: number;
  unit: ProductUnit;
  image_url: string | null;
  is_kitchen?: boolean;
  has_drink_option?: boolean;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  business_id: string;
  product_id: string;
  product_name?: string;
  type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_id: string | null;
  reason: string | null;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
}

export type ScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'absent' | 'cancelled';

export interface ShiftSchedule {
  id: string;
  business_id: string;
  user_id: string;
  user_name?: string;
  shift_name: string;
  shift_type: ShiftType;
  schedule_date: string;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  business_id: string;
  user_id: string;
  user_name?: string;
  shift_type: ShiftType;
  start_time: string;
  end_time: string | null;
  opening_cash: number;
  expected_cash: number | null;
  actual_cash: number | null;
  cash_difference: number | null;
  status: ShiftStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  receipt_number: string;
  user_id: string;
  user_name?: string;
  shift_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  change: number;
  payment_reference: string | null;
  status: SaleStatus;
  notes: string | null;
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  cost_price_snapshot: number;
  subtotal: number;
  selected_drink_id?: string | null;
  selected_drink_name?: string | null;
}

export interface Expense {
  id: string;
  business_id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes: string | null;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  business_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export interface VoidedSale {
  id: string;
  business_id: string;
  sale_id: string;
  receipt_number: string;
  total_amount: number;
  void_reason: string;
  voided_by: string | null;
  voided_by_name?: string | null;
  restock_items: boolean;
  notes: string | null;
  created_at: string;
}
