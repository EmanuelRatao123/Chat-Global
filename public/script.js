class ChatApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
        this.preventConsoleAccess();
    }

    preventConsoleAccess() {
        // Desabilita F12, Ctrl+Shift+I, Ctrl+U
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
                return false;
            }
        });

        // Desabilita clique direito
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Detecta abertura do console
        let devtools = {open: false, orientation: null};
        const threshold = 160;

        setInterval(() => {
            if (window.outerHeight - window.innerHeight > threshold || 
                window.outerWidth - window.innerWidth > threshold) {
                if (!devtools.open) {
                    devtools.open = true;
                    this.logout();
                    alert('Acesso negado! Console não permitido.');
                }
            } else {
                devtools.open = false;
            }
        }, 500);
    }

    setupEventListeners() {
        // Login/Register
        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('registerFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // Chat
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        // Buttons
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('profileBtn').addEventListener('click', () => {
            this.showProfileModal();
        });

        document.getElementById('adminBtn').addEventListener('click', () => {
            this.showAdminModal();
        });

        // Modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Profile form
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });

        document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });

        document.getElementById('avatarInput').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.uploadAvatar(e.target.files[0]);
            }
        });

        // Admin tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Ban forms
        document.getElementById('banUserForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.banUser();
        });

        document.getElementById('banIpForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.banIp();
        });
    }

    async checkAuth() {
        if (!this.token) {
            this.showLoginScreen();
            return;
        }

        try {
            const response = await fetch('/api/profile', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.currentUser = await response.json();
                this.showChatScreen();
                this.connectSocket();
            } else {
                localStorage.removeItem('token');
                this.showLoginScreen();
            }
        } catch (error) {
            console.error('Erro na autenticação:', error);
            this.showLoginScreen();
        }
    }

    async login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('token', this.token);
                this.showChatScreen();
                this.connectSocket();
            } else {
                if (data.error === 'Conta banida') {
                    this.showBanScreen(data.reason, data.expiresAt);
                } else {
                    alert(data.error);
                }
            }
        } catch (error) {
            alert('Erro de conexão');
        }
    }

    async register() {
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('token', this.token);
                this.showChatScreen();
                this.connectSocket();
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Erro de conexão');
        }
    }

    connectSocket() {
        this.socket = io();
        
        this.socket.emit('join', this.token);

        this.socket.on('userOnline', (users) => {
            this.updateOnlineUsers(users);
        });

        this.socket.on('recentMessages', (messages) => {
            this.displayMessages(messages);
        });

        this.socket.on('newMessage', (message) => {
            this.addMessage(message);
        });

        this.socket.on('userBanned', (data) => {
            if (data.userId === this.currentUser.id) {
                this.logout();
                alert(`Você foi banido: ${data.reason}`);
            }
        });
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (message && this.socket) {
            this.socket.emit('sendMessage', { message });
            messageInput.value = '';
        }
    }

    displayMessages(messages) {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            this.addMessage(message);
        });
    }

    addMessage(message) {
        const messagesContainer = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.isAdmin ? 'admin' : ''}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-username ${message.isAdmin ? 'admin' : ''}">
                    ${message.username}
                    ${message.isAdmin ? '<span class="admin-crown">👑</span>' : ''}
                </span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.message)}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateOnlineUsers(users) {
        const onlineUsersContainer = document.getElementById('onlineUsers');
        const onlineCount = document.getElementById('onlineCount');
        
        onlineCount.textContent = `${users.length} online`;
        
        onlineUsersContainer.innerHTML = '';
        
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = `user-item ${user.isAdmin ? 'admin' : ''}`;
            
            userElement.innerHTML = `
                <div class="user-avatar">${user.username[0].toUpperCase()}</div>
                <span>${user.username}</span>
                ${user.isAdmin ? '<span class="admin-crown">👑</span>' : ''}
            `;
            
            onlineUsersContainer.appendChild(userElement);
        });
    }

    async showProfileModal() {
        document.getElementById('profileModal').style.display = 'block';
        
        // Carregar dados do perfil
        try {
            const response = await fetch('/api/profile', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const profile = await response.json();
                document.getElementById('profileUsername').value = profile.username;
                document.getElementById('profileEmail').value = profile.email;
                
                const avatar = document.getElementById('currentAvatar');
                avatar.src = profile.profilePicture || '/default-avatar.png';
            }
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
        }
    }

    async updateProfile() {
        const username = document.getElementById('profileUsername').value;
        const email = document.getElementById('profileEmail').value;
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    username,
                    email,
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Perfil atualizado com sucesso!');
                document.getElementById('profileModal').style.display = 'none';
                
                // Limpar campos de senha
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Erro de conexão');
        }
    }

    async uploadAvatar(file) {
        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await fetch('/api/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                document.getElementById('currentAvatar').src = data.profilePicture;
                alert('Foto de perfil atualizada!');
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Erro ao fazer upload');
        }
    }

    async showAdminModal() {
        if (!this.currentUser.isAdmin) return;
        
        document.getElementById('adminModal').style.display = 'block';
        this.loadUsers();
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const users = await response.json();
                this.displayUsers(users);
            }
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    }

    displayUsers(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';

        users.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            
            userCard.innerHTML = `
                <div class="user-info">
                    <img src="${user.profilePicture || '/default-avatar.png'}" alt="Avatar">
                    <div>
                        <div>${user.username} ${user.isAdmin ? '👑' : ''}</div>
                        <div style="font-size: 12px; color: #666;">${user.email}</div>
                        ${user.isBanned ? `<div style="color: red;">Banido: ${user.banReason}</div>` : ''}
                    </div>
                </div>
                ${!user.isAdmin ? `<button class="ban-btn" onclick="app.showBanUserModal('${user._id}', '${user.username}')">Banir</button>` : ''}
            `;
            
            usersList.appendChild(userCard);
        });
    }

    showBanUserModal(userId, username) {
        document.getElementById('banUserId').value = userId;
        document.getElementById('banUserName').textContent = username;
        document.getElementById('banUserModal').style.display = 'block';
    }

    async banUser() {
        const userId = document.getElementById('banUserId').value;
        const reason = document.getElementById('banUserReason').value;
        const duration = parseInt(document.getElementById('banUserDuration').value);

        try {
            const response = await fetch('/api/admin/ban-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ userId, reason, duration })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Usuário banido com sucesso!');
                document.getElementById('banUserModal').style.display = 'none';
                this.loadUsers();
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Erro de conexão');
        }
    }

    async banIp() {
        const ip = document.getElementById('banIp').value;
        const reason = document.getElementById('banIpReason').value;
        const duration = parseInt(document.getElementById('banIpDuration').value);

        try {
            const response = await fetch('/api/admin/ban-ip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ ip, reason, duration })
            });

            const data = await response.json();

            if (response.ok) {
                alert('IP banido com sucesso!');
                document.getElementById('banIpForm').reset();
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Erro de conexão');
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    showLoginScreen() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('loginScreen').classList.add('active');
    }

    showChatScreen() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('chatScreen').classList.add('active');
        
        if (this.currentUser.isAdmin) {
            document.getElementById('adminBtn').classList.remove('hidden');
        }
    }

    showBanScreen(reason, expiresAt) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('banScreen').classList.add('active');
        
        document.getElementById('banReason').textContent = `Motivo: ${reason}`;
        
        if (expiresAt) {
            const expireDate = new Date(expiresAt);
            document.getElementById('banExpires').textContent = `Banimento expira em: ${expireDate.toLocaleString()}`;
        }
    }

    showLoginForm() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    }

    showRegisterForm() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    }

    logout() {
        localStorage.removeItem('token');
        if (this.socket) {
            this.socket.disconnect();
        }
        this.showLoginScreen();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar aplicação
const app = new ChatApp();