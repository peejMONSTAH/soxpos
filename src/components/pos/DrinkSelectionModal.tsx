'use client';

import React from 'react';
import { Product } from '@/types/database.types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CupSoda } from 'lucide-react';
import { formatPeso } from '@/lib/formatters';

interface DrinkSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealProduct: Product | null;
  beverages: Product[];
  onSelectDrink: (meal: Product, drink: Product) => void;
}

export function DrinkSelectionModal({
  isOpen,
  onClose,
  mealProduct,
  beverages,
  onSelectDrink,
}: DrinkSelectionModalProps) {
  if (!mealProduct) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <CupSoda className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Select Included Drink for</span>
                <span className="text-primary truncate max-w-[220px]">{mealProduct.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Choose from available drinks (<span className="font-semibold text-foreground">&lt; ₱25.00</span>). Included at no extra charge.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {beverages.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-muted/40 border border-dashed border-border text-xs text-muted-foreground space-y-2">
              <div className="text-sm font-semibold text-foreground">No eligible drinks under ₱25 found</div>
              <p>Add beverages priced less than ₱25.00 (e.g. Coke Mismo, Minute Maid, Bottled Water, Royal can) in Product Catalog.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {beverages.map((drink) => {
                const isOutOfStock = drink.stock_quantity <= 0;
                const isLow = drink.stock_quantity > 0 && drink.stock_quantity <= drink.minimum_stock;

                return (
                  <button
                    key={drink.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => {
                      onSelectDrink(mealProduct, drink);
                      onClose();
                    }}
                    className={`relative flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isOutOfStock
                        ? 'opacity-40 bg-muted/30 border-dashed border-border cursor-not-allowed'
                        : 'bg-card border-border hover:border-emerald-500/60 hover:bg-emerald-500/5 hover:shadow-xs active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="relative h-10 w-10 shrink-0 rounded-lg bg-muted/80 overflow-hidden border border-border/50 flex items-center justify-center">
                        {drink.image_url ? (
                          <img
                            src={drink.image_url}
                            alt={drink.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <CupSoda className="h-5 w-5 text-cyan-600/70" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">{drink.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isOutOfStock ? (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                              Out of Stock
                            </Badge>
                          ) : isLow ? (
                            <Badge variant="warning" className="text-[9px] px-1 py-0 h-4">
                              {drink.stock_quantity} left
                            </Badge>
                          ) : (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {drink.stock_quantity} in stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        INCLUDED
                      </div>
                      <span className="text-[9px] text-muted-foreground">Stock -1</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Meal Total: <span className="font-bold text-foreground">{formatPeso(mealProduct.selling_price)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
