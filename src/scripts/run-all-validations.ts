// Run all RAG pipeline validation scripts in sequence

import { spawn } from 'child_process'
import path from 'path'

const scripts = [
  { name: 'Environment Setup', script: 'src/scripts/validate-setup.ts' },
  { name: 'Embedding Generation', script: 'src/scripts/test-embeddings.ts' },
  { name: 'Vector Matching', script: 'src/scripts/test-vector-match.ts' },
  { name: 'Contextual Response', script: 'src/scripts/test-contextual-response.ts' },
  { name: 'Full Pipeline', script: 'src/scripts/test-full-pipeline.ts' }
]

async function runScript(scriptPath: string): Promise<{ success: boolean, output: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', scriptPath], {
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    let output = ''
    
    child.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    child.stderr.on('data', (data) => {
      output += data.toString()
    })
    
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output
      })
    })
  })
}

async function runAllValidations() {
  console.log('🚀 Running All RAG Pipeline Validations')
  console.log('=' .repeat(50))
  console.log()
  
  const results = []
  
  for (const [index, script] of scripts.entries()) {
    console.log(`📋 ${index + 1}/${scripts.length}: ${script.name}`)
    console.log(`🔄 Running: ${script.script}`)
    console.log('-'.repeat(30))
    
    const startTime = Date.now()
    const result = await runScript(script.script)
    const duration = Date.now() - startTime
    
    results.push({
      name: script.name,
      success: result.success,
      duration,
      output: result.output
    })
    
    if (result.success) {
      console.log(`✅ ${script.name} PASSED (${duration}ms)`)
    } else {
      console.log(`❌ ${script.name} FAILED (${duration}ms)`)
      console.log('Error output:')
      console.log(result.output.slice(-500)) // Show last 500 chars of output
    }
    
    console.log()
  }
  
  // Summary
  console.log('🏁 VALIDATION SUMMARY')
  console.log('=' .repeat(50))
  
  const passed = results.filter(r => r.success).length
  const total = results.length
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌'
    console.log(`${index + 1}. ${status} ${result.name} (${result.duration}ms)`)
  })
  
  console.log()
  console.log(`📊 Overall: ${passed}/${total} validations passed`)
  
  if (passed === total) {
    console.log('🎉 All validations passed! RAG pipeline is fully functional.')
  } else {
    console.log('❌ Some validations failed. Check the output above for details.')
    process.exit(1)
  }
}

runAllValidations().catch(error => {
  console.error('💥 Validation runner crashed:', error.message)
  process.exit(1)
})
