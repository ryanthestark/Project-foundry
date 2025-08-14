// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

// Service-role client (server-only)
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * All helpers below are BEST-EFFORT and MUST NEVER throw.
 * They either insert into rag_logs or no-op if schema is missing.
 * This keeps route.ts working without further edits.
 */

// ---- Types (lightweight) ----
type AnyJson = Record<string, any>;
type MatchRow = { id?: string | number; source?: string; similarity?: number; metadata?: AnyJson; content?: string };

// Utility: safe vector(512) array
const zeros512 = () => new Array(512).fill(0);

// ---------- LOGGING PRIMITIVES (write to rag_logs) ----------
export async function logChatQuery(payload: AnyJson) {
  try {
    await supabaseAdmin.from('rag_logs').insert({
      query: String(payload.query ?? payload.requestId ?? 'UNKNOWN'),
      query_embedding: zeros512(),
      matches: [],
      response: { _type: 'chat_query', ...payload },
    });
  } catch (e) {
    console.error('[supabaseAdmin] logChatQuery failed (ignored):', e);
  }
}

export async function logResponse(payload: AnyJson) {
  try {
    await supabaseAdmin.from('rag_logs').insert({
      query: String(payload.requestId ?? payload.query ?? 'UNKNOWN'),
      query_embedding: zeros512(),
      matches: [],
      response: { _type: 'response', ...payload },
    });
  } catch (e) {
    console.error('[supabaseAdmin] logResponse failed (ignored):', e);
  }
}

export async function logMatches(payload: { requestId?: string; queryHash?: string; matches: { embeddingId?: any; source?: string; similarity?: number; rankPosition?: number }[] }) {
  try {
    await supabaseAdmin.from('rag_logs').insert({
      query: String(payload.requestId ?? payload.queryHash ?? 'UNKNOWN'),
      query_embedding: zeros512(),
      matches: payload.matches ?? [],
      response: { _type: 'matches', count: payload.matches?.length ?? 0 },
    });
  } catch (e) {
    console.error('[supabaseAdmin] logMatches failed (ignored):', e);
  }
}

export async function logTimestamp(payload: AnyJson) {
  try {
    await supabaseAdmin.from('rag_logs').insert({
      query: String(payload.entityId ?? payload.sessionId ?? 'UNKNOWN'),
      query_embedding: zeros512(),
      matches: [],
      response: { _type: 'timestamp', ...payload },
    });
  } catch (e) {
    console.error('[supabaseAdmin] logTimestamp failed (ignored):', e);
  }
}

export async function logRAGRequest(payload: AnyJson) {
  try {
    await supabaseAdmin.from('rag_logs').insert({
      query: String(payload.requestId ?? payload.query ?? 'UNKNOWN'),
      query_embedding: zeros512(),
      matches: (payload.matches as MatchRow[] | undefined) ?? [],
      response: { _type: 'rag_request', ...payload },
    });
  } catch (e) {
    console.error('[supabaseAdmin] logRAGRequest failed (ignored):', e);
  }
}

// ---------- QUERY EMBEDDING CACHE (optional table) ----------
/**
 * If you also create the optional `query_embeddings` table, these will use it.
 * If not present, they safely fall back to no-op / null.
 *
 * Suggested SQL (run once in Supabase SQL editor):
 *
 * create table if not exists public.query_embeddings (
 *   query_hash text primary key,
 *   query_text text not null,
 *   embedding vector(512) not null,
 *   model_name text not null,
 *   usage_count int not null default 1,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 * create index if not exists query_embeddings_embedding_ivfflat_idx
 *   on public.query_embeddings using ivfflat (embedding vector_l2_ops) with (lists = 100);
 */

export async function getQueryEmbedding(queryHash: string): Promise<null | { embedding: number[]; model_name: string; usage_count: number; query_text: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('query_embeddings')
      .select('embedding, model_name, usage_count, query_text')
      .eq('query_hash', queryHash)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return data as any;
  } catch (e) {
    // Table may not exist yet—safe fallback
    console.warn('[supabaseAdmin] getQueryEmbedding fallback (returning null):', (e as any)?.message ?? e);
    return null;
  }
}

export async function saveQueryEmbedding(args: {
  queryText: string;
  queryHash: string;
  embedding: number[];
  modelName: string;
  embeddingDimensions: number;
}) {
  try {
    await supabaseAdmin.from('query_embeddings').upsert({
      query_hash: args.queryHash,
      query_text: args.queryText,
      embedding: args.embedding,
      model_name: args.modelName,
      usage_count: 1,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    // Table may not exist yet—ignore
    console.warn('[supabaseAdmin] saveQueryEmbedding ignored:', (e as any)?.message ?? e);
  }
}

export async function findSimilarQueries(embedding: number[], _threshold = 0.9, limit = 3): Promise<{ query_text: string; similarity: number; usage_count: number }[]> {
  try {
    // If table exists, do a simple nearest-neighbor search using ivfflat
    // NOTE: You could also create an RPC; for simplicity, use a raw SQL call via RPC if you have one.
    const { data, error } = await supabaseAdmin.rpc('match_query_embeddings', {
      query_embedding: `[${embedding.join(',')}]`,
      match_count: limit,
    });

    if (error) throw error;
    if (!data) return [];
    // Expecting rows with query_text and similarity; if your RPC differs, adjust mapping.
    return (data as any[]).map((r) => ({
      query_text: r.query_text ?? '',
      similarity: r.similarity ?? 0,
      usage_count: r.usage_count ?? 1,
    }));
  } catch (e) {
    // RPC or table likely not present yet—fallback quietly
    console.warn('[supabaseAdmin] findSimilarQueries fallback (returning []):', (e as any)?.message ?? e);
    return [];
  }
}
