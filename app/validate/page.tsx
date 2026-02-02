'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ValidationResult } from '@/lib/validation'

type CaseType = 'Diligence' | 'Strategy' | 'Performance Transformation' | 'Org Design'
type Geography = 'US' | 'EU' | 'UK' | 'India' | 'China' | 'Global'
type StakesLevel = 'Internal draft' | 'Client discussion' | 'Board-level'

export default function ValidatePage() {
  const [text, setText] = useState('')
  const [caseType, setCaseType] = useState<CaseType>('Diligence')
  const [geography, setGeography] = useState<Geography>('US')
  const [industry, setIndustry] = useState('')
  const [stakesLevel, setStakesLevel] = useState<StakesLevel>('Client discussion')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  
  // Check for draft text from generate page - only after mount to avoid hydration issues
  useEffect(() => {
    const draftText = sessionStorage.getItem('draftText')
    if (draftText) {
      setText(draftText)
      sessionStorage.removeItem('draftText')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          case_type: caseType,
          geography,
          industry,
          stakes_level: stakesLevel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Validation failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleExportJSON = () => {
    if (!result) return
    const dataStr = JSON.stringify(result, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'validation-result.json'
    link.click()
  }

  const handleCopyRewritten = () => {
    if (!result) return
    navigator.clipboard.writeText(result.rewritten_text)
    alert('Rewritten text copied to clipboard!')
  }

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'READY':
        return 'bg-green-500'
      case 'NEEDS_SHAPING':
        return 'bg-yellow-500'
      case 'REQUIRES_REVIEW':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const filteredFindings = result?.findings.filter(f => {
    if (filterCategory !== 'all' && f.category !== filterCategory) return false
    if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false
    return true
  }) || []

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-bain-blue hover:underline">
            ← Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 mb-6">
          <h1 className="text-3xl font-bold text-bain-blue mb-6">Validate Draft</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Draft Text *
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bain-blue focus:border-transparent"
                placeholder="Paste your draft text here..."
                suppressHydrationWarning
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Case Type *
                </label>
                <select
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value as CaseType)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bain-blue"
                >
                  <option value="Diligence">Diligence</option>
                  <option value="Strategy">Strategy</option>
                  <option value="Performance Transformation">Performance Transformation</option>
                  <option value="Org Design">Org Design</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Geography *
                </label>
                <select
                  value={geography}
                  onChange={(e) => setGeography(e.target.value as Geography)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bain-blue"
                >
                  <option value="US">US</option>
                  <option value="EU">EU</option>
                  <option value="UK">UK</option>
                  <option value="India">India</option>
                  <option value="China">China</option>
                  <option value="Global">Global</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry *
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bain-blue"
                  placeholder="e.g., Technology, Healthcare"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stakes Level *
                </label>
                <select
                  value={stakesLevel}
                  onChange={(e) => setStakesLevel(e.target.value as StakesLevel)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bain-blue"
                >
                  <option value="Internal draft">Internal draft</option>
                  <option value="Client discussion">Client discussion</option>
                  <option value="Board-level">Board-level</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-bain-blue text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? 'Validating...' : 'Validate'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Validation Results</h2>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className={`px-4 py-2 rounded-full text-white font-bold ${getLabelColor(result.label)}`}>
                      {result.label}
                    </span>
                    <span className="text-gray-600">Confidence: {result.score}%</span>
                    {result.bias_score !== undefined && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        result.bias_score >= 80 
                          ? 'bg-green-100 text-green-800' 
                          : result.bias_score >= 60 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-red-100 text-red-800'
                      }`} title={`Bias detection confidence: ${result.bias_confidence || 'N/A'}%`}>
                        🎯 Bias: {result.bias_score}/100
                        {(result.bias_confidence && result.bias_confidence < 70) && ' ⚠️'}
                      </span>
                    )}
                    {(result as any)._fallback ? (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                        ⚠️ Heuristic Mode
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                        🤖 AI-Powered
                      </span>
                    )}
                  </div>
                  {(result as any)._message && (
                    <p className="mt-2 text-sm text-yellow-700 italic">{(result as any)._message}</p>
                  )}
                </div>
                <div className="mt-4 md:mt-0 flex gap-2">
                  <button
                    onClick={handleExportJSON}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={handleCopyRewritten}
                    className="px-4 py-2 bg-bain-green text-white rounded-lg hover:bg-green-700"
                  >
                    Copy Rewritten Text
                  </button>
                </div>
              </div>

              <div className="mb-6 space-y-3">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Overall Confidence</span>
                    <span>{result.score}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all ${getLabelColor(result.label)}`}
                      style={{ width: `${result.score}%` }}
                    />
                  </div>
                </div>
                {result.bias_score !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Bias Score</span>
                      <span>{result.bias_score}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full transition-all ${
                          result.bias_score >= 80 
                            ? 'bg-green-500' 
                            : result.bias_score >= 60 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${result.bias_score}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {result.summary_next_steps.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2">Next Steps:</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {result.summary_next_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Findings Table */}
            <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Findings</h2>
              
              <div className="mb-4 flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All Categories</option>
                    <option value="Freshness">Freshness</option>
                    <option value="Regulatory">Regulatory</option>
                    <option value="Evidence">Evidence</option>
                    <option value="BainStyle">Bain Style</option>
                    <option value="Bias">Bias</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Severity</label>
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All Severities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {filteredFindings.length === 0 ? (
                <p className="text-gray-600">No findings match the selected filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Category</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Severity</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Claim Excerpt</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Rationale</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Suggested Fix</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFindings.map((finding, index) => (
                        <tr key={`${finding.id}-${index}`} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2 font-mono text-sm">{finding.id}</td>
                          <td className="border border-gray-300 px-4 py-2">{finding.category}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold border ${getSeverityColor(finding.severity)}`}>
                              {finding.severity}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-sm max-w-xs">{finding.claim_excerpt}</td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">{finding.rationale}</td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">{finding.suggested_fix}</td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">{finding.recommended_owner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Side-by-side Diff View */}
            <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Rewritten Text</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Original</h3>
                  <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800">{text}</pre>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Client-Safe Version</h3>
                  <div className="p-4 bg-green-50 border border-green-300 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800">{result.rewritten_text}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

