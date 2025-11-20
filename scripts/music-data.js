// music-data.js
class MusicDataRenderer {
    constructor() {
        this.dataManager = window.dataManager;
        this.init();
    }

    init() {
        this.renderMusicGrid();
        this.setupEventListeners();
        
        // Listen for data updates from admin panel
        window.addEventListener('dataUpdated', () => {
            this.renderMusicGrid();
        });
    }

    renderMusicGrid() {
        const container = document.getElementById('musicGrid');
        if (!container) return;

        const tracks = this.dataManager.getPublishedTracks();
        
        container.innerHTML = tracks.map((track, index) => {
            const artist = this.dataManager.getArtist(track.artist);
            const categories = this.getTrackCategories(track);
            const badge = this.getTrackBadge(track);
            
            return `
                <div class="track-card" data-track="${index}" data-category="${categories.join(' ')}">
                    <div class="track-artwork">
                        <img src="${track.artwork}" alt="${track.title}">
                        <button class="play-btn-card" onclick="musicPlayer.playTrack(${index})">
                            <i class="fas fa-play"></i>
                        </button>
                        ${badge ? `<div class="track-badge ${badge.type}">${badge.text}</div>` : ''}
                        <div class="track-overlay">
                            <div class="overlay-actions">
                                <button class="overlay-btn" title="Add to playlist">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="overlay-btn" title="Like" onclick="musicData.toggleLike('${track.id}')">
                                    <i class="far fa-heart"></i>
                                </button>
                                <button class="overlay-btn" title="Share">
                                    <i class="fas fa-share"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="track-content">
                        <h4 class="track-title">${track.title}</h4>
                        <p class="track-artist">${artist?.name || track.artistName}</p>
                        <div class="track-meta">
                            <span class="track-genre">${track.genre}</span>
                            <span class="track-duration">${track.duration}</span>
                        </div>
                        <div class="track-stats">
                            <div class="stat">
                                <i class="fas fa-play"></i>
                                <span>${this.formatNumber(track.streams)}</span>
                            </div>
                            <div class="stat">
                                <i class="fas fa-heart"></i>
                                <span>${this.formatNumber(track.likes)}</span>
                            </div>
                            <div class="stat">
                                <i class="fas fa-download"></i>
                                <span>${this.formatNumber(track.downloads)}</span>
                            </div>
                        </div>
                        <div class="release-date">Released: ${new Date(track.releaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Update results count
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
        }
    }

    getTrackCategories(track) {
        const categories = ['all'];
        if (track.featured) categories.push('featured');
        if (track.categories) categories.push(...track.categories);
        
        // Auto-categorize based on streams and release date
        if (track.streams > 50000) categories.push('popular');
        if (track.streams > 100000) categories.push('trending');
        
        const releaseDate = new Date(track.releaseDate);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (releaseDate > thirtyDaysAgo) categories.push('new');
        
        return categories;
    }

    getTrackBadge(track) {
        if (track.streams > 100000) return { type: 'trending', text: 'Trending' };
        if (track.streams > 50000) return { type: 'popular', text: 'Popular' };
        
        const releaseDate = new Date(track.releaseDate);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (releaseDate > thirtyDaysAgo) return { type: 'new-release', text: 'New' };
        
        return null;
    }

    toggleLike(trackId) {
        const track = this.dataManager.getTrack(trackId);
        if (track) {
            track.likes = (track.likes || 0) + 1;
            this.dataManager.saveTrack(track);
            this.renderMusicGrid();
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.getAttribute('data-filter');
                this.applyFilter(filter);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('musicSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
    }

    applyFilter(filter) {
        const tracks = document.querySelectorAll('.track-card');
        tracks.forEach(track => {
            if (filter === 'all' || track.getAttribute('data-category').includes(filter)) {
                track.style.display = 'block';
            } else {
                track.style.display = 'none';
            }
        });

        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
    }

    handleSearch(query) {
        const tracks = document.querySelectorAll('.track-card');
        const lowercaseQuery = query.toLowerCase();
        
        tracks.forEach(track => {
            const title = track.querySelector('.track-title').textContent.toLowerCase();
            const artist = track.querySelector('.track-artist').textContent.toLowerCase();
            const genre = track.querySelector('.track-genre').textContent.toLowerCase();
            
            if (title.includes(lowercaseQuery) || artist.includes(lowercaseQuery) || genre.includes(lowercaseQuery)) {
                track.style.display = 'block';
            } else {
                track.style.display = 'none';
            }
        });
    }
}

// Initialize music data renderer
document.addEventListener('DOMContentLoaded', function() {
    window.musicData = new MusicDataRenderer();
});