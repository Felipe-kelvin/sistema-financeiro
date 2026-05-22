// ================= VERIFICAÇÃO DE PAGAMENTO COMPARTILHADA =================

/**
 * Verifica se o usuário tem mensalidades pendentes
 * @param {object} db - Instância do Firestore
 * @param {string} userUID - UID do usuário
 * @returns {Promise<boolean>} true se há pagamento pendente, false caso contrário
 */
export async function verificarPagamentoPendente(db, userUID) {
  try {
    // Importar getDocs e query dinamicamente para evitar problemas de dependência
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    
    if (!userUID) return false;
    
    // Verificar se há mensalidades pendentes
    const mensalidadesRef = collection(db, "users", userUID, "mensalidades");
    const q = query(mensalidadesRef, where("status", "==", "pendente"));
    
    const querySnapshot = await getDocs(q);
    
    // Se houver mensalidades pendentes, retorna true (bloquear acesso)
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Erro ao verificar pagamento pendente:", error);
    // Em caso de erro, deixar o usuário passar (melhor experiência)
    return false;
  }
}

/**
 * Redireciona para a tela de pagamento pendente se necessário
 * @param {string} userUID - UID do usuário
 * @param {object} db - Instância do Firestore
 * @param {string} relativePath - Caminho relativo para o arquivo de bloqueio (padrão: "../pagamento-pendente.html")
 */
export async function redirecionarSePagamentoPendente(db, userUID, relativePath = "../pagamento-pendente.html") {
  const temPendente = await verificarPagamentoPendente(db, userUID);
  
  if (temPendente) {
    window.history.replaceState(null, '', relativePath);
    window.location.href = relativePath;
    return true;
  }
  
  return false;
}
