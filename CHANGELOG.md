# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - Unreleased

First public release.

### Added

- On-device parsing of Indian bank, card and UPI transaction SMS: amount, direction, account/card last digits, merchant, available balance. OTPs, promotions, due reminders and failed/declined payments are ignored.
- Automatic SMS sync when the app opens (at most every 10 minutes) and a manual "Sync now", with matching to accounts by last 4 digits and SMS sender.
- Accounts for bank, credit card, debit card, cash and wallet, with balances updated from SMS.
- Transactions with automatic categories, manual entry and editing.
- Savings and investments: FD, RD, stocks, mutual funds, digital gold, LIC, PPF, with on-demand price refresh (Yahoo Finance, mfapi.in) and computed FD/RD values.
- Pending payments (dues) with local reminders two days before and on the due date, and recurring dues.
- Subscription tracking with Android usage access to flag apps unused for 30+ days, plus a weekly digest notification.
- Random-time check-in nudges every 2–5 days.
- App lock with fingerprint, face or device PIN.
- Export backup (JSON via the share sheet), restore from backup, and erase all data.
- All data stored locally in SQLite; no account or server.
- Release APKs with SHA-256 checksums on GitHub Releases.

[Unreleased]: https://github.com/Abhijat-Abhijat/kosh/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Abhijat-Abhijat/kosh/releases/tag/v0.1.0
