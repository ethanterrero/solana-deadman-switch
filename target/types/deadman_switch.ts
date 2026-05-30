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
    }
  ],
  "types": [
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
    }
  ]
};
