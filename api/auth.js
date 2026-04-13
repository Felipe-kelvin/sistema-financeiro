const admin = require("firebase-admin");

// Inicializar Firebase Admin SDK
// Assume que variáveis de ambiente são configuradas no Netlify
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  clientId: process.env.FIREBASE_CLIENT_ID,
  authUri: "https://accounts.google.com/o/oauth2/auth",
  tokenUri: "https://oauth2.googleapis.com/token",
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const auth = admin.auth();

/**
 * Middleware para verificar token Firebase
 * @param {string} authHeader - Header "Authorization: Bearer <token>"
 * @returns {Promise<Object>} - { valid: boolean, uid: string, error: string }
 */
async function verifyToken(authHeader) {
  try {
    if (!authHeader) {
      return { valid: false, error: "Authorization header missing" };
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      return { valid: false, error: "Invalid authorization header format" };
    }

    const decodedToken = await auth.verifyIdToken(token);
    return { valid: true, uid: decodedToken.uid, email: decodedToken.email };

  } catch (error) {
    return { valid: false, error: "Invalid or expired token" };
  }
}

module.exports = { verifyToken, auth };
