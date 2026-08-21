import { Sale, Product, Expense, Shift, Business } from '@/types/database.types';
import { formatDateTime, formatPeso } from '@/lib/formatters';

/**
 * Universal CSV download helper
 */
export function downloadCSV(filename: string, csvContent: string) {
  // Add BOM for proper UTF-8 Excel support (e.g. Philippine Peso sign ₱)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format CSV cell to escape commas and quotes
 */
function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export Sales with Line Item details to CSV
 */
export function exportSalesToCSV(sales: Sale[], filename = 'sales-transactions') {
  const headers = [
    'Receipt Number',
    'Date/Time',
    'Cashier',
    'Payment Method',
    'Reference No',
    'Status',
    'Items Summary',
    'Subtotal',
    'Discount',
    'Total Amount',
    'Amount Paid',
    'Change',
    'Notes',
  ];

  const rows = sales.map((s) => {
    const itemsSummary = (s.items || [])
      .map((i) => `${i.product_name_snapshot} (${i.quantity}x @ ${i.unit_price})`)
      .join('; ');

    return [
      escapeCSV(s.receipt_number),
      escapeCSV(formatDateTime(s.created_at)),
      escapeCSV(s.user_name || 'Staff'),
      escapeCSV(s.payment_method?.toUpperCase() || 'CASH'),
      escapeCSV(s.payment_reference || ''),
      escapeCSV(s.status?.toUpperCase() || 'COMPLETED'),
      escapeCSV(itemsSummary),
      s.subtotal.toFixed(2),
      s.discount.toFixed(2),
      s.total.toFixed(2),
      s.amount_paid.toFixed(2),
      s.change.toFixed(2),
      escapeCSV(s.notes || ''),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(`${filename}-${new Date().toISOString().split('T')[0]}.csv`, csv);
}

/**
 * Export Product Inventory to CSV
 */
export function exportInventoryToCSV(products: Product[], filename = 'inventory-catalog') {
  const headers = [
    'Product Name',
    'Category',
    'Description',
    'Cost Price (₱)',
    'Selling Price (₱)',
    'Margin (%)',
    'Current Stock',
    'Min Stock Alert',
    'Unit',
    'Section',
    'Status',
  ];

  const rows = products.map((p) => {
    const margin = p.selling_price > 0 
      ? (((p.selling_price - p.cost_price) / p.selling_price) * 100).toFixed(1)
      : '0.0';

    return [
      escapeCSV(p.name),
      escapeCSV(p.category_name || 'Uncategorized'),
      escapeCSV(p.description || ''),
      p.cost_price.toFixed(2),
      p.selling_price.toFixed(2),
      margin,
      p.stock_quantity,
      p.minimum_stock,
      escapeCSV(p.unit || 'piece'),
      p.is_kitchen ? 'Kitchen' : 'Store',
      escapeCSV(p.status?.toUpperCase() || 'ACTIVE'),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(`${filename}-${new Date().toISOString().split('T')[0]}.csv`, csv);
}

/**
 * Export Expenses to CSV
 */
export function exportExpensesToCSV(expenses: Expense[], filename = 'expenses-log') {
  const headers = [
    'Date',
    'Description',
    'Category',
    'Amount (₱)',
    'Logged By',
    'Notes',
  ];

  const rows = expenses.map((e) => [
    escapeCSV(e.date || formatDateTime(e.created_at)),
    escapeCSV(e.description || ''),
    escapeCSV((e.category || 'Other').toUpperCase()),
    e.amount.toFixed(2),
    escapeCSV(e.created_by_name || 'Staff'),
    escapeCSV(e.notes || ''),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(`${filename}-${new Date().toISOString().split('T')[0]}.csv`, csv);
}

export interface ReadingReportData {
  type: 'X' | 'Z';
  title: string;
  generatedAt: string;
  businessName: string;
  cashierName: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  grossSales: number;
  totalDiscounts: number;
  netSales: number;
  vatableSales: number;
  vatAmount: number;
  transactionCount: number;
  averageBasket: number;
  payments: {
    cash: number;
    gcash: number;
    maya: number;
    other: number;
  };
  kitchenRevenue: number;
  storeRevenue: number;
  startingCash?: number;
  expectedCashInDrawer?: number;
}

/**
 * Computes X-Reading (Mid-shift) or Z-Reading (End-of-day closure) audit metrics
 */
export function computeReadingReport(options: {
  type: 'X' | 'Z';
  sales: Sale[];
  shift?: Shift | null;
  business?: Business | null;
  cashierName?: string;
  products?: Product[];
}): ReadingReportData {
  const { type, sales, shift, business, cashierName, products = [] } = options;
  const completedSales = sales.filter((s) => s.status === 'completed');

  // Build product lookup map for accurate is_kitchen flag
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  const grossSales = completedSales.reduce((acc, s) => acc + s.subtotal, 0);
  const totalDiscounts = completedSales.reduce((acc, s) => acc + s.discount, 0);
  const netSales = completedSales.reduce((acc, s) => acc + s.total, 0);
  const transactionCount = completedSales.length;
  const averageBasket = transactionCount > 0 ? netSales / transactionCount : 0;

  const payments = { cash: 0, gcash: 0, maya: 0, other: 0 };
  let kitchenRevenue = 0;
  let storeRevenue = 0;

  completedSales.forEach((s) => {
    const mode = (s.payment_method || 'cash').toLowerCase();
    if (mode in payments) {
      payments[mode as keyof typeof payments] += s.total;
    } else {
      payments.other += s.total;
    }

    s.items?.forEach((i) => {
      const product = i.product_id ? productMap.get(i.product_id) : undefined;
      const isKitchen = product?.is_kitchen ?? (
        i.product_name_snapshot.toLowerCase().includes('silog') ||
        i.product_name_snapshot.toLowerCase().includes('meal') ||
        i.product_name_snapshot.toLowerCase().includes('pancit') ||
        i.product_name_snapshot.toLowerCase().includes('halo-halo')
      );

      if (isKitchen) {
        kitchenRevenue += i.subtotal;
      } else {
        storeRevenue += i.subtotal;
      }
    });
  });

  const vatableSales = netSales / 1.12;
  const vatAmount = netSales - vatableSales;
  const startingCash = shift?.opening_cash || 0;
  const expectedCashInDrawer = startingCash + payments.cash;

  return {
    type,
    title: type === 'X' ? 'X-READING (MID-DAY SHIFT SUMMARY)' : 'Z-READING (END-OF-DAY CLOSING REPORT)',
    generatedAt: new Date().toISOString(),
    businessName: business?.name || 'POS STORE',
    cashierName: cashierName || shift?.user_name || 'Store Cashier',
    shiftStart: shift?.start_time,
    shiftEnd: shift?.end_time,
    grossSales,
    totalDiscounts,
    netSales,
    vatableSales,
    vatAmount,
    transactionCount,
    averageBasket,
    payments,
    kitchenRevenue,
    storeRevenue,
    startingCash,
    expectedCashInDrawer,
  };
}
