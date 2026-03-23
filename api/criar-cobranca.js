const axios = require("axios");
require("dotenv").config();

exports.handler = async (event, context) => {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const API_KEY = process.env.ASAAS_API_KEY;
  const API_URL = process.env.ASAAS_URL;

  const headers = {
    "Content-Type": "application/json",
    access_token: API_KEY
  };

  try {

    const { nome, email, cpf, valor } = JSON.parse(event.body);

    const cliente = await axios.post(
      `${API_URL}/customers`,
      {
        name: nome || "Cliente",
        email: email || "cliente@email.com",
        cpfCnpj: cpf || "12345678909"
      },
      { headers }
    );

    const clienteId = cliente.data.id;

    const pagamento = await axios.post(
      `${API_URL}/payments`,
      {
        customer: clienteId,
        billingType: "PIX",
        value: valor || 50,
        dueDate: "2026-12-30",
        description: "Pagamento de Mensalidade"
      },
      { headers }
    );

    const paymentId = pagamento.data.id;

    const pix = await axios.get(
      `${API_URL}/payments/${paymentId}/pixQrCode`,
      { headers }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        payload: pix.data.payload,
        qrcode: pix.data.encodedImage
      })
    };

  } catch (error) {

    console.error("ERRO ASAAS:", error.response?.data || error);

    return {
      statusCode: 500,
      body: JSON.stringify({ erro: "Erro ao gerar cobrança PIX" })
    };
  }
};