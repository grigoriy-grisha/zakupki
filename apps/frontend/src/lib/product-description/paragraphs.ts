import { escapeHtml } from '@/lib/utils/html';

export function blankParagraph(): string {
    return '<p></p>';
}

export function paragraph(text: string): string {
    return `<p>${escapeHtml(text)}</p>`;
}

export function boldParagraph(text: string): string {
    return `<p><strong>${escapeHtml(text)}</strong></p>`;
}

export function boldLinesParagraph(lines: string[]): string {
    return `<p><strong>${lines.map(escapeHtml).join('<br>')}</strong></p>`;
}

export function linesParagraph(lines: string[]): string {
    return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
}

export function linesInline(lines: string[]): string {
    return lines.map(escapeHtml).join('<br>');
}
