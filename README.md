# GavCoin - A Piece of Ethereum History

**GavCoin (GAV)** is one of the earliest token contracts on Ethereum, created by **Gavin Wood** (co-founder of Ethereum, creator of Solidity, founder of Polkadot) and deployed on **April 26, 2016** at block 1,408,600.

## Contract

- **Address:** `0xb4abc1bfc403a7b82c777420c81269858a4b8aa4`
- **Chain:** Ethereum mainnet
- **Etherscan:** [View contract](https://etherscan.io/address/0xb4abc1bfc403a7b82c777420c81269858a4b8aa4)

## History & Provenance

GavCoin predates the ERC-20 standard by over a year. It uses a custom interface with `sendCoin`, `coinBalanceOf`, and a unique `mine()` function. The contract was written in both Solidity and LLL (Lisp-Like Language, likely what was actually deployed).

### The Trail

- **Feb 19, 2015:** Gavin Wood pushes `coin.sol` (defining "GavCoin") to the official [ethereum/dapp-bin](https://github.com/ethereum/dapp-bin/blob/master/coin/coin.sol) repository. Ethereum mainnet hasn't launched yet.
- **April 26, 2016:** The contract is deployed to mainnet at block 1,408,600 from wallet [`0x20F9...fD2D`](https://etherscan.io/address/0x20F9bb9dfd0c18748debE6C534B13Cb24f8dfD2D), traceable to EthDev, the Ethereum Foundation, and the Genesis block.
- **Same day:** A second identical contract is deployed from the same wallet.
- **Bytecode evidence:** "GavCoin" is hardcoded in the constructor bytecode: `0x476176436f696e` = ASCII "GavCoin".
- **Timing:** Gavin's only tweet in April 2016 was within roughly one day of deployment.

### The Circumstantial Case

We can't prove it 100%, but the clues point to Gavin Wood:

- **April 27, 2016:** The day after deployment, Gavin tweets ["Aww. Me and my key"](https://x.com/gavofyork/status/725386148378464256) - his only tweet that month. A coincidence? Maybe.
- **The deployer wallet** traces back through EthDev and the Ethereum Foundation to the Genesis block.
- **The bytecode** has "GavCoin" hardcoded in the constructor. The Solidity source defining that name was pushed to `ethereum/dapp-bin` by Gavin over a year earlier.
- Gavin has never publicly confirmed or denied authorship.

In 2025, [@cartoonitunes wrote an investigation thread](https://x.com/cartoonitunes/status/1947704862159905221) tracing the deployer wallet through Ethereum Foundation infrastructure, bringing renewed attention to this artifact.

### How Mining Works

Anyone can call `mine()` to mint new GAV tokens. The amount minted equals `1000 * (currentBlock - lastMinedBlock)`, distributed to both the caller and the block's coinbase address (validator/miner). GAV uses 3 decimal places (raw values divided by 1000).

## This DApp

This is a faithful resurrection of the original GavCoin dapp interface, updated with modern wallet connectivity (ethers.js v6, MetaMask/injected provider support) while preserving the original visual style.

### Features

- Connect any Ethereum wallet (MetaMask, etc.)
- View your GAV balance
- Mine new GAV tokens
- Send GAV to any address
- View recent contract events
- Works in read-only mode without a wallet

### Technical Details

- Pure static site: HTML + CSS + JS (no build tools, no framework)
- ethers.js v6 loaded from CDN (esm.sh)
- Default RPC: eth.llamarpc.com (public, no API key needed)
- All assets bundled for IPFS deployment

## Deploy

### Local

Just open `index.html` in a browser, or serve with any static file server:

```bash
cd gavcoin
python3 -m http.server 8000
```

### IPFS

```bash
# Using ipfs-car or similar
ipfs add -r .
# Pin with Pinata, web3.storage, etc.
```

### ENS

This site is designed to be deployed to IPFS and linked via ENS contenthash on `gavcoin.eth`, accessible at `gavcoin.eth.limo`.

## Original Sources

- [coin.html](https://github.com/ethereum/dapp-bin/blob/master/coin/coin.html) - Original dapp HTML
- [coin.sol](https://github.com/ethereum/dapp-bin/blob/master/coin/coin.sol) - Solidity source
- [coin.lll](https://github.com/ethereum/dapp-bin/blob/master/coin/coin.lll) - LLL source (likely what was deployed)

## License

This resurrection is open source. The original contract and dapp code are from the `ethereum/dapp-bin` repository.
