"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react'
import { Button } from '@/components/ui/button'

function isHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s)
}

function wrapPlainTextInParagraphs(text: string): string {
  if (!text.trim()) return '<p></p>'
  return text
    .split(/\n\n+/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  className?: string
  /** When this changes, editor is reset to value (e.g. campaign id) */
  editorKey?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your message…',
  minHeight = '200px',
  className = '',
  editorKey = 'default',
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: (() => {
      const v = (value || '').trim()
      if (!v) return '<p></p>'
      if (isHtml(v)) return v
      return wrapPlainTextInParagraphs(v)
    })(),
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[120px] px-3 py-2 text-sm [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_p:last-child]:mb-0',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChangeRef.current(html === '<p></p>' ? '' : html)
    },
  }, [editorKey])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = (value || '').trim()
    const nextHtml = !next ? '<p></p>' : isHtml(next) ? next : wrapPlainTextInParagraphs(next)
    if (current !== nextHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false })
    }
  }, [editor, value, editorKey])

  if (!editor) {
    return (
      <div
        className={`rounded-md border border-input bg-background ${className}`}
        style={{ minHeight }}
      >
        <div className="flex flex-wrap gap-1 border-b border-input p-1.5">
          <Button type="button" variant="ghost" size="sm" disabled className="h-8 w-8 p-0" />
          <Button type="button" variant="ghost" size="sm" disabled className="h-8 w-8 p-0" />
          <Button type="button" variant="ghost" size="sm" disabled className="h-8 w-8 p-0" />
        </div>
        <div className="px-3 py-2 text-muted-foreground" style={{ minHeight: 120 }}>
          Loading editor…
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-md border border-input bg-background overflow-hidden ${className}`}
      style={{ minHeight }}
    >
      <div className="flex flex-wrap gap-0.5 border-b border-input p-1.5 bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-muted' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-muted' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${editor.isActive('underline') ? 'bg-muted' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <span className="w-px h-6 bg-border mx-0.5 self-center" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-muted' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-muted' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
