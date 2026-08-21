import { create } from 'zustand';
import { Shift, ShiftType } from '@/types/database.types';
import { dbService } from '@/lib/db';

interface ShiftState {
  activeShift: Shift | null;
  isLoading: boolean;
  fetchActiveShift: (userId?: string) => Promise<void>;
  startShift: (shiftType: ShiftType, openingCash: number, notes?: string) => Promise<Shift>;
  endShift: (shiftId: string, actualCash: number, notes?: string) => Promise<Shift>;
}

export const useShiftStore = create<ShiftState>((set) => ({
  activeShift: null,
  isLoading: true,

  fetchActiveShift: async (userId?: string) => {
    set({ isLoading: true });
    try {
      const activeShift = await dbService.getActiveShift(userId);
      set({ activeShift, isLoading: false });
    } catch {
      set({ activeShift: null, isLoading: false });
    }
  },

  startShift: async (shiftType: ShiftType, openingCash: number, notes?: string) => {
    const newShift = await dbService.startShift(shiftType, openingCash, notes);
    set({ activeShift: newShift });
    return newShift;
  },

  endShift: async (shiftId: string, actualCash: number, notes?: string) => {
    const closed = await dbService.endShift(shiftId, actualCash, notes);
    set({ activeShift: null });
    return closed;
  },
}));
