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
const OneEther = ethers.utils.parseEther('1.0');

const creator = provider.createEmptyWallet()


const updateParams = {
  startTs: 100,
  endTs: 999999,
  title: 'titleUpdate',
  uri: 'ipfs://Update' // quest URI
}

const badgeParams = {
  'questId': 10000,
  'uri': 'ipfs://123',
}

function getRandomAddress() {
  return provider.createEmptyWallet().address
}

const INVALID_SIG = '0xbba42b3d0af3d44ce510e7b6720750510dab05d6158de272cc06f91994c9dbf02ddee04c3697120ce7ca953978aef6bfb08edeaea38567dd0079f1da7582ccb71c';

describe("Badge", async () => {
  let badgeContract;
  let badgeMinterContract;
  let accounts, owner, sender, signer;
  const name = 'Decert Badge';
  const symbol = 'Decert';
  let updateScoreSig = '';
  let snapshotId;

  async function genClaimWithCreateSig(createParams, questId, to, uri, sender, signer) {
    let { creator, startTs, endTs, title, uri: questUri } = createParams;
    // console.log(creator, questId, startTs, endTs, title, questUri, to, uri, badgeMinterContract.address, sender.address)
    const types = ['address', 'uint256', 'uint32', 'uint32', 'string', 'string', 'address', 'string', 'address', 'address'];
    const params = [creator, questId, startTs, endTs, title, questUri, to, uri, badgeMinterContract.address, sender.address];

    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genClaimWithScoreSig(to, questId, uri, sender, signer) {
    const types = ['address', 'uint256', 'string', 'address', 'address'];
    const params = [to, questId, uri, badgeMinterContract.address, sender.address];
    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genUpdateURISig(tokenId, uri, sender, signer) {
    const types = ['uint256', 'string', 'address', 'address'];
    const params = [tokenId, uri, badgeMinterContract.address, sender.address];
    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genUpdateQuestSig(questId, updateParams, sender, signer) {
    let { startTs, endTs, title, uri: questUri } = updateParams;
    const types = ['uint256', 'uint32', 'uint32', 'string', 'string', 'address', 'address'];
    const params = [questId, startTs, endTs, title, questUri, badgeMinterContract.address, sender.address];
    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }


  async function genAirdropBadgeSig(params, sender, signer) {
    const { questsId, receivers } = params;

    const hash = ethers.utils.solidityKeccak256(['string', 'uint256[]', 'address[]', 'address', 'address'], ['airdropBadge', questsId, receivers, badgeMinterContract.address, sender.address]);

    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genClaimSig(params, sender, signer) {
    const { to, questsId, uri } = params;
    const hash = ethers.utils.solidityKeccak256(['address', 'uint256', 'string', 'address', 'address'], [to, questsId, uri, badgeMinterContract.address, sender.address]);

    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  before(async () => {
    const Badge = await ethers.getContractFactory("Badge");
    badgeContract = await Badge.deploy();
    await badgeContract.deployed();

    const BadgeMiner = await ethers.getContractFactory("BadgeMinter");
    badgeMinterContract = await BadgeMiner.deploy(badgeContract.address);
    await badgeMinterContract.deployed();

    accounts = await ethers.getSigners();
    owner = accounts[0];
    signer = accounts[1];
    sender = accounts[3];
    // set signer
    await badgeMinterContract.setSigner(signer.address);
    await badgeContract.setMinter(badgeMinterContract.address, true);
    let { questId, score, uri } = badgeParams;

    snapshotId = await ethers.provider.send("evm_snapshot");
  })

  afterEach(async () => {
    snapshotId = await revertBlock(snapshotId);
  });

  describe("updateURI", () => {
    let updateURISig = '';
    let sender, other;
    let claimSig = ''
    before(async () => {
      accounts = await ethers.getSigners();
      sender = accounts[3];
      other = accounts[4];
      let { questId, score, uri } = badgeParams;
      updateURISig = await genUpdateURISig(1, uri, sender, signer);
      claimSig = await genClaimSig({ 'to': sender.address, 'questsId': questId, 'uri': uri }, sender, signer);
    });

    it('should revert "ERC721: invalid token ID"', async () => {
      let { questId, score, uri } = badgeParams;

      await expect(
        badgeMinterContract.connect(sender).updateURI(1, uri, updateURISig)
      ).to.revertedWith('ERC721: invalid token ID');
    });

    it('should revert "Invalid signer"', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      await expect(
        badgeMinterContract.connect(sender).updateURI(1, uri, INVALID_SIG)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'InvalidSigner');
    });

    it('should revert "Not Owner"', async () => {
      let { questId, score, uri } = badgeParams;
      let transaction = await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      updateURISig = await genUpdateURISig(tokenId, uri, other, signer);
      await expect(
        badgeMinterContract.connect(other).updateURI(tokenId, uri, updateURISig)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'NotOwner');
    });

    it('should updateURI success', async () => {
      let { questId, score, uri } = badgeParams;
      let transaction = await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      uri = "ipfs://ipfs-new"
      updateURISig = await genUpdateURISig(tokenId, uri, sender, signer);
      await badgeMinterContract.connect(sender).updateURI(tokenId, uri, updateURISig);

      let tokenURI = await badgeContract.tokenURI(tokenId);
      expect(tokenURI).to.equal(uri);
    });
  });

  describe('airdropBadge()', () => {
    let creator;
    let caller;
    let claimer;
    let InitStartQuestId = 10000;
    const receiver1 = getRandomAddress();
    const receiver2 = getRandomAddress();
    let claimSig;
    before(async () => {
      caller = accounts[9]; // 任意
      let { questId, uri } = badgeParams;
      creator = accounts[2];
      claimer = accounts[3];
      claimSig = await genClaimSig({ 'to': sender.address, 'questsId': questId, 'uri': uri }, sender, signer);
    })
    it('should succeed when single address', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      const questIds = [questId]
      const receivers = [receiver1];
      const uris = ["ipfs://12412"];
      airdropBadgeSig = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);
      let transaction = await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSig);
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[1].args.tokenId;

      let totalSupply = await badgeContract.totalSupply();

      expect(totalSupply).to.equal(2);

      let ownerAddress = await badgeContract.ownerOf(tokenId);
      expect(ownerAddress).to.equal(receiver1);

      let ipfs1 = await badgeContract.tokenURI(tokenId);
      expect(ipfs1).to.equal(uris[0]);

    });

    it('should succeed when multi address', async () => {
      let { questId, score, uri } = badgeParams;

      const questIds = [questId, questId + 1];
      const receivers = [receiver1, receiver2];
      const scores = [10, 100];
      const uris = ["ipfs://12412", "ipfs://9877"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);

      let transaction = await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti);
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId1 = events[0].args.tokenId;
      const tokenId2 = events[1].args.tokenId;

      let ownerAddress1 = await badgeContract.ownerOf(tokenId1);
      let ownerAddress2 = await badgeContract.ownerOf(tokenId2);
      expect(ownerAddress1).to.equal(receiver1);
      expect(ownerAddress2).to.equal(receiver2);

      let totalSupply = await badgeContract.totalSupply();
      expect(totalSupply).to.equal(2);

      let balance1 = await badgeContract.balanceOf(receiver1);
      let balance2 = await badgeContract.balanceOf(receiver2);
      expect(balance1).to.equal(1);
      expect(balance2).to.equal(1);

      let uri1 = await badgeContract.tokenURI(tokenId1);
      let uri2 = await badgeContract.tokenURI(tokenId2);
      expect(uri1).to.equal(uris[0]);
      expect(uri2).to.equal(uris[1]);
    });

    it('should airdrop when batch token single address', async () => {
      let { questId, score, uri } = badgeParams;
      const questIds = [questId, questId + 1];
      const receivers = [receiver1, receiver1];
      const scores = [10, 100];
      const uris = ["ipfs://12412", "ipfs://9877"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);
      let transaction = await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti);
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId1 = events[0].args.tokenId;
      const tokenId2 = events[1].args.tokenId;

      let balance1 = await badgeContract.balanceOf(receiver1);
      expect(balance1).to.equal(2);

      let uri1 = await badgeContract.tokenURI(tokenId1);
      let uri2 = await badgeContract.tokenURI(tokenId2);
      expect(uri1).to.equal(uris[0]);
      expect(uri2).to.equal(uris[1]);
    });

    it('should failed when none address', async () => {
      let { questId, score, uri } = badgeParams;

      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      const questIds = [];
      const receivers = [];
      const scores = [];
      const uris = [];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });

    it('should failed address and length not equal', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      const questIds = [];
      const receivers = [receiver1];
      const scores = [];
      const uris = [];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });

    it('should failed with invalid signer', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      const questIds = [questId];
      const receivers = [receiver1];
      const scores = [10];
      const uris = ["ipfs://12412"];
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, INVALID_SIG)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'InvalidSigner');
    });

    it('should emit a Airdroped event', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      const questIds = [questId];
      const receivers = [receiver1];
      const scores = [10];
      const uris = ["ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti)
      ).to.emit(badgeMinterContract, 'Airdroped')
        .withArgs(questId, receivers[0], uris[0]);
    });

    it('should revert "AlreadyHoldsBadge" when has claimed before', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);
      //second
      const questIds = [questId, questId];
      const receivers = [sender.address, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeContract, 'AlreadyHoldsBadge');
    });

    it('should revert "AlreadyHoldsBadge" when has airdrop before', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      // first
      const questIds = [questId, questId];
      const receivers = [receiver1, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);

      await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti);

      // second
      const questIds2 = [questId];
      const receivers2 = [receiver2];
      const scores2 = [10];
      const uris2 = ["ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds2, 'receivers': receivers2, 'scores': scores2 }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds2, receivers2, uris2, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeContract, 'AlreadyHoldsBadge');
    });

    it('should revert "InvalidArray" when receivers length < tokenIds length', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      const questIds = [questId, questId + 1, questId + 3];
      const receivers = [receiver1, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);

      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });

    it('should revert "InvalidArray" when receivers length > tokenIds length', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claim(sender.address, questId, uri, claimSig);

      const questIds = [questId];
      const receivers = [receiver1, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers }, caller, signer);

      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });
  });

  describe('claim()', () => {
    let creator;
    let caller;
    before(async () => {
      caller = accounts[9]; // 任意
      creator = accounts[2];
      claimer = accounts[3];
    })
    it('should success', async () => {
      let questId = 10000;
      let uri = '';
      let claimSig = await genClaimSig({ 'to': claimer.address, 'questsId': questId, 'uri': uri }, caller, signer);

      let transaction = await badgeMinterContract.connect(caller).claim(claimer.address, questId, uri, claimSig)
      await transaction.wait();
      const filter = badgeContract.filters.Claimed();
      const events = await badgeContract.queryFilter(filter);
      const tokenId = events[0].args.tokenId;

      let balance1 = await badgeContract.balanceOf(claimer.address);
      expect(balance1).to.equal(1);

      let totalSupply = await badgeContract.totalSupply()
      expect(totalSupply).to.equal(1);

      let tokenURI = await badgeContract.tokenURI(tokenId)
      expect(tokenURI).to.equal(uri);
    });
    it('second claim should revert', async () => {
      let questId = 10000;
      let uri = "uri";

      let claimSig = await genClaimSig({ 'to': claimer.address, 'questsId': questId, 'uri': uri }, caller, signer);

      await badgeMinterContract.connect(caller).claim(claimer.address, questId, uri, claimSig)

      await expect(
        badgeMinterContract.connect(caller).claim(claimer.address, questId, uri, claimSig)
      ).to.revertedWithCustomError(badgeContract, 'AlreadyHoldsBadge');
    });
    it('should failed with invalid signer', async () => {
      let questId = 10000;
      let uri = "uri";

      let claimSig = await genClaimSig({ 'to': claimer.address, 'questsId': questId, 'uri': uri }, caller, signer);

      await expect(
        badgeMinterContract.connect(caller).claim(claimer.address, questId, uri, INVALID_SIG)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidSigner');
    });
  });
  describe('setSigner()', () => {
    it('should success', async () => {
      await expect(
        badgeMinterContract.connect(owner).setSigner(accounts[9].address)
      ).to.emit(badgeMinterContract, 'SignerChanged')
        .withArgs(accounts[9].address);
    });
    it('should revert onlyOwner error', async () => {
      await expect(
        badgeMinterContract.connect(accounts[9]).setSigner(accounts[9].address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});