// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract SushiBar is ERC20("SushiBar", "xSUSHI") {
    using SafeMath for uint256;
    using Counters for Counters.Counter;
    IERC20 public sushi;
    mapping(address => mapping(uint256 => uint256)) stakedTime;
    Counters.Counter txId;
    event Entered(uint256 txid);

    constructor(IERC20 _sushi) {
        sushi = _sushi;
    }

    function enter(uint256 _amount) public {
        uint256 totalSushi = sushi.balanceOf(address(this));
        uint256 totalShares = totalSupply();
        txId.increment();
        uint256 _txId = txId.current();
        if (totalShares == 0 || totalSushi == 0) {
            _mint(msg.sender, _amount);
        } else {
            uint256 what = _amount.mul(totalShares).div(totalSushi);
            _mint(msg.sender, what);
        }
        sushi.transferFrom(msg.sender, address(this), _amount);
        stakedTime[msg.sender][_txId] = block.timestamp;

        emit Entered(_txId);
    }

    function leave(uint256 _share, uint256 _trxId) public {
        uint256 passedTime = block.timestamp - stakedTime[msg.sender][_trxId];
        require(passedTime >= 2 days, "Can't unstake before 2 days");
        uint256 totalShares = totalSupply();
        uint256 what = _share.mul(sushi.balanceOf(address(this))).div(
            totalShares
        );
        _burn(msg.sender, _share);

        if (passedTime >= 2 days && passedTime < 4 days) {
            sushi.transfer(msg.sender, (what.mul(1).div(4)));
            sushi.transfer(address(this), (what.mul(3).div(4)));
        }

        if (passedTime >= 4 days && passedTime < 6 days) {
            sushi.transfer(msg.sender, (what.mul(1).div(2)));
            sushi.transfer(address(this), (what.mul(1).div(2)));
        }

        if (passedTime >= 6 days && passedTime < 8 days) {
            sushi.transfer(msg.sender, (what.mul(3).div(4)));
            sushi.transfer(address(this), (what.mul(1).div(4)));
        } else {
            sushi.transfer(msg.sender, what);
        }
    }

    function getCurrentTxId() public view returns (uint256) {
        return txId.current();
    }
}
