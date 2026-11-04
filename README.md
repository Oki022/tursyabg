# Tursyabg

Build a modern, intuitive, and mobile-first Service Task Board web application. 

CRITICAL REQUIREMENTS:

1. ALL user-facing text, UI elements, and mock data MUST be in BULGARIAN.

2. The currency must be Euro (€), placed after the number (e.g., 50 €).

3. NO "Professional Directory". This is purely a Task Board. Customers post tasks, and Workers browse them.

4. DO NOT use the word "Обява" (Ad/Listing). Use "Задача" (Task) or "Проект" (Project) instead to emphasize that this is about work/services, not selling items.

Core Concept: 

A platform where everyday people post tasks/projects they need done, and workers browse this feed to find tasks to execute.

Design System & UI:

- Clean, action-oriented, minimalist design (Tailwind CSS + Shadcn UI).

- Trustworthy colors (e.g., deep blue or slate with plenty of white space).

Key Features & Pages:

1. Homepage (Начална страница):

- Hero headline: "Какво трябва да се свърши днес?" (What needs to be done today?) OR "Имаш задача за вършене?" (Have a task to do?).

- Sub-headline: "Опиши задачата си и намери точния човек, който да я изпълни."

- A prominent search bar to find tasks.

- Two main CTA Buttons: "Възложи задача" (Assign a task / Post a task) and "Намери задачи" (Find tasks).

- A "Recent Tasks" section (Последни задачи) showing 4-6 cards of newly posted work.

2. Task Feed (Борса за задачи / Активни задачи - For workers):

- A page listing all available tasks.

- Task cards must display: Заглавие на задачата (Title), Категория (Category tag), Населено място (Location - Sofia, Plovdiv, Varna), Бюджет (Budget in €), and a "Кандидатствай" (Apply) or "Свържи се" (Contact) button.

- Sidebar filters: Категория, Населено място.

3. "Smart" Post a Task Form (Възложи задача):

- Form fields: Какво трябва да се направи? (Title), Категория (Category dropdown), Подробности за задачата (Description), Бюджет (€), Населено място.

- CRITICAL FEATURE (Auto-Categorization): Implement a simple React effect that auto-selects the Category based on keywords typed in the Title field. 

  * Example logic: If user types "баня" (bathroom) or "плочки" (tiles), auto-select "Ремонти" (Renovations). If they type "чистене" (cleaning), auto-select "Почистване".

- Show a subtle UI hint when auto-categorization happens (e.g., "Категорията е избрана автоматично според описанието").

- Submit button: "Публикувай задачата".

Please generate the complete frontend structure, routing, and interactive Bulgarian mock data. Use Lucide React icons for visual polish.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/233975ab-1dd4-439f-8c51-431acbafe057).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## API tests

**What:** Playwright API tests (`tests/api.spec.ts`, `tests/api-supabase.spec.ts`) call the backend over HTTP with Playwright's `request` context, without opening a browser. They cover:

- **Auth:** a wrong password is refused (400).
- **Row Level Security:** a signed-in user can read only their own private rows (profile, points history, phone); another user's rows come back empty; an admin can read them. A user cannot change their own points balance (403).
- **Roles:** an admin-only database function refuses a normal user (403) and works for an admin.
- **Input validation:** wrong or missing input returns the right status and error code (400 / 404 / 401).
- **Public endpoints:** cron endpoints need a secret key, the Stripe webhook needs a valid signature, the contact form has a rate limit.
- **Response time:** each checked call must answer within 3 seconds.

**How to run:**

```bash
npx playwright test tests/api.spec.ts tests/api-supabase.spec.ts --project=chromium --reporter=list
```

They also run in the daily Azure DevOps pipeline together with the UI tests (JUnit results are published in the run).

**Safety:** the tests run only against the separate test Supabase project. `tests/load-env.ts` and a pipeline step stop the run if the URL points at the live project. Passwords and keys come from `.env.test` (never committed) or pipeline secret variables.

**Why:** the UI tests show that pages work; these tests show that the data layer itself is safe — that the database rules hold even when someone calls the API directly, bypassing the website.

### Postman

`postman/tursya-api.postman_collection.json` holds three requests against the test project: sign in, read my own profile (RLS must return exactly one row) and try to change my own points balance (must be refused with 403 `PROTECTED_COLUMN`). Import it into Postman, create an environment with `supabase_url`, `anon_key`, `email` and `password` for the test project, then run the collection. The environment holds secrets and is never committed.
