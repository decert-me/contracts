//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IBadge is IERC721 {
    function setMinter(address minter, bool enabled) external;

    function claim(address to, uint256 questId, string memory uri) external;

    function totalSupply() external view returns (uint256);

    function updateURI(uint tokenId, string memory uri) external;
}
