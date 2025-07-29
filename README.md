# Options Enabled on Limit Order Protocol

IWantOptions is a decentralized, permissionless protocol that allows anyone to mint, buy, and exercise covered call options built on top of the 1inch Limit Order Protocol as a settlement layer. It leverages off-chain signatures, on-chain NFT minting, and tokenized collateral to create a new class of decentralized financial derivatives — without relying on a traditional order book model.


# ✅ Project To-Do List

## Smart Contracts

- [x] Write `OptionNFT` contract with ERC721Enumerable
- [x] Implement `notifyInteraction()` with EIP-712 signature verification
- [ ] Handle `permit()` logic for gasless approval
- [x] Enforce replay protection with hash tracking (`usedHashes`)
- [x] Add `exercise()` function for takers to claim collateral
- [x] Restrict `notifyInteraction()` to only be callable by LOP
- [ ] (Optional) Add `cancel()` or `revoke()` logic for makers
- [ ] (Optional) Add `withdrawUnmintedCollateral()` if orders are cancelled

---

## Backend / Relayer

- [ ] Set up Node.js or Python backend with REST or GraphQL API
- [ ] Create `/orders` endpoint to accept signed option orders
- [ ] Store off-chain orders in DB (e.g., PostgreSQL, Redis, or in-memory)
- [ ] Validate EIP-712 signature before accepting order
- [ ] Serve GET `/orders` endpoint for takers to browse open options
- [ ] Return pre-packed `interaction` calldata to frontend

---

## Testing

- [ ] Write unit tests for:
  - Option minting via `notifyInteraction()`
  - Invalid signature rejection
  - permit() fallback and approval
  - Option exercising logic
  - Expiry enforcement
- [ ] Set up Hardhat mainnet fork test using real tokens (USDC, WETH)
- [ ] Write Foundry fuzz tests (optional)
- [ ] Deploy to local devnet (Anvil/Hardhat) for end-to-end simulation

---

## Frontend (Maker / Taker / Exerciser UI)

### Maker Flow
- [ ] Form to enter option parameters (underlying, strike, expiry, etc.)
- [ ] Sign EIP-712 `Option` struct using wallet
- [ ] Submit signed data to relayer backend

### Taker Flow
- [ ] Browse available options from relayer API
- [ ] Preview NFT details and option metadata
- [ ] Fill order on-chain using LOP `fillOrder()`

### Exerciser Flow
- [ ] View owned option NFTs via `OptionNFT.tokenOfOwnerByIndex()`
- [ ] “Exercise” button to trigger `exercise(optionId)`
- [ ] Notify success or expiry failure

---

## Deployment

- [ ] Deploy `OptionNFT` contract to testnet
- [ ] Deploy relayer backend (Vercel, Fly.io, Heroku, etc.)
- [ ] Hook frontend to target deployed contracts and backend endpoints
- [ ] Write deployment docs / runbooks
- [ ] Deploy to mainnet (after testnet validation)

---

## Additional Extensions

- [ ] Add `predicate` to enforce time-based conditions
- [ ] Support secondary resale of Option NFTs on marketplaces (e.g., OpenSea)
- [ ] Support put options (strikeAsset as collateral)
