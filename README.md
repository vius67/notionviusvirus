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
3. Create a `.env.local` file:
   \`\`\`
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   \`\`\`
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
