const { ethers, network, upgrades } = require("hardhat");
const { writeAddr } = require('./recoder.js');

async function main() {
    let [owner] = await ethers.getSigners();
    console.log('\ndeployer:', owner.address);

    const QuestMinter = await ethers.getContractFactory('QuestMinter');
    const BadgeMinter = await ethers.getContractFactory('BadgeMinter');
    const Badge = await ethers.getContractFactory('Badge');
    const Quest = await ethers.getContractFactory('Quest');
    const QuestMetadata = await ethers.getContractFactory('QuestMetadata');

    // 部署Badge
    let badgeInstance;
    {
        badgeInstance = await Badge.deploy();
        await badgeInstance.deployed();
        await writeAddr(badgeInstance.address, 'Badge', network.name);        // 记录地址
        console.log('\nBadge contract deployed to:', badgeInstance.address);
    }

    // 部署Quest
    let questInstance;
    {
        questInstance = await Quest.deploy();
        await questInstance.deployed();
        await writeAddr(questInstance.address, 'Quest', network.name); // 记录地址
        console.log('\nQuest contract deployed to:', questInstance.address);
    }

    // 部署 BadgeMinter
    let badgeMinterInstance;
    {
        const badgeAddr = badgeInstance.address;

        badgeMinterInstance = await BadgeMinter.deploy(badgeAddr);
        await badgeMinterInstance.deployed();
        await writeAddr(badgeMinterInstance.address, 'BadgeMinter', network.name);// 记录地址
        console.log('\nBadgeMinter contract deployed to:', badgeMinterInstance.address);
    }

    // 部署 QuestMinter
    let questMinterInstance;
    {
        const questAddr = questInstance.address;

        questMinterInstance = await QuestMinter.deploy(questAddr);
        await questMinterInstance.deployed();
        await writeAddr(questMinterInstance.address, 'QuestMinter', network.name);// 记录地址
        console.log('\nQuestMinter contract deployed to:', questMinterInstance.address);
    }

    // 部署 QuestMetadata
    let questMetadataInstance;
    {
        const badgeAddr = badgeInstance.address;
        const questAddr = questInstance.address;

        questMetadataInstance = await QuestMetadata.deploy(questAddr);
        await questMetadataInstance.deployed();
        await writeAddr(questMetadataInstance.address, 'QuestMetadata', network.name);// 记录地址
        console.log('\nQuestMetadata contract deployed to:', questMetadataInstance.address);
    }

    // 初始化操作
    {
        await badgeInstance.connect(owner).setMinter(badgeMinterInstance.address, true);
        console.log('\nBaddge setMinter', badgeMinterInstance.address);

        await questInstance.connect(owner).setMinter(questMinterInstance.address, true);
        console.log('\nQuest setMinter', questMinterInstance.address);

        await questInstance.connect(owner).setMetaContract(questMetadataInstance.address);
        console.log('\nQuest setMetaContract', questMetadataInstance.address);

        // 设置signer
        {
            const MinterSigner = process.env.MINTER_SIGNER
            if (MinterSigner) {
                await questMinterInstance.connect(owner).setSigner(MinterSigner);
                console.log('\nquestMinter setSigner', MinterSigner);

                await badgeMinterInstance.connect(owner).setSigner(MinterSigner);
                console.log('\nquestMinter setSigner', MinterSigner);
            } else {
                console.log('\nQuestMinter use deployer as signer');
            }
        }
    }

    {

        // 开源认证
        if (!['hardhat', 'localhost'].includes(network.name)) {
            console.log(`\nPlease verify contract address [Badge]:\n npx hardhat verify ${badgeInstance.address} --network ${network.name}`);
            console.log(`\nPlease verify contract address [Quest]:\n npx hardhat verify ${questInstance.address} --network ${network.name}`);
            console.log(`\nPlease verify contract address [BadgeMinter]:\n npx hardhat verify ${badgeMinterInstance.address} "${badgeInstance.address}" --network ${network.name}`);
            console.log(`\nPlease verify contract address [QuestMinter]:\n npx hardhat verify ${questMinterInstance.address} "${questInstance.address}" --network ${network.name}`);
            console.log(`\nPlease verify contract address [QuestMetadata]:\n npx hardhat verify ${questMetadataInstance.address} "${questInstance.address}" --network ${network.name}`);
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });