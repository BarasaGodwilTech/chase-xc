// Main JavaScript - Global Scripts & DOM Management

function initApp() {
    initHeader()
    initNavigation()
    initSmoothScroll()
    initTestimonialCarousel()
    initContactForm()
    initTrackCards()
    setActiveNavLink()
    initMembership()
}

document.addEventListener("DOMContentLoaded", () => {
    // If the page uses partial includes, wait for them so header elements exist.
    // Otherwise run immediately.
    if (document.querySelector('[data-include]')) return
    initApp()
})

document.addEventListener('includes:loaded', () => {
    initApp()
})

// Header Scroll Effect
function initHeader() {
    const header = document.getElementById("header")

    window.addEventListener("scroll", () => {
        if (window.scrollY > 100) {
            header.classList.add("scrolled")
        } else {
            header.classList.remove("scrolled")
        }
    })
}

// Mobile Navigation Toggle
function initNavigation() {
    const hamburger = document.getElementById("hamburger")
    const nav = document.getElementById("nav")
    const navLinks = document.querySelectorAll(".nav-link")

    if (hamburger) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active")
            nav.classList.toggle("active")
        })
    }

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            if (hamburger) {
                hamburger.classList.remove("active")
                nav.classList.remove("active")
            }
        })
    })
}

// Set active navigation link based on current page
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'
    const navLinks = document.querySelectorAll('.nav-link')
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href')
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active')
        }
    })
}

// Smooth Scrolling for Navigation Links
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]')

    links.forEach((link) => {
        link.addEventListener("click", function (e) {
            const targetId = this.getAttribute("href")
            if (targetId.startsWith('#')) {
                e.preventDefault()
                const target = document.querySelector(targetId)

                if (target) {
                    const headerHeight = 80
                    const targetPosition = target.offsetTop - headerHeight

                    window.scrollTo({
                        top: targetPosition,
                        behavior: "smooth",
                    })
                }
            }
        })
    })
}

// Testimonials Carousel
function initTestimonialCarousel() {
    const slides = document.querySelectorAll(".testimonial-slide")
    const dotsContainer = document.getElementById("carouselDots")
    const prevBtn = document.getElementById("prevTestimonial")
    const nextBtn = document.getElementById("nextTestimonial")

    if (slides.length === 0) return

    let currentSlide = 0

    // Create dots if container exists
    if (dotsContainer) {
        slides.forEach((_, index) => {
            const dot = document.createElement("div")
            dot.className = `carousel-dot ${index === 0 ? "active" : ""}`
            dot.addEventListener("click", () => goToSlide(index))
            dotsContainer.appendChild(dot)
        })
    }

    function showSlide(n) {
        slides.forEach((slide) => slide.classList.remove("active"))
        document.querySelectorAll(".carousel-dot").forEach((dot) => dot.classList.remove("active"))

        slides[n].classList.add("active")
        if (dotsContainer) {
            document.querySelectorAll(".carousel-dot")[n].classList.add("active")
        }
    }

    function goToSlide(n) {
        currentSlide = n
        showSlide(currentSlide)
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length
        showSlide(currentSlide)
    }

    function prevSlide() {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length
        showSlide(currentSlide)
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", prevSlide)
    }
    
    if (nextBtn) {
        nextBtn.addEventListener("click", nextSlide)
    }

    // Auto-rotate testimonials
    setInterval(nextSlide, 8000)

    showSlide(0)
}

// Contact Form Validation
function initContactForm() {
    const form = document.getElementById("contactForm")

    if (!form) return

    form.addEventListener("submit", (e) => {
        e.preventDefault()

        if (validateForm()) {
            // Show success message
            alert("Thank you for reaching out! We'll get back to you soon.")
            form.reset()
            clearErrors()
        }
    })
}

function validateForm() {
    const name = document.getElementById("name")
    const email = document.getElementById("email")
    const subject = document.getElementById("subject")
    const message = document.getElementById("message")

    let isValid = true

    // Clear previous errors
    clearErrors()

    // Validate Name
    if (name && name.value.trim() === "") {
        showError("name", "Name is required")
        isValid = false
    }

    // Validate Email
    if (email && email.value.trim() === "") {
        showError("email", "Email is required")
        isValid = false
    } else if (email && !isValidEmail(email.value)) {
        showError("email", "Please enter a valid email")
        isValid = false
    }

    // Validate Subject
    if (subject && subject.value === "") {
        showError("subject", "Please select a subject")
        isValid = false
    }

    // Validate Message
    if (message && message.value.trim() === "") {
        showError("message", "Message is required")
        isValid = false
    } else if (message && message.value.trim().length < 10) {
        showError("message", "Message must be at least 10 characters")
        isValid = false
    }

    return isValid
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

function showError(fieldId, errorMessage) {
    const field = document.getElementById(fieldId)
    const errorElement = document.getElementById(`${fieldId}Error`)
    const formGroup = field.closest(".form-group")

    formGroup.classList.add("error")
    errorElement.textContent = errorMessage
    errorElement.classList.add("show")
}

function clearErrors() {
    document.querySelectorAll(".form-group").forEach((group) => {
        group.classList.remove("error")
    })
    document.querySelectorAll(".error-message").forEach((msg) => {
        msg.classList.remove("show")
        msg.textContent = ""
    })
}

// Track Card Click - Play Track
function initTrackCards() {
    const trackCards = document.querySelectorAll(".track-card")

    trackCards.forEach((card) => {
        card.addEventListener("click", function () {
            const trackIndex = this.getAttribute("data-track")
            const audioPlayer = document.getElementById("audioPlayer")
            // Scroll to player if it exists on this page
            if (audioPlayer) {
                audioPlayer.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }
        })
    })
}

function initMembership() {
    const membershipModal = document.getElementById('membershipModal')
    const planSelectButtons = document.querySelectorAll('.plan-select')
    const membershipForm = document.getElementById('membershipForm')

    if (!membershipModal || planSelectButtons.length === 0 || !membershipForm) return

    const selectedPlanName = document.getElementById('selectedPlanName')
    const selectedPlanPrice = document.getElementById('selectedPlanPrice')
    const selectedPlanDescription = document.getElementById('selectedPlanDescription')
    const billingCycle = document.getElementById('billingCycle')
    const paymentInstructions = document.getElementById('paymentInstructions')
    const instructionsTitle = document.getElementById('instructionsTitle')
    const instructionsText = document.getElementById('instructionsText')
    const transactionInput = document.getElementById('transactionInput')
    const transactionId = document.getElementById('transactionId')

    const plans = {
        weekly: {
            name: 'Weekly Pass',
            price: 'UGX 150,000',
            period: 'week',
            description: '10 hours of studio time, basic mixing for 2 tracks'
        },
        monthly: {
            name: 'Monthly Pro',
            price: 'UGX 500,000',
            period: 'month',
            description: '50 hours of studio time, unlimited mixing sessions'
        },
        yearly: {
            name: 'Yearly Elite',
            price: 'UGX 5,000,000',
            period: 'year',
            description: '600 hours of studio time, unlimited mixing & mastering'
        }
    }

    function openMembershipModal(planType) {
        const plan = plans[planType] || plans.monthly

        if (selectedPlanName) selectedPlanName.textContent = `${plan.name} Plan`
        if (selectedPlanPrice) selectedPlanPrice.textContent = `${plan.price} / ${plan.period}`
        if (selectedPlanDescription) selectedPlanDescription.textContent = plan.description
        if (billingCycle) billingCycle.value = planType

        membershipModal.classList.add('active')
        document.body.style.overflow = 'hidden'
    }

    function closeMembershipModal() {
        membershipModal.classList.remove('active')
        document.body.style.overflow = ''

        membershipModal.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'))
        if (paymentInstructions) paymentInstructions.style.display = 'none'
        if (transactionInput) transactionInput.style.display = 'none'
        if (transactionId) transactionId.value = ''
    }

    function updatePaymentInstructions(method, amountText) {
        if (!paymentInstructions || !instructionsTitle || !instructionsText) return

        paymentInstructions.style.display = 'block'

        const textByMethod = {
            mtn: {
                title: 'MTN Mobile Money',
                text: `Send ${amountText} to the studio MTN number. Enter the transaction ID below after payment.`
            },
            airtel: {
                title: 'Airtel Money',
                text: `Send ${amountText} to the studio Airtel number. Enter the reference ID below after payment.`
            },
            card: {
                title: 'Card Payment',
                text: `Card payments are not yet automated. Please contact the studio to complete payment for ${amountText}.`
            },
            bank: {
                title: 'Bank Transfer',
                text: `Transfer ${amountText} to the studio bank account. Enter the transfer reference below.`
            }
        }

        const content = textByMethod[method] || { title: 'Payment', text: '' }
        instructionsTitle.textContent = content.title
        instructionsText.textContent = content.text

        const needsReference = method === 'mtn' || method === 'airtel' || method === 'bank'
        if (transactionInput) transactionInput.style.display = needsReference ? 'block' : 'none'
        if (transactionId) transactionId.required = needsReference
    }

    function getSelectedPaymentMethod() {
        const selected = membershipModal.querySelector('.payment-option.selected')
        return selected ? selected.getAttribute('data-method') : null
    }

    function processSubscription() {
        const fullName = document.getElementById('fullName')?.value?.trim()
        const email = document.getElementById('email')?.value?.trim()
        const phone = document.getElementById('phone')?.value?.trim()
        const cycle = billingCycle?.value || 'monthly'
        const method = getSelectedPaymentMethod()
        const ref = transactionId?.value?.trim()

        if (!fullName || !email || !phone) {
            alert('Please fill in all required fields.')
            return
        }

        if (!method) {
            alert('Please select a payment method.')
            return
        }

        const needsReference = method === 'mtn' || method === 'airtel' || method === 'bank'
        if (needsReference && !ref) {
            alert('Please enter your Transaction ID / Reference.')
            return
        }

        const record = {
            id: `membership_${Date.now()}`,
            fullName,
            email,
            phone,
            billingCycle: cycle,
            paymentMethod: method,
            transactionId: ref || null,
            timestamp: new Date().toISOString(),
            status: 'pending'
        }

        const existing = JSON.parse(localStorage.getItem('membershipSubscriptions') || '[]')
        existing.push(record)
        localStorage.setItem('membershipSubscriptions', JSON.stringify(existing))

        alert('Subscription submitted! We will confirm your payment shortly.')
        membershipForm.reset()
        closeMembershipModal()
    }

    planSelectButtons.forEach(button => {
        button.addEventListener('click', function () {
            const planType = this.getAttribute('data-plan')
            openMembershipModal(planType)
        })
    })

    membershipModal.addEventListener('click', function (e) {
        const option = e.target.closest('.payment-option')
        if (option) {
            membershipModal.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'))
            option.classList.add('selected')

            const amountText = (selectedPlanPrice?.textContent || '').split('/')[0].trim() || 'the amount'
            updatePaymentInstructions(option.getAttribute('data-method'), amountText)
            return
        }

        if (e.target.classList.contains('modal-close') || e.target.classList.contains('membership-modal')) {
            closeMembershipModal()
        }
    })

    membershipForm.addEventListener('submit', function (e) {
        e.preventDefault()
        processSubscription()
    })

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && membershipModal.classList.contains('active')) {
            closeMembershipModal()
        }
    })
}

// === MUSIC FILTERS FUNCTIONALITY ===
class MusicFilters {
    constructor() {
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.trackCards = document.querySelectorAll('.track-card');
        this.musicGrid = document.getElementById('musicGrid');
        
        if (this.filterButtons.length > 0) {
            this.init();
        }
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.handleFilterClick(e);
            });
        });
    }
    
    handleFilterClick(e) {
        const button = e.currentTarget;
        const filter = button.dataset.filter;
        
        // Update active state
        this.filterButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        // Filter tracks
        this.filterTracks(filter);
        
        // Add click animation
        this.animateButtonClick(button);
    }
    
    filterTracks(filter) {
        let visibleCount = 0;
        
        this.trackCards.forEach(card => {
            const category = card.dataset.category;
            const shouldShow = filter === 'all' || category === filter;
            
            if (shouldShow) {
                card.style.display = 'block';
                visibleCount++;
                
                // Add animation delay for staggered appearance
                setTimeout(() => {
                    card.classList.add('filter-visible');
                    card.classList.remove('filter-hidden');
                }, visibleCount * 50);
            } else {
                card.classList.add('filter-hidden');
                card.classList.remove('filter-visible');
                
                // Hide after animation
                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            }
        });
        
        // Show message if no tracks found
        this.showNoResultsMessage(visibleCount === 0, filter);
    }
    
    animateButtonClick(button) {
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
    }
    
    showNoResultsMessage(show, filter) {
        // Remove existing message
        const existingMessage = this.musicGrid.querySelector('.no-results-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        if (show) {
            const message = document.createElement('div');
            message.className = 'no-results-message';
            message.innerHTML = `
                <div class="no-results-content">
                    <i class="fas fa-music"></i>
                    <h4>No ${this.getFilterDisplayName(filter)} Found</h4>
                    <p>Check back later for new ${this.getFilterDisplayName(filter).toLowerCase()} tracks</p>
                </div>
            `;
            this.musicGrid.appendChild(message);
        }
    }
    
    getFilterDisplayName(filter) {
        const names = {
            'all': 'Tracks',
            'new': 'New Releases',
            'popular': 'Popular Tracks',
            'trending': 'Trending Tracks'
        };
        return names[filter] || 'Tracks';
    }
}

// Initialize music filters when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize music filters
    new MusicFilters();
    
    // Initialize music search
    new MusicSearch();
});

// === MUSIC SEARCH FUNCTIONALITY ===
class MusicSearch {
    constructor() {
        this.searchInput = document.getElementById('musicSearch');
        this.searchClear = document.getElementById('searchClear');
        this.searchFilterToggle = document.getElementById('searchFilterToggle');
        this.searchFilters = document.getElementById('searchFilters');
        this.resultsCount = document.getElementById('resultsCount');
        this.trackCards = document.querySelectorAll('.track-card');
        this.musicGrid = document.getElementById('musicGrid');
        this.sortBy = document.getElementById('sortBy');
        this.genreFilter = document.getElementById('genreFilter');
        this.durationFilter = document.getElementById('durationFilter');
        
        this.allTracks = Array.from(this.trackCards);
        this.currentSearchTerm = '';
        
        if (this.searchInput) {
            this.init();
        }
    }
    
    init() {
        this.setupEventListeners();
        this.updateResultsCount(this.allTracks.length);
    }
    
    setupEventListeners() {
        // Search input events
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch(e.target.value);
            }
        });
        
        // Clear search
        this.searchClear.addEventListener('click', () => {
            this.clearSearch();
        });
        
        // Filter toggle
        this.searchFilterToggle.addEventListener('click', () => {
            this.toggleFilters();
        });
        
        // Filter changes
        this.sortBy.addEventListener('change', () => {
            this.applyFilters();
        });
        
        this.genreFilter.addEventListener('change', () => {
            this.applyFilters();
        });
        
        this.durationFilter.addEventListener('change', () => {
            this.applyFilters();
        });
        
        // Close filters when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-filters') && !e.target.closest('.search-filter-toggle')) {
                this.searchFilters.classList.remove('show');
                this.searchFilterToggle.classList.remove('active');
            }
        });
    }
    
    handleSearch(searchTerm) {
        this.currentSearchTerm = searchTerm.toLowerCase().trim();
        
        // Show/hide clear button
        if (this.currentSearchTerm) {
            this.searchClear.classList.add('show');
        } else {
            this.searchClear.classList.remove('show');
        }
        
        this.applyFilters();
    }
    
    applyFilters() {
        let filteredTracks = [...this.allTracks];
        
        // Apply search filter
        if (this.currentSearchTerm) {
            filteredTracks = filteredTracks.filter(card => {
                const title = card.querySelector('.track-title').textContent.toLowerCase();
                const artist = card.querySelector('.track-artist').textContent.toLowerCase();
                const genre = card.querySelector('.track-genre').textContent.toLowerCase();
                
                return title.includes(this.currentSearchTerm) || 
                       artist.includes(this.currentSearchTerm) || 
                       genre.includes(this.currentSearchTerm);
            });
            
            // Highlight search terms
            this.highlightSearchTerms(filteredTracks);
        }
        
        // Apply genre filter
        const genreValue = this.genreFilter.value;
        if (genreValue !== 'all') {
            filteredTracks = filteredTracks.filter(card => {
                const genre = card.querySelector('.track-genre').textContent.toLowerCase();
                return genre.includes(genreValue);
            });
        }
        
        // Apply duration filter
        const durationValue = this.durationFilter.value;
        if (durationValue !== 'all') {
            filteredTracks = filteredTracks.filter(card => {
                const durationText = card.querySelector('.track-duration').textContent;
                const minutes = parseInt(durationText.split(':')[0]);
                
                switch (durationValue) {
                    case 'short': return minutes < 3;
                    case 'medium': return minutes >= 3 && minutes <= 5;
                    case 'long': return minutes > 5;
                    default: return true;
                }
            });
        }
        
        // Apply sorting
        this.sortTracks(filteredTracks);
        
        // Update display
        this.displayFilteredTracks(filteredTracks);
        this.updateResultsCount(filteredTracks.length);
    }
    
    sortTracks(tracks) {
        const sortValue = this.sortBy.value;
        
        tracks.sort((a, b) => {
            switch (sortValue) {
                case 'newest':
                    return this.getReleaseDate(b) - this.getReleaseDate(a);
                case 'oldest':
                    return this.getReleaseDate(a) - this.getReleaseDate(b);
                case 'popular':
                    return this.getPopularity(b) - this.getPopularity(a);
                case 'duration':
                    return this.getDuration(b) - this.getDuration(a);
                default: // relevance
                    return 0;
            }
        });
    }
    
    getReleaseDate(card) {
        const dateText = card.querySelector('.release-date').textContent;
        const match = dateText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})/);
        if (match) {
            const month = match[1];
            const year = match[2];
            return new Date(`${month} 1, ${year}`).getTime();
        }
        return 0;
    }
    
    getPopularity(card) {
        const stats = card.querySelector('.track-stats');
        if (stats) {
            const playText = stats.querySelector('.stat:nth-child(1) span').textContent;
            return parseInt(playText.replace('K', '000').replace('.', ''));
        }
        return 0;
    }
    
    getDuration(card) {
        const durationText = card.querySelector('.track-duration').textContent;
        const [minutes, seconds] = durationText.split(':').map(Number);
        return minutes * 60 + seconds;
    }
    
    displayFilteredTracks(tracks) {
        // Remove existing no results message
        const existingMessage = this.musicGrid.querySelector('.no-search-results');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Hide all tracks first
        this.allTracks.forEach(card => {
            card.style.display = 'none';
            card.classList.remove('filter-visible');
            card.classList.add('filter-hidden');
        });
        
        // Show filtered tracks with animation
        if (tracks.length === 0) {
            this.showNoResultsMessage();
        } else {
            tracks.forEach((card, index) => {
                setTimeout(() => {
                    card.style.display = 'block';
                    card.classList.remove('filter-hidden');
                    card.classList.add('filter-visible');
                }, index * 50);
            });
        }
    }
    
    highlightSearchTerms(tracks) {
        // Remove existing highlights
        this.allTracks.forEach(card => {
            const title = card.querySelector('.track-title');
            const artist = card.querySelector('.track-artist');
            const genre = card.querySelector('.track-genre');
            
            this.removeHighlights(title);
            this.removeHighlights(artist);
            this.removeHighlights(genre);
        });
        
        // Apply highlights to filtered tracks
        if (this.currentSearchTerm) {
            tracks.forEach(card => {
                const title = card.querySelector('.track-title');
                const artist = card.querySelector('.track-artist');
                const genre = card.querySelector('.track-genre');
                
                this.applyHighlight(title, this.currentSearchTerm);
                this.applyHighlight(artist, this.currentSearchTerm);
                this.applyHighlight(genre, this.currentSearchTerm);
            });
        }
    }
    
    applyHighlight(element, searchTerm) {
        const text = element.textContent;
        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        const highlighted = text.replace(regex, '<span class="search-highlight">$1</span>');
        element.innerHTML = highlighted;
    }
    
    removeHighlights(element) {
        element.innerHTML = element.textContent;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    showNoResultsMessage() {
        const message = document.createElement('div');
        message.className = 'no-search-results';
        message.innerHTML = `
            <div class="no-search-results-content">
                <i class="fas fa-search"></i>
                <h4>No tracks found</h4>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
        this.musicGrid.appendChild(message);
    }
    
    updateResultsCount(count) {
        this.resultsCount.textContent = `${count} track${count !== 1 ? 's' : ''}`;
    }
    
    clearSearch() {
        this.searchInput.value = '';
        this.currentSearchTerm = '';
        this.searchClear.classList.remove('show');
        this.removeHighlightsFromAll();
        this.applyFilters();
    }
    
    removeHighlightsFromAll() {
        this.allTracks.forEach(card => {
            const title = card.querySelector('.track-title');
            const artist = card.querySelector('.track-artist');
            const genre = card.querySelector('.track-genre');
            
            this.removeHighlights(title);
            this.removeHighlights(artist);
            this.removeHighlights(genre);
        });
    }
    
    toggleFilters() {
        this.searchFilters.classList.toggle('show');
        this.searchFilterToggle.classList.toggle('active');
    }
}