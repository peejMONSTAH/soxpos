import { create } from 'zustand';
import { Product } from '@/types/database.types';
import { CartItem, CartDiscount } from '@/types/pos.types';

interface CartState {
  items: CartItem[];
  discount: CartDiscount | null;
  addItem: (product: Product, quantity?: number, selected_drink?: Product | null) => void;
  removeItem: (productId: string, drinkId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, drinkId?: string | null) => void;
  incrementQuantity: (productId: string, drinkId?: string | null) => void;
  decrementQuantity: (productId: string, drinkId?: string | null) => void;
  setDiscount: (discount: CartDiscount | null) => void;
  clearCart: () => void;

  // Computed values
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: null,

  addItem: (product: Product, quantity = 1, selected_drink?: Product | null) => {
    // Check product stock limit
    if (product.stock_quantity <= 0) return;

    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => item.product.id === product.id && item.selected_drink?.id === selected_drink?.id
      );

      if (existingIndex > -1) {
        const currentQty = state.items[existingIndex].quantity;
        const newQty = Math.min(currentQty + quantity, product.stock_quantity);
        const updatedItems = [...state.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: newQty,
          subtotal: newQty * product.selling_price,
        };
        return { items: updatedItems };
      } else {
        const initialQty = Math.min(quantity, product.stock_quantity);
        const newItem: CartItem = {
          product,
          quantity: initialQty,
          discount: 0,
          subtotal: initialQty * product.selling_price,
          selected_drink: selected_drink || null,
        };
        return { items: [...state.items, newItem] };
      }
    });
  },

  removeItem: (productId: string, drinkId?: string | null) => {
    set((state) => ({
      items: state.items.filter(
        (item) => !(item.product.id === productId && (drinkId === undefined || item.selected_drink?.id === drinkId))
      ),
    }));
  },

  updateQuantity: (productId: string, quantity: number, drinkId?: string | null) => {
    set((state) => {
      if (quantity <= 0) {
        return {
          items: state.items.filter(
            (item) => !(item.product.id === productId && (drinkId === undefined || item.selected_drink?.id === drinkId))
          ),
        };
      }

      return {
        items: state.items.map((item) => {
          if (item.product.id === productId && (drinkId === undefined || item.selected_drink?.id === drinkId)) {
            const safeQty = Math.min(quantity, item.product.stock_quantity);
            return {
              ...item,
              quantity: safeQty,
              subtotal: safeQty * item.product.selling_price,
            };
          }
          return item;
        }),
      };
    });
  },

  incrementQuantity: (productId: string, drinkId?: string | null) => {
    const item = get().items.find(
      (i) => i.product.id === productId && (drinkId === undefined || i.selected_drink?.id === drinkId)
    );
    if (item) {
      get().updateQuantity(productId, item.quantity + 1, drinkId);
    }
  },

  decrementQuantity: (productId: string, drinkId?: string | null) => {
    const item = get().items.find(
      (i) => i.product.id === productId && (drinkId === undefined || i.selected_drink?.id === drinkId)
    );
    if (item) {
      get().updateQuantity(productId, item.quantity - 1, drinkId);
    }
  },

  setDiscount: (discount: CartDiscount | null) => {
    set({ discount });
  },

  clearCart: () => {
    set({ items: [], discount: null });
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  },

  getDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    const discount = get().discount;
    if (!discount || subtotal <= 0) return 0;

    if (discount.type === 'percentage') {
      return (subtotal * discount.value) / 100;
    }
    return Math.min(discount.value, subtotal);
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discountAmount = get().getDiscountAmount();
    return Math.max(0, subtotal - discountAmount);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
