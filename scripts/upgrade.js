const { ethers, upgrades, network } = require("hardhat");
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

async function main() {
    const contractName = 'QuestMinter'; //to change
    const proxyAddr = require(`../deployments/${network.name}/${contractName}.json`).address;
    const contract = await ethers.getContractFactory(contractName);

    const proxy = await upgrades.upgradeProxy(proxyAddr, contract);
    await proxy.deployed();


    const logicAddr = await getImplementationAddress(ethers.provider, proxy.address);
    console.log(`[${contractName}] implementation contract deployed to:`, logicAddr);

    if (!['hardhat', 'localhost'].includes(network.name)) {
        console.log(`[${contractName}] Please verify new implementation contract : npx hardhat verify ${logicAddr} --network ${network.name}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });