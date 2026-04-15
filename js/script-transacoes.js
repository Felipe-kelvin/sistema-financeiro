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
  deleteDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

/* 🔥 SUA CONFIG FIREBASE */

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
const lista = document.getElementById("lista-transacoes");
const saldoEl = document.getElementById("saldo");
const filtroMesEl = document.getElementById("filtro-mes");
const exportPDFBtn = document.getElementById("export-pdf");
const exportExcelBtn = document.getElementById("export-excel");
const logoutBtn = document.getElementById("logout-btn");

let saldo = 0;
let transacoes = {};
let userUID = null;

// ================= AUTENTICAÇÃO =================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Substituir entrada do histórico para evitar aviso do navegador
    window.history.replaceState(null, '', '../index.html');
    window.location.href = "../index.html";
    return;
  }

  //console.log("Usuário autenticado:", user.uid);

  userUID = user.uid;

  // mostra página somente após validar login
  document.body.style.display = "block";

  escutarTransacoes();
});

// ================= ESCUTAR TEMPO REAL =================
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

      atualizarUI();
    }
  );
}

// ================= ATUALIZAR UI =================
function atualizarUI() {
  lista.innerHTML = "";
  saldo = 0;
  let temTransacoes = false;

  const filtroMes = filtroMesEl.value;

  for (let mes in transacoes) {
    if (filtroMes && mes !== filtroMes) continue;

    temTransacoes = true;

    transacoes[mes].forEach((t, index) => {
      const li = document.createElement("li");
      li.classList.add(t.tipo);

      const icon = t.tipo === "entrada" 
        ? '<i class="fas fa-arrow-down"></i>' 
        : '<i class="fas fa-arrow-up"></i>';

      const iconBg = t.tipo === "entrada" ? "#10b981" : "#ef4444";

      li.innerHTML = `
        <div class="transacao-info">
          <div class="transacao-icon" style="background: ${iconBg};">
            ${icon}
          </div>
          <div class="transacao-details">
            <h4>${escaparHTML(t.descricao)}</h4>
            <p>${formatarMes(mes)}</p>
          </div>
        </div>
        <div class="transacao-valor">
          <span class="valor">${t.tipo === "entrada" ? "+" : "-"} R$ ${t.valor.toFixed(2)}</span>
          <button class="delete" id="delete-${mes}-${index}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;

      const deleteBtn = li.querySelector(`#delete-${mes}-${index}`);
      deleteBtn.addEventListener("click", () => clean(mes, index));

      lista.appendChild(li);
      saldo += (t.tipo === "entrada" ? t.valor : -t.valor);
    });
  }

  // Mostrar mensagem vazia se não houver transações
  if (!temTransacoes) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <i class="fas fa-inbox"></i>
      <p>Nenhuma transação encontrada</p>
    `;
    lista.appendChild(emptyState);
  }

  if(saldo < 0){
    saldoEl.style.color = "red";
  } 

  saldoEl.textContent = saldo.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// ================= EXCLUIR =================
async function clean(mes, index) {
  const item = transacoes[mes][index];

  await deleteDoc(
    doc(db, "transacoes", userUID, "lista", item.id)
  );
}

// ================= FORMATAR MÊS =================
function formatarMes(mes) {
  const [ano, m] = mes.split("-");
  const nomesMeses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];
  return `${nomesMeses[parseInt(m) - 1]}/${ano}`;
}

// ================= EXPORTAR PDF =================
exportPDFBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 10;
  doc.text("Relatório de Fluxo de Caixa", 10, y);
  y += 10;

  let saldoGeral = 0;

  for (let mes in transacoes) {
    if (filtroMesEl.value && mes !== filtroMesEl.value) continue;

    doc.text(formatarMes(mes), 10, y);
    y += 6;

    let saldoMes = 0;

    transacoes[mes].forEach(t => {
      doc.text(
        `${t.descricao} - R$ ${t.valor.toFixed(2)} (${t.tipo})`,
        15,
        y
      );
      y += 6;

      saldoMes += (t.tipo === "entrada" ? t.valor : -t.valor);
    });

    doc.text(`Saldo do mês: R$ ${saldoMes.toFixed(2)}`, 15, y);
    y += 10;

    saldoGeral += saldoMes;
  }

  doc.text(`Saldo Total: R$ ${saldoGeral.toFixed(2)}`, 10, y);
  doc.save("fluxo-caixa.pdf");
});

// ================= EXPORTAR CSV =================
exportExcelBtn.addEventListener("click", () => {
  let csv = "Descrição,Valor,Tipo,Mês\n";

  for (let mes in transacoes) {
    if (filtroMesEl.value && mes !== filtroMesEl.value) continue;

    transacoes[mes].forEach(t => {
      csv += `"${t.descricao}",${t.valor},${t.tipo},${formatarMes(mes)}\n`;
    });
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "fluxo-caixa.csv";
  link.click();
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

// ================= INIT =================
filtroMesEl.addEventListener("input", atualizarUI);
