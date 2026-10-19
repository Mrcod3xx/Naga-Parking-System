<div align="center">

# 🅿️ Naga Smart Park
### Next-Generation QR-Based Municipal Parking Management System
**Designed for Naga City People's Mall & Commercial Parking Facilities**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](https://github.com/Mrcod3xx/Naga-Parking-System/pulls)

[Quick Start](#-quick-start) • [Live Demo Stations](#-live-demo-stations) • [System Architecture](#-system-architecture) • [Rate Engine](#-rate--fee-calculation-engine) • [Project Structure](#-project-structure) • [Hardware Ready](#-hardware--pos-integration)

</div>

---

## 📖 Overview

**Naga Smart Park** is a complete, real-time parking management and automated revenue system. Built for high-throughput public and commercial parking facilities (such as the Naga City People's Mall), it replaces traditional paper tokens and slow manual logging with an end-to-end QR code lifecycle.

The system requires **zero personal data collection** at entrance, completely eliminating driver bottlenecks while ensuring total cashier accountability, anti-passback integrity, and transparent municipal revenue auditing.

```
       ┌────────────────┐
       │ Driver Arrives │
       └───────┬────────┘
               │ 1. Selects vehicle type
               ▼
   ┌───────────────────────┐
   │    ENTRANCE KIOSK     │ ──► Auto-reserves bay (e.g. B04)
   │  Self-Service Station │ ──► Prints Thermal QR Ticket
   └───────────────────────┘
               │
               ▼
   ┌───────────────────────┐
   │      FACILITY BAY     │ ──► Driver navigates directly to assigned bay
   │   60 Real-Time Slots  │ ──► Live facility map updates in Admin
   └───────────────────────┘
               │
               ▼
   ┌───────────────────────┐
   │     EXIT TERMINAL     │ ──► Attendant scans QR code
   │   Attendant Cashier   │ ──► Tiered fee calculated automatically
   │     Point of Sale     │ ──► Cash / Digital tender with change math
   └───────────────────────┘ ──► Thermal receipt printed & bay released
               │
               ▼
   ┌───────────────────────┐
   │      ADMIN HUB        │ ──► Real-time turnover, analytics & shifts
   │ Revenue & Control Ctr │ ──► Rate versioning, bay overrides, export
   └───────────────────────┘
```

---

## ✨ Key Capabilities

| Station | Core Features | Operational Benefit |
| :--- | :--- | :--- |
| **Entrance Kiosk** | • Vehicle category selector (Motorcycle, Car, Van, Heavy)<br>• Instant slot claim & collision-avoidance reservation<br>• Dynamic directional guidance to bay<br>• High-density QR ticket generation | ⚡ **< 5 seconds** entry time per vehicle with zero attendant payroll required at gate. |
| **Exit Terminal** | • Instant barcode/QR scanner integration<br>• Auto duration calculation down to the minute<br>• Split-second checkout locking (prevents race conditions across lanes)<br>• Cash tender and change calculation<br>• Printable customer audit receipt | 🛡️ **Anti-theft & Anti-fraud**: Attendants cannot alter prices or pocket unlogged revenue. |
| **Administration Hub** | • Interactive 2D floorplan facility map<br>• Live slot state inspector (Available, Occupied, Reserved, Maintenance)<br>• Dynamic rate configuration with historical versioning<br>• Attendant lane assignments and shift logs<br>• Hourly utilization, peak revenue metrics, and financial audit logs | 📊 **Full transparency** for city auditors, facility managers, and parking operations teams. |

---

## 🖥️ Live Demo Stations

The application provides a seamless unified demo containing three interconnected stations that talk to a shared real-time in-memory state:

### 1. 🎫 Entrance Kiosk (`/kiosk`)
* **URL:** `http://localhost:8443/kiosk`
* Self-service kiosk placed at the entry boom gate. Drivers tap their vehicle class (Motorcycle, Car, Van, or Other) on the touch screen.
* The system allocates the closest available bay, holds a temporary lock on the bay, displays turn-by-turn facility directions, and prints the timestamped QR ticket.

### 2. 🧾 Exit Cashier Terminal (`/exit`)
* **URL:** `http://localhost:8443/exit`
* Cashier station for Lane A and Lane B. Attendants scan the driver's QR ticket (or enter the ticket ID, e.g., `T-0042`).
* The system quotes the bill based on municipal parking ordinances, logs attendant on duty, processes Cash (calculating tender and change) or Digital payments, and prints a formal receipt while opening the exit barrier.

### 3. 📊 Administrative Control Center (`/admin`)
* **URL:** `http://localhost:8443/admin`
* Command center for facility supervisors:
  * **Dashboard:** Live capacity gauge, today's gross collection, active sessions.
  * **Live Facility Map (`/admin/map`):** Interactive color-coded grid of all 60 bays.
  * **Slot Management (`/admin/slots`):** Toggle maintenance mode or manually inspect bays.
  * **Rate Configuration (`/admin/rates`):** Modify initial fees, grace windows, and incremental hourly rates.
  * **Transactions & Reports (`/admin/transactions`):** Complete exportable financial ledger.
  * **Attendant Shifts (`/admin/attendants`):** Lane assignments, active status, and clock-ins.

---

## 🏛️ Facility Architecture & Bay Allocations

The standard configuration models a 60-space covered and open-air facility:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      NAGA CITY PEOPLE'S MALL                           │
│                      SMART PARKING FACILITY                            │
├───────────────────┬───────────────────┬────────────────────────────────┤
│      BLOCK A      │      BLOCK B      │            BLOCK C             │
│    Motorcycles    │    Cars / Sedans  │        Vans & Commercial       │
│     (20 Bays)     │     (20 Bays)     │           (20 Bays)            │
├───────────────────┼───────────────────┼────────────────────────────────┤
│  A01  A02  ... A10│  B01  B02  ... B10│  C01  C02  ... C10 (Vans)      │
│  A11  A12  ... A20│  B11  B12  ... B20│  C11  C12  ... C20 (Other)     │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

* **Block A (A01 - A20):** Dedicated motorcycle bays located adjacent to entrance gate with direct ramp access.
* **Block B (B01 - B20):** Standard car and compact vehicle slots in central parking rows.
* **Block C (C01 - C10):** High-clearance bays for passenger vans and delivery utility vehicles.
* **Block C (C11 - C20):** Heavy/Other oversized commercial vehicles.

---

## 💰 Rate & Fee Calculation Engine

Fees are calculated deterministically through `calcFee(rate, entryTime, exitTime, graceMinutes)`:

$$\text{Total Fee} = \text{Initial Fee} + \left( \left\lceil \frac{\max(0, \text{Minutes Parked} - \text{Initial Minutes})}{\text{Increment Minutes}} \right\rceil \times \text{Hourly Increment} \right)$$

### Official Naga Smart Park Rate Matrix:

| Vehicle Class | Initial Fee | First Block Duration | Additional Hourly Increment | Grace Period |
| :--- | :---: | :---: | :---: | :---: |
| 🏍️ **Motorcycle** | **₱20.00** | First 60 mins | + ₱10.00 / hr | 15 mins |
| 🚗 **Sedan / SUV** | **₱40.00** | First 60 mins | + ₱20.00 / hr | 15 mins |
| 🚐 **Commercial Van**| **₱50.00** | First 60 mins | + ₱25.00 / hr | 15 mins |
| 🚛 **Truck / Other** | **₱60.00** | First 60 mins | + ₱30.00 / hr | 15 mins |

* **Grace Period:** Configurable grace window (e.g. 15 minutes) for free pickup/drop-off.
* **Rate Versioning:** Every rate change creates an immutable snapshot with an effective timestamp so active sessions are always charged the rate that was active when they entered.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js**: `v20.0.0` or higher (Node 22+ recommended)
* **npm** or **pnpm**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Mrcod3xx/Naga-Parking-System.git
   cd Naga-Parking-System
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open your browser and navigate to:
   * **Landing & Station Switcher:** [`http://localhost:8443`](http://localhost:8443)
   * **Entrance Kiosk:** [`http://localhost:8443/kiosk`](http://localhost:8443/kiosk)
   * **Exit Cashier:** [`http://localhost:8443/exit`](http://localhost:8443/exit)
   * **Administration:** [`http://localhost:8443/admin`](http://localhost:8443/admin)

---

## 🛠️ Tech Stack & Architecture

```
src/
├── admin/               # Administration Station views & components
│   ├── Admin.tsx        # Admin routing & sub-navigation controller
│   ├── AdminLayout.tsx  # Sidebar, topbar, and notifications layout
│   ├── OverviewPages.tsx# Dashboard, Live 2D Facility Map, Session logs
│   ├── SlotPages.tsx    # Slot manager, bay maintenance toggles
│   ├── RatesPage.tsx    # Municipal tariff editor & version auditor
│   ├── TransactionsPage.tsx # Accounting ledger & financial export
│   ├── AttendantsPage.tsx   # Staff shift management
│   └── SettingsPage.tsx # Hardware, printer & timeout configs
├── components/          # Shared atomic design system
│   ├── ui.tsx           # Buttons, Badges, Cards, Modals, Toasts, QR generator
│   └── vehicle.tsx      # Vehicle type badges & custom SVG iconography
├── exit/                # Exit POS Cashier Station
│   ├── Exit.tsx         # Scan intake, checkout lock, fee math, payment flow
│   └── ExitLayout.tsx   # Cashier POS lane interface
├── kiosk/               # Self-service Entrance Touch Kiosk
│   └── Kiosk.tsx        # 4-step wizard: Welcome -> Select -> Assign -> Print QR
├── lib/                 # Core utilities
│   ├── format.ts        # Currency (PHP), time, durations, ordinal helpers
│   └── router.ts        # Lightweight zero-dependency reactive router
└── store/               # In-memory reactive state engine
    ├── types.ts         # TypeScript interfaces & domain models
    ├── logic.ts         # Math engine (fee calculation, stats, search)
    ├── seed.ts          # Realistic municipal demonstration dataset
    └── store.ts         # Reactive subscription store with localStorage sync
```

* **React 19 & TypeScript:** Strict type-safety across all monetary computations, session states, and slot allocations.
* **Tailwind CSS v4:** Utilizes high-performance CSS engine for instant loading and responsive touch targets.
* **Lucide React:** Clean visual signifiers for vehicle types, navigation arrows, and operational indicators.
* **Print Stylesheet (`@media print`):** Built-in thermal printer templates for standard 58mm and 80mm ESC/POS receipt paper.

---

## 🖨️ Hardware & POS Integration

This system is built from the ground up for embedded industrial touchscreens and point-of-sale hardware:

1. **2D QR Barcode Scanners:**
   * Works with standard USB / Bluetooth HID barcode scanners (e.g. Honeywell, Zebra, Eyoyo).
   * Scanner input automatically focuses and submits the lookup modal in `/exit`.
2. **Thermal Receipt Printers (58mm / 80mm):**
   * Pre-configured CSS `@media print` rules format the ticket and receipt without browser headers or margins.
   * Prints clean vector QR codes readable by low-cost optical scanners.
3. **Barrier Gate Relays:**
   * Can hook into hardware GPIO or local serial relays on completion of `issueTicket()` or `completePayment()`.

---

## 🧪 Interactive Testing & Shortcuts

* **Floating Station Switcher:** Click the **Stations** button in the bottom right corner of any screen to quickly hop between Kiosk, Exit Terminal, and Admin.
* **Reset Demo Snapshot:** Select **Reset demo data** in the station switcher to roll back the state to the pre-populated 10:15 PM peak hour snapshot.
* **Simulate Entry-to-Exit:**
  1. Open `/kiosk` and issue a ticket for a **Motorcycle**. Note the ticket ID (e.g., `T-0043`) and assigned bay (e.g., `A04`).
  2. Switch to `/exit`, type or scan `T-0043`, inspect the live fee breakdown, enter the cash tender, and complete checkout.
  3. Switch to `/admin/map` to watch bay `A04` instantly turn from **Occupied** back to **Available**.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/smart-rfid-sensor`)
3. Commit your changes (`git commit -m 'feat: Add RFID sensor webhook support'`)
4. Push to the branch (`git push origin feature/smart-rfid-sensor`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more details.

Designed with precision for the **Naga City People's Mall** municipal parking system.
