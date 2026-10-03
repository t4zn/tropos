# EXUR — Step-by-Step Implementation Specification
> **Clean Air & Climate Resilience Platform**  
> Built for Hacktoberfest Hack Day Indore (PyData Indore x MLH) | Challenge 01: Best Use of Gemma 4 | Apple Design System

---

## System Vision & Design Architecture

Exur is a hyper-local atmospheric intelligence platform engineered for Indian economic corridors (Indo-Gangetic Plain, Delhi-NCR, Indore). It combines citizen sensing, ISRO geostationary satellite telemetry, inverse atmospheric physics, and Google Gemma 4 into an actionable enforcement and forecasting hub.

### Visual Design Integrity (`DESIGN.md` — Apple Design System)
The entire application strictly follows the Apple Design System specification:
* **Canvas Modes:**
  * **Pure White Canvas** (`#ffffff` — `--color-canvas`): Clean, photography-first product hero tiles.
  * **Parchment Canvas** (`#f5f5f7` — `--color-canvas-parchment`): Signature off-white for utility cards and footer.
  * **Near-Black Tile Surface** (`#161617` / `#272729` — `--color-surface-tile-1`): Deep dark tiles for telemetry and scientific simulations.
* **Interactive Color:**
  * **Action Blue** (`#0066cc` — `--color-primary`, focus `#0071e3`, on dark `#2997ff`): Single interactive color for all pill CTAs and links.
* **Rich Spacing Architecture:**
  * Generous tile padding: `--spacing-section-rich: 120px` and `--spacing-section: 88px`.
  * Tiles stack edge-to-edge with 0 gap; the surface color change itself creates the natural section divider.
* **Typography (SF Pro Stack):**
  * `hero-display`: 56px / 600 weight / line-height 1.07 / letter-spacing -0.28px.
  * `display-lg`: 40px / 600 weight / line-height 1.10.
  * `lead`: 28px / 400 weight / line-height 1.14.
  * `body`: 17px / 400 weight / line-height 1.47 (Apple's signature 17px body).
  * `nav-link` & `fine-print`: 12px / 400 weight.
* **Elevation:**
  * Exactly one drop shadow in the system: the signature Apple product drop shadow (`rgba(0, 0, 0, 0.16) 0px 10px 36px 0px`) used on elevated cards resting on a surface.

---

## Step-by-Step Implementation Plan

Follow this sequential checklist to implement, verify, and demo every feature of Vayu:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   VAYU STEP-BY-STEP EXECUTION PIPELINE                 │
├────────────────────────────────────────────────────────────────────────┤
│  STEP 1: Apple Design System & Token Foundation (globals.css)          │
│  STEP 2: Atmospheric Data Engine & Corridor Graph (airData.ts)         │
│  STEP 3: Apple Navigation System (Global Nav + Frosted Sub-Nav)        │
│  STEP 4: Hero Product Tile & Live Corridor Air-Shed Map                │
│  STEP 5: Innovation 1 — ISRO INSAT-3DR 15-Min Geostationary Scanner    │
│  STEP 6: Innovation 2 — Inverse Ray-Tracing Source Attribution Cone    │
│  STEP 7: Innovation 3 — Smartphone Camera Exposure Radiometry Analyzer │
│  STEP 8: Sovereign Federated Action Console & GRAP Trigger Hub         │
│  STEP 9: Performance Audit, $0 Cost Verification & Build Testing       │
│  STEP 10: 2-Minute Gemma 4 Hackathon Pitch Script & Live Walkthrough   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### STEP 1: Apple Design System & Token Foundation
* **File:** [`src/app/globals.css`](file:///Users/mac/Documents/vayu/src/app/globals.css) & [`src/app/layout.tsx`](file:///Users/mac/Documents/vayu/src/app/layout.tsx)
* **Objective:** Establish the design system tokens, typography ladder, and rich spacing layout rules.
* **Implementation Checklist:**
  - [x] Configure CSS custom properties for Apple colors: Action Blue (`#0066cc`), Pure White (`#ffffff`), Parchment (`#f5f5f7`), Near-Black (`#161617`), and Ink (`#1d1d1f`).
  - [x] Set up rich spacing constants: `--spacing-section-rich: 120px`, `--spacing-section: 88px`, `--spacing-xl: 32px`.
  - [x] Define button components: `.button-primary` (Action Blue pill), `.button-secondary-pill` (ghost blue pill), `.button-dark-utility` (black utility pill).
  - [x] Implement edge-to-edge product tile classes: `.product-tile-light`, `.product-tile-dark`, and `.product-tile-parchment`.
  - [x] Integrate font fallbacks in `layout.tsx` (`-apple-system`, `SF Pro Display/Text`, with `Inter` fallback).

---

### STEP 2: Atmospheric Data Engine & Corridor Graph
* **File:** [`src/data/airData.ts`](file:///Users/mac/Documents/vayu/src/data/airData.ts)
* **Objective:** Build a realistic, authentic Indian dataset modeling the Indo-Gangetic and Delhi-NCR economic corridors.
* **Implementation Checklist:**
  - [x] Define the `StationData` schema (coordinates, CPCB macro stations, hyper-local hotspots, PM2.5, AQI, wind vectors).
  - [x] Populate official CPCB baseline stations: Anand Vihar, Mandir Marg, Gurugram CyberCity, Noida Sector 62.
  - [x] Populate hyper-local micro-hotspots: Mundka Pyrolysis Zone, Jhajjar Brick Kiln Belt, Ghazipur Smolder Core.
  - [x] Populate the 15-minute INSAT-3DR geostationary time-series matrix comparing NASA FIRMS 1:30 PM (0 fires) vs ISRO 5:45 PM (420-acre evening flare).
  - [x] Add smartphone radiometry calibration presets (Clear Sky, Twilight Stubble Smoke, Industrial Smog).

---

### STEP 3: Apple Navigation System
* **Files:** [`src/components/Navigation.tsx`](file:///Users/mac/Documents/vayu/src/components/Navigation.tsx) & [`src/app/page.tsx`](file:///Users/mac/Documents/vayu/src/app/page.tsx)
* **Objective:** Build a single unified, ultra-clean frosted glass Apple navigation bar.
* **Implementation Checklist:**
  - [x] **Single Unified Nav:** Clean 52px frosted bar (`rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(20px)` and subtle `1px solid rgba(0,0,0,0.08)` hairline border).
  - [x] **Left Cluster:** Vayu atmospheric ring glyph + "Vayu" branding + "Indo-Gangetic Corridor" tag.
  - [x] **Center Links:** Quiet navigation links (`Overview`, `Corridor Map`, `INSAT-3DR`, `Attribution`, `Radiometry`, `AI Advisor`) with active scroll spy.
  - [x] **Right Cluster:** Live green telemetry status (`● ISRO 74°E`) + Action Blue pill CTA (`Live Air-Shed`).

---

### STEP 4: Hero Product Tile & Live Corridor Air-Shed Map
* **Files:** [`src/app/page.tsx`](file:///Users/mac/Documents/vayu/src/app/page.tsx)
* **Objective:** Create a museum-grade product presentation hero tile resting on the pure white canvas.
* **Implementation Checklist:**
  - [x] Eyebrow: `Clean Air & Climate Resilience` (17px / 600 weight).
  - [x] Hero Display: `Air. Measured to the meter.` (56px SF Pro Display tight tracking).
  - [x] Lead: Highlighting federated atmospheric intelligence for economic corridors (28px lead).
  - [x] Action CTA pair: Primary Blue pill (`Explore Corridor Map`) + Ghost Blue pill (`The 3 Innovations →`).
  - [x] **Elevated Corridor Card:** Card with signature Apple product drop shadow (`0px 10px 36px rgba(0,0,0,0.16)`) featuring:
    - Live wind vector status (`4.8 km/h NW`).
    - Interactive grid of CPCB stations vs hyper-local hotspots.
    - Click-to-inspect node panel displaying acute PM2.5 delta and initial attribution hint.

---

### STEP 5: Innovation 1 — ISRO INSAT-3DR 15-Min Geostationary Scanner
* **Files:** [`src/app/page.tsx`](file:///Users/mac/Documents/vayu/src/app/page.tsx)
* **Objective:** Demonstrate the satellite blind spot breakthrough on the dark canvas (`#161617`).
* **Implementation Checklist:**
  - [x] Introduce Dark Apple canvas with pure white headline: *"Three breakthroughs. Zero cloud cost."*
  - [x] Build interactive 15-minute cadence timeline selector (13:30, 15:00, 16:45, 17:45, 19:30).
  - [x] Dynamic comparison box contrasting:
    - **NASA FIRMS Polar View (1:30 PM):** 0 fires detected (polar satellite overpass blind spot).
    - **ISRO INSAT-3DR Geostationary View (5:45 PM):** High-intensity AOD spike (420-acre twilight evasion burn captured).
  - [x] Narrative notes explaining why geostationary monitoring is superior to polar LEO satellites for evening emissions.

---

### STEP 6: Innovation 2 — Inverse Ray-Tracing Source Attribution Engine
* **Files:** [`src/app/page.tsx`](file:///Users/mac/Documents/vayu/src/app/page.tsx)
* **Objective:** Provide actionable administrative accountability through backward wind trajectory physics.
* **Implementation Checklist:**
  - [x] Connect the selected hotspot from Step 4 directly into the physics simulator.
  - [x] Render the terminal-style physics computation box:
    - Wind vector components ($u, v$ speed and heading).
    - Planetary boundary layer (PBL) inversion height ($140\text{ m}$).
    - Computed upwind source cluster name (e.g. *Mundka Industrial Sector 4 Foundry Ring*).
    - Physical distance ($2.4\text{ km}$) and direction ($WNW$).
    - Mathematical confidence score ($91\%$).
  - [x] Direct bridge link to the inter-state enforcement console.

---

### STEP 7: Innovation 3 — Smartphone Camera Exposure Radiometry Analyzer
* **Files:** [`src/app/page.tsx`](file:///Users/mac/Documents/vayu/src/app/page.tsx)
* **Objective:** Enable zero-hardware citizen ground sensing using browser-based EXIF exposure value math ($0 cost).
* **Implementation Checklist:**
  - [x] Implement the physical Exposure Value formula:
    $$EV = \log_2\left(\frac{N^2}{t}\right) - \log_2\left(\frac{S}{100}\right)$$
  - [x] Interactive sample selector: *Clear Sky Calibration*, *Twilight Stubble Smoke*, and *Industrial Smog*.
  - [x] Display real-time calculated metrics: Exposure Value ($EV$), Particulate Matter equivalent ($\mu\text{g/m}^3$), and Anti-Spoofing Trust Score ($91\%$).
  - [x] Emphasize $0 API cost and client-side execution.

---

### STEP 8: Sovereign Federated Action Console & GRAP Trigger Hub
* **Files:** [`src/app/page.tsx`](file:///Users/mac/Documents/vayu/src/app/page.tsx)
* **Objective:** Solve the inter-state political blame game on the Apple Parchment canvas (`#f5f5f7`).
* **Implementation Checklist:**
  - [x] Render the 18px rounded utility card (`.store-utility-card`).
  - [x] Multi-state sovereign node tabs: **Delhi NCT**, **Haryana**, and **Uttar Pradesh**.
  - [x] Display Zero-Knowledge (ZK) Compliance Proof metrics showing verified progress without exposing raw farm/factory telemetry.
  - [x] Interactive **Rapid Action Trigger**:
    - One-click simulation dispatching municipal water mist cannons and posting highway freight advisories.
    - Live confirmation feedback banner with dispatch audit log.

---

### STEP 9: Performance Audit, $0 Cost Verification & Build Testing
* **Objective:** Ensure zero runtime errors, responsive layout fidelity, and 100% free operation.
* **Implementation Checklist:**
  - [x] Verify production compilation using `pnpm run build`.
  - [x] Confirm local dev server starts cleanly with Turbopack on port 3000.
  - [x] Ensure all API endpoints and atmospheric calculations run client-side with **$0.00 USD** cloud budget.
  - [x] Validate responsive behavior across mobile (<768px) and desktop (>1024px) viewports.

---

### STEP 10: 2-Minute Gemma 4 Hackathon Pitch Script & Live Walkthrough

* **0:00 – 0:30 (The Problem & The Hook):**
  > *"Every team today is showing you an air quality map with colored pins. But India has had CAAQMS stations and NASA fire maps for 10 years. Why are citizens in Delhi-NCR still breathing severe-plus air? Because of two fatal blind spots: Satellites pass at 1:30 PM while the real burning happens at dusk, and states refuse to share raw data due to political liability."*

* **0:30 – 0:55 (Innovation 1 — ISRO INSAT-3DR 15-Min Cadence):**
  > *"Meet Exur. We built an atmospheric intelligence platform using Apple's minimal design principles. Notice our satellite scanner: At 1:30 PM, NASA FIRMS shows zero fires. But toggle to 5:45 PM—ISRO's INSAT-3DR geostationary satellite scans every 15 minutes and catches a 420-acre twilight burn event that polar satellites completely miss."*

* **0:55 – 1:25 (Innovation 2 — Inverse Ray-Tracing):**
  > *"When a hotspot spikes, other dashboards simply say 'air is red.' Exur runs reverse Lagrangian wind dispersion physics in the browser. Watch this: we click the Mundka hotspot, and Exur ray-traces 2.4 km upwind to identify the exact industrial foundry cluster responsible with 91% confidence."*

* **1:25 – 1:45 (Innovation 3 — Smartphone Radiometry):**
  > *"How do citizens participate without buying ₹5,000 sensors? We extract raw camera Exposure Values (EV) from standard smartphone photos. The browser computes optical depth directly on-device with zero paid cloud vision APIs."*

* **1:45 – 2:00 (The Close — Exur Advisor & Actionable Intelligence with Gemma 4):**
  > *"Finally, Exur provides instant actionable intelligence for citizens and administrators. Our localized advisor powered by Google Gemma 4 answers complex relocation and health defense queries, analyzing aerosol trajectories in real time. All built on open data, running at literally zero dollars per city."*
