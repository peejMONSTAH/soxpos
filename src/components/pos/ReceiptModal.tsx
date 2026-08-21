'use client';

import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Sale, Business } from '@/types/database.types';
import { PrintableReceipt, ReceiptWidth } from '@/components/sales/PrintableReceipt';
import { generatePlainTextReceipt } from '@/lib/escpos';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Check, ShoppingCart, Copy, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  business?: Business | null;
}

export function ReceiptModal({ isOpen, onClose, sale, business }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [paperWidth, setPaperWidth] = useState<ReceiptWidth>('80mm');

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: sale ? `Receipt-${sale.receipt_number}` : 'Receipt',
    onAfterPrint: () => {
      toast.success('Print job sent successfully');
    },
  });

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
        <div className="py-2 overflow-y-auto max-h-[50vh] flex justify-center bg-slate-100 dark:bg-slate-950/60 p-3 rounded-lg border border-border/50">
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

        <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="gap-1.5 w-full font-medium"
          >
            <Printer className="h-4 w-4" />
            Print ({paperWidth})
          </Button>

          <Button
            type="button"
            variant="emerald"
            onClick={onClose}
            className="gap-1.5 w-full font-bold"
          >
            <ShoppingCart className="h-4 w-4" />
            New Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
