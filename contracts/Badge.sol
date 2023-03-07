// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "./interface/IBadge.sol";

contract Badge is IBadge, Ownable, ERC1155 {
    error InvalidMinter();
    error OnlyMinter();
    error NonTransferrableERC1155Token();
    error NonApprovableERC1155Token();
    error AlreadyHoldsBadge();
    error NonexistentToken();
    error TokenIdAlreadyExists();
    error NotClaimedYet();

    mapping(uint256 => address) public creators;
    mapping(uint256 => uint256) private _tokenSupply;
    mapping(uint256 => string) customUri;
    mapping(address => bool) public minters;
    mapping(uint256 => mapping(address => uint256)) public scores;

    event SetMinter(address minter, bool enabled);

    string public constant name = "Decert Badge";
    string public constant symbol = "DBadge";

    constructor(string memory uri_) ERC1155(uri_) {}

    modifier onlyMinter() {
        if (!minters[msg.sender]) {
            revert OnlyMinter();
        }
        _;
    }

    function setMinter(address minter, bool enabled) external onlyOwner {
        if (minter == address(0)) {
            revert InvalidMinter();
        }
        minters[minter] = enabled;
        emit SetMinter(minter, enabled);
    }

    /**
     * @notice Block badge transfers
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155) {
        if (!(from == address(0) || to == address(0))) {
            revert NonTransferrableERC1155Token();
        }
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    /**
     * @notice Block badge approvals
     */
    function setApprovalForAll(address, bool) public virtual override(ERC1155) {
        revert NonApprovableERC1155Token();
    }

    function create(
        address creator,
        uint256 id,
        uint256 initialSupply,
        string memory uri_,
        bytes memory data
    ) external override onlyMinter returns (uint256) {
        return _create(creator, id, initialSupply, uri_, data);
    }

    function exists(uint256 tokenId) external view override returns (bool) {
        return _exists(tokenId);
    }

    function tokenSupply(
        uint256 tokenId
    ) external view override returns (uint256) {
        return _tokenSupply[tokenId];
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external override onlyMinter {
        if (balanceOf(to, id) != 0) {
            revert AlreadyHoldsBadge();
        }
        if (!_exists(id)) {
            revert NonexistentToken();
        }
        
        _mint(to, id, amount, data);
        _tokenSupply[id] = _tokenSupply[id] + amount;
    }

    function setCustomURI(
        uint256 id,
        string memory newURI
    ) external override onlyMinter {
        if (!_exists(id)) {
            revert NonexistentToken();
        }
        customUri[id] = newURI;
        emit URI(newURI, id);
    }

    function uri(uint256 id) public view override returns (string memory) {
        if (!_exists(id)) {
            revert NonexistentToken();
        }
        // We have to convert string to bytes to check for existence
        bytes memory customUriBytes = bytes(customUri[id]);
        if (customUriBytes.length > 0) {
            return customUri[id];
        } else {
            return super.uri(id);
        }
    }

    function _create(
        address creator,
        uint256 id,
        uint256 initialSupply,
        string memory uri_,
        bytes memory data
    ) internal returns (uint256) {
        if (_exists(id)) {
            revert TokenIdAlreadyExists();
        }
        creators[id] = creator;

        if (bytes(uri_).length > 0) {
            customUri[id] = uri_;
            emit URI(uri_, id);
        }

        _mint(creator, id, initialSupply, data);

        _tokenSupply[id] = initialSupply;
        return id;
    }

    /**
     * @dev Returns whether the specified token exists by checking to see if it has a creator
     * @param tokenId uint256 ID of the token to query the existence of
     * @return bool whether the token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return creators[tokenId] != address(0);
    }

    function updateScore(
        address to,
        uint256 tokenId,
        uint256 score
    ) external onlyMinter {
        if (balanceOf(to, tokenId) == 0){
            revert NotClaimedYet();
        }

        scores[tokenId][to] = score;
    }
}
