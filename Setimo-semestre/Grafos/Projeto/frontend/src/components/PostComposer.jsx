import React, { useState, useContext } from 'react';
import ReactQuill from 'react-quill';
import { Image, Film, List, Calendar as CalendarIcon } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import 'react-quill/dist/quill.snow.css';

export default function PostComposer({ onPost }) {
  const { currentUser } = useContext(AuthContext);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const subjects = [
    {id: 1, name: 'Álgebra'}, {id: 2, name: 'Geometria'}, {id: 3, name: 'Física'}, 
    {id: 4, name: 'Química'}, {id: 5, name: 'História'}, {id: 6, name: 'Geografia'}, 
    {id: 7, name: 'Biologia'}, {id: 8, name: 'Filosofia'}, {id: 9, name: 'Sociologia'}
  ];

  const submitPost = () => {
    if (!content || content.trim() === '<p><br></p>' || !subjectId) return;
    onPost({ title, content, subject_id: subjectId });
    setContent('');
    setTitle('');
    setSubjectId('');
  };

  return (
    <div style={{ padding: '25px', display: 'flex', gap: '20px' }}>
      
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f2f6' }}>
          <input 
            type="text" 
            placeholder="Título da Publicação" 
            value={title} 
            onChange={e=>setTitle(e.target.value)} 
            style={{flex: 1, padding: '15px 15px 15px 25px', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none', color: '#2d3436', borderTopLeftRadius: '20px'}} 
          />
          <select 
            value={subjectId} 
            onChange={e=>setSubjectId(e.target.value)} 
            style={{ border: 'none', background: '#f8f9fa', padding: '0 15px', fontWeight: 'bold', color: '#636e72', outline: 'none', borderTopRightRadius: '20px', cursor: 'pointer' }}
            required
          >
            <option value="" disabled>Escolher Matéria...</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <ReactQuill 
          theme="snow" 
          value={content} 
          onChange={setContent} 
          placeholder="O que você deseja compartilhar graficamente hoje?"
          modules={{
            toolbar: [
              ['bold', 'italic', 'underline'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['code-block', 'link']
            ]
          }}
        />
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '15px' }}>
          <button 
            disabled={!content || content.trim() === '<p><br></p>' || !subjectId}
            onClick={submitPost}
            style={{ 
              background: '#2ed573', color: '#fff', fontWeight: 'bold', padding: '10px 24px', 
              borderRadius: '30px', fontSize: '0.95rem', cursor: 'pointer', border: 'none',
              opacity: (!content || content.trim() === '<p><br></p>') ? 0.5 : 1,
              boxShadow: '0 4px 12px rgba(46, 213, 115, 0.3)'
            }}
          >
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}
