import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ValidationResult, ValidationInput } from '@/lib/validation'

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
      "claim_excerpt": "exact excerpt showing bias (max 150 chars)",
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
      "claim_excerpt": "excerpt from the text (max 150 chars)",
      "rationale": "explanation of the issue with context-specific details",
      "suggested_fix": "specific recommendation tailored to the context",
      "recommended_owner": "Analyst" | "Manager" | "Legal/Compliance" | "SME"
    }
  ],
  "rewritten_text": "client-safe version that addresses ALL findings and is contextually appropriate",
  "summary_next_steps": ["bullet 1", "bullet 2", "bullet 3"]
}

CRITICAL: The rewritten_text MUST:
1. Address EVERY finding identified - fix or mitigate each issue
2. Replace overconfident language ("will guarantee", "proves", "ensures") with advisory language ("may", "suggests", "indicates")
3. Add specific dates to vague time references (e.g., "as of [DATE]" or "in [YEAR]")
4. Add jurisdiction context to regulatory references (e.g., "${geography} GDPR" or "${geography} SEC regulations")
5. Add [SOURCE NEEDED] markers or citations for unsourced numeric claims
6. Add [ASSUMPTION] markers where assumptions are made
7. Maintain the original meaning and structure while making it client-safe
8. Use industry-appropriate terminology and case-type-specific language
9. The rewritten text should ideally achieve "READY" status when re-validated

Validation Criteria (apply with context-specific rigor):
1. Freshness Risk: Flag vague time references without dates, dates older than 24 months in time-sensitive domains (laws, tariffs, sanctions, interest rates, market data). ${geography}-specific regulations and market data require current dates.
2. Regulatory Risk: Detect regulatory keywords without jurisdiction/date context. ${geography}-specific regulations (${getGeographyRegulations(geography)}) must be explicitly referenced with dates.
3. Evidence Risk: Flag numeric claims without sources, references to studies/research without citations. ${industry} industry data requires authoritative sources.
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
      
      const completion = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || '',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      })
      
      const responseText = completion.choices[0]?.message?.content || ''
      
      // Parse JSON response
      let result: ValidationResult
      try {
        result = JSON.parse(responseText)
        
        // Validate the structure
        if (!result.label || !result.findings || !result.rewritten_text) {
          throw new Error('Invalid response structure from AI')
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
        
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError)
        console.error('Response text:', responseText)
        throw new Error('Failed to parse AI validation response')
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

