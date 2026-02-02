import mockSources from '@/data/mock_sources.json'
import lawKeywords from '@/data/law_keywords.json'

export type CaseType = 'Diligence' | 'Strategy' | 'Performance Transformation' | 'Org Design'
export type Geography = 'US' | 'EU' | 'UK' | 'India' | 'China' | 'Global'
export type StakesLevel = 'Internal draft' | 'Client discussion' | 'Board-level'
export type Severity = 'low' | 'medium' | 'high'
export type Category = 'Freshness' | 'Regulatory' | 'Evidence' | 'BainStyle' | 'Bias'
export type RecommendedOwner = 'Analyst' | 'Manager' | 'Legal/Compliance' | 'SME'

export interface ValidationFinding {
  id: string
  category: Category
  severity: Severity
  claim_excerpt: string
  rationale: string
  suggested_fix: string
  recommended_owner: RecommendedOwner
}

export interface SourceReference {
  id: string
  url?: string
  title?: string
  author?: string
  date?: string
  excerpt?: string
  claim_reference?: string // Which claim this source supports
  type?: 'url' | 'citation' | 'internal' | 'study' | 'regulation'
}

export interface ValidationResult {
  label: 'READY' | 'NEEDS_SHAPING' | 'REQUIRES_REVIEW'
  score: number
  bias_score?: number // 0-100, where 100 = no bias detected
  bias_confidence?: number // 0-100, confidence in bias assessment
  bias_methodology?: string // Description of bias detection approach
  findings: ValidationFinding[]
  rewritten_text: string
  summary_next_steps: string[]
  sources?: SourceReference[] // Sources and references found in the text
}

export interface ValidationInput {
  text: string
  case_type: CaseType
  geography: Geography
  industry: string
  stakes_level: StakesLevel
}

// Helper: Extract claims from text (split by sentences and bullets)
function extractClaims(text: string): string[] {
  // Split by newlines, bullets, and sentences
  const lines = text.split(/\n+/).filter(line => line.trim().length > 0)
  const claims: string[] = []
  
  for (const line of lines) {
    // Remove bullet markers
    const cleaned = line.replace(/^[-•*]\s*/, '').trim()
    if (cleaned.length > 10) {
      // Split long sentences
      const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10)
      claims.push(...sentences.map(s => s.trim()))
    }
  }
  
  return claims.filter(c => c.length > 0)
}

// Check 1: Freshness Risk
function checkFreshnessRisk(claims: string[], geography: Geography): ValidationFinding[] {
  const findings: ValidationFinding[] = []
  const now = new Date()
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
  
  const timeSensitivePatterns = lawKeywords.time_sensitive_domains.join('|')
  const vagueTimePatterns = /\b(current|latest|recent|today|now)\b/i
  const datePattern = /\b(20\d{2}|19\d{2})\b/
  
  claims.forEach((claim, idx) => {
    const claimLower = claim.toLowerCase()
    
    // Check for vague time references without dates
    if (vagueTimePatterns.test(claim) && !datePattern.test(claim)) {
      const isTimeSensitive = new RegExp(timeSensitivePatterns, 'i').test(claim)
      const severity: Severity = isTimeSensitive ? 'high' : 'medium'
      
      findings.push({
        id: `F-${String(findings.length + 1).padStart(3, '0')}`,
        category: 'Freshness',
        severity,
        claim_excerpt: claim.substring(0, 150),
        rationale: `Vague time reference ("current/latest/recent") without specific date${isTimeSensitive ? ' in time-sensitive domain' : ''}`,
        suggested_fix: `Replace vague time reference with specific date (e.g., "as of [DATE]" or "in [YEAR]")`,
        recommended_owner: isTimeSensitive ? 'SME' : 'Analyst'
      })
    }
    
    // Check for old dates (>24 months)
    const dateMatch = claim.match(/\b(20\d{2})\b/)
    if (dateMatch) {
      const year = parseInt(dateMatch[1])
      const claimDate = new Date(year, 0, 1)
      if (claimDate < twoYearsAgo && new RegExp(timeSensitivePatterns, 'i').test(claim)) {
        findings.push({
          id: `F-${String(findings.length + 1).padStart(3, '0')}`,
          category: 'Freshness',
          severity: 'high',
          claim_excerpt: claim.substring(0, 150),
          rationale: `Date reference (${year}) is older than 24 months in time-sensitive domain`,
          suggested_fix: `Verify current status and update date or add disclaimer about data age`,
          recommended_owner: 'SME'
        })
      }
    }
  })
  
  return findings
}

// Check 2: Regulatory Risk
function checkRegulatoryRisk(claims: string[], geography: Geography): ValidationFinding[] {
  const findings: ValidationFinding[] = []
  const allRegKeywords = [
    ...lawKeywords.regulatory_keywords,
    ...lawKeywords.specific_regulations
  ]
  
  const regPattern = new RegExp(`\\b(${allRegKeywords.join('|')})\\b`, 'i')
  const jurisdictionPattern = new RegExp(`\\b(${lawKeywords.jurisdiction_keywords.join('|')})\\b`, 'i')
  const datePattern = /\b(20\d{2})\b/
  
  claims.forEach((claim) => {
    if (regPattern.test(claim)) {
      const hasJurisdiction = jurisdictionPattern.test(claim)
      const hasDate = datePattern.test(claim)
      
      let severity: Severity = 'medium'
      if (!hasJurisdiction && !hasDate) {
        severity = 'high'
      } else if (!hasJurisdiction || !hasDate) {
        severity = 'medium'
      } else {
        severity = 'low'
      }
      
      // Check if specific regulation mentioned
      const specificReg = lawKeywords.specific_regulations.find(reg => 
        new RegExp(`\\b${reg}\\b`, 'i').test(claim)
      )
      
      if (specificReg || severity === 'high') {
        findings.push({
          id: `F-${String(findings.length + 1).padStart(3, '0')}`,
          category: 'Regulatory',
          severity,
          claim_excerpt: claim.substring(0, 150),
          rationale: `Regulatory reference${specificReg ? ` (${specificReg})` : ''} ${!hasJurisdiction ? 'missing jurisdiction' : ''} ${!hasDate ? 'missing date/version' : ''}`,
          suggested_fix: `Add jurisdiction context (${geography}) and date/version of regulation`,
          recommended_owner: 'Legal/Compliance'
        })
      }
    }
  })
  
  return findings
}

// Check 3: Evidence Risk
function checkEvidenceRisk(claims: string[]): ValidationFinding[] {
  const findings: ValidationFinding[] = []
  
  const citationPatterns = [
    /\b(source|cite|citation|reference|according to|study|research|report|data from)\b/i,
    /\b\[\d+\]/, // [1], [2] style citations
    /\b\(\d{4}[a-z]?\)/, // (2023) style
    /https?:\/\//, // URLs
  ]
  
  const numberPattern = /\b\d+[%€$£]?\s*(million|billion|trillion|thousand|%|percent|points?)\b/i
  const studyPattern = /\b(study|research|analysis|report|survey|data)\b/i
  
  claims.forEach((claim) => {
    const hasNumber = numberPattern.test(claim)
    const mentionsStudy = studyPattern.test(claim)
    const hasCitation = citationPatterns.some(pattern => pattern.test(claim))
    
    if (hasNumber && !hasCitation) {
      findings.push({
        id: `F-${String(findings.length + 1).padStart(3, '0')}`,
        category: 'Evidence',
        severity: 'medium',
        claim_excerpt: claim.substring(0, 150),
        rationale: 'Numeric claim without citation or source',
        suggested_fix: 'Add source citation or data attribution',
        recommended_owner: 'Analyst'
      })
    }
    
    if (mentionsStudy && !hasCitation) {
      findings.push({
        id: `F-${String(findings.length + 1).padStart(3, '0')}`,
        category: 'Evidence',
        severity: 'high',
        claim_excerpt: claim.substring(0, 150),
        rationale: 'Reference to study/research without citation',
        suggested_fix: 'Add proper citation (author, year, source)',
        recommended_owner: 'Analyst'
      })
    }
  })
  
  return findings
}

// Check 4: Bain-Style Risk (overconfident language)
function checkBainStyleRisk(claims: string[]): ValidationFinding[] {
  const findings: ValidationFinding[] = []
  
  const overconfidentPatterns = [
    /\b(will\s+(guarantee|prove|ensure|deliver|achieve))\b/i,
    /\b(guarantees?|proves?|ensures?)\b/i,
    /\b(proven|definitive|certain|absolute)\b/i,
    /\b(must\s+(result|lead|cause))\b/i,
  ]
  
  const advisoryAlternatives = {
    'will guarantee': 'may support',
    'guarantees': 'suggests',
    'proves': 'indicates',
    'ensures': 'may contribute to',
    'will deliver': 'may deliver',
    'proven': 'suggested',
    'definitive': 'preliminary',
    'certain': 'likely',
  }
  
  claims.forEach((claim) => {
    for (const pattern of overconfidentPatterns) {
      if (pattern.test(claim)) {
        const match = claim.match(pattern)?.[0]
        if (match) {
          findings.push({
            id: `F-${String(findings.length + 1).padStart(3, '0')}`,
            category: 'BainStyle',
            severity: 'medium',
            claim_excerpt: claim.substring(0, 150),
            rationale: `Overconfident language ("${match}") may not be appropriate for client-facing content`,
            suggested_fix: `Replace with advisory language (e.g., "${advisoryAlternatives[match.toLowerCase() as keyof typeof advisoryAlternatives] || 'may'}" or add assumptions)`,
            recommended_owner: 'Manager'
          })
          break
        }
      }
    }
  })
  
  return findings
}

// Rewrite text to be client-safe
function rewriteText(text: string, findings: ValidationFinding[]): string {
  let rewritten = text
  
  // Apply Bain-style fixes
  const bainFindings = findings.filter(f => f.category === 'BainStyle')
  for (const finding of bainFindings) {
    rewritten = rewritten.replace(
      /\b(will\s+guarantee|guarantees|proves|ensures|will\s+deliver|proven|definitive|certain)\b/gi,
      (match) => {
        const lower = match.toLowerCase()
        const replacements: Record<string, string> = {
          'will guarantee': 'may support',
          'guarantees': 'suggests',
          'proves': 'indicates',
          'ensures': 'may contribute to',
          'will deliver': 'may deliver',
          'proven': 'suggested',
          'definitive': 'preliminary',
          'certain': 'likely',
        }
        return replacements[lower] || match
      }
    )
  }
  
  // Add source needed tags for evidence findings
  const evidenceFindings = findings.filter(f => f.category === 'Evidence' && f.severity === 'high')
  for (const finding of evidenceFindings) {
    if (finding.claim_excerpt && rewritten.includes(finding.claim_excerpt.substring(0, 50))) {
      // Add [SOURCE NEEDED] tag
      const excerpt = finding.claim_excerpt.substring(0, 50)
      const index = rewritten.indexOf(excerpt)
      if (index !== -1) {
        rewritten = rewritten.substring(0, index + excerpt.length) + 
                   ' [SOURCE NEEDED]' + 
                   rewritten.substring(index + excerpt.length)
      }
    }
  }
  
  // Add assumption placeholders for high-severity findings
  const highSeverityCount = findings.filter(f => f.severity === 'high').length
  if (highSeverityCount > 0) {
    rewritten += '\n\n[ASSUMPTIONS TO VALIDATE: ' + highSeverityCount + ' critical items require verification]'
  }
  
  return rewritten
}

// Compute readiness label
function computeReadinessLabel(
  findings: ValidationFinding[],
  stakesLevel: StakesLevel,
  hasCitations: boolean
): 'READY' | 'NEEDS_SHAPING' | 'REQUIRES_REVIEW' {
  const highSeverity = findings.filter(f => f.severity === 'high')
  const mediumSeverity = findings.filter(f => f.severity === 'medium')
  
  if (highSeverity.length > 0) {
    return 'REQUIRES_REVIEW'
  }
  
  if (stakesLevel === 'Board-level' && (mediumSeverity.length > 0 || findings.length > 0)) {
    return 'REQUIRES_REVIEW'
  }
  
  if (mediumSeverity.length > 0 || findings.length > 3) {
    return 'NEEDS_SHAPING'
  }
  
  if (findings.length === 0 && hasCitations) {
    return 'READY'
  }
  
  if (findings.length === 0) {
    return 'READY'
  }
  
  if (findings.every(f => f.severity === 'low')) {
    return 'READY'
  }
  
  return 'NEEDS_SHAPING'
}

// Compute confidence score
function computeScore(findings: ValidationFinding[], label: string): number {
  let score = 100
  
  for (const finding of findings) {
    if (finding.severity === 'high') {
      score -= 15
    } else if (finding.severity === 'medium') {
      score -= 8
    } else {
      score -= 3
    }
  }
  
  if (label === 'REQUIRES_REVIEW') {
    score = Math.max(score, 30)
  } else if (label === 'NEEDS_SHAPING') {
    score = Math.max(score, 50)
  }
  
  return Math.max(0, Math.min(100, score))
}

// Generate summary next steps
function generateSummary(findings: ValidationFinding[]): string[] {
  const summary: string[] = []
  
  const highFindings = findings.filter(f => f.severity === 'high')
  const regulatoryFindings = findings.filter(f => f.category === 'Regulatory')
  const evidenceFindings = findings.filter(f => f.category === 'Evidence')
  
  if (highFindings.length > 0) {
    summary.push(`Address ${highFindings.length} high-severity finding(s) before client presentation`)
  }
  
  if (regulatoryFindings.length > 0) {
    summary.push(`Verify regulatory references with Legal/Compliance (${regulatoryFindings.length} item(s))`)
  }
  
  if (evidenceFindings.length > 0) {
    summary.push(`Add citations for ${evidenceFindings.length} unsourced claim(s)`)
  }
  
  if (summary.length === 0) {
    summary.push('Review findings and apply suggested fixes')
    summary.push('Confirm all sources are current and accurate')
    summary.push('Final review by Manager before client presentation')
  }
  
  return summary.slice(0, 3)
}

// Main validation function
export function validateDraft(input: ValidationInput): ValidationResult {
  const claims = extractClaims(input.text)
  
  // Run all checks
  const freshnessFindings = checkFreshnessRisk(claims, input.geography)
  const regulatoryFindings = checkRegulatoryRisk(claims, input.geography)
  const evidenceFindings = checkEvidenceRisk(claims)
  const bainStyleFindings = checkBainStyleRisk(claims)
  
  const allFindings = [
    ...freshnessFindings,
    ...regulatoryFindings,
    ...evidenceFindings,
    ...bainStyleFindings,
  ]
  
  // Check for citations
  const hasCitations = /\b(source|cite|citation|reference|\[\d+\]|https?:\/\/)\b/i.test(input.text)
  
  // Compute label and score
  const label = computeReadinessLabel(allFindings, input.stakes_level, hasCitations)
  const score = computeScore(allFindings, label)
  
  // Rewrite text
  const rewritten = rewriteText(input.text, allFindings)
  
  // Generate summary
  const summary = generateSummary(allFindings)
  
  return {
    label,
    score,
    findings: allFindings,
    rewritten_text: rewritten,
    summary_next_steps: summary,
  }
}

