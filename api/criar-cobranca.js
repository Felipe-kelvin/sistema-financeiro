const axios = require("axios");
require("dotenv").config();

// the handler that Vercel will invoke for /api/criar-cobranca
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const API_KEY = process.env.ASAAS_API_KEY;
  const API_URL = process.env.ASAAS_URL;
  const headers = {
    "Content-Type": "application/json",
    access_token: API_KEY,
  };

  try {
    const { nome, email, cpf, valor } = req.body;

    // criar cliente
    const cliente = await axios.post(
      `${API_URL}/customers`,
      {
        name: nome || "Cliente",
        email: email || "cliente@email.com",
        cpfCnpj: cpf || "12345678909",
      },
      { headers }
    );
    const clienteId = cliente.data.id;

    // criar pagamento PIX
    const pagamento = await axios.post(
      `${API_URL}/payments`,
      {
        customer: clienteId,
        billingType: "PIX",
        value: valor || 50,
        dueDate: "2026-12-30",
        description: "Pagamento de Mensalidade",
      },
      { headers }
    );
    const paymentId = pagamento.data.id;

    // pegar QR code
    const pix = await axios.get(
      `${API_URL}/payments/${paymentId}/pixQrCode`,
      { headers }
    );

    return res.json({ payload: pix.data.payload, qrcode: pix.data.encodedImage });
  } catch (error) {
    console.error("ERRO ASAAS:", error.response?.data || error);
    return res.status(500).json({ erro: "Erro ao gerar cobrança PIX" });
  }
};