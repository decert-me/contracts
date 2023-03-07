const { ethers, network } = require("hardhat");
const questMinterAddr = require(`../deployments/${network.name}/QuestMinter.json`).address;
const badgeAddr = require(`../deployments/${network.name}/Badge.json`).address;
let questMinter, badge;
let signer, user;


async function init() {
    let accounts = await ethers.getSigners();
    signer = accounts[0];
    user = accounts[1];
    console.log('signer.address', signer.address);
    questMinter = await ethers.getContractAt('QuestMinter', questMinterAddr);
    badge = await ethers.getContractAt('Badge', badgeAddr);
}

const questData = {
    startTs: 0,
    endTs: 0,
    supply: 0,
    title: 'test',
    uri: 'ipfs://QmUMZseZM7ggKKaWqaaQZ3xb9uKSXGb3LgdauZyH6cv5mv',
}

async function genCreateQuestSig(questData, sender, signer) {
    const types = ['uint32', 'uint32', 'uint192', 'string', 'string', 'address', 'address'];
    const { startTs, endTs, supply, title, uri } = questData;
    const params = [startTs, endTs, supply, title, uri, questMinterAddr, sender.address];

    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
}

async function createQuest() {
    const signature = await genCreateQuestSig(questData, user, signer);

    try {
        await questMinter.connect(user).createQuest(questData, signature);
        console.log('====createQuest succeed====\n');
    } catch (err) {
        console.log('====createQuest failed====\n', err);
    }
}

async function claimBadge() {
    // const signature = await genCreateQuestSig(questData, user, signer);
    const signature = '0xc08ad49b98501a306361d3e5af01b5d7ddb7b29b21df70a8e7f8c6cff06dd74164ae75b2957965a9cbd96ab59678b6ebd2882e6195bf37639d526e8e742f10d41c';
    const tokenId = 10000;
    const score = 50;

    try {
        await questMinter.connect(user).claim(tokenId, score, signature);
        console.log('====claimBadge succeed====\n');
    } catch (err) {
        console.log('====claimBadge failed====\n', err);
    }
    
    const balance = await badge.balanceOf(user.address, tokenId);
    console.log('====badge balance====', balance);
}

// 0xc08ad49b98501a306361d3e5af01b5d7ddb7b29b21df70a8e7f8c6cff06dd74164ae75b2957965a9cbd96ab59678b6ebd2882e6195bf37639d526e8e742f10d41c

async function main() {
    await init();

    await createQuest();

    await claimBadge();
}
main()