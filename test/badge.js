const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity, MockProvider } = require("ethereum-waffle");
use(solidity);


const provider = new MockProvider();

async function revertBlock(snapshotId) {
  await ethers.provider.send("evm_revert", [snapshotId]);
  const newSnapshotId = await ethers.provider.send("evm_snapshot");
  return newSnapshotId;
}

const AddressZero = ethers.constants.AddressZero;

const creator = provider.createEmptyWallet().address
const createParams = {
  creator: creator,
  startTs: 0,
  endTs: 2681807920,
  title: 'title',
  uri: 'ipfs://123' // quest URI
}

const badgeParams = {
  'questId': 10000,
  'score': 100000,
  'uri': 'ipfs://123',
}

describe("Badge", async () => {
  let badgeContract;
  let accounts, owner, creator, minter;
  const name = 'Decert Badge';
  const symbol = 'Decert';
  let snapshotId;
  before(async () => {
    const Badge = await ethers.getContractFactory("Badge");
    badgeContract = await Badge.deploy();
    await badgeContract.deployed();


    accounts = await ethers.getSigners();
    owner = accounts[0];
    minter = accounts[1];
    creator = provider.createEmptyWallet().address;
    // set minter
    await badgeContract.setMinter(minter.address, true);

    snapshotId = await ethers.provider.send("evm_snapshot");
  })

  afterEach(async () => {
    snapshotId = await revertBlock(snapshotId);
  });

  it("name", async () => {
    expect(await badgeContract.name()).to.equal(name);
  });

  it("symbol", async () => {
    expect(await badgeContract.symbol()).to.equal(symbol);
  });

  describe('tokenURI()', async () => {
    it("None existent token", async () => {
      await expect(badgeContract.tokenURI(0)).to.be.revertedWithCustomError(badgeContract, 'NonexistentToken');
    });
  });

  describe('setMinter()', async () => {
    it("set minter", async () => {
      let addr = owner.address;
      await badgeContract.connect(owner).setMinter(addr, true);
      const isMinter = await badgeContract.minters(addr);
      expect(isMinter).to.equal(true);
    });

    it("unset minter", async () => {
      let addr = owner.address;
      await badgeContract.connect(owner).setMinter(addr, false);
      const isMinter = await badgeContract.minters(addr);
      expect(isMinter).to.equal(false);
    });

    it("Invalid minter", async () => {
      let addr = AddressZero;
      await expect(badgeContract.connect(owner).setMinter(addr, false)).to.be.revertedWithCustomError(badgeContract, 'InvalidMinter');
    });

    it("not owner should revert", async () => {
      let addr = accounts[1].address;
      await expect(badgeContract.connect(accounts[2]).setMinter(addr, false)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('claimWithCreate()', async () => {
    let sender;
    let minter;
    before(async () => {
      sender = accounts[2];
      minter = accounts[1];
    });

    it("minter claimWithCreate", async () => {
      let { questId, score, uri } = badgeParams;

      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri);

      let totalSupply = await badgeContract.totalSupply();
      expect(totalSupply).to.equal(1);

      let customUri = await badgeContract.tokenURI(1);
      expect(customUri).to.equal(uri);

      let questsData = await badgeContract.getQuest(questId);
      expect(questsData.startTs).to.equal(createParams.startTs);
      expect(questsData.endTs).to.equal(createParams.endTs);
      expect(questsData.title).to.equal(createParams.title);

      let customQuestId = await badgeContract.badgeToQuest(totalSupply);
      expect(customQuestId).to.equal(questId);

      let badgeScore = await badgeContract.scores(totalSupply);
      expect(badgeScore).to.equal(score);
    });

    it("claimWithCreate exists quest should revert", async () => {
      let { questId, score, uri } = badgeParams;

      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri);
      totalSupply = await badgeContract.totalSupply();
      await expect(
        badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri)
      ).to.be.revertedWithCustomError(badgeContract, 'QuestIdAlreadyExists');
    });

    it('should revert "OnlyMinter"', async () => {
      let { questId, score, uri } = badgeParams;

      await expect(
        badgeContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri)
      ).to.revertedWithCustomError(badgeContract, 'OnlyMinter');
    });
  })

  describe("updateScore", () => {
    let minter;
    let sender;
    before(async () => {
      sender = accounts[2];
      minter = accounts[1];
    });

    it('should revert "NotClaimedYet"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeContract.connect(minter).updateScore(sender.address, questId, score)
      ).to.revertedWithCustomError(badgeContract, 'NotClaimedYet');
    });

    it('should revert "OnlyMinter"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeContract.connect(sender).updateScore(sender.address, questId, score)
      ).to.be.revertedWithCustomError(badgeContract, 'OnlyMinter');
    });

    it('should updateScore success', async () => {
      let { questId, score, uri } = badgeParams;

      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri)

      score = 100
      await badgeContract.connect(minter).updateScore(sender.address, questId, score)

      let totalSupply = await badgeContract.totalSupply();

      let badgeScore = await badgeContract.scores(totalSupply);
      expect(badgeScore).to.equal(score);
    });
  });

  describe("claimWithScore", () => {
    let minter;
    let sender;
    let other;
    before(async () => {
      sender = accounts[2];
      minter = accounts[1];
      other = accounts[3];
    });

    it('should revert "NonexistentQuest"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeContract.connect(minter).claimWithScore(sender.address, questId, score, uri)
      ).to.revertedWithCustomError(badgeContract, 'NonexistentQuest');
    });

    it('should revert "OnlyMinter"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeContract.connect(sender).claimWithScore(sender.address, questId, score, uri)
      ).to.revertedWithCustomError(badgeContract, 'OnlyMinter');
    });

    it('should revert "AlreadyHoldsBadge"', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri);
      await expect(
        badgeContract.connect(minter).claimWithScore(sender.address, questId, score, uri)
      ).to.revertedWithCustomError(badgeContract, 'AlreadyHoldsBadge');
    });


    it('should claimWithScore success', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri);

      score = 100

      await badgeContract.connect(minter).claimWithScore(other.address, questId, score, uri)

      let totalSupply = await badgeContract.totalSupply();

      let badgeScore = await badgeContract.scores(totalSupply);
      expect(badgeScore).to.equal(score);
    });
  });

  describe('getQuest()', async () => {
    let minter;
    let sender;
    beforeEach(async () => {
      sender = accounts[2];
      minter = accounts[1];
      let { questId, score, uri } = badgeParams;
      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri);
    });

    it("None existent quest", async () => {
      const questData = await badgeContract.getQuest(1);
      const { startTs, endTs, supply, title, uri } = questData;
      expect(startTs).to.equal(questData.startTs);
      expect(endTs).to.equal(questData.endTs);
      expect(title).to.equal('');
      expect(uri).to.equal('');
    });

    it("existent quest", async () => {
      let { questId, score, uri } = badgeParams;
      const questData = await badgeContract.getQuest(questId);
      const { startTs, endTs, title, uri:questUri } = questData;
      expect(startTs).to.equal(createParams.startTs);
      expect(endTs).to.equal(createParams.endTs);
      expect(title).to.equal(createParams.title);
      expect(questUri).to.equal(createParams.uri);
    });
  })

  describe('getQuestBadgeNum()', async () => {
    let minter;
    let sender;
    beforeEach(async () => {
      sender = accounts[2];
      minter = accounts[1];
      let { questId, score, uri } = badgeParams;
      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri);
    });

    it("None existent quest", async () => {
      const badgeNum = await badgeContract.getQuestBadgeNum(1);
      expect(badgeNum).to.equal(0);
    });

    it("existent quest", async () => {
      let { questId, score, uri } = badgeParams;
      const badgeNum = await badgeContract.getQuestBadgeNum(questId);
      expect(badgeNum).to.equal(1);
    });
  })

  describe('totalSupply()', async () => {
    let minter;
    let sender;
    beforeEach(async () => {
      sender = accounts[2];
      minter = accounts[1];
    });

    it("start totalSupply ", async () => {
      const totalSupply = await badgeContract.totalSupply();
      expect(totalSupply).to.equal(0);
    });

    it("totalSupply should plus", async () => {
      let { questId, score, uri } = badgeParams;
      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri);
      
      const totalSupply = await badgeContract.totalSupply();
      expect(totalSupply).to.equal(1);
    });
  })

  describe('tokenURI()', async () => {
    let minter;
    let sender;
    beforeEach(async () => {
      sender = accounts[2];
      minter = accounts[1];
    });

    it("should revert NonexistentToken", async () => {
      await expect(badgeContract.tokenURI(1)).to.be.revertedWithCustomError(
        badgeContract,
        "NonexistentToken"
      );
    });

    it("tokenURI", async () => {
      let { questId, score, uri } = badgeParams;
      await badgeContract.connect(minter).claimWithCreate(createParams, questId, sender.address, score, uri);

      const tokenURI = await badgeContract.tokenURI(1);
      expect(tokenURI).to.equal(uri);
    });
  })
});