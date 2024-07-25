const { ethers, network } = require("hardhat");

const BadgeAddr = (require(`../deployments/${network.name}/Badge.json`)).address;
const BadgeMinterAddr = (require(`../deployments/${network.name}/BadgeMinter.json`)).address;

let bage;
let bageMinterContract;

// dev:0xc317F18d166e521de7eADBf39938699e7bA14C6b
// prod:0x243eB242211BE9901DE468767082338a1a5A0a38
// const signerPriKey = '0eb4c30ca400aff87fbfffec6aea896987e129d81ec1c5a0fe57be1307e90fb7'; //dev
const signerPriKey = ''; //prod
const signer = new ethers.Wallet(signerPriKey, ethers.provider);

// 0xC27018ca6c6DfF213583eB504df4a039Cc7d8043
const bageOwnerPrikey = '' //
const bageOwner = new ethers.Wallet(bageOwnerPrikey, ethers.provider);


async function init() {
    console.log(`bageOwner: ${bageOwner.address},\nsigner: ${signer.address}`);

    bage = await ethers.getContractAt("Badge", BadgeAddr, signer);
    bageMinterContract = await ethers.getContractAt("BadgeMinter", BadgeMinterAddr, signer);
}

async function main() {
    await init();

    // 获取原内容
    const tokenId = '8970423441318521685705421700773595597194038439371154405121475125570931771838';

    // 替换url
    const uri = 'ipfs://bafkreia4uwgcb65muphcusdriaw5jhpknxzig53nw3fpkd2zet2cxx7bau';

    // // 生成签名
    let signature = await genSig(tokenId, uri);
    console.log('====signature====', signature);

    // // 调用合约
    const result = await bageMinterContract.connect(bageOwner).updateURI(tokenId, uri, signature);
    console.log('hash:', result.hash);
}


async function genSig(tokenId, uri) {
    const hash = ethers.utils.solidityKeccak256(
        ['uint256', 'string', 'address', 'address'],
        [tokenId, uri, BadgeMinterAddr, bageOwner.address]);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
}


main()