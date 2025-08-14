// src/app/api/orchestrator/start/route.ts

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { query } = await req.json()

  // Basic stub that would enqueue a job
  return NextResponse.json({
    status: 'planning',
    id: Math.random().toString(36).slice(2),
    plan: {
      steps: ['example step 1', 'example step 2']
    }
  })
}
