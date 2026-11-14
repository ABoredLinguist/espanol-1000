# Español 1000

The top 1,402 Latin American Spanish words and phrases (plus the 100 most-used verbs) as an installable, offline-first web app: spaced-repetition flashcards, quizzes, verb-table drills, a placement test, and a searchable word list.

It began as a claude.ai artifact (kept in `reference/original-artifact.html`). This version:

- **Works anywhere:** it's a normal website, not tied to claude.ai.
- **Installs and works offline:** a PWA with a manifest and a service worker that caches the whole app and word list.
- **Uses better scheduling:** [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) replaces the simplified SM-2, so you need fewer reviews for the same recall.
- **Optional account sync:** sign in by email (Supabase) to sync progress between phone and computer.
- **Accepts your old backup codes:** codes from the original artifact restore here, and old cards are converted automatically.

## Run it on your Mac

Node.js 22 is installed in `~/.local/node`. Add it to your shell once:

```bash
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zprofile && source ~/.zprofile
```

Then:

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # data validation + unit tests + type-check
npm run build      # production build in dist/
npm run preview    # serve the build (http://localhost:4173)
```

## Turn on account sync (free)

1. Create a project at [supabase.com](https://supabase.com) (the free tier is plenty).
2. **SQL Editor → New query**: paste `supabase/schema.sql` and click **Run**.
3. **Authentication → URL Configuration**: set **Site URL** to your deployed address (e.g. `https://espanol-1000.netlify.app`). Add `http://localhost:5173` under **Redirect URLs** for local testing.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `.env.local` (copy `.env.example`), and into your hosting provider's environment variables.

Without these values the app still works. Progress stays on the device, and backup codes move it between devices.

## Deploy (free)

**Netlify:** push this folder to a GitHub repo, then **Add new site → Import from Git**. Use build command `npm run build` and publish directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Site settings → Environment variables**, then redeploy.

**Vercel:** the steps are the same (**Add New → Project**). It detects Vite automatically.

## Install on iPhone

Open the deployed site in **Safari**, tap **Share**, then **Add to Home Screen**. Open it once while online; after that it works offline.

## Move progress over from the claude.ai version

In the original artifact, open **Settings → Copy backup code**. In this app, open **Settings → Restore from code**, paste, and tap **Restore and merge**.

## Project layout

| Path | What it is |
| --- | --- |
| `src/data/words.json`, `verbs.json` | The word and verb lists (regenerate with `npm run extract-data`) |
| `src/lib/` | Pure logic: scheduling (`schedule.ts`), answer checking (`check.ts`), state and merging (`state.ts`), store, audio |
| `src/ui.ts` | Screen state and actions (sessions, quiz, drills) |
| `src/views/` | Preact screens |
| `src/sync.ts` | Supabase sign-in and sync |
| `scripts/validate-data.ts` | Checks every entry (ids, fill-in-the-blank ranges, verb tables) |
