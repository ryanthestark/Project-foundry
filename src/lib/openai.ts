import OpenAI from 'openai'

export const EMBED_MODEL = 'text-embedding-3-small'
export const CHAT_MODEL = 'gpt-4o'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
