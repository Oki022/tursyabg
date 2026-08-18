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
