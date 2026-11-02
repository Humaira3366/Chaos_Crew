# CHAOS CREW — Multiplayer Game

A responsive emoji party game built with React, Vite, and Supabase Realtime.

## Important MVP note
This starter uses Supabase Realtime Broadcast/Presence. The room's host browser coordinates scoring and round progression, so keep the host tab open during the game. This is a quick prototype architecture, not a hardened production game server. Broadcast messages are not a secure boundary for secret information; don't use it for sensitive data.

## 1. Requirements
- Node.js 20.19+ or 22.12+
- A Supabase account/project
- GitHub account (optional, for easiest Vercel deployment)

## 2. Create a Supabase project
1. Open https://supabase.com and create a project.
2. Wait for provisioning to finish.
3. In the project dashboard, open **Project Settings → API** (or **API Keys**).
4. Copy the **Project URL** and the **publishable/anon key**. Never use a `service_role` key in frontend code.
5. This game uses Realtime channels and Presence; no database table or SQL migration is required for this prototype. Make sure Realtime is available for your project.

## 3. Run locally
Extract this folder, open a terminal in it, then run:

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your Supabase details:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Then start the app:

```bash
npm run dev
```

Open the local URL Vite prints (usually http://localhost:5173).

## 4. Test multiplayer
1. Open the local app in two different browsers/devices.
2. Enter different player names.
3. Player 1 creates a room and shares the code.
4. Player 2 enters the code and joins.
5. Host starts the game; both players choose an emoji.
6. Confirm the reveal and scores are the same on both devices.
7. Keep the host browser open throughout the session.

## 5. Deploy to Vercel
### GitHub route
1. Create a new GitHub repository named `chaos-crew`.
2. Upload the extracted project files or push the folder using Git.
3. In Vercel, choose **Add New → Project**, import the repository.
4. Framework preset: Vite (usually detected automatically).
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy. Open the Vercel URL and test using two devices.

### Local CLI route
```bash
npm install
npm run build
npm install -g vercel
vercel
```
Follow the prompts, then add the two environment variables in the Vercel project settings and redeploy.

## 6. Common issues
- **“Setup needed”**: `.env` is missing or the URL/key is incorrect. Restart `npm run dev` after editing `.env`.
- **Can't join**: confirm both devices are using the same deployed URL, the room code is exact, and the host tab is open.
- **Joiner stuck in lobby**: reload both clients and try again; this prototype is host-coordinated and is not designed to recover state after the host disconnects.
- **Deployment loads a 404 on refresh**: `vercel.json` includes a single-page-app rewrite.
- **Build fails**: check Node version, then run `npm install` again and `npm run build`.

## 7. Current rules
- 2–6 players
- Five rounds
- 20 seconds per round
- Unique emoji: 3 points
- Shared emoji: 2 points
- Unsubmitted choice: 0 points

The UI uses “secret mission” prompts as flavor text. Since this prototype broadcasts game state to all room participants, do not treat those prompts as confidential or anti-cheat protected.

## Project structure
```
chaos-crew/
├── index.html
├── package.json
├── vercel.json
├── .env.example
└── src/
    ├── App.jsx
    ├── main.jsx
    └── style.css
```
