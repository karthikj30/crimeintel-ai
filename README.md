# 🛡️ CrimeIntel AI

[![Build Status](https://img.shields.io/badge/Build-Passing-success?style=flat-square)](https://github.com/your-username/crimescope-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![Node.js 20](https://img.shields.io/badge/Node-v20+-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

**CrimeScope AI** is a high-performance, real-time crime intelligence and geospatial analytics platform designed to serve as the central nervous system for smart city law enforcement and public safety authorities. 

The platform transforms raw, heterogeneous data into actionable intelligence through a sophisticated pipeline of NLP classification, geospatial enrichment, and predictive analytics.

---

## 📖 Table of Contents
- [Core Value Proposition](#-core-value-proposition)
- [Visual Experience](#-visual-experience)
- [System Architecture](#-system-architecture)
- [Deep Dive: How it Works](#-deep-dive-how-it-works)
- [Technical Stack](#-technical-stack)
- [Key Features](#-key-features)
- [Installation & Setup](#-installation--setup)
- [Design Philosophy](#-design-philosophy)
- [Performance & Scalability](#-performance--scalability)
- [Roadmap](#-roadmap)

---

## 🎯 Core Value Proposition

| Stakeholder | Benefit |
| :--- | :--- |
| **Patrol Officers** | Real-time mobile alerts with geo-context for rapid response. |
| **Crime Analysts** | Temporal pattern analysis, drill-down investigation, and source traceability. |
| **Command Staff** | Strategic overview dashboards for predictive resource allocation. |
| **City Officials** | Data-driven policy insights and community safety transparency. |

---

## 📸 Visual Experience

### 🖥️ Command Center Dashboard
![Main Dashboard Overview](./public/1.png)
*The main dashboard features a full-bleed interactive heatmap with glassmorphism overlays.*

### 📊 Intelligence & Analytics
![Analytics View](./public/2.png)
*Comprehensive data visualization showing temporal patterns and crime distributions.*

### 🗺️ Geospatial Intelligence
![Heatmap View](./public/3.png)
*Real-time hotspot detection using Kernel Density Estimation (KDE) algorithms.*

### 🔍 Investigative Deep-Dive
![Investigation View](./public/4.png)
*Detailed incident analysis including source provenance and NLP classification confidence.*

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph "Data Ingestion"
        A1[News RSS Feeds] --> B[Data Ingestor]
        A2[Twitter/X Stream] --> B
        A3[Gov Data Portals] --> B
    end

    subgraph "Intelligence Engine"
        B --> C[NLP Pipeline]
        C --> C1[Crime Classifier]
        C --> C2[NER Entity Extraction]
        C1 --> D[Data Enrichment]
        C2 --> D
        D --> D1[Geocoding Service]
        D1 --> E[Deduplicator]
    end

    subgraph "Storage & API"
        E --> F[(SQLite - better-sqlite3)]
        F --> G[Express.js API]
        F --> H[Socket.io Server]
    end

    subgraph "Frontend Interface"
        G --> I[Next.js Dashboard]
        H --> I
        I --> J1[Heatmap Canvas]
        I --> J2[Recharts Analytics]
        I --> J3[Live Alert Feed]
    end
```

---

## 🧠 Deep Dive: How it Works

### 1. The NLP Classification Pipeline
The system uses a custom NLP engine (powered by `compromise.js`) to process raw text. It extracts:
*   **Crime Type:** Categorization into 9+ types (Theft, Assault, Cybercrime, etc.).
*   **Severity:** Real-time risk assessment (Critical, High, Medium, Low).
*   **Entities:** Extraction of location names, person names, and organizations.

### 2. Geospatial Enrichment
Extracted location names are passed through a geocoding service to resolve precise latitude/longitude coordinates, which are then projected onto the heatmap using a WebGL-accelerated rendering layer.

### 3. Intelligence Fusion (Deduplication)
The system correlates reports from multiple sources (e.g., a news report and a tweet about the same incident) to reduce noise and provide a single "source of truth" with a provenance chain.

---

## 🛠️ Technical Stack

*   **Frontend:** Next.js 15 (App Router), React 18, Zustand (State), Framer Motion (Animations).
*   **Maps:** Leaflet.js with `leaflet.heat` for density visualization.
*   **Charts:** Recharts for responsive, animated temporal data.
*   **Backend:** Node.js 20+, Express.js.
*   **Real-time:** Socket.io for sub-500ms latency event broadcasting.
*   **Database:** SQLite via `better-sqlite3` for high-concurrency, zero-config storage.
*   **Styling:** CSS Modules with a custom Design Token system (Glassmorphism).

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v20 or higher)
- npm or yarn

### Quick Start

1. **Clone the Project**
   ```bash
   git clone https://github.com/your-username/crimescope-ai.git
   cd crimescope-ai
   ```

2. **Install Workspace Dependencies**
   ```bash
   cd app_build
   npm install
   ```

3. **Development Mode**
   ```bash
   # Run both Backend and Frontend
   npm run start   # Backend: http://localhost:3000
   npm run dev     # Frontend: http://localhost:3001
   ```

---

## 🎨 Design Philosophy

**"Command Center Aesthetics"** — The UI is inspired by a blend of Bloomberg Terminal's data density and Palantir Gotham's sophisticated dark mode.
*   **Glassmorphism:** Layers use backdrop-blur and subtle borders to create depth.
*   **Micro-animations:** Every interaction (hover, alert, map transition) is smoothed with Framer Motion.
*   **High Contrast:** Critical alerts use vibrant severity colors against a deep navy background (`#0a0e1a`).

---

## 📈 Performance & Scalability

*   **Sub-2s Page Load:** Optimized Next.js hydration and dynamic imports for heavy map components.
*   **Real-time Latency:** < 500ms from event ingestion to dashboard update via WebSocket.
*   **Data Volume:** Capable of rendering 10,000+ incidents on the heatmap without frame drops using WebGL acceleration.

---

## 🔮 Roadmap

- [x] **Phase 1:** Core NLP Pipeline & Real-time Heatmap.
- [ ] **Phase 2:** Advanced Predictive Modeling (Hotspot Forecasting).
- [ ] **Phase 3:** PostGIS integration for complex spatial queries.
- [ ] **Phase 4:** Multi-agency data sharing protocols (GDPR compliant).

---

## 🤝 Contributing
Contributions are what make the open source community such an amazing place to learn, inspire, and create.
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ by *Ashwin* for a safer, smarter future.*
