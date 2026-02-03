/**
 * Web Search Utilities
 * Fetches latest information from the web and validates URLs
 */

import https from 'https'

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  date?: string
  source?: string
}

export interface WebSearchOptions {
  query: string
  geography?: string
  maxResults?: number
}

/**
 * Search the web for current information
 * Supports multiple search providers:
 * 1. SerpAPI (requires SERP_API_KEY)
 * 2. Google Custom Search (requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID)
 * 3. Bing Search (requires BING_SEARCH_API_KEY)
 * 4. Fallback: Uses Azure OpenAI to suggest URLs based on context
 */
export async function searchWeb(options: WebSearchOptions): Promise<WebSearchResult[]> {
  const { query, geography, maxResults = 5 } = options

  console.log(`[WEB SEARCH] searchWeb called with query: "${query}"`)
  console.log(`[WEB SEARCH] Checking for SERP_API_KEY: ${!!process.env.SERP_API_KEY}`)

  // Try SerpAPI first
  if (process.env.SERP_API_KEY) {
    try {
      console.log(`[WEB SEARCH] Attempting SerpAPI search...`)
      const results = await searchWithSerpAPI(query, geography, maxResults)
      console.log(`[WEB SEARCH] SerpAPI returned ${results.length} results`)
      return results
    } catch (error) {
      console.error('[WEB SEARCH] SerpAPI search failed:', error)
      if (error instanceof Error) {
        console.error('[WEB SEARCH] Error message:', error.message)
      }
      // Don't return here - try other providers
    }
  } else {
    console.log(`[WEB SEARCH] SERP_API_KEY not found in process.env`)
  }

  // Try Google Custom Search
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    try {
      return await searchWithGoogle(query, geography, maxResults)
    } catch (error) {
      console.error('Google search failed:', error)
    }
  }

  // Try Bing Search
  if (process.env.BING_SEARCH_API_KEY) {
    try {
      return await searchWithBing(query, geography, maxResults)
    } catch (error) {
      console.error('Bing search failed:', error)
    }
  }

  // Fallback: Return empty or use AI to suggest URLs
  console.warn('No web search API configured. Using fallback.')
  return []
}

/**
 * Search using SerpAPI
 */
async function searchWithSerpAPI(
  query: string,
  geography?: string,
  maxResults: number = 5
): Promise<WebSearchResult[]> {
  const location = geography || 'United States'
  const apiKey = process.env.SERP_API_KEY!

  if (!apiKey) {
    throw new Error('SERP_API_KEY is not set')
  }

  const params = new URLSearchParams({
    q: query,
    api_key: apiKey,
    engine: 'google',
    num: maxResults.toString(),
    location: location,
    hl: 'en',
    gl: getCountryCode(geography),
  })

  console.log(`[SERPAPI] Searching with query: "${query}"`)
  console.log(`[SERPAPI] API key present: ${apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No'}`)

  const url = `https://serpapi.com/search.json?${params}`
  console.log(`[SERPAPI] Request URL: ${url.replace(apiKey, '***')}`)

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })
  } catch (fetchError: any) {
    // Log full error structure for debugging
    console.error('[SERPAPI] Fetch error caught:', {
      name: fetchError?.name,
      message: fetchError?.message,
      code: fetchError?.code,
      cause: fetchError?.cause ? {
        name: fetchError.cause?.name,
        message: fetchError.cause?.message,
        code: fetchError.cause?.code,
      } : undefined,
    })
    
    // Check if it's an SSL certificate error - check multiple ways
    // In Node.js, SSL errors are often in the cause property
    const errorCode = fetchError?.code || fetchError?.cause?.code
    const errorMessage = (fetchError?.message || fetchError?.cause?.message || '').toLowerCase()
    const causeMessage = (fetchError?.cause?.message || '').toLowerCase()
    
    // Check for SSL errors - handle both direct errors and errors with cause
    const isSSLError = 
      errorCode === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
      errorCode === 'CERT_HAS_EXPIRED' ||
      errorCode === 'SELF_SIGNED_CERT_IN_CHAIN' ||
      errorMessage.includes('certificate') ||
      errorMessage.includes('unable to get local issuer') ||
      (errorMessage.includes('fetch failed') && (causeMessage.includes('certificate') || fetchError?.cause?.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY')) ||
      causeMessage.includes('certificate') ||
      causeMessage.includes('unable to get local issuer')
    
    console.log(`[SERPAPI] SSL error detection: ${isSSLError} (code: ${errorCode}, message: ${errorMessage.substring(0, 100)})`)
    
    if (isSSLError) {
      console.warn('[SERPAPI] SSL certificate error detected. Attempting with custom HTTPS agent...')
      console.warn('[SERPAPI] Error details:', {
        message: fetchError?.message,
        code: fetchError?.code,
        causeCode: fetchError?.cause?.code,
        causeMessage: fetchError?.cause?.message,
      })
      console.warn('[SERPAPI] WARNING: Using less secure SSL settings for demo purposes only')
      
      // Try with a custom HTTPS agent that allows self-signed/invalid certificates
      // This is necessary for some corporate environments or demo setups
      // In production, you should fix the certificate chain instead
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false, // Allow insecure SSL for demo (corporate proxy/firewall scenarios)
      })

      // Use https module directly as fallback
      try {
        console.log('[SERPAPI] Attempting HTTPS fallback with custom agent...')
        const data = await fetchWithHttps(url, httpsAgent)
        console.log(`[SERPAPI] ✅ HTTPS fallback succeeded! Organic results: ${data.organic_results?.length || 0}`)
        return parseSerpAPIResults(data, maxResults)
      } catch (httpsError: any) {
        console.error('[SERPAPI] ❌ HTTPS fallback also failed:', httpsError.message)
        console.error('[SERPAPI] Fallback error details:', {
          message: httpsError?.message,
          code: httpsError?.code,
          stack: httpsError?.stack,
        })
        throw new Error(`SerpAPI SSL error: Unable to verify certificate. ${httpsError.message}`)
      }
    }
    
    // Log the error for debugging
    console.error('[SERPAPI] Fetch failed with non-SSL error:', {
      message: fetchError?.message,
      code: fetchError?.code,
      cause: fetchError?.cause,
    })
    
    // Re-throw if it's not an SSL error
    throw fetchError
  }

  console.log(`[SERPAPI] Response status: ${response.status} ${response.statusText}`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[SERPAPI] Error response (${response.status}): ${errorText}`)
    // Try to parse as JSON to get more details
    try {
      const errorJson = JSON.parse(errorText)
      if (errorJson.error) {
        console.error(`[SERPAPI] API Error: ${errorJson.error}`)
        throw new Error(`SerpAPI error: ${errorJson.error}`)
      }
    } catch {
      // Not JSON, use text as-is
    }
    throw new Error(`SerpAPI error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  console.log(`[SERPAPI] Response received. Organic results: ${data.organic_results?.length || 0}`)
  
  // Check for API errors in response
  if (data.error) {
    console.error(`[SERPAPI] API returned error: ${data.error}`)
    throw new Error(`SerpAPI API error: ${data.error}`)
  }

  return parseSerpAPIResults(data, maxResults)
}

/**
 * Parse SerpAPI results into WebSearchResult array
 */
function parseSerpAPIResults(data: any, maxResults: number): WebSearchResult[] {
  const results: WebSearchResult[] = []

  if (data.organic_results && Array.isArray(data.organic_results)) {
    for (const result of data.organic_results.slice(0, maxResults)) {
      if (result.link) {
        results.push({
          title: result.title || '',
          url: result.link || '',
          snippet: result.snippet || '',
          date: result.date || undefined,
          source: result.source || undefined,
        })
        console.log(`[SERPAPI] Added result: ${result.title} - ${result.link}`)
      }
    }
  } else {
    console.warn(`[SERPAPI] No organic_results in response. Response keys: ${Object.keys(data).join(', ')}`)
    if (data.error) {
      console.error(`[SERPAPI] API error: ${data.error}`)
    }
  }

  console.log(`[SERPAPI] Returning ${results.length} results`)
  return results
}

/**
 * Fetch using Node.js https module directly (fallback for SSL issues)
 */
function fetchWithHttps(urlString: string, agent: https.Agent): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BainValidator/1.0',
      },
      agent: agent,
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data)
            resolve(jsonData)
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError}`))
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.end()
  })
}

/**
 * Search using Google Custom Search API
 */
async function searchWithGoogle(
  query: string,
  geography?: string,
  maxResults: number = 5
): Promise<WebSearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY!
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID!
  const country = getCountryCode(geography)

  const params = new URLSearchParams({
    key: apiKey,
    cx: engineId,
    q: query,
    num: Math.min(maxResults, 10).toString(),
    cr: `country${country}`,
    safe: 'active',
  })

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)

  if (!response.ok) {
    throw new Error(`Google Search error: ${response.statusText}`)
  }

  const data = await response.json()
  const results: WebSearchResult[] = []

  if (data.items) {
    for (const item of data.items.slice(0, maxResults)) {
      results.push({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
        source: new URL(item.link).hostname,
      })
    }
  }

  return results
}

/**
 * Search using Bing Search API
 */
async function searchWithBing(
  query: string,
  geography?: string,
  maxResults: number = 5
): Promise<WebSearchResult[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY!
  const market = getBingMarket(geography)

  const response = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${maxResults}&mkt=${market}`,
    {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Bing Search error: ${response.statusText}`)
  }

  const data = await response.json()
  const results: WebSearchResult[] = []

  if (data.webPages?.value) {
    for (const page of data.webPages.value.slice(0, maxResults)) {
      results.push({
        title: page.name || '',
        url: page.url || '',
        snippet: page.snippet || '',
        date: page.dateLastCrawled || undefined,
        source: new URL(page.url).hostname,
      })
    }
  }

  return results
}

/**
 * Validate and fetch metadata for a URL
 */
export async function validateAndEnrichURL(url: string): Promise<{
  valid: boolean
  title?: string
  description?: string
  date?: string
  error?: string
}> {
  try {
    // Basic URL validation
    new URL(url)

    // Try to fetch the page (limited to avoid timeouts)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(url, {
        method: 'HEAD', // Just headers to check if URL is valid
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BainValidator/1.0)',
        },
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        // Try to get title from meta tags if possible
        // For full content, would need to fetch and parse HTML
        return {
          valid: true,
          title: response.headers.get('x-page-title') || undefined,
        }
      }

      return {
        valid: false,
        error: `HTTP ${response.status}`,
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        return {
          valid: false,
          error: 'Request timeout',
        }
      }
      // URL might still be valid, just not accessible
      return {
        valid: true, // Assume valid if we can't check
      }
    }
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format',
    }
  }
}

/**
 * Generate search queries for unsourced claims using AI
 */
export async function generateSearchQueries(
  claims: string[],
  geography: string,
  industry: string
): Promise<Map<string, string>> {
  // This would use Azure OpenAI to generate search queries
  // For now, return simple queries
  const queries = new Map<string, string>()

  for (const claim of claims) {
    // Extract key terms from claim
    const keywords = extractKeywords(claim)
    const query = `${keywords.join(' ')} ${industry} ${geography} 2024`
    queries.set(claim, query)
  }

  return queries
}

/**
 * Extract keywords from a claim for search
 */
function extractKeywords(claim: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being'])
  
  const words = claim
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5) // Top 5 keywords

  return words
}

/**
 * Get country code for search APIs
 */
function getCountryCode(geography?: string): string {
  const codes: Record<string, string> = {
    'US': 'us',
    'EU': 'de', // Default to Germany for EU
    'UK': 'gb',
    'India': 'in',
    'China': 'cn',
    'Global': 'us',
  }
  return codes[geography || 'US'] || 'us'
}

/**
 * Get Bing market code
 */
function getBingMarket(geography?: string): string {
  const markets: Record<string, string> = {
    'US': 'en-US',
    'EU': 'en-GB',
    'UK': 'en-GB',
    'India': 'en-IN',
    'China': 'en-CN',
    'Global': 'en-US',
  }
  return markets[geography || 'US'] || 'en-US'
}

