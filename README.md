# CHAOS CREW — The Secret Mission Game

CHAOS CREW is a real-time multiplayer party game where friends compete through secret missions, emoji challenges, and unexpected twists.

## Features

- Create a game room and invite friends using a room code.
- Join multiplayer rooms with a player name.
- Complete secret missions and participate in fast-paced rounds.
- Enjoy a dark, modern interface designed for a fun gaming experience.
- Uses React and Vite for the frontend and Supabase for multiplayer functionality.

## Tech Stack

- React
- Vite
- Supabase
- JavaScript
- CSS

## Run Locally

1. Install Node.js.
2. Clone the repository.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the project root with your Supabase configuration:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

## Build

Run the following command to create a production build:

```bash
npm run build
```

## Security

Keep `.env` out of version control. Never commit service-role keys or other secret credentials.