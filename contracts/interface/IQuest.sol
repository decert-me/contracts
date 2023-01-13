//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IQuest is IERC721Upgradeable {
    struct QuestData {
        uint32 startTs;
        uint32 endTs;
        uint192 supply;
        string title;
        string uri;
    }

    function setMinter(address minter, bool enabled) external;

    function mint(
        address to,
        uint256 tokenId,
        QuestData calldata questData,
        bytes memory data
    ) external;

    function getQuest(uint256 tokenId)
        external
        returns (QuestData memory questData);

    function updateURI(uint256 tokenId, string calldata uri) external;
}
