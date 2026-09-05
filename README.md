# My POS — Phone + PC Cloud Sync

This version stores the POS account data on the server so the same username/password account can be opened on a phone and a PC and see the same customers, bills, products and repairs.

## Recommended deployment: Render

1. Create a GitHub repository and upload this project.
2. In Render, create a **Blueprint** from the repository. Render will read `render.yaml`.
3. The service builds with `npm ci && npm run build` and starts with `node server.js`.
4. The persistent disk is mounted at `/app/server-data`, so `accounts.json` survives service restarts/deploys.
5. Open the generated HTTPS URL on the PC and phone. Install the PWA from the browser if desired.
6. Log in with the same username/password on both devices.

### Important
- Use an HTTPS URL in production.
- The server currently keeps account data in a JSON file on the persistent disk. This is suitable for a small single-shop deployment; for many shops/users, migrate the API to PostgreSQL/Supabase.
- The current sync model is whole-account snapshot sync. The latest saved snapshot wins if two devices edit the same data at exactly the same time.
- Do not delete the Render persistent disk unless you have a backup.

## Local run

```bash
npm install
npm run dev
```

For the production server locally:

```bash
npm run build
npm start
```

Then open `http://localhost:3000`.

## Android

After installing dependencies:

```bash
npm run build
npx cap add android
npm run android:sync
npx cap open android
```

## Google Drive / Google Sheets cloud sync (Vercel)

This version can sync POS data directly to a private Google Sheet in the signed-in Google account. No Google password is stored in the POS.

### One-time Google Cloud setup
1. Open Google Cloud Console and create/select a project.
2. Enable **Google Sheets API**.
3. Configure the OAuth consent screen (External is fine for a normal Google account; add your own Gmail as a test user if Google asks for test users).
4. Create **OAuth Client ID → Web application**.
5. Add your Vercel site URL under **Authorized JavaScript origins**, for example `https://your-pos.vercel.app`.
6. Copy the Client ID.
7. In Vercel → Project → Settings → Environment Variables, add:
   - Name: `VITE_GOOGLE_CLIENT_ID`
   - Value: your Google OAuth Web Client ID
   - Apply to Production (and Preview if needed)
8. Redeploy the Vercel project.

### Connect from the POS app
1. Log into the POS.
2. Open **Store Profile**.
3. Under **Google Drive / Sheets Cloud Backup**, press **Connect Google**.
4. Select the Gmail/Google account that should own the POS data.
5. Allow Google Sheets access.
6. A spreadsheet named **My POS - Cloud Data** will be created in that Google Drive.

After that, connect the same Google account on the phone and PC. The POS will periodically pull the latest cloud data and saves changes back to the same Google Sheet.

## Google Drive / Sheets multi-user setup

This build uses **one app-level Google OAuth Client ID** for all users. End users do **not** enter a Client ID. Each user only taps **Connect Google** and selects their own Google account. Each Google account gets its own `My POS - Cloud Data` spreadsheet, and the same Google account on another device automatically discovers and reuses that spreadsheet.

For the app owner, create one Google OAuth 2.0 **Web application** Client ID, enable the **Google Sheets API** and **Google Drive API**, add every deployed Vercel origin you use under **Authorized JavaScript origins**, then set this one Vercel environment variable and redeploy:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

If the Google OAuth consent screen is in **Testing** mode, only configured test users can connect. For a public multi-user deployment, configure/publish the consent screen as required by Google. The POS never asks users for their Gmail password.
