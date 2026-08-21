'use client';

import React, { useState } from 'react';
import { useCartStore } from '@/stores/cartStore';
import { useShiftStore } from '@/stores/shiftStore';
import { CartItemRow } from './CartItemRow';
import { DiscountModal } from './DiscountModal';
import { CheckoutModal } from './CheckoutModal';
import { ReceiptModal } from './ReceiptModal';
import { CurrencyText } from '@/components/ui/currency-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Sale, Business } from '@/types/database.types';
import {
  ShoppingCart,
  Trash2,
  Tag,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

interface CartPanelProps {
  business?: Business | null;
  onSaleSuccess?: () => void;
}

export function CartPanel({ business, onSaleSuccess }: CartPanelProps) {
  const {
    items,
    discount,
    getSubtotal,
    getDiscountAmount,
    getTotal,
    getItemCount,
    clearCart,
  } = useCartStore();

  const { activeShift } = useShiftStore();

  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
  const total = getTotal();
  const itemCount = getItemCount();

  const handleSaleCompleted = (sale: Sale) => {
    setCompletedSale(sale);
    setIsReceiptOpen(true);
    if (onSaleSuccess) onSaleSuccess();
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      {/* Cart Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm text-foreground">Current Cart</span>
          {itemCount > 0 && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-semibold text-muted-foreground">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Shift reminder pill */}
      {!activeShift && (
        <div className="px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <span className="flex items-center gap-1.5 font-medium">
            <Clock className="h-3.5 w-3.5" />
            No open shift session
          </span>
          <Link
            href="/shift"
            className="underline font-bold hover:text-amber-900 dark:hover:text-amber-200"
          >
            Start Shift
          </Link>
        </div>
      )}

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <ShoppingCart className="h-6 w-6 opacity-40" />
            </div>
            <p className="text-sm font-semibold text-foreground">Cart is empty</p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              Select products on the left or tap items to add them to this order.
            </p>
          </div>
        ) : (
          items.map((item) => <CartItemRow key={item.product.id} item={item} />)
        )}
      </div>

      {/* Cart Financial Summary & Checkout Footer */}
      {items.length > 0 && (
        <div className="p-3.5 border-t border-border bg-muted/20 space-y-3">
          {/* Subtotal & Discounts */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <CurrencyText amount={subtotal} className="font-semibold text-foreground" />
            </div>

            {/* Discount line */}
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setIsDiscountOpen(true)}
                className="flex items-center gap-1 text-primary hover:underline font-semibold"
              >
                <Tag className="h-3 w-3" />
                {discount ? (
                  <span>
                    Discount (
                    {discount.type === 'percentage' ? `${discount.value}%` : 'Fixed'}
                    ):
                  </span>
                ) : (
                  <span>+ Add Discount</span>
                )}
              </button>

              {discountAmount > 0 && (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  -<CurrencyText amount={discountAmount} />
                </span>
              )}
            </div>

            {/* Big Total */}
            <div className="flex justify-between items-baseline pt-2 border-t border-border/80">
              <span className="text-sm font-bold text-foreground">TOTAL:</span>
              <CurrencyText
                amount={total}
                className="text-2xl font-black text-emerald-700 dark:text-emerald-400"
              />
            </div>
          </div>

          {/* Big Action Button */}
          <Button
            variant="emerald"
            size="lg"
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full text-base font-bold gap-2 shadow-md hover:shadow-lg"
          >
            <span>Charge</span>
            <CurrencyText amount={total} signClass="text-emerald-200" />
            <ArrowRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      )}

      {/* Modals */}
      <DiscountModal
        isOpen={isDiscountOpen}
        onClose={() => setIsDiscountOpen(false)}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSaleCompleted={handleSaleCompleted}
      />

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setCompletedSale(null);
        }}
        sale={completedSale}
        business={business}
      />
    </div>
  );
}
