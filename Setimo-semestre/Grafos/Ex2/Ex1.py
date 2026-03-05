grafo = {
    "A":["E", "M"],
    "E":["C", "A"],
    "C":["G", "E"],
    "G":["S", "C"],
    "S":["M", "G"],
    "M":["A", "S"],
    "D":["P"],
    "P":["D"],
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