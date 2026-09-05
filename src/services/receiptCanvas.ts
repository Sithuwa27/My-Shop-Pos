import QRCode from 'qrcode';
import { BusinessProfile, Invoice } from '../types';
import { EscPosBuilder } from './escpos';
import { POWERED_BY } from '../data/defaultData';

/**
 * Renders the invoice to an HTML Canvas element at thermal printer resolution:
 * 58mm = 384 dots width
 * 80mm = 576 dots width
 */
async function loadReceiptLogo(dataUrl: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Logo could not be loaded'));
      img.src = dataUrl;
    });
    return img;
  } catch {
    return null;
  }
}

export async function renderReceiptToCanvas(
  invoice: Invoice,
  business: BusinessProfile
): Promise<HTMLCanvasElement> {
  const is58mm = business.paperWidth === '58mm';
  const width = is58mm ? 384 : 576;
  const padding = is58mm ? 12 : 24;
  const isEnglish = (invoice.receiptLanguage || business.receiptLanguage) === 'en';
  const isHeaderLeft = business.headerAlignment === 'left';
  const headerX = isHeaderLeft ? padding : width / 2;
  const headerAlign: CanvasTextAlign = isHeaderLeft ? 'left' : 'center';

  // Continuous font scale multiplier
  const fontScale = business.receiptFontScale
    ? business.receiptFontScale / 100
    : business.receiptFontSize === 'small'
    ? 0.85
    : business.receiptFontSize === 'large'
    ? 1.2
    : business.receiptFontSize === 'xlarge'
    ? 1.35
    : business.receiptFontSize === 'xxlarge'
    ? 1.5
    : 1.0;

  // Selected Font Family string
  const selectedFamily = business.receiptFontFamily || 'monospace';
  let fontNameStack = '"Courier Prime", "Courier New", monospace, "Noto Sans Sinhala", sans-serif';
  if (selectedFamily === 'sans') {
    fontNameStack = '"Plus Jakarta Sans", "Noto Sans Sinhala", -apple-system, sans-serif';
  } else if (selectedFamily === 'sinhala') {
    fontNameStack = '"Noto Sans Sinhala", "Plus Jakarta Sans", sans-serif';
  } else if (selectedFamily === 'serif') {
    fontNameStack = 'Georgia, "Times New Roman", serif, "Noto Sans Sinhala"';
  } else if (selectedFamily === 'ticket') {
    fontNameStack = '"Courier Prime", monospace, sans-serif';
  }

  // Create a deliberately generous working canvas.
  // We crop it to the exact last ink row at the end, so this prevents clipping
  // on long bills while still avoiding blank paper after the receipt.
  const logo = business.logoDataUrl && business.showLogo !== false ? await loadReceiptLogo(business.logoDataUrl) : null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  const itemLines = invoice.items.length * (business.showItemBarcode !== false ? 16 : 0);
  const logoHeight = logo ? Math.round(150 * fontScale) : 0;
  const estimatedHeight = Math.max(2200, Math.round(1900 + logoHeight + invoice.items.reduce((sum, item) => sum + Math.max(1, Math.ceil(item.name.length / (business.paperWidth === '58mm' ? 22 : 34))) * 35, 0) + itemLines + (business.showQrCode ? 220 : 0)) * Math.max(1, fontScale));
  canvas.height = estimatedHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Thermal paper background (white)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, canvas.height);

  // High-contrast pure black text for thermal printing
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = Math.round(20 * fontScale);

  // Scaled Fonts setup
  const sDisplay = Math.round(26 * fontScale);
  const sSubhead = Math.round(19 * fontScale);
  const sBody = Math.round(16 * fontScale);
  const sBodyBold = Math.round(16 * fontScale);
  const sSmall = Math.round(13 * fontScale);
  const sLargeBold = Math.round(22 * fontScale);
  const lineSpacing = business.receiptLineSpacing === 'compact' ? 0.82 : business.receiptLineSpacing === 'spacious' ? 1.25 : 1;
  const gap = (n:number) => Math.round(n * fontScale * lineSpacing);

  const fontDisplay = `bold ${sDisplay}px ${fontNameStack}`;
  const fontSubhead = `bold ${sSubhead}px ${fontNameStack}`;
  const fontBody = `${sBody}px ${fontNameStack}`;
  const fontBodyBold = `bold ${sBodyBold}px ${fontNameStack}`;
  const fontSmall = `${sSmall}px ${fontNameStack}`;
  const fontLargeBold = `bold ${sLargeBold}px ${fontNameStack}`;

  // Draw optional logo above the receipt header.
  if (logo) {
    const maxLogoW = is58mm ? width * 0.42 : width * 0.34;
    const maxLogoH = Math.round(110 * fontScale);
    const ratio = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
    const logoW = Math.max(1, Math.round(logo.width * ratio));
    const logoH = Math.max(1, Math.round(logo.height * ratio));
    const logoX = isHeaderLeft ? padding : Math.round((width - logoW) / 2);
    ctx.drawImage(logo, logoX, y, logoW, logoH);
    y += logoH + gap(12);
  }

  // Draw Header
  ctx.textAlign = headerAlign;
  ctx.font = fontDisplay;
  ctx.fillText(business.name, headerX, y);
  y += gap(32);

  if (!isEnglish && business.sinhalaName && business.showSinhalaName !== false) {
    ctx.font = fontSubhead;
    ctx.fillText(business.sinhalaName, headerX, y);
    y += gap(26);
  }

  ctx.font = fontSmall;
  if (business.tagline && business.showTagline !== false) {
    ctx.fillText(business.tagline, headerX, y);
    y += gap(18);
  }
  if (business.address && business.showAddress !== false) {
    ctx.fillText(business.address, headerX, y);
    y += gap(18);
  }
  if ((business.phone || business.mobile) && business.showPhone !== false) {
    ctx.fillText(`Tel: ${business.phone || business.mobile}`, headerX, y);
    y += gap(18);
  }
  if (business.taxOrRegNumber && business.showTaxNumber !== false) {
    ctx.fillText(business.taxOrRegNumber, headerX, y);
    y += gap(18);
  }
  if (business.receiptHeader) {
    ctx.font = fontBodyBold;
    ctx.fillText(business.receiptHeader, headerX, y);
    ctx.font = fontSmall;
    y += gap(20);
  }

  y += gap(8);
  // Divider double line
  drawDashedLine(ctx, padding, y, width - padding, '=');
  y += gap(16);

  // Invoice Details
  if (business.showDateTime !== false || business.showCashier !== false) {
    ctx.textAlign = 'left';
    ctx.font = fontSmall;
    ctx.fillText(isEnglish ? `Invoice: ${invoice.invoiceNumber}` : `බිල්පත් අංකය: ${invoice.invoiceNumber}`, padding, y);
    if (business.showDateTime !== false) {
      ctx.textAlign = 'right';
      ctx.fillText(isEnglish ? `Date: ${invoice.date}` : `දිනය: ${invoice.date}`, width - padding, y);
    }
    y += gap(18);

    if (business.showDateTime !== false || business.showCashier !== false) {
      ctx.textAlign = 'left';
      if (business.showDateTime !== false) ctx.fillText(isEnglish ? `Time: ${invoice.time}` : `වේලාව: ${invoice.time}`, padding, y);
      if (business.showCashier !== false) {
        ctx.textAlign = 'right';
        ctx.fillText(isEnglish ? `Cashier: ${invoice.cashierName || 'Cashier 01'}` : `අයකැමි: ${invoice.cashierName || 'Cashier 01'}`, width - padding, y);
      }
      y += gap(18);
    }
  }

  if (invoice.customerName && business.showCustomerInfo !== false) {
    ctx.textAlign = 'left';
    ctx.font = fontSmall;
    ctx.fillText(isEnglish ? `Customer: ${invoice.customerName}` : `පාරිභෝගිකයා: ${invoice.customerName}`, padding, y);
    if (invoice.customerPhone) {
      ctx.textAlign = 'right';
      ctx.fillText(`Tel: ${invoice.customerPhone}`, width - padding, y);
    }
    y += gap(18);
  }

  y += Math.round(6 * fontScale);
  drawDashedLine(ctx, padding, y, width - padding, '-');
  y += gap(14);

  // Table Header
  ctx.font = fontBodyBold;
  ctx.textAlign = 'left';
  ctx.fillText(isEnglish ? 'ITEM' : 'භාණ්ඩය (Item)', padding, y);
  ctx.textAlign = 'center';
  ctx.fillText(isEnglish ? 'QTY' : 'ප්‍රමාණය', width * 0.62, y);
  ctx.textAlign = 'right';
  ctx.fillText(isEnglish ? 'AMOUNT' : 'මුදල', width - padding, y);
  y += gap(20);

  drawDashedLine(ctx, padding, y, width - padding, '-');
  y += gap(14);

  // Items List
  for (const item of invoice.items) {
    ctx.font = fontBodyBold;
    ctx.textAlign = 'left';
    const itemName = isEnglish
      ? item.name
      : item.sinhalaName && business.showItemSinhalaName !== false
      ? `${item.sinhalaName} (${item.name})`
      : item.name;

    // Wrap long item names onto additional lines instead of truncating/overlapping.
    const itemNameWidth = is58mm ? width * 0.50 : width * 0.55;
    const nameLines = wrapText(ctx, itemName, itemNameWidth);
    const firstLineY = y;
    nameLines.forEach((line, lineIndex) => {
      ctx.textAlign = 'left';
      ctx.fillText(line, padding, y);
      if (lineIndex < nameLines.length - 1) y += gap(18);
    });

    // Qty and Total stay aligned with the first item-name line.
    ctx.font = fontBody;
    ctx.textAlign = 'center';
    ctx.fillText(`${item.quantity} ${item.unit}`, width * 0.62, firstLineY);
    ctx.textAlign = 'right';
    ctx.fillText(`${business.currencySymbol} ${item.total.toFixed(2)}`, width - padding, firstLineY);
    y = Math.max(y, firstLineY) + gap(18);

    // Barcode line
    if (business.showItemBarcode !== false && item.barcode) {
      ctx.font = fontSmall;
      ctx.textAlign = 'left';
      ctx.fillText(`Barcode: ${item.barcode}`, padding, y);
      y += gap(16);
    }

    // Unit price details
    if (business.showItemUnitPrice !== false) {
      ctx.font = fontSmall;
      ctx.textAlign = 'left';
      let detailText = `@ ${business.currencySymbol} ${item.price.toFixed(2)}`;
      if (item.discount > 0 && business.showDiscounts !== false) {
        detailText += ` (-${item.discount}${item.discountType === 'percentage' ? '%' : ''} off)`;
      }
      ctx.fillText(`   ${detailText}`, padding, y);
      y += gap(20);
    }
  }

  y += Math.round(4 * fontScale);

  // Repair details: print every repair field as its own wrapped line so nothing overlaps.
  if (invoice.repairJobNumber || invoice.repairDevice || invoice.repairIssue || invoice.repairAdvance !== undefined) {
    drawDashedLine(ctx, padding, y, width - padding, '-');
    y += gap(14);
    ctx.font = fontBodyBold;
    ctx.textAlign = 'left';
    ctx.fillText('REPAIR DETAILS', padding, y);
    y += gap(22);

    const repairRows: Array<[string, string]> = [];
    if (invoice.repairJobNumber) repairRows.push(['Job No:', invoice.repairJobNumber]);
    if (invoice.repairDevice) repairRows.push(['Device:', invoice.repairDevice]);
    if (invoice.repairImei) repairRows.push(['IMEI / Serial:', invoice.repairImei]);
    if (invoice.repairIssue) repairRows.push(['Issue:', invoice.repairIssue]);
    if (invoice.repairDiagnosis) repairRows.push(['Diagnosis:', invoice.repairDiagnosis]);
    if (invoice.repairEstimate !== undefined) repairRows.push(['Estimate:', `${business.currencySymbol} ${invoice.repairEstimate.toFixed(2)}`]);
    if (invoice.repairAdvance !== undefined) repairRows.push(['Advance Paid:', `${business.currencySymbol} ${invoice.repairAdvance.toFixed(2)}`]);
    if (invoice.repairBalance !== undefined) repairRows.push(['Balance Due:', `${business.currencySymbol} ${invoice.repairBalance.toFixed(2)}`]);

    for (const [label, value] of repairRows) {
      ctx.font = fontBody;
      const labelWidth = width * 0.34;
      const valueLines = wrapText(ctx, value, width - padding * 2 - labelWidth);
      ctx.textAlign = 'left';
      ctx.font = fontBodyBold;
      ctx.fillText(label, padding, y);
      ctx.font = fontBody;
      valueLines.forEach((line, idx) => {
        ctx.fillText(line, padding + labelWidth, y);
        if (idx < valueLines.length - 1) y += gap(18);
      });
      y += gap(20);
    }
  }

  drawDashedLine(ctx, padding, y, width - padding, '-');
  y += gap(14);

  // Totals Section
  ctx.font = fontBody;
  ctx.textAlign = 'left';
  ctx.fillText(isEnglish ? 'Subtotal:' : 'උප එකතුව (Subtotal):', padding, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${business.currencySymbol} ${invoice.subtotal.toFixed(2)}`, width - padding, y);
  y += gap(20);

  if (invoice.discountTotal > 0 && business.showDiscounts !== false) {
    ctx.textAlign = 'left';
    ctx.fillText(isEnglish ? 'Discount:' : 'මුළු වට්ටම (Discount):', padding, y);
    ctx.textAlign = 'right';
    ctx.fillText(`-${business.currencySymbol} ${invoice.discountTotal.toFixed(2)}`, width - padding, y);
    y += gap(20);
  }

  if (invoice.taxAmount > 0 && business.showTax !== false) {
    ctx.textAlign = 'left';
    ctx.fillText(isEnglish ? `Tax (${invoice.taxRate}%):` : `බදු (Tax ${invoice.taxRate}%):`, padding, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${business.currencySymbol} ${invoice.taxAmount.toFixed(2)}`, width - padding, y);
    y += gap(20);
  }

  if (invoice.serviceCharge > 0 && business.showTax !== false) {
    ctx.textAlign = 'left';
    ctx.fillText(isEnglish ? 'Service Charge:' : 'සේවා ගාස්තු (Service):', padding, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${business.currencySymbol} ${invoice.serviceCharge.toFixed(2)}`, width - padding, y);
    y += gap(20);
  }

  drawDashedLine(ctx, padding, y, width - padding, '=');
  y += gap(14);

  // Grand Total in Large Bold
  ctx.font = fontLargeBold;
  ctx.textAlign = 'left';
  ctx.fillText(isEnglish ? 'GRAND TOTAL:' : 'මුළු එකතුව:', padding, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${business.currencySymbol} ${invoice.grandTotal.toFixed(2)}`, width - padding, y);
  y += gap(28);

  drawDashedLine(ctx, padding, y, width - padding, '-');
  y += gap(14);

  // Payment Breakdown
  if (business.showPaymentDetails !== false) {
    ctx.font = fontBody;
    ctx.textAlign = 'left';
    const payMethodName = invoice.paymentMethod.toUpperCase();
    const payLabel = isEnglish
      ? `Payment (${payMethodName}):`
      : invoice.paymentMethod === 'cash'
      ? 'ගෙවීම් ක්‍රමය (මුදල්/Cash):'
      : invoice.paymentMethod === 'card'
      ? 'ගෙවීම් ක්‍රමය (කාඩ්පත්/Card):'
      : invoice.paymentMethod === 'transfer'
      ? 'ගෙවීම් ක්‍රමය (QR/Online):'
      : 'ගෙවීම් ක්‍රමය (ණය/Credit):';
    ctx.fillText(payLabel, padding, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${business.currencySymbol} ${invoice.paidAmount.toFixed(2)}`, width - padding, y);
    y += gap(20);

    if (invoice.paidAmount > invoice.grandTotal) {
      ctx.font = fontBodyBold;
      ctx.textAlign = 'left';
      ctx.fillText('Change:', padding, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${business.currencySymbol} ${(invoice.paidAmount - invoice.grandTotal).toFixed(2)}`, width - padding, y);
      y += gap(22);
    } else if (invoice.grandTotal > invoice.paidAmount) {
      ctx.font = fontBodyBold;
      ctx.textAlign = 'left';
      ctx.fillText('Balance Due:', padding, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${business.currencySymbol} ${(invoice.grandTotal - invoice.paidAmount).toFixed(2)}`, width - padding, y);
      y += gap(22);
    }
  }

  if (invoice.notes) {
    y += Math.round(6 * fontScale);
    ctx.font = fontSmall;
    ctx.textAlign = 'center';
    const noteLines = wrapText(ctx, isEnglish ? `Note: ${invoice.notes}` : `සටහන: ${invoice.notes}`, width - padding * 2);
    for (const line of noteLines) {
      ctx.fillText(line, width / 2, y);
      y += gap(17);
    }
  }

  // Warranty Policy note
  if (business.showWarrantyPolicy !== false && business.warrantyPolicyText) {
    y += Math.round(6 * fontScale);
    ctx.font = fontSmall;
    ctx.textAlign = 'center';
    const warrantyLines = wrapText(ctx, business.warrantyPolicyText, width - padding * 2);
    for (const line of warrantyLines) {
      ctx.fillText(line, width / 2, y);
      y += gap(17);
    }
  }

  // QR Code Generation
  if (business.showQrCode && business.qrCodeData) {
    try {
      const qrDataUrl = await QRCode.toDataURL(business.qrCodeData, {
        width: is58mm ? 120 : 150,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = reject;
        qrImg.src = qrDataUrl;
      });

      y += 10;
      const qrSize = is58mm ? 110 : 130;
      ctx.drawImage(qrImg, (width - qrSize) / 2, y, qrSize, qrSize);
      y += qrSize + 10;

      ctx.font = fontSmall;
      ctx.textAlign = 'center';
      ctx.fillText('Scan to Pay / Verify (LankaQR / Web)', width / 2, y);
      y += 18;
    } catch (err) {
      console.warn('QR Code generation failed:', err);
    }
  }

  y += 10;
  drawDashedLine(ctx, padding, y, width - padding, '-');
  y += 14;

  // Footer message — always after every bill detail.
  ctx.textAlign = 'center';
  ctx.font = fontBodyBold;
  if (business.receiptFooter) {
    const footerLines = wrapText(ctx, business.receiptFooter, width - padding * 2);
    for (const line of footerLines) {
      ctx.fillText(line, width / 2, y);
      y += gap(18);
    }
  }

  // Branding is deliberately the LAST printed text on the receipt.
  ctx.font = fontSmall;
  ctx.fillText(`*** ${POWERED_BY} ***`, width / 2, y);
  y += gap(18);

  // Scan backwards from bottom to find the exact last row of ink content
  // to eliminate excessive empty blank paper at the end (User Requested!)
  const scanLimitY = Math.min(canvas.height, y + 25);
  let lastInkRow = y;

  try {
    const checkData = ctx.getImageData(0, 0, width, scanLimitY).data;
    outerScan: for (let sy = scanLimitY - 1; sy >= Math.max(10, y - 50); sy--) {
      for (let sx = 0; sx < width; sx++) {
        const idx = (sy * width + sx) * 4;
        const r = checkData[idx];
        const g = checkData[idx + 1];
        const b = checkData[idx + 2];
        const a = checkData[idx + 3];
        // If dark pixel (ink)
        if (a > 128 && (r < 230 || g < 230 || b < 230)) {
          lastInkRow = sy;
          break outerScan;
        }
      }
    }
  } catch {
    lastInkRow = y;
  }

  // Exact tight crop with only 8px neat margin after the branding text
  const finalHeight = Math.min(canvas.height, Math.max(100, lastInkRow + 8));
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = finalHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (croppedCtx) {
    croppedCtx.fillStyle = '#FFFFFF';
    croppedCtx.fillRect(0, 0, width, finalHeight);
    croppedCtx.drawImage(canvas, 0, 0, width, finalHeight, 0, 0, width, finalHeight);
  }

  return croppedCanvas;
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  y: number,
  endX: number,
  char = '-'
) {
  const lineStr = char.repeat(Math.floor((endX - startX) / 8));
  ctx.textAlign = 'center';
  const midX = (startX + endX) / 2;
  ctx.fillText(lineStr, midX, y);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  if (!words.length || !text.trim()) return [];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

export function canvasToEscPosBytes(
  canvas: HTMLCanvasElement,
  business: BusinessProfile
): Uint8Array {
  const esc = new EscPosBuilder();

  if (business.openDrawer) {
    esc.kickDrawer();
  }

  esc.init();
  esc.rasterImage(canvas);

  // Always leave a proper tear/cut gap after the LAST receipt line.
  // Without this, the next receipt can appear immediately after the previous
  // receipt's footer on continuous-roll printers, making the footer look like
  // it was printed at the top of the next bill.
  if (business.cutPaper) {
    esc.feed(4);
    esc.cutPaper();
  } else {
    // Printers without a cutter need a visible manual-tear gap.
    esc.feed(5);
  }

  return esc.getUint8Array();
}
