// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SBTBase.sol";
import "./interface/IBadge.sol";
import "./interface/IQuest.sol";

contract Badge is IBadge, SBTBase, Ownable {
    error NonTransferrableERC1155Token();
    error NonApprovableERC1155Token();
    error AlreadyHoldsBadge();
    error NonexistentToken();
    error TokenIdAlreadyExists();
    error NotClaimedYet();
    error QuestIdAlreadyExists();
    error InvalidSigner();

    using ECDSA for bytes32;

    mapping(uint256 => uint256) public scores;
    mapping(uint256 => uint256) public badgeToQuest;
    mapping(uint256 => uint256) _questToBadgeNum; //migrate to quest
    mapping(address => mapping(uint256 => uint256)) addrToQuestToBadge;
    mapping(uint256 => QuestData) public quests;
    mapping(uint256 => string) private _tokenURIs;
    uint256 _totalSupply = 0;
    address public signer;

    event SetMinter(address minter, bool enabled);
    event SignerChanged(address signer);

    constructor() SBTBase("Decert Badge", "Decert") {}

    function setSigner(address signer_) external onlyOwner {
        signer = signer_;
        emit SignerChanged(signer_);
    }

    function claim(address to, uint256 questId, string memory uri) external {
        if (addrToQuestToBadge[to][questId] != 0) {
            revert AlreadyHoldsBadge();
        }

        uint256 tokenId = ++_totalSupply;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        badgeToQuest[tokenId] = questId;
        _questToBadgeNum[questId]++;
        addrToQuestToBadge[to][questId] = tokenId;
    }

    function claimWithScore(
        address to,
        uint256 questId,
        uint256 score,
        string memory uri
    ) external {
        this.claim(to, questId, uri);
        scores[_totalSupply] = score;
    }

    function claimWithCreate(
        address to,
        uint256 questId,
        uint256 score,
        QuestData memory quest,
        string memory uri,
        bytes calldata signature
    ) external {
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
        if (_questToBadgeNum[questId] != 0) revert QuestIdAlreadyExists();

        _create(questId, quest);
        this.claim(to, questId, uri);
        scores[_totalSupply] = score;
    }

    function _create(uint256 questId, QuestData memory quest) internal {
        quests[questId] = quest;
    }

    function updateScore(address to, uint256 questId, uint256 score) external {
        uint badgeId = addrToQuestToBadge[to][questId];

        if (badgeId == 0) {
            revert NotClaimedYet();
        }

        scores[badgeId] = score;
    }

    function getQuestBadgeNum(uint256 questId) external view returns (uint256) {
        return _questToBadgeNum[questId];
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function _setTokenURI(
        uint256 tokenId,
        string memory _tokenURI
    ) internal virtual {
        require(
            _exists(tokenId),
            "ERC721URIStorage: URI set of nonexistent token"
        );
        _tokenURIs[tokenId] = _tokenURI;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert NonexistentToken();

        return _tokenURIs[tokenId];
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
