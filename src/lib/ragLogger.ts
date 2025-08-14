import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type Match = {
  id?: string | number;
  score?: number;
  chunk?: string;
  metadata?: Record<string, any>;
};

export type RagLogPayload = {
  query: string;
  queryEmbedding: number[]; // length 512
  matches: Match[];
  response: any;            // final response you return to the client
};

export async function logRagEventNonBlocking(payload: RagLogPayload) {
  try {
    // Fire-and-forget: do not await (never block the user response)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    supabaseAdmin.from('rag_logs').insert({
      query: payload.query,
      query_embedding: payload.queryEmbedding,
      matches: payload.matches ?? [],
      response: payload.response ?? {},
    });
  } catch (e) {
    // Even setup errors must not throw
    console.error('[RAG_LOG][setup-error]', e);
  }
}

// Helper: safe array conversion if upstream uses Float32Array
export function toNumberArray512(vec: Float32Array | number[]): number[] {
  const arr = Array.isArray(vec) ? vec : Array.from(vec);
  if (arr.length !== 512) {
    console.warn('[RAG_LOG] queryEmbedding length != 512; got', arr.length);
  }
  return arr;
}
