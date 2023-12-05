// SPDX-License-Identifier: AGPL-3.0-or-later

/// pot.sol -- GALR Savings Rate

pragma solidity ^0.8.9;

/*
   "Savings Dai" is obtained when Dai is deposited into
   this contract. Each "Savings Dai" accrues Dai interest
   at the "Dai Savings Rate".
   This contract does not implement a user tradeable token
   and is intended to be used with adapters.
         --- `save` your `dai` in the `pot` ---
   - `dsr`: the Dai Savings Rate
   - `pie`: user balance of Savings Dai
   - `join`: start saving some dai
   - `exit`: remove some dai
   - `drip`: perform rate collection
*/