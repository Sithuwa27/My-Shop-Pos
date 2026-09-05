import { BusinessProfile, Invoice, QuickProduct, RepairJob, AuthUser } from '../types';

const TOKEN_KEY = 'brave_pos_google_token_v1';
const SHEET_ID_KEY = 'brave_pos_google_sheet_id_v1';
const SHEET_NAME = 'POS_DATA';
const SPREADSHEET_TITLE = 'My POS - Cloud Data';
const APP_PROPERTY_KEY = 'myPosCloudData';
const APP_PROPERTY_VALUE = 'v1';
const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const CHUNK_SIZE = 45000;

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleSnapshot {
  business: BusinessProfile | null;
  products: QuickProduct[];
  invoices: Invoice[];
  repairs: RepairJob[];
}

let scriptPromise: Promise<void> | null = null;
let tokenClient: any = null;

function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gis]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google sign-in library failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGis = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google sign-in library failed to load.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function getAccessToken(forceConsent = false): Promise<string> {
  if (!CLIENT_ID) throw new Error('Google Client ID is not configured. Add VITE_GOOGLE_CLIENT_ID in Vercel.');
  await loadGoogleScript();
  if (!window.google?.accounts?.oauth2) throw new Error('Google authorization is unavailable.');

  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing && !forceConsent) return existing;

  return await new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response?.error) {
          reject(new Error(response.error_description || response.error || 'Google authorization failed.'));
          return;
        }
        if (!response?.access_token) {
          reject(new Error('Google did not return an access token.'));
          return;
        }
        localStorage.setItem(TOKEN_KEY, response.access_token);
        resolve(response.access_token);
      },
      error_callback: (error: any) => reject(new Error(error?.message || 'Google authorization was cancelled.')),
    });
    tokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : 'select_account' });
  });
}

async function api(path: string, init: RequestInit = {}, retry = true) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://sheets.googleapis.com/v4${path}`, { ...init, headers });
  if (response.status === 401 && retry) {
    localStorage.removeItem(TOKEN_KEY);
    return api(path, init, false);
  }
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!response.ok) throw new Error(data?.error?.message || `Google Sheets request failed (${response.status}).`);
  return data;
}


async function driveApi(path: string, init: RequestInit = {}, retry = true) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, { ...init, headers });
  if (response.status === 401 && retry) {
    localStorage.removeItem(TOKEN_KEY);
    return driveApi(path, init, false);
  }
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!response.ok) throw new Error(data?.error?.message || `Google Drive request failed (${response.status}).`);
  return data;
}

async function findExistingSpreadsheet(): Promise<string | null> {
  // Prefer the hidden app marker for sheets created by newer versions.
  const propertyQuery = `appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' } and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const byProperty = await driveApi(`/files?q=${encodeURIComponent(propertyQuery)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=10`);
  const markedId = byProperty?.files?.[0]?.id;
  if (markedId) return markedId;

  // Backward-compatible lookup for sheets created by the previous POS version.
  const titleQuery = `name='${SPREADSHEET_TITLE.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const byTitle = await driveApi(`/files?q=${encodeURIComponent(titleQuery)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=10`);
  return byTitle?.files?.[0]?.id || null;
}

async function markSpreadsheet(id: string) {
  try {
    await driveApi(`/files/${encodeURIComponent(id)}?fields=id`, {
      method: 'PATCH',
      body: JSON.stringify({ appProperties: { [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE } }),
    });
  } catch {
    // Sync can still work by title lookup if the marker update is unavailable.
  }
}

function snapshotToRows(snapshot: GoogleSnapshot) {
  const payload = JSON.stringify(snapshot);
  const rows: string[][] = [['MY_POS_SHEET_V1', '0', '0', String(Math.ceil(payload.length / CHUNK_SIZE))]];
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    rows.push(['DATA', String(Math.floor(i / CHUNK_SIZE)), payload.length ? payload.slice(i, i + CHUNK_SIZE) : '', '']);
  }
  return rows;
}

function rowsToSnapshot(rows: any[][]): GoogleSnapshot | null {
  const chunks = (rows || [])
    .filter((row) => row?.[0] === 'DATA')
    .sort((a, b) => Number(a?.[1] || 0) - Number(b?.[1] || 0))
    .map((row) => String(row?.[2] ?? ''));
  if (!chunks.length) return null;
  try {
    const parsed = JSON.parse(chunks.join(''));
    return {
      business: parsed.business || null,
      products: Array.isArray(parsed.products) ? parsed.products : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      repairs: Array.isArray(parsed.repairs) ? parsed.repairs : [],
    };
  } catch {
    throw new Error('The connected Google Sheet contains invalid POS data.');
  }
}

async function ensureSpreadsheet() {
  let id = localStorage.getItem(SHEET_ID_KEY);
  if (id) return id;

  // This is what makes phone + PC use the same data for the same Google account.
  id = await findExistingSpreadsheet();
  if (id) {
    localStorage.setItem(SHEET_ID_KEY, id);
    await markSpreadsheet(id);
    return id;
  }

  const data = await api('/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({ properties: { title: SPREADSHEET_TITLE }, sheets: [{ properties: { title: SHEET_NAME } }] }),
  });
  id = data.spreadsheetId;
  if (!id) throw new Error('Google did not create the POS spreadsheet.');
  localStorage.setItem(SHEET_ID_KEY, id);
  await markSpreadsheet(id);
  return id;
}

async function ensureTab(id: string) {
  const meta = await api(`/spreadsheets/${encodeURIComponent(id)}?fields=sheets.properties`);
  const found = meta?.sheets?.some((s: any) => s?.properties?.title === SHEET_NAME);
  if (!found) {
    await api(`/spreadsheets/${encodeURIComponent(id)}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
    });
  }
}

export const googleSheetsSync = {
  isConfigured() { return Boolean(CLIENT_ID); },
  isConnected() { return Boolean(localStorage.getItem(SHEET_ID_KEY)); },
  getSheetId() { return localStorage.getItem(SHEET_ID_KEY); },
  disconnect() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SHEET_ID_KEY);
  },
  async connect(localSnapshot: GoogleSnapshot) {
    await getAccessToken(true);
    const id = await ensureSpreadsheet();
    await ensureTab(id);
    const existing = await this.load();
    if (!existing) await this.save(localSnapshot);
    return { spreadsheetId: id };
  },
  async load(): Promise<GoogleSnapshot | null> {
    const id = localStorage.getItem(SHEET_ID_KEY);
    if (!id) return null;
    await ensureTab(id);
    const data = await api(`/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(SHEET_NAME + '!A:D')}`);
    return rowsToSnapshot(data.values || []);
  },
  async save(snapshot: GoogleSnapshot) {
    const id = await ensureSpreadsheet();
    await ensureTab(id);
    const rows = snapshotToRows(snapshot);
    await api(`/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(SHEET_NAME + '!A:D')}:clear`, { method: 'POST', body: '{}' });
    await api(`/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(`${SHEET_NAME}!A1:D${rows.length}`)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ range: `${SHEET_NAME}!A1:D${rows.length}`, majorDimension: 'ROWS', values: rows }),
    });
  },
};
