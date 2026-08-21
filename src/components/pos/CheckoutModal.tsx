'use client';

import React, { useState, useEffect } from 'react';
import { useCartStore } from '@/stores/cartStore';
import { useShiftStore } from '@/stores/shiftStore';
import { dbService } from '@/lib/db';
import { PaymentMethod, Sale } from '@/types/database.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CurrencyText } from '@/components/ui/currency-text';
import { formatPeso } from '@/lib/formatters';
import {
  Banknote,
  Smartphone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleCompleted: (sale: Sale) => void;
}

export function CheckoutModal({ isOpen, onClose, onSaleCompleted }: CheckoutModalProps) {
  const { items, discount, getSubtotal, getDiscountAmount, getTotal, clearCart } = useCartStore();
  const { activeShift } = useShiftStore();

  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
  const total = getTotal();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default amount paid to exact total when modal opens or total changes
  useEffect(() => {
    if (isOpen) {
      setAmountPaidInput(total.toString());
    }
  }, [isOpen, total]);

  const parsedAmountPaid = parseFloat(amountPaidInput) || 0;
  const change = Math.max(0, parsedAmountPaid - total);
  const isInsufficient = paymentMethod === 'cash' && parsedAmountPaid < total;

  // Cash quick presets
  const quickCashPresets = [
    { label: 'Exact', amount: total },
    { label: '₱100', amount: 100 },
    { label: '₱200', amount: 200 },
    { label: '₱500', amount: 500 },
    { label: '₱1,000', amount: 1000 },
    { label: '₱2,000', amount: 2000 },
  ].filter((p) => p.amount >= total || p.label === 'Exact');

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || isSubmitting) return;

    if (paymentMethod === 'cash' && parsedAmountPaid < total) {
      toast.error('Insufficient cash received', {
        description: `Total amount is ${formatPeso(total)}. Received only ${formatPeso(parsedAmountPaid)}.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const sale = await dbService.createSale({
        items: items.map((i) => ({
          product_id: i.product.id,
          product_name_snapshot: i.selected_drink
            ? `${i.product.name} (w/ ${i.selected_drink.name})`
            : i.product.name,
          cost_price_snapshot: i.product.cost_price,
          quantity: i.quantity,
          unit_price: i.product.selling_price,
          subtotal: i.subtotal,
          selected_drink_id: i.selected_drink?.id || null,
          selected_drink_name: i.selected_drink?.name || null,
        })),
        subtotal,
        discount: discountAmount,
        total,
        payment_method: paymentMethod,
        amount_paid: paymentMethod === 'cash' ? parsedAmountPaid : total,
        change: paymentMethod === 'cash' ? change : 0,
        payment_reference: paymentReference || undefined,
        shift_id: activeShift?.id || undefined,
        notes: customerNotes || discount?.reason || undefined,
      });

      // Visual confetti delight
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });

      toast.success(`Transaction Completed!`, {
        description: `Receipt #${sale.receipt_number} · Total: ${formatPeso(total)}`,
      });

      clearCart();
      onSaleCompleted(sale);
      onClose();
    } catch (err: any) {
      toast.error('Transaction Failed', {
        description: err?.message || 'Could not complete the transaction. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Payment & Checkout</span>
            <CurrencyText amount={total} className="text-xl font-black text-emerald-600 dark:text-emerald-400" />
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCheckout} className="space-y-4">
          {/* Shift warning if cashier forgot to start a shift */}
          {!activeShift && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Note: No active shift is opened. This transaction will still be recorded and assigned to your account.
              </span>
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Payment Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('cash');
                  setAmountPaidInput(total.toString());
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground'
                }`}
              >
                <Banknote className="h-6 w-6 mb-1 text-emerald-600" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('gcash');
                  setAmountPaidInput(total.toString());
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === 'gcash'
                    ? 'border-[#007dfe] bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground'
                }`}
              >
                <Smartphone className="h-6 w-6 mb-1 text-[#007dfe]" />
                <span>GCash</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('maya');
                  setAmountPaidInput(total.toString());
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === 'maya'
                    ? 'border-[#12b886] bg-teal-50/50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/30'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground'
                }`}
              >
                <QrCode className="h-6 w-6 mb-1 text-[#12b886]" />
                <span>Maya</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('other');
                  setAmountPaidInput(total.toString());
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === 'other'
                    ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/30'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground'
                }`}
              >
                <CreditCard className="h-6 w-6 mb-1 text-purple-600" />
                <span>Other / Card</span>
              </button>
            </div>
          </div>

          {/* Cash Amount Paid & Change Calculation */}
          {paymentMethod === 'cash' ? (
            <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  Cash Amount Received:
                </label>
                <div className="flex gap-1">
                  {quickCashPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAmountPaidInput(preset.amount.toString())}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md border border-border bg-card hover:bg-primary/10 hover:border-primary transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  className="text-2xl font-bold h-14 pl-8 text-foreground"
                  autoFocus
                  required
                />
                <span className="absolute left-3 top-3.5 text-xl font-bold text-muted-foreground">
                  ₱
                </span>
              </div>

              {/* Change summary box */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="text-sm font-medium text-muted-foreground">Change:</span>
                <div className="text-right">
                  <CurrencyText
                    amount={change}
                    className={`text-2xl font-black ${
                      isInsufficient
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  />
                  {isInsufficient && (
                    <div className="text-[11px] font-semibold text-rose-600">
                      Need {formatPeso(total - parsedAmountPaid)} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border/80">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  {paymentMethod === 'gcash'
                    ? 'GCash Reference No. / Sender Name (Optional)'
                    : paymentMethod === 'maya'
                    ? 'Maya Reference No. / Transaction ID (Optional)'
                    : 'Payment Reference / Details (Optional)'}
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 98234812"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex justify-between items-center text-sm pt-2 border-t border-border/60">
                <span className="text-muted-foreground">Amount to Scan / Pay:</span>
                <CurrencyText amount={total} className="text-xl font-black text-foreground" />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Transaction Notes (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Customer name, delivery note, etc."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="emerald"
              size="lg"
              disabled={isSubmitting || isInsufficient || items.length === 0}
              className="gap-2 font-bold text-base flex-1 sm:flex-initial"
            >
              <CheckCircle2 className="h-5 w-5" />
              {isSubmitting ? 'Processing...' : `Confirm & Pay ${formatPeso(total)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
