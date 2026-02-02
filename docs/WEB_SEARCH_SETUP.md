# Web Search Integration Setup

This document explains how to configure web search to fetch the latest information and include specific URLs in your validation results.

## Overview

The system can search the web for current information to:
- Find sources for unsourced claims
- Validate URLs found in text
- Enrich source information with actual web data
- Get the latest information for time-sensitive topics

## Supported Search Providers

### 1. SerpAPI (Recommended)

SerpAPI provides Google search results without CAPTCHA.

**Setup:**
1. Sign up at https://serpapi.com/
2. Get your API key from the dashboard
3. Add to `.env.local`:
```env
SERP_API_KEY=your_serpapi_key_here
```

**Pricing:** Free tier: 100 searches/month, then paid plans

### 2. Google Custom Search API

Uses Google's official Custom Search API.

**Setup:**
1. Go to https://console.cloud.google.com/
2. Enable "Custom Search API"
3. Create a Custom Search Engine at https://cse.google.com/
4. Get your API key and Engine ID
5. Add to `.env.local`:
```env
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_engine_id
```

**Pricing:** 100 free searches/day, then $5 per 1,000 queries

### 3. Bing Search API

Microsoft's Bing Search API.

**Setup:**
1. Go to https://portal.azure.com/
2. Create a "Bing Search v7" resource
3. Get your subscription key
4. Add to `.env.local`:
```env
BING_SEARCH_API_KEY=your_bing_key
```

**Pricing:** Free tier: 1,000 queries/month, then paid

## How It Works

### Automatic Source Enrichment

When validating a draft:

1. **Extract Sources**: System finds all `[SOURCE: ...]` markers, URLs, and citations
2. **Identify Unsourced Claims**: Finds evidence findings without sources
3. **Web Search**: For each unsourced claim, searches the web for relevant sources
4. **URL Validation**: Validates existing URLs and enriches with metadata
5. **Source Cataloging**: Adds found sources to the results

### Example Flow

```
Claim: "GDPR fines reached €1.6 billion in 2023"
↓
Search Query: "GDPR fines 2023 1.6 billion"
↓
Web Search Results:
  - Title: "GDPR Enforcement Report 2023"
  - URL: https://gdpr.eu/fines-2023
  - Snippet: "Total GDPR fines reached €1.6 billion..."
↓
Added to Sources with claim reference
```

## Usage

### In Validation API

The web search is automatically triggered when:
- Evidence findings are detected without sources
- URLs are found in the text
- `[SOURCE: ...]` markers are present

### Manual Web Search

You can also use the web search utilities directly:

```typescript
import { searchWeb, validateAndEnrichURL } from '@/lib/web-search'

// Search for information
const results = await searchWeb({
  query: 'EU AI Act 2024',
  geography: 'EU',
  maxResults: 5
})

// Validate a URL
const validation = await validateAndEnrichURL('https://example.com')
```

## Rate Limiting

To avoid hitting API rate limits:
- Only searches for top 5 unsourced claims
- Adds 500ms delay between searches
- Caches results when possible
- Limits to 2 results per claim

## Fallback Behavior

If no web search API is configured:
- System still extracts sources from text
- Uses mock sources database for matching
- Returns existing sources without enrichment
- Logs warning but continues validation

## Best Practices

1. **Choose One Provider**: Configure only one search API to avoid conflicts
2. **Monitor Usage**: Track API usage to stay within free tiers
3. **Cache Results**: Consider caching search results for common queries
4. **Error Handling**: System gracefully handles API failures
5. **Privacy**: Search queries may be logged by the provider

## Troubleshooting

### "No web search API configured"
- Add at least one search API key to `.env.local`
- Restart the development server after adding keys

### "Search failed" errors
- Check API key is correct
- Verify API quota hasn't been exceeded
- Check network connectivity
- Review API provider status page

### Slow validation
- Web search adds ~2-5 seconds per unsourced claim
- Limit number of unsourced findings
- Consider caching search results

## Security Notes

- Never commit API keys to version control
- Use environment variables for all keys
- Rotate keys if exposed
- Monitor API usage for unusual activity

## Future Enhancements

Potential improvements:
- Caching layer for search results
- Batch search requests
- AI-powered query generation
- Source credibility scoring
- Automatic source verification

