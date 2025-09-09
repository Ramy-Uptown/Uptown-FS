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

Development notes
- Code changes in client/ and api/ are live-reloaded inside containers.
- The client reads VITE_API_URL (defaults to http://localhost:3000). docker-compose sets it for you in dev.
- Stop everything with:
   docker compose down
