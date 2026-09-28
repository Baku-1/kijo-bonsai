// seed-claim -- POST (v2 -- multi-mint loop)
// Called after a buyer sends RON to the treasury wallet.
// Verifies on-chain payment, then loops count times: for each token --
//   assigns tokenId from sequence, INSERTs trees row, submits on-chain mint.
// Waits for all receipts in parallel, enqueues render jobs, records token_ids.
//
// ALL 5 payment checks must pass before the mint loop starts:
//   1. tx exists and is mined (blockNumber present)
//   2. tx.to === TREASURY
//   3. tx.value >= SEED_PRICE_WEI * count
//   4. tx.from === caller's authenticated Ronin address
//   5. INSERT into seed_claims succeeds (replay guard -- unique PK on tx_hash)
//      On 23505 (duplicate): find-or-create -- return previously-minted tokens
//      if token_ids is populated (idempotent 200), or 409 if mid-loop die.
//
// Response shape v2: { v:2, ok, tokens:[{tokenId,treeId,mintTxHash,ok}], partial }
// JWT auth pattern copied from care-action/index.ts.
// Service-role client used for all DB writes (bypasses RLS).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createWalletClient, createPublicClient, http, defineChain } from 'npm:viem@2';
import { privateKeyToAccount } from 'npm:viem@2/accounts';
import { newTreeMorale } from '../_shared/morale-transport.mjs';

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
const RECEIPT_TIMEOUT_MS = 60_000;
const RONIN_SAIGON_CHAIN_ID = 202601;

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
// enqueueRender -- best-effort; failure logged but does not fail the response
// ---------------------------------------------------------------------------

async function enqueueRender(
  // deno-lint-ignore no-explicit-any
  client: any,
  tokenId: number,
  treeId: string,
  trigger: 'mint' | 'prune' | 'wire' | 'tick',
): Promise<void> {
  const { error } = await client.from('render_queue').insert({
    token_id: tokenId, tree_id: treeId, trigger, status: 'pending',
  });
  if (error) console.error('render_queue insert failed:', error.message);
}

// ---------------------------------------------------------------------------
// Ronin Saigon testnet chain definition (viem does not ship it)
// ---------------------------------------------------------------------------

const roninSaigon = defineChain({
  id: RONIN_SAIGON_CHAIN_ID,
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
// A8-2: Care-log action whitelist — module level for audit visibility.
// Matches care-action/index.ts ALLOWED_ACTION_TYPES exactly (GDD §3.1, §8.2).
// tick: excluded — server-scheduled, never a guest submission (GDD §8.2).
// rotate: included — valid user action (GDD §3.1, light-side bias).
// CRITIC B1 MANDATORY CORRECTION: tick OUT, rotate IN (opposite of architect spec).
// ---------------------------------------------------------------------------
const ALLOWED_GUEST_ACTION_TYPES = new Set([
  'water', 'prune', 'wire', 'wire-remove', 'fertilize', 'rotate',
  'jin', 'landscape', 'twine', 'twine-remove', 'weight', 'weight-remove',
]);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // -------------------------------------------------------------------------
  // 0. JWT verification
  // -------------------------------------------------------------------------
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // -------------------------------------------------------------------------
  // 1. Parse and validate request body
  // -------------------------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const { txHash, count } = body as { txHash?: unknown; count?: unknown };

  if (!txHash || typeof txHash !== 'string' || count == null || typeof count !== 'number') {
    return json({ error: 'Missing txHash or count' }, 400);
  }

  if (!Number.isInteger(count) || count < 1 || count > 10) {
    return json({ error: 'count must be an integer between 1 and 10' }, 400);
  }

  // Generate seeds server-side using CSPRNG. Client no longer provides seeds.
  // A5-1/A8-1: Prevents clients from precomputing optimal seeds offline.
  // crypto.getRandomValues is Deno's built-in Web Crypto API (synchronous, no await).
  // Uint32Array gives values in [0, 2^32-1] -- sufficient genome entropy.
  // NIST SP 800-90A: CSPRNG required for values affecting asset allocation.
  const seedArray = new Uint32Array(count);
  crypto.getRandomValues(seedArray);
  const seeds: number[] = Array.from(seedArray);

  // species validation
  const validSpecies = ['hardwood', 'evergreen', 'tropical'] as const;
  type SpeciesType = typeof validSpecies[number];
  if (!validSpecies.includes(body.species as SpeciesType)) {
    return json({ error: 'invalid species' }, 400);
  }
  const species = body.species as SpeciesType;

  // has_spirit must be true for mint path
  if (body.has_spirit !== true) {
    return json({ error: 'has_spirit must be true for mint path' }, 400);
  }

  // care_log: optional guest history; first token only
  const care_log: unknown[] | undefined =
    Array.isArray(body.care_log) ? (body.care_log as unknown[]) : undefined;

  // txHash format check before RPC call
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return json({ error: 'Invalid txHash format' }, 400);
  }

  const normalizedTxHash = txHash.toLowerCase();

  // -------------------------------------------------------------------------
  // 2. Resolve caller's Ronin wallet address for sender verification (check 4)
  // -------------------------------------------------------------------------
  const walletRowId = user.app_metadata?.wallet_row_id as string | undefined;
  if (!walletRowId) {
    return json({ error: 'Wallet not linked to account' }, 401);
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
  // 3. Payment verification -- all 5 checks before any mint
  // -------------------------------------------------------------------------

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
    return json({ error: 'Transaction not found or not yet mined' }, 422);
  }

  if (!tx.to || tx.to.toLowerCase() !== TREASURY.toLowerCase()) {
    return json({ error: 'Transaction destination mismatch' }, 422);
  }

  let valuePaid: bigint;
  try {
    valuePaid = BigInt(tx.value ?? '0x0');
  } catch {
    return json({ error: 'Malformed transaction value from RPC' }, 502);
  }
  const amountRequired = SEED_PRICE_WEI * BigInt(count);
  if (valuePaid < amountRequired) {
    return json({ error: 'Insufficient payment' }, 402);
  }

  if (!tx.from || tx.from.toLowerCase() !== callerWalletAddress.toLowerCase()) {
    return json({ error: 'Transaction sender does not match authenticated wallet' }, 422);
  }

  // Check 5: Replay guard -- find-or-create (MAJOR-1 fix)
  const { error: claimErr } = await serviceClient
    .from('seed_claims')
    .insert({ tx_hash: normalizedTxHash, claimed_by: user.id, count });

  if (claimErr) {
    if (claimErr.code === '23505') {
      // tx_hash already claimed. Return previously-minted tokens if available.
      const { data: existing } = await serviceClient
        .from('seed_claims')
        .select('token_ids, count')
        .eq('tx_hash', normalizedTxHash)
        .single();

      if (existing?.token_ids?.length) {
        // Previous run completed -- recover treeIds from trees table.
        const { data: treesRows } = await serviceClient
          .from('trees')
          .select('id, token_id')
          .in('token_id', existing.token_ids);

        const treeMap = new Map(
          (treesRows ?? []).map((t: { id: string; token_id: number }) =>
            [Number(t.token_id), t.id]
          )
        );

        return json({
          v: 2,
          ok: true,
          tokens: (existing.token_ids as number[]).map((tid: number) => ({
            tokenId: String(tid),
            treeId: treeMap.get(tid) ?? null,
            mintTxHash: null,
            ok: true,
          })),
          partial: false,
          replay: true,
        });
      }

      // token_ids is NULL: previous run died mid-loop.
      return json({
        error: 'Transaction already claimed but mint may be incomplete -- contact support',
        claimRecorded: true,
      }, 409);
    }
    return json({ error: claimErr.message }, 500);
  }

  // -------------------------------------------------------------------------
  // 4. Setup wallet/public client and fetch base nonce (BLOCKER-2 fix)
  // -------------------------------------------------------------------------
  const contractAddress = Deno.env.get('KIJONSAI_CONTRACT_ADDRESS') as `0x${string}`;
  const minterKey = Deno.env.get('MINTER_PRIVATE_KEY') as `0x${string}`;

  if (!contractAddress || !minterKey) {
    return json({ error: 'Mint not configured' }, 503);
  }

  const account = privateKeyToAccount(minterKey);
  const walletClient = createWalletClient({ account, chain: roninSaigon, transport: http() });
  const publicClient = createPublicClient({ chain: roninSaigon, transport: http() });

  // Fetch base nonce once before the loop. Explicit increment guarantees
  // distinct nonces for all N submissions even if the node's "pending"
  // tag returns a stale count (Ronin OP Stack risk -- see ARCH doc ss6.4).
  const baseNonce: number = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: 'pending',
  });

  // -------------------------------------------------------------------------
  // 5. Mint loop: count iterations
  // -------------------------------------------------------------------------

  type Submission = {
    tokenId: bigint;
    treeId: string | null;
    mintTxHash: `0x${string}` | null;
    ok: boolean;
    error?: string;
  };
  const submissions: Submission[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {

    // Step A: Atomically claim next tokenId from Postgres sequence (inside loop).
    const { data: tokenIdData, error: seqErr } =
      await serviceClient.rpc('get_next_kijonsai_token_id');
    if (seqErr || tokenIdData == null) {
      submissions.push({
        tokenId: 0n, treeId: null, mintTxHash: null, ok: false,
        error: 'Failed to assign token ID',
      });
      continue;
    }
    const tokenId = BigInt(tokenIdData as number);

    // Step B: Insert trees row (BLOCKER-1 fix -- seed-claim creates the row).
    // seeds[i] is the genome for this specific token (MAJOR-3 fix).
    const { data: treeRow, error: treeErr } = await serviceClient
      .from('trees')
      .insert({
        wallet_id:      walletRowId,
        seed:           seeds[i],
        species,
        has_spirit:     true,
        born_at:        now,
        current_day:    0,
        last_ticked_at: now,
        token_id:       Number(tokenId),
        spirit_morale:  newTreeMorale(),
      })
      .select('id')
      .single();

    if (treeErr || !treeRow) {
      console.error(`trees INSERT failed for tokenId ${tokenId}:`, treeErr?.message);
      submissions.push({
        tokenId, treeId: null, mintTxHash: null, ok: false,
        error: `Tree INSERT failed: ${treeErr?.message ?? 'unknown'}`,
      });
      continue;
    }

    const treeId: string = treeRow.id as string;

    // Step C: care_log hand-off -- first token only (guest -> wallet conversion).
    if (i === 0 && care_log && care_log.length > 0) {
      // 409 guard: skip if care_log_entries already exist for this tree_id.
      const { count: existingLogCount } = await serviceClient
        .from('care_log_entries')
        .select('id', { count: 'exact', head: true })
        .eq('tree_id', treeId);

      if (!existingLogCount) {
        // A8-2: ALLOWED_GUEST_ACTION_TYPES defined at module level for audit visibility.
        // See module-level comment above Deno.serve for rationale (GDD §3.1, §8.2).

        const validEntries = (care_log as unknown[]).filter((entry: unknown) => {
          const e = entry as { type?: string };
          const allowed = ALLOWED_GUEST_ACTION_TYPES.has(e.type ?? '');
          if (!allowed) {
            console.warn(`care_log entry skipped (invalid action_type='${e.type ?? ''}') for tree ${treeId}`);
          }
          return allowed;
        });

        const entries = validEntries.map((entry: unknown, seq: number) => {
          const e = entry as { day?: number; type?: string; data?: unknown };
          return {
            tree_id:     treeId,
            game_day:    e.day ?? 0,
            sequence:    seq,          // sequence re-derived from filtered index
            action_type: e.type ?? '',
            action_data: e.data ?? null,
          };
        });
        const { error: logErr } = await serviceClient
          .from('care_log_entries')
          .insert(entries);
        if (logErr) {
          // Non-fatal: tree row exists; care log is lost. Log for manual recovery.
          console.error('care_log_entries INSERT failed (non-fatal):', logErr.message);
        }
      }
    }

    // Step D: Submit on-chain mint with explicit nonce (BLOCKER-2 fix).
    const metadataUri = `https://api.kijo.xyz/nft/metadata/${tokenId}`;
    try {
      const mintTxHash = await walletClient.writeContract({
        address:      contractAddress,
        abi:          KIJONSAI_ABI,
        functionName: 'mintKijonsai',
        args:         [callerWalletAddress as `0x${string}`, tokenId, metadataUri],
        nonce:        baseNonce + i,
      });
      submissions.push({ tokenId, treeId, mintTxHash, ok: true });
    } catch (err) {
      // Tree row exists and tokenId is consumed from the sequence.
      // Support must call mintKijonsai directly for this tokenId.
      console.error(
        `mintKijonsai failed for tokenId ${tokenId} (tree ${treeId}),`,
        `nonce ${baseNonce + i}:`, err,
      );
      submissions.push({
        tokenId, treeId, mintTxHash: null, ok: false,
        error: (err as Error).message,
      });
      console.warn(
        `STUCK_NONCE_CANDIDATE: minter ${account.address} nonce ${baseNonce + i}`,
        `-- check eth_getTransactionCount after this request`
      );
    }
  }

  // -------------------------------------------------------------------------
  // 6. Parallel receipt wait
  // -------------------------------------------------------------------------
  const successfulSubmissions = submissions.filter(s => s.ok && s.mintTxHash);

  const settled = await Promise.allSettled(
    successfulSubmissions.map(async (s) => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash:          s.mintTxHash as `0x${string}`,
        confirmations: 1,
        timeout:       RECEIPT_TIMEOUT_MS,
      });
      return { ...s, receiptStatus: receipt.status };
    })
  );

  // Merge receipt results back.
  let settledIdx = 0;
  for (let i = 0; i < submissions.length; i++) {
    if (!submissions[i].ok || !submissions[i].mintTxHash) continue;
    const result = settled[settledIdx++];
    if (result.status === 'rejected') {
      submissions[i] = {
        ...submissions[i], ok: false,
        error: 'Receipt wait failed or timed out',
      };
    } else if ((result.value as { receiptStatus: string }).receiptStatus !== 'success') {
      submissions[i] = {
        ...submissions[i], mintTxHash: null, ok: false,
        error: 'Mint tx reverted on-chain',
      };
    }
  }

  // -------------------------------------------------------------------------
  // 7. Enqueue render jobs for confirmed mints (MAJOR-2 fix)
  // -------------------------------------------------------------------------
  for (const s of submissions) {
    if (s.ok && s.treeId) {
      await enqueueRender(serviceClient, Number(s.tokenId), s.treeId, 'mint');
    }
  }

  // -------------------------------------------------------------------------
  // 8. Update seed_claims with minted token_ids (feeds idempotent replay)
  // -------------------------------------------------------------------------
  const mintedIds = submissions.filter(s => s.ok).map(s => Number(s.tokenId));
  if (mintedIds.length > 0) {
    const { error: updateErr } = await serviceClient
      .from('seed_claims')
      .update({ token_ids: mintedIds })
      .eq('tx_hash', normalizedTxHash);
    if (updateErr) {
      console.error('seed_claims token_ids update failed:', updateErr.message);
    }
  }

  // -------------------------------------------------------------------------
  // 9. Response
  // -------------------------------------------------------------------------
  const partial = submissions.some(s => !s.ok);

  return json({
    v: 2,
    ok: true,
    seeds,           // A5-1: server-generated seeds for client guest session init
    tokens: submissions.map(s => ({
      tokenId:    s.tokenId > 0n ? s.tokenId.toString() : null,
      treeId:     s.treeId,
      mintTxHash: s.mintTxHash ?? null,
      ok:         s.ok,
      ...(s.error ? { error: s.error } : {}),
    })),
    partial,
    ...(partial ? { claimRecorded: true } : {}),
  });
});
