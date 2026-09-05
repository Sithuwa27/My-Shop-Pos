import { BusinessProfile, Invoice, QuickProduct, AuthUser, ReceiptItem, RepairJob } from '../types';
import { DEFAULT_BUSINESS_PROFILE, INITIAL_PRODUCTS, INITIAL_INVOICE, POWERED_BY } from '../data/defaultData';
import { cloudSync, CloudSnapshot } from './cloudSync';
import { googleSheetsSync, GoogleSnapshot } from './googleSheetsSync';

const KEYS = {
  BUSINESS: 'brave_mobile_profile_v2',
  PRODUCTS: 'brave_mobile_products_v2',
  INVOICES: 'brave_mobile_invoices_v2',
  LANGUAGE: 'brave_mobile_lang_v2',
  SOUND_ENABLED: 'brave_mobile_sound_v2',
  AUTH_USER: 'brave_mobile_auth_user_v2',
  AUTH_CREDS: 'brave_mobile_auth_creds_v2',
  REPAIRS: 'brave_mobile_repairs_v2',
};

const DEFAULT_AUTH_CREDS = {
  username: 'brave',
  password: 'brave123',
  name: 'POS Admin',
  role: 'admin' as const,
};

const currentSnapshot = (): CloudSnapshot => ({
  business: storage.getBusinessProfile(),
  products: storage.getProducts(),
  invoices: storage.getInvoices(),
  repairs: storage.getRepairs(),
});

const pushCloud = () => {
  const snapshot = currentSnapshot();
  if (googleSheetsSync.isConnected()) {
    void googleSheetsSync.save(snapshot);
  } else {
    void cloudSync.saveSnapshot(snapshot);
  }
};

const applyCloudSnapshot = (snapshot: CloudSnapshot) => {
  if (snapshot.business) localStorage.setItem(KEYS.BUSINESS, JSON.stringify(snapshot.business));
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(snapshot.products || []));
  localStorage.setItem(KEYS.INVOICES, JSON.stringify(snapshot.invoices || []));
  localStorage.setItem(KEYS.REPAIRS, JSON.stringify(snapshot.repairs || []));
};

export const storage = {
  exportBackup() {
    const data: Record<string, string | null> = {};
    Object.values(KEYS).forEach((key) => { data[key] = localStorage.getItem(key); });
    return { version: 1, exportedAt: new Date().toISOString(), data };
  },

  importBackup(payload: any) {
    if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') throw new Error('Invalid backup');
    Object.values(KEYS).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(payload.data, key)) {
        const value = payload.data[key];
        if (typeof value === 'string') localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      }
    });
  },

  getBusinessProfile(): BusinessProfile {
    try {
      const data = localStorage.getItem(KEYS.BUSINESS);
      if (!data) return DEFAULT_BUSINESS_PROFILE;
      const parsed = JSON.parse(data);
      // Ensure immutable branding is enforced
      return {
        ...DEFAULT_BUSINESS_PROFILE,
        ...parsed,
        poweredBy: POWERED_BY,
      };
    } catch {
      return DEFAULT_BUSINESS_PROFILE;
    }
  },

  saveBusinessProfile(profile: BusinessProfile) {
    try {
      // Force immutable developer credit
      const cleanProfile: BusinessProfile = {
        ...profile,
        poweredBy: POWERED_BY,
      };
      localStorage.setItem(KEYS.BUSINESS, JSON.stringify(cleanProfile));
      pushCloud();
    } catch (e) {
      console.error(e);
    }
  },

  getProducts(): QuickProduct[] {
    try {
      const data = localStorage.getItem(KEYS.PRODUCTS);
      if (!data) {
        localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
        return INITIAL_PRODUCTS;
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // Filter strictly to Accessories and Repair only. An intentionally empty
      // catalog must remain empty; do not silently repopulate sample products.
      return parsed.filter((p: any) => p.category === 'Accessories' || p.category === 'Repair');
    } catch {
      return INITIAL_PRODUCTS;
    }
  },

  saveProducts(products: QuickProduct[]) {
    try {
      // Ensure only Accessories & Repair
      const filtered = products.filter((p) => p.category === 'Accessories' || p.category === 'Repair');
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(filtered));
      pushCloud();
    } catch (e) {
      console.error(e);
    }
  },

  /**
   * Adjust inventory when an invoice is first saved or edited.
   * If the invoice already exists, restore the previous quantities first and
   * then apply the new quantities. Re-saving/reprinting the same invoice is
   * therefore idempotent and cannot deduct stock twice.
   */
  adjustStockForInvoice(previousInvoice: Invoice | undefined, invoice: Invoice) {
    try {
      const products = this.getProducts();
      const quantityForProduct = (items: ReceiptItem[], product: QuickProduct) =>
        items.reduce((sum, item) => {
          const sameBarcode = Boolean(product.barcode && item.barcode &&
            product.barcode.toLowerCase() === item.barcode.toLowerCase());
          const sameName = item.name.trim().toLowerCase() === product.name.trim().toLowerCase();
          return sum + (sameBarcode || sameName ? item.quantity : 0);
        }, 0);

      const updated = products.map((product) => {
        const oldQty = previousInvoice ? quantityForProduct(previousInvoice.items, product) : 0;
        const newQty = quantityForProduct(invoice.items, product);
        const delta = oldQty - newQty;
        if (delta === 0) return product;
        return {
          ...product,
          stockQuantity: Math.max(0, (product.stockQuantity || 0) + delta),
        };
      });

      this.saveProducts(updated);
      return updated;
    } catch (e) {
      console.error('Error adjusting stock:', e);
      return this.getProducts();
    }
  },

  // Backwards-compatible helper for callers that explicitly need to deduct stock.
  // New invoice persistence should use saveInvoice(), which handles stock atomically.
  deductStock(items: ReceiptItem[]) {
    try {
      const products = this.getProducts();
      const updated = products.map((prod) => {
        const matchedItem = items.find(
          (item) => item.name.trim().toLowerCase() === prod.name.trim().toLowerCase() ||
            (prod.barcode && item.barcode && item.barcode.toLowerCase() === prod.barcode.toLowerCase())
        );
        if (!matchedItem) return prod;
        return { ...prod, stockQuantity: Math.max(0, (prod.stockQuantity || 0) - matchedItem.quantity) };
      });
      this.saveProducts(updated);
      return updated;
    } catch (e) {
      console.error('Error deducting stock:', e);
      return this.getProducts();
    }
  },

  getNextInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const max = this.getInvoices().reduce((highest, invoice) => {
      const match = String(invoice.invoiceNumber || '').match(new RegExp(`^${prefix}(\\d+)$`));
      const number = match ? Number(match[1]) : 0;
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  },

  getRepairs(): RepairJob[] {
    try {
      const data = localStorage.getItem(KEYS.REPAIRS);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  saveRepair(job: RepairJob) {
    try {
      const existing = this.getRepairs();
      const updated = [job, ...existing.filter((r) => r.id !== job.id)].slice(0, 500);
      localStorage.setItem(KEYS.REPAIRS, JSON.stringify(updated));
      pushCloud();
    } catch (e) { console.error(e); }
  },

  deleteRepair(id: string) {
    try { localStorage.setItem(KEYS.REPAIRS, JSON.stringify(this.getRepairs().filter(r => r.id !== id)));
      pushCloud(); }
    catch (e) { console.error(e); }
  },

  getNextRepairNumber(): string {
    const year = new Date().getFullYear();
    const prefix = `REP-${year}-`;
    const max = this.getRepairs().reduce((highest, r) => {
      const m = String(r.jobNumber || '').match(new RegExp(`^${prefix}(\\d+)$`));
      const n = m ? Number(m[1]) : 0;
      return Number.isFinite(n) ? Math.max(highest, n) : highest;
    }, 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  },

  getInvoices(): Invoice[] {
    try {
      const data = localStorage.getItem(KEYS.INVOICES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveInvoice(invoice: Invoice) {
    try {
      const existing = this.getInvoices();
      const previous = existing.find((i) => i.id === invoice.id);
      const updated = [invoice, ...existing.filter((i) => i.id !== invoice.id)];
      localStorage.setItem(KEYS.INVOICES, JSON.stringify(updated.slice(0, 500)));
      pushCloud();
      this.adjustStockForInvoice(previous, invoice);
      if (invoice.repairJobNumber) {
        const repairs = this.getRepairs();
        const repair = repairs.find((r) => r.jobNumber === invoice.repairJobNumber);
        if (repair) {
          const updatedRepair = { ...repair, invoiceId: invoice.id, billedAt: Date.now(), status: 'billed' as const, updatedAt: Date.now() };
          this.saveRepair(updatedRepair);
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  deleteInvoice(id: string) {
    try {
      const existing = this.getInvoices();
      const filtered = existing.filter((i) => i.id !== id);
      localStorage.setItem(KEYS.INVOICES, JSON.stringify(filtered));
      pushCloud();
    } catch (e) {
      console.error(e);
    }
  },

  getLanguage(): 'si' | 'en' {
    try {
      return 'en';
    } catch {
      return 'si';
    }
  },

  saveLanguage(lang: 'si' | 'en') {
    try {
      localStorage.setItem(KEYS.LANGUAGE, lang);
    } catch (e) {
      console.error(e);
    }
  },

  isSoundEnabled(): boolean {
    try {
      const val = localStorage.getItem(KEYS.SOUND_ENABLED);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  },

  setSoundEnabled(enabled: boolean) {
    try {
      localStorage.setItem(KEYS.SOUND_ENABLED, String(enabled));
    } catch (e) {
      console.error(e);
    }
  },

  // Authentication methods
  getStoredCredentials() {
    try {
      const creds = localStorage.getItem(KEYS.AUTH_CREDS);
      return creds ? JSON.parse(creds) : DEFAULT_AUTH_CREDS;
    } catch {
      return DEFAULT_AUTH_CREDS;
    }
  },

  saveStoredCredentials(creds: typeof DEFAULT_AUTH_CREDS) {
    try {
      localStorage.setItem(KEYS.AUTH_CREDS, JSON.stringify(creds));
      void cloudSync.updateCredentials(creds.username, creds.password);
    } catch (e) {
      console.error(e);
    }
  },

  getCurrentUser(): AuthUser | null {
    try {
      const user = localStorage.getItem(KEYS.AUTH_USER);
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: AuthUser | null) {
    try {
      if (user) {
        localStorage.setItem(KEYS.AUTH_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(KEYS.AUTH_USER);
      }
    } catch (e) {
      console.error(e);
    }
  },

  login(username: string, pass: string): AuthUser | null {
    const creds = this.getStoredCredentials();
    const cleanUser = username.trim().toLowerCase();
    if (cleanUser === String(creds.username).trim().toLowerCase() && pass === String(creds.password)) {
      const user: AuthUser = { username: creds.username, name: creds.name || 'POS Staff', role: creds.role || 'admin' };
      this.setCurrentUser(user);
      return user;
    }
    return null;
  },

  async loginCloud(username: string, pass: string): Promise<AuthUser | null> {
    try {
      const result = await cloudSync.login(username, pass, currentSnapshot());
      applyCloudSnapshot(result.snapshot);
      this.setCurrentUser(result.user);
      return result.user;
    } catch (error) {
      console.warn('Cloud login failed, trying local login:', error);
      return this.login(username, pass);
    }
  },

  async refreshFromCloud(): Promise<boolean> {
    try {
      const snapshot = await cloudSync.getSnapshot();
      if (!snapshot) return false;
      applyCloudSnapshot(snapshot);
      return true;
    } catch { return false; }
  },

  async connectGoogleSheets() {
    const result = await googleSheetsSync.connect(currentSnapshot());
    const remote = await googleSheetsSync.load();
    if (remote) applyCloudSnapshot(remote);
    return result;
  },

  async refreshFromGoogleSheets(): Promise<boolean> {
    try {
      const snapshot = await googleSheetsSync.load();
      if (!snapshot) return false;
      applyCloudSnapshot(snapshot);
      return true;
    } catch (e) {
      console.warn('Google Sheets sync unavailable:', e);
      return false;
    }
  },

  isGoogleSheetsConnected() { return googleSheetsSync.isConnected(); },
  isGoogleSheetsConfigured() { return googleSheetsSync.isConfigured(); },
  disconnectGoogleSheets() { googleSheetsSync.disconnect(); },

  logout() {
    this.setCurrentUser(null);
    cloudSync.clearSession();
  },

  // Clear all invoices history
  clearAllRepairs(): RepairJob[] {
    try { localStorage.setItem(KEYS.REPAIRS, JSON.stringify([])); pushCloud(); return []; }
    catch (e) { console.error(e); return []; }
  },

  clearAllInvoices(): Invoice[] {
    try {
      localStorage.setItem(KEYS.INVOICES, JSON.stringify([]));
      pushCloud();
      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  // Completely wipe products list (0 items)
  clearAllProducts(): QuickProduct[] {
    try {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify([]));
      pushCloud();
      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  // Restore sample products
  restoreDefaultProducts(): QuickProduct[] {
    try {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    } catch (e) {
      console.error(e);
      return INITIAL_PRODUCTS;
    }
  },

  // Exhaustive reset of all data
  resetAllData(wipeProductsCompletely: boolean = false) {
    try {
      // Clear every POS-related key in localStorage
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(KEYS.REPAIRS);
      // Also clear any legacy keys if present
      localStorage.removeItem('brave_mobile_profile');
      localStorage.removeItem('brave_mobile_products');
      localStorage.removeItem('brave_mobile_invoices');
      localStorage.removeItem('brave_mobile_cart');

      const finalProducts = wipeProductsCompletely ? [] : INITIAL_PRODUCTS;
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(finalProducts));
      localStorage.setItem(KEYS.BUSINESS, JSON.stringify(DEFAULT_BUSINESS_PROFILE));
      localStorage.setItem(KEYS.INVOICES, JSON.stringify([]));

      return {
        profile: DEFAULT_BUSINESS_PROFILE,
        products: finalProducts,
        invoices: [],
      };
    } catch (e) {
      console.error('Error resetting data:', e);
      return {
        profile: DEFAULT_BUSINESS_PROFILE,
        products: wipeProductsCompletely ? [] : INITIAL_PRODUCTS,
        invoices: [],
      };
    }
  },
};
