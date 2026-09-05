import { BusinessProfile, Invoice } from '../types';
import { POWERED_BY } from '../data/defaultData';

/**
 * Normalizes Sri Lankan and international phone numbers for WhatsApp wa.me links
 * e.g. 077 123 4567 -> 94771234567
 */
export function normalizeWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  // Strip spaces, dashes, parentheses
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // If local Sri Lankan 10 digit (07XXXXXXXX), replace 0 with 94
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '94' + cleaned.substring(1);
  } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    cleaned = '94' + cleaned;
  }
  return cleaned;
}

/**
 * Generates a beautifully formatted WhatsApp receipt message with bolding and emojis
 */
export function generateWhatsAppReceiptText(
  invoice: Invoice,
  business: BusinessProfile
): string {
  const isEnglish = invoice.receiptLanguage === 'en';
  const currency = business.currencySymbol || 'Rs.';

  const lines: string[] = [];

  // Header
  lines.push(`📱 *${business.name}*`);
  if (!isEnglish && business.sinhalaName && business.showSinhalaName !== false) {
    lines.push(`   _${business.sinhalaName}_`);
  }
  if (business.tagline && business.showTagline !== false) {
    lines.push(`✨ ${business.tagline}`);
  }
  if (business.address && business.showAddress !== false) {
    lines.push(`📍 ${business.address}`);
  }
  if ((business.phone || business.mobile) && business.showPhone !== false) {
    lines.push(`📞 Tel: ${business.phone || business.mobile}`);
  }

  lines.push('──────────────────────');
  lines.push(`🧾 *${isEnglish ? 'Invoice No:' : 'බිල්පත් අංකය:'}* ${invoice.invoiceNumber}`);
  lines.push(`📅 *${isEnglish ? 'Date:' : 'දිනය:'}* ${invoice.date} • ${invoice.time}`);

  if (invoice.customerName && business.showCustomerInfo !== false) {
    lines.push(
      `👤 *${isEnglish ? 'Customer:' : 'පාරිභෝගිකයා:'}* ${invoice.customerName}${
        invoice.customerPhone ? ` (${invoice.customerPhone})` : ''
      }`
    );
  }
  if (invoice.cashierName && business.showCashier !== false) {
    lines.push(`👨‍💼 *${isEnglish ? 'Cashier:' : 'අයකැමි:'}* ${invoice.cashierName}`);
  }

  lines.push('──────────────────────');
  lines.push(`🛍️ *${isEnglish ? 'Purchased Items:' : 'භාණ්ඩ විස්තරය:'}*`);

  invoice.items.forEach((item, index) => {
    const itemName =
      !isEnglish && item.sinhalaName && business.showItemSinhalaName !== false
        ? `${item.sinhalaName} (${item.name})`
        : item.name;

    lines.push(`${index + 1}. *${itemName}*`);
    let qtyPriceLine = `   ${item.quantity} ${item.unit} x ${currency} ${item.price.toFixed(2)} = *${currency} ${item.total.toFixed(2)}*`;
    if (item.discount > 0 && business.showDiscounts !== false) {
      qtyPriceLine += ` _(-${item.discount}${item.discountType === 'percentage' ? '%' : ''} Off)_`;
    }
    lines.push(qtyPriceLine);
  });

  lines.push('──────────────────────');
  lines.push(`*${isEnglish ? 'Subtotal:' : 'උප එකතුව:'}* ${currency} ${invoice.subtotal.toFixed(2)}`);

  if (invoice.discountTotal > 0 && business.showDiscounts !== false) {
    lines.push(`*${isEnglish ? 'Total Discount:' : 'මුළු වට්ටම:'}* -${currency} ${invoice.discountTotal.toFixed(2)}`);
  }

  if (invoice.taxAmount > 0 && business.showTax !== false) {
    lines.push(`*${isEnglish ? `Tax (${invoice.taxRate}%):` : `බදු (${invoice.taxRate}%):`}* ${currency} ${invoice.taxAmount.toFixed(2)}`);
  }

  lines.push(`💰 *${isEnglish ? 'GRAND TOTAL:' : 'මුළු එකතුව:'}* *${currency} ${invoice.grandTotal.toFixed(2)}*`);

  if (business.showPaymentDetails !== false) {
    const paymentLabel =
      invoice.paymentMethod === 'cash'
        ? (isEnglish ? 'Cash' : 'මුදල් (Cash)')
        : invoice.paymentMethod === 'card'
        ? (isEnglish ? 'Card' : 'කාඩ්පත් (Card)')
        : invoice.paymentMethod === 'transfer'
        ? (isEnglish ? 'Transfer / QR' : 'බැංකු / QR (Transfer)')
        : (isEnglish ? 'Credit' : 'ණය (Credit)');

    lines.push(`💳 *${isEnglish ? 'Paid Via:' : 'ගෙවූ ක්‍රමය:'}* ${paymentLabel} (${currency} ${invoice.paidAmount.toFixed(2)})`);

    if (invoice.changeAmount > 0) {
      lines.push(`💵 *${isEnglish ? 'Balance / Change:' : 'ඉතිරි මුදල:'}* ${currency} ${invoice.changeAmount.toFixed(2)}`);
    }
  }

  if (invoice.notes) {
    lines.push('──────────────────────');
    lines.push(`📝 *${isEnglish ? 'Notes / Warranty:' : 'සටහන් / වගකීම්:'}*`);
    lines.push(`   ${invoice.notes}`);
  }

  if (business.showWarrantyPolicy !== false && business.warrantyPolicyText) {
    lines.push(`ℹ️ _${business.warrantyPolicyText}_`);
  }

  lines.push('──────────────────────');
  if (business.receiptFooter) {
    lines.push(`🙏 *${business.receiptFooter}*`);
  }
  lines.push(`⚡ *${POWERED_BY}*`);

  return lines.join('\n');
}

/**
 * Creates a direct WhatsApp URL to send the invoice
 */
export function createWhatsAppShareUrl(
  invoice: Invoice,
  business: BusinessProfile,
  customPhone?: string
): { url: string; text: string; cleanNumber: string } {
  const text = generateWhatsAppReceiptText(invoice, business);
  const targetPhone = customPhone || invoice.customerPhone || '';
  const cleanNumber = normalizeWhatsAppNumber(targetPhone);

  const encodedText = encodeURIComponent(text);
  const url = cleanNumber
    ? `https://wa.me/${cleanNumber}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  return { url, text, cleanNumber };
}
