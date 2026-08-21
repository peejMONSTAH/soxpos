'use client';

import React from 'react';
import { CartItem } from '@/types/pos.types';
import { useCartStore } from '@/stores/cartStore';
import { CurrencyText } from '@/components/ui/currency-text';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Trash2 } from 'lucide-react';

interface CartItemRowProps {
  item: CartItem;
}

export function CartItemRow({ item }: CartItemRowProps) {
  const { incrementQuantity, decrementQuantity, removeItem } = useCartStore();
  const isMax = item.quantity >= item.product.stock_quantity;

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors">
      {/* Product Image Thumbnail */}
      <div className="h-10 w-10 rounded-md bg-muted/60 overflow-hidden shrink-0 border border-border/60 flex items-center justify-center">
        {item.product.image_url ? (
          <img
            src={item.product.image_url}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-muted-foreground uppercase">
            {item.product.name.charAt(0)}
          </span>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <div className="text-xs sm:text-sm font-semibold text-foreground truncate">
          {item.product.name}
        </div>
        {item.selected_drink && (
          <div className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1 mt-0.5 truncate">
            <span>🥤</span>
            <span className="truncate">Combo: +{item.selected_drink.name}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
          <CurrencyText amount={item.product.selling_price} className="font-normal" />
          <span>×</span>
          <span>{item.quantity}</span>
        </div>
      </div>

      {/* Quantity Stepper */}
      <div className="flex items-center gap-1 bg-muted/60 rounded-md p-0.5 border border-border/80">
        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7 rounded-sm p-0 hover:bg-background"
          onClick={() => decrementQuantity(item.product.id, item.selected_drink?.id)}
          title="Decrease quantity"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-7 text-center text-xs font-bold text-foreground">
          {item.quantity}
        </span>
        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7 rounded-sm p-0 hover:bg-background disabled:opacity-30"
          onClick={() => incrementQuantity(item.product.id, item.selected_drink?.id)}
          disabled={isMax}
          title={isMax ? 'Maximum stock reached' : 'Increase quantity'}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Subtotal & Delete */}
      <div className="flex items-center gap-2 pl-1 text-right">
        <CurrencyText
          amount={item.subtotal}
          className="text-sm font-bold text-foreground min-w-16"
        />
        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7 rounded-sm p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => removeItem(item.product.id, item.selected_drink?.id)}
          title="Remove item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
