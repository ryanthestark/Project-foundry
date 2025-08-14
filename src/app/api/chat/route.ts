// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { query } = await req.json()

  // Basic chat endpoint - for non-RAG conversations
  return NextResponse.json({
    response: `You said: "${query}". This is a basic chat response.`
  })
}
