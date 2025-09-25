# FeeDelegate Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hackathon: MetaMask Smart Accounts x Monad Dev Cook-Off](https://img.shields.io/badge/Hackathon-MetaMask%20x%20Monad-blue)](https://www.hackquest.io/hackathons/MetaMask-Smart-Accounts-x-Monad-Dev-Cook-Off)

## Project Description

FeeDelegate Bridge is an on-chain automation tool built for the MetaMask Smart Accounts x Monad Dev Cook-Off hackathon (Best On-Chain Automation track). It uses MetaMask's Delegation Toolkit to automate bridging user assets to low-fee chains (e.g., Monad) when gas fees on the source chain exceed a threshold. This solves multi-chain UX pains by reducing costs and approval fatigue, leveraging ERC-4337 smart accounts for secure, permissioned executions.

Key Features:
- User-defined gas thresholds for auto-bridging.
- Integration with LayerZero for cross-chain transfers.
- Oracles (e.g., Chainlink) for real-time gas monitoring.
- Deployed on Monad testnet.

This is a monorepo with:
- **Backend**: Solidity contracts via Foundry.
- **Frontend**: Next.js app for user interactions.

## Deployments

Deployed Agent: 0x9b52dF03bbB3B20dDcb793100984425eD80ac5fD on Base Sepolia (tx :0xe8d4dfca3765ff9b91422b34d50d9ff4928db6b7d721531e712da941aba43f32)

Switched to Monad testnet - Agent: 0xa5262b3CF38fA74010A3873974b17EF53b81deE3 (tx: 0x6641eb1b7cd32ecd1536e18380a302cf4e8715d0cc555039a73a8619e71d15e1)

## Prerequisites

- Node.js v18+ (for frontend).
- Foundry (for contracts—install via `curl -L https://foundry.paradigm.xyz | bash`).
- Git.
- MetaMask wallet (for testing).
- Monad testnet added to MetaMask (RPC: https://testnet.monad.xyz/rpc, Chain ID: 10143).

## Installation

Clone the repo:
git clone https://github.com/U-GOD/fee-delegate-bridge.git

cd fee-delegate-bridge


### Backend (Foundry/Solidity)
1. Install dependencies:
forge install

2. Build contracts:
forge build

3. Run tests:
forge test


### Frontend (Next.js)
1. Navigate to frontend dir:
cd frontend

2. Install dependencies:
npm install

(This includes Wagmi, Viem, @metamask/delegation-toolkit, and Permissionless.)
3. Start dev server:
npm run dev

Open http://localhost:3000.

## Usage

1. Connect MetaMask in the app.
2. Set gas threshold and assets.
3. Sign delegation to grant agent permissions.
4. Simulate high fees (in dev) to trigger bridge.

For deployment: Use Remix/Foundry to deploy agent to Monad testnet.

## Contributing

Fork, create branch, PR. Follow code style (ESLint for JS, Forge-std for Solidity).

## License

MIT License. See LICENSE file.

## Acknowledgments

Built with ❤️ for the MetaMask x Monad hackathon. Inspired by MetaMask Delegation Toolkit docs. 
