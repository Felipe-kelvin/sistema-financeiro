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

/* 🔥 SUA CONFIG FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyCdok04xMPLJQ4FUhM9b6LFfSZyWDPeEoQ",
  authDomain: "sistema-caixa-efe6e.firebaseapp.com",
  projectId: "sistema-caixa-efe6e"
};

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
    window.location.href = "../index.html";
    return;
  }

  console.log("Usuário autenticado:", user.uid);

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

  saldoEl.textContent = `R$ ${saldo.toFixed(2)}`;
}

// ================= ADICIONAR TRANSAÇÃO =================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const descricao = document.getElementById("descricao").value.trim();
  const valor = parseFloat(document.getElementById("valor").value);
  const tipo = document.getElementById("tipo").value;
  const mes = document.getElementById("mes").value;

  if (!descricao || isNaN(valor) || valor <= 0 || !tipo) {
    alert("Preencha todos os dados corretamente!");
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
    alert("Erro ao adicionar transação. Tente novamente.");
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
