# Agar.io Solana Backend

This is the backend for the Agar.io clone with Solana and USDC integration.

## Features

- Solana wallet creation and management
- USDC deposits and withdrawals
- Fee logic for withdrawals (1% fee for amounts over 10 USDC)
- Transaction history tracking
- Integration with PostgreSQL database

## API Endpoints

- `POST /api/create-wallet` - Creates a new Solana wallet
- `GET /api/get-wallet/:userId` - Retrieves wallet information
- `POST /api/deposit` - Processes USDC deposits
- `POST /api/withdraw` - Processes USDC withdrawals with fee logic
- `GET /api/transactions/:userId` - Retrieves transaction history

## Environment Variables

Create a `.env` file with the following variables:

```
DATABASE_URL=postgres://username:password@host:port/dbname
ENCRYPTION_KEY=your-encryption-secret
USDC_MINT=EPjFWdd5AufqSSqeM2q6yZH7vjZgASkZ3ZQm4jL5JvhH
SOLANA_RPC_URL=https://api.devnet.solana.com
PORT=3001
```

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

For development:

```bash
npm run dev
```
