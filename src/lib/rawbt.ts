/**
 * RawBT Android Driver & URL Scheme Protocol
 * RawBT is the standard bridge on Android for printing raw ESC/POS binary data
 * to Bluetooth Classic (SPP), Bluetooth Low Energy (BLE), and USB thermal printers.
 */

import { Sale, Business } from '@/types/database.types';
import { generateEscPosBinary, generateReadingEscPosBinary, generateTestReceiptBinary, ReceiptPaperWidth } from './escpos';
import { ReadingReportData } from './export-utils';

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Send raw ESC/POS binary data to RawBT app on Android
 */
export function printViaRawBT(bytes: Uint8Array): void {
  const base64Data = uint8ArrayToBase64(bytes);
  const rawbtUrl = `rawbt:data:base64,${base64Data}`;
  window.location.href = rawbtUrl;
}

/**
 * Print a receipt via RawBT Android Intent
 */
export function printReceiptViaRawBT(
  sale: Sale,
  business?: Business | null,
  width: ReceiptPaperWidth = '80mm'
): void {
  const bytes = generateEscPosBinary(sale, business, width);
  printViaRawBT(bytes);
}

/**
 * Print an X/Z reading report via RawBT Android Intent
 */
export function printReadingViaRawBT(
  report: ReadingReportData,
  width: ReceiptPaperWidth = '80mm'
): void {
  const bytes = generateReadingEscPosBinary(report, width);
  printViaRawBT(bytes);
}

/**
 * Print a test receipt via RawBT
 */
export function printTestViaRawBT(
  businessName = 'SOX POS',
  width: ReceiptPaperWidth = '80mm'
): void {
  const bytes = generateTestReceiptBinary(businessName, width);
  printViaRawBT(bytes);
}
