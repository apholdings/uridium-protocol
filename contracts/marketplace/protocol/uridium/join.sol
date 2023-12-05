// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./lib.sol";

abstract contract GemLike {
    function transfer(address,uint) virtual external returns (bool);
    function transferFrom(address,address,uint) virtual external returns (bool);
}

abstract contract DSTokenLike {
    function mint(address,uint) virtual external;
    function burn(address,uint) virtual external;
}

abstract contract VatLike {
    function slip(bytes32,address,int) virtual external;
    function move(address,address,uint) virtual external;
}

/*
    Here we provide *adapters* to connect the Vat to arbitrary external
    token implementations, creating a bounded context for the Vat. The
    adapters here are provided as working examples:
      - `GemJoin`: For well behaved ERC20 tokens, with simple transfer
                   semantics.
      - `ETHJoin`: For native Ether.
      - `GALRJoin`: For connecting internal GALR balances to an external
                   `DSToken` implementation.
    In practice, adapter implementations will be varied and specific to
    individual collateral types, accounting for different transfer
    semantics and token standards.
    Adapters need to implement two basic methods:
      - `join`: enter collateral into the system
      - `exit`: remove collateral from the system
*/

contract GemJoin {

    VatLike public vat;
    bytes32 public ilk;
    GemLike public gem;

    constructor(address vat_, bytes32 ilk_, address gem_) {
        vat = VatLike(vat_);
        ilk = ilk_;
        gem = GemLike(gem_);
    }

    function join(address usr, uint wad) external {
        require(int(wad) >= 0);
        vat.slip(ilk, usr, int(wad));
        require(gem.transferFrom(msg.sender, address(this), wad));
    }

    function exit(address usr, uint wad) external {
        require(wad <= 2 ** 255);
        vat.slip(ilk, msg.sender, -int(wad));
        require(gem.transfer(usr, wad));
    }
}

contract ETHJoin {

    VatLike public vat;
    bytes32 public ilk;

    constructor(address vat_, bytes32 ilk_)  {
        vat = VatLike(vat_);
        ilk = ilk_;
    }

    function join(address usr) external payable  {
        require(int(msg.value) >= 0);
        vat.slip(ilk, usr, int(msg.value));
    }

    function exit(address payable usr, uint wad) external  {
        require(int(wad) >= 0);
        vat.slip(ilk, msg.sender, -int(wad));
        usr.transfer(wad);
    }

}

contract GALRJoin {

    VatLike public vat;
    DSTokenLike public galr;

    constructor(address vat_, address galr_)  {
        vat = VatLike(vat_);
        galr = DSTokenLike(galr_);
    }

    uint constant ONE = 10 ** 27;

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x);
    }

    function join(address usr, uint wad) external  {
        vat.move(address(this), usr, mul(ONE, wad));
        galr.burn(msg.sender, wad);
    }

    function exit(address usr, uint wad) external  {
        vat.move(msg.sender, address(this), mul(ONE, wad));
        galr.mint(usr, wad);
    }

}