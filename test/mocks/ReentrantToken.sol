// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IReenterTarget {
    function withdraw(address token) external;
    function sweep(address token, address to) external;
}

interface IReenterAgreement {
    function settleWorkUnit(uint256 workUnitId) external;
}

/// @notice Malicious ERC20 that reenters the VaultManager on every transfer,
/// modeling an ERC777-style callback token that governance mistakenly added to
/// the allowlist. Used to prove the reentrancy guard + effects-first ordering
/// hold end-to-end (the single highest-paid Immunefi bug class).
contract ReentrantToken is IERC20 {
    string public name = "Reenter";
    string public symbol = "RE";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public vault;
    uint8 public mode; // 0=off, 1=reenter withdraw, 2=reenter sweep, 3=reenter settle
    address public agree;
    uint256 public reenterWu;
    bool private _entered;

    function setAttack(address v, uint8 m) external {
        vault = v;
        mode = m;
    }

    /// @dev Arm a cross-function reentry into AgreementRegistry.settleWorkUnit
    /// (which is not nonReentrant) during a withdraw transfer.
    function setSettleReenter(address v, address _agree, uint256 wu) external {
        vault = v;
        agree = _agree;
        reenterWu = wu;
        mode = 3;
    }

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
        totalSupply += a;
    }

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        return true;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        _t(msg.sender, to, a);
        return true;
    }

    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        uint256 al = allowance[f][msg.sender];
        require(al >= a, "allow");
        if (al != type(uint256).max) allowance[f][msg.sender] = al - a;
        _t(f, to, a);
        return true;
    }

    function _t(address f, address to, uint256 a) private {
        require(balanceOf[f] >= a, "bal");
        balanceOf[f] -= a;
        balanceOf[to] += a;
        if (mode != 0 && !_entered) {
            _entered = true;
            // Reenter mid-transfer. The guard must make this revert and bubble
            // up, rolling back the whole outer call — no double-spend.
            if (mode == 1) IReenterTarget(vault).withdraw(address(this));
            else if (mode == 2) IReenterTarget(vault).sweep(address(this), f);
            else if (mode == 3) IReenterAgreement(agree).settleWorkUnit(reenterWu);
            _entered = false;
        }
    }
}
