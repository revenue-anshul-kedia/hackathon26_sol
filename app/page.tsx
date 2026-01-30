import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-bold text-bain-blue mb-4">
            Bain Output Readiness Classifier
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Validate AI-generated case deliverables for readiness and compliance
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              href="/validate"
              className="block p-6 bg-bain-blue text-white rounded-lg hover:bg-blue-800 transition-colors shadow-md"
            >
              <h2 className="text-2xl font-semibold mb-2">Validate Draft</h2>
              <p className="text-blue-100">
                Paste your draft text and validate it for case readiness
              </p>
            </Link>
            
            <Link
              href="/generate"
              className="block p-6 bg-bain-green text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
            >
              <h2 className="text-2xl font-semibold mb-2">Generate Draft</h2>
              <p className="text-green-100">
                Generate a draft using AI, then validate it
              </p>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

