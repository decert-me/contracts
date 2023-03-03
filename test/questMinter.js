const { ethers, upgrades } = require('hardhat');
const { use, expect } = require('chai');
const { solidity, MockProvider } = require('ethereum-waffle');
use(solidity);


const provider = new MockProvider();

const REVERT_MSGS = {
  'OnlyMinter': 'Only minter',
  'OnlyOwner': 'Ownable: caller is not the owner',
  'TokenIdAlreadyExists': 'TokenId already exists',
  'AlreadyHoldsBadge': 'Already holds badge',
  'NotCreator': 'Not creator',
  'AleadyClaimed': 'Aleady claimed',
  'OverLimit': 'Over limit',
  'NotInTime': 'Not in time',
  'InvalidSigner': 'Invalid signer',
  'InvalidReceivers': 'Invalid receivers',
  'NoneExistentToken': 'None existent token',
  'InvalidTokenID': 'ERC721: invalid token ID',
  'ClaimedCannotModify':'Claimed cannot modify',
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
  supply: 4294967295,
  title: 'title',
  uri: 'uri',
}

const questDataNew = {
  startTs: 1000,
  endTs: 1000,
  supply: 0,
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
    const types = ['uint32', 'uint32', 'uint192', 'string', 'string', 'address', 'address'];
    const { startTs, endTs, supply, title, uri } = questData;
    const params = [startTs, endTs, supply, title, uri, questMinterContract.address, sender.address];

    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genModifySig(tokenId, questData, sender, signer) {
    const types = ['uint256', 'uint32', 'uint32', 'uint192', 'string', 'string', 'address', 'address'];
    const { startTs, endTs, supply, title, uri } = questData;
    const params = [tokenId, startTs, endTs, supply, title, uri, questMinterContract.address, sender.address];

    const hash = ethers.utils.solidityKeccak256(types, params);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genClaimSig(claimData, sender, signer) {
    const { tokenId, score } = claimData;
    const hash = ethers.utils.solidityKeccak256(['uint256', 'uint256', 'address', 'address'], [tokenId, score, badgeContract.address, sender.address]);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genSetCustomURISig(customURIData, sender, signer) {
    const { tokenId, uri } = customURIData;

    const hash = ethers.utils.solidityKeccak256(['uint256', 'string', 'address', 'address'], [tokenId, uri, badgeContract.address, sender.address]);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  async function genAirdropBadgeSig(params, sender, signer) {
    const { tokenId } = params;
    const hash = ethers.utils.solidityKeccak256(['string', 'uint256[]', 'address', 'address'], ['airdropBadge', tokenId, badgeContract.address, sender.address]);

    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  }

  before(async () => {
    const Badge = await ethers.getContractFactory('Badge');
    badgeContract = await Badge.deploy(uri);
    await badgeContract.deployed();

    const Quest = await ethers.getContractFactory('Quest');
    questContract = await Quest.deploy(badgeContract.address);
    await questContract.deployed();

    const QuestMetadata = await ethers.getContractFactory("QuestMetadata");
    questMetadataContract = await QuestMetadata.deploy(badgeContract.address, questContract.address);
    await questMetadataContract.deployed();

    const QuestMinter = await ethers.getContractFactory('QuestMinter');
    questMinterContract = await QuestMinter.deploy(badgeContract.address, questContract.address);
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

  it('badge address', async () => {
    expect(await questMinterContract.badge()).to.equal(badgeContract.address);
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
      ).to.revertedWith(REVERT_MSGS['InvalidSigner']);
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
        expect(quest.supply).to.equal(supply);
        expect(quest.title).to.equal(title);

        const questOwner = await questContract.ownerOf(InitStartTokenId);
        expect(questOwner).to.equal(creator.address);
      }

      {
        // badge
        expect(await badgeContract.creators(InitStartTokenId)).to.equal(creator.address);
        expect(await badgeContract.tokenSupply(InitStartTokenId)).to.equal(0);
      }
    });

    it('should emit QuestCreated event', async () => {
      await expect(
        questMinterContract.connect(creator).createQuest(questData, createQuestSig)
      ).to.emit(questContract, 'QuestCreated')
        .withArgs(creator.address, InitStartTokenId, [startTs, endTs, supply, title, uri]);
    });

    it('should emit URI event', async () => {
      await expect(
        questMinterContract.connect(creator).createQuest(questData, createQuestSig)
      ).to.emit(badgeContract, 'URI')
        .withArgs(uri, InitStartTokenId);
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
      claimSig = await genClaimSig({ 'tokenId': InitStartTokenId, 'score': score }, claimer, signer);
    })

    it('should revert "Invalid signer"', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      await expect(
        questMinterContract.connect(creator).modifyQuest(InitStartTokenId, questData, INVALID_SIG)
      ).to.revertedWith(REVERT_MSGS['InvalidSigner']);
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
        expect(quest.supply).to.equal(supply);
        expect(quest.title).to.equal(title);

        const questOwner = await questContract.ownerOf(InitStartTokenId);
        expect(questOwner).to.equal(creator.address);
      }

      {
        // badge
        expect(await badgeContract.creators(InitStartTokenId)).to.equal(creator.address);
        expect(await badgeContract.tokenSupply(InitStartTokenId)).to.equal(0);
      }
    });

    it('should revert cannot modify', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);

      await expect(
        questMinterContract.connect(creator).modifyQuest(InitStartTokenId, questDataNew, modifyQuestSig)
      ).to.revertedWith(REVERT_MSGS['ClaimedCannotModify']);
    });

  });


  describe('setCustomURI()', () => {
    let { questData } = questParams;

    let creator;
    let createQuestSig = '';

    before(async () => {
      signer = owner;

      creator = accounts[2];
      createQuestSig = await genCreateSig(questData, creator, signer);
    })

    it('should revert "Not creator"', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig)

      await expect(
        questMinterContract.connect(accounts[3]).setBadgeURI(InitStartTokenId, uri, createQuestSig)
      ).to.revertedWith(REVERT_MSGS['NotCreator']);
    });

    it('should revert "Invalid signer"', async () => {
      const newUri = 'ipfs://new';

      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      await expect(
        questMinterContract.connect(creator).setBadgeURI(InitStartTokenId, newUri, INVALID_SIG)
      ).to.revertedWith(REVERT_MSGS['InvalidSigner']);
    });

    it('should set new uri', async () => {
      const newUri = 'ipfs://new';
      let createQuestSig = await genCreateSig(questData, creator, signer);
      let setCustomURISig = await genSetCustomURISig({ 'tokenId': InitStartTokenId, 'uri': newUri }, creator, signer);

      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await questMinterContract.connect(creator).setBadgeURI(InitStartTokenId, newUri, setCustomURISig);

      let quest = await questContract.quests(InitStartTokenId);
      expect(quest.uri).to.equal(newUri);

      let tokenUri = await badgeContract.uri(InitStartTokenId);
      expect(tokenUri).to.equal(newUri);
    });

    it('should revert set new uri when token none existent', async () => {
      const newUri = 'ipfs://new';
      let setCustomURISig = await genSetCustomURISig({ 'tokenId': InitStartTokenId, 'uri': newUri }, creator, signer);

      await expect(
        questMinterContract.connect(creator).setBadgeURI(InitStartTokenId, newUri, setCustomURISig)
      ).to.revertedWith(REVERT_MSGS['InvalidTokenID']);
    });
  });

  describe('claim()', () => {
    let { questData, signature } = questParams;

    let creator;
    let createQuestSig = '';
    let claimer;
    let claimer2;
    let claimSig = '';
    let claimSig2 = '';
    let score = 80;

    before(async () => {
      signer = owner;
      creator = accounts[2];
      createQuestSig = await genCreateSig(questData, creator, signer);

      claimer = accounts[3];
      claimer2 = accounts[4];
      claimSig = await genClaimSig({ 'tokenId': InitStartTokenId, 'score': score }, claimer, signer);
      claimSig2 = await genClaimSig({ 'tokenId': InitStartTokenId, 'score': score }, claimer2, signer);
    })

    it('should claim succeed', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);

      let balance = await badgeContract.balanceOf(claimer.address, InitStartTokenId);
      let _score = await badgeContract.scores(InitStartTokenId, claimer.address);
      expect(balance).to.equal(1);
      expect(_score).to.equal(score);
    });

    it('should emit a Claimed event', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      await expect(
        questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig)
      ).to.emit(questMinterContract, 'Claimed')
        .withArgs(InitStartTokenId, claimer.address);
    });

    it('should revert "Aleady claimed" when claim twice', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      // first
      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);

      //second
      await expect(
        questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig)
      ).to.revertedWith(REVERT_MSGS['AleadyClaimed']);
    });

    it('should revert "Over limit" when claimed to much', async () => {
      const questData_ = Object.assign({}, questData);
      questData_.supply = 1;
      createQuestSig = await genCreateSig(questData_, creator, signer);
      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);

      // claim1
      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);

      await expect(
        questMinterContract.connect(claimer2).claim(InitStartTokenId, score, claimSig2)
      ).to.revertedWith(REVERT_MSGS['OverLimit']);
    });

    it('should revert "Not in time" when now > endTs', async () => {
      const endTs = Math.floor(new Date().getTime() / 1000) - 10;

      const questData_ = Object.assign({}, questData);
      questData_.endTs = endTs;
      createQuestSig = await genCreateSig(questData_, creator, signer);

      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);

      await expect(
        questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig)
      ).to.revertedWith(REVERT_MSGS['NotInTime']);
    });

    it('should revert "Not in time" when  now < startTs', async () => {
      const startTs = Math.floor(new Date().getTime() / 1000) + 60;

      const questData_ = Object.assign({}, questData);
      questData_.startTs = startTs;
      createQuestSig = await genCreateSig(questData_, creator, signer);

      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);

      await expect(
        questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig)
      ).to.revertedWith(REVERT_MSGS['NotInTime']);
    });

    it('should succeed when in time', async () => {
      const startTs = Math.floor(new Date().getTime() / 1000) - 30;
      const endTs = Math.floor(new Date().getTime() / 1000) + 30;

      const questData_ = Object.assign({}, questData);
      questData_.startTs = startTs;
      questData_.endTs = endTs;
      createQuestSig = await genCreateSig(questData_, creator, signer);

      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);

      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);

      let balance = await badgeContract.balanceOf(claimer.address, InitStartTokenId);
      expect(balance).to.equal(1);
    });

    it('should revert when claim none existent token', async () => {
      await expect(
        questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig)
      ).to.revertedWith(REVERT_MSGS['NoneExistentToken']);
    });

  });

  describe('claim with donation', () => {
    let { questData, signature } = questParams;

    let creator;
    let createQuestSig = '';
    let claimer;
    let claimSig = '';
    let score = 0;

    before(async () => {
      signer = owner;
      creator = accounts[2];
      createQuestSig = await genCreateSig(questData, creator, signer);

      claimer = accounts[3];
      claimSig = await genClaimSig({ 'tokenId': InitStartTokenId, 'score': score }, claimer, signer);
    })

    it('creator should receive eth after donation', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      const beforeBalance = await ethers.provider.getBalance(creator.address);

      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig, { value: OneEther });

      const afterBalance = await ethers.provider.getBalance(creator.address);
      const gap = afterBalance.sub(beforeBalance);

      expect(gap.toString()).to.equal(OneEther.toString());
    });

    it('should emit a Donation event when donate', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      await expect(
        questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig, { value: OneEther })
      ).to.emit(questMinterContract, 'Donation')
        .withArgs(claimer.address, creator.address, OneEther.toString());
    });
  })

  describe('updateScore()', () => {
    let { questData, signature } = questParams;

    let creator;
    let createQuestSig = '';
    let claimer;
    let claimer2;
    let claimSig = '';
    let claimSig2 = '';
    let score = 80;
    let score2 = 90;
    before(async () => {
      signer = owner;
      creator = accounts[2];
      createQuestSig = await genCreateSig(questData, creator, signer);

      claimer = accounts[3];
      claimer2 = accounts[4];
      claimSig = await genClaimSig({ 'tokenId': InitStartTokenId, 'score': score }, claimer, signer);
      claimSig2 = await genClaimSig({ 'tokenId': InitStartTokenId, 'score': score2 }, claimer, signer);
    })

    it('should update score succeed', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);
      let _score = await badgeContract.scores(InitStartTokenId, claimer.address);
      expect(_score).to.equal(score);

      await questMinterContract.connect(claimer).updateScore(InitStartTokenId, score2, claimSig2);
      let _score2 = await badgeContract.scores(InitStartTokenId, claimer.address);
      expect(_score2).to.equal(score2);
    });

    it('should revert "Invalid signer"', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);

      await expect(
        questMinterContract.connect(claimer).updateScore(InitStartTokenId, score2, INVALID_SIG)
      ).to.revertedWith(REVERT_MSGS['InvalidSigner']);
    });

    it('should revert "Not in time" when now > endTs', async () => {
      const endTs = Math.floor(new Date().getTime() / 1000) + 100;

      const questData_ = Object.assign({}, questData);
      questData_.endTs = endTs;
      createQuestSig = await genCreateSig(questData_, creator, signer);

      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);
      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);
      await network.provider.send("evm_increaseTime", [3600]) // add time
      await expect(
        questMinterContract.connect(claimer).updateScore(InitStartTokenId, score2, claimSig2)
      ).to.revertedWith(REVERT_MSGS['NotInTime']);
    });
  })

  describe('airdropBadge()', () => {
    let { questData } = questParams;

    let creator;
    let caller;
    let claimer;
    let claimSig = '';
    let airdropBadgeSig = '';
    let score = 0;
    const receiver1 = getRandomAddress();
    const receiver2 = getRandomAddress();

    before(async () => {
      signer = owner;
      caller = accounts[9]; // 任意

      airdropBadgeSig = await genAirdropBadgeSig({ 'tokenId': [InitStartTokenId] }, caller, signer);
      airdropBadgeSigMulti = await genAirdropBadgeSig({ 'tokenId': [InitStartTokenId,InitStartTokenId+1] }, caller, signer);
      airdropBadgeSigMultiSame = await genAirdropBadgeSig({ 'tokenId': [InitStartTokenId,InitStartTokenId] }, caller, signer);

      creator = accounts[2];
      createQuestSig = await genCreateSig(questData, creator, signer);

      claimer = accounts[3];
      claimSig = await genClaimSig({ 'tokenId': InitStartTokenId, 'score': score }, claimer, signer);
    })
    it('should succeed when single address', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      const receivers = [receiver1];
      await questMinterContract.connect(caller).airdropBadge([InitStartTokenId], receivers, airdropBadgeSig);

      let balance1 = await badgeContract.balanceOf(receiver1, InitStartTokenId);
      let tokenSupply1 = await badgeContract.tokenSupply(InitStartTokenId);

      expect(balance1).to.equal(1);
      expect(tokenSupply1).to.equal(1);
    });

    it('should succeed when multi address', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);


      const receivers = [receiver1,receiver2];
      await questMinterContract.connect(caller).airdropBadge([InitStartTokenId,InitStartTokenId+1], receivers, airdropBadgeSigMulti);

      let balance1 = await badgeContract.balanceOf(receiver1, InitStartTokenId);
      let tokenSupply1 = await badgeContract.tokenSupply(InitStartTokenId);

      expect(balance1).to.equal(1);
      expect(tokenSupply1).to.equal(1);

      let balance2 = await badgeContract.balanceOf(receiver2, InitStartTokenId+1);
      let tokenSupply2 = await badgeContract.tokenSupply(InitStartTokenId+1);

      expect(balance2).to.equal(1);
      expect(tokenSupply2).to.equal(1);
    });

    it('should airdrop when batch token single address', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      const receivers = [receiver1, receiver1];
      await questMinterContract.connect(caller).airdropBadge([InitStartTokenId,InitStartTokenId+1], receivers, airdropBadgeSigMulti);

      let balance1 = await badgeContract.balanceOf(receiver1, InitStartTokenId);
      let balance2 = await badgeContract.balanceOf(receiver1, InitStartTokenId+1);
      let tokenSupply1 = await badgeContract.tokenSupply(InitStartTokenId);
      let tokenSupply2 = await badgeContract.tokenSupply(InitStartTokenId+1);

      expect(balance1).to.equal(1);
      expect(balance2).to.equal(1);
      expect(tokenSupply1).to.equal(1);
      expect(tokenSupply2).to.equal(1);
    });

    it('should failed when none address', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      const receivers = [];
      await expect(
        questMinterContract.connect(caller).airdropBadge([InitStartTokenId], receivers, airdropBadgeSig)
      ).to.be.revertedWith(REVERT_MSGS['InvalidReceivers']);
    });

    it('should failed address and length not equal', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      const receivers = [];
      await expect(
        questMinterContract.connect(caller).airdropBadge([InitStartTokenId], receivers, airdropBadgeSig)
      ).to.be.revertedWith(REVERT_MSGS['InvalidReceivers']);
    });

    it('should failed with invalid signer', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      const receivers = [receiver1];
      await expect(
        questMinterContract.connect(caller).airdropBadge([InitStartTokenId], receivers, INVALID_SIG)
      ).to.be.revertedWith(REVERT_MSGS['InvalidSigner']);
    });

    it('should emit a Airdroped event', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      const receivers = [receiver1];
      await expect(
        questMinterContract.connect(caller).airdropBadge([InitStartTokenId], receivers, airdropBadgeSig)
      ).to.emit(questMinterContract, 'Airdroped')
        .withArgs(InitStartTokenId, receivers[0]);
    });

    it('should revert "Over limit" when claimed to much', async () => {
      const questData_ = Object.assign({}, questData);
      questData_.supply = 1; // only supply 1
      let createQuestSig = await genCreateSig(questData_, creator, signer);
      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);

      // airdrop1
      await questMinterContract.connect(caller).airdropBadge([InitStartTokenId], [receiver1], airdropBadgeSig);

      // second should exceed limit
      await expect(
        questMinterContract.connect(caller).airdropBadge([InitStartTokenId], [receiver2], airdropBadgeSig)
      ).to.revertedWith(REVERT_MSGS['OverLimit']);
    });

    it('should revert "Not in time" when now > endTs', async () => {
      const endTs = Math.floor(new Date().getTime() / 1000) - 10;

      const questData_ = Object.assign({}, questData);
      questData_.endTs = endTs;
      let createQuestSig = await genCreateSig(questData_, creator, signer);

      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);

      await expect(
        questMinterContract.connect(caller).airdropBadge([InitStartTokenId], [receiver1], airdropBadgeSig)
      ).to.revertedWith(REVERT_MSGS['NotInTime']);
    });

    it('should revert "Not in time" when  now < startTs', async () => {
      const startTs = Math.floor(new Date().getTime() / 1000) + 60;

      const questData_ = Object.assign({}, questData);
      questData_.startTs = startTs;
      let createQuestSig = await genCreateSig(questData_, creator, signer);

      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);

      await expect(
        questMinterContract.connect(caller).airdropBadge([InitStartTokenId], [receiver1], airdropBadgeSig)
      ).to.revertedWith(REVERT_MSGS['NotInTime']);
    });

    it('should succeed when in time', async () => {
      const startTs = Math.floor(new Date().getTime() / 1000) - 30;
      const endTs = Math.floor(new Date().getTime() / 1000) + 30;

      const questData_ = Object.assign({}, questData);
      questData_.startTs = startTs;
      questData_.endTs = endTs;
      let createQuestSig = await genCreateSig(questData_, creator, signer);

      await questMinterContract.connect(creator).createQuest(questData_, createQuestSig);

      await questMinterContract.connect(caller).airdropBadge([InitStartTokenId], [receiver1], airdropBadgeSig)

      let balance = await badgeContract.balanceOf(receiver1, InitStartTokenId);
      expect(balance).to.equal(1);
    });

    it('should ignore when has claimed before', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      // first
      await questMinterContract.connect(claimer).claim(InitStartTokenId, score, claimSig);

      //second
      const receivers = [claimer.address, receiver2];
      await questMinterContract.connect(caller).airdropBadge([InitStartTokenId,InitStartTokenId], receivers, airdropBadgeSigMultiSame);

      let balanceClaimer = await badgeContract.balanceOf(claimer.address, InitStartTokenId);
      expect(balanceClaimer).to.equal(1);

      let balanceReceiver = await badgeContract.balanceOf(receiver2, InitStartTokenId);
      expect(balanceReceiver).to.equal(1);
    });

    it('should ignore when has airdrop before', async () => {
      await questMinterContract.connect(creator).createQuest(questData, createQuestSig);

      // first
      let receivers = [receiver1, receiver2];
      await questMinterContract.connect(caller).airdropBadge([InitStartTokenId,InitStartTokenId], receivers, airdropBadgeSigMultiSame);

      // second
      receivers = [receiver2];
      await questMinterContract.connect(caller).airdropBadge([InitStartTokenId], receivers, airdropBadgeSig);

      let balanceReceiver = await badgeContract.balanceOf(receiver2, InitStartTokenId);
      expect(balanceReceiver).to.equal(1);
    });

    it('should revert when airdrop none existent token', async () => {
      let receivers = [receiver1, receiver2];
      await expect(
        questMinterContract.connect(caller).airdropBadge([InitStartTokenId,InitStartTokenId], receivers, airdropBadgeSigMultiSame)
      ).to.revertedWith(REVERT_MSGS['OverLimit']);
    });
  });
});