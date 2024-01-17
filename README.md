# README

## 安装依赖
```
yarn install
```

## 运行测试
```
yarn test
```

## 修改配置文件
```
cp env_sample .env
vi .env
```
配置项详解：
- MNEMONIC 助记词
    用于部署合约，需要在对应网络持有远胜币作为手续费
    eg:  = "test test test test test test test test test test test junk"
- x_ETHERSCAN_API_KEY 区块链浏览器API KEY
    用于开源合约，不同区块链对应不同的KEY
- MINTER_SIGNER 交易签发者账号
    前端请求后端对数据进行签名后再调用合约发放；可不设置，默认为合约部署者

## 合约部署
scripts目录下面提供一键部署和初始化脚本 [deploy_and_init](./scripts/deploy_and_init)，是默认执行脚本
```
yarn deploy --network <network>
```

由于网络可能不稳定，该目录下提供了分别部署各个合约的脚本。分别部署合约时，遵循顺序如下：

Badge -> Quest -> QuestMinter -> QuestMetadata -> init
```
npx hardhat run scripts/deploy_Badge.js --network <network>
npx hardhat run scripts/deploy_Quest.js --network <network>
npx hardhat run scripts/deploy_QuestMinter.js --network <network>
npx hardhat run scripts/deploy_QuestMetadata.js --network <network>
npx hardhat run scripts/init_after_deploy.js --network <network>
```