// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "../../nfts/tickets/ticket.sol";
import "../../nfts/tickets/registry.sol";
import "./types.sol";

/*
    Praetorium: ERC1155-Based DAO Governance System

    This governance mechanism is designed to work with the ERC1155 Uridium protocol,
    leveraging the Ticket.sol contract to grant voting rights to token holders.

    Key Considerations:
    - Security: Prevent double voting by the same token through transfers.
    - Quorum: Establish quorum requirements based on a percentage or a fixed number of tokens.
    - Proposal Submission: Define who can submit proposals and the requirements.
    - Voting Mechanism: Implement a fair and transparent voting process.
    - Execution of Decisions: Ensure only approved proposals are executed.
    - Role Management: Utilize AccessControl for role-based functions.
    - Integration: Seamlessly integrate with existing Uridium contracts.
    - Upgradeability: Consider future improvements and changes.

    Key Components of the Governance System:
    - Proposal Mechanism: Proposers, who have the PROPOSER_ROLE, can create proposals. 
      Each proposal is tied to a specific token ID from the Ticket contract. 
      This token ID represents the "ticket" that grants voting rights for that particular proposal.

    - Voting Rights: Voting rights are based on ownership of a specific ERC1155 token (the ticket). 
      Token holders with the VOTER_ROLE can vote on proposals. The vote function checks if the caller owns 
      the specific ticket ID associated with the proposal they are voting on.

    - Quorum Calculation: Quorum is calculated based on the total supply of the specific token ID associated 
      with the proposal. You've set a quorum percentage (e.g., 20%) to determine the minimum level of 
      participation required for a vote to be valid.

    - Execution of Proposals: Once a proposal's voting period ends, its outcome is determined by the 
      finalizeProposal function. If the proposal meets the quorum and has more for votes than against, 
      it's marked as succeeded; otherwise, it's marked as failed. Successful proposals can be executed with 
      the executeProposal function.
*/

contract TicketGovernance is IERC165, IERC1155Receiver, AccessControl, ReentrancyGuard, Pausable {
    /* 
    /////////////////////////////////
    1. Contract and Role Declarations 
    /////////////////////////////////

        - Define a constant role for the proposer role
        - Define a constant role for the voter role
    */ 
    bytes32 public constant BOOTH_ROLE = keccak256("BOOTH_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant VOTER_ROLE = keccak256("VOTER_ROLE");

    /* 
    /////////////////////////////
    2. Structs and State Variables
    /////////////////////////////
        
        This section declares the state variables and data structures used in the contract.


        - enum ProposalStatus {
            Pending, // Proposal is created and pending for voting
            Active,  // Proposal is currently being voted on
            Succeeded, // Proposal has passed the voting
            Failed,   // Proposal has failed to pass the voting
            Executed  // Proposal has been executed after passing
        }

        - struct Proposal {
            uint256 id;                 // Unique identifier for the proposal
            address proposer;           // Address of the account who proposed
            string description;         // A brief description of what the proposal entails
            uint256 startTime;          // Block timestamp for when the proposal starts
            uint256 endTime;            // Block timestamp for when the proposal ends
            ProposalStatus status;      // Current status of the proposal
            uint256 forVotes;           // Total number of votes in favor
            uint256 againstVotes;       // Total number of votes against
            uint256 tokenId;            // Token ID associated with the proposal
            mapping(uint256 => bool) hasVoted; // Mapping of token IDs to voting status to prevent double voting
        }

        - ticketContract: This is the address of the Ticket contract used in the auctions.

        - _proposalCounter: Counter for tracking proposal IDs.

        - proposals: This is a mapping for the proposal struct.

        - hasVoted: Mapping of proposalId to tokenIds that have voted. // Voting Records

        - totalProposalsCount: Total number of proposals

        - passedProposalsCount: Total number of passed proposals

        - failedProposalsCount: Total number of failed proposals
    */

    Ticket public ticketContract;
    TicketRegistry public ticketRegistryContract;
    uint256 private _proposalCounter;
    mapping(uint256 => SharedTypes.Proposal) public proposals;
    mapping(uint256 => mapping(uint256 => bool)) public hasVoted;
    uint256 public totalProposalsCount;
    uint256 public passedProposalsCount;
    uint256 public failedProposalsCount;

    /* 
    /////////////////////////////
    3. Constructor and Events
    /////////////////////////////

        The constructor initializes the state of the contract with the following parameters:

        - Ticket _ticketContract: This is the ERC20 contract address of the Ticket.sol contract
    */

    constructor(
        Ticket _ticketContract,
        TicketRegistry _ticketRegistryContract
    ) 
    {
        ticketContract = _ticketContract;
        ticketRegistryContract = _ticketRegistryContract;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOOTH_ROLE, msg.sender);
    }

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description, uint256 startTime, uint256 endTime);
    event VotePlaced(uint256 indexed proposalId, uint256 tokenId, bool support);
    event ProposalExecuted(uint256 indexed proposalId);
    event QuorumCalculated(uint256 indexed proposalId);

    /* 
    /////////////////////////////
    4. Role-Based Functionality
    /////////////////////////////

        Group functions by the roles that can call them. 
        For example, all functions that require BOOTH_ROLE should be together.
    */ 

    function calculateQuorum(uint256 proposalId) onlyRole(BOOTH_ROLE) public view returns (bool) {
        SharedTypes.Proposal storage proposal = proposals[proposalId];

        // Quorum percentage (e.g., 20%)
        uint256 quorumPercentage = 20;

        // Get the total supply for the token ID associated with the proposal
        uint256 totalTokenSupply = ticketContract.totalSupply(proposal.tokenId);

        // Calculate the required quorum
        uint256 requiredQuorum = (totalTokenSupply * quorumPercentage) / 100;

        // Check if the for votes meet or exceed the required quorum
        return proposal.forVotes >= requiredQuorum;
    }
    function executeProposal(uint256 proposalId) public onlyRole(BOOTH_ROLE) {
        SharedTypes.Proposal storage proposal = proposals[proposalId];
        require(proposal.status == SharedTypes.ProposalStatus.Succeeded, "Praetorium: Proposal not succeeded");
        require(block.timestamp > proposal.endTime, "Praetorium: Voting period not ended");

        // Execute proposal logic here

        updateProposalStatus(proposalId, SharedTypes.ProposalStatus.Executed);
        emit ProposalExecuted(proposalId);
    }
    function updateProposalStatus(uint256 proposalId, SharedTypes.ProposalStatus newStatus) internal {
        SharedTypes.Proposal storage proposal = proposals[proposalId];
        if (proposal.status != newStatus) {
            if (newStatus == SharedTypes.ProposalStatus.Succeeded) {
                passedProposalsCount++;
            } else if (newStatus == SharedTypes.ProposalStatus.Failed) {
                failedProposalsCount++;
            }
            proposal.status = newStatus;
        }
    }
    function finalizeProposal(uint256 proposalId) public {
        SharedTypes.Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "Praetorium: Voting period not yet ended");

        bool quorumReached = calculateQuorum(proposalId);
        if (quorumReached && proposal.forVotes > proposal.againstVotes) {
            updateProposalStatus(proposalId, SharedTypes.ProposalStatus.Succeeded);
        } else {
            updateProposalStatus(proposalId, SharedTypes.ProposalStatus.Failed);
        }
    }
    function pause() public onlyRole(BOOTH_ROLE) {
        _pause();
    }
    function unpause() public onlyRole(BOOTH_ROLE) {
        _unpause();
    }

    /* 
    /////////////////////////////
    5. Governance methods
    /////////////////////////////
        
        Group together all functions related to voting. 
    */ 

    function createProposal(
        string memory description,
        uint256 startTime, // calculated in seconds 300 = 5 minutes
        uint256 endTime, // calculated in seconds 300 = 5 minutes
        uint256 tokenId
    ) public 
    onlyRole(PROPOSER_ROLE) {
        require(endTime > startTime, "Praetorium: End time must be after start time");

        // Increment proposal ID
        uint256 proposalId = _nextProposalId();
        
        // Create a new proposal
        SharedTypes.Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.description = description;
        newProposal.startTime = startTime;
        newProposal.endTime = endTime;
        newProposal.tokenId = tokenId; // Store the token ID in the proposal
        newProposal.status = SharedTypes.ProposalStatus.Pending;
        newProposal.forVotes = 0;
        newProposal.againstVotes = 0;

        totalProposalsCount++; // Increment total proposals count

        // Emit ProposalCreated event
        emit ProposalCreated(proposalId, msg.sender, description, startTime, endTime);
    }

    function vote(
        uint256 proposalId, 
        uint256 tokenId, 
        bool support,
        uint256 nftId
    ) public 
    isNftOwner(tokenId, nftId)
    onlyRole(VOTER_ROLE) {
        require(proposals[proposalId].startTime <= block.timestamp, "Praetorium: Voting has not started");
        require(proposals[proposalId].endTime >= block.timestamp, "Praetorium: Voting has ended");
        require(!hasVoted[proposalId][tokenId], "Praetorium: Token has already voted");

        hasVoted[proposalId][tokenId] = true;

        if (support) {
            proposals[proposalId].forVotes++;
        } else {
            proposals[proposalId].againstVotes++;
        }

        emit VotePlaced(proposalId, tokenId, support);
    }

    /* 
    /////////////////////////////
    6. Utility methods
    /////////////////////////////
        
        Group all together utility methods
    */ 

    function _nextProposalId() private returns (uint256) {
        return _proposalCounter++;
    }

    function getMaxPages(uint256 limit) public view returns (uint256) {
        return (totalProposalsCount + limit - 1) / limit; // Ceiling division
    }

    
    /* 
    /////////////////////////////
    7. Modifiers
    /////////////////////////////
        
        Group all together your modifiers that might be reused
    */ 

    modifier isNftOwner(uint256 _ticketId, uint256 _nftId) {
        require(ticketContract.balanceOf(msg.sender, _nftId) > 0, "Sender does not own the NFT");
        // require(ticketContract.isApprovedForAll(msg.sender, address(this)), "Contract must be approved to transfer NFT");
        _;
    }

    /* 
    /////////////////////////////
    8. ERC1155 and Interface Implementations
    /////////////////////////////

            Place the ERC1155 token reception and interface support functions at the end.
    */ 

    // Interface to allow receiving ERC1155 tokens.
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    // Interface to allow receiving batch ERC1155 tokens.
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165, AccessControl) returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}