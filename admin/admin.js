// admin.js - Simplified Working Version
class AdminPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.dataManager = window.dataManager;
        this.editingItem = null;

        if (!this.dataManager) {
            console.error('DataManager not found!');
            this.showError('Data Manager not initialized. Please refresh the page.');
            return;
        }

        this.init();
    }

    init() {
        console.log('AdminPanel initializing...');
        this.setupEventListeners();
        this.showSection('dashboard');

        window.addEventListener('dataUpdated', () => {
            this.loadSectionData(this.currentSection);
        });

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
            });
        });

        const navToggle = document.getElementById('navToggle');
        if (navToggle) {
            navToggle.addEventListener('click', () => {
                document.querySelector('.nav-content')?.classList.toggle('active');
            });
        }

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

        document.getElementById('addTrackBtn')?.addEventListener('click', () => {
            this.addNewTrack();
        });

        document.getElementById('addArtistBtn')?.addEventListener('click', () => {
            this.openArtistModal();
        });

        document.getElementById('closeAddArtistModal')?.addEventListener('click', () => {
            this.closeArtistModal();
        });

        document.getElementById('cancelAddArtist')?.addEventListener('click', () => {
            this.closeArtistModal();
        });

        document.getElementById('addArtistForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveArtist();
        });

        // Artist image preview
        const artistImageInput = document.getElementById('artistImage');
        if (artistImageInput) {
            artistImageInput.addEventListener('change', () => {
                const file = artistImageInput.files && artistImageInput.files[0];
                const preview = document.getElementById('artistImagePreview');
                if (file && preview) {
                    const url = URL.createObjectURL(file);
                    preview.classList.add('is-visible');
                    preview.style.backgroundImage = `url('${url}')`;
                }
            });
        }

        // Music management form handlers
        document.getElementById('audioUploadForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAudioUpload();
        });

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
                // No results found - show manual instructions
                resultsContainer.innerHTML = `
                    <div class="spotify-search-info">
                        <p><i class="fas fa-info-circle"></i> No Spotify links found for "${query}"</p>
                        <p>To import from Spotify:</p>
                        <ol>
                            <li>Go to <a href="https://open.spotify.com" target="_blank" style="color: #1DB954;">Spotify</a> and search for your track</li>
                            <li>Copy the track URL (e.g., https://open.spotify.com/track/...)</li>
                            <li>Paste it in the "Spotify Track URL" field above</li>
                            <li>Click "Import Track"</li>
                        </ol>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Web search error:', error);
            // Fallback to manual instructions
            resultsContainer.innerHTML = `
                <div class="spotify-search-info">
                    <p><i class="fas fa-info-circle"></i> Web search unavailable</p>
                    <p>Please manually find the track on Spotify and paste the URL below.</p>
                    <ol>
                        <li>Go to <a href="https://open.spotify.com" target="_blank" style="color: #1DB954;">Spotify</a> and search for your track</li>
                        <li>Copy the track URL (e.g., https://open.spotify.com/track/...)</li>
                        <li>Paste it in the "Spotify Track URL" field above</li>
                        <li>Click "Import Track"</li>
                    </ol>
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
            const artists = this.dataManager.getAllArtists();
            const matchingArtist = artists.find(a => 
                a.name.toLowerCase() === this.selectedSpotifyTrack.artist.toLowerCase()
            );
            if (matchingArtist) {
                artistInput.value = matchingArtist.id;
            } else {
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
        this.loadSectionData(sectionId);
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
        artistSelect.innerHTML = '<option value="">Select Artist</option>' + 
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
        // Team section functionality to be implemented
        const table = document.getElementById('teamTable');
        if (table) {
            table.innerHTML = '<tr><td colspan="7" class="text-center">Team management coming soon</td></tr>';
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
            
            // Setup save button handler
            this.setupSettingsSaveHandler();
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showNotification('Error loading settings. Config loader may not be available yet.', 'error');
        }
    }

    setupSettingsSaveHandler() {
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                this.saveSettings();
            };
        }
    }

    async saveSettings() {
        try {
            const { saveSettings: saveToFirebase } = await import('../scripts/config-loader.js');
            
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
                    location: document.getElementById('contactLocation').value
                },
                about: {
                    projects: document.getElementById('statProjects').value,
                    artists: document.getElementById('statArtists').value,
                    streams: document.getElementById('statStreams').value
                }
            };
            
            await saveToFirebase(config);
            this.showNotification('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Error saving settings: ' + error.message, 'error');
        }
    }

    editArtist(artistId) {
        const artist = this.dataManager.getArtist(artistId);
        if (artist) {
            this.openArtistModal(artist);
        }
    }

    openArtistModal(artist = null) {
        const modal = document.getElementById('addArtistModal');
        const form = document.getElementById('addArtistForm');
        const modalTitle = modal.querySelector('.modal-header h3');
        
        if (!modal || !form) return;

        // Reset form
        form.reset();
        document.getElementById('artistImagePreview').classList.remove('is-visible');
        document.getElementById('artistImagePreview').style.backgroundImage = '';

        if (artist) {
            // Edit mode
            modalTitle.textContent = 'Edit Artist';
            document.getElementById('artistName').value = artist.name || '';
            document.getElementById('artistGenre').value = artist.genre || '';
            document.getElementById('artistBio').value = artist.bio || '';
            
            if (artist.image) {
                const preview = document.getElementById('artistImagePreview');
                preview.classList.add('is-visible');
                preview.style.backgroundImage = `url('${artist.image}')`;
            }
            
            this.editingItem = { type: 'artist', id: artist.id, data: artist };
        } else {
            // Add mode
            modalTitle.textContent = 'Add New Artist';
            this.editingItem = null;
        }

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    closeArtistModal() {
        const modal = document.getElementById('addArtistModal');
        if (modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
        this.editingItem = null;
    }

    async saveArtist() {
        const form = document.getElementById('addArtistForm');
        const name = document.getElementById('artistName').value.trim();
        const genre = document.getElementById('artistGenre').value.trim();
        const bio = document.getElementById('artistBio').value.trim();
        const imageInput = document.getElementById('artistImage');

        if (!name) {
            this.showNotification('Artist name is required', 'error');
            return;
        }

        try {
            let imageUrl = '';
            
            // Handle image upload if file selected
            if (imageInput.files && imageInput.files[0]) {
                // For now, use a placeholder or data URL
                // In production, this should upload to Firebase Storage
                imageUrl = await this.handleImageUpload(imageInput.files[0]);
            } else if (this.editingItem && this.editingItem.data.image) {
                imageUrl = this.editingItem.data.image;
            }

            const artistData = {
                name,
                genre: genre || 'Unknown',
                bio,
                image: imageUrl || 'https://via.placeholder.com/150?text=Artist',
                status: 'active',
                tracks: 0
            };

            if (this.editingItem && this.editingItem.id) {
                // Update existing artist
                artistData.id = this.editingItem.id;
                artistData.tracks = this.editingItem.data.tracks;
                this.dataManager.saveArtist(artistData);
                this.showNotification('Artist updated successfully!', 'success');
            } else {
                // Add new artist
                artistData.id = 'A' + String(this.dataManager.getAllArtists().length + 1).padStart(3, '0');
                artistData.createdAt = new Date().toISOString();
                this.dataManager.saveArtist(artistData);
                this.showNotification('Artist added successfully!', 'success');
            }

            this.closeArtistModal();
            this.loadArtists();
        } catch (error) {
            console.error('Error saving artist:', error);
            this.showNotification('Error saving artist: ' + error.message, 'error');
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

    viewArtist(artistId) {
        const artist = this.dataManager.getArtist(artistId);
        if (!artist) {
            this.showNotification('Artist not found', 'error');
            return;
        }
        const tracks = this.dataManager.getTracksByArtist(artistId) || [];
        alert(`Artist: ${artist.name}\nGenre: ${artist.genre}\nTracks: ${tracks.length}\nStatus: ${artist.status}`);
    }

    deleteArtist(artistId) {
        if (confirm('Are you sure you want to delete this artist?')) {
            this.dataManager.deleteArtist(artistId);
            this.showNotification('Artist deleted successfully!', 'success');
            this.loadArtists();
        }
    }

    editTrack(trackId) {
        const track = this.dataManager.getTrack(trackId);
        if (!track) {
            this.showNotification('Track not found', 'error');
            return;
        }
        this.openTrackEditModal(track);
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

    viewTrack(trackId) {
        const track = this.dataManager.getTrack(trackId);
        if (!track) {
            this.showNotification('Track not found', 'error');
            return;
        }
        const artist = this.dataManager.getArtist(track.artist);
        alert(`Track: ${track.title}\nArtist: ${artist?.name || 'Unknown'}\nStreams: ${this.formatNumber(track.streams)}`);
    }

    deleteTrack(trackId) {
        if (confirm('Are you sure you want to delete this track?')) {
            this.dataManager.deleteTrack(trackId);
            this.showNotification('Track deleted successfully!', 'success');
            this.loadTracks();
        }
    }

    viewPayment(paymentId) {
        alert(`Viewing payment: ${paymentId}`);
    }

    addNewArtist() {
        this.openArtistModal();
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
                this.dataManager.saveTrack(trackData);
                this.showNotification('Track updated successfully!', 'success');
            } else {
                // Add new track
                this.dataManager.saveTrack(trackData);
                this.showNotification('Track uploaded successfully!', 'success');
            }
            
            this.resetUploadForm();
            this.loadTracks();
        } catch (error) {
            console.error('Error handling audio upload:', error);
            this.showNotification('Error uploading track: ' + error.message, 'error');
        }
    }

    async handleAudioFileUpload(file) {
        // For demo purposes, return a placeholder
        // In production, upload to Firebase Storage
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve('/audio/' + file.name);
            }, 500);
        });
    }

    async handleExternalTrack() {
        const platform = document.querySelector('input[name="platform"]:checked')?.value;
        const url = document.getElementById('externalUrl').value.trim();
        const title = document.getElementById('externalTitle').value.trim();
        const artist = document.getElementById('externalArtist').value.trim();
        const genre = document.getElementById('externalGenre').value;
        
        if (!url || !title || !artist) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            const trackData = {
                title,
                artist: 'external',
                artistName: artist,
                genre: genre || 'Unknown',
                externalUrl: url,
                platform,
                artwork: 'https://via.placeholder.com/300?text=External',
                streams: 0,
                status: 'published'
            };
            
            this.dataManager.saveTrack(trackData);
            this.showNotification('External track added successfully!', 'success');
            
            // Reset form
            document.getElementById('externalTrackForm').reset();
            this.switchUploadMethod('upload');
            this.loadTracks();
        } catch (error) {
            console.error('Error adding external track:', error);
            this.showNotification('Error adding track: ' + error.message, 'error');
        }
    }

    exportPayments() {
        const payments = this.dataManager.getAllTracks(); // This should be payments, but using tracks for now
        if (!payments || payments.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }
        
        const csv = 'ID,Artist,Amount,Service,Date,Status\n' + 
            payments.map(p => `${p.id},${p.artistName || 'Unknown'},${p.streams || 0},Track,${new Date().toISOString()},published`).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'payments_export.csv';
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Payments exported successfully!', 'success');
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
    showNotification(message, type = 'info') {
        console.log(`[Notification] ${type}: ${message}`);
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.zIndex = '99999';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
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

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
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
        window.adminPanel = new AdminPanel();
    }
});