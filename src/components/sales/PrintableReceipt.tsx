'use client';

import React from 'react';
import { Sale, Business } from '@/types/database.types';
import { formatPeso, formatDateTime } from '@/lib/formatters';

export type ReceiptWidth = '58mm' | '80mm';

interface PrintableReceiptProps {
  sale: Sale;
  business?: Business | null;
  paperWidth?: ReceiptWidth;
}

export const PrintableReceipt = React.forwardRef<HTMLDivElement, PrintableReceiptProps>(
  ({ sale, business, paperWidth = '80mm' }, ref) => {
    const storeName = business?.name || 'POS STORE';
    const storeAddress = business?.address || 'General Santos City, SOCCSKSARGEN';
    const storePhone = business?.phone || '';
    const headerNote = business?.receipt_header || 'Salamat sa pagpalit!';
    const footerNote = business?.receipt_footer || 'Salamat sa pagbisita! Please come again.';

    const is58mm = paperWidth === '58mm';
    const containerWidthClass = is58mm ? 'max-w-[240px] text-[10px]' : 'max-w-[340px] text-xs';

    return (
      <div
        ref={ref}
        className={`printable-receipt-container bg-white text-black p-3.5 font-mono ${containerWidthClass} mx-auto border border-dashed border-gray-300 shadow-sm rounded-none print:shadow-none print:border-none print:p-0`}
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* Store Header */}
        <div className="text-center pb-2.5 border-b border-dashed border-gray-400">
          <h2 className={`font-bold tracking-tight uppercase ${is58mm ? 'text-xs' : 'text-sm'}`}>
            {storeName}
          </h2>
          {storeAddress && (
            <p className="text-[10px] leading-tight text-gray-700 mt-0.5">{storeAddress}</p>
          )}
          {storePhone && <p className="text-[10px] text-gray-700">Tel: {storePhone}</p>}
          {headerNote && (
            <p className="text-[9px] italic mt-1 text-gray-600 font-sans">&ldquo;{headerNote}&rdquo;</p>
          )}
        </div>

        {/* Transaction Metadata */}
        <div className="py-2 text-[10px] border-b border-dashed border-gray-400 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-600">OR No:</span>
            <span className="font-bold">{sale.receipt_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date/Time:</span>
            <span>{formatDateTime(sale.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Cashier:</span>
            <span>{sale.user_name || 'Staff'}</span>
          </div>
          {sale.payment_reference && (
            <div className="flex justify-between">
              <span className="text-gray-600">Ref No:</span>
              <span className="font-bold">{sale.payment_reference}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="py-2 border-b border-dashed border-gray-400">
          <table className="w-full text-left text-[10px]">
            <thead>
              <tr className="border-b border-gray-300 text-gray-600">
                <th className="pb-1 font-semibold">Item</th>
                <th className="pb-1 text-center font-semibold">Qty</th>
                <th className="pb-1 text-right font-semibold">Price</th>
                <th className="pb-1 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sale.items?.map((item, idx) => (
                <tr key={idx} className="py-0.5">
                  <td className="py-1 pr-1 font-sans leading-snug">
                    <div className="font-medium text-black">{item.product_name_snapshot}</div>
                  </td>
                  <td className="py-1 text-center font-mono align-top">{item.quantity}</td>
                  <td className="py-1 text-right font-mono align-top text-gray-700">
                    {formatPeso(item.unit_price)}
                  </td>
                  <td className="py-1 text-right font-bold font-mono align-top">
                    {formatPeso(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="py-2 text-[10px] border-b border-dashed border-gray-400 space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatPeso(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-red-700">
              <span>Discount:</span>
              <span>-{formatPeso(sale.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs sm:text-sm font-bold pt-1 border-t border-gray-300">
            <span>TOTAL DUE:</span>
            <span className="font-black text-black">{formatPeso(sale.total)}</span>
          </div>
        </div>

        {/* Payment Details */}
        <div className="py-2 text-[10px] border-b border-dashed border-gray-400 space-y-0.5">
          <div className="flex justify-between uppercase">
            <span>Payment Mode:</span>
            <span className="font-bold">{sale.payment_method}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount Received:</span>
            <span>{formatPeso(sale.amount_paid)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Change:</span>
            <span>{formatPeso(sale.change)}</span>
          </div>
        </div>

        {/* Barcode & Footer */}
        <div className="text-center pt-2.5 text-[9px] text-gray-700 space-y-1">
          {/* Simulated thermal barcode */}
          <div className="flex flex-col items-center justify-center py-1">
            <div className="tracking-[4px] font-mono text-xs font-bold scale-y-125 select-none">
              ||||| | |||| || ||||| | |||
            </div>
            <span className="text-[8px] text-gray-500 font-mono mt-0.5">{sale.receipt_number}</span>
          </div>

          <p className="font-bold text-[10px] text-black">*** SALES RECEIPT ***</p>
          {footerNote && <p className="leading-tight">{footerNote}</p>}
          <p className="text-[8px] text-gray-400 pt-0.5">Thank you for your visit!</p>
        </div>
      </div>
    );
  }
);

PrintableReceipt.displayName = 'PrintableReceipt';
