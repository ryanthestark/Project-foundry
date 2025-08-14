
import 'dotenv/config'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { openai, EMBED_MODEL, CHAT_MODEL } from '../lib/openai'

async function validateEnvironment() {
  console.log('🔍 Validating Environment Variables...')
  
  const required = [
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
  
  for (const env of required) {
    if (!process.env[env]) {
      throw new Error(`❌ Missing: ${env}`)
    }
    console.log(`✅ ${env}: ${process.env[env]?.slice(0, 10)}...`)
  }
}

async function validateOpenAI() {
  console.log('🔍 Validating OpenAI Connection...')
  
  try {
    const response = await openai.embeddings.create({
      input: 'test',
      model: EMBED_MODEL,
      dimensions: 512
    })
    console.log(`✅ OpenAI Embeddings: ${EMBED_MODEL} (${response.data[0].embedding.length}D)`)
    
    const chat = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    })
    console.log(`✅ OpenAI Chat: ${CHAT_MODEL}`)
    
  } catch (error) {
    throw new Error(`❌ OpenAI Error: ${error.message}`)
  }
}

async function validateSupabase() {
  console.log('🔍 Validating Supabase Connection...')
  
  try {
    // Test basic connection
    const { data, error } = await supabaseAdmin
      .from('embeddings')
      .select('count(*)')
      .limit(1)
    
    if (error) throw error
    console.log('✅ Supabase Connection: OK')
    
    // Test embeddings table exists and has data
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from('embeddings')
      .select('id, source, metadata, created_at')
      .limit(5)
    
    if (tableError) throw tableError
    console.log(`✅ Embeddings Table: ${tableData?.length || 0} records found`)
    
    if (tableData && tableData.length > 0) {
      console.log('📊 Sample records:')
      tableData.forEach((record, i) => {
        console.log(`   ${i + 1}. ${record.source} (${record.metadata?.type || 'no-type'}) - ${record.created_at}`)
      })
    }
    
    // Test pgvector extension
    const { data: extensionData, error: extensionError } = await supabaseAdmin
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector')
      .single()
    
    if (extensionError && extensionError.code !== 'PGRST116') {
      console.warn('⚠️ Could not verify pgvector extension:', extensionError.message)
    } else if (extensionData) {
      console.log('✅ pgvector extension: Installed')
    }
    
    // Test RPC function with proper vector format
    const testEmbedding = new Array(512).fill(0.1)
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: testEmbedding,
        match_count: 3,
        similarity_threshold: 0.0
      })
    
    if (rpcError) throw rpcError
    console.log(`✅ match_embeddings RPC: Working (returned ${rpcData?.length || 0} results)`)
    
    if (rpcData && rpcData.length > 0) {
      console.log('🔍 Sample similarity scores:', rpcData.map(r => r.similarity?.toFixed(3)).join(', '))
    }
    
  } catch (error) {
    throw new Error(`❌ Supabase Error: ${error.message}`)
  }
}

async function main() {
  try {
    console.log('🚀 Starting RAG Pipeline Validation...\n')
    
    await validateEnvironment()
    console.log()
    
    await validateOpenAI()
    console.log()
    
    await validateSupabase()
    console.log()
    
    console.log('🎉 All validations passed! RAG pipeline is ready.')
    
  } catch (error) {
    console.error('\n💥 Validation failed:', error.message)
    process.exit(1)
  }
}

main()
