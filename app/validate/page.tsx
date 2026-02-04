'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ValidationResult } from '@/lib/validation'

type CaseType = 'Diligence' | 'Strategy' | 'Performance Transformation' | 'Org Design'
type Geography = 'United States' | 'EU' | 'UK' | 'India' | 'China' | 'Global'
type StakesLevel = 'Internal draft' | 'Client discussion' | 'Board-level'

export default function ValidatePage() {
  const [text, setText] = useState('')
  const [caseType, setCaseType] = useState<CaseType>('Diligence')
  const [geography, setGeography] = useState<Geography>('United States')
  const [industry, setIndustry] = useState('')
  const [stakesLevel, setStakesLevel] = useState<StakesLevel>('Client discussion')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  
  // Check for draft text from generate page - only after mount to avoid hydration issues
  useEffect(() => {
    const draftText = sessionStorage.getItem('draftText')
    if (draftText) {
      setText(draftText)
      sessionStorage.removeItem('draftText')
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploadedFileName(file.name)
    setLoading(true)
    setResult(null)

    try {
      // Extract text from file
      const extractFormData = new FormData()
      extractFormData.append('file', file)

      const extractResponse = await fetch('/api/extract-text', {
        method: 'POST',
        body: extractFormData,
      })

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json()
        throw new Error(errorData.error || 'Failed to extract text from file')
      }

      const extractData = await extractResponse.json()
      
      // Show extracted text in textarea immediately
      if (extractData.text) {
        setText(extractData.text)
        // Switch to text mode so user can see the extracted text
        setInputMode('text')
      } else {
        throw new Error('No text could be extracted from the file')
      }

      // Do NOT auto-validate - user will click Validate button
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setUploadedFileName(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate that text is provided
    if (!text || text.trim().length === 0) {
      setError('Please provide draft text or upload a file')
      return
    }

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
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-gray-500 hover:text-gray-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Validate Draft</h1>
                <p className="text-sm text-gray-500">Quality assurance and compliance validation</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="enterprise-card mb-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Draft Content</h2>
            <p className="text-sm text-gray-500">Upload a file or paste your draft text for validation</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input Mode Toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg inline-flex">
              <button
                type="button"
                onClick={() => {
                  setInputMode('text')
                  setUploadedFileName(null)
                  setText('')
                }}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  inputMode === 'text'
                    ? 'bg-white text-bain-blue shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">📝</span>Paste Text
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode('file')
                  setText('')
                }}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  inputMode === 'file'
                    ? 'bg-white text-bain-blue shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">📄</span>Upload File
              </button>
            </div>

            {/* Always show textarea */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Draft Text <span className="text-red-500">*</span>
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                required={inputMode === 'text'}
                rows={12}
                className="enterprise-input font-mono text-sm"
                placeholder={inputMode === 'file' ? 'Upload a file to extract text here...' : 'Paste your draft text here or upload a file...'}
                suppressHydrationWarning
                disabled={loading && inputMode === 'file'}
              />
              {loading && inputMode === 'file' && (
                <div className="mt-2 flex items-center text-sm text-blue-600">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Extracting text from file... (Click Validate button after extraction)
                </div>
              )}
              {uploadedFileName && !loading && inputMode === 'text' && (
                <div className="mt-2 flex items-center text-sm text-green-600">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Text extracted from {uploadedFileName}. Review and click Validate when ready.
                </div>
              )}
            </div>

            {/* File upload section */}
            {inputMode === 'file' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File (PDF, DOCX, DOC, PPTX, PPT, TXT, MD, HTML)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.markdown,.html,.htm"
                    className="hidden"
                    id="file-upload"
                    disabled={loading}
                  />
                  <label
                    htmlFor="file-upload"
                    className={`cursor-pointer inline-block px-6 py-3 bg-bain-blue text-white rounded-lg hover:bg-blue-800 transition-colors ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {loading ? 'Processing...' : uploadedFileName ? 'Change File' : 'Choose File'}
                  </label>
                  {uploadedFileName && !loading && (
                    <p className="mt-3 text-sm text-gray-600">
                      📎 {uploadedFileName}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Maximum file size: 100MB. Text will be extracted and shown above.
                  </p>
                </div>
              </div>
            )}

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
                  <option value="United States">United States</option>
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
            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="enterprise-card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Validation Results</h2>
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
                    className="enterprise-button-secondary"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={handleCopyRewritten}
                    className="enterprise-button-primary bg-bain-green hover:bg-green-700 focus:ring-bain-green"
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
            <div className="enterprise-card">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Findings</h2>
                <p className="text-sm text-gray-500">{filteredFindings.length} of {result.findings.length} findings displayed</p>
              </div>
              
              <div className="mb-6 flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="enterprise-select"
                  >
                    <option value="all">All Categories</option>
                    <option value="Freshness">Freshness</option>
                    <option value="Regulatory">Regulatory</option>
                    <option value="Evidence">Evidence</option>
                    <option value="BainStyle">Bain Style</option>
                    <option value="Bias">Bias</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Severity</label>
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="enterprise-select"
                  >
                    <option value="all">All Severities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {filteredFindings.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-4 text-gray-600">No findings match the selected filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="enterprise-table w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="enterprise-table-header w-20">ID</th>
                        <th className="enterprise-table-header w-32">Category</th>
                        <th className="enterprise-table-header w-28">Severity</th>
                        <th className="enterprise-table-header min-w-[200px]">Claim Excerpt</th>
                        <th className="enterprise-table-header min-w-[250px]">Rationale</th>
                        <th className="enterprise-table-header min-w-[200px]">Suggested Fix</th>
                        <th className="enterprise-table-header w-32">Owner</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredFindings.map((finding, index) => (
                        <tr key={`${finding.id}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="enterprise-table-cell font-mono text-xs align-top">{finding.id}</td>
                          <td className="enterprise-table-cell align-top">
                            <span className="enterprise-badge bg-blue-100 text-blue-800 whitespace-nowrap">{finding.category}</span>
                          </td>
                          <td className="enterprise-table-cell align-top">
                            <span className={`enterprise-badge border whitespace-nowrap ${getSeverityColor(finding.severity)}`}>
                              {finding.severity}
                            </span>
                          </td>
                          <td className="enterprise-table-cell-wrap align-top max-w-md">
                            <div className="break-words">{finding.claim_excerpt}</div>
                          </td>
                          <td className="enterprise-table-cell-wrap align-top max-w-md">
                            <div className="break-words">{finding.rationale}</div>
                          </td>
                          <td className="enterprise-table-cell-wrap align-top max-w-md">
                            <div className="break-words">{finding.suggested_fix}</div>
                          </td>
                          <td className="enterprise-table-cell align-top text-gray-600">{finding.recommended_owner}</td>
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

            {/* Sources Section */}
            {result.sources && result.sources.length > 0 && (
              <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Sources & References</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {result.sources.length} source(s) identified and validated
                </p>
                <div className="space-y-4">
                  {result.sources.map((source) => {
                    const validationStatus = (source as any).validation_status
                    const isAmbiguous = (source as any).is_ambiguous
                    const matchConfidence = (source as any).match_confidence
                    const validationIssues = (source as any).validation_issues || []
                    const exactReferences = (source as any).exact_references || []
                    const additionalResources = (source as any).additional_resources || []
                    const validationNotes = (source as any).validation_notes
                    
                    return (
                      <div key={source.id} className={`p-4 border rounded-lg ${
                        validationStatus === 'correct' ? 'border-green-300 bg-green-50' :
                        validationStatus === 'incorrect' ? 'border-red-300 bg-red-50' :
                        validationStatus === 'ambiguous' ? 'border-yellow-300 bg-yellow-50' :
                        validationStatus === 'partial_match' ? 'border-orange-300 bg-orange-50' :
                        'border-blue-200 bg-blue-50'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-xs text-gray-600">{source.id}</span>
                              {source.type && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                  {source.type}
                                </span>
                              )}
                              {validationStatus && validationStatus !== 'unknown' && (
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  validationStatus === 'correct' ? 'bg-green-100 text-green-800' :
                                  validationStatus === 'incorrect' ? 'bg-red-100 text-red-800' :
                                  validationStatus === 'ambiguous' ? 'bg-yellow-100 text-yellow-800' :
                                  validationStatus === 'partial_match' ? 'bg-orange-100 text-orange-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {validationStatus}
                                  {matchConfidence !== undefined && ` (${matchConfidence}%)`}
                                </span>
                              )}
                              {isAmbiguous && (
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                                  ⚠️ Ambiguous
                                </span>
                              )}
                            </div>
                            {source.title && (
                              <h4 className="font-semibold text-gray-800 mb-1">{source.title}</h4>
                            )}
                            {source.url && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm break-all"
                              >
                                {source.url}
                              </a>
                            )}
                            <div className="mt-2 text-sm text-gray-600 space-y-1">
                              {source.author && <div><strong>Author:</strong> {source.author}</div>}
                              {source.date && <div><strong>Date:</strong> {source.date}</div>}
                              {source.excerpt && (
                                <div className="mt-2 italic text-gray-700">
                                  "{source.excerpt}"
                                </div>
                              )}
                              {source.claim_reference && (
                                <div className="mt-2 text-xs text-gray-500">
                                  <strong>Referenced in:</strong> {source.claim_reference}
                                </div>
                              )}
                            </div>
                            
                            {/* Validation Results */}
                            {validationStatus && validationStatus !== 'unknown' && (
                              <div className="mt-3 pt-3 border-t border-gray-300">
                                {validationIssues.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Issues Found:</p>
                                    <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
                                      {validationIssues.map((issue: string, i: number) => (
                                        <li key={i}>{issue}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {exactReferences.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs font-semibold text-green-700 mb-1">✓ Exact References Found:</p>
                                    <ul className="list-disc list-inside text-xs text-green-600 space-y-1">
                                      {exactReferences.map((ref: string, i: number) => (
                                        <li key={i} className="italic">"{ref}"</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {additionalResources.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs font-semibold text-blue-700 mb-1">📚 Additional Resources:</p>
                                    <ul className="list-disc list-inside text-xs text-blue-600 space-y-1">
                                      {additionalResources.map((resource: any, i: number) => (
                                        <li key={i}>
                                          {resource.title}
                                          {resource.url && (
                                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                                              (link)
                                            </a>
                                          )}
                                          <span className="text-gray-500 ml-1">({resource.relevance} relevance: {resource.reason})</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {validationNotes && (
                                  <p className="text-xs text-gray-600 italic mt-2">Note: {validationNotes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

