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
    using ECDSA for bytes32;

    IBadge public badge;

    uint256 public startTokenId;
    address public signer;

    event SignerChanged(address signer);
    event Airdroped(
        uint256 indexed questId,
        address indexed to,
        uint256 score,
        string uri
    );
    event Donation(address from, address to, uint256 amount);

    constructor(address badge_) {
        badge = IBadge(badge_);
        signer = msg.sender;
    }

    function setSigner(address signer_) external onlyOwner {
        signer = signer_;
        emit SignerChanged(signer_);
    }

    function claimWithCreate(
        IBadge.QuestData calldata questData,
        uint256 questId,
        address to,
        uint256 score,
        string memory uri,
        bytes calldata signature
    ) external payable {
        address creator = questData.creator;
        uint32 startTs = questData.startTs;
        uint32 endTs = questData.endTs;
        string memory title = questData.title;
        string memory questUri = questData.uri;

        bytes32 hash = keccak256(
            abi.encodePacked(
                creator,
                questId,
                startTs,
                endTs,
                title,
                questUri,
                score,
                uri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        IBadge.QuestData memory quest;
        quest.startTs = startTs;
        quest.endTs = endTs;
        quest.title = title;
        quest.uri = questUri;
        badge.claimWithCreate(questData, questId, to, score, uri);

        // TOOD：下面有重复的代码，可以考虑做成独立函数
        if (msg.value > 0) {
            payable(creator).transfer(msg.value);
            emit Donation(msg.sender, creator, msg.value);
        }
    }

    // TODO： score 可以放到uri对应数据结构中
    function claimWithScore(
        address to,
        uint256 questId,
        uint256 score,
        string memory uri,
        bytes calldata signature
    ) external payable {
        bytes32 hash = keccak256(
            abi.encodePacked(
                to,
                questId,
                score,
                uri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        badge.claimWithScore(to, questId, score, uri);
        IBadge.QuestData memory quest;
        quest = badge.getQuest(questId);// TODO: not used if msg.value = 0

        if (msg.value > 0) {
            payable(quest.creator).transfer(msg.value);
            emit Donation(msg.sender, quest.creator, msg.value);
        }
    }

    function updateQuest(
        uint256 questId,
        uint32 startTs,
        uint32 endTs,
        string memory title,
        string memory questUri,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(
            abi.encodePacked(
                questId,
                startTs,
                endTs,
                title,
                questUri,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        badge.updateQuest(questId, startTs, endTs, title, questUri);
    }

    function updateScore(
        address to,
        uint256 questId,
        uint256 score,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(
            abi.encodePacked(
                to,
                questId,
                score,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        badge.updateScore(to, questId, score);
    }

    function airdropBadge(
        uint256[] calldata questIds,
        address[] calldata receivers,
        string[] calldata uris,
        uint256[] calldata scores,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(
            abi.encodePacked(
                "airdropBadge",
                questIds,
                receivers,
                scores,
                address(this),
                address(msg.sender)
            )
        );
        if (!_verify(hash, signature)) revert InvalidSigner();

        uint256 numOfReceivers = receivers.length;
        if (
            numOfReceivers == 0 ||
            numOfReceivers != questIds.length ||
            numOfReceivers != scores.length
        ) {
            revert InvalidArray();
        }
        for (uint256 i = 0; i < numOfReceivers; i++) {
            address receiver = receivers[i];
            uint questId = questIds[i];
            uint score = scores[i];
            string memory uri = uris[i];

            IBadge.QuestData memory questData;
            questData = badge.getQuest(questId);
            if (
                block.timestamp < questData.startTs ||
                block.timestamp > questData.endTs
            ) continue;
            badge.claimWithScore(receiver, questId, score, uri);
            emit Airdroped(questId, receiver, score, uri);
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
