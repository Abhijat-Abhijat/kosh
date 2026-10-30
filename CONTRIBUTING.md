# Contributing to Kosh

Thanks for helping. Kosh is a small project, so keep changes focused and easy to review.

## Ground rules

- **Never paste real SMS, account numbers, names, phone numbers or balances** into issues, pull requests, tests or commit messages. Use synthetic data (see below).
- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Security problems go through a private advisory, not a public issue. See [SECURITY.md](SECURITY.md).

## Setup

You need Node 20+ (CI uses Node 24), JDK 17 and the Android SDK. Full details in [docs/BUILDING.md](docs/BUILDING.md).

```bash
git clone https://github.com/Abhijat-Abhijat/kosh.git
cd kosh
npm ci
npx expo run:android   # builds a development build and installs it on a connected phone/emulator
```

Expo Go will not work: SMS reading and usage stats need the native module in `modules/kosh-native`.

Before writing code against an Expo or React Native API, read `AGENTS.md`: Expo changes between SDKs, so check the docs for SDK 58. Install new packages with `npx expo install <pkg>`, not `npm install`, so versions match the SDK. Never edit `android/` or `ios/` by hand; they are generated. Configure native behaviour through `app.json` and config plugins.

## Checks

Run these before opening a pull request. CI runs the same ones.

```bash
npm run typecheck
npm run lint
npm test
```

## Branches and pull requests

1. Fork the repo and create a branch from `main`: `feat/short-name`, `fix/short-name`, `docs/short-name`.
2. Make your change with tests where it makes sense (parsers, calculations and date logic always need them).
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(sms): parse Kotak credit card spends`
   - `fix(dues): keep reminder when the amount changes`
   - `docs: clarify restricted settings step`
   - Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.
4. Open a pull request against `main` and fill in the template. Link the issue it closes.
5. A maintainer reviews it. Keep the PR to one topic; follow-ups can go in another PR.

User-visible changes should also add a line under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md).

## Adding a bank SMS format

The parser is pure TypeScript in `src/features/sms/parser.ts`. It takes an SMS body and the time it was received and returns `{ amount, direction, last4?, merchant?, availableBalance?, kind, occurredAt }`, or `null` for anything that isn't a completed transaction (OTPs, promos, due reminders, declined or failed payments).

1. **Make a synthetic sample.** Start from the real message's *structure*, then replace every personal detail:
   - account/card digits → `4821`, `1234`, `9087` or similar made-up values
   - names, VPAs → `RAVI KUMAR`, `ravi.k@okicici`
   - reference numbers → random digits
   - amounts and balances → made-up values
   - keep the bank's wording, punctuation, abbreviations (`A/c`, `Avl Bal`, `Info:`) and sender style exactly as they are, since that is what the parser has to handle.
2. **Add a failing test** to `src/features/sms/__tests__/parser.test.ts`. Add a case to the `transactions` array (or `rejects` for a message that must be ignored):

   ```ts
   {
     name: 'Example Bank debit card POS',
     body: 'Rs.689.40 spent on Example Bank Debit Card xx9087 at DMART AVENUE on 11-10-26. Avl bal: Rs.23,456.10',
     expect: { amount: 689.4, direction: 'debit', last4: '9087', merchant: 'DMART AVENUE', availableBalance: 23456.1, kind: 'card' },
   },
   ```

3. Run `npx jest src/features/sms` and watch it fail.
4. **Change the parser as little as possible**: usually a new word in `DEBIT_WORDS`/`CREDIT_WORDS`, a new merchant pattern in `DEBIT_MERCHANT`/`CREDIT_MERCHANT`, or a new `REJECT` rule. Patterns are ordered; the first acceptable match wins.
5. Run the whole SMS suite again (`npx jest src/features/sms`) so existing banks still pass.
6. If the sender ID matters for account matching, see `src/features/sms/match.ts` and its tests.

Can't code it yourself? [Open an SMS format request](https://github.com/Abhijat-Abhijat/kosh/issues/new?template=sms_format.yml) with a redacted sample instead.

## Reporting bugs and ideas

Use the [issue templates](https://github.com/Abhijat-Abhijat/kosh/issues/new/choose). Include your Kosh version (the release you installed), Android version and phone model.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
