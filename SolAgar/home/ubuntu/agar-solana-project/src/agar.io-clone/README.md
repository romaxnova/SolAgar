# Agar.io Clone with Solana & USDC Integration

This is a fork of the open-source Agar.io clone enhanced with Solana blockchain integration and USDC cryptocurrency support.

## Features

- Solana-based custodial wallets for each player
- USDC deposit to start playing (1 USDC per game)
- Player value tracked in USDC
- Withdrawal mechanism (from 5 USDC with a 1% fee after 10 USDC)
- Locked liquidity on entry into global game session

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm
- Solana CLI
- PostgreSQL
- Phantom Wallet (for testing)
- Solana Devnet tokens (SOL + USDC)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/agar.io-clone
cd agar.io-clone
npm install
```

2. Build the frontend:
```bash
npm run build
```

3. Start the game:
```bash
npm start
```

## How to Play

1. Connect your wallet using the "Connect Wallet" button
2. Deposit 1 USDC to start playing
3. Control your cell with your mouse
4. Eat food and other players to grow
5. Your in-game value is tracked in USDC
6. Withdraw your earnings (minimum 5 USDC)

## Deployment

### Backend (Render)
The backend is deployed on Render. To deploy your own instance:

1. Push the code to GitHub
2. Create a new Web Service in Render
3. Connect to your GitHub repository
4. Set the required environment variables

### Frontend (Vercel)
The frontend is deployed on Vercel. To deploy your own instance:

1. Push the code to GitHub
2. Create a new project in Vercel
3. Connect to your GitHub repository
4. Set the environment variables to point to your backend

## License

This project is licensed under the MIT License - see the LICENSE file for details.
