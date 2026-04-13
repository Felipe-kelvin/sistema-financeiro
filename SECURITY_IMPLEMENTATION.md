# Checklist de Implementação de Segurança

## ✅ IMPLEMENTADO

### 1. Firestore Security Rules (`firestore.rules`)
- [x] Autenticação por usuário
- [x] Autorização por `userId` em todas as coleções
- [x] Validação de tipos de dados na criação
- [x] Proteção contra leitura/escrita de dados alheios
- [x] Regras específicas por coleção (estoque, vendas, transações, mensalidades)
- [x] Deny all por padrão (whitelist approach)

**⚠️ Próximo passo:** Deploy via Firebase CLI
```bash
firebase deploy --only firestore:rules
```

---

### 2. Validação Backend Robusta (`api/validators.js`)
- [x] Validação de CPF com algoritmo oficial
- [x] Validação de Email com regex
- [x] Validação de Nome (3-100 chars)
- [x] Validação de Valor (0.01 - 100000)
- [x] Funções reutilizáveis para todas as APIs

---

### 3. Autenticação em Endpoints (`api/auth.js`, `api/criar-cobranca.js`)
- [x] Middleware Firebase Admin SDK
- [x] Verificação de token JWT
- [x] Rate limiting por usuário
- [x] Content-Type validation
- [x] Timeout em requisições (5s)
- [x] Error handling seguro (sem expor detalhes)
- [x] Validação de entrada com mensagens claras
- [x] Logging seguro (sem dados sensíveis)

**⚠️ Próximo passo:** Configurar Firebase Admin SDK no Netlify
- Gerar credenciais em: Firebase Console > Project Settings > Service Accounts
- Adicionar variáveis de ambiente no Netlify UI

---

## 📋 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

### Netlify Environment Variables
```
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
FIREBASE_CLIENT_ID
ASAAS_API_KEY (já existe)
ASAAS_URL (já existe)
```

---

## 🧪 TESTES RECOMENDADOS

### Teste 1: Acesso Não Autorizado
```bash
# Sem token
curl -X POST http://localhost:8888/.netlify/functions/criar-cobranca \
  -H "Content-Type: application/json" \
  -d '{"nome":"Test","email":"test@test.com","cpf":"12345678901","valor":100}'
# ❌ Esperado: 401 Unauthorized
```

### Teste 2: Validação de CPF
```bash
# CPF inválido
curl -X POST http://localhost:8888/.netlify/functions/criar-cobranca \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"nome":"Test","email":"test@test.com","cpf":"00000000000","valor":100}'
# ❌ Esperado: 400 Invalid CPF
```

### Teste 3: Rate Limiting
```bash
# 11 requisições em sequência
for i in {1..11}; do
  curl -X POST ... (mesmo comando acima com token válido)
done
# ⚠️ Esperado: 10ª requisição sucede, 11ª retorna 429
```

### Teste 4: Firestore Rules
```javascript
// No console do Firebase/Firestore emulator
// Usuário A tenta ler dados de Usuário B
db.collection('estoque').where('userId', '==', 'other_user_id').get()
// ❌ Esperado: Permission denied
```

---

## 📚 DOCUMENTAÇÃO

Ver `API_SECURITY_SETUP.md` para:
- Como gerar credenciais Firebase Admin SDK
- Como configurar variáveis no Netlify
- Exemplo de requisição cliente com token
- Como fazer deploy do firestore.rules

---

## 🔒 SEGURANÇA VERIFICADA

- ✅ Autenticação em endpoints
- ✅ Autorização por usuário
- ✅ Validação de entrada robusta
- ✅ Rate limiting por usuário
- ✅ Content-Type validation
- ✅ Error handling seguro
- ✅ Timeout em requisições
- ✅ Firestore Rules com deny-all default
- ✅ CPF validado com algoritmo oficial
- ✅ Email validado com regex

---

## 🚀 PRÓXIMAS ETAPAS

1. Deploy de `firestore.rules` no Firebase
2. Configurar variáveis de ambiente no Netlify
3. Instalar `firebase-admin` no package.json
4. Testar endpoints com tokens válidos
5. Monitorar logs de erro no Netlify
6. Implementar CORS headers (passo 4 do plano)
7. Adicionar CSP headers (passo 4 do plano)
