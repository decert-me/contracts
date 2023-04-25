//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IBadge is IERC721 {
    struct QuestData {
        address creator;
        uint32 startTs;
        uint32 endTs;
        string title;
        string uri;
    }

    function setMinter(address minter, bool enabled) external;

    function claim(
        address to,
        uint256 questId,
        string memory uri
    ) external;

    function claimWithInit(
        IBadge.QuestData calldata questData,
        uint256 questId,
        address to,
        string memory uri
    ) external;

    function updateQuest(
        uint256 questId,
        uint32 startTs,
        uint32 endTs,
        string memory title,
        string memory questUri
    ) external;

    function getQuestBadgeNum(uint256 questId) external view returns (uint256);

    function getQuest(uint256 questId) external view returns (QuestData memory);

    function totalSupply() external view returns (uint256);
    
    function updateURI(uint tokenId, string memory uri) external;
}
