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
  getDoc
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
    alert("Erro ao fazer logout");
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
    collection(db, `users/${userUID}/mensalidades`)
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
  }, (error) => {
    console.error("❌ Erro ao carregar mensalidades:", error);
  });
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
    } else {
      return m.status === "pago";
    }
  });

  if (mensalidadesFiltradas.length === 0) {
    mensalidadesContainer.innerHTML = `
      <p class="empty-state">
        <i class="fas fa-inbox"></i> 
        ${filtroAtual === "pendente" ? "Nenhuma mensalidade pendente" : "Nenhuma mensalidade paga"}
      </p>
    `;
    return;
  }

  mensalidadesContainer.innerHTML = mensalidadesFiltradas.map(m => {
    const vencimento = new Date(m.vencimento || m.mes);
    const hoje = new Date();
    const statusBadge = m.status === "pago" 
      ? `<span class="badge badge-success"><i class="fas fa-check-circle"></i> Pago</span>`
      : vencimento < hoje
        ? `<span class="badge badge-danger"><i class="fas fa-exclamation-circle"></i> Atrasado</span>`
        : `<span class="badge badge-warning"><i class="fas fa-clock"></i> Pendente</span>`;

    return `
      <div class="mensalidade-card">
        <div class="mensalidade-header">
          <div>
            <h3 class="mensalidade-titulo">${escaparHTML(m.titulo || m.descricao || "Mensalidade")}</h3>
            <p class="mensalidade-data">
              <i class="fas fa-calendar"></i> ${formatarData(m.vencimento || m.mes)}
            </p>
          </div>
          ${statusBadge}
        </div>

        <div class="mensalidade-body">
          <div class="info-row">
            <span class="info-label">Valor:</span>
            <span class="info-value valor-destaque">${formatarMoeda(m.valor || 0)}</span>
          </div>
          ${m.descricao ? `
          <div class="info-row">
            <span class="info-label">Descrição:</span>
            <span class="info-value">${escaparHTML(m.descricao)}</span>
          </div>
          ` : ""}
          ${m.status === "pago" && m.dataPagamento ? `
          <div class="info-row">
            <span class="info-label">Data do Pagamento:</span>
            <span class="info-value">${formatarData(m.dataPagamento)}</span>
          </div>
          ` : ""}
          ${m.status === "pago" && m.metodoPagamento ? `
          <div class="info-row">
            <span class="info-label">Método:</span>
            <span class="info-value">${escaparHTML(m.metodoPagamento)}</span>
          </div>
          ` : ""}
        </div>

        <div class="mensalidade-footer">
          ${m.status !== "pago" ? `
          <button class="btn-pagar" onclick="abrirModalPagamento('${m.id}')">
            <i class="fas fa-credit-card"></i> Pagar
          </button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
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
  modal.style.display = "none";
  mensalidadeSelecionada = null;
};

window.addEventListener("click", (e) => {
  if (e.target === modal) fecharModal();
});

// ================= SALVAR PAGAMENTO =================
formPagamento.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!mensalidadeSelecionada) return;

  // Pegar método de pagamento selecionado
  const metodoPagamento = document.querySelector('input[name="metodo-pagamento"]:checked');
  if (!metodoPagamento) {
    alert("Por favor, selecione um método de pagamento");
    return;
  }
  const metodoValue = metodoPagamento.value;

  const dataPag = document.getElementById("data-pagamento").value;
  const observacoes = document.getElementById("observacoes").value;

  if (!dataPag) {
    alert("Por favor, selecione a data do pagamento");
    return;
  }

  // pagamento via PIX (Asaas)
  if (metodoValue === "pix") {

  try {
    // ✅ Obter token Firebase do usuário autenticado
    const user = auth.currentUser;
    if (!user) {
      alert("Erro: usuário não autenticado");
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
    alert("Erro ao gerar PIX");

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
      alert("Erro ao iniciar pagamento");
    }

    return; // o webhook registra o pagamento, não fazemos update aqui
  }

  // qualquer outro método, gravar imediatamente no Firestore
  try {
    await updateDoc(
      doc(db, `users/${userUID}/mensalidades`, mensalidadeSelecionada.id),
      {
        status: "pago",
        dataPagamento: new Date(dataPag),
        metodoPagamento: metodoValue,
        observacoes: observacoes,
        updatedAt: new Date()
      }
    );

    await addDoc(collection(db, `users/${userUID}/pagamentos`), {
      tipo: "entrada",
      descricao: `Pagamento de Mensalidade: ${mensalidadeSelecionada.titulo || mensalidadeSelecionada.descricao || "Mensalidade"}`,
      valor: mensalidadeSelecionada.valor,
      metodoPagamento: metodoValue,
      dataPagamento: new Date(dataPag),
      observacoes: observacoes,
      mensalidadeId: mensalidadeSelecionada.id,
      createdAt: new Date()
    });

    alert("✅ Pagamento registrado com sucesso!");
    fecharModal();
  } catch (error) {
    console.error("Erro ao registrar pagamento:", error);
    alert("Erro ao registrar pagamento");
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
    alert("Por favor, preencha todos os campos obrigatórios");
    return;
  }

  if (valor <= 0) {
    alert("O valor deve ser maior que zero");
    return;
  }

  try {
    console.log("💾 Salvando nova mensalidade...");
    
    await addDoc(collection(db, `users/${userUID}/mensalidades`), {
      titulo: titulo,
      valor: valor,
      vencimento: new Date(vencimento),
      descricao: descricao || "",
      status: "pendente",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log("✅ Mensalidade salva com sucesso!");
    alert("✅ Mensalidade adicionada com sucesso!");
    fecharModalAdicionar();
  } catch (error) {
    console.error("❌ Erro ao salvar mensalidade:", error);
    alert("Erro ao salvar mensalidade");
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