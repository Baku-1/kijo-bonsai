// seed-claim — POST
// Called after a buyer sends RON to the treasury wallet.
// Verifies the on-chain payment before recording the claim.
//
// ALL 5 payment checks must pass before any mint is attempted:
//   1. tx exists and is mined (blockNumber present)
//   2. tx.to === TREASURY
//   3. tx.value >= SEED_PRICE_WEI * count
//   4. tx.from === caller's authenticated Ronin address
//   5. INSERT into seed_claims succeeds (replay guard — unique PK on tx_hash)
//
// Mint is stubbed: KIJONSAI_CONTRACT_ADDRESS not yet set. Wire it in after deploy.
//
// JWT auth pattern copied exactly from care-action/index.ts.
// Service-role client used for all DB writes (bypasses RLS).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createWalletClient, createPublicClient, http, defineChain } from 'npm:viem@2';
import { privateKeyToAccount } from 'npm:viem@2/accounts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Payment constants
// ---------------------------------------------------------------------------

const TREASURY = '0x68bd10cf714217eb9877b37812a548b801a94894';
const SEED_PRICE_WEI = 3_000_000_000_000_000_000n; // 3 RON in wei
const RONIN_RPC = 'https://saigon-testnet.roninchain.com/rpc';
// MIN_CONFIRMATIONS = 1: having a blockNumber proves the tx is in at least one
// confirmed block. For stricter N-block finality, fetch eth_blockNumber, compare
// currentBlock - tx.blockNumber >= MIN_CONFIRMATIONS, and return 422 if not yet
// final. For testnet a single confirmation is sufficient.
// const _MIN_CONFIRMATIONS = 1; // declared but unused — kept as documentation

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Thin wrapper around a single JSON-RPC call to the Ronin RPC endpoint. */
async function rpcCall(
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(RONIN_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`RPC HTTP error: ${res.status}`);
  }
  const data: { result?: unknown; error?: { message: string } } = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result ?? null;
}

// ---------------------------------------------------------------------------
// Ronin Saigon testnet chain definition (viem doesn't ship it)
// ---------------------------------------------------------------------------

const roninSaigon = defineChain({
  id: 202601,
  name: 'Ronin Saigon Testnet',
  nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
  rpcUrls: { default: { http: ['https://saigon-testnet.roninchain.com/rpc'] } },
  blockExplorers: {
    default: { name: 'Ronin Explorer', url: 'https://saigon-explorer.roninchain.com' },
  },
  testnet: true,
});

const KIJONSAI_ABI = [
  {
    name: 'mintKijonsai',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'uri', type: 'string' },
    ],
    outputs: [],
  },
] as const;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // -------------------------------------------------------------------------
  // 0. JWT verification — copy of care-action pattern
  // -------------------------------------------------------------------------
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  // Use anon client to validate JWT against Supabase auth (not service role).
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // Service-role client for all DB operations.
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // -------------------------------------------------------------------------
  // 1. Parse and validate request body
  // -------------------------------------------------------------------------
  let body: { txHash?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const { txHash, count } = body;

  if (
    !txHash ||
    typeof txHash !== 'string' ||
    count == null ||
    typeof count !== 'number'
  ) {
    return json({ error: 'Missing txHash or count' }, 400);
  }

  if (!Number.isInteger(count) || count < 1 || count > 10) {
    return json({ error: 'count must be an integer between 1 and 10' }, 400);
  }

  // Validate txHash format before forwarding to eth_getTransactionByHash.
  // Prevents malformed input from reaching the RPC node.
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return json({ error: 'Invalid txHash format' }, 400);
  }

  const normalizedTxHash = txHash.toLowerCase();

  // -------------------------------------------------------------------------
  // 2. Resolve caller's Ronin wallet address for sender verification (check 4)
  //
  //    The JWT carries wallet_row_id — the UUID of the row in the `wallets`
  //    table for this user. We query that row for the stored Ronin address.
  //
  //    VERIFIED COLUMN NAME: `wallet_address`
  //    Confirmed via live Supabase DB query on 2026-07-22.
  //    wallets table columns: id, wallet_address, guest_token, is_guest,
  //    tutorial_day, tutorial_done, tutorial_shear_used, created_at
  // -------------------------------------------------------------------------
  const walletRowId = user.user_metadata?.wallet_row_id as string | undefined;
  if (!walletRowId) {
    return new Response(JSON.stringify({ error: 'Wallet not linked to account' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: walletRow, error: walletErr } = await serviceClient
    .from('wallets')
    .select('id, wallet_address')
    .eq('id', walletRowId)
    .single();

  if (walletErr || !walletRow) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const callerWalletAddress: string = walletRow.wallet_address as string;
  if (!callerWalletAddress) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // -------------------------------------------------------------------------
  // 3. Payment verification — all 5 checks before any mint
  // -------------------------------------------------------------------------

  // Check 1: Fetch the transaction; confirm it exists and is mined (blockNumber set).
  type TxResult = {
    blockNumber: string | null;
    to: string | null;
    from: string;
    value: string;
  } | null;

  let tx: TxResult;
  try {
    tx = (await rpcCall('eth_getTransactionByHash', [normalizedTxHash])) as TxResult;
  } catch (err) {
    return json({ error: `RPC call failed: ${(err as Error).message}` }, 502);
  }

  if (!tx || !tx.blockNumber) {
    // tx is null (not found) or blockNumber is null (pending / not yet mined).
    return json({ error: 'Transaction not found or not yet mined' }, 422);
  }

  // Check 2: Verify destination is the treasury wallet.
  if (!tx.to || tx.to.toLowerCase() !== TREASURY.toLowerCase()) {
    return json({ error: 'Transaction destination mismatch' }, 422);
  }

  // Check 3: Verify amount covers the full order.
  // tx.value is a hex string (e.g. "0x29a2241af62c0000"). BigInt() handles "0x" prefixes.
  let valuePaid: bigint;
  try {
    valuePaid = BigInt(tx.value ?? '0x0');
  } catch {
    return new Response(JSON.stringify({ error: 'Malformed transaction value from RPC' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const amountRequired = SEED_PRICE_WEI * BigInt(count);
  if (valuePaid < amountRequired) {
    return json({ error: 'Insufficient payment' }, 402);
  }

  // Check 4: Verify sender is the authenticated caller.
  // The person who paid must be the person claiming — prevents claiming
  // someone else's payment hash.
  if (!tx.from || tx.from.toLowerCase() !== callerWalletAddress.toLowerCase()) {
    return json({ error: 'Transaction sender does not match authenticated wallet' }, 422);
  }

  // Check 5: Replay guard — INSERT into seed_claims.
  // tx_hash is the PRIMARY KEY, so a second INSERT with the same hash
  // triggers a unique violation (Postgres code 23505) → 409 Conflict.
  // This is the difference between safe and exploitable: without this guard,
  // a valid txHash could be replayed to claim seeds multiple times.
  const { error: claimErr } = await serviceClient
    .from('seed_claims')
    .insert({
      tx_hash: normalizedTxHash,
      claimed_by: user.id,
      count,
    });

  if (claimErr) {
    if (claimErr.code === '23505') {
      return json({ error: 'Transaction already claimed' }, 409);
    }
    return json({ error: claimErr.message }, 500);
  }

  // -------------------------------------------------------------------------
  // 5a. Assign tokenId atomically from Postgres sequence
  //     Uses get_next_kijonsai_token_id() — a SECURITY DEFINER wrapper around
  //     nextval('kijonsai_token_id_seq'). See migration 20260722130000.
  // -------------------------------------------------------------------------
  const { data: tokenIdData, error: seqErr } = await serviceClient
    .rpc('get_next_kijonsai_token_id');
  if (seqErr || tokenIdData == null) {
    return json({ error: 'Failed to assign token ID' }, 500);
  }
  const tokenId = BigInt(tokenIdData as number);

  // -------------------------------------------------------------------------
  // 5b. Build metadata URI
  // -------------------------------------------------------------------------
  const metadataUri = `https://api.kijo.xyz/nft/metadata/${tokenId}`;

  // -------------------------------------------------------------------------
  // 5c. Call mintKijonsai on-chain via viem
  // -------------------------------------------------------------------------
  const contractAddress = Deno.env.get('KIJONSAI_CONTRACT_ADDRESS') as `0x${string}`;
  const minterKey = Deno.env.get('MINTER_PRIVATE_KEY') as `0x${string}`;

  if (!contractAddress || !minterKey) {
    return json({ error: 'Mint not configured' }, 503);
  }

  const account = privateKeyToAccount(minterKey);
  const walletClient = createWalletClient({ account, chain: roninSaigon, transport: http() });
  const publicClient = createPublicClient({ chain: roninSaigon, transport: http() });

  let mintTxHash: `0x${string}`;
  try {
    mintTxHash = await walletClient.writeContract({
      address: contractAddress,
      abi: KIJONSAI_ABI,
      functionName: 'mintKijonsai',
      args: [callerWalletAddress as `0x${string}`, tokenId, metadataUri],
    });
  } catch (err) {
    // Mint failed after payment verified and claim recorded.
    // Log for manual remediation — do NOT return 500 silently.
    console.error('mintKijonsai failed after claim recorded:', err);
    return json({
      error: 'Mint transaction failed — payment is recorded, contact support',
      claimRecorded: true,
    }, 502);
  }

  // Wait for 1 confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTxHash, confirmations: 1, timeout: 30_000 });
  if (receipt.status !== 'success') {
    return json({
      error: 'Mint transaction reverted — payment is recorded, contact support',
      claimRecorded: true,
      mintTxHash,
    }, 502);
  }

  return json({ ok: true, tokenId: tokenId.toString(), mintTxHash });
});
