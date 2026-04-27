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
            const navToggle = document.getElementById('navToggle');
            const adminNav = document.getElementById('adminNav');
            
            if (navContent && navContent.classList.contains('active')) {
                if (!adminNav.contains(e.target)) {
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
            externalUrlInput.addEventListener('paste', async (e) => {
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
            externalUrlInput.addEventListener('input', (e) => {
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

        await this.prefillAudioUploadForm({
            title: this.selectedSpotifyTrack.title,
            artistName: this.selectedSpotifyTrack.artist,
            duration: this.selectedSpotifyTrack.duration,
            releaseDate: this.selectedSpotifyTrack.releaseDate,
            description: `Imported from Spotify: ${this.selectedSpotifyTrack.url}`,
            audioUrl: this.selectedSpotifyTrack.url,
            artworkUrl: this.selectedSpotifyTrack.artwork,
        });

        const spotifyUrlInput = document.getElementById('spotifyUrl');

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

        this.showNotification('Spotify import moved to Audio Link. Please complete any missing fields and save.', 'success');
    }

    async prefillAudioUploadForm({
        title,
        artistName,
        genre,
        duration,
        releaseDate,
        description,
        audioUrl,
        artworkUrl,
    }) {
        const audioUrlInput = document.getElementById('audioUrl');
        const titleInput = document.getElementById('trackTitle');
        const artistInput = document.getElementById('trackArtist');
        const genreInput = document.getElementById('trackGenre');
        const durationInput = document.getElementById('trackDuration');
        const releaseDateInput = document.getElementById('releaseDate');
        const descriptionInput = document.getElementById('trackDescription');
        const artworkPreview = document.getElementById('artworkPreview');

        // Ensure hidden input for remote artwork URL exists (re-uses the existing plumbing in admin-firebase.js)
        let spotifyArtworkInput = document.getElementById('spotifyArtworkUrl');
        if (!spotifyArtworkInput) {
            spotifyArtworkInput = document.createElement('input');
            spotifyArtworkInput.type = 'hidden';
            spotifyArtworkInput.id = 'spotifyArtworkUrl';
            spotifyArtworkInput.name = 'spotifyArtworkUrl';
            document.getElementById('audioUploadForm')?.appendChild(spotifyArtworkInput);
        }

        if (audioUrlInput && audioUrl) audioUrlInput.value = String(audioUrl);
        if (titleInput && title) titleInput.value = String(title);

        if (genreInput && genre) {
            genreInput.value = String(genre);
        }

        if (durationInput && duration) {
            durationInput.value = String(duration);
        }

        if (releaseDateInput && releaseDate) {
            releaseDateInput.value = String(releaseDate);
        } else if (releaseDateInput && !releaseDateInput.value) {
            releaseDateInput.value = new Date().toISOString().split('T')[0];
        }

        if (descriptionInput && description) {
            descriptionInput.value = String(description);
        }

        // Try to match existing artist, otherwise force user to add/select.
        if (artistInput) {
            const name = String(artistName || '').trim();
            if (!name) {
                artistInput.value = '__add_new__';
            } else {
                try {
                    const artists = await window.fetchArtists?.();
                    const lower = name.toLowerCase();
                    const matchingArtist = (artists || []).find(a => String(a.name || '').toLowerCase() === lower);
                    artistInput.value = matchingArtist ? matchingArtist.id : '__add_new__';
                } catch (_) {
                    artistInput.value = '__add_new__';
                }
            }
        }

        if (artworkPreview && artworkUrl) {
            artworkPreview.classList.add('has-image');
            artworkPreview.style.backgroundImage = `url('${String(artworkUrl)}')`;
            if (spotifyArtworkInput) spotifyArtworkInput.value = String(artworkUrl);
        } else if (spotifyArtworkInput) {
            // If no remote artwork provided, don't leave stale data behind.
            spotifyArtworkInput.value = '';
        }
    }

    async handleExternalTrack() {
        const platform = document.querySelector('input[name="platform"]:checked')?.value;
        const url = document.getElementById('externalUrl').value.trim();
        const title = document.getElementById('externalTitle').value.trim();
        const artist = document.getElementById('externalArtist').value.trim();
        const genre = document.getElementById('externalGenre').value;

        if (!platform) {
            this.showNotification('Please select a platform', 'error');
            return;
        }

        if (!url || !title || !artist) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        try {
            // Use fetched metadata if available, otherwise use platform defaults
            const metadata = this.fetchedExternalMetadata || {};
            const artwork = metadata.artwork || this.getPlatformArtwork(platform);
            const duration = metadata.duration || '';

            const normalizedUrl = url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;

            await this.prefillAudioUploadForm({
                title,
                artistName: artist,
                genre: genre || '',
                duration,
                description: `Imported from ${platform}: ${normalizedUrl}`,
                audioUrl: normalizedUrl,
                artworkUrl: artwork,
            });

            // Reset external form state
            this.resetExternalForm();
            this.fetchedExternalMetadata = null;

            // Move user to Audio Link to complete missing fields and save
            this.switchUploadMethod('upload');
            this.showNotification('External import moved to Audio Link. Please complete any missing fields and save.', 'success');
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
            return;
        }

        try {
            let imageUrl = '';
            if (imageInput?.files?.[0]) {
                imageUrl = await this.handleImageUpload(imageInput.files[0]);
            } else if (this.editingItem?.data?.image) {
                imageUrl = this.editingItem.data.image;
            }

            const memberData = { name, role, badge, status, skills, bio, image: imageUrl };

            if (this.editingItem && this.editingItem.id) {
                const { db } = await import('../scripts/firebase-init.js');
                const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
                await updateDoc(doc(db, 'team', this.editingItem.id), memberData);
                this.showNotification('Team member updated successfully!', 'success');
            } else {
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
        if (!confirm('Are you sure you want to remove this admin? This action cannot be undone.')) return;

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