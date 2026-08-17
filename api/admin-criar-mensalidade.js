const admin = require("firebase-admin");
const { verifyToken } = require("./auth");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      clientId: process.env.FIREBASE_CLIENT_ID,
      authUri: "https://accounts.google.com/o/oauth2/auth",
      tokenUri: "https://oauth2.googleapis.com/token"
    })
  });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const authHeader = event.headers.authorization;
    const authResult = await verifyToken(authHeader);

    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const userDoc = await admin.firestore().doc(`users/${authResult.uid}`).get();
    const userData = userDoc.data() || {};

    if (userData.role !== "admin") {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Forbidden: admin only" })
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON" })
      };
    }

    const titulo = String(body.titulo || "").trim();
    const valor = Number(body.valor);
    const vencimento = body.vencimento;
    const descricao = String(body.descricao || "").trim();
    const aplicarParaTodos = Boolean(body.aplicarParaTodos);

    if (!titulo || !Number.isFinite(valor) || valor <= 0 || !vencimento) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "titulo, valor e vencimento são obrigatórios" })
      };
    }

    const payload = {
      titulo,
      valor,
      vencimento: new Date(vencimento),
      descricao,
      status: "pendente",
      createdAt: new Date(),
      updatedAt: new Date(),
      criadoPor: authResult.uid
    };

    if (aplicarParaTodos) {
      const usuarios = await admin.firestore().collection("users").get();
      if (usuarios.empty) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Nenhum usuário cadastrado" })
        };
      }

      await Promise.all(usuarios.docs.map((usuarioDoc) => {
        return admin.firestore()
          .collection("users")
          .doc(usuarioDoc.id)
          .collection("mensalidades")
          .add(payload);
      }));
    } else {
      await admin.firestore()
        .collection("users")
        .doc(authResult.uid)
        .collection("mensalidades")
        .add(payload);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, aplicarParaTodos })
    };
  } catch (error) {
    console.error("Erro ao criar mensalidade admin:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Erro interno ao criar mensalidade" })
    };
  }
};
