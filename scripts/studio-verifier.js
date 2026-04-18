// Studio Payment Verifier PWA
class StudioVerifier {
    constructor() {
        this.pendingPayments = new Map();
        this.verifiedPayments = new Map();
        this.isInstalled = false;
        this.hasSmsPermission = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.checkInstallation();
        await this.loadExistingPayments();
        this.updateUI();
        
        // Start checking for payment matches
        this.startMatchingProcess();
    }

    setupEventListeners() {
        // Install button
        document.getElementById('installBtn').addEventListener('click', () => {
            this.installPWA();
        });

        // SMS Permission button
        document.getElementById('smsPermissionBtn').addEventListener('click', () => {
            this.requestSmsPermission();
        });

        // Notification Permission button
        document.getElementById('notificationPermissionBtn').addEventListener('click', () => {
            this.requestNotificationPermission();
        });

        // Simulation button
        document.getElementById('simulatePaymentBtn').addEventListener('click', () => {
            this.simulateIncomingPayment();
        });

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            document.getElementById('installBtn').disabled = false;
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.updateUI();
            this.showMessage('App installed successfully!', 'success');
        });
    }

    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                this.isInstalled = true;
                document.getElementById('smsPermissionBtn').disabled = false;
            }
            
            this.deferredPrompt = null;
        }
    }

    async requestSmsPermission() {
        try {
            // Note: SMS permission API is limited in browsers
            // In a real Cordova/React Native app, you'd use native plugins
            if ('permissions' in navigator) {
                const permission = await navigator.permissions.query({ name: 'notifications' });
                this.hasSmsPermission = permission.state === 'granted';
            }
            
            // For demo purposes, we'll simulate granted permission
            this.hasSmsPermission = true;
            this.updateUI();
            this.showMessage('SMS monitoring enabled!', 'success');
            
            // Show monitoring section
            document.getElementById('monitoringSection').style.display = 'block';
            
        } catch (error) {
            console.error('Error requesting SMS permission:', error);
            this.showMessage('Error enabling SMS monitoring', 'error');
        }
    }

    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.showMessage('Notifications enabled!', 'success');
                this.showNotification('Payment Verifier', 'App is ready to monitor payments');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }

    checkInstallation() {
        // Check if app is installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            document.getElementById('smsPermissionBtn').disabled = false;
        }
    }

    simulateIncomingPayment() {
        const amount = document.getElementById('simAmount').value || '';
        const sender = document.getElementById('simSender').value || '';
        const provider = document.getElementById('simProvider').value;
        
        // SMS templates will use real data from configuration
        const smsTemplates = {
            mtn: `You have received UGX ${this.formatNumber(amount)} from ${sender}. Transaction ID: MTN${Date.now()}.`,
            airtel: `You have received ${amount} UGX from ${sender}. Ref: AIR${Date.now()}.`
        };

        const sms = smsTemplates[provider];
        this.processIncomingSMS(sms, provider);
        
        // Show SMS preview
        this.showSmsPreview(sms, provider);
    }

    showSmsPreview(sms, provider) {
        const preview = document.createElement('div');
        preview.className = 'sms-preview';
        preview.innerHTML = `
            <strong>${provider.toUpperCase()} SMS Preview:</strong>
            <div style="margin-top: 0.5rem;">${sms}</div>
        `;
        
        const simulationPanel = document.querySelector('.simulation-panel');
        simulationPanel.appendChild(preview);
        
        setTimeout(() => preview.remove(), 5000);
    }

    processIncomingSMS(sms, provider) {
        console.log(`📱 Received ${provider.toUpperCase()} SMS:`, sms);
        
        const paymentData = this.parsePaymentSMS(sms, provider);
        if (paymentData) {
            this.handleNewPayment(paymentData);
            this.showNotification('Payment Received', `UGX ${this.formatNumber(paymentData.amount)} from ${paymentData.sender}`);
        }
    }

    parsePaymentSMS(sms, provider) {
        try {
            let amount, sender, transactionId;

            if (provider === 'mtn') {
                const amountMatch = sms.match(/UGX ([0-9,]+) from/);
                const senderMatch = sms.match(/from ([A-Z\s]+)(\d{9,})/);
                const txMatch = sms.match(/Transaction ID: ([A-Z0-9]+)/);
                
                amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : null;
                sender = senderMatch ? senderMatch[1].trim() : 'Unknown';
                transactionId = txMatch ? txMatch[1] : `MTN${Date.now()}`;
            } else if (provider === 'airtel') {
                const amountMatch = sms.match(/received (\d+) UGX/);
                const senderMatch = sms.match(/from ([A-Z\s]+)(\d{9,})/);
                const txMatch = sms.match(/Ref: ([A-Z0-9]+)/);
                
                amount = amountMatch ? parseInt(amountMatch[1]) : null;
                sender = senderMatch ? senderMatch[1].trim() : 'Unknown';
                transactionId = txMatch ? txMatch[1] : `AIR${Date.now()}`;
            }

            if (amount && sender && transactionId) {
                return {
                    id: `studio_${Date.now()}`,
                    amount: amount,
                    sender: sender,
                    transactionId: transactionId,
                    provider: provider,
                    timestamp: new Date().toISOString(),
                    status: 'pending'
                };
            }
        } catch (error) {
            console.error('Error parsing SMS:', error);
        }
        return null;
    }

    handleNewPayment(paymentData) {
        this.pendingPayments.set(paymentData.id, paymentData);
        this.saveToStorage();
        this.updatePaymentList();
        this.checkPaymentMatches();
    }

    async checkPaymentMatches() {
        try {
            // Get waiting payments from "server" (localStorage)
            const waitingPayments = JSON.parse(localStorage.getItem('waitingUserPayments') || '[]');
            
            for (const userPayment of waitingPayments) {
                for (const [studioId, studioPayment] of this.pendingPayments) {
                    if (this.paymentsMatch(userPayment, studioPayment)) {
                        await this.confirmPaymentMatch(userPayment, studioPayment);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking payment matches:', error);
        }
    }

    paymentsMatch(userPayment, studioPayment) {
        const amountMatches = userPayment.amount === studioPayment.amount;
        const timeMatches = new Date(studioPayment.timestamp) > new Date(userPayment.timestamp);
        return amountMatches && timeMatches;
    }

    async confirmPaymentMatch(userPayment, studioPayment) {
        const isExactMatch = studioPayment.transactionId === userPayment.transactionId;
        
        const confirmation = {
            userPaymentId: userPayment.id,
            studioPaymentId: studioPayment.id,
            studioTransactionId: studioPayment.transactionId,
            userTransactionId: userPayment.transactionId,
            amount: studioPayment.amount,
            sender: studioPayment.sender,
            matched: isExactMatch,
            timestamp: new Date().toISOString()
        };

        // Save confirmation to "server"
        this.savePaymentConfirmation(confirmation);

        // Update payment status
        studioPayment.status = isExactMatch ? 'verified' : 'mismatch';
        studioPayment.userPaymentId = userPayment.id;
        
        if (isExactMatch) {
            this.verifiedPayments.set(studioPayment.id, studioPayment);
            this.pendingPayments.delete(studioPayment.id);
            this.showNotification('Payment Verified', `UGX ${this.formatNumber(studioPayment.amount)} - Exact match!`);
        } else {
            this.showNotification('Payment Mismatch', `UGX ${this.formatNumber(studioPayment.amount)} - ID doesn't match`);
        }

        this.saveToStorage();
        this.updatePaymentList();
    }

    savePaymentConfirmation(confirmation) {
        const confirmations = JSON.parse(localStorage.getItem('paymentConfirmations') || '[]');
        confirmations.push(confirmation);
        localStorage.setItem('paymentConfirmations', JSON.stringify(confirmations));
    }

    updatePaymentList() {
        const paymentList = document.getElementById('paymentList');
        const allPayments = [...this.pendingPayments.values(), ...this.verifiedPayments.values()]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (allPayments.length === 0) {
            paymentList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No payments detected yet</p>
                    <p style="font-size: 0.9rem;">Payments will appear here when received</p>
                </div>
            `;
            return;
        }

        paymentList.innerHTML = allPayments.map(payment => `
            <div class="payment-card ${payment.status}">
                <div class="payment-header">
                    <div class="payment-amount">UGX ${this.formatNumber(payment.amount)}</div>
                    <div class="payment-status status-${payment.status}">
                        ${payment.status.toUpperCase()}
                    </div>
                </div>
                <div class="payment-details">
                    <div><strong>From:</strong> ${payment.sender}</div>
                    <div><strong>Provider:</strong> ${payment.provider.toUpperCase()}</div>
                    <div><strong>Transaction ID:</strong> ${payment.transactionId}</div>
                    <div><strong>Time:</strong> ${new Date(payment.timestamp).toLocaleString()}</div>
                    ${payment.userPaymentId ? `<div><strong>User Payment:</strong> ${payment.userPaymentId}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    updateUI() {
        const permissionStatus = document.getElementById('permissionStatus');
        const statusMessages = [];
        
        if (this.isInstalled) {
            statusMessages.push('✅ App Installed');
            document.getElementById('installBtn').disabled = true;
            document.getElementById('installBtn').innerHTML = '<i class="fas fa-check"></i> Installed';
        }
        
        if (this.hasSmsPermission) {
            statusMessages.push('✅ SMS Monitoring Active');
            document.getElementById('smsPermissionBtn').disabled = true;
            document.getElementById('smsPermissionBtn').innerHTML = '<i class="fas fa-check"></i> SMS Enabled';
        }

        permissionStatus.innerHTML = statusMessages.join('<br>');
    }

    async loadExistingPayments() {
        // Load from storage
        const stored = localStorage.getItem('studioPayments');
        if (stored) {
            const payments = JSON.parse(stored);
            payments.forEach(payment => {
                if (payment.status === 'pending') {
                    this.pendingPayments.set(payment.id, payment);
                } else {
                    this.verifiedPayments.set(payment.id, payment);
                }
            });
        }
    }

    saveToStorage() {
        const allPayments = [...this.pendingPayments.values(), ...this.verifiedPayments.values()];
        localStorage.setItem('studioPayments', JSON.stringify(allPayments));
    }

    startMatchingProcess() {
        // Check for matches every 5 seconds
        setInterval(() => {
            this.checkPaymentMatches();
        }, 5000);
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/icons/icon-192.png' });
        }
    }

    showMessage(message, type) {
        // Simple toast message
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--radius);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }

    formatNumber(num) {
        return parseInt(num).toLocaleString();
    }
}

// Initialize the app
let studioVerifier;

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swUrl = new URL('../sw.js', window.location.href)
        navigator.serviceWorker.register(swUrl)
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    studioVerifier = new StudioVerifier();
});