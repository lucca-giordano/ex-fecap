const ecommerceData = {
    "pedidos": [
      {
        "id": 1,
        "ano": 2021,
        "cliente": "João Silva",
        "categoria": "Informática",
        "valor_total": 4500.00,
        "itens": [
          {
            "nome": "Notebook Dell Inspiron",
            "quantidade": 1,
            "preco_unitario": 4000.00
          },
          {
            "nome": "Mouse Logitech",
            "quantidade": 1,
            "preco_unitario": 100.00
          },
          {
            "nome": "Mochila Dell",
            "quantidade": 1,
            "preco_unitario": 400.00
          }
        ],
        "status": "entregue"
      },
      {
        "id": 2,
        "ano": 2022,
        "cliente": "Maria Oliveira",
        "categoria": "Eletrônicos",
        "valor_total": 7200.00,
        "itens": [
          {
            "nome": "iPhone 13",
            "quantidade": 1,
            "preco_unitario": 7000.00
          },
          {
            "nome": "Carregador",
            "quantidade": 1,
            "preco_unitario": 200.00
          }
        ],
        "status": "entregue"
      },
      {
        "id": 3,
        "ano": 2023,
        "cliente": "Carlos Souza",
        "categoria": "Eletrônicos",
        "valor_total": 3800.00,
        "itens": [
          {
            "nome": "Smart TV Samsung 55\"",
            "quantidade": 1,
            "preco_unitario": 3500.00
          },
          {
            "nome": "Suporte de parede",
            "quantidade": 1,
            "preco_unitario": 150.00
          },
          {
            "nome": "Cabo HDMI",
            "quantidade": 1,
            "preco_unitario": 150.00
          }
        ],
        "status": "entregue"
      },
      {
        "id": 4,
        "ano": 2023,
        "cliente": "Ana Costa",
        "categoria": "Eletrodomésticos",
        "valor_total": 5200.00,
        "itens": [
          {
            "nome": "Geladeira Brastemp",
            "quantidade": 1,
            "preco_unitario": 5200.00
          }
        ],
        "status": "processando"
      },
      {
        "id": 5,
        "ano": 2024,
        "cliente": "Lucas Pereira",
        "categoria": "Games",
        "valor_total": 4900.00,
        "itens": [
          {
            "nome": "PlayStation 5",
            "quantidade": 1,
            "preco_unitario": 4500.00
          },
          {
            "nome": "Controle adicional",
            "quantidade": 1,
            "preco_unitario": 300.00
          },
          {
            "nome": "Jogo Spider-Man",
            "quantidade": 1,
            "preco_unitario": 100.00
          }
        ],
        "status": "enviado"
      },
      {
        "id": 6,
        "ano": 2024,
        "cliente": "Fernanda Lima",
        "categoria": "Eletrodomésticos",
        "valor_total": 900.00,
        "itens": [
          {
            "nome": "Air Fryer Philips",
            "quantidade": 1,
            "preco_unitario": 800.00
          },
          {
            "nome": "Livro de receitas",
            "quantidade": 1,
            "preco_unitario": 100.00
          }
        ],
        "status": "entregue"
      }
    ]
  }
  
  module.exports = ecommerceData;