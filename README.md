# Aristotle Store — Firebase + Vercel setup guide

This version uses Firebase (Firestore for the database, Firebase Auth for
the owner's login) and deploys to Vercel. Follow these steps in order.

## Part 1 — Create your Firebase project

1. Go to console.firebase.google.com, sign in with a Google account,
   click "Add project." Name it e.g. `aristotle-store`. You can skip
   Google Analytics if it asks.
2. Once created, click the **</> (web app)** icon on the project overview
   page to register a web app. Name it anything. Firebase will show you a
   block of config values (`apiKey`, `authDomain`, etc.) — keep this page
   open, you'll need it in Part 3.
3. In the left sidebar, go to **Build → Firestore Database → Create
   database**. Choose "Start in production mode" and pick a location
   close to your customers (e.g. a European or nearest available region).
4. In the left sidebar, go to **Build → Authentication → Get started**.
   Under the "Sign-in method" tab, enable **Email/Password**, and turn on
   the **"Email link (passwordless sign-in)"** toggle underneath it.
5. Still in Authentication, go to the **Settings** tab → **Authorized
   domains**, and add your future Vercel domain here once you have it
   (Part 5 tells you when to come back and do this).

## Part 2 — Add your mother as the owner

1. In Authentication → Users, click **Add user**.
2. Enter her real email address (a password is required by this screen,
   but it won't actually be used — the app signs her in with the emailed
   link instead, not a password). Anything meeting Firebase's minimum
   works here.

Only an email that exists in this Users list will be able to sign in as
the owner.

## Part 3 — Set your Firestore security rules

1. Go to **Firestore Database → Rules** tab.
2. Delete what's there and paste in the entire contents of
   `firestore.rules` from this project folder.
3. Click **Publish**.

## Part 4 — Add your Firebase keys to the project

1. Copy `.env.example` to a new file named `.env` in this folder.
2. Fill in the six `VITE_FIREBASE_*` values from the config block you saw
   in Part 1, step 2.
3. Leave `VITE_APP_URL` as-is for now — you'll update it in Part 5 once
   you have your real Vercel address.

## Part 5 — Deploy to Vercel

**Easiest path:**

1. Create a free account at vercel.com.
2. Install Vercel's command-line tool isn't required — instead, go to
   your Vercel dashboard → **Add New → Project → Import** and connect
   your GitHub account, then push this folder to a new GitHub repository
   (GitHub's website lets you drag-and-drop files to create one, no
   command line needed) and import that repo into Vercel.
3. When Vercel asks about environment variables during import, add all
   six `VITE_FIREBASE_*` values, plus `VITE_APP_URL` (you can leave this
   one blank for now — you'll add it next).
4. Click Deploy. Vercel gives you a live URL like
   `https://aristotle-store.vercel.app`.
5. Go back to **Vercel → your project → Settings → Environment
   Variables**, set `VITE_APP_URL` to that real URL, then redeploy
   (**Deployments → ⋯ → Redeploy**).
6. Go back to **Firebase → Authentication → Settings → Authorized
   domains** and add that same Vercel domain (without `https://`), e.g.
   `aristotle-store.vercel.app`. Without this step, the owner's login
   link will fail.

## Part 6 — Try it

- Open your live Vercel URL, tap "Log in by email link," enter your
  mother's email, and check that inbox — tapping the link should bring
  her straight back into the owner dashboard.
- From there, add a product or two (Catalog tab), then add a test
  customer (Customers tab), log out, and log in as that test customer to
  place an order.

## Honest limitations of this version

- **Customer passwords are stored as plain text** in Firestore, not
  encrypted. Fine to launch small with people you trust, but a developer
  should later move customer accounts onto Firebase Auth too (like the
  owner already is), so passwords are properly hashed.
- **The WhatsApp number is a placeholder** — open `src/App.jsx`, find
  `WHATSAPP_NUMBER` near the top, and replace it with the real number
  (country code + number, no spaces or `+`).
- **The customer "Forgot password" flow doesn't verify identity** —
  anyone who knows a customer's username can currently reset that
  customer's password. Fine for a small trusted customer base to start;
  flag it to a developer before this scales up.
- **The owner's login link only works on the same device/browser it was
  requested from** by default (Firebase stores the email locally to
  confirm it's really her). If she opens the email on her phone but
  requested the link from her laptop, the app will simply ask her to
  re-type her email to confirm — that's expected, not a bug.
