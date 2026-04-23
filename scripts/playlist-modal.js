// Playlist Selection Modal - Replaces browser prompts with a proper UI
class PlaylistModal {
    constructor() {
        this.modal = null;
        this.currentTrack = null;
        this.onSelect = null;
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        // Check if modal already exists
        if (document.getElementById('playlistModal')) return;

        const modalHTML = `
            <div class="modal" id="playlistModal">
                <div class="modal-content playlist-modal-content">
                    <div class="modal-header">
                        <h3>Add to Playlist</h3>
                        <button class="modal-close" id="closePlaylistModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="playlist-modal-track-info" id="playlistModalTrackInfo">
                            <img id="playlistModalTrackArtwork" src="" alt="">
                            <div class="playlist-modal-track-details">
                                <h4 id="playlistModalTrackTitle">Track Title</h4>
                                <p id="playlistModalTrackArtist">Artist Name</p>
                            </div>
                        </div>
                        <div class="playlist-modal-search">
                            <input type="text" id="playlistSearchInput" placeholder="Search playlists...">
                        </div>
                        <div class="playlist-modal-list" id="playlistModalList">
                            <!-- Playlists will be loaded here -->
                        </div>
                        <div class="playlist-modal-create">
                            <button class="btn btn-outline btn-full" id="createNewPlaylistBtn">
                                <i class="fas fa-plus"></i> Create New Playlist
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('playlistModal');
    }

    setupEventListeners() {
        const closeBtn = document.getElementById('closePlaylistModal');
        const createBtn = document.getElementById('createNewPlaylistBtn');
        const searchInput = document.getElementById('playlistSearchInput');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreatePlaylist());
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterPlaylists(e.target.value));
        }

        // Close on backdrop click
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal?.classList.contains('active')) {
                this.close();
            }
        });
    }

    async open(track, onSelect) {
        this.currentTrack = track;
        this.onSelect = onSelect;

        // Update track info
        const artwork = document.getElementById('playlistModalTrackArtwork');
        const title = document.getElementById('playlistModalTrackTitle');
        const artist = document.getElementById('playlistModalTrackArtist');

        if (artwork) artwork.src = track.artwork || 'public/player-cover-1.jpg';
        if (title) title.textContent = track.title || 'Unknown Track';
        if (artist) artist.textContent = track.artistName || track.artist || 'Unknown Artist';

        // Load playlists
        await this.loadPlaylists();

        // Show modal
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus search input
        setTimeout(() => {
            const searchInput = document.getElementById('playlistSearchInput');
            if (searchInput) searchInput.focus();
        }, 100);
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.currentTrack = null;
        this.onSelect = null;

        // Clear search
        const searchInput = document.getElementById('playlistSearchInput');
        if (searchInput) searchInput.value = '';
    }

    async loadPlaylists() {
        const uid = window.userAuth?.getCurrentUser?.()?.uid;
        if (!uid) {
            this.showError('Please log in to manage playlists');
            return;
        }

        try {
            const { getPlaylists } = await import('./user-data.js');
            const playlists = await getPlaylists(uid, 50);
            this.renderPlaylists(playlists || []);
        } catch (error) {
            console.error('[PlaylistModal] Error loading playlists:', error);
            this.showError('Failed to load playlists');
        }
    }

    renderPlaylists(playlists) {
        const list = document.getElementById('playlistModalList');
        if (!list) return;

        if (!playlists || playlists.length === 0) {
            list.innerHTML = `
                <div class="playlist-modal-empty">
                    <i class="fas fa-list"></i>
                    <p>No playlists yet</p>
                    <p class="text-muted">Create your first playlist to get started</p>
                </div>
            `;
            return;
        }

        list.innerHTML = playlists.map(playlist => {
            const trackCount = playlist.trackCount || (playlist.tracks?.length || 0);
            const isDuplicate = this.isTrackInPlaylist(playlist);
            
            return `
                <div class="playlist-modal-item ${isDuplicate ? 'duplicate' : ''}" data-playlist-id="${playlist.id}">
                    <div class="playlist-modal-item-icon">
                        <i class="fas fa-music"></i>
                    </div>
                    <div class="playlist-modal-item-info">
                        <h4>${this.escapeHtml(playlist.name)}</h4>
                        <p>${trackCount} track${trackCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div class="playlist-modal-item-status">
                        ${isDuplicate ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}
                    </div>
                </div>
            `;
        }).join('');

        // Add click listeners
        list.querySelectorAll('.playlist-modal-item').forEach(item => {
            item.addEventListener('click', () => {
                const playlistId = item.dataset.playlistId;
                this.selectPlaylist(playlistId);
            });
        });
    }

    isTrackInPlaylist(playlist) {
        if (!this.currentTrack?.id || !playlist.tracks) return false;
        return playlist.tracks.includes(this.currentTrack.id);
    }

    async selectPlaylist(playlistId) {
        if (!this.currentTrack || !this.onSelect) return;

        const uid = window.userAuth?.getCurrentUser?.()?.uid;
        if (!uid) return;

        try {
            const { getPlaylists, addTrackToPlaylist } = await import('./user-data.js');
            const playlists = await getPlaylists(uid, 50);
            const playlist = playlists?.find(p => p.id === playlistId);

            if (!playlist) return;

            // Check if track already exists
            if (this.isTrackInPlaylist(playlist)) {
                this.showNotification('Track already in playlist', 'info');
                return;
            }

            // Add track to playlist
            await addTrackToPlaylist(uid, playlistId, this.currentTrack);
            this.showNotification('Added to playlist!', 'success');

            // Refresh the list to show updated state
            await this.loadPlaylists();

            // Call callback if provided
            if (this.onSelect) {
                this.onSelect(playlistId, playlist.name);
            }
        } catch (error) {
            console.error('[PlaylistModal] Error adding to playlist:', error);
            this.showNotification('Failed to add to playlist', 'error');
        }
    }

    showCreatePlaylist() {
        const name = prompt('Enter playlist name:');
        if (!name || !name.trim()) return;

        this.createPlaylist(name.trim());
    }

    async createPlaylist(name) {
        const uid = window.userAuth?.getCurrentUser?.()?.uid;
        if (!uid) return;

        try {
            const { createPlaylist, addTrackToPlaylist } = await import('./user-data.js');
            const playlistId = await createPlaylist(uid, name);

            if (!playlistId) {
                this.showNotification('Failed to create playlist', 'error');
                return;
            }

            // Add track to new playlist
            if (this.currentTrack) {
                await addTrackToPlaylist(uid, playlistId, this.currentTrack);
            }

            this.showNotification(`Created "${name}" and added track!`, 'success');

            // Refresh the list
            await this.loadPlaylists();

            // Call callback if provided
            if (this.onSelect) {
                this.onSelect(playlistId, name);
            }
        } catch (error) {
            console.error('[PlaylistModal] Error creating playlist:', error);
            this.showNotification('Failed to create playlist', 'error');
        }
    }

    filterPlaylists(query) {
        const items = document.querySelectorAll('.playlist-modal-item');
        const lowerQuery = query.toLowerCase();

        items.forEach(item => {
            const name = item.querySelector('h4')?.textContent.toLowerCase() || '';
            if (name.includes(lowerQuery)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    showError(message) {
        const list = document.getElementById('playlistModalList');
        if (list) {
            list.innerHTML = `
                <div class="playlist-modal-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${this.escapeHtml(message)}</p>
                </div>
            `;
        }
    }

    showNotification(message, type = 'info') {
        // Reuse existing notification system or create inline notification
        const notification = document.createElement('div');
        notification.className = `playlist-modal-notification playlist-modal-notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 500;
            z-index: 10;
            animation: slideUp 0.3s ease-out;
        `;

        const modalBody = this.modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.style.position = 'relative';
            modalBody.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideDown 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
}

// Create singleton instance
window.playlistModal = new PlaylistModal();

// Export for use in other modules
export { PlaylistModal };
