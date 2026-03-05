import heapq

def prim_mst(adj, start=1):
    n = len(adj) - 1 
    visited = [False] * (n + 1)
    mst_edges = []
    total = 0
    
    heap = [(0, -1, start)]
    
    while heap and len(mst_edges) < n - 1:
        w, u, v = heapq.heappop(heap)
        
        if visited[v]:
            continue
            
        visited[v] = True
        total += w
        
        if u != -1:
            mst_edges.append((u, v, w))
            
        for to, wt in adj[v]:
            if not visited[to]:
                heapq.heappush(heap, (wt, v, to))
                
    if not all(visited[1:]):
        raise ValueError("O grafo não é conexo — MST não existe (há floresta).")
        
    return total, mst_edges

def main():
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
    
    adj = [[] for _ in range(N + 1)]
    for u, v, peso in arestas:
        adj[u].append((v, peso))
        adj[v].append((u, peso))
        
    try:
        custo_total, _ = prim_mst(adj, start=1)
        print(f"{custo_total}")
    except ValueError:
        print("IMPOSSIVEL")

if __name__ == '__main__':
    main()