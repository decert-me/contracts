// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interface/IBadge.sol";

contract Badge is IBadge, OwnableUpgradeable, ERC1155Upgradeable {
    mapping(uint256 => address) public creators;
    mapping(uint256 => uint256) private _tokenSupply;
    mapping(uint256 => string) customUri;
    mapping(address => bool) public minters;

    event SetMinter(address minter, bool enabled);

    string public name;
    string public symbol;

    function initialize(string memory uri_) public initializer {
        __Ownable_init();
        __ERC1155_init(uri_);
        name = "Decert Badge";
        symbol = "DBadge";
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Only minter");
        _;
    }

    function setMinter(address minter, bool enabled) external onlyOwner {
        require(minter != address(0), "Invalid minter");
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
    ) internal virtual override(ERC1155Upgradeable) {
        require(
            from == address(0) || to == address(0),
            "NonTransferrableERC1155Token: non-transferrable"
        );
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    /**
     * @notice Block badge approvals
     */
    function setApprovalForAll(address, bool)
        public
        virtual
        override(ERC1155Upgradeable)
    {
        revert("NonApprovableERC1155Token: non-approvable");
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

    function tokenSupply(uint256 tokenId)
        external
        view
        override
        returns (uint256)
    {
        return _tokenSupply[tokenId];
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external override onlyMinter {
        require((balanceOf(to, id) == 0), "Already holds badge");
        require(_exists(id), "None existent token");

        _mint(to, id, amount, data);
        _tokenSupply[id] = _tokenSupply[id] + amount;
    }

    function setCustomURI(uint256 id, string memory newURI)
        external
        override
        onlyMinter
    {
        require(_exists(id), "None existent token");
        customUri[id] = newURI;
        emit URI(newURI, id);
    }

    function uri(uint256 id) public view override returns (string memory) {
        require(_exists(id), "None existent token");
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
        require(!_exists(id), "TokenId already exists");
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
}
