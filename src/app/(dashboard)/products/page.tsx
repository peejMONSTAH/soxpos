'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { useAuthStore } from '@/stores/authStore';
import { Product, Category, ProductUnit, ProductStatus } from '@/types/database.types';
import { formatPeso, formatDate } from '@/lib/formatters';
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
  Package,
  Plus,
  Search,
  Edit2,
  Archive,
  RotateCcw,
  Tag,
  AlertTriangle,
  XCircle,
  Filter,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { role, user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [minimumStock, setMinimumStock] = useState('5');
  const [unit, setUnit] = useState<ProductUnit>('piece');
  const [imageUrl, setImageUrl] = useState('');
  const [isKitchen, setIsKitchen] = useState(false);
  const [hasDrinkOption, setHasDrinkOption] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Fetch Products & Categories
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => dbService.getProducts(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dbService.getCategories(),
  });

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.status !== statusFilter) return false;
      if (selectedCatFilter !== 'all' && p.category_id !== selectedCatFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const catName = p.category_id ? (categoryMap.get(p.category_id) || p.category_name) : p.category_name;
        return (
          p.name.toLowerCase().includes(q) ||
          catName?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, statusFilter, selectedCatFilter, searchQuery, categoryMap]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setCategoryId(categories[0]?.id || '');
    setSellingPrice('');
    setCostPrice('');
    setStockQuantity('0');
    setMinimumStock('5');
    setUnit('piece');
    setImageUrl('');
    setIsKitchen(false);
    setHasDrinkOption(false);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || '');
    setCategoryId(product.category_id || '');
    setSellingPrice(product.selling_price.toString());
    setCostPrice(product.cost_price.toString());
    setStockQuantity(product.stock_quantity.toString());
    setMinimumStock(product.minimum_stock.toString());
    setUnit(product.unit);
    setImageUrl(product.image_url || '');
    setIsKitchen(Boolean(product.is_kitchen || product.category_id === 'c0000000-0000-0000-0000-000000000002'));
    setHasDrinkOption(Boolean(product.has_drink_option));
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sell = parseFloat(sellingPrice);
    const cost = parseFloat(costPrice) || 0;
    const stock = parseInt(stockQuantity, 10) || 0;
    const min = parseInt(minimumStock, 10) || 0;

    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (isNaN(sell) || sell < 0) {
      toast.error('Valid selling price is required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        const prevStock = editingProduct.stock_quantity;
        await dbService.updateProduct(editingProduct.id, {
          name: name.trim(),
          description: description.trim() || null,
          category_id: categoryId || null,
          selling_price: sell,
          cost_price: cost,
          stock_quantity: stock,
          minimum_stock: min,
          unit,
          image_url: imageUrl.trim() || null,
          is_kitchen: isKitchen,
          has_drink_option: isKitchen && hasDrinkOption,
        });

        if (stock !== prevStock) {
          const diff = stock - prevStock;
          await dbService.recordStockMovement({
            product_id: editingProduct.id,
            type: diff > 0 ? 'STOCK_IN' : 'CORRECTION',
            quantity: diff,
            reference_id: 'PRODUCT_EDIT',
            reason: 'Stock updated via product edit',
          });
        }

        toast.success(`Updated "${name}"`);
      } else {
        await dbService.createProduct({
          business_id: user?.business_id || 'b0000000-0000-0000-0000-000000000001',
          name: name.trim(),
          description: description.trim() || null,
          category_id: categoryId || null,
          selling_price: sell,
          cost_price: cost,
          stock_quantity: stock,
          minimum_stock: min,
          unit,
          image_url: imageUrl.trim() || null,
          is_kitchen: isKitchen,
          has_drink_option: isKitchen && hasDrinkOption,
          status: 'active',
        });
        toast.success(`Created product "${name}"`);
      }

      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['movements'] });
      setIsProductModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to save product', { description: err?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async (product: Product) => {
    try {
      if (product.status === 'active') {
        await dbService.archiveProduct(product.id);
        toast.info(`Archived "${product.name}"`);
      } else {
        await dbService.restoreProduct(product.id);
        toast.success(`Restored "${product.name}"`);
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err: any) {
      toast.error('Action failed', { description: err?.message });
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await dbService.deleteProduct(productToDelete.id);
      toast.success(`Product "${productToDelete.name}" permanently deleted.`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setProductToDelete(null);
    } catch (err: any) {
      toast.error('Failed to delete product', { description: err?.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const created = await dbService.createCategory({
        business_id: user?.business_id || 'b0000000-0000-0000-0000-000000000001',
        name: newCatName.trim(),
        description: newCatDesc.trim() || null,
        is_active: true,
      });
      toast.success(`Created category "${newCatName}"`);
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.refetchQueries({ queryKey: ['categories'] });
      setCategoryId(created.id);
      setNewCatName('');
      setNewCatDesc('');
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to create category', { description: err?.message });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Product Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Manage inventory items, selling prices, and product categories.
          </p>
        </div>

        {role === 'owner' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={isSyncing}
              onClick={async () => {
                setIsSyncing(true);
                try {
                  await dbService.syncLocalToSupabase();
                  await queryClient.invalidateQueries({ queryKey: ['products'] });
                  await queryClient.refetchQueries({ queryKey: ['products'] });
                  toast.success('Local catalog synced to Supabase Cloud!');
                } catch (err: any) {
                  toast.error('Sync failed', { description: err?.message });
                } finally {
                  setIsSyncing(false);
                }
              }}
              className="gap-1.5"
              title="Force sync local offline products to Supabase"
            >
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsCategoryModalOpen(true)}
              className="gap-1.5"
            >
              <Tag className="h-4 w-4" />
              Categories
            </Button>
            <Button
              variant="emerald"
              onClick={openCreateModal}
              className="gap-1.5 font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedCatFilter} onValueChange={setSelectedCatFilter}>
            <SelectTrigger className="w-48 bg-card">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border text-xs self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              statusFilter === 'active'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active Products
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              statusFilter === 'archived'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Products Table Card */}
      <Card>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <EmptyState
              title="No products found"
              description="Create a product or try adjusting your search or category filters."
              actionLabel={role === 'owner' ? 'Add First Product' : undefined}
              onAction={role === 'owner' ? openCreateModal : undefined}
              className="m-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Photo</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {role === 'owner' && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const margin =
                    product.selling_price > 0
                      ? ((product.selling_price - product.cost_price) / product.selling_price) * 100
                      : 0;

                  const isOut = product.stock_quantity <= 0;
                  const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock;

                  return (
                    <TableRow key={product.id}>
                      <TableCell className="p-2">
                        <div className="h-10 w-10 rounded-lg bg-muted/60 overflow-hidden border border-border flex items-center justify-center">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground uppercase">
                              {product.name.charAt(0)}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{product.name}</span>
                          {(product.is_kitchen || product.category_id === 'c0000000-0000-0000-0000-000000000002') && (
                            <span className="text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                              🍳 Kitchen
                            </span>
                          )}
                          {product.has_drink_option && (
                            <span className="text-[10px] font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              🥤 +Drink
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {product.category_id ? (categoryMap.get(product.category_id) || product.category_name || '—') : (product.is_kitchen ? 'Kitchen Meals & Cooked Food' : 'General Store Items')}
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formatPeso(product.selling_price)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatPeso(product.cost_price)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {margin.toFixed(0)}%
                      </TableCell>

                      <TableCell className="text-center">
                        {isOut ? (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            <XCircle className="h-2.5 w-2.5" />
                            Out of stock
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {product.stock_quantity} left
                          </Badge>
                        ) : (
                          <span className="font-mono font-semibold text-xs text-foreground">
                            {product.stock_quantity}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant={product.status === 'active' ? 'success' : 'secondary'}>
                          {product.status}
                        </Badge>
                      </TableCell>

                      {role === 'owner' && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => openEditModal(product)}
                              title="Edit product"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => handleArchiveToggle(product)}
                              title={product.status === 'active' ? 'Archive' : 'Restore'}
                              className={product.status === 'active' ? 'hover:text-destructive' : 'hover:text-emerald-600'}
                            >
                              {product.status === 'active' ? (
                                <Archive className="h-3.5 w-3.5" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => setProductToDelete(product)}
                              title="Delete product permanently"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Product Modal */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleProductSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Product Name *
              </label>
              <Input
                type="text"
                placeholder="e.g. Coca-Cola 1.5L PET"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Category
              </label>
              <Select
                value={categoryId}
                onValueChange={(val) => {
                  setCategoryId(val);
                  const selectedCat = categories.find((c) => c.id === val);
                  const isKitchenCat = Boolean(selectedCat?.is_kitchen || val === 'c0000000-0000-0000-0000-000000000002');
                  setIsKitchen(isKitchenCat);
                  if (!isKitchenCat) {
                    setHasDrinkOption(false);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Kitchen Cooked Meal Special Category Toggle */}
            <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  🍳 Special Kitchen Cooked Meal
                </span>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Separates item into POS Kitchen tab & tracks food orders in reports
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isKitchen}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsKitchen(checked);
                    if (checked) {
                      const kitchenCat = categories.find((c) => c.is_kitchen || c.id === 'c0000000-0000-0000-0000-000000000002');
                      setCategoryId(kitchenCat?.id || 'c0000000-0000-0000-0000-000000000002');
                    } else {
                      setHasDrinkOption(false);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {/* With Drinks Option Slider Toggle (Always Visible) */}
            <div className="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-cyan-900 dark:text-cyan-200 flex items-center gap-1.5">
                  🥤 With Drinks / Beverage Option
                </span>
                <p className="text-[11px] text-cyan-700 dark:text-cyan-400">
                  Prompts cashier to pick an eligible drink in POS & auto-deducts drink stock
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDrinkOption}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasDrinkOption(checked);
                    if (checked) {
                      setIsKitchen(true);
                      const kitchenCat = categories.find((c) => c.is_kitchen || c.id === 'c0000000-0000-0000-0000-000000000002');
                      setCategoryId(kitchenCat?.id || 'c0000000-0000-0000-0000-000000000002');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Selling Price (₱) *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="pl-7 font-semibold"
                    required
                  />
                  <span className="absolute left-2.5 top-2.5 text-xs font-bold text-muted-foreground">
                    ₱
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Cost / Purchase Price (₱)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="pl-7 font-semibold"
                  />
                  <span className="absolute left-2.5 top-2.5 text-xs font-bold text-muted-foreground">
                    ₱
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!editingProduct && (
                <div>
                  <label className="text-xs font-bold text-foreground mb-1 block">
                    Initial Stock Quantity
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                  />
                </div>
              )}

              <div className={editingProduct ? 'col-span-2' : ''}>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Low-Stock Threshold Alert
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="5"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                />
              </div>
            </div>

            {/* Product Image / Photo Upload */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Product Photo / Picture
              </label>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className="h-16 w-16 rounded-lg bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setImageUrl(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        Upload Image File
                      </span>
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-xs text-rose-600 hover:underline font-medium px-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <Input
                    type="text"
                    placeholder="Or paste Image URL (https://...)"
                    value={imageUrl.startsWith('data:') ? 'Image uploaded (base64)' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Description / Notes (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. 1.5L bottle original taste"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProductModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Saving...'
                  : editingProduct
                  ? 'Save Changes'
                  : 'Create Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Management Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <span>Manage Categories</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCategory} className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Category Name *
              </label>
              <Input
                type="text"
                placeholder="e.g. Frozen Foods"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Description (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Hotdogs, nuggets, siomai"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
              />
            </div>

            <Button type="submit" variant="emerald" size="sm" className="w-full">
              Add Category
            </Button>
          </form>

          {/* Current Category List */}
          <div className="pt-3 border-t border-border space-y-1.5 max-h-48 overflow-y-auto">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Existing Categories:
            </label>
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs"
              >
                <div>
                  <span className="font-semibold text-foreground">{c.name}</span>
                  {c.description && (
                    <p className="text-[11px] text-muted-foreground">{c.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation Modal */}
      <Dialog open={Boolean(productToDelete)} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Delete Product Permanently</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to delete <span className="font-bold text-foreground">&ldquo;{productToDelete?.name}&rdquo;</span>?
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground space-y-2">
            <p>
              This will permanently remove this item from your product catalog, local cache, and cloud database.
            </p>
            <p className="text-[11px] bg-muted/60 p-2.5 rounded-lg border border-border">
              💡 <span className="font-semibold text-foreground">Tip:</span> If you only want to temporarily hide this product from the POS, use <span className="font-semibold text-foreground">Archive</span> instead.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setProductToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteProduct}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
