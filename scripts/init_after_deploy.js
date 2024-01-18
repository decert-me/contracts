require('dotenv').config();
const { ethers, network, upgrades } = require("hardhat");

async function main() {
    let [owner] = await ethers.getSigners();

    const BadgeAddr = (require(`../deployments/${network.name}/Badge.json`)).address;
    const QuestAddr = (require(`../deployments/${network.name}/Quest.json`)).address;
    const QuestMinterAddr = (require(`../deployments/${network.name}/QuestMinter.json`)).address;
    const QuestMetadataAddr = (require(`../deployments/${network.name}/QuestMetadata.json`)).address;

    // Badge 初始化
    {
        const badgeInstance = await ethers.getContractAt("Badge",BadgeAddr,owner);
        await badgeInstance.connect(owner).setMinter(BadgeMinterAddr, true);
        console.log('\nBaddge setMinter', BadgeMinterAddr);
    }

    // Quest 初始化
    {
        const questInstance = await ethers.getContractAt("Quest", QuestAddr,owner);
        await questInstance.connect(owner).setMinter(QuestMinterAddr, true);
        console.log('\nQuest setMinter', QuestMinterAddr);
    
        await questInstance.connect(owner).setMetaContract(QuestMetadataAddr);
        console.log('\nQuest setMetaContract', QuestMetadataAddr);
    }

    // QuestMinter 初始化
    {   
        const MinterSigner = process.env.MINTER_SIGNER
        if(MinterSigner){
            const questMinterInstance = await ethers.getContractAt("QuestMinter", QuestMinterAddr,owner);
            await questMinterInstance.connect(owner).setSigner(MinterSigner);
            console.log('\nquestMinter setSigner', MinterSigner);

            const badgeMinterInstance = await ethers.getContractAt("BadgeMinter", QuestMinterAddr,owner);
            await badgeMinterInstance.connect(owner).setSigner(MinterSigner);
            console.log('\nbadgeMinter setSigner', MinterSigner);
        }else{
            console.log('\nQuestMinter use deployer as signer');
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });