
import 'dotenv/config'

async function testRAGPipeline() {
  console.log('🧪 Testing RAG Pipeline...')
  
  const testQuery = 'What is the business strategy?'
  
  try {
    const response = await fetch('http://localhost:3000/api/chat/rag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: testQuery,
        type: 'strategy' // optional type filter
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    console.log('✅ RAG Pipeline Test Results:')
    console.log('📝 Query:', testQuery)
    console.log('🤖 Response:', data.response?.slice(0, 200) + '...')
    console.log('📚 Sources found:', data.sources?.length || 0)
    console.log('🔍 Source details:', data.sources?.map(s => `${s.source} (${s.similarity.toFixed(3)})`))
    console.log('⏱️ Duration:', data.metadata?.duration + 'ms')
    
  } catch (error) {
    console.error('❌ RAG Pipeline Test Failed:', error.message)
  }
}

testRAGPipeline()
