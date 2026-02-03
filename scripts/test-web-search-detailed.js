/**
 * Detailed Web Search Diagnostic Test
 * Tests web search functionality specifically
 */

const testDraft = `The Indian fintech market has grown 45% year-over-year in 2023, reaching $85 billion in total transaction value. This growth is driven by increased digital adoption and favorable regulatory environment under Section 80G of the Income Tax Act. However, recent RBI guidelines from 2024 require stricter compliance for digital lending platforms.

Key findings:
- Mobile payment adoption increased by 60% in 2023
- Regulatory compliance costs have risen by 25% since the new guidelines
- Market consolidation expected in 2024-2025

The sector will continue to grow rapidly, with projections showing 50% CAGR over the next three years.`

async function testWebSearch() {
  console.log('🔍 Detailed Web Search Diagnostic Test\n')
  console.log('='.repeat(60))
  
  try {
    console.log('\n1️⃣ Testing direct web search API...')
    const searchTest = await fetch('http://localhost:3000/api/test-search?query=Indian+fintech+market+growth+2024')
    const searchResult = await searchTest.json()
    console.log(`   API Key Configured: ${searchResult.apiKeyConfigured}`)
    console.log(`   Results Found: ${searchResult.resultsCount}`)
    if (searchResult.results && searchResult.results.length > 0) {
      console.log('   ✅ Web search API is working')
      searchResult.results.slice(0, 2).forEach((r, i) => {
        console.log(`      ${i+1}. ${r.title}`)
        console.log(`         ${r.url}`)
      })
    } else {
      console.log('   ⚠️  Web search API returned 0 results')
      console.log('   This could indicate:')
      console.log('      - SSL certificate issues (should auto-fallback)')
      console.log('      - API rate limiting')
      console.log('      - Invalid API key')
      console.log('      - Network issues')
    }
    
    console.log('\n2️⃣ Testing validation with web search enrichment...')
    const response = await fetch('http://localhost:3000/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testDraft,
        case_type: 'Strategy',
        geography: 'India',
        industry: 'Financial Services',
        stakes_level: 'Client discussion'
      })
    })
    
    const result = await response.json()
    
    console.log(`   Findings: ${result.findings?.length || 0}`)
    console.log(`   Sources: ${result.sources?.length || 0}`)
    
    // Analyze findings that should trigger web search
    const findingsNeedingSources = result.findings?.filter(f => {
      const claim = f.claim_excerpt || ''
      const hasSource = claim.match(/\[SOURCE:/) || claim.match(/https?:\/\//)
      const needsSource = (f.category === 'Evidence' || f.category === 'Freshness' || f.category === 'Regulatory') && !hasSource
      return needsSource && claim.length > 20
    }) || []
    
    console.log(`\n   Findings needing sources: ${findingsNeedingSources.length}`)
    findingsNeedingSources.forEach((f, i) => {
      console.log(`      ${i+1}. [${f.category}] "${f.claim_excerpt?.substring(0, 60)}..."`)
    })
    
    // Check sources
    const webSearchSources = result.sources?.filter(s => 
      s.type === 'url' && s.claim_reference && !s.url?.includes('[SOURCE:')
    ) || []
    
    console.log(`\n   Web search sources: ${webSearchSources.length}`)
    if (webSearchSources.length > 0) {
      console.log('   ✅ Web search enrichment is working!')
      webSearchSources.slice(0, 3).forEach((s, i) => {
        console.log(`      ${i+1}. ${s.title || s.url}`)
        if (s.url) console.log(`         ${s.url}`)
      })
    } else {
      console.log('   ⚠️  No web search sources found')
      if (findingsNeedingSources.length > 0) {
        console.log('   ⚠️  There are findings needing sources, but web search didn\'t enrich them')
        console.log('   Possible reasons:')
        console.log('      - Web search API is failing (check server logs)')
        console.log('      - Rate limiting prevented searches')
        console.log('      - No results found for queries')
      } else {
        console.log('   ℹ️  No findings need sources (all claims already have sources)')
      }
    }
    
    // Check extracted sources
    const extractedSources = result.sources?.filter(s => 
      s.url?.match(/\[SOURCE:/) || !s.claim_reference
    ) || []
    console.log(`\n   Extracted sources (from text): ${extractedSources.length}`)
    
    console.log('\n' + '='.repeat(60))
    console.log('\n📊 Summary:')
    console.log(`   Direct API Test: ${searchResult.resultsCount > 0 ? '✅ Working' : '⚠️  No Results'}`)
    console.log(`   Findings Needing Sources: ${findingsNeedingSources.length}`)
    console.log(`   Web Search Sources Added: ${webSearchSources.length}`)
    console.log(`   Status: ${webSearchSources.length > 0 ? '✅ Working' : findingsNeedingSources.length > 0 ? '⚠️  Not Working' : 'ℹ️  N/A'}`)
    
    console.log('\n💡 Next Steps:')
    if (searchResult.resultsCount === 0) {
      console.log('   1. Check server console logs for [WEB SEARCH] messages')
      console.log('   2. Verify SERP_API_KEY is correct in .env.local')
      console.log('   3. Check for SSL certificate errors in logs')
      console.log('   4. Try restarting the dev server')
    } else if (webSearchSources.length === 0 && findingsNeedingSources.length > 0) {
      console.log('   1. Web search API works, but enrichment not happening')
      console.log('   2. Check server logs for [WEB SEARCH] enrichment messages')
      console.log('   3. Verify findings match criteria for needing sources')
    } else {
      console.log('   ✅ Everything appears to be working!')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testWebSearch().catch(console.error)

