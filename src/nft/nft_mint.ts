import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import wallet from "../../devnet-wallet.json";
import {
  createSignerFromKeypair,
  generateSigner,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { create, mplCore, updateAuthority } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { url } from "inspector/promises";

const umi = createUmi(
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
);

const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(signerIdentity(signer));

umi.use(mplCore());

(async () => {
  try {
    const metadataUri =
      "https://gateway.irys.xyz/Dw4dazGVwbVv5JtrenarpSPJQJVpEsQ9hdQMNLmed6iV";
    const asset = generateSigner(umi);

    //add you nft name and metadata uri
    const tx = create(umi, {
      asset,
      name: "Straw Hat Pirates Jolly Roger Luffy Drawn",
      uri: metadataUri,
      updateAuthority: keypair.publicKey,
    })
    const sig = (await tx.sendAndConfirm(umi)).signature;

    const signature = base58.deserialize(sig)[0];

    console.log(`signature ${signature} , asset : ${asset.publicKey}`);
  } catch (e) {
    console.log(`errior ${e}`);
  }
})();
