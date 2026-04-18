// data-manager.js - Simple Data Manager
class DataManager {
    constructor() {
        this.storageKey = 'chaseRecords_data';
        this.init();
    }

    init() {
        // Initialize default data structure if not exists
        if (!this.getData()) {
            const defaultData = {
                artists: [],
                tracks: [],
                settings: {
                    lastUpdated: new Date().toISOString()
                }
            };
            this.saveData(defaultData);
        }
    }

    getDefaultArtists() {
        // Return empty array - artists will be loaded from real data source
        return [];
    }

    getDefaultTracks() {
        // Return empty array - tracks will be loaded from real data source
        return [];
    }

    getData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading data:', error);
            return null;
        }
    }

    saveData(data) {
        try {
            data.settings.lastUpdated = new Date().toISOString();
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            this.triggerDataUpdate();
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }

    // Artist methods
    getAllArtists() {
        const data = this.getData();
        return data?.artists || [];
    }

    getArtist(id) {
        const artists = this.getAllArtists();
        return artists.find(artist => artist.id === id);
    }

    saveArtist(artistData) {
        const data = this.getData();
        if (!data) return null;

        const existingIndex = data.artists.findIndex(a => a.id === artistData.id);
        
        if (existingIndex >= 0) {
            data.artists[existingIndex] = { ...data.artists[existingIndex], ...artistData };
        } else {
            data.artists.push(artistData);
        }
        
        this.saveData(data);
        return artistData;
    }

    deleteArtist(artistId) {
        const data = this.getData();
        if (!data) return;

        data.artists = data.artists.filter(artist => artist.id !== artistId);
        
        // Also remove artist from tracks
        data.tracks = data.tracks.map(track => {
            if (track.artist === artistId) {
                return { ...track, artist: 'unknown', artistName: 'Unknown Artist' };
            }
            return track;
        });
        
        this.saveData(data);
    }

    // Track methods
    getAllTracks() {
        const data = this.getData();
        return data?.tracks || [];
    }

    getPublishedTracks() {
        const tracks = this.getAllTracks();
        return tracks.filter(track => track.status === 'published');
    }

    getTrack(id) {
        const tracks = this.getAllTracks();
        return tracks.find(track => track.id === id);
    }

    getTracksByArtist(artistId) {
        const tracks = this.getAllTracks();
        return tracks.filter(track => track.artist === artistId);
    }

    saveTrack(trackData) {
        const data = this.getData();
        if (!data) return null;

        // Generate ID if new track
        if (!trackData.id) {
            trackData.id = 'T' + String(data.tracks.length + 1).padStart(3, '0');
        }

        // Update artist name if artist exists
        const artist = data.artists.find(a => a.id === trackData.artist);
        if (artist) {
            trackData.artistName = artist.name;
        }

        const existingIndex = data.tracks.findIndex(t => t.id === trackData.id);
        
        if (existingIndex >= 0) {
            data.tracks[existingIndex] = { ...data.tracks[existingIndex], ...trackData };
        } else {
            data.tracks.push(trackData);
        }
        
        // Update artist track count
        this.updateArtistTrackCount(trackData.artist);
        
        this.saveData(data);
        return trackData;
    }

    deleteTrack(trackId) {
        const data = this.getData();
        if (!data) return;

        const track = data.tracks.find(t => t.id === trackId);
        
        if (track) {
            data.tracks = data.tracks.filter(t => t.id !== trackId);
            this.updateArtistTrackCount(track.artist);
            this.saveData(data);
        }
    }

    updateArtistTrackCount(artistId) {
        const data = this.getData();
        if (!data) return;

        const artistTracks = data.tracks.filter(track => track.artist === artistId);
        const artist = data.artists.find(a => a.id === artistId);
        
        if (artist) {
            artist.tracks = artistTracks.length;
            this.saveData(data);
        }
    }

    // Event system for real-time updates
    triggerDataUpdate() {
        window.dispatchEvent(new CustomEvent('dataUpdated', {
            detail: { timestamp: new Date().toISOString() }
        }));
    }
}

// Initialize global data manager
window.dataManager = new DataManager();