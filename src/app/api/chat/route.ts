// src/app/api/chat/rag/route.ts

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { query } = await req.json()

  // Fake RAG response for now
  return NextResponse.json({
    message: `You asked: "${query}", but RAG is not yet implemented.`
  })
}
