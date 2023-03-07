//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBadge {
    function exists(uint256 _id) external view returns (bool);

    function setCustomURI(uint256 _tokenId, string memory _newURI) external;

    function tokenSupply(uint256 _tokenId) external view returns (uint256);

    function create(
        address _initialOwner,
        uint256 _id,
        uint256 _initialSupply,
        string memory _uri,
        bytes memory _data
    ) external returns (uint256);

    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data
    ) external;

    function updateScore(address _to, uint256 _tokenId, uint256 _score) external;
}
