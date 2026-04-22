import { auth } from './firebase-init.js'
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { initSettings, getConfig } from './config-loader.js'

class SettingsManager {
    constructor() {
        this.currentUser = null;
        this.userSettings = null;
        this.init();
    }

    async init() {
        // Initialize settings first to ensure config is loaded
        await initSettings();
        
        // Ensure modal is hidden on page load
        const deleteAccountModal = document.getElementById('deleteAccountModal');
        if (deleteAccountModal) {
            deleteAccountModal.classList.remove('active');
        }

        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserSettings();
                this.setupEventListeners();
                this.loadProfileData();
            } else {
                window.location.href = 'auth.html';
            }
        });
    }

    loadUserSettings() {
        if (!this.currentUser) return;

        const savedSettings = localStorage.getItem(`settings_${this.currentUser.uid}`);
        this.userSettings = savedSettings ? JSON.parse(savedSettings) : {
            notifications: {
                emailNewReleases: true,
                emailMembership: true,
                emailPromotions: false,
                pushNotifications: false
            },
            privacy: {
                publicProfile: false,
                showActivity: true
            },
            appearance: {
                theme: 'dark',
                language: 'en',
                quality: 'auto'
            },
            security: {
                twoFactor: false
            }
        };

        this.applySettings();
    }

    applySettings() {
        if (!this.userSettings) return;

        // Apply notification settings
        const emailNewReleases = document.getElementById('emailNewReleases');
        const emailMembership = document.getElementById('emailMembership');
        const emailPromotions = document.getElementById('emailPromotions');
        const pushNotifications = document.getElementById('pushNotifications');

        if (emailNewReleases) emailNewReleases.checked = this.userSettings.notifications.emailNewReleases;
        if (emailMembership) emailMembership.checked = this.userSettings.notifications.emailMembership;
        if (emailPromotions) emailPromotions.checked = this.userSettings.notifications.emailPromotions;
        if (pushNotifications) pushNotifications.checked = this.userSettings.notifications.pushNotifications;

        // Apply privacy settings
        const publicProfile = document.getElementById('publicProfile');
        const showActivity = document.getElementById('showActivity');

        if (publicProfile) publicProfile.checked = this.userSettings.privacy.publicProfile;
        if (showActivity) showActivity.checked = this.userSettings.privacy.showActivity;

        // Apply appearance settings
        const themeOptions = document.querySelectorAll('.theme-option');
        const languageSelect = document.getElementById('languageSelect');
        const qualitySelect = document.getElementById('qualitySelect');

        themeOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === this.userSettings.appearance.theme) {
                option.classList.add('active');
            }
        });

        if (languageSelect) languageSelect.value = this.userSettings.appearance.language;
        if (qualitySelect) qualitySelect.value = this.userSettings.appearance.quality;

        // Apply security settings
        const twoFactorToggle = document.getElementById('twoFactorToggle');
        if (twoFactorToggle) twoFactorToggle.checked = this.userSettings.security.twoFactor;
    }

    loadProfileData() {
        if (!this.currentUser) return;

        const userProfile = localStorage.getItem(`userProfile_${this.currentUser.uid}`);
        const profile = userProfile ? JSON.parse(userProfile) : {};

        const settingsFullName = document.getElementById('settingsFullName');
        const settingsEmail = document.getElementById('settingsEmail');
        const settingsPhone = document.getElementById('settingsPhone');
        const settingsLocation = document.getElementById('settingsLocation');

        if (settingsFullName) settingsFullName.value = profile.displayName || this.currentUser.displayName || '';
        if (settingsEmail) settingsEmail.value = this.currentUser.email || '';
        if (settingsPhone) settingsPhone.value = profile.phone || '';
        if (settingsLocation) settingsLocation.value = profile.location || '';
    }

    setupEventListeners() {
        // Settings navigation
        const navItems = document.querySelectorAll('.settings-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchSection(e.currentTarget.dataset.section);
            });
        });

        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Password form
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordUpdate(e));
        }

        // Notification toggles
        const notificationToggles = [
            'emailNewReleases',
            'emailMembership',
            'emailPromotions',
            'pushNotifications'
        ];
        notificationToggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                toggle.addEventListener('change', () => this.saveNotificationSettings());
            }
        });

        // Privacy toggles
        const privacyToggles = ['publicProfile', 'showActivity'];
        privacyToggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                toggle.addEventListener('change', () => this.savePrivacySettings());
            }
        });

        // Theme options
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.setTheme(option.dataset.theme);
            });
        });

        // Language and quality selects
        const languageSelect = document.getElementById('languageSelect');
        const qualitySelect = document.getElementById('qualitySelect');

        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                this.userSettings.appearance.language = e.target.value;
                this.saveSettings();
            });
        }

        if (qualitySelect) {
            qualitySelect.addEventListener('change', (e) => {
                this.userSettings.appearance.quality = e.target.value;
                this.saveSettings();
            });
        }

        // Two-factor toggle
        const twoFactorToggle = document.getElementById('twoFactorToggle');
        if (twoFactorToggle) {
            twoFactorToggle.addEventListener('change', () => {
                this.showNotification('Two-factor authentication coming soon', 'info');
                twoFactorToggle.checked = false;
            });
        }

        // Delete account
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        const deleteAccountModal = document.getElementById('deleteAccountModal');
        const closeDeleteModal = document.getElementById('closeDeleteModal');
        const deleteAccountForm = document.getElementById('deleteAccountForm');

        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                deleteAccountModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        }

        if (closeDeleteModal) {
            closeDeleteModal.addEventListener('click', () => {
                deleteAccountModal.classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        if (deleteAccountModal) {
            deleteAccountModal.addEventListener('click', (e) => {
                if (e.target === deleteAccountModal) {
                    deleteAccountModal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }

        if (deleteAccountForm) {
            deleteAccountForm.addEventListener('submit', (e) => this.handleDeleteAccount(e));
        }

        // Download data
        const downloadDataBtn = document.getElementById('downloadDataBtn');
        if (downloadDataBtn) {
            downloadDataBtn.addEventListener('click', () => this.downloadUserData());
        }

        // Clear history
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearListeningHistory());
        }

        // Sign out all devices
        const signOutAllBtn = document.getElementById('signOutAllBtn');
        if (signOutAllBtn) {
            signOutAllBtn.addEventListener('click', () => this.showNotification('Sign out all devices coming soon', 'info'));
        }

        // Close modals on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                deleteAccountModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    switchSection(sectionId) {
        // Update nav items
        const navItems = document.querySelectorAll('.settings-nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === sectionId) {
                item.classList.add('active');
            }
        });

        // Update panels
        const panels = document.querySelectorAll('.settings-panel');
        panels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === sectionId) {
                panel.classList.add('active');
            }
        });
    }

    async handleProfileUpdate(e) {
        e.preventDefault();

        const fullName = document.getElementById('settingsFullName').value.trim();
        const phone = document.getElementById('settingsPhone').value.trim();
        const location = document.getElementById('settingsLocation').value.trim();

        if (!fullName) {
            this.showNotification('Full name is required', 'error');
            return;
        }

        try {
            // Update Firebase profile
            await updateProfile(auth.currentUser, {
                displayName: fullName
            });

            // Update local profile
            const userProfile = JSON.parse(localStorage.getItem(`userProfile_${this.currentUser.uid}`) || '{}');
            userProfile.displayName = fullName;
            userProfile.phone = phone;
            userProfile.location = location;
            localStorage.setItem(`userProfile_${this.currentUser.uid}`, JSON.stringify(userProfile));

            this.showNotification('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification('Error updating profile', 'error');
        }
    }

    async handlePasswordUpdate(e) {
        e.preventDefault();

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Please fill in all password fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            // Reauthenticate user
            const credential = EmailAuthProvider.credential(
                this.currentUser.email,
                currentPassword
            );
            await reauthenticateWithCredential(this.currentUser, credential);

            // Update password
            await updatePassword(this.currentUser, newPassword);

            // Clear form
            document.getElementById('passwordForm').reset();

            this.showNotification('Password updated successfully', 'success');
        } catch (error) {
            console.error('Error updating password:', error);
            if (error.code === 'auth/wrong-password') {
                this.showNotification('Current password is incorrect', 'error');
            } else {
                this.showNotification('Error updating password', 'error');
            }
        }
    }

    saveNotificationSettings() {
        this.userSettings.notifications.emailNewReleases = document.getElementById('emailNewReleases').checked;
        this.userSettings.notifications.emailMembership = document.getElementById('emailMembership').checked;
        this.userSettings.notifications.emailPromotions = document.getElementById('emailPromotions').checked;
        this.userSettings.notifications.pushNotifications = document.getElementById('pushNotifications').checked;
        this.saveSettings();
    }

    savePrivacySettings() {
        this.userSettings.privacy.publicProfile = document.getElementById('publicProfile').checked;
        this.userSettings.privacy.showActivity = document.getElementById('showActivity').checked;
        this.saveSettings();
    }

    setTheme(theme) {
        this.userSettings.appearance.theme = theme;
        
        // Update UI
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === theme) {
                option.classList.add('active');
            }
        });

        this.saveSettings();
        this.showNotification(`Theme changed to ${theme}`, 'success');
    }

    saveSettings() {
        localStorage.setItem(`settings_${this.currentUser.uid}`, JSON.stringify(this.userSettings));
    }

    handleDeleteAccount(e) {
        e.preventDefault();

        const confirmation = document.getElementById('deleteConfirmation').value.trim();

        if (confirmation !== 'DELETE') {
            this.showNotification('Please type DELETE to confirm', 'error');
            return;
        }

        // In production, this would call Firebase's deleteUser() function
        // For now, we'll simulate it
        this.showNotification('Account deletion requires additional verification. Contact support.', 'info');
        
        // Close modal
        const modal = document.getElementById('deleteAccountModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    downloadUserData() {
        const userData = {
            profile: JSON.parse(localStorage.getItem(`userProfile_${this.currentUser.uid}`) || '{}'),
            settings: this.userSettings,
            membership: JSON.parse(localStorage.getItem(`membership_${this.currentUser.uid}`) || '{}'),
            favorites: JSON.parse(localStorage.getItem(`favorites_${this.currentUser.uid}`) || '[]'),
            history: JSON.parse(localStorage.getItem(`history_${this.currentUser.uid}`) || '[]'),
            playlists: JSON.parse(localStorage.getItem(`playlists_${this.currentUser.uid}`) || '[]')
        };

        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `chase-xc-user-data-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);

        this.showNotification('Your data has been downloaded', 'success');
    }

    clearListeningHistory() {
        if (confirm('Are you sure you want to clear your listening history? This cannot be undone.')) {
            localStorage.setItem(`history_${this.currentUser.uid}`, JSON.stringify([]));
            this.showNotification('Listening history cleared', 'success');
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

// Initialize settings page
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
