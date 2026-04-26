'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ManuscriptFileRow, FileType } from '@/lib/types/database'
import { recordFile, deleteFile, getFileDownloadUrl } from '@/lib/submission/actions'

// ---- File category definitions ----

interface FileCategory {
  type: FileType
  label: string
  required: boolean
  accept: string
  maxSizeMB: number
  maxFiles: number
  description: string
}

const BASE_CATEGORIES: FileCategory[] = [
  {
    type: 'manuscript',
    label: 'Main Manuscript',
    required: true,
    accept: '.docx,.pdf',
    maxSizeMB: 50,
    maxFiles: 1,
    description: 'Your complete manuscript with all author information. Accepted formats: .docx or .pdf (max 50 MB).',
  },
  {
    type: 'blinded_manuscript',
    label: 'Blinded Manuscript',
    required: true,
    accept: '.docx,.pdf',
    maxSizeMB: 50,
    maxFiles: 1,
    description: 'Manuscript with all identifying information removed for peer review. Accepted formats: .docx or .pdf (max 50 MB).',
  },
  {
    type: 'title_page',
    label: 'Title Page',
    required: true,
    accept: '.docx',
    maxSizeMB: 5,
    maxFiles: 1,
    description: 'Separate Title Page document containing manuscript title, all author names + affiliations, corresponding-author block, and any title-page-specific declarations. Use the OSCRSJ Title Page template (download from /templates). Accepted format: .docx (max 5 MB).',
  },
  {
    type: 'tables',
    label: 'Tables',
    required: false,
    accept: '.docx',
    maxSizeMB: 10,
    maxFiles: 1,
    description: 'A single Word document containing every table in your manuscript, one table per page, with the caption above each table. Real editable Word tables (not images). Required only if your manuscript has tables. Use the OSCRSJ Tables template (download from /templates). Accepted format: .docx (max 10 MB).',
  },
  {
    type: 'figure',
    label: 'Figures',
    required: false,
    accept: '.jpeg,.jpg,.png,.tiff,.tif',
    maxSizeMB: 10,
    maxFiles: 10,
    description: 'High-resolution figure images, one file per figure (Figure_1.tiff, Figure_2.png, etc.). Minimum 300 DPI; 600 DPI recommended. Submit each figure as a separate image — do NOT embed figures in the manuscript or in a Word document. Accepted formats: .jpeg, .png, .tiff (max 10 MB each, up to 10 files).',
  },
  {
    type: 'supplement',
    label: 'Supplementary Materials',
    required: false,
    accept: '*',
    maxSizeMB: 50,
    maxFiles: 5,
    description: 'Videos, datasets, or additional files. Any format (max 50 MB each, up to 5 files).',
  },
  {
    type: 'cover_letter',
    label: 'Cover Letter',
    required: false,
    accept: '.docx,.pdf',
    maxSizeMB: 5,
    maxFiles: 1,
    description: 'Optional cover letter to the editor. Accepted formats: .docx or .pdf (max 5 MB).',
  },
  {
    type: 'ethics_approval',
    label: 'Ethics Approval',
    required: false,
    accept: '.pdf',
    maxSizeMB: 10,
    maxFiles: 1,
    description: 'IRB or ethics committee approval document. Accepted format: .pdf (max 10 MB).',
  },
]

const REVISION_CATEGORIES: FileCategory[] = [
  {
    type: 'manuscript',
    label: 'Revised Manuscript',
    required: true,
    accept: '.docx,.pdf',
    maxSizeMB: 50,
    maxFiles: 1,
    description: 'Clean revised manuscript with all author information. Accepted formats: .docx or .pdf (max 50 MB).',
  },
  {
    type: 'blinded_manuscript',
    label: 'Revised Blinded Manuscript',
    required: true,
    accept: '.docx,.pdf',
    maxSizeMB: 50,
    maxFiles: 1,
    description: 'Revised manuscript with identifying information removed. Accepted formats: .docx or .pdf (max 50 MB).',
  },
  {
    type: 'tracked_changes',
    label: 'Tracked Changes',
    required: true,
    accept: '.docx,.pdf',
    maxSizeMB: 50,
    maxFiles: 1,
    description: 'Revised manuscript with edits visible (Word track-changes or PDF compare). Accepted formats: .docx or .pdf (max 50 MB).',
  },
  {
    type: 'title_page',
    label: 'Revised Title Page',
    required: false,
    accept: '.docx',
    maxSizeMB: 5,
    maxFiles: 1,
    description: 'Updated Title Page if author list, affiliations, or corresponding author changed. Accepted format: .docx (max 5 MB).',
  },
  {
    type: 'tables',
    label: 'Revised Tables',
    required: false,
    accept: '.docx',
    maxSizeMB: 10,
    maxFiles: 1,
    description: 'Updated Tables document if tables changed during revision. Single Word document, one table per page, real editable Word tables (not images). Accepted format: .docx (max 10 MB).',
  },
  {
    type: 'response_to_reviewers',
    label: 'Response to Reviewers',
    required: true,
    accept: '.docx,.pdf',
    maxSizeMB: 20,
    maxFiles: 1,
    description: 'Point-by-point response to each reviewer comment. Accepted formats: .docx or .pdf (max 20 MB).',
  },
  {
    type: 'figure',
    label: 'Revised Figures',
    required: false,
    accept: '.jpeg,.jpg,.png,.tiff,.tif',
    maxSizeMB: 10,
    maxFiles: 10,
    description: 'Revised or additional figure images, one file per figure (Figure_1.tiff, etc.). Minimum 300 DPI. Accepted formats: .jpeg, .png, .tiff (max 10 MB each, up to 10 files).',
  },
  {
    type: 'ethics_approval',
    label: 'Ethics Approval (if updated)',
    required: false,
    accept: '.pdf',
    maxSizeMB: 10,
    maxFiles: 1,
    description: 'Updated ethics approval if protocol changed. Accepted format: .pdf (max 10 MB).',
  },
]

interface Step2FilesProps {
  manuscriptId: string | null
  files: ManuscriptFileRow[]
  onFilesChange: (files: ManuscriptFileRow[]) => void
  revisionNumber?: number
}

interface UploadProgress {
  fileName: string
  progress: number
  category: FileType
}

export default function Step2Files({ manuscriptId, files, onFilesChange, revisionNumber }: Step2FilesProps) {
  const isRevising = typeof revisionNumber === 'number' && revisionNumber >= 2
  const FILE_CATEGORIES = isRevising ? REVISION_CATEGORIES : BASE_CATEGORIES
  // Revision mode hides prior-version files from the per-category
  // slot count so upload-required gates are against the current
  // version's tiles only.
  const currentVersion = isRevising ? revisionNumber! : 1
  const currentVersionFiles = files.filter((f) => f.version === currentVersion)
  const [uploading, setUploading] = useState<UploadProgress[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeCategory, setActiveCategory] = useState<FileType | null>(null)

  const getFilesForCategory = (type: FileType) =>
    currentVersionFiles.filter((f) => f.file_type === type)

  const handleUpload = useCallback(async (inputFiles: FileList, category: FileCategory) => {
    if (!manuscriptId) {
      setError('Please complete Step 1 first to create a submission draft.')
      return
    }

    setError(null)
    const existingCount = getFilesForCategory(category.type).length
    const filesToUpload = Array.from(inputFiles)

    // Validate file count
    if (existingCount + filesToUpload.length > category.maxFiles) {
      setError(`Maximum ${category.maxFiles} file(s) allowed for ${category.label}. You already have ${existingCount}.`)
      return
    }

    const supabase = createClient()
    const newFiles: ManuscriptFileRow[] = []

    for (const file of filesToUpload) {
      // Validate size
      const maxBytes = category.maxSizeMB * 1024 * 1024
      if (file.size > maxBytes) {
        setError(`${file.name} exceeds the ${category.maxSizeMB} MB limit.`)
        continue
      }

      // Validate extension (unless category accepts all)
      if (category.accept !== '*') {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        const allowedExts = category.accept.split(',').map(e => e.trim().toLowerCase())
        if (!allowedExts.includes(ext)) {
          setError(`${file.name} is not an accepted format for ${category.label}.`)
          continue
        }
      }

      // Build storage path. v1 files land at a flat path to preserve
      // the existing Session 1–11 layout; v2+ revisions land in a
      // v{n}/ subfolder so every revision is addressable without
      // migrating historical files.
      const seq = existingCount + newFiles.length + 1
      const ext = file.name.split('.').pop()
      const storageName = `${manuscriptId}_v${currentVersion}_${category.type}_${seq}.${ext}`
      const storagePath = `${manuscriptId}/v${currentVersion}/${storageName}`

      // Track progress
      const progressEntry: UploadProgress = {
        fileName: file.name,
        progress: 0,
        category: category.type,
      }
      setUploading(prev => [...prev, progressEntry])

      try {
        // Upload to Supabase Storage
        // Note: Supabase JS client doesn't emit progress events, so we jump to 50% then 100%
        setUploading(prev =>
          prev.map(p => p.fileName === file.name ? { ...p, progress: 50 } : p)
        )

        // Storage path is unique per (manuscript, version, file_type, seq).
        // upsert: true protects against the failure mode where a previous
        // attempt orphaned an object at this path (e.g. Storage write
        // succeeded then recordFile failed — the typical cause is a
        // missing enum value before migration 014 was run for the
        // title_page / tables types). Retries cleanly overwrite the
        // orphan instead of 409'ing with "The resource already exists".
        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError) {
          setError(`Failed to upload ${file.name}: ${uploadError.message}`)
          setUploading(prev => prev.filter(p => p.fileName !== file.name))
          continue
        }

        setUploading(prev =>
          prev.map(p => p.fileName === file.name ? { ...p, progress: 90 } : p)
        )

        // Record in database
        const result = await recordFile({
          manuscriptId,
          originalFilename: file.name,
          fileName: storageName,
          fileType: category.type,
          storagePath,
          fileSizeBytes: file.size,
          fileOrder: existingCount + newFiles.length,
          version: currentVersion,
        })

        if (result.error) {
          setError(`Failed to record ${file.name}: ${result.error}`)
        } else if (result.file) {
          newFiles.push(result.file)
        }
      } catch {
        setError(`Upload failed for ${file.name}. Please try again.`)
      } finally {
        setUploading(prev => prev.filter(p => p.fileName !== file.name))
      }
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuscriptId, files, onFilesChange])

  const handleRemove = useCallback(async (file: ManuscriptFileRow) => {
    const result = await deleteFile(file.id, file.storage_path)
    if (result.error) {
      setError(result.error)
      return
    }
    onFilesChange(files.filter(f => f.id !== file.id))
  }, [files, onFilesChange])

  const handleDownload = useCallback(async (file: ManuscriptFileRow) => {
    const result = await getFileDownloadUrl(file.storage_path)
    if (result.error || !result.url) {
      setError('Failed to get download link.')
      return
    }
    window.open(result.url, '_blank')
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      <h2 className="font-serif text-xl text-brown-dark mb-1">
        {isRevising ? `Upload Revised Files (v${currentVersion})` : 'Upload Files'}
      </h2>
      <p className="text-sm text-brown mb-6">
        {isRevising
          ? 'Upload the revised manuscript set. Original v1 files stay on record — new uploads land in the v' +
            currentVersion +
            '/ folder. Revised manuscript, revised blinded manuscript, tracked-changes file, and response-to-reviewers are required.'
          : 'Upload your manuscript files below. Main manuscript and blinded manuscript are required.'}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="mb-4 space-y-2">
          {uploading.map(u => (
            <div key={u.fileName} className="flex items-center gap-3 p-3 bg-white rounded-lg">
              <div className="flex-1">
                <p className="text-sm text-ink font-medium">{u.fileName}</p>
                <div className="mt-1 h-1.5 bg-cream-alt rounded-full overflow-hidden">
                  <div
                    className="h-full bg-peach-dark rounded-full transition-all duration-300"
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-brown">{u.progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* File category sections */}
      <div className="space-y-4">
        {FILE_CATEGORIES.map(category => {
          const catFiles = getFilesForCategory(category.type)
          const isFull = catFiles.length >= category.maxFiles

          return (
            <div
              key={category.type}
              className={`border rounded-lg p-4 transition-all ${
                category.required && catFiles.length === 0
                  ? 'border-brown/30 bg-white'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {category.label}
                    {category.required && <span className="text-red-500 ml-1">*</span>}
                  </h3>
                  <p className="text-xs text-brown mt-0.5">{category.description}</p>
                </div>
                {!isFull && (
                  <button
                    onClick={() => {
                      setActiveCategory(category.type)
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = category.accept === '*' ? '' : category.accept
                        fileInputRef.current.multiple = category.maxFiles > 1
                        fileInputRef.current.click()
                      }
                    }}
                    className="text-xs font-medium text-brown border border-brown/20 px-3 py-1.5 rounded-full hover:bg-cream-alt transition-colors flex-shrink-0"
                  >
                    Upload
                  </button>
                )}
              </div>

              {/* Drag-and-drop zone */}
              {!isFull && catFiles.length === 0 && (
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (e.dataTransfer.files.length > 0) {
                      handleUpload(e.dataTransfer.files, category)
                    }
                  }}
                  className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-tan transition-colors"
                >
                  <svg className="w-8 h-8 text-taupe mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-xs text-brown">Drag and drop files here, or click Upload</p>
                </div>
              )}

              {/* File list for this category */}
              {catFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {catFiles.map(file => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2.5 bg-white rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-4 h-4 text-brown flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-ink truncate">{file.original_filename}</span>
                        <span className="text-xs text-brown flex-shrink-0">{formatSize(file.file_size_bytes)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(file)}
                          className="text-xs text-brown hover:underline"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleRemove(file)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && activeCategory) {
            const cat = FILE_CATEGORIES.find(c => c.type === activeCategory)
            if (cat) handleUpload(e.target.files, cat)
          }
          // Reset so the same file can be re-selected
          e.target.value = ''
        }}
      />
    </div>
  )
}
