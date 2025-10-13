This is the definitive project file for uptownFSfinancial system project

---

Full-stack Dockerized app scaffold added.

Stack
- Client: React + Vite (client/)
- Server: Node.js + Express with nodemon (api/)
- Orchestration: docker-compose.yml

Quick start
1) Create env file (first time only)
   copy .env.example .env   # Windows PowerShell: cp .env.example .env
   # You can edit ADMIN_EMAIL/ADMIN_PASSWORD if you like. Defaults are safe for dev.

2) Build and start
   docker compose up --build

2) Access
   - Client: http://localhost:5173
   - API health: http://localhost:3000/api/health
   - API message: http://localhost:3000/api/message

Phase 8: Egyptian ID OCR Module
- Purpose: Upload a photo of an Egyptian ID and automatically extract key fields to prefill the deal form.
- Flow:
  1) In Create Deal page, select an ID image and click "Extract from ID".
  2) The system uses a local OCR engine (Tesseract) first and automatically falls back to Google Cloud Vision (if GCV_API_KEY is set) only if local OCR fails to yield usable data.
  3) You can review/edit "Name", "National ID", and "Address", then click "Apply to Form" to populate the calculator's Client Information section.
- API:
  - POST /api/ocr/egypt-id (authenticated)
    Form-Data: image=<file>
    Response: { ok: true, engine: "google_vision" | "tesseract", rawText: string, fields: { name, nationalId, address } }

Configuration
- Local OCR (primary): tesseract.js (no system Tesseract required).
- Cloud OCR (fallback): Google Cloud Vision via API key.
  - Set env var GCV_API_KEY in the api service (e.g., in docker-compose.yml or your environment).

Security
- The OCR endpoint is authenticated the same as other /api routes.

Calculation and Plan Generation APIs

Preferred endpoint (benchmark-aware):
- POST http://localhost:3000/api/generate-plan
- Body (when coming from Inventory/Deals flow):
  {
    "mode": "evaluateCustomPrice" | "calculateForTargetPV" | "customYearlyThenEqual_useStdPrice" | "customYearlyThenEqual_targetPV",
    "unitId": 123,                   // REQUIRED in production flow
    "inputs": {
      "salesDiscountPercent": 1.5,
      "dpType": "amount",            // "amount" | "percentage"
      "downPaymentValue": 100000,
      "planDurationYears": 5,
      "installmentFrequency": "monthly", // "monthly" | "quarterly" | "bi-annually" | "annually"
      "additionalHandoverPayment": 0,
      "handoverYear": 2,
      "splitFirstYearPayments": false,
      "firstYearPayments": [         // used when splitFirstYearPayments=true
        { "amount": 50000, "month": 1, "type": "dp" },
        { "amount": 25000, "month": 6, "type": "regular" }
      ],
      "subsequentYears": [
        { "totalNominal": 120000, "frequency": "quarterly" },  // Year 2
        { "totalNominal": 120000, "frequency": "quarterly" }   // Year 3
      ],
      "baseDate": "2025-01-01",      // optional; used to produce absolute due dates
      "maintenancePaymentAmount": 0, // optional; appended to schedule only
      "maintenancePaymentMonth": 0,
      "garagePaymentAmount": 0,
      "garagePaymentMonth": 0
    },
    "language": "en",
    "currency": "EGP"
  }

Important
- When unitId is provided, the backend automatically:
  - Loads the official Approved Standard (benchmark) for that unit (from model’s approved pricing + active standard_plan for rate/duration/frequency).
  - Ignores any stdPlan sent by the client.
  - Computes the Standard PV baseline and compares the Proposed Plan PV against it.
- If unitId is not provided (demo only), you may pass a stdPlan object, but this is not used in production flows.

Response (generate-plan):
  {
    "ok": true,
    "schedule": [{ label, month, amount, date, writtenAmount }],
    "totals": { count, totalNominal },
    "meta": { calculatedPV, rateUsedPercent, ... },
    "evaluation": {
      "decision": "ACCEPT" | "REJECT",
      "pv": { proposedPV, standardPV, tolerancePercent, pass, difference },
      "conditions": [...],
      "summary": {...}
    }
  }

Also available (meta/preview):
- POST http://localhost:3000/api/calculate
  - Same rule: if unitId is provided, stdPlan is ignored and the benchmark is loaded server-side.
  - Returns a calculation result for previews/meta without the full schedule formatting.

Inventory endpoint (now returns the locked benchmark):
- GET http://localhost:3000/api/inventory/units/:id
  - Response includes unit.standardPlan:
    {
      "unit": {
        ...,
        "approved_standard_pricing": { ...components },
        "standardPlan": {
          "totalPrice": number,           // base+garden+roof+storage+garage (excl. maintenance)
          "financialDiscountRate": number, // from active standard_plan
          "calculatedPV": number           // Standard PV baseline
        }
      }
    }

Example curls

Generate a plan against the unit’s Approved Standard:
curl -s -X POST http://localhost:3000/api/generate-plan \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "calculateForTargetPV",
    "unitId": 101,
    "inputs": {
      "dpType": "amount",
      "downPaymentValue": 100000,
      "planDurationYears": 5,
      "installmentFrequency": "monthly",
      "handoverYear": 2,
      "additionalHandoverPayment": 0,
      "splitFirstYearPayments": false,
      "subsequentYears": []
    },
    "language": "en",
    "currency": "EGP"
  }' | jq

Preview calculation (meta) with unitId:
curl -s -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "evaluateCustomPrice",
    "unitId": 101,
    "inputs": {
      "salesDiscountPercent": 1.5,
      "dpType": "amount",
      "downPaymentValue": 100000,
      "planDurationYears": 5,
      "installmentFrequency": "monthly",
      "handoverYear": 2,
      "additionalHandoverPayment": 0,
      "splitFirstYearPayments": false,
      "subsequentYears": []
    }
  }' | jq

Client demo
- The client has a "Calculation API Demo" with:
  - A sample button for a quick request
  - A form to try your own payload (mode, stdPlan, and inputs) and see results

Run tests (API)
- Unit/lightweight tests for the calculation service:
  cd api && npm run test
- Integration tests for the HTTP endpoint using supertest:
  cd api && npm run test:integration

Branding (Logo and App Title)
- Default logo path (committed): client/public/logo.svg (served at /logo.svg)
- Drop your own company logo into GitHub here and it will appear automatically:
  client/public/logo/
  Supported filenames (in order): logo.svg, logo.png, logo.jpg
  The app will auto-detect the first available at runtime in this folder.
- Alternate legacy path also supported:
  client/public/branding/ (same filenames as above)
- Optional override:
  Set VITE_COMPANY_LOGO_URL for a custom absolute/relative URL.
- App title override:
  Set VITE_APP_TITLE to customize the header title.

Development notes
- Code changes in client/ and api/ are live-reloaded inside containers.
- The client reads VITE_API_URL (defaults to http://localhost:3000). docker-compose sets it for you in dev.
- Stop everything with:
   docker compose down

Phase 9: Consultant Flow — Inventory-Driven Deals, Prefill, and Blocking
Overview
- The Property Consultant now starts from Inventory, selects a unit, and lands on the Create Deal page with all unit data already applied to the calculator.
- The consultant does not re-enter any unit data; it’s pulled from Inventory and locked.
- Client data comes next (with OCR assist), followed by plan tailoring and evaluation. If acceptable, the consultant can print the offer; if not, they can adjust or request an override via the existing workflow.
- A new Request Unit Block button submits a block request and routes it to approvals.

What changed
1) Inventory -> Create Deal flow
   - Selecting a unit in Inventory navigates to:
     /deals/create?unit_id=<UNIT_ID>
   - Create Deal auto-redirects back to /deals/inventory if unit_id is missing.

2) Selected Unit summary card (Create Deal, top)
   - Shows key unit attributes and a price breakdown:
     Base, Garden, Roof, Storage, Garage, Maintenance, and Total excl. maintenance.
   - Provides:
     - Change Unit link to return to Inventory.
     - Request Unit Block button.

3) Read-only Unit & Project Information
   - On Create Deal, unit fields are read-only and sourced from Inventory.
   - Inside the embedded calculator, the Unit & Project Information section is hidden to avoid duplication.

4) Client data with OCR
   - The “Scan Egyptian National ID” panel extracts name, national ID, and address via /api/ocr/egypt-id and can apply them into the calculator’s Client Information section.

5) Calculation and evaluation
   - Generate a plan using /api/generate-plan.
   - The calculator shows “Standard PV vs Offer PV”, acceptance evaluation, and payment structure metrics vs centrally-managed thresholds.
   - If acceptable, print the Pricing Form (role based). Otherwise, adjust the plan or use the existing override/escalation.

6) Unit blocking
   - Consultants can request a unit block directly from Create Deal. The request goes to the approval chain (financial manager approval).
   - Block expiry is handled by a daily job; approved blocks auto-expire and release the unit.

Relevant endpoints
- Inventory
  - GET /api/inventory/types
  - GET /api/inventory/units
  - GET /api/inventory/units/:id
- Calculator
  - POST /api/calculate
  - POST /api/generate-plan
- OCR
  - POST /api/ocr/egypt-id (multipart form-data: image=<file>)
- Blocking workflow
  - POST /api/blocks/request
    Body: { unitId: number, durationDays: number, reason?: string }
    Role: property_consultant
    Response: { ok: true, block: {...} }
  - PATCH /api/blocks/:id/approve
    Body: { action: 'approve' | 'reject', reason?: string }
    Role: financial_manager
  - PATCH /api/blocks/:id/extend
    Body: { additionalDays: number, reason?: string }
    Role: financial_manager
  - GET /api/blocks/current
    Role: any authenticated; sales roles see own requests

UI behavior summary
- Inventory (Deals > Inventory): “Create Offer” on a unit routes to /deals/create?unit_id=<id>.
- Create Deal:
  - If unit_id missing: auto-redirect to Inventory.
  - Top “Selected Unit” card: quick price breakdown, Change Unit, Request Unit Block.
  - Unit fields below are read-only and mirror Inventory data.
  - Embedded calculator hides its own Unit section (no duplication).
  - OCR panel can apply extracted client data to the calculator.
  - Generate Plan -> evaluate PV and thresholds -> documents (role-based).
