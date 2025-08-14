// Comprehensive validation of the complete RAG pipeline flow

import 'dotenv/config'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { openai, EMBED_MODEL, CHAT_MODEL } from '../lib/openai'

async function validateFullRAGFlow() {
  console.log('🚀 COMPREHENSIVE RAG PIPELINE VALIDATION\n')
  console.log('=' .repeat(60))
  console.log('This script validates the complete RAG flow:')
  console.log('1. Environment & Dependencies')
  console.log('2. Embedding Generation')
  console.log('3. Vector Database & Search')
  console.log('4. Contextual Response Generation')
  console.log('5. End-to-End Integration')
  console.log('=' .repeat(60))
  console.log()
  
  let overallSuccess = true
  const results = {
    environment: false,
    embeddings: false,
    vectorSearch: false,
    contextualResponse: false,
    endToEnd: false
  }
  
  // STEP 1: Environment Validation
  console.log('🔍 STEP 1: Environment & Dependencies Validation')
  console.log('-'.repeat(50))
  
  try {
    // Check environment variables
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`)
      }
      console.log(`✅ ${envVar}: ${process.env[envVar]?.slice(0, 10)}...`)
    }
    
    // Test basic OpenAI connection
    const testEmbed = await openai.embeddings.create({
      input: 'test connection',
      model: EMBED_MODEL,
      dimensions: 512
    })
    console.log(`✅ OpenAI Embeddings API: Connected (${EMBED_MODEL})`)
    
    const testChat = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5
    })
    console.log(`✅ OpenAI Chat API: Connected (${CHAT_MODEL})`)
    
    // Test Supabase connection
    const { data: dbTest, error: dbError } = await supabaseAdmin
      .from('embeddings')
      .select('count(*)')
      .limit(1)
    
    if (dbError) throw new Error(`Supabase connection failed: ${dbError.message}`)
    console.log('✅ Supabase Database: Connected')
    
    results.environment = true
    console.log('🎉 STEP 1 PASSED: Environment is properly configured\n')
    
  } catch (error) {
    console.error('❌ STEP 1 FAILED:', error.message)
    console.log('💡 Fix: Check your .env file and API keys\n')
    overallSuccess = false
  }
  
  // STEP 2: Embedding Generation Validation
  console.log('🔍 STEP 2: Embedding Generation Validation')
  console.log('-'.repeat(50))
  
  try {
    const testTexts = [
      'Short business strategy text',
      'This is a longer document about product development and market analysis that contains multiple sentences and covers various business topics.',
      'Special characters: @#$%^&*()',
      ''
    ]
    
    for (const [index, text] of testTexts.entries()) {
      const response = await openai.embeddings.create({
        input: text,
        model: EMBED_MODEL,
        dimensions: 512
      })
      
      const embedding = response.data[0].embedding
      
      // Validate embedding properties
      if (!Array.isArray(embedding) || embedding.length !== 512) {
        throw new Error(`Invalid embedding for test ${index + 1}: expected 512D array`)
      }
      
      const invalidValues = embedding.filter(val => typeof val !== 'number' || isNaN(val))
      if (invalidValues.length > 0) {
        throw new Error(`Invalid values in embedding ${index + 1}: ${invalidValues.length} non-numeric values`)
      }
      
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
      console.log(`✅ Test ${index + 1}: ${text.length} chars → 512D embedding (magnitude: ${magnitude.toFixed(4)})`)
    }
    
    // Test batch embedding
    const batchResponse = await openai.embeddings.create({
      input: ['First doc', 'Second doc', 'Third doc'],
      model: EMBED_MODEL,
      dimensions: 512
    })
    
    if (batchResponse.data.length !== 3) {
      throw new Error('Batch embedding failed')
    }
    console.log('✅ Batch embedding: 3 documents processed successfully')
    
    results.embeddings = true
    console.log('🎉 STEP 2 PASSED: Embedding generation is working correctly\n')
    
  } catch (error) {
    console.error('❌ STEP 2 FAILED:', error.message)
    console.log('💡 Fix: Check OpenAI API key and model availability\n')
    overallSuccess = false
  }
  
  // STEP 3: Vector Database & Search Validation
  console.log('🔍 STEP 3: Vector Database & Search Validation')
  console.log('-'.repeat(50))
  
  try {
    // Check if embeddings table has data
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from('embeddings')
      .select('id, source, metadata')
      .limit(5)
    
    if (tableError) throw new Error(`Table access failed: ${tableError.message}`)
    
    if (!tableData || tableData.length === 0) {
      console.log('⚠️ No data in embeddings table')
      console.log('💡 Run: npx tsx src/scripts/ingest.ts')
      throw new Error('No data available for vector search testing')
    }
    
    console.log(`✅ Embeddings table: ${tableData.length} sample records found`)
    console.log(`✅ Available sources: ${tableData.map(r => r.source).join(', ')}`)
    
    // Test RPC function with real embedding
    const testQuery = 'business strategy and planning'
    const embedResponse = await openai.embeddings.create({
      input: testQuery,
      model: EMBED_MODEL,
      dimensions: 512
    })
    
    const queryEmbedding = embedResponse.data[0].embedding
    
    // Test basic RPC call
    const vectorString = `[${queryEmbedding.join(',')}]`
    const { data: matches, error: rpcError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: vectorString,
        match_count: 5,
        similarity_threshold: 0.1
      })
    
    if (rpcError) throw new Error(`RPC function failed: ${rpcError.message}`)
    
    console.log(`✅ Vector search: Found ${matches?.length || 0} matches`)
    
    if (matches && matches.length > 0) {
      console.log('✅ Top matches:')
      matches.slice(0, 3).forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.source} (similarity: ${match.similarity?.toFixed(3)})`)
      })
      
      // Validate match structure
      const requiredFields = ['id', 'content', 'source', 'metadata', 'similarity']
      const missingFields = requiredFields.filter(field => !(field in matches[0]))
      if (missingFields.length > 0) {
        throw new Error(`Missing fields in match result: ${missingFields.join(', ')}`)
      }
      console.log('✅ Match structure: All required fields present')
    }
    
    // Test type filtering
    const availableTypes = [...new Set(tableData.map(r => r.metadata?.type).filter(Boolean))]
    if (availableTypes.length > 0) {
      const testType = availableTypes[0]
      const { data: filtered, error: filterError } = await supabaseAdmin
        .rpc('match_embeddings', {
          query_embedding: vectorString,
          match_count: 5,
          similarity_threshold: 0.0,
          filter_type: testType
        })
      
      if (filterError) throw new Error(`Type filtering failed: ${filterError.message}`)
      console.log(`✅ Type filtering: ${filtered?.length || 0} results for type '${testType}'`)
    }
    
    results.vectorSearch = true
    console.log('🎉 STEP 3 PASSED: Vector database and search are working correctly\n')
    
  } catch (error) {
    console.error('❌ STEP 3 FAILED:', error.message)
    console.log('💡 Fix: Run SQL setup scripts and ingestion\n')
    overallSuccess = false
  }
  
  // STEP 4: Contextual Response Generation (requires server)
  console.log('🔍 STEP 4: Contextual Response Generation Validation')
  console.log('-'.repeat(50))
  
  try {
    const testQueries = [
      { query: 'What is the main business strategy?', type: null },
      { query: 'Tell me about product features', type: 'feature' },
      { query: 'Provide an analysis of the current situation', type: 'analysis' }
    ]
    
    let successfulQueries = 0
    
    for (const test of testQueries) {
      try {
        const response = await fetch('http://localhost:3000/api/chat/rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: test.query,
            ...(test.type && { type: test.type })
          })
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        // Validate response structure
        if (!data.response || typeof data.response !== 'string') {
          throw new Error('Invalid response structure')
        }
        
        if (!Array.isArray(data.sources)) {
          throw new Error('Invalid sources structure')
        }
        
        const responseLength = data.response.length
        const sourceCount = data.sources.length
        const avgSimilarity = sourceCount > 0 
          ? data.sources.reduce((sum, s) => sum + (s.similarity || 0), 0) / sourceCount 
          : 0
        
        console.log(`✅ Query: "${test.query.slice(0, 40)}..."`)
        console.log(`   Response: ${responseLength} chars, ${sourceCount} sources, avg similarity: ${avgSimilarity.toFixed(3)}`)
        
        successfulQueries++
        
      } catch (queryError) {
        console.error(`❌ Query failed: ${test.query.slice(0, 40)}... - ${queryError.message}`)
      }
    }
    
    if (successfulQueries === 0) {
      throw new Error('No queries succeeded - server may not be running')
    }
    
    console.log(`✅ Contextual responses: ${successfulQueries}/${testQueries.length} queries successful`)
    
    results.contextualResponse = true
    console.log('🎉 STEP 4 PASSED: Contextual response generation is working\n')
    
  } catch (error) {
    console.error('❌ STEP 4 FAILED:', error.message)
    console.log('💡 Fix: Make sure server is running with "npm run dev"\n')
    overallSuccess = false
  }
  
  // STEP 5: End-to-End Integration Test
  console.log('🔍 STEP 5: End-to-End Integration Test')
  console.log('-'.repeat(50))
  
  try {
    const integrationQuery = 'What are the key strategic priorities and how do they relate to our product development roadmap?'
    
    console.log(`🔄 Testing complex query: "${integrationQuery}"`)
    
    const startTime = Date.now()
    const response = await fetch('http://localhost:3000/api/chat/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: integrationQuery })
    })
    const totalTime = Date.now() - startTime
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    
    const data = await response.json()
    
    // Comprehensive validation
    const validations = [
      { check: data.response && data.response.length > 100, name: 'Response length > 100 chars' },
      { check: Array.isArray(data.sources) && data.sources.length > 0, name: 'Sources found' },
      { check: data.metadata && data.metadata.duration, name: 'Metadata present' },
      { check: data.sources.every(s => s.similarity > 0), name: 'Valid similarity scores' },
      { check: totalTime < 30000, name: 'Response time < 30s' }
    ]
    
    let passedValidations = 0
    for (const validation of validations) {
      if (validation.check) {
        console.log(`✅ ${validation.name}`)
        passedValidations++
      } else {
        console.log(`❌ ${validation.name}`)
      }
    }
    
    if (passedValidations < validations.length) {
      throw new Error(`Only ${passedValidations}/${validations.length} validations passed`)
    }
    
    console.log(`✅ Integration test: All validations passed`)
    console.log(`✅ Performance: ${totalTime}ms total, ${data.metadata.duration}ms server-side`)
    console.log(`✅ Quality: ${data.response.length} char response from ${data.sources.length} sources`)
    
    results.endToEnd = true
    console.log('🎉 STEP 5 PASSED: End-to-end integration is working perfectly\n')
    
  } catch (error) {
    console.error('❌ STEP 5 FAILED:', error.message)
    console.log('💡 Fix: Check all previous steps and server status\n')
    overallSuccess = false
  }
  
  // FINAL RESULTS
  console.log('🏁 FINAL RAG PIPELINE VALIDATION RESULTS')
  console.log('=' .repeat(60))
  
  const stepResults = [
    { name: 'Environment & Dependencies', passed: results.environment },
    { name: 'Embedding Generation', passed: results.embeddings },
    { name: 'Vector Database & Search', passed: results.vectorSearch },
    { name: 'Contextual Response Generation', passed: results.contextualResponse },
    { name: 'End-to-End Integration', passed: results.endToEnd }
  ]
  
  stepResults.forEach((step, index) => {
    const status = step.passed ? '✅ PASS' : '❌ FAIL'
    console.log(`${index + 1}. ${step.name}: ${status}`)
  })
  
  const passedSteps = stepResults.filter(s => s.passed).length
  const totalSteps = stepResults.length
  
  console.log()
  console.log(`📊 Overall Score: ${passedSteps}/${totalSteps} steps passed`)
  
  if (overallSuccess && passedSteps === totalSteps) {
    console.log('🎉 SUCCESS: RAG pipeline is fully functional!')
    console.log()
    console.log('✅ Your RAG system can:')
    console.log('   • Generate embeddings from text queries')
    console.log('   • Search vector database for relevant content')
    console.log('   • Generate contextual responses using retrieved information')
    console.log('   • Handle type filtering and similarity thresholds')
    console.log('   • Process end-to-end requests efficiently')
    console.log()
    console.log('🚀 Ready for production use!')
    
  } else {
    console.log('❌ FAILURE: RAG pipeline has issues that need to be resolved')
    console.log()
    console.log('💡 Next steps:')
    if (!results.environment) console.log('   • Fix environment variables and API keys')
    if (!results.embeddings) console.log('   • Check OpenAI API access and model availability')
    if (!results.vectorSearch) console.log('   • Run SQL setup scripts and data ingestion')
    if (!results.contextualResponse) console.log('   • Start development server with "npm run dev"')
    if (!results.endToEnd) console.log('   • Debug integration issues and performance')
    
    process.exit(1)
  }
}

validateFullRAGFlow().catch(error => {
  console.error('💥 Validation script crashed:', error.message)
  process.exit(1)
})
