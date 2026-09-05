import { BusinessProfile, Invoice, QuickProduct, RepairJob, AuthUser } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';
const TOKEN_KEY = 'brave_pos_cloud_token_v1';
const USER_KEY = 'brave_pos_cloud_user_v1';

export interface CloudSnapshot {
  business: BusinessProfile | null;
  products: QuickProduct[];
  invoices: Invoice[];
  repairs: RepairJob[];
}

export const cloudSync = {
  isConfigured() { return true; },
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  getUser(): AuthUser | null {
    try { const raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  },
  clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
  async login(username: string, password: string, localSnapshot: CloudSnapshot) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, localSnapshot }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data as { token: string; user: AuthUser; snapshot: CloudSnapshot };
  },
  async getSnapshot(): Promise<CloudSnapshot | null> {
    const token = this.getToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/data`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  },
  async updateCredentials(username: string, password: string) {
    const token = this.getToken();
    if (!token) return false;
    const res = await fetch(`${API_BASE}/api/auth/credentials`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    const oldUser = this.getUser();
    localStorage.setItem(USER_KEY, JSON.stringify({ ...(oldUser || {}), username }));
    return true;
  },
  async saveSnapshot(snapshot: CloudSnapshot) {
    const token = this.getToken();
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/data`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(snapshot),
      });
    } catch (e) { console.warn('Cloud sync unavailable:', e); }
  },
};
