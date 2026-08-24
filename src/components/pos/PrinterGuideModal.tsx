'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Printer,
  Bluetooth,
  Smartphone,
  Share2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Apple,
  Radio,
} from 'lucide-react';
import { isIOS, isAndroid, getBrowserName, isWebBluetoothSupported } from '@/lib/platform';

interface PrinterGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrinterGuideModal({ isOpen, onClose }: PrinterGuideModalProps) {
  const ios = typeof window !== 'undefined' && isIOS();
  const android = typeof window !== 'undefined' && isAndroid();
  const bluetoothSupported = typeof window !== 'undefined' && isWebBluetoothSupported();
  const browser = typeof window !== 'undefined' ? getBrowserName() : 'Browser';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Printer className="h-5 w-5 text-emerald-600" />
            Thermal Printer & Device Setup Guide
          </DialogTitle>
          <DialogDescription className="text-xs">
            How to print receipts on iOS (iPhone / iPad), Android, and Desktop browsers.
          </DialogDescription>
        </DialogHeader>

        {/* Current Environment Badge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border border-border text-xs">
          <div className="flex items-center gap-2">
            <Radio className={`h-4 w-4 ${bluetoothSupported ? 'text-emerald-600 animate-pulse' : 'text-amber-500'}`} />
            <div>
              <span className="font-semibold text-foreground">Detected: </span>
              <span className="text-muted-foreground">{ios ? 'Apple iOS' : android ? 'Android' : 'Desktop'} ({browser})</span>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${bluetoothSupported ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
            {bluetoothSupported ? 'Web Bluetooth Active' : 'AirPrint / System Mode'}
          </span>
        </div>

        <div className="space-y-4 text-xs">
          {/* iOS Section */}
          <div className={`p-4 rounded-xl border transition-all ${ios ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' : 'bg-card border-border'}`}>
            <div className="flex items-center gap-2 font-bold text-sm text-foreground mb-2">
              <span className="p-1 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                <Apple className="h-4 w-4" />
              </span>
              iOS (iPhone & iPad) Printing Options
            </div>

            <p className="text-muted-foreground mb-3 text-[11px] leading-relaxed">
              Apple enforces WebKit on Safari and Chrome for iOS, which restricts the browser from scanning Bluetooth directly. Here are the 2 ways to print:
            </p>

            <div className="space-y-2.5">
              <div className="p-2.5 rounded-lg bg-background border border-border/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Option 1: AirPrint / System Print (Recommended)
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">1-Tap</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tap <strong>&ldquo;Print Receipt (System / AirPrint)&rdquo;</strong> in the receipt dialog. Works instantly with AirPrint thermal receipt printers, network printers, or standard printers.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-background border border-border/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Bluetooth className="h-3.5 w-3.5 text-sky-600" />
                    Option 2: Direct Bluetooth BLE via &ldquo;Bluefy&rdquo; Browser
                  </span>
                  <span className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300 px-1.5 py-0.5 rounded font-bold">Direct BLE</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  If you have a portable Bluetooth thermal printer (POS-58, GOOJPRT, Xprinter, etc.) and want direct ESC/POS Bluetooth printing on iPad/iPhone:
                </p>
                <ol className="list-decimal list-inside text-[11px] text-muted-foreground pl-1 space-y-0.5 mt-1">
                  <li>Install the free <strong>Bluefy – Web BLE Browser</strong> from the iOS App Store.</li>
                  <li>Open your POS website URL inside Bluefy.</li>
                  <li>Direct Web Bluetooth will work immediately!</li>
                </ol>
              </div>

              <div className="p-2.5 rounded-lg bg-background border border-border/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5 text-purple-600" />
                    Option 3: Share Receipt (AirDrop / Messenger / Printer Apps)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tap <strong>&ldquo;Share Receipt&rdquo;</strong> to send the digital receipt text to WhatsApp, Viber, Notes, or 3rd-party iOS thermal printer apps.
                </p>
              </div>
            </div>
          </div>

          {/* Android Section */}
          <div className={`p-4 rounded-xl border transition-all ${android ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' : 'bg-card border-border'}`}>
            <div className="flex items-center gap-2 font-bold text-sm text-foreground mb-2">
              <span className="p-1 rounded-md bg-emerald-600 text-white">
                <Smartphone className="h-4 w-4" />
              </span>
              Android Printing Options
            </div>

            <div className="space-y-2.5">
              <div className="p-2.5 rounded-lg bg-background border border-border/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Bluetooth className="h-3.5 w-3.5 text-emerald-600" />
                    Option 1: Direct Web Bluetooth (Chrome / Edge)
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">Fastest</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Open your POS over HTTPS in Google Chrome or Edge. Tap <strong>&ldquo;Connect & Print Bluetooth&rdquo;</strong> to pair your thermal printer directly.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-background border border-border/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Printer className="h-3.5 w-3.5 text-sky-600" />
                    Option 2: RawBT Companion App (Bluetooth Classic SPP & USB)
                  </span>
                  <span className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300 px-1.5 py-0.5 rounded font-bold">Universal</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  If your printer uses Bluetooth Classic SPP or USB OTG, install the free <strong>RawBT</strong> app from Google Play, pair it in Android Bluetooth settings, and tap &ldquo;RawBT Android&rdquo;.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="default"
            onClick={onClose}
            className="w-full font-bold text-xs"
          >
            Got it, Back to POS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
