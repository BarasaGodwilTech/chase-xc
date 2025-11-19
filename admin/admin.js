// Admin Panel Main JavaScript
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
        
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadSampleData();
        this.showSection('dashboard');
        this.renderDashboard();
        this.loadNotifications();
    }

    checkAuth() {
        // This would normally check with adminAuth, but for simplicity:
        const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
        if (!token && !window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
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

        // Payment management
        document.getElementById('applyPaymentFilters')?.addEventListener('click', () => {
            this.filterPayments();
        });

        document.getElementById('exportPayments')?.addEventListener('click', () => {
            this.exportPayments();
        });

        document.getElementById('refreshPayments')?.addEventListener('click', () => {
            this.loadPayments();
        });

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // Close notifications panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications-panel') && 
                !e.target.closest('#notificationsBtn') &&
                notificationsPanel.classList.contains('active')) {
                notificationsPanel.classList.remove('active');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case '1':
                        e.preventDefault();
                        this.showSection('dashboard');
                        break;
                    case '2':
                        e.preventDefault();
                        this.showSection('payments');
                        break;
                    case '3':
                        e.preventDefault();
                        this.showSection('artists');
                        break;
                    case 'l':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.handleLogout();
                        }
                        break;
                    case 'k':
                        e.preventDefault();
                        document.querySelector('.search-box input').focus();
                        break;
                }
            }
        });

        // =========================================================================
        // MUSIC MANAGEMENT EVENT LISTENERS - ADD THIS SECTION
        // =========================================================================
        this.setupMusicManagement();
    }

    // =========================================================================
    // MUSIC MANAGEMENT METHODS - ADD THESE METHODS TO THE CLASS
    // =========================================================================

    setupMusicManagement() {
        // Method tabs
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const method = tab.getAttribute('data-method');
                this.switchUploadMethod(method);
            });
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
        // Update tabs
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-method="${method}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.method-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${method}Form`).classList.add('active');
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
        fileInfo.classList.add('active');

        audioUploadArea.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
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
            artworkPreview.innerHTML = `<img src="${e.target.result}" alt="Artwork preview">`;
        };
        reader.readAsDataURL(file);
    }

    async handleAudioUpload() {
        const formData = new FormData(document.getElementById('audioUploadForm'));
        
        try {
            this.showLoading();
            
            // Simulate API call - replace with actual endpoint
            await this.simulateApiCall('uploadTrack', formData);
            
            this.showNotification('Track uploaded successfully!', 'success');
            this.resetUploadForm();
            
            // Refresh tracks list if on tracks section
            if (this.currentSection === 'tracks') {
                this.loadTracks();
            }
            
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
            
            // In a real implementation, you would call your backend which would use Spotify API
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
                // Mock data - replace with actual Spotify API integration
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

        // Add event listeners to select buttons
        container.querySelectorAll('.select-track').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackData = JSON.parse(btn.getAttribute('data-track'));
                this.selectSpotifyTrack(trackData);
            });
        });
    }

    selectSpotifyTrack(track) {
        // Populate the Spotify URL field
        const spotifyUrl = document.getElementById('spotifyUrl');
        if (spotifyUrl) {
            spotifyUrl.value = track.url;
        }
        
        // Mark as selected
        document.querySelectorAll('.track-result').forEach(result => {
            result.classList.remove('selected');
        });
        event.target.closest('.track-result').classList.add('selected');
    }

    async importSpotifyTrack() {
        const spotifyUrl = document.getElementById('spotifyUrl')?.value.trim();
        
        if (!spotifyUrl) {
            this.showNotification('Please select a track or enter a Spotify URL', 'warning');
            return;
        }

        try {
            this.showLoading();
            
            // Simulate API call to import from Spotify
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
            
            // Simulate API call
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
        if (fileInfo) fileInfo.classList.remove('active');
        if (artworkPreview) {
            artworkPreview.innerHTML = `
                <i class="fas fa-image"></i>
                <span>No artwork selected</span>
            `;
        }
    }

    resetSpotifyForm() {
        const spotifyUrl = document.getElementById('spotifyUrl');
        const spotifySearch = document.getElementById('spotifySearch');
        const spotifyResults = document.getElementById('spotifyResults');

        if (spotifyUrl) spotifyUrl.value = '';
        if (spotifySearch) spotifySearch.value = '';
        if (spotifyResults) spotifyResults.innerHTML = '';
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
                // Simulate random success/failure
                if (Math.random() > 0.2) {
                    resolve({ success: true, message: 'Operation completed' });
                } else {
                    reject(new Error('Simulated API error'));
                }
            }, 2000);
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
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

        // Add to page
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        // Close on click
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

    // =========================================================================
    // EXISTING METHODS - KEEP THESE AS THEY ARE
    // =========================================================================

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

        // Simulate API call delay
        setTimeout(() => {
            switch(sectionId) {
                case 'dashboard':
                    this.renderDashboard();
                    break;
                case 'payments':
                    this.loadPayments();
                    break;
                case 'projects':
                    this.loadProjects();
                    break;
                case 'artists':
                    this.loadArtists();
                    break;
                case 'tracks':
                    this.loadTracks();
                    break;
                case 'savings':
                    this.loadSavings();
                    break;
                case 'reports':
                    this.loadReports();
                    break;
                case 'settings':
                    this.loadSettings();
                    break;
                case 'music-management':
                    // Initialize music management section
                    this.loadArtistsForSelect();
                    break;
            }
            this.hideLoading();
        }, 500);
    }

    loadSampleData() {
        // Sample data - in a real app, this would come from an API
        this.data = {
            payments: [
                {
                    id: 'TX001',
                    artist: 'Alex Nova',
                    amount: 1800000,
                    service: 'Music Production',
                    date: '2025-03-15',
                    status: 'completed'
                },
                {
                    id: 'TX002',
                    artist: 'Luna Sky',
                    amount: 900000,
                    service: 'Mixing & Mastering',
                    date: '2025-03-14',
                    status: 'pending'
                },
                {
                    id: 'TX003',
                    artist: 'Marcus Sound',
                    amount: 540000,
                    service: 'Vocal Production',
                    date: '2025-03-13',
                    status: 'completed'
                }
            ],
            projects: [
                {
                    id: 'P001',
                    name: 'Midnight Echo Album',
                    artist: 'Alex Nova',
                    service: 'Full Production',
                    budget: 5000000,
                    progress: 75,
                    deadline: '2025-04-15',
                    status: 'active'
                }
            ],
            artists: [
                {
                    id: 'A001',
                    name: 'Alex Nova',
                    genre: 'Electronic',
                    tracks: 12,
                    since: '2020',
                    status: 'active'
                },
                {
                    id: 'A002',
                    name: 'Sarah Miles',
                    genre: 'Afro-Pop',
                    tracks: 8,
                    since: '2021',
                    status: 'active'
                },
                {
                    id: 'A003',
                    name: 'DJ Kato',
                    genre: 'Electronic',
                    tracks: 15,
                    since: '2019',
                    status: 'active'
                }
            ],
            tracks: [
                {
                    id: 'T001',
                    title: 'Midnight Echo',
                    artist: 'Alex Nova',
                    genre: 'Electronic',
                    year: '2024',
                    streams: 125000
                }
            ],
            activities: [
                {
                    type: 'payment',
                    message: 'Payment received from Alex Nova - UGX 1,800,000',
                    time: '2 hours ago'
                },
                {
                    type: 'project',
                    message: 'Project "Electric Dreams" completed',
                    time: '1 day ago'
                },
                {
                    type: 'artist',
                    message: 'New artist registration: Sofia Beats',
                    time: '2 days ago'
                }
            ],
            notifications: [
                {
                    id: 'N001',
                    type: 'payment',
                    title: 'New Payment Received',
                    message: 'Alex Nova just paid UGX 1,800,000 for music production',
                    time: '2 hours ago',
                    read: false
                },
                {
                    id: 'N002',
                    type: 'project',
                    title: 'Project Deadline Approaching',
                    message: 'Midnight Echo Album deadline is in 30 days',
                    time: '5 hours ago',
                    read: false
                },
                {
                    id: 'N003',
                    type: 'system',
                    title: 'System Update Available',
                    message: 'New admin panel update is ready to install',
                    time: '1 day ago',
                    read: true
                }
            ]
        };
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
        // Update stats
        const totalRevenue = this.data.payments
            .filter(p => p.status === 'completed')
            .reduce((sum, payment) => sum + payment.amount, 0);
        
        // Render activity
        this.renderActivity();
        
        // Render charts
        this.renderCharts();
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

    renderCharts() {
        // In a real implementation, you would use Chart.js or similar
        console.log('Charts would be rendered here');
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
                        <button class="btn btn-secondary btn-sm" onclick="adminPanel.editPayment('${payment.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    filterPayments() {
        // Implementation for filtering payments
        console.log('Filtering payments...');
    }

    exportPayments() {
        // Implementation for exporting payments
        const csvContent = "data:text/csv;charset=utf-8," 
            + ["ID,Artist,Amount,Service,Date,Status"]
            .concat(this.data.payments.map(p => 
                `${p.id},${p.artist},${p.amount},${p.service},${p.date},${p.status}`
            ))
            .join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "payments_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    handleLogout() {
        // Clear storage
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminUser');
        
        // Redirect to login
        window.location.href = 'index.html';
    }

    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // Additional methods for other sections would be implemented here
    loadProjects() { /* ... */ }
    loadArtists() { /* ... */ }
    loadTracks() { /* ... */ }
    loadSavings() { /* ... */ }
    loadReports() { /* ... */ }
    loadSettings() { /* ... */ }

    viewPayment(id) {
        const payment = this.data.payments.find(p => p.id === id);
        alert(`Viewing payment: ${payment.id}\nArtist: ${payment.artist}\nAmount: UGX ${this.formatNumber(payment.amount)}`);
    }

    editPayment(id) {
        const payment = this.data.payments.find(p => p.id === id);
        alert(`Editing payment: ${payment.id}`);
    }
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Make available globally
window.adminPanel = adminPanel;