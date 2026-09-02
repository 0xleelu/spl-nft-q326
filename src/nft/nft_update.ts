import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { update, mplCore,fetchAsset } from '@metaplex-foundation/mpl-core'
import { createSignerFromKeypair, signerIdentity } from '@metaplex-foundation/umi';
import wallet from "../../devnet-wallet.json"
import { base58 } from '@metaplex-foundation/umi/serializers';

const umi = createUmi('https://api.devnet.solana.com').use(mplCore());
const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));

  (async () => {
    try {
      const assetAddress = await fetchAsset(umi, "DQjTtqMVRY88VeiyEjNzsFaRMFvfAxPZpcj8dgMYu4b5")

      // Update an existing NFT asset's metadata
      const result = await update(umi, {
        asset: assetAddress,
        name: 'luffy drawn nft with its updated name',
        uri: 'https://gateway.irys.xyz/DYWuqYiG4RA6rd8MCZEgguNLQVLg5wSo9QwPUAW3cex3',
      }).sendAndConfirm(umi)

      const signature = base58.deserialize(result.signature)[0];
      console.log(`Asset updated successfully ${signature}`);
    } catch (e) {
      console.log(`error ${e}`);
    }
  })();
