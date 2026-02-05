# Internal Wallet Service

A high-concurrency, ledger-based wallet service built with NestJS, TypeORM, and PostgreSQL.

## Prerequisites

- **Node.js** (v18+)
- **Docker** & **Docker Compose**
- **pnpm** (Package Manager)

> **Note**: This project relies on `pnpm`. Please ensure it is installed:
> ```bash
> npm install -g pnpm
> ```

## Setup Instructions

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
Copy the sample env file and configure it (optional, defaults are set for Docker):
```bash
cp .env.sample .env
```
*Variables: `AUTH_USER`, `AUTH_PASS`, `DB_HOST`, etc.*

### 3. Start Database
Spin up the PostgreSQL container:
```bash
docker-compose up -d
```
*This starts a Postgres instance on port 5432.*

### 3. Initialize & Seed Data
Initialize the database schema and populate it with required assets and accounts:
```bash
npx ts-node seed.ts
```
**What this does:**
- Truncates existing tables (Fresh start).
- Creates Assets: `GOLD` (2 decimals), `POINTS` (0 decimals).
- Creates System Accounts: `SYSTEM_TREASURY`, `SYSTEM_MARKETING`, `SYSTEM_REVENUE`.
- Creates User Accounts: `u1` (100 GOLD, 0 POINTS), `u2` (50 GOLD).

### 4. Run the Application
Start the NestJS server:
```bash
pnpm run start
```
*Server will listen on `http://localhost:3000`.*

---

## API Usage Guide

### Check Balance
**GET** `/wallet/:userId/balance?assetId=GOLD`
```bash
curl -s -u admin:secret "http://localhost:3000/wallet/u1/balance?assetId=GOLD"
```

### Top-up Wallet
**POST** `/transactions/topup`
- Requires `Idempotency-Key` header.
- Requires `Authorization` header (Basic Auth).
```bash
curl -X POST http://localhost:3000/transactions/topup \
  -u admin:secret \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-1" \
  -d '{"userId": "u1", "amount": "50", "assetId": "GOLD", "reference": "REF001"}'
```

### Spend Credits
**POST** `/transactions/spend`
- Debits user, credits `SYSTEM_REVENUE`.
```bash
curl -X POST http://localhost:3000/transactions/spend \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-2" \
  -d '{"userId": "u1", "amount": "30", "assetId": "GOLD", "reference": "REF002", "itemId": "ITEM1"}'
```

### Award Bonus
**POST** `/transactions/bonus`
- Credits user, debits `SYSTEM_MARKETING`.
```bash
curl -X POST http://localhost:3000/transactions/bonus \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-3" \
  -d '{"userId": "u1", "amount": "10", "assetId": "POINTS", "reference": "REF003", "reason": "LEVEL_UP"}'
```

## Refinements & Features

- **Double-Entry Ledger**: All money movements are recorded as balanced pairs of Debits/Credits.
- **Concurrency Safety**: Uses Optimistic `Atomic Updates` for System Accounts and `Pessimistic Locking` for User accounts to prevent deadlocks and hotspots.
- **Strict Idempotency**: Prevents replaying requests. If you reuse a key with DIFFERENT parameters, you get `409 Conflict`.
- **Configurable**: System Account IDs are managed in `src/config`.
