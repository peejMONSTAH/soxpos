import { Sale, Business } from '@/types/database.types';
import { formatPeso, formatDateTime } from '@/lib/formatters';

/**
 * ESC/POS Control Codes
 */
export const ESC_POS_CODES = {
  INIT: '\x1B\x40',          // Initialize printer
  ALIGN_LEFT: '\x1B\x61\x00', // Align left
  ALIGN_CENTER: '\x1B\x61\x01', // Align center
  ALIGN_RIGHT: '\x1B\x61\x02', // Align right
  BOLD_ON: '\x1B\x45\x01',    // Bold on
  BOLD_OFF: '\x1B\x45\x00',   // Bold off
  DOUBLE_HEIGHT_ON: '\x1B\x21\x10',
  DOUBLE_WIDTH_ON: '\x1B\x21\x20',
  NORMAL: '\x1B\x21\x00',
  FEED_AND_CUT: '\x1D\x56\x42\x00', // Full cut with feed
  FEED_3_LINES: '\x1B\x64\x03',
};

export type ReceiptPaperWidth = '58mm' | '80mm';

/**
 * Formats a plain text thermal receipt suitable for 58mm (32 cols) or 80mm (48 cols) printers.
 */
export function generatePlainTextReceipt(
  sale: Sale,
  business?: Business | null,
  width: ReceiptPaperWidth = '80mm'
): string {
  const maxCols = width === '58mm' ? 32 : 48;
  const lineDivider = '-'.repeat(maxCols);
  const doubleDivider = '='.repeat(maxCols);

  const padBoth = (text: string) => {
    if (text.length >= maxCols) return text.substring(0, maxCols);
    const leftPad = Math.floor((maxCols - text.length) / 2);
    const rightPad = maxCols - text.length - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  };

  const justify = (left: string, right: string) => {
    const space = maxCols - left.length - right.length;
    if (space < 1) {
      return left.substring(0, maxCols - right.length - 1) + ' ' + right;
    }
    return left + ' '.repeat(space) + right;
  };

  const storeName = (business?.name || 'POS STORE').toUpperCase();
  const storeAddress = business?.address || 'General Santos City, SOCCSKSARGEN';
  const storePhone = business?.phone ? `Tel: ${business.phone}` : '';
  const headerNote = business?.receipt_header || 'Salamat sa pagpalit!';
  const footerNote = business?.receipt_footer || 'Salamat sa pagbisita! Please come again.';

  const lines: string[] = [];

  // Header
  lines.push(padBoth(storeName));
  if (storeAddress) lines.push(padBoth(storeAddress));
  if (storePhone) lines.push(padBoth(storePhone));
  if (headerNote) lines.push(padBoth(headerNote));
  lines.push(doubleDivider);

  // Metadata
  lines.push(justify('Receipt #:', sale.receipt_number));
  lines.push(justify('Date:', formatDateTime(sale.created_at)));
  lines.push(justify('Cashier:', sale.user_name || 'Staff'));
  if (sale.payment_reference) {
    lines.push(justify('Ref #:', sale.payment_reference));
  }
  lines.push(lineDivider);

  // Column Headers
  if (width === '58mm') {
    lines.push(justify('Item / Qty x Price', 'Total'));
  } else {
    // 80mm table header
    lines.push(
      'ITEM'.padEnd(22) +
      'QTY'.padStart(5) +
      'PRICE'.padStart(10) +
      'TOTAL'.padStart(11)
    );
  }
  lines.push(lineDivider);

  // Items
  sale.items?.forEach((item) => {
    const itemTotal = formatPeso(item.subtotal);
    const itemName = item.product_name_snapshot;

    if (width === '58mm') {
      lines.push(itemName);
      lines.push(
        justify(
          `  ${item.quantity} x ${formatPeso(item.unit_price)}`,
          itemTotal
        )
      );
    } else {
      const priceStr = formatPeso(item.unit_price);
      const shortName = itemName.length > 20 ? itemName.substring(0, 19) + '…' : itemName;
      lines.push(
        shortName.padEnd(22) +
        String(item.quantity).padStart(5) +
        priceStr.padStart(10) +
        itemTotal.padStart(11)
      );
    }
  });

  lines.push(lineDivider);

  // Totals
  lines.push(justify('Subtotal:', formatPeso(sale.subtotal)));
  if (sale.discount > 0) {
    lines.push(justify('Discount:', `-${formatPeso(sale.discount)}`));
  }
  lines.push(doubleDivider);
  lines.push(justify('TOTAL:', formatPeso(sale.total)));
  lines.push(doubleDivider);

  // Payment
  lines.push(justify('Payment Mode:', (sale.payment_method || 'cash').toUpperCase()));
  lines.push(justify('Amount Paid:', formatPeso(sale.amount_paid)));
  lines.push(justify('Change:', formatPeso(sale.change)));
  lines.push(lineDivider);

  // Footer
  lines.push(padBoth('*** SALES RECEIPT ***'));
  if (footerNote) lines.push(padBoth(footerNote));
  lines.push(padBoth('Please come again!'));
  lines.push('\n\n');

  return lines.join('\n');
}

/**
 * Encodes text into a Uint8Array byte stream with ESC/POS commands
 */
export function generateEscPosBinary(
  sale: Sale,
  business?: Business | null,
  width: ReceiptPaperWidth = '80mm'
): Uint8Array {
  const plainText = generatePlainTextReceipt(sale, business, width);
  const textEncoder = new TextEncoder();
  const rawBytes = textEncoder.encode(
    ESC_POS_CODES.INIT +
    plainText +
    ESC_POS_CODES.FEED_AND_CUT
  );
  return rawBytes;
}
