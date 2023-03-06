const { ethers, network, upgrades } = require("hardhat");
const { writeAddr } = require('./recoder.js');


async function main() {
  let [owner] = await ethers.getSigners();
  let contractName = 'Quest';
  const contractFactory = await ethers.getContractFactory(contractName);

  const BadgeAddr = (require(`../deployments/${network.name}/Badge.json`)).address;

  const contract = await contractFactory.deploy(BadgeAddr);
  await contract.deployed();

  console.log(`[${contractName}] contract deployed to:`, contract.address);
  await writeAddr(contract.address, contractName, network.name);


  if (!['hardhat', 'localhost'].includes(network.name)) {
    console.log(`[${contractName}] Please verify contract : npx hardhat verify ${contract.address} --network ${network.name}`);
  }
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });