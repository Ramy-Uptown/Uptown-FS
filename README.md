# Uptown-FS — Full Stack Financial System

This repository contains a Dockerized full‑stack app for Uptown’s financial workflows:

- Client: React + Vite (client/)
- API: Node.js + Express (api/)
- Database: PostgreSQL 16 (containerized)
- Orchestration: Docker Compose (docker-compose.yml)
- Dev environment: GitHub Codespaces with auto‑forwarded ports (.devcontainer/)

The README is the living source of truth. Every significant change must be reflected here. See “AI/Agent Contribution Rules” below.

---

## Quick Start (local machine)

Prerequisites: Docker Desktop.

1) Create your environment file
- Copy .env.example to .env and adjust if needed
  - ADMIN_EMAIL / ADMIN_PASSWORD (for initial seed)
  - DB_PASSWORD (already set to apppass for dev)

2) Start the stack
- docker compose up -d --build

3) Access locally
- Client: http://localhost:5173
- API Health: http://localhost:3000/api/health
- API Message: http://localhost:3000/api/message

Stop everything:
- docker compose down
Note: Do NOT use docker compose down -v unless you want to wipe the database volume.

---

## Quick Start (GitHub Codespaces)

This repo is configured for Codespaces.

- Auto‑forwarded ports: 3001 (API), 5173 (Client)
- Auto‑start stack: docker compose up -d runs on container start (postStartCommand)

First run in a Codespace:
1) Rebuild the container so devcontainer settings take effect
- F1 → “Codespaces: Rebuild Container”
2) The stack will start automatically (postStartCommand).
3) Open the Ports panel and click:
- 5173 → Client
- 3001 → API

Notes:
- We expose the API container’s port 3000 to the host port 3001 to avoid conflicts (compose uses 3001:3000).
- The client is configured for Codespaces HMR and uses the forwarded hosts, not localhost.
- If you open a public port URL, GitHub may show a one‑time safety warning; click “Continue.”

Health checks:
- curl -sS https://<codespace>-3001.app.github.dev/api/health
- Client should hot‑reload without ws://localhost references.

---

## Ports and Environment

- API container listens on 0.0.0.0:3000.
- Host forwards to:
  - 3001 → API (container:3000)
  - 5173 → Client (container:5173)
- Vite config (client/vite.config.js) detects Codespaces and:
  - Sets HMR over wss to the forwarded 5173 host
  - Sets origin to the public 5173 host
  - Sets VITE_API_URL to the public 3001 host
- docker-compose.yml passes CODESPACE_NAME and GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN to client so the config can compute public URLs.

---

## Current Features and Status

1) Calculation Service and API
- Endpoint: POST /api/calculate
- Modes include:
  - evaluateCustomPrice
  - calculateForTargetPV
  - customYearlyThenEqual_useStdPrice
  - customYearlyThenEqual_targetPV
- Returns totals, PV, and metadata to drive the UI.

2) Generator and Documents
- Endpoint: POST /api/generate-plan
- Document generation endpoint scaffolded: POST /api/generate-document
- Client can export schedule to CSV/XLSX and generate a checks sheet XLSX.

3) Inventory/Units (stubs for integration)
- Basic endpoints scaffolded; UI has type and unit pickers with server calls.

4) OCR Module (scaffold)
- OCR upload endpoint design (tesseract primary; Google Cloud Vision optional via GCV_API_KEY) documented for future enablement.

5) Auth and Roles (client side)
- Role-aware UI sections (e.g., thresholds, contract sections).
- Client persists session/role in localStorage.

6) Codespaces Integration
- Devcontainer auto‑forwards 3001/5173 and auto‑starts the stack.
- Vite HMR configured to work behind Codespaces.

7) Recent Fixes and Changes
- Resolved App.jsx merge conflicts; rateLocked computed once from unitInfo.
- Switched host API port to 3001 and updated client to talk to 3001.
- Added .devcontainer/devcontainer.json with forwardPorts and postStartCommand.
- Vite HMR configured for Codespaces (wss + origin).
- Docker Compose passes Codespaces env vars into client service.
- Inventory deals page now shows a clear empty-state message for sales roles. It explains that units only appear after: (1) Financial Admin creates drafts linked to a Unit Model with approved standard pricing, and (2) Financial Manager approves the drafts to mark them AVAILABLE. This helps when inventory appears in Admin pages but not under Deals → Inventory.
- Client Information enhanced: added Birth Date and moved the Egyptian ID scanner into the Client Information section (ClientIdScanner) so consultants can scan and auto-fill name, ID, address directly.
- Create Deal page: “Unit Type” relabeled to “Unit Model” and now displays model_code — model_name when available.
- Acceptance evaluation fix: PV rule now passes when Proposed PV ≤ Standard PV × tolerance (equality allowed). Previously it required ≥, which caused a false FAIL at 0 difference. Also added small epsilon to avoid float rounding issues.
- Third-year condition is already dynamic; it now reads min/max from payment_thresholds (with sensible fallbacks if not configured).
- UI cleanup: Removed duplicated “Unit & Project Information” section from Deals → Create Deal in favor of the upper “Selected Unit” summary, and added “Block / Sector” to that summary. Removed unused local state and draft autosave tied to the deleted section to prevent stale localStorage keys and simplify the component.
- Sales Consultant calculator UX: Hid “Std Financial Rate (%)” input for property consultants (it is pulled from approved standard and should not be editable). Also improved Down Payment UX—when DP Type = percentage, the input now shows a “%” suffix and enforces 0–100, reducing confusion about entering values.
- Removed obsolete “Standard PV vs Offer PV” comparison section from the calculator page; kept the server-side “Acceptance Evaluation” section only (as this is authoritative and up-to-date).
- Removed the “Payment Structure Metrics” section below Acceptance Evaluation to avoid duplicated/legacy presentation. The page now relies solely on the server-side Acceptance Evaluation.
- Acceptance Evaluation banner: Compact banner now displays NPV-based decision with distinct colors (green for ACCEPT, stronger red for REJECT). When REJECT, it also lists unmet criteria (e.g., PV below standard, specific failed conditions) and shows a “Request Override” action that posts to /api/deals/:id/request-override.
- Offer/First Payment Dates: Added two required date pickers in Inputs — Offer Date and First Payment Date. Offer Date defaults to today; First Payment Date defaults to Offer Date. Plan generation uses First Payment Date as baseDate (fallback to Offer Date or today). Both dates are included in document generation (offer_date, first_payment_date) from Calculator and Deal Detail flows, and are now displayed above the Payment Schedule for clear visibility (also shown on Deal Detail).
- Create Deal UI: Removed the separate “Server Calculation” panel and its button; consultants generate the plan using the main “Calculate (Generate Plan)” action only.

Future tasks:
- PDF templates: map offer_date and first_payment_date placeholders in server-side document templates for Pricing Form, Reservation Form, and Contract.

---

## How to Work Day‑to‑Day

- Pull latest code in Codespaces:
  - Commit/stash your local changes
  - git pull --rebase
  - Rebuild container if devcontainer/ or Docker files changed:
    - F1 → Rebuild Container
  - Rebuild services if needed:
    - docker compose build
    - docker compose up -d
- Stop Codespace to save hours:
  - GitHub → Your profile → Codespaces → ••• → Stop
  - Or F1 → Codespaces: Stop Current Codespace

Persistence
- Postgres data is stored in the named volume db_data and survives restarts.
- Client form state persists in localStorage per Codespace URL.
- Avoid docker compose down -v unless you want to reset the database.

---

## Troubleshooting

- Client connects to localhost:5173 in browser logs:
  - Hard refresh the client page (Ctrl/Cmd+Shift+R)
  - Ensure you opened via the Ports panel 5173 public URL
  - Rebuild the client container: docker compose up -d --build client
- No ports appear in Ports panel:
  - Rebuild container; postStartCommand will run
  - Check docker compose ps; then docker logs -f app_client / app_api
- 500 on /src/*.jsx in dev overlay:
  - Check app_client logs for syntax errors and fix the file
- Merge conflicts:
  - Use VS Code Merge Editor; prefer “Accept Current” when keeping local branch
  - Remove all conflict markers <<<<<<<, =======, >>>>>>> before committing

---

## API Reference (selected)

POST /api/calculate
- Body schema:
  - mode: string (see modes)
  - stdPlan: { totalPrice, financialDiscountRate, calculatedPV }
  - inputs: {
      salesDiscountPercent,
      dpType, downPaymentValue,
      planDurationYears, installmentFrequency,
      additionalHandoverPayment, handoverYear,
      splitFirstYearPayments, firstYearPayments[], subsequentYears[]
    }

Health endpoints
- GET /api/health → { status: "OK" }
- GET /api/message → { message: "Hello..." }

---

## Branding and App Title

- Place a logo under client/public/logo/ (logo.svg/png/jpg). First found will be used.
- Legacy path supported: client/public/branding/
- Override via VITE_COMPANY_LOGO_URL
- Override app title via VITE_APP_TITLE

---

## Testing

API unit tests:
- cd api && npm run test

API integration tests:
- cd api && npm run test:integration

---

## Roadmap (next sessions)

- Wire real inventory endpoints and types/units data model.
- Implement authentication/authorization end‑to‑end (API issued tokens).
- Persist thresholds and management controls (admin UI + API).
- Finalize OCR pipeline and document generation templates.
- Add CI for lint/test on PRs and container build.
- Add “Export/Import” for local calculator state.

---

## Calculator Modularity Audit

Scope: review of calculator architecture, unused/broken files, and drift from modular design (no deletions performed).

Summary
- The calculator is intentionally modular (InputsForm, LivePreview, PaymentSchedule, UnitInfoSection, ClientInfoForm, ContractDetailsForm, EvaluationPanel).
- App.jsx has accumulated too many responsibilities (validation, payload building, comparison metrics, some deal-bridging). It still works, but should be split into hooks/utilities to restore clean modularity.

Findings — likely broken filename mismatches
- client/src/components/UnitDetailsDrawer.jsx.jsx
  - Imports expect ../components/UnitDetailsDrawer.jsx (single .jsx). This mismatch will break admin drawers.
- client/src/admin/InventoryChangeHistory.jsx.jsx
  - Router imports InventoryChangeHistory.jsx (single .jsx).
- client/src/admin/InventoryChanges.jsx.jsx
  - Router imports InventoryChanges.jsx (single .jsx).

Findings — present but currently unused in routes
- client/src/components/dashboards/SalesManagerDashboard.jsx
- client/src/components/dashboards/SalesRepDashboard.jsx
- client/src/components/notifications/NotificationCenter.jsx

Back-end legacy/unused
- api/server.js (compose and scripts run src/index.js). Keep as legacy starter, but it is not used by the dev stack.

What works well
- useCalculatorSnapshot and CreateDeal.jsx integration to prefill and extract calculator state.
- Payment schedule export (CSV/XLSX) and checks-sheet generator.
- Codespaces-compatible HMR and API URL wiring.

Recommended actions (future task list)
- File hygiene
  - Rename the three double-extension files to single .jsx to match imports and prevent runtime errors.
- Refactor App.jsx (behavior must remain identical)
  - Extract buildPayload and validateForm into client/src/lib/calculatorHelpers.js.
  - Extract comparison calculations into a hook: client/src/lib/useCalculatorComparison.js.
  - Keep App.jsx focused on composing UI and delegating logic.
- Optional wiring
  - If dashboards are desired now, add routes and minimal API stubs; otherwise mark as “future” and leave untouched.
  - Wire NotificationCenter to notifications API or keep as “future module.”
- DX/Quality
  - Add ESLint + Prettier to catch duplicate declarations and file mismatches earlier.
  - Consider TypeScript for types on calculator payloads and API responses (incremental).
- Documentation
  - Maintain this section (Calculator Modularity Audit) and “Recent Fixes and Changes” for every session.
  - When renaming files or refactoring, summarize exactly what moved and why.

No deletions were done in this audit.

---

## AI/Agent Contribution Rules

Any automated agent (AI or script) committing changes MUST:
1) Update this README in the “Recent Fixes and Changes” section with a concise bullet list of what changed and why.
2) If developer experience changes (ports, env, run steps), update the corresponding sections.
3) If new endpoints, routes, or commands are added, document them briefly under API Reference or a new section.
4) Keep instructions accurate for both local Docker and Codespaces.
5) Do not remove existing notes; append and refine.

Checklist before finishing any task:
- [ ] Code builds and runs locally (docker compose up -d) or in Codespaces
- [ ] Ports are correct and forwarded
- [ ] README updated with the changes
- [ ] Commit message references what was updated in README

---
