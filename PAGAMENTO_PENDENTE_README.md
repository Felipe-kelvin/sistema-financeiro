# Sistema de Bloqueio por Pagamento Pendente

## 📋 Visão Geral

Este documento explica como o novo sistema de verificação de pagamento funciona. O sistema bloqueia o acesso ao dashboard da aplicação enquanto o usuário tiver mensalidades pendentes.

## 🔐 Como Funciona

### Fluxo de Autenticação e Verificação

```
1. Usuário faz login
   ↓
2. Sistema verifica autenticação Firebase
   ↓
3. Se autenticado, verifica se há mensalidades pendentes no Firestore
   ↓
   ├─ SIM → Redireciona para tela de bloqueio (pagamento-pendente.html)
   │         Mostra informações da mensalidade
   │         Oferece botão para efetuar pagamento
   │
   └─ NÃO → Libera acesso ao dashboard normalmente
```

### Tela de Bloqueio (pagamento-pendente.html)

A tela de bloqueio exibe:
- ❌ Ícone de acesso bloqueado
- 📌 Status "Pagamento Pendente"
- 📝 Detalhes da mensalidade:
  - Descrição
  - Valor devido
  - Data de vencimento
- 🎯 Botões de ação:
  - **Efetuar Pagamento Agora** - Redireciona para página de mensalidades
  - **Sair da Conta** - Faz logout
  - **Atualizar Status** - Verifica se pagamento foi feito

### Atualização em Tempo Real

A tela de bloqueio escuta mudanças no Firestore. Quando o pagamento é efetuado:
1. Status é atualizado para "pago" no Firestore
2. Página detecta a mudança automaticamente
3. Usuário é redirecionado para o dashboard

## 🏗️ Arquitetura

### Arquivos Criados/Modificados

#### Novo: `pagamento-pendente.html`
- Página de bloqueio com design responsivo
- Escuta em tempo real mudanças no Firestore
- Redireciona automaticamente quando pagamento é feito

#### Novo: `js/utils-pagamento.js`
Arquivo de utilidades com funções compartilhadas:

```javascript
// Verifica se há mensalidades pendentes
verificarPagamentoPendente(db, userUID)
// Retorna: Promise<boolean>

// Redireciona se há pagamentos pendentes
redirecionarSePagamentoPendente(db, userUID, relativePath)
// Retorna: Promise<boolean>
```

#### Modificados: Todos os scripts de página
- `js/script.js` (caixa.html)
- `js/script-transacoes.js`
- `js/script-estoque.js`
- `js/script-produtos.js`
- `js/script-graficos.js`

Cada script foi atualizado para:
1. Importar `redirecionarSePagamentoPendente`
2. Verificar pagamentos pendentes após autenticação
3. Bloquear acesso se necessário

## 📊 Estrutura de Dados no Firestore

### Coleção: `mensalidades`

```
mensalidades/
├── {userUID}/
│   └── lista/
│       └── {docId}/
│           ├── descricao: "Mensalidade Janeiro 2026"
│           ├── valor: 150.00
│           ├── status: "pendente" ou "pago"
│           ├── vencimento: Timestamp
│           ├── dataPagamento: Timestamp (opcional)
│           └── metodoPagamento: "dinheiro|cartao|pix|transferencia" (opcional)
```

### Campos Obrigatórios

- `status`: "pendente" ou "pago" - determina se bloqueia acesso
- `descricao`: string - exibida na tela de bloqueio
- `valor`: number - valor em reais

### Campos Opcionais

- `vencimento`: Timestamp - exibida na tela de bloqueio
- `dataPagamento`: Timestamp - quando foi pago
- `metodoPagamento`: string - método de pagamento utilizado

## 🚀 Como Usar

### Para Administrador/Sistema

1. **Criar Mensalidade Pendente**
   ```javascript
   // No Firebase Console ou via script-mensalidade.js
   await addDoc(collection(db, "mensalidades", userUID, "lista"), {
     descricao: "Mensalidade Janeiro 2026",
     valor: 150.00,
     status: "pendente",
     vencimento: Timestamp.now()
   });
   ```

2. **Efetuar Pagamento (Marcar como Pago)**
   ```javascript
   // Ao confirmar pagamento
   await updateDoc(doc(db, "mensalidades", userUID, "lista", docId), {
     status: "pago",
     dataPagamento: Timestamp.now(),
     metodoPagamento: "pix"
   });
   ```

### Para Usuário Final

1. **Se tiver pagamento pendente:**
   - Acessa o sistema
   - Vê tela de bloqueio com informações
   - Clica em "Efetuar Pagamento Agora"
   - Vai para página de mensalidades e efetua o pagamento
   - É redirecionado automaticamente ao dashboard após pagamento

2. **Se não tiver pagamento pendente:**
   - Acessa o sistema normalmente
   - Dashboard carrega sem restrições

## 🔍 Verificação e Testes

### Testar Bloqueio
1. Crie uma mensalidade com `status: "pendente"` para um usuário
2. Faça login com esse usuário
3. Veja a tela de bloqueio aparecer automaticamente

### Testar Desbloqueio
1. Na tela de bloqueio, clique em "Efetuar Pagamento Agora"
2. Efetue o pagamento na página de mensalidades
3. Veja redirecionamento automático para dashboard

### Testar Atualização Manual
1. Na tela de bloqueio, clique em "Atualizar Status"
2. Se o pagamento foi feito, vai redirecionar para dashboard

## ⚠️ Observações Importantes

1. **Usuários sem mensalidades**: Não são bloqueados, acessam normalmente
2. **Múltiplas mensalidades pendentes**: O sistema bloqueia se houver QUALQUER uma pendente
3. **Erro de conexão**: Se o Firestore estiver indisponível, o usuário é deixado passar (melhor experiência)
4. **Logout**: Sair e fazer login novamente refaz a verificação

## 🎨 Customização

Para personalizar a tela de bloqueio, edite `pagamento-pendente.html`:
- Cores: Variáveis CSS (`:root`)
- Mensagens: Textos do HTML
- Layout: Classes CSS Bootstrap-like

## 📞 Suporte

Se encontrar problemas:
1. Verifique se a estrutura de dados no Firestore está correta
2. Abra o Console (F12) para ver erros de JavaScript
3. Verifique as regras de segurança do Firestore
4. Confirme que o usuário tem permissão para ler a coleção "mensalidades"

## 🔐 Segurança

Recomendações de regras do Firestore:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Mensalidades - usuário só pode ler suas próprias
    match /mensalidades/{userId}/lista/{document=**} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId && isAdmin();
    }
  }
}

function isAdmin() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
}
```

---

**Última atualização**: 21 de maio de 2026
