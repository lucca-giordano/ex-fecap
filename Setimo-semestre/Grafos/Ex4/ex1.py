import heapq

def dijkstra(grafo, origem):
    """
    Algoritmo de Dijkstra para encontrar o caminho de menor custo
    de uma origem para todos os outros vértices.
    """
    n = len(grafo)
    dist = [float('inf')] * n
    dist[origem] = 0
    
    heap = []
    heapq.heappush(heap, (0, origem))
    
    while heap:
        dist_atual, u = heapq.heappop(heap)
        
        if dist_atual > dist[u]:
            continue
            
        for v, peso in grafo[u]:
            nova_dist = dist[u] + peso
            if nova_dist < dist[v]:
                dist[v] = nova_dist
                heapq.heappush(heap, (nova_dist, v))
                
    return dist

def main():
    # 1. Dados Hardcoded (baseados na imagem 'entrada')
    N = 8  # Número de vértices
    M = 10 # Número de arestas
    
    # Lista de tuplas representando as arestas: (u, v, peso)
    arestas = [
        (1, 2, 4),
        (1, 3, 1),
        (2, 3, 2),
        (2, 4, 5),
        (3, 4, 8),
        (3, 5, 10),
        (4, 5, 2),
        (4, 6, 6),
        (5, 6, 3),
        (7, 8, 1)
    ]
    
    Q = 5 # Número de consultas
    
    # Lista de tuplas representando as consultas: (origem, destino)
    consultas = [
        (1, 6),
        (1, 5),
        (2, 6),
        (1, 8),
        (7, 8)
    ]

    # 2. Construção do Grafo (1-indexed)
    grafo = [[] for _ in range(N + 1)]
    for u, v, peso in arestas:
        grafo[u].append((v, peso))
        grafo[v].append((u, peso)) # Grafo não direcionado

    # 3. Processamento das Consultas com Cache
    cache_distancias = {}
    
    print("--- Resultados das Consultas ---")
    for s, t in consultas:
        if s not in cache_distancias:
            cache_distancias[s] = dijkstra(grafo, s)
            
        custo_minimo = cache_distancias[s][t]
        
        if custo_minimo == float('inf'):
            print(f"De {s} para {t}: IMPOSSIVEL")
        else:
            print(f"De {s} para {t}: {custo_minimo}")

if __name__ == '__main__':
    main()