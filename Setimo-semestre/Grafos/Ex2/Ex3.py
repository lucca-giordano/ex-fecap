grafo = {
    "A": ["B", "C", "D"],
    "B": ["E", "F", "A"],
    "C": ["G", "H", "A"],
    "D": ["I", "A"],
    "E": ["J", "B"],
    "F": ["K", "B"],
    "G": ["L", "C"],
    "H": ["M", "C"],
    "I": ["N", "D"],
    "J": ["O", "E"],
    "K": ["O", "F"],
    "L": ["M", "G"],
    "M": ["N", "H", "L"],
    "N": ["O", "M", "I"],
    "O": ["N", "K", "J"]
}

visitados = set()
componentes = []

def dfs(grafo, v, componenteAtual):
    visitados.add(v)
    componenteAtual.append(v)
    for vizinho in grafo[v]:
        if vizinho not in visitados:
            dfs(grafo, vizinho, componenteAtual)

for vertice in grafo:
    if vertice not in visitados:
        ilha = []
        dfs(grafo, vertice, ilha)
        componentes.append(ilha)
        

if(len(componentes) == 1):
    print("Grafo conexo")
else:
    print("Grafo nao conexo")

print(f"Quantidade de componentes conexos: {len(componentes)}")