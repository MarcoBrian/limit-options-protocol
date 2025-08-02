
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

- [x] Set up Node.js or Python backend with REST
- [x] Create `/orders` endpoint to accept signed option orders
- [x] Store off-chain orders in DB
- [x] Validate EIP-712 signature before accepting order
- [x] Serve GET `/orders` endpoint for takers to browse open options
- [x] Return pre-packed `interaction` calldata to frontend

---

## Testing

- [ ] Write unit tests for:
  - Option minting via `TakerInteraction`
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
- [x] Form to enter option parameters (underlying, strike, expiry, etc.)
- [x] Sign EIP-712 `Option` struct using wallet
- [x] Submit signed data to relayer backend

### Taker Flow
- [x] Browse available options from relayer API
- [x] Preview NFT details and option metadata
- [x] Fill order on-chain using LOP `fillOrder()`

### Exerciser Flow
- [x] View owned option NFTs via `OptionNFT`
- [x] “Exercise” button to trigger `exercise(optionId)`
- [x] Notify success or expiry failure

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
