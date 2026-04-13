# Configuração de Segurança da API

## Autenticação Firebase Admin SDK

Para usar o endpoint `/api/criar-cobranca`, você precisa configurar as variáveis de ambiente do Firebase Admin SDK no Netlify.

### Passos para gerar credenciais:

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Project Settings** (ícone de engrenagem)
4. Aba **Service Accounts**
5. Clique em **Generate New Private Key**
6. Um JSON será baixado com as credenciais

### Variáveis de Ambiente (adicionar no Netlify):

```
FIREBASE_PROJECT_ID=seu_project_id
FIREBASE_PRIVATE_KEY_ID=seu_private_key_id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIB...etc...\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@seu_project_id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=seu_client_id
```

**⚠️ Importante:** 
- Nunca commite o arquivo `.json` de credenciais no git
- Copie os valores direto das variáveis de ambiente do Netlify
- Para `FIREBASE_PRIVATE_KEY`, substitua quebras de linha por `\n`

## Exemplo de Requisição (Cliente)

```javascript
// Cliente precisa ter um token Firebase válido
const token = await user.getIdToken();

const response = await fetch('/.netlify/functions/criar-cobranca', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    nome: 'João Silva',
    email: 'joao@email.com',
    cpf: '12345678901',
    valor: 150.00
  })
});

const data = await response.json();
console.log(data);
```

## Firestore Security Rules

Deploy o arquivo `firestore.rules` no Firebase:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Isso garante que:
- Usuários só acessam seus próprios dados
- Não podem ver dados de outros usuários
- Dados são validados no servidor
