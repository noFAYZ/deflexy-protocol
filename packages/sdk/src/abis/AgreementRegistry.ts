export const AgreementRegistryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "profileRegistry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "jobRegistry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "bidRegistry",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "vaultManager",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "workUnitManager",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "reputationRegistry",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "APPROVAL_WINDOW",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "addWorkUnit",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "sequence",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "metadataCID",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "workUnitId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "agreementCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agreementOfJob",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approveWork",
    "inputs": [
      {
        "name": "workUnitId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "bids",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IBidRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancelWorkUnit",
    "inputs": [
      {
        "name": "workUnitId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimApproval",
    "inputs": [
      {
        "name": "workUnitId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "completeAgreement",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createAgreement",
    "inputs": [
      {
        "name": "jobId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "bidId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "disputeManager",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "disputeView",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "employerProfileId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "freelancerProfileId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "enum AgreementStatus"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "exists",
    "inputs": [
      {
        "name": "agreementId",
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
    "name": "fundVault",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAgreement",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct AgreementRegistry.Agreement",
        "components": [
          {
            "name": "jobId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "bidId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "employerProfileId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "freelancerProfileId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "paymentToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "totalAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "allocated",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "vaultId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "model",
            "type": "uint8",
            "internalType": "enum SettlementModel"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum AgreementStatus"
          },
          {
            "name": "outstandingUnits",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "createdAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "completedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "lastDisputeClearedAt",
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
    "name": "guardian",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "jobs",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IJobRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "markDismissed",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "markDisputed",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
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
    "name": "permissionManager",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IPermissionManager"
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
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reputation",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IReputationRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requestRevision",
    "inputs": [
      {
        "name": "workUnitId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveDispute",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "internalType": "enum DisputeOutcome"
      },
      {
        "name": "freelancerAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "employerRefund",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDisputeManager",
    "inputs": [
      {
        "name": "dm",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setGuardian",
    "inputs": [
      {
        "name": "g",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPaused",
    "inputs": [
      {
        "name": "p",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPermissionManager",
    "inputs": [
      {
        "name": "pm",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settleWorkUnit",
    "inputs": [
      {
        "name": "workUnitId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "startWork",
    "inputs": [
      {
        "name": "workUnitId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "submitWork",
    "inputs": [
      {
        "name": "workUnitId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "submissionCID",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "terminateAgreement",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "vault",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IVaultManager"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "workUnits",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IWorkUnitManager"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AgreementActivated",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgreementCompleted",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgreementCreated",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "jobId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "bidId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgreementDisputeDismissed",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgreementDisputed",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgreementResolved",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "freelancerAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "employerRefund",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgreementTerminated",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DisputeManagerSet",
    "inputs": [
      {
        "name": "disputeManager",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "GuardianSet",
    "inputs": [
      {
        "name": "guardian",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PausedSet",
    "inputs": [
      {
        "name": "paused",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PermissionManagerSet",
    "inputs": [
      {
        "name": "permissionManager",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WorkUnitAdded",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "workUnitId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WorkUnitCancelled",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "workUnitId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WorkUnitSettled",
    "inputs": [
      {
        "name": "agreementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "workUnitId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AgreementExistsForJob",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AgreementNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AllocationExceedsTotal",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadySet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ApprovalWindowNotElapsed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BidNotForJob",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDistribution",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidFixedAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "JobNotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotActive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotCancellable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotDisputeManager",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotDisputed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotEmployer",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotFreelancer",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotGuardian",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotSubmitted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OutstandingUnits",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "Paused",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ProfileNotActive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Underfunded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
