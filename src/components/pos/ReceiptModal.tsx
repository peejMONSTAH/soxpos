'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Sale, Business } from '@/types/database.types';
import { PrintableReceipt } from '@/components/sales/PrintableReceipt';
import { generatePlainTextReceipt, ReceiptPaperWidth } from '@/lib/escpos';
import { usePrinterStore } from '@/stores/printerStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Printer,
  Check,
  ShoppingCart,
  Copy,
  Download,
  FileText,
  Bluetooth,
  BluetoothConnected,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  business?: Business | null;
}

export function ReceiptModal({ isOpen, onClose, sale, business }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isConnecting,
    isPrinting,
    deviceName,
    paperWidth: storedPaperWidth,
    autoPrintOnSale,
    connect: connectPrinter,
    printReceipt: printBtReceipt,
  } = usePrinterStore();

  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>(storedPaperWidth || '80mm');
  const autoPrintedRef = useRef<string | null>(null);

  // Sync stored default paper width
  useEffect(() => {
    if (storedPaperWidth) {
      setPaperWidth(storedPaperWidth);
    }
  }, [storedPaperWidth]);

  // Handle Auto-print on completed sale if configured
  useEffect(() => {
    if (isOpen && sale && autoPrintOnSale && isConnected && autoPrintedRef.current !== sale.id) {
      autoPrintedRef.current = sale.id;
      printBtReceipt(sale, business);
    }
  }, [isOpen, sale, autoPrintOnSale, isConnected, business, printBtReceipt]);

  const handleSystemPrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: sale ? `Receipt-${sale.receipt_number}` : 'Receipt',
    onAfterPrint: () => {
      toast.success('Print job sent successfully');
    },
  });

  const handleBluetoothPrint = async () => {
    if (!sale) return;
    if (!isConnected) {
      const ok = await connectPrinter();
      if (ok) {
        await printBtReceipt(sale, business);
      }
      return;
    }
    await printBtReceipt(sale, business);
  };

  const handleCopyRawText = () => {
    if (!sale) return;
    const text = generatePlainTextReceipt(sale, business, paperWidth);
    navigator.clipboard.writeText(text);
    toast.success('Raw ESC/POS text copied to clipboard');
  };

  const handleDownloadTxt = () => {
    if (!sale) return;
    const text = generatePlainTextReceipt(sale, business, paperWidth);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${sale.receipt_number}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Receipt text file downloaded');
  };

  if (!sale) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
              <Check className="h-5 w-5" />
              Sale Completed
            </span>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {sale.receipt_number}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Paper Width & Format Switcher */}
        <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded-lg border border-border text-xs">
          <span className="text-muted-foreground font-medium pl-1">Thermal Format:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaperWidth('58mm')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                paperWidth === '58mm'
                  ? 'bg-background shadow-xs text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              58mm (Roll)
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth('80mm')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                paperWidth === '80mm'
                  ? 'bg-background shadow-xs text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              80mm (Standard)
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Preview */}
        <div className="py-2 overflow-y-auto max-h-[46vh] flex justify-center bg-slate-100 dark:bg-slate-950/60 p-3 rounded-lg border border-border/50">
          <PrintableReceipt
            ref={receiptRef}
            sale={sale}
            business={business}
            paperWidth={paperWidth}
          />
        </div>

        {/* Raw Export / Quick Action Bar */}
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            ESC/POS Raw:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyRawText}
              className="flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <Download className="h-3 w-3" />
              Download .txt
            </button>
          </div>
        </div>

        {/* Printing Action Buttons */}
        <div className="space-y-2 pt-1 border-t border-border">
          {/* Bluetooth Print Button */}
          <Button
            type="button"
            variant="emerald"
            onClick={handleBluetoothPrint}
            disabled={isPrinting || isConnecting}
            className="w-full gap-2 font-bold shadow-xs py-2.5"
          >
            {isConnected ? (
              <BluetoothConnected className="h-4 w-4 text-emerald-100" />
            ) : (
              <Bluetooth className="h-4 w-4" />
            )}
            {isPrinting
              ? 'Sending to Bluetooth Printer...'
              : isConnecting
              ? 'Connecting Bluetooth...'
              : isConnected
              ? `Bluetooth Print (${deviceName || 'Thermal'})`
              : 'Connect & Print Bluetooth'}
          </Button>

          <DialogFooter className="grid grid-cols-2 gap-2 pt-1 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleSystemPrint}
              className="gap-1.5 w-full font-medium text-xs"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              System Print
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="gap-1.5 w-full font-bold text-xs"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              New Sale
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
