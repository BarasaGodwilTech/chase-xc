(function () {
    async function includeAll() {
        const includeEls = document.querySelectorAll('[data-include]');
        if (includeEls.length === 0) return;

        await Promise.all(Array.from(includeEls).map(async (el) => {
            const path = el.getAttribute('data-include');
            if (!path) return;

            try {
                const res = await fetch(path, { cache: 'no-cache' });
                if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);

                const html = await res.text();
                el.innerHTML = html;

                // Re-run scripts embedded in the included HTML, if any.
                // (Header/footer shouldn't need this, but it's a safe default.)
                el.querySelectorAll('script').forEach((oldScript) => {
                    const s = document.createElement('script');
                    Array.from(oldScript.attributes).forEach((attr) => s.setAttribute(attr.name, attr.value));
                    s.textContent = oldScript.textContent;
                    oldScript.replaceWith(s);
                });
            } catch (err) {
                console.error(err);
                el.innerHTML = '';
            }
        }));

        document.dispatchEvent(new CustomEvent('includes:loaded'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', includeAll);
    } else {
        includeAll();
    }
})();
