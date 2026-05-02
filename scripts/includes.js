(function () {
    // Auto-load config-loader.js for settings data on all pages
    function autoLoadConfig() {
        // Check if config-loader is already loaded
        if (document.querySelector('script[src*="config-loader.js"]')) return;
        
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'scripts/config-loader.js';
        document.body.appendChild(script);
    }
    
    // Load config once DOM is ready so we can reliably detect existing script tags
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoLoadConfig)
    } else {
        autoLoadConfig()
    }

    function autoLoadUserDataTracker() {
        if (document.querySelector('script[src*="user-data-tracker.js"]')) return

        const script = document.createElement('script')
        script.type = 'module'
        script.src = 'scripts/user-data-tracker.js'
        document.body.appendChild(script)
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoLoadUserDataTracker)
    } else {
        autoLoadUserDataTracker()
    }

    function autoLoadSpaNav() {
        if (document.querySelector('script[src*="spa-nav.js"]')) return

        const script = document.createElement('script')
        script.type = 'module'
        script.src = 'scripts/spa-nav.js'
        document.body.appendChild(script)
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoLoadSpaNav)
    } else {
        autoLoadSpaNav()
    }

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
