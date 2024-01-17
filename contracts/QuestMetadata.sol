//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";
import "./interface/IQuest.sol";
import "./interface/IMetadata.sol";

contract QuestMetadata is IMetadata {
    error NonexistentTokenUri();

    IQuest immutable quest;

    constructor(address quests_) {
        quest = IQuest(quests_);
    }

    function tokenURI(
        uint256 tokenId
    ) external view override returns (string memory) {
        if (!quest.exists(tokenId)) revert NonexistentTokenUri();

        return generateTokenUri(tokenId);
    }

    function generateTokenUri(
        uint256 tokenId
    ) internal view returns (string memory) {
        string memory svg = generateSVGBase64(generateSVG(tokenId));

        bytes memory dataURI = abi.encodePacked(
            "{",
            '"name": "DecertQuest',
            '",',
            '"description": "",',
            '"image": "',
            svg,
            '",',
            '"external_uri": "',
            "https://decert.me/quests/",
            Strings.toString(tokenId),
            '"'
            "}"
        );

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(dataURI)
                )
            );
    }

    function generateSVGBase64(
        string memory svgFormat
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "data:image/svg+xml;base64,",
                    Base64.encode(bytes(svgFormat))
                )
            );
    }

    function generateSVG(
        uint256 tokenId
    ) internal view returns (string memory) {
        IQuest.QuestData memory questData = quest.getQuest(tokenId);
        string memory title = questData.title;
        string memory uri = questData.uri;

        return
            string(
                abi.encodePacked(
                    '<svg width="440px" height="330px" viewBox="0 0 440 330" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><title>group</title><defs><rect id="path-1" x="0" y="0" width="440" height="330"></rect><rect id="path-3" x="0" y="0" width="440" height="330"></rect></defs><g id="page1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">',
                    '<mask id="mask-2" fill="white"><use xlink:href="#path-1"></use></mask><use id="rectangle" fill="#831FEF" xlink:href="#path-1"></use><mask id="mask-4" fill="white"><use xlink:href="#path-3"></use></mask><use id="rectangle" fill="#831FEF" xlink:href="#path-3"></use>',
                    '<circle id="circular" fill="#FFFFFF" opacity="0.0999348958" mask="url(#mask-4)" cx="91" cy="86" r="322"></circle><circle id="circular" fill="#FFFFFF" opacity="0.0999348958" mask="url(#mask-4)" cx="91" cy="86" r="241"></circle>',
                    '<circle id="circular" fill="#FFFFFF" opacity="0.0999348958" mask="url(#mask-4)" cx="91" cy="86" r="178"></circle><circle id="circular" fill="#FFFFFF" opacity="0.0999348958" mask="url(#mask-4)" cx="91" cy="86" r="128"></circle>',
                    '<circle id="circular" fill="#FFFFFF" opacity="0.0999348958" mask="url(#mask-4)" cx="91" cy="86" r="95"></circle><circle id="circular" fill="#FFFFFF" opacity="0.199935" mask="url(#mask-4)" cx="91" cy="86" r="58"></circle>',
                    '<rect id="rectangle" fill="#FFFFFF" mask="url(#mask-4)" x="307" y="19" width="114" height="36" rx="17.5263158"></rect><text id="Decert.me" mask="url(#mask-4)" font-family="PingFangSC-Semibold, PingFang SC" font-size="18" font-weight="500" fill="#8E32F2"><tspan x="321" y="43">Decert.me</tspan></text>',
                    '<text id="title" mask="url(#mask-4)" font-family="PingFangSC-Semibold, PingFang SC" font-size="26" font-weight="500" fill="#FFFFFF"><tspan x="33" y="97">',
                    title,
                    '</tspan> </text><text id="ipfs" mask="url(#mask-4)" font-family="PingFangSC-Semibold, PingFang SC" font-size="16" font-weight="500" fill="#FFFFFF"><tspan x="33" y="142">IPFS:</tspan></text>',
                    '<text id="ipfs-value" opacity="0.8" mask="url(#mask-4)" font-family="PingFangSC-Regular, PingFang SC" font-size="11" font-weight="normal" fill="#FFFFFF"><tspan x="33" y="161">',
                    uri,
                    '</tspan></text></g></svg>'
                )
            );
    }
}
