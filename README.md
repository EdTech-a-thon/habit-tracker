# Daily Habits

A simple, private habit tracker for student habit-building projects. Students start with three daily habits, can add or remove habits as needed, mark their progress, and export their data as CSV for submission or safekeeping.

## Features

- No account, ads, or paid features
- Data stays in the browser's local storage
- Daily check-in cards, a mobile weekly view, and a desktop monthly grid
- Streaks and monthly completion rates
- One-to-six editable habits
- CSV export from the project's first day through today
- Responsive and keyboard-accessible interface

## Development

Built with Vite, Svelte 5, and TypeScript.

```bash
npm install
npm run dev
```

Validate and build:

```bash
npm run check
npm run build
```

Cloudflare Web Analytics is enabled in production when `VITE_CF_BEACON` is set. The deployment process supplies that public token; it is not needed for local development.

## Data format

The app stores one JSON object under `daily-habits-v1` in local storage. A CSV export contains one row per calendar day and one Yes/No column per active habit, followed by daily totals and a percentage.
