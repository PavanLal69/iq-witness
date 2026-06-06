# WitnessIQ — AI-Powered Incident Reconstruction Platform

WitnessIQ is a forensic evidence intelligence platform that automatically reconstructs incident timelines, maps entity relationships, and generates investigation reports from uploaded evidence files (video, audio, documents, chat logs).

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes (serverless — no separate server)
- **Database**: Firebase Firestore
- **File Storage**: Firebase Storage
- **Deployment**: Vercel

## Features

- 📁 **Evidence Vault** — Upload video, audio, PDF, chat logs, images
- ⏱ **AI Chronology** — Auto-generates timestamped incident timelines
- 🕸 **Relationship Board** — Interactive force-directed graph connecting suspects, organizations, locations
- ✏️ **Manual Connections** — Link any two entities manually with a custom relationship label
- 📄 **Report Export** — Generate investigation reports (police, legal, HR, insurance templates)
- 🔍 **Audit Ledger** — Full activity audit trail

## Getting Started (Local Development)

```bash
# 1. Clone the repo
git clone https://github.com/PavanLal69/iq-witness.git
cd iq-witness/frontend

# 2. Install dependencies
npm install

# 3. Set up Firebase credentials
cp .env.example .env.local
# Fill in your Firebase project values in .env.local

# 4. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import `iq-witness`
3. Set **Root Directory** to `frontend`
4. Add all environment variables from `.env.example` with your real Firebase values
5. Click **Deploy**

## Firebase Setup

In [Firebase Console](https://console.firebase.google.com/):
1. Enable **Firestore Database** → Start in test mode
2. Enable **Storage** → Start in test mode
3. Copy your Firebase config into `.env.local`

## Dataset Used

The **demo case (Case Beta)** is based on the **Enron Corporation corporate fraud scandal (2001)**:

- **Source**: Publicly available historical records, court documents, and the famous [Enron Email Dataset](https://www.cs.cmu.edu/~enron/) (Carnegie Mellon University)
- **Evidence files simulated**:
  - `skilling-lay-emails.txt` — Reconstructed internal communications between executives
  - `enron-whistleblower-memo.pdf` — Sherron Watkins' August 2001 memo to Kenneth Lay
  - `enron-stock-collapse.png` — ENE stock price chart (Jan–Dec 2001, $83 → $0.25)
  - `cctv-shredding-room.mp4` — Simulated CCTV footage of Arthur Andersen document shredding
  - `grubman-conference-call.wav` — Simulated analyst conference call audio

## License

MIT
