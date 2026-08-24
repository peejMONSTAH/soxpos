import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bluetoothPrinterService, BluetoothPrinterState } from '@/lib/bluetoothPrinter';
import {
  generateEscPosBinary,
  generateReadingEscPosBinary,
  generateTestReceiptBinary,
  ReceiptPaperWidth,
} from '@/lib/escpos';
import { Sale, Business } from '@/types/database.types';
import { ReadingReportData } from '@/lib/export-utils';
import { toast } from 'sonner';

interface PrinterStoreState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  deviceName: string | null;
  deviceId: string | null;

  // Persisted user preferences
  paperWidth: ReceiptPaperWidth;
  autoPrintOnSale: boolean;

  // Actions
  setPaperWidth: (width: ReceiptPaperWidth) => void;
  setAutoPrintOnSale: (enabled: boolean) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  printReceipt: (sale: Sale, business?: Business | null) => Promise<boolean>;
  printReading: (report: ReadingReportData) => Promise<boolean>;
  printTest: (businessName?: string) => Promise<boolean>;
}

export const usePrinterStore = create<PrinterStoreState>()(
  persist(
    (set, get) => {
      // Sync service connection state updates
      if (typeof window !== 'undefined') {
        bluetoothPrinterService.subscribe((state: BluetoothPrinterState) => {
          set({
            isConnected: state.isConnected,
            isConnecting: state.isConnecting,
            isPrinting: state.isPrinting,
            deviceName: state.deviceName,
            deviceId: state.deviceId,
          });
        });
      }

      return {
        isConnected: false,
        isConnecting: false,
        isPrinting: false,
        deviceName: null,
        deviceId: null,

        paperWidth: '80mm',
        autoPrintOnSale: false,

        setPaperWidth: (width) => set({ paperWidth: width }),
        setAutoPrintOnSale: (enabled) => set({ autoPrintOnSale: enabled }),

        connect: async () => {
          try {
            const success = await bluetoothPrinterService.connect();
            if (success) {
              const name = bluetoothPrinterService.getState().deviceName || 'Printer';
              toast.success(`Bluetooth connected to ${name}`);
            } else {
              const err = bluetoothPrinterService.getState().error;
              if (err) {
                toast.error('Bluetooth connection issue', { description: err });
              }
            }
            return success;
          } catch (err: any) {
            toast.error('Bluetooth connection failed', {
              description: err?.message || 'Could not connect to thermal printer',
            });
            return false;
          }
        },

        disconnect: () => {
          bluetoothPrinterService.disconnect();
          toast.info('Bluetooth printer disconnected');
        },

        printReceipt: async (sale: Sale, business?: Business | null) => {
          const { paperWidth } = get();
          try {
            toast.loading('Sending receipt to Bluetooth printer...', { id: 'bt-print' });
            const bytes = generateEscPosBinary(sale, business, paperWidth);
            await bluetoothPrinterService.printBytes(bytes);
            toast.success('Receipt printed successfully via Bluetooth', { id: 'bt-print' });
            return true;
          } catch (err: any) {
            toast.error('Failed to print receipt', {
              id: 'bt-print',
              description: err?.message || 'Bluetooth communication error',
            });
            return false;
          }
        },

        printReading: async (report: ReadingReportData) => {
          const { paperWidth } = get();
          try {
            toast.loading(`Sending ${report.type}-Reading to Bluetooth printer...`, { id: 'bt-print-reading' });
            const bytes = generateReadingEscPosBinary(report, paperWidth);
            await bluetoothPrinterService.printBytes(bytes);
            toast.success(`${report.type}-Reading printed successfully`, { id: 'bt-print-reading' });
            return true;
          } catch (err: any) {
            toast.error('Failed to print report', {
              id: 'bt-print-reading',
              description: err?.message || 'Bluetooth communication error',
            });
            return false;
          }
        },

        printTest: async (businessName?: string) => {
          const { paperWidth } = get();
          try {
            toast.loading('Printing test receipt...', { id: 'bt-test-print' });
            const bytes = generateTestReceiptBinary(businessName || 'SOX POS', paperWidth);
            await bluetoothPrinterService.printBytes(bytes);
            toast.success('Test receipt printed successfully!', { id: 'bt-test-print' });
            return true;
          } catch (err: any) {
            toast.error('Test print failed', {
              id: 'bt-test-print',
              description: err?.message || 'Bluetooth communication error',
            });
            return false;
          }
        },
      };
    },
    {
      name: 'sox-pos-printer-settings',
      partialize: (state) => ({
        paperWidth: state.paperWidth,
        autoPrintOnSale: state.autoPrintOnSale,
      }),
    }
  )
);
