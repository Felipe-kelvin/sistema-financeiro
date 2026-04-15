// ================= FIREBASE =================
import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= SEGURANÇA DE CARREGAMENTO =================
document.body.style.display = "none";

// ================= UTIL =================
function escaparHTML(texto = "") {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ================= ELEMENTOS =================
const form = document.getElementById("form-transacao");
const saldoEl = document.getElementById("saldo");
const logoutBtn = document.getElementById("logout-btn");

let userUID = null;
let transacoes = {};

// ================= AUTENTICAÇÃO =================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Substituir entrada do histórico para evitar aviso do navegador
    window.history.replaceState(null, '', '../index.html');
    window.location.href = "../index.html";
    return;
  }

  // Logs de debug removidos por segurança
  // console.log("Firebase project:", app.options.projectId);
  // console.log("Usuário autenticado:", user.uid);
  // console.log("auth.currentUser:", auth.currentUser);

  userUID = user.uid;

  // mostra página somente após validar login
  document.body.style.display = "block";

  // Escuta as transações em tempo real
  escutarTransacoes();
});

// ================= ESCUTAR TRANSAÇÕES EM TEMPO REAL =================
function escutarTransacoes() {
  onSnapshot(
    collection(db, "transacoes", userUID, "lista"),
    (snapshot) => {
      transacoes = {};

      snapshot.forEach(docSnap => {
        const t = docSnap.data();

        if (!transacoes[t.mes]) {
          transacoes[t.mes] = [];
        }

        transacoes[t.mes].push({
          id: docSnap.id,
          ...t
        });
      });

      calcularSaldo();
    }
  );
}

// ================= CALCULAR SALDO =================
function calcularSaldo() {
  let saldo = 0;

  for (let mes in transacoes) {
    transacoes[mes].forEach(t => {
      saldo += (t.tipo === "entrada" ? t.valor : -t.valor);
    });
  }

  if(saldo < 0){
    saldoEl.style.color = "red";
  }

  saldoEl.textContent = saldo.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// ================= ADICIONAR TRANSAÇÃO =================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const descricao = document.getElementById("descricao").value.trim();
  const valor = parseFloat(document.getElementById("valor").value);
  const tipo = document.getElementById("tipo").value;
  const mes = document.getElementById("mes").value;

  if (!descricao || isNaN(valor) || valor <= 0 || !tipo || !mes) {
    alert("Preencha todos os dados corretamente! Todos os campos são obrigatórios.");
    return;
  }

  if (!userUID) {
    console.error("Tentativa de criar transação sem UID de usuário autenticado.");
    alert("Erro de autenticação: usuário não identificado.");
    return;
  }

  // Log de debug removido por segurança
  // console.log("Criando transação", { userUID, authCurrentUID: auth.currentUser?.uid, ... });

  if (!auth.currentUser) {
    console.error("Nenhum usuário autenticado no Firebase Auth no momento do submit.");
    alert("Erro de autenticação: usuário não está logado no Firebase.");
    return;
  }

  try {
    await addDoc(
      collection(db, "transacoes", userUID, "lista"),
      {
        descricao: escaparHTML(descricao),
        valor,
        tipo,
        mes
      }
    );

    // Mostrar feedback positivo
    alert("Transação adicionada com sucesso!");
    form.reset();

  } catch (error) {
    console.error("Erro ao adicionar transação:", error);
    alert(`Erro ao adicionar transação: ${error.code || error.message}`);
  }
});

// ================= LOGOUT =================
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "../index.html";
  } catch (error) {
    console.error("Erro ao fazer logout:", error);
    alert("Erro ao fazer logout");
  }
});
