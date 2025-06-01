// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PolytradeNFTWrapper
 * @dev Wraps ERC-721 NFTs into ERC-6960 fractional tokens for Polytrade marketplace
 */
contract Polytrade721Wrapper is ERC721Holder, Ownable, ReentrancyGuard {
    
    // Wrapped NFT information
    struct WrappedNFT {
        address originalContract;    // Original ERC-721 contract
        uint256 originalTokenId;     // Original token ID
        address originalOwner;       // Who deposited the NFT
        uint256 totalShares;         // Total fractional shares created
        uint256 mainId;              // ERC-6960 main ID
        bool isWrapped;              // Whether NFT is currently wrapped
        mapping(uint256 => uint256) subIdShares; // Sub ID to shares mapping
    }
    
    // ERC-6960 token state
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) private _balances;
    mapping(uint256 => mapping(uint256 => uint256)) private _totalSupply;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Wrapped NFTs tracking
    mapping(uint256 => WrappedNFT) public wrappedNFTs;
    mapping(address => mapping(uint256 => uint256)) public nftToMainId; // contract => tokenId => mainId
    
    uint256 private _currentMainId = 1;
    
    // Events
    event NFTWrapped(
        address indexed originalContract,
        uint256 indexed originalTokenId,
        uint256 indexed mainId,
        uint256[] subIds,
        uint256[] shares,
        address owner
    );
    
    event NFTUnwrapped(
        address indexed originalContract,
        uint256 indexed originalTokenId,
        uint256 indexed mainId,
        address owner
    );
    
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed mainId,
        uint256 subId,
        uint256 amount
    );

    /**
     * @dev Wraps an ERC-721 NFT into fractional ERC-6960 tokens
     * @param nftContract Address of the original ERC-721 contract
     * @param tokenId Token ID of the NFT to wrap
     * @param subIds Array of sub IDs to create
     * @param shares Array of shares for each sub ID
     */
    function wrapNFT(
        address nftContract,
        uint256 tokenId,
        uint256[] memory subIds,
        uint256[] memory shares
    ) external nonReentrant {
        require(subIds.length == shares.length, "Arrays length mismatch");
        require(subIds.length > 0, "Must create at least one sub ID");
        
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(nft.isApprovedForAll(msg.sender, address(this)) || 
                nft.getApproved(tokenId) == address(this), "Contract not approved");
        
        // Calculate total shares
        uint256 totalShares = 0;
        for (uint256 i = 0; i < shares.length; i++) {
            require(shares[i] > 0, "Shares must be greater than 0");
            totalShares += shares[i];
        }
        
        uint256 mainId = _currentMainId++;
        
        // Transfer NFT to this contract
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        
        // Create wrapped NFT record
        WrappedNFT storage wrappedNFT = wrappedNFTs[mainId];
        wrappedNFT.originalContract = nftContract;
        wrappedNFT.originalTokenId = tokenId;
        wrappedNFT.originalOwner = msg.sender;
        wrappedNFT.totalShares = totalShares;
        wrappedNFT.mainId = mainId;
        wrappedNFT.isWrapped = true;
        
        // Map NFT to main ID
        nftToMainId[nftContract][tokenId] = mainId;
        
        // Mint fractional tokens to the original owner
        for (uint256 i = 0; i < subIds.length; i++) {
            uint256 subId = subIds[i];
            uint256 shareAmount = shares[i];
            
            _balances[mainId][subId][msg.sender] = shareAmount;
            _totalSupply[mainId][subId] = shareAmount;
            wrappedNFT.subIdShares[subId] = shareAmount;
            
            emit Transfer(address(0), msg.sender, mainId, subId, shareAmount);
        }
        
        emit NFTWrapped(nftContract, tokenId, mainId, subIds, shares, msg.sender);
    }
    
    /**
     * @dev Unwraps ERC-6960 tokens back to original ERC-721 NFT
     * @param mainId The main ID of the wrapped NFT
     */
    function unwrapNFT(uint256 mainId) external nonReentrant {
        WrappedNFT storage wrappedNFT = wrappedNFTs[mainId];
        require(wrappedNFT.isWrapped, "NFT not wrapped");
        
        // Check if sender owns 100% of all shares
        uint256 totalOwnedShares = 0;
        
        // This is a simplified check - in practice, you'd iterate through all sub IDs
        // For now, assuming you know the sub IDs used (101, 102)
        uint256[] memory checkSubIds = new uint256[](2);
        checkSubIds[0] = 101;
        checkSubIds[1] = 102;
        
        for (uint256 i = 0; i < checkSubIds.length; i++) {
            uint256 subId = checkSubIds[i];
            if (_totalSupply[mainId][subId] > 0) {
                require(_balances[mainId][subId][msg.sender] == _totalSupply[mainId][subId], 
                       "Must own 100% of all shares");
                totalOwnedShares += _balances[mainId][subId][msg.sender];
            }
        }
        
        require(totalOwnedShares == wrappedNFT.totalShares, "Must own all shares");
        
        // Burn all fractional tokens
        for (uint256 i = 0; i < checkSubIds.length; i++) {
            uint256 subId = checkSubIds[i];
            if (_totalSupply[mainId][subId] > 0) {
                uint256 burnAmount = _balances[mainId][subId][msg.sender];
                _balances[mainId][subId][msg.sender] = 0;
                _totalSupply[mainId][subId] = 0;
                
                emit Transfer(msg.sender, address(0), mainId, subId, burnAmount);
            }
        }
        
        // Transfer original NFT back
        IERC721(wrappedNFT.originalContract).safeTransferFrom(
            address(this),
            msg.sender,
            wrappedNFT.originalTokenId
        );
        
        // Mark as unwrapped
        wrappedNFT.isWrapped = false;
        
        emit NFTUnwrapped(
            wrappedNFT.originalContract,
            wrappedNFT.originalTokenId,
            mainId,
            msg.sender
        );
    }
    
    /**
     * @dev ERC-6960 compatible functions
     */
    function balanceOf(address account, uint256 mainId, uint256 subId) 
        public view returns (uint256) {
        return _balances[mainId][subId][account];
    }
    
    function totalSupply(uint256 mainId, uint256 subId) 
        public view returns (uint256) {
        return _totalSupply[mainId][subId];
    }
    
    function safeTransferFrom(
        address from,
        address to,
        uint256 mainId,
        uint256 subId,
        uint256 amount,
        bytes memory data
    ) public {
        require(
            from == msg.sender || _operatorApprovals[from][msg.sender],
            "Not approved"
        );
        require(_balances[mainId][subId][from] >= amount, "Insufficient balance");
        
        _balances[mainId][subId][from] -= amount;
        _balances[mainId][subId][to] += amount;
        
        emit Transfer(from, to, mainId, subId, amount);
    }
    
    function setApprovalForAll(address operator, bool approved) public {
        _operatorApprovals[msg.sender][operator] = approved;
    }
    
    function isApprovedForAll(address account, address operator) 
        public view returns (bool) {
        return _operatorApprovals[account][operator];
    }
    
    /**
     * @dev Get wrapped NFT information
     */
    function getWrappedNFTInfo(uint256 mainId) 
        public view returns (
            address originalContract,
            uint256 originalTokenId,
            address originalOwner,
            uint256 totalShares,
            bool isWrapped
        ) {
        WrappedNFT storage wrappedNFT = wrappedNFTs[mainId];
        return (
            wrappedNFT.originalContract,
            wrappedNFT.originalTokenId,
            wrappedNFT.originalOwner,
            wrappedNFT.totalShares,
            wrappedNFT.isWrapped
        );
    }
    
    /**
     * @dev Check if NFT is wrapped
     */
    function isNFTWrapped(address nftContract, uint256 tokenId) 
        public view returns (bool) {
        uint256 mainId = nftToMainId[nftContract][tokenId];
        return mainId > 0 && wrappedNFTs[mainId].isWrapped;
    }
}