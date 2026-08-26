'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService, KEYS, getStorage } from '@/lib/db';
import { Sale, PaymentMethod, VoidedSale, Business } from '@/types/database.types';
import { formatPeso, formatDateTime } from '@/lib/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CurrencyText } from '@/components/ui/currency-text';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
  ReceiptText,
  Search,
  Printer,
  Calendar,
  CreditCard,
  User,
  CheckCircle2,
  Download,
  RefreshCw,
  Ban,
  AlertTriangle,
  RotateCcw,
  TrendingDown,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportSalesToCSV } from '@/lib/export-utils';

const VOID_REASONS = [
  'Conflict / Wrong items ordered',
  'Customer changed mind / cancelled',
  'Payment dispute / duplicate transaction',
  'Cashier entry error / test transaction',
  'Damaged or unavailable item',
  'Other',
];

export default function SalesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isReprintModalOpen, setIsReprintModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Void Modal state
  const [voidModalSale, setVoidModalSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState<string>(VOID_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [restockItems, setRestockItems] = useState<boolean>(true);
  const [voidNotes, setVoidNotes] = useState<string>('');
  const [isVoiding, setIsVoiding] = useState<boolean>(false);

  // Fetch Sales
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => dbService.getSales(),
    initialData: () => getStorage<Sale[]>(KEYS.SALES, []),
    initialDataUpdatedAt: () => 0,
  });

  // Fetch Voided Sales
  const { data: voidedSales = [] } = useQuery({
    queryKey: ['voided_sales'],
    queryFn: () => dbService.getVoidedSales(),
    initialData: () => getStorage<VoidedSale[]>(KEYS.VOIDED_SALES, []),
    initialDataUpdatedAt: () => 0,
  });

  // Fetch Business info for receipts
  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: () => dbService.getBusiness(),
    initialData: () => getStorage<Business | null>(KEYS.BUSINESS, null),
    initialDataUpdatedAt: () => 0,
  });

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    try {
      await dbService.syncLocalToSupabase();
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['voided_sales'] });
      toast.success('Sales synced with Supabase cloud successfully!');
    } catch (err: any) {
      toast.error('Sync failed', { description: err?.message });
    } finally {
      setIsSyncing(false);
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const completed = sales.filter((s) => s.status === 'completed');
    const voided = sales.filter((s) => s.status === 'voided');

    const totalRevenue = completed.reduce((sum, s) => sum + s.total, 0);
    const totalVoidedAmount = voided.reduce((sum, s) => sum + s.total, 0);

    return {
      completedCount: completed.length,
      totalRevenue,
      voidedCount: voided.length,
      totalVoidedAmount,
    };
  }, [sales]);

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Status filter
      if (statusFilter !== 'all' && sale.status !== statusFilter) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== 'all' && sale.payment_method !== paymentFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReceipt = sale.receipt_number.toLowerCase().includes(q);
        const matchesUser = sale.user_name?.toLowerCase().includes(q);
        const matchesRef = sale.payment_reference?.toLowerCase().includes(q);
        return matchesReceipt || matchesUser || matchesRef;
      }

      return true;
    });
  }, [sales, statusFilter, paymentFilter, searchQuery]);

  const handleRowClick = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailDrawerOpen(true);
  };

  const handleReprint = () => {
    setIsReprintModalOpen(true);
  };

  const handleOpenVoidModal = (sale: Sale) => {
    setVoidModalSale(sale);
    setVoidReason(VOID_REASONS[0]);
    setCustomReason('');
    setRestockItems(true);
    setVoidNotes('');
  };

  const handleConfirmVoid = async () => {
    if (!voidModalSale) return;

    const finalReason = voidReason === 'Other' ? customReason.trim() || 'Other' : voidReason;

    setIsVoiding(true);
    try {
      await dbService.voidSale(voidModalSale.id, {
        reason: finalReason,
        restock_items: restockItems,
        notes: voidNotes.trim() || undefined,
      });

      toast.success(`Transaction #${voidModalSale.receipt_number} Voided`, {
        description: restockItems ? 'Items were returned to inventory stock.' : 'Transaction marked as voided.',
      });

      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['voided_sales'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['movements'] });

      setVoidModalSale(null);
      if (selectedSale?.id === voidModalSale.id) {
        setSelectedSale((prev) => prev ? { ...prev, status: 'voided' } : null);
      }
    } catch (err: any) {
      toast.error('Failed to void transaction', { description: err?.message });
    } finally {
      setIsVoiding(false);
    }
  };

  const handleExport = () => {
    if (filteredSales.length === 0) {
      toast.error('No sales to export');
      return;
    }
    exportSalesToCSV(filteredSales, 'sales-history');
    toast.success(`Exported ${filteredSales.length} transaction records to CSV`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sales & Transactions</h1>
          <p className="text-sm text-muted-foreground">
            View completed sales, transaction breakdowns, voided transactions, and cashier audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncCloud}
            disabled={isSyncing}
            className="gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Cloud'}
          </Button>

          <Button
            variant="outline"
            onClick={handleExport}
            className="gap-2 font-medium text-xs"
          >
            <Download className="h-4 w-4" />
            Export CSV ({filteredSales.length})
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Net Revenue */}
        <Card className="bg-card/50 border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Net Active Revenue
              </p>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                {formatPeso(metrics.totalRevenue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                From {metrics.completedCount} completed transactions
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Completed Orders Count */}
        <Card className="bg-card/50 border-border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completed Orders
              </p>
              <div className="text-2xl font-bold text-foreground mt-1">
                {metrics.completedCount}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Active and paid
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Voided Transactions */}
        <Card className={`border shadow-sm ${metrics.voidedCount > 0 ? 'bg-rose-500/5 border-rose-500/30' : 'bg-card/50 border-border'}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Voided Sales
              </p>
              <div className={`text-2xl font-bold mt-1 ${metrics.voidedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                {metrics.voidedCount}
              </div>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                {metrics.totalVoidedAmount > 0 ? `Total: ${formatPeso(metrics.totalVoidedAmount)}` : 'No voided sales'}
              </p>
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${metrics.voidedCount > 0 ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400' : 'bg-muted border border-border text-muted-foreground'}`}>
              <Ban className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by receipt # or cashier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Transaction Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed Only</SelectItem>
            <SelectItem value="voided">Voided Only</SelectItem>
          </SelectContent>
        </Select>

        {/* Payment Filter */}
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-48 bg-card">
            <SelectValue placeholder="Payment Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment Methods</SelectItem>
            <SelectItem value="cash">Cash Only</SelectItem>
            <SelectItem value="gcash">GCash Only</SelectItem>
            <SelectItem value="maya">Maya Only</SelectItem>
            <SelectItem value="other">Other / Card</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          {filteredSales.length === 0 ? (
            <EmptyState
              title="No sales transactions found"
              description="Transactions recorded in the POS will be listed here with receipts and status."
              className="m-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    className={`cursor-pointer transition-colors ${sale.status === 'voided' ? 'bg-rose-500/[0.03] hover:bg-rose-500/[0.07] opacity-80' : 'hover:bg-muted/40'}`}
                    onClick={() => handleRowClick(sale)}
                  >
                    <TableCell className="font-mono font-bold text-foreground">
                      {sale.receipt_number}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(sale.created_at)}
                    </TableCell>

                    <TableCell className="text-xs font-medium text-foreground">
                      {sale.user_name || 'Staff'}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          sale.payment_method === 'cash'
                            ? 'cash'
                            : sale.payment_method === 'gcash'
                            ? 'gcash'
                            : sale.payment_method === 'maya'
                            ? 'maya'
                            : 'other'
                        }
                        className="uppercase text-[10px]"
                      >
                        {sale.payment_method}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center text-xs text-muted-foreground">
                      {sale.items?.reduce((s, i) => s + i.quantity, 0) || 1}
                    </TableCell>

                    <TableCell className={`text-right font-mono font-bold ${sale.status === 'voided' ? 'line-through text-muted-foreground' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {formatPeso(sale.total)}
                    </TableCell>

                    <TableCell>
                      {sale.status === 'voided' ? (
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold gap-1 bg-rose-600 text-white">
                          <Ban className="h-2.5 w-2.5" />
                          Voided
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] capitalize">
                          {sale.status}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSale(sale);
                          setIsReprintModalOpen(true);
                        }}
                        className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Print Receipt"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Receipt</span>
                      </Button>

                      {sale.status !== 'voided' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenVoidModal(sale)}
                          className="h-8 gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                          title="Void this Transaction"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Void</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Drawer */}
      <Sheet open={isDetailDrawerOpen} onOpenChange={setIsDetailDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {selectedSale && (
            <div className="space-y-5 pt-2">
              <SheetHeader className="text-left pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  {selectedSale.status === 'voided' ? (
                    <Badge variant="destructive" className="uppercase font-bold gap-1 bg-rose-600 text-white">
                      <Ban className="h-3 w-3" />
                      Voided Transaction
                    </Badge>
                  ) : (
                    <Badge variant="success" className="capitalize">
                      {selectedSale.status}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(selectedSale.created_at)}
                  </span>
                </div>
                <SheetTitle className="font-mono text-lg font-bold mt-2">
                  {selectedSale.receipt_number}
                </SheetTitle>
              </SheetHeader>

              {/* Voided Warning Notice */}
              {selectedSale.status === 'voided' && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Transaction Voided</span>
                  </div>
                  <p className="text-[11px] opacity-90">
                    This sale was voided and excluded from active sales revenue. Items were returned to inventory stock.
                  </p>
                </div>
              )}

              {/* Cashier & Payment Metadata */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 text-xs">
                <div>
                  <span className="text-muted-foreground block">Cashier:</span>
                  <span className="font-semibold text-foreground">
                    {selectedSale.user_name || 'Staff'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Payment Mode:</span>
                  <span className="font-semibold text-foreground uppercase">
                    {selectedSale.payment_method}
                  </span>
                </div>
                {selectedSale.payment_reference && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block">Reference ID:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {selectedSale.payment_reference}
                    </span>
                  </div>
                )}
                {selectedSale.notes && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block">Notes:</span>
                    <span className="text-foreground">{selectedSale.notes}</span>
                  </div>
                )}
              </div>

              {/* Purchased Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Purchased Items
                </h4>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {selectedSale.items?.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 flex justify-between items-center text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-md bg-muted/60 border border-border flex items-center justify-center font-bold text-xs text-muted-foreground shrink-0 uppercase">
                          {item.product_name_snapshot.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">
                            {item.product_name_snapshot}
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            {item.quantity} × {formatPeso(item.unit_price)}
                          </div>
                        </div>
                      </div>
                      <div className={`font-mono font-bold ${selectedSale.status === 'voided' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {formatPeso(item.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation breakdown */}
              <div className="space-y-2 p-3.5 rounded-xl bg-muted/30 border border-border text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <CurrencyText amount={selectedSale.subtotal} className="font-medium" />
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount Applied:</span>
                    <span className="text-emerald-600 font-medium">
                      -{formatPeso(selectedSale.discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border text-foreground">
                  <span>Grand Total:</span>
                  <CurrencyText
                    amount={selectedSale.total}
                    className={`text-base font-black ${selectedSale.status === 'voided' ? 'line-through text-muted-foreground' : 'text-emerald-700 dark:text-emerald-400'}`}
                  />
                </div>
                <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50">
                  <span>Amount Paid:</span>
                  <CurrencyText amount={selectedSale.amount_paid} />
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Change Given:</span>
                  <CurrencyText amount={selectedSale.change} className="font-semibold text-foreground" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Button
                  variant="emerald"
                  className="w-full gap-2 font-semibold"
                  onClick={handleReprint}
                >
                  <Printer className="h-4 w-4" />
                  Reprint Official Receipt
                </Button>

                {selectedSale.status !== 'voided' && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30"
                    onClick={() => handleOpenVoidModal(selectedSale)}
                  >
                    <Ban className="h-4 w-4" />
                    Void This Transaction
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* VOID CONFIRMATION MODAL */}
      <Dialog open={!!voidModalSale} onOpenChange={(open) => !open && setVoidModalSale(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Ban className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-rose-600 dark:text-rose-400">
                  Void Sale Transaction
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Receipt <strong className="text-foreground">#{voidModalSale?.receipt_number}</strong> ({voidModalSale ? formatPeso(voidModalSale.total) : ''})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {voidModalSale && (
            <div className="space-y-4 py-2 text-xs">
              {/* Reason Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground block">
                  Select Reason for Voiding:
                </label>
                <Select value={voidReason} onValueChange={setVoidReason}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOID_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Reason Input */}
              {voidReason === 'Other' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">
                    Specify Reason:
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter reason for voiding..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Auto-Restock Checkbox */}
              <div className="p-3 bg-muted/50 rounded-lg border border-border flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="restock-checkbox"
                  checked={restockItems}
                  onChange={(e) => setRestockItems(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="restock-checkbox" className="text-xs text-foreground cursor-pointer">
                  <span className="font-bold block">Return items to inventory stock</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Automatically replenishes stock for the {voidModalSale.items?.length || 0} product(s) in this receipt.
                  </span>
                </label>
              </div>

              {/* Optional Notes */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground block">
                  Audit Notes (Optional):
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Approved by Store Owner"
                  value={voidNotes}
                  onChange={(e) => setVoidNotes(e.target.value)}
                />
              </div>

              {/* Warning box */}
              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-rose-700 dark:text-rose-300 space-y-1 text-[11px]">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> What happens when voided:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                  <li>This sale will be removed from your active daily revenue and drawer totals.</li>
                  <li>A permanent record will be saved in your database for audit logs and tax compliance.</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVoidModalSale(null)}
              disabled={isVoiding}
              className="w-full"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmVoid}
              disabled={isVoiding}
              className="w-full font-bold gap-1.5"
            >
              <Ban className="h-4 w-4" />
              {isVoiding ? 'Voiding...' : 'Confirm & Void'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprint Modal */}
      <ReceiptModal
        isOpen={isReprintModalOpen}
        onClose={() => setIsReprintModalOpen(false)}
        sale={selectedSale}
        business={business}
      />
    </div>
  );
}
