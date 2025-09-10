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

Calculation API
- Endpoint: POST http://localhost:3000/api/calculate
- Body:
  {
    "mode": "evaluateCustomPrice" | "calculateForTargetPV" | "customYearlyThenEqual_useStdPrice" | "customYearlyThenEqual_targetPV",
    "stdPlan": {
      "totalPrice": 1000000,
      "financialDiscountRate": 12,       // percent per annum
      "calculatedPV": 850000             // benchmark PV from standard plan
    },
    "inputs": {
      "salesDiscountPercent": 1.5,       // only used in evaluateCustomPrice
      "dpType": "amount",                // "amount" | "percentage"
      "downPaymentValue": 100000,
      "planDurationYears": 5,
      "installmentFrequency": "monthly", // "monthly" | "quarterly" | "bi-annually" | "annually"
      "additionalHandoverPayment": 0,
      "handoverYear": 2,
      "splitFirstYearPayments": false,
      "firstYearPayments": [             // used when splitFirstYearPayments=true
        { "amount": 50000, "month": 1, "type": "dp" },
        { "amount": 25000, "month": 6, "type": "regular" }
      ],
      "subsequentYears": [
        { "totalNominal": 120000, "frequency": "quarterly" },  // Year 2
        { "totalNominal": 120000, "frequency": "quarterly" }   // Year 3
      ]
    }
  }

- Response:
  {
    "ok": true,
    "data": {
      "totalNominalPrice": number,
      "downPaymentAmount": number,
      "numEqualInstallments": number,
      "equalInstallmentAmount": number,
      "equalInstallmentMonths": number[],
      "monthlyRate": number,
      "calculatedPV": number,
      "meta": {
        "effectiveStartYears": number,
        "splitFirstYearPayments": boolean
      }
    }
  }

Example curl
Evaluate price with sales discount:
curl -s -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "evaluateCustomPrice",
    "stdPlan": { "totalPrice": 1000000, "financialDiscountRate": 12, "calculatedPV": 850000 },
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

Match target PV (standard PV) with structure:
curl -s -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "calculateForTargetPV",
    "stdPlan": { "totalPrice": 1000000, "financialDiscountRate": 12, "calculatedPV": 850000 },
    "inputs": {
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
