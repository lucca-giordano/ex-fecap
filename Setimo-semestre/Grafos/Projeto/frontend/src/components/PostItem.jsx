import React from 'react';
import { MessageCircle, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAvatarUrl } from '../utils';

export default function PostItem({ post, currentUser, onDelete }) {
  return (
    <article style={{ 
      background: '#ffffff', borderRadius: '16px', padding: '20px', marginBottom: '15px',  
      boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f1f2f6',
      transition: 'transform 0.1s', cursor: 'pointer'
    }} onMouseOver={e=>e.currentTarget.style.background='#fbfdfc'} onMouseOut={e=>e.currentTarget.style.background='#ffffff'}>
      <Link to={`/post/${post.id}`} style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Link to={`/profile/${post.author_id}`} onClick={e => e.stopPropagation()}>
                <img src={getAvatarUrl(post.authorName, post.authorAvatar)} alt="Avatar" style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#2d3436' }}>{post.authorName}</span>
                <span style={{ color: '#b2bec3', fontSize: '0.85rem' }}>·</span>
                {post.subjectName && (
                  <span style={{ fontSize: '0.75rem', background: '#e8f8f5', color: '#20bf6b', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold' }}>
                    {post.subjectName}
                  </span>
                )}
                {post.isFollowing && (
                  <span style={{ fontSize: '0.75rem', background: '#f1f2f6', color: '#636e72', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold' }}>
                    Conexão Mútua
                  </span>
                )}
                {post.isRecommended && post.recommendationReason && (
                  <span style={{ fontSize: '0.75rem', background: '#fff3cd', color: '#e17055', padding: '2px 8px', borderRadius: '15px', fontWeight: 'bold' }}>
                    {post.recommendationReason}
                  </span>
                )}
            </div>
          </div>
          
          <h2 style={{ margin: '0 0 15px 0', fontSize: '1.25rem', fontWeight: '800', color: '#2d3436', lineHeight: '1.3' }}>
            {post.title}
          </h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '20px', color: '#b2bec3' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <MessageCircle size={18} /> {post.commentsCount || 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <Heart size={18} /> {post.likesCount || 0}
              </div>
            </div>
            
            {currentUser?.id === post.author_id && (
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(post.id); }} 
                  style={{ background: '#ff7675', color: '#white', border: 'none', padding: '6px 12px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', color: '#fff' }}
                >
                  Deletar post
                </button>
            )}
          </div>
      </Link>
    </article>
  );
}
