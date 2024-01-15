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
const REVERT_MSGS = {
  'AlreadyMinted': 'ERC721: token already minted',
  'SBTNonTransferable': 'SBT:non-transferable',
  'SBTNonApprovable': 'SBT:non-approvable',
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

const updateParams = {
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

  describe('claim()', async () => {
    let sender;
    let minter;
    before(async () => {
      sender = accounts[2];
      minter = accounts[1];
    });

    it('should revert "OnlyMinter"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeContract.connect(sender).claim(sender.address, questId, uri)
      ).to.revertedWithCustomError(badgeContract, 'OnlyMinter');
    })
    it('should success', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeContract.connect(minter).claim(sender.address, questId, uri)
    });
  });


  describe("updateURI", () => {
    let minter;
    let sender;
    before(async () => {
      sender = accounts[2];
      minter = accounts[1];
    });

    it('should revert "NonexistentToken"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeContract.connect(minter).updateURI(1, uri)
      ).to.revertedWithCustomError(badgeContract, 'NonexistentToken');
    });

    it('should revert "OnlyMinter"', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeContract.connect(minter).claim(sender.address, questId,  uri);

      await expect(
        badgeContract.connect(sender).updateURI(1, uri)
      ).to.be.revertedWithCustomError(badgeContract, 'OnlyMinter');
    });

    it('should success', async () => {
      let { questId, score, uri } = badgeParams;

      let transaction = await badgeContract.connect(minter).claim(sender.address, questId,  uri);
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      uri = "ipfs://test-new"
      await badgeContract.connect(minter).updateURI(tokenId, uri)

      let tokenURI = await badgeContract.tokenURI(tokenId);
      expect(tokenURI).to.equal(uri);
    });
  });

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
      await badgeContract.connect(minter).claim(sender.address, questId,  uri);

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
      let transaction = await badgeContract.connect(minter).claim(sender.address, questId,  uri)
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      const tokenURI = await badgeContract.tokenURI(tokenId);
      expect(tokenURI).to.equal(uri);
    });
  })

  describe('SBT', async () => {
    it("transferFrom non-transferable", async () => {
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      let { questId, score, uri } = badgeParams;
      let transaction = await badgeContract.connect(minter).claim(receiver.address, questId,  uri)
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      await expect(
        badgeContract.connect(receiver).transferFrom(receiver.address, newReceiver.address, tokenId)
      ).to.be.revertedWith(REVERT_MSGS['SBTNonTransferable']);
    });

    it("non-approvable", async () => {
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      let { questId, score, uri } = badgeParams;
      let transaction = await badgeContract.connect(minter).claim(receiver.address, questId,  uri)
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      await expect(
        badgeContract.connect(receiver).approve(receiver.address, tokenId)
      ).to.be.revertedWith(REVERT_MSGS['SBTNonApprovable']);
    });

    it("get approved return zero", async () => {
      const receiver = accounts[3];
      const newReceiver = provider.createEmptyWallet();

      let { questId, score, uri } = badgeParams;
      let transaction = await badgeContract.connect(minter).claim(receiver.address, questId,  uri)
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      let address = await badgeContract.connect(receiver).getApproved(tokenId);
      expect(address).to.equal('0x0000000000000000000000000000000000000000');
    });
  })
});