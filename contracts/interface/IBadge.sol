//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBadge {
    function claim(
        address to,
        uint256 questId,
        bytes memory _data
    ) external;


    function claimWithScore(
        address to,
        uint256 questId,
        uint256 score,
        bytes memory _data
    ) external;

    function updateScore(
        address to,
        uint256 questId,
        uint256 score
    ) external;

    function getQuestBadgeNum(uint256 questId) external view returns (uint256);

    function totalSupply() external view returns (uint256);
}
