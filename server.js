const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const app = express();

app.use(cors()); // permitir CORS
app.use(express.json());

// servir arquivos HTML
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.ASAAS_API_KEY;
const API_URL = process.env.ASAAS_URL;

// headers da API
const headers = {
  "Content-Type": "application/json",
  access_token: API_KEY
};

app.post("/criar-cobranca", async (req, res) => {

  try {

    const { nome, email, cpf, valor } = req.body;

    // ==============================
    // CRIAR CLIENTE
    // ==============================
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

    // ==============================
    // CRIAR PAGAMENTO PIX
    // ==============================
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

    // ==============================
    // PEGAR QR CODE PIX
    // ==============================
    const pix = await axios.get(
      `${API_URL}/payments/${paymentId}/pixQrCode`,
      { headers }
    );

    res.json({
      payload: pix.data.payload,
      qrcode: pix.data.encodedImage
    });

  } catch (error) {

    console.log("ERRO ASAAS:");
    console.log(error.response?.data || error);

    res.status(500).json({
      erro: "Erro ao gerar cobrança PIX"
    });

  }

});

app.listen(3001, () => {
  console.log("Servidor rodando em http://localhost:3001");
});