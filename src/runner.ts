// src/runner.ts

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { openai, CHAT_MODEL } from '@/lib/openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runOnce() {
  console.log('[Runner] Checking for queued jobs...')

  const { data: job, error } = await supabase
    .from('autonomous_jobs')
    .select('*')
    .eq('status', 'queued')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[Runner] Failed to fetch job:', error)
    return
  }

  if (!job) {
    console.log('[Runner] No jobs found.')
    return
  }

  console.log(`[Runner] Found job: ${job.id} - "${job.goal}"`)
  await supabase.from('autonomous_jobs').update({ status: 'in_progress' }).eq('id', job.id)

  try {
    const chat = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are a smart, efficient autonomous agent.' },
        { role: 'user', content: job.goal }
      ]
    })

    const result = chat.choices[0]?.message?.content || ''
    await supabase.from('autonomous_jobs').update({
      status: 'completed',
      result: { output: result }
    }).eq('id', job.id)

    console.log(`[Runner] Job ${job.id} completed.`)
  } catch (err: any) {
    console.error('[Runner] Job failed:', err.message)
    await supabase.from('autonomous_jobs').update({
      status: 'failed',
      error: err.message
    }).eq('id', job.id)
  }
}

async function mainLoop() {
  console.log('[Runner] Starting continuous loop...')
  while (true) {
    await runOnce()
    await new Promise(resolve => setTimeout(resolve, 5000)) // wait 5s before next check
  }
}

mainLoop()
