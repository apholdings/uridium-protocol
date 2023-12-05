// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract DSNote {
    event LogNote(
        bytes4 indexed sig,
        address indexed usr,
        bytes32 indexed arg1,
        bytes32 indexed arg2,
        bytes data
    ) anonymous;

    modifier note {
        bytes memory _calldata = msg.data;
        bytes4 _sig = msg.sig;
        address _usr = msg.sender;
        assembly {
            // Get the size of the calldata
            let size := calldatasize()

            // Allocate memory for the data
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, and(add(add(size, 32), 31), not(31))))

            // Copy the calldata to memory
            calldatacopy(ptr, 0, size)

            // Log the note event with the calldata and indexed fields
            log4(ptr, add(size, 32), _sig, _usr, calldataload(4), calldataload(36))
        }
        _;
    }
}