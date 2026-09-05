'use client';

import { Extension } from '@tiptap/core';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapUnderline from '@tiptap/extension-underline';
import { type Editor, EditorContent, useEditor,type UseEditorOptions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Link2, List, ListOrdered } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { normalizeNovelHtml,POST_TEMPLATE_PLACEHOLDERS } from '@/lib/product-description';
import { cn } from '@/lib/utils';

interface PostTemplateEditorProps {
    initialHtml: string;
    onChange: (html: string) => void;
}

interface TemplateToolbarButtonProps {
    active: boolean;
    disabled?: boolean;
    title: string;
    onClick: () => void;
    children: React.ReactNode;
}

const ModEnterNewLine = Extension.create({
    name: 'modEnterNewLine',
    addKeyboardShortcuts() {
        return {
            'Mod-Enter': () => this.editor.commands.splitBlock(),
            'Ctrl-Enter': () => this.editor.commands.splitBlock(),
        };
    },
});

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function PostTemplateEditor({ initialHtml, onChange }: PostTemplateEditorProps) {
    const [initialContent] = useState(() => (initialHtml?.trim() ? initialHtml : EMPTY_DOC));
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const editor = useEditor(
        useMemo<UseEditorOptions>(
            () => ({
                extensions: [
                    StarterKit.configure({
                        heading: false,
                        codeBlock: false,
                        code: false,
                        blockquote: false,
                        horizontalRule: false,
                    }),
                    ModEnterNewLine,
                    TiptapUnderline.configure({}),
                    TiptapLink.configure({
                        openOnClick: false,
                        autolink: true,
                        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
                    }),
                    Placeholder.configure({ placeholder: 'Текст шаблона поста…', showOnlyCurrent: false }),
                ],
                content: initialContent,
                immediatelyRender: false,
                editorProps: {
                    attributes: {
                        class: 'novel-editor focus:outline-none px-3 py-2 text-base md:text-sm',
                        style: 'min-height: 14rem',
                    },
                    handlePaste: (view, event) => {
                        const text = event.clipboardData?.getData('text/plain') ?? '';
                        if (!text.trim()) return false;
                        const before = view.state.doc.textContent;
                        requestAnimationFrame(() => {
                            const after = view.state.doc.textContent;
                            const marker = text.trim().slice(0, 12);
                            if (marker && !after.includes(marker) && before === after) {
                                view.dispatch(view.state.tr.insertText(text));
                            }
                        });
                        return false;
                    },
                },
                onUpdate: ({ editor: ed }) => {
                    onChangeRef.current(ed.isEmpty ? '' : normalizeNovelHtml(ed.getHTML()));
                },
            }),
            [initialContent],
        ),
    );

    if (!editor) {
        return <div className="h-56 animate-pulse rounded-md border border-input bg-bg-soft" />;
    }

    return (
        <div className="rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <TemplateToolbar editor={editor} />
            <EditorContent editor={editor} />
            <PlaceholderChips editor={editor} />
        </div>
    );
}

function TemplateToolbar({ editor }: { editor: Editor }) {
    return (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1">
            <TemplateToolbarButton
                title="Жирный"
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <span className="font-bold">Ж</span>
            </TemplateToolbarButton>
            <TemplateToolbarButton
                title="Курсив"
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <span className="italic">К</span>
            </TemplateToolbarButton>
            <TemplateToolbarButton
                title="Подчёркнутый"
                active={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
                <span className="underline">Ч</span>
            </TemplateToolbarButton>
            <TemplateToolbarButton
                title="Зачёркнутый"
                active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <span className="line-through">З</span>
            </TemplateToolbarButton>

            <ToolbarSeparator />

            <TemplateToolbarButton
                title="Маркированный список"
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <List className="h-4 w-4" />
            </TemplateToolbarButton>
            <TemplateToolbarButton
                title="Нумерованный список"
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="h-4 w-4" />
            </TemplateToolbarButton>
            <TemplateToolbarButton
                title="Ссылка"
                active={editor.isActive('link')}
                onClick={() => toggleLink(editor)}
            >
                <Link2 className="h-4 w-4" />
            </TemplateToolbarButton>

            <ToolbarSeparator />

            <TemplateToolbarButton
                title="Отменить"
                disabled={!editor.can().undo()}
                active={false}
                onClick={() => editor.chain().focus().undo().run()}
            >
                <span className="text-13-medium">↺</span>
            </TemplateToolbarButton>
            <TemplateToolbarButton
                title="Повторить"
                disabled={!editor.can().redo()}
                active={false}
                onClick={() => editor.chain().focus().redo().run()}
            >
                <span className="text-13-medium">↻</span>
            </TemplateToolbarButton>

            <span className="ml-auto hidden pr-1 text-11-regular text-fg-tertiary sm:inline">
                Ctrl+Enter — новая строка
            </span>
        </div>
    );
}

function TemplateToolbarButton({ active, disabled, title, onClick, children }: TemplateToolbarButtonProps) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                active && 'bg-accent text-accent-foreground',
            )}
        >
            {children}
        </button>
    );
}

function ToolbarSeparator() {
    return <div aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

function PlaceholderChips({ editor }: { editor: Editor }) {
    const insert = useCallback(
        (key: string) => {
            editor.chain().focus().insertContent(`{{${key}}}`).run();
        },
        [editor],
    );

    return (
        <div className="flex flex-wrap gap-1.5 border-t border-input px-2 py-1.5">
            <span className="mr-1 self-center text-11-regular text-fg-tertiary">Вставить метку:</span>
            {POST_TEMPLATE_PLACEHOLDERS.map((p) => (
                <button
                    key={p.key}
                    type="button"
                    title={`Вставить метку ${`{{${p.key}}}`}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insert(p.key)}
                    className="rounded-full border border-border bg-bg-soft px-2 py-0.5 font-mono text-11-regular text-fg-primary hover:bg-bg-soft/70"
                >
                    {`{{${p.key}}}`}
                </button>
            ))}
        </div>
    );
}

function toggleLink(editor: Editor) {
    if (editor.isActive('link')) {
        editor.chain().focus().unsetLink().run();
        return;
    }
    const previousUrl = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = typeof window !== 'undefined' ? window.prompt('URL ссылки', previousUrl) : null;
    if (url === null) return;
    if (url === '') {
        editor.chain().focus().unsetLink().run();
        return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}
