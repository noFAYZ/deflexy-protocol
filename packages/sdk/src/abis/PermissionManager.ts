export const PermissionManagerAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "profileRegistry",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getGrant",
    "inputs": [
      {
        "name": "profileId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "delegate",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PermissionManager.Grant",
        "components": [
          {
            "name": "mask",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "expiration",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantPermission",
    "inputs": [
      {
        "name": "profileId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "delegate",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "mask",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "expiration",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hasPermission",
    "inputs": [
      {
        "name": "profileId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "capability",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "profiles",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IProfileRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "revokePermission",
    "inputs": [
      {
        "name": "profileId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "delegate",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "PermissionGranted",
    "inputs": [
      {
        "name": "profileId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "delegate",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "mask",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "expiration",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PermissionRevoked",
    "inputs": [
      {
        "name": "profileId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "delegate",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "InvalidDelegate",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidMask",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotProfileOwner",
    "inputs": []
  }
] as const;
