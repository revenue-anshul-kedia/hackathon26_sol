import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ValidationResult, ValidationInput, SourceReference } from '@/lib/validation'
import mockSources from '@/data/mock_sources.json'
import { searchWeb, validateAndEnrichURL, generateSearchQueries } from '@/lib/web-search'

// Build context-specific validation guidelines based on metadata
function buildContextGuidelines(
  caseType: string,
  geography: string,
  industry: string,
  stakesLevel: string
): string {
  const caseTypeGuidelines: Record<string, string> = {
    'Diligence': `CASE TYPE: DILIGENCE
- Focus on accuracy of financial data, market sizing, competitive positioning
- Regulatory compliance is CRITICAL - flag any compliance risks
- Historical data must be dated and sourced
- Forward-looking statements must be clearly marked as projections
- Legal/regulatory findings should be HIGH severity`,
    'Strategy': `CASE TYPE: STRATEGY
- Market analysis requires current data (within 12 months for fast-moving industries)
- Competitive intelligence must be dated and sourced
- Strategic recommendations should use advisory language, not guarantees
- Industry trends require recent citations`,
    'Performance Transformation': `CASE TYPE: PERFORMANCE TRANSFORMATION
- Financial projections and benchmarks must be sourced
- Industry benchmarks require current data
- Transformation timelines should avoid overconfident delivery dates
- Regulatory compliance for workforce changes (especially in ${geography})`,
    'Org Design': `CASE TYPE: ORG DESIGN
- Labor law compliance is CRITICAL for ${geography}
- Workforce data must be current and sourced
- Regulatory requirements for org changes (SEC disclosure if public company, GDPR for EU, etc.)
- Avoid guarantees about employee satisfaction or retention outcomes`
  }
  
  const geographyGuidelines: Record<string, string> = {
    'US': `GEOGRAPHY: UNITED STATES
- Key regulations: SEC, FTC, HIPAA, SOX, Dodd-Frank, state-specific laws
- Financial data must comply with SEC disclosure requirements if public company
- Healthcare data requires HIPAA compliance markers
- Antitrust/competition law (FTC/DOJ) must be referenced with dates
- State-specific regulations (CA CCPA, NY SHIELD Act) if applicable`,
    'EU': `GEOGRAPHY: EUROPEAN UNION
- Key regulations: GDPR, EU AI Act, Digital Markets Act, MiFID II
- GDPR compliance is MANDATORY for any data processing claims
- EU AI Act (effective 2024) must be referenced if discussing AI
- Cross-border data transfers require adequacy decisions
- Country-specific regulations (Germany BDSG, France CNIL) may apply`,
    'UK': `GEOGRAPHY: UNITED KINGDOM
- Key regulations: UK GDPR, Data Protection Act 2018, post-Brexit regulations
- UK-EU data adequacy status must be current (extended to 2025)
- Financial services: FCA regulations
- Employment law: updated flexible working rights (2024)`,
    'India': `GEOGRAPHY: INDIA
- Key regulations: Digital Personal Data Protection Act (2023), Companies Act, FEMA
- Data localization requirements for certain sectors
- RBI regulations for financial services
- Labor law: updated employment regulations`,
    'China': `GEOGRAPHY: CHINA
- Key regulations: Data Security Law, Personal Information Protection Law, Cybersecurity Law
- Data localization requirements are STRICT
- Cross-border data transfers require approval
- Industry-specific regulations (finance, healthcare)`,
    'Global': `GEOGRAPHY: GLOBAL
- Must specify jurisdiction for each regulatory claim
- Cross-border compliance requirements (GDPR for EU data, US regulations for US operations)
- International trade regulations (sanctions, tariffs) require current dates
- Avoid generic "global" regulatory statements without jurisdiction`
  }
  
  const industryGuidelines: Record<string, string> = {
    'Technology': `INDUSTRY: TECHNOLOGY
- Data privacy regulations are CRITICAL (GDPR, CCPA, etc.)
- AI regulations (EU AI Act, US AI Executive Order) must be current
- Cybersecurity requirements must be dated
- Platform regulations (DMA, DSA in EU) if applicable
- Intellectual property claims require sources`,
    'Healthcare': `INDUSTRY: HEALTHCARE
- HIPAA (US) or equivalent data protection (GDPR Article 9 for EU) is MANDATORY
- FDA regulations (US) or EMA (EU) for medical claims
- Clinical data must be sourced and dated
- Patient data handling requires explicit compliance markers`,
    'Financial Services': `INDUSTRY: FINANCIAL SERVICES
- SEC regulations (US) or FCA (UK) or ESMA (EU) must be current
- Basel III/IV requirements if discussing capital
- Anti-money laundering regulations
- Financial data must be sourced from authoritative sources (Bloomberg, S&P, etc.)`,
    'Manufacturing': `INDUSTRY: MANUFACTURING
- Environmental regulations (EPA, EU ETS) require current dates
- Supply chain regulations (conflict minerals, modern slavery)
- Trade regulations (tariffs, sanctions) must be current
- Safety regulations (OSHA, EU directives)`
  }
  
  const stakesGuidelines: Record<string, string> = {
    'Internal draft': `STAKES LEVEL: INTERNAL DRAFT
- Can tolerate more assumptions and placeholders
- Medium severity findings are acceptable
- Focus on structure and completeness
- Citations can be marked as [TO BE SOURCED]`,
    'Client discussion': `STAKES LEVEL: CLIENT DISCUSSION
- All high-severity findings must be resolved
- Citations required for all numeric claims
- Regulatory references must be accurate and dated
- Assumptions must be clearly marked
- Professional tone is critical`,
    'Board-level': `STAKES LEVEL: BOARD-LEVEL
- ZERO tolerance for high-severity findings
- ALL medium findings must be addressed
- Every regulatory claim must have jurisdiction + date
- Every numeric claim must have authoritative source
- Overconfident language is UNACCEPTABLE
- Assumptions must be minimal and clearly flagged
- Legal/Compliance review recommended for all regulatory content`
  }
  
  return `CONTEXT-SPECIFIC VALIDATION GUIDELINES:

${caseTypeGuidelines[caseType] || `CASE TYPE: ${caseType}
- Apply standard validation criteria
- Consider case-specific requirements`}

${geographyGuidelines[geography] || `GEOGRAPHY: ${geography}
- Apply standard regulatory validation
- Consider jurisdiction-specific requirements`}

${industryGuidelines[industry] || `INDUSTRY: ${industry}
- Apply standard industry validation
- Consider sector-specific regulations and data requirements`}

${stakesGuidelines[stakesLevel] || `STAKES LEVEL: ${stakesLevel}
- Apply standard validation rigor`}

APPLY THESE GUIDELINES STRICTLY when validating the draft.`
}

// Get geography-specific regulations for prompt
function getGeographyRegulations(geography: string): string {
  const regulations: Record<string, string> = {
    'US': 'SEC, FTC, HIPAA, SOX, Dodd-Frank',
    'EU': 'GDPR, EU AI Act, Digital Markets Act, MiFID II',
    'UK': 'UK GDPR, Data Protection Act, FCA regulations',
    'India': 'DPDP Act, Companies Act, RBI regulations',
    'China': 'Data Security Law, PIPL, Cybersecurity Law',
    'Global': 'jurisdiction-specific regulations (GDPR for EU, SEC for US, etc.)'
  }
  return regulations[geography] || 'applicable regulations'
}

// Get case type specific requirements
function getCaseTypeRequirements(caseType: string): string {
  const requirements: Record<string, string> = {
    'Diligence': 'Financial accuracy, regulatory compliance, legal risks are critical',
    'Strategy': 'Market data currency, competitive intelligence, strategic language',
    'Performance Transformation': 'Benchmark sourcing, timeline realism, regulatory compliance',
    'Org Design': 'Labor law compliance, regulatory disclosure, workforce data accuracy'
  }
  return requirements[caseType] || 'Standard case requirements apply'
}

// Get stakes level specific requirements
function getStakesLevelRequirements(stakesLevel: string): string {
  const requirements: Record<string, string> = {
    'Internal draft': 'Can include placeholders and assumptions',
    'Client discussion': 'All high-severity issues must be resolved, professional tone required',
    'Board-level': 'Zero tolerance for high/medium findings, all claims must be sourced and dated'
  }
  return requirements[stakesLevel] || 'Standard validation applies'
}

// Extract sources and references from text
function extractSources(
  originalText: string,
  rewrittenText: string,
  caseType: string,
  geography: string,
  industry: string
): SourceReference[] {
  const sources: SourceReference[] = []
  const sourceIdCounter = { count: 0 }
  
  // Pattern to match [SOURCE: ...] markers
  const sourcePattern = /\[SOURCE:\s*([^\]]+)\]/gi
  const urlPattern = /https?:\/\/[^\s\)]+/gi
  const citationPattern = /\([A-Z][a-z]+\s+et\s+al\.?\s*,\s*\d{4}\)/gi
  
  // Extract from both original and rewritten text
  const allText = `${originalText}\n${rewrittenText}`
  
  // Extract [SOURCE: ...] markers
  let match
  while ((match = sourcePattern.exec(allText)) !== null) {
    const sourceText = match[1].trim()
    sourceIdCounter.count++
    
    // Try to extract URL if present
    const urlMatch = sourceText.match(urlPattern)
    const url = urlMatch ? urlMatch[0] : undefined
    
    // Determine source type
    let type: SourceReference['type'] = 'citation'
    if (url) {
      type = 'url'
    } else if (sourceText.toLowerCase().includes('regulation') || sourceText.toLowerCase().includes('act') || sourceText.toLowerCase().includes('gdpr') || sourceText.toLowerCase().includes('sec')) {
      type = 'regulation'
    } else if (sourceText.toLowerCase().includes('study') || sourceText.toLowerCase().includes('research') || sourceText.toLowerCase().includes('analysis')) {
      type = 'study'
    }
    
    // Try to match with mock sources
    const matchedMockSource = findMatchingMockSource(sourceText, geography, industry)
    
    sources.push({
      id: `S-${String(sourceIdCounter.count).padStart(3, '0')}`,
      url: url || matchedMockSource?.url_placeholder,
      title: matchedMockSource?.statement || sourceText,
      author: matchedMockSource ? undefined : extractAuthor(sourceText),
      date: matchedMockSource?.date || extractDate(sourceText),
      excerpt: matchedMockSource?.statement,
      claim_reference: findClaimReference(match[0], originalText),
      type,
    })
  }
  
  // Extract standalone URLs
  const urlMatches = allText.match(urlPattern)
  if (urlMatches) {
    for (const url of urlMatches) {
      // Skip if already captured in SOURCE marker
      if (!sources.some(s => s.url === url)) {
        sourceIdCounter.count++
        sources.push({
          id: `S-${String(sourceIdCounter.count).padStart(3, '0')}`,
          url,
          type: 'url',
          claim_reference: findClaimReference(url, originalText),
        })
      }
    }
  }
  
  // Extract citations (Author, Year)
  while ((match = citationPattern.exec(allText)) !== null) {
    const citation = match[0]
    sourceIdCounter.count++
    
    sources.push({
      id: `S-${String(sourceIdCounter.count).padStart(3, '0')}`,
      title: citation,
      type: 'citation',
      claim_reference: findClaimReference(citation, originalText),
    })
  }
  
  return sources
}

// Find matching mock source based on text content
function findMatchingMockSource(sourceText: string, geography: string, industry: string): any {
  const lowerText = sourceText.toLowerCase()
  
  // Check for geography match first
  const geoMatches = mockSources.filter((s: any) => 
    s.geography === geography && 
    (lowerText.includes(s.topic.toLowerCase()) || lowerText.includes(s.geography.toLowerCase()))
  )
  
  if (geoMatches.length > 0) {
    return geoMatches[0]
  }
  
  // Check for topic matches
  const topicMatches = mockSources.filter((s: any) => 
    lowerText.includes(s.topic.toLowerCase())
  )
  
  return topicMatches[0] || null
}

// Extract author from source text
function extractAuthor(text: string): string | undefined {
  const patterns = [
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+et\s+al/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return undefined
}

// Extract date from source text
function extractDate(text: string): string | undefined {
  const patterns = [
    /\b(20\d{2}-\d{2}-\d{2})\b/,
    /\b(20\d{2}-\d{2})\b/,
    /\b(20\d{2})\b/,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0]
    }
  }
  
  return undefined
}

// Find which claim a source supports
function findClaimReference(sourceMarker: string, text: string): string | undefined {
  const markerIndex = text.indexOf(sourceMarker)
  if (markerIndex === -1) return undefined
  
  const start = Math.max(0, markerIndex - 50)
  const end = Math.min(text.length, markerIndex + sourceMarker.length + 200) // Increased to capture full URLs
  const context = text.substring(start, end)
  
  const sentences = context.split(/[.!?]+/)
  let relevantSentence = sentences.find(s => s.includes(sourceMarker)) || context
  
  // Check if there's a URL in the sentence - if so, preserve the full URL
  const urlPattern = /https?:\/\/[^\s\)]+/gi
  const urlMatch = relevantSentence.match(urlPattern)
  
  if (urlMatch && urlMatch.length > 0) {
    // If URL is present, ensure we include the full URL even if it exceeds 150 chars
    // Find the position of the URL and extend the excerpt to include it fully
    const urlStart = relevantSentence.indexOf(urlMatch[0])
    const urlEnd = urlStart + urlMatch[0].length
    const beforeUrl = relevantSentence.substring(0, urlStart).trim()
    const afterUrl = relevantSentence.substring(urlEnd).trim()
    
    // Preserve full URL, but limit surrounding text
    const maxBefore = Math.min(100, beforeUrl.length)
    const maxAfter = Math.min(50, afterUrl.length)
    relevantSentence = beforeUrl.substring(beforeUrl.length - maxBefore) + 
                       urlMatch[0] + 
                       afterUrl.substring(0, maxAfter)
  } else {
    // No URL, use standard truncation
    relevantSentence = relevantSentence.trim().substring(0, 200) // Increased from 150
  }
  
  return relevantSentence.trim()
}

// Extract numeric claims from text for proactive source search
function extractNumericClaims(text: string): string[] {
  const claims: string[] = []
  const sentences = text.split(/[.!?]+/)
  
  // Pattern for numeric claims (percentages, dollar amounts, statistics)
  const numericPattern = /\b\d+[%€$£]?\s*(million|billion|trillion|thousand|percent|%|points?)\b/i
  
  for (const sentence of sentences) {
    if (numericPattern.test(sentence) && !sentence.match(/\[SOURCE:/) && !sentence.match(/https?:\/\//)) {
      claims.push(sentence.trim())
    }
  }
  
  return claims.slice(0, 5) // Limit to 5
}

// Extract regulatory claims from text for proactive source search
function extractRegulatoryClaims(text: string, geography: string): string[] {
  const claims: string[] = []
  const sentences = text.split(/[.!?]+/)
  
  // Pattern for regulatory references
  const regulatoryPattern = /\b(GDPR|HIPAA|SEC|FTC|regulation|act|compliance)\b/i
  
  for (const sentence of sentences) {
    if (regulatoryPattern.test(sentence) && !sentence.match(/\[SOURCE:/) && !sentence.match(/https?:\/\//)) {
      claims.push(sentence.trim())
    }
  }
  
  return claims.slice(0, 5) // Limit to 5
}

// Enrich sources with web search results for unsourced claims
async function enrichSourcesWithWebSearch(
  existingSources: SourceReference[],
  unsourcedFindings: any[],
  caseType: string,
  geography: string,
  industry: string
): Promise<SourceReference[]> {
  const enrichedSources = [...existingSources]
  
  // If no web search APIs configured, return existing sources
  if (!process.env.SERP_API_KEY && 
      !process.env.GOOGLE_SEARCH_API_KEY && 
      !process.env.BING_SEARCH_API_KEY) {
    console.log('No web search API configured. Skipping web search enrichment.')
    return enrichedSources
  }
  
  console.log(`[WEB SEARCH] ===== STARTING SOURCE ENRICHMENT =====`)
  console.log(`[WEB SEARCH] Total unsourced findings: ${unsourcedFindings.length}`)
  console.log(`[WEB SEARCH] Processing top 5 findings (rate limit protection)`)
  console.log(`[WEB SEARCH] Case type: ${caseType}, Geography: ${geography}, Industry: ${industry}`)
  
  // For each unsourced finding, try to find relevant sources
  for (let i = 0; i < Math.min(unsourcedFindings.length, 5); i++) { // Limit to 5 to avoid rate limits
    const finding = unsourcedFindings[i]
    try {
      const claim = finding.claim_excerpt || finding.rationale || ''
      if (!claim || claim.length < 20) {
        console.log(`[WEB SEARCH] [${i+1}/5] Skipping finding - claim too short: "${claim.substring(0, 50)}"`)
        continue
      }
      
      // Smart query generation: Extract key terms and create contextual query
      const keyTerms = extractKeyTermsFromClaim(claim, industry, geography)
      const searchQuery = `${keyTerms} ${industry} ${geography} 2024`
      console.log(`[WEB SEARCH] [${i+1}/5] Processing finding: "${claim.substring(0, 80)}..."`)
      console.log(`[WEB SEARCH] [${i+1}/5] Generated search query: "${searchQuery}"`)
      
      // Search the web
      const searchResults = await searchWeb({
        query: searchQuery,
        geography,
        maxResults: 2, // Get top 2 results per claim
      })
      
      console.log(`[WEB SEARCH] Found ${searchResults.length} results for query: "${searchQuery}"`)
      
      // Add search results as potential sources
      for (const result of searchResults) {
        // Check if URL already exists
        if (!enrichedSources.some(s => s.url === result.url)) {
          enrichedSources.push({
            id: `S-${String(enrichedSources.length + 1).padStart(3, '0')}`,
            url: result.url,
            title: result.title,
            excerpt: result.snippet,
            claim_reference: claim, // Don't truncate - preserve full claim including URLs
            type: 'url',
            date: result.date,
            source: result.source,
          })
          console.log(`[WEB SEARCH] Added source: ${result.url}`)
        } else {
          console.log(`[WEB SEARCH] Skipping duplicate URL: ${result.url}`)
        }
      }
      
      // Rate limiting: 500ms delay between searches
      console.log(`[WEB SEARCH] [${i+1}/5] Waiting 500ms before next search (rate limiting)`)
      await new Promise(resolve => setTimeout(resolve, 500))
      console.log(`[WEB SEARCH] [${i+1}/5] Completed successfully`)
    } catch (error) {
      console.error(`[WEB SEARCH] [${i+1}/5] ERROR searching for claim "${finding.claim_excerpt?.substring(0, 50)}":`, error)
      if (error instanceof Error) {
        console.error(`[WEB SEARCH] [${i+1}/5] Error message: ${error.message}`)
        console.error(`[WEB SEARCH] [${i+1}/5] Error stack: ${error.stack}`)
      }
      // Continue processing other findings even if one fails (error handling)
      console.log(`[WEB SEARCH] [${i+1}/5] Continuing to next finding despite error`)
    }
  }
  
  console.log(`[WEB SEARCH] ===== SOURCE ENRICHMENT COMPLETE =====`)
  console.log(`[WEB SEARCH] Total sources after enrichment: ${enrichedSources.length}`)
  console.log(`[WEB SEARCH] Starting URL validation for ${enrichedSources.filter(s => s.url).length} URLs`)
  
  // Validate and enrich existing URLs
  let validatedCount = 0
  for (let i = 0; i < enrichedSources.length; i++) {
    const source = enrichedSources[i]
    if (source.url && !source.title) {
      try {
        console.log(`[WEB SEARCH] [URL VALIDATION ${i+1}/${enrichedSources.length}] Validating: ${source.url}`)
        const validation = await validateAndEnrichURL(source.url)
        if (validation.valid && validation.title) {
          source.title = validation.title
          validatedCount++
          console.log(`[WEB SEARCH] [URL VALIDATION ${i+1}/${enrichedSources.length}] ✓ Enriched with title: "${validation.title}"`)
        } else if (validation.valid) {
          validatedCount++
          console.log(`[WEB SEARCH] [URL VALIDATION ${i+1}/${enrichedSources.length}] ✓ Valid but no title available`)
        } else {
          console.log(`[WEB SEARCH] [URL VALIDATION ${i+1}/${enrichedSources.length}] ✗ Invalid: ${validation.error}`)
        }
      } catch (error) {
        console.error(`[WEB SEARCH] [URL VALIDATION ${i+1}/${enrichedSources.length}] Error validating URL ${source.url}:`, error)
        // Continue validation for other URLs (error handling)
      }
    }
  }
  
  console.log(`[WEB SEARCH] ===== URL VALIDATION COMPLETE =====`)
  console.log(`[WEB SEARCH] Validated ${validatedCount} URLs`)
  console.log(`[WEB SEARCH] Final source count: ${enrichedSources.length}`)
  
  return enrichedSources
}

// Extract key terms from a claim for better search query generation
function extractKeyTermsFromClaim(claim: string, industry: string, geography: string): string {
  // Remove common stop words
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those', 'has', 'have', 'had', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'])
  
  // Extract meaningful words (length > 3, not stop words, not industry/geography)
  const words = claim
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !stopWords.has(word) &&
      !word.includes(industry.toLowerCase()) &&
      !word.includes(geography.toLowerCase())
    )
    .slice(0, 5) // Top 5 keywords
  
  return words.join(' ') || claim.substring(0, 100)
}

// Extract text content from HTML (basic implementation)
function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  // Remove HTML tags but preserve structure
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()
  
  // Limit to reasonable size (first 15000 chars for AI processing)
  return text.substring(0, 15000)
}

// Fetch HTML content using Node.js https/http module (fallback for SSL issues)
async function fetchHtmlWithHttps(
  urlString: string,
  agent: any,
  httpModule: any,
  httpsModule: any
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    const isHttps = url.protocol === 'https:'
    const module = isHttps ? httpsModule : httpModule
    
    const options: any = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BainValidator/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
    }
    
    if (isHttps && agent) {
      options.agent = agent
    }

    const req = module.request(options, (res: any) => {
      let data = ''

      res.on('data', (chunk: any) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        }
      })
    })

    req.on('error', (error: any) => {
      reject(error)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.setTimeout(10000)
    req.end()
  })
}

// Validate and match sources to claims using SerpAPI, fetch web pages, and AI validation
async function validateAndMatchSources(
  client: OpenAI,
  originalText: string,
  sources: SourceReference[],
  caseType: string,
  geography: string,
  industry: string
): Promise<SourceReference[]> {
  const { searchWeb } = await import('@/lib/web-search')
  const validatedSources: SourceReference[] = []
  
  console.log(`[SOURCE VALIDATION] ===== STARTING SOURCE VALIDATION =====`)
  console.log(`[SOURCE VALIDATION] Validating ${sources.length} sources`)
  
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]
    const validatedSource = { ...source }
    
    try {
      // Extract the claim this source is supposed to support
      const claim = source.claim_reference || ''
      
      if (!claim || claim.length < 10) {
        console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Skipping - no claim reference`)
        validatedSources.push(validatedSource)
        continue
      }
      
      console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Validating source: ${source.title || source.url || 'Unknown'}`)
      console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Claim: "${claim.substring(0, 100)}..."`)
      
      // Step 1: Search for the source using SerpAPI
      let searchQuery = ''
      let searchResults: any[] = []
      let sourceUrl = source.url
      let pageContent = ''
      let pageTitle = source.title || ''
      let pageExcerpt = source.excerpt || ''
      
      if (source.url) {
        // If we have a URL, use it directly
        sourceUrl = source.url
        console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Source URL provided: ${sourceUrl}`)
      } else if (source.title) {
        // Search for the source by title
        searchQuery = source.title
        console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Searching for source: "${searchQuery}"`)
        
        try {
          searchResults = await searchWeb({
            query: searchQuery,
            geography,
            maxResults: 3, // Get top 3 results
          })
          console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Found ${searchResults.length} search results`)
          
          // Use the first result as the source URL
          if (searchResults.length > 0) {
            sourceUrl = searchResults[0].url
            pageTitle = searchResults[0].title || pageTitle
            pageExcerpt = searchResults[0].snippet || pageExcerpt
            console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Using search result: ${sourceUrl}`)
          }
        } catch (searchError) {
          console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Web search failed:`, searchError)
        }
      } else {
        // Use claim to search for the source
        searchQuery = `${claim.substring(0, 100)} ${industry} ${geography}`
        console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Searching by claim: "${searchQuery}"`)
        
        try {
          searchResults = await searchWeb({
            query: searchQuery,
            geography,
            maxResults: 3,
          })
          console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Found ${searchResults.length} search results`)
          
          if (searchResults.length > 0) {
            sourceUrl = searchResults[0].url
            pageTitle = searchResults[0].title || pageTitle
            pageExcerpt = searchResults[0].snippet || pageExcerpt
            console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Using search result: ${sourceUrl}`)
          }
        } catch (searchError) {
          console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Web search failed:`, searchError)
        }
      }
      
      // Step 2: Fetch the web page content
      if (sourceUrl) {
        try {
          console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Fetching web page: ${sourceUrl}`)
          
          let html = ''
          let fetchSucceeded = false
          
          // Check if SSL verification should be bypassed via environment variable
          const skipSSLVerification = process.env.SKIP_SSL_VERIFICATION === '1' || 
                                      process.env.ALLOW_INSECURE_SSL === '1' ||
                                      process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
          
          if (skipSSLVerification) {
            // Always use HTTPS fallback (skip SSL verification)
            console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Using HTTPS fallback (SKIP_SSL_VERIFICATION enabled)`)
            try {
              const https = await import('https')
              const http = await import('http')
              const httpsAgent = new https.Agent({
                rejectUnauthorized: false, // Skip SSL verification
              })
              
              html = await fetchHtmlWithHttps(sourceUrl, httpsAgent, http, https)
              fetchSucceeded = true
              console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] ✅ Fetched ${html.length} chars via HTTPS fallback`)
            } catch (httpsError: any) {
              console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] HTTPS fallback failed:`, httpsError.message)
              html = ''
            }
          } else {
            // Try standard fetch first, then fallback on SSL errors
            try {
              const fetchResponse = await fetch(sourceUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; BainValidator/1.0)',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
              })
              
              if (!fetchResponse.ok) {
                throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`)
              }
              
              html = await fetchResponse.text()
              fetchSucceeded = true
              console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] ✅ Fetched ${html.length} chars via standard fetch`)
              
            } catch (fetchError: any) {
              // Log full error for debugging
              console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Fetch error:`, {
                message: fetchError?.message,
                code: fetchError?.code,
                cause: fetchError?.cause ? {
                  message: fetchError.cause?.message,
                  code: fetchError.cause?.code,
                } : undefined,
              })
              
              // Check if it's an SSL certificate error
              const errorCode = fetchError?.code || fetchError?.cause?.code
              const errorMessage = (fetchError?.message || fetchError?.cause?.message || '').toLowerCase()
              const causeMessage = (fetchError?.cause?.message || '').toLowerCase()
              
              // More aggressive SSL error detection - "fetch failed" often indicates SSL issues for HTTPS URLs
              const isSSLError = 
                errorCode === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
                errorCode === 'CERT_HAS_EXPIRED' ||
                errorCode === 'SELF_SIGNED_CERT_IN_CHAIN' ||
                errorMessage.includes('certificate') ||
                errorMessage.includes('unable to get local issuer') ||
                (errorMessage.includes('fetch failed') && (causeMessage.includes('certificate') || fetchError?.cause?.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY')) ||
                causeMessage.includes('certificate') ||
                causeMessage.includes('unable to get local issuer')
              
              // For HTTPS URLs, "fetch failed" without timeout/network errors is likely SSL-related
              const isHttpsUrl = sourceUrl.startsWith('https://')
              const isLikelySSLError = isHttpsUrl && 
                                       errorMessage === 'fetch failed' && 
                                       !errorMessage.includes('timeout') && 
                                       !errorMessage.includes('network') &&
                                       !errorMessage.includes('dns')
              
              if (isSSLError || isLikelySSLError) {
                console.warn(`[SOURCE VALIDATION] [${i+1}/${sources.length}] SSL certificate error or fetch failure detected. Attempting HTTPS fallback...`)
                
                // Try with HTTPS module using custom agent
                try {
                  const https = await import('https')
                  const http = await import('http')
                  const httpsAgent = new https.Agent({
                    rejectUnauthorized: false, // Allow insecure SSL for demo (corporate proxy/firewall scenarios)
                  })
                  
                  html = await fetchHtmlWithHttps(sourceUrl, httpsAgent, http, https)
                  fetchSucceeded = true
                  console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] ✅ Fetched ${html.length} chars via HTTPS fallback`)
                } catch (httpsError: any) {
                  console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] HTTPS fallback also failed:`, httpsError.message)
                  // Continue without page content
                  html = ''
                }
              } else {
                // Not an SSL error, log and continue without content
                console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Fetch failed (non-SSL error):`, fetchError.message)
                html = ''
              }
            }
          }
          
          // Process HTML content if we successfully fetched it
          if (html && fetchSucceeded) {
            // Extract text content from HTML
            pageContent = extractTextFromHTML(html)
            
            // Extract title if not already set
            if (!pageTitle) {
              const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
              if (titleMatch) {
                pageTitle = titleMatch[1].trim()
                validatedSource.title = pageTitle
              }
            }
            
            // Extract meta description for excerpt
            if (!pageExcerpt) {
              const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
              if (metaMatch) {
                pageExcerpt = metaMatch[1].trim()
                validatedSource.excerpt = pageExcerpt
              }
            }
            
            // Update source with fetched URL if it was from search
            if (!validatedSource.url && sourceUrl) {
              validatedSource.url = sourceUrl
            }
            
            console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] ✅ Processed ${pageContent.length} characters of content`)
          } else {
            console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] ⚠️ Could not fetch page content, will validate using metadata only`)
          }
          
        } catch (error: any) {
          console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Error fetching page:`, error.message)
          // Continue with AI validation using available info
          pageContent = ''
        }
      } else {
        console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] No URL available, skipping fetch`)
      }
      
      // Step 3: Use AI to validate the claim against the fetched content
      if (sourceUrl || pageContent.length > 0 || searchResults.length > 0) {
        const validationPrompt = `You are a source validation expert. Validate if a claim in a draft document is inline with the actual source content and not ambiguous.

SOURCE INFORMATION:
URL: ${sourceUrl || source.url || 'No URL provided'}
Title: ${pageTitle || source.title || 'Not available'}
${source.author ? `Author: ${source.author}` : ''}
${source.date ? `Date: ${source.date}` : ''}

CLAIM FROM DRAFT THAT SHOULD BE SUPPORTED:
"${claim}"

${pageContent.length > 0 ? `ACTUAL WEB PAGE CONTENT (fetched from source):
${pageContent.substring(0, 12000)}
${pageContent.length > 12000 ? '\n[... content truncated for analysis ...]' : ''}` : ''}

${pageContent.length === 0 && searchResults.length > 0 ? `SEARCH RESULTS FOUND (source content not available, using search snippets):
${searchResults.map((r, idx) => `${idx + 1}. ${r.title}
   URL: ${r.url}
   Snippet: ${r.snippet}
   ${r.date ? `Date: ${r.date}` : ''}`).join('\n\n')}` : ''}

${pageContent.length === 0 && searchResults.length === 0 ? 'NOTE: Could not fetch web page content or find search results. Validating based on available metadata only.' : ''}

Analyze and return JSON:
{
  "is_valid": boolean,
  "is_ambiguous": boolean,
  "match_confidence": number (0-100),
  "validation_status": "correct" | "incorrect" | "ambiguous" | "not_found" | "partial_match" | "content_unavailable",
  "issues": [
    "specific issue 1 - e.g., claim does not match source content",
    "specific issue 2 - e.g., claim is misleading or out of context"
  ],
  "exact_references_found": [
    "exact quote or reference from the web page that supports the claim (include page context)",
    "another relevant reference with specific page location/context"
  ],
  "additional_resources": [
    {
      "title": "title of additional resource",
      "url": "url if available",
      "relevance": "high" | "medium" | "low",
      "reason": "why this is relevant"
    }
  ],
  "claim_accuracy": {
    "matches_content": boolean,
    "accuracy_score": number (0-100),
    "discrepancies": [
      "specific discrepancy between claim and source content"
    ],
    "supporting_evidence": [
      "specific evidence from source that supports the claim"
    ]
  },
  "ambiguity_analysis": {
    "is_ambiguous": boolean,
    "ambiguity_reasons": [
      "reason why the reference might be ambiguous (e.g., multiple interpretations, unclear context)"
    ],
    "clarity_score": number (0-100)
  },
  "validation_notes": "detailed explanation of validation including specific page references and whether the draft is inline with the source"
}

VALIDATION CRITERIA:
1. Check if the claim accurately reflects what's stated in the web page content
2. Verify the claim is not misleading or taken out of context
3. Check if the reference is ambiguous (could refer to multiple sources or interpretations)
4. Identify exact quotes/references from the page that support or contradict the claim
5. Assess if the claim is inline with the source (not contradictory)
6. Check for any discrepancies between the claim and the actual content
7. For ${caseType} in ${geography} for ${industry}, ensure claims are appropriate and accurate
8. Determine if the draft is inline with the reference (consistent, accurate, not misleading)

Return ONLY valid JSON.`

        try {
          const validationCompletion = await client.chat.completions.create({
            model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
            messages: [
              { role: 'system', content: 'You are a source validation expert. Return JSON only.' },
              { role: 'user', content: validationPrompt },
            ],
            temperature: 0.2, // Low temperature for accurate validation
            max_tokens: 2000, // Increased for detailed validation with page content
            response_format: { type: 'json_object' },
          })
          
          const validationResult = JSON.parse(validationCompletion.choices[0]?.message?.content || '{}')
          
          // Update source with validation results
          validatedSource.validation_status = validationResult.validation_status || 'unknown'
          validatedSource.is_valid = validationResult.is_valid !== false
          validatedSource.is_ambiguous = validationResult.is_ambiguous === true
          validatedSource.match_confidence = validationResult.match_confidence || 0
          validatedSource.validation_issues = validationResult.issues || []
          validatedSource.exact_references = validationResult.exact_references_found || []
          validatedSource.additional_resources = validationResult.additional_resources || []
          validatedSource.validation_notes = validationResult.validation_notes
          
          // Update with recommended source if provided
          if (validationResult.recommended_source) {
            if (validationResult.recommended_source.url && !validatedSource.url) {
              validatedSource.url = validationResult.recommended_source.url
            }
            if (validationResult.recommended_source.title && !validatedSource.title) {
              validatedSource.title = validationResult.recommended_source.title
            }
            if (validationResult.recommended_source.excerpt) {
              validatedSource.excerpt = validationResult.recommended_source.excerpt
            }
          }
          
          // If validation found issues, add a finding
          if (validationResult.issues && validationResult.issues.length > 0) {
            console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Issues found: ${validationResult.issues.length}`)
          }
          
          console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Validation complete: ${validationResult.validation_status}, confidence: ${validationResult.match_confidence}%`)
          
        } catch (aiError: any) {
          console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] AI validation failed:`, aiError.message)
          // Continue with source as-is if AI validation fails
        }
      } else {
        console.log(`[SOURCE VALIDATION] [${i+1}/${sources.length}] No search results found, skipping AI validation`)
      }
      
      // Rate limiting: small delay between validations
      if (i < sources.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      validatedSources.push(validatedSource)
      
    } catch (error: any) {
      console.error(`[SOURCE VALIDATION] [${i+1}/${sources.length}] Error validating source:`, error.message)
      // Add source as-is if validation fails
      validatedSources.push(validatedSource)
    }
  }
  
  console.log(`[SOURCE VALIDATION] ===== SOURCE VALIDATION COMPLETE =====`)
  return validatedSources
}

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

// Refine rewritten text to ensure it addresses all findings and would pass validation
async function refineRewrittenText(
  client: OpenAI,
  originalText: string,
  initialRewritten: string,
  findings: any[],
  caseType: string,
  geography: string,
  industry: string,
  stakesLevel: string
): Promise<string> {
  if (findings.length === 0) {
    return initialRewritten
  }
  
  const refinementPrompt = `You are refining a client-safe version of consultant text. The original text had ${findings.length} validation finding(s).

Original text:
${originalText}

Initial rewritten version:
${initialRewritten}

Findings that must be addressed:
${findings.map((f, i) => `${i + 1}. [${f.category}/${f.severity}] ${f.rationale} - Fix: ${f.suggested_fix}`).join('\n')}

Refine the rewritten text to ensure:
1. ALL findings are addressed (every issue fixed or mitigated)
2. Overconfident language is replaced with advisory language (especially critical for ${stakesLevel} stakes)
3. Vague time references have specific dates (${geography}-specific regulations require current dates)
4. Regulatory references include jurisdiction (${geography}) and date context (${getGeographyRegulations(geography)})
5. Numeric claims have [SOURCE NEEDED] markers or citations (${industry} industry data requires authoritative sources)
6. Assumptions are clearly marked with [ASSUMPTION] tags
7. ALL bias findings are addressed - remove demographic, geographic, cultural, or language biases
8. Use inclusive, balanced language that represents diverse perspectives
9. The text maintains professional tone and original meaning
10. Use ${caseType}-appropriate language and ${industry} industry terminology
11. Apply ${stakesLevel} stakes-level rigor (${stakesLevel === 'Board-level' ? 'zero tolerance for high/medium findings' : 'appropriate level of detail'})
12. The refined version should achieve "READY" or "NEEDS_SHAPING" status when re-validated

Context-Specific Requirements:
- Case Type: ${caseType} - ${getCaseTypeRequirements(caseType)}
- Geography: ${geography} - Must comply with ${getGeographyRegulations(geography)}
- Industry: ${industry} - Industry-specific data and regulatory requirements apply
- Stakes Level: ${stakesLevel} - ${getStakesLevelRequirements(stakesLevel)}

Return ONLY the refined rewritten text, no JSON, no explanations, just the improved text.`
  
  try {
    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
      messages: [
        { role: 'system', content: 'You are an expert at refining consultant text to be client-safe and validation-ready.' },
        { role: 'user', content: refinementPrompt },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    })
    
    const refined = completion.choices[0]?.message?.content?.trim() || initialRewritten
    return refined
  } catch (error) {
    console.error('Error refining rewritten text:', error)
    return initialRewritten
  }
}

// Detect bias in the text using AI with multi-dimensional analysis (similar to deepeval approach)
async function detectBias(
  client: OpenAI,
  text: string,
  caseType: string,
  geography: string,
  industry: string
): Promise<{ score: number; findings: any[]; confidence: number; methodology: string }> {
  const biasPrompt = `You are a bias detection expert using a rigorous, multi-dimensional analysis framework. Analyze the following text for potential biases and return JSON:
{
  "bias_score": number (0-100, where 100 = no bias detected, 0 = severe bias),
  "confidence": number (0-100, how confident you are in this assessment),
  "methodology": "brief description of analysis approach",
  "findings": [
    {
      "id": "B-001",
      "category": "Bias",
      "severity": "low" | "medium" | "high",
      "bias_type": "demographic" | "geographic" | "cultural" | "confirmation" | "language" | "stereotyping" | "representation" | "implicit",
      "claim_excerpt": "exact excerpt showing bias (preserve full URLs even if they exceed 150 chars - do NOT truncate URLs, max 300 chars for text with URLs, 150 chars for text without URLs)",
      "rationale": "detailed explanation: (1) what bias is detected, (2) why it's problematic, (3) evidence from text",
      "suggested_fix": "specific, actionable recommendation to remove bias",
      "recommended_owner": "Analyst" | "Manager" | "Legal/Compliance" | "SME",
      "confidence": number (0-100, confidence in this specific finding)
    }
  ],
  "bias_types_detected": ["demographic", "geographic", "cultural", "confirmation", "language", "stereotyping", etc.],
  "analysis_notes": "brief summary of analysis methodology and key observations"
}

BIAS DETECTION FRAMEWORK - Apply systematically:

1. DEMOGRAPHIC BIAS:
   - Check for: Gender, race, age, nationality, religion, sexual orientation, disability status
   - Indicators: Stereotypes, assumptions about capabilities, exclusionary language
   - Evidence required: Specific words/phrases, patterns, implicit assumptions
   - Score impact: High severity = -30 points, Medium = -15, Low = -5

2. GEOGRAPHIC BIAS:
   - Check for: Favoring certain regions/countries without justification, cultural assumptions
   - Indicators: "Western vs Eastern", "developed vs developing", regional stereotypes
   - Evidence required: Comparative language, value judgments, missing perspectives
   - Score impact: High = -20, Medium = -10, Low = -5

3. INDUSTRY/ECONOMIC BIAS:
   - Check for: Favoring certain sectors/companies unfairly, economic assumptions
   - Indicators: Unjustified preferences, missing competitor perspectives
   - Evidence required: Selective data, unbalanced analysis
   - Score impact: High = -15, Medium = -8, Low = -3

4. CONFIRMATION BIAS:
   - Check for: Selective use of data, cherry-picking evidence
   - Indicators: Only supporting data cited, contradictory evidence ignored
   - Evidence required: Missing counter-arguments, one-sided analysis
   - Score impact: High = -25, Medium = -12, Low = -5

5. CULTURAL BIAS:
   - Check for: Assumptions about cultural norms, ethnocentrism
   - Indicators: "Universal" claims without evidence, cultural stereotypes
   - Evidence required: Cultural assumptions, missing cultural context
   - Score impact: High = -20, Medium = -10, Low = -5

6. LANGUAGE BIAS:
   - Check for: Exclusionary, discriminatory, or insensitive language
   - Indicators: Offensive terms, microaggressions, loaded language
   - Evidence required: Specific problematic phrases, tone analysis
   - Score impact: High = -30, Medium = -15, Low = -5

7. STEREOTYPING:
   - Check for: Generalizations about groups without evidence
   - Indicators: "All X are Y", "Typical X behavior", group assumptions
   - Evidence required: Generalizations, group-based claims
   - Score impact: High = -25, Medium = -12, Low = -5

8. UNBALANCED REPRESENTATION:
   - Check for: Missing perspectives, over-representing one view
   - Indicators: Single perspective, missing stakeholder views
   - Evidence required: Missing viewpoints, one-sided analysis
   - Score impact: High = -20, Medium = -10, Low = -5

9. IMPLICIT ASSUMPTIONS:
   - Check for: Hidden biases in word choice, framing, structure
   - Indicators: Subtle language patterns, framing effects
   - Evidence required: Word choice analysis, structural patterns
   - Score impact: High = -15, Medium = -8, Low = -3

SCORING METHODOLOGY:
- Start at 100 (no bias)
- Subtract points for each finding based on severity
- Apply multiplier: High severity findings × 1.5 if multiple types detected
- Final score: max(0, min(100, calculated_score))
- Confidence: Based on clarity of evidence, ambiguity of text, number of findings

VALIDATION CRITERIA (for trust):
- Only flag biases with clear evidence from text
- Distinguish between bias and legitimate business analysis
- Provide specific excerpts as evidence
- Explain why it's problematic (not just that it exists)
- Consider context (${caseType} in ${geography} for ${industry})

Context:
- Case Type: ${caseType}
- Geography: ${geography}
- Industry: ${industry}

Be thorough, fair, and evidence-based. Only flag actual biases with clear justification.
Return ONLY valid JSON, no additional text.`

  try {
    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
      messages: [
        { role: 'system', content: 'You are an expert bias detection analyst. Return JSON only.' },
        { role: 'user', content: `Analyze this text for bias:\n\n${text}` },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })
    
    const biasAnalysis = JSON.parse(completion.choices[0]?.message?.content || '{}')
    
    const findings = (biasAnalysis.findings || []).map((f: any, idx: number) => ({
      id: f.id || `B-${String(idx + 1).padStart(3, '0')}`,
      category: 'Bias',
      severity: f.severity || 'medium',
      bias_type: f.bias_type || 'implicit',
      claim_excerpt: f.claim_excerpt || '',
      rationale: f.rationale || '',
      suggested_fix: f.suggested_fix || 'Review and revise to remove bias',
      recommended_owner: f.recommended_owner || 'Manager',
      confidence: f.confidence || 75,
    }))
    
    const confidence = biasAnalysis.confidence || 75
    
    // Calculate score based on actual findings (don't trust AI's score if it contradicts findings)
    let calculatedScore = 100 // Start with perfect score
    
    if (findings.length === 0) {
      // No findings = perfect score
      calculatedScore = 100
    } else {
      // Calculate score based on findings severity
      const severityPenalties: Record<string, number> = {
        'high': 25,
        'medium': 12,
        'low': 5,
      }
      
      // Count bias types for multiplier
      const biasTypes = new Set(findings.map((f: any) => f.bias_type || 'implicit'))
      const multipleTypesMultiplier = biasTypes.size > 1 ? 1.3 : 1.0
      
      // Deduct points for each finding
      let totalDeduction = 0
      for (const finding of findings) {
        const penalty = severityPenalties[finding.severity] || 12
        totalDeduction += penalty
      }
      
      // Apply multiplier if multiple bias types
      totalDeduction = Math.floor(totalDeduction * multipleTypesMultiplier)
      
      // Calculate final score
      calculatedScore = Math.max(0, 100 - totalDeduction)
      
      // Cross-validate with AI's score: if AI says 100 but we have findings, use our calculation
      const aiScore = biasAnalysis.bias_score || 100
      if (aiScore === 100 && findings.length > 0) {
        // AI's score is wrong - use our calculated score
        console.log(`Bias score mismatch: AI reported ${aiScore} but ${findings.length} findings detected. Using calculated score: ${calculatedScore}`)
      } else if (Math.abs(aiScore - calculatedScore) > 20) {
        // Large discrepancy - use weighted average but favor our calculation
        calculatedScore = Math.floor((calculatedScore * 0.7) + (aiScore * 0.3))
      } else {
        // Close enough - use average
        calculatedScore = Math.floor((calculatedScore * 0.5) + (aiScore * 0.5))
      }
    }
    
    // Apply confidence weighting: lower confidence = more conservative score
    if (confidence < 70 && findings.length > 0) {
      // If low confidence but findings exist, be more conservative (lower score)
      calculatedScore = Math.max(0, calculatedScore - 5)
    }
    
    // Final validation: if findings exist, score MUST be < 100
    if (findings.length > 0 && calculatedScore >= 100) {
      // Force score down based on findings count
      calculatedScore = Math.max(50, 100 - (findings.length * 15))
      console.log(`Forced bias score adjustment: ${findings.length} findings detected, setting score to ${calculatedScore}`)
    }
    
    return {
      score: Math.max(0, Math.min(100, calculatedScore)),
      confidence,
      methodology: biasAnalysis.methodology || biasAnalysis.analysis_notes || 'AI-based multi-dimensional bias analysis',
      findings,
    }
  } catch (error) {
    console.error('Error detecting bias:', error)
    return { score: 100, findings: [] }
  }
}

// Verify that the rewritten text would pass validation
async function verifyRewrittenText(
  client: OpenAI,
  rewrittenText: string,
  caseType: string,
  geography: string,
  industry: string,
  stakesLevel: string
): Promise<{ improved: boolean; newFindings: any[]; newLabel: string }> {
  const verificationPrompt = `Quickly validate this rewritten text against context-specific requirements and return JSON:
{
  "findings_count": number,
  "label": "READY" | "NEEDS_SHAPING" | "REQUIRES_REVIEW",
  "findings": [brief list of any remaining issues]
}

Text to validate:
${rewrittenText}

Context-Specific Validation:
- Case Type: ${caseType} - ${getCaseTypeRequirements(caseType)}
- Geography: ${geography} - Must comply with ${getGeographyRegulations(geography)}
- Industry: ${industry} - Industry-specific requirements apply
- Stakes Level: ${stakesLevel} - ${getStakesLevelRequirements(stakesLevel)}

Check that:
1. All regulatory references include ${geography} jurisdiction and dates
2. All numeric claims are sourced (critical for ${industry})
3. Language is appropriate for ${stakesLevel} stakes
4. ${caseType}-specific requirements are met

Return ONLY valid JSON.`
  
  try {
    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
      messages: [
        { role: 'system', content: 'You are a quick validator. Return JSON only.' },
        { role: 'user', content: verificationPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })
    
    const verification = JSON.parse(completion.choices[0]?.message?.content || '{}')
    return {
      improved: (verification.findings_count || 0) === 0 || verification.label === 'READY',
      newFindings: verification.findings || [],
      newLabel: verification.label || 'NEEDS_SHAPING',
    }
  } catch (error) {
    console.error('Error verifying rewritten text:', error)
    return { improved: false, newFindings: [], newLabel: 'NEEDS_SHAPING' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { text, case_type, geography, industry, stakes_level } = body
    
    // Validate required fields
    if (!text || !case_type || !geography || !industry || !stakes_level) {
      return NextResponse.json(
        { error: 'Missing required fields: text, case_type, geography, industry, stakes_level' },
        { status: 400 }
      )
    }
    
    // Check if Azure OpenAI is configured
    try {
      const client = getOpenAIClient()
      
      // Build context-specific validation guidelines based on metadata
      const contextGuidelines = buildContextGuidelines(case_type, geography, industry, stakes_level)
      
      const systemPrompt = `You are an expert consultant quality reviewer for Bain & Company. Your role is to validate case deliverable drafts for "case readiness" and provide structured feedback.

${contextGuidelines}

Analyze the provided draft text and return a JSON object with the following structure:
{
  "label": "READY" | "NEEDS_SHAPING" | "REQUIRES_REVIEW",
  "score": number (0-100),
  "findings": [
    {
      "id": "F-001",
      "category": "Freshness" | "Regulatory" | "Evidence" | "BainStyle" | "Bias",
      "severity": "low" | "medium" | "high",
      "claim_excerpt": "excerpt from the text (preserve full URLs even if they exceed 150 chars - do NOT truncate URLs, max 300 chars for text with URLs, 150 chars for text without URLs)",
      "rationale": "explanation of the issue with context-specific details",
      "suggested_fix": "specific recommendation tailored to the context",
      "recommended_owner": "Analyst" | "Manager" | "Legal/Compliance" | "SME"
    }
  ],
  "rewritten_text": "client-safe version that addresses ALL findings and is contextually appropriate",
  "summary_next_steps": ["bullet 1", "bullet 2", "bullet 3"],
  "sources": [
    {
      "id": "S-001",
      "url": "https://example.com/source",
      "title": "Source Title",
      "author": "Author Name",
      "date": "2024-01-01",
      "excerpt": "Relevant excerpt from source",
      "claim_reference": "Which claim this supports",
      "type": "url" | "citation" | "internal" | "study" | "regulation"
    }
  ]
}

CRITICAL: The rewritten_text MUST:
1. Address EVERY finding identified - fix or mitigate each issue
2. Replace overconfident language ("will guarantee", "proves", "ensures") with advisory language ("may", "suggests", "indicates")
3. Add specific dates to vague time references (e.g., "as of [DATE]" or "in [YEAR]")
4. Add jurisdiction context to regulatory references (e.g., "${geography} GDPR" or "${geography} SEC regulations")
5. Add [SOURCE: description or URL] markers for all claims that need sources
6. Preserve existing [SOURCE: ...] markers from the original text
7. Add [SOURCE NEEDED] markers or citations for unsourced numeric claims
8. Add [ASSUMPTION] markers where assumptions are made
9. Maintain the original meaning and structure while making it client-safe
10. Use industry-appropriate terminology and case-type-specific language
11. The rewritten text should ideally achieve "READY" status when re-validated

Validation Criteria (apply with context-specific rigor):
1. Freshness Risk: Flag vague time references without dates, dates older than 24 months in time-sensitive domains (laws, tariffs, sanctions, interest rates, market data). ${geography}-specific regulations and market data require current dates.
2. Regulatory Risk: Detect regulatory keywords without jurisdiction/date context. ${geography}-specific regulations (${getGeographyRegulations(geography)}) must be explicitly referenced with dates.
3. Evidence Risk: Flag numeric claims without sources, references to studies/research without citations. ${industry} industry data requires authoritative sources. Extract and catalog all [SOURCE: ...] markers, URLs (https://...), and citations (Author, Year) found in the text for the sources array.
4. Bain-Style Risk: Detect overconfident language ("will guarantee", "proves", "ensures") and suggest advisory alternatives. ${stakes_level} stakes require more conservative language.
5. Bias Risk: Detect potential biases including:
   - Demographic bias (gender, race, age, nationality, religion)
   - Geographic bias (favoring certain regions/countries)
   - Industry bias (favoring certain sectors or companies)
   - Confirmation bias (selective use of data)
   - Cultural bias (assumptions about cultural norms)
   - Language bias (exclusionary or discriminatory language)
   - Stereotyping or generalizations without evidence
   - Unbalanced representation of perspectives
   Calculate a bias score (0-100, where 100 = no bias detected, 0 = severe bias).

Readiness Label Rules (context-adjusted):
- REQUIRES_REVIEW: Any high-severity finding OR ${stakes_level === 'Board-level' ? 'Board-level stakes (stricter: any medium/high findings)' : 'Client discussion with high-severity findings'}
- NEEDS_SHAPING: Only medium/low findings exist OR ${stakes_level === 'Internal draft' ? 'Internal drafts with minor issues' : 'issues that need refinement'}
- READY: Only low findings and at least one source/citation marker exists, OR content is purely structural. ${stakes_level === 'Board-level' ? 'Board-level requires zero high/medium findings' : 'Standard validation applies'}

Return ONLY valid JSON, no additional text or markdown formatting.`

      const userPrompt = `Please validate the following draft text:\n\n${text}`
      
      // Try with response_format first, but handle if it's not supported
      let completion
      try {
        completion = await client.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        })
      } catch (formatError: any) {
        // If response_format is not supported, try without it
        if (formatError.message?.includes('response_format') || formatError.code === 'invalid_parameter') {
          console.warn('[AI RESPONSE] response_format not supported, retrying without it...')
          completion = await client.chat.completions.create({
            model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
            messages: [
              { role: 'system', content: systemPrompt + '\n\nCRITICAL: You MUST return ONLY valid JSON. No markdown, no code blocks, no explanations. Just the JSON object.' },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 4000,
          })
        } else {
          throw formatError
        }
      }
      
      const responseText = completion.choices[0]?.message?.content || ''
      
      // Parse JSON response with better error handling
      let result: ValidationResult
      try {
        // Clean the response text - remove markdown code blocks if present
        let cleanedText = responseText.trim()
        
        // Remove markdown code blocks (```json ... ```)
        if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
        }
        
        // Try to extract JSON if there's extra text
        let jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        } else {
          // If no JSON object found, try to find any JSON structure
          jsonMatch = cleanedText.match(/\[[\s\S]*\]/) // Array
          if (jsonMatch) {
            cleanedText = jsonMatch[0]
          }
        }
        
        // Final check - if still not valid JSON structure, try to fix common issues
        if (!cleanedText.trim().startsWith('{') && !cleanedText.trim().startsWith('[')) {
          console.warn('[AI RESPONSE] Response does not start with JSON. Attempting to find JSON...')
          // Try to find JSON anywhere in the text
          const allJsonMatches = cleanedText.match(/\{[\s\S]{20,}\}/g)
          if (allJsonMatches && allJsonMatches.length > 0) {
            cleanedText = allJsonMatches[0] // Use the first/largest match
            console.log('[AI RESPONSE] Found JSON in text, extracted it')
          }
        }
        
        console.log(`[AI RESPONSE] Attempting to parse JSON (length: ${cleanedText.length})`)
        console.log(`[AI RESPONSE] First 200 chars: ${cleanedText.substring(0, 200)}`)
        console.log(`[AI RESPONSE] Last 200 chars: ${cleanedText.substring(Math.max(0, cleanedText.length - 200))}`)
        
        // Try parsing
        try {
          result = JSON.parse(cleanedText)
        } catch (parseErr: any) {
          // If parsing fails, try to fix common JSON issues
          console.log('[AI RESPONSE] Initial parse failed, attempting to fix JSON...')
          
          // Try to fix trailing commas
          let fixedText = cleanedText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
          
          // Try to fix unclosed strings
          fixedText = fixedText.replace(/(".*?)(\n)(.*?")/g, '$1 $3')
          
          try {
            result = JSON.parse(fixedText)
            console.log('[AI RESPONSE] Successfully parsed after fixing JSON')
          } catch (fixErr) {
            // If still fails, throw original error with more context
            console.error('[AI RESPONSE] JSON fix also failed')
            throw parseErr
          }
        }
        
        // Validate the structure
        if (!result.label || !result.findings || !result.rewritten_text) {
          console.error('[AI RESPONSE] Missing required fields:', {
            hasLabel: !!result.label,
            hasFindings: !!result.findings,
            hasRewrittenText: !!result.rewritten_text,
            resultKeys: Object.keys(result),
          })
          throw new Error('Invalid response structure from AI - missing required fields')
        }
        
        // Ensure all required fields are present
        // NOTE: Don't set bias_score here - it will be calculated after collecting all bias findings
        result = {
          label: result.label || 'NEEDS_SHAPING',
          score: result.score || 50,
          findings: result.findings || [],
          rewritten_text: result.rewritten_text || text,
          summary_next_steps: result.summary_next_steps || ['Review the draft for quality'],
          // bias_score will be calculated below based on actual findings
        }
        
        // Post-process findings to fix truncated URLs in claim_excerpts
        // Check if any claim_excerpt contains a truncated URL and try to find the full URL from the original text
        result.findings = result.findings.map(finding => {
          const claimExcerpt = finding.claim_excerpt || ''
          const urlPattern = /https?:\/\/[^\s\)]*/gi
          const truncatedUrlMatch = claimExcerpt.match(urlPattern)
          
          if (truncatedUrlMatch && truncatedUrlMatch.length > 0) {
            // Check if URL appears truncated (doesn't end with common URL endings)
            const truncatedUrl = truncatedUrlMatch[0]
            const commonEndings = ['.com', '.org', '.net', '.edu', '.gov', '.in', '.uk', '/', '?', '&']
            const appearsTruncated = !commonEndings.some(ending => truncatedUrl.endsWith(ending)) && truncatedUrl.length < 50
            
            if (appearsTruncated) {
              // Try to find the full URL in the original text
              const fullUrlPattern = new RegExp(truncatedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\s\\)]*', 'gi')
              const fullUrlMatch = text.match(fullUrlPattern)
              
              if (fullUrlMatch && fullUrlMatch[0] && fullUrlMatch[0].length > truncatedUrl.length) {
                // Replace truncated URL with full URL
                finding.claim_excerpt = claimExcerpt.replace(truncatedUrl, fullUrlMatch[0])
                console.log(`[URL FIX] Fixed truncated URL in finding ${finding.id}: ${truncatedUrl} -> ${fullUrlMatch[0]}`)
              }
            }
          }
          
          return finding
        })
        
        console.log(`[AI RESPONSE] Successfully parsed. Label: ${result.label}, Findings: ${result.findings.length}, Score: ${result.score}`)
        
        // Run bias detection using AI with multi-dimensional analysis (similar to deepeval)
        const biasResult = await detectBias(client, text, case_type, geography, industry)
        
        // Collect ALL bias findings (from main validation + dedicated bias detection)
        const allBiasFindings = [
          ...result.findings.filter(f => f.category === 'Bias'),
          ...biasResult.findings
        ]
        
        // Remove duplicate bias findings from main result
        result.findings = result.findings.filter(f => f.category !== 'Bias')
        
        // Add all unique bias findings
        const uniqueBiasFindings = allBiasFindings.filter((finding, index, self) =>
          index === self.findIndex(f => f.claim_excerpt === finding.claim_excerpt)
        )
        result.findings.push(...uniqueBiasFindings)
        
        // Recalculate bias score based on ALL bias findings
        let finalBiasScore = 100
        if (uniqueBiasFindings.length > 0) {
          const severityPenalties: Record<string, number> = {
            'high': 25,
            'medium': 12,
            'low': 5,
          }
          
          const biasTypes = new Set(uniqueBiasFindings.map(f => (f as any).bias_type || 'implicit'))
          const multipleTypesMultiplier = biasTypes.size > 1 ? 1.3 : 1.0
          
          let totalDeduction = 0
          for (const finding of uniqueBiasFindings) {
            const penalty = severityPenalties[finding.severity] || 12
            totalDeduction += penalty
          }
          
          totalDeduction = Math.floor(totalDeduction * multipleTypesMultiplier)
          finalBiasScore = Math.max(0, 100 - totalDeduction)
          
          console.log(`Bias score calculated: ${uniqueBiasFindings.length} findings, ${totalDeduction} points deducted, final score: ${finalBiasScore}`)
        } else {
          // No bias findings = perfect score
          finalBiasScore = 100
        }
        
        // Use the recalculated score (not the AI's potentially incorrect score)
        result.bias_score = finalBiasScore
        
        // Debug logging to verify score calculation
        console.log(`[BIAS SCORE] Calculated: ${finalBiasScore} from ${uniqueBiasFindings.length} findings`)
        if (uniqueBiasFindings.length > 0 && finalBiasScore === 100) {
          console.error(`[BIAS SCORE ERROR] Findings detected but score is 100!`, uniqueBiasFindings.map(f => ({ 
            id: f.id, 
            severity: f.severity, 
            excerpt: f.claim_excerpt?.substring(0, 50) 
          })))
        }
        
        // Store bias metadata for transparency
        ;(result as any).bias_confidence = biasResult.confidence
        ;(result as any).bias_methodology = biasResult.methodology
        
        // Validate and refine the rewritten text to ensure it addresses all findings
        const refinedRewritten = await refineRewrittenText(
          client,
          text,
          result.rewritten_text,
          result.findings,
          case_type,
          geography,
          industry,
          stakes_level
        )
        
        result.rewritten_text = refinedRewritten
        
        // Re-check bias on rewritten text to ensure improvement
        const rewrittenBiasResult = await detectBias(client, refinedRewritten, case_type, geography, industry)
        
        // Collect bias findings from rewritten text
        const rewrittenBiasFindings = rewrittenBiasResult.findings
        
        // Recalculate score based on rewritten text bias findings
        let rewrittenBiasScore = 100
        if (rewrittenBiasFindings.length > 0) {
          const severityPenalties: Record<string, number> = {
            'high': 25,
            'medium': 12,
            'low': 5,
          }
          
          const biasTypes = new Set(rewrittenBiasFindings.map(f => (f as any).bias_type || 'implicit'))
          const multipleTypesMultiplier = biasTypes.size > 1 ? 1.3 : 1.0
          
          let totalDeduction = 0
          for (const finding of rewrittenBiasFindings) {
            const penalty = severityPenalties[finding.severity] || 12
            totalDeduction += penalty
          }
          
          totalDeduction = Math.floor(totalDeduction * multipleTypesMultiplier)
          rewrittenBiasScore = Math.max(0, 100 - totalDeduction)
        }
        
        // Use the better score (higher = less bias) - but don't overwrite if original was already calculated correctly
        // Only update if rewritten text has fewer bias issues
        if (rewrittenBiasScore > (result.bias_score || 0)) {
          result.bias_score = rewrittenBiasScore
          console.log(`Bias score improved in rewritten text: ${result.bias_score} -> ${rewrittenBiasScore}`)
        } else {
          console.log(`Bias score from original text maintained: ${result.bias_score} (rewritten: ${rewrittenBiasScore})`)
        }
        
        // Verify the rewritten text would pass validation (optional check)
        try {
          const verificationResult = await verifyRewrittenText(
            client,
            refinedRewritten,
            case_type,
            geography,
            industry,
            stakes_level
          )
          
          // If verification shows significant improvement, update the result
          if (verificationResult.improved && verificationResult.newFindings.length < result.findings.length) {
            result.rewritten_text = refinedRewritten
            // Add a note about verification in the summary if significantly improved
            if (verificationResult.newFindings.length === 0 || 
                (verificationResult.newLabel === 'READY' && result.label !== 'READY')) {
              result.summary_next_steps.unshift('✓ Rewritten text verified and improved')
            }
          }
        } catch (verifyError) {
          // Verification is optional, continue with refined text
          console.log('Verification step skipped:', verifyError)
        }
        
      } catch (parseError: any) {
        console.error('[AI RESPONSE] Failed to parse AI response:', parseError)
        console.error('[AI RESPONSE] Parse error message:', parseError.message)
        console.error('[AI RESPONSE] Response text length:', responseText.length)
        console.error('[AI RESPONSE] Response text (first 500 chars):', responseText.substring(0, 500))
        console.error('[AI RESPONSE] Response text (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)))
        
        // Try to provide a helpful error message
        let errorMessage = 'Failed to parse AI validation response'
        if (parseError.message) {
          errorMessage += `: ${parseError.message}`
        }
        if (responseText.includes('```')) {
          errorMessage += '. Response appears to be wrapped in markdown code blocks.'
        }
        if (!responseText.trim().startsWith('{')) {
          errorMessage += '. Response does not start with JSON object.'
        }
        
        // Try fallback: use heuristic validation
        console.log('[AI RESPONSE] Attempting fallback result creation...')
        try {
          const { validateDraft, ValidationInput } = await import('@/lib/validation')
          const input: ValidationInput = {
            text,
            case_type,
            geography,
            industry,
            stakes_level,
          }
          const fallbackResult = validateDraft(input)
          console.log('[AI RESPONSE] Using fallback heuristic validation')
          return NextResponse.json({
            ...fallbackResult,
            _fallback: true,
            _message: 'AI response parsing failed. Using heuristic validation. Check server logs for details.',
            _aiError: parseError.message,
          })
        } catch (fallbackError) {
          console.error('[AI RESPONSE] Fallback also failed:', fallbackError)
          throw new Error(errorMessage)
        }
      }
      
      // Final validation: Ensure bias score matches actual bias findings
      const finalBiasFindings = result.findings.filter(f => f.category === 'Bias')
      if (finalBiasFindings.length > 0) {
        // Recalculate one more time to be absolutely sure
        const severityPenalties: Record<string, number> = {
          'high': 25,
          'medium': 12,
          'low': 5,
        }
        
        const biasTypes = new Set(finalBiasFindings.map(f => (f as any).bias_type || 'implicit'))
        const multipleTypesMultiplier = biasTypes.size > 1 ? 1.3 : 1.0
        
        let totalDeduction = 0
        for (const finding of finalBiasFindings) {
          const penalty = severityPenalties[finding.severity] || 12
          totalDeduction += penalty
        }
        
        totalDeduction = Math.floor(totalDeduction * multipleTypesMultiplier)
        const recalculatedScore = Math.max(0, 100 - totalDeduction)
        
        // Force the correct score
        if (result.bias_score !== recalculatedScore) {
          console.log(`[BIAS SCORE FIX] Correcting score from ${result.bias_score} to ${recalculatedScore} (${finalBiasFindings.length} findings)`)
          result.bias_score = recalculatedScore
        }
      } else if (result.bias_score === undefined) {
        // No bias findings = perfect score
        result.bias_score = 100
      }
      
      console.log(`[FINAL RESULT] Bias score: ${result.bias_score}, Bias findings: ${finalBiasFindings.length}`)
      
      // Extract and catalog sources from the text
      let extractedSources = extractSources(text, result.rewritten_text, case_type, geography, industry)
      
      // Validate and match sources to claims using SerpAPI and AI
      if (extractedSources.length > 0 && process.env.SERP_API_KEY) {
        try {
          console.log(`[SOURCE VALIDATION] Starting validation for ${extractedSources.length} sources`)
          extractedSources = await validateAndMatchSources(
            client,
            text,
            extractedSources,
            case_type,
            geography,
            industry
          )
          console.log(`[SOURCE VALIDATION] Completed validation for ${extractedSources.length} sources`)
        } catch (sourceValidationError) {
          console.error('[SOURCE VALIDATION] Error during source validation:', sourceValidationError)
          // Continue with unvalidated sources if validation fails
        }
      }
      
      // Enrich sources with web search for unsourced claims
      try {
        // Find all findings that need sources (Evidence, Freshness with dates, Regulatory)
        const findingsNeedingSources = result.findings.filter(f => {
          const claim = f.claim_excerpt || ''
          const hasSource = claim.match(/\[SOURCE:/) || claim.match(/https?:\/\//)
          const needsSource = (f.category === 'Evidence' || f.category === 'Freshness' || f.category === 'Regulatory') && !hasSource
          return needsSource && claim.length > 20
        })
        
        // Also extract numeric claims and regulatory references from text for proactive search
        const numericClaims = extractNumericClaims(text)
        const regulatoryClaims = extractRegulatoryClaims(text, geography)
        
        console.log(`[WEB SEARCH] ===== WEB SEARCH DEBUG =====`)
        console.log(`[WEB SEARCH] SERP_API_KEY configured: ${!!process.env.SERP_API_KEY}`)
        console.log(`[WEB SEARCH] SERP_API_KEY value: ${process.env.SERP_API_KEY ? process.env.SERP_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`)
        console.log(`[WEB SEARCH] Findings needing sources: ${findingsNeedingSources.length}`)
        console.log(`[WEB SEARCH] Numeric claims found: ${numericClaims.length}`)
        console.log(`[WEB SEARCH] Regulatory claims found: ${regulatoryClaims.length}`)
        console.log(`[WEB SEARCH] Existing sources before enrichment: ${extractedSources.length}`)
        
        // Combine all claims that need sources
        const allClaimsNeedingSources = [
          ...findingsNeedingSources.map(f => ({
            claim: f.claim_excerpt || f.rationale || '',
            category: f.category,
            finding: f,
          })),
          ...numericClaims.map(claim => ({ claim, category: 'Evidence' as const, finding: null })),
          ...regulatoryClaims.map(claim => ({ claim, category: 'Regulatory' as const, finding: null })),
        ].filter(item => item.claim.length > 20)
        
        console.log(`[WEB SEARCH] Total claims needing sources: ${allClaimsNeedingSources.length}`)
        
        if (allClaimsNeedingSources.length > 0 && process.env.SERP_API_KEY) {
          // Convert to findings format for enrichment function
          const findingsForSearch = allClaimsNeedingSources.map(item => ({
            claim_excerpt: item.claim,
            category: item.category,
            rationale: item.claim,
          }))
          
          extractedSources = await enrichSourcesWithWebSearch(
            extractedSources,
            findingsForSearch,
            case_type,
            geography,
            industry
          )
          console.log(`[WEB SEARCH] Final sources count: ${extractedSources.length}`)
        } else if (!process.env.SERP_API_KEY) {
          console.log(`[WEB SEARCH] SERP_API_KEY not found in environment variables`)
          console.log(`[WEB SEARCH] Available env vars: ${Object.keys(process.env).filter(k => k.includes('SERP') || k.includes('SEARCH')).join(', ')}`)
        } else {
          console.log(`[WEB SEARCH] No claims needing sources`)
        }
        console.log(`[WEB SEARCH] ===== END WEB SEARCH DEBUG =====`)
      } catch (webSearchError) {
        console.error('[WEB SEARCH] Enrichment failed:', webSearchError)
        console.error('[WEB SEARCH] Error details:', webSearchError instanceof Error ? webSearchError.message : String(webSearchError))
        if (webSearchError instanceof Error && webSearchError.stack) {
          console.error('[WEB SEARCH] Stack:', webSearchError.stack)
        }
        // Continue with existing sources if web search fails
      }
      
      result.sources = extractedSources
      
      // Note: Source validation issues are displayed in the Sources & References section of the UI
      // We don't add them to the findings table to avoid duplication
      
      return NextResponse.json(result)
      
    } catch (configError: any) {
      // If Azure OpenAI is not configured, fall back to heuristic validation
      if (configError.message?.includes('Missing Azure OpenAI')) {
        const { validateDraft } = await import('@/lib/validation')
        const input: ValidationInput = {
          text,
          case_type,
          geography,
          industry,
          stakes_level,
        }
        const result = validateDraft(input)
        return NextResponse.json({
          ...result,
          _fallback: true,
          _message: 'Using heuristic validation. Configure Azure OpenAI for AI-powered validation.',
        })
      }
      throw configError
    }
  } catch (error: any) {
    console.error('Validation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error during validation' },
      { status: 500 }
    )
  }
}

