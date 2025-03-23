# Agar.io Clone with Solana & USDC Integration

This repository contains a fork of the open-source Agar.io clone enhanced with Solana blockchain integration and USDC cryptocurrency support.

## Features

- Solana-based custodial wallets for each player
- USDC deposit to start playing (1 USDC per game)
- Player value tracked in USDC
- Withdrawal mechanism (from 5 USDC with a 1% fee after 10 USDC)
- Locked liquidity on entry into global game session

## Repository Structure

- `/src/backend` - Node.js/Express backend with Solana integration
- `/src/agar.io-clone` - Modified Agar.io game client with USDC features
- `documentation.md` - Comprehensive technical documentation
- `user_guide.md` - Detailed user guide
- `todo.md` - Project implementation checklist

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm
- Solana CLI
- PostgreSQL
- Git
- Phantom Wallet (for testing)
- Solana Devnet tokens (SOL + USDC)

### Local Development Setup

1. Clone this repository:
```bash
git clone https://github.com/YOUR_USERNAME/agar-solana.git
cd agar-solana
```

2. Set up the backend:
```bash
cd src/backend
npm install
cp .env.example .env
# Edit .env with your configuration
```

3. Set up the frontend:
```bash
cd ../agar.io-clone
npm install
```

4. Start the backend server:
```bash
cd ../backend
node index.js
```

5. Start the frontend development server:
```bash
cd ../agar.io-clone
npm run build
npx http-server dist -p 8080
```

6. Access the game at `http://localhost:8080`

## Deployment

### Backend Deployment (Render)

1. Push this repository to GitHub
2. Create a new Web Service in Render
3. Connect to your GitHub repository
4. Set the required environment variables:
   - DATABASE_URL
   - ENCRYPTION_KEY
   - USDC_MINT
   - SOLANA_KEYPAIR_PATH
5. Deploy the service

### Frontend Deployment (Vercel)

1. Push this repository to GitHub
2. Create a new project in Vercel
3. Connect to your GitHub repository
4. Set the environment variables:
   - BACKEND_URL (pointing to your Render deployment)
5. Deploy the project

## Documentation

For detailed information about the implementation, please refer to:

- [Technical Documentation](./documentation.md)
- [User Guide](./user_guide.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
