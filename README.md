# scripts-solana

Scripts for creating SPL tokens and NFTs on Solana devnet.

---

## Setup

### 1. Add your wallet

Place your devnet wallet keypair file at the project root:

```
root/
└── devnet-wallet.json   ← here
```

It should be a JSON array of numbers, e.g. `[174, 23, ...]`.

### 2. Install dependencies

```bash
npm install
```

```bash
npm install --save-dev @types/node ts-node typescript
```

### 3. Add your image

Place your image at the project root.

```
root/
└── og_strawhat.png   ← here
```

`nft_image.ts` reads this file by name — update the path and the `createGenericFile` mime type in that script if you use a different image.

---

> Before running the scripts, go through these docs:
> - [Solana token docs](https://solana.com/docs/tokens) — mint accounts, token accounts, and ATAs
> - [Solana Kit](https://www.solanakit.com/) — the JS SDK used for building and sending transactions
> - [Metaplex Token Metadata](https://www.metaplex.com/docs/smart-contracts/token-metadata) — attaching metadata to SPL tokens
> - [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core) — the NFT standard used in the NFT scripts

## SPL Token

Uses **@solana/kit** and **@solana-program/token** for transactions, and **mpl-token-metadata** via UMI for on-chain metadata.

| Script | Command | What it does |
|---|---|---|
| `spl_init.ts` | `npm run spl:init` | Creates a new mint account |
| `spl_metadata.ts` | `npm run spl:metadata` | Attaches a name, symbol, and URI to the mint |
| `spl_mint.ts` | `npm run spl:mint` | Creates your associated token account and mints tokens into it |
| `spl_transfer.ts` | `npm run spl:transfer` | Sends tokens to another wallet i.e ata to ata |

Run them in order. Each script logs the addresses/signatures you'll need to paste into the next one.

---

## NFT
Uses **@solana/kit** and **mpl-core** via UMI. Images and metadata are stored on Irys (decentralized storage).

| Script | Command | What it does |
|---|---|---|
| `nft_image.ts` | `npm run nft:image` | Uploads your image to Irys, logs the image URI |
| `nft_metadata.ts` | `npm run nft:metadata` | Builds the metadata JSON and uploads it, logs the metadata URI |
| `nft_mint.ts` | `npm run nft:mint` | Mints the NFT on-chain using the metadata URI, with your wallet set as update authority |
| `nft_update.ts` | `npm run nft:update` | Fetches the existing on-chain asset, then updates its name and metadata URI as the update authority |
| `nft_transfer_ownership.ts` | `npm run nft:transfer` | Transfers an existing NFT asset to a new owner wallet (optional extension task) |


Run them in order. Paste the URI logged by each step into the next script before running it. For `nft_update.ts`, paste the asset address logged by `nft_mint.ts` into the `fetchAsset` call before running. For `nft_transfer_ownership.ts`, paste the asset address and the recipient wallet's public key before running..

---
## Notes

### Update authority (`nft_mint.ts`)
The `updateAuthority` field on `create()` expects a plain `PublicKey | Pda | undefined` — it is **not** a discriminated union, so it doesn't need a `{ __kind, fields }` wrapper. Passing `keypair.publicKey` directly is correct:

```ts
updateAuthority: keypair.publicKey
```

If omitted entirely, mpl-core defaults the update authority to the transaction signer anyway — since the signer here *is* `keypair`, this line is technically optional in this repo, but it's kept explicit for clarity and to support cases where authority and signer differ.

### Fetching before updating (`nft_update.ts`)
`update()`'s `asset` field expects the **full current asset object** — not just its address:

```ts
asset: Pick<AssetV1, "owner" | "publicKey" | "oracles" | "lifecycleHooks">
```

This is because `update` needs to know the asset's existing on-chain state (owner, attached plugins/oracles, etc.) to build a valid update instruction. A bare address string doesn't carry that. The fix is to fetch the asset first, then pass the result into `update`:

```ts
const assetAddress = await fetchAsset(umi, "<asset address>");
const result = await update(umi, {
  asset: assetAddress,
  name: "...",
  uri: "...",
}).sendAndConfirm(umi);
```

### Signer identity (all scripts)
Every script attaches the wallet as the active signer before sending any transaction:

```ts
const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));
```

- `wallet.json` is a plain array of secret key bytes — `Uint8Array` conversion is required because Solana's crypto libraries expect typed byte arrays, not generic JS arrays.
- `createKeypairFromSecretKey` derives the public key from the secret key (EdDSA keys are mathematically linked) and returns both as a `Keypair`.
- Without `umi.use(signerIdentity(signer))`, transactions fail at send time with `Error: Trying to use a NullSigner` — Umi has no default signer, so it must be attached explicitly before any `sendAndConfirm()` call.

### Top-level `await` and module config
This repo's `tsconfig.json` uses `"module": "commonjs"`, which does not support top-level `await`. All scripts wrap their async logic in an immediately-invoked async function instead:

```ts
(async () => {
  try {
    // ...
  } catch (e) {
    console.log(`error ${e}`);
  }
})();
```

Watch for missing semicolons before this pattern — `const umi = createUmi(...).use(mplCore())` followed directly by `(async () => {...})()` on the next line with no semicolon gets parsed as one expression (`umi.use(...)(async () => {...})()`), which TypeScript reports as `"Umi has no call signatures"`.

### Reading signatures
`sendAndConfirm()` returns `signature` as a raw `Uint8Array`, not a readable string. It's decoded to base58 before logging:

```ts
const signature = base58.deserialize(result.signature)[0];
```

### Security
`devnet-wallet.json` contains a **raw private key** in plaintext byte-array form. It is gitignored and must never be committed, shared, or reused for a mainnet wallet.

### Transferring ownership (`nft_transfer_ownership.ts`)
This script started as a copy of `nft_update.ts`'s boilerplate — same Umi setup, same signer identity block, same `fetchAsset` call to load the full asset object first. The only functional changes were swapping `update(...)` for mpl-core's `transfer(...)`, and replacing the `name`/`uri` update fields with a `newOwner` field:

```ts
const result = await transfer(umi, {
  asset: assetAddress,
  newOwner: publicKey("<recipient wallet address>"),
}).sendAndConfirm(umi);
```

Two things worth noting from reusing the pattern:

- **`newOwner` is a distinct concept from `updateAuthority`.** `updateAuthority` controls who can *edit* the asset's metadata; `newOwner` controls who *holds* the NFT after the transfer. They're unrelated fields and can point to different wallets.
- **`newOwner` requires the typed `PublicKey` type, not a raw string** — same distinction seen earlier with `updateAuthority`. The `publicKey(...)` helper from `@metaplex-foundation/umi` wraps a base58 string into that type.

One gotcha hit while testing: the base58 signature decode step was added *after* the transfer transaction had already been sent, so the first run logged the raw `Uint8Array` signature instead of a readable string. Since the transaction was already confirmed on-chain, the fix didn't require re-running the transfer — the same raw bytes were decoded after the fact with `base58.deserialize(rawBytes)[0]` to recover the readable signature for the explorer link.

### Screenshots

All screenshots live under [`images/`](images), split into `images/online/` (explorer / Metaplex Core views) and `images/terminal ss/` (CLI output).

**Online — SPL Token**
- Minting (Solscan): ![spltoken-minting solscan](images/online/spltoken-minting%20solscan.png)
- Transfer receipt (Solscan): ![spltoken-transferring receipt solscan](images/online/spltoken-transferring%20receipt%20solscan.png)

**Online — NFT**
- Minting (Metaplex Core): ![nft-minting nft metaplex core](images/online/nft-minting%20nft%20metaplex%20core.png)
- Updating name and metadata (Metaplex Core): ![nft-updating name and metadata metaplex core](images/online/nft-updating%20name%20and%20metadata%20metaplex%20core.png)
- Transferring owner (Solscan): ![nft-transferring owner solscan](images/online/nft-transferring%20owner%20solscan.png)

**Terminal — SPL Token**
- Mint: ![spltoken-mint successful ss](images/terminal%20ss/spltoken-mint%20successful%20ss.png)
- Transfer: ![spltoken-transferring successful ss](images/terminal%20ss/spltoken-transferring%20successful%20ss.png)

**Terminal — NFT**
- Minting: ![nft-minting successful ss](images/terminal%20ss/nft-minting%20successful%20ss.png)
- Transferring: ![nft-transferring successful ss](images/terminal%20ss/nft-transferring%20successful%20ss.png)
- Transferring (alt run): ![nft-transferring successful ss(1)](images/terminal%20ss/nft-transferring%20successful%20ss%281%29.png)
- Transferring owner: ![nft-transferring owner successful](images/terminal%20ss/nft-transferring%20owner%20successful.png)
