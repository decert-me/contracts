//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interface/IBadge.sol";
import "./interface/IQuest.sol";

contract QuestMinter is Initializable, OwnableUpgradeable {
    using ECDSA for bytes32;

    IQuest public quest;
    IBadge public badge;

    uint256 public startTokenId;
    address public signer;

    mapping(uint256 => mapping(address => bool)) claimed;
    mapping(uint256 => mapping(address => uint256)) public scores;

    event Claimed(uint256 indexed tokenId, address indexed sender);
    event SignerChanged(address signer);
    event Donation(address from, address to, uint256 amount);
    event Airdroped(uint256 indexed tokenId, address indexed to);

    function initialize(address badge_, address quest_) public initializer {
        __Ownable_init();

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
        require(_verify(hash, signature), "Invalid signer");

        while (badge.exists(startTokenId)) {
            startTokenId += 1;
        }

        badge.create(msg.sender, startTokenId, 0, uri, "0x");
        quest.mint(msg.sender, startTokenId, questData, "0x");

        startTokenId += 1;
    }

    // TODO: update title...
    function setBadgeURI(
        uint256 tokenId,
        string memory uri,
        bytes calldata signature
    ) external {
        require(quest.ownerOf(tokenId) == msg.sender, "Not creator");

        bytes32 hash = keccak256(
            abi.encodePacked(tokenId, uri, address(badge), address(msg.sender))
        );
        require(_verify(hash, signature), "Invalid signer");

        quest.updateURI(tokenId, uri);
        badge.setCustomURI(tokenId, uri);
    }

    function claim(uint256 tokenId, uint256 score, bytes calldata signature) external payable {
        require(!claimed[tokenId][msg.sender], "Aleady claimed");// 删除
        require(badge.exists(tokenId), "None existent token");

        IQuest.QuestData memory questData = quest.getQuest(tokenId);
        if (questData.supply > 0)
            require(
                badge.tokenSupply(tokenId) < questData.supply,
                "Over limit"
            );

        require(block.timestamp > questData.startTs, "Not in time");
        if (questData.endTs > 0)
            require(block.timestamp <= questData.endTs, "Not in time");

        bytes32 hash = keccak256(
            abi.encodePacked(tokenId, score, address(badge), address(msg.sender))
        );
        require(_verify(hash, signature), "Invalid signer");

        badge.mint(msg.sender, tokenId, 1, "0x");

        claimed[tokenId][msg.sender] = true;

        emit Claimed(tokenId, msg.sender);

        if (msg.value > 0) {
            address creator = quest.ownerOf(tokenId);
            payable(creator).transfer(msg.value);
            emit Donation(msg.sender, creator, msg.value);
        }

        scores[tokenId][msg.sender] = score; //TODO: migrate to badge
    }

    // TODO: 60%。。
    function updateScore(uint256 tokenId, uint256 score, bytes calldata signature)external{
        require(claimed[tokenId][msg.sender], "not claimed yet");
        
        IQuest.QuestData memory questData = quest.getQuest(tokenId);
        if (questData.endTs > 0)
            require(block.timestamp <= questData.endTs, "Not in time");
            // TODO: if...revert error

        bytes32 hash = keccak256(
            abi.encodePacked(tokenId, score, address(badge), address(msg.sender))
        );
        require(_verify(hash, signature), "Invalid signer");

        scores[tokenId][msg.sender] = score;
    }

    function airdropBadge(
        uint256 tokenId, //TODO: tokenIds
        address[] calldata receivers,
        bytes calldata signature
    ) external {
        bytes32 hash = keccak256(
            abi.encodePacked(
                "airdropBadge",
                tokenId,
                address(badge),
                address(msg.sender)
            )
        );

        require(_verify(hash, signature), "Invalid signer");

        uint256 numOfReceivers = receivers.length;
        require(numOfReceivers > 0, "Invalid receivers");

        IQuest.QuestData memory questData = quest.getQuest(tokenId);
        if (questData.supply > 0) // TODO: big number
            require(
                badge.tokenSupply(tokenId) + numOfReceivers <= questData.supply,
                "Over limit"
            );

        require(block.timestamp > questData.startTs, "Not in time");

        if (questData.endTs > 0)
            require(block.timestamp <= questData.endTs, "Not in time");

        for (uint256 i = 0; i < numOfReceivers; i++) {
            address receiver = receivers[i];
            if(claimed[tokenId][receiver]) {
                continue;
            }

            claimed[tokenId][receiver] = true;

            badge.mint(receiver, tokenId, 1, "0x");

            emit Airdroped(tokenId, receiver);
        }
    }

    function _verify(bytes32 hash, bytes calldata signature)
        internal
        view
        returns (bool)
    {
        return (_recover(hash, signature) == signer);
    }

    function _recover(bytes32 msgHash, bytes calldata signature)
        internal
        pure
        returns (address)
    {
        return msgHash.toEthSignedMessageHash().recover(signature);
    }
}
