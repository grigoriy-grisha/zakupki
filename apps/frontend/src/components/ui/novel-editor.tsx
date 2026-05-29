'use client';

import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
    EditorBubble,
    EditorBubbleItem,
    EditorContent,
    EditorRoot,
    HighlightExtension,
    HorizontalRule,
    Placeholder,
    StarterKit,
    TaskItem,
    TaskList,
    TiptapLink,
    TiptapUnderline,
    useEditor as useCurrentEditor,
    type EditorInstance,
    type JSONContent,
} from 'novel';
import {
    Bold,
    Code as CodeIcon,
    CodeXml,
    Heading1,
    Heading2,
    Heading3,
    Highlighter,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    ListTodo,
    Minus,
    Pilcrow,
    Quote,
    Redo,
    Strikethrough,
    Underline as UnderlineIcon,
    Undo,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { normalizeNovelHtml } from '@/app/(admin)/products/lib';

interface NovelEditorProps {
    value?: string;
    onChange?: (html: string) => void;
    placeholder?: string;
    className?: string;
    minHeight?: string;
}

const EMPTY_DOC: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph' }],
};

export function NovelEditor({
    value,
    onChange,
    placeholder = 'Введите описание...',
    className,
    minHeight = '10rem',
}: NovelEditorProps) {
    const lastEmittedHtml = useRef<string>('');
    const editorRef = useRef<EditorInstance | null>(null);

    const extensions = useMemo(
        () => [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                horizontalRule: false,
            }),
            HorizontalRule,
            TiptapUnderline,
            TiptapLink.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: { class: 'novel-link', rel: 'noopener noreferrer nofollow', target: '_blank' },
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            HighlightExtension.configure({ multicolor: false }),
            Placeholder.configure({
                placeholder: ({ node }) => (node.type.name === 'heading' ? 'Заголовок' : placeholder),
                includeChildren: true,
            }),
        ],
        [placeholder],
    );

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const incoming = normalizeNovelHtml(value ?? '');
        if (incoming === lastEmittedHtml.current) return;

        const currentHtml = editor.isEmpty ? '' : normalizeNovelHtml(editor.getHTML());
        if (currentHtml === incoming) return;

        editor.commands.setContent(incoming, false);
        lastEmittedHtml.current = incoming;
    }, [value]);

    return (
        <div
            className={cn(
                'rounded-md border border-input bg-transparent shadow-xs',
                'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
                'transition-[color,box-shadow] dark:bg-input/30',
                className,
            )}
        >
            <EditorRoot>
                <EditorContent
                    initialContent={EMPTY_DOC}
                    extensions={extensions}
                    immediatelyRender={false}
                    slotBefore={<EditorToolbar />}
                    onCreate={({ editor }) => {
                        editorRef.current = editor;
                        if (value) {
                            const normalized = normalizeNovelHtml(value);
                            editor.commands.setContent(normalized, false);
                            lastEmittedHtml.current = normalized;
                        }
                    }}
                    onUpdate={({ editor }) => {
                        const html = editor.isEmpty ? '' : editor.getHTML();
                        lastEmittedHtml.current = html;
                        onChange?.(html);
                    }}
                    editorProps={{
                        attributes: {
                            class: 'novel-editor focus:outline-none px-3 py-2 text-base md:text-sm',
                            style: `min-height: ${minHeight}`,
                        },
                    }}
                >
                    <EditorBubble
                        tippyOptions={{ placement: 'top' }}
                        className="flex w-fit overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
                    >
                        <BubbleButton
                            icon={<Bold className="h-4 w-4" />}
                            isActive={(e) => e.isActive('bold')}
                            command={(e) => e.chain().focus().toggleBold().run()}
                        />
                        <BubbleButton
                            icon={<Italic className="h-4 w-4" />}
                            isActive={(e) => e.isActive('italic')}
                            command={(e) => e.chain().focus().toggleItalic().run()}
                        />
                        <BubbleButton
                            icon={<UnderlineIcon className="h-4 w-4" />}
                            isActive={(e) => e.isActive('underline')}
                            command={(e) => e.chain().focus().toggleUnderline().run()}
                        />
                        <BubbleButton
                            icon={<Strikethrough className="h-4 w-4" />}
                            isActive={(e) => e.isActive('strike')}
                            command={(e) => e.chain().focus().toggleStrike().run()}
                        />
                        <BubbleButton
                            icon={<CodeIcon className="h-4 w-4" />}
                            isActive={(e) => e.isActive('code')}
                            command={(e) => e.chain().focus().toggleCode().run()}
                        />
                        <BubbleButton
                            icon={<Highlighter className="h-4 w-4" />}
                            isActive={(e) => e.isActive('highlight')}
                            command={(e) => e.chain().focus().toggleHighlight().run()}
                        />
                        <BubbleButton
                            icon={<LinkIcon className="h-4 w-4" />}
                            isActive={(e) => e.isActive('link')}
                            command={toggleLink}
                        />
                    </EditorBubble>
                </EditorContent>
            </EditorRoot>
        </div>
    );
}

interface BubbleButtonProps {
    icon: React.ReactNode;
    isActive?: (editor: EditorInstance) => boolean;
    command: (editor: EditorInstance) => void;
}

function BubbleButton({ icon, isActive, command }: BubbleButtonProps) {
    const { editor } = useCurrentEditor();
    useEditorRerender(editor);
    const active = editor && isActive ? isActive(editor) : false;
    return (
        <EditorBubbleItem
            onSelect={(e) => command(e)}
            className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                active && 'bg-accent text-accent-foreground',
            )}
        >
            {icon}
        </EditorBubbleItem>
    );
}

function EditorToolbar() {
    const { editor } = useCurrentEditor();
    useEditorRerender(editor);

    if (!editor) {
        return <div aria-hidden className="flex h-9 items-center border-b border-input px-1.5" />;
    }

    return (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1">
            <ToolbarButton
                title="Отменить"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
            >
                <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Повторить"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
            >
                <Redo className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
                title="Параграф"
                active={editor.isActive('paragraph') && !editor.isActive('heading')}
                onClick={() => editor.chain().focus().setParagraph().run()}
            >
                <Pilcrow className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Заголовок 1"
                active={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
                <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Заголовок 2"
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
                <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Заголовок 3"
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
                <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
                title="Жирный"
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Курсив"
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Подчёркнутый"
                active={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
                <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Зачёркнутый"
                active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Код (inline)"
                active={editor.isActive('code')}
                onClick={() => editor.chain().focus().toggleCode().run()}
            >
                <CodeIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Выделение"
                active={editor.isActive('highlight')}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
            >
                <Highlighter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Ссылка" active={editor.isActive('link')} onClick={() => toggleLink(editor)}>
                <LinkIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
                title="Маркированный список"
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Нумерованный список"
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Чек-лист"
                active={editor.isActive('taskList')}
                onClick={() => editor.chain().focus().toggleTaskList().run()}
            >
                <ListTodo className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
                title="Цитата"
                active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
                <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Блок кода"
                active={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
                <CodeXml className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                title="Горизонтальная линия"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
                <Minus className="h-4 w-4" />
            </ToolbarButton>
        </div>
    );
}

interface ToolbarButtonProps {
    children: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
}

function ToolbarButton({ children, onClick, active, disabled, title }: ToolbarButtonProps) {
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

function toggleLink(editor: EditorInstance) {
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

function useEditorRerender(editor: EditorInstance | null) {
    const [, force] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
        if (!editor) return;
        const handler = () => force();
        editor.on('transaction', handler);
        editor.on('selectionUpdate', handler);
        editor.on('focus', handler);
        editor.on('blur', handler);
        return () => {
            editor.off('transaction', handler);
            editor.off('selectionUpdate', handler);
            editor.off('focus', handler);
            editor.off('blur', handler);
        };
    }, [editor]);
}
