import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";
import { redirecionarSePagamentoPendente } from "./utils-pagamento.js";
import { showError } from "./ui-feedback.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.body.style.display = "none";

const totalEntradasEl = document.getElementById("total-entradas");
const totalSaidasEl = document.getElementById("total-saidas");
const totalSaldoEl = document.getElementById("total-saldo");
const totalProdutosVendidosEl = document.getElementById("total-produtos-vendidos");
const totalCustosVendasEl = document.getElementById("total-custos-vendas");
const totalLucroVendasEl = document.getElementById("total-lucro-vendas");
const ctxEntradasSaidas = document.getElementById("chart-entradas-saidas");
const ctxVendasProdutos = document.getElementById("chart-vendas-produtos");
const ctxSaldoMensal = document.getElementById("chart-saldo-mensal");
const errorMessageEl = document.getElementById("graficos-error");
const logoutBtn = document.getElementById("logout-btn");
const rangeButtons = document.querySelectorAll(".filter-btn");

let userUID = null;
let chartEntradasSaidas = null;
let chartVendasProdutos = null;
let chartSaldoMensal = null;
let currentRange = "all";
let transacoesData = {};
let vendasData = {};

rangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentRange = button.dataset.range || "all";
    rangeButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
    atualizarDashboard();
  });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Substituir entrada do histórico para evitar aviso do navegador
    window.history.replaceState(null, '', '../index.html');
    window.location.href = "../index.html";
    return;
  }

  userUID = user.uid;

  // Verificar se há mensalidade pendente antes de liberar acesso
  if (await redirecionarSePagamentoPendente(db, userUID)) {
    return;
  }

  document.body.style.display = "flex";

  if (typeof Chart === "undefined") {
    mostrarErroChart("O Chart.js não foi carregado. Verifique sua conexão ou tente recarregar a página.");
    return;
  }

  escutarTransacoes();
  escutarVendas();
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "../index.html";
  } catch (erro) {
    showError("Erro ao sair: " + erro.message);
  }
});

function escutarTransacoes() {
  onSnapshot(collection(db, "transacoes", userUID, "lista"), (snapshot) => {
    if (typeof Chart === "undefined") {
      mostrarErroChart("O Chart.js não foi carregado. Verifique sua conexão ou tente recarregar a página.");
      return;
    }

    const dadosPorMes = {};
    let totalEntradas = 0;
    let totalSaidas = 0;

    snapshot.forEach((docSnap) => {
      const t = docSnap.data();
      const mes = t.mes || formatarMesData(t.criadoEm);
      const valor = Number(t.valor) || 0;

      if (!dadosPorMes[mes]) {
        dadosPorMes[mes] = {
          entradas: 0,
          saidas: 0,
          saldo: 0
        };
      }

      if (t.tipo === "entrada") {
        dadosPorMes[mes].entradas += valor;
        totalEntradas += valor;
      } else {
        dadosPorMes[mes].saidas += valor;
        totalSaidas += valor;
      }

      dadosPorMes[mes].saldo = dadosPorMes[mes].entradas - dadosPorMes[mes].saidas;
    });

    transacoesData = dadosPorMes;
    atualizarDashboard();
  });
}

function escutarVendas() {
  const vendasQuery = query(collection(db, "vendas"), where("userId", "==", userUID));

  onSnapshot(vendasQuery, (snapshot) => {
    if (typeof Chart === "undefined") {
      mostrarErroChart("O Chart.js não foi carregado. Verifique sua conexão ou tente recarregar a página.");
      return;
    }

    const dadosVendasPorMes = {};
    let totalProdutosVendidos = 0;
    let totalCustos = 0;
    let totalLucro = 0;

    snapshot.forEach((docSnap) => {
      const venda = docSnap.data();
      const mes = formatarMesData(venda.dataVenda);
      const quantidade = Number(venda.quantidade) || 0;
      const custoTotal = Number(venda.custoTotal) || 0;
      const lucro = Number(venda.lucro) || 0;

      totalProdutosVendidos += quantidade;
      totalCustos += custoTotal;
      totalLucro += lucro;

      if (!dadosVendasPorMes[mes]) {
        dadosVendasPorMes[mes] = {
          quantidade: 0,
          custos: 0,
          lucro: 0
        };
      }

      dadosVendasPorMes[mes].quantidade += quantidade;
      dadosVendasPorMes[mes].custos += custoTotal;
      dadosVendasPorMes[mes].lucro += lucro;
    });

    vendasData = dadosVendasPorMes;
    atualizarDashboard();
  });
}

function atualizarDashboard() {
  const dadosFiltrados = filtrarDadosPorPeriodo(transacoesData);
  const vendasFiltradas = filtrarDadosPorPeriodo(vendasData, "vendas");

  const totalEntradas = Object.values(dadosFiltrados).reduce((acc, item) => acc + (Number(item.entradas) || 0), 0);
  const totalSaidas = Object.values(dadosFiltrados).reduce((acc, item) => acc + (Number(item.saidas) || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  const totalProdutosVendidos = Object.values(vendasFiltradas).reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
  const totalCustos = Object.values(vendasFiltradas).reduce((acc, item) => acc + (Number(item.custos) || 0), 0);
  const totalLucro = Object.values(vendasFiltradas).reduce((acc, item) => acc + (Number(item.lucro) || 0), 0);

  atualizarResumo(totalEntradas, totalSaidas);
  atualizarResumoVendas(totalProdutosVendidos, totalCustos, totalLucro);
  atualizarGraficos(dadosFiltrados);
  atualizarGraficoVendas(vendasFiltradas);
}

function filtrarDadosPorPeriodo(dados, tipo = "transacoes") {
  const meses = Object.keys(dados).sort();
  if (!meses.length) return {};

  let limite = meses.length;
  const range = currentRange;

  if (range !== "all") {
    limite = Number(range);
  }

  const sliceStart = Math.max(0, meses.length - limite);
  const mesesSelecionados = meses.slice(sliceStart);
  const resultado = {};

  mesesSelecionados.forEach((mes) => {
    if (tipo === "vendas") {
      resultado[mes] = dados[mes] || { quantidade: 0, custos: 0, lucro: 0 };
      return;
    }

    resultado[mes] = dados[mes] || { entradas: 0, saidas: 0, saldo: 0 };
  });

  return resultado;
}

function atualizarResumo(entradas, saidas) {
  const saldo = entradas - saidas;

  totalEntradasEl.textContent = formatarMoeda(entradas);
  totalSaidasEl.textContent = formatarMoeda(saidas);
  totalSaldoEl.textContent = formatarMoeda(saldo);
}

function atualizarResumoVendas(produtosVendidos, custos, lucro) {
  totalProdutosVendidosEl.textContent = produtosVendidos;
  totalCustosVendasEl.textContent = formatarMoeda(custos);
  totalLucroVendasEl.textContent = formatarMoeda(lucro);
}

function atualizarGraficos(dadosPorMes) {
  if (typeof Chart === "undefined") {
    mostrarErroChart("O Chart.js não foi carregado. Verifique sua conexão ou tente recarregar a página.");
    return;
  }
  const mesesOrdenados = Object.keys(dadosPorMes).sort();

  const labels = mesesOrdenados.map(formatarMesLabel);
  const valoresEntradas = mesesOrdenados.map((mes) => dadosPorMes[mes].entradas);
  const valoresSaidas = mesesOrdenados.map((mes) => dadosPorMes[mes].saidas);
  const valoresSaldo = mesesOrdenados.map((mes) => dadosPorMes[mes].saldo);

  if (chartEntradasSaidas) {
    chartEntradasSaidas.destroy();
  }

  if (chartVendasProdutos) {
    chartVendasProdutos.destroy();
  }

  if (chartSaldoMensal) {
    chartSaldoMensal.destroy();
  }

  try {
    chartEntradasSaidas = new Chart(ctxEntradasSaidas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Entradas",
            data: valoresEntradas,
            backgroundColor: "rgba(16, 185, 129, 0.92)",
            borderColor: "rgba(5, 150, 105, 1)",
            borderWidth: 1,
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 46,
            barPercentage: 0.76,
            categoryPercentage: 0.8,
          },
          {
            label: "Saídas",
            data: valoresSaidas,
            backgroundColor: "rgba(239, 68, 68, 0.92)",
            borderColor: "rgba(185, 28, 28, 1)",
            borderWidth: 1,
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 46,
            barPercentage: 0.76,
            categoryPercentage: 0.8,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 700,
          easing: "easeOutQuart"
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        layout: {
          padding: { top: 12, right: 8, left: 8, bottom: 8 }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#475569", font: { weight: "600" } },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#475569",
              callback: (value) => formatarMoeda(value)
            },
            grid: { color: "rgba(148, 163, 184, 0.15)", drawBorder: false },
            border: { display: false }
          }
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 18,
              color: "#334155",
              font: { weight: "600" }
            }
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            borderColor: "rgba(148, 163, 184, 0.25)",
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatarMoeda(context.parsed.y)}`
            }
          }
        }
      }
    });
  } catch (erro) {
    mostrarErroChart("Não foi possível inicializar o gráfico de entradas e saídas. " + erro.message);
    return;
  }

  try {
    chartSaldoMensal = new Chart(ctxSaldoMensal, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Saldo",
            data: valoresSaldo,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.18)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: "#2563eb",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#475569" }
          },
          y: {
            beginAtZero: false,
            ticks: {
              color: "#475569",
              callback: (value) => formatarMoeda(value)
            },
            grid: { color: "rgba(148, 163, 184, 0.15)" }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => `Saldo: ${formatarMoeda(context.parsed.y)}`
            }
          }
        }
      }
    });
  } catch (erro) {
    mostrarErroChart("Não foi possível inicializar o gráfico de saldo. " + erro.message);
    return;
  }
}

const valueLabelPlugin = {
  id: "valueLabelPlugin",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((element, index) => {
        const dataValue = dataset.data[index];
        if (dataValue === null || dataValue === undefined || dataValue === 0) return;

        const position = element.tooltipPosition();
        const barHeight = element.height || 0;
        const barWidth = element.width || 0;

        // Para barras verticais, posiciona no centro vertical
        // Para barras horizontais ou outros tipos, ajusta conforme necessário
        let yPosition = position.y;
        if (barHeight > 0) {
          yPosition = position.y + (barHeight / 2);
        }

        ctx.save();
        ctx.fillStyle = "#ffffff"; // Texto branco para contraste
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const label = dataset.yAxisID === "y" ? formatarMoeda(dataValue) : dataset.yAxisID === "y1" ? formatarNumero(dataValue) : String(dataValue);
        ctx.fillText(label, position.x, yPosition);
        ctx.restore();
      });
    });
  }
};

function formatarNumero(valor) {
  return Number(valor).toLocaleString('pt-BR');
}

function atualizarGraficoVendas(dadosVendasPorMes) {
  if (typeof Chart === "undefined") {
    mostrarErroChart("O Chart.js não foi carregado. Verifique sua conexão ou tente recarregar a página.");
    return;
  }

  const mesesOrdenados = Object.keys(dadosVendasPorMes).sort();
  const labels = mesesOrdenados.map(formatarMesLabel);
  const valoresQuantidade = mesesOrdenados.map((mes) => dadosVendasPorMes[mes].quantidade);
  const valoresCustos = mesesOrdenados.map((mes) => dadosVendasPorMes[mes].custos);
  const valoresLucro = mesesOrdenados.map((mes) => dadosVendasPorMes[mes].lucro);

  if (chartVendasProdutos) {
    chartVendasProdutos.destroy();
  }

  try {
    chartVendasProdutos = new Chart(ctxVendasProdutos, {
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Produtos vendidos",
            data: valoresQuantidade,
            backgroundColor: "rgba(14, 165, 233, 0.9)",
            borderColor: "rgba(2, 132, 199, 1)",
            yAxisID: "y1",
            borderRadius: 8,
            borderWidth: 1,
            maxBarThickness: 44,
            barPercentage: 0.7,
            categoryPercentage: 0.75,
          },
          {
            type: "bar",
            label: "Custos",
            data: valoresCustos,
            backgroundColor: "rgba(249, 115, 22, 0.88)",
            borderColor: "rgba(234, 88, 12, 1)",
            yAxisID: "y",
            borderRadius: 8,
            borderWidth: 1,
            maxBarThickness: 44,
            barPercentage: 0.7,
            categoryPercentage: 0.75,
          },
          {
            type: "bar",
            label: "Lucro",
            data: valoresLucro,
            backgroundColor: "rgba(22, 163, 74, 0.9)",
            borderColor: "rgba(21, 128, 61, 1)",
            yAxisID: "y",
            borderRadius: 8,
            borderWidth: 1,
            maxBarThickness: 44,
            barPercentage: 0.7,
            categoryPercentage: 0.75,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 700,
          easing: "easeOutQuart"
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        layout: {
          padding: { top: 12, right: 8, left: 8, bottom: 8 }
        },
        scales: {
          x: {
            stacked: false,
            grid: { display: false },
            ticks: { color: "#475569", font: { weight: "600" } },
            border: { display: false }
          },
          y: {
            type: "linear",
            position: "left",
            beginAtZero: true,
            ticks: {
              color: "#475569",
              callback: (value) => formatarMoeda(value)
            },
            grid: { color: "rgba(148, 163, 184, 0.15)", drawBorder: false },
            border: { display: false }
          },
          y1: {
            type: "linear",
            position: "right",
            beginAtZero: true,
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              color: "#475569",
              callback: (value) => formatarNumero(value)
            },
            border: { display: false }
          }
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 18,
              color: "#334155",
              font: { weight: "600" }
            }
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            borderColor: "rgba(148, 163, 184, 0.25)",
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => {
                if (context.dataset.yAxisID === "y") {
                  return `${context.dataset.label}: ${formatarMoeda(context.parsed.y)}`;
                }
                return `${context.dataset.label}: ${context.parsed.y}`;
              }
            }
          }
        }
      },
      plugins: [valueLabelPlugin]
    });
  } catch (erro) {
    mostrarErroChart("Não foi possível inicializar o gráfico de vendas de produtos. " + erro.message);
  }
}

function mostrarErroChart(mensagem) {
  if (errorMessageEl) {
    errorMessageEl.style.display = "block";
    while (errorMessageEl.firstChild) {
      errorMessageEl.removeChild(errorMessageEl.firstChild);
    }

    const strong = document.createElement("strong");
    strong.textContent = "Erro ao carregar os gráficos.";

    const paragraph = document.createElement("p");
    paragraph.textContent = mensagem;

    errorMessageEl.append(strong, paragraph);
  }

  if (ctxEntradasSaidas) {
    ctxEntradasSaidas.style.display = "none";
  }

  if (ctxSaldoMensal) {
    ctxSaldoMensal.style.display = "none";
  }
}

function formatarMesLabel(mes) {
  const [ano, mesNumero] = mes.split("-");
  const nomesMeses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  const mesIndex = Number(mesNumero) - 1;
  return `${nomesMeses[mesIndex]}/${ano}`;
}

function formatarMesData(timestamp) {
  if (!timestamp || !timestamp.toDate) {
    return "0000-00";
  }

  const data = timestamp.toDate();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor);
}
