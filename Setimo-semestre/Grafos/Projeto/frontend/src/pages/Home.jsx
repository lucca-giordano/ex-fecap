import React, { useState, useEffect, useContext } from 'react';
import PostComposer from '../components/PostComposer';
import PostItem from '../components/PostItem';
import { Settings } from 'lucide-react';
import { AuthContext } from '../AuthContext';

export default function Home() {
  const { currentUser } = useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchFeed = (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    
    fetch(`http://localhost:3001/api/feed/strict?userId=${currentUser.id}&offset=${currentOffset}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          if (data.length < 8) setHasMore(false);
          setPosts(prev => reset ? data : [...prev, ...data]);
        } else {
          if (reset) setPosts([]); 
          setHasMore(false);
        }
      })
      .catch(err => {
        console.error("Erro absoluto no feed strict", err);
        if (reset) setPosts([]);
        setHasMore(false); // Assume no more data on error
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchFeed(true);
  }, [currentUser.id]);

  useEffect(() => {
    if (offset > 0) fetchFeed();
  }, [offset]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 5 >= document.documentElement.scrollHeight && !loading && hasMore) {
          setOffset(prev => prev + 8);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore]);


  const handleNewPost = (newPost) => {
    fetch('http://localhost:3001/api/feed', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ user_id: currentUser.id, title: newPost.title || "Discussão Geral", content: newPost.content, subject_id: newPost.subject_id })
    }).then(res => res.json()).then((data) => { 
         const localPost = {
            id: data.id,
            author_id: currentUser.id,
            authorName: currentUser.name,
            authorHandle: currentUser.handle,
            authorAvatar: currentUser.avatar,
            title: newPost.title || "Discussão Geral",
            content: newPost.content,
            subjectName: "Publicação Aberta",
            created_at: new Date().toISOString(),
            likesCount: 0,
            commentsCount: 0,
            isFollowing: false,
            isRecommended: false
         };
         setPosts(prev => [localPost, ...prev]);
         window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleDeletePost = (id) => {
      fetch(`http://localhost:3001/api/posts/${id}`, { method: 'DELETE' })
        .then(() => { setPosts(prev => prev.filter(p => p.id !== id)); });
  };

  return (
    <div style={{ padding: '0 20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, background: 'rgba(244, 247, 246, 0.95)', backdropFilter: 'blur(12px)', padding: '20px 0', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#2d3436' }}>Feed da Comunidade</h1>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '24px', marginBottom: '30px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
          <PostComposer onPost={handleNewPost} />
      </div>

      <div>
        {posts.map(post => (
          <PostItem key={post.id} post={post} currentUser={currentUser} onDelete={handleDeletePost} />
        ))}
        {loading && <p style={{color: '#636e72', padding: '20px', textAlign: 'center'}}>Expandindo feed global...</p>}
        {!loading && !hasMore && posts.length > 0 && <p style={{color: '#b2bec3', padding: '20px', textAlign: 'center'}}>você chegou ao fim.</p>}
      </div>
    </div>
  );
}
