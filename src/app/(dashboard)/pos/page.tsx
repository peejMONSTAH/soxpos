'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService, KEYS, getStorage } from '@/lib/db';
import { Product, Category, Business } from '@/types/database.types';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { useCartStore } from '@/stores/cartStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CurrencyText } from '@/components/ui/currency-text';
import { ShoppingCart, ArrowRight } from 'lucide-react';

export default function POSPage() {
  const queryClient = useQueryClient();
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const itemCount = useCartStore((state) => state.getItemCount());
  const total = useCartStore((state) => state.getTotal());

  // Fetch Products with Instant Cache-First Hydration (0ms Load Time)
  const { data: products = [], isFetching: isFetchingProducts } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => dbService.getProducts(),
    initialData: () => getStorage<Product[]>(KEYS.PRODUCTS, []),
    initialDataUpdatedAt: () => 0,
  });

  // Fetch Categories with Instant Cache-First Hydration
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => dbService.getCategories(),
    initialData: () => getStorage<Category[]>(KEYS.CATEGORIES, []),
    initialDataUpdatedAt: () => 0,
  });

  // Fetch Business Profile for receipt
  const { data: business } = useQuery<Business | null>({
    queryKey: ['business'],
    queryFn: () => dbService.getBusiness(),
    initialData: () => getStorage<Business | null>(KEYS.BUSINESS, null),
    initialDataUpdatedAt: () => 0,
  });

  const handleSaleSuccess = () => {
    // Invalidate product queries to update stock quantities instantly
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
    queryClient.invalidateQueries({ queryKey: ['movements'] });
    setIsMobileCartOpen(false);
  };

  return (
    <div className="h-full flex flex-col md:flex-row p-2.5 sm:p-4 gap-3 sm:gap-4 overflow-hidden">
      {/* Left side: Product catalog & Search */}
      <div className="flex-1 h-full min-w-0 overflow-hidden flex flex-col">
        <ProductGrid
          products={products}
          categories={categories}
          isLoading={products.length === 0 && isFetchingProducts}
        />
      </div>

      {/* Right side: Desktop & Tablet Cart Panel */}
      <div className="hidden md:flex w-80 lg:w-96 shrink-0 h-full flex-col">
        <CartPanel
          business={business}
          onSaleSuccess={handleSaleSuccess}
        />
      </div>

      {/* Mobile Sticky Bottom Cart Trigger Bar */}
      {itemCount > 0 && (
        <div className="md:hidden fixed bottom-16 left-3 right-3 z-30 animate-in slide-in-from-bottom-4 duration-200">
          <Button
            variant="emerald"
            size="lg"
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full h-14 rounded-xl shadow-xl flex items-center justify-between px-4 font-bold text-base border border-emerald-400/40"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-800 text-xs font-bold text-white">
                {itemCount}
              </div>
              <span>View Cart</span>
            </div>
            <div className="flex items-center gap-2">
              <CurrencyText amount={total} className="text-lg font-black" />
              <ArrowRight className="h-4 w-4" />
            </div>
          </Button>
        </div>
      )}

      {/* Mobile Cart Bottom Sheet */}
      <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <SheetContent side="bottom" className="p-0 max-h-[85vh] h-[85vh]">
          <div className="h-full p-2">
            <CartPanel
              business={business}
              onSaleSuccess={handleSaleSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
