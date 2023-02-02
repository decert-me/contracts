const { ethers, upgrades, network } = require("hardhat");


async function main() {
    const contractName = 'QuestMinter'; //to change
    const proxyAddr = require(`../deployments/${network.name}/${contractName}.json`).address;
    const contract = await ethers.getContractFactory(contractName);

    const result = await upgrades.forceImport(proxyAddr, contract, { kind: 'transparent' });

    console.log('=====forceImport========', result);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });