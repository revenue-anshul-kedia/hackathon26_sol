import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, validateFile } from '@/lib/file-extraction'

/**
 * API endpoint to extract text from uploaded files
 * POST /api/extract-text
 * Body: FormData with 'file' field
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid file' },
        { status: 400 }
      )
    }

    // Extract text from file
    const extractionResult = await extractTextFromFile(file, file.name, file.type)

    if (extractionResult.error || !extractionResult.text) {
      return NextResponse.json(
        { 
          error: extractionResult.error || 'Failed to extract text from file',
          fileName: file.name,
          fileType: extractionResult.fileType,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      text: extractionResult.text,
      fileName: extractionResult.fileName,
      fileType: extractionResult.fileType,
    })
  } catch (error: any) {
    console.error('Text extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error during text extraction' },
      { status: 500 }
    )
  }
}

