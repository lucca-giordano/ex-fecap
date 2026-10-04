// Alerta sonoro, como o P_NoiseAlert / P_RecursiveSound do Doom. Puro.
// O grafo de setores é montado uma vez (sem portas, as aberturas não mudam). A busca usa uma pilha
// explícita em vez de recursão; o conjunto final de setores alertados é o mesmo.

export const ML_SOUNDBLOCK = 0x0040;

// Arestas por setor: { to, soundBlock } para cada linha de dois lados com abertura > 0.
export function buildSoundGraph(world) {
  const edges = world.sectors.map(() => []);
  for (const l of world.lines) {
    if (l.oneSided) continue;
    const f = world.sectors[l.front], b = world.sectors[l.back];
    const open = Math.min(f.ceilingHeight, b.ceilingHeight) - Math.max(f.floorHeight, b.floorHeight);
    if (open <= 0) continue;
    const soundBlock = (l.flags & ML_SOUNDBLOCK) !== 0;
    edges[l.front].push({ to: l.back, soundBlock });
    edges[l.back].push({ to: l.front, soundBlock });
  }
  return { edges };
}

// Marca `alerted[setor] = true` em todos os setores alcançados a partir de `start`.
// Um setor é revisitado só se chegar com menos bloqueios (soundtraversed > b + 1).
// Uma linha com soundBlock só é atravessada com b = 0 (passando b = 1).
export function noiseAlert(graph, start, alerted) {
  if (start < 0 || start >= graph.edges.length) return alerted;
  const traversed = new Map(); // setor -> b + 1 da melhor visita
  const stack = [[start, 0]];
  while (stack.length) {
    const [sec, b] = stack.pop();
    const seen = traversed.get(sec);
    if (seen !== undefined && seen <= b + 1) continue;
    traversed.set(sec, b + 1);
    alerted[sec] = true;
    for (const e of graph.edges[sec]) {
      if (e.soundBlock) {
        if (b === 0) stack.push([e.to, 1]);
      } else {
        stack.push([e.to, b]);
      }
    }
  }
  return alerted;
}
