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
    IBadge public badge;

    uint256 public totalSupply;
    address public meta;

    mapping(address => bool) public minters;
    mapping(uint256 => QuestData) public quests;

    event SetMinter(address minter, bool enabled);
    event QuestCreated(
        address indexed creator,
        uint256 indexed tokenId,
        QuestData questData
    );

    constructor(address badge_) SBTBase("Decert Quest", "DQuest") {
        badge = IBadge(badge_);
    }

    function setMinter(address minter, bool enabled)
        external
        override
        onlyOwner
    {
        require(minter != address(0), "Invalid minter");
        minters[minter] = enabled;
        emit SetMinter(minter, enabled);
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Only minter");
        _;
    }

    function mint(
        address to,
        uint256 tokenId,
        QuestData calldata questData,
        bytes memory data
    ) external override onlyMinter {
        require(badge.exists(tokenId), "None existent token");

        _mint(to, tokenId);
        totalSupply += 1;

        quests[tokenId] = questData;
        emit QuestCreated(to, tokenId, questData);
    }

    function modifyQuest(
        uint256 tokenId,
        QuestData calldata questData
    ) external onlyMinter {
        require(badge.tokenSupply(tokenId) == 0, "Claimed cannot modify");

        quests[tokenId] = questData;
    }

    function getQuest(uint256 tokenId)
        external
        view
        returns (QuestData memory questData)
    {
        return quests[tokenId];
    }

    function updateURI(uint256 tokenId, string calldata uri)
        external
        onlyMinter
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        QuestData storage questData = quests[tokenId];
        questData.uri = uri;
    }

    function setMetaContract(address _meta) external onlyOwner {
        require(_meta != address(0), "zero address");
        meta = _meta;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        return IMetadata(meta).tokenURI(tokenId);
    }
}
