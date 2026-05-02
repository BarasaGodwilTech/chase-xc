// Duration Fetcher Service
// Handles fetching duration from various platforms (YouTube, Spotify, SoundCloud)
class DurationFetcher {
    constructor() {
        this.cache = new Map();
        this.apiKeys = {
            youtube: null, // Will use YouTube Data API v3 without key for public videos
            spotify: null, // Spotify Web API requires authentication
            soundcloud: null // SoundCloud API requires authentication
        };
        this.axiosScriptLoaded = false;
    }

    // Load axios for API requests
    ensureAxiosLoaded() {
        if (this.axiosScriptLoaded || window.axios) return Promise.resolve();
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js';
            script.onload = () => {
                this.axiosScriptLoaded = true;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Fetch YouTube video duration using YouTube Data API
    async fetchYouTubeDuration(videoUrl) {
        const videoId = this.extractYouTubeId(videoUrl);
        if (!videoId) return null;

        // Check cache first
        const cacheKey = `youtube_${videoId}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
                return cached.duration;
            }
        }

        try {
            // Method 1: Try YouTube Data API (no key needed for public videos)
            const duration = await this.fetchYouTubeDurationFromAPI(videoId);
            if (duration) {
                this.cache.set(cacheKey, { duration, timestamp: Date.now() });
                return duration;
            }
        } catch (error) {
            console.warn('[DurationFetcher] YouTube API failed, trying fallback:', error);
        }

        try {
            // Method 2: Parse from video page (fallback)
            const duration = await this.fetchYouTubeDurationFromPage(videoId);
            if (duration) {
                this.cache.set(cacheKey, { duration, timestamp: Date.now() });
                return duration;
            }
        } catch (error) {
            console.warn('[DurationFetcher] YouTube page parsing failed:', error);
            // Don't throw error, just return null to prevent breaking the flow
        }

        return null;
    }

    extractYouTubeId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/.*[?&]v=([^&\n?#]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    async fetchYouTubeDurationFromAPI(videoId) {
        await this.ensureAxiosLoaded();
        
        // Use oembed endpoint which doesn't require API key
        const response = await window.axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        
        if (response.data && response.data.title) {
            // Try to extract duration from title (some videos include duration)
            const title = response.data.title;
            const durationMatch = title.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (durationMatch) {
                const [, minutes, seconds, hours] = durationMatch;
                const totalSeconds = hours ? 
                    parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) :
                    parseInt(minutes) * 60 + parseInt(seconds);
                return totalSeconds;
            }
        }
        
        throw new Error('Could not extract duration from oembed');
    }

    async fetchYouTubeDurationFromPage(videoId) {
        await this.ensureAxiosLoaded();
        
        // Use Invidious instance as a privacy-friendly alternative
        const instances = [
            'https://yewtu.be',
            'https://invidious.snopyta.org',
            'https://yewtu.be'
        ];
        
        for (const instance of instances) {
            try {
                const response = await window.axios.get(`${instance}/api/v1/videos/${videoId}`);
                if (response.data && response.data.lengthSeconds) {
                    return response.data.lengthSeconds;
                }
            } catch (error) {
                console.warn(`[DurationFetcher] Failed to fetch from ${instance}:`, error.message);
                continue; // Try next instance
            }
        }
        
        // Return null instead of throwing to prevent breaking the flow
        return null;
    }

    // Fetch Spotify track duration
    async fetchSpotifyDuration(spotifyUrl) {
        const trackId = this.extractSpotifyId(spotifyUrl);
        if (!trackId) return null;

        const cacheKey = `spotify_${trackId}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 3600000) {
                return cached.duration;
            }
        }

        try {
            // Method 1: Try Spotify embed data extraction
            const duration = await this.fetchSpotifyDurationFromEmbed(spotifyUrl);
            if (duration) {
                this.cache.set(cacheKey, { duration, timestamp: Date.now() });
                return duration;
            }
        } catch (error) {
            console.warn('[DurationFetcher] Spotify embed extraction failed:', error);
        }

        // Method 2: Use public Spotify API (requires authentication - not implemented)
        // This would require OAuth flow which is complex for client-side only
        
        return null;
    }

    extractSpotifyId(url) {
        const match = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    async fetchSpotifyDurationFromEmbed(spotifyUrl) {
        return new Promise((resolve) => {
            // Create a hidden iframe to load Spotify embed
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `https://open.spotify.com/embed/track/${this.extractSpotifyId(spotifyUrl)}`;
            
            const timeout = setTimeout(() => {
                document.body.removeChild(iframe);
                resolve(null);
            }, 5000);

            iframe.onload = () => {
                try {
                    // Try to access embed data (may be blocked by CORS)
                    // This is a best-effort approach
                    const embedData = iframe.contentWindow?.document?.body?.innerText;
                    if (embedData) {
                        const durationMatch = embedData.match(/(\d{1,2}):(\d{2})/);
                        if (durationMatch) {
                            clearTimeout(timeout);
                            document.body.removeChild(iframe);
                            const [, minutes, seconds] = durationMatch;
                            resolve(parseInt(minutes) * 60 + parseInt(seconds));
                            return;
                        }
                    }
                } catch (error) {
                    // Expected due to CORS
                }
                
                clearTimeout(timeout);
                document.body.removeChild(iframe);
                resolve(null);
            };

            document.body.appendChild(iframe);
        });
    }

    // Fetch SoundCloud track duration
    async fetchSoundCloudDuration(soundcloudUrl) {
        const trackId = this.extractSoundCloudId(soundcloudUrl);
        if (!trackId) return null;

        const cacheKey = `soundcloud_${trackId}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 3600000) {
                return cached.duration;
            }
        }

        try {
            const duration = await this.fetchSoundCloudDurationFromAPI(soundcloudUrl);
            if (duration) {
                this.cache.set(cacheKey, { duration, timestamp: Date.now() });
                return duration;
            }
        } catch (error) {
            console.warn('[DurationFetcher] SoundCloud API failed:', error);
        }

        return null;
    }

    extractSoundCloudId(url) {
        // Extract from URL like https://soundcloud.com/user/track-name
        const match = url.match(/soundcloud\.com\/[^\/]+\/([^\/\?]+)/);
        return match ? match[1] : null;
    }

    async fetchSoundCloudDurationFromAPI(soundcloudUrl) {
        await this.ensureAxiosLoaded();
        
        // Use SoundCloud oembed endpoint
        const response = await window.axios.get(`https://soundcloud.com/oembed?url=${encodeURIComponent(soundcloudUrl)}&format=json`);
        
        if (response.data && response.data.title) {
            // Try to extract duration from title
            const title = response.data.title;
            const durationMatch = title.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (durationMatch) {
                const [, minutes, seconds, hours] = durationMatch;
                const totalSeconds = hours ? 
                    parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) :
                    parseInt(minutes) * 60 + parseInt(seconds);
                return totalSeconds;
            }
        }
        
        throw new Error('Could not extract duration from SoundCloud oembed');
    }

    // Generic method to fetch duration from any supported platform
    async fetchDuration(url, platform = null) {
        if (!platform) {
            platform = this.detectPlatform(url);
        }

        switch (platform) {
            case 'youtube':
            case 'youtubemusic':
                return await this.fetchYouTubeDuration(url);
            case 'spotify':
                return await this.fetchSpotifyDuration(url);
            case 'soundcloud':
                return await this.fetchSoundCloudDuration(url);
            default:
                return null;
        }
    }

    detectPlatform(url) {
        if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
            return 'youtube';
        }
        if (/^(https?:\/\/)?(open\.)?spotify\.com\//i.test(url)) {
            return 'spotify';
        }
        if (/^(https?:\/\/)?(www\.)?soundcloud\.com\//i.test(url)) {
            return 'soundcloud';
        }
        return null;
    }

    // Format seconds to human-readable format
    formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Get cached duration
    getCachedDuration(url, platform = null) {
        if (!platform) {
            platform = this.detectPlatform(url);
        }
        
        const cacheKey = `${platform}_${url}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 3600000) {
            return cached.duration;
        }
        return null;
    }
}

// Create global instance
window.durationFetcher = new DurationFetcher();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DurationFetcher;
}
