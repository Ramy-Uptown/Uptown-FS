y financial system project

---

Full-stack Dockerized app scaffold added.

Stack
- Client: React + Vite (client/)
- Server: Node.js + Express with nodemon (api/)
- Orchestration: docker-compose.yml

Quick start
1) Build and start
   docker compose up --build

2) Access
   - Client: http://localhost:5173
   - API health: http://localhost:3000/api/health
   - API message: http://localhost:3000/api/message

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
- The client has a \"Calculation API Demo\" section with a button that calls /api/calculate using a sample payload and displays the result.

Run tests (API)
- Lightweight tests cover calculation service logic without extra dependencies:
  cd api && npm run test

Development notes
- Code changes in client/ and api/ are live-reloaded inside containers.
- The client reads VITE_API_URL (defaults to http://localhost:3000). docker-compose sets it for you in dev.
- Stop everything with:
   docker compose down
