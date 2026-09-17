/**
 * update-token-uris.ts
 *
 * One-off operational script: updates the on-chain tokenURIs for tokens 3 and 4
 * from the dead `api.kijo.xyz` domain to the working `api-kijo.netlify.app` proxy.
 *
 * Requires MINTER_ROLE on the Kijonsai contract.
 * The signer comes from PRIVATE_KEY in .env — set it to the minter wallet's
 * private key before running. (On testnet, this may be the same as the deployer.)
 *
 * Usage:
 *   cd packages/contracts
 *   npx hardhat run scripts/update-token-uris.ts --network saigon
 *
 * Safety:
 *   - Dry-run by default: prints what it WILL do, then asks for confirmation.
 *   - Pass --dry-run to skip execution entirely (just print).
 */

import { ethers } from 'hardhat';

const CONTRACT_ADDRESS = '0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44';

const UPDATES: { tokenId: number; uri: string }[] = [
  { tokenId: 3, uri: 'https://api-kijo.netlify.app/nft/metadata/3' },
  { tokenId: 4, uri: 'https://api-kijo.netlify.app/nft/metadata/4' },
];

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`Signer: ${signer.address}`);
  console.log(`Network: ${network.name} (chainId ${network.chainId})`);

  // Minimal ABI — only the functions we call + role check
  const abi = [
    'function updateMetadata(uint256 tokenId, string calldata uri) external',
    'function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) external',
    'function MINTER_ROLE() external view returns (bytes32)',
    'function hasRole(bytes32 role, address account) external view returns (bool)',
    'function tokenURI(uint256 tokenId) external view returns (string)',
  ];

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  // Pre-flight: verify signer has MINTER_ROLE
  const MINTER_ROLE = await contract.MINTER_ROLE();
  const hasRole = await contract.hasRole(MINTER_ROLE, signer.address);
  if (!hasRole) {
    console.error(`\n❌ Signer ${signer.address} does NOT have MINTER_ROLE.`);
    console.error(`   Set PRIVATE_KEY in .env to the minter wallet's key and retry.`);
    process.exit(1);
  }
  console.log(`✅ Signer has MINTER_ROLE\n`);

  // Show current state
  console.log('Current tokenURIs:');
  for (const { tokenId } of UPDATES) {
    const currentUri = await contract.tokenURI(tokenId);
    console.log(`  token ${tokenId}: ${currentUri}`);
  }

  console.log('\nPlanned updates:');
  for (const { tokenId, uri } of UPDATES) {
    console.log(`  token ${tokenId} → ${uri}`);
  }
  console.log(`  + emitBatchMetadataUpdate(3, 4)`);

  if (isDryRun) {
    console.log('\n🔍 Dry run — no transactions sent.');
    return;
  }

  // Execute
  console.log('\nSending transactions...\n');

  for (const { tokenId, uri } of UPDATES) {
    console.log(`updateMetadata(${tokenId}, "${uri}")...`);
    const tx = await contract.updateMetadata(tokenId, uri);
    console.log(`  tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  confirmed in block ${receipt!.blockNumber} (gas: ${receipt!.gasUsed})\n`);
  }

  console.log('emitBatchMetadataUpdate(3, 4)...');
  const tx = await contract.emitBatchMetadataUpdate(3, 4);
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  confirmed in block ${receipt!.blockNumber} (gas: ${receipt!.gasUsed})\n`);

  // Verify
  console.log('Post-update verification:');
  for (const { tokenId, uri } of UPDATES) {
    const newUri = await contract.tokenURI(tokenId);
    const match = newUri === uri ? '✅' : '❌ MISMATCH';
    console.log(`  token ${tokenId}: ${newUri} ${match}`);
  }

  console.log('\n✅ Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
