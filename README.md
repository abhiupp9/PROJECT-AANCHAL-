# 🛡️ AANCHAL (आँचल) — AI-Powered Women's Safety & Health Ecosystem

<div align="center">

![AANCHAL Logo](https://img.shields.io/badge/AANCHAL-Women's%20Safety-ff6b9d?style=for-the-badge&logo=shield&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Frontend-646CFF?style=for-the-badge&logo=vite&logoColor=white)

**A comprehensive AI-powered safety and health ecosystem built for women's protection.**

[🔗 GitHub Repository](https://github.com/abhiupp9/PROJECT-AANCHAL-) • [📋 Report Bug](https://github.com/abhiupp9/PROJECT-AANCHAL-/issues) • [💡 Request Feature](https://github.com/abhiupp9/PROJECT-AANCHAL-/issues)

</div>

---

## 📖 What is AANCHAL?

**AANCHAL** stands for our **3H Core Safety Framework**:

| Letter | Module | Description |
|--------|--------|-------------|
| **A** | AI-Powered Voice Recognition | Background voice engine detecting "Help! Help! Help!" trigger |
| **A** | Automated Emergency Alert | Instant GPS location + multi-channel SOS SMS dispatch |
| **N** | Network of Local Volunteers | Real-time connection with police booths & volunteer safety nodes |
| **C** | Care-Centric Safe Corridors | Navigation optimized for CCTV density & street lighting |
| **H** | Help & Rapid Rescue | Emergency siren & police dispatch (1st H — **Help**) |
| **A** | Assistance for Safe Commute | GPS route tracking & deviation detection (2nd H — **Home**) |
| **L** | Life & Medical Health Card | Encrypted Medical Shield accessible to first responders (3rd H — **Health**) |

---

## ✨ Features

- 🎙️ **Voice Trigger** — Say *"Help! Help! Help!"* to silently dispatch SOS alerts
- 🤫 **Muffled Panic Detector** — AI audio sensor detects muffled Hmm-Hmm panic sounds even when mouth is covered
- 📍 **Live GPS Tracking** — Real-time satellite location with safe corridor overlay map
- 🗺️ **Safe Corridors Map** — Leaflet.js map showing CCTV cameras, police booths, and lighting levels
- 👥 **Emergency Contacts** — Add/remove trusted contacts who receive SOS SMS instantly
- 🏥 **Medical Shield Card** — AES-256 encrypted health card (blood group, allergies, medications)
- 🤝 **Volunteer Network** — Connect with nearby safety volunteers for real-time escort
- 🔐 **Secure Auth** — Login / Registration / Forgot Password with OTP verification

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Leaflet.js, Lucide Icons, CryptoJS |
| **Backend** | Node.js, Express.js |
| **Database** | Supabase (PostgreSQL) |
| **Styling** | Vanilla CSS (Glassmorphism Dark Theme) |
| **Maps** | Leaflet.js with OpenStreetMap |
| **Voice** | Web Speech API (SpeechRecognition) |
| **Audio** | Web Audio API (AnalyserNode for panic sound detection) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm v9+
- A [Supabase](https://supabase.com) account

### 1. Clone the Repository
```bash
git clone https://github.com/abhiupp9/PROJECT-AANCHAL-.git
cd PROJECT-AANCHAL-
```

### 2. Setup the Backend (Server)
```bash
cd server
npm install
```

Create your `.env` file from the example:
```bash
cp .env.example .env
```

Fill in your Supabase credentials in `server/.env`:
```env
PORT=5000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-supabase-api-key
```

Start the backend:
```bash
npm run dev    # Development (with auto-reload)
# or
npm start      # Production
```
> Backend runs on **http://localhost:5000**

### 3. Setup the Frontend (Client)
```bash
cd ../client
npm install
npm run dev
```
> Frontend runs on **http://localhost:5173**

---

## 🗄️ Database Setup (Supabase)

Run the SQL schema in your Supabase SQL Editor:

```bash
# File: server/schema.sql
```

Tables created:
- `users` — User accounts
- `emergency_contacts` — Saved SOS contacts
- `otp_store` — OTP records for password reset
- `distress_alerts` — Log of triggered SOS events

> ⚠️ **Note:** Without valid Supabase credentials, the app automatically falls back to in-memory storage so you can still test locally.

---

## 📁 Project Structure

```
PROJECT-AANCHAL-/
├── client/                   # React + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth.jsx         # Login / Register / Forgot Password
│   │   │   ├── Dashboard.jsx    # Main App Dashboard (all features)
│   │   │   └── AcronymInfo.jsx  # AANCHAL mission modules panel
│   │   ├── utils/
│   │   │   ├── voiceListener.js  # Web Speech API voice trigger
│   │   │   └── hmmDetector.js    # Audio panic sound detector
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css            # Glassmorphism dark theme
│   ├── index.html
│   └── vite.config.js
│
├── server/                   # Node.js + Express Backend
│   ├── server.js                # All API routes
│   ├── supabaseClient.js        # Supabase connection
│   ├── schema.sql               # Database schema
│   ├── .env.example             # Environment template
│   └── package.json
│
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health-check` | Server health status |
| `POST` | `/api/register` | User registration |
| `POST` | `/api/login` | User login |
| `POST` | `/api/forgot-password` | Send OTP to phone |
| `POST` | `/api/verify-otp` | Verify OTP |
| `POST` | `/api/reset-password` | Reset password after OTP |
| `GET` | `/api/contacts` | Get emergency contacts |
| `POST` | `/api/contacts` | Add emergency contact |
| `DELETE` | `/api/contacts/:id` | Remove emergency contact |
| `GET` | `/api/safe-corridors` | Get safe corridor map data |
| `POST` | `/api/alert` | Trigger SOS distress alert |
| `POST` | `/api/upload-recording` | Upload panic audio recording |

---

## 🔒 Security

- Medical Shield Card data is encrypted client-side using **AES-256 (CryptoJS)** — never stored unencrypted
- Passwords are currently stored as plaintext — **production deployment should use bcrypt hashing**
- OTP expires after **10 minutes**
- Supabase RLS (Row Level Security) can be configured for production

---

## 📜 License

This project is built for social good. All rights reserved © AANCHAL Project 2025.

---

<div align="center">
Made with ❤️ to keep women safe
</div>
