# BEAM Portal

Student productivity app built with Next.js, Supabase, and a liquid glass UI.

## Features
- 📊 Dashboard — overview of everything
- 📚 Homework — track and manage homework
- ✓ To-do — Todoist-style task manager
- 📈 Past Papers — log papers with score charts
- ⏱ Study Timer — Pomodoro-style timer with session log
- 🗓 Calendar — Google Calendar-style event manager
- 📝 Notes — Notion-style note editor with autosave

## Setup

1. Clone the repo
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Copy `.env.local.example` to `.env.local` and fill in your Supabase project's URL, anon key, and service role key (Project Settings > API), plus a random `CRON_SECRET`
4. Run the SQL from `supabase/schema.sql` in your Supabase SQL editor
5. Run locally:
   \`\`\`bash
   npm run dev
   \`\`\`

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Sentral auto-sync

Connect once from the Timetable page (paste your Sentral session cookie) — after that, a scheduled job keeps your timetable/events fresh in the background, no manual re-sync or re-login needed.

To enable the background schedule, add these repo secrets under GitHub → Settings → Secrets and variables → Actions:
- `SENTRAL_SYNC_URL` — `https://<your-deployed-domain>/api/sentral/cron`
- `CRON_SECRET` — same random string you set in `.env.local` / Vercel env vars

`.github/workflows/sentral-sync.yml` pings that endpoint every 20 minutes.
