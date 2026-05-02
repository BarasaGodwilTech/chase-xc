// Team functionality for fetching and displaying team members from Firebase
import { db } from './firebase-init.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

/**
 * Fetches team members from Firebase Firestore
 * @returns {Promise<Array>} Array of team member objects
 */
async function fetchTeamMembers() {
    try {
        console.log('Fetching team members from Firebase...');

        // Avoid composite index requirements (e.g. where + orderBy) and tolerate missing fields.
        // Fetch all team docs, then filter/sort client-side.
        const querySnapshot = await getDocs(collection(db, 'team'));
        const allMembers = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        const teamMembers = (allMembers || [])
            .filter((m) => m && m.id)
            .filter((m) => (m.status || 'active') === 'active')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

        console.log(`Successfully fetched ${teamMembers.length} team members`);
        return teamMembers;
    } catch (error) {
        console.error('Error fetching team members:', error);
        return [];
    }
}

/**
 * Creates HTML for a single team member card
 * @param {Object} member - Team member object
 * @returns {string} HTML string for the team member card
 */
function createTeamMemberCard(member) {
    const socialLinks = member.socials ? Object.entries(member.socials)
        .map(([platform, url]) => {
            const iconClass = getSocialIcon(platform);
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="team-social-link" aria-label="${platform}">
                        <i class="${iconClass}"></i>
                    </a>`;
        }).join('') : '';

    const skillsHtml = member.skills ? member.skills
        .map(skill => `<span class="team-skill-tag">${skill}</span>`)
        .join('') : '';

    return `
        <div class="team-member-card" data-team-member-id="${member.id}">
            <div class="team-member-image-wrapper">
                <img src="${member.image || 'https://via.placeholder.com/250'}" 
                     alt="${member.name}" 
                     class="team-member-image"
                     loading="lazy"
                     decoding="async">
                ${member.badge ? `<span class="team-member-badge">${member.badge}</span>` : ''}
            </div>
            <div class="team-member-info">
                <h3 class="team-member-name">${member.name}</h3>
                <p class="team-member-role">${member.role}</p>
                <p class="team-member-bio">${member.bio}</p>
                ${skillsHtml ? `<div class="team-member-skills">${skillsHtml}</div>` : ''}
                ${socialLinks ? `<div class="team-member-socials">${socialLinks}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Gets the Font Awesome icon class for a social platform
 * @param {string} platform - Social platform name
 * @returns {string} Font Awesome icon class
 */
function getSocialIcon(platform) {
    const iconMap = {
        'instagram': 'fab fa-instagram',
        'twitter': 'fab fa-twitter',
        'x': 'fab fa-x-twitter',
        'linkedin': 'fab fa-linkedin',
        'facebook': 'fab fa-facebook',
        'youtube': 'fab fa-youtube',
        'tiktok': 'fab fa-tiktok'
    };
    return iconMap[platform.toLowerCase()] || 'fas fa-link';
}

/**
 * Renders team members to the DOM
 * @param {Array} teamMembers - Array of team member objects
 */
function renderTeamMembers(teamMembers) {
    const teamGrid = document.getElementById('teamGrid');
    
    if (!teamGrid) {
        console.warn('Team grid element not found');
        return;
    }

    if (teamMembers.length === 0) {
        teamGrid.innerHTML = `
            <div class="team-empty-state">
                <i class="fas fa-users"></i>
                <p>Team members will be displayed here soon.</p>
            </div>
        `;
        return;
    }

    const teamHtml = teamMembers.map(member => createTeamMemberCard(member)).join('');
    teamGrid.innerHTML = teamHtml;
    
    // Add scroll functionality if there are more than 4 team members
    if (teamMembers.length > 4) {
        setupScrollFunctionality(teamGrid);
    }
}

/**
 * Sets up scroll functionality for the team grid
 * @param {HTMLElement} teamGrid - The team grid element
 */
function setupScrollFunctionality(teamGrid) {
    // Add scroll indicators
    addScrollIndicators(teamGrid);
    
    // Add touch/swipe support for mobile
    addTouchSupport(teamGrid);
    
    // Add keyboard navigation
    addKeyboardNavigation(teamGrid);
}

/**
 * Adds scroll indicators to show more content is available
 * @param {HTMLElement} teamGrid - The team grid element
 */
function addScrollIndicators(teamGrid) {
    // Check if scroll indicators already exist
    if (teamGrid.parentElement.querySelector('.team-scroll-indicators')) {
        return;
    }
    
    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.className = 'team-scroll-indicators';
    indicatorsContainer.innerHTML = `
        <button class="team-scroll-btn team-scroll-left" aria-label="Scroll left">
            <i class="fas fa-chevron-left"></i>
        </button>
        <button class="team-scroll-btn team-scroll-right" aria-label="Scroll right">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    teamGrid.parentElement.style.position = 'relative';
    teamGrid.parentElement.appendChild(indicatorsContainer);
    
    // Scroll button functionality
    const leftBtn = indicatorsContainer.querySelector('.team-scroll-left');
    const rightBtn = indicatorsContainer.querySelector('.team-scroll-right');
    
    leftBtn.addEventListener('click', () => {
        teamGrid.scrollBy({ left: -300, behavior: 'smooth' });
    });
    
    rightBtn.addEventListener('click', () => {
        teamGrid.scrollBy({ left: 300, behavior: 'smooth' });
    });
    
    // Update button visibility based on scroll position
    function updateScrollButtons() {
        const maxScroll = teamGrid.scrollWidth - teamGrid.clientWidth;
        leftBtn.style.display = teamGrid.scrollLeft <= 10 ? 'none' : 'flex';
        rightBtn.style.display = teamGrid.scrollLeft >= maxScroll - 10 ? 'none' : 'flex';
    }
    
    teamGrid.addEventListener('scroll', updateScrollButtons);
    updateScrollButtons(); // Initial state
}

/**
 * Adds touch/swipe support for mobile devices
 * @param {HTMLElement} teamGrid - The team grid element
 */
function addTouchSupport(teamGrid) {
    let startX = 0;
    let scrollLeft = 0;
    let isDown = false;
    
    teamGrid.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - teamGrid.offsetLeft;
        scrollLeft = teamGrid.scrollLeft;
        teamGrid.style.cursor = 'grabbing';
    });
    
    teamGrid.addEventListener('mouseleave', () => {
        isDown = false;
        teamGrid.style.cursor = 'grab';
    });
    
    teamGrid.addEventListener('mouseup', () => {
        isDown = false;
        teamGrid.style.cursor = 'grab';
    });
    
    teamGrid.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - teamGrid.offsetLeft;
        const walk = (x - startX) * 2;
        teamGrid.scrollLeft = scrollLeft - walk;
    });
    
    // Touch events for mobile
    teamGrid.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - teamGrid.offsetLeft;
        scrollLeft = teamGrid.scrollLeft;
    });
    
    teamGrid.addEventListener('touchmove', (e) => {
        const x = e.touches[0].pageX - teamGrid.offsetLeft;
        const walk = (x - startX) * 2;
        teamGrid.scrollLeft = scrollLeft - walk;
    });
}

/**
 * Adds keyboard navigation support
 * @param {HTMLElement} teamGrid - The team grid element
 */
function addKeyboardNavigation(teamGrid) {
    teamGrid.setAttribute('tabindex', '0');
    teamGrid.setAttribute('role', 'region');
    teamGrid.setAttribute('aria-label', 'Team members carousel');
    
    teamGrid.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                teamGrid.scrollBy({ left: -300, behavior: 'smooth' });
                break;
            case 'ArrowRight':
                e.preventDefault();
                teamGrid.scrollBy({ left: 300, behavior: 'smooth' });
                break;
            case 'Home':
                e.preventDefault();
                teamGrid.scrollTo({ left: 0, behavior: 'smooth' });
                break;
            case 'End':
                e.preventDefault();
                teamGrid.scrollTo({ left: teamGrid.scrollWidth, behavior: 'smooth' });
                break;
        }
    });
}

/**
 * Initializes the team section by fetching and displaying team members
 */
async function initializeTeamSection() {
    console.log('Initializing team section...');
    
    try {
        const teamMembers = await fetchTeamMembers();
        renderTeamMembers(teamMembers);
        console.log('Team section initialized successfully');
    } catch (error) {
        console.error('Error initializing team section:', error);
        
        // Show error state
        const teamGrid = document.getElementById('teamGrid');
        if (teamGrid) {
            teamGrid.innerHTML = `
                <div class="team-error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Unable to load team information. Please try again later.</p>
                </div>
            `;
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initTeamSection()
    });
} else {
    initTeamSection();
}

function initTeamSection() {
    const root = document.getElementById('teamGrid')
    if (!root) return
    if (root.dataset.teamInit === '1') return
    root.dataset.teamInit = '1'
    initializeTeamSection()
}

document.addEventListener('includes:loaded', () => {
    initTeamSection()
})

document.addEventListener('spa:navigated', () => {
    initTeamSection()
})

// Export functions for potential use in other scripts
window.teamUtils = {
    fetchTeamMembers,
    renderTeamMembers,
    initializeTeamSection
};
