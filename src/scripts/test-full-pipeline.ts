// Comprehensive end-to-end test of the RAG pipeline

import 'dotenv/config'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { openai, EMBED_MODEL, CHAT_MODEL } from '../lib/openai'

async function testFullPipeline() {
  console.log('🚀 Starting Full RAG Pipeline Test\n')
  
  let allTestsPassed = true
  
  // Test 1: Environment and Dependencies
  console.log('1️⃣ Testing Environment and Dependencies...')
  try {
    const required = ['OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    for (const env of required) {
      if (!process.env[env]) throw new Error(`Missing ${env}`)
    }
    console.log('✅ Environment variables: OK\n')
  } catch (error) {
    console.error('❌ Environment test failed:', error.message)
    allTestsPassed = false
  }
  
  // Test 2: OpenAI Connection
  console.log('2️⃣ Testing OpenAI Connection...')
  try {
    const embedTest = await openai.embeddings.create({
      input: 'test embedding',
      model: EMBED_MODEL,
      dimensions: 512
    })
    
    const chatTest = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5
    })
    
    console.log(`✅ OpenAI: ${EMBED_MODEL} (${embedTest.data[0].embedding.length}D) + ${CHAT_MODEL}`)
    console.log(`✅ Test response: "${chatTest.choices[0].message.content}"\n`)
  } catch (error) {
    console.error('❌ OpenAI test failed:', error.message)
    allTestsPassed = false
  }
  
  // Test 3: Database Connection and Schema
  console.log('3️⃣ Testing Database Connection and Schema...')
  try {
    const { data: tableTest, error: tableError } = await supabaseAdmin
      .from('embeddings')
      .select('count(*)')
      .limit(1)
    
    if (tableError) throw tableError
    
    const { data: records } = await supabaseAdmin
      .from('embeddings')
      .select('id, source, metadata')
      .limit(3)
    
    console.log(`✅ Database connection: OK`)
    console.log(`✅ Embeddings table: ${records?.length || 0} sample records found\n`)
  } catch (error) {
    console.error('❌ Database test failed:', error.message)
    console.log('💡 Run: sql/create_embeddings_table.sql and sql/match_embeddings_function.sql')
    allTestsPassed = false
  }
  
  // Test 4: Vector Similarity Function
  console.log('4️⃣ Testing Vector Similarity Function...')
  try {
    const testVector = new Array(512).fill(0.1)
    const testVectorString = `[${testVector.join(',')}]`
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: testVectorString,
        match_count: 2,
        similarity_threshold: 0.0
      })
    
    if (rpcError) throw rpcError
    
    console.log(`✅ match_embeddings RPC: Working (${rpcResult?.length || 0} results)`)
    if (rpcResult && rpcResult.length > 0) {
      console.log(`✅ Sample similarity: ${rpcResult[0].similarity?.toFixed(3)}`)
    }
    console.log()
  } catch (error) {
    console.error('❌ RPC function test failed:', error.message)
    console.log('💡 Run: sql/match_embeddings_function.sql')
    allTestsPassed = false
  }
  
  // Test 5: RAG Endpoint (if server is running)
  console.log('5️⃣ Testing RAG Endpoint...')
  try {
    const testQuery = 'What is the main business strategy?'
    const response = await fetch('http://localhost:3000/api/chat/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: testQuery })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    
    const data = await response.json()
    
    console.log('✅ RAG endpoint: Working')
    console.log(`✅ Response length: ${data.response?.length || 0} chars`)
    console.log(`✅ Sources found: ${data.sources?.length || 0}`)
    console.log(`✅ Duration: ${data.metadata?.duration || 'unknown'}ms`)
    console.log()
    
  } catch (error) {
    console.error('❌ RAG endpoint test failed:', error.message)
    console.log('💡 Make sure server is running: npm run dev')
    allTestsPassed = false
  }
  
  // Test 6: Data Quality Check
  console.log('6️⃣ Testing Data Quality...')
  try {
    const { data: qualityCheck } = await supabaseAdmin
      .from('embeddings')
      .select('source, metadata, content')
      .limit(10)
    
    if (qualityCheck && qualityCheck.length > 0) {
      const avgContentLength = qualityCheck.reduce((sum, r) => sum + (r.content?.length || 0), 0) / qualityCheck.length
      const typesFound = [...new Set(qualityCheck.map(r => r.metadata?.type).filter(Boolean))]
      
      console.log(`✅ Data quality: ${qualityCheck.length} records checked`)
      console.log(`✅ Average content length: ${Math.round(avgContentLength)} chars`)
      console.log(`✅ Document types: ${typesFound.join(', ')}`)
      console.log()
    } else {
      console.log('⚠️ No data found - run ingestion script: npx tsx src/scripts/ingest.ts')
    }
  } catch (error) {
    console.error('❌ Data quality check failed:', error.message)
    allTestsPassed = false
  }
  
  // Final Results
  console.log('🏁 Full Pipeline Test Results:')
  if (allTestsPassed) {
    console.log('🎉 All tests passed! RAG pipeline is fully functional.')
    console.log('\n📋 Next steps:')
    console.log('   • Run ingestion if no data: npx tsx src/scripts/ingest.ts')
    console.log('   • Start dev server: npm run dev')
    console.log('   • Test queries: npx tsx src/scripts/test-rag.ts')
  } else {
    console.log('❌ Some tests failed. Check the errors above and fix them.')
    process.exit(1)
  }
}

testFullPipeline()
