import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

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

let userUID = null;
let chartEntradasSaidas = null;
let chartVendasProdutos = null;
let chartSaldoMensal = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  userUID = user.uid;
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
    alert("Erro ao sair: " + erro.message);
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

    atualizarResumo(totalEntradas, totalSaidas);
    atualizarGraficos(dadosPorMes);
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

    atualizarResumoVendas(totalProdutosVendidos, totalCustos, totalLucro);
    atualizarGraficoVendas(dadosVendasPorMes);
  });
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
            backgroundColor: "#10b981",
            borderRadius: 6,
          },
          {
            label: "Saídas",
            data: valoresSaidas,
            backgroundColor: "#ef4444",
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            stacked: false,
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatarMoeda(value)
            }
          }
        },
        plugins: {
          legend: {
            position: "top"
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatarMoeda(context.parsed.y)}`
            }
          }
        }
      },
      plugins: [valueLabelPlugin]
    });
  } catch (erro) {
    mostrarErroChart("Não foi possível inicializar o gráfico de entradas e saídas. " + erro.message);
    return;
  }

  try {
    chartSaldoMensal = new Chart(ctxSaldoMensal, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Saldo",
            data: valoresSaldo,
            backgroundColor: valoresSaldo.map((saldo) => saldo >= 0 ? "#2563eb" : "#d97706"),
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: false,
            ticks: {
              callback: (value) => formatarMoeda(value)
            }
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
      },
      plugins: [valueLabelPlugin]
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

        const label = dataset.yAxisID === "y" || dataset.yAxisID === "y1" ? formatarMoeda(dataValue) : String(dataValue);
        ctx.fillText(label, position.x, yPosition);
        ctx.restore();
      });
    });
  }
};

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
            backgroundColor: "#0ea5e9",
            yAxisID: "y1",
            borderRadius: 6,
            borderWidth: 1,
          },
          {
            type: "bar",
            label: "Custos",
            data: valoresCustos,
            backgroundColor: "#f97316",
            yAxisID: "y",
            borderRadius: 6,
            borderWidth: 1,
          },
          {
            type: "bar",
            label: "Lucro",
            data: valoresLucro,
            backgroundColor: "#16a34a",
            yAxisID: "y",
            borderRadius: 6,
            borderWidth: 1,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            stacked: false,
            grid: {
              display: false
            }
          },
          y: {
            type: "linear",
            position: "left",
            beginAtZero: true,
            ticks: {
              callback: (value) => formatarMoeda(value)
            }
          },
          y1: {
            type: "linear",
            position: "right",
            beginAtZero: true,
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              callback: (value) => value
            }
          }
        },
        plugins: {
          legend: {
            position: "bottom"
          },
          tooltip: {
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
    errorMessageEl.innerHTML = `<strong>Erro ao carregar os gráficos.</strong><p>${mensagem}</p>`;
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
