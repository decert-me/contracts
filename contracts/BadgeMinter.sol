//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IBadge.sol";

contract BadgeMinter is Ownable {
    error NotInTime();
    error InvalidSigner();
    error NotCreator();
    error InvalidArray();
    error NotOwner();

    using ECDSA for bytes32;

    IBadge public badge; // TODO: immutable

    uint256 public startTokenId; //TODO: delete
    address public signer;

    event SignerChanged(address signer);
    event Airdroped(uint256 indexed questId, address indexed to, string uri);
    event Donation(address from, address to, uint256 amount);

    constructor(address badge_) {
        badge = IBadge(badge_);
        signer = msg.sender;
    }

    function setSigner(address signer_) external onlyOwner {
        signer = signer_;
        emit SignerChanged(signer_);
    }

    function claim(
        address to,
        uint256 questId,
        string memory uri,
        bytes calldata signature
    ) external payable {
        bytes32 hash = keccak256(
            abi.encodePacked(
                block.chainid,
                to,
                questId,
                uri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        badge.claim(to, questId, uri);
    }

    function updateURI(
        uint tokenId,
        string memory uri,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(
            abi.encodePacked(tokenId, uri, address(this), address(msg.sender))
        );
        if (!_verify(hash, signature)) revert InvalidSigner();
        if (badge.ownerOf(tokenId) != msg.sender) revert NotOwner();

        badge.updateURI(tokenId, uri);
    }

    function airdropBadge(
        uint256[] calldata questIds,
        address[] calldata receivers,
        string[] calldata uris,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(
            abi.encodePacked(
                block.chainid,
                questIds,
                receivers,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        uint256 numOfReceivers = receivers.length;
        if (numOfReceivers == 0 || numOfReceivers != questIds.length) {
            revert InvalidArray();
        }
        for (uint256 i = 0; i < numOfReceivers; i++) {
            address receiver = receivers[i];
            uint questId = questIds[i];
            string memory uri = uris[i];

            badge.claim(receiver, questId, uri);
            emit Airdroped(questId, receiver, uri);
        }
    }

    function _verify(
        bytes32 hash,
        bytes calldata signature
    ) internal view returns (bool) {
        return (_recover(hash, signature) == signer);
    }

    function _recover(
        bytes32 msgHash,
        bytes calldata signature
    ) internal pure returns (address) {
        return msgHash.toEthSignedMessageHash().recover(signature);
    }
}
