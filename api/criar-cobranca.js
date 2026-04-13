const axios = require("axios");
require("dotenv").config();
const { verifyToken } = require("./auth");
const validators = require("./validators");

// Rate limiting simples (em memória - usar Redis em produção)
const rateLimitMap = new Map();
const RATE_LIMIT_TIMEOUT = 60000; // 1 minuto
const RATE_LIMIT_MAX = 10; // 10 requisições por minuto

function checkRateLimit(clientId) {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientId) || { count: 0, resetTime: now + RATE_LIMIT_TIMEOUT };

  if (now > clientData.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_TIMEOUT });
    return true;
  }

  if (clientData.count >= RATE_LIMIT_MAX) {
    return false;
  }

  clientData.count++;
  return true;
}

exports.handler = async (event, context) => {
  try {
    // ✅ 1. Validar método HTTP
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    // ✅ 2. Validar Content-Type
    if (event.headers['content-type'] !== 'application/json') {
      return {
        statusCode: 415,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Content-Type must be application/json" })
      };
    }

    // ✅ 3. Verificar autenticação (JWT Firebase)
    const authHeader = event.headers.authorization;
    const authResult = await verifyToken(authHeader);
    
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const userId = authResult.uid;

    // ✅ 4. Rate limiting por usuário
    if (!checkRateLimit(userId)) {
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Too many requests. Please try again later." })
      };
    }

    // ✅ 5. Parse e validação de entrada
    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON" })
      };
    }

    const { nome, email, cpf, valor } = parsedBody;

    // ✅ 6. Validação robusta de campos obrigatórios
    if (!validators.isValidNome(nome)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Name must be between 3 and 100 characters" })
      };
    }

    if (!validators.isValidEmail(email)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid email address" })
      };
    }

    if (!validators.isValidCPF(cpf)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid CPF" })
      };
    }

    if (!validators.isValidValor(valor)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Value must be between 0.01 and 100000" })
      };
    }

    // ✅ 7. Configuração segura da API
    const API_KEY = process.env.ASAAS_API_KEY;
    const API_URL = process.env.ASAAS_URL;

    if (!API_KEY || !API_URL) {
      console.error("Missing ASAAS configuration");
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Server configuration error" })
      };
    }

    const headers = {
      "Content-Type": "application/json",
      "access_token": API_KEY
    };

    // ✅ 8. Requisições com timeout
    const axiosConfig = {
      headers,
      timeout: 5000 // 5 segundos máximo
    };

    // Criar cliente
    const cliente = await axios.post(
      `${API_URL}/customers`,
      {
        name: nome.trim(),
        email: email.trim(),
        cpfCnpj: cpf.replace(/\D/g, '')
      },
      axiosConfig
    );

    const clienteId = cliente.data.id;

    // Criar pagamento
    const pagamento = await axios.post(
      `${API_URL}/payments`,
      {
        customer: clienteId,
        billingType: "PIX",
        value: parseFloat(valor),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias de validade
        description: "Pagamento de Mensalidade"
      },
      axiosConfig
    );

    const paymentId = pagamento.data.id;

    // Gerar QR Code
    const pix = await axios.get(
      `${API_URL}/payments/${paymentId}/pixQrCode`,
      axiosConfig
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        payload: pix.data.payload,
        qrcode: pix.data.encodedImage
      })
    };

  } catch (error) {
    // ✅ 9. Error handling seguro (sem expor detalhes internos)
    const statusCode = error.response?.status || 500;
    
    console.error("[ERRO CRIAR COBRANÇA]", {
      timestamp: new Date().toISOString(),
      status: statusCode,
      message: error.message,
      // Não logar response completo que pode ter dados sensíveis
    });

    // Respostas seguras de erro
    if (error.code === 'ECONNABORTED') {
      return {
        statusCode: 504,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Payment service timeout" })
      };
    }

    if (statusCode === 422) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid payment data" })
      };
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to process payment request" })
    };
  }
};