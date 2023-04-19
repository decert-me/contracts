//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";
import "./SBTBase.sol";
import "./interface/IQuest.sol";
import "./interface/IBadge.sol";
import "./interface/IMetadata.sol";

contract Quest is IQuest, SBTBase, Ownable {
    error InvalidMinter();
    error OnlyMinter();
    error NonexistentToken();
    error ClaimedCannotModify();
    error ZeroAddress();

    uint256 public totalSupply;
    address public meta;

    mapping(address => bool) public minters;
    mapping(uint256 => QuestData) public quests;
    mapping(uint256 => uint256) public questBadgeNum;

    event SetMinter(address minter, bool enabled);
    event QuestCreated(
        address indexed creator,
        uint256 indexed tokenId,
        QuestData questData
    );

    constructor() SBTBase("Decert Quest", "DQuest") {}

    function setMinter(
        address minter,
        bool enabled
    ) external override onlyOwner {
        if (minter == address(0)) {
            revert InvalidMinter();
        }
        minters[minter] = enabled;
        emit SetMinter(minter, enabled);
    }

    modifier onlyMinter() {
        if (!minters[msg.sender]) {
            revert OnlyMinter();
        }
        _;
    }

    function mint(
        address to,
        uint256 tokenId,
        QuestData calldata questData,
        bytes memory data
    ) external override onlyMinter {
        _mint(to, tokenId);
        totalSupply += 1;

        quests[tokenId] = questData;
        emit QuestCreated(to, tokenId, questData);
    }

    function modifyQuest(
        uint256 tokenId,
        QuestData calldata questData
    ) external onlyMinter {
        quests[tokenId] = questData;
    }

    function getQuest(
        uint256 tokenId
    ) external view returns (QuestData memory questData) {
        return quests[tokenId];
    }

    function updateURI(
        uint256 tokenId,
        string calldata uri
    ) external onlyMinter {
        if (!_exists(tokenId)) revert NonexistentToken();

        QuestData storage questData = quests[tokenId];
        questData.uri = uri;
    }

    function updateQuestBadgeNum(
        uint256 questId,
        uint256 badgeNum
    ) external onlyMinter {
        questBadgeNum[questId] = badgeNum;
    }

    function getQuestBadgeNum(uint256 questId) external view returns (uint256) {
        return questBadgeNum[questId];
    }

    function setMetaContract(address _meta) external onlyOwner {
        if (_meta == address(0)) revert ZeroAddress();

        meta = _meta;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        return IMetadata(meta).tokenURI(tokenId);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }
}
