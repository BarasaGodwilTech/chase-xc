// Main JavaScript - Global Scripts & DOM Management

document.addEventListener("DOMContentLoaded", () => {
    initHeader()
    initNavigation()
    initSmoothScroll()
    initTestimonialCarousel()
    initContactForm()
    initTrackCards()
    setActiveNavLink()
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