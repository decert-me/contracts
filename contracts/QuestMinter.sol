//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IQuest.sol";

contract QuestMinter is Ownable {
    error InvalidSigner();
    error NotCreator();
    error InvalidArray();

    using ECDSA for bytes32;

    IQuest immutable quest;

    address public signer;

    event SignerChanged(address signer);

    constructor(address quest_) {
        quest = IQuest(quest_);
        signer = msg.sender;
    }

    function setSigner(address signer_) external onlyOwner {
        signer = signer_;
        emit SignerChanged(signer_);
    }

    function createQuest(
        IQuest.QuestData calldata questData,
        bytes calldata signature
    ) external {
        uint32 startTs = questData.startTs;
        uint32 endTs = questData.endTs;
        string memory title = questData.title;
        string memory uri = questData.uri;

        bytes32 hash = keccak256(
            abi.encodePacked(
                block.chainid,
                startTs,
                endTs,
                title,
                uri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        quest.mint(msg.sender, questData, "0x");
    }

    function modifyQuest(
        uint256 tokenId,
        IQuest.QuestData calldata questData,
        bytes calldata signature
    ) external {
        if (quest.ownerOf(tokenId) != msg.sender) revert NotCreator();

        uint32 startTs = questData.startTs;
        uint32 endTs = questData.endTs;
        string memory title = questData.title;
        string memory uri = questData.uri;

        bytes32 hash = keccak256(
            abi.encodePacked(
                tokenId,
                startTs,
                endTs,
                title,
                uri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        quest.modifyQuest(tokenId, questData);
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
