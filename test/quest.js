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
const OneEther = ethers.utils.parseEther('1.0');

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
  let other;
  before(async () => {
    const Quest = await ethers.getContractFactory("Quest");
    questContract = await Quest.deploy();
    await questContract.deployed();

    const QuestMetadata = await ethers.getContractFactory("QuestMetadata");
    questMetadataContract = await QuestMetadata.deploy(questContract.address);
    await questMetadataContract.deployed();

    accounts = await ethers.getSigners();
    owner = accounts[0];
    minter = accounts[1];
    other = accounts[2];
    // set minter
    await questContract.setMinter(minter.address, true);
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

      await expect(questContract.connect(accounts[2]).mint(to, questData, data)).to.be.revertedWithCustomError(questContract, 'OnlyMinter');
    });

    it("minter mint", async () => {
      let { id, to, questData, data } = mintParams;

      let beforeBalance = await questContract.balanceOf(to);

      await questContract.connect(minter).mint(to, questData, data);

      let afterBalance = await questContract.balanceOf(to);

      expect(beforeBalance).to.equal(0);
      expect(afterBalance).to.equal(1);
    });

    it("should emit QuestCreated event", async () => {
      let { id, to, questData, data } = mintParams;
      const { startTs, endTs, supply, title, uri } = questData;

      await questContract.connect(minter).mint(to, questData, data)
    });

    it("mint twice should success", async () => {
      let { id, to, questData, data } = mintParams;
      await questContract.connect(minter).mint(to, questData, data);

      // mint again
      await questContract.connect(minter).mint(to, questData, data);
    });
  })

  describe('modifyQuest()', async () => {
    it("not minter should revert", async () => {
      let { to, id, questData, data } = mintParams;

      await expect(questContract.connect(accounts[2]).modifyQuest(id, questData)).to.be.revertedWithCustomError(questContract, 'OnlyMinter');
    });
    it("not exists should revert", async () => {
      let { to, id, questData, data } = mintParams;

      await expect(questContract.connect(minter).modifyQuest(id, questData)).to.be.revertedWithCustomError(questContract, 'NonexistentToken');
    });
    it("should success", async () => {
      let { to, id, questData, data } = mintParams;
      let transaction = await questContract.connect(minter).mint(to, questData, data);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      let startTs = 100
      let endTs = 110
      let title = 'title2'
      let uri = 'uri2'
      await questContract.connect(minter).modifyQuest(tokenId, { startTs, endTs, title, uri });

      let questData2 = await questContract.quests(tokenId);
      expect(questData2.startTs).to.equal(startTs);
      expect(questData2.endTs).to.equal(endTs);
      expect(questData2.title).to.equal(title);
      expect(questData2.uri).to.equal(uri);
    });
  });

  describe('getQuest()', async () => {
    it("None existent quest should revert", async () => {
      await expect(questContract.getQuest(1)).to.be.revertedWithCustomError(questContract, 'NonexistentToken');
    });

    it("existent quest", async () => {
      let { id, to, questData, data } = mintParams;
      let transaction = await questContract.connect(minter).mint(to, questData, data);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      const questData2 = await questContract.getQuest(tokenId);
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
      let transaction = await questContract.connect(minter).mint(to, questData, data);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;


      const uri = await questContract.tokenURI(tokenId);
      expect(uri).to.be.not.null;
    });
  })

  describe('SBT', async () => {
    it("transferFrom non-transferable", async () => {
      let { id, to, questData, data } = mintParams;
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      let transaction = await questContract.connect(minter).mint(receiver.address, questData, data);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      await expect(
        questContract.connect(receiver).transferFrom(receiver.address, newReceiver.address, tokenId)
      ).to.be.revertedWith(REVERT_MSGS['SBTNonTransferable']);
    });

    it("non-approvable", async () => {
      let { id, to, questData, data } = mintParams;
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      let transaction = await questContract.connect(minter).mint(receiver.address, questData, data);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      await expect(
        questContract.connect(receiver).approve(receiver.address, tokenId)
      ).to.be.revertedWith(REVERT_MSGS['SBTNonApprovable']);
    });

    it("get approved return zero", async () => {
      let { id, to, questData, data } = mintParams;
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      let transaction = await questContract.connect(minter).mint(receiver.address, questData, data);
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      let address = await questContract.connect(receiver).getApproved(tokenId);
      expect(address).to.equal('0x0000000000000000000000000000000000000000');
    });
  })

  describe('SetMetaContract', async () => {
    it("should revert not owner", async () => {
      expect(await questContract.meta()).to.equal(questMetadataContract.address);
      await expect(
        questContract.connect(other).setMetaContract(questContract.address)
      ).to.revertedWith('Ownable: caller is not the owner');
    });

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

  describe('donate()', () => {
    it("should emit Donation event", async () => {
      let { id, to, questData, data } = mintParams;
      const { startTs, endTs, supply, title, uri } = questData;

      let transaction =  await questContract.connect(minter).mint(to, questData, data)
      await transaction.wait();
      const filter = questContract.filters.QuestCreated();
      const events = await questContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      await expect(
        questContract.connect(minter).donate(tokenId, { value: OneEther })
      ).to.emit(questContract, 'Donation')
        .withArgs(minter.address, to, OneEther);
    });
  });
});