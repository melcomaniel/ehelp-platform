# eGov API Developer Portal — Service Documentation

> Compiled from the eGov API Developer Portal (platforms.e.gov.ph).
> Credentials, secrets, tokens and API keys are intentionally omitted — only their required placeholders (e.g. \`{{partner_secret}}\`, \`{{apiKey}}\`) are shown.
> Base URLs shown are the staging/hackathon environments configured in the portal.

## Catalog Overview

| # | Service | Category | Description |
|---|---------|----------|-------------|
| 1 | eGov SSO | Single sign-on | Single Sign-On integration for eGov partners. |
| 2 | eVerify | Identity verification | Verify citizen identity against PhilSys in real time, with consent built into every check. |
| 3 | eMessage | Notifications | Deliver SMS, email and in-app notices to citizens through a single messaging API. |
| 4 | eGov AI | AI services | Document intelligence, translation and conversational endpoints tuned for government workloads. |
| 5 | eGovPay | Digital payments | Collect and reconcile government fees and charges through one gateway, with real-time settlement. |
| 6 | eGovChain | Blockchain | Anchor records and run smart contracts on a zero-fee government blockchain (Hyperledger Besu) over JSON-RPC. |
| 7 | eReport | Citizen reports | File and track complaints/reports: submit, verify by OTP, then list and view status by case number. |
| 8 | Face Liveness | Liveness detection | Confirm a live person is present during identity capture. |
| 9 | Compass | Budget transparency | Programmatic access to public DBM budget-execution data (SAAODB, NCA, SARO, LGSF). |

---

## 1. eGov SSO

**Single Sign-On integration for eGov partners.** Implements the OAuth 2.0 authorization-code flow.

**Base URL (staging):** \`https://hackathon-sso.e.gov.ph\`
**Variables:** \`{{base_url}}\`, \`{{partner_code}}\` (e.g. \`TEST_AGENCY\`), \`{{partner_secret}}\` (secret — omitted)

### 1.1 POST \`/api/token\` — Generates Access Token
Exchanges an authorization (exchange) code for an access token using the eGov SSO service. Part of the OAuth 2.0 authorization-code flow, called after the user authenticates.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| exchange_code | string | Yes | The authorization code received after user authentication. |
| scope | string | Yes | Requested scope. Use \`SSO_AUTHENTICATION\` for standard SSO login. |
| partner_code | string | Yes | Unique code identifying the partner/agency system. |
| partner_secret | string | Yes | Secret key associated with the partner account. *(omitted)* |

**Responses:** \`200\` access token generated · \`403\` forbidden (invalid credentials / inactive partner) · \`422\` exchange code invalid or already used/expired.

**Example request body**
\`\`\`json
{ "exchange_code": "generated_exchange_code", "scope": "SSO_AUTHENTICATION", "partner_code": "{{partner_code}}", "partner_secret": "{{partner_secret}}" }
\`\`\`

**Example 200 response**
\`\`\`json
{ "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." }
\`\`\`

**Notes:** the exchange_code is single-use and short-lived; store partner_secret server-side only; send the returned token in the \`Authorization\` header of subsequent requests.

### 1.2 POST — SSO Authentication
Second documented request in the SSO collection (companion to the token exchange, used to perform the SSO authentication step).

### Integration — eGov SSO Widget
A lightweight SSO widget for native web apps or React.

**Native web install:** add meta tags to \`<head>\`, define a global success handler, drop in the widget markup, and load \`egov-hackathon-sso-widget.js\` with \`async defer\`.

| Element | Purpose |
|---------|---------|
| \`meta[name="egov-environment"]\` | Environment (e.g. \`STAGING\`) |
| \`meta[name="egov-client-id"]\` | Your registered eGov client ID |
| \`meta[name="egov-sso-onsuccess"]\` | Name of the global function invoked on successful login |
| \`#egov-sso-widget-button\` | Mount point for the sign-in button |
| \`#egov-sso-widget-portal\` | Mount point for the login modal/portal (required, stays empty until triggered) |

**React install:** \`npm install --save egov-hackathon-sso-widget\`, render \`<EGovSSOWidget />\` plus the required \`#egov-sso-widget-portal\` div.

| Prop | Type | Description |
|------|------|-------------|
| environment | \`"STAGING"\` | Target environment |
| client_id | string | Registered eGov client ID |
| on_success_function | \`(exchange_code: string) => void\` | Callback fired with the exchange code once login succeeds |

**Success callback:** the widget returns an **exchange code** (not a token). Exchange it server-side for a token (via the \`/api/token\` endpoint).

**Login flow (rendered by the widget):** (1) mobile number entry (or switch to email), (2) OTP verification (6-digit SMS code with countdown), (3) account security notice, (4) MPIN entry (6-digit passcode) → on success \`on_success_function\` is invoked.

**Best practices:** use \`STAGING\` for dev and \`PRODUCTION\` for live; load script with \`async defer\`; keep client IDs environment-specific; the exchange code is single-use and short-lived.


---

## 2. eVerify

**Verify citizen identity against PhilSys in real time, with consent built into every check.** NIDAS eVerify Authentication Services (National ID) REST API for Relying Parties — Tier 1 and Tier 2 identity authentication.

**Flow:** (1) obtain an \`access_token\` from the Authentication endpoint → (2) secure a \`face_liveness_session_id\` via the Face Liveness Web SDK → (3) submit demographics + \`face_liveness_session_id\` to the Verify endpoint.

**Variables:** \`{{base_url}}\`, \`{{client_id}}\`, \`{{client_secret}}\` (omitted), \`{{access_token}}\`, \`{{public_api_key}}\`

### 2.1 POST \`/api/auth\` — Authenticate (Generate Access Token)
Generates a server-to-server \`access_token\`. Every verification call requires this token.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| client_id | string | Yes | Assigned API Client ID. |
| client_secret | string | Yes | Assigned API Client Secret. *(omitted)* |

**Responses:** \`200\` token generated · \`403\` invalid credentials.
**Example 200:**
\`\`\`json
{ "data": { "access_token": "eyJ0eXAiOiJKV1Qi...", "token_type": "Bearer", "expires_at": "1724223772" } }
\`\`\`
Use the token as a Bearer token in the \`Authorization\` header of the verify endpoints.

### 2.2 POST \`/api/query\` — Verify Personal Information
Compares the user's demographic input and biometrics (Face Liveness) against the NIDAS database.
**Header:** \`Authorization: Bearer <access_token>\`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| first_name | string | Yes | |
| middle_name | string | No | |
| last_name | string | Yes | |
| suffix | string | No | |
| birth_date | string (YYYY-MM-DD) | Yes | |
| face_liveness_session_id | string (UUID) | Yes | The session_id from the Liveness Web SDK. |

**Note:** obtain \`face_liveness_session_id\` via the SDK: \`window.eKYC().start({ pubKey })\` and pass the returned \`result.session_id\`.

**Example 200 (abridged):** returns \`data\` with code, token, reference, face_url, full_name and demographic fields (gender, marital_status, blood_type, addresses, place_of_birth, etc.) plus \`meta\`: \`{ "tier_level": "Tier II", "result_grade": 1 }\`. Errors: \`401 Unauthorized\`.

### 2.3 POST \`/api/query/qr/check\` — QR Check
Checks and decodes a scanned National ID QR code value. Decrypts and returns the verified demographics stored inside the QR.
**Header:** \`Authorization: Bearer <access_token>\`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| value | string | Yes | Raw string scanned from the National ID QR code. |

**Responses:** \`200\` valid QR (returns decrypted profile) · \`422\` invalid QR format.
Supports multiple QR types: Philsys Card Number, Digital ID, National ID Signed, ePhilId, Philsys Card. Example 200: \`{ "data": { "pcn": "1234-1234-1234-1234" }, "meta": { "qr_type": "Philsys Card Number" } }\`

### 2.4 POST \`/api/query/qr\` — QR Verify
Full identity verification using the scanned National ID QR value + matching biometrics (Face Liveness).
**Header:** \`Authorization: Bearer <access_token>\`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| value | string | Yes | Raw string scanned from the National ID QR code. |
| face_liveness_session_id | string (UUID) | Yes | The session_id from the Liveness Web SDK. |

**Responses:** \`200\` processed (returns profile if matched). Also returns "Unverified (Face Mismatch)" variant. Returns full demographic \`data\` + \`meta\` (tier_level, result_grade).

### Integration — Face Liveness Web SDK
1. **Import SDK:** \`<script src="https://hackathon-everify-face-liveness.e.gov.ph/js/everify-liveness-sdk.min.js"></script>\`
2. **Start check:** call \`window.eKYC().start({ pubKey: "YOUR_PUBLIC_API_KEY" })\` (returns a Promise).
3. **Response payload:** \`{ "status": "COMPLETED", "result": { "photo": "data:image/jpeg;base64,...", "session_id": "<UUID>", "photo_url": "https://..." } }\`
   - status (string), result.photo (base64 selfie), result.session_id (UUID), result.photo_url (temporary secure URL).
4. **Submit to backend:** send \`session_id\` to your backend, which calls the eVerify query/verify endpoints, passing it as \`face_liveness_session_id\`.
5. A full minimal HTML integration example is provided in the portal.

---

## 3. eMessage

**Deliver SMS, email and in-app notices to citizens through a single messaging API.**
**Variables:** \`{{base_url}}\`, \`{{api_token}}\` (omitted)

### 3.1 POST \`/messaging/v1/sms/push\` — Push SMS
Sends an SMS message to a recipient number.

**Headers**

| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| X-EMESSAGE-Auth | \`<API-TOKEN>\` | Yes | eMessage API auth token. |
| Content-Type | application/json | Yes | Request body is JSON. |

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| number | string | Yes | Recipient mobile number in E.164 format, e.g. +639090000000. |
| message | string | Yes | The SMS message body. |

**Responses:** \`201\` created · \`400\` bad request · \`422\` unprocessable entity.
**Example 201:** \`{ "data": { "message": "SMS was successfully created." } }\`


---

## 4. eGov AI

**Document intelligence, translation and conversational endpoints tuned for government workloads.**
**Variables:** \`{{base}}\`, \`{{access_code}}\` (omitted), \`{{hackathon_token}}\` (omitted).
All authenticated endpoints use \`Authorization: Bearer {{hackathon_token}}\`. \`category\` is a country/region code (e.g. \`PH\`).

### 4.1 POST \`/api/v1/egov/integration/token\` — Generate Access Token
Generates a short-lived access token. Body: \`{ "access_code": "{{access_code}}" }\`.
**Example 200:** \`{ "access_token": "<uuid>", "expires_in_seconds": 28800, "credits_total": 200, "credits_remaining": 200 }\`. Errors: \`401\`. Token is auto-stored to \`hackathon_token\` for reuse.

### 4.2 POST \`/api/v1/egov/integration/ai_assistant/generate\` — AI Assistant
AI-powered answers about eGov services.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Natural-language question. |
| category | string | Yes | Country/region code (e.g. \`PH\`). |

Returns \`{ "data": "<answer>", "session_id": "<uuid>" }\`. Errors: \`401\`.

### 4.3 POST \`/api/v1/egov/integration/speech_maker/generate\` — Speech Maker
Generates a structured speech. Body: \`prompt\` (required), \`category\` (required). Returns \`{ "data": "<speech>", "session_id": "<uuid>" }\`.

### 4.4 POST \`/api/v1/egov/integration/tourism/generate\` — Tourism
Generates travel/tourism content (itineraries, cultural insights). Body: \`prompt\` (required), \`category\` (required). Returns \`{ "data": "<markdown content>", "session_id": "<uuid>" }\`. The \`data\` field supports Markdown.

### 4.5 POST \`/api/v1/egov/integration/laws_and_regulations/generate\` — Laws & Regulations
AI responses about laws & regulations. Body: \`prompt\` (required), \`category\` (jurisdiction code, e.g. \`PH\`). Returns \`{ "data": "<answer>", "session_id": "<uuid>" }\`.

### 4.6 POST \`/api/v1/egov/integration/translator/generate\` — Translator
Translates text between languages (ISO 639-1 codes).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Text to translate. |
| source_lang | string | Yes | Source language code (e.g. \`en\`). |
| target_lang | string | Yes | Target language code (e.g. \`fil\`). |

Returns \`original_prompt\`, \`source_lang\`, \`target_lang\`, \`translate_from\` {code,label}, \`translated_prompt\`, \`transliterated_prompt\`.

### 4.7 POST \`/api/v1/egov/integration/document_extractor/generate\` — Document Extractor
OCR / structured extraction from an uploaded document. Request is **multipart/form-data**.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | Document to process (image of ID/license/gov document). Supports JPEG, PNG, PDF. |

Returns \`{ "data": "<HTML-formatted extracted fields>" }\`. Errors: \`401\`.

### 4.8 GET \`/api/v1/egov/integration/credits\` — Token Credits
Retrieves the current token credit balance.
**Example 200:** \`{ "credits_total": 200, "credits_used": 5, "credits_remaining": 195, "expires_at": "2026-07-10T23:33:34.000+08:00" }\`. Errors: \`401\`.

---

## 5. eGovPay

**Collect and reconcile government fees and charges through one gateway, with real-time settlement.**
**Variables:** \`{{base_url}}\`, \`{{api_token}}\` (omitted; prefix a test-mode token with \`test_\`), \`{{template_id}}\`, \`{{transaction_uuid}}\`.
All requests use header \`X-eGovPay-Token: <token>\` (a \`test_\`-prefixed token runs in test mode and does not touch live financial networks).

### 5.1 POST \`/api/v1/transaction\` — Generate Payment
Creates a payment transaction and returns a hosted payment-gateway link.

**Headers:** \`X-eGovPay-Token\` (Yes), \`Content-Type: application/json; charset=utf-8\` (Yes).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| items | array | Yes | Line items being paid for. |
| items[].name | string | Yes | Name of the item. |
| items[].amount | double | Yes | Amount of the item. |
| amount | double | Yes | Total transaction amount. |
| settlement_template_uuid | uuid | Yes | Settlement template used for bank settlements. |
| redirect_url | url | Yes | Redirect after payment processed. |
| txnid | string | Yes | Transaction ID generated by the biller/merchant. |
| callback_url | url | Yes | URL notified for every status change. |
| digest | string | Yes | HMAC-SHA256 of the txn keyed by API token: \`hash_hmac('sha256', "$amount|$txnid", $token)\`. |
| currency | string | No | Currency code, e.g. PHP. |
| mobile | string | No | Customer mobile (for e-receipt). |
| email | string | No | Customer email. |
| name | string | No | Customer name. |
| expires_at | datetime | No | Transaction expiry (YYYY-MM-DD HH:MM:SS). |
| link_expires_at | datetime | No | Payment-link expiry. |
| description | object | No | Additional transaction info. |

**Responses:** \`201\` created · \`401\` unauthorized · \`422\` unprocessable.
**Example 201:** \`{ "data": { "uuid": "<uuid>", "url": "https://egovpay-pgi-dev.oueg.info/<uuid>", "channel": { "refno": "0IOKUXQ5XX" } } }\`
**Notes:** the \`digest\` binds amount+txnid to your token — recompute per request; use a \`test_\` token while integrating.

### 5.2 GET \`/api/v1/transaction/{{transaction_uuid}}\` — Check Transaction Details
Returns transaction details by UUID. Header: \`X-eGovPay-Token\` (Yes). Path param \`uuid\` (Yes).
**Responses:** \`200\` · \`404\` not found · \`401\` unauthorized. Returns full transaction object (refno, txnid, environment_type, items, amount, fees, currency, payment_status, channel info, timestamps).

### 5.3 PUT \`/api/v1/transaction/{{transaction_uuid}}/void\` — Void Transaction
Voids a transaction by UUID. Header: \`X-eGovPay-Token\` (Yes). Path param \`uuid\` (Yes).
**Responses:** \`200\` success · \`400\` bad request · \`401\` unauthorized · \`404\` not found.
**Example 200:** \`{ "data": { "message": "You have successfully voided this transaction." } }\`


---

## 6. eGovChain

**Anchor records and run smart contracts on a zero-fee government blockchain (Hyperledger Besu, QBFT) over JSON-RPC.** Postman Collection v2.1 for the DICT eGov hackathon Besu node. Covers ETH, NET, WEB3, TXPOOL and read-only QBFT. Operator-only namespaces (ADMIN, DEBUG, TRACE) are omitted.

**Zero fees:** all transactions use \`gasPrice: 0x0\` (no ETH needed). Confirm enabled APIs with **Misc → rpc_modules**.

**Network / variables**

| Variable | Value |
|----------|-------|
| rpcUrl | https://hackathon-blockchain.e.gov.ph |
| explorerUrl | https://hackathon-explorer.e.gov.ph |
| chainIdHex | 0x343b (13371) |
| devAccount | 0xCe6eb51f790F63488670fCe1F85DD88355c3C047 |
| contractAddress_HackathonGuestbook | 0x2012eFf5594bA45eC8Ec537B982dd18dc529CA95 |
| txHash | 0x56bd3b58deed549b2c22a17e4897034932687e10b057dfd6605256a8e28e7749 |
| blockHash | 0x8da0a2f370a05a19c16c06836c69d6f15e93c267b07754117aa83c62d31a9aa1 |
| storageSlot | 0x0 · txIndexHex 0x0 · filterId 0x1 · logsFromBlock 0x1600 · logsToBlock 0x1700 |

**Deploy your own contracts:** point Remix, Hardhat, Foundry, MetaMask or any Ethereum tooling at RPC \`https://hackathon-blockchain.e.gov.ph\`, Chain ID \`13371\`, gas price \`0\`.

All calls are \`POST {{rpcUrl}}\` with header \`Content-Type: application/json\` and a JSON-RPC 2.0 body: \`{ "jsonrpc":"2.0", "method":"<method>", "params":[...], "id":1 }\`.

### 6.1 Misc
| Method | Params | Returns |
|--------|--------|---------|
| \`rpc_modules\` | \`[]\` | Object mapping namespace → version (e.g. eth, net, web3). |

### 6.2 WEB3
| Method | Params | Returns |
|--------|--------|---------|
| \`web3_clientVersion\` | \`[]\` | Besu client version string (\`besu/v…\`). |
| \`web3_sha3\` | \`[ "0x68656c6c6f" ]\` | Keccak-256 32-byte hash hex. |

### 6.3 NET
| Method | Params | Returns |
|--------|--------|---------|
| \`net_version\` | \`[]\` | Network ID decimal string (e.g. "13371"). |
| \`net_listening\` | \`[]\` | true / false. |
| \`net_peerCount\` | \`[]\` | Hex quantity of connected peers. |
| \`net_enode\` | \`[]\` | This node's enode URL. |
| \`net_services\` | \`[]\` | Object of enabled P2P service flags. |

### 6.4 ETH — chain / gas
| Method | Params | Returns |
|--------|--------|---------|
| \`eth_chainId\` | \`[]\` | \`0x343b\` (13371). |
| \`eth_protocolVersion\` | \`[]\` | Hex string. |
| \`eth_syncing\` | \`[]\` | \`false\` when synced, else progress object. |
| \`eth_coinbase\` | \`[]\` | Coinbase / block beneficiary address. |
| \`eth_mining\` | \`[]\` | true / false. |
| \`eth_hashrate\` | \`[]\` | Usually \`0x0\` (unused on QBFT). |
| \`eth_gasPrice\` | \`[]\` | \`0x0\` on this zero-fee chain. |
| \`eth_maxPriorityFeePerGas\` | \`[]\` | Often \`0x0\`. |
| \`eth_feeHistory\` | \`[ "0x4", "latest", [25,50,75] ]\` | baseFeePerGas, gasUsedRatio, reward, oldestBlock. |
| \`eth_blobBaseFee\` | \`[]\` | May be \`0x0\` / unused. |
| \`eth_blockNumber\` | \`[]\` | Latest block number (hex). |

### 6.5 ETH — accounts / state
| Method | Params | Returns |
|--------|--------|---------|
| \`eth_accounts\` | \`[]\` | Usually \`[]\` on Besu. |
| \`eth_getBalance\` | \`[ "{{devAccount}}", "latest" ]\` | Balance in wei (hex). |
| \`eth_getBalance (at block)\` | \`[ "{{devAccount}}", "{{blockNumberHex}}" ]\` | Balance in wei (hex). |
| \`eth_getTransactionCount\` | \`[ "{{devAccount}}", "latest" ]\` | Account nonce (hex). |
| \`eth_getTransactionCount (pending)\` | \`[ "{{devAccount}}", "pending" ]\` | Account nonce (hex). |
| \`eth_getCode\` | \`[ "{{contractAddress}}", "latest" ]\` | \`0x\` for EOAs; bytecode otherwise. |
| \`eth_getStorageAt\` | \`[ "{{contractAddress}}", "{{storageSlot}}", "latest" ]\` | 32-byte hex. |
| \`eth_getProof\` | \`[ "{{devAccount}}", [], "latest" ]\` | Merkle proof: address, balance, nonce, codeHash, storageHash, proofs. |

### 6.6 ETH — blocks
| Method | Params | Returns |
|--------|--------|---------|
| \`eth_getBlockByNumber (latest)\` | \`[ "latest", false ]\` | Block object or null. |
| \`eth_getBlockByNumber (full txs)\` | \`[ "{{blockNumberHex}}", true ]\` | Block object or null. |
| \`eth_getBlockByHash\` | \`[ "{{blockHash}}", false ]\` | Block object or null. |
| \`eth_getBlockTransactionCountByNumber\` | \`[ "{{blockNumberHex}}" ]\` | Hex quantity. |
| \`eth_getBlockTransactionCountByHash\` | \`[ "{{blockHash}}" ]\` | Hex quantity. |
| \`eth_getBlockReceipts\` | \`[ "{{blockNumberHex}}" ]\` | Array of receipt objects. |
| \`eth_getUncleCountByBlockNumber\` | \`[ "{{blockNumberHex}}" ]\` | Usually \`0x0\` on QBFT. |
| \`eth_getUncleCountByBlockHash\` | \`[ "{{blockHash}}" ]\` | Usually \`0x0\` on QBFT. |
| \`eth_getUncleByBlockNumberAndIndex\` | \`[ "{{blockNumberHex}}", "0x0" ]\` | Often null on QBFT. |

### 6.7 ETH — transactions
| Method | Params | Returns |
|--------|--------|---------|
| \`eth_getTransactionByHash\` | \`[ "{{txHash}}" ]\` | Tx object or null. |
| \`eth_getTransactionReceipt\` | \`[ "{{txHash}}" ]\` | Receipt (status, logs, gasUsed) or null. |
| \`eth_getTransactionByBlockNumberAndIndex\` | \`[ "{{blockNumberHex}}", "{{txIndexHex}}" ]\` | Tx object or null. |
| \`eth_getTransactionByBlockHashAndIndex\` | \`[ "{{blockHash}}", "{{txIndexHex}}" ]\` | Tx object or null. |
| \`eth_sendRawTransaction\` | \`[ "{{rawSignedTx}}" ]\` | Tx hash on success. **gasPrice must be 0x0.** |

### 6.8 ETH — filters / logs
| Method | Params | Returns |
|--------|--------|---------|
| \`eth_newBlockFilter\` | \`[]\` | Filter id hex. |
| \`eth_newPendingTransactionFilter\` | \`[]\` | Filter id hex. |
| \`eth_newFilter\` | \`[ { "fromBlock":"latest","toBlock":"latest" } ]\` | Filter id hex. |
| \`eth_getFilterChanges\` | \`[ "{{filterId}}" ]\` | Array of hashes/logs. |
| \`eth_getFilterLogs\` | \`[ "{{filterId}}" ]\` | Array of log objects. |
| \`eth_uninstallFilter\` | \`[ "{{filterId}}" ]\` | true / false. |
| \`eth_getLogs\` | \`[ { "fromBlock":"latest","toBlock":"latest" } ]\` | Array of logs (keep ranges small — Besu enforces a max range). |

### 6.9 ETH — call / estimate
| Method | Params | Returns |
|--------|--------|---------|
| \`eth_call\` | \`[ { "to":"{{contractAddress}}","data":"0x8caa0083","gasPrice":"0x0" }, "latest" ]\` | ABI-encoded return data hex. |
| \`eth_estimateGas\` | \`[ { "to":"{{contractAddress}}","data":"0x8caa0083","gasPrice":"0x0" } ]\` | Hex gas quantity. |
| \`eth_createAccessList\` | \`[ { "to":"{{contractAddress}}","data":"0x8caa0083","gasPrice":"0x0" }, "latest" ]\` | EIP-2930 accessList + gasUsed. |

### 6.10 QBFT (read-only)
| Method | Params | Returns |
|--------|--------|---------|
| \`qbft_getValidatorsByBlockNumber\` | \`[ "latest" ]\` | Array of validator addresses. |
| \`qbft_getValidatorsByBlockHash\` | \`[ "{{blockHash}}" ]\` | Array of validator addresses. |
| \`qbft_getPendingVotes\` | \`[]\` | Object of address → vote. |
| \`qbft_getSignerMetrics\` | \`[]\` | Signer / proposer metrics. |

### 6.11 TXPOOL
| Method | Params | Returns |
|--------|--------|---------|
| \`txpool_besuStatistics\` | \`[]\` | Local/remote pending/queued counts. |
| \`txpool_besuTransactions\` | \`[]\` | Txpool contents object. |
| \`txpool_besuPendingTransactions\` | \`[]\` | Pending transactions. |

### 6.12 Contracts — HackathonGuestbook (eth_call samples)
Demo contract at \`{{contractAddress_HackathonGuestbook}}\`. Read calls use function selectors in \`data\`; write functions are shown as **simulation-only** \`eth_call\` samples plus gas estimation and log queries.

| Sample | Params (data selector) |
|--------|------------------------|
| \`eth_getCode (HackathonGuestbook)\` | \`[ "{{contractAddress}}", "latest" ]\` |
| \`eth_call — teamCount()\` | data \`0x8caa0083\` |
| \`eth_call — listTeams()\` | data \`0x0d1d8d6d\` |
| \`eth_call — getTeam(0)\` | data \`0x008e0f1b{{guestbookTeamIdHex}}\` |
| \`eth_call — entryCount()\` | data \`0x0cbb0f83\` |
| \`eth_call — getEntry(0)\` | data \`0xbae78d7b{{guestbookEntryIdHex}}\` |
| \`eth_call — createTeam("Team Alpha")\` **(sim only)** | data \`0x972fa53f…\` (from devAccount, gas 0x7a120, gasPrice 0x0) |
| \`eth_call — post("Hello hackathon!")\` **(sim only)** | data \`0x8ee93cf3…\` |
| \`eth_call — postForTeam(0,"Go Alpha!")\` **(sim only)** | data \`0x672d0bb4…\` |
| \`eth_estimateGas — createTeam("Team Alpha")\` | data \`0x972fa53f…\` → hex gas |
| \`eth_getLogs — TeamCreated events\` | topic \`0x31e53e620200526794090176a9f84c399de83e99e97f7e76485a3f2003087443\` |
| \`eth_getLogs — MessagePosted events\` | topic \`0xb8addafd9d8559ba…\` |

*(All 70 endpoints in the collection are listed above, grouped by namespace.)*


---

## 7. eReport

**Let citizens file and track complaints and reports:** submit a complaint, verify by OTP, then list and view report status by case number.
**Variables:** \`{{base}}\`, \`{{access_code}}\` (omitted), \`{{integration_token}}\` (omitted), \`{{integration_report_view_token}}\` (omitted).
Dataset & submit endpoints use \`Authorization: Bearer {{integration_token}}\`; report-viewing endpoints use header \`X-EReport-View-Token: {{integration_report_view_token}}\`.

### Datasets
**7.1 GET \`/api/integration/datasets/report_types\`** — Report Type List. No params. Returns report-type objects (code/name/sequence). Sample codes: crime, red_tape, scam, child_abuse, women_abuse, overpricing, fire, accident, gas_station_concerns.

**7.2 GET \`/api/integration/datasets/regions\`** — Region List. No params. Returns regions with 9-digit id + name (e.g. 130000000 = NCR).

**7.3 GET \`/api/integration/datasets/provinces?region_code=\`** — Province List by Params. Query: \`region_code\` (required). Returns provinces (id, region_code, name, district).

**7.4 GET \`/api/integration/datasets/municipalities?province_code=\`** — Municipality List by Params. Query: \`province_code\` (required). Returns municipalities (id, region_code, province_code, name, zip_code).

**7.5 GET \`/api/integration/datasets/barangays?municipality_code=\`** — Barangay List by Params. Query: \`municipality_code\` (required). Returns barangays (id, region/province/municipality codes, name, zip_code).

### Actions
**7.6 POST \`/api/integration/token\`** — Generate Token. Body: \`{ "access_code": "{{access_code}}" }\`. Returns \`{ "access_token": "<token>", "expires_at": "..." }\`; auto-saved to \`integration_token\`. Errors: \`401\`.

**7.7 POST \`/api/integration/submit_complaint\`** — Submit Complaint. Auth: Bearer \`{{integration_token}}\`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mobile | string | Yes | Complainant mobile (639XXXXXXXXX). |
| first_name | string | Yes | |
| last_name | string | Yes | |
| gender | string | Yes | e.g. Male, Female. |
| complainant_email | string | Yes | |
| report_type | string | Yes | e.g. crime. |
| subject | string | Yes | Brief subject. |
| message | string | Yes | Detailed description. |
| evidences | array of strings | No | Image URLs. |
| region_code | string | Yes | PSA region code. |
| province_code | string | Yes | PSA province code. |
| municipality_code | string | Yes | PSA municipality/city code. |
| barangay_code | string | Yes | PSA barangay code. |
| latitude | string | No | |
| longitude | string | No | |

**Example 200:** \`{ "code": 200, "message": "We received your report. We'll get back to you.", "case_number": "PFM-071826-0014" }\`. Errors: \`401\`.

**7.8 POST \`/api/integration/verify/request\`** — Verify - Request OTP. Auth: Bearer \`{{integration_token}}\`. Body: \`{ "email": "..." }\`. Sends a 6-digit code (expires in 5 min). Returns \`{ "code":200, "already_verified":false, "message":"..." }\`.

**7.9 POST \`/api/integration/verify/confirm\`** — Verify - Confirm OTP. Auth: Bearer \`{{integration_token}}\`. Body: \`{ "email":"...", "otp":"000000" }\`. Returns \`{ "code":200, "report_view_token":"<uuid>", "expires_at":"..." }\`; auto-saved to \`integration_report_view_token\`.

**7.10 GET \`/api/integration/reports\`** — Reports List. Header: \`X-EReport-View-Token\`. Query: \`q\` (optional search), \`page\` (default 1), \`limit\` (default 25). Returns paginated reports (case_number, complainant, report_type, subject, message, evidences, address, status, history, created_at).

**7.11 GET \`/api/integration/reports/:case_number\`** — View Report by Case Number. Header: \`X-EReport-View-Token\`. Path: \`case_number\` (required). Returns the full report object incl. status history. Errors: report not found or invalid token.

---

## 8. Face Liveness

**Confirm a live person is present during identity capture:** create a liveness session, then fetch the verification result. Includes automatic session-token propagation.
**Base URL (staging):** \`https://hackathon-face-liveness-api.e.gov.ph\`
**Variables:** \`{{baseUrl}}\`, \`{{apiKey}}\` (omitted), \`{{sessionToken}}\`.
All calls use header \`x-api-key: {{apiKey}}\`.

### 8.1 POST \`/v1/liveness/session\` — Create Session
Initializes a liveness session and returns a dynamic verification URL + session token.
**Headers:** \`x-api-key\`, \`Content-Type: application/json\`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | Flow action on completion: \`redirect\`, \`post\`, or \`close\`. |
| callback_url | string | Yes (for redirect) | Destination URL for redirect flow. |
| delay | integer | No | Ms to show the completion screen before redirect/close. Default 3000. |

**Responses:** \`201\` created (Redirect / Post Message / Close flow variants).
**Example 201:** \`{ "token": "<uuid>", "url": "https://hackathon-face-liveness.e.gov.ph/liveness?token=<uuid>&action=redirect&callbackUrl=...&delay=3000" }\`

### 8.2 GET \`/v1/liveness/result/{{sessionToken}}\` — Get Verification Result
Protected backend-to-backend endpoint retrieving the final result for a session. Header: \`x-api-key\`.
**Example 200:** \`{ "status": "SUCCEEDED", "confidence_score": 98.71, "reference_image_url": "https://...s3...reference.jpg?..." }\`
**Recommended security threshold:** status must be exactly \`SUCCEEDED\`; confidence_score ≥ 95.0 (out of 100.0). Below 95.0 → reject as high-risk and request a retry.


---

## 9. Compass

**Centralized Open Monitoring Platform for Appropriations and Spending Statistics:** programmatic access to public DBM budget-execution data — SAAODB, NCA, SARO and LGSF records and dashboard summaries.
**Base URL:** \`https://dbm-ws.oueg.info\`
**Variables:** \`{{baseUrl}}\`, \`{{apiKey}}\` (omitted).
All calls use header \`X-API-Key: {{apiKey}}\`.

### 9.1 GET \`/api/v1/records/saaodb\` — Get SAAODB Records
Paginated SAAODB (Statement of Appropriations, Allotments, Obligations, Disbursements & Balances) records.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reportYear | integer | Yes | Fiscal report year (e.g. 2026). |
| period | string | Yes | Q1, Q2, Q3, Q4, or FY. |
| class | string | No | Expense class: PS, MOOE, FINEX, CO. |
| sheetScope | string | No | summary, agency, sucs. |
| entityName | string | No | Partial-match entity name. |
| page | integer | Yes | Page number (starts at 1). |
| limit | integer | Yes | Records per page (max 1000). |

Each record includes: id, fileVersionId, sourceRow, sheetScope, reportYear, asOfDate, period, isPreliminary, entityName, fundSource, class, appropriations, adjustments, totalAvailableAppropriations, allotments, obligations, unobligatedAllotments, disbursements, unpaidObligationsDue/NotDue/Total, createdAt.

### 9.2 GET \`/api/v1/records/saaodb/dashboard\` — Get SAAODB Dashboard Summary
High-level dashboard summary of SAAODB data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reportYear | integer | Yes | Fiscal report year. |
| sheetScope | string | Yes | summary, agency, sucs. |

Returns: reportYear, sheetScope, \`cascade\` (appropriations, adjustments, totalAvailable, allotments, obligations, unobligated, disbursements, unreleased), \`rates\` (obligationRate, disbRateOblig, disbRateAppro), \`classBreakdown\` [{class, amount}], \`appropriationSplit\` (currentYear, continuing, hasSplit), \`topEntities\` (may be empty for summary scope).

### 9.3 GET \`/api/v1/records/saaodb/entities\` — Get SAAODB Hierarchical Entities
Parent-child entity structure (departments → agencies → fund sources).

| Parameter | Required | Description |
|-----------|----------|-------------|
| reportYear | Yes | Fiscal report year. |
| sheetScope | Yes | agency or sucs. |
| expandParent | No | Department name to expand into child agencies. |
| expandEntity | No | Agency name to expand into fund sources. |
| expandEntityParent | No | Parent department to disambiguate agencies with shared names. |

### 9.4 GET \`/api/v1/records/nca\` — Get NCA Records
Paginated NCA (Notice of Cash Allocation) records.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| budgetYear | integer | Yes | Fiscal budget year. |
| deptCode | string | No | UACS department code. |
| agencyCode | string | No | UACS agency code. |
| operatingUnitCode | string | No | Operating unit code. |
| expenseClass | string | No | Expense class UACS code. |
| page | integer | No | Default 1. |
| limit | integer | No | Default 100. |

Returns \`{ data[], total, page, limit }\`.

### 9.5 GET \`/api/v1/records/saro\` — Get SARO Records
Paginated SARO (Special Allotment Release Order) records.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| saroNo | string | No | Exact SARO number. |
| deptCode | string | No | UACS department code. |
| agencyCode | string | No | UACS agency code. |
| expenseClass | string | No | UACS expense class code. |
| page | integer | No | Default 1. |
| limit | integer | No | Default 100. |

Record object: saroNo, deptCode, agencyCode, expenseClass, amount, dateIssued (ISO 8601). Returns \`{ data[], total, page, limit }\`.

### 9.6 GET \`/api/v1/records/lgsf\` — Get LGSF Records
Paginated Local Government Support Fund records. All params optional.

| Parameter | Description | Example |
|-----------|-------------|---------|
| fiscalYear | Program budget year | 2026 |
| programCode | LGSF program: FALGU, GEF, GGG, SBDP, SAFPB | GGG |
| regionCode | Region UACS/geo code | PH030000000 |
| province | Province name | Bulacan |
| cityMunicipality | City/municipality name | Malolos |
| page | Page number | 1 |
| limit | Records per page | 100 |

### 9.7 GET \`/api/v1/records/lgsf/dashboard\` — Get LGSF Dashboard Summary
Dashboard summary for an LGSF program: KPIs, yearly trend, and paginated projects.

| Parameter | Required | Description |
|-----------|----------|-------------|
| programCode | Yes | FALGU, GEF, GGG, SBDP, SAFPB. |
| reportYear | No | Fiscal year to filter KPIs. |
| region | No | Region GADM canonical name (e.g. Region III). |
| province | No | Province name. |
| municipality | No | City/municipality name. |
| page | No | Projects page (default 1). |
| limit | No | Projects per page (default 25, max 200). |

Returns: programCode, reportYear, \`kpis\` (totalReleased, projectCount, lguCount, barangayCount, regionCount, provinceCount, fiscalYearCount), \`trend\` [], \`projects\` { rows[], total, page, pageSize }.

---

*End of document. Compiled 2026-07-21 from the eGov API Developer Portal. All credentials/secrets/tokens omitted by design.*
