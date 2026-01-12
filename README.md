# Chat Global - Sistema de Chat em Tempo Real

## Como o Site Funciona

### 🚀 Funcionalidades Principais

**Sistema de Autenticação**
- Login e registro de usuários
- Autenticação segura com JWT
- Proteção contra acesso ao console do navegador
- Validação de dados em tempo real

**Chat Global**
- Mensagens em tempo real para todos os usuários
- Lista de usuários online atualizada automaticamente
- Interface moderna e responsiva
- Histórico de mensagens recentes

**Sistema de Perfil**
- Alteração de nome de usuário e email
- Upload de foto de perfil
- Mudança de senha com validação
- Perfil personalizado para cada usuário

**Painel Administrativo**
- Acesso exclusivo para administradores
- Visualização de todos os usuários registrados
- Sistema de banimento com motivo e tempo
- Banimento por IP para violações graves
- Selo de coroa para administradores no chat

### 🔧 Configuração no Render

**Variáveis de Ambiente Necessárias:**
```
MONGODB_URI=sua_url_do_mongodb
JWT_SECRET=sua_chave_secreta_jwt
ADMIN_USERNAME=Emanuel
ADMIN_PASSWORD=sua_senha_admin
PORT=3000
```

### 📋 Como Usar

1. **Primeiro Acesso:**
   - Acesse o site e clique em "Crie uma!" para registrar
   - Ou faça login se já tiver uma conta

2. **Chat:**
   - Digite mensagens no campo inferior
   - Veja usuários online na barra lateral
   - Administradores aparecem com coroa 👑

3. **Perfil:**
   - Clique em "Perfil" para editar suas informações
   - Altere foto, nome, email ou senha

4. **Administração (apenas para Emanuel):**
   - Acesso ao painel administrativo
   - Visualizar todos os usuários
   - Banir usuários com motivo e tempo
   - Banir IPs para violações graves

### 🛡️ Segurança

- **Proteção contra Console:** Impede acesso às ferramentas de desenvolvedor
- **Rate Limiting:** Limita requisições para prevenir spam
- **Validação de Dados:** Todos os dados são validados no servidor
- **Autenticação JWT:** Tokens seguros para autenticação
- **Banimento por IP:** Proteção contra usuários problemáticos
- **Criptografia de Senhas:** Senhas são criptografadas com bcrypt

### 🎯 Sistema de Banimento

**Banimento de Usuário:**
- Administrador pode banir com motivo e duração
- Usuário banido não consegue fazer login
- Banimento temporário com expiração automática

**Banimento de IP:**
- Para violações graves
- Impede criação de novas contas do mesmo IP
- Usuário precisa trocar de dispositivo/rede

### 📱 Interface

- **Design Responsivo:** Funciona em desktop e mobile
- **Tema Moderno:** Gradientes e sombras elegantes
- **Feedback Visual:** Animações e transições suaves
- **Acessibilidade:** Interface intuitiva e clara

### 🔄 Tempo Real

- **Socket.IO:** Comunicação bidirecional instantânea
- **Usuários Online:** Lista atualizada automaticamente
- **Mensagens:** Entrega imediata para todos os usuários
- **Notificações:** Alertas de banimento em tempo real

### 📊 Banco de Dados

**Coleções MongoDB:**
- **Users:** Dados dos usuários, senhas criptografadas
- **Messages:** Histórico de mensagens do chat
- **IpBans:** Lista de IPs banidos com expiração

### 🚀 Deploy

1. Faça upload dos arquivos para o Render
2. Configure as variáveis de ambiente
3. O site estará disponível automaticamente
4. MongoDB será conectado via URI fornecida

### 👑 Conta Administrativa

- **Usuário:** Emanuel (definido via variável de ambiente)
- **Privilégios:** Acesso total ao painel administrativo
- **Identificação:** Coroa dourada no chat e interface especial