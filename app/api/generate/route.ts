import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { searchWeb } from '@/lib/web-search'

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
      
      // Step 3.4a: Search web for relevant articles and references
      let webSearchResults: any[] = []
      let searchQuery = ''
      
      if (process.env.SERP_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || process.env.BING_SEARCH_API_KEY) {
        try {
          // Build search query: user prompt + geography + industry
          searchQuery = `${prompt} ${geography || ''} ${industry || ''}`.trim()
          console.log(`[GENERATE] Searching web for: "${searchQuery}"`)
          
          const searchResults = await searchWeb({
            query: searchQuery,
            geography: geography || 'US',
            maxResults: 5, // Get top 5 results
          })
          
          webSearchResults = searchResults
          console.log(`[GENERATE] Found ${searchResults.length} web search results`)
          
          // Log first few results for debugging
          searchResults.slice(0, 3).forEach((result, idx) => {
            console.log(`[GENERATE] Result ${idx + 1}: ${result.title} - ${result.url}`)
          })
        } catch (searchError: any) {
          console.error('[GENERATE] Web search failed:', searchError.message)
          console.warn('[GENERATE] Continuing without web search results')
          // Continue without web search results - don't fail the entire generation
        }
      } else {
        console.log('[GENERATE] No web search API configured, skipping web search')
      }
      
      // Step 3.3: Build System Prompt with web search context
      let systemPrompt = `You are a consultant helping to draft a case deliverable for ${case_type || 'a consulting case'} in ${geography || 'a region'}, focusing on ${industry || 'an industry'}.

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

      // Add web search results to context if available
      let userPrompt = prompt
      
      if (webSearchResults.length > 0) {
        // Format web search results for AI context with URLs prominently displayed
        const searchContext = webSearchResults.map((result, idx) => {
          return `[Source ${idx + 1}]
Title: ${result.title}
URL: ${result.url}
Snippet: ${result.snippet}
${result.date ? `Date: ${result.date}` : ''}
${result.source ? `Source: ${result.source}` : ''}`
        }).join('\n\n')
        
        systemPrompt += `\n\nYou have access to the following recent web sources related to this topic. Use this information to inform your draft and cite these sources where relevant:\n\n${searchContext}\n\nCRITICAL: When referencing information from these sources, you MUST include the URL in the [SOURCE: ...] marker. Use the format [SOURCE: Title - URL] or [SOURCE: URL]. Always include the full URL from the source list above. For example:
- [SOURCE: Gartner Cloud Market Analysis - https://www.gartner.com/...]
- [SOURCE: https://www.mckinsey.com/...]

Make sure every claim that uses information from these sources includes the URL in the citation.`
        
        console.log(`[GENERATE] Added ${webSearchResults.length} web sources to AI context`)
        console.log(`[GENERATE] Sources with URLs:`)
        webSearchResults.forEach((result, idx) => {
          console.log(`  ${idx + 1}. ${result.title}: ${result.url}`)
        })
      }
      
      // Step 3.4b: Call Azure OpenAI API
      console.log(`[GENERATE] Calling Azure OpenAI API...`)
      const completion = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      })
      
      const generatedText = completion.choices[0]?.message?.content || ''
      console.log(`[GENERATE] Generated draft (${generatedText.length} characters)`)
      
      // Step 3.5: Handle Response
      return NextResponse.json({
        draft: generatedText,
        webSearchUsed: webSearchResults.length > 0,
        webSearchResultsCount: webSearchResults.length,
        searchQuery: searchQuery || undefined,
        webSources: webSearchResults.length > 0 ? webSearchResults.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          date: r.date,
        })) : undefined,
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

