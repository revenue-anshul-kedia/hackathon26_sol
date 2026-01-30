'use client'

import { useState } from 'react'
import Link from 'next/link'

type CaseType = 'Diligence' | 'Strategy' | 'Performance Transformation' | 'Org Design'
type Geography = 'US' | 'EU' | 'UK' | 'India' | 'China' | 'Global'

export default function GeneratePage() {
  const [prompt, setPrompt] = useState('')
  const [caseType, setCaseType] = useState<CaseType>('Diligence')
  const [geography, setGeography] = useState<Geography>('US')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

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
      
      if (data.warning) {
        setError(data.warning)
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-bain-blue hover:underline">
            ← Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 mb-6">
          <h1 className="text-3xl font-bold text-bain-blue mb-6">Generate Draft</h1>

          <form onSubmit={handleGenerate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt *
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bain-blue focus:border-transparent"
                placeholder="Describe what you want the draft to cover... (e.g., 'Analyze the competitive landscape for cloud services in the US market')"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Case Type
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
                  Geography
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bain-blue"
                  placeholder="e.g., Technology, Healthcare, Financial Services"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-bain-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? 'Generating...' : 'Generate Draft'}
            </button>
          </form>

          {error && (
            <div className={`mt-4 p-4 border rounded-lg ${
              error.includes('not configured') 
                ? 'bg-yellow-100 border-yellow-400 text-yellow-700' 
                : 'bg-red-100 border-red-400 text-red-700'
            }`}>
              {error}
            </div>
          )}
        </div>

        {draft && (
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Generated Draft</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyDraft}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Copy Draft
                </button>
                <button
                  onClick={handleUseInValidation}
                  className="px-4 py-2 bg-bain-blue text-white rounded-lg hover:bg-blue-800"
                >
                  Validate This Draft
                </button>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm text-gray-800">{draft}</pre>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

