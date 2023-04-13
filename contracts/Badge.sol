// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./SBTBase.sol";
import "./interface/IBadge.sol";
import "./interface/IQuest.sol";

contract Badge is IBadge, SBTBase, Ownable {
    error InvalidMinter();
    error OnlyMinter();
    error NonTransferrableERC1155Token();
    error NonApprovableERC1155Token();
    error AlreadyHoldsBadge();
    error NonexistentToken();
    error TokenIdAlreadyExists();
    error NotClaimedYet();
    error OverLimit();

    mapping(address => bool) public minters;
    mapping(uint256 => uint256) public scores;
    mapping(uint256 => uint256) public badgeToQuest;
    mapping(uint256 => uint256) _questToBadgeNum; //migrate to quest
    mapping(address => mapping(uint256 => uint256)) addrToQuestToBadge;

    event SetMinter(address minter, bool enabled);

    uint256 _totalSupply = 0;

    IQuest public quest;

    constructor(address quest_) SBTBase("Decert Badge", "Decert") {
        quest = IQuest(quest_);
    }

    modifier onlyMinter() {
        if (!minters[msg.sender]) {
            revert OnlyMinter();
        }
        _;
    }

    function setMinter(address minter, bool enabled) external onlyOwner {
        if (minter == address(0)) {
            revert InvalidMinter();
        }
        minters[minter] = enabled;
        emit SetMinter(minter, enabled);
    }

    function claim(
        address to,
        uint256 questId,
        bytes memory data
    ) external onlyMinter {
        // 判断 questId 是否存在，是否已领取,是否达到上限
        if (!quest.exists(questId)) {
            revert NonexistentToken();
        }

        if (addrToQuestToBadge[to][questId] != 0) {
            revert AlreadyHoldsBadge();
        }

        if (quest.getQuest(questId).supply >= _questToBadgeNum[questId]) {
            revert OverLimit();
        }

        uint256 tokenId = ++_totalSupply;
        _mint(to, tokenId);
        badgeToQuest[tokenId] = questId;
        _questToBadgeNum[questId]++;
        addrToQuestToBadge[to][questId] = tokenId;
    }

    function claimWithScore(
        address to,
        uint256 questId,
        uint256 score,
        bytes memory data
    ) external onlyMinter {
        this.claim(to, questId, data);

        scores[_totalSupply] = score;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        uint questId = badgeToQuest[tokenId];
        return quest.getQuest(questId).uri;
    }

    function updateScore(
        address to,
        uint256 questId,
        uint256 score
    ) external onlyMinter {
        uint badgeId = addrToQuestToBadge[to][questId];

        if (badgeId == 0) {
            revert NotClaimedYet();
        }

        scores[badgeId] = score;
    }

    function getQuestBadgeNum(uint256 questId) external view returns (uint256) {
        return _questToBadgeNum[questId];
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }
}
