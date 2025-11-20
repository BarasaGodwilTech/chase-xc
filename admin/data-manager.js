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
                artists: this.getDefaultArtists(),
                tracks: this.getDefaultTracks(),
                settings: {
                    lastUpdated: new Date().toISOString()
                }
            };
            this.saveData(defaultData);
        }
    }

    getDefaultArtists() {
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
            },
            {
                id: 'A002',
                name: 'DJ Kato',
                genre: 'Electronic',
                bio: 'Electronic music producer and DJ.',
                image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
                tracks: 2,
                streams: 45800,
                since: '2024',
                status: 'active'
            }
        ];
    }

    getDefaultTracks() {
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
                status: 'published',
                audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
            },
            {
                id: 'T002',
                title: 'City Lights',
                artist: 'A002',
                artistName: 'DJ Kato',
                genre: 'Electronic',
                duration: '4:20',
                year: '2024',
                streams: 45800,
                likes: 8700,
                downloads: 6200,
                artwork: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop',
                description: 'Energetic electronic track inspired by city nightlife',
                releaseDate: '2024-11-28',
                status: 'published',
                audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
            }
        ];
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