import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const res = await fetch('http://localhost:3001/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                login(data);
                navigate('/');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Falha de conexão com o servidor de grafos.');
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7f6', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '2rem', color: '#2d3436', textAlign: 'center' }}>Acesso à Rede</h1>
                <p style={{ color: '#636e72', textAlign: 'center', marginBottom: '30px' }}>Conecte-se para explorar as conexões acadêmicas.</p>
                
                {error && <div style={{ background: '#ff7675', color: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#2d3436', fontWeight: 'bold' }}>Nome de Usuário</label>
                        <input 
                            type="text" 
                            required 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid #dfe6e9', fontSize: '1rem', outline: 'none' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#2d3436', fontWeight: 'bold' }}>Senha</label>
                        <input 
                            type="password" 
                            required 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '12px', border: '1px solid #dfe6e9', fontSize: '1rem', outline: 'none' }}
                        />
                    </div>
                    
                    <button type="submit" style={{ background: '#2ed573', color: '#fff', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 15px rgba(46,213,115,0.3)' }}>
                        Entrar na Plataforma
                    </button>
                </form>
                
                <div style={{ textAlign: 'center', marginTop: '25px', color: '#636e72' }}>
                    Não possui uma matriz acadêmica? <Link to="/register" style={{ color: '#2ed573', fontWeight: 'bold', textDecoration: 'none' }}>Matricule-se</Link>
                </div>
            </div>
        </div>
    );
}
