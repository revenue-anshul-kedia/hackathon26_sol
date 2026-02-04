'use client'

import { useState } from 'react'
import Link from 'next/link'

type CaseType = 'Diligence' | 'Strategy' | 'Performance Transformation' | 'Org Design'
type Geography = 'United States' | 'EU' | 'UK' | 'India' | 'China' | 'Global'

export default function GeneratePage() {
  const [prompt, setPrompt] = useState('')
  const [caseType, setCaseType] = useState<CaseType>('Diligence')
  const [geography, setGeography] = useState<Geography>('United States')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [webSources, setWebSources] = useState<any[]>([])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setDraft('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          case_type: caseType,
          geography,
          industry,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Generation failed')
      }

      const data = await response.json()
      setDraft(data.draft)
      setWebSources(data.webSources || [])
      
      if (data.warning) {
        setError(data.warning)
      }
      
      // Log web search usage if available
      if (data.webSearchUsed) {
        console.log(`Web search used: ${data.webSearchResultsCount} results found`)
        if (data.webSources) {
          console.log('Web sources:', data.webSources)
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(draft)
    alert('Draft copied to clipboard!')
  }

  const handleUseInValidation = () => {
    // Store draft in sessionStorage and redirect
    sessionStorage.setItem('draftText', draft)
    window.location.href = '/validate'
  }

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
                <h1 className="text-xl font-semibold text-gray-900">Generate Draft</h1>
                <p className="text-sm text-gray-500">AI-powered draft generation with source citations</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="enterprise-card mb-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Draft Generation</h2>
            <p className="text-sm text-gray-500">Generate AI-powered draft content with integrated web research</p>
          </div>

          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt <span className="text-red-500">*</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                rows={6}
                className="enterprise-input"
                placeholder="Describe what you want the draft to cover... (e.g., 'Analyze the competitive landscape for cloud services in the US market')"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Case Type
                </label>
                <select
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value as CaseType)}
                  className="enterprise-select"
                >
                  <option value="Diligence">Diligence</option>
                  <option value="Strategy">Strategy</option>
                  <option value="Performance Transformation">Performance Transformation</option>
                  <option value="Org Design">Org Design</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Geography
                </label>
                <select
                  value={geography}
                  onChange={(e) => setGeography(e.target.value as Geography)}
                  className="enterprise-select"
                >
                  <option value="United States">United States</option>
                  <option value="EU">EU</option>
                  <option value="UK">UK</option>
                  <option value="India">India</option>
                  <option value="China">China</option>
                  <option value="Global">Global</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="enterprise-input"
                  placeholder="e.g., Technology, Healthcare, Financial Services"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={loading}
                className="enterprise-button-primary bg-bain-green hover:bg-green-700 focus:ring-bain-green"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Generate Draft'
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className={`mt-4 p-4 border-l-4 rounded-r-lg ${
              error.includes('not configured') 
                ? 'bg-yellow-50 border-yellow-400' 
                : 'bg-red-50 border-red-400'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className={`h-5 w-5 ${error.includes('not configured') ? 'text-yellow-400' : 'text-red-400'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${error.includes('not configured') ? 'text-yellow-700' : 'text-red-700'}`}>{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {draft && (
          <div className="enterprise-card">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Generated Draft</h2>
                {error && error.includes('web search') && (
                  <p className="text-sm text-gray-500">
                    Draft generated using web search results for enhanced accuracy
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyDraft}
                  className="enterprise-button-secondary"
                >
                  Copy Draft
                </button>
                <button
                  onClick={handleUseInValidation}
                  className="enterprise-button-primary"
                >
                  Validate This Draft
                </button>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">{draft}</pre>
            </div>
            
            {webSources.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  📚 Sources Used ({webSources.length})
                </h3>
                <div className="space-y-3">
                  {webSources.map((source, idx) => (
                    <div key={idx} className="p-3 bg-white rounded border border-blue-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 mb-1">
                            {source.title || `Source ${idx + 1}`}
                          </h4>
                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm break-all"
                            >
                              {source.url}
                            </a>
                          )}
                          {source.snippet && (
                            <p className="text-gray-600 text-sm mt-2 italic">
                              "{source.snippet.substring(0, 150)}..."
                            </p>
                          )}
                          {source.date && (
                            <p className="text-gray-500 text-xs mt-1">
                              Date: {source.date}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-blue-700 mt-3">
                  ℹ️ These sources were used to inform the generated draft. URLs should be included in [SOURCE: ...] citations within the draft.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

