'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService, KEYS, getStorage } from '@/lib/db';
import { useAuthStore } from '@/stores/authStore';
import { Product, InventoryMovement, MovementType } from '@/types/database.types';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Boxes,
  PackagePlus,
  AlertTriangle,
  XCircle,
  TrendingDown,
  History,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  Layers,
  TrendingUp,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [movementType, setMovementType] = useState<MovementType>('STOCK_IN');
  const [quantityInput, setQuantityInput] = useState<string>('10');
  const [reasonInput, setReasonInput] = useState<string>('');
  const [referenceIdInput, setReferenceIdInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [ledgerSearch, setLedgerSearch] = useState('');

  // Fetch Products with Instant Cache-First Hydration
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => dbService.getProducts(),
    initialData: () => getStorage<Product[]>(KEYS.PRODUCTS, []),
    initialDataUpdatedAt: () => 0,
  });

  // Fetch Inventory Movements with Instant Cache-First Hydration
  const { data: movements = [] } = useQuery<InventoryMovement[]>({
    queryKey: ['movements'],
    queryFn: () => dbService.getInventoryMovements(),
    initialData: () => getStorage<InventoryMovement[]>(KEYS.MOVEMENTS, []),
    initialDataUpdatedAt: () => 0,
  });

  // Calculations for Inventory KPI Dashboard
  const metrics = useMemo(() => {
    const totalProducts = products.filter((p) => p.status === 'active').length;
    const totalUnits = products
      .filter((p) => p.status === 'active')
      .reduce((sum, p) => sum + p.stock_quantity, 0);

    const lowStockCount = products.filter(
      (p) => p.status === 'active' && p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock
    ).length;

    const outOfStockCount = products.filter(
      (p) => p.status === 'active' && p.stock_quantity <= 0
    ).length;

    const totalCostValuation = products
      .filter((p) => p.status === 'active')
      .reduce((sum, p) => sum + p.stock_quantity * p.cost_price, 0);

    const totalRetailValuation = products
      .filter((p) => p.status === 'active')
      .reduce((sum, p) => sum + p.stock_quantity * p.selling_price, 0);

    return {
      totalProducts,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      totalCostValuation,
      totalRetailValuation,
    };
  }, [products]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    if (!ledgerSearch.trim()) return movements;
    const q = ledgerSearch.toLowerCase().trim();
    return movements.filter(
      (m) =>
        m.product_name?.toLowerCase().includes(q) ||
        m.reason?.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.created_by_name?.toLowerCase().includes(q)
    );
  }, [movements, ledgerSearch]);

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error('Please select a product');
      return;
    }

    const qty = parseInt(quantityInput, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }

    // Determine sign: STOCK_IN, RETURN, CORRECTION (can be positive/negative), DAMAGE/SALE (negative)
    let finalQty = qty;
    if (movementType === 'DAMAGE' || movementType === 'SALE') {
      finalQty = -qty;
    } else if (movementType === 'ADJUSTMENT') {
      // User specifies reduction if damage or positive if found stock
      finalQty = -qty;
    }

    setIsSubmitting(true);
    try {
      const movement = await dbService.recordStockMovement({
        product_id: selectedProductId,
        type: movementType,
        quantity: finalQty,
        reference_id: referenceIdInput.trim() || undefined,
        reason: reasonInput.trim() || undefined,
        created_by: user?.id,
      });

      toast.success('Stock Updated Successfully', {
        description: `New stock level: ${movement.new_stock} units`,
      });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['movements'] });
      await queryClient.refetchQueries({ queryKey: ['products'] });
      await queryClient.refetchQueries({ queryKey: ['movements'] });
      setIsMovementModalOpen(false);
      setReasonInput('');
      setReferenceIdInput('');
      setQuantityInput('1');
    } catch (err: any) {
      toast.error('Failed to adjust stock', { description: err?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    try {
      await dbService.syncLocalToSupabase();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['movements'] });
      toast.success('Inventory synced with Supabase cloud successfully!');
    } catch (err: any) {
      toast.error('Sync failed', { description: err?.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory & Stock Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Track real-time stock levels, record stock-ins, damages, and audit stock movement logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncCloud}
            disabled={isSyncing}
            className="gap-2 font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Cloud'}
          </Button>

          <Button
            variant="emerald"
            onClick={() => {
              if (products.length > 0) {
                setSelectedProductId(products[0].id);
              }
              setIsMovementModalOpen(true);
            }}
            className="gap-2 font-semibold shadow-xs"
          >
            <PackagePlus className="h-4 w-4" />
            Record Stock Movement
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total In Stock */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Units in Stock</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics.totalUnits.toLocaleString()}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Across {metrics.totalProducts} active products
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className={metrics.lowStockCount > 0 ? 'border-amber-500/30 bg-amber-500/5' : ''}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Low Stock Alert</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {metrics.lowStockCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                At or below minimum threshold
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Out of Stock */}
        <Card className={metrics.outOfStockCount > 0 ? 'border-rose-500/30 bg-rose-500/5' : ''}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Out of Stock</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {metrics.outOfStockCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Needs immediate supplier reorder
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Valuation */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Inventory Cost Value</p>
              <div className="text-xl font-bold text-foreground mt-1">
                <CurrencyText amount={metrics.totalCostValuation} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Retail: <CurrencyText amount={metrics.totalRetailValuation} />
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Movement Ledger Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Stock Movement History & Audit Trail
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Complete audit ledger of sales deductions, supplier deliveries, returns, and manual adjustments.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search product or reason..."
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredMovements.length === 0 ? (
            <EmptyState
              title="No movement records found"
              description="Stock movements recorded from sales and restocks will appear in this ledger."
              className="m-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Movement Type</TableHead>
                  <TableHead className="text-right">Qty Change</TableHead>
                  <TableHead className="text-right">Prev → New Stock</TableHead>
                  <TableHead>Reason / Reference</TableHead>
                  <TableHead>Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((m) => {
                  const isPositive = m.quantity > 0;
                  const prod = products.find((p) => p.id === m.product_id);
                  const displayName = m.product_name && m.product_name !== 'Product' && m.product_name !== 'Item'
                    ? m.product_name
                    : prod?.name || 'Product Item';

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(m.created_at)}
                      </TableCell>

                      <TableCell className="font-semibold text-foreground">
                        {displayName}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            m.type === 'STOCK_IN'
                              ? 'success'
                              : m.type === 'SALE'
                              ? 'secondary'
                              : m.type === 'DAMAGE'
                              ? 'destructive'
                              : 'warning'
                          }
                          className="text-[10px]"
                        >
                          {m.type}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold text-xs">
                        <span
                          className={
                            isPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </span>
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {m.previous_stock} → <span className="font-bold text-foreground">{m.new_stock}</span>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {m.reason || m.reference_id || '—'}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {m.created_by_name || 'System'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Stock Movement Modal */}
      <Dialog open={isMovementModalOpen} onOpenChange={setIsMovementModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-emerald-600" />
              <span>Record Inventory Movement</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRecordMovement} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Select Product *
              </label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {products
                    .filter((p) => p.status === 'active')
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (Current Stock: {p.stock_quantity} {p.unit}s)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Movement Type *
              </label>
              <Select
                value={movementType}
                onValueChange={(v) => setMovementType(v as MovementType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STOCK_IN">STOCK_IN (New Delivery / Restock)</SelectItem>
                  <SelectItem value="ADJUSTMENT">ADJUSTMENT (Stock Audit Correction)</SelectItem>
                  <SelectItem value="DAMAGE">DAMAGE (Expired / Broken / Spilled)</SelectItem>
                  <SelectItem value="RETURN">RETURN (Customer Return to Inventory)</SelectItem>
                  <SelectItem value="CORRECTION">CORRECTION (Count Correction)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Quantity Units *
              </label>
              <Input
                type="number"
                min="1"
                placeholder="10"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Reason / Note *
              </label>
              <Input
                type="text"
                placeholder="e.g. Delivery from San Miguel distributor / PO-2026-082"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Reference / PO Number (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. PO-89213"
                value={referenceIdInput}
                onChange={(e) => setReferenceIdInput(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMovementModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={isSubmitting}>
                {isSubmitting ? 'Recording...' : 'Submit Movement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
