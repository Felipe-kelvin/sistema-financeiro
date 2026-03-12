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
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  Timestamp
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

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

function formatarData(timestamp) {
  if (!timestamp) return '';
  const data = timestamp.toDate();
  return new Intl.DateTimeFormat('pt-BR').format(data);
}

// ================= ELEMENTOS DOM =================
const formProduto = document.getElementById("form-produto");
const nomeProdutoInput = document.getElementById("nome-produto");
const quantidadeProdutoInput = document.getElementById("quantidade-produto");
const precoProdutoInput = document.getElementById("preco-produto");
const categoriaProdutoInput = document.getElementById("categoria-produto");
const tabelaProdutos = document.getElementById("tabela-produtos");
const filtroProdutoInput = document.getElementById("filtro-produto");
const logoutBtn = document.getElementById("logout-btn");

// Stats
const totalItensEl = document.getElementById("total-itens");
const totalProdutosEl = document.getElementById("total-produtos");
const valorTotalEl = document.getElementById("valor-total");
const vazioMensagem = document.getElementById("vazio-mensagem");

// Modal de venda
const modalVenda = document.getElementById("modal-venda");
const modalProdutoNome = document.getElementById("modal-produto-nome");
const modalQtdVendida = document.getElementById("modal-qtd-vendida");
const modalPrecoUnit = document.getElementById("modal-preco-unit");
const modalTotalVenda = document.getElementById("modal-total-venda");
const fecharModalBtn = document.getElementById("fechar-modal");
const cancelarVendaBtn = document.getElementById("cancelar-venda");
const confirmarVendaBtn = document.getElementById("confirmar-venda");

// ================= VARIÁVEIS GLOBAIS =================
let userUID = null;
let produtos = {};
let produtoAtualSelecionado = null;

// ================= AUTENTICAÇÃO =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }
  
  userUID = user.uid;
  document.body.style.display = "flex";
  carregarProdutos();
});

// ================= LOGOUT =================
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "../index.html";
  } catch (erro) {
    alert("Erro ao sair: " + erro.message);
  }
});

// ================= CARREGAR PRODUTOS =================
function carregarProdutos() {
  if (!userUID) return;
  
  const q = query(
    collection(db, "estoque"),
    where("userId", "==", userUID)
  );
  
  onSnapshot(q, (snapshot) => {
    produtos = {};
    
    snapshot.forEach((doc) => {
      produtos[doc.id] = {
        id: doc.id,
        ...doc.data()
      };
    });
    
    renderizarProdutos();
    atualizarStats();
  });
}

// ================= RENDERIZAR PRODUTOS =================
function renderizarProdutos() {
  const filtro = filtroProdutoInput.value.toLowerCase();
  const produtosFiltrados = Object.values(produtos).filter(p => 
    p.nome.toLowerCase().includes(filtro) ||
    (p.categoria && p.categoria.toLowerCase().includes(filtro))
  );
  
  if (produtosFiltrados.length === 0) {
    tabelaProdutos.innerHTML = '';
    vazioMensagem.style.display = Object.keys(produtos).length === 0 ? 'flex' : 'none';
    return;
  }
  
  vazioMensagem.style.display = 'none';
  
  tabelaProdutos.innerHTML = produtosFiltrados.map(p => `
    <tr data-id="${p.id}">
      <td>
        <strong>${escaparHTML(p.nome)}</strong>
        ${p.sku ? `<br><small style="color: var(--text-secondary);">SKU: ${escaparHTML(p.sku)}</small>` : ''}
      </td>
      <td>${p.categoria ? escaparHTML(p.categoria) : '-'}</td>
      <td>
        <span class="badge-qtd ${p.quantidade <= 5 ? 'alerta' : ''}">${p.quantidade} un.</span>
      </td>
      <td>${formatarMoeda(p.preco)}</td>
      <td><strong>${formatarMoeda(p.quantidade * p.preco)}</strong></td>
      <td>
        <div class="btn-group-small">
          <button class="btn btn-sm btn-success" onclick="abrirModalVenda('${p.id}')">
            <i class="fas fa-sell">Registrar Venda</i>
          </button>
          <button class="btn btn-sm btn-primary" onclick="editarProduto('${p.id}')">
            <i class="fas fa-edit"> Editar Produto</i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deletarProduto('${p.id}')">
            <i class="fas fa-trash"> Deletar</i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ================= ATUALIZAR STATS =================
function atualizarStats() {
  const totalItens = Object.values(produtos).reduce((acc, p) => acc + p.quantidade, 0);
  const totalProdutos = Object.keys(produtos).length;
  const valorTotal = Object.values(produtos).reduce((acc, p) => acc + (p.quantidade * p.preco), 0);
  
  totalItensEl.textContent = totalItens.toLocaleString('pt-BR');
  totalProdutosEl.textContent = totalProdutos;
  valorTotalEl.textContent = formatarMoeda(valorTotal);
}

// ================= CADASTRAR/ATUALIZAR PRODUTO =================
formProduto.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const nome = nomeProdutoInput.value.trim();
  const quantidade = parseInt(quantidadeProdutoInput.value) || 0;
  const preco = parseFloat(precoProdutoInput.value) || 0;
  const categoria = categoriaProdutoInput.value.trim();
  
  if (!nome || quantidade < 0 || preco < 0) {
    alert("Preencha todos os campos obrigatórios corretamente!");
    return;
  }
  
  try {
    await addDoc(collection(db, "estoque"), {
      userId: userUID,
      nome,
      quantidade,
      preco,
      categoria,
      criadoEm: Timestamp.now(),
      atualizadoEm: Timestamp.now()
    });
    
    formProduto.reset();
    console.log("✅ Produto cadastrado com sucesso!");
  } catch (erro) {
    alert("Erro ao cadastrar produto: " + erro.message);
  }
});

// ================= ABRIR MODAL DE VENDA =================
function abrirModalVenda(produtoId) {
  produtoAtualSelecionado = produtos[produtoId];
  
  if (!produtoAtualSelecionado) {
    alert("Produto não encontrado!");
    return;
  }
  
  modalProdutoNome.textContent = escaparHTML(produtoAtualSelecionado.nome);
  modalPrecoUnit.textContent = formatarMoeda(produtoAtualSelecionado.preco);
  modalQtdVendida.value = 1;
  modalTotalVenda.textContent = formatarMoeda(produtoAtualSelecionado.preco);
  
  modalVenda.style.display = "flex";
  modalQtdVendida.focus();
}

// ================= FECHAR MODAL DE VENDA =================
fecharModalBtn.addEventListener("click", () => {
  modalVenda.style.display = "none";
  produtoAtualSelecionado = null;
});

cancelarVendaBtn.addEventListener("click", () => {
  modalVenda.style.display = "none";
  produtoAtualSelecionado = null;
});

// Fechar modal ao clicar fora
modalVenda.addEventListener("click", (e) => {
  if (e.target === modalVenda) {
    modalVenda.style.display = "none";
    produtoAtualSelecionado = null;
  }
});

// ================= CALCULAR TOTAL VENDA EM TEMPO REAL =================
modalQtdVendida.addEventListener("input", () => {
  if (!produtoAtualSelecionado) return;
  
  const qtd = parseInt(modalQtdVendida.value) || 0;
  const total = qtd * produtoAtualSelecionado.preco;
  
  modalTotalVenda.textContent = formatarMoeda(total);
  
  // Validação
  if (qtd > produtoAtualSelecionado.quantidade) {
    modalQtdVendida.style.borderColor = "var(--danger-color)";
    modalTotalVenda.style.color = "var(--danger-color)";
  } else {
    modalQtdVendida.style.borderColor = "";
    modalTotalVenda.style.color = "var(--success-color)";
  }
});

// ================= CONFIRMAR VENDA =================
confirmarVendaBtn.addEventListener("click", async () => {
  if (!produtoAtualSelecionado) return;
  
  const qtdVendida = parseInt(modalQtdVendida.value) || 0;
  
  if (qtdVendida <= 0) {
    alert("Quantidade deve ser maior que 0!");
    return;
  }
  
  if (qtdVendida > produtoAtualSelecionado.quantidade) {
    alert(`Quantidade insuficiente! Disponível: ${produtoAtualSelecionado.quantidade} un.`);
    return;
  }
  
  try {
    const novaQuantidade = produtoAtualSelecionado.quantidade - qtdVendida;
    const totalVenda = qtdVendida * produtoAtualSelecionado.preco;
    
    // Obter o mês atual para registrar na coleção de transações
    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    
    // Atualizar quantidade do produto
    await updateDoc(doc(db, "estoque", produtoAtualSelecionado.id), {
      quantidade: novaQuantidade,
      atualizadoEm: Timestamp.now()
    });
    
    // Registrar a venda em uma coleção separada (para histórico)
    await addDoc(collection(db, "vendas"), {
      userId: userUID,
      produtoId: produtoAtualSelecionado.id,
      produtoNome: produtoAtualSelecionado.nome,
      quantidade: qtdVendida,
      precoUnitario: produtoAtualSelecionado.preco,
      total: totalVenda,
      dataVenda: Timestamp.now()
    });
    
    // Registrar a venda como ENTRADA na coleção de transações
    await addDoc(
      collection(db, "transacoes", userUID, "lista"),
      {
        descricao: `Venda de ${produtoAtualSelecionado.nome} (${qtdVendida} un.)`,
        valor: totalVenda,
        tipo: "entrada",
        mes: mesAtual
      }
    );
    
    console.log(`✅ Venda registrada: ${qtdVendida} un. de ${produtoAtualSelecionado.nome} = ${formatarMoeda(totalVenda)}`);
    
    modalVenda.style.display = "none";
    produtoAtualSelecionado = null;
  } catch (erro) {
    alert("Erro ao registrar venda: " + erro.message);
  }
});

// ================= EDITAR PRODUTO =================
async function editarProduto(produtoId) {
  const produto = produtos[produtoId];
  if (!produto) return;
  
  // Preencher form com dados do produto
  nomeProdutoInput.value = produto.nome;
  quantidadeProdutoInput.value = produto.quantidade;
  precoProdutoInput.value = produto.preco;
  categoriaProdutoInput.value = produto.categoria || '';
  
  // Mudar botão de submit
  const btnSubmit = formProduto.querySelector('button[type="submit"]');
  const originalText = btnSubmit.innerHTML;
  btnSubmit.innerHTML = '<i class="fas fa-sync"></i> Atualizar Produto';
  
  // Remover listener anterior e adicionar novo
  const novoForm = formProduto.cloneNode(true);
  formProduto.parentNode.replaceChild(novoForm, formProduto);
  
  novoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    try {
      await updateDoc(doc(db, "estoque", produtoId), {
        nome: novoForm.querySelector("#nome-produto").value.trim(),
        quantidade: parseInt(novoForm.querySelector("#quantidade-produto").value) || 0,
        preco: parseFloat(novoForm.querySelector("#preco-produto").value) || 0,
        categoria: novoForm.querySelector("#categoria-produto").value.trim(),
        atualizadoEm: Timestamp.now()
      });
      
      novoForm.reset();
      novoForm.querySelector('button[type="submit"]').innerHTML = originalText;
      console.log("✅ Produto atualizado com sucesso!");
      
      // Re-adicionar listener original
      formProduto.addEventListener("submit", handleFormProduto);
    } catch (erro) {
      alert("Erro ao atualizar produto: " + erro.message);
    }
  });
  
  novoForm.id = "form-produto";
  window.addEventListener("beforeunload", () => {
    formProduto.reset();
    btnSubmit.innerHTML = originalText;
  });
}

// Listener original
async function handleFormProduto(e) {
  e.preventDefault();
  
  const nome = nomeProdutoInput.value.trim();
  const quantidade = parseInt(quantidadeProdutoInput.value) || 0;
  const preco = parseFloat(precoProdutoInput.value) || 0;
  const categoria = categoriaProdutoInput.value.trim();
  
  if (!nome || quantidade < 0 || preco < 0) {
    alert("Preencha todos os campos obrigatórios corretamente!");
    return;
  }
  
  try {
    await addDoc(collection(db, "estoque"), {
      userId: userUID,
      nome,
      quantidade,
      preco,
      categoria,
      criadoEm: Timestamp.now(),
      atualizadoEm: Timestamp.now()
    });
    
    formProduto.reset();
    console.log("✅ Produto cadastrado com sucesso!");
  } catch (erro) {
    alert("Erro ao cadastrar produto: " + erro.message);
  }
}

// ================= DELETAR PRODUTO =================
async function deletarProduto(produtoId) {
  const produto = produtos[produtoId];
  if (!produto) return;
  
  if (!confirm(`Tem certeza que deseja deletar "${produto.nome}"? Esta ação não pode ser desfeita!`)) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, "estoque", produtoId));
    console.log("✅ Produto deletado com sucesso!");
  } catch (erro) {
    alert("Erro ao deletar produto: " + erro.message);
  }
}

// ================= FILTRO DE BUSCA =================
filtroProdutoInput.addEventListener("input", () => {
  renderizarProdutos();
});

// Expor funções globais
window.abrirModalVenda = abrirModalVenda;
window.editarProduto = editarProduto;
window.deletarProduto = deletarProduto;
