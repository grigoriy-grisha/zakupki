export function normalizeNovelHtml(html: string): string {
    const out = (html ?? '').trim();
    if (!out) return '';

    if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
        try {
            const doc = new window.DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
            const body = doc.body;

            let nested = true;
            while (nested) {
                nested = false;
                body.querySelectorAll('p > p').forEach((inner) => {
                    const outer = inner.parentElement;
                    if (outer?.tagName === 'P') {
                        outer.replaceWith(inner);
                        nested = true;
                    }
                });
            }

            body.querySelectorAll('div, h1, h2, h3, blockquote').forEach((el) => {
                const hasMedia = el.querySelector('img, hr, iframe');
                const text = (el.textContent ?? '').replace(/ /g, ' ').trim();
                if (!hasMedia && text === '') el.remove();
            });
            return body.innerHTML.trim();
        } catch {
            return stripEmptyBlocks(out);
        }
    }

    return stripEmptyBlocks(out);
}

function stripEmptyBlocks(html: string): string {
    return html
        .replace(/<(div|h[1-3]|blockquote)>\s*(<br\s*\/?>)?\s*<\/\1>/gi, '')
        .trim();
}
