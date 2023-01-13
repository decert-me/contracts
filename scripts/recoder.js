const fs = require('fs');
const path = require('path');
const util = require('util');

const writeFile = util.promisify(fs.writeFile);


async function writeAddr(addr, name, network) {
    const deployments = {};
    deployments["address"] = addr;
    deployments["contractName"] = name;

    await writeLog(deployments, name, network);
}

/**
 * 记录合约发布地址
 * @param {*} deployments json
 * @param {*} name 类型
 * @param {*} network 网络
 */
async function writeLog(deployments, name, network) {

    let dir = path.resolve(__dirname, `../deployments/${network}`);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {
            recursive: true
        });
    }

    const deploymentPath = path.resolve(dir, `${name}.json`);

    await writeFile(deploymentPath, JSON.stringify(deployments, null, 2));
    // console.log(`Exported deployments into ${deploymentPath}`);
}

module.exports = {
    writeLog,
    writeAddr
}