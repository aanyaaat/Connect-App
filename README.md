# Aanya & Me — Mobile & Web Connect App ❤️

> A tiny, private connection button and real-time status tracker for two. Just one tap away.

---

## 📱 How to Run & Use on Mobile & Web

### 1. Quick Start (Local Development)

To start the app on your computer:
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### 2. Testing on Your Mobile Phone (Same Wi-Fi)

You can run the app directly on your phone and your partner's phone on your local network:

1. Start Vite with the `--host` flag:
   ```bash
   npm run dev -- --host
   ```
2. Terminal will display a Network URL, e.g.:
   ```text
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://192.168.1.XX:5173/
   ```
3. Open `http://192.168.1.XX:5173/` in Safari (iOS) or Chrome (Android) on your mobile phone.

---

### 3. Install as a Native-Feeling Mobile App (PWA)

This app is configured as a Progressive Web App (PWA) with app icons, splash theme colors, and full-screen standalone mode.

#### 🍏 On iPhone / iPad (iOS Safari):
1. Open the app URL in **Safari**.
2. Tap the **Share** button (the square icon with an arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**. The app will now appear on your home screen with the custom heart icon and run in borderless, full-screen mobile app mode.

#### 🤖 On Android (Chrome / Brave / Edge):
1. Open the app URL in **Chrome**.
2. Tap the **three-dots menu (⋮)** in the top right corner.
3. Tap **"Add to Home screen"** or **"Install app"**.
4. The app will be installed directly onto your phone's app drawer and home screen.

---

## 🗄️ Supabase Setup Guide (Realtime & Auth)

To enable real-time messaging, user authentication, arrival detection, and pairing between two accounts:

### Step 1: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a free account.
2. Click **"New Project"**, give it a name (e.g. `connect-app`), set a database password, and choose your region.

### Step 2: Run the Database Schema
1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
2. Click **"New Query"**.
3. Open the file [`supabase/schema.sql`](./supabase/schema.sql) in this repo, copy its entire contents, paste it into the Supabase SQL Editor, and click **Run**.
4. This will set up all tables (`profiles`, `connections`, `places`, `quick_messages`, `events`), Row Level Security policies, user triggers, and enable Postgres Realtime.

### Step 3: Add Your Supabase Keys to `.env`
1. In your Supabase project dashboard, go to **Project Settings (gear icon) -> API**.
2. Copy the **Project URL** and the **`anon` `public` key**.
3. Open the `.env` file in the root of this project and fill them in:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
   ```
4. Restart your dev server (`npm run dev`).

---

## 🚀 Pairing & How to Use the App

1. **User 1 (You)**:
   - Open the app, tap **Get Started**, sign up with your email & name.
   - On the connection screen, tap **Create pairing code** (e.g., `AANYA-4821`).
   - Share this code with Aanya.

2. **User 2 (Aanya)**:
   - Open the app on her phone, tap **Get Started**, sign up with her email & name.
   - On the connection screen, enter the pairing code `AANYA-4821` and tap **Join connection**.

3. **Instant Realtime Connection**:
   - Both users are now paired!
   - Tap quick actions (e.g. "I'm ready", "On my way", "Thinking of you", custom messages) to send instant updates.
   - Use the **SOS** button for high-priority emergency alerts with coordinates.
   - Add saved places in **Places 📍** to automatically trigger arrival/departure notifications.
   - Customize appearance (Dark/Light mode, Rose, Burgundy, Lavender, Sage, Amber, Ocean accents) in **Settings ⚙️**.

---

## 🌐 Free 24/7 Cloud Deployment (Optional)

To keep the app accessible anytime from anywhere without keeping your computer on:

### Deploy with Vercel (Recommended):
1. Push your repository to GitHub.
2. Go to [https://vercel.com](https://vercel.com) and import your repo.
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy**. Vercel will give you a live HTTPS URL (e.g., `https://aanya-and-me.vercel.app`) that you and your partner can install on your phones!
