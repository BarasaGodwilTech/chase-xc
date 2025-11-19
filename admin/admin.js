// Enhanced Admin Panel with Full CRUD Operations
class AdminPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.data = {
            payments: [],
            projects: [],
            artists: [],
            tracks: [],
            savings: [],
            activities: [],
            notifications: []
        };
        
        this.editingItem = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadDataFromStorage();
        this.showSection('dashboard');
        this.renderDashboard();
        this.loadNotifications();
    }

    checkAuth() {
        // Simple auth check
        const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
        if (!token && !window.location.pathname.includes('login')) {
            console.warn('Not authenticated');
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item[data-target]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.getAttribute('data-target');
                this.showSection(target);
            });
        });

        // Mobile navigation toggle
        const navToggle = document.getElementById('navToggle');
        if (navToggle) {
            navToggle.addEventListener('click', () => {
                document.querySelector('.nav-content').classList.toggle('active');
            });
        }

        // Notifications
        const notificationsBtn = document.getElementById('notificationsBtn');
        const closeNotifications = document.getElementById('closeNotifications');
        const notificationsPanel = document.getElementById('notificationsPanel');

        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                notificationsPanel.classList.add('active');
            });
        }

        if (closeNotifications) {
            closeNotifications.addEventListener('click', () => {
                notificationsPanel.classList.remove('active');
            });
        }

        // Fullscreen toggle
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // Add new artist button
        document.getElementById('addArtistBtn')?.addEventListener('click', () => {
            this.addNewArtist();
        });

        // Add new track button
        document.getElementById('addTrackBtn')?.addEventListener('click', () => {
            this.addNewTrack();
        });

        // =========================================================================
        // MUSIC MANAGEMENT EVENT LISTENERS - FIXED VERSION
        // =========================================================================
        this.setupMusicManagement();

        // Close notifications panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications-panel') && 
                !e.target.closest('#notificationsBtn') &&
                notificationsPanel.classList.contains('active')) {
                notificationsPanel.classList.remove('active');
            }
        });
    }

    // =========================================================================
    // MUSIC MANAGEMENT METHODS - FIXED VERSION
    // =========================================================================

    setupMusicManagement() {
        // Method tabs - FIXED: Use event delegation for dynamic content
        document.addEventListener('click', (e) => {
            if (e.target.closest('.method-tab')) {
                const tab = e.target.closest('.method-tab');
                const method = tab.getAttribute('data-method');
                this.switchUploadMethod(method);
            }
        });

        // File upload
        const audioUploadArea = document.getElementById('audioUploadArea');
        const audioFileInput = document.getElementById('audioFile');
        const fileInfo = document.getElementById('fileInfo');

        if (audioUploadArea && audioFileInput) {
            audioUploadArea.addEventListener('click', () => audioFileInput.click());
            
            audioUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                audioUploadArea.classList.add('dragover');
            });

            audioUploadArea.addEventListener('dragleave', () => {
                audioUploadArea.classList.remove('dragover');
            });

            audioUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                audioUploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });

            audioFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            });
        }

        // Artwork upload
        const artworkBtn = document.getElementById('uploadArtworkBtn');
        const artworkInput = document.getElementById('trackArtwork');
        const artworkPreview = document.getElementById('artworkPreview');

        if (artworkBtn && artworkInput) {
            artworkBtn.addEventListener('click', () => artworkInput.click());
            
            artworkInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleArtworkSelect(e.target.files[0]);
                }
            });
        }

        // Form submissions
        document.getElementById('audioUploadForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAudioUpload();
        });

        document.getElementById('externalTrackForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleExternalTrack();
        });

        document.getElementById('searchSpotify')?.addEventListener('click', () => {
            this.searchSpotify();
        });

        document.getElementById('importSpotify')?.addEventListener('click', () => {
            this.importSpotifyTrack();
        });

        // Cancel buttons
        document.getElementById('cancelUpload')?.addEventListener('click', () => {
            this.resetUploadForm();
        });

        document.getElementById('cancelSpotify')?.addEventListener('click', () => {
            this.resetSpotifyForm();
        });

        document.getElementById('cancelExternal')?.addEventListener('click', () => {
            this.resetExternalForm();
        });
    }

    switchUploadMethod(method) {
        console.log('Switching to method:', method); // Debug log
        
        // Update tabs
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-method="${method}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Update content
        document.querySelectorAll('.method-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`${method}Form`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
    }

    handleFileSelect(file) {
        const fileInfo = document.getElementById('fileInfo');
        const audioUploadArea = document.getElementById('audioUploadArea');
        
        if (!fileInfo || !audioUploadArea) return;

        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/x-m4a'];
        if (!validTypes.includes(file.type)) {
            this.showNotification('Please select a valid audio file (MP3, WAV, FLAC, M4A)', 'error');
            return;
        }

        // Validate file size (50MB)
        if (file.size > 50 * 1024 * 1024) {
            this.showNotification('File size must be less than 50MB', 'error');
            return;
        }

        // Update UI
        fileInfo.innerHTML = `
            <strong>Selected File:</strong> ${file.name}<br>
            <strong>Size:</strong> ${this.formatFileSize(file.size)}<br>
            <strong>Type:</strong> ${file.type}
        `;
        fileInfo.style.display = 'block';

        audioUploadArea.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <p>File ready for upload</p>
            <span>${file.name}</span>
        `;
    }

    handleArtworkSelect(file) {
        const artworkPreview = document.getElementById('artworkPreview');
        if (!artworkPreview) return;
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            this.showNotification('Please select a valid image file (JPEG, PNG, GIF, WebP)', 'error');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            artworkPreview.innerHTML = `<img src="${e.target.result}" alt="Artwork preview" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">`;
            artworkPreview.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }

    async handleAudioUpload() {
        const formData = new FormData(document.getElementById('audioUploadForm'));
        
        try {
            this.showLoading();
            
            // Simulate API call
            await this.simulateApiCall('uploadTrack', formData);
            
            this.showNotification('Track uploaded successfully!', 'success');
            this.resetUploadForm();
            
        } catch (error) {
            this.showNotification('Error uploading track: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async searchSpotify() {
        const query = document.getElementById('spotifySearch')?.value.trim();
        if (!query) {
            this.showNotification('Please enter a search term', 'warning');
            return;
        }

        try {
            this.showLoading();
            
            const results = await this.simulateSpotifySearch(query);
            this.displaySpotifyResults(results);
            
        } catch (error) {
            this.showNotification('Error searching Spotify: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    simulateSpotifySearch(query) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve([
                    {
                        id: 'spotify_1',
                        title: `${query} - Track 1`,
                        artist: 'Artist 1',
                        album: 'Album 1',
                        duration: '3:45',
                        image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop',
                        url: `https://open.spotify.com/track/mock1`
                    },
                    {
                        id: 'spotify_2',
                        title: `${query} - Track 2`,
                        artist: 'Artist 2',
                        album: 'Album 2',
                        duration: '4:20',
                        image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=100&h=100&fit=crop',
                        url: `https://open.spotify.com/track/mock2`
                    }
                ]);
            }, 1000);
        });
    }

    displaySpotifyResults(results) {
        const container = document.getElementById('spotifyResults');
        if (!container) return;
        
        if (results.length === 0) {
            container.innerHTML = '<p class="no-results">No tracks found</p>';
            container.style.display = 'block';
            return;
        }

        container.innerHTML = results.map(track => `
            <div class="track-result" data-track-id="${track.id}">
                <img src="${track.image}" alt="${track.album}">
                <div class="track-result-info">
                    <h4>${track.title}</h4>
                    <p>${track.artist} • ${track.album} • ${track.duration}</p>
                </div>
                <button class="btn btn-sm btn-primary select-track" 
                        data-track='${JSON.stringify(track).replace(/'/g, "\\'")}'>
                    Select
                </button>
            </div>
        `).join('');

        container.style.display = 'block';

        // Add event listeners to select buttons
        container.querySelectorAll('.select-track').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackData = JSON.parse(btn.getAttribute('data-track'));
                this.selectSpotifyTrack(trackData, btn);
            });
        });
    }

    selectSpotifyTrack(track, button) {
        // Populate the Spotify URL field
        const spotifyUrl = document.getElementById('spotifyUrl');
        if (spotifyUrl) {
            spotifyUrl.value = track.url;
        }
        
        // Mark as selected
        document.querySelectorAll('.track-result').forEach(result => {
            result.classList.remove('selected');
        });
        button.closest('.track-result').classList.add('selected');
    }

    async importSpotifyTrack() {
        const spotifyUrl = document.getElementById('spotifyUrl')?.value.trim();
        
        if (!spotifyUrl) {
            this.showNotification('Please select a track or enter a Spotify URL', 'warning');
            return;
        }

        try {
            this.showLoading();
            
            await this.simulateApiCall('importSpotifyTrack', { url: spotifyUrl });
            
            this.showNotification('Track imported from Spotify successfully!', 'success');
            this.resetSpotifyForm();
            
        } catch (error) {
            this.showNotification('Error importing from Spotify: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleExternalTrack() {
        const form = document.getElementById('externalTrackForm');
        if (!form) return;

        const formData = new FormData(form);
        const platform = formData.get('platform');
        const url = formData.get('externalUrl');
        const title = formData.get('externalTitle');
        const artist = formData.get('externalArtist');

        if (!platform || !url || !title || !artist) {
            this.showNotification('Please fill all required fields', 'warning');
            return;
        }

        try {
            this.showLoading();
            
            await this.simulateApiCall('addExternalTrack', {
                platform,
                url,
                title,
                artist,
                genre: formData.get('externalGenre')
            });
            
            this.showNotification('External track added successfully!', 'success');
            this.resetExternalForm();
            
        } catch (error) {
            this.showNotification('Error adding external track: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    resetUploadForm() {
        const form = document.getElementById('audioUploadForm');
        const audioUploadArea = document.getElementById('audioUploadArea');
        const fileInfo = document.getElementById('fileInfo');
        const artworkPreview = document.getElementById('artworkPreview');

        if (form) form.reset();
        if (audioUploadArea) {
            audioUploadArea.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Drag & drop your audio file here or click to browse</p>
                <span>Supports: MP3, WAV, FLAC, M4A (Max 50MB)</span>
            `;
        }
        if (fileInfo) {
            fileInfo.innerHTML = '';
            fileInfo.style.display = 'none';
        }
        if (artworkPreview) {
            artworkPreview.innerHTML = `
                <i class="fas fa-image"></i>
                <span>No artwork selected</span>
            `;
            artworkPreview.classList.remove('has-image');
        }
    }

    resetSpotifyForm() {
        const spotifyUrl = document.getElementById('spotifyUrl');
        const spotifySearch = document.getElementById('spotifySearch');
        const spotifyResults = document.getElementById('spotifyResults');

        if (spotifyUrl) spotifyUrl.value = '';
        if (spotifySearch) spotifySearch.value = '';
        if (spotifyResults) {
            spotifyResults.innerHTML = '';
            spotifyResults.style.display = 'none';
        }
    }

    resetExternalForm() {
        const form = document.getElementById('externalTrackForm');
        if (form) form.reset();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    simulateApiCall(endpoint, data) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.2) {
                    resolve({ success: true, message: 'Operation completed' });
                } else {
                    reject(new Error('Simulated API error'));
                }
            }, 2000);
        });
    }

    // =========================================================================
    // DATA MANAGEMENT - STORAGE AND RETRIEVAL
    // =========================================================================

    loadDataFromStorage() {
        const savedArtists = localStorage.getItem('chaseRecords_artists');
        const savedTracks = localStorage.getItem('chaseRecords_tracks');
        
        this.data.artists = savedArtists ? JSON.parse(savedArtists) : this.getSampleArtists();
        this.data.tracks = savedTracks ? JSON.parse(savedTracks) : this.getSampleTracks();
        
        this.data.payments = this.getSamplePayments();
        this.data.projects = this.getSampleProjects();
        this.data.activities = this.getSampleActivities();
        this.data.notifications = this.getSampleNotifications();
    }

    saveDataToStorage() {
        localStorage.setItem('chaseRecords_artists', JSON.stringify(this.data.artists));
        localStorage.setItem('chaseRecords_tracks', JSON.stringify(this.data.tracks));
    }

    getSampleArtists() {
        return [
            {
                id: 'A001',
                name: 'Sarah Miles',
                genre: 'Afro-Pop',
                bio: 'Soulful vocalist known for her powerful performances and emotional depth.',
                image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
                tracks: 3,
                streams: 15200,
                since: '2024',
                status: 'active'
            }
        ];
    }

    getSampleTracks() {
        return [
            {
                id: 'T001',
                title: 'Sunset Dreams',
                artist: 'A001',
                artistName: 'Sarah Miles',
                genre: 'Afro-Pop',
                duration: '3:45',
                year: '2024',
                streams: 15200,
                likes: 2400,
                downloads: 1800,
                artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
                description: 'A soulful afro-pop track about chasing dreams',
                releaseDate: '2024-12-15',
                status: 'published'
            }
        ];
    }

    getSamplePayments() {
        return [{
            id: 'TX001',
            artist: 'Alex Nova',
            amount: 1800000,
            service: 'Music Production',
            date: '2025-03-15',
            status: 'completed'
        }];
    }

    getSampleProjects() {
        return [{
            id: 'P001',
            name: 'Midnight Echo Album',
            artist: 'Alex Nova',
            service: 'Full Production',
            budget: 5000000,
            progress: 75,
            deadline: '2025-04-15',
            status: 'active'
        }];
    }

    getSampleActivities() {
        return [{
            type: 'payment',
            message: 'Payment received from Alex Nova - UGX 1,800,000',
            time: '2 hours ago'
        }];
    }

    getSampleNotifications() {
        return [{
            id: 'N001',
            type: 'payment',
            title: 'New Payment Received',
            message: 'Alex Nova just paid UGX 1,800,000 for music production',
            time: '2 hours ago',
            read: false
        }];
    }

    // =========================================================================
    // ARTISTS MANAGEMENT
    // =========================================================================

    loadArtists() {
        const container = document.getElementById('artistsTable');
        if (!container) return;

        container.innerHTML = this.data.artists.map(artist => `
            <tr>
                <td>
                    <div class="artist-cell">
                        <img src="${artist.image}" alt="${artist.name}" class="artist-avatar">
                        <span>${artist.name}</span>
                    </div>
                </td>
                <td>${artist.genre}</td>
                <td>${artist.tracks}</td>
                <td>${this.formatNumber(artist.streams)}</td>
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
        `).join('');
    }

    editArtist(artistId) {
        const artist = this.data.artists.find(a => a.id === artistId);
        if (!artist) return;

        this.editingItem = artist;
        this.showArtistForm(artist);
    }

    showArtistForm(artist = null) {
        const isEdit = !!artist;
        
        const formHTML = `
            <div class="modal" id="artistModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Edit Artist' : 'Add New Artist'}</h3>
                        <button class="modal-close" onclick="adminPanel.closeModal('artistModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="artistForm">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="artistName">Artist Name *</label>
                                    <input type="text" id="artistName" name="artistName" value="${artist?.name || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="artistGenre">Genre *</label>
                                    <select id="artistGenre" name="artistGenre" required>
                                        <option value="">Select Genre</option>
                                        <option value="afro-pop" ${artist?.genre === 'afro-pop' ? 'selected' : ''}>Afro-Pop</option>
                                        <option value="electronic" ${artist?.genre === 'electronic' ? 'selected' : ''}>Electronic</option>
                                        <option value="dancehall" ${artist?.genre === 'dancehall' ? 'selected' : ''}>Dancehall</option>
                                        <option value="r&b" ${artist?.genre === 'r&b' ? 'selected' : ''}>R&B</option>
                                        <option value="afrobeat" ${artist?.genre === 'afrobeat' ? 'selected' : ''}>Afrobeat</option>
                                        <option value="afro-house" ${artist?.genre === 'afro-house' ? 'selected' : ''}>Afro-House</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="artistBio">Bio</label>
                                <textarea id="artistBio" name="artistBio" rows="3">${artist?.bio || ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label for="artistImage">Artist Image URL</label>
                                <input type="url" id="artistImage" name="artistImage" value="${artist?.image || ''}" placeholder="https://example.com/image.jpg">
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="artistSince">Active Since</label>
                                    <input type="number" id="artistSince" name="artistSince" value="${artist?.since || '2024'}" min="2000" max="2025">
                                </div>
                                <div class="form-group">
                                    <label for="artistStatus">Status</label>
                                    <select id="artistStatus" name="artistStatus">
                                        <option value="active" ${artist?.status === 'active' ? 'selected' : ''}>Active</option>
                                        <option value="inactive" ${artist?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="adminPanel.closeModal('artistModal')">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    ${isEdit ? 'Update Artist' : 'Add Artist'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHTML);
        this.setupArtistFormEvents();
        document.getElementById('artistModal').style.display = 'block';
    }

    setupArtistFormEvents() {
        const form = document.getElementById('artistForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleArtistSubmit(e));
        }
    }

    handleArtistSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const artistData = {
            id: this.editingItem?.id || 'A' + String(this.data.artists.length + 1).padStart(3, '0'),
            name: formData.get('artistName'),
            genre: formData.get('artistGenre'),
            bio: formData.get('artistBio'),
            image: formData.get('artistImage'),
            since: formData.get('artistSince'),
            status: formData.get('artistStatus'),
            tracks: this.editingItem?.tracks || 0,
            streams: this.editingItem?.streams || 0,
            socials: this.editingItem?.socials || {}
        };

        if (this.editingItem) {
            const index = this.data.artists.findIndex(a => a.id === this.editingItem.id);
            this.data.artists[index] = { ...this.data.artists[index], ...artistData };
            this.showNotification('Artist updated successfully!', 'success');
        } else {
            this.data.artists.push(artistData);
            this.showNotification('Artist added successfully!', 'success');
        }

        this.saveDataToStorage();
        this.loadArtists();
        this.closeModal('artistModal');
        this.editingItem = null;
    }

    deleteArtist(artistId) {
        if (confirm('Are you sure you want to delete this artist?')) {
            this.data.artists = this.data.artists.filter(a => a.id !== artistId);
            this.data.tracks = this.data.tracks.filter(t => t.artist !== artistId);
            this.saveDataToStorage();
            this.loadArtists();
            this.loadTracks();
            this.showNotification('Artist deleted successfully!', 'success');
        }
    }

    viewArtist(artistId) {
        const artist = this.data.artists.find(a => a.id === artistId);
        if (!artist) return;
        alert(`Artist: ${artist.name}\nGenre: ${artist.genre}\nTracks: ${artist.tracks}\nStreams: ${this.formatNumber(artist.streams)}`);
    }

    // =========================================================================
    // TRACKS MANAGEMENT
    // =========================================================================

    loadTracks() {
        const container = document.getElementById('tracksTable');
        if (!container) return;

        container.innerHTML = this.data.tracks.map(track => {
            const artist = this.data.artists.find(a => a.id === track.artist);
            return `
                <tr>
                    <td>
                        <div class="track-cell">
                            <img src="${track.artwork}" alt="${track.title}" class="track-artwork-small">
                            <span>${track.title}</span>
                        </div>
                    </td>
                    <td>${artist?.name || 'Unknown Artist'}</td>
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

    editTrack(trackId) {
        const track = this.data.tracks.find(t => t.id === trackId);
        if (!track) return;
        this.editingItem = track;
        this.showTrackForm(track);
    }

    showTrackForm(track = null) {
        const isEdit = !!track;
        
        const formHTML = `
            <div class="modal" id="trackModal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Edit Track' : 'Add New Track'}</h3>
                        <button class="modal-close" onclick="adminPanel.closeModal('trackModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="trackForm">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="trackTitle">Track Title *</label>
                                    <input type="text" id="trackTitle" name="trackTitle" value="${track?.title || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="trackArtist">Artist *</label>
                                    <select id="trackArtist" name="trackArtist" required>
                                        <option value="">Select Artist</option>
                                        ${this.data.artists.map(artist => 
                                            `<option value="${artist.id}" ${track?.artist === artist.id ? 'selected' : ''}>${artist.name}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="trackGenre">Genre *</label>
                                    <select id="trackGenre" name="trackGenre" required>
                                        <option value="">Select Genre</option>
                                        <option value="afro-pop" ${track?.genre === 'afro-pop' ? 'selected' : ''}>Afro-Pop</option>
                                        <option value="electronic" ${track?.genre === 'electronic' ? 'selected' : ''}>Electronic</option>
                                        <option value="dancehall" ${track?.genre === 'dancehall' ? 'selected' : ''}>Dancehall</option>
                                        <option value="r&b" ${track?.genre === 'r&b' ? 'selected' : ''}>R&B</option>
                                        <option value="afrobeat" ${track?.genre === 'afrobeat' ? 'selected' : ''}>Afrobeat</option>
                                        <option value="afro-house" ${track?.genre === 'afro-house' ? 'selected' : ''}>Afro-House</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="trackDuration">Duration (MM:SS) *</label>
                                    <input type="text" id="trackDuration" name="trackDuration" value="${track?.duration || ''}" pattern="[0-9]{1,2}:[0-9]{2}" required>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="trackStreams">Streams</label>
                                    <input type="number" id="trackStreams" name="trackStreams" value="${track?.streams || 0}" min="0">
                                </div>
                                <div class="form-group">
                                    <label for="trackLikes">Likes</label>
                                    <input type="number" id="trackLikes" name="trackLikes" value="${track?.likes || 0}" min="0">
                                </div>
                                <div class="form-group">
                                    <label for="trackDownloads">Downloads</label>
                                    <input type="number" id="trackDownloads" name="trackDownloads" value="${track?.downloads || 0}" min="0">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="trackDescription">Description</label>
                                <textarea id="trackDescription" name="trackDescription" rows="3">${track?.description || ''}</textarea>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="trackReleaseDate">Release Date</label>
                                    <input type="date" id="trackReleaseDate" name="trackReleaseDate" value="${track?.releaseDate || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="trackStatus">Status</label>
                                    <select id="trackStatus" name="trackStatus">
                                        <option value="published" ${track?.status === 'published' ? 'selected' : ''}>Published</option>
                                        <option value="draft" ${track?.status === 'draft' ? 'selected' : ''}>Draft</option>
                                        <option value="archived" ${track?.status === 'archived' ? 'selected' : ''}>Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="trackArtwork">Track Artwork URL</label>
                                <input type="url" id="trackArtwork" name="trackArtwork" value="${track?.artwork || ''}" placeholder="https://example.com/artwork.jpg">
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="adminPanel.closeModal('trackModal')">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    ${isEdit ? 'Update Track' : 'Add Track'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHTML);
        this.setupTrackFormEvents();
        document.getElementById('trackModal').style.display = 'block';
    }

    setupTrackFormEvents() {
        const form = document.getElementById('trackForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleTrackSubmit(e));
        }
    }

    handleTrackSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const artist = this.data.artists.find(a => a.id === formData.get('trackArtist'));
        
        const trackData = {
            id: this.editingItem?.id || 'T' + String(this.data.tracks.length + 1).padStart(3, '0'),
            title: formData.get('trackTitle'),
            artist: formData.get('trackArtist'),
            artistName: artist?.name || 'Unknown Artist',
            genre: formData.get('trackGenre'),
            duration: formData.get('trackDuration'),
            streams: parseInt(formData.get('trackStreams')) || 0,
            likes: parseInt(formData.get('trackLikes')) || 0,
            downloads: parseInt(formData.get('trackDownloads')) || 0,
            description: formData.get('trackDescription'),
            releaseDate: formData.get('trackReleaseDate'),
            status: formData.get('trackStatus'),
            artwork: formData.get('trackArtwork'),
            year: formData.get('trackReleaseDate')?.substring(0, 4) || '2024'
        };

        if (this.editingItem) {
            const index = this.data.tracks.findIndex(t => t.id === this.editingItem.id);
            this.data.tracks[index] = { ...this.data.tracks[index], ...trackData };
            this.showNotification('Track updated successfully!', 'success');
        } else {
            this.data.tracks.push(trackData);
            this.showNotification('Track added successfully!', 'success');
        }

        this.saveDataToStorage();
        this.loadTracks();
        this.closeModal('trackModal');
        this.editingItem = null;
    }

    deleteTrack(trackId) {
        if (confirm('Are you sure you want to delete this track?')) {
            this.data.tracks = this.data.tracks.filter(t => t.id !== trackId);
            this.saveDataToStorage();
            this.loadTracks();
            this.showNotification('Track deleted successfully!', 'success');
        }
    }

    viewTrack(trackId) {
        const track = this.data.tracks.find(t => t.id === trackId);
        if (!track) return;
        const artist = this.data.artists.find(a => a.id === track.artist);
        alert(`Track: ${track.title}\nArtist: ${artist?.name || 'Unknown'}\nGenre: ${track.genre}\nDuration: ${track.duration}\nStreams: ${this.formatNumber(track.streams)}`);
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
        this.editingItem = null;
    }

    showSection(sectionId) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-target="${sectionId}"]`)?.classList.add('active');

        // Update sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId)?.classList.add('active');

        // Update page title
        this.updatePageTitle(sectionId);

        // Load section data
        this.currentSection = sectionId;
        this.loadSectionData(sectionId);
    }

    updatePageTitle(sectionId) {
        const titles = {
            dashboard: 'Dashboard',
            payments: 'Payment Management',
            artists: 'Artist Management',
            tracks: 'Track Management',
            projects: 'Project Management',
            savings: 'Savings Goals',
            reports: 'Reports & Analytics',
            settings: 'Settings',
            'music-management': 'Music Management'
        };

        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');

        if (pageTitle) {
            pageTitle.textContent = titles[sectionId] || 'Admin Panel';
        }

        if (pageSubtitle) {
            const subtitles = {
                dashboard: 'Welcome to your admin dashboard',
                payments: 'Manage and track all payments',
                artists: 'Manage artist profiles and content',
                tracks: 'Manage music tracks and releases',
                projects: 'Track ongoing projects and progress',
                savings: 'Monitor client savings goals',
                reports: 'View analytics and reports',
                settings: 'Configure studio settings',
                'music-management': 'Upload and manage music tracks'
            };
            pageSubtitle.textContent = subtitles[sectionId] || 'Manage your studio operations';
        }
    }

    loadSectionData(sectionId) {
        this.showLoading();

        setTimeout(() => {
            switch(sectionId) {
                case 'dashboard':
                    this.renderDashboard();
                    break;
                case 'payments':
                    this.loadPayments();
                    break;
                case 'artists':
                    this.loadArtists();
                    break;
                case 'tracks':
                    this.loadTracks();
                    break;
                case 'music-management':
                    this.loadArtistsForSelect();
                    break;
            }
            this.hideLoading();
        }, 500);
    }

    loadArtistsForSelect() {
        const artistSelect = document.getElementById('trackArtist');
        if (artistSelect && this.data.artists) {
            artistSelect.innerHTML = '<option value="">Select Artist</option>' +
                this.data.artists.map(artist => 
                    `<option value="${artist.id}">${artist.name}</option>`
                ).join('');
        }
    }

    renderDashboard() {
        const totalRevenue = this.data.payments
            .filter(p => p.status === 'completed')
            .reduce((sum, payment) => sum + payment.amount, 0);
        
        const totalRevenueEl = document.getElementById('totalRevenue');
        const totalArtistsEl = document.getElementById('totalArtists');
        const activeProjectsEl = document.getElementById('activeProjects');
        const pendingPaymentsEl = document.getElementById('pendingPayments');

        if (totalRevenueEl) totalRevenueEl.textContent = `UGX ${this.formatNumber(totalRevenue)}`;
        if (totalArtistsEl) totalArtistsEl.textContent = this.data.artists.length;
        if (activeProjectsEl) activeProjectsEl.textContent = this.data.projects.length;
        if (pendingPaymentsEl) pendingPaymentsEl.textContent = this.data.payments.filter(p => p.status === 'pending').length;
        
        this.renderActivity();
    }

    renderActivity() {
        const activityList = document.getElementById('activityList');
        if (activityList) {
            activityList.innerHTML = this.data.activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-${this.getActivityIcon(activity.type)}"></i>
                    </div>
                    <div class="activity-content">
                        <p>${activity.message}</p>
                        <div class="activity-time">${activity.time}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    getActivityIcon(type) {
        const icons = {
            payment: 'money-bill-wave',
            project: 'project-diagram',
            artist: 'user-plus',
            track: 'music',
            system: 'cog'
        };
        return icons[type] || 'bell';
    }

    loadPayments() {
        const table = document.getElementById('paymentsTable');
        if (table) {
            table.innerHTML = this.data.payments.map(payment => `
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
    }

    loadNotifications() {
        const notificationsList = document.querySelector('.notifications-list');
        if (notificationsList) {
            notificationsList.innerHTML = this.data.notifications.map(notification => `
                <div class="activity-item ${notification.read ? 'read' : 'unread'}">
                    <div class="activity-icon">
                        <i class="fas fa-${this.getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="activity-content">
                        <strong>${notification.title}</strong>
                        <p>${notification.message}</p>
                        <div class="activity-time">${notification.time}</div>
                    </div>
                </div>
            `).join('');
        }
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

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    handleLogout() {
        localStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminToken');
        window.location.href = 'index.html';
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

    viewPayment(id) {
        const payment = this.data.payments.find(p => p.id === id);
        alert(`Payment: ${payment.id}\nArtist: ${payment.artist}\nAmount: UGX ${this.formatNumber(payment.amount)}`);
    }

    addNewArtist() {
        this.editingItem = null;
        this.showArtistForm();
    }

    addNewTrack() {
        this.editingItem = null;
        this.showTrackForm();
    }
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    window.adminPanel = new AdminPanel();
});