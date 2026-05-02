import { auth } from './firebase-init.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { getPlaylists, removeTrackFromPlaylist } from './user-data.js'
import { fetchArtists, fetchArtistById, fetchTrackById } from './data/content-repo.js'

function uniqueStrings(values) {
    const out = []
    const seen = new Set()
    for (const v of values || []) {
        const s = String(v || '').trim()
        if (!s) continue
        const key = s.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(s)
    }
    return out
}

function splitArtistParts(name) {
    const raw = String(name || '').trim()
    if (!raw) return []
    return raw
        .split(/\s*(?:&|•|\+|,|\/|\bfeat\.?\b|\bft\.?\b|\bx\b)\s*/i)
        .map((p) => String(p || '').trim())
        .filter((p) => p && p.toLowerCase() !== 'unknown artist')
}

function normalizeArtistParts(values) {
    const parts = []
    for (const v of values || []) {
        parts.push(...splitArtistParts(v))
    }
    return uniqueStrings(parts)
}

async function resolveTrackArtistLine(track, artistsById) {
    const t = track || {}
    const namesFromDoc = Array.isArray(t.collaboratorNames) ? t.collaboratorNames : []

    const parts = []

    if (namesFromDoc.length > 0) {
        parts.push(...namesFromDoc)
    }

    const collabIds = Array.isArray(t.collaborators) ? t.collaborators : []
    if (collabIds.length > 0) {
        const fetched = await Promise.all(
            collabIds.map(async (id) => {
                const key = String(id || '').trim()
                if (!key) return ''
                const fromCache = artistsById?.get(key)
                if (fromCache?.name) return fromCache.name
                try {
                    const a = await fetchArtistById(key)
                    return a?.name || ''
                } catch (_) {
                    return ''
                }
            })
        )
        parts.push(...fetched)
    }

    if (t.artistName) parts.push(t.artistName)

    const primaryId = String(t.artist || '').trim()
    if (primaryId) {
        const fromCache = artistsById?.get(primaryId)
        if (fromCache?.name) parts.push(fromCache.name)
        else {
            try {
                const a = await fetchArtistById(primaryId)
                if (a?.name) parts.push(a.name)
            } catch (_) {}
        }
    }

    const normalized = normalizeArtistParts(parts)
    return normalized.length > 0 ? normalized.join(' & ') : (t.artistName || 'Unknown Artist')
}

class PlaylistDetail {
    constructor() {
        this.currentUser = null;
        this.playlistId = null;
        this.playlist = null;
        this.tracks = [];
        this.artistsById = new Map();
        this.init();
    }

    init() {
        this.getPlaylistIdFromUrl();
        this.setupEventListeners();

        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.loadPlaylist();
            } else {
                window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.href);
            }
        });
    }

    getPlaylistIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        this.playlistId = params.get('id');
    }

    setupEventListeners() {
        const playAllBtn = document.getElementById('playAllBtn');
        const shuffleBtn = document.getElementById('shuffleBtn');
        const editPlaylistBtn = document.getElementById('editPlaylistBtn');
        const deletePlaylistBtn = document.getElementById('deletePlaylistBtn');

        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => this.playAll());
        }

        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.shuffle());
        }

        if (editPlaylistBtn) {
            editPlaylistBtn.addEventListener('click', () => this.editPlaylist());
        }

        if (deletePlaylistBtn) {
            deletePlaylistBtn.addEventListener('click', () => this.deletePlaylist());
        }
    }

    async loadPlaylist() {
        if (!this.currentUser?.uid || !this.playlistId) return;

        try {
            const playlists = await getPlaylists(this.currentUser.uid, 50);
            this.playlist = playlists?.find(p => p.id === this.playlistId);

            if (!this.playlist) {
                this.showError('Playlist not found');
                return;
            }

            this.updateHeader();
            await this.loadTracks();
        } catch (error) {
            console.error('[PlaylistDetail] Error loading playlist:', error);
            this.showError('Failed to load playlist');
        }
    }

    updateHeader() {
        const title = document.getElementById('playlistTitle');
        const meta = document.getElementById('playlistMeta');

        if (title) title.textContent = this.playlist.name || 'Untitled Playlist';
        if (meta) {
            const trackCount = this.playlist.trackCount || (this.playlist.tracks?.length || 0);
            meta.textContent = `${trackCount} track${trackCount !== 1 ? 's' : ''}`;
        }
    }

    async loadTracks() {
        const container = document.getElementById('playlistTracksList');
        if (!container) return;

        const trackIds = this.playlist.tracks || [];
        
        if (!trackIds || trackIds.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <h3>No tracks in this playlist</h3>
                    <p>Add tracks from the music page to build your playlist</p>
                    <a href="music.html" class="btn btn-primary">Browse Music</a>
                </div>
            `;
            return;
        }

        // Fetch track details for each track ID
        this.tracks = [];
        try {
            const artists = await fetchArtists()
            this.artistsById = new Map((artists || []).map((a) => [String(a.id), a]))
        } catch (e) {
            console.warn('[PlaylistDetail] Failed to fetch artists for collaboration resolution', e)
            this.artistsById = new Map()
        }

        for (const trackId of trackIds) {
            try {
                const track = await fetchTrackById(trackId);
                if (track) {
                    const artistLine = await resolveTrackArtistLine(track, this.artistsById)
                    this.tracks.push({ ...track, artistName: artistLine });
                }
            } catch (error) {
                console.error('[PlaylistDetail] Error loading track:', trackId, error);
            }
        }

        this.renderTracks();
    }

    renderTracks() {
        const container = document.getElementById('playlistTracksList');
        const trackCount = document.getElementById('trackCount');
        
        if (trackCount) {
            trackCount.textContent = `${this.tracks.length} track${this.tracks.length !== 1 ? 's' : ''}`;
        }

        if (this.tracks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <h3>No tracks in this playlist</h3>
                    <p>Add tracks from the music page to build your playlist</p>
                    <a href="music.html" class="btn btn-primary">Browse Music</a>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tracks.map((track, index) => {
            const spotifyUrl = track.spotifyUrl || track.platformLinks?.spotify || '';
            return `
                <div class="playlist-track-item" data-track-id="${track.id}" data-index="${index}">
                    <div class="playlist-track-number">
                        <span>${index + 1}</span>
                    </div>
                    <div class="playlist-track-artwork">
                        <img src="${track.artwork || 'public/player-cover-1.jpg'}" alt="${track.title}">
                        <button class="playlist-track-play-btn" type="button" aria-label="Play ${track.title}">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    <div class="playlist-track-info">
                        <h4 class="playlist-track-title">${track.title}</h4>
                        <p class="playlist-track-artist">${track.artistName || 'Unknown Artist'}</p>
                    </div>
                    <div class="playlist-track-duration">
                        <span>${track.duration || ''}</span>
                    </div>
                    <div class="playlist-track-actions">
                        ${spotifyUrl ? `<a href="${spotifyUrl}" target="_blank" class="playlist-track-action" title="Open in Spotify"><i class="fab fa-spotify"></i></a>` : ''}
                        <button class="playlist-track-action btn-remove" data-track-id="${track.id}" title="Remove from playlist">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        this.setupTrackListeners();
    }

    setupTrackListeners() {
        // Play buttons
        document.querySelectorAll('.playlist-track-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.playlist-track-item');
                const index = parseInt(item.dataset.index);
                this.playTrack(index);
            });
        });

        // Remove buttons
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackId = btn.dataset.trackId;
                this.removeTrack(trackId);
            });
        });

        // Track item click - play track
        document.querySelectorAll('.playlist-track-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.playlist-track-action')) return;
                const index = parseInt(item.dataset.index);
                this.playTrack(index);
            });

            // Drag and drop
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => this.handleDragStart(e));
            item.addEventListener('dragover', (e) => this.handleDragOver(e));
            item.addEventListener('drop', (e) => this.handleDrop(e));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });
    }

    handleDragStart(e) {
        this.draggedItem = e.target.closest('.playlist-track-item');
        this.draggedIndex = parseInt(this.draggedItem.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        this.draggedItem.classList.add('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const item = e.target.closest('.playlist-track-item');
        if (item && item !== this.draggedItem) {
            item.classList.add('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const dropTarget = e.target.closest('.playlist-track-item');
        if (!dropTarget || dropTarget === this.draggedItem) return;

        const dropIndex = parseInt(dropTarget.dataset.index);
        this.reorderTrack(this.draggedIndex, dropIndex);

        // Remove drag-over class
        document.querySelectorAll('.playlist-track-item').forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    handleDragEnd(e) {
        this.draggedItem?.classList.remove('dragging');
        document.querySelectorAll('.playlist-track-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        this.draggedItem = null;
        this.draggedIndex = null;
    }

    async reorderTrack(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;

        // Reorder local array
        const [movedTrack] = this.tracks.splice(fromIndex, 1);
        this.tracks.splice(toIndex, 0, movedTrack);

        // Update Firestore playlist track order
        const newTrackIds = this.tracks.map(t => t.id);
        
        try {
            const { doc, updateDoc, getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const db = getFirestore();
            const playlistRef = doc(db, 'users', this.currentUser.uid, 'playlists', this.playlistId);
            await updateDoc(playlistRef, { 
                tracks: newTrackIds,
                updatedAt: new Date()
            });

            // Update local playlist
            this.playlist.tracks = newTrackIds;
            
            // Re-render
            this.renderTracks();
            this.showNotification('Track order updated', 'success');
        } catch (error) {
            console.error('[PlaylistDetail] Error reordering tracks:', error);
            this.showNotification('Failed to reorder track', 'error');
            // Revert local changes
            this.loadTracks();
        }
    }

    playTrack(index) {
        const track = this.tracks[index];
        if (!track) return;

        console.log('[PlaylistDetail] Playing track:', track.title);

        // Use persistent floating player
        if (window.persistentPlayer) {
            const playlistData = this.tracks.map(t => ({
                id: t.id,
                title: t.title,
                artistName: t.artistName,
                artwork: t.artwork,
                platformLinks: t.platformLinks || {},
                originalData: t
            }));

            window.persistentPlayer.setPlaylist(playlistData, index);
            window.persistentPlayer.play();
        }
    }

    playAll() {
        if (this.tracks.length === 0) return;
        this.playTrack(0);
    }

    shuffle() {
        if (this.tracks.length === 0) return;

        // Shuffle array
        const shuffled = [...this.tracks];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Play first track
        if (window.persistentPlayer) {
            const playlistData = shuffled.map(t => ({
                id: t.id,
                title: t.title,
                artistName: t.artistName,
                artwork: t.artwork,
                platformLinks: t.platformLinks || {},
                originalData: t
            }));

            window.persistentPlayer.setPlaylist(playlistData, 0);
            window.persistentPlayer.play();
        }
    }

    editPlaylist() {
        const newName = prompt('Edit playlist name:', this.playlist.name);
        if (newName && newName.trim()) {
            this.updatePlaylistName(newName.trim());
        }
    }

    async updatePlaylistName(newName) {
        if (!this.currentUser?.uid || !this.playlistId) return;

        try {
            const { doc, updateDoc, getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const db = getFirestore();
            const playlistRef = doc(db, 'users', this.currentUser.uid, 'playlists', this.playlistId);
            await updateDoc(playlistRef, { name: newName, updatedAt: new Date() });

            this.playlist.name = newName;
            this.updateHeader();
            this.showNotification('Playlist updated', 'success');
        } catch (error) {
            console.error('[PlaylistDetail] Error updating playlist:', error);
            this.showNotification('Failed to update playlist', 'error');
        }
    }

    async deletePlaylist() {
        if (!confirm('Are you sure you want to delete this playlist? This action cannot be undone.')) return;

        if (!this.currentUser?.uid || !this.playlistId) return;

        try {
            const { doc, deleteDoc, getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const db = getFirestore();
            const playlistRef = doc(db, 'users', this.currentUser.uid, 'playlists', this.playlistId);
            await deleteDoc(playlistRef);

            this.showNotification('Playlist deleted', 'success');
            setTimeout(() => {
                const href = 'profile.html'
                if (typeof window.spaNavigate === 'function') {
                    window.spaNavigate(href)
                } else {
                    window.location.href = href;
                }
            }, 1000);
        } catch (error) {
            console.error('[PlaylistDetail] Error deleting playlist:', error);
            this.showNotification('Failed to delete playlist', 'error');
        }
    }

    async removeTrack(trackId) {
        if (!this.currentUser?.uid || !this.playlistId) return;

        try {
            await removeTrackFromPlaylist(this.currentUser.uid, this.playlistId, trackId);
            
            // Remove from local array
            this.tracks = this.tracks.filter(t => t.id !== trackId);
            
            // Re-render
            this.renderTracks();
            this.updateHeader();
            
            this.showNotification('Track removed from playlist', 'success');
        } catch (error) {
            console.error('[PlaylistDetail] Error removing track:', error);
            this.showNotification('Failed to remove track', 'error');
        }
    }

    showError(message) {
        const container = document.querySelector('.playlist-detail-section');
        if (container) {
            container.innerHTML = `
                <div class="container">
                    <div class="error-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <h2>${message}</h2>
                        <a href="profile.html" class="btn btn-primary">Back to Profile</a>
                    </div>
                </div>
            `;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#00d4ff'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 3000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

function initPlaylistDetailPage() {
    const root = document.getElementById('playlistTracksList')
    if (!root) return
    if (root.dataset.playlistDetailInit === '1') return
    root.dataset.playlistDetailInit = '1'
    new PlaylistDetail()
}

// Initialize playlist detail page
document.addEventListener('DOMContentLoaded', () => {
    initPlaylistDetailPage()
})

document.addEventListener('includes:loaded', () => {
    initPlaylistDetailPage()
})

document.addEventListener('spa:navigated', () => {
    initPlaylistDetailPage()
})
