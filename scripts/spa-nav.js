// SPA-style navigation (PJAX) to preserve the persistent floating player across page switches
(function () {
  let _spaNavInitialized = false

  const PERSISTENT_SCRIPT_PARTS = [
    'scripts/includes.js',
    'scripts/config-loader.js',
    'scripts/user-data-tracker.js',
    'scripts/floating-player.js',
    'scripts/firebase-init.js',
    'scripts/auth.js'
  ]

  function isSameOrigin(url) {
    try {
      const u = new URL(url, window.location.href)
      return u.origin === window.location.origin
    } catch (_) {
      return false
    }
  }

  function isHashOnlyNavigation(href) {
    try {
      const u = new URL(href, window.location.href)
      const cur = new URL(window.location.href)
      return u.pathname === cur.pathname && u.search === cur.search && u.hash
    } catch (_) {
      return false
    }
  }

  function getIncludeEl(doc, includePath) {
    return doc.querySelector(`[data-include="${includePath}"]`)
  }

  function ensureSpaContentContainer() {
    const existing = document.getElementById('spaContent')
    if (existing) return existing

    const headerInclude = getIncludeEl(document, 'partials/header.html')
    const footerInclude = getIncludeEl(document, 'partials/footer.html')
    if (!headerInclude || !footerInclude) return null

    const container = document.createElement('div')
    container.id = 'spaContent'

    // Insert right after the header include block
    headerInclude.insertAdjacentElement('afterend', container)

    // Move everything between headerInclude and footerInclude into the container
    let node = container.nextSibling
    while (node && node !== footerInclude) {
      const next = node.nextSibling
      // Skip empty text nodes
      if (node.nodeType === Node.TEXT_NODE && !String(node.textContent || '').trim()) {
        node = next
        continue
      }
      container.appendChild(node)
      node = next
    }

    return container
  }

  function extractPageContent(doc) {
    const headerInclude = getIncludeEl(doc, 'partials/header.html')
    const footerInclude = getIncludeEl(doc, 'partials/footer.html')
    if (!headerInclude || !footerInclude) return null

    const nodes = []
    let node = headerInclude.nextSibling
    while (node && node !== footerInclude) {
      const next = node.nextSibling
      // Ignore whitespace-only text
      if (node.nodeType === Node.TEXT_NODE && !String(node.textContent || '').trim()) {
        node = next
        continue
      }
      nodes.push(node)
      node = next
    }

    return nodes
  }

  function extractPostFooterScripts(doc) {
    const footerInclude = getIncludeEl(doc, 'partials/footer.html')
    if (!footerInclude) return []

    const out = []
    let node = footerInclude.nextSibling
    while (node) {
      const next = node.nextSibling
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
        out.push(node)
      }
      node = next
    }

    return out
  }

  function normalizeHrefToAbsolute(href) {
    try {
      return new URL(href, window.location.href).href
    } catch (_) {
      return null
    }
  }

  function normalizeSrcToAbsolute(src) {
    try {
      return new URL(src, window.location.href).href
    } catch (_) {
      return null
    }
  }

  function syncStylesheetsFromDoc(doc) {
    if (!doc) return

    const incoming = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))
    if (incoming.length === 0) return

    const existing = new Set(
      Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
        .map((l) => normalizeHrefToAbsolute(l.getAttribute('href')))
        .filter(Boolean)
    )

    incoming.forEach((linkEl) => {
      const href = linkEl.getAttribute('href')
      const abs = normalizeHrefToAbsolute(href)
      if (!abs) return
      if (existing.has(abs)) return

      const l = document.createElement('link')
      Array.from(linkEl.attributes).forEach((attr) => l.setAttribute(attr.name, attr.value))
      l.setAttribute('data-spa-style', '1')
      document.head.appendChild(l)
      existing.add(abs)
    })
  }

  function rerunScriptsWithin(el) {
    if (!el) return
    el.querySelectorAll('script').forEach((oldScript) => {
      const s = document.createElement('script')
      Array.from(oldScript.attributes).forEach((attr) => s.setAttribute(attr.name, attr.value))
      s.textContent = oldScript.textContent
      oldScript.replaceWith(s)
    })
  }

  function removeSpaInjectedInlineScripts() {
    document.querySelectorAll('script[data-spa-inline="1"]').forEach((s) => s.remove())
  }

  function srcLooksPersistent(src) {
    if (!src) return false
    return PERSISTENT_SCRIPT_PARTS.some((p) => src.includes(p))
  }

  function scriptAlreadyOnPage(src) {
    if (!src) return false
    const abs = normalizeSrcToAbsolute(src)
    if (abs) {
      return !!document.querySelector(`script[src="${CSS.escape(abs)}"]`)
    }
    return !!document.querySelector(`script[src="${CSS.escape(src)}"]`)
  }

  function syncExternalScriptsFromDoc(doc) {
    if (!doc) return Promise.resolve([])

    const incoming = Array.from(doc.querySelectorAll('script[src]'))
    if (incoming.length === 0) return Promise.resolve([])

    const loads = []

    incoming.forEach((scriptEl) => {
      const src = scriptEl.getAttribute('src')
      if (!src) return
      if (srcLooksPersistent(src)) return
      if (scriptAlreadyOnPage(src)) return

      const abs = normalizeSrcToAbsolute(src)
      const s = document.createElement('script')
      Array.from(scriptEl.attributes).forEach((attr) => s.setAttribute(attr.name, attr.value))
      if (abs) s.setAttribute('src', abs)
      s.setAttribute('data-spa-script', '1')

      loads.push(new Promise((resolve) => {
        s.addEventListener('load', () => resolve({ src: abs || src, ok: true }))
        s.addEventListener('error', () => resolve({ src: abs || src, ok: false }))
      }))

      document.body.appendChild(s)
    })

    return Promise.all(loads)
  }

  function injectPostFooterScripts(scripts) {
    // Keep external scripts once loaded to avoid breaking global state (e.g. Firebase/auth).
    // Only clear SPA-injected inline scripts to prevent stacking duplicates.
    removeSpaInjectedInlineScripts()

    scripts.forEach((scriptEl) => {
      const src = scriptEl.getAttribute('src')
      if (srcLooksPersistent(src)) return
      if (src && scriptAlreadyOnPage(src)) return

      // Inline scripts: execute on each navigation, but don't keep accumulating DOM nodes
      if (!src) {
        const code = scriptEl.textContent || ''
        if (code.trim()) {
          try {
            // eslint-disable-next-line no-new-func
            new Function(code)()
          } catch (e) {
            console.error('[spa-nav] inline script error:', e)
          }
        }

        // Keep a small marker so we can remove any previously injected inline scripts next nav
        const marker = document.createElement('script')
        marker.setAttribute('data-spa-inline', '1')
        document.body.appendChild(marker)
        return
      }

      const s = document.createElement('script')
      Array.from(scriptEl.attributes).forEach((attr) => s.setAttribute(attr.name, attr.value))
      s.textContent = scriptEl.textContent
      document.body.appendChild(s)
    })
  }

  function updateActiveNav(urlHref) {
    let url
    try {
      url = new URL(urlHref, window.location.href)
    } catch (_) {
      return
    }

    const currentPath = url.pathname.replace(/\/+$/, '')
    const navLinks = Array.from(document.querySelectorAll('a.nav-link[href]'))
    if (navLinks.length === 0) return

    navLinks.forEach((a) => a.classList.remove('active'))

    const match = navLinks.find((a) => {
      const href = a.getAttribute('href')
      if (!href) return false
      if (href.startsWith('#')) return false
      try {
        const u = new URL(href, window.location.href)
        const p = u.pathname.replace(/\/+$/, '')
        return p === currentPath
      } catch (_) {
        return false
      }
    })

    if (match) match.classList.add('active')
  }

  async function navigateTo(href, { replace = false } = {}) {
    const url = new URL(href, window.location.href)

    // For hash changes on the same page, let the browser handle scrolling
    if (isHashOnlyNavigation(href)) {
      if (replace) {
        history.replaceState({}, '', url.href)
      } else {
        history.pushState({}, '', url.href)
      }
      return
    }

    const res = await fetch(url.href, {
      cache: 'no-cache',
      headers: {
        'X-Requested-With': 'spa-nav'
      }
    })

    if (!res.ok) {
      window.location.href = url.href
      return
    }

    const html = await res.text()
    const parser = new DOMParser()
    const newDoc = parser.parseFromString(html, 'text/html')

    // Ensure page-specific CSS is present (e.g., profile.css) when navigating without a full reload
    syncStylesheetsFromDoc(newDoc)

    const spaContent = ensureSpaContentContainer()
    if (!spaContent) {
      window.location.href = url.href
      return
    }

    const newNodes = extractPageContent(newDoc)
    if (!newNodes) {
      window.location.href = url.href
      return
    }

    // Swap content
    spaContent.innerHTML = ''
    newNodes.forEach((n) => spaContent.appendChild(document.importNode(n, true)))

    // Ensure page-specific external scripts are loaded (e.g., music-page.js) before we broadcast lifecycle events
    await syncExternalScriptsFromDoc(newDoc)

    // Ensure scripts inside the swapped content execute
    rerunScriptsWithin(spaContent)

    // Update title
    if (newDoc.title) document.title = newDoc.title

    // Update history
    if (replace) {
      history.replaceState({}, '', url.href)
    } else {
      history.pushState({}, '', url.href)
    }

    updateActiveNav(url.href)

    // Inject scripts that were after the footer include in the target page
    const postFooterScripts = extractPostFooterScripts(newDoc)
    injectPostFooterScripts(postFooterScripts)

    // Scroll
    if (url.hash) {
      const target = document.getElementById(url.hash.slice(1))
      if (target) {
        target.scrollIntoView({ block: 'start' })
      } else {
        window.scrollTo(0, 0)
      }
    } else {
      window.scrollTo(0, 0)
    }

    // Let existing page modules re-bind like they do after includes injection
    document.dispatchEvent(new CustomEvent('includes:loaded'))
    document.dispatchEvent(new CustomEvent('spa:navigated', { detail: { url: url.href } }))
  }

  function shouldHandleLink(a) {
    if (!a) return false

    const href = a.getAttribute('href')
    if (!href) return false

    if (a.hasAttribute('download')) return false
    if (a.getAttribute('target') === '_blank') return false
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return false

    // Allow normal behavior for anchors if it's within the same page
    if (href.startsWith('#')) return true

    if (!isSameOrigin(href)) return false

    // Avoid admin pages
    if (/^admin\//i.test(href) || href.includes('/admin/')) return false

    return true
  }

  function onDocumentClick(e) {
    const a = e.target && e.target.closest ? e.target.closest('a') : null
    if (!a) return

    if (!shouldHandleLink(a)) return

    const href = a.getAttribute('href')
    if (!href) return

    // Respect modifier keys / middle click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return

    e.preventDefault()
    navigateTo(href).catch((err) => {
      console.error('[spa-nav] Navigation failed:', err)
      window.location.href = href
    })
  }

  function init() {
    if (_spaNavInitialized) return
    const spaContent = ensureSpaContentContainer()
    if (!spaContent) return

    _spaNavInitialized = true

    updateActiveNav(window.location.href)

    document.addEventListener('click', onDocumentClick)

    window.addEventListener('popstate', () => {
      navigateTo(window.location.href, { replace: true }).catch((err) => {
        console.error('[spa-nav] popstate navigation failed:', err)
        window.location.reload()
      })
    })
  }

  // Wait until includes are loaded so header/footer include anchors exist
  document.addEventListener('includes:loaded', () => {
    init()
  })

  // Allow other modules (e.g. auth) to navigate without a full reload to preserve the player.
  // This is safe to call even before init; it will fall back to a normal navigation.
  window.spaNavigate = function spaNavigate(href, opts = {}) {
    try {
      return navigateTo(href, opts)
    } catch (e) {
      console.error('[spa-nav] spaNavigate fallback:', e)
      window.location.href = href
      return Promise.resolve()
    }
  }

  // If includes already loaded before this script evaluated, try init on next tick
  if (document.readyState !== 'loading') {
    setTimeout(() => {
      init()
    }, 0)
  }
})()
