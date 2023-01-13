const { ethers, network, upgrades } = require("hardhat");
const { writeAddr } = require('./recoder.js');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

async function main() {
    let [owner] = await ethers.getSigners();
    console.log('\ndeployer:', owner.address);

    const QuestMinter = await ethers.getContractFactory('QuestMinter');
    const Badge = await ethers.getContractFactory('Badge');
    const Quest = await ethers.getContractFactory('Quest');

    // 部署Badge
    let badgeInstance;
    {
        const BadgeUri = '';
        badgeInstance = await upgrades.deployProxy(Badge, [BadgeUri]);
        await badgeInstance.deployed();
        console.log('\nBadge contract deployed to:', badgeInstance.address);
    }

    // 部署Quest
    let questInstance;
    {
        questInstance = await upgrades.deployProxy(Quest, [badgeInstance.address], { initializer: 'initialize(address)' });
        await questInstance.deployed();
        console.log('\nQuest contract deployed to:', questInstance.address);
    }

    // 部署 QuestMinter
    let questMinterInstance;
    {
        const badgeAddr = badgeInstance.address;
        const questAddr = questInstance.address;

        questMinterInstance = await upgrades.deployProxy(QuestMinter, [badgeAddr, questAddr]);
        await questMinterInstance.deployed();
        console.log('\nQuestMinter contract deployed to:', questMinterInstance.address);
    }

    // 初始化操作
    {
        await badgeInstance.connect(owner).setMinter(questMinterInstance.address, true);
        console.log('\nBaddge setMinter', questMinterInstance.address);

        await questInstance.connect(owner).setMinter(questMinterInstance.address, true);
        console.log('\nQuest setMinter', questMinterInstance.address);
    }

    {
        // 记录地址
        await writeAddr(badgeInstance.address, 'Badge', network.name);
        await writeAddr(questInstance.address, 'Quest', network.name);
        await writeAddr(questMinterInstance.address, 'QuestMinter', network.name);
    }

    {
        const badgeLogicAddr = await getImplementationAddress(ethers.provider, badgeInstance.address);
        const quesLogicAddr = await getImplementationAddress(ethers.provider, questInstance.address);
        const quesMinterLogicAddr = await getImplementationAddress(ethers.provider, questMinterInstance.address);

        // 开源认证
        if (!['hardhat', 'localhost'].includes(network.name)) {
            console.log(`\nPlease verify implementation address [Badge]:\n npx hardhat verify ${badgeLogicAddr} --network ${network.name}`);
            console.log(`\nPlease verify implementation address [Quest]:\n npx hardhat verify ${quesLogicAddr} --network ${network.name}`);
            console.log(`\nPlease verify implementation address [QuestMinter]:\n npx hardhat verify ${quesMinterLogicAddr} --network ${network.name}`);
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });