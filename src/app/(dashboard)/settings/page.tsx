'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { dbService } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePrinterStore } from '@/stores/printerStore';
import { bluetoothPrinterService } from '@/lib/bluetoothPrinter';
import { printTestViaRawBT } from '@/lib/rawbt';
import {
  getPlatformCapabilities,
  PlatformCapabilities,
} from '@/lib/platform';
import { PrinterGuideModal } from '@/components/pos/PrinterGuideModal';
import { PrintableReceipt } from '@/components/sales/PrintableReceipt';
import { Sale } from '@/types/database.types';
import {
  Store,
  Printer,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sliders,
  FileCheck2,
  Smartphone,
  Apple,
  HelpCircle,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const testReceiptRef = useRef<HTMLDivElement>(null);

  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: () => dbService.getBusiness(),
  });

  // Printer Store
  const {
    isConnected,
    isConnecting,
    isPrinting,
    deviceName,
    paperWidth,
    autoPrintOnSale,
    setPaperWidth,
    setAutoPrintOnSale,
    connect: connectPrinter,
    disconnect: disconnectPrinter,
    printTest,
  } = usePrinterStore();

  const [platform, setPlatform] = useState<PlatformCapabilities | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setPlatform(getPlatformCapabilities());
  }, []);

  // Simple local store form states
  const [name, setName] = useState('SOX POS Store');
  const [phone, setPhone] = useState('0917-555-7890');
  const [address, setAddress] = useState('General Santos City');
  const [headerNote, setHeaderNote] = useState('Salamat sa pagpalit!');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setName(business.name || 'SOX POS Store');
      setPhone(business.phone || '');
      setAddress(business.address || '');
      setHeaderNote(business.receipt_header || 'Salamat sa pagpalit!');
    }
  }, [business]);

  const sampleTestSale: Sale = {
    id: 'test-sale',
    business_id: business?.id || 'default-biz',
    receipt_number: 'TEST-0001',
    user_id: 'admin',
    user_name: 'Cashier Staff',
    shift_id: null,
    status: 'completed',
    notes: null,
    total: 250.0,
    subtotal: 250.0,
    discount: 0,
    amount_paid: 500.0,
    change: 250.0,
    payment_method: 'cash',
    payment_reference: null,
    created_at: new Date().toISOString(),
    items: [
      {
        id: 'item-1',
        sale_id: 'test-sale',
        product_id: 'p-1',
        product_name_snapshot: 'Sample Test Product Item',
        quantity: 2,
        unit_price: 125.0,
        cost_price_snapshot: 80.0,
        subtotal: 250.0,
      },
    ],
  };

  const handleSystemTestPrint = useReactToPrint({
    contentRef: testReceiptRef,
    documentTitle: 'Test-Receipt',
    onAfterPrint: () => {
      toast.success('System test print sent');
    },
  });

  const handlePairClick = async () => {
    const hasBluetooth =
      typeof navigator !== 'undefined' &&
      'bluetooth' in navigator &&
      typeof (navigator as any).bluetooth?.requestDevice === 'function';

    if (!hasBluetooth) {
      toast.error('Bluetooth not available in this browser', {
        description: 'Please open this website inside the Bluefy app on iOS or Chrome on Android.',
        action: {
          label: 'View Guide',
          onClick: () => setShowGuide(true),
        },
      });
      return;
    }
    await connectPrinter();
  };

  const handleRawBTTest = () => {
    try {
      printTestViaRawBT(business?.name || 'SOX POS Store', paperWidth);
      toast.success('RawBT test print sent');
    } catch (err: any) {
      toast.error('RawBT Error', { description: err?.message });
    }
  };

  const handleSaveStoreInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Store name is required');
      return;
    }

    setIsSaving(true);
    try {
      await dbService.updateBusiness({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        receipt_header: headerNote.trim() || null,
      });

      toast.success('Store Settings Saved');
      queryClient.invalidateQueries({ queryKey: ['business'] });
    } catch (err: any) {
      toast.error('Failed to save settings', { description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  const isBluetoothSupported = platform?.isWebBluetoothSupported ?? false;
  const isIOSPlatform = platform?.isIOS ?? false;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Hardware</h1>
          <p className="text-sm text-muted-foreground">
            Configure store profile, receipt formats, iOS AirPrint, and Bluetooth thermal printers.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowGuide(true)}
          className="gap-1.5 text-xs font-semibold self-start sm:self-auto"
        >
          <HelpCircle className="h-4 w-4 text-emerald-600" />
          Hardware & Printing Guide
        </Button>
      </div>

      {/* Hidden container for System Test Print */}
      <div className="hidden">
        <PrintableReceipt
          ref={testReceiptRef}
          sale={sampleTestSale}
          business={business}
          paperWidth={paperWidth}
        />
      </div>

      {/* Hardware & Thermal Printing Card */}
      <Card className="border-emerald-200/50 dark:border-emerald-900/40 shadow-sm">
        <CardHeader className="pb-3 border-b border-border bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
              <Printer className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Thermal Receipt & Wireless Hardware
            </CardTitle>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  <BluetoothConnected className="h-3.5 w-3.5 animate-pulse" />
                  BLE Paired: {deviceName || 'Thermal Printer'}
                </span>
              ) : isBluetoothSupported ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-border">
                  <Radio className="h-3.5 w-3.5 text-emerald-600" />
                  Web Bluetooth Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                  <Printer className="h-3.5 w-3.5 text-sky-600" />
                  System / AirPrint Ready
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* iOS Platform Notice Banner */}
          {isIOSPlatform && !isBluetoothSupported && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 text-xs">
              <Apple className="h-4 w-4 shrink-0 mt-0.5 text-zinc-900 dark:text-zinc-100" />
              <div className="space-y-1">
                <p className="font-bold">Apple iOS Detected (iPhone / iPad)</p>
                <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Safari and Chrome on iOS use <strong>AirPrint / System Print</strong> by default. For direct Bluetooth ESC/POS on iPad/iPhone without AirPrint, open your POS inside the free <strong>Bluefy Web BLE Browser</strong> from the App Store.
                </p>
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  className="font-bold underline hover:text-emerald-600 inline-flex items-center gap-1 mt-0.5"
                >
                  View iOS Setup Guide &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Web Bluetooth Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/40 border border-border">
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bluetooth className="h-4 w-4 text-emerald-600" />
                Direct Web Bluetooth (BLE Thermal)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConnected
                  ? `Active printer paired: ${deviceName || 'BLE Thermal Printer'}`
                  : isBluetoothSupported
                  ? 'Pair portable Bluetooth thermal printers (POS-58, GOOJPRT, Xprinter, MPT).'
                  : 'Web Bluetooth requires Chrome on Android/Desktop or Bluefy on iOS.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isConnected ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => printTest(business?.name)}
                    disabled={isPrinting}
                    className="gap-1.5 text-xs font-semibold border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    {isPrinting ? 'Printing...' : 'BLE Test'}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={disconnectPrinter}
                    className="text-xs"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="emerald"
                  size="sm"
                  onClick={handlePairClick}
                  disabled={isConnecting}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Bluetooth className="h-3.5 w-3.5" />
                  {isConnecting ? 'Searching Devices...' : 'Pair & Connect Printer'}
                </Button>
              )}
            </div>
          </div>

          {/* AirPrint / System Print Option */}
          <div className="p-3.5 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                <Printer className="h-4 w-4 text-emerald-600" />
                AirPrint / System Print (Universal for iOS, Android & Desktop)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Prints to any AirPrint receipt printer, Wi-Fi/Ethernet thermal printer, or standard desktop printer.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSystemTestPrint}
              className="gap-1.5 text-xs shrink-0 font-medium border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              Test AirPrint / System Print
            </Button>
          </div>

          {/* RawBT Companion Option for Android Classic SPP */}
          <div className="p-3.5 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                <Smartphone className="h-4 w-4 text-sky-600" />
                Android RawBT Companion (Classic Bluetooth SPP & USB)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                If using Android with a Bluetooth Classic or USB thermal printer, print instantly via the free <strong>RawBT</strong> app.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRawBTTest}
              className="gap-1.5 text-xs shrink-0 font-medium"
            >
              <Printer className="h-3.5 w-3.5 text-sky-600" />
              Test RawBT Print
            </Button>
          </div>

          {/* Paper Size & Auto-Print Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
                Thermal Paper Roll Width
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaperWidth('58mm')}
                  className={`p-2.5 rounded-lg text-left border transition-all ${
                    paperWidth === '58mm'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold ring-1 ring-emerald-600'
                      : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <p className="text-xs font-semibold">58mm (2-inch)</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Compact mobile roll</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperWidth('80mm')}
                  className={`p-2.5 rounded-lg text-left border transition-all ${
                    paperWidth === '80mm'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold ring-1 ring-emerald-600'
                      : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <p className="text-xs font-semibold">80mm (3-inch)</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Standard desktop roll</p>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-card flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Auto-Print on Checkout
                </label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Automatically sends receipt to your paired thermal printer immediately upon completing a sale.
                </p>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setAutoPrintOnSale(!autoPrintOnSale)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-between transition-all ${
                    autoPrintOnSale
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  <span>Auto-Print: {autoPrintOnSale ? 'ENABLED' : 'DISABLED'}</span>
                  <CheckCircle2 className={`h-4 w-4 ${autoPrintOnSale ? 'opacity-100' : 'opacity-40'}`} />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Information Card */}
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4 text-emerald-600" />
            Store Information & Receipt Header
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5">
          <form onSubmit={handleSaveStoreInfo} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Store Name *
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SOX POS Store"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Contact Phone / Mobile
                </label>
                <Input
                  type="text"
                  placeholder="0917-000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Store Location / Address
                </label>
                <Input
                  type="text"
                  placeholder="e.g. GenSan, South Cotabato"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <label className="text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                Receipt Greeting Message
              </label>
              <Input
                type="text"
                placeholder="e.g. Salamat sa pagpalit! Please come again."
                value={headerNote}
                onChange={(e) => setHeaderNote(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                This greeting prints at the top/bottom of customer thermal receipts.
              </p>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="emerald" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Store Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Guide Modal */}
      <PrinterGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </div>
  );
}
