# Mobile POS – Mobile App Edition

This edition keeps the original billing, inventory, scanner, receipt preview, Bluetooth printing, WhatsApp sharing, PWA install and history features and adds a mobile-first POS dashboard and repair-job workflow.

## Mobile workflow
- Home dashboard: today's sales, bills, products, open repairs and low-stock alerts.
- New Bill: product search/scan, cart, customer, payment, save and print.
- Bills: existing invoice history and reprint/edit flow.
- Stock: existing product/inventory manager.
- More: Repair Jobs, Printer, Shop Profile, Install App, themes, language, sound and reset tools.

## Repair workflow
Repair jobs support customer, phone/WhatsApp, device, IMEI/serial, issue, diagnosis, estimate, advance, notes and status. The Smart Estimate button is an offline heuristic helper; it does not claim to be a medical/technical AI diagnosis engine.

## Android packaging
Capacitor configuration is included. After installing dependencies, use `npm run build`, then `npx cap add android` (first time), `npm run android:sync`, and `npm run android:open`.
