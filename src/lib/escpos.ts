import { Sale, Business } from '@/types/database.types';
import { ReadingReportData } from '@/lib/export-utils';
import { format, parseISO, isValid } from 'date-fns';

/**
 * ESC/POS Control Codes
 */
export const ESC_POS_CODES = {
  INIT: '\x1B\x40',             // Initialize printer
  ALIGN_LEFT: '\x1B\x61\x00',    // Align left
  ALIGN_CENTER: '\x1B\x61\x01',  // Align center
  ALIGN_RIGHT: '\x1B\x61\x02',   // Align right
  BOLD_ON: '\x1B\x45\x01',       // Bold on
  BOLD_OFF: '\x1B\x45\x00',      // Bold off
  DOUBLE_HEIGHT_ON: '\x1B\x21\x10',
  DOUBLE_WIDTH_ON: '\x1B\x21\x20',
  NORMAL: '\x1B\x21\x00',
  FEED_AND_CUT: '\x1D\x56\x42\x00', // Full cut with feed (80mm auto-cutter only)
  FEED_3_LINES: '\x1B\x64\x03',
};

export type ReceiptPaperWidth = '58mm' | '80mm';

/**
 * Format currency in pure ASCII for thermal receipt printers (e.g. "P15.00" / "P1,250.00")
 * Avoids multi-byte UTF-8 currency symbols (like ₱) that corrupt on thermal Code Page 437.
 */
export function formatThermalMoney(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  const n = isNaN(num) ? 0 : num;
  const parts = n.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `P${intPart}.${parts[1]}`;
}

/**
 * Format date & time in pure ASCII without special middle-dot symbols.
 */
export function formatThermalDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    if (!isValid(d)) return '-';
    return format(d, 'MMM d, yyyy h:mm a');
  } catch {
    return '-';
  }
}

/**
 * Word wrap helper to wrap long sentences neatly between words across column limits.
 */
function wordWrap(text: string, maxCols: number): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxCols) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      if (word.length > maxCols) {
        for (let i = 0; i < word.length; i += maxCols) {
          lines.push(word.substring(i, i + maxCols));
        }
        currentLine = '';
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Centers text within maxCols.
 */
function padBoth(text: string, maxCols: number): string {
  const t = text.trim();
  if (t.length >= maxCols) return t.substring(0, maxCols);
  const leftPad = Math.floor((maxCols - t.length) / 2);
  const rightPad = maxCols - t.length - leftPad;
  return ' '.repeat(leftPad) + t + ' '.repeat(rightPad);
}

/**
 * Left-right justify within maxCols.
 */
function justify(left: string, right: string, maxCols: number): string {
  const l = left.trim();
  const r = right.trim();
  const spaceNeeded = maxCols - l.length - r.length;
  if (spaceNeeded >= 1) {
    return l + ' '.repeat(spaceNeeded) + r;
  }
  const availableLeft = Math.max(1, maxCols - r.length - 1);
  return l.substring(0, availableLeft) + ' ' + r;
}

/**
 * Formats a plain text thermal receipt matching the on-screen preview.
 */
export function generatePlainTextReceipt(
  sale: Sale,
  business?: Business | null,
  width: ReceiptPaperWidth = '58mm'
): string {
  const maxCols = width === '58mm' ? 32 : 48;
  const lineDivider = '-'.repeat(maxCols);
  const doubleDivider = '='.repeat(maxCols);

  const storeName = (business?.name || 'SOX POS STORE').toUpperCase();
  const storeAddress = business?.address || 'General Santos City, SOCCSKSARGEN';
  const storePhone = business?.phone ? `Tel: ${business.phone}` : '';
  const headerNote = business?.receipt_header || 'Salamat sa pagpalit!';
  const footerNote = business?.receipt_footer || 'Salamat sa pagbisita! Please come again.';

  const lines: string[] = [];

  // 1. Store Header
  lines.push(doubleDivider);
  lines.push(padBoth(storeName, maxCols));
  if (storeAddress) {
    wordWrap(storeAddress, maxCols).forEach((l) => lines.push(padBoth(l, maxCols)));
  }
  if (storePhone) lines.push(padBoth(storePhone, maxCols));
  if (headerNote) {
    wordWrap(`"${headerNote}"`, maxCols).forEach((l) => lines.push(padBoth(l, maxCols)));
  }
  lines.push(doubleDivider);

  // 2. Metadata
  lines.push(justify('OR No:', sale.receipt_number, maxCols));
  lines.push(justify('Date/Time:', formatThermalDate(sale.created_at), maxCols));
  lines.push(justify('Cashier:', sale.user_name || 'Staff', maxCols));
  if (sale.payment_reference) {
    lines.push(justify('Ref No:', sale.payment_reference, maxCols));
  }
  lines.push(lineDivider);

  // 3. Column Header
  if (width === '58mm') {
    lines.push(justify('Item / Qty x Price', 'Total', maxCols));
  } else {
    lines.push(
      'ITEM'.padEnd(22) +
      'QTY'.padStart(5) +
      'PRICE'.padStart(10) +
      'TOTAL'.padStart(11)
    );
  }
  lines.push(lineDivider);

  // 4. Line Items
  sale.items?.forEach((item) => {
    const itemTotal = formatThermalMoney(item.subtotal);
    const itemName = item.product_name_snapshot;

    if (width === '58mm') {
      lines.push(itemName);
      lines.push(
        justify(
          `  ${item.quantity} x ${formatThermalMoney(item.unit_price)}`,
          itemTotal,
          maxCols
        )
      );
    } else {
      const priceStr = formatThermalMoney(item.unit_price);
      const shortName = itemName.length > 20 ? itemName.substring(0, 19) + '...' : itemName;
      lines.push(
        shortName.padEnd(22) +
        String(item.quantity).padStart(5) +
        priceStr.padStart(10) +
        itemTotal.padStart(11)
      );
    }
  });

  lines.push(lineDivider);

  // 5. Totals
  lines.push(justify('Subtotal:', formatThermalMoney(sale.subtotal), maxCols));
  if (sale.discount > 0) {
    lines.push(justify('Discount:', `-${formatThermalMoney(sale.discount)}`, maxCols));
  }
  lines.push(doubleDivider);
  lines.push(justify('TOTAL DUE:', formatThermalMoney(sale.total), maxCols));
  lines.push(doubleDivider);

  // 6. Payment Details
  lines.push(justify('Payment Mode:', (sale.payment_method || 'CASH').toUpperCase(), maxCols));
  lines.push(justify('Amount Received:', formatThermalMoney(sale.amount_paid), maxCols));
  lines.push(justify('Change:', formatThermalMoney(sale.change), maxCols));
  lines.push(lineDivider);

  // 7. Barcode & Footer
  lines.push(padBoth('||||| | |||| || ||||| | |||', maxCols));
  lines.push(padBoth(sale.receipt_number, maxCols));
  lines.push(padBoth('*** SALES RECEIPT ***', maxCols));
  if (footerNote) {
    wordWrap(footerNote, maxCols).forEach((l) => lines.push(padBoth(l, maxCols)));
  }
  lines.push(padBoth('Thank you for your visit!', maxCols));
  lines.push('\n\n\n\n');

  return lines.join('\n');
}

/**
 * Encodes text into a Uint8Array byte stream with ESC/POS commands
 */
export function generateEscPosBinary(
  sale: Sale,
  business?: Business | null,
  width: ReceiptPaperWidth = '58mm'
): Uint8Array {
  const plainText = generatePlainTextReceipt(sale, business, width);
  const textEncoder = new TextEncoder();
  const endCommands = width === '80mm' ? '\n\n' + ESC_POS_CODES.FEED_AND_CUT : '\n\n\n\n';
  return textEncoder.encode(
    ESC_POS_CODES.INIT +
    plainText +
    endCommands
  );
}

/**
 * Formats an X or Z reading plain text report suitable for thermal printing
 */
export function generatePlainTextReading(
  report: ReadingReportData,
  width: ReceiptPaperWidth = '58mm'
): string {
  const maxCols = width === '58mm' ? 32 : 48;
  const lineDivider = '-'.repeat(maxCols);
  const doubleDivider = '='.repeat(maxCols);

  const lines: string[] = [];

  lines.push(doubleDivider);
  lines.push(padBoth(report.businessName.toUpperCase(), maxCols));
  lines.push(padBoth(report.title, maxCols));
  lines.push(doubleDivider);

  lines.push(justify('Date/Time:', formatThermalDate(report.generatedAt), maxCols));
  lines.push(justify('Cashier:', report.cashierName, maxCols));
  if (report.shiftStart) {
    lines.push(justify('Shift Started:', formatThermalDate(report.shiftStart), maxCols));
  }
  if (report.shiftEnd) {
    lines.push(justify('Shift Ended:', formatThermalDate(report.shiftEnd), maxCols));
  }
  lines.push(justify('Transactions:', String(report.transactionCount), maxCols));
  lines.push(lineDivider);

  lines.push(justify('Gross Sales:', formatThermalMoney(report.grossSales), maxCols));
  if (report.totalDiscounts > 0) {
    lines.push(justify('Discounts Given:', `-${formatThermalMoney(report.totalDiscounts)}`, maxCols));
  }
  lines.push(doubleDivider);
  lines.push(justify('NET SALES:', formatThermalMoney(report.netSales), maxCols));
  lines.push(doubleDivider);

  lines.push(padBoth('-- PAYMENT BREAKDOWN --', maxCols));
  lines.push(justify('Cash:', formatThermalMoney(report.payments.cash), maxCols));
  lines.push(justify('GCash:', formatThermalMoney(report.payments.gcash), maxCols));
  lines.push(justify('Maya:', formatThermalMoney(report.payments.maya), maxCols));
  if (report.payments.other > 0) {
    lines.push(justify('Other:', formatThermalMoney(report.payments.other), maxCols));
  }
  lines.push(lineDivider);

  lines.push(padBoth('-- CASH DRAWER AUDIT --', maxCols));
  lines.push(justify('Starting Float:', formatThermalMoney(report.startingCash || 0), maxCols));
  lines.push(justify('Cash Sales Added:', `+${formatThermalMoney(report.payments.cash)}`, maxCols));
  lines.push(doubleDivider);
  lines.push(justify('EXPECTED CASH:', formatThermalMoney(report.expectedCashInDrawer || 0), maxCols));
  lines.push(doubleDivider);

  lines.push(padBoth(`*** END OF ${report.type}-READING ***`, maxCols));
  lines.push(padBoth('System Generated Audit Report', maxCols));
  lines.push('\n\n\n\n');

  return lines.join('\n');
}

/**
 * Encodes Reading Report into Uint8Array ESC/POS binary stream
 */
export function generateReadingEscPosBinary(
  report: ReadingReportData,
  width: ReceiptPaperWidth = '58mm'
): Uint8Array {
  const plainText = generatePlainTextReading(report, width);
  const textEncoder = new TextEncoder();
  const endCommands = width === '80mm' ? '\n\n' + ESC_POS_CODES.FEED_AND_CUT : '\n\n\n\n';
  return textEncoder.encode(
    ESC_POS_CODES.INIT +
    plainText +
    endCommands
  );
}

/**
 * Generates a diagnostic Test Print receipt matching the preview
 */
export function generateTestReceiptBinary(
  businessName = 'SOX POS',
  width: ReceiptPaperWidth = '58mm'
): Uint8Array {
  const maxCols = width === '58mm' ? 32 : 48;
  const lineDivider = '-'.repeat(maxCols);
  const doubleDivider = '='.repeat(maxCols);

  const lines: string[] = [
    doubleDivider,
    padBoth(businessName.toUpperCase(), maxCols),
    padBoth('BLUETOOTH PRINTER TEST', maxCols),
    doubleDivider,
    justify('Status:', 'CONNECTED [OK]', maxCols),
    justify('Paper Width:', width, maxCols),
    justify('Column Width:', `${maxCols} Characters`, maxCols),
    justify('Date/Time:', formatThermalDate(new Date().toISOString()), maxCols),
    lineDivider,
    justify('Sample Item 1', formatThermalMoney(120), maxCols),
    justify('  2 x P60.00', formatThermalMoney(120), maxCols),
    justify('Sample Item 2', formatThermalMoney(45), maxCols),
    justify('  1 x P45.00', formatThermalMoney(45), maxCols),
    lineDivider,
    justify('Subtotal:', formatThermalMoney(165), maxCols),
    doubleDivider,
    justify('TOTAL DUE:', formatThermalMoney(165), maxCols),
    doubleDivider,
    justify('Payment Mode:', 'CASH', maxCols),
    justify('Amount Received:', formatThermalMoney(200), maxCols),
    justify('Change:', formatThermalMoney(35), maxCols),
    lineDivider,
    padBoth('||||| | |||| || ||||| | |||', maxCols),
    padBoth('*** TEST RECEIPT SUCCESS ***', maxCols),
    padBoth('RP21UB Thermal Printing Ready', maxCols),
    '\n\n\n\n',
  ];

  const textEncoder = new TextEncoder();
  const endCommands = width === '80mm' ? '\n\n' + ESC_POS_CODES.FEED_AND_CUT : '\n\n\n\n';
  return textEncoder.encode(
    ESC_POS_CODES.INIT +
    lines.join('\n') +
    endCommands
  );
}
