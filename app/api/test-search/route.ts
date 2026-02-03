import { NextRequest, NextResponse } from 'next/server'
import { searchWeb } from '@/lib/web-search'

/**
 * Test endpoint to verify web search is working
 * GET /api/test-search?query=your+search+query
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query') || 'GDPR fines 2024'
    
    console.log(`[TEST SEARCH] Testing web search with query: "${query}"`)
    console.log(`[TEST SEARCH] SERP_API_KEY configured: ${!!process.env.SERP_API_KEY}`)
    
    if (!process.env.SERP_API_KEY) {
      return NextResponse.json({
        error: 'SERP_API_KEY not configured',
        hint: 'Add SERP_API_KEY to your .env.local file and restart the server',
        availableEnvVars: Object.keys(process.env).filter(k => 
          k.includes('SERP') || k.includes('SEARCH') || k.includes('API')
        ),
      }, { status: 400 })
    }
    
    console.log(`[TEST SEARCH] Starting web search...`)
    const startTime = Date.now()
    
    const results = await searchWeb({
      query,
      geography: 'US',
      maxResults: 3,
    })
    
    const duration = Date.now() - startTime
    console.log(`[TEST SEARCH] Search completed in ${duration}ms, found ${results.length} results`)
    
    return NextResponse.json({
      success: true,
      query,
      resultsCount: results.length,
      results,
      apiKeyConfigured: !!process.env.SERP_API_KEY,
      apiKeyLength: process.env.SERP_API_KEY?.length || 0,
      apiKeyPrefix: process.env.SERP_API_KEY ? process.env.SERP_API_KEY.substring(0, 10) + '...' : 'N/A',
      duration: `${duration}ms`,
      diagnostics: {
        serpApiConfigured: !!process.env.SERP_API_KEY,
        googleConfigured: !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID),
        bingConfigured: !!process.env.BING_SEARCH_API_KEY,
      }
    })
  } catch (error: any) {
    console.error('[TEST SEARCH] Error:', error)
    return NextResponse.json({
      error: 'Search failed',
      message: error.message || String(error),
      stack: error.stack,
    }, { status: 500 })
  }
}

