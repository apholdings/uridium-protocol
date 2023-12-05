// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract SharedTypes {

    enum ProposalStatus {
        Pending, // Proposal is created and pending for voting
        Active,  // Proposal is currently being voted on
        Succeeded, // Proposal has passed the voting
        Failed,   // Proposal has failed to pass the voting
        Executed  // Proposal has been executed after passing
    }

    struct Proposal {
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
}