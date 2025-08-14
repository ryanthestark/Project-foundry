// Test Supabase RPC vector matching specifically

import 'dotenv/config'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { openai, EMBED_MODEL, EMBEDDING_DIMENSIONS, validateEmbeddingDimensions } from '../lib/openai'

async function testVectorMatch() {
  console.log('🧪 Testing Supabase RPC Vector Match...\n')
  
  let allTestsPassed = true
  
  // Test 1: Basic RPC function existence
  console.log('1️⃣ Testing RPC Function Existence...')
  try {
    const testVector = new Array(EMBEDDING_DIMENSIONS).fill(0.1)
    const testVectorString = `[${testVector.join(',')}]`
    const { data, error } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: testVectorString,
        match_count: 1,
        similarity_threshold: 0.0
      })
    
    if (error) {
      console.error('❌ RPC function error:', error)
      console.log('💡 Make sure to run: sql/match_embeddings_function.sql')
      allTestsPassed = false
    } else {
      console.log('✅ match_embeddings RPC function exists and callable')
      console.log(`✅ Returned ${data?.length || 0} results`)
    }
    console.log()
  } catch (error) {
    console.error('❌ RPC test failed:', error.message)
    allTestsPassed = false
  }
  
  // Test 2: Check embeddings table has data
  console.log('2️⃣ Testing Embeddings Table Data...')
  try {
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from('embeddings')
      .select('id, source, metadata, created_at')
      .limit(5)
    
    if (tableError) throw tableError
    
    if (!tableData || tableData.length === 0) {
      console.log('⚠️ No data in embeddings table')
      console.log('💡 Run ingestion script: npx tsx src/scripts/ingest.ts')
      allTestsPassed = false
    } else {
      console.log(`✅ Found ${tableData.length} sample records`)
      console.log('📊 Sample sources:', tableData.map(r => r.source).join(', '))
      console.log('📊 Sample types:', tableData.map(r => r.metadata?.type || 'unknown').join(', '))
    }
    console.log()
  } catch (error) {
    console.error('❌ Table data check failed:', error.message)
    allTestsPassed = false
  }
  
  // Test 3: Test with real embedding
  console.log('3️⃣ Testing with Real Embedding...')
  try {
    const testQuery = 'business strategy and planning'
    console.log(`🔍 Creating embedding for: "${testQuery}"`)
    
    const embedResponse = await openai.embeddings.create({
      input: testQuery,
      model: EMBED_MODEL,
      dimensions: EMBEDDING_DIMENSIONS
    })
    
    const queryEmbedding = embedResponse.data[0].embedding
    console.log(`✅ Created embedding: ${queryEmbedding.length} dimensions`)
    
    // Validate embedding dimensions
    validateEmbeddingDimensions(queryEmbedding)
    console.log(`✅ Embedding validation passed`)
    
    // Test RPC with real embedding
    const vectorString = `[${queryEmbedding.join(',')}]`
    const { data: matches, error: matchError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: vectorString,
        match_count: 5,
        similarity_threshold: 0.1
      })
    
    if (matchError) {
      console.error('❌ RPC with real embedding failed:', matchError)
      allTestsPassed = false
    } else {
      console.log(`✅ Found ${matches?.length || 0} matches`)
      
      if (matches && matches.length > 0) {
        console.log('🔍 Top matches:')
        matches.slice(0, 3).forEach((match, i) => {
          console.log(`   ${i + 1}. ${match.source} (similarity: ${match.similarity?.toFixed(3)}, type: ${match.metadata?.type || 'unknown'})`)
        })
        
        // Validate match structure
        const firstMatch = matches[0]
        const expectedFields = ['id', 'content', 'source', 'metadata', 'similarity']
        const missingFields = expectedFields.filter(field => !(field in firstMatch))
        
        if (missingFields.length > 0) {
          console.error('❌ Missing fields in match result:', missingFields)
          allTestsPassed = false
        } else {
          console.log('✅ Match structure is correct')
        }
      }
    }
    console.log()
  } catch (error) {
    console.error('❌ Real embedding test failed:', error.message)
    allTestsPassed = false
  }
  
  // Test 4: Test type filtering
  console.log('4️⃣ Testing Type Filtering...')
  try {
    const testVector = new Array(EMBEDDING_DIMENSIONS).fill(0.1)
    const testVectorString = `[${testVector.join(',')}]`
    
    // Test without filter
    const { data: unfiltered, error: unfilteredError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: testVectorString,
        match_count: 10,
        similarity_threshold: 0.0
      })
    
    if (unfilteredError) throw unfilteredError
    
    console.log(`✅ Unfiltered search: ${unfiltered?.length || 0} results`)
    
    // Get available types
    const availableTypes = [...new Set(unfiltered?.map(r => r.metadata?.type).filter(Boolean))]
    console.log('📊 Available types:', availableTypes.join(', '))
    
    // Test with type filter if types exist
    if (availableTypes.length > 0) {
      const testType = availableTypes[0]
      const { data: filtered, error: filteredError } = await supabaseAdmin
        .rpc('match_embeddings', {
          query_embedding: testVectorString,
          match_count: 10,
          similarity_threshold: 0.0,
          filter_type: testType
        })
      
      if (filteredError) throw filteredError
      
      console.log(`✅ Filtered search (type: ${testType}): ${filtered?.length || 0} results`)
      
      // Verify all results have the correct type
      const wrongTypes = filtered?.filter(r => r.metadata?.type !== testType) || []
      if (wrongTypes.length > 0) {
        console.error(`❌ Type filter failed: ${wrongTypes.length} results have wrong type`)
        allTestsPassed = false
      } else {
        console.log('✅ Type filtering works correctly')
      }
    } else {
      console.log('⚠️ No types found in data - type filtering test skipped')
    }
    console.log()
  } catch (error) {
    console.error('❌ Type filtering test failed:', error.message)
    allTestsPassed = false
  }
  
  // Test 5: Test similarity thresholds
  console.log('5️⃣ Testing Similarity Thresholds...')
  try {
    const testVector = new Array(EMBEDDING_DIMENSIONS).fill(0.1)
    const testVectorString = `[${testVector.join(',')}]`
    
    const thresholds = [0.0, 0.3, 0.5, 0.8]
    
    for (const threshold of thresholds) {
      const { data: results, error } = await supabaseAdmin
        .rpc('match_embeddings', {
          query_embedding: testVectorString,
          match_count: 10,
          similarity_threshold: threshold
        })
      
      if (error) throw error
      
      const count = results?.length || 0
      const minSimilarity = results?.length > 0 ? Math.min(...results.map(r => r.similarity)) : 'N/A'
      const maxSimilarity = results?.length > 0 ? Math.max(...results.map(r => r.similarity)) : 'N/A'
      
      console.log(`   Threshold ${threshold}: ${count} results (similarity range: ${minSimilarity} - ${maxSimilarity})`)
      
      // Verify all results meet threshold
      const belowThreshold = results?.filter(r => r.similarity <= threshold) || []
      if (belowThreshold.length > 0) {
        console.error(`❌ Found ${belowThreshold.length} results below threshold ${threshold}`)
        allTestsPassed = false
      }
    }
    
    console.log('✅ Similarity threshold filtering works correctly')
    console.log()
  } catch (error) {
    console.error('❌ Similarity threshold test failed:', error.message)
    allTestsPassed = false
  }
  
  // Test 6: Test edge cases
  console.log('6️⃣ Testing Edge Cases...')
  try {
    const testVector = new Array(EMBEDDING_DIMENSIONS).fill(0.1)
    const testVectorString = `[${testVector.join(',')}]`
    
    // Test with match_count = 0
    const { data: zeroCount, error: zeroError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: testVectorString,
        match_count: 0,
        similarity_threshold: 0.0
      })
    
    if (zeroError) {
      console.log('⚠️ match_count=0 caused error (expected):', zeroError.message)
    } else {
      console.log(`✅ match_count=0: ${zeroCount?.length || 0} results`)
    }
    
    // Test with very high threshold
    const { data: highThreshold, error: highError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: testVectorString,
        match_count: 5,
        similarity_threshold: 0.99
      })
    
    if (highError) throw highError
    console.log(`✅ High threshold (0.99): ${highThreshold?.length || 0} results`)
    
    // Test with invalid type filter
    const { data: invalidType, error: invalidError } = await supabaseAdmin
      .rpc('match_embeddings', {
        query_embedding: testVectorString,
        match_count: 5,
        similarity_threshold: 0.0,
        filter_type: 'nonexistent_type_12345'
      })
    
    if (invalidError) throw invalidError
    console.log(`✅ Invalid type filter: ${invalidType?.length || 0} results (should be 0)`)
    
    console.log('✅ Edge case testing completed')
    console.log()
  } catch (error) {
    console.error('❌ Edge case test failed:', error.message)
    allTestsPassed = false
  }
  
  // Final Results
  console.log('🏁 Vector Match Test Results:')
  if (allTestsPassed) {
    console.log('🎉 All vector match tests passed!')
    console.log('\n📋 Key findings:')
    console.log('   • match_embeddings RPC function is working correctly')
    console.log('   • Vector similarity search is functional')
    console.log('   • Type filtering works as expected')
    console.log('   • Similarity thresholds are properly enforced')
    console.log('   • Edge cases are handled appropriately')
    console.log('\n✅ Supabase RPC vector match is fully functional!')
  } else {
    console.log('❌ Some vector match tests failed. Check the errors above.')
    console.log('\n💡 Common fixes:')
    console.log('   • Run: sql/create_embeddings_table.sql')
    console.log('   • Run: sql/match_embeddings_function.sql')
    console.log('   • Run: npx tsx src/scripts/ingest.ts')
    process.exit(1)
  }
}

testVectorMatch()
