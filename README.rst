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
* `About <./docs/defi/PROTOCOL.rst>`_

For our multi-collateral system, we plan to implement a similar model to MakerDAO, where users can lock their collateral into a smart contract to generate stablecoins. 

This will provide stability to our economy, as well as create a new investment opportunity for users who want to earn interest on their collateral. 


Galerium Module
----------------

Galerium (GALR) will be used as a stablecoin within the Uridium Network. This stablecoin will be pegged to the value of a fiat currency, enabling users to transact with confidence, knowing that the value of their assets is stable. 

**Galerium.sol**
=================
* `GaleriumToken.sol <./docs/defi/NFTMARKETPLACE.rst>`_

This contract is responsible for...

**GaleriumJoin.sol**
=====================
* `GaleriumJoin.sol <./docs/defi/NFTMARKETPLACE.rst>`_

This contract is responsible for...


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
* `Clip.sol <./docs/defi/PROTOCOL.rst>`_

This contract is responsible for clipping a specified amount of collateral from a Vault and generating GALR from it. 

It works by specifying an amount of collateral and a maximum amount of GALR to be generated from that collateral. 

The contract then calculates the minimum amount of collateral required to generate that maximum amount of GALR and clips that amount of collateral from the Vault. 

The resulting GALR is transferred to the caller of the function.


**Dog.sol**
=================
* `Dog.sol <./docs/defi/PROTOCOL.rst>`_

This contract is responsible for managing the liquidation process in the Uridium protocol. 

When a Vault becomes undercollateralized, Dog.sol automatically transfers the collateral from the Vault to the protocol and starts a collateral auction to sell the transferred collateral for GALR. 

The auction uses a Dutch auction format, which settles instantly and allows for flash lending of collateral. The price of the collateral decreases over time, with occasional increases, and can be reset if it falls below a certain level or if too much time has elapsed since the auction started.


**Abacus.sol**
=================
* `Abacus.sol <./docs/defi/PROTOCOL.rst>`_

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
* `Vow.sol <./docs/defi/PROTOCOL.rst>`_

The Vow is the primary contract, which controls the overall stability of the system. The Flop and Flap are auctions for selling off surplus collateral or buying additional collateral, respectively.

**Flop.sol**
=================
* `Flop.sol <./docs/defi/PROTOCOL.rst>`_

The Flop auction contract is used to sell surplus collateral back to the market. The Flop auction begins with an initial bid, and the price gradually decreases over time until the auction ends. The winning bidder receives the surplus collateral in exchange for GALR.

**Flap.sol**
=================
* `Flap.sol <./docs/defi/PROTOCOL.rst>`_

The Flap auction contract is used to buy additional collateral for the system. The Flap auction begins with an initial bid, and the price gradually increases over time until the auction ends. The winning bidder receives GALR in exchange for the additional collateral.

These auction contracts are designed to be market-based mechanisms for adjusting the supply and demand of GALR and collateral in the system. They are used to keep the GALR stable and maintain the value of the collateral.


Oracle Module
----------------

In the Uridium protocol, the Oracle module plays a crucial role in providing reliable and accurate price data for the various assets used in the protocol. It is responsible for updating the prices of these assets on the blockchain, which are then used in various modules for collateralization, liquidation, and other functions.

Similar to the Maker DAO, we will deploy an oracle module for each collateral type, with the OSM and Median contracts being the core components of the Oracle Module. 

**OSM.sol**
=================
* `OSM.sol <./docs/defi/PROTOCOL.rst>`_

The OSM contract (Oracle Security Module) will store the most up-to-date price information for each collateral type and will be used by other modules to determine the value of assets.

**Median.sol**
=================
* `Median.sol <./docs/defi/PROTOCOL.rst>`_

The Median contract, on the other hand, will act as an intermediary between the oracles and the OSM by taking the median of the price feeds from multiple oracles to minimize the risk of an incorrect price being used.


Praedium Module
----------------
Praedium (PDM) will give holders a say in the decisions made by the network. This governance token will be used to vote on proposals to improve the Uridium Network, and to participate in the management of the network’s finances. 

**Praedium.sol**
=================
* `PraediumToken.sol <./docs/defi/PROTOCOL.rst>`_

The Praedium Module contains the Praedium token (PDM), which is an ERC20 token deployed on the Ethereum blockchain. It provides a standard ERC20 token interface with added governance features that allow PDM holders to participate in the decision-making process of the Uridium Protocol.

* Key Functionalities (as defined in the smart contract)
  
  * **mint**: credit tokens at an address whilst simultaneously increasing totalSupply (requires auth).
  * **burn**: debit tokens at an address whilst simultaneously decreasing totalSupply (requires auth).
  * **transfer**: transfers an amount of tokens to a given address, and MUST fire the Transfer event. This SHOULD throw if the message caller’s account balance does not have enough tokens to spend.
  * **approve**: allows _spender to withdraw from your account multiple times, up to the _value amount. If this function is called again it overwrites the current allowance with _value.
  * **increaseAllowance**: increase the amount which _spender is still allowed to withdraw from the caller's account.
  * **decreaseAllowance**: decrease the amount which _spender is still allowed to withdraw from the caller's account.
  * **transferFrom**: transfers an amount of tokens from address _from to address _to, and MUST fire the Transfer event.

* *Key Mechanisms & Concepts*

  * PDM tokens provide governance features for the Uridium Protocol, enabling holders to vote on important decisions such as the addition of new collateral types or changes to the system parameters. PDM holders can stake their tokens in order to vote and earn rewards, providing a mechanism to incentivize participation and community engagement.

  * **Praedium DAO** Praedium DAO is the governance mechanism used to manage the Praedium Protocol. The DAO is a decentralized autonomous organization that is responsible for managing the Praedium Treasury, making decisions related to the addition of new collateral types, and setting system parameters.

* *Failure Modes (Bounds on Operating Conditions & External Risk Factors)*

  * In the event that the Praedium Protocol experiences insolvency or a shortfall in the value of the collateral, the Praedium DAO can autonomously mint new PDM tokens and sell them in exchange for collateral in order to recapitalize the system.

Overall, the Praedium Governance Token is a critical component of the Uridium Protocol, enabling community participation and ensuring the continued stability and growth of the platform.


Governance Module
----------------

**Votes.sol**
=============
* `Voting.sol <./docs/defi/PROTOCOL.rst>`_

This contract is responsible for...

**Disputes.sol**
=================
* `Disputes.sol <./docs/defi/PROTOCOL.rst>`_

This contract is responsible for...


Liquidity Providers
********************

As we discussed earlier, we plan to provide liquidity to our tokens, Praedium (PDM) and Galerium (GALR), through various means. One method we plan to use is through decentralized exchanges (DEXs) like Uniswap and SushiSwap, where users can trade their tokens for other ERC20 tokens or ETH. We also plan to incentivize liquidity providers on these DEXs through yield farming programs, where users can earn rewards in our tokens for providing liquidity to our token pairs on the DEXs.

In addition to DEXs, we also plan to offer staking programs where users can lock up their tokens for a period of time and earn rewards in our tokens. This not only provides liquidity to our tokens, but also incentivizes long-term holding of our tokens by users. We also plan to implement a voting system where users can use their tokens to vote on proposals related to the development and direction of the Uridium Network.

Finally, we plan to conduct airdrops of our tokens to help increase awareness and adoption of the Uridium Network. These airdrops will be targeted towards individuals who have shown an interest in our project, as well as those who actively participate in the ecosystem through activities such as trading, staking, and voting.

Overall, by using a combination of liquidity pools, yield farming, staking, voting, and airdrops, we aim to provide a robust and diverse ecosystem for our tokens, with ample liquidity and opportunities for users to participate and engage with the Uridium Network.


Governance
***********

ISO Standards
**************
* Information security, cybersecurity and privacy protection (ISO 27001:2022)
* Quality management (ISO 9001:2015)
* Risk management (ISO 31000)
* Educational management (ISO 21001:2018)
* Anti-Bribery management (ISO 37001)
* Business continuity management (ISO 22301:2019)
* Energy management (ISO 50001:2018)
* Environmental management systems (ISO 14001:2015)
* Blockchain and distributed ledger technologies (ISO/DIS 22739)
* Governance of organizations (ISO/DIS 37004)

Microservices
**************

Microfrontends
**************
