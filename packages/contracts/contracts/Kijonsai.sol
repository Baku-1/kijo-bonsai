// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Kijonsai is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin, address minter) ERC721("Kijonsai", "KIJO") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function mintKijonsai(address to, uint256 tokenId, string calldata uri)
        external onlyRole(MINTER_ROLE)
    {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function updateMetadata(uint256 tokenId, string calldata uri)
        external onlyRole(MINTER_ROLE)
    {
        _requireOwned(tokenId);
        _setTokenURI(tokenId, uri);
    }

    function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId)
        external onlyRole(MINTER_ROLE)
    {
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, AccessControl) returns (bool)
    {
        return interfaceId == 0x49064906 || super.supportsInterface(interfaceId);
    }
}
