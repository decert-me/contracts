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

const createParams = {
  'creator': provider.createEmptyWallet().address,
  'id': 0,
  'initialSupply': 1,
  'uri': 'ipfs://123',
  'data': '0x',
}

const mintParams = {
  'to': provider.createEmptyWallet().address,
  'id': 0,
  'quantity': 1,
  'data': '0x',
}


describe("Badge", async () => {
  let badgeContract;
  let accounts, owner;
  const name = 'Decert Badge';
  const symbol = 'Decert';
  const uri = '';
  let snapshotId;
  let minter;

  before(async () => {
    const Badge = await ethers.getContractFactory("Badge");
    badgeContract = await Badge.deploy(uri);
    await badgeContract.deployed();

    accounts = await ethers.getSigners();
    owner = accounts[0];
    minter = accounts[1];

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

  describe('uri()', async () => {
    it("None existent token", async () => {
      await expect(badgeContract.uri(0)).to.be.revertedWithCustomError(badgeContract, 'NonexistentToken');
    });

    it("set customUri", async () => {
      // set setCustomURI
    });
  })

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
  })

  describe('create()', async () => {
    it("not minter should revert", async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await expect(badgeContract.connect(accounts[2]).create(creator, id, initialSupply, uri, data)).to.be.revertedWithCustomError(badgeContract, 'OnlyMinter');
    });

    it("minter create", async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data);

      let tokenSupply = await badgeContract.tokenSupply(id);
      expect(tokenSupply).to.equal(initialSupply);

      let customUri = await badgeContract.uri(id);
      expect(customUri).to.equal(uri);

      let creator_ = await badgeContract.creators(id);
      expect(creator_).to.equal(creator);

      let balance = await badgeContract.balanceOf(creator, id);
      expect(balance).to.equal(initialSupply);
    });

    it("create exists toekn should revert", async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data);

      // create same tokenId again
      await expect(
        badgeContract.connect(minter).create(creator, id, initialSupply, uri, data)
      ).to.be.revertedWithCustomError(badgeContract, 'TokenIdAlreadyExists');
    });
  })

  describe('mint()', async () => {
    beforeEach(async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data);
    });

    it("not minter should revert", async () => {
      let { to, id, quantity, data } = mintParams;
      await expect(badgeContract.connect(accounts[2]).mint(to, id, quantity, data)).to.be.revertedWithCustomError(badgeContract, 'OnlyMinter');
    });

    it("minter mint", async () => {
      let { to, id, quantity, data } = mintParams;
      await expect(
        badgeContract.connect(minter).mint(to, id, quantity, data)
      ).to.emit(badgeContract, 'TransferSingle')
        .withArgs(minter.address, AddressZero, to, id, quantity);

      let tokenSupply = await badgeContract.tokenSupply(id);
      expect(tokenSupply).to.equal(quantity + 1);

      let balance = await badgeContract.balanceOf(to, id);
      expect(balance).to.equal(quantity);
    });

    it("should emit TransferSingle event", async () => {

      let { to, id, quantity, data } = mintParams;
      await expect(
        badgeContract.connect(minter).mint(to, id, quantity, data)
      ).to.emit(badgeContract, 'TransferSingle')
        .withArgs(minter.address, AddressZero, to, id, quantity);
    });

    it("mint twice should revert", async () => {

      let { to, id, quantity, data } = mintParams;
      await badgeContract.connect(minter).mint(to, id, quantity, data);

      // mint again
      await expect(
        badgeContract.connect(minter).mint(to, id, quantity, data)
      ).to.be.revertedWithCustomError(badgeContract, 'AlreadyHoldsBadge');
    });

    it("mint none existent should revert", async () => {
      let { to, id, quantity, data } = mintParams;

      // mint again
      await expect(
        badgeContract.connect(minter).mint(to, 2, quantity, data)
      ).to.be.revertedWithCustomError(badgeContract, 'NonexistentToken');
    });
  })

  describe("setCustomURI()", () => {
    it("Should set a new uri", async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      const newURI = 'ipfs://new';

      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data);
      await badgeContract.connect(minter).setCustomURI(id, newURI);

      const tokenUri = await badgeContract.uri(id);
      expect(tokenUri).to.equal(newURI);
    });

    it("Should emit URI event", async () => {
      const newURI = 'ipfs://new';
      let { creator, id, initialSupply, uri, data } = createParams;

      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data);

      await expect(
        badgeContract.connect(minter).setCustomURI(id, newURI)
      )
        .to.emit(badgeContract, 'URI')
        .withArgs(newURI, id);
    });

    it("not minter should revert", async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      const newURI = 'ipfs://new';

      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data);

      await expect(
        badgeContract.connect(accounts[2]).setCustomURI(id, newURI)
      ).to.be.revertedWithCustomError(badgeContract, 'OnlyMinter');
    });

    it("set none existent token should revert", async () => {
      let { id } = createParams;
      const newURI = 'ipfs://new';

      await expect(
        badgeContract.connect(minter).setCustomURI(id, newURI)
      ).to.be.revertedWithCustomError(badgeContract, 'NonexistentToken');
    });
  });

  describe('exists()', async () => {
    it("should return false when not exist", async () => {
      let exist = await badgeContract.exists(10000);
      expect(exist).to.equal(false);
    });

    it("should return true when exist", async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).create(creator, id, initialSupply, uri, data);

      let exist = await badgeContract.exists(id);
      expect(exist).to.equal(true);
    });
  })

  describe("1155", () => {
    describe("setApprovalForAll()", () => {
      it("Should revert with non-approvable", async () => {
        let operator = provider.createEmptyWallet().address;

        await expect(
          badgeContract.setApprovalForAll(operator, true)
        )
          .to.be.revertedWithCustomError(badgeContract, 'NonApprovableERC1155Token')
      });
    });
  })

  describe("updateScore", () => {
    let score = 80;

    it('should revert "NotClaimedYet"', async () => {
      let { id } = createParams;
      await expect(
        badgeContract.connect(minter).updateScore(minter.address, id, score)
      ).to.revertedWithCustomError(badgeContract, 'NotClaimedYet');
    });
  });
});