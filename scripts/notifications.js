/**
 * Global Notification System
 * Replaces generic alert() and confirm() with custom branded notifications and modals
 */

class NotificationSystem {
    constructor() {
        this.container = null;
        this.modalContainer = null;
        this.init();
    }

    init() {
        // Create toast container
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);

        // Create modal container
        this.modalContainer = document.createElement('div');
        this.modalContainer.id = 'modal-container';
        this.modalContainer.className = 'modal-container';
        document.body.appendChild(this.modalContainer);

        // Add styles
        this.injectStyles();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }

            .notification {
                pointer-events: auto;
                min-width: 300px;
                max-width: 450px;
                padding: 1rem 1.25rem;
                background: rgba(26, 26, 46, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                animation: slideIn 0.3s ease-out;
                color: #fff;
                font-family: 'Inter', sans-serif;
                font-size: 0.95rem;
                line-height: 1.5;
            }

            .notification.success {
                border-color: rgba(76, 175, 80, 0.4);
                background: rgba(26, 26, 46, 0.95);
            }

            .notification.success .notification-icon {
                color: #4caf50;
            }

            .notification.error {
                border-color: rgba(244, 67, 54, 0.4);
                background: rgba(26, 26, 46, 0.95);
            }

            .notification.error .notification-icon {
                color: #f44336;
            }

            .notification.warning {
                border-color: rgba(255, 152, 0, 0.4);
                background: rgba(26, 26, 46, 0.95);
            }

            .notification.warning .notification-icon {
                color: #ff9800;
            }

            .notification.info {
                border-color: rgba(33, 150, 243, 0.4);
                background: rgba(26, 26, 46, 0.95);
            }

            .notification.info .notification-icon {
                color: #2196f3;
            }

            .notification-icon {
                font-size: 1.25rem;
                flex-shrink: 0;
                margin-top: 2px;
            }

            .notification-content {
                flex: 1;
            }

            .notification-title {
                font-weight: 600;
                margin-bottom: 4px;
                color: #fff;
            }

            .notification-message {
                color: rgba(255, 255, 255, 0.8);
                font-size: 0.9rem;
            }

            .notification-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                padding: 4px;
                font-size: 1rem;
                transition: color 0.2s ease;
                flex-shrink: 0;
            }

            .notification-close:hover {
                color: #fff;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }

            .notification.removing {
                animation: slideOut 0.3s ease-out forwards;
            }

            .modal-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10001;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 1rem;
            }

            .modal-container.active {
                display: flex;
            }

            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                animation: fadeIn 0.2s ease-out;
            }

            .modal {
                position: relative;
                background: rgba(26, 26, 46, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
                max-width: 500px;
                width: 100%;
                animation: modalSlideIn 0.3s ease-out;
                color: #fff;
                font-family: 'Inter', sans-serif;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes modalSlideIn {
                from {
                    transform: scale(0.9) translateY(-20px);
                    opacity: 0;
                }
                to {
                    transform: scale(1) translateY(0);
                    opacity: 1;
                }
            }

            .modal-header {
                padding: 1.5rem 1.5rem 1rem;
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .modal-icon {
                font-size: 1.5rem;
            }

            .modal-icon.warning { color: #ff9800; }
            .modal-icon.danger { color: #f44336; }
            .modal-icon.success { color: #4caf50; }
            .modal-icon.info { color: #2196f3; }

            .modal-title {
                font-family: 'Poppins', sans-serif;
                font-size: 1.25rem;
                font-weight: 700;
                color: #fff;
                margin: 0;
                flex: 1;
            }

            .modal-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                padding: 4px;
                font-size: 1.25rem;
                transition: color 0.2s ease;
            }

            .modal-close:hover {
                color: #fff;
            }

            .modal-body {
                padding: 1.5rem;
                color: rgba(255, 255, 255, 0.8);
                font-size: 1rem;
                line-height: 1.6;
            }

            .modal-footer {
                padding: 1rem 1.5rem 1.5rem;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .modal-btn {
                padding: 0.75rem 1.5rem;
                font-size: 0.95rem;
                font-weight: 600;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: 'Inter', sans-serif;
                border: none;
            }

            .modal-btn-primary {
                background: #e94560;
                color: #fff;
            }

            .modal-btn-primary:hover {
                background: #ff6b8a;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
            }

            .modal-btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .modal-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.3);
            }

            .modal-btn-danger {
                background: #f44336;
                color: #fff;
            }

            .modal-btn-danger:hover {
                background: #ff5252;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
            }

            @media (max-width: 768px) {
                .notification-container {
                    left: 10px;
                    right: 10px;
                    top: 10px;
                }

                .notification {
                    min-width: auto;
                    max-width: none;
                }

                .modal {
                    margin: 1rem;
                }

                .modal-footer {
                    flex-direction: column;
                }

                .modal-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {string} title - Optional title
     * @param {number} duration - Duration in ms (0 for no auto-dismiss)
     */
    show(message, type = 'info', title = null, duration = 4000) {
        // Validate message - don't show empty notifications
        if (!message || (typeof message === 'string' && message.trim() === '')) {
            console.warn('Notification not shown: empty message');
            return null;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const titles = {
            success: title || 'Success',
            error: title || 'Error',
            warning: title || 'Warning',
            info: title || 'Information'
        };

        notification.innerHTML = `
            <i class="fas ${icons[type]} notification-icon"></i>
            <div class="notification-content">
                ${title ? `<div class="notification-title">${titles[type]}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.remove(notification));

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.remove(notification), duration);
        }

        this.container.appendChild(notification);
        return notification;
    }

    remove(notification) {
        notification.classList.add('removing');
        notification.addEventListener('animationend', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    /**
     * Show a confirmation modal
     * @param {string} message - The message to display
     * @param {string} title - Modal title
     * @param {string} type - 'warning', 'danger', 'info'
     * @returns {Promise<boolean>} - True if confirmed, false if cancelled
     */
    async confirm(message, title = 'Confirm Action', type = 'warning') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-container active';

            const icons = {
                warning: 'fa-exclamation-triangle',
                danger: 'fa-exclamation-circle',
                info: 'fa-info-circle'
            };

            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal">
                    <div class="modal-header">
                        <i class="fas ${icons[type]} modal-icon ${type}"></i>
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${message}
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-secondary cancel-btn">Cancel</button>
                        <button class="modal-btn modal-btn-${type === 'danger' ? 'danger' : 'primary'} confirm-btn">Confirm</button>
                    </div>
                </div>
            `;

            const overlay = modal.querySelector('.modal-overlay');
            const closeBtn = modal.querySelector('.modal-close');
            const cancelBtn = modal.querySelector('.cancel-btn');
            const confirmBtn = modal.querySelector('.confirm-btn');

            const cleanup = (result) => {
                modal.remove();
                resolve(result);
            };

            overlay.addEventListener('click', () => cleanup(false));
            closeBtn.addEventListener('click', () => cleanup(false));
            cancelBtn.addEventListener('click', () => cleanup(false));
            confirmBtn.addEventListener('click', () => cleanup(true));

            this.modalContainer.appendChild(modal);
        });
    }

    /**
     * Show an alert modal
     * @param {string} message - The message to display
     * @param {string} title - Modal title
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    async alert(message, title = 'Notice', type = 'info') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-container active';

            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };

            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal">
                    <div class="modal-header">
                        <i class="fas ${icons[type]} modal-icon ${type}"></i>
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${message}
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-primary ok-btn">OK</button>
                    </div>
                </div>
            `;

            const overlay = modal.querySelector('.modal-overlay');
            const closeBtn = modal.querySelector('.modal-close');
            const okBtn = modal.querySelector('.ok-btn');

            const cleanup = () => {
                modal.remove();
                resolve();
            };

            overlay.addEventListener('click', cleanup);
            closeBtn.addEventListener('click', cleanup);
            okBtn.addEventListener('click', cleanup);

            this.modalContainer.appendChild(modal);
        });
    }

    /**
     * Show a prompt modal
     * @param {string} message - The message to display
     * @param {string} defaultValue - Default value for the input
     * @param {string} title - Modal title
     * @returns {Promise<string|null>} - The input value or null if cancelled
     */
    async prompt(message, defaultValue = '', title = 'Input Required') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-container active';

            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal">
                    <div class="modal-header">
                        <i class="fas fa-keyboard modal-icon info"></i>
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem;">${message}</p>
                        <input type="text" class="modal-input" value="${defaultValue}" 
                               style="width: 100%; padding: 0.75rem; background: rgba(255,255,255,0.1); 
                                      border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; 
                                      color: #fff; font-size: 1rem; font-family: 'Inter', sans-serif;
                                      outline: none; transition: border-color 0.2s;">
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-secondary cancel-btn">Cancel</button>
                        <button class="modal-btn modal-btn-primary submit-btn">Submit</button>
                    </div>
                </div>
            `;

            const input = modal.querySelector('.modal-input');
            const overlay = modal.querySelector('.modal-overlay');
            const closeBtn = modal.querySelector('.modal-close');
            const cancelBtn = modal.querySelector('.cancel-btn');
            const submitBtn = modal.querySelector('.submit-btn');

            // Focus input and select text
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);

            // Handle Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    cleanup(input.value);
                }
            });

            const cleanup = (result) => {
                modal.remove();
                resolve(result || null);
            };

            overlay.addEventListener('click', () => cleanup(null));
            closeBtn.addEventListener('click', () => cleanup(null));
            cancelBtn.addEventListener('click', () => cleanup(null));
            submitBtn.addEventListener('click', () => cleanup(input.value));

            this.modalContainer.appendChild(modal);
        });
    }
}

// Initialize and make available globally
const notifications = new NotificationSystem();
window.notifications = notifications;

// Export for module usage
export { notifications };
