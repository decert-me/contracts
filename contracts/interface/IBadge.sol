//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBadge {
    struct QuestData {
        uint32 startTs;
        uint32 endTs;
        string title;
    }

    function claim(
        address to,
        uint256 questId,
        string memory uri
    ) external;


    function claimWithScore(
        address to,
        uint256 questId,
        uint256 score,
        string memory uri
    ) external;

    function updateScore(
        address to,
        uint256 questId,
        uint256 score
    ) external;

    function getQuestBadgeNum(uint256 questId) external view returns (uint256);

    function totalSupply() external view returns (uint256);
}
