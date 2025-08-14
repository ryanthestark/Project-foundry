// src/scripts/ingest.ts

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { openai, EMBED_MODEL } from '../lib/openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function inferTypeFromFilename(filename: string): string {
  const normalized = filename.toLowerCase()
  if (normalized.includes('strategy')) return 'strategy'
  if (normalized.includes('briefing')) return 'briefing'
  if (normalized.includes('pipeline')) return 'pipeline'
  if (normalized.includes('analysis')) return 'analysis'
  if (normalized.includes('feature')) return 'feature'
  if (normalized.includes('summary')) return 'summary'
  if (normalized.includes('spec')) return 'spec'
  return 'note'
}

async function embedText(text: string) {
  const response = await openai.embeddings.create({
    input: text,
    model: EMBED_MODEL,
  })
  
  const embedding = response.data[0].embedding
  
  // Ensure embedding is exactly 1536 dimensions for vector(1536)
  if (embedding.length !== 1536) {
    throw new Error(`Embedding dimension mismatch: expected 1536, got ${embedding.length}`)
  }
  
  return embedding
}

async function ingestFile(filePath: string) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const filename = path.basename(filePath) // strips directories, just filename
    const embedding = await embedText(content)
    const type = inferTypeFromFilename(filename)

    console.log(`🔄 Processing ${filename} (${embedding.length} dimensions, type: ${type})`)

    const { error } = await supabase.from('embeddings').insert({
      content,
      source: filename,
      embedding,
      metadata: { type },
    })

    if (error) {
      console.error(`❌ Failed to ingest ${filename}:`, error)
    } else {
      console.log(`✅ Ingested ${filename} as type: ${type}`)
    }
  } catch (error) {
    console.error(`❌ Error processing ${path.basename(filePath)}:`, error.message)
  }
}

async function main() {
  const dir = path.join(process.cwd(), 'docs')
  const files = await fs.readdir(dir)

  for (const file of files) {
    const fullPath = path.join(dir, file)
    await ingestFile(fullPath)
  }

  console.log('🎉 All files ingested.')
}

main().catch(console.error)
