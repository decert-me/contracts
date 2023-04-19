//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBadge {
    struct QuestData {
        uint32 startTs;
        uint32 endTs;
        string title;
        string uri;
    }

    function setMinter(address minter, bool enabled) external;

    function claimWithScore(
        address to,
        uint256 questId,
        uint256 score,
        string memory uri
    ) external;

    function claimWithCreate(
        QuestData calldata questData,
        uint256 questId,
        address to,
        uint256 score,
        string memory uri
    ) external;

    function updateQuest(
        uint256 questId,
        uint32 startTs,
        uint32 endTs,
        string memory title,
        string memory questUri
    ) external;

    function updateScore(address to, uint256 questId, uint256 score) external;

    function getQuestBadgeNum(uint256 questId) external view returns (uint256);

    function getQuest(uint256 questId) external view returns (QuestData memory);

    function totalSupply() external view returns (uint256);
}
