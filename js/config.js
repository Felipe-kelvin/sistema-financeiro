// Configuração Firebase que será substituída por variáveis de ambiente do Netlify/Parcel
// Funciona em desenvolvimento (com fallbacks) e em produção (com variáveis de ambiente)

const getEnv = (key, defaultValue) => {
  try {
    return import.meta.env?.[`VITE_${key}`] || defaultValue;
  } catch {
    return defaultValue;
  }
};

export const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY', 'AIzaSyCdok04xMPLJQ4FUhM9b6LFfSZyWDPeEoQ'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN', 'sistema-caixa-efe6e.firebaseapp.com'),
  projectId: getEnv('FIREBASE_PROJECT_ID', 'sistema-caixa-efe6e'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET', 'sistema-caixa-efe6e.appspot.com'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID', '203332128049'),
  appId: getEnv('FIREBASE_APP_ID', '1:203332128049:web:018082ef4705aa26e9b410')
};
