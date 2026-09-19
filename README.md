# CitizenWater Guard

**CitizenWater Guard** is a participatory water-quality monitoring system for the *Bureau National de l'Eau Potable (ONEP)* in Côte d'Ivoire. It enables citizens, field agents, and partners to report water anomalies (quality, leaks, illegal artisanal gold mining – *orpaillage*) via a mobile app or USSD/SMS. The system provides real‑time dashboards for decision‑makers, geolocated mapping, and gamified feedback for users.

## Architecture

| Layer | Technology (open‑source) |
|---|---|
| **Mobile / USSD** | React‑Native (Expo) or USSD gateway (Twilio/Africa’s Talking) |
| **Backend** | Node.js / Express + PostgreSQL (PostGIS) |
| **Database** | PostgreSQL with PostGIS for spatial data |
| **Mapping** | Leaflet.js + OpenStreetMap tiles |
| **Deployment** | VPS (≈ 2 CPU, 4 GB RAM) – < 50 USD/month |

## Quick Start (local)

```bash
# 1️⃣ Clone the repo
git clone https://github.com/onepsiege353/citizenwater-guard.git
cd citizenwater-guard

# 2️⃣ Backend
cd backend
npm install
# set env vars (DB_URL, JWT_SECRET, etc.)
npm run start   # runs on http://localhost:3000

# 3️⃣ Frontend (Expo)
cd ../frontend
npm install
expo start
```

## Features (MVP)

- Sign‑up / login (phone number)
- Quick report: type (quality / leak / orpaillage) + photo + GPS
- SMS/USSD fallback: `EWP <type> <location>`
- Real‑time dashboard (map, filters, export CSV)
- Gamification: points, badges
- Alerts to sector supervisors

## Roadmap (12 months)

| Month | Milestone |
|---|---|
| M1‑M2 | Finalise specs, UI/UX design |
| M3 | Mobile app (React‑Native) + USSD integration |
| M4 | Backend API, PostgreSQL + PostGIS |
| M5 | Dashboard (Leaflet, filters) |
| M6 | Pilot in Abidjan district (training, feedback) |
| M7‑M8 | Analyse pilot data, refine processes |
| M9 | Expand to second district, add Bluetooth sensors |
| M10 | National sensitization campaign |
| M11‑M12 | Full‑release, PSQ 2026‑2030 reporting |

## License

MIT – free to use and adapt.
