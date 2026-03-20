import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../AuthContext';
import { Link } from 'react-router-dom';
import { getAvatarUrl } from '../utils';

export default function SidebarRight() {
  const { currentUser } = useContext(AuthContext);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleFollow = async (candidateId) => {
      try {
          const res = await fetch(`http://localhost:3001/api/users/${candidateId}/follow`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ followerId: currentUser.id })
          });
          if (res.ok) {
              const data = await res.json();
              setRecommendations(prev => prev.map(r => r.candidate_id === candidateId ? { ...r, isFollowing: data.following } : r));
          }
      } catch (e) {
          console.error("Follow error:", e);
      }
  };

  useEffect(() => {
    fetch(`http://localhost:3001/api/recommendations/${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
         if (data.recommendations && data.recommendations.length > 0) {
            setRecommendations(data.recommendations.slice(0, 4));
         } else {
            setRecommendations([]);
         }
      })
      .finally(() => setLoading(false));
  }, [currentUser.id]);

  return (
    <div style={{ height: '100%', padding: '10px 0', position: 'relative' }}>
      
      {/* Recommendations Widget */}
      <div style={{ background: '#ffffff', borderRadius: '24px', padding: '20px 0', marginTop: '15px', border: '1px solid #f1f2f6', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 20px 0', padding: '0 20px', color: '#2d3436' }}>
          Sugestões
        </h2>

        {loading ? (
            <p style={{ color: '#636e72', padding: '0 20px' }}>Invocando Python Engine...</p>
        ) : recommendations.length === 0 ? (
            <p style={{ color: '#636e72', padding: '0 20px' }}>Nenhuma intersecção pendente.</p>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recommendations.map(rec => {
                const subjStr = (rec.common_subjects_names || []).join(', ');
                return (
                <div key={rec.candidate_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', transition: 'background 0.2s', borderBottom: '1px solid #f1f2f6' }} onMouseOver={e=>e.currentTarget.style.background='#fbfdfc'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <Link to={`/profile/${rec.candidate_id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, textDecoration: 'none' }}>
                    <img src={getAvatarUrl(rec.candidate_name, rec.candidate_avatar)} alt={rec.candidate_name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                       <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#2d3436', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                         {rec.candidate_name}
                       </span>
                       {subjStr ? (
                           <span style={{ color: '#b2bec3', fontSize: '0.75rem', marginTop: '2px', lineHeight: '1.2' }}>
                               Interesses em comum: <strong style={{color: '#636e72'}}>{subjStr}</strong>
                           </span>
                       ) : rec.common_friends_names?.length > 0 && (
                           <span style={{ color: '#b2bec3', fontSize: '0.75rem', marginTop: '2px', lineHeight: '1.2' }}>
                               Amigo de <strong style={{color: '#636e72'}}>{rec.common_friends_names[0]}</strong>
                           </span>
                       )}
                    </div>
                  </Link>
                  <button 
                     onClick={() => handleFollow(rec.candidate_id)}
                     style={{ 
                         background: rec.isFollowing ? 'transparent' : '#2d3436', 
                         color: rec.isFollowing ? '#2ed573' : '#fff', 
                         fontWeight: 'bold', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', cursor: 'pointer', 
                         border: rec.isFollowing ? '2px solid #2ed573' : '2px solid transparent', marginLeft: '10px',
                         display: 'flex', alignItems: 'center', gap: '5px'
                     }}
                  >
                     {rec.isFollowing ? 'Deixar de seguir' : 'Seguir'}
                  </button>
                </div>
              );})}
            </div>
        )}
      </div>
    </div>
  );
}
