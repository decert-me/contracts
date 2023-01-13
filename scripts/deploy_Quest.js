const { ethers, network, upgrades } = require("hardhat");
const { writeAddr } = require('./recoder.js');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');


async function main() {
  let [owner] = await ethers.getSigners();
  let contractName = 'Quest';
  const contract = await ethers.getContractFactory(contractName);

  const BadgeAddr = (require(`../deployments/${network.name}/Badge.json`)).address;
  let params = [BadgeAddr];

  const proxy = await upgrades.deployProxy(contract, params, { initializer: 'initialize(address)' });
  await proxy.deployed();

  console.log(`[${contractName}] proxy contract deployed to:`, proxy.address);
  await writeAddr(proxy.address, contractName, network.name);

  const logicAddr = await getImplementationAddress(ethers.provider, proxy.address);
  console.log(`[${contractName}] implementation contract deployed to:`, logicAddr);

  if (!['hardhat', 'localhost'].includes(network.name)) {
    console.log(`[${contractName}] Please verify implementation contract : npx hardhat verify ${logicAddr} --network ${network.name}`);
  }
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });