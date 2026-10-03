const dados = require('./data');

// Função 1
const buscarPedidosPorAno = (ano) => {
  if (isNaN(parseInt(ano))) {
    throw new Error('Valor inesperado. Insira um número.');
  }

  const pedidos = dados.pedidos.filter(
    (pedido) => pedido.ano === ano
  );

  if (pedidos.length === 0) {
    throw new Error(`No ano ${ano} não foram encontrados pedidos`);
  }

  return pedidos;
};

// Função 2
const calcularTotalPedido = (pedido) => {
  return pedido.itens.reduce((total, item) => {
    return total + item.quantidade * item.preco_unitario;
  }, 0);
};

// Função 3
const validarTotalPedido = (pedido) => {
  const calculado = calcularTotalPedido(pedido);

  return calculado === pedido.valor_total;
};

// Função 4
const listarPedidosInconsistentes = () => {
  return dados.pedidos.filter(
    (pedido) => !validarTotalPedido(pedido)
  );
};

// Função 5
const buscarPedidosPorStatus = (status) => {
  if (!status) {
    throw new Error('Status é obrigatório.');
  }

  return dados.pedidos.filter(
    (pedido) => pedido.status === status
  );
};

console.log(buscarPedidosPorStatus("entregue"))

// Função 6
const calcularFaturamentoPorAno = (ano) => {
  const pedidos = buscarPedidosPorAno(ano);

  return pedidos.reduce((total, pedido) => {
    return total + pedido.valor_total;
  }, 0);
};


// console.log('Pedidos de 2023:', buscarPedidosPorAno(2023));

/* const pedidoExemplo = dados.pedidos[0];
console.log(
  `Total calculado do pedido ${pedidoExemplo.id}:`,
  calcularTotalPedido(pedidoExemplo)
); */

/* console.log(
  `Pedido ${pedidoExemplo.id} está consistente?`,
  validarTotalPedido(pedidoExemplo)
); */

//console.log('Pedidos inconsistentes:', listarPedidosInconsistentes());

//console.log('Pedidos entregues:', buscarPedidosPorStatus('entregue'));

//console.log('Faturamento em 2024:', calcularFaturamentoPorAno(2024));

/*try {
  console.log(buscarPedidosPorAno('abc'));
} catch (erro) {
  console.log('Erro capturado:', erro.message);
}

try {
  console.log(buscarPedidosPorAno(1999));
} catch (erro) {
  console.log('Erro capturado:', erro.message);
} */

module.exports = {
  buscarPedidosPorAno,
  calcularTotalPedido,
  validarTotalPedido,
  listarPedidosInconsistentes,
  buscarPedidosPorStatus,
  calcularFaturamentoPorAno
};