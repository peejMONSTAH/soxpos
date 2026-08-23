'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePrinterStore } from '@/stores/printerStore';
import { bluetoothPrinterService } from '@/lib/bluetoothPrinter';
import { printTestViaRawBT } from '@/lib/rawbt';
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
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const queryClient = useQueryClient();

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

  const [isBluetoothSupported, setIsBluetoothSupported] = useState(true);
  const [diagnosticReason, setDiagnosticReason] = useState<string>('');

  useEffect(() => {
    const supported = bluetoothPrinterService.isSupported();
    setIsBluetoothSupported(supported);
    setDiagnosticReason(bluetoothPrinterService.getDiagnosticReason());
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

  const handlePairClick = async () => {
    if (!isBluetoothSupported) {
      alert(`Bluetooth cannot start:\n\n${diagnosticReason}\n\nMake sure you are opening your POS site via HTTPS (e.g. on Vercel) inside Google Chrome on your Android tablet.`);
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

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Hardware</h1>
        <p className="text-sm text-muted-foreground">
          Configure store profile, receipt header message, and Bluetooth thermal printer.
        </p>
      </div>

      {/* Bluetooth Thermal Printer Card */}
      <Card className="border-emerald-200/50 dark:border-emerald-900/40 shadow-sm">
        <CardHeader className="pb-3 border-b border-border bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
              <Bluetooth className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Bluetooth Thermal Printer (Android / Chrome)
            </CardTitle>
            <div>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  <BluetoothConnected className="h-3.5 w-3.5 animate-pulse" />
                  Connected: {deviceName || 'Thermal Printer'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  <BluetoothOff className="h-3.5 w-3.5" />
                  Not Connected
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {!isBluetoothSupported && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Web Bluetooth Notice: {diagnosticReason}</p>
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  To use direct Bluetooth pairing, please make sure you open your POS through your <strong>HTTPS Vercel link</strong> inside <strong>Google Chrome</strong> on your tablet.
                </p>
              </div>
            </div>
          )}

          {/* Connection Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/40 border border-border">
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Printer className="h-4 w-4 text-emerald-600" />
                Wireless Thermal Connection
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConnected
                  ? `Active printer paired: ${deviceName || 'BLE Thermal Printer'}`
                  : 'Pair your Bluetooth thermal printer directly inside Chrome on your tablet.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
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
                    {isPrinting ? 'Printing...' : 'Test Print'}
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

          {/* RawBT Companion Option for Bluetooth Classic SPP printers */}
          <div className="p-3.5 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                <Smartphone className="h-4 w-4 text-sky-600" />
                Android RawBT Companion Option (Works with ALL Bluetooth Printers)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                If your printer uses Bluetooth Classic SPP or does not show in the BLE list, you can print instantly using the free <strong>RawBT</strong> app from Google Play.
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

          {/* Paper Size & Hardware Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
                Thermal Paper Width
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
                  Automatically send receipt to your Bluetooth thermal printer the moment a sale is completed.
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

          <div className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-md border border-border/60">
            <strong>Android Tablet Tips:</strong> Make sure Bluetooth and Location/Nearby Devices permissions are allowed for Chrome in your Android Tablet Settings. If your printer asks for a PIN when pairing, try <code>0000</code> or <code>1234</code>.
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
    </div>
  );
}
