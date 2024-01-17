const { ethers, upgrades } = require('hardhat');
const { use, expect } = require('chai');
const { solidity, MockProvider } = require('ethereum-waffle');
use(solidity);

const provider = new MockProvider();

const REVERT_MSGS = {
  'OnlyOwner': 'Ownable: caller is not the owner',
  'InvalidTokenID': 'ERC721: invalid token ID',
}

const INVALID_SIG = '0xbba42b3d0af3d44ce510e7b6720750510dab05d6158de272cc06f91994c9dbf02ddee04c3697120ce7ca953978aef6bfb08edeaea38567dd0079f1da7582ccb71c';
async function revertBlock(snapshotId) {
  await ethers.provider.send('evm_revert', [snapshotId]);
  const newSnapshotId = await ethers.provider.send('evm_snapshot');
  return newSnapshotId;
}


const questData = {
  startTs: 0,
  endTs: 4294967295,
  title: 'title',
  uri: 'uri',
}

const mintParams = {
  'to': provider.createEmptyWallet().address,
  'id': 0,
  'questData': questData,
  'data': '0x',
}

const questDataNew = {
  startTs: 1000,
  endTs: 1000,
  title: 'titleNew',
  uri: 'uriNew',
}


const questParams = {
  'questData': questData,
  'signature': '0x',
}

const OneEther = ethers.utils.parseEther('1.0');

function getRandomAddress() {
  return provider.createEmptyWallet().address
}

describe('QuestMinter', async () => {
  let questContract;
  let questMinterContract;
  let accounts, owner;
  const name = 'Decert Badge';
  const symbol = 'Badge';
  const uri = '';
  let snapshotId;
  let minter;
  let InitStartTokenId;


  async function genCreateSig(questData, sender, signer) {
    const types = ['uint256','uint32', 'uint32', 'string', 'string', 'address', 'address'];
    const { startTs, endTs, title, uri } = questData;
    const chainId = await ethers.provider.send('eth_chainId');

    const params = [chainId,startTs, endTs, title, uri, questMinterContract.address, sender.address];

    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genModifySig(tokenId, questData, sender, signer) {
    const types = ['uint256', 'uint32', 'uint32', 'string', 'string', 'address', 'address'];
    const { startTs, endTs, title, uri } = questData;
    const params = [tokenId, startTs, endTs, title, uri, questMinterContract.address, sender.address];

    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  before(async () => {
    const Quest = await ethers.getContractFactory('Quest');
    questContract = await Quest.deploy();
    await questContract.deployed();

    const QuestMetadata = await ethers.getContractFactory("QuestMetadata");
    questMetadataContract = await QuestMetadata.deploy(questContract.address);
    await questMetadataContract.deployed();

    const QuestMinter = await ethers.getContractFactory('QuestMinter');
    questMinterContract = await QuestMinter.deploy(questContract.address);
    await questMinterContract.deployed();

    accounts = await ethers.getSigners();
    owner = accounts[0];
    minter = questMinterContract;

    // set minter
    await questContract.setMinter(minter.address, true);
    // set meta 
    await questContract.setMetaContract(questMetadataContract.address)

    snapshotId = await ethers.provider.send('evm_snapshot');
  })

  afterEach(async () => {
    snapshotId = await revertBlock(snapshotId);
  });

  describe('setSigner()', () => {
    it('should revert onlyOwner', async () => {
      await expect(
        questMinterContract.connect(accounts[1]).setSigner(accounts[1].address)
      ).to.revertedWith(REVERT_MSGS['OnlyOwner']);
    });

    it('owner should succeed', async () => {
      await questMinterContract.connect(owner).setSigner(accounts[1].address);
      expect(1).to.equal(1);
    });
  });

  describe('createQuest()', () => {
    let { questData, signature } = questParams;
    const { startTs, endTs, supply, title, uri } = questData;

    let creator;
    let signer;
    let createQuestSig = '';
    let InitStartTokenId = 0;
    before(async () => {
      signer = owner;
      creator = accounts[2];
      createQuestSig = await genCreateSig(questData, creator, signer);
    })

    it('should revert "Invalid signer"', async () => {
      await expect(
        questMinterContract.connect(creator).createQuest(questData, INVALID_SIG)
      ).to.revertedWithCustomError(questMinterContract, 'InvalidSigner');
    });

    it('should create quest and badge', async () => {
      let transaction = await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;
      {
        // quest
        expect(await questContract.totalSupply()).to.equal(1);

        const quest = await questContract.getQuest(tokenId);
        expect(quest.startTs).to.equal(startTs);
        expect(quest.endTs).to.equal(endTs);
        expect(quest.title).to.equal(title);

        const questOwner = await questContract.ownerOf(tokenId);
        expect(questOwner).to.equal(creator.address);
      }
    });

    it('should create two quest and badge', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      {
        // quest
        expect(await questContract.totalSupply()).to.equal(2);
      }
    });
  });

  describe('modifyQuest()', () => {
    const { startTs, endTs, supply, title, uri } = questDataNew;

    let creator;
    let signer;
    let createQuestSig = '';
    let score = 0;
    before(async () => {
      signer = owner;
      creator = accounts[2];
      claimer = accounts[3];

      // modifyQuestSig = await genModifySig(InitStartTokenId, questDataNew, creator, signer);
      createQuestSig = await genCreateSig(questData, creator, signer);
    })

    it('should revert "Invalid signer"', async () => {
      let transaction = await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;
      await expect(
        questMinterContract.connect(creator).modifyQuest(tokenId, questData, INVALID_SIG)
      ).to.revertedWithCustomError(questMinterContract, 'InvalidSigner');
    });

    it('should modify quest', async () => {
      let transaction = await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;
      modifyQuestSig = await genModifySig(tokenId, questDataNew, creator, signer);

      await questMinterContract.connect(creator).modifyQuest(tokenId, questDataNew, modifyQuestSig);

      {
        // quest
        expect(await questContract.totalSupply()).to.equal(1);

        const quest = await questContract.getQuest(tokenId);
        expect(quest.startTs).to.equal(startTs);
        expect(quest.endTs).to.equal(endTs);
        expect(quest.title).to.equal(title);

        const questOwner = await questContract.ownerOf(tokenId);
        expect(questOwner).to.equal(creator.address);
      }
    });

    it('should revert "Not creator"', async () => {
      let transaction = await questMinterContract.connect(creator).createQuest(questData, createQuestSig)
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;
      modifyQuestSig = await genModifySig(tokenId, questDataNew, creator, signer);

      await expect(
        questMinterContract.connect(accounts[3]).modifyQuest(tokenId, questDataNew, modifyQuestSig)
      ).to.revertedWithCustomError(questMinterContract, 'NotCreator');
    });
  });
});