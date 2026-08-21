import { Product, PaymentMethod, Shift } from './database.types';

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // item-level discount in PHP
  subtotal: number;
  special_instructions?: string;
  selected_drink?: Product | null;
}

export type DiscountType = 'fixed' | 'percentage';

export interface CartDiscount {
  type: DiscountType;
  value: number;
  amount: number;
  reason?: string;
}

export interface CheckoutData {
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  paymentReference?: string;
  customerName?: string;
  notes?: string;
}

export interface StockStatusInfo {
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  label: string;
  color: string;
  textColor: string;
}

export interface POSMetrics {
  todaySales: number;
  transactionCount: number;
  averageSale: number;
  estimatedProfit: number;
}

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
  period: 'today' | '7days' | '30days' | 'thisMonth' | 'custom';
}
