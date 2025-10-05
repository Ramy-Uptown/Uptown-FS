# Uptown-FS AI Coding Conventions

This document provides AI-driven guidance for developers working on the Uptown-FS project.

## Project Overview

Uptown-FS is a full-stack financial system built with a focus on modularity and clear separation of concerns. The project is containerized using Docker, with distinct services for the backend API and the frontend client.

- **`client/`**: A React application built with Vite, responsible for the user interface and all client-side logic. It communicates with the backend via a RESTful API.
- **`api/`**: A Node.js and Express-based backend that serves the API. It handles business logic, data processing, and interactions with the PostgreSQL database.
- **`docker-compose.yml`**: Orchestrates the services, including the database, API, and client, for a unified development environment.

## Development Workflow

The entire development environment is managed through Docker Compose, simplifying setup and ensuring consistency.

- **To start the application**:
  ```bash
  docker-compose up --build
  ```
- **Client is accessible at**: `http://localhost:5173`
- **API is accessible at**: `http://localhost:3000`

## Backend (`api/`)

The backend is structured to support a range of financial calculations, data management, and OCR processing.

- **Key technologies**: Node.js, Express, PostgreSQL.
- **Database migrations**: Managed via numbered SQL files in `api/src/migrations`. To apply migrations, run:
  ```bash
  docker-compose exec api npm run migrate
  ```
- **Environment variables**: Managed through a `.env` file in the `api/` directory. The `validateEnv.js` script ensures that all required variables are set before the application starts.

## Frontend (`client/`)

The frontend is a modern React application that provides a responsive and interactive user experience.

- **Key technologies**: React, Vite, Ant Design for UI components.
- **API interaction**: The client makes HTTP requests to the backend API (configured via `VITE_API_URL`). All financial calculations and data manipulations are handled by the backend.

## Key Architectural Decisions

- **Containerization**: Docker is used to ensure a consistent and reproducible development environment. This isolates dependencies and simplifies deployment.
- **Separation of concerns**: The frontend and backend are developed and deployed as separate services, allowing for independent scaling and development.
- **Stateless API**: The backend API is designed to be stateless, with all application state managed by the client or stored in the database.
- **Database-driven**: A PostgreSQL database serves as the single source of truth for all application data.
