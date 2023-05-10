const { ethers, network, upgrades } = require("hardhat");
const axios = require('axios')

const BadgeAddr = (require(`../deployments/${network.name}/Badge.json`)).address;
const QuestMinterAddr = (require(`../deployments/${network.name}/QuestMinter.json`)).address;
const QuestAddr = (require(`../deployments/${network.name}/Quest.json`)).address;

async function main() {
    const tokenID = 10118 // 需要修改的 TOKEN ID


    accounts = await ethers.getSigners();
    singer = accounts[0];

    questContract = await ethers.getContractAt("Quest", QuestAddr, singer);

    const creator = await questContract.connect(singer).ownerOf(tokenID)

    const uri = await JSONv1Migrate(tokenID)

    const hash = ethers.utils.solidityKeccak256(['uint256', 'string', 'address', 'address'], [tokenID, uri, BadgeAddr, creator]);
    const signature = await singer.signMessage(ethers.utils.arrayify(hash));

    console.log('Singer',singer.address)
    console.log('Creator',creator)
    console.log('Contract',QuestMinterAddr)
    console.log('tokenID',tokenID)
    console.log('uri',uri)
    console.log('signature',signature)
}

async function JSONv1Migrate(tokenID) {
    accounts = await ethers.getSigners();
    account1 = accounts[0];
    questContract = await ethers.getContractAt("Quest", QuestAddr, account1);
    const creator = await questContract.connect(account1).ownerOf(tokenID)
    const old = await questContract.connect(account1).getQuest(tokenID)

    // console.log(old)
    let jsonRes = ''
    await axios.get('http://ipfs.learnblockchain.cn/' + old.uri.replace('ipfs://', ''))
        .then((response) => {
            jsonRes = response.data
        })
        .catch((error) => {
            console.error(error)
            process.exit(1);
        })

    // 迁移JSON
    const challengeJSON = {
        "title": jsonRes.title,
        "description": jsonRes.description,
        "creator": creator,
        "content": "",
        "questions": jsonRes.properties.questions,
        "answers": jsonRes.properties.answers,
        "startTime": jsonRes.properties.startTime,
        "estimateTime": jsonRes.properties.estimateTime,
        "endTIme": jsonRes.properties.endTIme,
        "passingScore": jsonRes.properties.passingScore,
        "version": 1.1
    }

    // 上传JSON
    let challenge_url = ""
    await axios.post('http://192.168.1.10:3022/v1/upload/json', { "body": challengeJSON })
        .then((response) => {
            challenge_url = "ipfs://" + response.data.hash
        })
        .catch((error) => {
            console.error(error)
        })


    const newJSON = {
        "name": jsonRes.title,
        "description": jsonRes.description,
        "image": jsonRes.image,
        "attributes": {
            "challenge_ipfs_url": challenge_url,
            "challenge_url": "https://decert.me/quests/" + generateUUID(),
            "challenge_title": jsonRes.title,
            "creator": creator,
            "difficulty": convertDifficulty(jsonRes.properties.difficulty)
        },
        "external_url": "https://decert.me",
        "version": 1.1
    }
    // 上传JSON
    let uri = ""
    await axios.post('http://192.168.1.10:3022/v1/upload/json', { "body": newJSON })
        .then((response) => {
            uri = "ipfs://" + response.data.hash
        })
        .catch((error) => {
            console.error(error)
        })

    return uri
}

const convertDifficulty = (value) => {
    switch (value) {
        case 0:
            return 'easy'
        case 1:
            return 'normal'
        case 2:
            return 'diff'
        default:
            return ''
    }
}

function generateUUID() {
    let d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        d += performance.now(); // use high-precision timer if available
    }
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });