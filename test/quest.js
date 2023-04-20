const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity, MockProvider } = require("ethereum-waffle");
use(solidity);


const provider = new MockProvider();
const REVERT_MSGS = {
  'AlreadyMinted': 'ERC721: token already minted',
  'SBTNonTransferable': 'SBT:non-transferable',
  'SBTNonApprovable': 'SBT:non-approvable',
}

async function revertBlock(snapshotId) {
  await ethers.provider.send("evm_revert", [snapshotId]);
  const newSnapshotId = await ethers.provider.send("evm_snapshot");
  return newSnapshotId;
}

const AddressZero = ethers.constants.AddressZero;


const questData = {
  startTs: 0,
  endTs: 0,
  supply: 0,
  title: 'title',
  uri: 'uri',
}

const mintParams = {
  'to': provider.createEmptyWallet().address,
  'id': 0,
  'questData': questData,
  'data': '0x',
}

const createParams = {
  'creator': provider.createEmptyWallet().address,
  'id': 0,
  'initialSupply': 1,
  'uri': 'ipfs://123',
  'data': '0x',
}

describe("Quest", async () => {
  let questContract;
  let accounts, owner;
  const name = 'Decert Quest';
  const symbol = 'DQuest';
  let snapshotId;
  let minter;

  before(async () => {
    const Badge = await ethers.getContractFactory('Badge');
    badgeContract = await Badge.deploy();
    await badgeContract.deployed();

    const Quest = await ethers.getContractFactory("Quest");
    questContract = await Quest.deploy();
    await questContract.deployed();

    const QuestMetadata = await ethers.getContractFactory("QuestMetadata");
    questMetadataContract = await QuestMetadata.deploy(badgeContract.address, questContract.address);
    await questMetadataContract.deployed();

    accounts = await ethers.getSigners();
    owner = accounts[0];
    minter = accounts[1];

    // set minter
    await questContract.setMinter(minter.address, true);
    await badgeContract.setMinter(minter.address, true);
    // set meta 
    await questContract.setMetaContract(questMetadataContract.address)

    snapshotId = await ethers.provider.send("evm_snapshot");
  })

  afterEach(async () => {
    snapshotId = await revertBlock(snapshotId);
  });

  it("name", async () => {
    expect(await questContract.name()).to.equal(name);
  });

  it("symbol", async () => {
    expect(await questContract.symbol()).to.equal(symbol);
  });

  describe('setMinter()', async () => {
    it("set minter", async () => {
      let addr = owner.address;
      await questContract.connect(owner).setMinter(addr, true);
      const isMinter = await questContract.minters(addr);
      expect(isMinter).to.equal(true);
    });

    it("unset minter", async () => {
      let addr = owner.address;
      await questContract.connect(owner).setMinter(addr, false);
      const isMinter = await questContract.minters(addr);
      expect(isMinter).to.equal(false);
    });

    it("Invalid minter", async () => {
      let addr = AddressZero;
      await expect(questContract.connect(owner).setMinter(addr, false)).to.be.revertedWithCustomError(questContract, 'InvalidMinter');
    });

    it("not owner should revert", async () => {
      let addr = accounts[1].address;
      await expect(questContract.connect(accounts[2]).setMinter(addr, false)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  })

  describe('mint()', async () => {
    beforeEach(async () => {
    });

    it("not minter should revert", async () => {
      let { to, id, questData, data } = mintParams;

      await expect(questContract.connect(accounts[2]).mint(to, id, questData, data)).to.be.revertedWithCustomError(questContract, 'OnlyMinter');
    });

    it("minter mint", async () => {
      let { id, to, questData, data } = mintParams;

      let beforeBalance = await questContract.balanceOf(to);

      await questContract.connect(minter).mint(to, id, questData, data);

      let afterBalance = await questContract.balanceOf(to);

      expect(beforeBalance).to.equal(0);
      expect(afterBalance).to.equal(1);
    });

    it("should emit QuestCreated event", async () => {
      let { id, to, questData, data } = mintParams;
      const { startTs, endTs, supply, title, uri } = questData;

      await expect(
        questContract.connect(minter).mint(to, id, questData, data)
      ).to.emit(questContract, 'QuestCreated')
        .withArgs(to, id, [startTs, endTs, title, uri]);

    });

    it("mint twice should revert", async () => {
      let { id, to, questData, data } = mintParams;
      await questContract.connect(minter).mint(to, id, questData, data);

      // mint again
      await expect(
        questContract.connect(minter).mint(to, id, questData, data)
      ).to.be.revertedWith(REVERT_MSGS['AlreadyMinted']);
    });
  })

  describe('modifyQuest()', async () => {
    it("not minter should revert", async () => {
      let { to, id, questData, data } = mintParams;

      await expect(questContract.connect(accounts[2]).modifyQuest(id, questData)).to.be.revertedWithCustomError(questContract, 'OnlyMinter');
    });
  });

  describe('getQuest()', async () => {
    it("None existent quest", async () => {
      const questData = await questContract.quests(1);
      const { startTs, endTs, title, uri } = questData;
      expect(startTs).to.equal(questData.startTs);
      expect(endTs).to.equal(questData.endTs);
      expect(title).to.equal('');
      expect(uri).to.equal('');
    });

    it("existent quest", async () => {
      let { id, to, questData, data } = mintParams;
      await questContract.connect(minter).mint(to, id, questData, data);

      const questData2 = await questContract.quests(id);
      const { startTs, endTs, title, uri } = questData2;
      expect(startTs).to.equal(questData.startTs);
      expect(endTs).to.equal(questData.endTs);
      expect(title).to.equal(questData.title);
      expect(uri).to.equal(questData.uri);
    });
  })

  describe('tokenURI()', async () => {
    it("should revert NonexistentTokenUri", async () => {
      await expect(questContract.tokenURI(1)).to.be.revertedWithCustomError(
        questMetadataContract,
        "NonexistentTokenUri"
      );
    });

    it("uri", async () => {
      let { id, to, questData, data } = mintParams;
      await questContract.connect(minter).mint(to, id, questData, data);

      const uri = await questContract.tokenURI(id);
      expect(uri).to.be.not.null;
    });
  })

  describe('SBT', async () => {
    it("transferFrom non-transferable", async () => {
      let { id, to, questData, data } = mintParams;
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      await questContract.connect(minter).mint(receiver.address, id, questData, data);

      await expect(
        questContract.connect(receiver).transferFrom(receiver.address, newReceiver.address, id)
      ).to.be.revertedWith(REVERT_MSGS['SBTNonTransferable']);
    });

    it("non-approvable", async () => {
      let { id, to, questData, data } = mintParams;
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      await questContract.connect(minter).mint(receiver.address, id, questData, data);

      await expect(
        questContract.connect(receiver).approve(receiver.address, id)
      ).to.be.revertedWith(REVERT_MSGS['SBTNonApprovable']);
    });

    it("get approved return zero", async () => {
      let { id, to, questData, data } = mintParams;
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      await questContract.connect(minter).mint(receiver.address, id, questData, data);

      let address = await questContract.connect(receiver).getApproved(id);
      expect(address).to.equal('0x0000000000000000000000000000000000000000');
    });
  })

  describe('SetMetaContract', async () => {
    it("should revert set zero address", async () => {
      await expect(
        questContract.connect(owner).setMetaContract(AddressZero)
      ).to.revertedWithCustomError(questContract, 'ZeroAddress');
    });

    it("should set success", async () => {
      expect(await questContract.meta()).to.equal(questMetadataContract.address);

      await questContract.connect(owner).setMetaContract(questContract.address);

      expect(await questContract.meta()).to.equal(questContract.address);
    });
  });
  describe('updateQuestBadgeNum()', () => {
    let questBadgeNum = 1000;

    it('should revert "NonexistentToken""', async () => {
      await expect(
        questContract.connect(minter).updateQuestBadgeNum(100, questBadgeNum)
      ).to.revertedWithCustomError(questContract, 'NonexistentToken');
    });

    it('should updateQuestBadgeNum ', async () => {
      let { id, to, questData, data } = mintParams;
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      await questContract.connect(minter).mint(receiver.address, id, questData, data);

      await questContract.connect(minter).updateQuestBadgeNum(id, questBadgeNum);
      let questBadgeNumAfter = await questContract.questBadgeNum(id)
      expect(questBadgeNumAfter).to.equal(questBadgeNum);
    });
  });
});