// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { query } = await req.json()
    
    console.log("🔵 Basic chat endpoint called with query:", query)

    // Basic chat endpoint - for non-RAG conversations
    return NextResponse.json({
      response: `You said: "${query}". This is a basic chat response.`
    })
  } catch (error) {
    console.error("❌ Basic chat endpoint error:", error)
    return NextResponse.json(
      { error: 'Failed to process chat request', details: error.message },
      { status: 500 }
    )
  }
}
