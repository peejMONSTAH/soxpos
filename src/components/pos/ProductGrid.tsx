'use client';

import React, { useState, useMemo } from 'react';
import { Product, Category } from '@/types/database.types';
import { ProductCard } from './ProductCard';
import { DrinkSelectionModal } from './DrinkSelectionModal';
import { useCartStore } from '@/stores/cartStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Search,
  X,
  Layers,
  AlertTriangle,
  CheckCircle2,
  UtensilsCrossed,
  Store,
} from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  isLoading?: boolean;
}

type OrderSection = 'all' | 'store' | 'kitchen';

export function ProductGrid({ products, categories, isLoading }: ProductGridProps) {
  const { addItem } = useCartStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [orderSection, setOrderSection] = useState<OrderSection>('store'); // Default to Store or Kitchen
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock'>('all');
  const [comboMeal, setComboMeal] = useState<Product | null>(null);

  // Available beverages for combo selection (Only drinks less than 25 pesos)
  const availableBeverages = useMemo(() => {
    return products.filter((p) => {
      if (p.status !== 'active') return false;
      if (p.is_kitchen) return false;
      // Only drinks strictly less than 25 pesos
      if (p.selling_price >= 25) return false;

      const catName = p.category_name?.toLowerCase() || '';
      const name = p.name.toLowerCase();
      return (
        p.category_id === 'c0000000-0000-0000-0000-000000000003' ||
        catName.includes('beverage') ||
        catName.includes('drink') ||
        name.includes('coca-cola') ||
        name.includes('coke') ||
        name.includes('sprite') ||
        name.includes('royal') ||
        name.includes('juice') ||
        name.includes('water') ||
        name.includes('mogu') ||
        name.includes('soda') ||
        name.includes('tea') ||
        name.includes('coffee')
      );
    });
  }, [products]);

  // Filter categories based on section
  const visibleCategories = useMemo(() => {
    if (orderSection === 'kitchen') {
      return categories.filter((c) => c.is_kitchen || c.id === 'cat-kitchen');
    }
    if (orderSection === 'store') {
      return categories.filter((c) => !c.is_kitchen && c.id !== 'cat-kitchen');
    }
    return categories;
  }, [categories, orderSection]);

  // Filter products based on section, search, category, and stock filter
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Must be active
      if (product.status !== 'active') return false;

      // Section Filter: Kitchen vs Store
      const isProductKitchen = product.is_kitchen || product.category_id === 'cat-kitchen';
      if (orderSection === 'kitchen' && !isProductKitchen) return false;
      if (orderSection === 'store' && isProductKitchen) return false;

      // Category filter
      if (selectedCategoryId !== 'all' && product.category_id !== selectedCategoryId) {
        return false;
      }

      // Stock status filter
      if (stockFilter === 'in_stock' && product.stock_quantity <= 0) {
        return false;
      }
      if (stockFilter === 'low_stock' && (product.stock_quantity > product.minimum_stock || product.stock_quantity <= 0)) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesCat = product.category_name?.toLowerCase().includes(query);
        const matchesDesc = product.description?.toLowerCase().includes(query);
        return matchesName || matchesCat || matchesDesc;
      }

      return true;
    });
  }, [products, orderSection, searchQuery, selectedCategoryId, stockFilter]);

  // Section product counts
  const storeCount = products.filter((p) => p.status === 'active' && !p.is_kitchen && p.category_id !== 'cat-kitchen').length;
  const kitchenCount = products.filter((p) => p.status === 'active' && (p.is_kitchen || p.category_id === 'cat-kitchen')).length;

  return (
    <div className="flex flex-col h-full space-y-2.5 sm:space-y-3">
      {/* 1. Top Section Mode Switcher: Store vs Kitchen */}
      <div className="flex items-center justify-between gap-2 p-1 bg-muted/70 rounded-xl border border-border">
        <button
          type="button"
          onClick={() => {
            setOrderSection('store');
            setSelectedCategoryId('all');
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${orderSection === 'store'
            ? 'bg-background text-emerald-700 dark:text-emerald-400 shadow-sm border border-border'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <Store className="h-4 w-4 text-emerald-600" />
          <span>Store Products</span>
          <span className="text-[11px] font-normal px-1.5 py-0.2 rounded-full bg-muted">
            {storeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOrderSection('kitchen');
            setSelectedCategoryId('all');
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${orderSection === 'kitchen'
            ? 'bg-background text-amber-600 dark:text-amber-400 shadow-sm border border-border'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <UtensilsCrossed className="h-4 w-4 text-amber-500" />
          <span>🍳 Kitchen Orders & Meals</span>
          <span className="text-[11px] font-normal px-1.5 py-0.2 rounded-full bg-muted">
            {kitchenCount}
          </span>
        </button>
      </div>

      {/* 2. Search & Stock quick toggles */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Instant Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={
              orderSection === 'kitchen'
                ? 'Search cooked meals (e.g. Tapsilog, Sisig)...'
                : 'Search store items by name or category...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-10 bg-card rounded-lg text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Stock Filter Pills */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border shrink-0 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStockFilter('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${stockFilter === 'all'
              ? 'bg-background text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('in_stock')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${stockFilter === 'in_stock'
              ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            Available
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('low_stock')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${stockFilter === 'low_stock'
              ? 'bg-background text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <AlertTriangle className="h-3 w-3" />
            Low Stock
          </button>
        </div>
      </div>

      {/* 3. Horizontal Category Carousel (if multiple categories visible) */}
      {visibleCategories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${selectedCategoryId === 'all'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
              }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>All Items</span>
          </button>

          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${selectedCategoryId === cat.id
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                }`}
            >
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* 4. Products / Meals Grid */}
      <div className="flex-1 overflow-y-auto pr-1 overscroll-contain">
        {filteredProducts.length === 0 ? (
          <EmptyState
            title={orderSection === 'kitchen' ? 'No kitchen meals found' : 'No store products found'}
            description={
              searchQuery
                ? `No items matched "${searchQuery}".`
                : orderSection === 'kitchen'
                  ? 'Add cooked meals under the Kitchen Meals category in Products to take food orders.'
                  : 'No products available in this category.'
            }
            actionLabel={searchQuery ? 'Clear Search' : undefined}
            onAction={searchQuery ? () => setSearchQuery('') : undefined}
            className="my-8"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelectCombo={(p) => setComboMeal(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Beverage / Drink Combo Selection Modal */}
      <DrinkSelectionModal
        isOpen={Boolean(comboMeal)}
        onClose={() => setComboMeal(null)}
        mealProduct={comboMeal}
        beverages={availableBeverages}
        onSelectDrink={(meal, drink) => addItem(meal, 1, drink)}
      />
    </div>
  );
}
