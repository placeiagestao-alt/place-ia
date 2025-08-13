
e// Elementos DOM para as páginas de login
document.addEventListener('DOMContentLoaded', function() {
    // Botões para alternar visibilidade da senha
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    if (togglePasswordButtons) {
        togglePasswordButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                const passwordInput = document.getElementById(targetId);
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    this.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    passwordInput.type = 'password';
                    this.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        });
    }
    
    // Formulário de login do cliente
    const clientLoginForm = document.getElementById('client-login-form');
    if (clientLoginForm) {
        clientLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('client-email').value;
            const password = document.getElementById('client-password').value;
            const rememberMe = document.getElementById('remember-client').checked;
            
            try {
                const response = await window.PlaceIA.auth.login(email, password, 'client');
                
                if (response.success) {
                    showLoginMessage('cliente', true);
                    
                    setTimeout(() => {
                        window.location.href = 'dashboard-cliente.html';
                    }, 1500);
                } else {
                    showLoginMessage('cliente', false);
                }
            } catch (error) {
                console.error('Erro no login:', error);
                showLoginMessage('cliente', false);
            }
        });
    }
    
    // Formulário de login do administrador
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const token = document.getElementById('admin-token').value;
            const rememberMe = document.getElementById('remember-admin').checked;
            
            try {
                const response = await window.PlaceIA.auth.login(email, password, 'admin', token);
                
                if (response.success) {
                    showLoginMessage('admin', true);
                    
                    setTimeout(() => {
                        window.location.href = 'dashboard-admin.html';
                    }, 1500);
                } else {
                    showLoginMessage('admin', false);
                }
            } catch (error) {
                console.error('Erro no login do administrador:', error);
                showLoginMessage('admin', false);
            }
        });
    }
    
    // Opções de login na página principal
    const clientLoginOption = document.getElementById('client-login-option');
    const adminLoginOption = document.getElementById('admin-login-option');
    
    if (clientLoginOption) {
        clientLoginOption.addEventListener('click', function() {
            window.location.href = 'login-cliente.html';
        });
    }
    
    if (adminLoginOption) {
        adminLoginOption.addEventListener('click', function() {
            window.location.href = 'login-admin.html';
        });
    }
});

// Função para mostrar mensagem de sucesso ou erro no login
function showLoginMessage(type, success) {
    // Remove mensagens anteriores
    const oldMessage = document.querySelector('.login-message');
    if (oldMessage) {
        oldMessage.remove();
    }
    
    // Cria nova mensagem
    const messageDiv = document.createElement('div');
    messageDiv.className = `login-message ${success ? 'success' : 'error'}`;
    
    if (success) {
        messageDiv.innerHTML = `<i class="fas fa-check-circle"></i> Login realizado com sucesso! Redirecionando...`;
    } else {
        messageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Erro no login. Verifique suas credenciais.`;
    }
    
    // Adiciona a mensagem ao formulário
    const form = document.getElementById(`${type}-login-form`);
    form.appendChild(messageDiv);
    
    // Remove a mensagem após alguns segundos se for erro
    if (!success) {
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// Adiciona estilos CSS para as mensagens de login
const loginMessageStyles = document.createElement('style');
loginMessageStyles.textContent = `
    .login-message {
        padding: 15px;
        border-radius: 5px;
        margin-top: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .login-message.success {
        background-color: #00BFFF;
        color: #FFFFFF;
        border: 2px solid #FFFFFF;
    }
    
    .login-message.error {
        background-color: #000000;
        color: #FFFFFF;
        border: 2px solid #00BFFF;
    }
    
    .login-message i {
        font-size: 18px;
    }
`;

document.head.appendChild(loginMessageStyles);