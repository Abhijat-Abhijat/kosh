# Privacy

The full privacy policy is on the website (`website/privacy.html`). This is the short version; if the two ever differ, the website wins.

- **No account, no server.** Kosh has no backend. All your data is stored in a database on your phone.
- **No analytics, no ads, no tracking.**
- **SMS stay on the phone.** Kosh reads your SMS inbox on the device to find bank, card and UPI transactions. Messages that aren't transactions (personal chats, OTPs, promotions) are skipped and never stored. For transactions, the original SMS text is saved with the transaction so you can check it.
- **Usage access** is used only to see when you last opened the apps you've linked to subscriptions.
- **Network calls** happen only for:
  - price lookups for holdings you add: Yahoo Finance (stocks, gold, USD/INR) and mfapi.in (mutual fund NAVs). They see the ticker or scheme code you look up, not your amounts or units;
  - crash reports to Sentry **only** if whoever built your APK set a Sentry DSN. Official releases from GitHub don't.
- **Backups are yours.** "Export backup" creates an unencrypted JSON file and hands it to the app you choose (Drive, Files, …). Kosh never uploads it anywhere itself.
- **Deleting data:** Settings → Erase all data, or uninstall the app.

Kosh doesn't sell, share or see your data, because it never leaves your phone unless you export it.
