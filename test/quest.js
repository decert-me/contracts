const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity, MockProvider } = require("ethereum-waffle");
use(solidity);


const provider = new MockProvider();
const REVERT_MSGS = {
  'OnlyMinter': 'Only minter',
  'TokenIdAlreadyExists': 'TokenId already exists',
  'AlreadyMinted': 'ERC721: token already minted',
  'NonexistentTokenUri': 'ERC721Metadata: URI query for nonexistent token',
  'SBTNonTransferable': 'SBT:non-transferable',
  'NoneExistentToken':'None existent token',
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
  const uri = '';
  let snapshotId;
  let minter;

  before(async () => {
    const Badge = await ethers.getContractFactory('Badge');
    badgeContract = await Badge.deploy(uri);
    await badgeContract.deployed();

    const Quest = await ethers.getContractFactory("Quest");

    questContract = await Quest.deploy(badgeContract.address);
    await questContract.deployed();

    accounts = await ethers.getSigners();
    owner = accounts[0];
    minter = accounts[1];

    // set minter
    await questContract.setMinter(minter.address, true);
    await badgeContract.setMinter(minter.address, true);

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
      await expect(questContract.connect(owner).setMinter(addr, false)).to.be.revertedWith('Invalid minter');

    });

    it("not owner should revert", async () => {
      let addr = accounts[1].address;
      await expect(questContract.connect(accounts[2]).setMinter(addr, false)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  })

  describe('mint()', async () => {
    beforeEach(async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data)
    });

    it("not minter should revert", async () => {
      let { to, id, questData, data } = mintParams;

      await expect(questContract.connect(accounts[2]).mint(to, id, questData, data)).to.be.revertedWith(REVERT_MSGS['OnlyMinter']);
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
        .withArgs(to, id, [startTs, endTs, supply, title, uri]);

    });

    it("mint twice should revert", async () => {
      let { id, to, questData, data } = mintParams;
      await questContract.connect(minter).mint(to, id, questData, data);

      // mint again
      await expect(
        questContract.connect(minter).mint(to, id, questData, data)
      ).to.be.revertedWith(REVERT_MSGS['AlreadyMinted']);
    });

    it("mint none existent token should revert", async () => {
      let { to, questData, data } = mintParams;
      await expect(
        questContract.connect(minter).mint(to, 1, questData, data)
      ).to.be.revertedWith(REVERT_MSGS['NoneExistentToken']);
    }); 
  })

  describe('getQuest()', async () => {
    beforeEach(async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data)
    });

    it("None existent quest", async () => {
      const questData = await questContract.quests(1);
      const { startTs, endTs, supply, title, uri } = questData;
      expect(startTs).to.equal(questData.startTs);
      expect(endTs).to.equal(questData.endTs);
      expect(supply).to.equal(questData.supply);
      expect(title).to.equal('');
      expect(uri).to.equal('');
    });

    it("existent quest", async () => {
      let { id, to, questData, data } = mintParams;
      await questContract.connect(minter).mint(to, id, questData, data);

      const questData2 = await questContract.quests(id);
      const { startTs, endTs, supply, title, uri } = questData2;
      expect(startTs).to.equal(questData.startTs);
      expect(endTs).to.equal(questData.endTs);
      expect(supply).to.equal(questData.supply);
      expect(title).to.equal(questData.title);
      expect(uri).to.equal(questData.uri);
    });
  })

  describe('tokenURI()', async () => {
    beforeEach(async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data)
    });

    it("should revert NonexistentTokenUri", async () => {
      await expect(questContract.tokenURI(0)).to.be.revertedWith(REVERT_MSGS['NonexistentTokenUri']);
    });

    it("uri", async () => {
      let { id, to, questData, data } = mintParams;
      await questContract.connect(minter).mint(to, id, questData, data);

      const uri = await questContract.tokenURI(id);
      expect(uri).to.be.not.null;
    });
  })

  describe('SBT', async () => {
    beforeEach(async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data)
    });

    it("non-transferable", async () => {
      let { id, to, questData, data } = mintParams;
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      await questContract.connect(minter).mint(receiver.address, id, questData, data);

      await expect(
        questContract.connect(receiver).transferFrom(receiver.address, newReceiver.address, id)
      ).to.be.revertedWith(REVERT_MSGS['SBTNonTransferable']);
    });
  })
});