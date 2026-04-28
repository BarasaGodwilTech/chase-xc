// Team functionality for fetching and displaying team members from Firebase
import { db } from './firebase-init.js';
import { collection, getDocs, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

/**
 * Fetches team members from Firebase Firestore
 * @returns {Promise<Array>} Array of team member objects
 */
async function fetchTeamMembers() {
    try {
        console.log('Fetching team members from Firebase...');
        
        const teamQuery = query(
            collection(db, 'team'),
            where('status', '==', 'active'),
            orderBy('createdAt', 'asc')
        );
        
        const querySnapshot = await getDocs(teamQuery);
        const teamMembers = [];
        
        querySnapshot.forEach((doc) => {
            teamMembers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
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
    document.addEventListener('DOMContentLoaded', initializeTeamSection);
} else {
    initializeTeamSection();
}

// Export functions for potential use in other scripts
window.teamUtils = {
    fetchTeamMembers,
    renderTeamMembers,
    initializeTeamSection
};
