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

    IQuest public quest;

    uint256 public startTokenId;
    address public signer;

    event SignerChanged(address signer);

    constructor(address quest_) {
        quest = IQuest(quest_);
        signer = msg.sender;

        startTokenId = 10000;
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
                startTs,
                endTs,
                title,
                uri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        while (quest.exists(startTokenId)) {
            startTokenId += 1;
        }

        quest.mint(msg.sender, startTokenId, questData, "0x");

        startTokenId += 1;
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

    function updateBadgeNum(
        uint256 questId,
        uint256 badgeNum,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(
            abi.encodePacked(
                questId,
                badgeNum,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        quest.updateBadgeNum(questId, badgeNum);
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

    function setStartTokenId(uint256 _startTokenId) external onlyOwner {
        startTokenId = _startTokenId;
    }
}
