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
  let badgeContract;
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
    const types = ['uint32', 'uint32', 'string', 'string', 'address', 'address'];
    const { startTs, endTs, title, uri } = questData;
    const params = [startTs, endTs, title, uri, questMinterContract.address, sender.address];

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

  async function genUpdateQuestBadgeNumSig(questId, badgeNum, sender, signer) {
    const hash = ethers.utils.solidityKeccak256(['uint256', 'uint256', 'address', 'address'], [questId, badgeNum, questMinterContract.address, sender.address]);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  before(async () => {
    const Badge = await ethers.getContractFactory('Badge');
    badgeContract = await Badge.deploy();
    await badgeContract.deployed();

    const Quest = await ethers.getContractFactory('Quest');
    questContract = await Quest.deploy();
    await questContract.deployed();

    const QuestMetadata = await ethers.getContractFactory("QuestMetadata");
    questMetadataContract = await QuestMetadata.deploy(badgeContract.address, questContract.address);
    await questMetadataContract.deployed();

    const QuestMinter = await ethers.getContractFactory('QuestMinter');
    questMinterContract = await QuestMinter.deploy(questContract.address);
    await questMinterContract.deployed();

    InitStartTokenId = (await questMinterContract.startTokenId()).toNumber();

    accounts = await ethers.getSigners();
    owner = accounts[0];
    minter = questMinterContract;

    // set minter
    await questContract.setMinter(minter.address, true);
    await badgeContract.setMinter(minter.address, true);
    // set meta 
    await questContract.setMetaContract(questMetadataContract.address)

    snapshotId = await ethers.provider.send('evm_snapshot');
  })

  afterEach(async () => {
    snapshotId = await revertBlock(snapshotId);
  });

  it('startTokenId', async () => {
    expect(await questMinterContract.startTokenId()).to.equal(10000);
  });

  it('quest address', async () => {
    expect(await questMinterContract.quest()).to.equal(questContract.address);
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
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      let nextTokenId = (await questMinterContract.startTokenId()).toNumber();
      expect(nextTokenId).to.equal(InitStartTokenId + 1);

      {
        // quest
        expect(await questContract.totalSupply()).to.equal(1);

        const quest = await questContract.getQuest(InitStartTokenId);
        expect(quest.startTs).to.equal(startTs);
        expect(quest.endTs).to.equal(endTs);
        expect(quest.title).to.equal(title);

        const questOwner = await questContract.ownerOf(InitStartTokenId);
        expect(questOwner).to.equal(creator.address);
      }
    });

    it('should emit QuestCreated event', async () => {
      await expect(
        questMinterContract.connect(creator).createQuest(questData, createQuestSig)
      ).to.emit(questContract, 'QuestCreated')
        .withArgs(creator.address, InitStartTokenId, [startTs, endTs, title, uri]);
    });

    it('should create two quest and badge', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      let nextTokenId = (await questMinterContract.startTokenId()).toNumber();
      expect(nextTokenId).to.equal(InitStartTokenId + 2);

      {
        // quest
        expect(await questContract.totalSupply()).to.equal(2);
        expect(await questContract.ownerOf(InitStartTokenId)).to.equal(creator.address);
        expect(await questContract.ownerOf(InitStartTokenId + 1)).to.equal(creator.address);
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

      modifyQuestSig = await genModifySig(InitStartTokenId, questDataNew, creator, signer);
      createQuestSig = await genCreateSig(questData, creator, signer);
    })

    it('should revert "Invalid signer"', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      await expect(
        questMinterContract.connect(creator).modifyQuest(InitStartTokenId, questData, INVALID_SIG)
      ).to.revertedWithCustomError(questMinterContract, 'InvalidSigner');
    });

    it('should modify quest', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      await questMinterContract.connect(creator).modifyQuest(InitStartTokenId, questDataNew, modifyQuestSig);

      {
        // quest
        expect(await questContract.totalSupply()).to.equal(1);

        const quest = await questContract.getQuest(InitStartTokenId);
        expect(quest.startTs).to.equal(startTs);
        expect(quest.endTs).to.equal(endTs);
        expect(quest.title).to.equal(title);

        const questOwner = await questContract.ownerOf(InitStartTokenId);
        expect(questOwner).to.equal(creator.address);
      }
    });

    it('should revert "Not creator"', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig)

      await expect(
        questMinterContract.connect(accounts[3]).modifyQuest(InitStartTokenId, questDataNew, modifyQuestSig)
      ).to.revertedWithCustomError(questMinterContract, 'NotCreator');
    });
  });
  describe('updateQuestBadgeNum()', () => {
    const { startTs, endTs, supply, title, uri } = questDataNew;
    let updateQuestBadgeSig = ''
    let creator;
    let signer;
    let questBadgeNum = 0;
    before(async () => {
      signer = owner;
      creator = accounts[2];
      claimer = accounts[3];
      questBadgeNum = 100;
      createQuestSig = await genCreateSig(questData, creator, signer);
      updateQuestBadgeSig = await genUpdateQuestBadgeNumSig(InitStartTokenId, questBadgeNum, creator, signer);
      // questMinterContract.connect(accounts[3]).updateQuestBadgeNum(InitStartTokenId, questDataNew, modifyQuestSig);

      // QuestBadgeNum = badge.questBadgeNum(InitStartTokenId);

    });
    it('should revert "Invalid signer"', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await expect(
        questMinterContract.connect(creator).updateQuestBadgeNum(InitStartTokenId, questBadgeNum, INVALID_SIG)
      ).to.revertedWithCustomError(questMinterContract, 'InvalidSigner');
    });

    it('should revert "NonexistentToken""', async () => {
      await expect(
        questMinterContract.connect(creator).updateQuestBadgeNum(InitStartTokenId, questBadgeNum, updateQuestBadgeSig)
      ).to.revertedWithCustomError(questContract, 'NonexistentToken');
    });

    it('should updateQuestBadgeNum ', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await questMinterContract.connect(creator).updateQuestBadgeNum(InitStartTokenId, questBadgeNum, updateQuestBadgeSig);
      let questBadgeNumAfter = await questContract.questBadgeNum(InitStartTokenId)
      expect(questBadgeNumAfter).to.equal(questBadgeNum);
    });
  });
});