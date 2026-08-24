'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Sale, Shift, Business } from '@/types/database.types';
import { computeReadingReport, ReadingReportData } from '@/lib/export-utils';
import { formatPeso, formatDateTime } from '@/lib/formatters';
import { ReceiptPaperWidth, generatePlainTextReading } from '@/lib/escpos';
import { usePrinterStore } from '@/stores/printerStore';
import { bluetoothPrinterService } from '@/lib/bluetoothPrinter';
import {
  getPlatformCapabilities,
  PlatformCapabilities,
} from '@/lib/platform';
import { PrinterGuideModal } from '@/components/pos/PrinterGuideModal';
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
  Share2,
  HelpCircle,
  Apple,
  Smartphone,
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
  const [platform, setPlatform] = useState<PlatformCapabilities | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setPlatform(getPlatformCapabilities());
  }, []);

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
    if (!sales || !report) return;

    if (!isConnected) {
      const ok = await bluetoothPrinterService.connect();
      if (ok) {
        await printBtReading(report);
      }
      return;
    }
    await printBtReading(report);
  };

  const handleShareReport = async () => {
    const text = generatePlainTextReading(report, paperWidth);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${type}-Reading Report - ${business?.name || 'POS'}`,
          text: text,
        });
        toast.success('Report shared successfully');
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          handleCopyPlainText();
        }
      }
    } else {
      handleCopyPlainText();
    }
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
  const isBluetoothAvailable = platform?.isWebBluetoothSupported ?? false;
  const isIOSPlatform = platform?.isIOS ?? false;

  return (
    <>
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
                80mm
              </button>
            </div>
          </div>

          {/* iOS Notice if relevant */}
          {isIOSPlatform && !isBluetoothAvailable && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-300">
              <div className="flex items-center gap-1.5 font-medium">
                <Apple className="h-3.5 w-3.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                <span>iOS Web: Tap <strong>Print Report</strong> (AirPrint)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="underline hover:text-emerald-700 font-semibold flex items-center gap-0.5 shrink-0"
              >
                <HelpCircle className="h-3 w-3" />
                BT Guide
              </button>
            </div>
          )}

          {/* Report Paper Preview */}
          <div className="py-2 overflow-y-auto max-h-[44vh] flex justify-center bg-slate-100 dark:bg-slate-950/60 p-3 rounded-lg border border-border/50">
            <div
              ref={reportRef}
              className={`printable-report-container bg-white text-black p-3 font-mono ${widthClass} mx-auto border border-dashed border-gray-300 shadow-sm print:shadow-none print:border-none print:p-0`}
              style={{ fontFamily: "'Courier New', Courier, monospace" }}
            >
              {/* Header */}
              <div className="text-center pb-2 border-b border-dashed border-gray-400">
                <h2 className="font-bold uppercase text-xs">{report.businessName}</h2>
                {business?.address && (
                  <p className="text-[9px] text-gray-600">{business.address}</p>
                )}
                <div className="mt-1 font-bold text-xs bg-black text-white py-0.5 px-1 inline-block">
                  *** {report.type}-READING REPORT ***
                </div>
                <p className="text-[9px] text-gray-500 mt-0.5">
                  {report.type === 'X' ? 'MID-DAY AUDIT' : 'OFFICIAL END-OF-DAY'}
                </p>
              </div>

              {/* Metadata */}
              <div className="py-1.5 text-[9px] border-b border-dashed border-gray-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Generated:</span>
                  <span>{formatDateTime(report.generatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span className="font-bold">{report.cashierName}</span>
                </div>
                {report.shiftStart && (
                  <div className="flex justify-between">
                    <span>Period:</span>
                    <span>{formatDateTime(report.shiftStart).split(' ')[1]} - {report.shiftEnd ? formatDateTime(report.shiftEnd).split(' ')[1] : 'Present'}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Sales Count:</span>
                  <span className="font-bold">{report.transactionCount} txns</span>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="py-1.5 text-[10px] border-b border-dashed border-gray-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Gross Sales:</span>
                  <span>{formatPeso(report.grossSales)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Discounts:</span>
                  <span>-{formatPeso(report.totalDiscounts)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-300 pt-0.5">
                  <span>NET SALES:</span>
                  <span>{formatPeso(report.netSales)}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="py-1.5 text-[9px] border-b border-dashed border-gray-400 space-y-0.5">
                <p className="font-bold text-[9px] text-gray-600 uppercase">Payment Modes:</p>
                <div className="flex justify-between pl-1">
                  <span>CASH:</span>
                  <span className="font-bold">{formatPeso(report.payments.cash)}</span>
                </div>
                <div className="flex justify-between pl-1">
                  <span>GCASH:</span>
                  <span className="font-bold">{formatPeso(report.payments.gcash)}</span>
                </div>
                <div className="flex justify-between pl-1">
                  <span>MAYA:</span>
                  <span className="font-bold">{formatPeso(report.payments.maya)}</span>
                </div>
                {report.payments.other > 0 && (
                  <div className="flex justify-between pl-1">
                    <span>OTHER:</span>
                    <span className="font-bold">{formatPeso(report.payments.other)}</span>
                  </div>
                )}
              </div>

              {/* Department Breakdown */}
              <div className="py-1.5 text-[9px] border-b border-dashed border-gray-400 space-y-0.5">
                <p className="font-bold uppercase text-gray-600">Department Sales:</p>
                <div className="flex justify-between pl-1">
                  <span>Kitchen / Food:</span>
                  <span>{formatPeso(report.kitchenRevenue)}</span>
                </div>
                <div className="flex justify-between pl-1">
                  <span>Store / Retail:</span>
                  <span>{formatPeso(report.storeRevenue)}</span>
                </div>
              </div>

              {/* Shift Drawer Reconciliation (if shift available) */}
              {report.startingCash !== undefined && (
                <div className="py-1.5 text-[9px] border-b border-dashed border-gray-400 space-y-0.5">
                  <p className="font-bold uppercase text-gray-600">Drawer Reconciliation:</p>
                  <div className="flex justify-between pl-1">
                    <span>Opening Float:</span>
                    <span>{formatPeso(report.startingCash)}</span>
                  </div>
                  <div className="flex justify-between pl-1">
                    <span>+ Cash Sales:</span>
                    <span>{formatPeso(report.payments.cash)}</span>
                  </div>
                  {report.expectedCashInDrawer !== undefined && (
                    <div className="flex justify-between pl-1 font-bold">
                      <span>= Expected Cash:</span>
                      <span>{formatPeso(report.expectedCashInDrawer)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-2 text-[8px] text-gray-500 space-y-0.5">
                <p>=== END OF {report.type}-READING ===</p>
                <p>POS Terminal #01 - SOX POS</p>
              </div>
            </div>
          </div>

          {/* Quick Raw Actions */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Raw Data:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPlainText}
                className="flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <Copy className="h-3 w-3" />
                Copy Text
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
            {isBluetoothAvailable ? (
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
            ) : (
              <Button
                type="button"
                variant="emerald"
                onClick={handleSystemPrint}
                className="w-full gap-2 font-bold shadow-xs py-2.5"
              >
                <Printer className="h-4 w-4" />
                {isIOSPlatform ? `Print ${type}-Reading (AirPrint / System)` : `Print ${type}-Reading (System)`}
              </Button>
            )}

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-2">
              {isBluetoothAvailable ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSystemPrint}
                  className="gap-1.5 w-full font-medium text-xs"
                >
                  <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                  System Print
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBluetoothPrint}
                  className="gap-1.5 w-full font-medium text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                >
                  <Bluetooth className="h-3.5 w-3.5 text-emerald-600" />
                  Bluetooth Setup
                </Button>
              )}

              {platform?.isAndroid ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    import('@/lib/rawbt').then(({ printReadingViaRawBT }) => {
                      printReadingViaRawBT(report, paperWidth);
                    });
                  }}
                  className="gap-1.5 w-full font-medium text-xs border-sky-600/30 text-sky-700 hover:bg-sky-50 dark:text-sky-400"
                >
                  <Smartphone className="h-3.5 w-3.5 text-sky-600" />
                  RawBT Android
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShareReport}
                  className="gap-1.5 w-full font-medium text-xs border-purple-600/30 text-purple-700 hover:bg-purple-50 dark:text-purple-400"
                >
                  <Share2 className="h-3.5 w-3.5 text-purple-600" />
                  Share Report
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2 h-8"
              >
                <HelpCircle className="h-3 w-3" />
                Setup Guide
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1 text-xs font-semibold h-8"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PrinterGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </>
  );
}
