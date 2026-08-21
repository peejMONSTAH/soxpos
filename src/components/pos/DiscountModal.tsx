'use client';

import React, { useState } from 'react';
import { useCartStore } from '@/stores/cartStore';
import { DiscountType } from '@/types/pos.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Percent, Tag, X } from 'lucide-react';
import { formatPeso } from '@/lib/formatters';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DiscountModal({ isOpen, onClose }: DiscountModalProps) {
  const { discount, setDiscount, getSubtotal } = useCartStore();
  const subtotal = getSubtotal();

  const [type, setType] = useState<DiscountType>(discount?.type || 'percentage');
  const [value, setValue] = useState<string>(discount ? discount.value.toString() : '');
  const [reason, setReason] = useState<string>(discount?.reason || '');

  const quickPercentages = [
    { label: '5%', value: 5 },
    { label: '10%', value: 10 },
    { label: '15%', value: 15 },
    { label: '20% (Senior / PWD)', value: 20, reason: 'Senior Citizen / PWD Discount' },
  ];

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      setDiscount(null);
      onClose();
      return;
    }

    const calculatedAmount =
      type === 'percentage' ? (subtotal * numVal) / 100 : Math.min(numVal, subtotal);

    setDiscount({
      type,
      value: numVal,
      amount: calculatedAmount,
      reason: reason.trim() || undefined,
    });
    onClose();
  };

  const handleRemove = () => {
    setDiscount(null);
    setValue('');
    setReason('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <span>Apply Transaction Discount</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleApply} className="space-y-4 py-2">
          {/* Subtotal preview */}
          <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">Order Subtotal:</span>
            <span className="font-bold text-foreground">{formatPeso(subtotal)}</span>
          </div>

          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === 'percentage' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setType('percentage')}
            >
              <Percent className="h-4 w-4" />
              Percentage (%)
            </Button>
            <Button
              type="button"
              variant={type === 'fixed' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setType('fixed')}
            >
              <span>₱</span>
              Fixed Amount (₱)
            </Button>
          </div>

          {/* Quick Buttons for percentage */}
          {type === 'percentage' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Quick Preset:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {quickPercentages.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setValue(item.value.toString());
                      if (item.reason) setReason(item.reason);
                    }}
                    className={`text-xs py-2 px-3 rounded-lg border font-medium transition-all text-left ${
                      value === item.value.toString()
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-card hover:bg-muted text-foreground'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Value Input */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              {type === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (₱)'}
            </label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                min="0"
                max={type === 'percentage' ? '100' : subtotal.toString()}
                placeholder={type === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                required
                className="text-base font-semibold pr-8"
              />
              <span className="absolute right-3 top-2.5 text-muted-foreground text-sm font-bold">
                {type === 'percentage' ? '%' : '₱'}
              </span>
            </div>
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Reason / Customer Note (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Senior Citizen ID / Loyalty / Promo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            {discount && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemove}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald">
              Apply Discount
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
