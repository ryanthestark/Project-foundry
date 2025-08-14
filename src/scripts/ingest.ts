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
  
  // Ensure embedding is exactly 512 dimensions for vector(512)
  if (embedding.length !== 512) {
    throw new Error(`Embedding dimension mismatch: expected 512, got ${embedding.length}`)
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

async function validateEnvironment() {
  const required = [
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
  
  for (const env of required) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`)
    }
  }
  
  console.log("✅ Environment variables validated")
}

async function main() {
  try {
    console.log("🚀 Starting ingestion process...")
    
    // Validate environment
    await validateEnvironment()
    
    const dir = path.join(process.cwd(), 'docs')
    console.log(`📁 Reading directory: ${dir}`)
    
    let files
    try {
      files = await fs.readdir(dir)
    } catch (error) {
      throw new Error(`Failed to read docs directory: ${error.message}`)
    }
    
    console.log(`📄 Found ${files.length} files to process`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const file of files) {
      const fullPath = path.join(dir, file)
      
      // Check if it's a file (not directory)
      try {
        const stats = await fs.stat(fullPath)
        if (!stats.isFile()) {
          console.log(`⏭️ Skipping directory: ${file}`)
          continue
        }
      } catch (error) {
        console.error(`❌ Error checking file stats for ${file}:`, error.message)
        errorCount++
        continue
      }
      
      try {
        await ingestFile(fullPath)
        successCount++
      } catch (error) {
        console.error(`❌ Failed to ingest ${file}:`, error.message)
        errorCount++
      }
    }

    console.log(`🎉 Ingestion complete! Success: ${successCount}, Errors: ${errorCount}`)
  } catch (error) {
    console.error("❌ Ingestion process failed:", error.message)
    process.exit(1)
  }
}

main().catch(console.error)
