const { ethers, network, upgrades } = require("hardhat");
const { writeAddr } = require('./recoder.js');


async function main() {
  let [owner] = await ethers.getSigners();
  let contractName = 'Badge';
  const contractFactory = await ethers.getContractFactory(contractName);

  const contract = await contractFactory.deploy('');
  await contract.deployed();

  console.log(`[${contractName}] contract deployed to:`, contract.address);
  await writeAddr(contract.address, contractName, network.name);

  if (!['hardhat', 'localhost'].includes(network.name)) {
    console.log(`[${contractName}] Please verify implementation contract : npx hardhat verify ${contract.address} --network ${network.name}`);
  }
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });