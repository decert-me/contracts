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
const createParams = {
  creator: creator.address,
  startTs: 0,
  endTs: 2681807920,
  title: 'title',
  uri: 'ipfs://123' // quest URI
}

const updateParams = {
  startTs: 100,
  endTs: 999999,
  title: 'titleUpdate',
  uri: 'ipfs://Update' // quest URI
}

const badgeParams = {
  'questId': 10000,
  'score': 100000,
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
  let claimWithCreateSig = '';
  let snapshotId;

  async function genClaimWithCreateSig(createParams, questId, score, uri, sender, signer) {
    let { creator, startTs, endTs, title, uri: questUri } = createParams;

    const types = ['address', 'uint256', 'uint32', 'uint32', 'string', 'string', 'uint256', 'string', 'address', 'address'];
    const params = [creator, questId, startTs, endTs, title, questUri, score, uri, badgeMinterContract.address, sender.address];

    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genClaimWithScoreSig(to, questId, score, uri, sender, signer) {
    const types = ['address', 'uint256', 'uint256', 'string', 'address', 'address'];
    const params = [to, questId, score, uri, badgeMinterContract.address, sender.address];
    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genUpdateScoreSig(to, questId, score, sender, signer) {
    const types = ['address', 'uint256', 'uint256', 'address', 'address'];
    const params = [to, questId, score, badgeMinterContract.address, sender.address];
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
    const { questsId, receivers, scores } = params;

    const hash = ethers.utils.solidityKeccak256(['string', 'uint256[]', 'address[]', 'uint256[]', 'address', 'address'], ['airdropBadge', questsId, receivers, scores, badgeMinterContract.address, sender.address]);

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
    claimWithCreateSig = await genClaimWithCreateSig(createParams, questId, score, uri, sender, signer);
    claimWithScoreSig = await genClaimWithScoreSig(sender.address, questId, score, uri, sender, signer);

    snapshotId = await ethers.provider.send("evm_snapshot");
  })

  afterEach(async () => {
    snapshotId = await revertBlock(snapshotId);
  });

  describe('claimWithCreate()', async () => {

    before(async () => {
    });

    it("minter claimWithCreate", async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

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

      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, creator.address, score, uri, claimWithCreateSig);

      await expect(
        badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, creator.address, score, uri, claimWithCreateSig)
      ).to.be.revertedWithCustomError(badgeContract, 'QuestIdAlreadyExists');
    });

    it('should revert "Invalid signer"', async () => {
      let { questId, score, uri } = badgeParams;

      await expect(
        badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, creator.address, score, uri, INVALID_SIG)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidSigner');
    });

    it('creator should receive eth after donation', async () => {
      const beforeBalance = await ethers.provider.getBalance(creator.address);

      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig, { value: OneEther });

      const afterBalance = await ethers.provider.getBalance(creator.address);
      const gap = afterBalance.sub(beforeBalance);

      expect(gap.toString()).to.equal(OneEther.toString());
    });

    it('should emit a Donation event when donate', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig, { value: OneEther })
      ).to.emit(badgeMinterContract, 'Donation')
        .withArgs(sender.address, creator.address, OneEther.toString());
    });
  })

  describe("updateScore", () => {
    let updateScoreSig = '';
    before(async () => {
      let { questId, score, uri } = badgeParams;
      updateScoreSig = await genUpdateScoreSig(sender.address, questId, score, sender, signer);
    });

    it('should revert "NotClaimedYet"', async () => {
      let { questId, score, uri } = badgeParams;

      await expect(
        badgeMinterContract.connect(sender).updateScore(sender.address, questId, score, updateScoreSig)
      ).to.revertedWithCustomError(badgeContract, 'NotClaimedYet');
    });

    it('should revert "Invalid signer"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeMinterContract.connect(sender).updateScore(sender.address, questId, score, INVALID_SIG)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'InvalidSigner');
    });

    it('should updateScore success', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      score = 100
      updateScoreSig = await genUpdateScoreSig(sender.address, questId, score, sender, signer);
      await badgeMinterContract.connect(sender).updateScore(sender.address, questId, score, updateScoreSig)

      let totalSupply = await badgeContract.totalSupply();

      let badgeScore = await badgeContract.scores(totalSupply);
      expect(badgeScore).to.equal(score);
    });
  });
  describe("claimWithScore", () => {
    let other;
    before(async () => {
      other = accounts[9];
    });

    it('should revert "NonexistentQuest"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeMinterContract.connect(sender).claimWithScore(sender.address, questId, score, uri, claimWithScoreSig)
      ).to.revertedWithCustomError(badgeContract, 'NonexistentQuest');
    });

    it('should revert "Invalid signer"', async () => {
      let { questId, score, uri } = badgeParams;
      await expect(
        badgeMinterContract.connect(sender).claimWithScore(sender.address, questId, score, uri, INVALID_SIG)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidSigner');
    });

    it('should revert "AlreadyHoldsBadge"', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);
      await expect(
        badgeMinterContract.connect(sender).claimWithScore(sender.address, questId, score, uri, claimWithScoreSig)
      ).to.revertedWithCustomError(badgeContract, 'AlreadyHoldsBadge');
    });


    it('should claimWithScore success', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);
      score = 100
      claimWithScoreSig = await genClaimWithScoreSig(other.address, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithScore(other.address, questId, score, uri, claimWithScoreSig);

      let totalSupply = await badgeContract.totalSupply();
      expect(totalSupply).to.equal(2);

      let badgeScore = await badgeContract.scores(totalSupply);
      expect(badgeScore).to.equal(score);
    });

    it('creator should receive eth after donation', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);
      score = 100
      const beforeBalance = await ethers.provider.getBalance(creator.address);

      claimWithScoreSig = await genClaimWithScoreSig(other.address, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithScore(other.address, questId, score, uri, claimWithScoreSig, { value: OneEther });

      const afterBalance = await ethers.provider.getBalance(creator.address);
      const gap = afterBalance.sub(beforeBalance);

      expect(gap.toString()).to.equal(OneEther.toString());
    });

    it('should emit a Donation event when donate', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);
      score = 100
      await expect(
        badgeMinterContract.connect(sender).claimWithScore(other.address, questId, score, uri, claimWithScoreSig, { value: OneEther })
      ).to.emit(badgeMinterContract, 'Donation')
        .withArgs(sender.address, creator.address, OneEther.toString());
    });
  });

  describe("updateQuest", () => {
    let updateQuestSig = '';
    let other;
    before(async () => {
      other = accounts[9];
      let { questId, score, uri } = badgeParams;
      updateQuestSig = await genUpdateQuestSig(questId, updateParams, sender, signer);
    });

    it('should revert "NonexistentQuest"', async () => {
      let { questId, score, uri } = badgeParams;
      let { startTs, endTs, title, uri: questUri } = updateParams;
      await expect(
        badgeMinterContract.connect(sender).updateQuest(questId, startTs, endTs, title, questUri, updateQuestSig)
      ).to.revertedWithCustomError(badgeContract, 'NonexistentQuest');
    });

    it('should revert "Invalid signer"', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      let { startTs, endTs, title, uri: questUri } = updateParams;
      await expect(
        badgeMinterContract.connect(sender).updateQuest(questId, startTs, endTs, title, questUri, INVALID_SIG)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidSigner');
    });

    it('should updateQuest success', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      let { startTs, endTs, title, uri: questUri } = updateParams;
      await badgeMinterContract.connect(sender).updateQuest(questId, startTs, endTs, title, questUri, updateQuestSig);

      let totalSupply = await badgeContract.totalSupply();
      expect(totalSupply).to.equal(1);

      let questsData = await badgeContract.getQuest(questId);
      expect(questsData.startTs).to.equal(updateParams.startTs);
      expect(questsData.endTs).to.equal(updateParams.endTs);
      expect(questsData.title).to.equal(updateParams.title);

      let customQuestId = await badgeContract.badgeToQuest(totalSupply);
      expect(customQuestId).to.equal(questId);
    });
  });

  describe('airdropBadge()', () => {
    let creator;
    let caller;
    let claimer;
    let InitStartQuestId = 10000
    const receiver1 = getRandomAddress();
    const receiver2 = getRandomAddress();
    before(async () => {
      caller = accounts[9]; // 任意
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId, score, uri, sender, signer);

      creator = accounts[2];
      claimer = accounts[3];
    })
    it('should succeed when single address', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [questId]
      const receivers = [receiver1];
      const scores = [10];
      const uris = ["ipfs://12412"];
      airdropBadgeSig = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);
      await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSig);

      let questIdRes = await badgeContract.badgeToQuest(2);
      let totalSupply = await badgeContract.totalSupply();

      expect(questIdRes).to.equal(questId);
      expect(totalSupply).to.equal(2);


      let scoreAfter = await badgeContract.scores(2);
      expect(scoreAfter).to.equal(scores);

      let ownerAddress = await badgeContract.ownerOf(2);
      expect(ownerAddress).to.equal(receiver1);

      let ipfs1 = await badgeContract.tokenURI(2);
      expect(ipfs1).to.equal(uris[0]);

    });

    it('should succeed when multi address', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId + 1, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId + 1, caller.address, score, uri, claimWithCreateSig);

      const questIds = [questId, questId + 1];
      const receivers = [receiver1, receiver2];
      const scores = [10, 100];
      const uris = ["ipfs://12412", "ipfs://9877"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);

      await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti);

      let ownerAddress1 = await badgeContract.ownerOf(3);
      let ownerAddress2 = await badgeContract.ownerOf(4);
      expect(ownerAddress1).to.equal(receiver1);
      expect(ownerAddress2).to.equal(receiver2);

      let totalSupply = await badgeContract.totalSupply();
      expect(totalSupply).to.equal(4);

      let balance1 = await badgeContract.balanceOf(receiver1);
      let balance2 = await badgeContract.balanceOf(receiver2);
      expect(balance1).to.equal(1);
      expect(balance2).to.equal(1);

      let score1 = await badgeContract.scores(3);
      let score2 = await badgeContract.scores(4);
      expect(score1).to.equal(scores[0]);
      expect(score2).to.equal(scores[1]);

      let uri1 = await badgeContract.tokenURI(3);
      let uri2 = await badgeContract.tokenURI(4);
      expect(uri1).to.equal(uris[0]);
      expect(uri2).to.equal(uris[1]);
    });

    it('should airdrop when batch token single address', async () => {
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);
      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId + 1, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId + 1, sender.address, score, uri, claimWithCreateSig);

      const questIds = [questId, questId + 1];
      const receivers = [receiver1, receiver1];
      const scores = [10, 100];
      const uris = ["ipfs://12412", "ipfs://9877"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);
      await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti);

      let balance1 = await badgeContract.balanceOf(receiver1);
      expect(balance1).to.equal(2);

      let score1 = await badgeContract.scores(3);
      let score2 = await badgeContract.scores(4);
      expect(score1).to.equal(scores[0]);
      expect(score2).to.equal(scores[1]);

      let uri1 = await badgeContract.tokenURI(3);
      let uri2 = await badgeContract.tokenURI(4);
      expect(uri1).to.equal(uris[0]);
      expect(uri2).to.equal(uris[1]);
    });

    it('should failed when none address', async () => {
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [];
      const receivers = [];
      const scores = [];
      const uris = [];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });

    it('should failed address and length not equal', async () => {
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [];
      const receivers = [receiver1];
      const scores = [];
      const uris = [];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });

    it('should failed with invalid signer', async () => {
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [questId];
      const receivers = [receiver1];
      const scores = [10];
      const uris = ["ipfs://12412"];
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, INVALID_SIG)
      ).to.be.revertedWithCustomError(badgeMinterContract, 'InvalidSigner');
    });

    it('should emit a Airdroped event', async () => {
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [questId];
      const receivers = [receiver1];
      const scores = [10];
      const uris = ["ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti)
      ).to.emit(badgeMinterContract, 'Airdroped')
        .withArgs(questId, receivers[0], scores[0], uris[0]);
    });

    it('should skip when now > endTs', async () => {
      const endTs = Math.floor(new Date().getTime() / 1000) + 30;

      const questData_ = Object.assign({}, createParams);
      questData_.endTs = endTs;
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(questData_, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(questData_, questId, sender.address, score, uri, claimWithCreateSig);
      // add time 
      await network.provider.send("evm_setNextBlockTimestamp", [Math.floor(Date.now() / 1000) + 60]);
      const questIds = [questId];
      const receivers = [receiver1];
      const scores = [10];
      const uris = ["ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);
      badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti);

      let balance1 = await badgeContract.balanceOf(receiver1);
      expect(balance1).to.equal(0);

      let totalSupply = await badgeContract.totalSupply()
      expect(totalSupply).to.equal(1);

      let questIdRes = await badgeContract.badgeToQuest(2)
      expect(questIdRes).to.equal(0);

      await expect(
        badgeContract.tokenURI(2)
      ).to.be.revertedWithCustomError(badgeContract, 'NonexistentToken');

    });

    it('should succeed when in time', async () => {
      const startTs = Math.floor(new Date().getTime() / 1000) - 30;
      const endTs = Math.floor(new Date().getTime() / 1000) + 30;

      const questData_ = Object.assign({}, createParams);
      questData_.startTs = startTs;
      questData_.endTs = endTs;
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(questData_, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(questData_, questId, sender.address, score, uri, claimWithCreateSig);
      const questIds = [questId];
      const receivers = [receiver2];
      const scores = [10];
      const uris = ["ipfs://12412"];

      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);
      await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti);


      let balance1 = await badgeContract.balanceOf(receiver2);
      expect(balance1).to.equal(1);

      let totalSupply = await badgeContract.totalSupply()
      expect(totalSupply).to.equal(2);

    });

    it('should revert "AlreadyHoldsBadge" when has claimed before', async () => {
      let { questId, score, uri } = badgeParams;
      claimWithCreateSig = await genClaimWithCreateSig(createParams, questId, score, uri, sender, signer);
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);
      //second
      const questIds = [questId, questId];
      const receivers = [sender.address, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeContract, 'AlreadyHoldsBadge');
    });

    it('should revert "AlreadyHoldsBadge" when has airdrop before', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      // first
      const questIds = [questId, questId];
      const receivers = [receiver1, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);

      await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti);

      // second
      const questIds2 = [questId];
      const receivers2 = [receiver2];
      const scores2 = [10];
      const uris2 = ["ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds2, 'receivers': receivers2, 'scores': scores2 }, caller, signer);
      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds2, receivers2, uris2, scores2, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeContract, 'AlreadyHoldsBadge');
    });

    it('should skip airdrop none existent token', async () => {
      let { questId, score, uri } = badgeParams;
      const questIds = [questId, questId];
      const receivers = [receiver1, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);

      await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti);

      expect(await badgeContract.balanceOf(receiver2)).to.equal(0);
      expect(await badgeContract.balanceOf(receiver1)).to.equal(0);
    });

    it('should skip airdrop multi none existent token', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [questId, questId + 1];
      const receivers = [receiver1, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);

      await badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti);

      expect(await badgeContract.balanceOf(receiver1)).to.equal(1);
      expect(await badgeContract.balanceOf(receiver2)).to.equal(0);
    });

    it('should revert "InvalidArray" when receivers length < tokenIds length', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [questId, questId + 1, questId + 3];
      const receivers = [receiver1, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);

      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });

    it('should revert "InvalidArray" when receivers length > tokenIds length', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [questId];
      const receivers = [receiver1, receiver2];
      const scores = [10, 200];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);

      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });

    it('should revert "InvalidArray" when receivers length > scores length', async () => {
      let { questId, score, uri } = badgeParams;
      await badgeMinterContract.connect(sender).claimWithCreate(createParams, questId, sender.address, score, uri, claimWithCreateSig);

      const questIds = [questId, questId];
      const receivers = [receiver1, receiver2];
      const scores = [10];
      const uris = ["ipfs://12412", "ipfs://12412"];
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'questsId': questIds, 'receivers': receivers, 'scores': scores }, caller, signer);

      await expect(
        badgeMinterContract.connect(caller).airdropBadge(questIds, receivers, uris, scores, airdropBadgeSigMulti)
      ).to.revertedWithCustomError(badgeMinterContract, 'InvalidArray');
    });
  });
});