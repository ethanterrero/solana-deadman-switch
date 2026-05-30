/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/deadman_switch.json`.
 */
export type DeadmanSwitch = {
  "address": "6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu",
  "metadata": {
    "name": "deadmanSwitch",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancel",
      "discriminator": [
        232,
        219,
        223,
        41,
        219,
        236,
        220,
        190
      ],
      "accounts": [
        {
          "name": "switch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "switch"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "checkIn",
      "discriminator": [
        209,
        253,
        4,
        217,
        250,
        241,
        207,
        50
      ],
      "accounts": [
        {
          "name": "switch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "switch"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "switch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "switch.owner",
                "account": "switch"
              }
            ]
          }
        },
        {
          "name": "beneficiary",
          "writable": true,
          "signer": true,
          "relations": [
            "switch"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "switch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "switch"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "switch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "beneficiary",
          "type": "pubkey"
        },
        {
          "name": "interval",
          "type": "i64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "switch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  105,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "switch"
          ]
        }
      ],
      "args": [
        {
          "name": "newBeneficiary",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newInterval",
          "type": {
            "option": "i64"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "switch",
      "discriminator": [
        242,
        175,
        214,
        214,
        230,
        53,
        61,
        158
      ]
    }
  ],
  "events": [
    {
      "name": "cancelled",
      "discriminator": [
        136,
        23,
        42,
        65,
        143,
        233,
        234,
        46
      ]
    },
    {
      "name": "checkedIn",
      "discriminator": [
        211,
        80,
        198,
        244,
        196,
        84,
        212,
        150
      ]
    },
    {
      "name": "claimed",
      "discriminator": [
        217,
        192,
        123,
        72,
        108,
        150,
        248,
        33
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "deposited",
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ]
    },
    {
      "name": "switchInitialized",
      "discriminator": [
        134,
        59,
        228,
        132,
        128,
        185,
        32,
        114
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "stillActive",
      "msg": "Owner is still active; the check-in interval has not elapsed"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Signer is not authorized for this action"
    },
    {
      "code": 6002,
      "name": "invalidInterval",
      "msg": "Interval must be greater than zero"
    },
    {
      "code": 6003,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6004,
      "name": "invalidBeneficiary",
      "msg": "Beneficiary must differ from the owner"
    }
  ],
  "types": [
    {
      "name": "cancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "checkedIn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "lastCheckin",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "claimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "interval",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "deposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "total",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "switch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "lastCheckin",
            "type": "i64"
          },
          {
            "name": "interval",
            "type": "i64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "switchInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "interval",
            "type": "i64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "lastCheckin",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
