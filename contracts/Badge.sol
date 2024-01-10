// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SBTBase.sol";
import "./interface/IBadge.sol";

contract Badge is IBadge, SBTBase, Ownable {
    error AlreadyHoldsBadge();
    error NonexistentToken();
    error NotClaimedYet();
    error NonexistentQuest();
    error NotInTime();
    error InvalidMinter();
    error OnlyMinter();
    error QuestIdAlreadyExists();
    error InvalidCreator();

    using ECDSA for bytes32;

    mapping(address => bool) public minters;
    mapping(uint256 => uint256) public questBadgeNum;
    mapping(uint256 => string) private _tokenURIs;
    mapping(address => mapping(uint256 => bool)) public addrHoldQuestBadge;
    uint256 public totalSupply;

    event MinterSet(address minter, bool enabled);
    event Claimed(uint256 indexed tokenId, uint256 questId, address receiver);
    event Donation(address from, address to, uint256 amount);
    event URIUpdated(uint indexed tokenId, string uri);

    constructor() SBTBase("Decert Badge", "Decert") {}

    function setMinter(
        address minter,
        bool enabled
    ) external override onlyOwner {
        if (minter == address(0)) revert InvalidMinter();

        minters[minter] = enabled;
        emit MinterSet(minter, enabled);
    }

    modifier onlyMinter() {
        if (!minters[msg.sender]) {
            revert OnlyMinter();
        }
        _;
    }

    function _claim(address to, uint256 questId, string memory uri) internal {
        if (addrHoldQuestBadge[to][questId] == true) revert AlreadyHoldsBadge();

        uint256 tokenId = uint256(
            keccak256(
                abi.encodePacked(
                    block.chainid,
                    address(this),
                    to,
                    block.number,
                    totalSupply
                )
            )
        );
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        totalSupply += 1;
        questBadgeNum[questId]++;
        addrHoldQuestBadge[to][questId] = true;

        emit Claimed(tokenId, questId, to);
    }

    function claim(
        address to,
        uint256 questId,
        string memory uri
    ) external onlyMinter {
        _claim(to, questId, uri);
    }

    function updateURI(uint tokenId, string memory uri) external onlyMinter {
        _setTokenURI(tokenId, uri);
        emit URIUpdated(tokenId, uri);
    }

    function _setTokenURI(
        uint256 tokenId,
        string memory _tokenURI
    ) internal virtual {
        if (!_exists(tokenId)) revert NonexistentToken();

        _tokenURIs[tokenId] = _tokenURI;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert NonexistentToken();

        return _tokenURIs[tokenId];
    }
}
