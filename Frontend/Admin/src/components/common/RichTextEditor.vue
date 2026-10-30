
<template>
  <div class="rich-editor">
    <div class="toolbar">
      <button type="button" @click="toggle('bold')" :class="{ active: isActive('bold') }" title="Bold"><strong>B</strong></button>
      <button type="button" @click="toggle('italic')" :class="{ active: isActive('italic') }" title="Italic"><em>I</em></button>
      <button type="button" @click="toggle('underline')" :class="{ active: isActive('underline') }" title="Underline"><u>U</u></button>
      <button type="button" @click="toggle('strike')" :class="{ active: isActive('strike') }" title="Strikethrough"><s>S</s></button>

      <span class="separator"></span>

      <select aria-label="Text style" @change="setHeading($event.target.value)">
        <option value="paragraph">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <select aria-label="Font size" @change="setFontSize($event.target.value)">
        <option value="">Font size</option>
        <option value="12px">12</option>
        <option value="14px">14</option>
        <option value="16px">16</option>
        <option value="18px">18</option>
        <option value="20px">20</option>
        <option value="24px">24</option>
        <option value="32px">32</option>
      </select>

      <label class="color-tool" title="Text color">
        A
        <input type="color" aria-label="Text color" @input="setTextColor($event.target.value)" />
      </label>

      <span class="separator"></span>

      <button type="button" @click="toggle('bulletList')" title="Bullet list">• List</button>
      <button type="button" @click="toggle('orderedList')" title="Numbered list">1. List</button>
      <button type="button" @click="toggle('blockquote')" title="Quote">❝</button>

      <select aria-label="Text alignment" @change="setAlignment($event.target.value)">
        <option value="left">Align left</option>
        <option value="center">Center</option>
        <option value="right">Align right</option>
        <option value="justify">Justify</option>
      </select>

      <span class="separator"></span>

      <button type="button" @click="setLink" title="Insert link">Link</button>
      <button type="button" @click="toggle('link')" title="Remove link">Unlink</button>
      <button type="button" @click="editor?.chain().focus().undo().run()" title="Undo">↶</button>
      <button type="button" @click="editor?.chain().focus().redo().run()" title="Redo">↷</button>
      <button type="button" @click="clearFormatting" title="Clear formatting">Clear</button>
    </div>

    <EditorContent :editor="editor" class="editor-content" />

    <div class="editor-footer">
      <span>Rich-text description</span>
      <span>{{ characterCount }} characters</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'

const model = defineModel({ type: String, default: '' })

const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,

            parseHTML: element =>
              element.style.fontSize || null,

            renderHTML: attributes => {
              if (!attributes.fontSize) return {}

              return {
                style: `font-size: ${attributes.fontSize}`
              }
            }
          }
        }
      }
    ]
  }
})

const editor = new Editor({
  extensions: [
    StarterKit,
    Underline,
    TextStyle,
    FontSize,
    Color,
    TextAlign.configure({
      types: ['heading', 'paragraph']
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['http', 'https', 'mailto']
    })
  ],
  content: model.value || '',
  onUpdate: ({ editor }) => {
    model.value = editor.getHTML()
  }
})

const characterCount = computed(() =>
  editor.getText().length
)

watch(model, value => {
  if (!editor || editor.isDestroyed) return

  const incoming = value || ''
  if (incoming !== editor.getHTML()) {
    editor.commands.setContent(incoming || '', { emitUpdate: false })
  }
})

const toggle = name => {
  if (name === 'link') {
    editor.chain().focus().unsetLink().run()
    return
  }

  const chain = editor.chain().focus()
  if (name === 'bulletList') chain.toggleBulletList().run()
  else if (name === 'orderedList') chain.toggleOrderedList().run()
  else if (name === 'blockquote') chain.toggleBlockquote().run()
  else if (name === 'bold') chain.toggleBold().run()
  else if (name === 'italic') chain.toggleItalic().run()
  else if (name === 'underline') chain.toggleUnderline().run()
  else if (name === 'strike') chain.toggleStrike().run()
}

const isActive = name => editor.isActive(name)

const setHeading = value => {
  if (value === 'paragraph') {
    editor.chain().focus().setParagraph().run()
  } else {
    editor.chain().focus().toggleHeading({ level: Number(value) }).run()
  }
}

const setFontSize = value => {
  if (!value) return
  editor.chain().focus().setMark('textStyle', { fontSize: value }).run()
}

const setTextColor = value => {
  editor.chain().focus().setColor(value).run()
}

const setAlignment = value => {
  editor.chain().focus().setTextAlign(value).run()
}

const setLink = () => {
  const previous = editor.getAttributes('link').href || ''
  const url = window.prompt('Enter URL', previous)

  if (url === null) return
  if (!url.trim()) {
    editor.chain().focus().unsetLink().run()
    return
  }

  if (!/^(https?:\/\/|mailto:)/i.test(url.trim())) {
    window.alert('Enter a URL starting with https://, http:// or mailto:')
    return
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

const clearFormatting = () => {
  editor.chain().focus().clearNodes().unsetAllMarks().run()
}

onBeforeUnmount(() => {
  editor.destroy()
})
</script>

<style scoped>
.rich-editor {
  overflow: hidden;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.toolbar button,
.toolbar select {
  min-height: 34px;
  padding: 5px 9px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  cursor: pointer;
}

.toolbar button:hover,
.toolbar button.active {
  background: #e5e7eb;
}

.toolbar select {
  max-width: 145px;
}

.separator {
  width: 1px;
  height: 25px;
  margin: 0 3px;
  background: #d1d5db;
}

.color-tool {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-weight: 700;
  cursor: pointer;
}

.color-tool input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.editor-content :deep(.tiptap) {
  min-height: 220px;
  padding: 16px;
  outline: none;
  color: #111827;
  line-height: 1.7;
}

.editor-content :deep(.tiptap p) {
  margin: 0 0 10px;
}

.editor-content :deep(.tiptap h1) {
  font-size: 2em;
}

.editor-content :deep(.tiptap h2) {
  font-size: 1.5em;
}

.editor-content :deep(.tiptap h3) {
  font-size: 1.17em;
}

.editor-content :deep(.tiptap ul),
.editor-content :deep(.tiptap ol) {
  padding-left: 24px;
}

.editor-content :deep(.tiptap blockquote) {
  margin: 12px 0;
  padding-left: 14px;
  border-left: 3px solid #9ca3af;
  color: #6b7280;
}

.editor-content :deep(.tiptap a) {
  color: #2563eb;
  text-decoration: underline;
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 640px) {
  .toolbar select {
    max-width: 120px;
  }
}
</style>
