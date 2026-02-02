import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize Azure OpenAI client
function getOpenAIClient() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
  
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Missing Azure OpenAI configuration. Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT environment variables.')
  }
  
  return new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/deployments/${deployment}`,
    defaultQuery: { 'api-version': apiVersion },
    defaultHeaders: {
      'api-key': apiKey,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, case_type, geography, industry } = body
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      )
    }
    
    // Check if Azure OpenAI is configured
    try {
      const client = getOpenAIClient()
      
      const systemPrompt = `You are a consultant helping to draft a case deliverable for ${case_type || 'a consulting case'} in ${geography || 'a region'}, focusing on ${industry || 'an industry'}.

Generate a professional draft that:
- Uses advisory language (avoid "will guarantee", "proves", etc.)
- Includes specific dates where relevant
- Includes inline citations with [SOURCE: description] markers for all claims
- For numeric claims, include [SOURCE: study name or URL]
- For regulatory references, include [SOURCE: regulation name and date]
- For market data, include [SOURCE: data provider and date]
- Is structured and clear
- Is appropriate for client discussion

IMPORTANT: Include [SOURCE: ...] markers inline in the text for:
- All numeric claims (percentages, dollar amounts, statistics)
- Regulatory references
- Market data or industry trends
- Research findings or studies
- External data points

Keep the draft to 300-500 words.`
      
      const completion = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      })
      
      const generatedText = completion.choices[0]?.message?.content || ''
      
      return NextResponse.json({
        draft: generatedText,
      })
    } catch (configError: any) {
      // If Azure OpenAI is not configured, return a mock response for demo
      if (configError.message?.includes('Missing Azure OpenAI')) {
        return NextResponse.json({
          draft: `[MOCK DRAFT - Azure OpenAI not configured]\n\n${prompt}\n\nThe target company operates in a dynamic market environment. According to recent industry analysis, the sector has shown growth trends. Market research indicates potential opportunities for strategic initiatives.\n\nKey considerations include regulatory compliance requirements and market positioning. The current landscape suggests that careful planning will be important for success.\n\n[Note: Configure Azure OpenAI environment variables to generate real drafts]`,
          warning: 'Azure OpenAI not configured. This is a mock response.',
        })
      }
      throw configError
    }
  } catch (error: any) {
    console.error('Generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error during generation' },
      { status: 500 }
    )
  }
}

