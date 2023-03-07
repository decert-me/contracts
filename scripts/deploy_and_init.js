const { ethers, network, upgrades } = require("hardhat");
const { writeAddr } = require('./recoder.js');

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
        badgeInstance = await Badge.deploy(BadgeUri);
        await badgeInstance.deployed();
        console.log('\nBadge contract deployed to:', badgeInstance.address);
    }

    // 部署Quest
    let questInstance;
    {
        questInstance = await Quest.deploy(badgeInstance.address);
        await questInstance.deployed();
        console.log('\nQuest contract deployed to:', questInstance.address);
    }

    // 部署 QuestMinter
    let questMinterInstance;
    {
        const badgeAddr = badgeInstance.address;
        const questAddr = questInstance.address;

        questMinterInstance = await QuestMinter.deploy(badgeAddr, questAddr);
        await questMinterInstance.deployed();
        console.log('\nQuestMinter contract deployed to:', questMinterInstance.address);
    }

    // 部署 QuestMetadata
    let questMetadataInstance;
    {
        const badgeAddr = badgeInstance.address;
        const questAddr = questInstance.address;

        questMetadataInstance = await QuestMinter.deploy(badgeAddr, questAddr);
        await questMetadataInstance.deployed();
        console.log('\nQuestMetadata contract deployed to:', questMetadataInstance.address);
    }

    // 初始化操作
    {
        await badgeInstance.connect(owner).setMinter(questMinterInstance.address, true);
        console.log('\nBaddge setMinter', questMinterInstance.address);

        await questInstance.connect(owner).setMinter(questMinterInstance.address, true);
        console.log('\nQuest setMinter', questMinterInstance.address);

        await questInstance.connect(owner).setMetaContract(questMetadataInstance.address);
        console.log('\nQuest setMetaContract', questMetadataInstance.address);

    }

    {
        // 记录地址
        await writeAddr(badgeInstance.address, 'Badge', network.name);
        await writeAddr(questInstance.address, 'Quest', network.name);
        await writeAddr(questMinterInstance.address, 'QuestMinter', network.name);
        await writeAddr(questMetadataInstance.address, 'QuestMetadata', network.name);
    }

    {

        // 开源认证
        if (!['hardhat', 'localhost'].includes(network.name)) {
            console.log(`\nPlease verify contract address [Badge]:\n npx hardhat verify ${badgeInstance.address} --network ${network.name}`);
            console.log(`\nPlease verify contract address [Quest]:\n npx hardhat verify ${questInstance.address} --network ${network.name}`);
            console.log(`\nPlease verify contract address [QuestMinter]:\n npx hardhat verify ${questMinterInstance.address} --network ${network.name}`);
            console.log(`\nPlease verify contract address [questMetadata]:\n npx hardhat verify ${questMetadataInstance.address} --network ${network.name}`);
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });