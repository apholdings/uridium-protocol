// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;


interface VatLike {
    function move(address,address,uint) external;
}
interface GemLike {
    function move(address,address,uint) external;
    function burn(address,uint) external;
}

/*
   This thing lets you sell some dai in return for gems.
 - `lot` dai in return for bid
 - `bid` gems paid
 - `ttl` single bid lifetime
 - `beg` minimum bid increase
 - `end` max auction duration
*/

contract Flapper {
    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address usr) external auth { wards[usr] = 1; }
    function deny(address usr) external auth { wards[usr] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "Flapper/not-authorized");
        _;
    }

    // --- Data ---
    struct Bid {
        uint256 bid;  // gems paid               [wad]
        uint256 lot;  // dai in return for bid   [rad]
        address guy;  // high bidder
        uint48  tic;  // bid expiry time         [unix epoch time]
        uint48  end;  // auction expiry time     [unix epoch time]
    }

    mapping (uint => Bid) public bids;

    VatLike  public   vat;  // CDP Engine
    GemLike  public   gem;

    uint256  constant ONE = 1.00E18;
    uint256  public   beg = 1.05E18;  // 5% minimum bid increase
    uint48   public   ttl = 3 hours;  // 3 hours bid duration         [seconds]
    uint48   public   tau = 2 days;   // 2 days total auction length  [seconds]
    uint256  public kicks = 0;
    uint256  public live;  // Active Flag
    uint256  public lid;   // max dai to be in auction at one time  [rad]
    uint256  public fill;  // current dai in auction                [rad]

    // --- Events ---
    event Kick(
      uint256 id,
      uint256 lot,
      uint256 bid
    );

    // --- Init ---
    constructor(address vat_, address gem_) {
        wards[msg.sender] = 1;
        vat = VatLike(vat_);
        gem = GemLike(gem_);
        live = 1;
    }

    // --- Math ---
    function add(uint48 x, uint48 y) internal pure returns (uint48 z) {
        require((z = x + y) >= x);
    }
    function add256(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x);
    }
    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x);
    }
    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x);
    }

    // --- Admin ---
    function file(bytes32 what, uint data) external auth {
        if (what == "beg") beg = data;
        else if (what == "ttl") ttl = uint48(data);
        else if (what == "tau") tau = uint48(data);
        else if (what == "lid") lid = data;
        else revert("Flapper/file-unrecognized-param");
    }

    // --- Auction ---
    function kick(uint lot, uint bid) external auth returns (uint id) {
        require(live == 1, "Flapper/not-live");
        require(kicks < type(uint256).max, "Flapper/overflow");
        fill = add256(fill, lot);
        require(fill <= lid, "Flapper/over-lid");
        id = ++kicks;

        bids[id].bid = bid;
        bids[id].lot = lot;
        bids[id].guy = msg.sender;  // configurable??
        bids[id].end = add(uint48(block.timestamp), tau);

        vat.move(msg.sender, address(this), lot);

        emit Kick(id, lot, bid);
    }
    function tick(uint id) external {
        require(bids[id].end < block.timestamp, "Flapper/not-finished");
        require(bids[id].tic == 0, "Flapper/bid-already-placed");
        bids[id].end = add(uint48(block.timestamp), tau);
    }
    function tend(uint id, uint lot, uint bid) external {
        require(live == 1, "Flapper/not-live");
        require(bids[id].guy != address(0), "Flapper/guy-not-set");
        require(bids[id].tic > block.timestamp || bids[id].tic == 0, "Flapper/already-finished-tic");
        require(bids[id].end > block.timestamp, "Flapper/already-finished-end");

        require(lot == bids[id].lot, "Flapper/lot-not-matching");
        require(bid >  bids[id].bid, "Flapper/bid-not-higher");
        require(mul(bid, ONE) >= mul(beg, bids[id].bid), "Flapper/insufficient-increase");

        if (msg.sender != bids[id].guy) {
            gem.move(msg.sender, bids[id].guy, bids[id].bid);
            bids[id].guy = msg.sender;
        }
        gem.move(msg.sender, address(this), bid - bids[id].bid);

        bids[id].bid = bid;
        bids[id].tic = add(uint48(block.timestamp), ttl);
    }
    function deal(uint id) external {
        require(live == 1, "Flapper/not-live");
        require(bids[id].tic != 0 && (bids[id].tic < block.timestamp || bids[id].end < block.timestamp), "Flapper/not-finished");
        uint256 lot = bids[id].lot;
        vat.move(address(this), bids[id].guy, lot);
        gem.burn(address(this), bids[id].bid);
        delete bids[id];
        fill = sub(fill, lot);
    }

    function cage(uint rad) external auth {
       live = 0;
       vat.move(address(this), msg.sender, rad);
    }
    function yank(uint id) external {
        require(live == 0, "Flapper/still-live");
        require(bids[id].guy != address(0), "Flapper/guy-not-set");
        gem.move(address(this), bids[id].guy, bids[id].bid);
        delete bids[id];
    }
}