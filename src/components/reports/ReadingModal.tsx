'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Sale, Shift, Business } from '@/types/database.types';
import { computeReadingReport, ReadingReportData } from '@/lib/export-utils';
import { formatPeso, formatDateTime } from '@/lib/formatters';
import { ReceiptPaperWidth, generatePlainTextReading } from '@/lib/escpos';
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
  Download,
  FileText,
  Bluetooth,
  BluetoothConnected,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

import { useQuery } from '@tanstack/react-query';
import { dbService } from '@/lib/db';

interface ReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'X' | 'Z';
  sales: Sale[];
  shift?: Shift | null;
  business?: Business | null;
  cashierName?: string;
}

export function ReadingModal({
  isOpen,
  onClose,
  type,
  sales,
  shift,
  business,
  cashierName,
}: ReadingModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isConnecting,
    isPrinting,
    deviceName,
    paperWidth: storedPaperWidth,
    connect: connectPrinter,
    printReading: printBtReading,
  } = usePrinterStore();

  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>(storedPaperWidth || '80mm');

  useEffect(() => {
    if (storedPaperWidth) {
      setPaperWidth(storedPaperWidth);
    }
  }, [storedPaperWidth]);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => dbService.getProducts(),
    enabled: isOpen,
  });

  const report: ReadingReportData = computeReadingReport({
    type,
    sales,
    shift,
    business,
    cashierName,
    products,
  });

  const handleSystemPrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `${type}-Reading-${new Date().toISOString().split('T')[0]}`,
    onAfterPrint: () => {
      toast.success(`${type}-Reading sent to printer`);
    },
  });

  const handleBluetoothPrint = async () => {
    if (!isConnected) {
      const ok = await connectPrinter();
      if (ok) {
        await printBtReading(report);
      }
      return;
    }
    await printBtReading(report);
  };

  const handleCopyPlainText = () => {
    const text = generatePlainTextReading(report, paperWidth);
    navigator.clipboard.writeText(text);
    toast.success('Report text copied to clipboard');
  };

  const handleDownloadSummary = () => {
    const text = generatePlainTextReading(report, paperWidth);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-Reading-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${type}-Reading text file downloaded`);
  };

  const is58mm = paperWidth === '58mm';
  const widthClass = is58mm ? 'max-w-[240px] text-[10px]' : 'max-w-[340px] text-xs';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <FileText className="h-5 w-5 text-emerald-600" />
              {type}-Reading Report
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">
              {type === 'X' ? 'MID-SHIFT' : 'DAY-END'}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Paper Switcher */}
        <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded-lg border border-border text-xs">
          <span className="text-muted-foreground font-medium pl-1">Thermal Format:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaperWidth('58mm')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                is58mm
                  ? 'bg-background shadow-xs text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              58mm
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth('80mm')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                !is58mm
                  ? 'bg-background shadow-xs text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              80mm Standard
            </button>
          </div>
        </div>

        {/* Printable Report Preview */}
        <div className="py-2 overflow-y-auto max-h-[46vh] flex justify-center bg-slate-100 dark:bg-slate-950/60 p-3 rounded-lg border border-border/50">
          <div
            ref={reportRef}
            className={`printable-report-container bg-white text-black p-3.5 font-mono ${widthClass} mx-auto border border-dashed border-gray-300 shadow-sm print:shadow-none print:border-none print:p-0`}
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <h2 className="font-bold tracking-tight uppercase text-sm">{report.businessName}</h2>
              <p className="font-bold text-[11px] mt-1">{report.title}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{formatDateTime(report.generatedAt)}</p>
            </div>

            {/* Shift & Staff Metadata */}
            <div className="py-2 text-[10px] border-b border-dashed border-gray-400 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-600">Cashier:</span>
                <span className="font-bold">{report.cashierName}</span>
              </div>
              {report.shiftStart && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Shift Started:</span>
                  <span>{formatDateTime(report.shiftStart)}</span>
                </div>
              )}
              {report.shiftEnd && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Shift Ended:</span>
                  <span>{formatDateTime(report.shiftEnd)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Transactions:</span>
                <span className="font-bold">{report.transactionCount}</span>
              </div>
            </div>

            {/* Sales Summary */}
            <div className="py-2 text-[10px] border-b border-dashed border-gray-400 space-y-0.5">
              <div className="flex justify-between">
                <span>Gross Sales:</span>
                <span>{formatPeso(report.grossSales)}</span>
              </div>
              {report.totalDiscounts > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>Discounts Given:</span>
                  <span>-{formatPeso(report.totalDiscounts)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-200">
                <span>NET SALES:</span>
                <span className="font-black">{formatPeso(report.netSales)}</span>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="py-2 text-[10px] border-b border-dashed border-gray-400 space-y-0.5">
              <div className="font-bold text-[10px] pb-0.5">PAYMENT BREAKDOWN</div>
              <div className="flex justify-between">
                <span>Cash:</span>
                <span className="font-bold">{formatPeso(report.payments.cash)}</span>
              </div>
              <div className="flex justify-between">
                <span>GCash:</span>
                <span>{formatPeso(report.payments.gcash)}</span>
              </div>
              <div className="flex justify-between">
                <span>Maya:</span>
                <span>{formatPeso(report.payments.maya)}</span>
              </div>
              {report.payments.other > 0 && (
                <div className="flex justify-between">
                  <span>Other:</span>
                  <span>{formatPeso(report.payments.other)}</span>
                </div>
              )}
            </div>

            {/* Drawer Cash Reconciliation */}
            <div className="py-2 text-[10px] border-b border-dashed border-gray-400 space-y-0.5 bg-gray-50 p-1.5 rounded-xs mt-1">
              <div className="font-bold text-[10px]">CASH DRAWER RECONCILIATION</div>
              <div className="flex justify-between">
                <span>Opening Cash Float:</span>
                <span>{formatPeso(report.startingCash || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Sales Added:</span>
                <span>+{formatPeso(report.payments.cash)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-300">
                <span>EXPECTED CASH:</span>
                <span className="font-black text-black">
                  {formatPeso(report.expectedCashInDrawer || 0)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 text-[9px] text-gray-500">
              <p>*** END OF {type}-READING ***</p>
              <p className="pt-0.5 font-sans">System Generated Audit Report</p>
            </div>
          </div>
        </div>

        {/* Raw Export Quick Actions */}
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Report Text:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPlainText}
              className="flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={handleDownloadSummary}
              className="flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <Download className="h-3 w-3" />
              Download .txt
            </button>
          </div>
        </div>

        {/* Printing Action Buttons */}
        <div className="space-y-2 pt-1 border-t border-border">
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
              ? `Printing ${type}-Reading...`
              : isConnecting
              ? 'Connecting Bluetooth...'
              : isConnected
              ? `Bluetooth Print ${type}-Reading (${deviceName || 'Thermal'})`
              : `Connect & Print ${type}-Reading`}
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
              className="w-full text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
