// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.body.style.display = "none";

function escaparHTML(texto = "") {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

const formProduto = document.getElementById("form-produto");
const nomeProdutoInput = document.getElementById("nome-produto");
const tabelaProdutos = document.getElementById("tabela-produtos");
const filtroProdutoInput = document.getElementById("filtro-produto");
const logoutBtn = document.getElementById("logout-btn");

const totalItensEl = document.getElementById("total-itens");
const totalProdutosEl = document.getElementById("total-produtos");
const valorTotalEl = document.getElementById("valor-total");
const vazioMensagem = document.getElementById("vazio-mensagem");

const modalVenda = document.getElementById("modal-venda");
const modalProdutoNome = document.getElementById("modal-produto-nome");
const modalQtdVendida = document.getElementById("modal-qtd-vendida");
const modalTotalVendaInput = document.getElementById("modal-total-venda-input");
const modalCustoProdutoInput = document.getElementById("modal-custo-produto-input");
const modalPrecoUnit = document.getElementById("modal-preco-unit");
const modalCustoTotal = document.getElementById("modal-custo-total");
const modalLucro = document.getElementById("modal-lucro");
const fecharModalBtn = document.getElementById("fechar-modal");
const cancelarVendaBtn = document.getElementById("cancelar-venda");
const confirmarVendaBtn = document.getElementById("confirmar-venda");

let userUID = null;
let produtos = {};
let produtoAtualSelecionado = null;
let produtoEditandoId = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Substituir entrada do histórico para evitar aviso do navegador
    window.history.replaceState(null, '', '../index.html');
    window.location.href = "../index.html";
    return;
  }

  userUID = user.uid;
  document.body.style.display = "flex";
  carregarProdutos();
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "../index.html";
  } catch (erro) {
    alert("Erro ao sair: " + erro.message);
  }
});

function carregarProdutos() {
  if (!userUID) return;

  const q = query(collection(db, "produtos"), where("userId", "==", userUID));

  onSnapshot(q, (snapshot) => {
    produtos = {};

    snapshot.forEach((docSnap) => {
      produtos[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
    });

    renderizarProdutos();
    atualizarStats();
  });
}

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
      <td><strong>${escaparHTML(p.nome)}</strong></td>
      <td>${p.categoria ? escaparHTML(p.categoria) : '-'}</td>
      <td><span class="badge-qtd ${p.quantidade <= 5 ? 'alerta' : ''}">${p.quantidade} un.</span></td>
      <td>${formatarMoeda(p.preco)}</td>
      <td><strong>${formatarMoeda(p.quantidade * p.preco)}</strong></td>
      <td>
        <div class="btn-group-small">
          <button class="btn btn-sm btn-success" onclick="window.abrirModalVenda('${p.id}')"><i class="fas fa-sell"></i>Registrar Venda</button>
          <button class="btn btn-sm btn-primary" onclick="window.editarProduto('${p.id}')"><i class="fas fa-edit"></i> Editar</button>
          <button class="btn btn-sm btn-danger" onclick="window.deletarProduto('${p.id}')"><i class="fas fa-trash"></i> Deletar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function atualizarStats() {
  const totalItens = Object.values(produtos).reduce((acc, p) => acc + p.quantidade, 0);
  const totalProdutos = Object.keys(produtos).length;
  const valorTotal = Object.values(produtos).reduce((acc, p) => acc + (p.quantidade * p.preco), 0);

  totalItensEl.textContent = totalItens.toLocaleString('pt-BR');
  totalProdutosEl.textContent = totalProdutos;
  valorTotalEl.textContent = formatarMoeda(valorTotal);
}

formProduto.addEventListener("submit", salvarProduto);

async function salvarProduto(e) {
  e.preventDefault();

  const nome = nomeProdutoInput.value.trim();
  const btnSubmit = formProduto.querySelector('button[type="submit"]');

  if (!nome) {
    alert("Digite o nome do produto!");
    return;
  }

  try {
    if (produtoEditandoId) {
      await updateDoc(doc(db, "produtos", produtoEditandoId), {
        nome,
        atualizadoEm: Timestamp.now()
      });

      produtoEditandoId = null;
      btnSubmit.innerHTML = '<i class="fas fa-save"></i> Cadastrar Produto';
      alert("Produto atualizado com sucesso!");
    } else {
      await addDoc(collection(db, "produtos"), {
        userId: userUID,
        nome,
        quantidade: 0,
        preco: 0,
        categoria: "",
        criadoEm: Timestamp.now(),
        atualizadoEm: Timestamp.now()
      });
      alert("Produto cadastrado com sucesso!");
    }

    formProduto.reset();
  } catch (erro) {
    alert("Erro ao salvar produto: " + erro.message);
  }
}


function abrirModalVenda(produtoId) {
  produtoAtualSelecionado = produtos[produtoId];

  if (!produtoAtualSelecionado) {
    alert("Produto não encontrado!");
    return;
  }

  modalProdutoNome.textContent = escaparHTML(produtoAtualSelecionado.nome);
  modalQtdVendida.value = 1;
  modalTotalVendaInput.value = "";
  modalCustoProdutoInput.value = "";
  modalPrecoUnit.textContent = "R$ 0,00";
  modalCustoTotal.textContent = "R$ 0,00";
  modalLucro.textContent = "R$ 0,00";
  modalVenda.style.display = "flex";
  modalQtdVendida.focus();
}

function atualizarPrevia() {
  const qtd = parseInt(modalQtdVendida.value) || 0;
  const total = parseFloat(modalTotalVendaInput.value) || 0;
  const custo = parseFloat(modalCustoProdutoInput.value) || 0;

  if (qtd > 0 && total > 0) {
    modalPrecoUnit.textContent = formatarMoeda(total / qtd);
  } else {
    modalPrecoUnit.textContent = "R$ 0,00";
  }

  modalCustoTotal.textContent = formatarMoeda(custo);
  const lucro = total - custo;
  modalLucro.textContent = formatarMoeda(lucro);
}

fecharModalBtn.addEventListener("click", () => { modalVenda.style.display = "none"; produtoAtualSelecionado = null; });
cancelarVendaBtn.addEventListener("click", () => { modalVenda.style.display = "none"; produtoAtualSelecionado = null; });
modalVenda.addEventListener("click", (e) => { if (e.target === modalVenda) { modalVenda.style.display = "none"; produtoAtualSelecionado = null; }});

modalQtdVendida.addEventListener("input", atualizarPrevia);
modalTotalVendaInput.addEventListener("input", atualizarPrevia);
modalCustoProdutoInput.addEventListener("input", atualizarPrevia);

confirmarVendaBtn.addEventListener("click", async () => {
  if (!produtoAtualSelecionado) return;

  const qtdVendida = parseInt(modalQtdVendida.value) || 0;
  const totalVenda = parseFloat(modalTotalVendaInput.value) || 0;
  const custoTotal = parseFloat(modalCustoProdutoInput.value) || 0;

  if (qtdVendida <= 0) { alert("Quantidade deve ser maior que 0!"); return; }
  if (totalVenda <= 0) { alert("Informe um valor total válido para a venda!"); return; }
  if (custoTotal < 0) { alert("Informe um valor de custo válido para a venda!"); return; }

  try {
    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const lucro = totalVenda - custoTotal;

    await addDoc(collection(db, "vendas"), {
      userId: userUID,
      produtoId: produtoAtualSelecionado.id,
      produtoNome: produtoAtualSelecionado.nome,
      quantidade: qtdVendida,
      precoUnitario: totalVenda / qtdVendida,
      custoTotal,
      lucro,
      total: totalVenda,
      dataVenda: Timestamp.now()
    });

    await addDoc(collection(db, "transacoes", userUID, "lista"), {
      descricao: `Custo de ${produtoAtualSelecionado.nome} (${qtdVendida} un.)`,
      valor: custoTotal,
      tipo: "saida",
      mes: mesAtual
    });

    await addDoc(collection(db, "transacoes", userUID, "lista"), {
      descricao: `Venda de ${produtoAtualSelecionado.nome} (${qtdVendida} un.)`,
      valor: totalVenda,
      tipo: "entrada",
      mes: mesAtual
    });

    modalVenda.style.display = "none";
    produtoAtualSelecionado = null;
    alert("Venda registrada com sucesso!");
  } catch (erro) {
    alert("Erro ao registrar venda: " + erro.message);
  }
});

async function editarProduto(produtoId) {
  const produto = produtos[produtoId];
  if (!produto) return;

  nomeProdutoInput.value = produto.nome;
  produtoEditandoId = produtoId;

  const btnSubmit = formProduto.querySelector('button[type="submit"]');
  btnSubmit.innerHTML = '<i class="fas fa-sync"></i> Atualizar Produto';
}

async function deletarProduto(produtoId) {
  const produto = produtos[produtoId];
  if (!produto) return;

  if (!confirm(`Tem certeza que deseja deletar "${produto.nome}"? Esta ação não pode ser desfeita!`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "produtos", produtoId));
    alert("Produto deletado com sucesso!");
  } catch (erro) {
    alert("Erro ao deletar produto: " + erro.message);
  }
}

filtroProdutoInput.addEventListener("input", () => { renderizarProdutos(); });
window.abrirModalVenda = abrirModalVenda;
window.editarProduto = editarProduto;
window.deletarProduto = deletarProduto;
