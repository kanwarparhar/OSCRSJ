'use client'

// BodyEditor — Phase 2 HTML body editor (Sushant Session 64, 2026-05-19).
//
// TipTap-backed rich-text editor for the manuscript body HTML stored in
// `manuscripts.manuscript_body_cleaned_html` (migration 024). Mounted
// inside BodyEditorPanel below the Pre-Render Metadata Editor on the
// admin manuscript page. When the editor saves cleaned HTML, the
// preview + publish endpoints pass that HTML verbatim to the renderer
// as `cleanedHtml` — bypassing the renderer's extractBody auto-
// extraction path.
//
// MVP scope (per Kanwar 2026-05-19 AskUserQuestion):
//   - Text formatting (bold, italic, strikethrough, code, paragraph,
//     H1/H2/H3, bullet list, ordered list, blockquote)
//   - Link insert (URL prompt)
//   - Image insert by URL + image swap by URL on click
//   - Undo / redo
//   - Save + Discard buttons with isDirty tracking
//
// Phase 2 deferrals (filed as follow-ups in CLAUDE.md §11):
//   - Drag-to-reposition figures inline (TipTap supports via
//     extension-drag-handle; deferred until Kanwar uses MVP first)
//   - Table cell editing (read-only display only for MVP; the
//     extractBody pathway emits tables as HTML already)
//   - Auto-seeding initial state from the .docx via a renderer
//     endpoint (current Phase 2 behaviour: editor mounts with whatever
//     was previously saved OR empty; the renderer's Session 62
//     auto-extract path remains the fallback when the editor's HTML
//     is empty)

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { saveManuscriptBodyCleanedHtml } from '@/lib/admin/actions'

interface BodyEditorProps {
  manuscriptId: string
  initialHtml: string
  isPublished: boolean
}

// Sentinel used by the empty-state guidance: the editor renders this
// hidden paragraph when initialHtml is empty so TipTap has a valid
// document tree on mount. Saving from an "empty" editor still strips
// this back to an empty string before the server action persists.
const EMPTY_PLACEHOLDER_HTML = '<p></p>'

export default function BodyEditor({
  manuscriptId,
  initialHtml,
  isPublished,
}: BodyEditorProps) {
  const [savedHtml, setSavedHtml] = useState<string>(initialHtml)
  const [isDirty, setIsDirty] = useState(false)
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<
    | { kind: 'idle' }
    | { kind: 'saved'; at: number }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // StarterKit ships history; we keep its defaults.
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'text-brown underline underline-offset-2 hover:text-ink',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded border border-border my-3 max-w-full h-auto',
        },
      }),
    ],
    content: initialHtml || EMPTY_PLACEHOLDER_HTML,
    editable: !isPublished,
    onUpdate: ({ editor: e }) => {
      const html = normalize(e.getHTML())
      setIsDirty(html !== savedHtml)
      if (feedback.kind === 'saved') setFeedback({ kind: 'idle' })
    },
    // TipTap recommends disabling immediatelyRender in Next.js to
    // avoid hydration mismatches; the editor renders on mount via
    // useEffect-internal scheduling.
    immediatelyRender: false,
  })

  // Keep tracking isDirty correct after a save round-trip.
  useEffect(() => {
    if (!editor) return
    const current = normalize(editor.getHTML())
    setIsDirty(current !== savedHtml)
  }, [editor, savedHtml])

  const handleSave = useCallback(() => {
    if (!editor) return
    const html = normalize(editor.getHTML())
    startTransition(async () => {
      const result = await saveManuscriptBodyCleanedHtml(manuscriptId, html)
      if (result.ok) {
        setSavedHtml(html)
        setIsDirty(false)
        setFeedback({ kind: 'saved', at: Date.now() })
      } else {
        setFeedback({
          kind: 'error',
          message: result.error || 'Save failed — please try again.',
        })
      }
    })
  }, [editor, manuscriptId])

  const handleDiscard = useCallback(() => {
    if (!editor) return
    editor.commands.setContent(savedHtml || EMPTY_PLACEHOLDER_HTML, false)
    setIsDirty(false)
    setFeedback({ kind: 'idle' })
  }, [editor, savedHtml])

  const handleClearSaved = useCallback(() => {
    if (!editor) return
    if (
      !confirm(
        'Clear the saved body HTML? Preview + publish will fall back to the renderer auto-extraction from the manuscript .docx.'
      )
    ) {
      return
    }
    editor.commands.setContent(EMPTY_PLACEHOLDER_HTML, false)
    startTransition(async () => {
      const result = await saveManuscriptBodyCleanedHtml(manuscriptId, '')
      if (result.ok) {
        setSavedHtml('')
        setIsDirty(false)
        setFeedback({ kind: 'saved', at: Date.now() })
      } else {
        setFeedback({
          kind: 'error',
          message: result.error || 'Clear failed — please try again.',
        })
      }
    })
  }, [editor, manuscriptId])

  if (!editor) {
    return (
      <div className="text-sm text-brown">Loading editor…</div>
    )
  }

  return (
    <div className="space-y-3">
      {isPublished && (
        <div className="text-xs text-brown bg-cream-alt border border-border rounded-md px-3 py-2">
          This manuscript is published. The body editor is read-only.
          Restore <code className="font-mono text-[11px]">status=&apos;accepted&apos;</code> via the
          publish pipeline panel to re-enable edits.
        </div>
      )}

      {!isPublished && (
        <Toolbar editor={editor} />
      )}

      <div
        className="prose prose-sm max-w-none border border-border rounded-md bg-white p-4 min-h-[300px] focus-within:border-brown transition-colors"
        // Tailwind Typography is not installed in this project; the
        // `prose` class is a hint for future styling. Until then, the
        // base styles below + globals.css carry the look.
      >
        <EditorContent
          editor={editor}
          className="tiptap-editor text-ink leading-relaxed [&_h1]:font-serif [&_h1]:text-brown-dark [&_h1]:text-2xl [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:font-serif [&_h2]:text-brown-dark [&_h2]:text-xl [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:font-serif [&_h3]:text-brown-dark [&_h3]:text-lg [&_h3]:mt-3 [&_h3]:mb-1.5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-taupe [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-brown [&_blockquote]:my-3 [&_code]:bg-cream-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.95em] [&_pre]:bg-cream-alt [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-border [&_th]:bg-cream-alt [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_a]:text-brown [&_a]:underline focus:outline-none"
        />
      </div>

      {!isPublished && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || pending}
            className="btn-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {pending ? 'Saving…' : 'Save body HTML'}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty || pending}
            className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard changes
          </button>
          {savedHtml && (
            <button
              type="button"
              onClick={handleClearSaved}
              disabled={pending}
              className="text-xs text-brown underline underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              Clear saved HTML (revert to auto-extract)
            </button>
          )}
          <span className="text-xs text-brown">
            {feedback.kind === 'saved' && '✓ Saved'}
            {feedback.kind === 'error' && (
              <span className="text-red-700">⚠ {feedback.message}</span>
            )}
            {feedback.kind === 'idle' && isDirty && '● Unsaved changes'}
          </span>
        </div>
      )}
    </div>
  )
}

// ----- Toolbar -----

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-1 flex-wrap bg-cream-alt border border-border rounded-md p-1.5">
      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          <span className="font-mono text-[11px]">{'<>'}</span>
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive('paragraph')}
          title="Paragraph"
        >
          P
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          • L
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Ordered list"
        >
          1. L
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          ❝
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Code block"
        >
          {'{ }'}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          ─
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => promptForLink(editor)}
          active={editor.isActive('link')}
          title="Insert/edit link"
        >
          🔗
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          title="Remove link"
        >
          ⛓
        </ToolbarButton>
        <ToolbarButton
          onClick={() => promptForImage(editor)}
          title="Insert image by URL"
        >
          🖼
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </ToolbarButton>
      </ToolbarGroup>
    </div>
  )
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1" aria-hidden />
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active || false}
      className={
        'min-w-[28px] h-7 px-1.5 rounded text-xs transition-colors ' +
        (active
          ? 'bg-brown text-cream'
          : 'text-ink hover:bg-white disabled:text-taupe disabled:hover:bg-transparent disabled:cursor-not-allowed')
      }
    >
      {children}
    </button>
  )
}

function promptForLink(editor: Editor) {
  const prev = editor.getAttributes('link').href as string | undefined
  const next = window.prompt(
    'Link URL (leave empty to remove):',
    prev || 'https://'
  )
  if (next === null) return
  if (next === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: next })
    .run()
}

function promptForImage(editor: Editor) {
  const url = window.prompt(
    'Image URL (https:// ...) or data: URL:',
    'https://'
  )
  if (!url) return
  editor.chain().focus().setImage({ src: url }).run()
}

// Normalize: TipTap emits `<p></p>` for an empty document. Treat that as
// empty string so isDirty + persistence both treat it as "no override".
function normalize(html: string): string {
  const trimmed = (html || '').trim()
  if (trimmed === '' || trimmed === EMPTY_PLACEHOLDER_HTML) return ''
  return trimmed
}
