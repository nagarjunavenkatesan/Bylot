# How to Run Bylot

Your application consists of two parts: the Backend (API) and the Frontend (React App). Both need to be running for the site to work correctly.

## Prerequisites
- Node.js installed
- PostgreSQL installed and running (Credentials configured in `server/.env`)

## Quick Start

### 1. Start the Backend
Open a terminal and run:
```bash
cd server
npm run dev
```
*You should see: `Server running on port 5000` and `Database initialized successfully`.*

### 2. Start the Frontend
Open a **new** terminal window and run:
```bash
npm run dev
```
*You should see: `Local: http://localhost:5173/`.*

### 3. Open in Browser
Visit [http://localhost:5173](http://localhost:5173) to use the application.

## Troubleshooting
- **Database Error**: If the backend fails with a password error, check `server/.env` and ensure `DB_PASSWORD` matches your local PostgreSQL setup.
- **Port in Use**: If you see "Port already in use", it means the server is already running. You can likely just open the browser.
