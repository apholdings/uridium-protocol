Uridium Network (DeFi Protocol)
################################

The *Uridium Network is an open source ecosystem* designed to bring together decentralized finance (DeFi), online education, physical products, digital art ownership, and video gaming. 

Our platform **provides a means for people to access, create, and trade valuable assets in a decentralized way**. 

We built **a set of smart contracts** to support the exchange of digital and physical assets, as well as a **DAO governance token** called Praedium (PDM) *and a stablecoin* called Galerium (GALR) that will be used in our economy.


Marketplace
****************
* `About <./docs/defi/NFTMARKETPLACE.rst>`_

An online platform where sellers can create and sell courses in exchange for Galerium (GALR) stablecoin. 

The courses are represented as NFTs on the Uridium Network, allowing for unique ownership and transfer of each course.

NFT
-------------

Sellers will be able to create a new NFT for each course they create, providing details such as course title, description, level, duration, and any other relevant information. Once the NFT is created, it can be listed on our marketplace for purchase by students.

**NFT.sol**
=================
* `NFT.sol <./docs/defi/NFTS.rst>`_


NFT Marketplace
----------------

When a student purchases an NFT representing a course, they will gain access to the course content. The NFT will be stored in their digital wallet, and they can access the course content by interacting with the smart contract associated with the NFT.

**NFTMarketplace.sol**
======================
* `NFTMarketplace.sol <./docs/defi/NFTMARKETPLACE.rst>`_

Ecosystem
**********
* `About <./docs/praedium/PROTOCOL.rst>`_

For our multi-collateral system, we plan to implement a similar model to MakerDAO, where users can lock their collateral into a smart contract to generate stablecoins. 

This will provide stability to our economy, as well as create a new investment opportunity for users who want to earn interest on their collateral. 


Galerium Module
----------------

The GaleriumToken module in the Uridium protocol is the ERC20 token that represents the stablecoin Galerium (PDM).

**Galerium.sol**
=================
* `GaleriumToken.sol <./docs/defi/NFTMARKETPLACE.rst>`_

The GaleriumToken contract is similar to the Dai contract in the MakerDAO system, which maintains accounting for external Galerium balances. The key functionalities of the GaleriumToken contract include minting, burning, transferring, and allowing approvals for transfers based on signed messages.

**GaleriumJoin.sol**
=====================
* `GaleriumJoin.sol <./docs/defi/NFTMARKETPLACE.rst>`_

The GaleriumJoin contract is similar to the DaiJoin contract, which allows users to withdraw their Galerium from the system into a standard ERC20 token. The GaleriumJoin contract is designed to allow the Galerium token to be joined to the Praedium Vat.


Core Module
----------------

The core module is the foundation of our decentralized platform and implements the core smart contracts that enable the functioning of our ecosystem. 

It consists of two key contracts: Vat.sol and Spot.sol.

**Vat.sol**
=============
* `Vat.sol <./docs/defi/NFTMARKETPLACE.rst>`_

Vat.sol is responsible for storing the state of the system and tracking user balances, debt positions, and collateral positions. 

The Vat.sol contract also maintains a ledger of all transactions and manages the issuance and burning of our stablecoin, GALR. It interacts with all other modules of our platform, allowing the system to accurately assess risk and maintain stability.

**Spot.sol**
=================
* `Spot.sol <./docs/defi/NFTMARKETPLACE.rst>`_

Spot.sol is responsible for calculating the price of our stablecoin, GALR, based on the value of the underlying collateral in the system. It also manages the liquidation of debt positions when the value of the underlying collateral falls below a certain threshold. This is important to maintain the stability of the system and prevent the emergence of any systemic risks.


Collateral Module
------------------

The Collateral Module is a key component of the Uridium Network's ecosystem. It is responsible for managing the adapters and auction contracts for each specific collateral type. Similar to the Collateral Module in MakerDAO's system, it contains a join contract (join.sol) and a clip contract (clip.sol) for each new collateral type added to the Vat.

**Join.sol**
=================
The join contract (join.sol) allows standard ERC20 tokens to be deposited for use with the system.

* `Join.sol <./docs/defi/NFTMARKETPLACE.rst>`_

**Join.sol** has three variations: GemJoin, ETHJoin, and GalrJoin. GemJoin allows ERC20 tokens to be deposited, ETHJoin allows native Ether to be used, and GalrJoin allows users to withdraw their GALR from the system. Each variation of Join.sol is created specifically to allow the given token type to be join'ed to the Vat, and therefore, each contract has slightly different logic to account for the different types of tokens within the system.


**Clip.sol**
=================
The clip contract (clip.sol) allows users to enter auctions for a specific collateral type.

* `Clip.sol <./docs/defi/NFTMARKETPLACE.rst>`_


**Clip.sol**, on the other hand, is responsible for managing auctions of collateral in the case of a liquidation event. Specifically, it allows users to purchase collateral from the Vat by bidding on lots of the collateral. The lots are initially priced at a discount to incentivize bidders, but as the auction progresses, the discount decreases. If the lot is not purchased, it is passed to the next auction with a slightly lower price, and this process continues until the lot is sold. 

clip.sol has been designed to ensure that liquidations are conducted in a fair and efficient manner.

By using the Collateral Module, the Uridium Network can support a wide variety of collateral types, allowing users to interact with the system using their preferred tokens. This flexibility is key to the success of our ecosystem and will ensure that users have the freedom to choose which assets they wish to use as collateral.


Liquidation Module
-------------------
In the context of the Uridium protocol, a liquidation is the automatic transfer of collateral from an insufficiently collateralized Vault, along with the transfer of that Vault’s debt to the protocol. In the liquidation contract, an auction is started promptly to sell the transferred collateral for Galerium stablecoins in an attempt to cancel out the debt now assigned to the protocol. This is achieved using our Collateral Auction House, which is based on the Liquidation System 2.0 used by MakerDAO.

**Features**
=============

* Instant Settlement
   
   * **Dutch Auctions**: They work according to a price calculated from the initial price and the time elapsed since the auction began. The lack of a lock-up period mitigates much of the price volatility risk for auction participants and allows for faster capital recycling.

* Flash Lending of Collateral

This feature, enabled by instant settlement, eliminates any capital requirement for bidders (excepting gas) — in the sense that even a participant with zero Galerium (and nothing to trade for Galerium) could still purchase from an auction by directing the sale of the auction's collateral into other protocols in exchange for Galerium.

Thus, all Galerium liquidity available across DeFi can be used by any participant to purchase collateral, subject only to gas requirements. The exact mechanics are discussed above, but essentially a participant needs to specify a contract which (conforms to a particular interface), and calldata to supply to it, and the auction contract will automatically invoke whatever logic is in the external contract.

* Price as a Function of Time
   
   * **Price-versus-time curves** are specified through an interface that treats price at the current time as a function of the initial price of an auction and the time at which that price was set.

How to determine the most effective price curve for a given collateral is still an active area of research. This module is configurable and can be replaced in the course of innovation.

* Improved Keeper Wallet Security
   
   * If keepers decide to use the clipperCallee pattern, then they need not store Galerium or collateral on that account. 

This means a keeper need only hold enough ETH to execute transactions that can orchestrate the Clipper.take call, sending collateral to a contract that returns Galerium to the msg.sender to pay for the collateral all in one transaction. The contract implementing the clipperCallee interface can send any remaining collateral or Galerium beyond owe to a cold wallet address inaccessible to the keeper.


**Clip.sol**
=================
* `Clip.sol <./docs/praedium/PROTOCOL.rst>`_

This contract is responsible for clipping a specified amount of collateral from a Vault and generating GALR from it. 

It works by specifying an amount of collateral and a maximum amount of GALR to be generated from that collateral. 

The contract then calculates the minimum amount of collateral required to generate that maximum amount of GALR and clips that amount of collateral from the Vault. 

The resulting GALR is transferred to the caller of the function.


**Dog.sol**
=================
* `Dog.sol <./docs/praedium/PROTOCOL.rst>`_

This contract is responsible for managing the liquidation process in the Uridium protocol. 

When a Vault becomes undercollateralized, Dog.sol automatically transfers the collateral from the Vault to the protocol and starts a collateral auction to sell the transferred collateral for GALR. 

The auction uses a Dutch auction format, which settles instantly and allows for flash lending of collateral. The price of the collateral decreases over time, with occasional increases, and can be reset if it falls below a certain level or if too much time has elapsed since the auction started.


**Abacus.sol**
=================
* `Abacus.sol <./docs/praedium/PROTOCOL.rst>`_

This contract is responsible for calculating the current price of collateral in the Uridium protocol. 

It does so by taking the current price of the collateral as reported by an Oracle and adjusting it based on a configurable buffer parameter. 

The buffer parameter allows the price to be adjusted to account for market volatility and other factors. 

The resulting price is used to determine the amount of collateral to be clipped from a Vault during liquidation, as well as the price of collateral in the collateral auction.



System Stabilizer Module
-------------------------

The System Stabilizer Module, also known as the Vow, is responsible for stabilizing the Maker Protocol by governing the mechanisms for minting and burning the stablecoin GALR. 

The Vow can create new GALR by minting it in exchange for collateral, or it can burn existing GALR by redeeming it for collateral. 

These actions are designed to keep the GALR price stable and protect the value of the collateral.

*The System Stabilizer Module consists of three contracts: *

* the Vow, 
  
* the Flop, 
  
* the Flap. 


**Vow.sol**
=================
* `Vow.sol <./docs/praedium/PROTOCOL.rst>`_

The Vow is the primary contract, which controls the overall stability of the system. The Flop and Flap are auctions for selling off surplus collateral or buying additional collateral, respectively.

**Flop.sol**
=================
* `Flop.sol <./docs/praedium/PROTOCOL.rst>`_

The Flop auction contract is used to sell surplus collateral back to the market. The Flop auction begins with an initial bid, and the price gradually decreases over time until the auction ends. The winning bidder receives the surplus collateral in exchange for GALR.

**Flap.sol**
=================
* `Flap.sol <./docs/praedium/PROTOCOL.rst>`_

The Flap auction contract is used to buy additional collateral for the system. The Flap auction begins with an initial bid, and the price gradually increases over time until the auction ends. The winning bidder receives GALR in exchange for the additional collateral.

These auction contracts are designed to be market-based mechanisms for adjusting the supply and demand of GALR and collateral in the system. They are used to keep the GALR stable and maintain the value of the collateral.


Oracle Module
----------------

In the Uridium protocol, the Oracle module plays a crucial role in providing reliable and accurate price data for the various assets used in the protocol. It is responsible for updating the prices of these assets on the blockchain, which are then used in various modules for collateralization, liquidation, and other functions.

Similar to the Maker DAO, we will deploy an oracle module for each collateral type, with the OSM and Median contracts being the core components of the Oracle Module. 

**OSM.sol**
=================
* `OSM.sol <./docs/praedium/PROTOCOL.rst>`_

The OSM contract (Oracle Security Module) will store the most up-to-date price information for each collateral type and will be used by other modules to determine the value of assets.

**Median.sol**
=================
* `Median.sol <./docs/praedium/PROTOCOL.rst>`_

The Median contract, on the other hand, will act as an intermediary between the oracles and the OSM by taking the median of the price feeds from multiple oracles to minimize the risk of an incorrect price being used.


Praedium Module
----------------
Praedium (PDM) will give holders a say in the decisions made by the network. This governance token will be used to vote on proposals to improve the Uridium Network, and to participate in the management of the network’s finances. 

**Praedium.sol**
=================
* `PraediumToken.sol <./docs/praedium/PROTOCOL.rst>`_

The Praedium Module contains the Praedium token (PDM), which is an ERC20 token deployed on the Ethereum blockchain. It provides a standard ERC20 token interface with added governance features that allow PDM holders to participate in the decision-making process of the Uridium Protocol.

Key Functionalities (as defined in the smart contract):

* **mint**: credit tokens at an address whilst simultaneously increasing totalSupply (requires auth).

* **burn**: debit tokens at an address whilst simultaneously decreasing totalSupply (requires auth).

* **transfer**: transfers an amount of tokens to a given address, and MUST fire the Transfer event. This SHOULD throw if the message caller’s account balance does not have enough tokens to spend.

* **approve**: allows _spender to withdraw from your account multiple times, up to the _value amount. If this function is called again it overwrites the current allowance with _value.

* **increaseAllowance**: increase the amount which _spender is still allowed to withdraw from the caller's account.

* **decreaseAllowance**: decrease the amount which _spender is still allowed to withdraw from the caller's account.

* **transferFrom**: transfers an amount of tokens from address _from to address _to, and MUST fire the Transfer event.

*Key Mechanisms & Concepts*

* PDM tokens provide governance features for the Uridium Protocol, enabling holders to vote on important decisions such as the addition of new collateral types or changes to the system parameters. PDM holders can stake their tokens in order to vote and earn rewards, providing a mechanism to incentivize participation and community engagement.

* **Praedium DAO** Praedium DAO is the governance mechanism used to manage the Praedium Protocol. The DAO is a decentralized autonomous organization that is responsible for managing the Praedium Treasury, making decisions related to the addition of new collateral types, and setting system parameters.

*Failure Modes (Bounds on Operating Conditions & External Risk Factors)*

* In the event that the Praedium Protocol experiences insolvency or a shortfall in the value of the collateral, the Praedium DAO can autonomously mint new PDM tokens and sell them in exchange for collateral in order to recapitalize the system.

Overall, the Praedium Governance Token is a critical component of the Uridium Protocol, enabling community participation and ensuring the continued stability and growth of the platform.


Governance Module
----------------

In the Uridium protocol, the governance module is responsible for the governance of the system. The governance token is Praedium (PDM), and it is used for voting on proposals that can impact the protocol. The key mechanisms and concepts of the governance module include:

* **Proposal Creation**: Anyone can create a proposal to change the parameters of the Uridium protocol, such as adding or removing collateral types, changing the risk parameters, or modifying the system parameters.

* **Voting**: Once a proposal is created, the PDM token holders can vote on it using their tokens. The voting process follows a snapshot model, where the number of tokens a user has at the snapshot block determines their voting power.

* **Execution**: Once a proposal has received enough votes in favor, it is executed automatically through the smart contract.


**Governance Contracts:**

The key contracts in the governance module are Chief, Pause, and Spell contracts. 

**Chief.sol**
=============
* `Chief.sol <./docs/praedium/PROTOCOL.rst>`_

The Chief contract provides a method to elect a "chief" contract via an approval voting system, similar to MakerDAO. 

**Pause.sol**
=============
* `Pause.sol <./docs/praedium/PROTOCOL.rst>`_

The Pause contract allows authorized users to schedule function calls that can only be executed once a predetermined waiting period has elapsed. 

**Spell.sol**
=============
* `Spell.sol <./docs/praedium/PROTOCOL.rst>`_

The Spell contract is an un-owned object that performs one action or series of atomic actions one time only.

**Gotchas:** Users should be aware of potential sources of user error, such as the need to trust the identity of the contract rather than the address of the contract, and the fact that there is no way to bypass the delay in the Pause contract.


Rates Module
----------------

The Rates module is a fundamental feature of the Uridium Protocol, allowing for the accumulation of stability fees on outstanding loans and interest on savings deposits. 

The mechanism used to perform these accumulation functions is subject to an important constraint: accumulation must be a constant-time operation with respect to the number of loans and the number of savings deposits. 

Otherwise, accumulation events would be very gas-inefficient and might even exceed block gas limits.

Similar to MakerDAO, the solution for both stability fees and the interest rate on savings deposits is to store and update a global "cumulative rate" value (per-asset for stability fees), which can then be multiplied by a normalized loan or deposit amount to give the total debt or deposit amount when needed.

`In Uridium, the two key assets are Praedium (PDM) and Galerium (GALR).` The PDM token is used as collateral for loans, while GALR is used for savings deposits.

Detailed explanations of the two accumulation mechanisms may be found below.

* Stability Fee Accumulation:
  
**Overview:**

The stability fee accumulation in Uridium is similar to that in MakerDAO. The rates for stability fees are set for each asset, and the rate values are stored in a global "cumulative rate" value for each asset, which is updated periodically.

In terms of Uridium Protocol, the Jug contract in MakerDAO's Rates Module can be thought of as the contract responsible for calculating and updating the stability fees. In our system, we can call our version of this contract the PraediumJug contract. 

Similarly, the Pot contract in MakerDAO's Rates Module can be thought of as the contract responsible for tracking and updating the savings rate for the DAI token. In our system, we can call our version of this contract the GaleriumPot contract.

**PradeiumJug.sol**
====================
* `PradeiumJug.sol <./docs/praedium/PROTOCOL.rst>`_

The PraediumJug contract would calculate the stability fees for our protocol's PDM token by utilizing a global cumulative rate that is updated based on a per-second stability fee for each collateral type. 

The contract would also update the debt of each individual vault in the system based on the latest stability fee rate. The contract would have functions for updating the stability fee rates and calculating the stability fees for individual vaults.


**GaleriumPot.sol**
====================
* `GaleriumPot.sol <./docs/praedium/PROTOCOL.rst>`_

The GaleriumPot contract would track and update the savings rate for our protocol's GALR token, similar to how the Pot contract works for DAI in MakerDAO. This contract would maintain a cumulative interest rate parameter that is updated based on a per-second savings rate. The contract would also keep track of individual user balances and be responsible for distributing the savings interest to each user. 

The contract would have functions for updating the savings rate and for depositing and withdrawing GALR tokens from the contract.


Proxy Module
----------------

the Proxy module would also be created to make it easier for users and developers to interact with the protocol. It would contain contract interfaces, proxies, and aliases to functions necessary for managing our NFT marketplace, online courses, and video games.

**DSRManager.sol**
===================
* `DSRManager.sol <./docs/praedium/PROTOCOL.rst>`_

The DSRManager contract would be used to allow service providers to deposit and withdraw GALR into the contract pot, enabling them to start earning the Praedium Savings Rate on a pool of GALR in a single function call. This would be useful for smart contracts integrating DSR functionality in our ecosystem.

**CDPManager.sol**
===================
* `CDPManager.sol <./docs/praedium/PROTOCOL.rst>`_

The CDPManager contract would enable a formalized process for managing Vaults and transferring them between owners in a way that treats them as NFTs. The manager would abstract the Vault usage by a CDPId to make it easier for developers to join collateral to a Vault.


**VoteProxy.sol**
==================
* `VoteProxy.sol <./docs/praedium/PROTOCOL.rst>`_

The VoteProxy contract would facilitate online voting with offline PDM storage. By having a VoteProxy, users would have a linked hot wallet that can pull and push PDM from the proxy’s corresponding cold wallet to DS-Chief, where voting can take place with the online hot wallet. This would allow for two different voting mechanisms and minimize the time that PDM owners need to have their wallet online.

**ProxyActions.sol**
=====================
* `ProxyActions.sol <./docs/praedium/PROTOCOL.rst>`_

The ProxyActions contract would be designed to be used by the Ds-Proxy, which would be owned individually by users to interact more easily with the Uridium Protocol. The DssProxyActions contract would serve as a library for user's ds-proxies, and users would be able to execute functions and parameters via their proxies.

**Sources of Failure:**

Potential sources of user error and failure modes for these contracts in the Uridium Protocol ecosystem would be similar to those described for the Maker Protocol, and would need to be taken into account to ensure the safety and security of our users.

* DSR Manager
* CDP Manager
* Vote Proxy
* Proxy Actions

**Failure Modes** (*Bounds on Operating Conditions & External Risk Factors*)

* Potential Issues around Chain Reorganization
* Vote Proxy
* Proxy Actions


Flash Mint Module
------------------

**Flash.sol**
==================
* `Flash.sol <./docs/praedium/PROTOCOL.rst>`_

We can also implement a Flash module to allow users to mint our stablecoin (Galerium, GALR) up to a limit set by our governance, with the condition that they pay it back in the same transaction with a fee. 

This mechanism would allow users to exploit arbitrage opportunities in the DeFi space without having to commit upfront capital, similar to Maker's Flash module.

The benefits of implementing a Flash module in the Uridium Protocol would include improved market efficiencies for Galerium, democratization of arbitrage, which would allow anyone to participate, quicker discovery of exploits requiring large amounts of capital, and the collection of fees as an income source for the protocol.

The Flash module would have a debt ceiling, which would be the maximum amount of Galerium any single transaction can borrow. It would also have minting fees, which would determine how much additional Galerium must be returned to the Flash module at the end of the transaction, and would be transferred into a vow contract at the end of a successful mint.


Emergency Shutdown Module
--------------------------

The Emergency Shutdown Module (ESM) is a critical component of the Maker Protocol that allows the system to be shut down in the event of an emergency. In Maker, there are two types of emergency shutdown: Global Settlement and Emergency Shutdown for Partners.

Global Settlement is a process that can be initiated in response to a catastrophic event that threatens the stability of the Dai system. When Global Settlement is triggered, all Dai is frozen and the collateral is liquidated to cover all outstanding debt. The frozen Dai is then redeemed for its underlying collateral at a fixed price, which is determined by the Maker Governance community.

Emergency Shutdown for Partners is a process that allows specific partners to shut down their individual Vaults in the event of a localized emergency. This allows the partner to exit their position quickly and limit their potential losses.


**ESM.sol**
==================
* `ESM.sol <./docs/praedium/PROTOCOL.rst>`_

In the case of Uridium Protocol, we would need to adapt the emergency shutdown module to work with our ecosystem, which includes Galerium (GALR) as the stablecoin and Praedium (PDM) as the governance token. We would need to develop a set of emergency shutdown procedures that are tailored to our specific needs and that take into account the unique risks associated with our system.

**End.sol**
==================
* `End.sol <./docs/praedium/PROTOCOL.rst>`_

The End contract is another critical component of the Maker Protocol that allows the system to be shut down. The End contract is responsible for winding down the system by redeeming all outstanding Dai for its underlying collateral at a fixed price. This price is determined by the Maker Governance community and is designed to ensure that all Dai is fully backed by collateral.

In the case of Uridium Protocol, we would need to adapt the End contract to work with our ecosystem, which includes Galerium (GALR) as the stablecoin and Praedium (PDM) as the governance token. We would need to develop a set of procedures that ensure the system can be wound down in a safe and efficient manner in the event of an emergency. These procedures would need to take into account the unique risks associated with our system and ensure that all users are able to exit their positions with minimal losses.


Liquidity Providers
********************

As we discussed earlier, we plan to provide liquidity to our tokens, Praedium (PDM) and Galerium (GALR), through various means. One method we plan to use is through decentralized exchanges (DEXs) like Uniswap and SushiSwap, where users can trade their tokens for other ERC20 tokens or ETH. We also plan to incentivize liquidity providers on these DEXs through yield farming programs, where users can earn rewards in our tokens for providing liquidity to our token pairs on the DEXs.

In addition to DEXs, we also plan to offer staking programs where users can lock up their tokens for a period of time and earn rewards in our tokens. This not only provides liquidity to our tokens, but also incentivizes long-term holding of our tokens by users. We also plan to implement a voting system where users can use their tokens to vote on proposals related to the development and direction of the Uridium Network.

Finally, we plan to conduct airdrops of our tokens to help increase awareness and adoption of the Uridium Network. These airdrops will be targeted towards individuals who have shown an interest in our project, as well as those who actively participate in the ecosystem through activities such as trading, staking, and voting.

Overall, by using a combination of liquidity pools, yield farming, staking, voting, and airdrops, we aim to provide a robust and diverse ecosystem for our tokens, with ample liquidity and opportunities for users to participate and engage with the Uridium Network.


ISO Standards Applied
**********************
* Information security management (`ISO 27002:2022 <https://www.iso.org/standard/75652.html>`_)
* Quality management (`ISO 9001:2015 <https://www.iso.org/standard/62085.html>`_)
* Risk management (`ISO 31000:2018 <https://www.iso.org/standard/65694.html>`_)
* Management systems for educational organizations (`ISO 21001:2018 <https://www.iso.org/standard/66266.html>`_)
* Anti-Bribery management (`ISO 37001:2016 <https://www.iso.org/standard/65034.html>`_)
* Business continuity management (`ISO 22301:2019 <https://www.iso.org/standard/75106.html>`_)
* Energy management (`ISO 50001:2018 <https://www.iso.org/standard/51297.html>`_)
* Environmental management systems (`ISO 14001:2015 <https://www.iso.org/standard/60857.html>`_)
* Blockchain and distributed ledger technologies (`ISO/DIS 22739 <https://www.iso.org/standard/82208.html>`_)
* Governance of organizations (`ISO/DIS 37004 <https://www.iso.org/standard/65037.html>`_)
