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
  onSnapshot,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";
import { redirecionarSePagamentoPendente } from "./utils-pagamento.js";
import { createElement, clearElement } from "./dom-utils.js";
import { showError } from "./ui-feedback.js";

/* 🔥 SUA CONFIG FIREBASE */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= SEGURANÇA DE CARREGAMENTO =================
document.body.style.display = "none";

// ================= UTIL CONTRA XSS =================
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
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Substituir entrada do histórico para evitar aviso do navegador
    window.history.replaceState(null, '', '../index.html');
    window.location.href = "../index.html";
    return;
  }

  //console.log("Usuário autenticado:", user.uid);

  userUID = user.uid;

  // Verificar se há mensalidade pendente antes de liberar acesso
  if (await redirecionarSePagamentoPendente(db, userUID)) {
    return;
  }

  // mostra página somente após validar login e pagamento
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
  clearElement(lista);
  saldo = 0;
  let temTransacoes = false;

  const filtroMes = filtroMesEl.value;

  for (let mes in transacoes) {
    if (filtroMes && mes !== filtroMes) continue;

    transacoes[mes].forEach((t, index) => {
      temTransacoes = true;

      const li = createElement("li", { className: t.tipo });
      const iconBg = t.tipo === "entrada" ? "#10b981" : "#ef4444";
      const icon = createElement("i", { className: t.tipo === "entrada" ? "fas fa-arrow-down" : "fas fa-arrow-up" });
      const iconWrapper = createElement("div", { className: "transacao-icon" });
      iconWrapper.style.background = iconBg;
      iconWrapper.appendChild(icon);

      const details = createElement("div", { className: "transacao-details" });
      details.append(
        createElement("h4", { text: t.descricao }),
        createElement("p", { text: formatarMes(mes) })
      );

      const info = createElement("div", { className: "transacao-info", children: [iconWrapper, details] });
      const valorTexto = `${t.tipo === "entrada" ? "+" : "-"} R$ ${t.valor.toFixed(2)}`;
      const valorSpan = createElement("span", { className: "valor", text: valorTexto });
      const deleteBtn = createElement("button", { className: "delete", attrs: { type: "button" } });
      deleteBtn.appendChild(createElement("i", { className: "fas fa-trash" }));
      deleteBtn.addEventListener("click", () => clean(mes, index));

      const valorBox = createElement("div", { className: "transacao-valor", children: [valorSpan, deleteBtn] });
      li.append(info, valorBox);
      lista.appendChild(li);

      saldo += (t.tipo === "entrada" ? t.valor : -t.valor);
    });
  }

  if (!temTransacoes) {
    const emptyState = createElement("div", { className: "empty-state" });
    emptyState.append(
      createElement("i", { className: "fas fa-inbox" }),
      createElement("p", { text: "Nenhuma transação encontrada" })
    );
    lista.appendChild(emptyState);
  }

  if (saldo < 0) {
    saldoEl.style.color = "red";
  } else {
    saldoEl.style.color = "";
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
    showError("Erro ao fazer logout");
  }
});

// ================= INIT =================
filtroMesEl.addEventListener("input", atualizarUI);
