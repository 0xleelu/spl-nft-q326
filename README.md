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
└── image.jpeg   ← here
```

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

Run them in order. Paste the URI logged by each step into the next script before running it. For `nft_update.ts`, paste the asset address logged by `nft_mint.ts` into the `fetchAsset` call before running.

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
