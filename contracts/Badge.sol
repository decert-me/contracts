// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SBTBase.sol";
import "./interface/IBadge.sol";

contract Badge is IBadge, SBTBase, Ownable {
    error AlreadyHoldsBadge();
    error NonexistentToken();
    error NotClaimedYet();
    error NonexistentQuest();
    error NotInTime();
    error InvalidMinter();
    error OnlyMinter();
    error QuestIdAlreadyExists();

    using ECDSA for bytes32;

    mapping(address => bool) public minters;
    mapping(uint256 => uint256) public badgeToQuest;
    mapping(uint256 => uint256) _questBadgeNum;
    mapping(address => mapping(uint256 => uint256)) addrToQuestToBadge;
    mapping(uint256 => QuestData) quests;
    mapping(uint256 => string) private _tokenURIs;
    uint256 _totalSupply = 0;

    event MinterSet(address minter, bool enabled);
    event QuesteInit(uint256 indexed questId, QuestData questData);
    event QuestUpdated(uint256 indexed questId, QuestData questData);
    event Claimed(uint256 indexed tokenId, uint256 questId, address sender);
    event Donation(address from, address to, uint256 amount);
    event URIUpdated(uint indexed tokenId, string uri);

    constructor() SBTBase("Decert Badge", "Decert") {}

    function setMinter(
        address minter,
        bool enabled
    ) external override onlyOwner {
        if (minter == address(0)) revert InvalidMinter();

        minters[minter] = enabled;
        emit MinterSet(minter, enabled);
    }

    modifier onlyMinter() {
        if (!minters[msg.sender]) {
            revert OnlyMinter();
        }
        _;
    }

    function _claim(address to, uint256 questId, string memory uri) internal {
        if (addrToQuestToBadge[to][questId] != 0) revert AlreadyHoldsBadge();

        QuestData memory questData = quests[questId];
        if (
            block.timestamp < questData.startTs ||
            block.timestamp > questData.endTs
        ) {
            revert NotInTime();
        }

        uint256 tokenId = ++_totalSupply;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        badgeToQuest[tokenId] = questId;
        _questBadgeNum[questId]++;
        addrToQuestToBadge[to][questId] = tokenId;
        emit Claimed(tokenId, questId, to);
    }

    function claim(
        address to,
        uint256 questId,
        string memory uri
    ) external onlyMinter {
        _claim(to, questId, uri);
    }

    function claimWithInit(
        QuestData calldata questData,
        uint256 questId,
        address to,
        string memory uri
    ) external onlyMinter {
        if (_questBadgeNum[questId] != 0) revert QuestIdAlreadyExists();

        _initQuest(questId, questData);
        _claim(to, questId, uri);
    }

    function updateURI(uint tokenId, string memory uri) external onlyMinter {
        _setTokenURI(tokenId, uri);
        emit URIUpdated(tokenId, uri);
    }

    function updateQuest(
        uint256 questId,
        uint32 startTs,
        uint32 endTs,
        string memory title,
        string memory questUri
    ) external onlyMinter {
        if (_questBadgeNum[questId] == 0) revert NonexistentQuest();

        QuestData storage quest = quests[questId];
        quest.startTs = startTs;
        quest.endTs = endTs;
        quest.title = title;
        quest.uri = questUri;

        emit QuestUpdated(questId, quest);
    }

    function _initQuest(uint256 questId, QuestData memory quest) internal {
        quests[questId] = quest;
        emit QuesteInit(questId, quest);
    }

    function getQuest(
        uint256 questId
    ) external view returns (QuestData memory) {
        return quests[questId];
    }

    function getBadgeNum(uint256 questId) external view returns (uint256) {
        return _questBadgeNum[questId];
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function _setTokenURI(
        uint256 tokenId,
        string memory _tokenURI
    ) internal virtual {
        if (!_exists(tokenId)) revert NonexistentToken();

        _tokenURIs[tokenId] = _tokenURI;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert NonexistentToken();

        return _tokenURIs[tokenId];
    }
}
