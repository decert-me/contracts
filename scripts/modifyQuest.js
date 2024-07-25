const { ethers, network } = require("hardhat");

const QuestMinterAddr = (require(`../deployments/${network.name}/QuestMinter.json`)).address;
const QuestAddr = (require(`../deployments/${network.name}/Quest.json`)).address;
let questContract;
let questMinterContract;

const signerPriKey = '';
const signer = new ethers.Wallet(signerPriKey, ethers.provider);

const creatorPrikey = ''
const creator = new ethers.Wallet(creatorPrikey, ethers.provider);


async function init() {
    console.log(`creator: ${creator.address}, signer: ${signer}`);

    questContract = await ethers.getContractAt("Quest", QuestAddr, signer);
    questMinterContract = await ethers.getContractAt("QuestMinter", QuestMinterAddr, signer);
}

async function main() {
    await init();

    // 获取原内容
    const tokenId = '62016902449589482603347309471149909605775242086529622696907085749735627073737';

    let questData = await questContract.quests(tokenId);
    questData = Object.assign({}, questData);

    //  替换url
    const newUri = 'ipfs://bafkreigqmk5xzww5ls6aqcmvipdl5k7rf2pyxyddm47bmms44oqkmwyz2u';
    questData.uri = newUri;

    // 生成签名
    let signature = await genModifyQuestSig(tokenId, questData);

    // 调用合约
    const result = await questMinterContract.connect(creator).modifyQuest(tokenId, questData, signature);
    console.log(result);
}


async function genModifyQuestSig(tokenId, questData) {
    const { startTs, endTs, title, uri } = questData;

    const hash = ethers.utils.solidityKeccak256(
        ['uint256', 'uint32', 'uint32', 'string', 'string', 'address', 'address'],
        [tokenId, startTs, endTs, title, uri, QuestMinterAddr, creator.address]);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
}


main()