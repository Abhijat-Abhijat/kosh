# Installing Kosh

This guide takes about 10 minutes. You don't need to be a developer, and you don't need an account anywhere: Kosh keeps all your data on your phone.

You need an Android phone (Android 8 or newer recommended) that receives your bank's SMS.

> **Important:** because everything stays on your phone, **if you lose or reset the phone without a backup, your Kosh data is gone.** There is no cloud sync and no sync between devices. See [Back up your data](#back-up-your-data).

---

## 1. Download the APK

1. On your phone, open **<https://github.com/Abhijat-Abhijat/kosh/releases/latest>**.
2. Under **Assets**, tap `kosh-<version>.apk` to download it.
   - Don't use a file ending in `-unsigned-debug.apk`; that's a test build.
3. Optional but recommended: check the download. Each APK has a matching `.sha256` file. On a computer, run `sha256sum kosh-<version>.apk` (Linux/macOS) or `certutil -hashfile kosh-<version>.apk SHA256` (Windows) and compare the result with the text in the `.sha256` file.

Only download Kosh from the official repository. An APK from anywhere else could be modified to steal your SMS.

## 2. Allow installing from your browser

Android blocks apps that don't come from the Play Store until you allow it.

1. Open the downloaded APK (from the browser's downloads or the **Files** app).
2. Android says *"For your security, your phone is not allowed to install unknown apps from this source."* Tap **Settings**.
3. Turn on **Allow from this source**, then go back.
4. Tap **Install**. If Play Protect warns that the app is unknown, tap **More details → Install anyway**. (Play Protect warns about every app not on the Play Store.)

You can turn **Allow from this source** off again afterwards.

## 3. Allow restricted settings (Android 13 and newer)

On Android 13+, apps installed from outside an app store can't be given SMS access until you allow "restricted settings". If the SMS permission is greyed out or you see *"Restricted setting – For your security, this setting is currently unavailable"*, do this:

1. Open **Settings → Apps → Kosh** (or long-press the Kosh icon → **App info**).
2. Tap the **⋮** menu in the top-right corner.
3. Tap **Allow restricted settings** and confirm with your fingerprint or PIN.
4. Go back to Kosh and grant the SMS permission again.

If you don't see **Allow restricted settings** in the menu, first try to grant the SMS permission once from inside Kosh (so Android blocks it), then come back to App info; the option appears after the first blocked attempt.

## 4. First run

Open Kosh and follow the on-screen setup. Kosh asks for these permissions; each one is explained in the app:

| Permission | Why | Needed? |
| --- | --- | --- |
| **SMS** | Reads bank/card/UPI SMS on the phone to log transactions. Nothing is uploaded. | Yes, for automatic expenses |
| **Usage access** | Sees when you last opened subscription apps (Netflix, Spotify, …) to flag unused ones. Opens a system settings screen; find **Kosh** and turn it on. | Optional |
| **Notifications** | Payment reminders, the weekly unused-subscription digest and occasional check-in nudges. | Recommended |

## 5. Add your accounts

Kosh matches each SMS to an account using the **last 4 digits** of the account or card number in the message.

1. Open **Accounts → Add**.
2. Add each bank account, credit card and debit card. Enter the **last 4 digits** exactly as they appear in your bank's SMS (for example `XX4821` → `4821`).
3. Optionally set the SMS sender (e.g. `HDFCBK`) to help when two accounts share the same digits.
4. Open **SMS Sync** and tap **Sync now**. The first sync looks back 90 days.

After that Kosh syncs automatically whenever you open it.

## 6. Turn on app lock

Open **Settings** and turn on **App lock**. Kosh will ask for your fingerprint, face or device PIN every time it opens.

App lock stops someone using your unlocked phone from opening Kosh. It doesn't encrypt your data; your phone's own screen lock and encryption do that. Use a strong screen lock.

## Back up your data

Do this regularly, and always before resetting or changing phones.

- **Export backup:** **Settings → Export backup** creates a `.json` file and opens the share sheet. Save it to Google Drive, the Files app, or a computer.
- **Restore from backup:** on a new phone, install Kosh, then **Settings → Restore from backup** and pick the file.
- **Erase all data:** **Settings → Erase all data** deletes everything Kosh stored on this phone. Uninstalling Kosh also deletes it.

> Backup files are **not encrypted**. They contain all your transactions, balances and the text of matched bank SMS. Keep them somewhere private and delete old ones you no longer need.

---

## Troubleshooting

### No transactions appear

- Check **SMS Sync**: does it say the SMS permission is granted? If not, grant it (see [step 3](#3-allow-restricted-settings-android-13-and-newer) on Android 13+).
- Tap **Sync now** and look at the result. If it read messages but parsed none, your bank's format probably isn't supported yet (next section).
- If transactions appear but under "unmatched", the last 4 digits on the account don't match the SMS. Edit the account so the digits match the message.
- Kosh only reads SMS from the last 90 days on the first sync.

### My bank's SMS format isn't supported

Open an **[SMS format request](https://github.com/Abhijat-Abhijat/kosh/issues/new?template=sms_format.yml)**. Include the bank name and a **redacted** sample: replace account digits, names, UPI IDs, reference numbers and amounts with made-up values, but keep the wording exactly. Never post a real, unredacted SMS; issues are public.

### SMS permission is greyed out or "restricted"

See [step 3](#3-allow-restricted-settings-android-13-and-newer).

### Reminders don't show up

- Make sure notifications are allowed: **Settings → Apps → Kosh → Notifications**, and the **Payment reminders** channel is on.
- Exempt Kosh from battery optimisation: **Settings → Apps → Kosh → Battery → Unrestricted** (the wording varies: "No restrictions", "Don't optimise").
- Some phones (Xiaomi/MIUI, Oppo/ColorOS, Vivo, Realme, OnePlus, Samsung) also kill background apps aggressively. Turn on **Autostart** for Kosh and lock it in the recent-apps screen. <https://dontkillmyapp.com> has steps for each brand.
- Reminders are scheduled on the phone. Open Kosh once after adding or changing a due so it can schedule them.

### Prices for stocks or mutual funds don't refresh

Price refresh needs an internet connection and uses Yahoo Finance and mfapi.in. Check that the symbol is right (e.g. `RELIANCE.NS` for NSE stocks, the AMFI scheme code for mutual funds) and try again later; these free services sometimes rate-limit.

### Updating Kosh

Download the newer APK from Releases and install it over the old one. Your data stays. Take a backup first anyway.
