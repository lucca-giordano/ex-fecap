const {
  buscarPedidosPorAno,
  calcularTotalPedido,
  validarTotalPedido,
  listarPedidosInconsistentes,
  buscarPedidosPorStatus,
  calcularFaturamentoPorAno
} = require('./script');

const dados = require('./data');

const pedidoTeste = dados.pedidos[0]

// =============================================

// 'Testa função que busca pedidos por ano.'


  // 1- 'Verifica se a função buscarPedidosPorAno existe.'
  test('Verifica se a função buscarPedidosPorAno existe.', () => {
    expect(buscarPedidosPorAno).toBeDefined()
  })

  // 2- 'Verifica se a função buscarPedidosPorAno, ao receber o ano 2023, retorna um array de pedidos.'
  test('Verifica se a função buscarPedidosPorAno, ao receber o ano 2023, retorna um array de pedidos.', () => {
    expect(buscarPedidosPorAno(2023)).toEqual(expect.any(Array))
  })

  // 3- 'Verifica se a função buscarPedidosPorAno, ao receber um ano sem pedidos, lança um erro.'
  test('Verifica se a função buscarPedidosPorAno, ao receber um ano sem pedidos, lança um erro.', () => {
    expect(() => buscarPedidosPorAno()).toThrow()
  })

  // 4- 'Verifica se a função buscarPedidosPorAno, ao receber um valor inválido, lança erro.'
  test('Verifica se a função buscarPedidosPorAno, ao receber um valor inválido, lança erro.', () => {
    expect(() => buscarPedidosPorAno('2018')).toThrow()
  })


// =============================================

// 'Testa função que calcula total de um pedido.'


  // 1- 'Verifica se a função calcularTotalPedido existe.'

  test('Verifica se a função calcularTotalPedido existe.', () => {
    expect(calcularTotalPedido).toBeDefined()
  })

  // 2- 'Verifica se a função calcularTotalPedido retorna um número maior que zero.'

  test('Verifica se a função calcularTotalPedido retorna um número maior que zero.', () => {
    expect(calcularTotalPedido(pedidoTeste)).toBeGreaterThan(0)
  })


// =============================================

// 'Testa função que valida total do pedido.'

  // 1- 'Verifica se a função validarTotalPedido existe.'

  test('Verifica se a função validarTotalPedido existe.', () => {
    expect(validarTotalPedido).toBeDefined()
  })

  // 2- 'Verifica se a função validarTotalPedido retorna true para pedido consistente.'

  test('Verifica se a função validarTotalPedido retorna true para pedido consistente.', () => {
    expect(validarTotalPedido(pedidoTeste)).toBeTruthy()
  })

// =============================================

// 'Testa função que lista pedidos inconsistentes.'

  // 1- 'Verifica se a função listarPedidosInconsistentes existe.'
  test('Verifica se a função listarPedidosInconsistentes existe.', () => {
    expect(listarPedidosInconsistentes).toBeDefined()
  })

  // 2- 'Verifica se a função retorna um array.'
  test('Verifica se a função retorna um array.', () => {
    expect(listarPedidosInconsistentes()).toEqual(expect.any(Array))
  })

// =============================================

// 'Testa função que busca pedidos por status.'

  // 1- 'Verifica se a função buscarPedidosPorStatus existe.'
  test('Verifica se a função buscarPedidosPorStatus existe.', () => {
    expect(buscarPedidosPorStatus).toBeDefined()
  })

  // 2- 'Verifica se a função retorna pedidos com status "entregue".'
  test('Verifica se a função retorna pedidos com status "entregue".', () => {
    expect(buscarPedidosPorStatus("entregue")).toEqual(expect.any(Array))
  })

  // 3- 'Verifica se a função lança erro quando status não é informado.'
  test('Verifica se a função lança erro quando status não é informado.', () => {
    expect(() => buscarPedidosPorStatus()).toThrow()
  })

// =============================================

// 'Testa função que calcula faturamento por ano.'

  // 1- 'Verifica se a função calcularFaturamentoPorAno existe.'

  test('Verifica se a função calcularFaturamentoPorAno existe.', () => {
    expect(calcularFaturamentoPorAno).toBeDefined()
  })

  // 2- 'Verifica se a função retorna um número maior que zero.'
  test('Verifica se a função retorna um número maior que zero.', ()=> {
    expect(calcularFaturamentoPorAno(2023)).toBeGreaterThan(0)
  })