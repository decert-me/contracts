const { ethers, network, upgrades } = require("hardhat");
const BadgeAddr = (require(`../deployments/${network.name}/Badge.json`)).address;

async function main() {
    let tokenIdList = [10309,10308,10308]   // 需要空投的token id
    let sender = "0x7d32D1DE76acd73d58fc76542212e86ea63817d8" // 空投发起地址
    let [signer] = await ethers.getSigners();
    let badgeAddr = BadgeAddr    // Badge 合约地址

    console.log("Signer: ",signer.address)
    console.log("Signature: ",await genAirdropBadgeSig(badgeAddr, tokenIdList, sender, signer));
}



async function genAirdropBadgeSig(badgeAddr, tokenId, sender, signer) {
    const hash = ethers.utils.solidityKeccak256(['string', 'uint256[]', 'address', 'address'], ['airdropBadge', tokenId, badgeAddr, sender]);

    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    }); 