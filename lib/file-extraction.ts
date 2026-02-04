/**
 * Utility functions to extract text from various file types
 */

import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import AdmZip from 'adm-zip'
import { parseString } from 'xml2js'

export interface FileExtractionResult {
  text: string
  fileName: string
  fileType: string
  error?: string
}

/**
 * Extract text from a file based on its MIME type or extension
 */
export async function extractTextFromFile(
  file: File | Buffer,
  fileName: string,
  mimeType?: string
): Promise<FileExtractionResult> {
  const fileBuffer = file instanceof File ? await file.arrayBuffer() : file
  const buffer = Buffer.from(fileBuffer)
  
  // Determine file type
  const detectedType = mimeType || detectFileType(fileName)
  
  try {
    let extractedText = ''
    
    switch (detectedType) {
      case 'application/pdf':
        extractedText = await extractTextFromPDF(buffer)
        break
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        extractedText = await extractTextFromDOCX(buffer)
        break
      
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        extractedText = await extractTextFromPPTX(buffer)
        break
      
      case 'application/vnd.ms-powerpoint':
        // Old PPT format (binary) - not easily parseable without specialized tools
        throw new Error('Old PPT format (.ppt) is not supported. Please convert to PPTX format or export as PDF/DOCX.')
      
      case 'text/plain':
      case 'text/markdown':
      case 'text/html':
        extractedText = buffer.toString('utf-8')
        break
      
      default:
        // Try to extract as plain text if unknown type
        try {
          extractedText = buffer.toString('utf-8')
        } catch (err) {
          throw new Error(`Unsupported file type: ${detectedType || 'unknown'}. Supported types: PDF, DOCX, PPTX, PPT, TXT, MD, HTML`)
        }
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the file')
    }
    
    return {
      text: extractedText.trim(),
      fileName,
      fileType: detectedType,
    }
  } catch (error: any) {
    return {
      text: '',
      fileName,
      fileType: detectedType || 'unknown',
      error: error.message || 'Failed to extract text from file',
    }
  }
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch (error: any) {
    throw new Error(`Failed to parse PDF: ${error.message}`)
  }
}

/**
 * Extract text from DOCX file
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error: any) {
    throw new Error(`Failed to parse DOCX: ${error.message}`)
  }
}

/**
 * Extract text from PPTX file
 * PPTX files are ZIP archives containing XML files
 */
async function extractTextFromPPTX(buffer: Buffer): Promise<string> {
  try {
    const zip = new AdmZip(buffer)
    const zipEntries = zip.getEntries()
    
    // Find all slide XML files (ppt/slides/slide*.xml)
    const slideFiles = zipEntries
      .filter(entry => entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml'))
      .sort((a, b) => {
        // Sort by slide number
        const aNum = parseInt(a.entryName.match(/slide(\d+)\.xml/)?.[1] || '0')
        const bNum = parseInt(b.entryName.match(/slide(\d+)\.xml/)?.[1] || '0')
        return aNum - bNum
      })
    
    if (slideFiles.length === 0) {
      throw new Error('No slides found in PowerPoint file')
    }
    
    const allText: string[] = []
    
    for (const slideFile of slideFiles) {
      const slideXml = zip.readAsText(slideFile, 'utf8')
      const slideText = await extractTextFromSlideXML(slideXml)
      if (slideText.trim()) {
        allText.push(`--- Slide ${slideFiles.indexOf(slideFile) + 1} ---\n${slideText}`)
      }
    }
    
    return allText.join('\n\n')
  } catch (error: any) {
    throw new Error(`Failed to parse PPTX: ${error.message}`)
  }
}

/**
 * Extract text from a single slide XML
 * Uses regex as primary method for reliability, with XML parsing as fallback
 */
async function extractTextFromSlideXML(xml: string): Promise<string> {
  try {
    // Primary method: regex extraction (more reliable for PowerPoint XML)
    // PowerPoint uses <a:t> tags for text content
    const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
    const texts = textMatches
      .map(match => {
        const textMatch = match.match(/<a:t[^>]*>([^<]*)<\/a:t>/)
        return textMatch ? textMatch[1] : ''
      })
      .filter(t => t.trim())
      .map(t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
    
    if (texts.length > 0) {
      return texts.join(' ')
    }
    
    // Fallback: try XML parsing
    return new Promise((resolve) => {
      parseString(xml, { explicitArray: false, mergeAttrs: true }, (err, result) => {
        if (err || !result) {
          resolve('')
          return
        }
        
        try {
          const extractedTexts: string[] = []
          
          // Recursively extract text from XML structure
          function extractText(node: any): void {
            if (typeof node === 'string') {
              if (node.trim()) extractedTexts.push(node.trim())
              return
            }
            
            if (Array.isArray(node)) {
              node.forEach(extractText)
              return
            }
            
            if (typeof node === 'object' && node !== null) {
              // Look for text nodes (a:t elements in PowerPoint XML)
              if (node['a:t']) {
                const textNodes = Array.isArray(node['a:t']) ? node['a:t'] : [node['a:t']]
                textNodes.forEach((t: any) => {
                  if (typeof t === 'string') {
                    extractedTexts.push(t.trim())
                  } else if (t._) {
                    extractedTexts.push(String(t._).trim())
                  }
                })
              }
              
              // Recursively process all properties
              Object.values(node).forEach(extractText)
            }
          }
          
          extractText(result)
          resolve(extractedTexts.filter(t => t).join(' '))
        } catch (parseError: any) {
          resolve('')
        }
      })
    })
  } catch (error: any) {
    return ''
  }
}

/**
 * Detect file type from file name extension
 */
function detectFileType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop() || ''
  
  const typeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    'html': 'text/html',
    'htm': 'text/html',
  }
  
  return typeMap[extension] || 'application/octet-stream'
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 100 * 1024 * 1024 // 100MB
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'text/markdown',
    'text/html',
  ]
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
    }
  }
  
  const extension = file.name.toLowerCase().split('.').pop() || ''
  const allowedExtensions = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'md', 'markdown', 'html', 'htm']
  
  if (!allowedExtensions.includes(extension) && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: PDF, DOCX, DOC, PPTX, PPT, TXT, MD, HTML`,
    }
  }
  
  return { valid: true }
}

