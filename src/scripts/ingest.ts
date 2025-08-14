// src/scripts/ingest.ts

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { openai, EMBED_MODEL, EMBEDDING_DIMENSIONS, validateEmbeddingDimensions } from '../lib/openai'

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
    dimensions: EMBEDDING_DIMENSIONS,
  })

  const embedding = response.data[0].embedding
  validateEmbeddingDimensions(embedding)
  return embedding
}

async function ingestFile(filePath: string) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const filename = path.basename(filePath)
    const embedding = await embedText(content)
    const type = inferTypeFromFilename(filename)

    console.log(`🔄 Processing ${filename} (${embedding.length} dimensions, type: ${type})`)

    const { error } = await supabaseAdmin.from('embeddings').insert({
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
  } catch (error: any) {
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

  console.log('✅ Environment variables validated')
  console.log(`🔐 SUPABASE URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
}

async function main() {
  try {
    console.log("🚀 Starting ingestion process...")

    await validateEnvironment()

    const { count, error: checkError } = await supabaseAdmin
      .from('embeddings')
      .select('*', { count: 'exact', head: true })

    if (checkError) {
      console.error('❌ Could not check embeddings table:', checkError.message)
      console.log('💡 Make sure to run the SQL setup scripts first:')
      console.log('   1. sql/create_embeddings_table.sql')
      console.log('   2. sql/match_embeddings_function.sql')
      throw new Error('Database not ready for ingestion')
    }

    console.log(`📊 Existing records in database: ${count}`)

    const dir = path.join(process.cwd(), 'docs')
    console.log(`📁 Reading directory: ${dir}`)

    let files: string[] = []
    try {
      files = await fs.readdir(dir)
    } catch (error: any) {
      throw new Error(`Failed to read docs directory: ${error.message}`)
    }

    const textFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase()
      return ['.md', '.txt', '.json'].includes(ext) || !ext
    })

    console.log(`📄 Found ${files.length} total files, ${textFiles.length} text files to process`)

    let successCount = 0
    let errorCount = 0

    for (const file of textFiles) {
      const fullPath = path.join(dir, file)

      try {
        const stats = await fs.stat(fullPath)
        if (!stats.isFile()) {
          console.log(`⏭️ Skipping directory: ${file}`)
          continue
        }
      } catch (error: any) {
        console.error(`❌ Error checking file stats for ${file}:`, error.message)
        errorCount++
        continue
      }

      try {
        await ingestFile(fullPath)
        successCount++
        await new Promise(resolve => setTimeout(resolve, 100)) // Delay for rate limiting
      } catch (error: any) {
        console.error(`❌ Failed to ingest ${file}:`, error.message)
        errorCount++
      }
    }

    console.log(`\n🎉 Ingestion complete!`)
    console.log(`✅ Success: ${successCount}`)
    console.log(`❌ Errors: ${errorCount}`)

    const { data: finalCount } = await supabaseAdmin
      .from('embeddings')
      .select('metadata')

    if (finalCount) {
      const typeStats = finalCount.reduce<Record<string, number>>((acc, record: any) => {
        const type = record.metadata?.type || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})

      console.log(`📊 Final breakdown by type:`)
      Object.entries(typeStats).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} records`)
      })
    }

  } catch (error: any) {
    console.error("❌ Ingestion process failed:", error.message)
    process.exit(1)
  }
}

main().catch(console.error)
