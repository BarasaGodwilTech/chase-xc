// admin.js - Simplified Working Version
class AdminPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.dataManager = window.dataManager;
        this.editingItem = null;
        
        // Check if dataManager is available
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
        
        // Listen for data updates
        window.addEventListener('dataUpdated', () => {
            this.loadSectionData(this.currentSection);
        });
        
        console.log('AdminPanel initialized successfully');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Navigation
        document.querySelectorAll('.nav-item[data-target]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.getAttribute('data-target');
                console.log('Navigation clicked:', target);
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

        // Basic button handlers
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        // Add new buttons
        document.getElementById('addTrackBtn')?.addEventListener('click', () => {
            this.addNewTrack();
        });

        // Simple music management
        this.setupBasicMusicManagement();

        console.log('Event listeners setup complete');
    }

    setupBasicMusicManagement() {
        // Method tabs
        document.addEventListener('click', (e) => {
            if (e.target.closest('.method-tab')) {
                const tab = e.target.closest('.method-tab');
                const method = tab.getAttribute('data-method');
                this.switchUploadMethod(method);
            }
        });

        // Simple form submission for audio upload
        document.getElementById('audioUploadForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSimpleAudioUpload();
        });
    }

    switchUploadMethod(method) {
        console.log('Switching to method:', method);
        
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

    handleSimpleAudioUpload() {
        const formData = new FormData(document.getElementById('audioUploadForm'));
        const title = formData.get('trackTitle');
        const artist = formData.get('trackArtist');
        const genre = formData.get('trackGenre');

        if (!title || !artist || !genre) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const trackData = {
            title: title,
            artist: artist,
            genre: genre,
            duration: '3:45',
            streams: 0,
            likes: 0,
            downloads: 0,
            status: 'published',
            artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
            audioUrl: '/placeholder.mp3',
            releaseDate: new Date().toISOString().split('T')[0],
            description: 'New track uploaded via admin panel'
        };

        this.dataManager.saveTrack(trackData);
        this.showNotification('Track uploaded successfully!', 'success');
        
        // Reset form
        document.getElementById('audioUploadForm').reset();
        
        // Refresh tracks if on that section
        if (this.currentSection === 'tracks') {
            this.loadTracks();
        }
    }

    showSection(sectionId) {
        console.log('Showing section:', sectionId);
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-target="${sectionId}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Update sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const activeSection = document.getElementById(sectionId);
        if (activeSection) {
            activeSection.classList.add('active');
        } else {
            console.error('Section not found:', sectionId);
            return;
        }

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
                'music-management': 'Upload and manage music tracks'
            };
            pageSubtitle.textContent = subtitles[sectionId] || 'Manage your studio operations';
        }
    }

    loadSectionData(sectionId) {
        console.log('Loading section data:', sectionId);
        this.showLoading();

        // Simulate loading time
        setTimeout(() => {
            try {
                switch(sectionId) {
                    case 'dashboard':
                        this.renderDashboard();
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
        
        // Update stats
        const totalRevenueEl = document.getElementById('totalRevenue');
        const totalArtistsEl = document.getElementById('totalArtists');
        const activeProjectsEl = document.getElementById('activeProjects');
        const pendingPaymentsEl = document.getElementById('pendingPayments');

        if (totalRevenueEl) totalRevenueEl.textContent = `UGX ${this.formatNumber(totalRevenue)}`;
        if (totalArtistsEl) totalArtistsEl.textContent = artists.length;
        if (activeProjectsEl) activeProjectsEl.textContent = publishedTracks.length;
        if (pendingPaymentsEl) pendingPaymentsEl.textContent = '0';

        console.log('Dashboard rendered successfully');
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

        console.log('Artists loaded:', artists.length);
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

        console.log('Tracks loaded:', tracks.length);
    }

    loadArtistsForSelect() {
        const artistSelect = document.getElementById('trackArtist');
        if (artistSelect) {
            const artists = this.dataManager.getAllArtists();
            artistSelect.innerHTML = '<option value="">Select Artist</option>' +
                artists.map(artist => 
                    `<option value="${artist.id}">${artist.name}</option>`
                ).join('');
        }
    }

    loadPayments() {
        const table = document.getElementById('paymentsTable');
        if (table) {
            // Simple sample payments
            const payments = [
                {
                    id: 'TX001',
                    artist: 'Sarah Miles',
                    amount: 1800000,
                    service: 'Music Production',
                    date: '2025-03-15',
                    status: 'completed'
                },
                {
                    id: 'TX002',
                    artist: 'DJ Kato',
                    amount: 2500000,
                    service: 'Mixing & Mastering',
                    date: '2025-03-10',
                    status: 'pending'
                }
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