//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IBadge.sol";
import "./interface/IQuest.sol";

contract QuestMinter is Ownable {
    error NotInTime();
    error InvalidSigner();
    error NotCreator();
    error NonexistentToken();
    error OverLimit();
    error InvalidArray();

    using ECDSA for bytes32;

    IQuest public quest;
    IBadge public badge;

    uint256 public startTokenId;
    address public signer;

    event Claimed(uint256 indexed tokenId, address indexed sender);
    event SignerChanged(address signer);
    event Donation(address from, address to, uint256 amount);
    event Airdroped(uint256 indexed tokenId, address indexed to);

    constructor(address badge_, address quest_) {
        badge = IBadge(badge_);
        quest = IQuest(quest_);
        signer = msg.sender;

        startTokenId = 10000;
    }

    function setSigner(address signer_) external onlyOwner {
        signer = signer_;
        emit SignerChanged(signer_);
    }

    // add createQuest whitelist

    function createQuest(
        IQuest.QuestData calldata questData,
        bytes calldata signature
    ) external {
        uint32 startTs = questData.startTs;
        uint32 endTs = questData.endTs;
        uint192 supply = questData.supply;
        string memory title = questData.title;
        string memory uri = questData.uri;

        bytes32 hash = keccak256(
            abi.encodePacked(
                startTs,
                endTs,
                supply,
                title,
                uri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) {
            revert InvalidSigner();
        }

        while (badge.exists(startTokenId)) {
            startTokenId += 1;
        }

        badge.create(msg.sender, startTokenId, 0, uri, "0x");
        quest.mint(msg.sender, startTokenId, questData, "0x");

        startTokenId += 1;
    }

    function modifyQuest(
        uint256 tokenId,
        IQuest.QuestData calldata questData,
        bytes calldata signature
    ) external {
        if (quest.ownerOf(tokenId) != msg.sender) {
            revert NotCreator();
        }

        uint32 startTs = questData.startTs;
        uint32 endTs = questData.endTs;
        uint192 supply = questData.supply;
        string memory title = questData.title;
        string memory uri = questData.uri;

        bytes32 hash = keccak256(
            abi.encodePacked(
                tokenId,
                startTs,
                endTs,
                supply,
                title,
                uri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) {
            revert InvalidSigner();
        }

        quest.modifyQuest(tokenId, questData);
    }

    function setBadgeURI(
        uint256 tokenId,
        string memory uri,
        bytes calldata signature
    ) external {
        if (quest.ownerOf(tokenId) != msg.sender) {
            revert NotCreator();
        }

        bytes32 hash = keccak256(
            abi.encodePacked(tokenId, uri, address(badge), address(msg.sender))
        );
        if (!_verify(hash, signature)) {
            revert InvalidSigner();
        }

        quest.updateURI(tokenId, uri);
        badge.setCustomURI(tokenId, uri);
    }

    function claim(
        uint256 tokenId,
        uint256 score,
        bytes calldata signature
    ) external payable {
        IQuest.QuestData memory questData = quest.getQuest(tokenId);
        if (badge.tokenSupply(tokenId) >= questData.supply) {
            revert OverLimit();
        }
        if (
            block.timestamp < questData.startTs ||
            block.timestamp > questData.endTs
        ) {
            revert NotInTime();
        }

        bytes32 hash = keccak256(
            abi.encodePacked(
                "claim",
                tokenId,
                score,
                address(badge),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) {
            revert InvalidSigner();
        }

        badge.mint(msg.sender, tokenId, 1, "0x");

        emit Claimed(tokenId, msg.sender);

        if (msg.value > 0) {
            address creator = quest.ownerOf(tokenId);
            payable(creator).transfer(msg.value);
            emit Donation(msg.sender, creator, msg.value);
        }

        badge.updateScore(msg.sender, tokenId, score);
    }

    function updateScore(
        uint256 tokenId,
        uint256 score,
        bytes calldata signature
    ) external {
        IQuest.QuestData memory questData = quest.getQuest(tokenId);
        if (block.timestamp > questData.endTs) {
            revert NotInTime();
        }

        bytes32 hash = keccak256(
            abi.encodePacked(
                "updateScore",
                tokenId,
                score,
                address(badge),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) {
            revert InvalidSigner();
        }

        badge.updateScore(msg.sender, tokenId, score);
    }

    function airdropBadge(
        uint256[] calldata tokenIds,
        address[] calldata receivers,
        uint256[] calldata scores,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(
            abi.encodePacked(
                "airdropBadge",
                tokenIds,
                address(badge),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) {
            revert InvalidSigner();
        }

        uint256 numOfReceivers = receivers.length;
        if (
            numOfReceivers == 0 ||
            numOfReceivers != tokenIds.length ||
            numOfReceivers != scores.length
        ) {
            revert InvalidArray();
        }

        for (uint256 i = 0; i < numOfReceivers; i++) {
            address receiver = receivers[i];
            uint tokenId = tokenIds[i];
            uint score = scores[i];

            IQuest.QuestData memory questData = quest.getQuest(tokenId);
            if (badge.tokenSupply(tokenId) + 1 > questData.supply) continue;

            if (
                block.timestamp < questData.startTs ||
                block.timestamp > questData.endTs
            ) continue;

            badge.mint(receiver, tokenId, 1, "0x");
            badge.updateScore(receiver, tokenId, score);

            emit Airdroped(tokenId, receiver);
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
