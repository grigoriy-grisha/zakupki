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

            body.querySelectorAll('p, div, h1, h2, h3, blockquote').forEach((el) => {
                const hasMedia = el.querySelector('img, hr, iframe');
                const text = (el.textContent ?? '').replace(/ /g, ' ').trim();
                if (!hasMedia && text === '') el.remove();
            });
            return body.innerHTML.trim();
        } catch {
            return stripEmptyParagraphs(out);
        }
    }

    return stripEmptyParagraphs(out);
}

function stripEmptyParagraphs(html: string): string {
    let res = html.replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '<p></p>');
    res = res.replace(/<p>(?:\s|&nbsp;|&#160;| )*<\/p>/gi, '<p></p>');
    res = res.replace(/<p>\s*<\/p>\s*/gi, '');
    return res.trim();
}
