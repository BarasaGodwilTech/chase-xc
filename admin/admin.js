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
        this.loadSectionData('dashboard');

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

        document.getElementById('addTrackBtn')?.addEventListener('click', () => {
            this.addNewTrack();
        });

        this.setupBasicMusicManagement();
        this.setupSpotifyImport();

        console.log('Event listeners setup complete');
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

        // Parse URL when pasted
        if (spotifyUrlInput) {
            spotifyUrlInput.addEventListener('change', () => {
                const url = spotifyUrlInput.value.trim();
                if (url && url.includes('spotify.com/track/')) {
                    this.fetchSpotifyTrackFromUrl(url);
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
            // Use DuckDuckGo API to search for the song + spotify
            const searchQuery = encodeURIComponent(`${query} site:open.spotify.com/track`);
            const searchUrl = `https://api.duckduckgo.com/?q=${searchQuery}&format=json&pretty=1`;
            
            const response = await fetch(searchUrl);
            const data = await response.json();
            
            // Extract Spotify URLs from results
            const spotifyResults = this.extractSpotifyUrlsFromResults(data, query);
            
            if (spotifyResults.length > 0) {
                // Display found Spotify links
                resultsContainer.innerHTML = `
                    <div class="spotify-search-info">
                        <p><i class="fas fa-check-circle" style="color: #1DB954;"></i> Found ${spotifyResults.length} result(s) on Spotify:</p>
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
            // Use Spotify oEmbed API to get track info (no auth required)
            const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
            const response = await fetch(oembedUrl);
            
            if (!response.ok) {
                throw new Error('Failed to fetch track data');
            }

            const data = await response.json();
            
            // Display the track
            this.selectedSpotifyTrack = {
                id: trackId,
                url: url,
                title: data.title || 'Unknown Track',
                artist: data.author || 'Unknown Artist',
                artwork: data.thumbnail_url || '',
                html: data.html || ''
            };

            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="spotify-track selected" data-track-id="${trackId}">
                        <img src="${this.selectedSpotifyTrack.artwork}" alt="${this.selectedSpotifyTrack.title}">
                        <div class="spotify-track-info">
                            <div class="spotify-track-name">${this.selectedSpotifyTrack.title}</div>
                            <div class="spotify-track-artist">${this.selectedSpotifyTrack.artist}</div>
                            <div class="spotify-track-url">
                                <i class="fas fa-check-circle"></i> Ready to import
                            </div>
                        </div>
                    </div>
                `;
            }

            // Auto-fill form fields
            this.autoFillSpotifyForm();
        } catch (error) {
            console.error('Error fetching Spotify track:', error);
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="spotify-error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Could not fetch track information. The track might be private or region-restricted.</p>
                        <p class="text-muted">You can still manually enter the track details below.</p>
                    </div>
                `;
            }
        }
    }

    autoFillSpotifyForm() {
        if (!this.selectedSpotifyTrack) return;

        // Switch to upload form to fill in the details
        const titleInput = document.getElementById('trackTitle');
        const genreSelect = document.getElementById('trackGenre');
        const descriptionInput = document.getElementById('trackDescription');
        const artworkPreview = document.getElementById('artworkPreview');

        if (titleInput) {
            titleInput.value = this.selectedSpotifyTrack.title;
        }

        if (descriptionInput) {
            descriptionInput.value = `Imported from Spotify: ${this.selectedSpotifyTrack.url}`;
        }

        if (artworkPreview && this.selectedSpotifyTrack.artwork) {
            artworkPreview.classList.add('has-image');
            artworkPreview.style.backgroundImage = `url('${this.selectedSpotifyTrack.artwork}')`;
        }

        this.showNotification('Track information loaded. Please select an artist and genre, then upload.', 'success');
    }

    async importSpotifyTrack() {
        if (!this.selectedSpotifyTrack) {
            this.showNotification('Please select a Spotify track first', 'warning');
            return;
        }

        const artistSelect = document.getElementById('trackArtist');
        const genreSelect = document.getElementById('trackGenre');
        const titleInput = document.getElementById('trackTitle');
        const descriptionInput = document.getElementById('trackDescription');

        const artistId = artistSelect?.value;
        const genre = genreSelect?.value;
        const title = titleInput?.value?.trim();
        const description = descriptionInput?.value?.trim();

        if (!artistId || artistId === '__add_new__' || !genre || !title) {
            this.showNotification('Please fill in Artist, Genre, and Title fields', 'warning');
            return;
        }

        try {
            // Create track data
            const trackData = {
                title: title,
                artist: artistId,
                genre: genre,
                duration: '0:00', // Will be updated when audio is uploaded
                year: new Date().getFullYear().toString(),
                streams: 0,
                likes: 0,
                downloads: 0,
                artwork: this.selectedSpotifyTrack.artwork || '',
                description: description || `Imported from Spotify`,
                releaseDate: new Date().toISOString().split('T')[0],
                status: 'published',
                audioUrl: '', // Will need to upload audio file separately
                spotifyUrl: this.selectedSpotifyTrack.url,
                platformLinks: {
                    spotify: this.selectedSpotifyTrack.url
                }
            };

            // Save to data manager
            const savedTrack = this.dataManager.saveTrack(trackData);

            if (savedTrack) {
                this.showNotification('Spotify track imported successfully! Please upload the audio file to complete.', 'success');
                
                // Clear form
                this.selectedSpotifyTrack = null;
                document.getElementById('spotifyUrl').value = '';
                document.getElementById('spotifySearch').value = '';
                const resultsContainer = document.getElementById('spotifyResults');
                resultsContainer.innerHTML = '';
                resultsContainer.classList.remove('show');
                
                // Switch to upload tab to complete with audio file
                this.switchUploadMethod('upload');
                
                // Pre-fill the form with saved data
                if (titleInput) titleInput.value = savedTrack.title;
                if (artistSelect) artistSelect.value = savedTrack.artist;
                if (genreSelect) genreSelect.value = savedTrack.genre;
                if (descriptionInput) descriptionInput.value = savedTrack.description;
                
                if (savedTrack.artwork) {
                    const artworkPreview = document.getElementById('artworkPreview');
                    if (artworkPreview) {
                        artworkPreview.classList.add('has-image');
                        artworkPreview.style.backgroundImage = `url('${savedTrack.artwork}')`;
                    }
                }
            } else {
                this.showNotification('Failed to save track data', 'error');
            }
        } catch (error) {
            console.error('Error importing Spotify track:', error);
            this.showNotification('Error importing track: ' + error.message, 'error');
        }
    }

    switchUploadMethod(method) {
        console.log('Switching to method:', method);

        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const activeTab = document.querySelector(`[data-method="${method}"]`);
        if (activeTab) activeTab.classList.add('active');

        document.querySelectorAll('.method-content').forEach(content => {
            content.classList.remove('active');
        });

        const activeContent = document.getElementById(`${method}Form`);
        if (activeContent) activeContent.classList.add('active');
    }

    showSection(sectionId) {
        console.log('Showing section:', sectionId);

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
            'music-management': 'Music Management',
            projects: 'Projects'
        };

        const subtitles = {
            dashboard: 'Welcome to your admin dashboard',
            payments: 'Manage and track all payments',
            artists: 'Manage artist profiles and content',
            tracks: 'Manage music tracks and releases',
            'music-management': 'Upload and manage music tracks',
            projects: 'Manage studio projects and deliverables'
        };

        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');

        if (pageTitle) pageTitle.textContent = titles[sectionId] || 'Admin Panel';
        if (pageSubtitle) pageSubtitle.textContent = subtitles[sectionId] || 'Manage your studio operations';
    }

    loadSectionData(sectionId) {
        console.log('Loading section data:', sectionId);
        this.showLoading();

        setTimeout(() => {
            try {
                switch (sectionId) {
                    case 'dashboard':
                        this.renderDashboard();
                        break;
                    case 'artists':
                        break;
                    case 'tracks':
                        this.loadTracks();
                        break;
                    case 'music-management':
                        this.loadArtistsForSelect();
                        break;
                    case 'projects':
                        break;
                    case 'payments':
                        this.loadPayments();
                        break;
                }
            } catch (error) {
                console.error('Error loading section data:', error);
                this.showNotification('Error loading data: ' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        }, 300);
    }

    renderDashboard() {
        console.log('Rendering dashboard...');
        const artists = this.dataManager.getAllArtists();
        const tracks = this.dataManager.getAllTracks();
        const publishedTracks = this.dataManager.getPublishedTracks();

        const totalStreams = tracks.reduce((sum, track) => sum + (track.streams || 0), 0);
        const totalRevenue = Math.round(totalStreams * 0.003);

        const totalRevenueEl = document.getElementById('totalRevenue');
        const totalArtistsEl = document.getElementById('totalArtists');
        const activeProjectsEl = document.getElementById('activeProjects');
        const pendingPaymentsEl = document.getElementById('pendingPayments');

        if (totalRevenueEl) totalRevenueEl.textContent = `UGX ${this.formatNumber(totalRevenue)}`;
        if (totalArtistsEl) totalArtistsEl.textContent = artists.length;
        if (activeProjectsEl) activeProjectsEl.textContent = publishedTracks.length;
        if (pendingPaymentsEl) pendingPaymentsEl.textContent = '0';
    }

    loadArtists() {
        console.log('Loading artists...');
        const container = document.getElementById('artistsTable');
        if (!container) {
            console.error('Artists table container not found');
            return;
        }

        const artists = this.dataManager.getAllArtists();
        if (artists.length === 0) {
            container.innerHTML = '<tr><td colspan="7" class="text-center">No artists found</td></tr>';
            return;
        }

        container.innerHTML = artists.map(artist => {
            const tracks = this.dataManager.getTracksByArtist(artist.id);
            const totalStreams = tracks.reduce((sum, track) => sum + (track.streams || 0), 0);

            return `
                <tr>
                    <td>
                        <div class="artist-cell">
                            <img src="${artist.image}" alt="${artist.name}" class="artist-avatar">
                            <span>${artist.name}</span>
                        </div>
                    </td>
                    <td>${artist.genre}</td>
                    <td>${tracks.length}</td>
                    <td>${this.formatNumber(totalStreams)}</td>
                    <td>${artist.since}</td>
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

    loadTracks() {
        console.log('Loading tracks...');
        const container = document.getElementById('tracksTable');
        if (!container) {
            console.error('Tracks table container not found');
            return;
        }

        const tracks = this.dataManager.getAllTracks();
        if (tracks.length === 0) {
            container.innerHTML = '<tr><td colspan="7" class="text-center">No tracks found</td></tr>';
            return;
        }

        container.innerHTML = tracks.map(track => {
            const artist = this.dataManager.getArtist(track.artist);
            return `
                <tr>
                    <td>
                        <div class="track-cell">
                            <img src="${track.artwork}" alt="${track.title}" class="track-artwork-small">
                            <span>${track.title}</span>
                        </div>
                    </td>
                    <td>${artist?.name || track.artistName || 'Unknown Artist'}</td>
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

    loadArtistsForSelect() {
        const artistSelect = document.getElementById('trackArtist');
        if (!artistSelect) return;
        const artists = this.dataManager.getAllArtists();
        artistSelect.innerHTML = '<option value="">Select Artist</option>' + artists.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    }

    loadPayments() {
        const table = document.getElementById('paymentsTable');
        if (!table) return;
        const payments = [
            { id: 'TX001', artist: 'Sarah Miles', amount: 1800000, service: 'Music Production', date: '2025-03-15', status: 'completed' },
            { id: 'TX002', artist: 'DJ Kato', amount: 2500000, service: 'Mixing & Mastering', date: '2025-03-10', status: 'pending' }
        ];
        table.innerHTML = payments.map(payment => `
            <tr>
                <td>${payment.id}</td>
                <td>${payment.artist}</td>
                <td>UGX ${this.formatNumber(payment.amount)}</td>
                <td>${payment.service}</td>
                <td>${payment.date}</td>
                <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="adminPanel.viewPayment('${payment.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Basic CRUD operations
    editArtist(artistId) {
        const artist = this.dataManager.getArtist(artistId);
        if (artist) {
            alert(`Edit Artist: ${artist.name}\nThis would open an edit form in a real implementation.`);
        }
    }

    viewArtist(artistId) {
        const artist = this.dataManager.getArtist(artistId);
        const tracks = this.dataManager.getTracksByArtist(artistId);
        if (artist) {
            alert(`Artist: ${artist.name}\nGenre: ${artist.genre}\nTracks: ${tracks.length}\nStatus: ${artist.status}`);
        }
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
        if (track) {
            alert(`Edit Track: ${track.title}\nThis would open an edit form in a real implementation.`);
        }
    }

    viewTrack(trackId) {
        const track = this.dataManager.getTrack(trackId);
        const artist = this.dataManager.getArtist(track.artist);
        if (track) {
            alert(`Track: ${track.title}\nArtist: ${artist?.name || 'Unknown'}\nStreams: ${this.formatNumber(track.streams)}`);
        }
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
        // Basic placeholder until Firestore-backed artist creation UI is implemented
        this.showNotification('Artist creation will be added next. For now, create artists in Firestore or we will add an inline form.', 'info');
        this.showSection('artists');
    }

    addNewTrack() {
        // Switch to music management and show upload form
        this.showSection('music-management');
        this.switchUploadMethod('upload');
    }

    // Utility methods
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
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