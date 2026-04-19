// admin.js - Simplified Working Version
class AdminPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.dataManager = window.dataManager;
        this.editingItem = null;
        this.settingsDirty = false;
        this.settingsDirtyBound = false;
        this.searchBound = false;
        this.artistModalMode = 'view';
        this.artistModalSnapshot = null;

        this.init();
    }

    init() {
        console.log('AdminPanel initializing...');

        // Ensure we have a reliable focus target outside modals (prevents aria-hidden focus warnings)
        const adminNav = document.getElementById('adminNav');
        if (adminNav && !adminNav.hasAttribute('tabindex')) {
            adminNav.setAttribute('tabindex', '-1');
        }

        this.setupEventListeners();

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

        // Add team member modal event listeners
        const closeTeamMemberModal = document.getElementById('closeTeamMemberModal');
        const cancelTeamMember = document.getElementById('cancelTeamMember');
        const addTeamMemberForm = document.getElementById('addTeamMemberForm');

        if (closeTeamMemberModal) {
            closeTeamMemberModal.addEventListener('click', () => this.closeTeamMemberModal());
        }
        if (cancelTeamMember) {
            cancelTeamMember.addEventListener('click', () => this.closeTeamMemberModal());
        }
        if (addTeamMemberForm) {
            addTeamMemberForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTeamMember();
            });
        }

        // Artist modal + image preview are handled by admin-firebase.js

        // View artist modal event listeners
        const closeViewArtistModal = document.getElementById('closeViewArtistModal');
        const closeViewArtistModalBtn = document.getElementById('closeViewArtistModalBtn');
        const editFromViewArtist = document.getElementById('editFromViewArtist');
        const viewArtistModalCancelEdit = document.getElementById('cancelEditFromViewArtist');
        const viewArtistModal = document.getElementById('viewArtistModal');

        const closeViewModalSafe = (modalEl) => {
            if (!modalEl) return;
            let focusSink = document.getElementById('modalFocusSink');
            if (!focusSink) {
                focusSink = document.createElement('div');
                focusSink.id = 'modalFocusSink';
                focusSink.tabIndex = -1;
                focusSink.style.position = 'fixed';
                focusSink.style.width = '1px';
                focusSink.style.height = '1px';
                focusSink.style.left = '-9999px';
                focusSink.style.top = '0';
                document.body.appendChild(focusSink);
            }
            if (modalEl.contains(document.activeElement)) {
                document.getElementById('adminNav')?.focus?.();
                focusSink.focus();
            }
            modalEl.classList.remove('active');
            modalEl.setAttribute('aria-hidden', 'true');
        };

        if (closeViewArtistModal) {
            closeViewArtistModal.addEventListener('click', () => {
                closeViewModalSafe(viewArtistModal);
            });
        }
        if (closeViewArtistModalBtn) {
            closeViewArtistModalBtn.addEventListener('click', () => {
                closeViewModalSafe(viewArtistModal);
            });
        }
        if (editFromViewArtist) {
            editFromViewArtist.addEventListener('click', () => {
                const artistId = viewArtistModal.dataset.artistId;
                if (!artistId) return;
                if (this.artistModalMode === 'view') {
                    this.enterArtistEditMode();
                } else {
                    this.saveArtistFromViewModal();
                }
            });
        }

        if (viewArtistModalCancelEdit) {
            viewArtistModalCancelEdit.addEventListener('click', () => {
                this.exitArtistEditMode();
            });
        }

        // View track modal event listeners
        const closeViewTrackModal = document.getElementById('closeViewTrackModal');
        const closeViewTrackModalBtn = document.getElementById('closeViewTrackModalBtn');
        const editFromViewTrack = document.getElementById('editFromViewTrack');
        const viewTrackModal = document.getElementById('viewTrackModal');

        if (closeViewTrackModal) {
            closeViewTrackModal.addEventListener('click', () => {
                closeViewModalSafe(viewTrackModal);
            });
        }
        if (closeViewTrackModalBtn) {
            closeViewTrackModalBtn.addEventListener('click', () => {
                closeViewModalSafe(viewTrackModal);
            });
        }
        if (editFromViewTrack) {
            editFromViewTrack.addEventListener('click', () => {
                const trackId = viewTrackModal.dataset.trackId;
                closeViewModalSafe(viewTrackModal);
                if (trackId) {
                    this.editTrack(trackId);
                }
            });
        }

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

        const audioUploadArea = document.getElementById('audioUploadArea');
        const audioFileInput = document.getElementById('audioFile');
        const fileInfo = document.getElementById('fileInfo');

        if (audioUploadArea && audioFileInput) {
            audioUploadArea.addEventListener('click', () => {
                audioFileInput.click();
            });

            audioFileInput.addEventListener('change', () => {
                if (!fileInfo) return;
                const f = audioFileInput.files && audioFileInput.files[0];
                const titleInput = document.getElementById('trackTitle');
                const releaseDateInput = document.getElementById('releaseDate');
                const durationInput = document.getElementById('trackDuration');

                if (!f) {
                    fileInfo.classList.remove('show');
                    fileInfo.textContent = '';
                    if (durationInput) durationInput.value = '';
                    return;
                }

                fileInfo.classList.add('show');
                fileInfo.textContent = `${f.name} (${Math.round(f.size / 1024 / 1024 * 10) / 10} MB)`;

                if (titleInput && !titleInput.value) {
                    const base = f.name.replace(/\.[^/.]+$/, '');
                    const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
                    titleInput.value = cleaned;
                }

                if (releaseDateInput && !releaseDateInput.value) {
                    releaseDateInput.value = new Date().toISOString().split('T')[0];
                }

                if (durationInput) {
                    durationInput.value = '';
                    try {
                        const objectUrl = URL.createObjectURL(f);
                        const audioProbe = new Audio();
                        audioProbe.preload = 'metadata';
                        audioProbe.src = objectUrl;
                        audioProbe.addEventListener('loadedmetadata', () => {
                            URL.revokeObjectURL(objectUrl);
                            const seconds = audioProbe.duration;
                            if (!seconds || !isFinite(seconds)) return;
                            const mins = Math.floor(seconds / 60);
                            const secs = Math.floor(seconds % 60);
                            durationInput.value = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                        }, { once: true });
                        audioProbe.addEventListener('error', () => {
                            URL.revokeObjectURL(objectUrl);
                        }, { once: true });
                    } catch (_) {
                        // ignore
                    }
                }
            });
        }

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

        this.showNotification('Track data imported from Spotify. Please upload audio file to complete.', 'success');
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
                            <button class="btn btn-primary btn-sm" onclick="adminPanel.editArtist('${artist.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="adminPanel.viewArtist('${artist.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteArtist('${artist.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
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
                            <button class="btn btn-primary btn-sm" onclick="adminPanel.editTrack('${track.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="adminPanel.viewTrack('${track.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteTrack('${track.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async loadArtistsForSelect() {
        const artistSelect = document.getElementById('trackArtist');
        if (!artistSelect) return;
        
        const artists = await window.fetchArtists();
        // Preserve the Firestore-powered artist select behavior, including "+ Add new artist..."
        // (admin-firebase.js relies on the special __add_new__ option).
        artistSelect.innerHTML = '<option value="">Select Artist</option>' +
            '<option value="__add_new__">+ Add new artist...</option>' +
            artists.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    }

    async loadPayments() {
        const table = document.getElementById('paymentsTable');
        if (!table) return;
        
        const payments = await window.fetchPayments();
        
        if (payments.length === 0) {
            table.innerHTML = '<tr><td colspan="7" class="text-center">No payments found</td></tr>';
            return;
        }
        table.innerHTML = payments.map(payment => `
            <tr>
                <td>${payment.id}</td>
                <td>${payment.fullName || payment.artist || 'Unknown'}</td>
                <td>UGX ${this.formatNumber(payment.amount || 0)}</td>
                <td>${payment.billingCycle || payment.service || 'Membership'}</td>
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
                            <button class="btn btn-primary btn-sm" onclick="adminPanel.editTeamMember('${member.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteTeamMember('${member.id}')">
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
        this.openTeamMemberModal();
    }

    editTeamMember(memberId) {
        // Fetch team member data and populate modal
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
                this.openTeamMemberModal(member);
            } else {
                this.showNotification('Team member not found', 'error');
            }
        } catch (error) {
            console.error('Error loading team member:', error);
            this.showNotification('Error loading team member: ' + error.message, 'error');
        }
    }

    openTeamMemberModal(member = null) {
        const modal = document.getElementById('addTeamMemberModal');
        const form = document.getElementById('addTeamMemberForm');
        const modalTitle = document.getElementById('teamModalTitle');
        
        if (!modal || !form) return;

        // Reset form
        form.reset();
        document.getElementById('teamMemberImagePreview').classList.remove('is-visible');
        document.getElementById('teamMemberImagePreview').style.backgroundImage = '';

        if (member) {
            // Edit mode
            modalTitle.textContent = 'Edit Team Member';
            document.getElementById('teamMemberName').value = member.name || '';
            document.getElementById('teamMemberRole').value = member.role || '';
            document.getElementById('teamMemberBadge').value = member.badge || '';
            document.getElementById('teamMemberBio').value = member.bio || '';
            document.getElementById('teamMemberSkills').value = (member.skills || []).join(', ');
            document.getElementById('teamMemberStatus').value = member.status || 'active';
            
            if (member.image) {
                const preview = document.getElementById('teamMemberImagePreview');
                preview.classList.add('is-visible');
                preview.style.backgroundImage = `url('${member.image}')`;
            }
            
            this.editingItem = { type: 'team', id: member.id, data: member };
        } else {
            // Add mode
            modalTitle.textContent = 'Add New Team Member';
            this.editingItem = null;
        }

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    closeTeamMemberModal() {
        const modal = document.getElementById('addTeamMemberModal');
        if (modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
        this.editingItem = null;
    }

    async saveTeamMember() {
        const form = document.getElementById('addTeamMemberForm');
        const name = document.getElementById('teamMemberName').value.trim();
        const role = document.getElementById('teamMemberRole').value.trim();
        const badge = document.getElementById('teamMemberBadge').value.trim();
        const bio = document.getElementById('teamMemberBio').value.trim();
        const skills = document.getElementById('teamMemberSkills').value.split(',').map(s => s.trim()).filter(s => s);
        const status = document.getElementById('teamMemberStatus').value;
        const imageInput = document.getElementById('teamMemberImage');

        if (!name || !role) {
            this.showNotification('Name and role are required', 'error');
            return;
        }

        try {
            let imageUrl = '';
            
            // Handle image upload if file selected
            if (imageInput.files && imageInput.files[0]) {
                imageUrl = await this.handleImageUpload(imageInput.files[0]);
            } else if (this.editingItem && this.editingItem.data.image) {
                imageUrl = this.editingItem.data.image;
            }

            const memberData = {
                name,
                role,
                badge,
                bio,
                skills,
                status,
                image: imageUrl || 'https://via.placeholder.com/250',
                createdAt: new Date().toISOString()
            };

            const { db } = await import('../scripts/firebase-init.js');
            const { collection, addDoc, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

            if (this.editingItem && this.editingItem.id) {
                // Update existing team member
                const docRef = doc(db, 'team', this.editingItem.id);
                delete memberData.createdAt; // Don't update creation time
                memberData.updatedAt = new Date().toISOString();
                await updateDoc(docRef, memberData);
                this.showNotification('Team member updated successfully!', 'success');
            } else {
                // Add new team member
                await addDoc(collection(db, 'team'), memberData);
                this.showNotification('Team member added successfully!', 'success');
            }

            this.closeTeamMemberModal();
            this.loadTeam();
        } catch (error) {
            console.error('Error saving team member:', error);
            this.showNotification('Error saving team member: ' + error.message, 'error');
        }
    }

    async deleteTeamMember(memberId) {
        let ok = false;
        if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm('Are you sure you want to delete this team member?', 'Delete Team Member', 'warning');
        } else {
            ok = confirm('Are you sure you want to delete this team member?');
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

    async loadSettings() {
        // Load settings from Firebase config
        try {
            const { getConfig } = await import('../scripts/config-loader.js');
            const config = getConfig();
            
            // Populate payment settings form
            if (config.payment) {
                document.getElementById('mtnNumber').value = config.payment.mtn || '';
                document.getElementById('airtelNumber').value = config.payment.airtel || '';
                document.getElementById('bankName').value = config.payment.bank?.name || '';
                document.getElementById('bankAccount').value = config.payment.bank?.account || '';
                document.getElementById('bankAccountName').value = config.payment.bank?.accountName || '';
                document.getElementById('supportPhone').value = config.payment.supportPhone || '';
            }
            
            // Populate plans settings form
            if (config.plans) {
                document.getElementById('weeklyPrice').value = config.plans.weekly?.price || '';
                document.getElementById('weeklyDescription').value = config.plans.weekly?.description || '';
                document.getElementById('monthlyPrice').value = config.plans.monthly?.price || '';
                document.getElementById('monthlyDescription').value = config.plans.monthly?.description || '';
                document.getElementById('yearlyPrice').value = config.plans.yearly?.price || '';
                document.getElementById('yearlyDescription').value = config.plans.yearly?.description || '';
                document.getElementById('monthlySavings').value = config.plans.monthly?.savings || '';
                document.getElementById('yearlySavings').value = config.plans.yearly?.savings || '';
            }
            
            // Populate service pricing form
            if (config.services) {
                document.getElementById('productionPrice').value = config.services.production || '';
                document.getElementById('mixingPrice').value = config.services.mixing || '';
                document.getElementById('masteringPrice').value = config.services.mastering || '';
                document.getElementById('vocalPrice').value = config.services.vocal || '';
                document.getElementById('hourlyRate').value = config.services.hourlyRate || '';
                document.getElementById('packagePrice').value = config.services.packagePrice || '';
                document.getElementById('songwritingPrice').value = config.services.songwriting || '';
                document.getElementById('restorationPrice').value = config.services.restoration || '';
                document.getElementById('sessionMusicianMin').value = config.services.sessionMusicianMin || '';
                document.getElementById('sessionMusicianMax').value = config.services.sessionMusicianMax || '';
            }
            
            // Populate budget tiers form
            if (config.budgetTiers) {
                document.getElementById('budgetStandard').value = config.budgetTiers.standard || '';
                document.getElementById('budgetClassic').value = config.budgetTiers.classic || '';
                document.getElementById('budgetPremium').value = config.budgetTiers.premium || '';
                document.getElementById('budgetDeluxe').value = config.budgetTiers.deluxe || '';
            }
            
            // Populate contact information form
            if (config.contact) {
                document.getElementById('contactPhone').value = config.contact.phone || '';
                document.getElementById('contactEmail').value = config.contact.email || '';
                document.getElementById('contactLocation').value = config.contact.location || '';
            }
            
            // Populate about page stats form
            if (config.about) {
                document.getElementById('statProjects').value = config.about.projects || '';
                document.getElementById('statArtists').value = config.about.artists || '';
                document.getElementById('statStreams').value = config.about.streams || '';
            }
            
            // Populate social media links form
            if (config.social) {
                document.getElementById('socialInstagram').value = config.social.instagram || '';
                document.getElementById('socialYouTube').value = config.social.youtube || '';
                document.getElementById('socialTikTok').value = config.social.tiktok || '';
                document.getElementById('socialTwitter').value = config.social.twitter || '';
                document.getElementById('socialSpotify').value = config.social.spotify || '';
            }
            
            // Setup save button handler
            this.setupSettingsSaveHandler();

            // Dirty state tracking for settings
            this.setupSettingsDirtyTracking();
            this.setSettingsDirty(false);
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showNotification('Error loading settings. Config loader may not be available yet.', 'error');
        }
    }

    setupSettingsDirtyTracking() {
        if (this.settingsDirtyBound) return;
        const section = document.getElementById('settings');
        if (!section) return;

        this.settingsDirtyBound = true;
        const markDirty = () => this.setSettingsDirty(true);
        section.querySelectorAll('input, textarea, select').forEach((el) => {
            el.addEventListener('input', markDirty);
            el.addEventListener('change', markDirty);
        });
    }

    setSettingsDirty(isDirty) {
        this.settingsDirty = Boolean(isDirty);
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.disabled = !this.settingsDirty;
            saveBtn.classList.toggle('btn-disabled', !this.settingsDirty);
        }
    }

    setupSettingsSaveHandler() {
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                await this.saveSettings();
            };
        }
    }

    async saveSettings() {
        try {
            const { saveSettings: saveToFirebase } = await import('../scripts/config-loader.js');

            const saveBtn = document.getElementById('saveSettings');
            if (saveBtn) {
                saveBtn.disabled = true;
            }
            
            const config = {
                payment: {
                    mtn: document.getElementById('mtnNumber').value,
                    airtel: document.getElementById('airtelNumber').value,
                    bank: {
                        name: document.getElementById('bankName').value,
                        account: document.getElementById('bankAccount').value,
                        accountName: document.getElementById('bankAccountName').value
                    },
                    supportPhone: document.getElementById('supportPhone').value
                },
                plans: {
                    weekly: {
                        price: parseInt(document.getElementById('weeklyPrice').value) || 0,
                        description: document.getElementById('weeklyDescription').value
                    },
                    monthly: {
                        price: parseInt(document.getElementById('monthlyPrice').value) || 0,
                        description: document.getElementById('monthlyDescription').value,
                        savings: document.getElementById('monthlySavings').value
                    },
                    yearly: {
                        price: parseInt(document.getElementById('yearlyPrice').value) || 0,
                        description: document.getElementById('yearlyDescription').value,
                        savings: document.getElementById('yearlySavings').value
                    }
                },
                services: {
                    production: parseInt(document.getElementById('productionPrice').value) || 0,
                    mixing: parseInt(document.getElementById('mixingPrice').value) || 0,
                    mastering: parseInt(document.getElementById('masteringPrice').value) || 0,
                    vocal: parseInt(document.getElementById('vocalPrice').value) || 0,
                    hourlyRate: parseInt(document.getElementById('hourlyRate').value) || 0,
                    packagePrice: parseInt(document.getElementById('packagePrice').value) || 0,
                    songwriting: parseInt(document.getElementById('songwritingPrice').value) || 0,
                    restoration: parseInt(document.getElementById('restorationPrice').value) || 0,
                    sessionMusicianMin: parseInt(document.getElementById('sessionMusicianMin').value) || 0,
                    sessionMusicianMax: parseInt(document.getElementById('sessionMusicianMax').value) || 0
                },
                budgetTiers: {
                    standard: parseInt(document.getElementById('budgetStandard').value) || 0,
                    classic: parseInt(document.getElementById('budgetClassic').value) || 0,
                    premium: parseInt(document.getElementById('budgetPremium').value) || 0,
                    deluxe: parseInt(document.getElementById('budgetDeluxe').value) || 0
                },
                contact: {
                    phone: document.getElementById('contactPhone').value,
                    email: document.getElementById('contactEmail').value,
                    location: document.getElementById('contactLocation').value,
                    whatsapp: document.getElementById('whatsappNumber').value
                },
                about: {
                    projects: document.getElementById('statProjects').value,
                    artists: document.getElementById('statArtists').value,
                    streams: document.getElementById('statStreams').value
                },
                social: {
                    instagram: document.getElementById('socialInstagram').value,
                    youtube: document.getElementById('socialYouTube').value,
                    tiktok: document.getElementById('socialTikTok').value,
                    twitter: document.getElementById('socialTwitter').value,
                    spotify: document.getElementById('socialSpotify').value
                }
            };
            
            await saveToFirebase(config);
            this.showNotification('Settings saved successfully!', 'success');
            this.setSettingsDirty(false);
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Error saving settings: ' + error.message, 'error');
        } finally {
            const saveBtn = document.getElementById('saveSettings');
            if (saveBtn) {
                saveBtn.disabled = !this.settingsDirty;
            }
        }
    }

    async editArtist(artistId) {
        // Always use the View Artist modal for editing (single-modal UX)
        try {
            await this.viewArtist(artistId);
            // Wait a tick to ensure the modal has rendered its DOM content
            setTimeout(() => {
                this.enterArtistEditMode();
            }, 0);
        } catch (error) {
            console.error('Error opening artist editor:', error);
            this.showNotification('Failed to open artist editor: ' + error.message, 'error');
        }
    }

    async handleImageUpload(file) {
        // For demo purposes, convert to data URL
        // In production, upload to Firebase Storage
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async viewArtist(artistId) {
        try {
            const artists = await window.fetchArtists();
            const tracks = await window.fetchTracks();
            const artist = (artists || []).find(a => a.id === artistId);
            if (!artist) {
                this.showNotification('Artist not found', 'error');
                return;
            }

            const artistTracks = (tracks || []).filter(t => String(t.artist || '') === String(artistId));
            const totalStreams = artistTracks.reduce((sum, t) => sum + (t.streams || 0), 0);

            // Populate artist detail modal
            const modal = document.getElementById('viewArtistModal');
            const image = document.getElementById('viewArtistImage');
            const name = document.getElementById('viewArtistName');
            const genre = document.getElementById('viewArtistGenre');
            const tracksCount = document.getElementById('viewArtistTracks');
            const streams = document.getElementById('viewArtistStreams');
            const status = document.getElementById('viewArtistStatus');
            const bio = document.getElementById('viewArtistBio');
            const tracksList = document.getElementById('viewArtistTracksList');

            image.src = artist.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"%3E%3Crect width="150" height="150" fill="%23667eea"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E%3F%3C/text%3E%3C/svg%3E';
            image.alt = artist.name || 'Artist';
            name.textContent = artist.name || 'Unnamed';
            genre.textContent = artist.genre || 'No genre';
            tracksCount.textContent = artistTracks.length;
            streams.textContent = totalStreams.toLocaleString();
            status.textContent = artist.status || 'active';
            bio.textContent = artist.bio || 'No bio available';

            // Populate tracks list
            if (artistTracks.length > 0) {
                const maxItems = 4;
                const visibleTracks = artistTracks.slice(0, maxItems);
                const remaining = Math.max(artistTracks.length - visibleTracks.length, 0);

                tracksList.innerHTML = visibleTracks.map(track => `
                    <div class="track-list-item">
                        <div class="track-list-item-image" style="${track.artwork ? `background-image: url('${track.artwork}')` : 'background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}"></div>
                        <div class="track-list-item-info">
                            <div class="track-list-item-title">${track.title || 'Untitled'}</div>
                            <div class="track-list-item-meta">${track.genre || 'No genre'} • ${track.duration || '0:00'}</div>
                        </div>
                    </div>
                `).join('') + (remaining > 0 ? `<div class="track-list-item-meta" style="padding-top: 0.5rem;">And ${remaining} more...</div>` : '');
            } else {
                tracksList.innerHTML = '<p style="color: var(--text-secondary);">No tracks yet</p>';
            }

            // Show modal
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');

            // Store artist ID for edit button
            modal.dataset.artistId = artistId;

            // Ensure view mode each time we open
            this.artistModalSnapshot = {
                name: artist.name || '',
                genre: artist.genre || '',
                bio: artist.bio || '',
                status: artist.status || 'active'
            };
            this.artistModalMode = 'view';
            this.applyArtistModalMode();
        } catch (error) {
            console.error('Error viewing artist:', error);
            this.showNotification('Error loading artist: ' + error.message, 'error');
        }
    }

    applyArtistModalMode() {
        const modal = document.getElementById('viewArtistModal');
        if (!modal) return;

        const editBtn = document.getElementById('editFromViewArtist');
        const cancelBtn = document.getElementById('cancelEditFromViewArtist');

        const isEdit = this.artistModalMode === 'edit';
        modal.classList.toggle('is-editing', isEdit);

        if (editBtn) {
            editBtn.innerHTML = isEdit ? '<i class="fas fa-save"></i> Save Changes' : 'Edit Artist';
        }
        if (cancelBtn) {
            cancelBtn.style.display = isEdit ? '' : 'none';
        }
    }

    enterArtistEditMode() {
        if (this.artistModalMode === 'edit') return;

        const modal = document.getElementById('viewArtistModal');
        if (!modal) return;

        const nameEl = document.getElementById('viewArtistName');
        const genreEl = document.getElementById('viewArtistGenre');
        const bioEl = document.getElementById('viewArtistBio');
        const statusEl = document.getElementById('viewArtistStatus');

        const snap = this.artistModalSnapshot || {
            name: nameEl?.textContent || '',
            genre: genreEl?.textContent || '',
            bio: bioEl?.textContent || '',
            status: statusEl?.textContent || 'active'
        };
        this.artistModalSnapshot = snap;

        if (nameEl) {
            nameEl.innerHTML = `<input id="viewArtistNameInput" type="text" value="${this.escapeHtml(snap.name)}" class="modal-inline-input" />`;
        }
        if (genreEl) {
            genreEl.innerHTML = `<input id="viewArtistGenreInput" type="text" value="${this.escapeHtml(snap.genre)}" class="modal-inline-input" placeholder="Genre" />`;
        }
        if (bioEl) {
            bioEl.innerHTML = `<textarea id="viewArtistBioInput" class="modal-inline-textarea" rows="4" placeholder="Bio">${this.escapeHtml(snap.bio)}</textarea>`;
        }
        if (statusEl) {
            const cur = String(snap.status || 'active');
            statusEl.innerHTML = `
                <select id="viewArtistStatusInput" class="modal-inline-select">
                    <option value="active" ${cur === 'active' ? 'selected' : ''}>active</option>
                    <option value="inactive" ${cur === 'inactive' ? 'selected' : ''}>inactive</option>
                </select>
            `;
        }

        this.artistModalMode = 'edit';
        this.applyArtistModalMode();
    }

    exitArtistEditMode() {
        if (this.artistModalMode !== 'edit') return;

        const snap = this.artistModalSnapshot;
        if (!snap) {
            this.artistModalMode = 'view';
            this.applyArtistModalMode();
            return;
        }

        const nameEl = document.getElementById('viewArtistName');
        const genreEl = document.getElementById('viewArtistGenre');
        const bioEl = document.getElementById('viewArtistBio');
        const statusEl = document.getElementById('viewArtistStatus');

        if (nameEl) nameEl.textContent = snap.name;
        if (genreEl) genreEl.textContent = snap.genre;
        if (bioEl) bioEl.textContent = snap.bio || 'No bio available';
        if (statusEl) statusEl.textContent = snap.status;

        this.artistModalMode = 'view';
        this.applyArtistModalMode();
    }

    async saveArtistFromViewModal() {
        const modal = document.getElementById('viewArtistModal');
        const artistId = modal?.dataset?.artistId;
        if (!artistId) return;

        const name = document.getElementById('viewArtistNameInput')?.value?.trim() || '';
        const genre = document.getElementById('viewArtistGenreInput')?.value?.trim() || '';
        const bio = document.getElementById('viewArtistBioInput')?.value?.trim() || '';
        const status = document.getElementById('viewArtistStatusInput')?.value || 'active';

        if (!name) {
            this.showNotification('Artist name is required', 'error');
            return;
        }

        try {
            if (typeof window.updateArtistInFirestore !== 'function') {
                throw new Error('updateArtistInFirestore is not available');
            }

            await window.updateArtistInFirestore(artistId, {
                name,
                genre,
                bio,
                status
            });

            this.artistModalSnapshot = { name, genre, bio, status };
            this.showNotification('Artist updated successfully', 'success');

            if (typeof window.renderArtistsTable === 'function') {
                await window.renderArtistsTable();
            }
            await this.loadArtists();
            await this.viewArtist(artistId);
        } catch (error) {
            console.error('Error saving artist:', error);
            this.showNotification('Failed to save artist: ' + error.message, 'error');
        }
    }

    escapeHtml(input) {
        const str = String(input ?? '');
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async deleteArtist(artistId) {
        // Use the richer delete flow from admin-firebase.js (includes refresh + name in prompt)
        if (typeof window.deleteArtist === 'function') {
            try {
                const artists = await window.fetchArtists();
                const artist = (artists || []).find(a => a.id === artistId);
                const name = artist?.name || 'Unknown';
                await window.deleteArtist(artistId, name);
                // Ensure the table in this script refreshes too
                await this.loadArtists();
            } catch (error) {
                console.error('Error deleting artist:', error);
                this.showNotification('Failed to delete artist: ' + error.message, 'error');
            }
            return;
        }

        // Fallback: direct Firestore delete if available
        let ok = false;
        if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm('Are you sure you want to delete this artist?', 'Delete Artist', 'warning');
        } else {
            ok = confirm('Are you sure you want to delete this artist?');
        }
        if (!ok) return;

        try {
            await window.deleteArtistFromFirestore?.(artistId);
            this.showNotification('Artist deleted successfully!', 'success');
            this.loadArtists();
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
            this.openTrackEditModal(track);
        } catch (error) {
            console.error('Error fetching track:', error);
            this.showNotification('Error loading track: ' + error.message, 'error');
        }
    }

    openTrackEditModal(track) {
        // Navigate to music-management section and populate form
        this.showSection('music-management');
        
        setTimeout(() => {
            const titleInput = document.getElementById('trackTitle');
            const artistInput = document.getElementById('trackArtist');
            const genreInput = document.getElementById('trackGenre');
            const durationInput = document.getElementById('trackDuration');
            const releaseDateInput = document.getElementById('releaseDate');
            const descriptionInput = document.getElementById('trackDescription');
            const artworkPreview = document.getElementById('artworkPreview');
            
            if (titleInput) titleInput.value = track.title || '';
            if (artistInput) artistInput.value = track.artist || '';
            if (genreInput) genreInput.value = track.genre || '';
            if (durationInput) durationInput.value = track.duration || '';
            if (releaseDateInput) releaseDateInput.value = track.releaseDate || '';
            if (descriptionInput) descriptionInput.value = track.description || '';
            
            if (track.artwork && artworkPreview) {
                artworkPreview.classList.add('has-image');
                artworkPreview.style.backgroundImage = `url('${track.artwork}')`;
            }
            
            // Set editing state
            this.editingItem = { type: 'track', id: track.id, data: track };
            
            // Change button text to indicate edit mode
            const submitBtn = document.querySelector('#audioUploadForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Track';
            }
            
            this.showNotification('Editing track: ' + track.title, 'info');
        }, 300);
    }

    async viewTrack(trackId) {
        try {
            const tracks = await window.fetchTracks();
            const track = tracks.find(t => t.id === trackId);
            if (!track) {
                this.showNotification('Track not found', 'error');
                return;
            }

            const artists = await window.fetchArtists();
            const artist = artists.find(a => a.id === track.artist);

            // Populate track detail modal
            const modal = document.getElementById('viewTrackModal');
            const artwork = document.getElementById('viewTrackArtwork');
            const title = document.getElementById('viewTrackTitle');
            const artistName = document.getElementById('viewTrackArtist');
            const genre = document.getElementById('viewTrackGenre');
            const streams = document.getElementById('viewTrackStreams');
            const duration = document.getElementById('viewTrackDuration');
            const status = document.getElementById('viewTrackStatus');
            const releaseDate = document.getElementById('viewTrackReleaseDate');
            const description = document.getElementById('viewTrackDescription');
            const platformLinks = document.getElementById('viewTrackPlatformLinks');

            artwork.src = track.artwork || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"%3E%3Crect width="180" height="180" fill="%23f093fb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E%26%239835%3B%3C/text%3E%3C/svg%3E';
            artwork.alt = track.title || 'Track';
            title.textContent = track.title || 'Untitled';
            artistName.textContent = artist?.name || 'Unknown Artist';
            genre.textContent = track.genre || 'No genre';
            streams.textContent = (track.streams || 0).toLocaleString();
            duration.textContent = track.duration || '0:00';
            status.textContent = track.status || 'published';
            releaseDate.textContent = track.releaseDate || 'Not set';
            description.textContent = track.description || 'No description available';

            // Populate platform links
            const links = track.platformLinks || {};
            const platforms = [
                { key: 'spotify', name: 'Spotify', icon: 'fa-spotify' },
                { key: 'appleMusic', name: 'Apple Music', icon: 'fa-apple' },
                { key: 'youtube', name: 'YouTube', icon: 'fa-youtube' },
                { key: 'soundcloud', name: 'SoundCloud', icon: 'fa-soundcloud' },
                { key: 'tidal', name: 'Tidal', icon: 'fa-music' },
                { key: 'amazon', name: 'Amazon Music', icon: 'fa-amazon' },
            ];

            const validLinks = platforms
                .filter(p => links[p.key])
                .map(p => `
                    <a href="${links[p.key]}" target="_blank" rel="noopener noreferrer" class="platform-link">
                        <i class="fab ${p.icon}"></i>
                        ${p.name}
                    </a>
                `).join('');

            platformLinks.innerHTML = validLinks || '<p style="color: var(--text-secondary);">No platform links available</p>';

            // Show modal
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');

            // Store track ID for edit button
            modal.dataset.trackId = trackId;
        } catch (error) {
            console.error('Error fetching track:', error);
            this.showNotification('Error loading track: ' + error.message, 'error');
        }
    }

    async deleteTrack(trackId) {
        let ok = false;
        if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm('Are you sure you want to delete this track?', 'Delete Track', 'warning');
        } else {
            ok = confirm('Are you sure you want to delete this track?');
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

    viewPayment(paymentId) {
        const message = `Viewing payment: ${paymentId}`;
        if (window.notifications) {
            window.notifications.show(message, 'info');
        } else {
            console.log(message);
        }
    }

    addNewArtist() {
        // Add artist modal is managed by admin-firebase.js
        document.getElementById('addArtistBtn')?.click();
    }

    addNewTrack() {
        this.showSection('music-management');
        this.resetUploadForm();
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
        
        // Reset button text
        const submitBtn = document.querySelector('#audioUploadForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Track';
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
        const audioFile = document.getElementById('audioFile').files[0];
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
        
        try {
            let artworkUrl = spotifyArtworkUrl || 'https://via.placeholder.com/300?text=Track';
            
            // Handle artwork upload
            if (artworkFile) {
                artworkUrl = await this.handleImageUpload(artworkFile);
            }
            
            // Handle audio file (in production, upload to Firebase Storage)
            let audioUrl = '';
            if (audioFile) {
                audioUrl = await this.handleAudioFileUpload(audioFile);
            }
            
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
                    this.showNotification('Track uploaded successfully!', 'success');
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

    async handleAudioFileUpload(file) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve('https://via.placeholder.com/audio');
            }, 500);
        });
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
        document.getElementById('externalArtist').value = artist;

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
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            
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

        if (artistInput && metadata.artist) {
            artistInput.value = metadata.artist;
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

            const trackData = {
                title,
                artist: artist,
                artistName: artist,
                genre: genre || 'Unknown',
                duration: duration,
                externalUrl: url,
                platform,
                artwork: artwork,
                streams: 0,
                likes: 0,
                downloads: 0,
                status: 'published',
                audioUrl: '', // External tracks don't have local audio
            };

            // Save to Firestore if available
            if (window.saveTrackToFirestore) {
                await window.saveTrackToFirestore(trackData);
                this.showNotification('External track added to Firestore successfully!', 'success');
            } else {
                this.showNotification('Firestore integration is not available. Please refresh the page.', 'error');
                return;
            }

            // Reset form and refresh table
            this.resetExternalForm();
            this.loadTracks();
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

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
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
            localStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminToken');
            window.location.href = 'index.html';
        }
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