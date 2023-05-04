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

    event SetMinter(address minter, bool enabled);
    event InitQuest(uint256 indexed questId, QuestData questData);
    event UpdateQuest(uint256 indexed questId, QuestData questData);
    event Claimed(uint256 indexed questId, address indexed sender);
    event Donation(address from, address to, uint256 amount);
    event UpdateURI(uint indexed tokenId, string uri);

    constructor() SBTBase("Decert Badge", "Decert") {}

    function setMinter(
        address minter,
        bool enabled
    ) external override onlyOwner {
        if (minter == address(0)) revert InvalidMinter();

        minters[minter] = enabled;
        emit SetMinter(minter, enabled); //TODO: 事件名建议使用名词/过去式
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
        emit Claimed(questId, to);
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
        emit UpdateURI(tokenId, uri); //TODO: 事件名建议使用名词/过去式
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

        emit UpdateQuest(questId, quest); //TODO: 事件名建议使用名词/过去式
    }

    function _initQuest(uint256 questId, QuestData memory quest) internal {
        quests[questId] = quest;
        emit InitQuest(questId, quest); //TODO: 事件名建议使用名词/过去式
    }

    function getQuest(
        uint256 questId
    ) external view returns (QuestData memory) {
        return quests[questId];
    }

    function getQuestBadgeNum(uint256 questId) external view returns (uint256) {
        return _questBadgeNum[questId];
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function _setTokenURI(
        uint256 tokenId,
        string memory _tokenURI
    ) internal virtual {
        require(
            _exists(tokenId),
            "ERC721URIStorage: URI set of nonexistent token"
        );
        // TODO: 统一改成if...revert...；没有引入ERC721URIStorage，不需要标记它
        _tokenURIs[tokenId] = _tokenURI;
    }

     function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert NonexistentToken();

        return _tokenURIs[tokenId];
    }
}
