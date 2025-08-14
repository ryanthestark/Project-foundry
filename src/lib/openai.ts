import OpenAI from 'openai'

export const EMBED_MODEL = 'text-embedding-3-small'
export const CHAT_MODEL = 'gpt-4o'
export const EMBEDDING_DIMENSIONS = 512 // Must match Supabase vector(512) schema

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Utility function to validate embedding dimensions
export function validateEmbeddingDimensions(embedding: number[]): void {
  if (!Array.isArray(embedding)) {
    throw new Error('Embedding must be an array')
  }
  
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}. ` +
      `This must match the Supabase vector(${EMBEDDING_DIMENSIONS}) schema.`
    )
  }
  
  const invalidValues = embedding.filter(val => typeof val !== 'number' || isNaN(val))
  if (invalidValues.length > 0) {
    throw new Error(`Found ${invalidValues.length} invalid values in embedding`)
  }
}
