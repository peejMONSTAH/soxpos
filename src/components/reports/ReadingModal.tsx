'use client';

import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Sale, Shift, Business } from '@/types/database.types';
import { computeReadingReport, ReadingReportData } from '@/lib/export-utils';
import { formatPeso, formatDateTime } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, FileText, CheckCircle2 } from 'lucide-react';
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
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');

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

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `${type}-Reading-${new Date().toISOString().split('T')[0]}`,
    onAfterPrint: () => {
      toast.success(`${type}-Reading sent to printer`);
    },
  });

  const handleDownloadSummary = () => {
    const lines = [
      '========================================',
      report.businessName.toUpperCase(),
      report.title,
      '========================================',
      `Date/Time: ${formatDateTime(report.generatedAt)}`,
      `Cashier:   ${report.cashierName}`,
      report.shiftStart ? `Shift In:  ${formatDateTime(report.shiftStart)}` : '',
      report.shiftEnd ? `Shift Out: ${formatDateTime(report.shiftEnd)}` : '',
      '----------------------------------------',
      `Total Transactions: ${report.transactionCount}`,
      `Gross Sales:        ${formatPeso(report.grossSales)}`,
      `Discounts Given:   -${formatPeso(report.totalDiscounts)}`,
      `NET SALES:          ${formatPeso(report.netSales)}`,
      '----------------------------------------',
      'PAYMENT BREAKDOWN:',
      `  Cash:             ${formatPeso(report.payments.cash)}`,
      `  GCash:            ${formatPeso(report.payments.gcash)}`,
      `  Maya:             ${formatPeso(report.payments.maya)}`,
      `  Other:            ${formatPeso(report.payments.other)}`,
      '----------------------------------------',
      `Store Sales:        ${formatPeso(report.storeRevenue)}`,
      `Kitchen Sales:      ${formatPeso(report.kitchenRevenue)}`,
      '========================================',
      `Expected Cash in Drawer: ${formatPeso(report.expectedCashInDrawer || 0)}`,
      '========================================',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
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
        <div className="py-2 overflow-y-auto max-h-[50vh] flex justify-center bg-slate-100 dark:bg-slate-950/60 p-3 rounded-lg border border-border/50">
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

        <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadSummary}
            className="gap-1.5 w-full font-medium"
          >
            <Download className="h-4 w-4" />
            Download .txt
          </Button>

          <Button
            type="button"
            variant="emerald"
            onClick={handlePrint}
            className="gap-1.5 w-full font-bold"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
