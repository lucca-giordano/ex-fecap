class UnionFind:
    def __init__(self, n):
        # Cria a lista de pais e o rank (nível)
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, a):
        while self.parent[a] != a:
            # Path compression (compressão de caminho)
            self.parent[a] = self.parent[self.parent[a]] 
            a = self.parent[a]
        return a

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        
        if ra == rb:
            return False
            
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
            
        self.parent[rb] = ra
        
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1
            
        return True

def kruskal_mst(n, edges):
    """
    edges: lista de (u, v, w) (não direcionado)
    Retorna: (custo_total, arestas_mst)
    """
    # Instanciamos com n + 1 porque as salas vão de 1 a N
    uf = UnionFind(n + 1) 
    edges_sorted = sorted(edges, key=lambda x: x[2])
    
    mst_edges = []
    total = 0
    
    for u, v, w in edges_sorted:
        if uf.union(u, v):
            mst_edges.append((u, v, w))
            total += w
            if len(mst_edges) == n - 1:
                break
                
    if len(mst_edges) != n - 1:
        raise ValueError("O grafo não é conexo — MST não existe (há floresta).")
        
    return total, mst_edges

def main():
    # Dados Hardcoded (baseados na imagem 'entrada')
    N = 6 
    M = 9 
    
    arestas = [
        (1, 2, 4),
        (1, 3, 2),
        (2, 3, 1),
        (2, 4, 5),
        (3, 4, 8),
        (3, 5, 10),
        (4, 5, 2),
        (4, 6, 6),
        (5, 6, 3)
    ]
    
    try:
        # Tenta calcular a Árvore Geradora Mínima
        custo_total, _ = kruskal_mst(N, arestas)
        print(custo_total)
    except ValueError:
        # Captura o erro gerado na função caso o grafo seja desconexo
        print("IMPOSSIVEL")

if __name__ == '__main__':
    main()