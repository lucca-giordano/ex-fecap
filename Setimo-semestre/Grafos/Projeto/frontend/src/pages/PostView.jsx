import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { Heart, MessageCircle, Send } from 'lucide-react';

export default function PostView() {
  const { id } = useParams();
  const { currentUser } = useContext(AuthContext);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [hasLiked, setHasLiked] = useState(false);

  const fetchPost = async () => {
      try {
          const res = await fetch(`http://localhost:3001/api/posts/${id}`);
          if (res.ok) setData(await res.json());
          
          const resLike = await fetch(`http://localhost:3001/api/posts/${id}/has-liked/${currentUser.id}`);
          if (resLike.ok) setHasLiked((await resLike.json()).hasLiked);
      } catch(e) { console.error(e); }
      setLoading(false);
  };

  useEffect(() => { fetchPost(); }, [id]);

  const toggleLike = async () => {
      const res = await fetch(`http://localhost:3001/api/posts/${id}/like`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
          const result = await res.json();
          setHasLiked(result.liked);
          setData(prev => ({
              ...prev,
              post: { ...prev.post, likesCount: prev.post.likesCount + (result.liked ? 1 : -1) }
          }));
      }
  };

  const submitComment = async () => {
      if (!commentText.trim()) return;
      const res = await fetch(`http://localhost:3001/api/posts/${id}/comments`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, content: commentText })
      });
      if (res.ok) {
          setCommentText('');
          fetchPost();
      }
  };

  if (loading) return <div style={{padding: '40px', textAlign: 'center'}}>Carregando Teoria...</div>;
  if (!data || !data.post) return <div style={{padding: '40px', color: '#ff7675'}}>Publicação não encontrada no SQLite.</div>;

  const { post, comments } = data;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f2f6' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
             <Link to={`/profile/${post.author_id}`}>
                 <img src={post.authorAvatar} alt="Avatar" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
             </Link>
             <div>
                 <Link to={`/profile/${post.author_id}`} style={{ textDecoration: 'none', fontWeight: 'bold', color: '#2d3436', fontSize: '1.05rem', display: 'block' }}>
                     {post.authorName}
                 </Link>
                 <div style={{ color: '#b2bec3', fontSize: '0.85rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span>@{post.authorHandle}</span>
                     {post.subjectName && <span style={{ background: '#e8f8f5', color: '#20bf6b', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{post.subjectName}</span>}
                 </div>
             </div>
         </div>

         <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#2d3436', margin: '0 0 20px 0', lineHeight: '1.3' }}>
             {post.title}
         </h1>

         <div className="custom-html-content" dangerouslySetInnerHTML={{ __html: post.content }} style={{ fontSize: '1.05rem', lineHeight: '1.7', color: '#2d3436', marginBottom: '30px' }} />

         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f2f6', paddingTop: '20px' }}>
             <div style={{ display: 'flex', gap: '15px' }}>
                 <button onClick={toggleLike} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: hasLiked ? '#ff7675' : '#f1f2f6', color: hasLiked ? '#fff' : '#636e72', border: 'none', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                     <Heart size={20} fill={hasLiked ? "#fff" : "none"} /> {post.likesCount || 0} Upvotes
                 </button>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#636e72', padding: '10px 20px', borderRadius: '30px', background: '#f8f9fa', fontWeight: 'bold' }}>
                     <MessageCircle size={20} /> {post.commentsCount || 0} Respostas
                 </div>
             </div>
             {currentUser?.id === post.author_id && (
                 <button onClick={() => {
                     fetch(`http://localhost:3001/api/posts/${post.id}`, { method: 'DELETE' })
                     .then(() => window.location.href = '/');
                 }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ff7675', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                     Deletar post
                 </button>
             )}
         </div>
      </div>

      <div style={{ marginTop: '30px', background: '#fff', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #f1f2f6' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#2d3436' }}>Discussão Colaborativa</h3>
          
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
             <img src={currentUser.avatar} alt="Me" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
             <div style={{ flex: 1, display: 'flex', background: '#f8f9fa', borderRadius: '20px', padding: '5px 15px', border: '1px solid #dfe6e9' }}>
                 <input 
                     type="text" 
                     placeholder="Adicionar um comentário acadêmico..." 
                     value={commentText} 
                     onChange={e => setCommentText(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && submitComment()}
                     style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '1rem', color: '#2d3436' }} 
                 />
                 <button onClick={submitComment} style={{ background: 'transparent', border: 'none', color: '#2ed573', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                     <Send size={20} />
                 </button>
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: '15px' }}>
                      <Link to={`/profile/${c.author_id}`}>
                          <img src={c.authorAvatar} alt="Ava" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                      </Link>
                      <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '16px', borderTopLeftRadius: '0', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                              <Link to={`/profile/${c.author_id}`} style={{ fontWeight: 'bold', color: '#2d3436', textDecoration: 'none' }}>{c.authorName}</Link>
                              <span style={{ fontSize: '0.8rem', color: '#b2bec3' }}>@{c.authorHandle}</span>
                          </div>
                          <div style={{ color: '#2d3436', lineHeight: '1.5', fontSize: '0.95rem' }}>{c.content}</div>
                      </div>
                  </div>
              ))}
              {comments.length === 0 && <p style={{color: '#b2bec3', textAlign: 'center'}}>Nenhuma resposta ainda. Seja o primeiro a debater!</p>}
          </div>
      </div>
    </div>
  );
}
