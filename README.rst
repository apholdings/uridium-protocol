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
* `Contract <./docs/defi/NFTS.rst>`_


NFT Marketplace
-------------

When a student purchases an NFT representing a course, they will gain access to the course content. The NFT will be stored in their digital wallet, and they can access the course content by interacting with the smart contract associated with the NFT.

**NFTMarketplace.sol**
=================
* `Contract <./docs/defi/NFTMARKETPLACE.rst>`_

Ecosystem
**********
* `About <./docs/defi/PROTOCOL.rst>`_

For our multi-collateral system, we plan to implement a similar model to MakerDAO, where users can lock their collateral into a smart contract to generate stablecoins. 

This will provide stability to our economy, as well as create a new investment opportunity for users who want to earn interest on their collateral. 


Galerium Module
----------------

Galerium (GALR) will be used as a stablecoin within the Uridium Network. This stablecoin will be pegged to the value of a fiat currency, enabling users to transact with confidence, knowing that the value of their assets is stable. 

**Galerium.sol**
=============
* `Galerium.sol <./Galerium.rst>`_

This contract is responsible for...

**GaleriumJoin.sol**
=================
* `GaleriumJoin.sol <./GaleriumJoin.rst>`_

This contract is responsible for...

Praedium
-------------
Praedium (PDM) will give holders a say in the decisions made by the network. This governance token will be used to vote on proposals to improve the Uridium Network, and to participate in the management of the network’s finances. 

**Praedium.sol**
=============
* `Praedium.sol <./docs/defi/PROTOCOL.rst>`_

This contract is responsible for...


**Votes.sol**
=============
* `Votes.sol <./docs/defi/PROTOCOL.rst>`_

This contract is responsible for...

**Disputes.sol**
=============
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
* Information Security management (ISO 27001:2022)
* Quality management (ISO 9001:2015)
* Risk management (ISO 31000)
* Educational management (ISO 21001:2018)
* Anti-Bribery management (ISO 37001)

Microservices
**************

Microfrontends
**************
