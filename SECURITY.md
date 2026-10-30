# Security Policy

## Supported versions

Kosh is pre-1.0. Only the latest release on [GitHub Releases](https://github.com/Abhijat-Abhijat/kosh/releases) gets security fixes. Please update before reporting.

| Version | Supported |
| ------- | --------- |
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report privately through GitHub Security Advisories: **[Report a vulnerability](https://github.com/Abhijat-Abhijat/kosh/security/advisories/new)** (Security tab → "Report a vulnerability").

Please include:

- what the issue is and what an attacker could do with it,
- steps to reproduce, or a proof of concept,
- the Kosh version, Android version and phone model.

Never include real SMS, account numbers or backup files with personal data. Use synthetic data.

We aim to acknowledge reports within 7 days and to agree on a fix and disclosure timeline with you. We'll credit you in the advisory unless you'd rather stay anonymous.

## Threat model

Kosh is a local-only app. Knowing what it does and doesn't protect against helps you judge your own risk.

**Where data lives**

- Everything (accounts, transactions, holdings, dues, subscriptions) is stored in a SQLite database in the app's private storage on your phone. There is no Kosh server, no account and no sync.
- Android's app sandbox keeps other apps from reading that storage. **Kosh does not encrypt the database itself.** Anyone who can read the app's private storage (a rooted phone, a forensic tool with an unlocked device, or a debuggable build) can read your data. Use a strong screen lock and keep your phone encrypted (the default on modern Android).
- Small settings and secrets use `expo-secure-store` (Android Keystore-backed).

**SMS**

- SMS are read and parsed **on the device**. Messages that don't parse as a completed bank/card/UPI transaction are never stored.
- For messages that do parse, the **raw SMS text is stored** next to the transaction so you can check what was parsed. That text can include partial account numbers, balances and counterparties.

**App lock**

- The fingerprint / face / device PIN lock (via `expo-local-authentication`) is a **UI lock**. It stops someone holding your unlocked phone from opening Kosh. It is not encryption at rest and does not protect against someone who can read the app's storage directly.

**Backups**

- "Export backup" writes a **plain, unencrypted JSON file** with all your data and hands it to the Android share sheet. Wherever you save it (Google Drive, Files, email), that copy is protected only by that location. Store backups somewhere private and delete old ones you don't need.
- "Restore from backup" trusts the file you choose. Only restore backups you made yourself.

**Network**

Kosh makes no network calls except:

- optional price lookups for holdings you add: Yahoo Finance chart API (stocks, gold, USD/INR) and mfapi.in (mutual fund NAVs). These requests reveal the ticker or scheme code to those services, never amounts or units;
- crash reports to Sentry, **only** if whoever built the APK set `EXPO_PUBLIC_SENTRY_DSN`. Official release builds do not set it.

**Distribution**

- Kosh is sideloaded from GitHub Releases. Each release publishes a SHA-256 checksum next to the APK; check it before installing. Only install APKs from the official repository.

## Out of scope

- Attacks that need a rooted or already-compromised device.
- Data exposed through a backup file the user shared.
- Issues in third-party services (Yahoo Finance, mfapi.in, Sentry) or in Android itself.
