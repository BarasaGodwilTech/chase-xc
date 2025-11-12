class AdminPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardData();
        this.setupCharts();
        this.loadPayments();
        this.loadSavingsGoals();
        this.loadArtists();
        this.loadProjects();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                this.switchSection(section);
            });
        });

        // Sidebar toggle
        document.querySelector('.sidebar-toggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });

        // Refresh payments
        document.getElementById('refresh-payments').addEventListener('click', () => {
            this.loadPayments();
        });

        // Add artist
        document.getElementById('add-artist').addEventListener('click', () => {
            this.showAddArtistModal();
        });

        // Add project
        document.getElementById('add-project').addEventListener('click', () => {
            this.showAddProjectModal();
        });

        // Settings forms
        document.getElementById('studio-settings').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveStudioSettings();
        });

        document.getElementById('payment-settings').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePaymentSettings();
        });
    }

    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(section).classList.add('active');

        // Update page title
        document.getElementById('page-title').textContent = 
            document.querySelector(`[data-section="${section}"] span`).textContent;

        this.currentSection = section;

        // Load section-specific data
        switch(section) {
            case 'payments':
                this.loadPayments();
                break;
            case 'savings':
                this.loadSavingsGoals();
                break;
            case 'artists':
                this.loadArtists();
                break;
            case 'projects':
                this.loadProjects();
                break;
        }
    }

    setupCharts() {
        // Revenue Chart
        const revenueCtx = document.getElementById('revenueChart').getContext('2d');
        this.revenueChart = new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Revenue (UGX)',
                    data: [2500000, 3200000, 2800000, 4500000, 3800000, 5200000],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return 'UGX ' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });

        // Projects Chart
        const projectsCtx = document.getElementById('projectsChart').getContext('2d');
        this.projectsChart = new Chart(projectsCtx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Pending'],
                datasets: [{
                    data: [12, 8, 4],
                    backgroundColor: [
                        '#10b981',
                        '#00d4ff',
                        '#f59e0b'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    loadDashboardData() {
        // Simulate loading data
        setTimeout(() => {
            document.getElementById('total-revenue').textContent = 'UGX 18,200,000';
            document.getElementById('total-artists').textContent = '24';
            document.getElementById('active-goals').textContent = '15';
            document.getElementById('total-projects').textContent = '24';

            // Load recent activity
            this.loadRecentActivity();
        }, 1000);
    }

    loadRecentActivity() {
        const activities = [
            {
                type: 'payment',
                message: 'New payment received from Alex Nova',
                amount: 'UGX 540,000',
                time: '2 minutes ago'
            },
            {
                type: 'savings',
                message: 'Luna Sky completed savings goal',
                amount: 'UGX 1,800,000',
                time: '1 hour ago'
            },
            {
                type: 'project',
                message: 'New project started: "Electric Dreams"',
                artist: 'Marcus Sound',
                time: '3 hours ago'
            },
            {
                type: 'payment',
                message: 'Payment verified for Sofia Beats',
                amount: 'UGX 900,000',
                time: '5 hours ago'
            }
        ];

        const activityList = document.getElementById('activity-list');
        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas fa-${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-details">
                    <p>${activity.message}</p>
                    <span class="activity-time">${activity.time}</span>
                </div>
                ${activity.amount ? `<div class="activity-amount">${activity.amount}</div>` : ''}
            </div>
        `).join('');
    }

    getActivityIcon(type) {
        const icons = {
            payment: 'money-bill-wave',
            savings: 'piggy-bank',
            project: 'music'
        };
        return icons[type] || 'bell';
    }

    loadPayments() {
        const payments = [
            {
                id: 'PAY001',
                artist: 'Alex Nova',
                amount: '540,000',
                method: 'MTN MoMo',
                status: 'completed',
                date: '2024-01-15'
            },
            {
                id: 'PAY002',
                artist: 'Luna Sky',
                amount: '1,800,000',
                method: 'Bank Transfer',
                status: 'completed',
                date: '2024-01-14'
            },
            {
                id: 'PAY003',
                artist: 'Marcus Sound',
                amount: '900,000',
                method: 'Airtel Money',
                status: 'processing',
                date: '2024-01-14'
            },
            {
                id: 'PAY004',
                artist: 'Sofia Beats',
                amount: '270,000',
                method: 'MTN MoMo',
                status: 'pending',
                date: '2024-01-13'
            }
        ];

        const tableBody = document.getElementById('payments-table-body');
        tableBody.innerHTML = payments.map(payment => `
            <tr>
                <td>${payment.id}</td>
                <td>${payment.artist}</td>
                <td>UGX ${payment.amount}</td>
                <td>${payment.method}</td>
                <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                <td>${payment.date}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="admin.viewPayment('${payment.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="admin.editPayment('${payment.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    loadSavingsGoals() {
        const savingsGoals = JSON.parse(localStorage.getItem('savingsGoals')) || [];
        
        const savingsGrid = document.getElementById('savings-grid');
        
        if (savingsGoals.length === 0) {
            savingsGrid.innerHTML = `
                <div class="savings-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <i class="fas fa-piggy-bank" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>No Savings Goals Yet</h3>
                    <p>Savings goals created by artists will appear here.</p>
                </div>
            `;
            return;
        }

        savingsGrid.innerHTML = savingsGoals.map(goal => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            return `
                <div class="savings-card">
                    <div class="savings-header">
                        <div class="savings-title">${goal.projectName}</div>
                        <div class="savings-amount">UGX ${this.formatNumber(goal.currentAmount)} / ${this.formatNumber(goal.targetAmount)}</div>
                    </div>
                    <div class="savings-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="progress-text">
                            <span>${progress.toFixed(1)}% Complete</span>
                            <span>${this.calculateDaysLeft(goal.targetDate)} days left</span>
                        </div>
                    </div>
                    <div class="savings-details">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>Artist:</span>
                            <span>${goal.artist || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>Service:</span>
                            <span>${this.getServiceName(goal.serviceType)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Target Date:</span>
                            <span>${new Date(goal.targetDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadArtists() {
        const artists = [
            {
                name: 'Alex Nova',
                genre: 'Electronic',
                projects: 12,
                joined: '2020'
            },
            {
                name: 'Luna Sky',
                genre: 'Hip-Hop',
                projects: 8,
                joined: '2021'
            },
            {
                name: 'Marcus Sound',
                genre: 'R&B',
                projects: 6,
                joined: '2022'
            },
            {
                name: 'Sofia Beats',
                genre: 'Pop',
                projects: 15,
                joined: '2019'
            }
        ];

        const artistsGrid = document.getElementById('artists-grid');
        artistsGrid.innerHTML = artists.map(artist => `
            <div class="artist-card">
                <div class="artist-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="artist-name">${artist.name}</div>
                <div class="artist-genre">${artist.genre}</div>
                <div class="artist-stats">
                    <div class="artist-stat">
                        <div class="artist-stat-value">${artist.projects}</div>
                        <div class="artist-stat-label">Projects</div>
                    </div>
                    <div class="artist-stat">
                        <div class="artist-stat-value">${artist.joined}</div>
                        <div class="artist-stat-label">Joined</div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn btn-secondary btn-sm" style="flex: 1;">
                        <i class="fas fa-envelope"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" style="flex: 1;">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    loadProjects() {
        const projects = [
            {
                name: 'Midnight Echo',
                artist: 'Alex Nova',
                service: 'Music Production',
                status: 'completed',
                progress: 100,
                dueDate: '2024-01-10'
            },
            {
                name: 'Electric Dreams',
                artist: 'Luna Project',
                service: 'Mixing & Mastering',
                status: 'in-progress',
                progress: 75,
                dueDate: '2024-01-20'
            },
            {
                name: 'Urban Legends',
                artist: 'Metro Beats',
                service: 'Vocal Production',
                status: 'in-progress',
                progress: 50,
                dueDate: '2024-01-25'
            },
            {
                name: 'Crystal Sound',
                artist: 'Rhythm Kings',
                service: 'Songwriting',
                status: 'pending',
                progress: 0,
                dueDate: '2024-02-01'
            }
        ];

        const tableBody = document.getElementById('projects-table-body');
        tableBody.innerHTML = projects.map(project => `
            <tr>
                <td>${project.name}</td>
                <td>${project.artist}</td>
                <td>${project.service}</td>
                <td><span class="status-badge status-${project.status}">${project.status}</span></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1; height: 6px; background: var(--border); border-radius: 3px;">
                            <div style="height: 100%; width: ${project.progress}%; background: var(--primary); border-radius: 3px;"></div>
                        </div>
                        <span style="font-size: 0.8rem;">${project.progress}%</span>
                    </div>
                </td>
                <td>${project.dueDate}</td>
                <td>
                    <button class="btn btn-secondary btn-sm">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    showAddArtistModal() {
        // Implementation for add artist modal
        alert('Add Artist functionality would open a modal here');
    }

    showAddProjectModal() {
        // Implementation for add project modal
        alert('Add Project functionality would open a modal here');
    }

    saveStudioSettings() {
        // Save studio settings to localStorage or send to server
        const settings = {
            name: document.getElementById('studio-name').value,
            email: document.getElementById('studio-email').value,
            phone: document.getElementById('studio-phone').value
        };
        
        localStorage.setItem('studioSettings', JSON.stringify(settings));
        this.showNotification('Studio settings saved successfully!', 'success');
    }

    savePaymentSettings() {
        // Save payment settings to localStorage or send to server
        const paymentSettings = {
            mtn: document.getElementById('mtn-number').value,
            airtel: document.getElementById('airtel-number').value,
            bank: document.getElementById('bank-details').value
        };
        
        localStorage.setItem('paymentSettings', JSON.stringify(paymentSettings));
        this.showNotification('Payment settings updated successfully!', 'success');
    }

    viewPayment(paymentId) {
        alert(`View payment details for: ${paymentId}`);
    }

    editPayment(paymentId) {
        alert(`Edit payment: ${paymentId}`);
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    calculateDaysLeft(targetDate) {
        const today = new Date();
        const target = new Date(targetDate);
        const diffTime = target - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getServiceName(serviceType) {
        const services = {
            'production': 'Music Production',
            'mixing': 'Mixing & Mastering',
            'vocal': 'Vocal Production',
            'songwriting': 'Songwriting',
            'other': 'Other'
        };
        return services[serviceType] || serviceType;
    }

    showNotification(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#00d4ff'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize admin panel when DOM is loaded
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new AdminPanel();
});