import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { getAvatarUrl } from '../utils';
import { ArrowRight, UserPlus, CheckCircle } from 'lucide-react';

export default function Register() {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ name: '', username: '', password: '', bio: '', subjects: [] });
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (step === 2) {
            fetch('http://localhost:3001/api/subjects')
                .then(res => res.json())
                .then(data => setAvailableSubjects(data))
                .catch(() => setError('Falha carregando grade curricular.'));
        }
    }, [step]);

    const handleNextStep1 = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.username || !formData.password) {
            setError('Preencha os campos obrigatórios.');
            return;
        }
        setError('');
        setStep(2);
    };

    const handleCompleteRegistration = async () => {
        if (formData.subjects.length === 0) {
            setError('Selecione ao menos 1 disciplina de interesse.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://localhost:3001/api/register', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            
            if (res.ok) {
                // Log the user in Context implicitly
                login(data);
                
                // Fetch recommendations for Step 3
                const recRes = await fetch(`http://localhost:3001/api/recommendations/${data.id}`);
                const recData = await recRes.json();
                setRecommendations(recData.recommendations || []);
                setStep(3);
            } else {
                setError(data.error);
                setStep(1); // Back to details if username exists
            }
        } catch(err) {
            setError('Falha de conexão com a Base de Grafos.');
        }
        setLoading(false);
    };

    const handleFollow = async (candidateId) => {
        // Obter ID logado implicitamente via cache após step 2
         const cached = JSON.parse(localStorage.getItem('currentUser'));
         const res = await fetch(`http://localhost:3001/api/users/${candidateId}/follow`, {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ followerId: cached.id })
         });
         const data = await res.json();
         setRecommendations(prev => prev.map(r => r.candidate_id === candidateId ? { ...r, isFollowing: data.following } : r));
    };

    return (
        <div style={{ minHeight: '100vh', padding: '40px 20px', background: '#f4f7f6', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', borderRadius: '24px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px', gap: '10px' }}>
                    <div style={{ width: '30px', height: '6px', borderRadius: '3px', background: step >= 1 ? '#2ed573' : '#dfe6e9', transition: '0.3s' }} />
                    <div style={{ width: '30px', height: '6px', borderRadius: '3px', background: step >= 2 ? '#2ed573' : '#dfe6e9', transition: '0.3s' }} />
                    <div style={{ width: '30px', height: '6px', borderRadius: '3px', background: step >= 3 ? '#2ed573' : '#dfe6e9', transition: '0.3s' }} />
                </div>

                {error && <div style={{ background: '#ff7675', color: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}

                {/* ETAPA 1: INFO BÁSICA */}
                {step === 1 && (
                    <form onSubmit={handleNextStep1} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h2 style={{margin: '0 0 10px 0', color: '#2d3436'}}>Matrícula Acadêmica</h2>
                            <p style={{margin: '0 0 20px 0', color: '#636e72'}}>Crie sua identidade estudantil.</p>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#2d3436', fontWeight: 'bold' }}>Nome Completo *</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid #dfe6e9', fontSize: '1rem', outline: 'none' }}/>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#2d3436', fontWeight: 'bold' }}>Nome de Usuário Acadêmico *</label>
                            <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid #dfe6e9', fontSize: '1rem', outline: 'none' }}/>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#2d3436', fontWeight: 'bold' }}>Senha * (Apenas Letras/Números)</label>
                            <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid #dfe6e9', fontSize: '1rem', outline: 'none' }}/>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#2d3436', fontWeight: 'bold' }}>Minibiografia Estudantil</label>
                            <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid #dfe6e9', fontSize: '1rem', outline: 'none', height: '100px', resize: 'none' }}></textarea>
                        </div>
                        <button type="submit" style={{ background: '#2ed573', color: '#fff', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(46,213,115,0.3)' }}>
                            Avançar <ArrowRight size={20} />
                        </button>
                    </form>
                )}

                {/* ETAPA 2: MATÉRIAS */}
                {step === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h2 style={{margin: '0 0 10px 0', color: '#2d3436'}}>Grade Curricular</h2>
                            <p style={{margin: '0 0 20px 0', color: '#636e72'}}>Selecione as disciplinas que você deseja interagir. Elas ditarão o fluxo de seu cluster de amigos!</p>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                            {availableSubjects.map(sub => {
                                const selected = formData.subjects.includes(sub.id);
                                return (
                                    <div 
                                      key={sub.id} 
                                      onClick={() => {
                                          setFormData(prev => ({
                                              ...prev, 
                                              subjects: selected ? prev.subjects.filter(id => id !== sub.id) : [...prev.subjects, sub.id]
                                          }))
                                      }}
                                      style={{ padding: '10px 18px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', transition: 'all 0.2s', border: selected ? '2px solid #2ed573' : '2px solid #dfe6e9', background: selected ? '#e8f8f5' : '#fff', color: selected ? '#20bf6b' : '#636e72' }}
                                    >
                                        {sub.name}
                                    </div>
                                )
                            })}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={()=>setStep(1)} style={{ flex: 1, background: '#f1f2f6', color: '#636e72', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}>
                                Voltar
                            </button>
                            <button onClick={handleCompleteRegistration} disabled={loading} style={{ flex: 2, background: '#2ed573', color: '#fff', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(46,213,115,0.3)', opacity: loading ? 0.7 : 1 }}>
                                {loading ? 'Compilando Vértices...' : <>Integrar Perfil <ArrowRight size={20} /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ETAPA 3: RECOMENDAÇÕES FINAIS E DEPARTIDA */}
                {step === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h2 style={{margin: '0 0 10px 0', color: '#2d3436'}}>Comunidade Sintonizada</h2>
                            <p style={{margin: '0 0 20px 0', color: '#636e72'}}>O Python Adamic-Adar detectou seus novos vizinhos de Grade. Siga alguns antes de iniciar seus estudos!</p>
                        </div>
                        
                        <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' }}>
                            {recommendations.length === 0 ? <p style={{color: '#b2bec3'}}>Buscando vértices próximos...</p> : recommendations.map(rec => (
                                <div key={rec.candidate_id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', borderBottom: '1px solid #f1f2f6' }}>
                                    <img src={getAvatarUrl(rec.candidate_name, rec.candidate_avatar)} alt="Avatar" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 'bold', color: '#2d3436' }}>{rec.candidate_name}</span>
                                        <span style={{ fontSize: '0.85rem', color: '#636e72' }}>Também curte {rec.common_subjects_names?.[0]}</span>
                                    </div>
                                    <button onClick={() => handleFollow(rec.candidate_id)} style={{ 
                                        background: rec.isFollowing ? 'transparent' : '#0984e3', 
                                        color: rec.isFollowing ? '#2ed573' : '#fff', 
                                        border: rec.isFollowing ? '2px solid #2ed573' : '2px solid transparent', 
                                        padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' 
                                    }}>
                                       {rec.isFollowing ? 'Deixar de seguir' : <><UserPlus size={16}/> Seguir</>}
                                    </button>
                                </div>
                            ))}
                        </div>
                        
                        <button onClick={() => navigate('/')} style={{ background: '#2ed573', color: '#fff', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(46,213,115,0.3)', marginTop: '10px' }}>
                            <CheckCircle size={20} /> Tudo Pronto, Ir para a Home
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
