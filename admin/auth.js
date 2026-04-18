// Authentication System for Admin Panel
class AdminAuth {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.checkAuthentication();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const passwordToggle = document.getElementById('passwordToggle');
        if (passwordToggle) {
            passwordToggle.addEventListener('click', () => this.togglePasswordVisibility());
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Add input event listeners to ensure inputs are working
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('focus', (e) => {
                e.target.style.borderColor = 'var(--primary)';
            });
            input.addEventListener('blur', (e) => {
                e.target.style.borderColor = 'var(--border)';
            });
        });
    }

    checkAuthentication() {
        const token = localStorage.getItem('adminToken');
        const user = localStorage.getItem('adminUser');
        
        if (token && user) {
            this.isAuthenticated = true;
            this.currentUser = JSON.parse(user);
            
            // If we're on login page, redirect to dashboard
            if (window.location.pathname.includes('index.html') || 
                window.location.pathname.endsWith('admin/')) {
                window.location.href = 'dashboard.html';
            }
        } else {
            this.isAuthenticated = false;
            this.currentUser = null;
            
            // If we're not on login page, redirect to login
            if (window.location.pathname.includes('dashboard.html')) {
                window.location.href = 'index.html';
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        console.log('Login form submitted'); // Debug log
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        console.log('Username:', username); // Debug log
        console.log('Password:', password); // Debug log

        // Show loading state
        this.showLoading();

        try {
            // Simulate API call - in real app, this would be a fetch to your backend
            const user = await this.authenticateUser(username, password);
            
            // Create user session
            this.createSession(user, rememberMe);
            
            // Show success message
            this.showNotification('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error); // Debug log
            this.showNotification(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async authenticateUser(username, password) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Default admin credentials - in production, this would be handled by a backend
        const validCredentials = [
            { username: 'admin', password: 'admin123', role: 'superadmin' },
            { username: 'studio', password: 'studio123', role: 'admin' },
            { username: 'chase', password: 'chase123', role: 'superadmin' }
        ];
        
        const user = validCredentials.find(
            cred => cred.username === username && cred.password === password
        );
        
        if (!user) {
            throw new Error('Invalid username or password');
        }
        
        return user;
    }

    createSession(user, rememberMe) {
        const userData = {
            username: user.username,
            role: user.role,
            loginTime: new Date().toISOString()
        };
        
        const token = this.generateToken();
        
        if (rememberMe) {
            localStorage.setItem('adminToken', token);
            localStorage.setItem('adminUser', JSON.stringify(userData));
        } else {
            sessionStorage.setItem('adminToken', token);
            sessionStorage.setItem('adminUser', JSON.stringify(userData));
        }
        
        this.isAuthenticated = true;
        this.currentUser = userData;
    }

    handleLogout() {
        // Clear all storage
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminUser');
        
        this.isAuthenticated = false;
        this.currentUser = null;
        
        // Redirect to login page
        window.location.href = 'index.html';
    }

    generateToken() {
        // In a real app, this would be a JWT from your backend
        return 'admin_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const toggleIcon = document.getElementById('passwordToggle').querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            toggleIcon.className = 'fas fa-eye';
        }
    }

    showLoading() {
        const submitBtn = document.querySelector('.btn-login');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
            submitBtn.disabled = true;
        }
    }

    hideLoading() {
        const submitBtn = document.querySelector('.btn-login');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            submitBtn.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type} show`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        } else {
            // Use custom notification system as fallback
            if (window.notifications) {
                window.notifications.show(message, type);
            } else {
                console.log(`[${type}] ${message}`);
            }
        }
    }

    // Check if user has specific permission
    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        const permissions = {
            'superadmin': ['*'],
            'admin': ['read', 'write', 'manage_content'],
            'viewer': ['read']
        };
        
        const userPermissions = permissions[this.currentUser.role] || [];
        return userPermissions.includes('*') || userPermissions.includes(permission);
    }

    // Get current user info
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is authenticated
    isLoggedIn() {
        return this.isAuthenticated;
    }
}

// Initialize authentication system
const adminAuth = new AdminAuth();

// Make it available globally for other scripts
window.adminAuth = adminAuth;