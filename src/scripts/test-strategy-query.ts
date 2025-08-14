// Test specific strategy query to validate RAG endpoint functionality

import 'dotenv/config'

async function testStrategyQuery() {
  console.log('🧪 Testing Strategy Query: "Summarize the strategy documents"\n')
  
  const query = "Summarize the strategy documents"
  
  // Test both with and without type filtering
  const testCases = [
    { name: 'With strategy filter', body: { query, type: 'strategy' } },
    { name: 'Without filter', body: { query } }
  ]
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🔍 Testing: ${testCase.name}`)
    console.log(`📝 Query: "${query}"`)
    console.log(`🏷️ Filter: ${testCase.body.type || 'none'}`)
    console.log('🔄 Making POST request to /api/chat/rag...')
    
    try {
      const startTime = Date.now()
      const response = await fetch('http://localhost:3000/api/chat/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.body)
      })
      const responseTime = Date.now() - startTime
    
      console.log(`📡 Response status: ${response.status} ${response.statusText}`)
      console.log(`⏱️ Response time: ${responseTime}ms`)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`)
      }
      
      const data = await response.json()
    
    // Validate response structure
    console.log('\n📋 Validating Response Structure:')
    
    if (!data.response || typeof data.response !== 'string') {
      throw new Error('❌ Missing or invalid response field')
    }
    console.log('✅ Response field: Present and valid')
    
    if (!data.sources || !Array.isArray(data.sources)) {
      throw new Error('❌ Missing or invalid sources field')
    }
    console.log('✅ Sources field: Present and valid array')
    
    if (!data.metadata || typeof data.metadata !== 'object') {
      throw new Error('❌ Missing or invalid metadata field')
    }
    console.log('✅ Metadata field: Present and valid')
    
    // Analyze response quality
    console.log('\n📊 Response Analysis:')
    const responseLength = data.response.length
    const sourceCount = data.sources.length
    const avgSimilarity = sourceCount > 0 
      ? data.sources.reduce((sum, s) => sum + (s.similarity || 0), 0) / sourceCount 
      : 0
    
    console.log(`📏 Response length: ${responseLength} characters`)
    console.log(`📚 Sources found: ${sourceCount}`)
    console.log(`🎯 Average similarity: ${avgSimilarity.toFixed(3)}`)
    console.log(`⏱️ Server duration: ${data.metadata.duration}ms`)
    console.log(`🔧 Models used: ${data.metadata.model?.embedding} + ${data.metadata.model?.chat}`)
    
    // Check for strategy-related content
    console.log('\n🔍 Content Analysis:')
    const responseText = data.response.toLowerCase()
    const strategyKeywords = ['strategy', 'strategic', 'business', 'plan', 'planning', 'goal', 'objective', 'vision', 'mission']
    const foundKeywords = strategyKeywords.filter(keyword => responseText.includes(keyword))
    
    console.log(`🔑 Strategy keywords found: ${foundKeywords.length}/${strategyKeywords.length}`)
    console.log(`📝 Keywords: ${foundKeywords.join(', ')}`)
    
    // Check if response is contextual
    const contextualIndicators = [
      'based on', 'according to', 'the document', 'documents show', 
      'information indicates', 'strategy', 'strategic'
    ]
    const isContextual = contextualIndicators.some(indicator => responseText.includes(indicator))
    console.log(`🧠 Contextual response: ${isContextual ? 'Yes' : 'No'}`)
    
    // Validate sources are strategy-related
    console.log('\n📄 Source Analysis:')
    if (sourceCount > 0) {
      console.log('🔍 Found sources:')
      data.sources.forEach((source, i) => {
        const isStrategySource = source.source.toLowerCase().includes('strategy') || 
                               source.type === 'strategy' ||
                               source.source.toLowerCase().includes('business')
        console.log(`   ${i + 1}. ${source.source} (similarity: ${source.similarity?.toFixed(3)}, type: ${source.type}) ${isStrategySource ? '✅' : '⚠️'}`)
      })
      
      const strategySourceCount = data.sources.filter(s => 
        s.source.toLowerCase().includes('strategy') || 
        s.type === 'strategy' ||
        s.source.toLowerCase().includes('business')
      ).length
      
      console.log(`📊 Strategy-related sources: ${strategySourceCount}/${sourceCount}`)
    } else {
      console.log('⚠️ No sources found - this may indicate an issue')
    }
    
    // Display response preview
    console.log('\n📖 Response Preview:')
    console.log('─'.repeat(60))
    console.log(data.response.slice(0, 500) + (data.response.length > 500 ? '\n...[truncated]' : ''))
    console.log('─'.repeat(60))
    
    // Quality checks
    console.log('\n🔍 Quality Checks:')
    const checks = [
      { name: 'Response length > 100 chars', passed: responseLength > 100 },
      { name: 'Sources found', passed: sourceCount > 0 },
      { name: 'Average similarity > 0.3', passed: avgSimilarity > 0.3 },
      { name: 'Contains strategy keywords', passed: foundKeywords.length > 0 },
      { name: 'Contextual response', passed: isContextual },
      { name: 'Response time < 10s', passed: responseTime < 10000 }
    ]
    
    let passedChecks = 0
    checks.forEach(check => {
      const status = check.passed ? '✅' : '❌'
      console.log(`${status} ${check.name}`)
      if (check.passed) passedChecks++
    })
    
    console.log(`\n📊 Quality Score: ${passedChecks}/${checks.length} checks passed`)
    
      // Final assessment for this test case
      if (passedChecks === checks.length) {
        console.log(`\n🎉 SUCCESS: ${testCase.name} passed completely!`)
      } else if (passedChecks >= checks.length * 0.8) {
        console.log(`\n✅ MOSTLY SUCCESS: ${testCase.name} mostly passed`)
        console.log(`⚠️ ${checks.length - passedChecks} quality checks failed`)
      } else {
        console.log(`\n❌ FAILURE: ${testCase.name} failed`)
      }
      
    } catch (error) {
      console.error(`\n❌ ${testCase.name} Failed:`, error.message)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('🏁 STRATEGY QUERY TEST COMPLETE')
  console.log('✅ The RAG endpoint should successfully:')
  console.log('   • Find relevant strategy documents')
  console.log('   • Generate contextual responses')
  console.log('   • Return proper source attribution')
  console.log('   • Handle both filtered and unfiltered queries')
  console.log('\n💡 If tests failed, check:')
  console.log('   • Server is running: npm run dev')
  console.log('   • Data is ingested: npm run ingest')
  console.log('   • Environment variables are set')
  console.log('   • OpenAI API credits and rate limits')
}

testStrategyQuery()
