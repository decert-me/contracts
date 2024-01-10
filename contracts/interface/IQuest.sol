//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IQuest is IERC721 {
    struct QuestData {
        uint32 startTs;
        uint32 endTs;
        string title;
        string uri;
    }

    function setMinter(address minter, bool enabled) external;

    function mint(
        address to,
        QuestData calldata questData,
        bytes memory data
    ) external;

    function getQuest(
        uint256 tokenId
    ) external view returns (QuestData memory questData);

    function modifyQuest(
        uint256 tokenId,
        QuestData calldata questData
    ) external;

    function exists(uint256 tokenId) external view returns (bool);
}
