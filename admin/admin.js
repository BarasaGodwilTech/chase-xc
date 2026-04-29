// admin.js - Simplified Working Version
class AdminPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.dataManager = window.dataManager;
        this.editingItem = null;

        this.settingsDirty = false;
        this.settingsDirtyBound = false;
        this.searchBound = false;

        this._adminAuthListenerBound = false;

        this._githubSettingsCache = null;
        this._githubSettingsCacheAt = 0;

        this.init();
    }


    init() {
        console.log('AdminPanel initializing...');

        // Ensure we have a reliable focus target for keyboard navigation
        const adminNav = document.getElementById('adminNav');
        if (adminNav && !adminNav.hasAttribute('tabindex')) {
            adminNav.setAttribute('tabindex', '-1');
        }

        this.setupEventListeners();
        this.bindAdminAuthState();

        const storedSection = localStorage.getItem('admin:lastSection');
        const initialSection = storedSection && document.getElementById(storedSection) ? storedSection : 'dashboard';
        this.showSection(initialSection);

        // Only listen for local DataManager updates when running in local-storage mode.
        if (this.dataManager) {
            window.addEventListener('dataUpdated', () => {
                this.loadSectionData(this.currentSection);
            });
        }

        console.log('AdminPanel initialized successfully');
    }

    async getGithubSettings() {
        const now = Date.now();
        if (this._githubSettingsCache && (now - this._githubSettingsCacheAt) < 60_000) {
            return this._githubSettingsCache;
        }

        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const ref = doc(db, 'settings', 'github');
            const snap = await getDoc(ref);
            const settings = snap.exists() ? snap.data() : null;
            this._githubSettingsCache = settings;
            this._githubSettingsCacheAt = now;
            return settings;
        } catch (e) {
            console.warn('[AdminPanel] Failed to fetch GitHub settings from Firestore:', e);
            this._githubSettingsCache = null;
            this._githubSettingsCacheAt = now;
            return null;
        }
    }

    async handleImageUpload(file, entityType = 'team') {
        if (!file) return '';

        // Prefer GitHub uploads via Cloudflare Worker (server-side token). If not configured,
        // fall back to Firebase Storage.

        const githubSettings = await this.getGithubSettings();
        const githubEnabled = Boolean(githubSettings && githubSettings.enabled);
        if (githubEnabled) {
            try {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
                    reader.onload = () => {
                        const dataUrl = String(reader.result || '');
                        const idx = dataUrl.indexOf(',');
                        resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
                    };
                    reader.readAsDataURL(file);
                });

                // Construct GitHub path from settings
                const owner = githubSettings.owner;
                const repo = githubSettings.repo;
                const branch = githubSettings.branch || 'main';
                const folder = githubSettings.folder || 'images/profiles';

                if (!owner || !repo) {
                    console.warn('[AdminPanel] GitHub settings missing owner or repo, falling back to Firebase Storage');
                } else {
                    const ext = String(file.name || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
                    const timestamp = Date.now();
                    const path = `${folder}/${entityType}/${timestamp}.${ext}`;

                    // Call Cloudflare Worker
                    const workerUrl = 'https://github-image-uploader.barasagodwil.workers.dev';
                    const res = await fetch(workerUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            owner,
                            repo,
                            path,
                            content: base64,
                            message: `Upload ${entityType} image ${timestamp}.${ext}`,
                            branch,
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const url = data?.url;
                        if (typeof url === 'string' && url.startsWith('http')) {
                            return url;
                        }
                    } else {
                        console.warn('[AdminPanel] Cloudflare Worker upload failed:', res.status, await res.text());
                    }
                }
            } catch (e) {
                // Not fatal — will fall back below.
                console.warn('[AdminPanel] GitHub upload failed, falling back to Firebase Storage:', e);
            }
        }

        // Firebase Storage fallback
        const { storage } = await import('../scripts/firebase-init.js');
        const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js');

        const parts = String(file.name || '').split('.');
        const ext = (parts.length > 1 ? parts.pop() : 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const now = Date.now();
        const path = `${String(entityType || 'team')}/${now}.${ext}`;

        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    }

    bindAdminAuthState() {
        if (this._adminAuthListenerBound) return;
        this._adminAuthListenerBound = true;

        const apply = () => {
            this.applyRoleBasedUI();
        };

        // Apply immediately if adminAuth is already present.
        apply();

        // Re-apply whenever admin auth state changes.
        window.addEventListener('adminAuthState', apply);
    }

    applyRoleBasedUI() {
        const isSuper = this.isSuperAdmin();
        const adminMgmtNav = document.querySelector('.nav-item[data-target="admin-management"]');
        if (adminMgmtNav) {
            adminMgmtNav.style.display = isSuper ? '' : 'none';
        }

        const inviteBtn = document.getElementById('inviteAdminBtn');
        if (inviteBtn) {
            inviteBtn.style.display = isSuper ? '' : 'none';
        }

        // If user is not super admin and is currently on admin-management, move them away.
        if (!isSuper && this.currentSection === 'admin-management') {
            this.showSection('dashboard');
        }
    }


    setupEventListeners() {
        console.log('Setting up event listeners...');

        document.querySelectorAll('.nav-item[data-target]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.getAttribute('data-target');
                console.log('Navigation clicked:', target);
                this.showSection(target);

                const navContent = document.querySelector('.nav-content');
                if (navContent && navContent.classList.contains('active')) {
                    navContent.classList.remove('active');
                }
            });
        });

        const navToggle = document.getElementById('navToggle');
        if (navToggle) {
            navToggle.addEventListener('click', () => {
                document.querySelector('.nav-content')?.classList.toggle('active');
            });
        }

        // Close mobile nav when clicking outside
        document.addEventListener('click', (e) => {
            const navContent = document.querySelector('.nav-content');
            const adminNav = document.getElementById('adminNav');
            if (navContent && navContent.classList.contains('active')) {
                if (adminNav && !adminNav.contains(e.target)) {
                    navContent.classList.remove('active');
                }
            }
        });

        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        document.getElementById('notificationsBtn')?.addEventListener('click', () => {
            this.toggleNotifications();
        });

        document.getElementById('closeNotifications')?.addEventListener('click', () => {
            this.toggleNotifications();
        });

        document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Global search (filters the active table)
        if (!this.searchBound) {
            this.searchBound = true;
            const searchInput = document.querySelector('.search-box input');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    this.applyTableSearch(searchInput.value);
                });
            }
        }

        // Keyboard shortcuts
        if (!this.shortcutsBound) {
            this.shortcutsBound = true;
            document.addEventListener('keydown', (e) => {
                const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
                const isTyping = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

                if (e.key === '/' && !isTyping) {
                    const searchInput = document.querySelector('.search-box input');
                    if (searchInput) {
                        e.preventDefault();
                        searchInput.focus();
                    }
                }

                if (!(e.ctrlKey || e.metaKey)) return;
                if (isTyping) return;

                const map = {
                    '1': 'dashboard',
                    '2': 'artists',
                    '3': 'tracks',
                    '4': 'team',
                    '5': 'settings'
                };
                const target = map[e.key];
                if (target) {
                    e.preventDefault();
                    this.showSection(target);
                }
            });
        }

        document.getElementById('addTrackBtn')?.addEventListener('click', () => {
            this.addNewTrack();
        });

        // Inline form event listeners
        this.setupInlineFormListeners();

        // Music management form handlers - audioUploadForm is handled by admin-firebase.js
        document.getElementById('cancelUpload')?.addEventListener('click', () => {
            this.resetUploadForm();
        });

        document.getElementById('externalTrackForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleExternalTrack();
        });

        document.getElementById('cancelExternal')?.addEventListener('click', () => {
            this.switchUploadMethod('upload');
        });

        // Platform selection listeners
        document.querySelectorAll('input[name="platform"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.handlePlatformSelection(radio.value);
            });
        });

        const externalArtistSelect = document.getElementById('externalArtist');
        if (externalArtistSelect && !externalArtistSelect.dataset.collabBound) {
            externalArtistSelect.dataset.collabBound = 'true';
            externalArtistSelect.addEventListener('change', async () => {
                const container = document.getElementById('externalCollaboratorsTickList');
                if (!container) return;

                if (externalArtistSelect.value === '__collab__') {
                    container.style.display = '';
                    await this.renderExternalCollaboratorsTickList(Array.isArray(this.externalCollaboratorIds) ? this.externalCollaboratorIds : []);
                } else {
                    container.style.display = 'none';
                    this.externalCollaboratorIds = [];
                    container.innerHTML = '';
                }
            });
        }

        document.getElementById('searchExternal')?.addEventListener('click', () => {
            this.searchExternalPlatform();
        });

        const externalSearchInput = document.getElementById('externalSearch');
        if (externalSearchInput) {
            externalSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.searchExternalPlatform();
                }
            });
        }

        // External URL auto-fetch metadata
        const externalUrlInput = document.getElementById('externalUrl');
        if (externalUrlInput) {
            // Handle paste event
            externalUrlInput.addEventListener('paste', async () => {
                setTimeout(async () => {
                    const url = externalUrlInput.value.trim();
                    if (url) {
                        await this.fetchExternalTrackMetadata(url);
                    }
                }, 100);
            });

            // Handle change event
            externalUrlInput.addEventListener('change', async () => {
                const url = externalUrlInput.value.trim();
                if (url) {
                    await this.fetchExternalTrackMetadata(url);
                }
            });

            // Handle input event with debounce
            externalUrlInput.addEventListener('input', () => {
                const url = externalUrlInput.value.trim();
                if (url && (
                    this.isValidPlatformUrl(url, 'youtube') ||
                    this.isValidPlatformUrl(url, 'apple-music') ||
                    this.isValidPlatformUrl(url, 'soundcloud')
                )) {
                    clearTimeout(this.externalUrlDebounce);
                    this.externalUrlDebounce = setTimeout(async () => {
                        await this.fetchExternalTrackMetadata(url);
                    }, 500);
                }
            });
        }

        // Payment section handlers
        document.getElementById('exportPayments')?.addEventListener('click', () => {
            this.exportPayments();
        });

        document.getElementById('refreshPayments')?.addEventListener('click', () => {
            this.loadPayments();
        });

        document.getElementById('applyPaymentFilters')?.addEventListener('click', () => {
            this.applyPaymentFilters();
        });

        // Audio URL link preview on input
        const audioUrlInput = document.getElementById('audioUrl');
        if (audioUrlInput) {
            audioUrlInput.addEventListener('input', () => {
                const url = audioUrlInput.value.trim();
                if (url) {
                    this.showLinkPreview(url);
                } else {
                    this.hideLinkPreview();
                }
            });
            audioUrlInput.addEventListener('paste', () => {
                setTimeout(() => {
                    const url = audioUrlInput.value.trim();
                    if (url) this.showLinkPreview(url);
                }, 100);
            });
        }

        this.setupBasicMusicManagement();
        this.setupSpotifyImport();

        console.log('Event listeners setup complete');
    }

    applyTableSearch(rawQuery) {
        const query = String(rawQuery || '').trim().toLowerCase();

        const sectionToTableId = {
            artists: 'artistsTable',
            tracks: 'tracksTable',
            team: 'teamTable',
            payments: 'paymentsTable'
        };

        const tableId = sectionToTableId[this.currentSection];
        if (!tableId) return;

        const tbody = document.getElementById(tableId);
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        let visible = 0;

        const ensureNoResultsRow = () => {
            let row = tbody.querySelector('tr[data-search-no-results="true"]');
            if (!row) {
                row = document.createElement('tr');
                row.dataset.searchNoResults = 'true';
                row.innerHTML = '<td colspan="20" class="text-center">No matching results</td>';
                tbody.appendChild(row);
            }
            return row;
        };

        const removeNoResultsRow = () => {
            tbody.querySelector('tr[data-search-no-results="true"]')?.remove();
        };

        for (const row of rows) {
            if (row.dataset && row.dataset.searchNoResults === 'true') continue;
            const txt = (row.textContent || '').toLowerCase();
            const show = !query || txt.includes(query);
            row.style.display = show ? '' : 'none';
            if (show) visible += 1;
        }

        if (query && rows.length > 0 && visible === 0) {
            ensureNoResultsRow().style.display = '';
        } else {
            removeNoResultsRow();
        }
    }

    switchUploadMethod(method) {
        // Update tab active states
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-method') === method) {
                tab.classList.add('active');
            }
        });

        // Show/hide corresponding content
        document.querySelectorAll('.method-content').forEach(content => {
            content.classList.remove('active');
        });

        const contentMap = {
            'upload': 'uploadForm',
            'spotify': 'spotifyForm',
            'external': 'externalForm'
        };

        const targetContent = document.getElementById(contentMap[method]);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        // Reset external form when switching away
        if (method !== 'external') {
            this.resetExternalForm();
        }
    }

    handlePlatformSelection(platform) {
        const sections = ['searchSection', 'urlSection', 'titleSection', 'detailsSection', 'actionsSection'];

        // Update platform option styling
        document.querySelectorAll('.platform-option').forEach(option => {
            option.classList.remove('selected');
        });
        const selectedOption = document.querySelector(`input[name="platform"][value="${platform}"]`)?.closest('.platform-option');
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }

        if (platform) {
            // Show all form sections
            sections.forEach(sectionId => {
                const section = document.getElementById(sectionId);
                if (section) {
                    section.classList.remove('hidden');
                }
            });

            // Update placeholder based on platform
            const urlInput = document.getElementById('externalUrl');
            if (urlInput) {
                const platformNames = {
                    'youtube': 'YouTube',
                    'apple-music': 'Apple Music',
                    'soundcloud': 'SoundCloud',
                    'other': 'the selected platform'
                };
                urlInput.placeholder = `Paste track URL from ${platformNames[platform] || 'the selected platform'}`;
            }

            this.showNotification(`${platform === 'youtube' ? 'YouTube' : platform === 'apple-music' ? 'Apple Music' : platform === 'soundcloud' ? 'SoundCloud' : platform} selected. You can now search or paste a URL.`, 'info');
        } else {
            // Hide all form sections
            sections.forEach(sectionId => {
                const section = document.getElementById(sectionId);
                if (section) {
                    section.classList.add('hidden');
                }
            });
        }

        // Ensure the external artist dropdown is populated when this method is active.
        this.populateExternalArtistSelect().catch(console.error);
    }

    resetExternalForm() {
        // Clear platform selection
        document.querySelectorAll('input[name="platform"]').forEach(radio => {
            radio.checked = false;
        });

        // Hide form sections
        const sections = ['searchSection', 'urlSection', 'titleSection', 'detailsSection', 'actionsSection'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.add('hidden');
            }
        });

        // Clear form values
        const form = document.getElementById('externalTrackForm');
        if (form) {
            form.reset();
        }

        // Clear search results
        const resultsContainer = document.getElementById('externalResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }

        this.externalExtractedArtistName = '';
    }

    setupBasicMusicManagement() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.method-tab')) {
                const tab = e.target.closest('.method-tab');
                const method = tab.getAttribute('data-method');
                this.switchUploadMethod(method);
            }
        });

        const uploadArtworkBtn = document.getElementById('uploadArtworkBtn');
        const artworkInput = document.getElementById('trackArtwork');
        const artworkPreview = document.getElementById('artworkPreview');

        if (uploadArtworkBtn && artworkInput) {
            uploadArtworkBtn.addEventListener('click', () => {
                artworkInput.click();
            });
        }

        if (artworkInput && artworkPreview) {
            artworkInput.addEventListener('change', () => {
                const f = artworkInput.files && artworkInput.files[0];
                if (!f) return;
                const url = URL.createObjectURL(f);
                artworkPreview.classList.add('has-image');
                artworkPreview.style.backgroundImage = `url('${url}')`;
            });
        }
    }

    setupSpotifyImport() {
        const searchSpotifyBtn = document.getElementById('searchSpotify');
        const importSpotifyBtn = document.getElementById('importSpotify');
        const cancelSpotifyBtn = document.getElementById('cancelSpotify');
        const spotifyUrlInput = document.getElementById('spotifyUrl');
        const spotifySearchInput = document.getElementById('spotifySearch');
        const spotifyResults = document.getElementById('spotifyResults');

        this.selectedSpotifyTrack = null;

        // Search Spotify
        if (searchSpotifyBtn) {
            searchSpotifyBtn.addEventListener('click', () => this.searchSpotify());
        }

        // Search on Enter key
        if (spotifySearchInput) {
            spotifySearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.searchSpotify();
                }
            });
        }

        // Import selected track
        if (importSpotifyBtn) {
            importSpotifyBtn.addEventListener('click', () => this.importSpotifyTrack());
        }

        // Cancel
        if (cancelSpotifyBtn) {
            cancelSpotifyBtn.addEventListener('click', () => {
                this.switchUploadMethod('upload');
            });
        }

        // Parse URL when pasted - with clipboard API support
        if (spotifyUrlInput) {
            // Handle paste event with clipboard API
            spotifyUrlInput.addEventListener('paste', async (e) => {
                // Let the default paste happen first
                setTimeout(async () => {
                    const url = spotifyUrlInput.value.trim();
                    if (url && url.includes('spotify.com/track/')) {
                        await this.fetchSpotifyTrackFromUrl(url);
                    }
                }, 100);
            });

            // Also handle change event as fallback
            spotifyUrlInput.addEventListener('change', () => {
                const url = spotifyUrlInput.value.trim();
                if (url && url.includes('spotify.com/track/')) {
                    this.fetchSpotifyTrackFromUrl(url);
                }
            });

            // Handle input event for real-time detection
            spotifyUrlInput.addEventListener('input', () => {
                const url = spotifyUrlInput.value.trim();
                if (url && url.includes('spotify.com/track/')) {
                    // Debounce to avoid multiple calls
                    clearTimeout(this.spotifyUrlDebounce);
                    this.spotifyUrlDebounce = setTimeout(() => {
                        this.fetchSpotifyTrackFromUrl(url);
                    }, 500);
                }
            });
        }
    }

    async searchSpotify() {
        const searchInput = document.getElementById('spotifySearch');
        const resultsContainer = document.getElementById('spotifyResults');
        const query = searchInput?.value?.trim();

        if (!query) {
            this.showNotification('Please enter a search query', 'warning');
            return;
        }

        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Searching web for Spotify links...</div>';
            resultsContainer.classList.add('show');
        }

        try {
            // First check if it's a direct Spotify URL
            const trackId = this.extractSpotifyId(query);
            
            if (trackId) {
                // Direct URL was entered
                await this.fetchSpotifyTrackFromUrl(query);
                return;
            }

            // Otherwise, search the web for Spotify links
            await this.searchWebForSpotifyLinks(query);
        } catch (error) {
            console.error('Spotify search error:', error);
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="spotify-error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Search failed. Please paste a Spotify URL directly.</p>
                        <p class="text-muted">Go to Spotify, find your track, copy the URL, and paste it in the "Spotify Track URL" field above.</p>
                    </div>
                `;
            }
        }
    }

    async searchWebForSpotifyLinks(query) {
        const resultsContainer = document.getElementById('spotifyResults');
        
        try {
            // Try multiple search queries to find more related songs
            const searchQueries = [
                `${query} site:open.spotify.com/track`,
                `"${query}" site:open.spotify.com/track`,
                `${query.replace(/\s+/g, ' ')} spotify`
            ];
            
            let allResults = [];
            
            for (const searchQuery of searchQueries) {
                const encodedQuery = encodeURIComponent(searchQuery);
                const searchUrl = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&pretty=1`;
                
                try {
                    const response = await fetch(searchUrl);
                    const data = await response.json();
                    
                    // Extract Spotify URLs from results
                    const results = this.extractSpotifyUrlsFromResults(data, query);
                    allResults = allResults.concat(results);
                } catch (e) {
                    console.log('Search query failed:', searchQuery, e);
                }
            }
            
            // Remove duplicates and limit results
            const uniqueResults = [];
            const seenUrls = new Set();
            for (const result of allResults) {
                if (!seenUrls.has(result.url)) {
                    seenUrls.add(result.url);
                    uniqueResults.push(result);
                }
            }
            
            const spotifyResults = uniqueResults.slice(0, 10); // Show up to 10 results
            
            if (spotifyResults.length > 0) {
                // Display found Spotify links
                resultsContainer.innerHTML = `
                    <div class="spotify-search-info">
                        <p><i class="fas fa-check-circle" style="color: #1DB954;"></i> Found ${spotifyResults.length} result(s) on Spotify for "${query}":</p>
                        <p class="text-muted">Click on a result to import it</p>
                    </div>
                    ${spotifyResults.map(result => `
                        <div class="spotify-track" onclick="adminPanel.selectSpotifyResult('${result.url}')">
                            <div class="spotify-track-info">
                                <div class="spotify-track-name">${result.title}</div>
                                <div class="spotify-track-url">
                                    <i class="fab fa-spotify"></i> Click to select
                                </div>
                            </div>
                        </div>
                    `).join('')}
                `;
            } else {
                // No results found - provide direct search link to Spotify
                const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
                resultsContainer.innerHTML = `
                    <div class="spotify-search-info">
                        <p><i class="fas fa-info-circle"></i> No direct Spotify links found for "${query}"</p>
                        <p class="text-muted">Search directly on Spotify:</p>
                        <div class="spotify-track" onclick="window.open('${spotifySearchUrl}', '_blank')">
                            <div class="spotify-track-info">
                                <i class="fab fa-spotify" style="font-size: 24px; color: #1DB954;"></i>
                                <div class="spotify-track-details">
                                    <div class="spotify-track-name">Search "${query}" on Spotify</div>
                                    <div class="spotify-track-url">
                                        <i class="fas fa-external-link-alt"></i> Opens in new tab
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p class="text-muted" style="margin-top: 12px;">After finding your track, copy the URL and paste it in the "Spotify Track URL" field above.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Web search error:', error);
            // Fallback to direct search link
            const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
            resultsContainer.innerHTML = `
                <div class="spotify-search-info">
                    <p><i class="fas fa-info-circle"></i> Web search unavailable</p>
                    <p class="text-muted">Search directly on Spotify:</p>
                    <div class="spotify-track" onclick="window.open('${spotifySearchUrl}', '_blank')">
                        <div class="spotify-track-info">
                            <i class="fab fa-spotify" style="font-size: 24px; color: #1DB954;"></i>
                            <div class="spotify-track-details">
                                <div class="spotify-track-name">Search "${query}" on Spotify</div>
                                <div class="spotify-track-url">
                                    <i class="fas fa-external-link-alt"></i> Opens in new tab
                                </div>
                            </div>
                        </div>
                    </div>
                    <p class="text-muted" style="margin-top: 12px;">After finding your track, copy the URL and paste it in the "Spotify Track URL" field above.</p>
                </div>
            `;
        }
    }

    extractSpotifyUrlsFromResults(data, query) {
        const results = [];
        
        // Try to extract from RelatedTopics
        if (data.RelatedTopics) {
            for (const topic of data.RelatedTopics) {
                if (topic.FirstURL && topic.FirstURL.includes('open.spotify.com/track')) {
                    const url = topic.FirstURL;
                    const title = topic.Text || topic.Result || `Track from Spotify`;
                    results.push({ url, title: this.cleanTitle(title, query) });
                }
            }
        }
        
        // Try to extract from AbstractURL
        if (data.AbstractURL && data.AbstractURL.includes('open.spotify.com/track')) {
            results.push({
                url: data.AbstractURL,
                title: data.Abstract || data.Heading || `Track from Spotify`
            });
        }
        
        // Return unique results only
        const uniqueResults = [];
        const seenUrls = new Set();
        for (const result of results) {
            if (!seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                uniqueResults.push(result);
            }
        }
        
        return uniqueResults.slice(0, 5); // Limit to 5 results
    }

    cleanTitle(title, query) {
        // Clean up the title from search results
        if (!title) return query;
        // Remove common prefixes/suffixes
        return title
            .replace(/^.*?Spotify[:\s-]*/i, '')
            .replace(/\s*-\s*Open\.Spotify\.com.*$/i, '')
            .trim()
            .substring(0, 60) || query;
    }

    async selectSpotifyResult(url) {
        // Fetch the selected Spotify track
        await this.fetchSpotifyTrackFromUrl(url);
    }

    extractSpotifyId(urlOrId) {
        // Extract Spotify track ID from URL
        const match = urlOrId.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    async fetchSpotifyTrackFromUrl(url) {
        const resultsContainer = document.getElementById('spotifyResults');
        const trackId = this.extractSpotifyId(url);

        if (!trackId) {
            this.showNotification('Invalid Spotify URL. Please use a track URL.', 'error');
            return;
        }

        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Fetching track info...</div>';
            resultsContainer.classList.add('show');
        }

        try {
            // Try multiple methods to fetch Spotify track data
            let data = null;
            let lastError = null;

            // Method 1: Direct oEmbed API
            try {
                const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    data = await response.json();
                }
            } catch (e) {
                lastError = e;
                console.log('Direct oEmbed failed, trying CORS proxy...');
            }

            // Method 2: Try with CORS proxy if direct fails
            if (!data) {
                try {
                    const corsProxies = [
                        'https://api.allorigins.win/raw?url=',
                        'https://corsproxy.io/?'
                    ];
                    
                    for (const proxy of corsProxies) {
                        try {
                            const oembedUrl = `${proxy}${encodeURIComponent(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)}`;
                            const response = await fetch(oembedUrl);
                            if (response.ok) {
                                data = await response.json();
                                break;
                            }
                        } catch (e) {
                            console.log('CORS proxy failed:', e);
                        }
                    }
                } catch (e) {
                    console.log('CORS proxy method failed:', e);
                }
            }

            // Method 3: Fallback - extract info from URL pattern
            if (!data) {
                console.log('Using fallback method - minimal info from URL');
                data = {
                    title: 'Spotify Track',
                    author: 'Unknown Artist',
                    thumbnail_url: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
                    html: ''
                };
            }

            // Store the fetched data and try to get additional info from Spotify page
            this.selectedSpotifyTrack = {
                title: data.title || 'Unknown Track',
                artist: data.author || 'Unknown Artist',
                artwork: data.thumbnail_url || '',
                url: url,
                trackId: trackId
            };

            // Try to fetch additional metadata (duration, release date) from Spotify page
            await this.fetchSpotifyMetadata(trackId);

            // Display the fetched data
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="spotify-track-selected">
                        <div class="spotify-track-info">
                            ${this.selectedSpotifyTrack.artwork ? `<img src="${this.selectedSpotifyTrack.artwork}" alt="Artwork" class="spotify-artwork">` : ''}
                            <div class="spotify-track-details">
                                <div class="spotify-track-name">${this.selectedSpotifyTrack.title}</div>
                                <div class="spotify-track-artist">${this.selectedSpotifyTrack.artist}</div>
                                ${this.selectedSpotifyTrack.duration ? `<div class="spotify-track-duration">Duration: ${this.selectedSpotifyTrack.duration}</div>` : ''}
                                ${this.selectedSpotifyTrack.releaseDate ? `<div class="spotify-track-release">Release: ${this.selectedSpotifyTrack.releaseDate}</div>` : ''}
                            </div>
                        </div>
                        <div class="spotify-import-actions">
                            <button type="button" class="btn btn-primary" id="confirmImportBtn">Import Track</button>
                        </div>
                    </div>
                `;

                // Add click handler for confirm import
                document.getElementById('confirmImportBtn')?.addEventListener('click', () => {
                    this.importSpotifyTrack();
                });
            }
        } catch (error) {
            console.error('Error fetching Spotify track:', error);
            this.showNotification('Error fetching track: ' + error.message, 'error');
        } finally {
            if (resultsContainer) {
                resultsContainer.classList.remove('show');
            }
        }
    }

    async fetchSpotifyMetadata(trackId) {
        try {
            // Try to scrape the Spotify open page for duration and release date
            const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
            
            // Use a CORS proxy to fetch the page
            const corsProxies = [
                'https://api.allorigins.win/raw?url=',
                'https://corsproxy.io/?'
            ];
            
            for (const proxy of corsProxies) {
                try {
                    const response = await fetch(`${proxy}${encodeURIComponent(spotifyUrl)}`);
                    if (response.ok) {
                        const html = await response.text();
                        
                        // Try to extract duration from the page
                        const durationMatch = html.match(/"duration_ms":(\d+)/);
                        if (durationMatch) {
                            const durationMs = parseInt(durationMatch[1]);
                            const minutes = Math.floor(durationMs / 60000);
                            const seconds = Math.floor((durationMs % 60000) / 1000);
                            this.selectedSpotifyTrack.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        }

                        // Try to extract release date from the page
                        const releaseDateMatch = html.match(/"release_date":"([^"]+)"/);
                        if (releaseDateMatch) {
                            this.selectedSpotifyTrack.releaseDate = releaseDateMatch[1];
                        }

                        // If we found data, break
                        if (this.selectedSpotifyTrack.duration || this.selectedSpotifyTrack.releaseDate) {
                            break;
                        }
                    }
                } catch (e) {
                    console.log('Failed to fetch metadata with proxy:', e);
                }
            }
        } catch (error) {
            console.log('Could not fetch additional metadata:', error);
        }
    }

    async importSpotifyTrack() {
        if (!this.selectedSpotifyTrack) {
            this.showNotification('No Spotify track selected', 'error');
            return;
        }

        // Populate the form with Spotify data
        const titleInput = document.getElementById('trackTitle');
        const artistInput = document.getElementById('trackArtist');
        const genreInput = document.getElementById('trackGenre');
        const durationInput = document.getElementById('trackDuration');
        const releaseDateInput = document.getElementById('releaseDate');
        const descriptionInput = document.getElementById('trackDescription');
        const artworkPreview = document.getElementById('artworkPreview');
        const spotifyUrlInput = document.getElementById('spotifyUrl');

        // Ensure hidden input for Spotify artwork URL exists
        let spotifyArtworkInput = document.getElementById('spotifyArtworkUrl');
        if (!spotifyArtworkInput) {
            spotifyArtworkInput = document.createElement('input');
            spotifyArtworkInput.type = 'hidden';
            spotifyArtworkInput.id = 'spotifyArtworkUrl';
            spotifyArtworkInput.name = 'spotifyArtworkUrl';
            document.getElementById('audioUploadForm')?.appendChild(spotifyArtworkInput);
        }

        if (titleInput) titleInput.value = this.selectedSpotifyTrack.title;
        
        // Try to find matching artist or set to add new
        if (artistInput) {
            try {
                const artists = await window.fetchArtists();
                const spotifyArtist = String(this.selectedSpotifyTrack.artist || '').toLowerCase();
                const matchingArtist = (artists || []).find(a => String(a.name || '').toLowerCase() === spotifyArtist);
                artistInput.value = matchingArtist ? matchingArtist.id : '__add_new__';
            } catch (_) {
                artistInput.value = '__add_new__';
            }

            if (artistInput.value === '__add_new__') {
                artistInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        if (durationInput && this.selectedSpotifyTrack.duration) {
            durationInput.value = this.selectedSpotifyTrack.duration;
        }

        if (releaseDateInput && this.selectedSpotifyTrack.releaseDate) {
            releaseDateInput.value = this.selectedSpotifyTrack.releaseDate;
        } else if (releaseDateInput) {
            releaseDateInput.value = new Date().toISOString().split('T')[0];
        }

        if (descriptionInput) {
            descriptionInput.value = `Imported from Spotify: ${this.selectedSpotifyTrack.url}`;
        }

        // Set artwork preview and save URL for form submission
        if (artworkPreview && this.selectedSpotifyTrack.artwork) {
            artworkPreview.classList.add('has-image');
            artworkPreview.style.backgroundImage = `url('${this.selectedSpotifyTrack.artwork}')`;
            // Save the Spotify artwork URL to hidden input
            if (spotifyArtworkInput) {
                spotifyArtworkInput.value = this.selectedSpotifyTrack.artwork;
            }
        }

        // Move the Spotify link into the Audio Link field so it can be previewed/tested and saved.
        const audioUrlInput = document.getElementById('audioUrl');
        if (audioUrlInput && this.selectedSpotifyTrack.url) {
            audioUrlInput.value = this.selectedSpotifyTrack.url;
        }

        // Clear Spotify URL input
        if (spotifyUrlInput) spotifyUrlInput.value = '';

        // Hide Spotify results
        const resultsContainer = document.getElementById('spotifyResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('show');
        }

        // Switch to upload method to complete the import
        this.switchUploadMethod('upload');

        // Trigger the existing inline preview logic bound to #audioUrl (scripts/admin-firebase.js)
        if (audioUrlInput) {
            audioUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        this.showNotification('Track data imported from Spotify. Please add an audio link (URL) to complete.', 'success');
    }

    showSection(sectionId) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-target="${sectionId}"]`)?.classList.add('active');

        document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));

        const activeSection = document.getElementById(sectionId);
        if (!activeSection) {
            console.error('Section not found:', sectionId);
            return;
        }
        activeSection.classList.add('active');

        this.updatePageTitle(sectionId);
        this.currentSection = sectionId;
        localStorage.setItem('admin:lastSection', sectionId);
        this.loadSectionData(sectionId);

        const searchInput = document.querySelector('.search-box input');
        if (searchInput && !searchInput.value) {
            this.applyTableSearch('');
        } else if (searchInput) {
            this.applyTableSearch(searchInput.value);
        }
    }

    updatePageTitle(sectionId) {
        const titles = {
            dashboard: 'Dashboard',
            payments: 'Payment Management',
            users: 'User Management',
            artists: 'Artist Management',
            tracks: 'Track Management',
            team: 'Team Management',
            'music-management': 'Music Management',
            projects: 'Projects',
            settings: 'Studio Settings',
            savings: 'Savings Goals',
            reports: 'Reports'
        };

        const subtitles = {
            dashboard: 'Welcome to your admin dashboard',
            payments: 'Manage and track all payments',
            users: 'View and manage app users',
            artists: 'Manage artist profiles and content',
            tracks: 'Manage music tracks and releases',
            team: 'Manage team members and their profiles',
            'music-management': 'Upload and manage music tracks',
            projects: 'Manage studio projects and deliverables',
            settings: 'Configure studio settings and pricing',
            savings: 'Track and manage your savings goals',
            reports: 'Generate and view financial reports'
        };

        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');

        if (pageTitle) pageTitle.textContent = titles[sectionId] || 'Admin Panel';
        if (pageSubtitle) pageSubtitle.textContent = subtitles[sectionId] || 'Manage your studio operations';
    }

    async loadSectionData(sectionId) {
        console.log('Loading section data:', sectionId);
        try {
            switch (sectionId) {
                case 'dashboard':
                    await this.renderDashboard();
                    break;
                case 'users':
                    await this.loadUsers();
                    break;
                case 'artists':
                    await this.loadArtists();
                    break;
                case 'tracks':
                    await this.loadTracks();
                    break;
                case 'team':
                    await this.loadTeam();
                    break;
                case 'music-management':
                    await this.loadArtistsForSelect();
                    break;
                case 'projects':
                    break;
                case 'payments':
                    await this.loadPayments();
                    break;
                case 'settings':
                    await this.loadSettings();
                    break;
                case 'savings':
                    break;
                case 'reports':
                    break;
                case 'admin-management':
                    await this.loadAdminManagement();
                    break;
            }
        } catch (error) {
            console.error('Error loading section data:', error);
            this.showNotification('Error loading data: ' + error.message, 'error');
        }
    }

    async renderDashboard() {
        console.log('Rendering dashboard...');

        const artists = await window.fetchArtists();
        const tracks = await window.fetchTracks();
        const payments = await window.fetchPayments();

        const totalStreams = tracks.reduce((sum, track) => sum + (track.streams || 0), 0);
        const totalRevenue = Math.round(totalStreams * 0.003);
        const publishedTracks = tracks.filter(t => t.status === 'published');
        const pendingPayments = payments.filter(p => p.status === 'pending').length;

        const totalRevenueEl = document.getElementById('totalRevenue');
        const totalArtistsEl = document.getElementById('totalArtists');
        const activeProjectsEl = document.getElementById('activeProjects');
        const pendingPaymentsEl = document.getElementById('pendingPayments');

        const totalTracksValueEl = document.getElementById('totalTracksValue');
        const streamsValueEl = document.getElementById('streamsValue');
        const bookingsValueEl = document.getElementById('bookingsValue');
        const ratingValueEl = document.getElementById('ratingValue');

        if (totalRevenueEl) totalRevenueEl.textContent = `UGX ${this.formatNumber(totalRevenue)}`;
        if (totalArtistsEl) totalArtistsEl.textContent = artists.length;
        if (activeProjectsEl) activeProjectsEl.textContent = publishedTracks.length;
        if (pendingPaymentsEl) pendingPaymentsEl.textContent = pendingPayments;

        // Update quick stats
        if (totalTracksValueEl) totalTracksValueEl.textContent = tracks.length;
        if (streamsValueEl) streamsValueEl.textContent = this.formatNumber(totalStreams);
        if (bookingsValueEl) bookingsValueEl.textContent = '0'; // TODO: Implement bookings tracking
        if (ratingValueEl) ratingValueEl.textContent = 'N/A'; // TODO: Implement rating system
    }

    async loadArtists() {
        console.log('Loading artists...');
        const container = document.getElementById('artistsTable');
        if (!container) {
            console.error('Artists table container not found');
            return;
        }

        const artists = await window.fetchArtists();
        const tracks = await window.fetchTracks();

        if (artists.length === 0) {
            container.innerHTML = '<tr><td colspan="7" class="text-center">No artists found</td></tr>';
            return;
        }

        // Calculate stats for each artist
        const statsByArtist = new Map();
        for (const t of tracks || []) {
            const artistId = String(t.artist || '');
            if (!artistId) continue;
            if (!statsByArtist.has(artistId)) statsByArtist.set(artistId, { tracks: 0, streams: 0 });
            const s = statsByArtist.get(artistId);
            s.tracks += 1;
            s.streams += Number(t.streams || 0);
        }

        container.innerHTML = artists.map(artist => {
            const stats = statsByArtist.get(artist.id) || { tracks: 0, streams: 0 };
            const since = artist.createdAt && artist.createdAt.toDate ? String(artist.createdAt.toDate().getFullYear()) : artist.since || '';

            return `
                <tr>
                    <td>
                        <div class="artist-cell">
                            <img src="${artist.image}" alt="${artist.name}" class="artist-avatar">
                            <span>${artist.name}</span>
                        </div>
                    </td>
                    <td>${artist.genre}</td>
                    <td>${stats.tracks}</td>
                    <td>${this.formatNumber(stats.streams)}</td>
                    <td>${since}</td>
                    <td><span class="status-badge status-${artist.status}">${artist.status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary btn-sm js-edit-artist" type="button" data-artist-id="${artist.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-secondary btn-sm js-view-artist" type="button" data-artist-id="${artist.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-danger btn-sm js-delete-artist" type="button" data-artist-id="${artist.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (!container.dataset.actionsBound) {
            container.dataset.actionsBound = 'true';
            container.addEventListener('click', async (e) => {
                const editBtn = e.target.closest('.js-edit-artist');
                const viewBtn = e.target.closest('.js-view-artist');
                const delBtn = e.target.closest('.js-delete-artist');

                const artistId = editBtn?.dataset?.artistId || viewBtn?.dataset?.artistId || delBtn?.dataset?.artistId;
                if (!artistId) return;

                try {
                    if (editBtn) await this.editArtist(artistId);
                    if (viewBtn) await this.viewArtist(artistId);
                    if (delBtn) await this.deleteArtist(artistId);
                } catch (error) {
                    console.error('Artist action failed:', error);
                    this.showNotification('Action failed: ' + (error?.message || String(error)), 'error');
                }
            });
        }
    }

    async loadTracks() {
        console.log('Loading tracks...');
        const container = document.getElementById('tracksTable');
        if (!container) {
            console.error('Tracks table container not found');
            return;
        }

        const tracks = await window.fetchTracks();
        const artists = await window.fetchArtists();

        if (tracks.length === 0) {
            container.innerHTML = '<tr><td colspan="7" class="text-center">No tracks found</td></tr>';
            return;
        }

        // Create artist lookup map
        const artistMap = new Map();
        for (const a of artists || []) {
            artistMap.set(a.id, a.name || 'Unknown Artist');
        }

        container.innerHTML = tracks.map(track => {
            const artistName = artistMap.get(track.artist) || track.artistName || 'Unknown Artist';
            return `
                <tr>
                    <td>
                        <div class="track-cell">
                            <img src="${track.artwork}" alt="${track.title}" class="track-artwork-small">
                            <span>${track.title}</span>
                        </div>
                    </td>
                    <td>${artistName}</td>
                    <td>${track.genre}</td>
                    <td>${this.formatNumber(track.streams)}</td>
                    <td>${track.duration}</td>
                    <td><span class="status-badge status-${track.status}">${track.status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary btn-sm js-edit-track" type="button" data-track-id="${track.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-secondary btn-sm js-view-track" type="button" data-track-id="${track.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-danger btn-sm js-delete-track" type="button" data-track-id="${track.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (!container.dataset.actionsBound) {
            container.dataset.actionsBound = 'true';
            container.addEventListener('click', async (e) => {
                const editBtn = e.target.closest('.js-edit-track');
                const viewBtn = e.target.closest('.js-view-track');
                const delBtn = e.target.closest('.js-delete-track');

                const trackId = editBtn?.dataset?.trackId || viewBtn?.dataset?.trackId || delBtn?.dataset?.trackId;
                if (!trackId) return;

                try {
                    if (editBtn) await this.editTrack(trackId);
                    if (viewBtn) await this.viewTrack(trackId);
                    if (delBtn) await this.deleteTrack(trackId);
                } catch (error) {
                    console.error('Track action failed:', error);
                    this.showNotification('Action failed: ' + (error?.message || String(error)), 'error');
                }
            });
        }
    }

    async loadArtistsForSelect() {
        const artistSelect = document.getElementById('trackArtist');
        if (!artistSelect) return;
        
        const artists = await window.fetchArtists();
        const seenIds = new Set();
        const seenNames = new Set();

        const normalized = (artists || [])
            .filter((a) => a && a.id)
            .map((a) => ({
                id: String(a.id),
                name: String(a.name || ''),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const optionsHtml = normalized
            .filter((a) => {
                const keyName = a.name.trim().toLowerCase();
                if (seenIds.has(a.id)) return false;
                if (keyName && seenNames.has(keyName)) return false;
                seenIds.add(a.id);
                if (keyName) seenNames.add(keyName);
                return true;
            })
            .map((a) => `<option value="${a.id}">${a.name || a.id}</option>`)
            .join('');

        // Preserve the Firestore-powered artist select behavior, including "+ Add new artist..."
        // (admin-firebase.js relies on the special __add_new__ option).
        artistSelect.innerHTML = '<option value="">Select Artist</option>' +
            '<option value="__collab__">Collaboration (multiple artists)</option>' +
            '<option value="__add_new__">+ Add new artist...</option>' +
            optionsHtml;
    }

    async loadPayments() {
        const table = document.getElementById('paymentsTable');
        if (!table) return;
        
        // Load payments from Firestore
        const { db } = await import('../scripts/firebase-init.js');
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
        
        try {
            const paymentsQuery = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(paymentsQuery);
            
            const payments = [];
            snapshot.forEach(doc => {
                payments.push({ id: doc.id, ...doc.data() });
            });
            
            if (payments.length === 0) {
                table.innerHTML = '<tr><td colspan="9" class="text-center">No payments found</td></tr>';
                return;
            }
            
            table.innerHTML = payments.map(payment => `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="user-name">${payment.userName || 'Unknown'}</div>
                            <div class="user-email">${payment.userEmail || ''}</div>
                        </div>
                    </td>
                    <td>${payment.plan || 'Unknown'}</td>
                    <td>UGX ${this.formatNumber(payment.amount || 0)}</td>
                    <td>${payment.paymentMethod || 'Unknown'}</td>
                    <td>${payment.phoneNumber || 'N/A'}</td>
                    <td><code>${payment.transactionId || 'N/A'}</code></td>
                    <td>${new Date(payment.createdAt).toLocaleDateString()}</td>
                    <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                    <td>
                        ${payment.status === 'pending' ? `
                            <button class="btn btn-success btn-sm" onclick="adminPanel.verifyPayment('${payment.id}')" title="Verify">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="adminPanel.rejectPayment('${payment.id}')" title="Reject">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : `
                            <button class="btn btn-secondary btn-sm" onclick="adminPanel.viewPayment('${payment.id}')" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                        `}
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading payments from Firestore:', error);
            // Fallback to localStorage
            const payments = await window.fetchPayments();
            
            if (payments.length === 0) {
                table.innerHTML = '<tr><td colspan="9" class="text-center">No payments found</td></tr>';
                return;
            }
            
            table.innerHTML = payments.map(payment => `
                <tr>
                    <td>${payment.fullName || payment.artist || 'Unknown'}</td>
                    <td>${payment.billingCycle || 'Membership'}</td>
                    <td>UGX ${this.formatNumber(payment.amount || 0)}</td>
                    <td>N/A</td>
                    <td>N/A</td>
                    <td>N/A</td>
                    <td>${new Date(payment.timestamp).toLocaleDateString()}</td>
                    <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="adminPanel.viewPayment('${payment.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    async loadUsers() {
        console.log('Loading users...');
        const container = document.getElementById('usersTable');
        if (!container) {
            console.error('Users table container not found');
            return;
        }

        try {
            // Load users from Firestore
            const { db } = await import('../scripts/firebase-init.js');
            const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            
            const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(usersQuery);
            
            const users = [];
            snapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
            
            if (users.length === 0) {
                container.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
                return;
            }
            
            container.innerHTML = users.map(user => {
                const displayName = user.displayName || user.email || 'Anonymous User';
                const email = user.email || '';
                const plan = user.membership?.plan || 'Free';
                const memberSince = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 
                                 user.memberSince || 'Unknown';
                const status = user.status || 'active';
                
                return `
                    <tr>
                        <td>
                            <div class="user-cell">
                                <div class="user-name">${displayName}</div>
                                <div class="user-email">${email}</div>
                            </div>
                        </td>
                        <td><span class="plan-badge plan-${plan.toLowerCase()}">${plan}</span></td>
                        <td>${memberSince}</td>
                        <td><span class="status-badge status-${status}">${status}</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-primary btn-sm" onclick="adminPanel.viewUser('${user.id}')" title="View">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="adminPanel.editUser('${user.id}')" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                ${status === 'active' ? `
                                    <button class="btn btn-warning btn-sm" onclick="adminPanel.suspendUser('${user.id}')" title="Suspend">
                                        <i class="fas fa-ban"></i>
                                    </button>
                                ` : `
                                    <button class="btn btn-success btn-sm" onclick="adminPanel.activateUser('${user.id}')" title="Activate">
                                        <i class="fas fa-check"></i>
                                    </button>
                                `}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Error loading users from Firestore:', error);
            container.innerHTML = '<tr><td colspan="5" class="text-center">Failed to load users</td></tr>';
        }
    }

    async verifyPayment(paymentId) {
        if (!confirm('Are you sure you want to verify this payment? This will activate the user\'s membership.')) {
            return;
        }

        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            
            const reviewer = (window.adminAuth && typeof window.adminAuth.getCurrentUser === 'function')
                ? window.adminAuth.getCurrentUser()
                : null;
            const reviewedBy = reviewer?.username || reviewer?.email || 'admin';
            
            const paymentRef = doc(db, 'payments', paymentId);
            await updateDoc(paymentRef, {
                status: 'verified',
                reviewedAt: new Date().toISOString(),
                reviewedBy,
                rejectionReason: null,
                updatedAt: new Date().toISOString()
            });

            this.showNotification('Payment verified successfully', 'success');
            this.loadPayments();
        } catch (error) {
            console.error('Error verifying payment:', error);
            this.showNotification('Error verifying payment', 'error');
        }
    }

    async rejectPayment(paymentId) {
        let memberName = '';
        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const snap = await getDoc(doc(db, 'payments', paymentId));
            if (snap.exists()) {
                const m = snap.data() || {};
                memberName = m.name || m.fullName || m.displayName || m.email || '';
            }
        } catch (_) {
            // ignore lookup failures; still allow delete
        }

        const label = memberName ? `"${memberName}"` : `ID ${paymentId}`;
        const msg = `Are you sure you want to reject this payment? This action cannot be undone.`;

        let ok = false;
        if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm(msg, 'Reject Payment', 'warning');
        } else {
            ok = confirm(msg);
        }
        if (ok) {
            try {
                const { db } = await import('../scripts/firebase-init.js');
                const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

                const reason = (prompt('Reason for rejecting this payment (required):') || '').trim();
                if (!reason) {
                    this.showNotification('Rejection reason is required.', 'error');
                    return;
                }

                const reviewer = (window.adminAuth && typeof window.adminAuth.getCurrentUser === 'function')
                    ? window.adminAuth.getCurrentUser()
                    : null;
                const reviewedBy = reviewer?.username || reviewer?.email || 'admin';
                
                const paymentRef = doc(db, 'payments', paymentId);
                await updateDoc(paymentRef, {
                    status: 'rejected',
                    rejectionReason: reason,
                    reviewedAt: new Date().toISOString(),
                    reviewedBy,
                    updatedAt: new Date().toISOString()
                });

                this.showNotification('Payment rejected', 'success');
                this.loadPayments();
            } catch (error) {
                console.error('Error rejecting payment:', error);
                this.showNotification('Error rejecting payment: ' + error.message, 'error');
            }
        }
    }

    async loadSettings() {
        const applyValue = (id, value) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'number') {
                const n = Number(value);
                el.value = Number.isFinite(n) ? String(n) : '';
                return;
            }
            el.value = value == null ? '' : String(value);
        };

        const populateFromConfig = (config) => {
            const c = config || window.studioConfig || {};

            applyValue('mtnNumber', c.payment?.mtn);
            applyValue('airtelNumber', c.payment?.airtel);
            applyValue('bankName', c.payment?.bank?.name);
            applyValue('bankAccount', c.payment?.bank?.account);
            applyValue('bankAccountName', c.payment?.bank?.accountName);
            applyValue('supportPhone', c.payment?.supportPhone);

            applyValue('weeklyPrice', c.plans?.weekly?.price);
            applyValue('weeklyDescription', c.plans?.weekly?.description);
            applyValue('monthlyPrice', c.plans?.monthly?.price);
            applyValue('monthlyDescription', c.plans?.monthly?.description);
            applyValue('yearlyPrice', c.plans?.yearly?.price);
            applyValue('yearlyDescription', c.plans?.yearly?.description);

            applyValue('productionPrice', c.services?.production);
            applyValue('mixingPrice', c.services?.mixing);
            applyValue('masteringPrice', c.services?.mastering);
            applyValue('vocalPrice', c.services?.vocal);
            applyValue('studioHourlyRate', c.services?.studioHourlyRate);
            applyValue('studioPackagePrice', c.services?.studioPackagePrice);
            applyValue('lessonHourlyRate', c.services?.lessonHourlyRate);
            applyValue('lessonPackagePrice', c.services?.lessonPackagePrice);
            applyValue('vocalLessonPrice', c.services?.vocalLessonPrice);
            applyValue('instrumentLessonPrice', c.services?.instrumentLessonPrice);
            applyValue('advancedLessonPrice', c.services?.advancedLessonPrice);
            applyValue('groupLessonPrice', c.services?.groupLessonPrice);
            applyValue('songwritingPrice', c.services?.songwriting);
            applyValue('restorationPrice', c.services?.restoration);
            applyValue('sessionMusicianMin', c.services?.sessionMusicianMin);
            applyValue('sessionMusicianMax', c.services?.sessionMusicianMax);

            applyValue('budgetStandard', c.budgetTiers?.standard);
            applyValue('budgetClassic', c.budgetTiers?.classic);
            applyValue('budgetPremium', c.budgetTiers?.premium);
            applyValue('budgetDeluxe', c.budgetTiers?.deluxe);

            applyValue('contactPhone', c.contact?.phone);
            applyValue('contactEmail', c.contact?.email);
            applyValue('contactLocation', c.contact?.location);

            applyValue('monthlySavings', c.planSavings?.monthly);
            applyValue('yearlySavings', c.planSavings?.yearly);

            applyValue('statProjects', c.about?.projects);
            applyValue('statArtists', c.about?.artists);
            applyValue('statStreams', c.about?.streams);

            applyValue('socialInstagram', c.social?.instagram);
            applyValue('socialYouTube', c.social?.youtube);
            applyValue('socialTikTok', c.social?.tiktok);
            applyValue('socialTwitter', c.social?.twitter);
            applyValue('socialSpotify', c.social?.spotify);
            applyValue('socialWhatsApp', c.social?.whatsapp);
        };

        const bindDirtyTracking = () => {
            if (this.settingsDirtyBound) return;
            this.settingsDirtyBound = true;
            const container = document.getElementById('settings');
            if (!container) return;
            container.addEventListener('input', (e) => {
                const t = e.target;
                if (!t) return;
                if (t.closest('form')) {
                    this.settingsDirty = true;
                }
            });
        };

        const bindSaveButton = () => {
            const btn = document.getElementById('saveSettings');
            if (!btn || btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';

            btn.addEventListener('click', async (e) => {
                e.preventDefault();

                const read = (id) => document.getElementById(id)?.value ?? '';
                const readNum = (id) => {
                    const v = String(read(id)).trim();
                    if (!v) return 0;
                    const n = Number(v);
                    return Number.isFinite(n) ? n : 0;
                };

                const base = window.studioConfig ? JSON.parse(JSON.stringify(window.studioConfig)) : {};
                base.payment = base.payment || {};
                base.payment.bank = base.payment.bank || {};
                base.plans = base.plans || { weekly: {}, monthly: {}, yearly: {} };
                base.plans.weekly = base.plans.weekly || {};
                base.plans.monthly = base.plans.monthly || {};
                base.plans.yearly = base.plans.yearly || {};
                base.services = base.services || {};
                base.budgetTiers = base.budgetTiers || {};
                base.contact = base.contact || {};
                base.social = base.social || {};
                base.about = base.about || {};
                base.planSavings = base.planSavings || {};

                base.payment.mtn = read('mtnNumber').trim();
                base.payment.airtel = read('airtelNumber').trim();
                base.payment.bank.name = read('bankName').trim();
                base.payment.bank.account = read('bankAccount').trim();
                base.payment.bank.accountName = read('bankAccountName').trim();
                base.payment.supportPhone = read('supportPhone').trim();

                base.plans.weekly.price = readNum('weeklyPrice');
                base.plans.weekly.description = read('weeklyDescription').trim();
                base.plans.monthly.price = readNum('monthlyPrice');
                base.plans.monthly.description = read('monthlyDescription').trim();
                base.plans.yearly.price = readNum('yearlyPrice');
                base.plans.yearly.description = read('yearlyDescription').trim();

                base.services.production = readNum('productionPrice');
                base.services.mixing = readNum('mixingPrice');
                base.services.mastering = readNum('masteringPrice');
                base.services.vocal = readNum('vocalPrice');
                base.services.studioHourlyRate = readNum('studioHourlyRate');
                base.services.studioPackagePrice = readNum('studioPackagePrice');
                base.services.lessonHourlyRate = readNum('lessonHourlyRate');
                base.services.lessonPackagePrice = readNum('lessonPackagePrice');
                base.services.vocalLessonPrice = readNum('vocalLessonPrice');
                base.services.instrumentLessonPrice = readNum('instrumentLessonPrice');
                base.services.advancedLessonPrice = readNum('advancedLessonPrice');
                base.services.groupLessonPrice = readNum('groupLessonPrice');
                base.services.songwriting = readNum('songwritingPrice');
                base.services.restoration = readNum('restorationPrice');
                base.services.sessionMusicianMin = readNum('sessionMusicianMin');
                base.services.sessionMusicianMax = readNum('sessionMusicianMax');

                base.budgetTiers.standard = readNum('budgetStandard');
                base.budgetTiers.classic = readNum('budgetClassic');
                base.budgetTiers.premium = readNum('budgetPremium');
                base.budgetTiers.deluxe = readNum('budgetDeluxe');

                base.contact.phone = read('contactPhone').trim();
                base.contact.email = read('contactEmail').trim();
                base.contact.location = read('contactLocation').trim();

                base.planSavings.monthly = read('monthlySavings').trim();
                base.planSavings.yearly = read('yearlySavings').trim();

                base.about.projects = read('statProjects').trim();
                base.about.artists = read('statArtists').trim();
                base.about.streams = read('statStreams').trim();

                base.social.instagram = read('socialInstagram').trim();
                base.social.youtube = read('socialYouTube').trim();
                base.social.tiktok = read('socialTikTok').trim();
                base.social.twitter = read('socialTwitter').trim();
                base.social.spotify = read('socialSpotify').trim();
                base.social.whatsapp = read('socialWhatsApp').trim();

                try {
                    const mod = await import('../scripts/config-loader.js');
                    const ok = await mod.saveSettings(base);
                    if (ok) {
                        window.studioConfig = base;
                        this.settingsDirty = false;
                        this.showNotification('Settings saved successfully!', 'success');
                    } else {
                        this.showNotification('Failed to save settings. Please try again.', 'error');
                    }
                } catch (err) {
                    console.error('Error saving settings:', err);
                    this.showNotification('Error saving settings: ' + (err?.message || String(err)), 'error');
                }
            });
        };

        bindDirtyTracking();
        bindSaveButton();

        const cfg = window.studioConfig;
        if (cfg) {
            populateFromConfig(cfg);
        }

        if (!window.__adminSettingsUpdatedBound) {
            window.__adminSettingsUpdatedBound = true;
            window.addEventListener('settingsUpdated', (e) => {
                if (this.currentSection !== 'settings') return;
                if (this.settingsDirty) return;
                populateFromConfig(e.detail);
            });
        }
    }

    async loadTeam() {
        console.log('Loading team members...');
        const table = document.getElementById('teamTable');
        if (!table) {
            console.error('Team table container not found');
            return;
        }

        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            
            const teamQuery = query(collection(db, 'team'), orderBy('name'));
            const querySnapshot = await getDocs(teamQuery);
            
            const teamMembers = [];
            querySnapshot.forEach((doc) => {
                teamMembers.push({ id: doc.id, ...doc.data() });
            });

            if (teamMembers.length === 0) {
                table.innerHTML = '<tr><td colspan="5" class="text-center">No team members found</td></tr>';
                return;
            }

            table.innerHTML = teamMembers.map(member => `
                <tr>
                    <td>
                        <div class="member-cell">
                            <img src="${member.image || 'https://via.placeholder.com/40'}" alt="${member.name}" class="member-avatar">
                            <div>
                                <strong>${member.name}</strong>
                                <small>${member.badge || ''}</small>
                            </div>
                        </div>
                    </td>
                    <td>${member.role}</td>
                    <td>${(member.skills || []).join(', ')}</td>
                    <td><span class="status-badge status-${member.status || 'active'}">${member.status || 'active'}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary" onclick="adminPanel.editTeamMember('${member.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger" onclick="adminPanel.deleteTeamMember('${member.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading team members:', error);
            table.innerHTML = '<tr><td colspan="5" class="text-center">Error loading team members</td></tr>';
        }
    }

    addNewTeamMember() {
        this.openTeamForm(null);
    }

    editTeamMember(memberId) {
        this.loadTeamMemberForEdit(memberId);
    }

    async loadTeamMemberForEdit(memberId) {
        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            
            const docRef = doc(db, 'team', memberId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const member = { id: docSnap.id, ...docSnap.data() };
                this.openTeamForm(member);
            } else {
                this.showNotification('Team member not found', 'error');
            }
        } catch (error) {
            console.error('Error loading team member:', error);
            this.showNotification('Error loading team member: ' + error.message, 'error');
        }
    }

    async deleteTeamMember(memberId) {
        let memberName = '';
        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

            const docRef = doc(db, 'team', memberId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const m = docSnap.data() || {};
                memberName = m.name || m.fullName || m.displayName || m.email || '';
            }
        } catch (_) {
            // ignore lookup failures; still allow delete
        }

        const label = memberName ? `"${memberName}"` : `ID ${memberId}`;
        const msg = `Are you sure you want to delete team member ${label}? This action cannot be undone.`;

        let ok = false;
        if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm(msg, 'Delete Team Member', 'warning');
        } else {
            ok = confirm(msg);
        }
        if (ok) {
            try {
                const { db } = await import('../scripts/firebase-init.js');
                const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
                await deleteDoc(doc(db, 'team', memberId));
                this.showNotification('Team member deleted successfully!', 'success');
                this.loadTeam();
            } catch (error) {
                console.error('Error deleting team member:', error);
                this.showNotification('Error deleting team member: ' + error.message, 'error');
            }
        }
    }

    async deleteArtist(artistId) {
        let artistName = '';
        try {
            const artists = await window.fetchArtists();
            const a = (artists || []).find(x => x.id === artistId);
            artistName = a?.name || '';
        } catch (_) {
            // ignore
        }

        const label = artistName ? `"${artistName}"` : `ID ${artistId}`;
        const msg = `Are you sure you want to delete artist ${label}? This action cannot be undone.`;

        let ok = false;
        if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm(msg, 'Delete Artist', 'warning');
        } else {
            ok = confirm(msg);
        }
        if (!ok) return;
        try {
            await window.deleteArtistFromFirestore(artistId);
            this.showNotification('Artist deleted successfully!', 'success');
            await this.loadArtists();
        } catch (error) {
            console.error('Error deleting artist:', error);
            this.showNotification('Failed to delete artist: ' + error.message, 'error');
        }
    }

    async editTrack(trackId) {
        try {
            const tracks = await window.fetchTracks();
            const track = tracks.find(t => t.id === trackId);
            if (!track) {
                this.showNotification('Track not found', 'error');
                return;
            }
            this.openTrackEditForm(track);
        } catch (error) {
            console.error('Error fetching track:', error);
            this.showNotification('Error loading track: ' + error.message, 'error');
        }
    }

    openTrackEditForm(track) {
        // Navigate to music-management section and populate form
        this.showSection('music-management');

        // Use longer delay to ensure section is visible and form is rendered
        const populateForm = async () => {
            const titleInput = document.getElementById('trackTitle');
            const artistInput = document.getElementById('trackArtist');
            const collaboratorsInput = document.getElementById('trackCollaborators');
            const genreInput = document.getElementById('trackGenre');
            const durationInput = document.getElementById('trackDuration');
            const releaseDateInput = document.getElementById('releaseDate');
            const descriptionInput = document.getElementById('trackDescription');
            const audioUrlInput = document.getElementById('audioUrl');
            const artworkPreview = document.getElementById('artworkPreview');

            if (titleInput) titleInput.value = track.title || '';

            // Try to match artist by name into the select; fall back to add-new.
            if (artistInput) {
                const selectedIds = Array.isArray(track.collaborators)
                    ? track.collaborators.map(x => String(x))
                    : [];

                // Collaboration tracks may not have a main artist saved.
                if (!track.artist && selectedIds.length >= 2) {
                    artistInput.value = '__collab__';
                    artistInput.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    try {
                        const artists = await window.fetchArtists();
                        const trackArtist = String(track.artist || '').toLowerCase();
                        const matchingArtist = (artists || []).find(a => String(a.name || '').toLowerCase() === trackArtist);
                        artistInput.value = matchingArtist ? matchingArtist.id : '__add_new__';
                    } catch (_) {
                        artistInput.value = '__add_new__';
                    }

                    if (artistInput.value === '__add_new__') {
                        artistInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }

            if (collaboratorsInput) {
                const selectedIds = Array.isArray(track.collaborators)
                    ? track.collaborators.map(x => String(x))
                    : [];

                try {
                    if (typeof window.populateCollaboratorsSelect === 'function') {
                        await window.populateCollaboratorsSelect(selectedIds);
                    } else {
                        const artists = await window.fetchArtists();
                        const normalized = (artists || [])
                            .filter((a) => a && a.id)
                            .map((a) => ({ id: String(a.id), name: String(a.name || '') }))
                            .sort((a, b) => a.name.localeCompare(b.name));

                        collaboratorsInput.innerHTML = normalized
                            .map((a) => `<option value="${a.id}">${a.name || a.id}</option>`)
                            .join('');

                        const selectedSet = new Set(selectedIds);
                        Array.from(collaboratorsInput.options).forEach((opt) => {
                            opt.selected = selectedSet.has(opt.value);
                        });
                    }
                } catch (_) {
                    // ignore
                }
            }

            if (genreInput) genreInput.value = track.genre || '';
            if (durationInput) durationInput.value = track.duration || '';
            if (releaseDateInput) releaseDateInput.value = track.releaseDate || '';
            if (descriptionInput) descriptionInput.value = track.description || '';

            // Populate audio URL and show link preview
            if (audioUrlInput) {
                const fromPlatformLinks = (() => {
                    const pl = track.platformLinks || {};
                    const candidates = [pl.audioUrl, pl.youtube, pl.spotify, pl.soundcloud, pl.appleMusic, pl.url, pl.link];
                    for (const c of candidates) {
                        if (typeof c === 'string' && c.trim()) return c.trim();
                    }
                    // Any string value
                    for (const v of Object.values(pl)) {
                        if (typeof v === 'string' && v.trim()) return v.trim();
                    }
                    return '';
                })();

                let existingUrl = track.audioUrl || track.audioLink || track.url || track.link || fromPlatformLinks || '';
                if (existingUrl && !/^https?:\/\//i.test(existingUrl)) {
                    existingUrl = `https://${existingUrl}`;
                }

                audioUrlInput.value = existingUrl;
                if (existingUrl) {
                    audioUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            if (track.artwork && artworkPreview) {
                artworkPreview.classList.add('has-image');
                artworkPreview.style.backgroundImage = `url('${track.artwork}')`;
            }

            // Set editing state
            this.editingItem = { type: 'track', id: track.id, data: track };

            // Change button text to indicate edit mode
            const submitBtn = document.querySelector('#audioUploadForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Track';
            }

            this.showNotification('Editing track: ' + track.title, 'info');
        };

        // Wait for section to be visible, then populate
        setTimeout(() => {
            populateForm().catch((err) => {
                console.error('Failed to populate track edit form:', err);
                this.showNotification('Failed to populate track form. Please try again.', 'error');
            });
        }, 500);
    }

    async viewTrack(trackId) {
        // View redirects to edit (same as edit track pattern)
        await this.editTrack(trackId);
    }

    async deleteTrack(trackId) {
        let trackTitle = '';
        try {
            const tracks = await window.fetchTracks();
            const t = (tracks || []).find(x => x.id === trackId);
            trackTitle = t?.title || '';
        } catch (_) {
            // ignore
        }

        const label = trackTitle ? `"${trackTitle}"` : `ID ${trackId}`;
        const msg = `Are you sure you want to delete track ${label}? This action cannot be undone.`;

        let ok = false;
        if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm(msg, 'Delete Track', 'warning');
        } else {
            ok = confirm(msg);
        }
        if (ok) {
            try {
                await window.deleteTrackFromFirestore(trackId);
                this.showNotification('Track deleted successfully!', 'success');
                this.loadTracks();
            } catch (error) {
                console.error('Error deleting track:', error);
                this.showNotification('Failed to delete track: ' + error.message, 'error');
            }
        }
    }

    addNewTrack() {
        this.showSection('music-management');
        this.resetUploadForm();
    }

    showLinkPreview(url) {
        const preview = document.getElementById("audioUrlPreview");
        const previewLink = document.getElementById("audioUrlPreviewLink");
        const status = document.getElementById("audioUrlStatus");
        if (!preview || !previewLink) return;

        try {
            new URL(url); // validate URL format
            previewLink.href = url;
            previewLink.textContent = url.length > 60 ? url.substring(0, 57) + "..." : url;
            preview.style.display = "block";

            if (status) {
                const isHttp = url.startsWith("http://") || url.startsWith("https://");
                status.textContent = isHttp ? "URL format looks valid" : "URL should start with http:// or https://";
                status.className = "link-preview-status " + (isHttp ? "valid" : "invalid");
            }
        } catch (e) {
            if (status) {
                status.textContent = "Invalid URL format";
                status.className = "link-preview-status invalid";
            }
            preview.style.display = "block";
            previewLink.textContent = url;
            previewLink.href = "#";
        }
    }

    hideLinkPreview() {
        const preview = document.getElementById("audioUrlPreview");
        if (preview) preview.style.display = "none";
    }


    resetUploadForm() {
        const form = document.getElementById('audioUploadForm');
        if (form) {
            form.reset();
        }
        
        // Reset artwork preview
        const artworkPreview = document.getElementById('artworkPreview');
        if (artworkPreview) {
            artworkPreview.classList.remove('has-image');
            artworkPreview.style.backgroundImage = '';
        }
        
        // Reset file info
        const fileInfo = document.getElementById('fileInfo');
        if (fileInfo) {
            fileInfo.classList.remove('show');
            fileInfo.textContent = '';
        }
        
        // Clear editing state
        this.editingItem = null;

        // Hide link preview
        this.hideLinkPreview();
        
        // Reset button text
        const submitBtn = document.querySelector('#audioUploadForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Track';
        }
        
        // Reload artists select
        this.loadArtistsForSelect();
    }

    async handleAudioUpload() {
        const title = document.getElementById('trackTitle').value.trim();
        const artist = document.getElementById('trackArtist').value;
        const genre = document.getElementById('trackGenre').value;
        const duration = document.getElementById('trackDuration').value;
        const releaseDate = document.getElementById('releaseDate').value;
        const description = document.getElementById('trackDescription').value;
        const audioUrlInput = document.getElementById('audioUrl')?.value?.trim() || '';
        const artworkFile = document.getElementById('trackArtwork').files[0];
        const spotifyArtworkUrl = document.getElementById('spotifyArtworkUrl')?.value;
        
        if (!title) {
            this.showNotification('Track title is required', 'error');
            return;
        }
        
        if (!artist) {
            this.showNotification('Please select an artist', 'error');
            return;
        }
        
        const isEdit = Boolean(this.editingItem && this.editingItem.id);
        if (!isEdit && !audioUrlInput) {
            this.showNotification('Please provide an audio link (URL).', 'error');
            return;
        }
        
        try {
            let artworkUrl = spotifyArtworkUrl || 'https://via.placeholder.com/300?text=Track';
            
            // Handle artwork upload
            if (artworkFile) {
                artworkUrl = await this.handleImageUpload(artworkFile);
            }

            const existingAudioUrl = this.editingItem?.data?.audioUrl || '';
            const audioUrl = audioUrlInput || existingAudioUrl;
            
            const trackData = {
                title,
                artist,
                genre,
                duration,
                releaseDate,
                description,
                artwork: artworkUrl,
                audioUrl,
                streams: 0,
                status: 'published'
            };
            
            if (this.editingItem && this.editingItem.id) {
                // Update existing track
                trackData.id = this.editingItem.id;
                trackData.streams = this.editingItem.data.streams;
                if (window.updateTrackInFirestore) {
                    await window.updateTrackInFirestore(this.editingItem.id, trackData);
                    this.showNotification('Track updated successfully!', 'success');
                } else {
                    this.showNotification('Firestore integration is not available. Please refresh the page.', 'error');
                    return;
                }
            } else {
                // Add new track
                if (window.saveTrackToFirestore) {
                    await window.saveTrackToFirestore(trackData);
                    this.showNotification('Track saved successfully!', 'success');
                } else {
                    this.showNotification('Firestore integration is not available. Please refresh the page.', 'error');
                    return;
                }
            }

            this.resetUploadForm();
            this.loadTracks();
        } catch (error) {
            console.error('Error adding external track:', error);
            this.showNotification('Error adding track: ' + error.message, 'error');
        }
    }

    async searchExternalPlatform() {
        const platform = document.querySelector('input[name="platform"]:checked')?.value;
        const searchInput = document.getElementById('externalSearch');
        const resultsContainer = document.getElementById('externalResults');
        const query = searchInput?.value?.trim();

        if (!platform) {
            this.showNotification('Please select a platform first', 'error');
            return;
        }

        if (!query) {
            this.showNotification('Please enter a search query', 'warning');
            return;
        }

        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Searching web for track links...</div>';
            resultsContainer.classList.add('show');
        }

        try {
            await this.searchWebForExternalLinks(query, platform);
        } catch (error) {
            console.error('External platform search error:', error);
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="spotify-error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Search failed. Please paste the track URL directly.</p>
                    </div>
                `;
            }
        }
    }

    async searchWebForExternalLinks(query, platform) {
        const resultsContainer = document.getElementById('externalResults');

        const platformDomains = {
            'youtube': 'youtube.com',
            'apple-music': 'music.apple.com',
            'soundcloud': 'soundcloud.com',
            'other': ''
        };

        const domain = platformDomains[platform] || '';
        const platformName = platform === 'apple-music' ? 'Apple Music' :
                            platform === 'soundcloud' ? 'SoundCloud' :
                            platform === 'youtube' ? 'YouTube' : 'External Platform';

        try {
            const searchQueries = domain
                ? [
                    `${query} site:${domain}`,
                    `"${query}" site:${domain}`,
                    `${query.replace(/\s+/g, ' ')} ${platformName}`
                ]
                : [
                    `${query} music`,
                    `"${query}" song`,
                    `${query} official`
                ];

            let allResults = [];

            for (const searchQuery of searchQueries) {
                const encodedQuery = encodeURIComponent(searchQuery);
                const searchUrl = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&pretty=1`;

                try {
                    const response = await fetch(searchUrl);
                    const data = await response.json();

                    const results = this.extractExternalUrlsFromResults(data, query, platform);
                    allResults = allResults.concat(results);
                } catch (e) {
                    console.log('Search query failed:', searchQuery, e);
                }
            }

            const uniqueResults = [];
            const seenUrls = new Set();
            for (const result of allResults) {
                if (!seenUrls.has(result.url)) {
                    seenUrls.add(result.url);
                    uniqueResults.push(result);
                }
            }

            const searchResults = uniqueResults.slice(0, 8);

            if (searchResults.length > 0) {
                const platformIcon = platform === 'youtube' ? 'fab fa-youtube' :
                                   platform === 'apple-music' ? 'fab fa-apple' :
                                   platform === 'soundcloud' ? 'fab fa-soundcloud' :
                                   'fas fa-globe';

                resultsContainer.innerHTML = `
                    <div class="spotify-search-info">
                        <p><i class="fas fa-check-circle" style="color: #10b981;"></i> Found ${searchResults.length} result(s) on ${platformName} for "${query}":</p>
                        <p class="text-muted">Click on a result to auto-fill the form</p>
                    </div>
                    ${searchResults.map(result => `
                        <div class="spotify-track" onclick="adminPanel.selectExternalResult('${result.url}', '${result.title}', '${result.artist}')">
                            <div class="spotify-track-info">
                                <i class="${platformIcon}"></i>
                                <div class="spotify-track-name">${result.title}</div>
                                <div class="spotify-track-url">
                                    <i class="fas fa-link"></i> Click to select
                                </div>
                            </div>
                        </div>
                    `).join('')}
                `;
            } else {
                const platformSearchUrls = {
                    'youtube': `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
                    'apple-music': `https://music.apple.com/search?term=${encodeURIComponent(query)}`,
                    'soundcloud': `https://soundcloud.com/search?q=${encodeURIComponent(query)}`,
                    'other': `https://www.google.com/search?q=${encodeURIComponent(query + ' music')}`
                };
                
                const searchUrl = platformSearchUrls[platform] || platformSearchUrls['other'];
                const platformIcon = platform === 'youtube' ? 'fab fa-youtube' :
                                   platform === 'apple-music' ? 'fab fa-apple' :
                                   platform === 'soundcloud' ? 'fab fa-soundcloud' :
                                   'fas fa-globe';
                const platformColor = platform === 'youtube' ? '#FF0000' :
                                      platform === 'apple-music' ? '#FA2D48' :
                                      platform === 'soundcloud' ? '#FF5500' :
                                      '#666666';

                resultsContainer.innerHTML = `
                    <div class="spotify-search-info">
                        <p><i class="fas fa-info-circle"></i> No direct links found for "${query}" on ${platformName}</p>
                        <p class="text-muted">Search directly on ${platformName}:</p>
                        <div class="spotify-track" onclick="window.open('${searchUrl}', '_blank')">
                            <div class="spotify-track-info">
                                <i class="${platformIcon}" style="font-size: 24px; color: ${platformColor};"></i>
                                <div class="spotify-track-details">
                                    <div class="spotify-track-name">Search "${query}" on ${platformName}</div>
                                    <div class="spotify-track-url">
                                        <i class="fas fa-external-link-alt"></i> Opens in new tab
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p class="text-muted" style="margin-top: 12px;">After finding your track, copy the URL and paste it in the "Track URL" field below, then fill in the title and artist.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Web search error:', error);
            const platformSearchUrls = {
                'youtube': `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
                'apple-music': `https://music.apple.com/search?term=${encodeURIComponent(query)}`,
                'soundcloud': `https://soundcloud.com/search?q=${encodeURIComponent(query)}`,
                'other': `https://www.google.com/search?q=${encodeURIComponent(query + ' music')}`
            };
            
            const searchUrl = platformSearchUrls[platform] || platformSearchUrls['other'];
            const platformIcon = platform === 'youtube' ? 'fab fa-youtube' :
                               platform === 'apple-music' ? 'fab fa-apple' :
                               platform === 'soundcloud' ? 'fab fa-soundcloud' :
                               'fas fa-globe';
            const platformColor = platform === 'youtube' ? '#FF0000' :
                                  platform === 'apple-music' ? '#FA2D48' :
                                  platform === 'soundcloud' ? '#FF5500' :
                                  '#666666';

            resultsContainer.innerHTML = `
                <div class="spotify-search-info">
                    <p><i class="fas fa-info-circle"></i> Web search unavailable</p>
                    <p class="text-muted">Search directly on ${platformName}:</p>
                    <div class="spotify-track" onclick="window.open('${searchUrl}', '_blank')">
                        <div class="spotify-track-info">
                            <i class="${platformIcon}" style="font-size: 24px; color: ${platformColor};"></i>
                            <div class="spotify-track-details">
                                <div class="spotify-track-name">Search "${query}" on ${platformName}</div>
                                <div class="spotify-track-url">
                                    <i class="fas fa-external-link-alt"></i> Opens in new tab
                                </div>
                            </div>
                        </div>
                    </div>
                    <p class="text-muted" style="margin-top: 12px;">After finding your track, copy the URL and paste it in the "Track URL" field below, then fill in the title and artist.</p>
                </div>
            `;
        }
    }

    extractExternalUrlsFromResults(data, query, platform) {
        const results = [];

        if (data.RelatedTopics) {
            for (const topic of data.RelatedTopics) {
                if (topic.FirstURL && this.isValidPlatformUrl(topic.FirstURL, platform)) {
                    const url = topic.FirstURL;
                    const title = topic.Text || topic.Result || `Track from ${platform}`;
                    results.push({ url, title: this.cleanTitle(title, query), artist: this.extractArtist(title) });
                }
            }
        }

        if (data.AbstractURL && this.isValidPlatformUrl(data.AbstractURL, platform)) {
            results.push({
                url: data.AbstractURL,
                title: data.Abstract || data.Heading || `Track from ${platform}`,
                artist: this.extractArtist(data.Abstract || data.Heading || '')
            });
        }

        const uniqueResults = [];
        const seenUrls = new Set();
        for (const result of results) {
            if (!seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                uniqueResults.push(result);
            }
        }

        return uniqueResults.slice(0, 5);
    }

    isValidPlatformUrl(url, platform) {
        const patterns = {
            'youtube': /youtube\.com|youtu\.be/,
            'apple-music': /music\.apple\.com/,
            'soundcloud': /soundcloud\.com/,
            'other': /.*/
        };
        return patterns[platform]?.test(url) || false;
    }

    extractArtist(title) {
        if (!title) return 'Unknown Artist';
        const match = title.match(/^by\s+(.+?)(?:\s+-\s+|$)/i);
        if (match) return match[1].trim();
        const dashMatch = title.match(/^(.+?)\s*-\s*.+$/);
        if (dashMatch) return dashMatch[1].trim();
        return 'Unknown Artist';
    }

    selectExternalResult(url, title, artist) {
        document.getElementById('externalUrl').value = url;
        document.getElementById('externalTitle').value = title;
        // Artist is likely a name from search results; try to match into the dropdown.
        this.externalExtractedArtistName = String(artist || '').trim();
        this.selectExternalArtistByName(this.externalExtractedArtistName).catch(console.error);

        const resultsContainer = document.getElementById('externalResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';

            resultsContainer.classList.remove('show');
        }

        this.showNotification('Track details filled in. Please complete the form.', 'success');
    }

    async fetchExternalTrackMetadata(url) {
        // Detect platform from URL
        let platform = 'other';
        if (this.isValidPlatformUrl(url, 'youtube')) {
            platform = 'youtube';
        } else if (this.isValidPlatformUrl(url, 'apple-music')) {
            platform = 'apple-music';
        } else if (this.isValidPlatformUrl(url, 'soundcloud')) {
            platform = 'soundcloud';
        }

        if (platform === 'other') {
            return; // Not a supported platform
        }

        try {
            let metadata = null;
            
            switch (platform) {
                case 'youtube':
                    metadata = await this.fetchYouTubeMetadata(url);
                    break;
                case 'apple-music':
                    metadata = await this.fetchAppleMusicMetadata(url);
                    break;
                case 'soundcloud':
                    metadata = await this.fetchSoundCloudMetadata(url);
                    break;
            }

            if (metadata) {
                this.autoFillExternalForm(metadata);
                this.showNotification(`Track info fetched from ${platform === 'youtube' ? 'YouTube' : platform === 'apple-music' ? 'Apple Music' : 'SoundCloud'}!`, 'success');
            }
        } catch (error) {
            console.error('Error fetching external track metadata:', error);
            // Don't show error notification - let user manually fill
        }
    }

    async fetchYouTubeMetadata(url) {
        try {
            // Extract video ID from URL
            const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
            const videoId = videoIdMatch ? videoIdMatch[1] : null;
            
            if (!videoId) {
                return null;
            }

            // Try to fetch from oEmbed API
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}`;
            
            try {
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    const data = await response.json();
                    
                    // Extract duration from YouTube page
                    let duration = await this.fetchYouTubeDuration(videoId);
                    
                    return {
                        title: data.title || 'Unknown Track',
                        artist: data.author_name || 'Unknown Artist',
                        artwork: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                        duration: duration || null,
                        genre: 'Unknown'
                    };
                }
            } catch (e) {
                console.log('YouTube oEmbed failed, trying fallback');
            }

            // Fallback: Extract basic info from URL
            return {
                title: 'YouTube Track',
                artist: 'Unknown Artist',
                artwork: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                duration: null,
                genre: 'Unknown'
            };
        } catch (error) {
            console.error('Error fetching YouTube metadata:', error);
            return null;
        }
    }

    async fetchYouTubeDuration(videoId) {
        try {
            // Use noembed as a fallback for basic info
            const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            if (response.ok) {
                const data = await response.json();
                // Try to extract duration if available
                if (data.html) {
                    const durationMatch = data.html.match(/(\d+):(\d+)/);
                    if (durationMatch) {
                        return durationMatch[0];
                    }
                }
            }
        } catch (e) {
            console.log('Could not fetch duration');
        }
        return null;
    }

    async fetchAppleMusicMetadata(url) {
        try {
            // Try oEmbed API
            const oembedUrl = `https://embed.music.apple.com/oembed?url=${encodeURIComponent(url)}`;
            
            try {
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    const data = await response.json();
                    
                    return {
                        title: data.title || 'Unknown Track',
                        artist: data.author_name || 'Unknown Artist',
                        artwork: data.thumbnail_url || 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Apple_Music_icon.svg/1024px-Apple_Music_icon.svg.png',
                        duration: null,
                        genre: 'Unknown'
                    };
                }
            } catch (e) {
                console.log('Apple Music oEmbed failed');
            }

            // Fallback
            return {
                title: 'Apple Music Track',
                artist: 'Unknown Artist',
                artwork: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Apple_Music_icon.svg/1024px-Apple_Music_icon.svg.png',
                duration: null,
                genre: 'Unknown'
            };
        } catch (error) {
            console.error('Error fetching Apple Music metadata:', error);
            return null;
        }
    }

    async fetchSoundCloudMetadata(url) {
        try {
            // Try oEmbed API
            const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            
            try {
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    const data = await response.json();
                    
                    // Extract duration if available
                    let duration = null;
                    if (data.html) {
                        const durationMatch = data.html.match(/(\d+):(\d+)/);
                        if (durationMatch) {
                            duration = durationMatch[0];
                        }
                    }
                    
                    return {
                        title: data.title || 'Unknown Track',
                        artist: data.author_name || 'Unknown Artist',
                        artwork: data.thumbnail_url || 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/SoundCloud_logo.svg/1024px-SoundCloud_logo.svg.png',
                        duration: duration || null,
                        genre: 'Unknown'
                    };
                }
            } catch (e) {
                console.log('SoundCloud oEmbed failed');
            }

            // Fallback
            return {
                title: 'SoundCloud Track',
                artist: 'Unknown Artist',
                artwork: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/SoundCloud_logo.svg/1024px-SoundCloud_logo.svg.png',
                duration: null,
                genre: 'Unknown'
            };
        } catch (error) {
            console.error('Error fetching SoundCloud metadata:', error);
            return null;
        }
    }

    autoFillExternalForm(metadata) {
        // Fill in the form fields
        const titleInput = document.getElementById('externalTitle');
        const artistInput = document.getElementById('externalArtist');
        const genreSelect = document.getElementById('externalGenre');
        

        if (titleInput && metadata.title) {
            titleInput.value = metadata.title;
        }

        if (metadata && metadata.artist) {
            this.externalExtractedArtistName = String(metadata.artist || '').trim();
        } else {
            this.externalExtractedArtistName = '';
        }

        // If externalArtist is a select, try to match the extracted name to an existing artist.
        if (artistInput && metadata && metadata.artist) {
            this.selectExternalArtistByName(String(metadata.artist || '')).catch(console.error);
        }
        

        if (genreSelect && metadata.genre && metadata.genre !== 'Unknown') {
            // Try to match genre to available options
            const genreOptions = Array.from(genreSelect.options).map(opt => opt.value);
            const matchedGenre = genreOptions.find(g => g.toLowerCase().includes(metadata.genre.toLowerCase()));
            if (matchedGenre) {
                genreSelect.value = matchedGenre;
            }
        }

        // Store artwork and duration for later use
        this.fetchedExternalMetadata = metadata;
    }

    async populateExternalArtistSelect(selectedId = '') {
        const select = document.getElementById('externalArtist');
        if (!select) return;

        this._populateExternalArtistSelectSeq = (this._populateExternalArtistSelectSeq || 0) + 1;
        const seq = this._populateExternalArtistSelectSeq;

        const addNewOptionValue = '__add_new__';
        const collabOptionValue = '__collab__';

        // Always rebuild options from scratch.
        // This prevents duplicates when navigating away/back and the browser restores previous <option> nodes.
        select.innerHTML = '';

        {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Select Artist';
            select.appendChild(opt);
        }

        {
            const opt = document.createElement('option');
            opt.value = collabOptionValue;
            opt.textContent = 'Collaboration (multiple artists)';
            select.appendChild(opt);
        }

        {
            const opt = document.createElement('option');
            opt.value = addNewOptionValue;
            opt.textContent = '+ Add new artist...';
            select.appendChild(opt);
        }

        try {
            const artists = await window.fetchArtists();
            if (seq !== this._populateExternalArtistSelectSeq) return;
            const seenIds = new Set();
            const seenNames = new Set();

            const normalized = (artists || [])
                .filter((a) => a && a.id)
                .map((a) => ({ id: String(a.id), name: String(a.name || '') }))
                .sort((a, b) => a.name.localeCompare(b.name))
                .filter((a) => {
                    const keyName = a.name.trim().toLowerCase();
                    if (seenIds.has(a.id)) return false;
                    if (keyName && seenNames.has(keyName)) return false;
                    seenIds.add(a.id);
                    if (keyName) seenNames.add(keyName);
                    return true;
                });

            for (const a of normalized) {
                if (seq !== this._populateExternalArtistSelectSeq) return;
                const opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.name || a.id;
                select.appendChild(opt);
            }
        } catch (e) {
            console.error(e);
        }

        if (selectedId) select.value = selectedId;
    }

    async renderExternalCollaboratorsTickList(selectedIds = []) {
        const container = document.getElementById('externalCollaboratorsTickList');
        if (!container) return;

        const preserved = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(x => String(x)));

        let artists = [];
        try {
            artists = await window.fetchArtists();
        } catch (_) {
            artists = [];
        }

        const seenIds = new Set();
        const seenNames = new Set();

        const normalized = (artists || [])
            .filter((a) => a && a.id)
            .map((a) => ({ id: String(a.id), name: String(a.name || '') }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter((a) => {
                const keyName = a.name.trim().toLowerCase();
                if (seenIds.has(a.id)) return false;
                if (keyName && seenNames.has(keyName)) return false;
                seenIds.add(a.id);
                if (keyName) seenNames.add(keyName);
                return true;
            });

        container.innerHTML = '';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-secondary btn-sm';
        addBtn.textContent = '+ Add new artist...';
        addBtn.addEventListener('click', () => {
            const trackArtistSelect = document.getElementById('trackArtist');
            if (trackArtistSelect) {
                trackArtistSelect.value = '__add_new__';
                trackArtistSelect.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (typeof window.openAddArtistModal === 'function') {
                window.openAddArtistModal();
            }
        });
        container.appendChild(addBtn);

        const list = document.createElement('div');
        list.className = 'artist-tick-items';

        for (const a of normalized) {
            const row = document.createElement('label');
            row.className = 'artist-tick-item';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.artistId = a.id;
            cb.checked = preserved.has(a.id);

            row.classList.toggle('selected', cb.checked);

            cb.addEventListener('change', () => {
                const ids = Array.from(container.querySelectorAll('input[type="checkbox"][data-artist-id]'))
                    .filter((x) => x.checked)
                    .map((x) => String(x.dataset.artistId || ''))
                    .filter(Boolean);
                this.externalCollaboratorIds = ids;
                row.classList.toggle('selected', cb.checked);
            });

            const name = document.createElement('span');
            name.textContent = a.name || a.id;

            row.appendChild(cb);
            row.appendChild(name);
            list.appendChild(row);
        }

        container.appendChild(list);

        // initial sync
        this.externalCollaboratorIds = Array.from(preserved);
    }

    async selectExternalArtistByName(name) {
        const select = document.getElementById('externalArtist');
        if (!select) return;

        const raw = String(name || '').trim();
        if (!raw) {
            select.value = '';
            return;
        }

        await this.populateExternalArtistSelect();

        const artists = await window.fetchArtists();
        const lower = raw.toLowerCase();
        const match = (artists || []).find((a) => String(a.name || '').toLowerCase() === lower);

        if (match && match.id) {
            select.value = match.id;
            return;
        }

        // Artist not found: keep selection empty, but let user confirm whether to add a new artist.
        select.value = '';
        await this.confirmAndOpenAddArtist(raw);
    }

    async confirmAndOpenAddArtist(extractedName = '') {
        if (this._addArtistConfirmInFlight) return;

        const suggested = String(extractedName || '').trim();

        const promptKey = suggested.toLowerCase();
        const now = Date.now();
        if (promptKey && this._lastAddArtistPromptKey === promptKey && (now - (this._lastAddArtistPromptAt || 0)) < 1500) {
            return;
        }

        this._lastAddArtistPromptKey = promptKey;
        this._lastAddArtistPromptAt = now;

        this._addArtistConfirmInFlight = true;
        const msg = suggested
            ? `Artist "${suggested}" was not found. Do you want to add this artist now? You can also cancel and select a different artist from the dropdown.`
            : 'Do you want to add a new artist now?';

        let ok = false;
        try {
            if (window.notifications && window.notifications.confirm) {
                ok = await window.notifications.confirm(msg, 'Add New Artist?', 'info');
            } else {
                ok = confirm(msg);
            }
            if (!ok) return;

            // Prefill artist name if we have one.
            if (suggested) {
                window.__pendingNewArtistName = suggested;
            }

            // Prefer the established add-new flow via the Audio Link artist select.
            const trackArtistSelect = document.getElementById('trackArtist');
            if (trackArtistSelect) {
                trackArtistSelect.value = '__add_new__';
                trackArtistSelect.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (typeof window.openAddArtistModal === 'function') {
                window.openAddArtistModal();
            }

            // Try to prefill once the form is visible.
            if (suggested) {
                setTimeout(() => {
                    const input = document.getElementById('artistName');
                    if (input && !input.value) input.value = suggested;
                }, 350);
            }
        } finally {
            this._addArtistConfirmInFlight = false;
        }
    }

    async handleExternalTrack() {
        const platform = document.querySelector('input[name="platform"]:checked')?.value;
        const url = document.getElementById('externalUrl').value.trim();
        const title = document.getElementById('externalTitle').value.trim();
        const externalArtistValue = document.getElementById('externalArtist').value;
        const genre = document.getElementById('externalGenre').value;

        if (!platform) {
            this.showNotification('Please select a platform', 'error');
            return;
        }

        if (!url || !title || !externalArtistValue) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (externalArtistValue === '__collab__') {
            const ids = Array.isArray(this.externalCollaboratorIds) ? this.externalCollaboratorIds : [];
            if (ids.length < 2) {
                this.showNotification('For collaborations, please select at least 2 artists.', 'error');
                return;
            }
        }

        if (externalArtistValue === '__add_new__') {
            const extractedName = String(this.externalExtractedArtistName || '').trim();
            await this.confirmAndOpenAddArtist(extractedName);
            return;
        }

        try {
            // Use fetched metadata if available, otherwise use platform defaults
            const metadata = this.fetchedExternalMetadata || {};
            const artwork = metadata.artwork || this.getPlatformArtwork(platform);
            const duration = metadata.duration || '';

            // Normalize URL and move everything into the Audio Link form.
            // The Audio Link save flow (scripts/admin-firebase.js) already classifies platform links into platformLinks.
            const normalizedUrl = url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;

            const audioUrlInput = document.getElementById('audioUrl');
            const titleInput = document.getElementById('trackTitle');
            const artistSelect = document.getElementById('trackArtist');
            const genreInput = document.getElementById('trackGenre');
            const durationInput = document.getElementById('trackDuration');
            const releaseDateInput = document.getElementById('releaseDate');
            const descriptionInput = document.getElementById('trackDescription');
            const artworkPreview = document.getElementById('artworkPreview');

            // Ensure hidden input for URL-based artwork exists (scripts/admin-firebase.js reads spotifyArtworkUrl)
            let spotifyArtworkInput = document.getElementById('spotifyArtworkUrl');
            if (!spotifyArtworkInput) {
                spotifyArtworkInput = document.createElement('input');
                spotifyArtworkInput.type = 'hidden';
                spotifyArtworkInput.id = 'spotifyArtworkUrl';
                spotifyArtworkInput.name = 'spotifyArtworkUrl';
                document.getElementById('audioUploadForm')?.appendChild(spotifyArtworkInput);
            }

            if (audioUrlInput) audioUrlInput.value = normalizedUrl;
            if (titleInput) titleInput.value = title;
            if (genreInput) genreInput.value = genre || '';
            if (durationInput) durationInput.value = duration;

            if (releaseDateInput) {
                releaseDateInput.value = new Date().toISOString().split('T')[0];
            }

            if (descriptionInput) {
                descriptionInput.value = `Imported from ${platform}: ${normalizedUrl}`;
            }

            // Use selected artist ID.
            if (artistSelect) {
                artistSelect.value = externalArtistValue;
                artistSelect.dispatchEvent(new Event('change', { bubbles: true }));

                if (externalArtistValue === '__collab__') {
                    const ids = Array.isArray(this.externalCollaboratorIds) ? this.externalCollaboratorIds : [];
                    window.__pendingCollaboratorIds = ids;
                    if (typeof window.populateCollaboratorsSelect === 'function') {
                        await window.populateCollaboratorsSelect(ids);
                    } else {
                        const collabSelect = document.getElementById('trackCollaborators');
                        if (collabSelect) {
                            const selectedSet = new Set(ids.map((x) => String(x)));
                            Array.from(collabSelect.options).forEach((opt) => {
                                opt.selected = selectedSet.has(opt.value);
                            });
                        }
                    }
                }
            }

            if (artworkPreview && artwork) {
                artworkPreview.classList.add('has-image');
                artworkPreview.style.backgroundImage = `url('${artwork}')`;
                if (spotifyArtworkInput) {
                    spotifyArtworkInput.value = artwork;
                }
            }

            if (audioUrlInput) {
                audioUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Switch to Audio Link method so you can complete missing info and save normally.
            this.switchUploadMethod('upload');

            if (externalArtistValue === '__collab__') {
                const ids = Array.isArray(this.externalCollaboratorIds) ? this.externalCollaboratorIds : [];
                window.__pendingCollaboratorIds = ids;
                setTimeout(async () => {
                    try {
                        const artistSelect2 = document.getElementById('trackArtist');
                        if (artistSelect2 && artistSelect2.value !== '__collab__') {
                            artistSelect2.value = '__collab__';
                            artistSelect2.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        if (typeof window.populateCollaboratorsSelect === 'function') {
                            await window.populateCollaboratorsSelect(ids);
                        }
                    } catch (e) {
                        console.error('Failed to re-apply collaborators after switch:', e);
                    }
                }, 450);
            }

            this.resetExternalForm();

            this.showNotification('External track data imported. Please complete missing info and click Save Track.', 'success');
        } catch (error) {
            console.error('Error adding external track:', error);
            this.showNotification('Error adding track: ' + error.message, 'error');
        }
    }

    getPlatformArtwork(platform) {
        const artworkMap = {
            'youtube': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/1024px-YouTube_full-color_icon_%282017%29.svg.png',
            'apple-music': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Apple_Music_icon.svg/1024px-Apple_Music_icon.svg.png',
            'soundcloud': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/SoundCloud_logo.svg/1024px-SoundCloud_logo.svg.png',
            'other': 'https://via.placeholder.com/300?text=External'
        };
        return artworkMap[platform] || artworkMap['other'];
    }

    applyPaymentFilters() {
        const status = document.getElementById('paymentStatusFilter').value;
        const dateFrom = document.getElementById('paymentDateFrom').value;
        const dateTo = document.getElementById('paymentDateTo').value;

        
        this.showNotification(`Filters applied: Status=${status}, From=${dateFrom}, To=${dateTo}`, 'info');
        // In production, this would filter the payments table
        this.loadPayments();
    }

    // Utility methods
    async showNotification(message, type = 'info') {
        const msg = String(message || '');

        // Wait briefly for notifications to be available (modules load asynchronously)
        if (!window.notifications || typeof window.notifications.show !== 'function') {
            // Wait up to 500ms for notifications to initialize
            await new Promise(resolve => {
                let attempts = 0;
                const check = setInterval(() => {
                    attempts++;
                    if (window.notifications && typeof window.notifications.show === 'function') {
                        clearInterval(check);
                        resolve();
                    } else if (attempts >= 10) { // 500ms max
                        clearInterval(check);
                        resolve();
                    }
                }, 50);
            });
        }

        // Try to use the global notification system
        if (window.notifications && typeof window.notifications.show === 'function') {
            window.notifications.show(msg, type);
            return;
        }

        // Fallback to alert if notifications system isn't available
        console.log(`[Notification] ${type}: ${msg}`);
        alert(msg);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }

    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('active');
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    toggleNotifications() {
        const panel = document.getElementById('notificationsPanel');
        if (panel) {
            panel.classList.toggle('active');
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    async handleLogout() {
        let ok = false;
        if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm('Are you sure you want to logout?', 'Logout', 'warning');
        } else {
            ok = confirm('Are you sure you want to logout?');
        }
        if (ok) {
            // Prefer signing out via Firebase auth if available.
            if (window.adminAuth && typeof window.adminAuth.handleLogout === 'function') {
                await window.adminAuth.handleLogout();
                return;
            }
            window.location.href = 'index.html';
        }
    }

    // --- Inline Form Listeners & Handlers ---

    setupInlineFormListeners() {
        // Close / Cancel artist form
        document.getElementById('closeArtistForm')?.addEventListener('click', () => {
            this.closeArtistForm();
        });
        document.getElementById('cancelArtistForm')?.addEventListener('click', () => {
            this.closeArtistForm();
        });

        // Artist image upload
        document.getElementById('uploadArtistImageBtn')?.addEventListener('click', () => {
            document.getElementById('artistImageInput')?.click();
        });

        // Add Team Member button
        document.getElementById('addTeamMemberBtn')?.addEventListener('click', () => {
            this.openTeamForm(null);
        });

        // Close / Cancel team form
        document.getElementById('closeTeamForm')?.addEventListener('click', () => {
            this.closeTeamForm();
        });
        document.getElementById('cancelTeamForm')?.addEventListener('click', () => {
            this.closeTeamForm();
        });

        // Team form submit
        document.getElementById('teamForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTeamForm();
        });

        // Team photo upload
        document.getElementById('uploadTeamPhotoBtn')?.addEventListener('click', () => {
            document.getElementById('teamMemberPhotoInput')?.click();
        });
        document.getElementById('teamMemberPhotoInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const preview = document.getElementById('teamMemberPhotoPreview');
                if (preview) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        preview.style.backgroundImage = `url('${ev.target.result}')`;
                        preview.classList.add('has-image');
                        preview.querySelector('i')?.remove();
                        preview.querySelector('span')?.remove();
                    };
                    reader.readAsDataURL(file);
                }
            }
        });

        // Admin Management - Invite button
        document.getElementById('inviteAdminBtn')?.addEventListener('click', () => {
            this.openInviteModal();
        });

        // Admin Management - Close modal
        document.getElementById('closeInviteModal')?.addEventListener('click', () => {
            this.closeInviteModal();
        });

        // Admin Management - Send invite form
        document.getElementById('inviteAdminForm')?.addEventListener('submit', (e) => {
            this.sendAdminInvite(e);
        });
    }

    openArtistForm(artist = null) {
        const formContainer = document.getElementById('artistManagementForm');
        const formTitle = document.getElementById('artistFormTitle');
        const form = document.getElementById('artistForm');
        if (!formContainer || !form) return;

        // Reset form
        form.reset();
        const preview = document.getElementById('artistImagePreview');
        if (preview) {
            preview.style.backgroundImage = '';
            preview.classList.remove('has-image');
            if (!preview.querySelector('i')) {
                preview.innerHTML = '<i class="fas fa-user"></i><span>No photo selected</span>';
            }
        }

        if (artist) {
            formTitle.textContent = 'Edit Artist';
            document.getElementById('artistName').value = artist.name || '';
            document.getElementById('artistGenre').value = artist.genre || '';
            document.getElementById('artistStatus').value = artist.status || 'active';
            document.getElementById('artistBio').value = artist.bio || '';
            if (artist.image) {
                const imgPreview = document.getElementById('artistImagePreview');
                if (imgPreview) {
                    imgPreview.style.backgroundImage = `url('${artist.image}')`;
                    imgPreview.classList.add('has-image');
                    imgPreview.querySelector('i')?.remove();
                    imgPreview.querySelector('span')?.remove();
                }
            }
            this.editingItem = { type: 'artist', id: artist.id, data: artist };
        } else {
            formTitle.textContent = 'Add New Artist';
            this.editingItem = null;
        }

        formContainer.style.display = '';
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    closeArtistForm() {
        const formContainer = document.getElementById('artistManagementForm');
        const form = document.getElementById('artistForm');
        if (formContainer) formContainer.style.display = 'none';
        if (form) form.reset();
        this.editingItem = null;
    }

    openTeamForm(member = null) {
        const formContainer = document.getElementById('teamManagementForm');
        const formTitle = document.getElementById('teamFormTitle');
        const form = document.getElementById('teamForm');
        if (!formContainer || !form) return;

        // Reset form
        form.reset();
        const preview = document.getElementById('teamMemberPhotoPreview');
        if (preview) {
            preview.style.backgroundImage = '';
            preview.classList.remove('has-image');
            if (!preview.querySelector('i')) {
                preview.innerHTML = '<i class="fas fa-user"></i><span>No photo selected</span>';
            }
        }

        if (member) {
            formTitle.textContent = 'Edit Team Member';
            document.getElementById('teamMemberNameInput').value = member.name || '';
            document.getElementById('teamMemberRoleInput').value = member.role || '';
            document.getElementById('teamMemberBadgeInput').value = member.badge || '';
            document.getElementById('teamMemberStatusInput').value = member.status || 'active';
            document.getElementById('teamMemberSkillsInput').value = (member.skills || []).join(', ');
            document.getElementById('teamMemberBioInput').value = member.bio || '';
            if (member.image) {
                const imgPreview = document.getElementById('teamMemberPhotoPreview');
                if (imgPreview) {
                    imgPreview.style.backgroundImage = `url('${member.image}')`;
                    imgPreview.classList.add('has-image');
                    imgPreview.querySelector('i')?.remove();
                    imgPreview.querySelector('span')?.remove();
                }
            }
            this.editingItem = { type: 'team', id: member.id, data: member };
        } else {
            formTitle.textContent = 'Add Team Member';
            this.editingItem = null;
        }

        formContainer.style.display = '';
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    closeTeamForm() {
        const formContainer = document.getElementById('teamManagementForm');
        const form = document.getElementById('teamForm');
        if (formContainer) formContainer.style.display = 'none';
        if (form) form.reset();
        this.editingItem = null;
    }

    async saveTeamForm() {
        if (this.teamSaveInProgress) return;
        this.teamSaveInProgress = true;

        const form = document.getElementById('teamForm');
        const submitBtn = form?.querySelector('button[type="submit"]');
        if (submitBtn && !submitBtn.dataset.originalHtml) submitBtn.dataset.originalHtml = submitBtn.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        const name = document.getElementById('teamMemberNameInput')?.value?.trim();
        const role = document.getElementById('teamMemberRoleInput')?.value?.trim();
        const badge = document.getElementById('teamMemberBadgeInput')?.value?.trim();
        const status = document.getElementById('teamMemberStatusInput')?.value || 'active';
        const skillsRaw = document.getElementById('teamMemberSkillsInput')?.value?.trim() || '';
        const skills = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const bio = document.getElementById('teamMemberBioInput')?.value?.trim();
        const imageInput = document.getElementById('teamMemberPhotoInput');

        if (!name || !role) {
            this.showNotification('Name and role are required', 'error');
            this.teamSaveInProgress = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                if (submitBtn.dataset.originalHtml) {
                    submitBtn.innerHTML = submitBtn.dataset.originalHtml;
                    delete submitBtn.dataset.originalHtml;
                }
            }
            return;
        }

        try {
            let imageUrl = '';
            if (imageInput?.files?.[0]) {
                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading photo...';
                imageUrl = await this.handleImageUpload(imageInput.files[0]);
            } else if (this.editingItem?.data?.image) {
                imageUrl = this.editingItem.data.image;
            }

            const memberData = { name, role, badge, status, skills, bio, image: imageUrl };

            if (this.editingItem && this.editingItem.id) {
                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating member...';
                const { db } = await import('../scripts/firebase-init.js');
                const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
                await updateDoc(doc(db, 'team', this.editingItem.id), memberData);
                this.showNotification('Team member updated successfully!', 'success');
            } else {
                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding member...';
                const { db } = await import('../scripts/firebase-init.js');
                const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
                memberData.createdAt = new Date().toISOString();
                await addDoc(collection(db, 'team'), memberData);
                this.showNotification('Team member added successfully!', 'success');
            }

            this.loadTeam();
            this.closeTeamForm();
        } catch (error) {
            console.error('Error saving team member:', error);
            this.showNotification('Failed to save team member: ' + error.message, 'error');
        } finally {
            this.teamSaveInProgress = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                if (submitBtn.dataset.originalHtml) {
                    submitBtn.innerHTML = submitBtn.dataset.originalHtml;
                    delete submitBtn.dataset.originalHtml;
                }
            }
        }
    }

    addNewArtist() {
        this.openArtistForm(null);
    }

    async editArtist(artistId) {
        // Delegate to admin-firebase.js which manages editingArtistId and form population
        if (typeof window.editArtist === 'function') {
            await window.editArtist(artistId);
        } else {
            this.showNotification('Edit functionality not available', 'error');
        }
    }

    async viewArtist(artistId) {
        // View redirects to edit form (same as edit track pattern)
        await this.editArtist(artistId);
    }

    // Admin Management Methods
    async loadAdminManagement() {
        if (!this.isSuperAdmin()) {
            this.renderAdminManagementAccessDenied();
            return;
        }
        await this.loadAdmins();
        await this.loadAdminInvites();
    }

    renderAdminManagementAccessDenied() {
        const section = document.getElementById('admin-management');
        if (!section) return;

        const inviteBtn = document.getElementById('inviteAdminBtn');
        if (inviteBtn) inviteBtn.style.display = 'none';

        const adminsTable = document.getElementById('adminsTable');
        const invitesTable = document.getElementById('invitesTable');

        if (adminsTable) {
            adminsTable.innerHTML = '<tr><td colspan="5" class="text-center">Access denied</td></tr>';
        }

        if (invitesTable) {
            invitesTable.innerHTML = '<tr><td colspan="4" class="text-center">Access denied</td></tr>';
        }

        // Insert a friendly access panel right after the header.
        const existing = section.querySelector('[data-admin-mgmt-denied="true"]');
        if (existing) return;

        const header = section.querySelector('.section-header');
        const panel = document.createElement('div');
        panel.dataset.adminMgmtDenied = 'true';
        panel.className = 'table-container';
        panel.innerHTML = `
            <div class="text-center" style="padding: 1.25rem;">
                <h3 style="margin: 0 0 0.5rem;">Not authorized</h3>
                <p style="margin: 0; opacity: 0.85;">Access denied. Only super admins can invite or manage admins.</p>
            </div>
        `;

        if (header && header.parentNode) {
            header.insertAdjacentElement('afterend', panel);
        } else {
            section.prepend(panel);
        }
    }

    async loadAdmins() {
        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            
            const q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            
            const adminsTable = document.getElementById('adminsTable');
            if (!adminsTable) return;

            const currentAdmin = window.adminAuth?.getCurrentUser();
            const isSuperAdmin = currentAdmin?.role === 'super_admin';

            adminsTable.innerHTML = snapshot.docs.map(doc => {
                const admin = { id: doc.id, ...doc.data() };
                const isCurrentUser = admin.id === currentAdmin?.uid;
                const canEdit = isSuperAdmin && !isCurrentUser;
                const canDelete = isSuperAdmin && !isCurrentUser;
                
                const roleBadge = admin.role === 'super_admin' 
                    ? '<span class="badge badge-super-admin">Super Admin</span>'
                    : '<span class="badge badge-admin">Admin</span>';

                return `
                    <tr>
                        <td>${admin.name || admin.email}</td>
                        <td>${admin.email}</td>
                        <td>${roleBadge}</td>
                        <td>${new Date(admin.createdAt).toLocaleDateString()}</td>
                        <td>
                            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="window.adminPanel.editAdminRole('${admin.id}')">
                                <i class="fas fa-edit"></i>
                            </button>` : ''}
                            ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="window.adminPanel.deleteAdmin('${admin.id}')">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
                            ${isCurrentUser ? '<span class="text-muted">(You)</span>' : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading admins:', error);
            this.showNotification('Failed to load admins: ' + error.message, 'error');
        }
    }

    async loadAdminInvites() {
        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const snapshot = await getDocs(collection(db, 'adminInvites'));
            
            const invitesTable = document.getElementById('invitesTable');
            if (!invitesTable) return;

            const currentAdmin = window.adminAuth?.getCurrentUser();
            const isSuperAdmin = currentAdmin?.role === 'super_admin';

            invitesTable.innerHTML = snapshot.docs.map(doc => {
                const invite = { id: doc.id, ...doc.data() };
                const canDelete = isSuperAdmin;
                
                const roleBadge = invite.role === 'super_admin' 
                    ? '<span class="badge badge-super-admin">Super Admin</span>'
                    : '<span class="badge badge-admin">Admin</span>';

                return `
                    <tr>
                        <td>${invite.id}</td>
                        <td>${roleBadge}</td>
                        <td>${invite.createdBy || 'Unknown'}</td>
                        <td>
                            ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="window.adminPanel.deleteAdminInvite('${invite.id}')">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');

            if (snapshot.empty) {
                invitesTable.innerHTML = '<tr><td colspan="4" class="text-center">No pending invites</td></tr>';
            }
        } catch (error) {
            console.error('Error loading admin invites:', error);
            this.showNotification('Failed to load invites: ' + error.message, 'error');
        }
    }

    openInviteModal() {
        if (!this.isSuperAdmin()) {
            this.showNotification('Access denied: Only super admins can invite admins', 'error');
            return;
        }
        const modal = document.getElementById('inviteAdminModal');
        if (modal) modal.classList.add('active');
    }

    closeInviteModal() {
        const modal = document.getElementById('inviteAdminModal');
        const form = document.getElementById('inviteAdminForm');
        if (modal) modal.classList.remove('active');
        if (form) form.reset();
    }

    async sendAdminInvite(e) {
        e.preventDefault();
        const email = document.getElementById('inviteEmail')?.value?.trim();
        const role = document.getElementById('inviteRole')?.value;

        if (!email) {
            this.showNotification('Email is required', 'error');
            return;
        }

        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const currentAdmin = window.adminAuth?.getCurrentUser();

            const inviteData = {
                email,
                role,
                createdBy: currentAdmin?.email || currentAdmin?.uid,
                createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'adminInvites', email), inviteData);
            this.showNotification(`Invite sent to ${email}`, 'success');
            this.closeInviteModal();
            await this.loadAdminInvites();
        } catch (error) {
            console.error('Error sending invite:', error);
            this.showNotification('Failed to send invite: ' + error.message, 'error');
        }
    }

    async deleteAdminInvite(email) {
        if (!confirm('Are you sure you want to delete this invite?')) return;

        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            await deleteDoc(doc(db, 'adminInvites', email));
            this.showNotification('Invite deleted successfully', 'success');
            await this.loadAdminInvites();
        } catch (error) {
            console.error('Error deleting invite:', error);
            this.showNotification('Failed to delete invite: ' + error.message, 'error');
        }
    }

    async editAdminRole(adminId) {
        if (!this.isSuperAdmin()) {
            this.showNotification('Access denied: Only super admins can edit admin roles', 'error');
            return;
        }

        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, getDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const adminDoc = await getDoc(doc(db, 'admins', adminId));
            
            if (!adminDoc.exists()) {
                this.showNotification('Admin not found', 'error');
                return;
            }

            const admin = adminDoc.data();
            const newRole = admin.role === 'super_admin' ? 'admin' : 'super_admin';
            
            await updateDoc(doc(db, 'admins', adminId), { role: newRole });
            this.showNotification(`Admin role updated to ${newRole}`, 'success');
            await this.loadAdmins();
        } catch (error) {
            console.error('Error updating admin role:', error);
            this.showNotification('Failed to update admin role: ' + error.message, 'error');
        }
    }

    async deleteAdmin(adminId) {
        let adminLabel = `ID ${adminId}`;
        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const snap = await getDoc(doc(db, 'admins', adminId));
            if (snap.exists()) {
                const a = snap.data() || {};
                adminLabel = a.email ? `"${a.email}"` : adminLabel;
            }
        } catch (_) {
            // ignore
        }

        if (!confirm(`Are you sure you want to remove admin ${adminLabel}? This action cannot be undone.`)) return;

        try {
            const { db } = await import('../scripts/firebase-init.js');
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            await deleteDoc(doc(db, 'admins', adminId));
            this.showNotification('Admin removed successfully', 'success');
            await this.loadAdmins();
        } catch (error) {
            console.error('Error deleting admin:', error);
            this.showNotification('Failed to remove admin: ' + error.message, 'error');
        }
    }

    isSuperAdmin() {
        const currentAdmin = window.adminAuth?.getCurrentUser();
        return currentAdmin?.role === 'super_admin';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing AdminPanel...');
    // Check if we're on an admin page
    if (document.querySelector('.admin-page')) {
        if (window.adminPanel) return;

        const init = () => {
            if (window.adminPanel) return;

            // If admin auth is present and the user is not an authenticated admin,
            // do not initialize the panel (admin/auth.js will handle redirect).
            if (window.adminAuth && typeof window.adminAuth.isLoggedIn === 'function') {
                if (!window.adminAuth.isLoggedIn()) {
                    // Auth may still be resolving; retry once when the auth listener fires.
                    window.addEventListener('adminAuthState', init, { once: true });
                    return;
                }
            }
            window.adminPanel = new AdminPanel();
        };

        // If Firestore helpers already exist, init immediately; otherwise wait.
        if (window.fetchArtists && window.fetchTracks) {
            init();
        } else {
            window.addEventListener('adminFirebaseReady', init, { once: true });
            // Fallback in case the event fired before we attached (or script order differs)
            setTimeout(init, 0);
        }
    }
});