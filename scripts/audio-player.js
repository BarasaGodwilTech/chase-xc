// Audio Player Component

class AudioPlayer {
  constructor() {
    this.audio = document.getElementById("audioElement")
    this.playBtn = document.getElementById("playBtn")
    this.prevBtn = document.getElementById("prevBtn")
    this.nextBtn = document.getElementById("nextBtn")
    this.seekBar = document.getElementById("seekBar")
    this.volumeControl = document.getElementById("volumeControl")
    this.progressBar = document.getElementById("progressBar")
    this.currentTimeDisplay = document.getElementById("currentTime")
    this.durationDisplay = document.getElementById("duration")
    this.playerTitle = document.getElementById("playerTitle")
    this.playerArtist = document.getElementById("playerArtist")
    this.playerCover = document.getElementById("playerCover")

    // Only initialize if audio element exists on the page
    if (!this.audio) return

    this.isPlaying = false
    this.currentTrackIndex = 0

    // Extended tracks data for music page
    this.tracks = [
      {
        title: "Midnight Echo",
        artist: "By Alex Studios",
        cover: "/placeholder.svg?height=60&width=60",
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      },
      {
        title: "Electric Dreams",
        artist: "By Luna Project",
        cover: "/placeholder.svg?height=60&width=60",
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      },
      {
        title: "Neon Nights",
        artist: "By Sonic Wave",
        cover: "/placeholder.svg?height=60&width=60",
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      },
      {
        title: "Crystal Sound",
        artist: "By Rhythm Kings",
        cover: "/placeholder.svg?height=60&width=60",
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      },
      {
        title: "Urban Legends",
        artist: "By Metro Beats",
        cover: "/placeholder.svg?height=60&width=60",
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      },
      {
        title: "Solar Flare",
        artist: "By Cosmic Drift",
        cover: "/placeholder.svg?height=60&width=60",
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      },
    ]

    this.init()
  }

  init() {
    this.setupEventListeners()
    this.loadTrack(this.currentTrackIndex)
    this.updateVolume()
  }

  setupEventListeners() {
    if (this.playBtn) this.playBtn.addEventListener("click", () => this.togglePlay())
    if (this.nextBtn) this.nextBtn.addEventListener("click", () => this.nextTrack())
    if (this.prevBtn) this.prevBtn.addEventListener("click", () => this.prevTrack())
    if (this.seekBar) this.seekBar.addEventListener("input", (e) => this.seek(e))
    if (this.volumeControl) this.volumeControl.addEventListener("input", (e) => this.updateVolume())

    this.audio.addEventListener("timeupdate", () => this.updateProgress())
    this.audio.addEventListener("loadedmetadata", () => this.updateDuration())
    this.audio.addEventListener("ended", () => this.nextTrack())

    // Track card click handlers
    document.querySelectorAll(".play-btn-card").forEach((btn, index) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        this.currentTrackIndex = index
        this.loadTrack(index)
        this.play()
      })
    })

    document.querySelectorAll(".track-card").forEach((card, index) => {
      card.addEventListener("click", () => {
        this.currentTrackIndex = index
        this.loadTrack(index)
        this.play()
      })
    })
  }

  loadTrack(index) {
    const track = this.tracks[index]
    this.audio.src = track.src
    if (this.playerTitle) this.playerTitle.textContent = track.title
    if (this.playerArtist) this.playerArtist.textContent = track.artist
    if (this.playerCover) this.playerCover.src = track.cover
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause()
    } else {
      this.play()
    }
  }

  play() {
    this.audio.play()
    this.isPlaying = true
    if (this.playBtn) {
      this.playBtn.textContent = "⏸"
      this.playBtn.classList.add("playing")
    }
  }

  pause() {
    this.audio.pause()
    this.isPlaying = false
    if (this.playBtn) {
      this.playBtn.textContent = "▶"
      this.playBtn.classList.remove("playing")
    }
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length
    this.loadTrack(this.currentTrackIndex)
    this.play()
  }

  prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length
    this.loadTrack(this.currentTrackIndex)
    this.play()
  }

  seek(e) {
    const seekTime = (e.target.value / 100) * this.audio.duration
    this.audio.currentTime = seekTime
  }

  updateProgress() {
    if (this.audio.duration) {
      const progress = (this.audio.currentTime / this.audio.duration) * 100
      if (this.progressBar) this.progressBar.style.width = progress + "%"
      if (this.seekBar) this.seekBar.value = progress
      if (this.currentTimeDisplay) this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime)
    }
  }

  updateDuration() {
    if (this.durationDisplay) this.durationDisplay.textContent = this.formatTime(this.audio.duration)
  }

  updateVolume() {
    this.audio.volume = this.volumeControl.value / 100
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00"

    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`
  }
}

// Initialize player when DOM is ready and audio element exists
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("audioElement")) {
    new AudioPlayer()
  }
})