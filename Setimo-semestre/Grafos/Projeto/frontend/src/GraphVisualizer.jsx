import React, { useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function GraphVisualizer() {
  const [targetUser, setTargetUser] = useState(1);
  const [data, setData] = useState({ nodes: [], links: [] });
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fgRef = React.useRef();

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-400); 
      fgRef.current.d3Force('link').distance(100);    
    }
  }, [data]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/recommendations/${targetUser}`);
      if (!response.ok) throw new Error("Erro da API. A engine.exe do C rodou?");
      const result = await response.json();
      
      setRecommendations(result.recommendations || []);

      const uniqueNodes = new Set();
      if (result.graphData) {
          result.graphData.forEach(link => {
            uniqueNodes.add(link.follower_id);
            uniqueNodes.add(link.followed_id);
          });
      }

      const usersRes = await fetch('http://localhost:3001/api/users');
      const usersData = await usersRes.json();
      const userMap = {};
      usersData.forEach(u => userMap[u.id] = u.name);

      const nodes = Array.from(uniqueNodes).map(id => ({ 
        id, 
        name: userMap[id] || `Usuário ${id}`, 
        color: id === targetUser ? '#2ed573' : '#74b9ff',
        val: id === targetUser ? 20 : 10
      }));

      const links = (result.graphData || []).map(l => ({
        source: l.follower_id,
        target: l.followed_id
      }));

      setData({ nodes, links });
    } catch (err) {
      console.error(err);
      setError("Verifique se o backend está rodando em :3001 e se o Python (engine.py) está acessível.");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadRecommendations(); }, [targetUser]);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', fontFamily: 'Inter, sans-serif', flexDirection: 'column' }}>
      
      <div style={{ flex: 1, minHeight: '400px', background: '#ffffff', position: 'relative', borderBottom: '1px solid #f1f2f6' }}>
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, background: 'rgba(255,255,255,0.9)', padding: '10px 15px', borderRadius: '12px', fontSize: '0.85rem', color: '#636e72', backdropFilter: 'blur(4px)', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          *Verde Pastel: Alvo | Azul: Seguidores Conectados | Arraste e Dê Zoom Livremente
        </div>
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          d3AlphaDecay={0.02}        
          d3VelocityDecay={0.3}
          nodeLabel="name"
          nodeColor="color"
          backgroundColor="#ffffff"
          nodeRelSize={4}
          linkColor={() => 'rgba(45, 52, 54, 0.15)'}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
        />
      </div>

      <div style={{ flex: 1, padding: '20px', background: '#f4f7f6', overflowY: 'auto' }}>
        <h2 style={{marginTop: 0, color: '#2d3436'}}>Terminal Python (Grafos Nativos)</h2>
        <p style={{color: '#636e72', fontSize: '0.9rem'}}>Processamento de Adamic-Adar e Jaccard consultando SQLite puro via `engine.py`.</p>
        
        <div style={{ background: '#ffffff', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', marginBottom: '20px', border: '1px solid #f1f2f6' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#2d3436' }}>
            Simular Grafo do Estudante ID:
            <div style={{ display: 'flex', marginTop: '10px' }}>
                <input 
                    type="number" 
                    value={targetUser} 
                    onChange={e => setTargetUser(parseInt(e.target.value) || 1)} 
                    style={{ flex: 1, padding: '10px 15px', borderRadius: '8px', border: '1px solid #dfe6e9', outline: 'none', fontSize: '1rem' }} 
                />
                <button 
                    onClick={loadRecommendations} 
                    style={{ marginLeft: '10px', padding: '10px 20px', background: '#2ed573', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(46, 213, 115, 0.2)' }}>
                    Injetar no C
                </button>
            </div>
            </label>
        </div>

        {error && <div style={{ background: '#ff7675', color: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>{error}</div>}
        
        <h3 style={{ color: '#2d3436' }}>Sugestões Algorítmicas (Python):</h3>
        
        {loading ? (
            <p style={{color: '#636e72'}}>Spawn() C process...</p>
        ) : recommendations.length === 0 ? (
            <p style={{color: '#636e72'}}>Grafo totalmente isolado ou esgotado para o ID atual.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recommendations.map(req => (
              <li key={req.candidate_id} style={{
                background: '#ffffff', padding: '20px', marginBottom: '15px', borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderLeft: '4px solid #2ed573'
              }}>
                <strong style={{ fontSize: '1.2rem', color: '#2d3436' }}>Colega Compatível: ID {req.candidate_id}</strong>
                <div style={{ fontSize: '0.95em', color: '#636e72', marginTop: '10px', lineHeight: '1.5' }}>
                   📊 <strong>Peso Topológico Final:</strong> {req.score}<br/>
                   📈 <strong>Taxa de Aproximação Adamic:</strong> {req.adamic_adar_raw}<br/>
                   🎯 <strong>Similitude Jaccard:</strong> {req.jaccard_raw} (Common: {req.common_interests})<br/>
                   🤝 <strong>Amigo de Amigo?</strong> {req.is_friend_of_friend === 'true' || req.is_friend_of_friend === true ? 'Sim' : 'Não'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    
    </div>
  );
}
