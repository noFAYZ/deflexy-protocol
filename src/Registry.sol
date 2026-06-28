// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ZeroAddress} from "./utils/Errors.sol";

/// @notice Discovery directory only. Apps/indexers resolve module addresses
/// here. Hardening §3: contracts do NOT consult the Registry for authorization
/// — trusted siblings are wired set-once in each contract. So even a mutable
/// directory cannot redirect fund-moving permissions.
contract Registry is Ownable {
    mapping(bytes32 => address) private _modules;

    event ModuleRegistered(bytes32 indexed id, address indexed module);
    event ModuleUpdated(bytes32 indexed id, address indexed previous, address indexed module);

    error AlreadyRegistered();
    error NotRegistered();
    error NoChange();

    constructor(address owner_) Ownable(owner_) {}

    function registerModule(bytes32 id, address module) external onlyOwner {
        if (module == address(0)) revert ZeroAddress();
        if (_modules[id] != address(0)) revert AlreadyRegistered();
        _modules[id] = module;
        emit ModuleRegistered(id, module);
    }

    function updateModule(bytes32 id, address module) external onlyOwner {
        address prev = _modules[id];
        if (prev == address(0)) revert NotRegistered();
        if (module == address(0)) revert ZeroAddress();
        if (module == prev) revert NoChange();
        _modules[id] = module;
        emit ModuleUpdated(id, prev, module);
    }

    function getModule(bytes32 id) external view returns (address) {
        address m = _modules[id];
        if (m == address(0)) revert NotRegistered();
        return m;
    }

    function isRegistered(bytes32 id) external view returns (bool) {
        return _modules[id] != address(0);
    }
}
