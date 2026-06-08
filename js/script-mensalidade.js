// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";
import { createElement, clearElement } from "./dom-utils.js";
import { showError, showSuccess, showInfo } from "./ui-feedback.js";

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

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor);
}

function formatarData(data) {
  if (!data) return "";
  const d = new Date(data.seconds ? data.seconds * 1000 : data);
  return d.toLocaleDateString("pt-BR");
}

// ================= ELEMENTOS DOM =================
const logoutBtn = document.getElementById("logout-btn");
const mensalidadesContainer = document.getElementById("mensalidades-container");
const modal = document.getElementById("modal-pagamento");
const formPagamento = document.getElementById("form-pagamento");
const dataPagamento = document.getElementById("data-pagamento");

// Elementos do modal adicionar
const btnAdicionarMensalidade = document.getElementById("btn-adicionar-mensalidade");
const modalAdicionar = document.getElementById("modal-adicionar");
const formAdicionarMensalidade = document.getElementById("form-adicionar-mensalidade");

// ================= ESTADO =================
let userUID = null;
let mensalidades = [];
let filtroAtual = "pendente";
let mensalidadeSelecionada = null;
let _blockingOverlay = null;

// ================= AUTENTICAÇÃO =================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    console.log("❌ Usuário não autenticado, redirecionando para login");
    // Substituir entrada do histórico para evitar aviso do navegador
    window.history.replaceState(null, '', '../index.html');
    window.location.href = "../index.html";
    return;
  }
  userUID = user.uid;
  // Log de debug removido por segurança
  // console.log("✅ Usuário autenticado:", userUID);
  document.body.style.display = "flex";
  
  // Setar data de pagamento como hoje
  const hoje = new Date().toISOString().split('T')[0];
  dataPagamento.value = hoje;
  
  carregarMensalidades();
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

// ================= ADICIONAR MENSALIDADE =================
btnAdicionarMensalidade.addEventListener("click", () => {
  console.log("🆕 Abrindo modal para adicionar mensalidade");
  modalAdicionar.style.display = "flex";
  
  // Setar data de vencimento como hoje + 30 dias
  const hoje = new Date();
  const vencimento = new Date(hoje.getTime() + (30 * 24 * 60 * 60 * 1000));
  document.getElementById("vencimento-mensalidade").value = vencimento.toISOString().split('T')[0];
});

// ================= FECHAR MODAL ADICIONAR =================
window.fecharModalAdicionar = () => {
  modalAdicionar.style.display = "none";
  formAdicionarMensalidade.reset();
};

window.addEventListener("click", (e) => {
  if (e.target === modalAdicionar) fecharModalAdicionar();
});

// ================= CARREGAR MENSALIDADES =================
function carregarMensalidades() {
  // Log de debug removido por segurança
  // console.log("🔄 Carregando mensalidades para userUID:", userUID);

  const q = query(
    collection(db, "users", userUID, "mensalidades")
  );

  onSnapshot(q, (snapshot) => {
    mensalidades = [];
    // Logs de debug removidos por segurança
    // console.log("📦 Snapshot recebido com", snapshot.docs.length, "documentos");

    snapshot.forEach((doc) => {
      // console.log("📄 Documento:", doc.id, doc.data());
      mensalidades.push({ ...doc.data(), id: doc.id });
    });

    // console.log("✅ Total de mensalidades carregadas:", mensalidades.length);

    // Ordenar por vencimento
    mensalidades.sort((a, b) => {
      const dataA = new Date(a.vencimento || a.mes);
      const dataB = new Date(b.vencimento || b.mes);
      return dataB - dataA;
    });
    
    renderizarMensalidades();
    // Bloquear navegação caso existam mensalidades pendentes
    verificarBloqueioEAutoOpen();
  }, (error) => {
    console.error("❌ Erro ao carregar mensalidades:", error);
  });
}

function getQueryParam(name) {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  } catch (e) {
    return null;
  }
}

function verificarBloqueioEAutoOpen() {
  const temPendente = mensalidades.some(m => m.status !== 'pago');
  if (temPendente) {
    bloquearAcoes();
  } else {
    desbloquearAcoes();
  }

  // Se veio com mensalidadeId na query, abrir modal automaticamente
  const mensalidadeId = getQueryParam('mensalidadeId');
  if (mensalidadeId) {
    const encontrado = mensalidades.find(m => m.id === mensalidadeId);
    if (encontrado && encontrado.status !== 'pago') {
      abrirModalPagamento(mensalidadeId);
    }
  }
}

function bloquearAcoes() {
  if (_blockingOverlay) return;
  _blockingOverlay = document.createElement('div');
  _blockingOverlay.id = 'blocking-overlay';
  Object.assign(_blockingOverlay.style, {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(255,255,255,0.6)', zIndex: 9998, backdropFilter: 'blur(2px)'
  });
  document.body.appendChild(_blockingOverlay);
  if (modal) modal.style.zIndex = 9999;
  document.addEventListener('click', interceptClick, true);
  window.addEventListener('beforeunload', beforeUnloadHandler);
  // permitir logout mesmo com bloqueio
  if (logoutBtn) logoutBtn.setAttribute('data-allow-navigation', 'true');
}

function desbloquearAcoes() {
  if (!_blockingOverlay) return;
  _blockingOverlay.remove();
  _blockingOverlay = null;
  if (modal) modal.style.zIndex = '';
  document.removeEventListener('click', interceptClick, true);
  window.removeEventListener('beforeunload', beforeUnloadHandler);
  if (logoutBtn) logoutBtn.removeAttribute('data-allow-navigation');
}

function interceptClick(e) {
  if (modal && modal.contains(e.target)) return;
  if (e.target.closest('[data-allow-navigation]')) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  showInfo('Você precisa efetuar o pagamento da mensalidade para acessar outras áreas.');
}

function beforeUnloadHandler(e) {
  e.preventDefault();
  e.returnValue = 'Você precisa efetuar o pagamento da mensalidade para sair desta página.';
}

// ================= FILTRAR MENSALIDADES =================
window.filtrarMensalidades = (status, evt) => {
  filtroAtual = status;
  
  // Atualizar abas ativas
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  // marca o botão clicado (evt é passado pelo onclick)
  if (evt && evt.currentTarget) {
    evt.currentTarget.classList.add("active");
  }
  
  renderizarMensalidades();
};

// ================= RENDERIZAR MENSALIDADES =================
function renderizarMensalidades() {
  const mensalidadesFiltradas = mensalidades.filter(m => {
    if (filtroAtual === "pendente") {
      return m.status !== "pago";
    }
    return m.status === "pago";
  });

  clearElement(mensalidadesContainer);

  if (mensalidadesFiltradas.length === 0) {
    const message = createElement("p", {
      className: "empty-state",
      children: [
        createElement("i", { className: "fas fa-inbox" }),
        `${filtroAtual === "pendente" ? "Nenhuma mensalidade pendente" : "Nenhuma mensalidade paga"}`
      ]
    });
    mensalidadesContainer.appendChild(message);
    return;
  }

  mensalidadesFiltradas.forEach((m) => {
    const vencimento = new Date(m.vencimento || m.mes);
    const hoje = new Date();
    const card = createElement("div", { className: "mensalidade-card" });

    const header = createElement("div", { className: "mensalidade-header" });
    const titleBlock = createElement("div");
    const titulo = createElement("h3", {
      className: "mensalidade-titulo",
      text: m.titulo || m.descricao || "Mensalidade"
    });
    const dataText = createElement("p", { className: "mensalidade-data" });
    dataText.append(createElement("i", { className: "fas fa-calendar" }));
    dataText.append(document.createTextNode(` ${formatarData(m.vencimento || m.mes)}`));
    titleBlock.append(titulo, dataText);
    header.append(titleBlock, criarStatusBadge(m.status, vencimento, hoje));

    const body = createElement("div", { className: "mensalidade-body" });
    body.append(criarInfoRow("Valor:", formatarMoeda(m.valor || 0), "valor-destaque"));

    if (m.descricao) {
      body.append(criarInfoRow("Descrição:", m.descricao));
    }

    if (m.status === "pago" && m.dataPagamento) {
      body.append(criarInfoRow("Data do Pagamento:", formatarData(m.dataPagamento)));
    }

    if (m.status === "pago" && m.metodoPagamento) {
      body.append(criarInfoRow("Método:", m.metodoPagamento));
    }

    const footer = createElement("div", { className: "mensalidade-footer" });
    if (m.status !== "pago") {
      const pagarBtn = createElement("button", {
        className: "btn-pagar",
        attrs: { type: "button" },
        text: "Pagar"
      });
      pagarBtn.appendChild(createElement("i", { className: "fas fa-credit-card" }));
      pagarBtn.addEventListener("click", () => abrirModalPagamento(m.id));
      footer.appendChild(pagarBtn);
    }

    card.append(header, body, footer);
    mensalidadesContainer.appendChild(card);
  });
}

function criarInfoRow(label, value, valueClass = "") {
  const row = createElement("div", { className: "info-row" });
  const labelEl = createElement("span", { className: "info-label", text: label });
  const valueEl = createElement("span", { className: `info-value ${valueClass}`.trim(), text: value });
  row.append(labelEl, valueEl);
  return row;
}

function criarStatusBadge(status, vencimento, hoje) {
  let badgeClass = "badge badge-warning";
  let text = "Pendente";
  let iconClass = "fas fa-clock";

  if (status === "pago") {
    badgeClass = "badge badge-success";
    text = "Pago";
    iconClass = "fas fa-check-circle";
  } else if (vencimento < hoje) {
    badgeClass = "badge badge-danger";
    text = "Atrasado";
    iconClass = "fas fa-exclamation-circle";
  }

  const badge = createElement("span", { className: badgeClass });
  badge.append(createElement("i", { className: iconClass }));
  badge.append(document.createTextNode(` ${text}`));
  return badge;
}

// ================= ABRIR MODAL DE PAGAMENTO =================
window.abrirModalPagamento = (id) => {
  mensalidadeSelecionada = mensalidades.find(m => m.id === id);
  if (!mensalidadeSelecionada) return;

  document.getElementById("pag-descricao").textContent = escaparHTML(
    mensalidadeSelecionada.titulo || mensalidadeSelecionada.descricao || "Mensalidade"
  );
  document.getElementById("pag-valor").textContent = formatarMoeda(mensalidadeSelecionada.valor || 0);
  document.getElementById("pag-vencimento").textContent = formatarData(
    mensalidadeSelecionada.vencimento || mensalidadeSelecionada.mes
  );

  // Resetar formulário
  formPagamento.reset();
  const hoje = new Date().toISOString().split('T')[0];
  dataPagamento.value = hoje;

  // Resetar radio buttons
  const radioButtons = document.querySelectorAll('input[name="metodo-pagamento"]');
  radioButtons.forEach(radio => radio.checked = false);

  modal.style.display = "flex";
};

// ================= FECHAR MODAL =================
window.fecharModal = () => {
  // Se ainda houver mensalidade selecionada pendente, não permitir fechar
  if (mensalidadeSelecionada && mensalidadeSelecionada.status !== 'pago') {
    mostrarAvisoFecharModal();
    return;
  }

  modal.style.display = "none";
  mensalidadeSelecionada = null;
};

window.addEventListener("click", (e) => {
  if (e.target === modal) {
    // Tentativa de fechar clicando fora do conteúdo
    if (mensalidadeSelecionada && mensalidadeSelecionada.status !== 'pago') {
      mostrarAvisoFecharModal();
    } else {
      fecharModal();
    }
  }
});

function mostrarAvisoFecharModal() {
  showInfo('Você precisa efetuar o pagamento da mensalidade para continuar usando o sistema. O modal permanecerá aberto até o pagamento.');
}

// ================= SALVAR PAGAMENTO =================
formPagamento.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!mensalidadeSelecionada) return;

  // Pegar método de pagamento selecionado
  const metodoPagamento = document.querySelector('input[name="metodo-pagamento"]:checked');
  if (!metodoPagamento) {
    showError("Por favor, selecione um método de pagamento");
    return;
  }
  const metodoValue = metodoPagamento.value;

  const dataPag = document.getElementById("data-pagamento").value;
  const observacoes = document.getElementById("observacoes").value;

  if (!dataPag) {
    showError("Por favor, selecione a data do pagamento");
    return;
  }

  // pagamento via PIX (Asaas)
  if (metodoValue === "pix") {

  try {
    // ✅ Obter token Firebase do usuário autenticado
    const user = auth.currentUser;
    if (!user) {
      showError("Erro: usuário não autenticado");
      return;
    }

    const token = await user.getIdToken();

    const response = await fetch('/api/criar-cobranca', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        nome: "Cliente",
        email: "cliente@email.com",
        cpf: "12345678909",
        valor: mensalidadeSelecionada.valor
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro na API: ${response.status} - ${errorData.error || 'Erro desconhecido'}`);
    }

    const data = await response.json();

    // Mostrar área PIX
    document.getElementById("pix-area").style.display = "block";
    document.getElementById("qrcode").src = `data:image/png;base64,${data.qrcode}`;
    document.getElementById("pixCode").value = data.payload;

    // Esconder formulário
    formPagamento.style.display = "none";

  } catch (error) {

    console.error(error);
    showError("Erro ao gerar PIX");

  }

  return;
}

  // pagamento online via Mercado Pago
  if (metodoValue === "mercado_pago") {
    try {
      const response = await fetch(
        "http://localhost:3001/criar-pagamento",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            titulo: mensalidadeSelecionada.titulo || "Mensalidade",
            valor: mensalidadeSelecionada.valor,
            mensalidadeId: mensalidadeSelecionada.id,
            userUID
          })
        }
      );

      const data = await response.json();
      window.location.href = data.init_point;
    } catch (error) {
      console.error(error);
      showError("Erro ao iniciar pagamento");
    }

    return; // o webhook registra o pagamento, não fazemos update aqui
  }

  // qualquer outro método, gravar imediatamente no Firestore
  try {
    await updateDoc(
      doc(db, "users", userUID, "mensalidades", mensalidadeSelecionada.id),
      {
        status: "pago",
        dataPagamento: new Date(dataPag),
        metodoPagamento: metodoValue,
        observacoes: observacoes,
        updatedAt: new Date()
      }
    );

    await addDoc(collection(db, "users", userUID, "pagamentos"), {
      tipo: "entrada",
      descricao: `Pagamento de Mensalidade: ${mensalidadeSelecionada.titulo || mensalidadeSelecionada.descricao || "Mensalidade"}`,
      valor: mensalidadeSelecionada.valor,
      metodoPagamento: metodoValue,
      dataPagamento: new Date(dataPag),
      observacoes: observacoes,
      mensalidadeId: mensalidadeSelecionada.id,
      createdAt: new Date()
    });

    showSuccess("✅ Pagamento registrado com sucesso!");
    // Atualizar estado local e remover bloqueio antes de fechar o modal
    try {
      if (mensalidadeSelecionada) mensalidadeSelecionada.status = 'pago';
    } catch (e) {}
    try { desbloquearAcoes(); } catch (e) { /* ignore */ }
    fecharModal();
  } catch (error) {
    console.error("Erro ao registrar pagamento:", error);
    showError("Erro ao registrar pagamento");
  }
});

// ================= SALVAR NOVA MENSALIDADE =================
formAdicionarMensalidade.addEventListener("submit", async (e) => {
  e.preventDefault();

  const titulo = document.getElementById("titulo-mensalidade").value.trim();
  const valor = parseFloat(document.getElementById("valor-mensalidade").value);
  const vencimento = document.getElementById("vencimento-mensalidade").value;
  const descricao = document.getElementById("descricao-mensalidade").value.trim();

  if (!titulo || !valor || !vencimento) {
    showError("Por favor, preencha todos os campos obrigatórios");
    return;
  }

  if (valor <= 0) {
    showError("O valor deve ser maior que zero");
    return;
  }

  try {
    console.log("💾 Salvando nova mensalidade...");
    
await addDoc(collection(db, "users", userUID, "mensalidades"), {
      titulo: titulo,
      valor: valor,
      vencimento: new Date(vencimento),
      descricao: descricao || "",
      status: "pendente",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log("✅ Mensalidade salva com sucesso!");
    showSuccess("✅ Mensalidade adicionada com sucesso!");
    fecharModalAdicionar();
  } catch (error) {
    console.error("❌ Erro ao salvar mensalidade:", error);
    showError("Erro ao salvar mensalidade");
  }
});
// ================= COPIAR CÓDIGO PIX =================
window.copiarPixCode = () => {
  const pixCodeTextarea = document.getElementById("pixCode");
  pixCodeTextarea.select();
  document.execCommand("copy");
  
  // Feedback visual
  const copyBtn = document.querySelector(".btn-copy-pix");
  const originalText = copyBtn.innerHTML;
  copyBtn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
  copyBtn.style.background = "#10b981";
  
  setTimeout(() => {
    copyBtn.innerHTML = originalText;
    copyBtn.style.background = "";
  }, 2000);
};