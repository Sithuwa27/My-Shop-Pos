export type PaperWidth = '58mm' | '80mm';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit';
export type PrintMethod = 'bluetooth' | 'system' | 'simulator';

export type RepairStatus = 'received' | 'diagnosing' | 'repairing' | 'ready' | 'billed' | 'delivered' | 'cancelled';

export interface RepairJob {
  id: string;
  jobNumber: string;
  customerName: string;
  customerPhone: string;
  device: string;
  imei?: string;
  issue: string;
  diagnosis?: string;
  estimate: number;
  advance: number;
  status: RepairStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  invoiceId?: string;
  billedAt?: number;
}

export type ProductCategory = 'Accessories' | 'Repair';

export type ReceiptFontFamily = 'monospace' | 'sans' | 'sinhala' | 'serif' | 'ticket';
export type ReceiptFontSize = 'small' | 'normal' | 'large' | 'xlarge' | 'xxlarge';
export type AppTheme = 'dark_modern' | 'midnight_blue' | 'clean_light' | 'amoled_black' | 'dark' | 'light' | 'oled';
export type ResetScope = 'all_wipe' | 'all_defaults' | 'invoices_only' | 'products_only' | 'current_bill';

export interface ReceiptItem {
  id: string;
  name: string;
  sinhalaName?: string;
  price: number; // Selling price
  costPrice?: number; // Buying price (ගැනුම් මිල)
  quantity: number;
  unit: string;
  discount: number; // percentage or fixed
  discountType: 'percentage' | 'fixed';
  total: number;
  category?: ProductCategory;
  barcode?: string;
}

export interface BusinessProfile {
  /** App-wide display name. Editable from Store Profile. */
  appName?: string;
  logoDataUrl?: string;
  showLogo?: boolean;
  name: string;
  sinhalaName: string;
  tagline: string;
  address: string;
  phone: string;
  mobile: string;
  taxOrRegNumber: string;
  receiptHeader: string;
  receiptFooter: string;
  currencySymbol: string;
  paperWidth: PaperWidth;
  printSinhalaAsGraphic: boolean;
  showQrCode: boolean;
  qrCodeData: string;
  showBarcode: boolean;
  cutPaper: boolean;
  openDrawer: boolean;
  copies: number;
  receiptLanguage: 'si' | 'en';
  receiptFontSize?: ReceiptFontSize;
  receiptFontFamily?: ReceiptFontFamily;
  receiptFontScale?: number; // e.g. 100 for 100%, 120 for 120%
  receiptLineSpacing?: 'compact' | 'normal' | 'spacious';
  headerAlignment?: 'center' | 'left';
  // Visibility toggles for 100% customizable receipt
  showSinhalaName?: boolean;
  showTagline?: boolean;
  showAddress?: boolean;
  showPhone?: boolean;
  showTaxNumber?: boolean;
  showDateTime?: boolean;
  showCashier?: boolean;
  showCustomerInfo?: boolean;
  showItemUnitPrice?: boolean;
  showItemSinhalaName?: boolean;
  showItemBarcode?: boolean;
  showDiscounts?: boolean;
  showTax?: boolean;
  showPaymentDetails?: boolean;
  showWarrantyPolicy?: boolean;
  warrantyPolicyText?: string;
  appTheme?: AppTheme;
  readonly poweredBy: string; // "Powered By Sithum Kalhara" - IMMUTABLE
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  time: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  taxRate: number; // percentage (e.g. 0% or 8% etc)
  taxAmount: number;
  serviceCharge: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  // Optional repair-job details used when a repair is converted into an invoice.
  repairJobNumber?: string;
  repairDevice?: string;
  repairImei?: string;
  repairIssue?: string;
  repairDiagnosis?: string;
  repairEstimate?: number;
  repairAdvance?: number;
  repairBalance?: number;
  cashierName?: string;
  totalCost?: number; // Total buying price of items
  totalProfit?: number; // Total profit = grandTotal - totalCost
  receiptLanguage?: 'si' | 'en';
  createdAt: number;
}

export interface QuickProduct {
  id: string;
  name: string;
  sinhalaName: string;
  price: number; // Selling price (විකුණුම් මිල)
  costPrice: number; // Buying price (ගැනුම් මිල)
  category: ProductCategory; // 'Accessories' | 'Repair'
  stockQuantity: number; // Current stock count (තොග ප්‍රමාණය)
  minStockLevel: number; // Low stock warning trigger level (අවම තොගය)
  unit: string;
  barcode?: string; // Barcode / QR code
}

export interface BluetoothDeviceState {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  deviceId: string | null;
  error: string | null;
  batteryLevel?: number | null;
  lastPrintTimestamp?: number | null;
}

export interface AuthUser {
  username: string;
  name: string;
  role: 'admin' | 'cashier';
}
