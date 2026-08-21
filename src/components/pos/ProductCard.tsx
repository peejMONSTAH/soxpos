'use client';

import React from 'react';
import { Product } from '@/types/database.types';
import { useCartStore } from '@/stores/cartStore';
import { CurrencyText } from '@/components/ui/currency-text';
import { Badge } from '@/components/ui/badge';
import { Plus, Check, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  onSelectCombo?: (product: Product) => void;
}

export function ProductCard({ product, onSelectCombo }: ProductCardProps) {
  const { addItem, items } = useCartStore();
  const cartItem = items.find((i) => i.product.id === product.id);
  const cartQty = cartItem?.quantity || 0;

  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock;
  const isMaxInCart = cartQty >= product.stock_quantity;

  const handleAdd = () => {
    if (isOutOfStock || isMaxInCart) return;
    if (product.has_drink_option && onSelectCombo) {
      onSelectCombo(product);
    } else {
      addItem(product);
    }
  };

  return (
    <button
      onClick={handleAdd}
      disabled={isOutOfStock || isMaxInCart}
      className={cn(
        'group relative flex flex-col justify-between text-left p-2 sm:p-3 rounded-xl border bg-card text-card-foreground shadow-xs transition-all touch-press select-none h-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/40',
        isOutOfStock
          ? 'opacity-50 bg-muted/40 border-dashed border-border cursor-not-allowed'
          : 'hover:border-primary/50 hover:shadow-md active:scale-[0.96] border-border active:bg-emerald-500/5',
        cartQty > 0 && 'ring-2 ring-emerald-500/80 border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20'
      )}
    >
      {/* Product Image Thumbnail */}
      <div className="relative w-full h-20 sm:h-28 rounded-lg bg-muted/60 overflow-hidden mb-1.5 sm:mb-2 border border-border/40 flex items-center justify-center">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 group-active:scale-95 transition-transform duration-200"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50">
            <span className="text-lg sm:text-2xl font-bold uppercase">{product.name.charAt(0)}</span>
          </div>
        )}

        {/* Combo Drinks Available Badge */}
        {product.has_drink_option && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 text-[9px] sm:text-[10px] font-black bg-cyan-600/90 text-white px-1.5 py-0.5 rounded shadow-sm backdrop-blur-xs">
            🥤 +Drink
          </span>
        )}

        {/* Floating Cart Qty Badge */}
        {cartQty > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-5.5 min-w-5.5 sm:h-6 sm:min-w-6 px-1.5 items-center justify-center rounded-full bg-emerald-600 text-[11px] sm:text-xs font-black text-white shadow-md animate-in zoom-in-75 duration-150">
            {cartQty}
          </span>
        )}

        {/* Category Pill Tag */}
        <span className="absolute bottom-1 left-1 sm:bottom-1.5 sm:left-1.5 text-[9px] sm:text-[10px] font-bold bg-black/70 text-white px-1.5 sm:px-2 py-0.5 rounded backdrop-blur-xs uppercase tracking-wider truncate max-w-[85%]">
          {product.category_name || 'Item'}
        </span>
      </div>

      {/* Center: Product Name */}
      <div className="flex-1 min-h-[36px] flex flex-col justify-center">
        <h4 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {product.name}
        </h4>
      </div>

      {/* Bottom row: Price & Stock Status */}
      <div className="flex items-end justify-between w-full pt-1 border-t border-border/50">
        <div>
          <CurrencyText
            amount={product.selling_price}
            className="text-base font-bold text-emerald-700 dark:text-emerald-400"
          />
        </div>

        <div>
          {isOutOfStock ? (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1 font-medium">
              <XCircle className="h-2.5 w-2.5" />
              Out
            </Badge>
          ) : isLowStock ? (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0 gap-1 font-medium">
              <AlertTriangle className="h-2.5 w-2.5" />
              {product.stock_quantity} left
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground font-medium">
              {product.stock_quantity} in stock
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
