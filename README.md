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
```

**Note**: If Azure OpenAI is not configured, the app will still work for validation. The draft generation feature will return a mock response.

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

