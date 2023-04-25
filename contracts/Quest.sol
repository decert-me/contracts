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
    event QuestBadgeNumUpdate(uint256 indexed questId, uint256 badgeNum);
    event QuestModify(
        address indexed creator,
        uint256 indexed tokenId,
        QuestData questData
    );
    event Donation(address from, address to, uint256 amount);

    constructor() SBTBase("Decert Quest", "DQuest") {}

    function setMinter(
        address minter,
        bool enabled
    ) external override onlyOwner {
        if (minter == address(0)) revert InvalidMinter();

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
        if (!_exists(tokenId)) revert NonexistentToken();

        quests[tokenId] = questData;
        emit QuestModify(msg.sender, tokenId, questData);
    }

    function getQuest(
        uint256 tokenId
    ) external view returns (QuestData memory questData) {
        if (!_exists(tokenId)) revert NonexistentToken();

        return quests[tokenId];
    }

    function updateQuestBadgeNum(
        uint256 questId,
        uint256 badgeNum
    ) external onlyMinter {
        if (!_exists(questId)) revert NonexistentToken();

        questBadgeNum[questId] = badgeNum;
        emit QuestBadgeNumUpdate(questId, badgeNum);
    }

    function getQuestBadgeNum(uint256 questId) external view returns (uint256) {
        if (!_exists(questId)) revert NonexistentToken();

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

    function donate(uint256 questId) external payable {
        address creator = ownerOf(questId);

        payable(creator).transfer(msg.value);
        emit Donation(msg.sender, creator, msg.value);
    }
}
