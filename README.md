# Bain Output Readiness Classifier

A web application that validates AI-generated case deliverable drafts for "case readiness" and returns structured feedback including readiness labels, confidence scores, validation findings, and client-safe rewritten text.

## Features

- **Draft Validation**: Comprehensive validation pipeline that checks for:
  - Freshness risks (outdated dates, vague time references)
  - Regulatory risks (missing jurisdiction/date context)
  - Evidence risks (unsourced claims, missing citations)
  - Bain-style risks (overconfident language)
- **Draft Generation**: Optional AI-powered draft generation using Azure OpenAI
- **Client-Safe Rewriting**: Automatically softens claims and adds assumption placeholders
- **Structured Output**: JSON export and detailed findings table
- **Interactive UI**: Side-by-side diff view, filtered findings, and export capabilities

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Azure OpenAI** (for draft generation)

## Setup

### Prerequisites

- Node.js 18+ and npm/yarn
- Azure OpenAI account (optional, for draft generation)

### Installation

1. Clone the repository and navigate to the project directory:
```bash
cd _idea4
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory with your Azure OpenAI configuration:
```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Optional: Web Search APIs (for fetching latest information and URLs)
# Choose one of the following:
SERP_API_KEY=your_serpapi_key
# OR
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_engine_id
# OR
BING_SEARCH_API_KEY=your_bing_key

# Optional: SSL Verification (for corporate environments with proxy/firewall)
# Set to '1' to bypass SSL certificate verification for SerpAPI and web page fetching
# WARNING: Only use for demo/development. Not recommended for production.
SKIP_SSL_VERIFICATION=0
# Alternative: You can also use ALLOW_INSECURE_SSL=1 or NODE_TLS_REJECT_UNAUTHORIZED=0
```

**Note**: 
- If Azure OpenAI is not configured, the app will still work for validation. The draft generation feature will return a mock response.
- Web search APIs are optional but recommended for fetching latest information and validating URLs. See `docs/WEB_SEARCH_SETUP.md` for setup instructions.
- **SSL Certificate Issues**: If you encounter SSL certificate errors (e.g., "unable to get local issuer certificate") when using SerpAPI, the app will automatically attempt a fallback with relaxed SSL verification. This is safe for demo purposes but should be addressed in production by fixing the certificate chain.
- **IMPORTANT**: After adding environment variables, you MUST restart the Next.js development server (`npm run dev`) for changes to take effect.

### Testing Web Search

**Option 1: Test Search Endpoint**
To verify your SerpAPI key is working, visit:
```
http://localhost:3000/api/test-search?query=GDPR+fines+2024
```

This will test the web search and show you if it's working correctly.

**Option 2: Feature Validation Test**
Run the automated feature test script:
```bash
node scripts/test-features.js
```

This will test all web search features:
- ✅ Automatic source enrichment
- ✅ URL validation and metadata enrichment
- ✅ Smart query generation
- ✅ Rate limiting (500ms delays, max 5 findings)
- ✅ Error handling (continues on failures)
- ✅ Integration with validation pipeline

**Option 3: Manual Testing**
1. Navigate to the Validate Draft page
2. Paste a draft with unsourced claims (e.g., "The market grew 45% in 2023")
3. Submit for validation
4. Check the "Sources & References" section in the results
5. Verify that web search results appear for unsourced claims

**Checking Server Logs**
Watch the development server console for detailed `[WEB SEARCH]` logs showing:
- Search queries being generated
- Results found per query
- Rate limiting delays (500ms)
- URL validation progress
- Error handling and recovery

### Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser.

3. You can:
   - Navigate to **Validate Draft** to validate existing text
   - Navigate to **Generate Draft** to generate a draft using AI (requires Azure OpenAI config)

## Project Structure

```
_idea4/
├── app/
│   ├── api/
│   │   ├── validate/      # Validation API endpoint
│   │   └── generate/       # Draft generation API endpoint
│   ├── generate/           # Generate Draft page
│   ├── validate/           # Validate Draft page
│   ├── layout.tsx
│   ├── page.tsx             # Home page
│   └── globals.css
├── data/
│   ├── mock_sources.json   # Mock data sources for cross-checking
│   ├── law_keywords.json   # Regulatory keywords and patterns
│   └── sample_inputs.md    # Sample test inputs
├── lib/
│   └── validation.ts       # Core validation logic
└── README.md
```

## Usage

### Validating a Draft

1. Go to the **Validate Draft** page
2. Paste your draft text
3. Select:
   - Case Type (Diligence, Strategy, Performance Transformation, Org Design)
   - Geography (US, EU, UK, India, China, Global)
   - Industry (free text)
   - Stakes Level (Internal draft, Client discussion, Board-level)
4. Click **Validate**
5. Review the results:
   - Readiness label and confidence score
   - Findings table (filterable by category and severity)
   - Side-by-side comparison of original vs. rewritten text
   - Next steps summary

### Generating a Draft

1. Go to the **Generate Draft** page
2. Enter a prompt describing what you want the draft to cover
3. Optionally select Case Type, Geography, and Industry
4. Click **Generate Draft**
5. Copy the draft or click **Validate This Draft** to validate it immediately

## Validation Logic

The validation pipeline performs the following checks:

### 1. Freshness Risk
- Flags vague time references ("current", "latest", "recent") without dates
- Detects dates older than 24 months in time-sensitive domains
- Identifies time-sensitive domains (interest rates, tariffs, sanctions, etc.)

### 2. Regulatory Risk
- Detects regulatory keywords (GDPR, HIPAA, SEC, FTC, etc.)
- Checks for missing jurisdiction context
- Flags missing dates/versions for regulations

### 3. Evidence Risk
- Flags numeric claims without citations
- Identifies references to studies/research without proper citations
- Checks for citation markers ([1], URLs, etc.)

### 4. Bain-Style Risk
- Detects overconfident language ("will guarantee", "proves", "ensures")
- Suggests advisory alternatives ("may", "suggests", "indicates")

### Readiness Label Rules

- **REQUIRES_REVIEW**: Any high-severity finding OR Board-level stakes with any medium/high findings
- **NEEDS_SHAPING**: Only medium/low findings exist
- **READY**: Only low findings and at least one source/citation marker exists, OR content is purely structural

## API Endpoints

### POST `/api/validate`

Validates a draft and returns structured results.

**Request Body:**
```json
{
  "text": "string",
  "case_type": "Diligence" | "Strategy" | "Performance Transformation" | "Org Design",
  "geography": "US" | "EU" | "UK" | "India" | "China" | "Global",
  "industry": "string",
  "stakes_level": "Internal draft" | "Client discussion" | "Board-level"
}
```

**Response:**
```json
{
  "label": "READY" | "NEEDS_SHAPING" | "REQUIRES_REVIEW",
  "score": 0-100,
  "findings": [...],
  "rewritten_text": "string",
  "summary_next_steps": ["string"]
}
```

### POST `/api/generate`

Generates a draft using Azure OpenAI.

**Request Body:**
```json
{
  "prompt": "string",
  "case_type": "string (optional)",
  "geography": "string (optional)",
  "industry": "string (optional)"
}
```

**Response:**
```json
{
  "draft": "string",
  "warning": "string (optional)"
}
```

## Sample Inputs

See `data/sample_inputs.md` for example inputs to test the validation system.

## Development

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Notes

- The validation logic is deterministic and heuristic-based for stable demo results
- Mock data sources are used for demonstration purposes only
- Azure OpenAI is optional; validation works without it
- All validation checks are performed server-side for security

## License

This is a hackathon demo prototype.

