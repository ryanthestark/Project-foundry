// Test response grounding specifically

import 'dotenv/config'

async function testResponseGrounding() {
  console.log('🧪 Testing Response Grounding...\n')
  
  const testCases = [
    {
      name: 'Query with available context',
      query: 'What is the business strategy mentioned in the documents?',
      type: 'strategy',
      expectGrounded: true
    },
    {
      name: 'Query with no relevant context',
      query: 'What is the weather like today?',
      type: null,
      expectGrounded: false,
      expectLimitation: true
    },
    {
      name: 'Specific document query',
      query: 'What specific features are mentioned in the feature documents?',
      type: 'feature',
      expectGrounded: true,
      expectQuotes: true
    },
    {
      name: 'Broad query requiring synthesis',
      query: 'Summarize all the key information across all document types',
      type: null,
      expectGrounded: true,
      expectMultipleSources: true
    }
  ]
  
  let allTestsPassed = true
  
  for (const testCase of testCases) {
    console.log(`🔍 Testing: ${testCase.name}`)
    console.log(`📝 Query: "${testCase.query}"`)
    console.log(`🏷️ Type filter: ${testCase.type || 'none'}`)
    console.log(`🎯 Expected: ${testCase.expectGrounded ? 'Grounded' : 'Ungrounded'} response`)
    
    try {
      const response = await fetch('http://localhost:3000/api/chat/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: testCase.query,
          ...(testCase.type && { type: testCase.type })
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`)
      }
      
      const data = await response.json()
      
      // Analyze grounding
      const responseText = data.response.toLowerCase()
      const sourceCount = data.sources?.length || 0
      
      // Check grounding indicators
      const groundingIndicators = [
        'based on', 'according to', 'the document', 'documents show',
        'information shows', 'source', 'as stated', 'from the'
      ]
      const hasGroundingLanguage = groundingIndicators.some(indicator => 
        responseText.includes(indicator)
      )
      
      // Check for quotes
      const hasQuotes = data.response.includes('"') || data.response.includes("'")
      
      // Check for limitation acknowledgment
      const limitationIndicators = [
        "don't have", "not enough", "limited information", "insufficient", 
        "cannot determine", "unclear", "would need more", "no relevant information"
      ]
      const acknowledgesLimitations = limitationIndicators.some(indicator =>
        responseText.includes(indicator)
      )
      
      // Check for ungrounded claims
      const ungroundedPatterns = [
        'in general', 'typically', 'usually', 'commonly',
        'it is known that', 'research shows', 'studies indicate'
      ]
      const hasUngroundedClaims = ungroundedPatterns.some(pattern =>
        responseText.includes(pattern)
      )
      
      // Grounding score from metadata if available
      const groundingScore = data.metadata?.grounding?.score || 0
      
      console.log('\n📊 Grounding Analysis:')
      console.log(`   📚 Sources found: ${sourceCount}`)
      console.log(`   🔗 Grounding language: ${hasGroundingLanguage ? 'Yes' : 'No'}`)
      console.log(`   📝 Has quotes: ${hasQuotes ? 'Yes' : 'No'}`)
      console.log(`   ⚠️ Acknowledges limits: ${acknowledgesLimitations ? 'Yes' : 'No'}`)
      console.log(`   🚫 Ungrounded claims: ${hasUngroundedClaims ? 'Yes' : 'No'}`)
      console.log(`   📈 Grounding score: ${groundingScore}/100`)
      
      // Validation checks
      let passed = true
      const issues = []
      
      if (testCase.expectGrounded && sourceCount === 0) {
        issues.push('Expected sources but none found')
        passed = false
      }
      
      if (testCase.expectGrounded && !hasGroundingLanguage && sourceCount > 0) {
        issues.push('Has sources but no grounding language')
        passed = false
      }
      
      if (testCase.expectLimitation && !acknowledgesLimitations && sourceCount === 0) {
        issues.push('Should acknowledge limitations when no sources available')
        passed = false
      }
      
      if (testCase.expectQuotes && !hasQuotes && sourceCount > 0) {
        issues.push('Expected direct quotes from sources')
        passed = false
      }
      
      if (hasUngroundedClaims) {
        issues.push('Contains potentially ungrounded claims')
        passed = false
      }
      
      if (testCase.expectMultipleSources && sourceCount < 2) {
        issues.push('Expected multiple sources for synthesis')
        passed = false
      }
      
      // Show response preview
      console.log('\n📖 Response Preview:')
      console.log('─'.repeat(50))
      console.log(data.response.slice(0, 300) + (data.response.length > 300 ? '\n...[truncated]' : ''))
      console.log('─'.repeat(50))
      
      if (passed) {
        console.log('✅ Grounding test PASSED')
      } else {
        console.log('❌ Grounding test FAILED')
        console.log('Issues:')
        issues.forEach(issue => console.log(`   • ${issue}`))
        allTestsPassed = false
      }
      
      console.log()
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`)
      allTestsPassed = false
      console.log()
    }
  }
  
  // Final Results
  console.log('🏁 Response Grounding Test Results:')
  if (allTestsPassed) {
    console.log('🎉 All grounding tests passed!')
    console.log('\n📋 Key findings:')
    console.log('   • Responses are properly grounded in context')
    console.log('   • Sources are appropriately referenced')
    console.log('   • Limitations are acknowledged when appropriate')
    console.log('   • Ungrounded claims are avoided')
    console.log('\n✅ Response grounding is working correctly!')
  } else {
    console.log('❌ Some grounding tests failed.')
    console.log('\n💡 Common issues to check:')
    console.log('   • System prompt may need adjustment')
    console.log('   • Response validation logic needs tuning')
    console.log('   • Context formatting may be unclear')
    console.log('   • Model temperature may be too high')
    process.exit(1)
  }
}

testResponseGrounding()
