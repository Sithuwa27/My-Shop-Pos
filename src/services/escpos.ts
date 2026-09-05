import { BusinessProfile, Invoice, PaperWidth } from '../types';

export class EscPosBuilder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  init(): this {
    this.buffer.push(0x1B, 0x40); // ESC @
    return this;
  }

  alignLeft(): this {
    this.buffer.push(0x1B, 0x61, 0x00);
    return this;
  }

  alignCenter(): this {
    this.buffer.push(0x1B, 0x61, 0x01);
    return this;
  }

  alignRight(): this {
    this.buffer.push(0x1B, 0x61, 0x02);
    return this;
  }

  bold(enable = true): this {
    this.buffer.push(0x1B, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  doubleSize(): this {
    this.buffer.push(0x1D, 0x21, 0x11);
    return this;
  }

  doubleHeight(): this {
    this.buffer.push(0x1D, 0x21, 0x01);
    return this;
  }

  normalSize(): this {
    this.buffer.push(0x1D, 0x21, 0x00);
    return this;
  }

  invert(enable = true): this {
    this.buffer.push(0x1D, 0x42, enable ? 0x01 : 0x00);
    return this;
  }

  underline(enable = true): this {
    this.buffer.push(0x1B, 0x2D, enable ? 0x01 : 0x00);
    return this;
  }

  newLine(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0A);
    }
    return this;
  }

  feed(lines = 3): this {
    this.buffer.push(0x1B, 0x64, lines);
    return this;
  }

  cutPaper(): this {
    this.buffer.push(0x1D, 0x56, 0x42, 0x00); // GS V 66 0
    return this;
  }

  kickDrawer(): this {
    this.buffer.push(0x1B, 0x70, 0x00, 0x19, 0xFA); // ESC p 0 25 250
    return this;
  }

  text(str: string): this {
    // Standard ASCII sanitization for thermal ESC/POS text mode
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        this.buffer.push(code);
      } else {
        // Fallback for non-ASCII in text mode: map common or replace
        this.buffer.push(0x20); // space or simple char
      }
    }
    return this;
  }

  textLine(str: string): this {
    this.text(str);
    this.newLine();
    return this;
  }

  separator(width: PaperWidth = '58mm', char = '-'): this {
    const cols = width === '58mm' ? 32 : 48;
    this.textLine(char.repeat(cols));
    return this;
  }

  twoColumns(left: string, right: string, width: PaperWidth = '58mm'): this {
    const totalCols = width === '58mm' ? 32 : 48;
    const leftLen = left.length;
    const rightLen = right.length;
    
    if (leftLen + rightLen >= totalCols) {
      const trimmedLeft = left.substring(0, totalCols - rightLen - 1);
      const spaces = totalCols - trimmedLeft.length - rightLen;
      this.textLine(trimmedLeft + ' '.repeat(Math.max(1, spaces)) + right);
    } else {
      const spaces = totalCols - leftLen - rightLen;
      this.textLine(left + ' '.repeat(spaces) + right);
    }
    return this;
  }

  threeColumns(col1: string, col2: string, col3: string, width: PaperWidth = '58mm'): this {
    const totalCols = width === '58mm' ? 32 : 48;
    // e.g. 58mm: Item (16) Qty (6) Total (10)
    // e.g. 80mm: Item (26) Qty (10) Total (12)
    const col2Width = width === '58mm' ? 6 : 9;
    const col3Width = width === '58mm' ? 10 : 13;
    const col1Width = totalCols - col2Width - col3Width;

    const c1 = col1.length > col1Width ? col1.substring(0, col1Width - 1) + ' ' : col1.padEnd(col1Width);
    const c2 = col2.padStart(col2Width);
    const c3 = col3.padStart(col3Width);

    this.textLine(c1 + c2 + c3);
    return this;
  }

  rawBytes(bytes: number[] | Uint8Array): this {
    if (bytes instanceof Uint8Array) {
      this.buffer.push(...Array.from(bytes));
    } else {
      this.buffer.push(...bytes);
    }
    return this;
  }

  /**
   * Generates ESC/POS GS v 0 raster bitmap from an HTML Canvas using 24-dot vertical slicing.
   * By slicing into standard 24-dot strips (supported by all ESC/POS thermal printers),
   * we completely eliminate buffer overflows that cause overlapping lines (එක උඩ එක ප්රින්ට් වීම)
   * or cutoffs (බිල් එකේ සදහන් ඔක්කොම ප්රින්ට් නොවී කැපී යාම).
   */
  rasterImage(canvas: HTMLCanvasElement): this {
    const ctx = canvas.getContext('2d');
    if (!ctx) return this;

    const width = canvas.width;
    const height = canvas.height;

    // Width in bytes (each byte represents 8 horizontal pixels)
    const widthBytes = Math.ceil(width / 8);
    const imgData = ctx.getImageData(0, 0, width, height).data;

    // Standard 24 dots vertical strip for thermal printer heads
    const STRIP_HEIGHT = 24;

    for (let startY = 0; startY < height; startY += STRIP_HEIGHT) {
      const currentStripHeight = Math.min(STRIP_HEIGHT, height - startY);

      // ESC/POS GS v 0 m xL xH yL yH
      const xL = widthBytes % 256;
      const xH = Math.floor(widthBytes / 256);
      const yL = currentStripHeight % 256;
      const yH = Math.floor(currentStripHeight / 256);

      // GS v 0 m xL xH yL yH (0x00 = normal mode)
      this.buffer.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH);

      // Convert RGBA pixels for this vertical strip to 1-bit monochrome (0 = white, 1 = black)
      for (let y = startY; y < startY + currentStripHeight; y++) {
        for (let xByte = 0; xByte < widthBytes; xByte++) {
          let byteVal = 0;
          for (let b = 0; b < 8; b++) {
            const x = xByte * 8 + b;
            if (x < width) {
              const idx = (y * width + x) * 4;
              const r = imgData[idx];
              const g = imgData[idx + 1];
              const bVal = imgData[idx + 2];
              const a = imgData[idx + 3];

              // Threshold: if dark enough and not transparent, it is black dot
              const luminance = 0.299 * r + 0.587 * g + 0.114 * bVal;
              if (a > 128 && luminance < 180) {
                byteVal |= (1 << (7 - b));
              }
            }
          }
          this.buffer.push(byteVal);
        }
      }
    }

    return this;
  }

  getUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Creates formatted ESC/POS commands for an invoice in text mode
 */
export function buildTextReceiptBytes(invoice: Invoice, business: BusinessProfile): Uint8Array {
  const esc = new EscPosBuilder();

  if (business.openDrawer) {
    esc.kickDrawer();
  }

  // Header
  esc.alignCenter().bold().doubleSize().textLine(business.name).normalSize();

  if (business.tagline) {
    esc.textLine(business.tagline);
  }
  if (business.address) {
    esc.textLine(business.address);
  }
  if (business.phone || business.mobile) {
    esc.textLine(`Tel: ${business.phone || business.mobile}`);
  }
  if (business.taxOrRegNumber) {
    esc.textLine(business.taxOrRegNumber);
  }

  esc.separator(business.paperWidth, '=');

  // Invoice Meta
  esc.alignLeft();
  esc.twoColumns(`Invoice: ${invoice.invoiceNumber}`, `Date: ${invoice.date}`, business.paperWidth);
  esc.twoColumns(`Time: ${invoice.time}`, `Cashier: ${invoice.cashierName || '01'}`, business.paperWidth);
  if (invoice.customerName) {
    esc.textLine(`Customer: ${invoice.customerName}`);
  }
  if (invoice.customerPhone) {
    esc.textLine(`Phone: ${invoice.customerPhone}`);
  }

  esc.separator(business.paperWidth, '-');

  // Item headers
  esc.threeColumns('ITEM', 'QTY', 'TOTAL', business.paperWidth);
  esc.separator(business.paperWidth, '-');

  // Items
  for (const item of invoice.items) {
    const unitPrice = `${business.currencySymbol} ${item.price.toFixed(2)}`;
    const lineTotal = `${business.currencySymbol} ${item.total.toFixed(2)}`;
    
    // Wrap long item names so thermal printers never overlap text.
    const itemColWidth = business.paperWidth === '58mm' ? 16 : 26;
    const words = String(item.name || '').split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > itemColWidth && current) {
        esc.textLine(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) esc.textLine(current);
    // Qty x UnitPrice -> Total is printed on its own line.
    esc.threeColumns(`  ${item.quantity} ${item.unit} x ${item.price}`, '', lineTotal, business.paperWidth);
  }

  // Repair details: each field is printed on its own line, with long values wrapped.
  if (invoice.repairJobNumber || invoice.repairDevice || invoice.repairIssue || invoice.repairAdvance !== undefined) {
    esc.separator(business.paperWidth, '-');
    esc.alignLeft().bold().textLine('REPAIR DETAILS').bold(false);
    const repairLines: Array<[string, string]> = [];
    if (invoice.repairJobNumber) repairLines.push(['Job No:', invoice.repairJobNumber]);
    if (invoice.repairDevice) repairLines.push(['Device:', invoice.repairDevice]);
    if (invoice.repairImei) repairLines.push(['IMEI / Serial:', invoice.repairImei]);
    if (invoice.repairIssue) repairLines.push(['Issue:', invoice.repairIssue]);
    if (invoice.repairDiagnosis) repairLines.push(['Diagnosis:', invoice.repairDiagnosis]);
    if (invoice.repairEstimate !== undefined) repairLines.push(['Estimate:', `${business.currencySymbol} ${invoice.repairEstimate.toFixed(2)}`]);
    if (invoice.repairAdvance !== undefined) repairLines.push(['Advance Paid:', `${business.currencySymbol} ${invoice.repairAdvance.toFixed(2)}`]);
    if (invoice.repairBalance !== undefined) repairLines.push(['Balance Due:', `${business.currencySymbol} ${invoice.repairBalance.toFixed(2)}`]);
    const totalCols = business.paperWidth === '58mm' ? 32 : 48;
    for (const [label, value] of repairLines) {
      const words = String(value).split(/\s+/).filter(Boolean);
      const firstWidth = Math.max(8, totalCols - label.length - 1);
      const nextWidth = totalCols - 2;
      let line = '';
      let first = true;
      for (const word of words) {
        const limit = first ? firstWidth : nextWidth;
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > limit && line) {
          esc.textLine(first ? `${label} ${line}` : `  ${line}`);
          first = false;
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) esc.textLine(first ? `${label} ${line}` : `  ${line}`);
    }  }

  esc.separator(business.paperWidth, '-');

  // Summary
  esc.alignRight();
  esc.twoColumns('Subtotal:', `${business.currencySymbol} ${invoice.subtotal.toFixed(2)}`, business.paperWidth);

  if (invoice.discountTotal > 0) {
    esc.twoColumns('Discount:', `-${business.currencySymbol} ${invoice.discountTotal.toFixed(2)}`, business.paperWidth);
  }

  if (invoice.taxAmount > 0) {
    esc.twoColumns(`Tax (${invoice.taxRate}%):`, `${business.currencySymbol} ${invoice.taxAmount.toFixed(2)}`, business.paperWidth);
  }

  if (invoice.serviceCharge > 0) {
    esc.twoColumns('Service Charge:', `${business.currencySymbol} ${invoice.serviceCharge.toFixed(2)}`, business.paperWidth);
  }

  esc.separator(business.paperWidth, '=');
  esc.bold().doubleHeight();
  esc.twoColumns('GRAND TOTAL:', `${business.currencySymbol} ${invoice.grandTotal.toFixed(2)}`, business.paperWidth);
  esc.normalSize().bold(false);
  esc.separator(business.paperWidth, '-');

  // Payment
  esc.twoColumns(`Payment (${invoice.paymentMethod.toUpperCase()}):`, `${business.currencySymbol} ${invoice.paidAmount.toFixed(2)}`, business.paperWidth);
  if (invoice.changeAmount > 0) {
    esc.twoColumns('Change:', `${business.currencySymbol} ${invoice.changeAmount.toFixed(2)}`, business.paperWidth);
  } else if (invoice.grandTotal > invoice.paidAmount) {
    esc.twoColumns('Balance Due:', `${business.currencySymbol} ${(invoice.grandTotal - invoice.paidAmount).toFixed(2)}`, business.paperWidth);
  }

  // Keep the footer at the absolute end of the receipt.
  esc.separator(business.paperWidth, '-');

  // Footer
  esc.alignCenter();
  if (business.receiptFooter) {
    esc.textLine(business.receiptFooter);
  }
  esc.textLine('*** Powered By Sithum Kalhara ***');
  esc.feed(4);

  if (business.cutPaper) {
    esc.cutPaper();
  }

  return esc.getUint8Array();
}

/**
 * Creates diagnostic test print receipt bytes
 */
export function buildTestPrintBytes(business: BusinessProfile): Uint8Array {
  const esc = new EscPosBuilder();
  if (business.openDrawer) {
    esc.kickDrawer();
  }

  esc.alignCenter().bold().doubleSize().textLine("TEST PRINT").normalSize().bold(false);
  esc.textLine("Bluetooth Thermal POS Ready");
  esc.separator(business.paperWidth, '=');
  esc.alignLeft();
  esc.textLine(`Printer Width: ${business.paperWidth}`);
  esc.textLine(`Store: ${business.name}`);
  esc.textLine(`Date/Time: ${new Date().toLocaleString()}`);
  esc.separator(business.paperWidth, '-');
  esc.bold().textLine("FONT STYLES & SIZES:").bold(false);
  esc.textLine("Normal 12x24 font");
  esc.bold().textLine("Bold font enabled").bold(false);
  esc.underline().textLine("Underlined text enabled").underline(false);
  esc.doubleHeight().textLine("Double Height").normalSize();
  esc.doubleSize().textLine("Double Size").normalSize();
  esc.separator(business.paperWidth, '-');
  esc.alignCenter();
  esc.textLine("*** SUCCESSFUL TEST ***");
  esc.feed(4);
  if (business.cutPaper) {
    esc.cutPaper();
  }
  return esc.getUint8Array();
}
