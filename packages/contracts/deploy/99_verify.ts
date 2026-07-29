import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

/**
 * Sourcify verification — runs after all deploy scripts on live networks.
 *
 * Uses the sourcify config from hardhat.config.ts (endpoint, browserUrl).
 * Skip on hardhat/localhost — nothing to verify there.
 *
 * Note: hardhat-deploy's DeployFunction uses `runAtTheEnd` (not `runAtEnd`).
 * The Ronin Sourcify endpoint (https://sourcify.roninchain.com/server/) is set
 * in hardhat.config.ts sourcify block; this script just triggers the task.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name === 'hardhat' || hre.network.name === 'localhost') {
    return;
  }

  console.log(`Verifying contracts on Ronin Sourcify (${hre.network.name})...`);
  // Uses the `sourcify` block in hardhat.config.ts for the endpoint.
  await hre.run('sourcify');
};

func.tags = ['VerifyContracts'];
func.runAtTheEnd = true;
func.dependencies = ['Kijonsai'];

export default func;
