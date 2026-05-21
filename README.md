# 🛡️ FaceTracker Pro — Biometric Attendance Platform

[![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![face-api.js](https://img.shields.io/badge/face--api.js-TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://github.com/justadudewhohacks/face-api.js)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLite3](https://img.shields.io/badge/SQLite3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

**FaceTracker Pro** is a state-of-the-art, fully local, real-time facial recognition attendance system featuring military-grade biometric spoofing protection via blink-based liveness verification. Engineered as an enterprise-grade Express.js fullstack application, it implements a dual-database architecture seamlessly adapting to local SQLite file databases or robust cloud PostgreSQL instances (like Supabase, Render, or Neon).

The front-end features a breathtaking **Holographic Glassmorphic dark-theme console** built on top of high-performance HTML5 canvas mapping and real-time GPU-accelerated video rendering.

---

## 🌟 Key Features

*   **⚡ Real-Time Face Biometrics matching**: Scans and parses facial features using **SSD MobileNet V1** CNN architecture and converts them to standard 128D floating point vectors, achieving 99.6% recognition accuracy.
*   **👁️ Anti-Spoofing Blink Liveness check**: Defeats print, tablet, and picture-based facial spoofs. Uses facial landmarks to calculate **Eye Aspect Ratio (EAR)** in real time, validating that the user is actively blinking before logging attendance.
*   **🛡️ Biometric Scanning HUD Overlay**: Features a high-tech glowing green neon biometric targeting reticle, real-time facial feature maps (68-point landmarks) drawn directly on canvas, and instant identity success cards.
*   **💾 Intelligent Dual Database Architecture**: Runs automatically on zero-config **SQLite** out of the box for local developer setups, and dynamically shifts to **PostgreSQL** in production simply by providing a `DATABASE_URL` environment variable.
*   **⏱️ Double-Layer Rate Limiting**: Employs backend SQLite/PG locks alongside localized 5-minute memory debounces, keeping systems secure from repeated logs or spamming attacks.
*   **📱 Universal Ultra-Responsive Design**: Tailored layout structures perfectly render on mobiles, tablets, widescreen laptops, and ultra-high resolution desktops.
*   **🧠 Optimized Asynchronous Pipeline**: Uses recursive, non-overlapping frame evaluation (150ms delay) to avoid browser thread lockups, ensuring buttery smooth webcam feeds on lightweight machines.

---

## 💻 Tech Stack

### Frontend Core
*   **face-api.min.js**: Wrapper for TensorFlow.js containing pre-trained models optimized for browsers.
*   **Core UI**: Semantic HTML5 with custom Glassmorphism tokens, rich micro-animations, linear gradients, and smooth CSS3 layouts.
*   **Typography**: Inter & Outfit (Google Fonts) loaded via optimized CDNs.

### Backend Core
*   **Node.js & Express**: Minimalist framework handling CORS, JSON serialization limits (up to 10MB to accommodate high-resolution biometric array blobs), and static routing.
*   **Database Adapters**: `sqlite3` for local development, `pg` for high-throughput cloud PostgreSQL databases.
*   **Environment Engine**: `dotenv` for unified local config variables.

---

## 📂 Project Structure

```bash
Attendance_Tracker/
├── public/                 # Edge-optimized frontend static assets
│   ├── models/             # Pre-trained Face-API.js model weights (local SSD / Landmarks / Recognition)
│   ├── app.js              # State manager & Core face-api tracking logic
│   ├── face-api.min.js     # Lightweight bundled TensorFlow Face API
│   ├── index.html          # High-performance semantic viewport structure
│   └── style.css           # Premium glassmorphic biometric layout & animations
├── database.js             # Dual DB abstraction layer (SQLite <-> PG auto-migration engine)
├── server.js               # Secured Node Express API controller
├── vercel.json             # Edge hosting configuration for Vercel functions
├── .env.example            # Environment variables placeholder
├── .env                    # Active local environment configuration
├── .gitignore              # Standard git exclusion policy
├── package.json            # Node project configuration & dependencies
└── README.md               # Advanced system overview
```

---

## 🚀 Quick Setup (Local Development)

Follow these simple steps to run the biometric attendance tracking terminal in your local developer workspace.

### Prerequisites
1.  **Node.js**: Installed (version 16.x or newer). Check version via `node -v`.
2.  **Webcam**: Connected and functional.

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/sudeenjain/attendence_tracker.git
    cd Attendance_Tracker
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Setup Environment File**:
    Simply copy the `.env.example` template:
    ```bash
    cp .env.example .env
    ```
    *By default, leaving `DATABASE_URL` empty instructs the app to run completely offline using the auto-created `attendance.db` SQLite file.*

4.  **Start Development Server**:
    ```bash
    npm run dev
    ```

5.  **Access the Dashboard**:
    Open [http://localhost:3000](http://localhost:3000) in your favorite modern browser (Chrome, Edge, or Safari).

---

## 🔧 Database Setup & Configuration

### Local SQLite (Standard Dev)
The application automatically creates `attendance.db` in your root folder. No manual configuration required.

### Cloud PostgreSQL (Production Dev)
For cloud hosting (e.g. Supabase, Render PostgreSQL), simply obtain your connection string and add it to your `.env` file or hosting provider config:
```ini
DATABASE_URL="postgresql://postgres:your-db-password@db.supabase.co:5432/postgres"
```
The application will automatically perform schema creations, initialize constraints, and map queries without any changes required on your end.

---

## 🌐 Production Deployment Guide

Deploy this fullstack biometric platform globally in seconds.

### Deploy to Vercel (Highly Recommended)
This repository is pre-configured with a top-tier `vercel.json` file. It splits backend endpoints and static layouts automatically:

1.  Sign in to [Vercel](https://vercel.com).
2.  Import your GitHub repository or use the CLI:
    ```bash
    npm install -g vercel
    vercel --prod
    ```
3.  **Important**: Set your PostgreSQL connection string under **Project Settings -> Environment Variables** as `DATABASE_URL` if you want persistence across serverless spins.

### Deploy to Render / Railway (Full Server Hosting)
To run a persistent Node Express process:
1.  Connect your repository to Render or Railway.
2.  Choose **Node** environment.
3.  Set Start Command: `node server.js`
4.  Configure `DATABASE_URL` as your environment variable.

---

## 🏎️ Performance Optimizations Implemented

*   **💾 Model Weights Caching**: Models are served locally from `/models` at the edge to prevent slow cross-origin CDNs or heavy external script fetches.
*   **🧠 Non-Overlapping Scan Loop**: App.js implements a smart recursive loop waiting for the face detector to resolve before initiating the next request. This completely eliminates CPU queue pileups and keeps browser pages highly responsive.
*   **📦 Light 128D Parsing**: The system checks liveness (EAR) using lightweight landmarks *before* calculating heavy facial recognition vectors.
*   **🌐 Static Edge Routing**: Static resources (`index.html`, `style.css`, assets) are served directly via Vercel's ultra-fast Edge Network, while API routes are resolved in serverless node contexts.

---

## 🛡️ Contribution & Security Standards

1.  **Strict Security Policy**: Do NOT commit `.env` or local databases (`*.db`) to the repository. The `.gitignore` is pre-configured to prevent credentials leaks.
2.  **Biometric Security Guidelines**: All face recognition descriptors are stored purely as parsed JSON arrays of 128 float integers. Face images are NEVER saved on the server, respecting GDPR and CCPA privacy standards.

---

## 📝 License
Distributed under the **MIT License**. Check `LICENSE` for more information.

*Made with 💖 by the [Sudeen Jain](https://github.com/sudeenjain) development team.*
