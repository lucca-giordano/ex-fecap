import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { BookOpen, UserPlus, UserMinus, X } from 'lucide-react';
import PostItem from '../components/PostItem';
import { getAvatarUrl } from '../utils';

export default function Profile() {
  const { id } = useParams();
  const { currentUser } = useContext(AuthContext);
  
  const parsedId = parseInt(id);
  const targetId = isNaN(parsedId) ? currentUser.id : parsedId;
  
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // States for Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalList, setModalList] = useState([]);

  const handleDeletePost = (id) => {
      fetch(`http://localhost:3001/api/posts/${id}`, { method: 'DELETE' })
        .then(() => { setPosts(prev => prev.filter(p => p.id !== id)); });
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/users/${targetId}`);
      if (res.ok) {
          const data = await res.json();
          setProfile(data);
      } else {
          console.error("Erro 404 recuperando usuário alvo", targetId);
          setProfile(null);
      }

      const resPosts = await fetch(`http://localhost:3001/api/feed/${targetId}`);
      if (resPosts.ok) setPosts(await resPosts.json());

      if (targetId !== currentUser.id) {
         const resFollow = await fetch(`http://localhost:3001/api/users/${currentUser.id}/is-following/${targetId}`);
         if (resFollow.ok) setIsFollowing((await resFollow.json()).isFollowing);
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [targetId]);

  const toggleFollow = async () => {
    const res = await fetch(`http://localhost:3001/api/users/${targetId}/follow`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ followerId: currentUser.id })
    });
    if (res.ok) {
       const data = await res.json();
       setIsFollowing(data.following);
       fetchProfile(); 
    }
  };

  const handleRemoveConnection = async (id, type) => {
      if (type === 'following') {
          // Unfollow
          await fetch(`http://localhost:3001/api/users/${id}/follow`, {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ followerId: currentUser.id })
          });
          setModalList(prev => prev.filter(u => u.id !== id));
      } else if (type === 'followBack') {
          // Seguir de volta
          await fetch(`http://localhost:3001/api/users/${id}/follow`, {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ followerId: currentUser.id })
          });
          setModalList(prev => prev.map(u => u.id === id ? { ...u, isFollowedByViewer: 1 } : u));
      }
      fetchProfile();
  };

  const openListModal = async (type) => {
      setModalTitle(type === 'followers' ? 'Seguidores' : 'Seguindo');
      const res = await fetch(`http://localhost:3001/api/users/${targetId}/${type}?viewerId=${currentUser.id}`);
      if (res.ok) {
          setModalList(await res.json());
          setModalOpen(true);
      }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center'}}>Carregando Perfil Acadêmico...</div>;
  if (!profile) return (
       <div style={{padding: '40px', textAlign: 'center', color: '#2d3436'}}>
           <h2 style={{color: '#ff7675'}}>Aluno Removido ou Base Atualizada</h2>
           <p>Este ID acadêmico não existe na arquitetura atual de 6-sandbox.</p>
           <Link to="/" style={{color: '#2ed573', fontWeight: 'bold', textDecoration: 'none'}}>Voltar para as Matrizes (Feed)</Link>
       </div>
  );

  const isMe = currentUser.id === targetId;

  return (
    <div style={{ padding: '0 20px', position: 'relative' }}>
      
      <div style={{ position: 'sticky', top: 0, background: 'rgba(244, 247, 246, 0.9)', backdropFilter: 'blur(12px)', padding: '20px 0', zIndex: 10 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{profile.name}</h1>
        <span style={{ color: '#636e72', fontSize: '0.9rem' }}>{posts.length} Publicações</span>
      </div>

      <div style={{ height: '220px', borderRadius: '24px', background: '#dfe6e9', backgroundImage: 'url("https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=80")', backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: '70px', position: 'relative' }}>
         <img 
          src={getAvatarUrl(profile.name, profile.profile_picture_url)} 
          alt="Avatar" 
          style={{ width: '130px', height: '130px', borderRadius: '50%', border: '6px solid #f4f7f6', position: 'absolute', bottom: '-50px', left: '25px', background: '#2d3436' }}
        />
      </div>

      <div style={{ padding: '0 10px', position: 'relative' }}>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-60px', marginBottom: '20px' }}>
          {isMe ? (
              <button style={{ background: '#fff', color: '#2d3436', fontWeight: 'bold', padding: '8px 20px', borderRadius: '30px', fontSize: '0.95rem', cursor: 'pointer', border: '1px solid #dfe6e9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                Editar Perfil
              </button>
          ) : (
              <button onClick={toggleFollow} style={{ 
                background: isFollowing ? '#ff4757' : '#2ed573', color: '#fff', fontWeight: 'bold', 
                padding: '8px 24px', borderRadius: '30px', fontSize: '0.95rem', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: `0 4px 12px ${isFollowing ? 'rgba(255,71,87,0.3)' : 'rgba(46,213,115,0.3)'}` 
              }}>
                {isFollowing ? <><UserMinus size={18}/> Deixar de Seguir</> : <><UserPlus size={18}/> Seguir Colega</>}
              </button>
          )}
        </div>

        <div style={{ marginTop: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: '#2d3436' }}>{profile.name}</h2>
          <span style={{ color: '#636e72', fontSize: '1rem' }}>@{profile.username}</span>
        </div>

        <p style={{ marginTop: '15px', lineHeight: '1.6', fontSize: '1.05rem', color: '#2d3436' }}>
          {profile.bio}
        </p>

        <div style={{ display: 'flex', gap: '25px', marginTop: '20px', fontSize: '1rem' }}>
          <span onClick={()=>openListModal('following')} style={{cursor:'pointer', borderBottom: '1px dashed #b2bec3', paddingBottom: '2px'}}>
            <strong style={{color: '#2d3436'}}>{profile.followingCount}</strong> <span style={{color: '#636e72'}}>Seguindo</span>
          </span>
          <span onClick={()=>openListModal('followers')} style={{cursor:'pointer', borderBottom: '1px dashed #b2bec3', paddingBottom: '2px'}}>
            <strong style={{color: '#2d3436'}}>{profile.followersCount}</strong> <span style={{color: '#636e72'}}>Seguidores</span>
          </span>
        </div>

        <div style={{ marginTop: '25px' }}>
            <span style={{ color: '#636e72', fontSize: '0.9rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <BookOpen size={16}/> Matérias em Destaque:
            </span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                {profile?.interests?.map(int => (
                  <span key={int} style={{ background: '#e8f8f5', color: '#20bf6b', padding: '6px 14px', borderRadius: '15px', fontSize: '0.85rem', fontWeight:'bold' }}>
                    {int}
                  </span>
                ))}
            </div>
        </div>
      </div>
      
      <h2 style={{ fontSize: '1.25rem', marginTop: '30px', marginBottom: '20px', paddingLeft: '10px', color: '#2d3436' }}>Publicações Recentes</h2>

      <div>
        {posts.map(post => (
          <PostItem key={post.id} post={post} currentUser={currentUser} onDelete={handleDeletePost} />
        ))}
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div style={{ background: '#fff', borderRadius: '24px', width: '400px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #f1f2f6' }}>
                <h3 style={{margin: 0, fontSize: '1.2rem', color: '#2d3436'}}>{modalTitle}</h3>
                <X size={24} color="#636e72" style={{cursor: 'pointer'}} onClick={()=>setModalOpen(false)} />
              </div>
              
              <div style={{ padding: '0', overflowY: 'auto', flex: 1 }}>
                 {modalList.length === 0 ? <div style={{padding: '30px', color: '#636e72', textAlign: 'center'}}>Lista vazia.</div> : (
                     modalList.map(item => (
                         <Link to={`/profile/${item.id}`} key={item.id} onClick={()=>setModalOpen(false)} style={{ display: 'flex', gap: '15px', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #f9f9f9', transition: 'background 0.2s', textDecoration: 'none' }} onMouseOver={e=>e.currentTarget.style.background='#f4f7f6'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                            <img src={getAvatarUrl(item.name, item.avatar)} alt="foto" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
                            <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1}}>
                               <span style={{ fontWeight: 'bold', color: '#2d3436', fontSize: '1rem' }}>{item.name}</span>
                               <span style={{ color: '#636e72', fontSize: '0.85rem'}}>@{item.username}</span>
                            </div>
                             {isMe && modalTitle === 'Seguindo' && (
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveConnection(item.id, 'following'); }} style={{ background: '#ff7675', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Deixar de seguir</button>
                             )}
                             {isMe && modalTitle === 'Seguidores' && item.isFollowedByViewer === 0 && (
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveConnection(item.id, 'followBack'); }} style={{ background: '#0984e3', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(9,132,227,0.3)' }}>Seguir de volta</button>
                             )}
                          </Link>
                     ))
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
