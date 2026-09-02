import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { transfer, mplCore,fetchAsset } from '@metaplex-foundation/mpl-core'
import { createSignerFromKeypair, signerIdentity } from '@metaplex-foundation/umi'
import wallet from "../../devnet-wallet.json"
import { base58 } from '@metaplex-foundation/umi/serializers'
import { publicKey } from '@metaplex-foundation/umi'

// Initialize UMI
const umi = createUmi('https://api.devnet.solana.com').use(mplCore());
const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));

(async () => {
  try {
    const assetAddress = await fetchAsset(umi, "DQjTtqMVRY88VeiyEjNzsFaRMFvfAxPZpcj8dgMYu4b5")

    // Transfer an existing NFT asset to a new owner
    const result = await transfer(umi, {
      asset: assetAddress,
      newOwner: publicKey("D2M8xt2FWqkX4TxqxGRnv2gWeyeMBX6K15FCrV8MiKpW"),
    }).sendAndConfirm(umi)

    const signature = base58.deserialize(result.signature)[0];

    console.log('Asset transferred:', signature);
    ;
  } catch (e) {
    console.log(`error ${e}`);
  }
})();
