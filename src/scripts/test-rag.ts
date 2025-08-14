
import 'dotenv/config'

async function testRAGPipeline() {
  console.log('🧪 Testing RAG Pipeline...')
  
  const testQueries = [
    { query: 'What is the business strategy?', type: 'strategy' },
    { query: 'Tell me about the product features', type: 'feature' },
    { query: 'What are the key project details?', type: null }, // No filter
  ]
  
  for (const test of testQueries) {
    console.log(`\n🔍 Testing: "${test.query}" ${test.type ? `(type: ${test.type})` : '(no filter)'}`)
    
    try {
      const startTime = Date.now()
      const response = await fetch('http://localhost:3000/api/chat/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: test.query,
          ...(test.type && { type: test.type })
        })
      })
      
      const responseTime = Date.now() - startTime
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`)
      }
      
      const data = await response.json()
      
      console.log('✅ Success!')
      console.log('📝 Query:', test.query)
      console.log('🤖 Response length:', data.response?.length || 0, 'chars')
      console.log('🤖 Response preview:', data.response?.slice(0, 150) + '...')
      console.log('📚 Sources found:', data.sources?.length || 0)
      
      if (data.sources && data.sources.length > 0) {
        console.log('🔍 Top sources:')
        data.sources.slice(0, 3).forEach((s, i) => {
          console.log(`   ${i + 1}. ${s.source} (similarity: ${s.similarity?.toFixed(3)}, type: ${s.type})`)
        })
      }
      
      console.log('⏱️ Total duration:', data.metadata?.duration || responseTime, 'ms')
      console.log('🔧 Models used:', data.metadata?.model ? `${data.metadata.model.embedding} + ${data.metadata.model.chat}` : 'unknown')
      
    } catch (error) {
      console.error('❌ Test Failed:', error.message)
    }
  }
  
  console.log('\n🎉 RAG Pipeline testing complete!')
}

testRAGPipeline()
