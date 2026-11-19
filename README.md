# ТърсяБГ · tursya.bg

A Bulgarian marketplace for local services. People post a task they need done (cleaning, repairs,
moving, lessons…), and professionals unlock the client's contact details with points.
Web app and an Android app (Capacitor; not yet published in Google Play), Bulgarian interface, prices in euro.

**Live:** [tursya.bg](https://tursya.bg)

## Features

- **Tasks:** posting with photos, automatic category suggestion, city and neighbourhood, budget or
  "price to be agreed". A task is live for 30 days; after 14 days the owner is asked whether it is
  still open.
- **Contacts and points:** a professional unlocks a client's phone number with points (at most
  5 professionals per task). Points are sold in packs: card payments on the web (Stripe), Google Play
  in the app (RevenueCat). Bonus points expire after 30 days; all points expire after 12 months
  without any activity, with a warning 7 days before.
- **Messages, reviews and notifications:** in-app, email and push notifications, saved task alerts.
- **Moderation:** automatic checks of photos and texts, manual review queue, reports, progressive
  sanctions.
- **Admin panel:** moderation, reports, refunds, revenue by month.
- **Privacy (GDPR):** full data export as JSON, account deactivation, account deletion with a
  14-day grace period.

## Tech stack

| Area | Tools |
|---|---|
| Frontend | React 19, TanStack Start and Router, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Supabase: PostgreSQL, Row Level Security, `SECURITY DEFINER` functions, triggers, `pg_cron`, Auth |
| Payments | Stripe (web), RevenueCat with Google Play Billing (Android) |
| Mobile | Capacitor 8 (Android) |
| Hosting and services | Vercel, Cloudflare (DNS, R2 photo storage), Resend (email), Firebase Cloud Messaging (push), Sentry (errors), Sightengine (image checks) |
| Testing and CI | Vitest, Playwright (UI and API tests), Azure DevOps daily pipeline, Postman, n8n |

## Security

- Row Level Security on every table. Sensitive columns, such as a user's points balance, are
  protected by database triggers, so they cannot be changed through the API even with a valid login.
- Phone numbers are shown only after an unlock; phone numbers and emails typed into public texts
  are masked automatically.
- Admin-only functions check the staff role in the database, not only in the interface.
- Tests run only against a separate test project; the test setup and the pipeline stop if they
  point at the live project.
- No passwords or keys in the repository: they live in Vercel, Azure secret variables and local,
  ignored files.

## Tests

38 Playwright tests (24 API tests without a browser, 14 UI tests) and Vitest unit tests.
They run every day in an Azure DevOps pipeline against the test project.

```bash
npm run test:unit                                    # unit tests
npx playwright test --project=chromium --reporter=list   # UI and API tests (needs .env.test)
```

## How it was built

The first version of the interface was generated with Lovable. Since then I have developed the
product step by step with an AI coding assistant (Claude): data model and security rules, points and
payments, moderation, notifications, the Android app, legal pages, tests and CI. I decide what to
build, review and run every change, and test it before it goes live.

## Development

Requirements: Node.js 22+ and npm.

```bash
npm ci
npm run dev
```

The app reads its Supabase URL and publishable key from environment variables
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Tests read their own values from `.env.test`,
which is never committed.

## API tests

**What:** Playwright API tests (`tests/api.spec.ts`, `tests/api-supabase.spec.ts`) call the backend over HTTP with Playwright's `request` context, without opening a browser. They cover:

- **Auth:** a wrong password is refused (400).
- **Row Level Security:** a signed-in user can read only their own private rows (profile, points history, phone); another user's rows come back empty; an admin can read them. A user cannot change their own points balance (403).
- **Roles:** an admin-only database function refuses a normal user (403) and works for an admin.
- **Input validation:** wrong or missing input returns the right status and error code (400 / 404 / 401).
- **Task lifetime:** a visitor cannot keep a task live (401) and a signed-in user cannot run the expiry sweep (403).
- **Public endpoints:** cron endpoints need a secret key, the Stripe webhook needs a valid signature, the contact form has a rate limit.
- **Response time:** each checked call must answer within 3 seconds.

**How to run:**

```bash
npx playwright test tests/api.spec.ts tests/api-supabase.spec.ts --project=chromium --reporter=list
```

They also run in the daily Azure DevOps pipeline together with the UI tests (JUnit results are published in the run).

**Safety:** the tests run only against the separate test Supabase project. `tests/load-env.ts` and a pipeline step stop the run if the URL points at the live project. Passwords and keys come from `.env.test` (never committed) or pipeline secret variables.

**Why:** the UI tests show that pages work; these tests show that the data layer itself is safe: the database rules hold even when someone calls the API directly, bypassing the website.

### Postman

`postman/tursya-api.postman_collection.json` holds three requests against the test project: sign in, read my own profile (RLS must return exactly one row) and try to change my own points balance (must be refused with 403 `PROTECTED_COLUMN`). Import it into Postman, create an environment with `supabase_url`, `anon_key`, `email` and `password` for the test project, then run the collection. The environment holds secrets and is never committed.

## Automation (n8n)

When the daily Azure pipeline finishes, it sends the Playwright JSON report to an n8n workflow. If any test failed, n8n posts a short summary to Telegram: counts, each failed test with the reason, flaky tests and a link to the run. If everything passed, nothing is sent.

Workflow (`automation/n8n/playwright-failures-telegram.json`):

1. **Webhook** receives the report (POST). The URL path is random and acts as the secret; it is stored in Azure as the secret variable `N8N_WEBHOOK_URL`.
2. **Code** (JavaScript, same code as `automation/n8n/summarize-report.js`) walks the nested report, collects failed and flaky tests, strips terminal colour codes and builds the message. It returns no items when nothing failed, so the next node does not run.
3. **Telegram** sends the message through a bot.

The pipeline step is skipped when `N8N_WEBHOOK_URL` is not set and never fails the build.

Secrets: the bot token lives in n8n credentials and is never exported. Before committing, the export is cleaned with `node automation/n8n/clean-export.mjs <download> automation/n8n/playwright-failures-telegram.json`, which replaces the webhook path and the chat ID with placeholders and refuses to save if anything private remains.

The workflow ran on an n8n Cloud trial instance; the exported workflow is kept here.

To try it: import the workflow into n8n, set your own path, chat ID and Telegram credential, then POST `automation/n8n/sample-playwright-report.json` to the webhook.

## Related

[tursya-angular](https://github.com/Oki022/tursya-angular): a small Angular app on the same Supabase
backend, built to learn Angular.
