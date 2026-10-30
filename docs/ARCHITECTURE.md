# Architecture

Kosh is a local-only Expo (SDK 58) app for Android. There is no backend: data lives in a SQLite database on the phone, and the only network calls are optional price lookups and optional crash reports.

```
SMS inbox ──► kosh-native (Kotlin) ──► parser.ts ──► match.ts / categorize.ts ──► SQLite
                                                                                 │
        usage stats ──► subscriptions/logic ──► weekly digest      TanStack Query hooks ──► screens
        dues ──► expo-notifications (local reminders, check-in nudges)
        holdings ──► Yahoo Finance / mfapi.in (on demand) ──► SQLite
```

## Folder map

| Path | What lives there |
| --- | --- |
| `src/app/` | Expo Router routes. Every file is a screen; `_layout.tsx` files are navigators. `onboarding.tsx` is the first-run flow; `(app)/` holds the main app: home (`index.tsx`), `accounts/`, `transactions/`, `investments/`, `dues/`, `subscriptions/`, `sync.tsx` (SMS sync), `settings.tsx`, `menu.tsx`. Keep logic out of here. |
| `src/features/<slice>/` | Feature slices. Each has its data hooks (`api.ts`), pure logic (`logic.ts`, `calc.ts`, …), forms and feature-specific UI, with tests in `__tests__/`. Slices: `accounts`, `transactions`, `sms`, `investments`, `dues`, `subscriptions`, `summary`, `lock` (app lock), `nudges` (check-in notifications), `profile`. |
| `src/components/ui/` | Design system: text, amounts, bands, rows, chips, controls, buttons, bar charts, screen scaffold. Exported from `index.ts`. |
| `src/lib/` | Shared infrastructure: local database (`src/lib/db/`: connection, schema migrations, queries), native device bridge (`device.ts`), formatting (`format.ts`), the TanStack Query client and keys (`query-client.ts`), secure storage, env. |
| `src/stores/` | Zustand stores for small global state shared across slices. |
| `src/theme/` | Design tokens (`tokens.js`), shared by Tailwind and TS code. |
| `modules/kosh-native/` | Local Expo module in Kotlin: `READ_SMS` permission + inbox reading, Usage Access check/settings + per-app last-used times, list of launchable apps. Android only. |
| `assets/` | App icon, splash, brand assets. |
| `.github/` | CI, release workflow, issue/PR templates. |

## Data model

All tables live in the on-device SQLite database (`expo-sqlite`). Schema and migrations are in `src/lib/db/`; the database is versioned and migrated on app start. Money is stored in rupees with two decimals.

| Table | Holds |
| --- | --- |
| `accounts` | Bank accounts, credit/debit cards, cash, wallets. `last4` and `sms_sender_hint` are used to match SMS. `balance` (or card outstanding), `credit_limit`, billing/due day, debit card → bank link. |
| `categories` | Built-in categories (Food, Groceries, Fuel, Salary, …) plus user ones; `kind` is expense, income or transfer. |
| `transactions` | Amount, direction (debit/credit), time, merchant, category, account, source (`sms`, `manual`, `import`). SMS rows keep `sms_hash` (dedupe key) and `raw_sms`. |
| `holdings` | Savings and investments: FD, RD, stock, mutual fund, gold, LIC, PPF, other. Units, invested amount, cached price/value, interest rate, maturity, instalments, premiums. |
| `subscriptions` | Recurring charges with billing cycle, next charge, Android package (for usage tracking), merchant pattern, last used / last check-in. |
| `dues` | Pending payments with due date, kind, recurrence, status, and the scheduled notification ids. |

Backups ("Export backup") serialise these tables to one JSON file; "Restore from backup" replaces the database contents with it.

## SMS sync

`src/features/sms/`

1. `useAutoSmsSync` runs on app start and when the app returns to the foreground (at most every 10 minutes) if SMS permission is granted. "Sync now" on the SMS Sync screen runs it manually. Concurrent runs share one promise.
2. `device.readSmsSince(cursor, 200)` (native module) reads inbox messages newer than the last cursor, in batches of 200. The first sync looks back 90 days.
3. `parser.ts` turns each body into `{ amount, direction, last4, merchant, availableBalance, kind }` or `null`. It is pure TypeScript with no network and is the main place contributors add bank formats.
4. `match.ts` picks the account by last digits, using the SMS sender as a tie-breaker; it returns nothing rather than guess. `categorize.ts` picks a category from merchant keywords.
5. Rows are written with `sms_hash` as a unique key so re-reading the same SMS never creates duplicates. The cursor advances only after a batch is stored.
6. The newest available balance per account updates `accounts.balance`, unless a newer balance is already stored.
7. Unmatched transactions appear on the SMS Sync screen so the user can fix account digits.

## Notifications

`src/features/dues/notifications.ts` (expo-notifications, local only; no push server)

- One Android channel, **Payment reminders**.
- For each pending due: reminders at 09:00 two days before and on the due date. Ids are stored on the due so edits cancel and reschedule them. A reconcile pass runs at most every 6 hours and on foreground.
- A weekly digest (Sunday 10:00) lists subscriptions unused for 30+ days and how much they cost.
- Check-in nudges (`src/features/nudges/`) at random times every 2–5 days.

## Price refresh

`src/features/investments/prices.ts`

- Runs on demand (and when prices are older than 6 hours). Stocks use the Yahoo Finance chart API (`RELIANCE.NS`), mutual funds use mfapi.in NAVs by AMFI scheme code, and gold is estimated from COMEX gold (`GC=F`) × USD/INR (`INR=X`) ÷ 31.1035 g.
- FD, RD, LIC and PPF values are computed locally (`calc.ts`).
- Failures are per holding; the old price stays.

## App lock

`src/features/lock/` uses `expo-local-authentication` to prompt for fingerprint, face or device PIN when the app opens or returns from the background, if the user turned on App lock. It gates the UI only; see [SECURITY.md](../SECURITY.md).

## Design tokens

`src/theme/tokens.js` is the single source for colours and fonts, used by `tailwind.config.js` (NativeWind classes) and TypeScript.

- Colours: `paper` `#c3c6b0` (main surface), `backdrop` `#9fa391`, bands `sage` `#65705f` / `deep` `#4a5244` / `forest` `#3d4438`, text `ink` `#1f231c` / `mute` / `faint`, accents `alert` `#e0714c` (dues, overruns, waste), `goal` `#dfc655` (savings), `gain` `#b9d39a`, `loss`.
- Fonts: Familjen Grotesk for text and headings, Chakra Petch for numbers.
