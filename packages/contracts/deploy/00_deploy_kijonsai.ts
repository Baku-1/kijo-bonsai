import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { admin: deployer } = await getNamedAccounts();

  // Read role addresses from env — fail fast if missing.
  // ADMIN_ADDRESS receives DEFAULT_ADMIN_ROLE (can be the deployer on testnet,
  // a multisig on mainnet). MINTER_ADDRESS receives MINTER_ROLE (server wallet).
  const adminAddress = process.env.ADMIN_ADDRESS;
  const minterAddress = process.env.MINTER_ADDRESS;

  if (!adminAddress) {
    throw new Error('ADMIN_ADDRESS env var is required. Set it in .env (see .env.example).');
  }
  if (!minterAddress) {
    throw new Error('MINTER_ADDRESS env var is required. Set it in .env (see .env.example).');
  }

  console.log(`[${network.name}] Deploying Kijonsai...`);
  console.log(`  deployer (gas payer): ${deployer}`);
  console.log(`  admin (DEFAULT_ADMIN_ROLE): ${adminAddress}`);
  console.log(`  minter (MINTER_ROLE):       ${minterAddress}`);

  const result = await deploy('Kijonsai', {
    from: deployer,
    args: [adminAddress, minterAddress],
    log: true,
    waitConfirmations: network.name === 'ronin' ? 5 : 1,
  });

  if (result.newlyDeployed) {
    console.log(`✅ Kijonsai deployed at: ${result.address}`);
    console.log(`   Block:    ${result.receipt?.blockNumber}`);
    console.log(`   Gas used: ${result.receipt?.gasUsed}`);
  } else {
    console.log(`ℹ️  Kijonsai already deployed at: ${result.address} (skipping)`);
  }
};

func.tags = ['Kijonsai'];
func.id = 'Kijonsai'; // prevents re-deployment on subsequent runs

export default func;
