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
  startTs: 0,
  endTs: 0,
  title: 'ipfs://123',
}

const mintParams = {
  'to': provider.createEmptyWallet().address,
  'id': 0,
  'quantity': 1,
  'data': '0x',
}
const INVALID_SIG = '0xbba42b3d0af3d44ce510e7b6720750510dab05d6158de272cc06f91994c9dbf02ddee04c3697120ce7ca953978aef6bfb08edeaea38567dd0079f1da7582ccb71c';

describe("Badge", async () => {
  let badgeContract;
  let accounts, owner, creator, minter;
  const name = 'Decert Badge';
  const symbol = 'Decert';
  let snapshotId;
  let questId;
  let uri;
  let score;
  let claimWithCreateSig = '';

  async function genClaimWithCreateSig(to, questId, score, uri, sender, signer) {
    const types = ['address', 'uint256', 'uint256', 'string', 'address', 'address'];
    const params = [to, questId, score, uri, badgeContract.address, sender.address];

    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  before(async () => {
    const Badge = await ethers.getContractFactory("Badge");
    badgeContract = await Badge.deploy();
    await badgeContract.deployed();

    accounts = await ethers.getSigners();
    owner = accounts[0];
    signer = owner;
    minter = accounts[1];
    creator = provider.createEmptyWallet().address;

    questId = 10000;
    score = 100;
    uri = "ipfs://"
    snapshotId = await ethers.provider.send("evm_snapshot");
    claimWithCreateSig = await genClaimWithCreateSig(creator, questId, score, uri, minter, signer);
    // set signer
    await badgeContract.setSigner(signer.address);
    // console.log(await badgeContract.signer.address);
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
  })

  describe('claimWithCreate()', async () => {
    it("minter claimWithCreate", async () => {
      await badgeContract.connect(minter).claimWithCreate(creator, questId, score, createParams, uri, claimWithCreateSig);

      let totalSupply = await badgeContract.totalSupply();
      expect(totalSupply).to.equal(1);

      let customUri = await badgeContract.tokenURI(1);
      expect(customUri).to.equal(uri);

      let questsData = await badgeContract.quests(questId);
      expect(questsData.startTs).to.equal(createParams.startTs);
      expect(questsData.endTs).to.equal(createParams.endTs);
      expect(questsData.title).to.equal(createParams.title);

      let customQuestId = await badgeContract.badgeToQuest(1);
      expect(customQuestId).to.equal(questId);
    });

    it.only("claimWithCreate exists quest should revert", async () => {
      let { creator, id, initialSupply, uri, data } = createParams;
      await badgeContract.connect(minter).claimWithCreate(creator, questId, score, createParams, uri, claimWithCreateSig);
      // create same tokenId again
      await expect(
       badgeContract.connect(minter).claimWithCreate(creator, questId, score, createParams, uri, claimWithCreateSig)
      ).to.be.revertedWithCustomError(badgeContract, 'QuestIdAlreadyExists');
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