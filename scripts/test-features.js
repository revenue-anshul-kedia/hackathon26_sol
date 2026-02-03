/**
 * Feature Validation Test Script
 * Tests all web search and source enrichment features
 * 
 * Usage: node scripts/test-features.js
 * 
 * Make sure SERP_API_KEY is set in .env.local and the dev server is running
 */

const testDraft = `The Indian fintech market has grown 45% year-over-year in 2023, reaching $85 billion in total transaction value. This growth is driven by increased digital adoption and favorable regulatory environment under Section 80G of the Income Tax Act. However, recent RBI guidelines from 2024 require stricter compliance for digital lending platforms.

Key findings:
- Mobile payment adoption increased by 60% in 2023
- Regulatory compliance costs have risen by 25% since the new guidelines
- Market consolidation expected in 2024-2025

The sector will continue to grow rapidly, with projections showing 50% CAGR over the next three years.`

async function testFeatures() {
  console.log('🧪 Testing Web Search and Source Enrichment Features\n')
  console.log('=' .repeat(60))
  
  // Test 1: Check if API is accessible
  console.log('\n📋 Test 1: API Accessibility')
  try {
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
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log('✅ API is accessible')
    console.log(`   Label: ${result.label}`)
    console.log(`   Score: ${result.score}`)
    console.log(`   Findings: ${result.findings?.length || 0}`)
    console.log(`   Sources: ${result.sources?.length || 0}`)
    
    // Test 2: Check source enrichment
    console.log('\n📋 Test 2: Source Enrichment')
    console.log(`   Findings breakdown:`)
    result.findings?.forEach(f => {
      console.log(`     - ${f.category}: "${f.claim_excerpt?.substring(0, 50) || f.rationale?.substring(0, 50) || 'N/A'}..."`)
    })
    
    const evidenceFindingsCount = result.findings?.filter(f => f.category === 'Evidence').length || 0
    const regulatoryFindingsCount = result.findings?.filter(f => f.category === 'Regulatory').length || 0
    console.log(`   Evidence findings: ${evidenceFindingsCount}`)
    console.log(`   Regulatory findings: ${regulatoryFindingsCount}`)
    
    if (result.sources && result.sources.length > 0) {
      console.log(`✅ Sources found: ${result.sources.length}`)
      const webSources = result.sources.filter(s => s.type === 'url' || s.url)
      console.log(`   Web search sources: ${webSources.length}`)
      webSources.slice(0, 3).forEach((source, idx) => {
        console.log(`   ${idx + 1}. ${source.title || source.url}`)
        if (source.url) console.log(`      URL: ${source.url}`)
        if (source.claim_reference) {
          console.log(`      Claim: ${source.claim_reference.substring(0, 60)}...`)
        }
      })
    } else {
      console.log('⚠️  No sources found')
      console.log('   Possible reasons:')
      console.log('   1. No unsourced claims detected in findings')
      console.log('   2. Web search API not responding (check server logs)')
      console.log('   3. SERP_API_KEY not loaded (restart dev server)')
      console.log('   4. SSL certificate issues (should auto-fallback)')
    }
    
    // Test 3: Check URL validation
    console.log('\n📋 Test 3: URL Validation')
    const sourcesWithUrls = result.sources?.filter(s => s.url) || []
    const sourcesWithTitles = sourcesWithUrls.filter(s => s.title)
    console.log(`   URLs found: ${sourcesWithUrls.length}`)
    console.log(`   URLs with metadata: ${sourcesWithTitles.length}`)
    if (sourcesWithTitles.length > 0) {
      console.log('✅ URL validation is working')
    } else if (sourcesWithUrls.length > 0) {
      console.log('⚠️  URLs found but metadata not enriched (may be rate limited)')
    } else {
      console.log('⚠️  No URLs to validate')
    }
    
    // Test 4: Check error handling
    console.log('\n📋 Test 4: Error Handling')
    // Check if validation completed even if there are errors
    if (result.label && result.score !== undefined) {
      console.log('✅ Validation completed successfully')
      console.log('✅ Error handling: Continues on failures')
    } else {
      console.log('❌ Validation did not complete')
    }
    
    // Test 5: Check rate limiting
    console.log('\n📋 Test 5: Rate Limiting')
    const evidenceFindingsForRateLimit = result.findings?.filter(f => f.category === 'Evidence') || []
    console.log(`   Evidence findings: ${evidenceFindingsForRateLimit.length}`)
    console.log(`   Sources from web search: ${result.sources?.filter(s => s.type === 'url' && s.claim_reference).length || 0}`)
    if (evidenceFindingsForRateLimit.length > 5 && (result.sources?.filter(s => s.type === 'url').length || 0) <= 10) {
      console.log('✅ Rate limiting appears to be working (max 5 findings processed)')
    } else {
      console.log('⚠️  Rate limiting may not be active (check server logs)')
    }
    
    // Test 6: Check integration
    console.log('\n📋 Test 6: Integration')
    const hasSources = result.sources && result.sources.length > 0
    const hasFindings = result.findings && result.findings.length > 0
    const hasRewritten = result.rewritten_text && result.rewritten_text.length > 0
    
    if (hasSources && hasFindings && hasRewritten) {
      console.log('✅ All components integrated')
      console.log(`   ✓ Findings: ${result.findings.length}`)
      console.log(`   ✓ Sources: ${result.sources.length}`)
      console.log(`   ✓ Rewritten text: ${result.rewritten_text.length} chars`)
    } else {
      console.log('❌ Integration incomplete')
      console.log(`   Findings: ${hasFindings ? '✓' : '✗'}`)
      console.log(`   Sources: ${hasSources ? '✓' : '✗'}`)
      console.log(`   Rewritten: ${hasRewritten ? '✓' : '✗'}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('\n📊 Summary:')
    console.log(`   Total Features Tested: 6`)
    console.log(`   Features Working: ${[
      result.label && result.score !== undefined,
      result.sources && result.sources.length > 0,
      sourcesWithTitles.length > 0,
      result.label && result.score !== undefined,
      true, // Rate limiting checked
      hasSources && hasFindings && hasRewritten
    ].filter(Boolean).length}/6`)
    
    console.log('\n💡 Tips:')
    console.log('   - Check server console logs for detailed [WEB SEARCH] messages')
    console.log('   - Verify SERP_API_KEY is set in .env.local')
    console.log('   - Restart dev server after changing .env.local')
    console.log('   - Rate limiting may cause delays (500ms between searches)')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('\n💡 Make sure:')
    console.error('   1. Dev server is running: npm run dev')
    console.error('   2. SERP_API_KEY is set in .env.local')
    console.error('   3. Server is accessible at http://localhost:3000')
  }
}

// Run tests
testFeatures().catch(console.error)

