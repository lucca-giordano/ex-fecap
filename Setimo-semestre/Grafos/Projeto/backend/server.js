const express = require('express');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { fileMustExist: true });
db.pragma('foreign_keys = ON');

// --- AUTENTICAÇÃO E REGISTRO DE USUÁRIOS ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const user = db.prepare(`
            SELECT id, name, username, bio, profile_picture_url as avatar, created_at 
            FROM users WHERE username = ? AND password_hash = ?
        `).get(username, password);

        if (!user) return res.status(401).json({ error: "Credenciais inválidas" });
        res.json(user);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/register', (req, res) => {
    const { name, username, password, bio, subjects } = req.body;
    try {
        const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
        if (existing) return res.status(400).json({ error: "Nome de usuário já está em uso" });

        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2ed573&color=fff`;

        let newUserId;
        db.transaction(() => {
            const result = db.prepare('INSERT INTO users (username, email, password_hash, name, bio, profile_picture_url) VALUES (?, ?, ?, ?, ?, ?)')
                            .run(username, `${username}@instituto.edu`, password, name, bio, avatar);
            newUserId = result.lastInsertRowid;
            
            if (subjects && subjects.length > 0) {
                const insertInterest = db.prepare('INSERT INTO user_interests (user_id, subject_id) VALUES (?, ?)');
                subjects.forEach(sid => insertInterest.run(newUserId, sid));
            }
        })();

        const user = db.prepare('SELECT id, name, username, bio, profile_picture_url as avatar, created_at FROM users WHERE id = ?').get(newUserId);
        res.json(user);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/subjects', (req, res) => {
    try {
        res.json(db.prepare('SELECT id, name FROM subjects').all());
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- REDE SOCIAL E GRAFOS (ENGINE PYTHON NATIVO) ---
app.get('/api/recommendations/:userId', (req, res) => {
    const targetUserId = parseInt(req.params.userId);
    
    // Injetando Engine Python Direta com Comunicação via SQLite Ativa
    const engineProcess = spawn('python', ['engine.py', targetUserId.toString()], { cwd: __dirname }); 
    let outputData = '';

    engineProcess.stdout.on('data', (data) => { outputData += data.toString(); });
    
    engineProcess.on('close', (code) => {
        try {
            const recommendations = JSON.parse(outputData);
            const followsDetails = db.prepare('SELECT follower_id, followed_id FROM followers').all();
            res.json({ recommendations, graphData: followsDetails });
        } catch (error) {
            res.status(500).json({ error: "Erro na decodificação JSON do Python", raw: outputData });
        }
    });
});

// --- FEED DE POSTS ESTREITO (C/ GRAFOS PYTHON) ---
app.get('/api/feed/strict', (req, res) => {
    const userId = parseInt(req.query.userId);
    const offset = parseInt(req.query.offset) || 0;
    const limit = 8;
    
    if (!userId || isNaN(userId)) return res.status(400).json({ error: "userId query param required" });

    // Node Server repassa a carga integral da Inteligência, Recomendação e Paginação para a Engine nativa
    const engineProcess = spawn('python', ['engine.py', 'feed', userId.toString(), limit.toString(), offset.toString()], { cwd: __dirname }); 
    let outputData = '';
    engineProcess.stdout.on('data', (data) => { outputData += data.toString(); });
    
    engineProcess.on('close', (code) => {
        try {
            let posts = JSON.parse(outputData);
            if (!Array.isArray(posts)) posts = [];
            res.json(posts);
        } catch(e) { 
            console.error("Python JSON break:", e, outputData);
            res.status(500).json({ error: "Python falhou em orquestrar feeds", details: e.message }); 
        }
    });
});

app.get('/api/feed/:userId', (req, res) => {
    try {
        const posts = db.prepare(`
            SELECT p.id, p.content, p.title, p.created_at, u.id as author_id, u.name as authorName, u.username as authorHandle, u.profile_picture_url as authorAvatar,
            s.name as subjectName,
            (SELECT COUNT(*) FROM likes WHERE publication_id = p.id) as likesCount,
            (SELECT COUNT(*) FROM comments WHERE publication_id = p.id) as commentsCount
            FROM publications p 
            JOIN users u ON p.user_id = u.id 
            LEFT JOIN subjects s ON p.subject_id = s.id
            WHERE p.user_id = ? ORDER BY p.id DESC
        `).all(req.params.userId);
        res.json(posts);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/feed', (req, res) => {
    const { user_id, content, title, subject_id } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO publications (user_id, content, title, subject_id) VALUES (?, ?, ?, ?)');
        const result = stmt.run(user_id, content, title || "Discussão Aberta", subject_id || null);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/posts/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        db.prepare('DELETE FROM publications WHERE id = ?').run(postId);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- VISÃO EXPANDIDA (FÓRUM/REDDIT) ---
app.get('/api/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });
    try {
        const post = db.prepare(`
            SELECT p.id, p.content, p.title, p.created_at, p.user_id as author_id, u.name as authorName, u.username as authorHandle, u.profile_picture_url as authorAvatar,
            s.name as subjectName,
            (SELECT COUNT(*) FROM likes WHERE publication_id = p.id) as likesCount,
            (SELECT COUNT(*) FROM comments WHERE publication_id = p.id) as commentsCount
            FROM publications p 
            JOIN users u ON p.user_id = u.id 
            LEFT JOIN subjects s ON p.subject_id = s.id
            WHERE p.id = ?
        `).get(postId);
        if (!post) return res.status(404).json({ error: "Post not found" });

        const comments = db.prepare(`
            SELECT c.id, c.content, c.created_at, u.name as authorName, u.username as authorHandle, u.profile_picture_url as authorAvatar, u.id as author_id
            FROM comments c JOIN users u ON c.user_id = u.id WHERE c.publication_id = ? ORDER BY c.id ASC
        `).all(postId);

        res.json({ post, comments });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/like', (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = parseInt(req.body.userId);
    if (isNaN(postId) || isNaN(userId)) return res.status(400).json({ error: "Invalid IDs" });
    
    try {
        const exists = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND publication_id = ?').get(userId, postId);
        if (exists) {
            db.prepare('DELETE FROM likes WHERE user_id = ? AND publication_id = ?').run(userId, postId);
            res.json({ liked: false });
        } else {
            db.prepare('INSERT INTO likes (user_id, publication_id) VALUES (?, ?)').run(userId, postId);
            res.json({ liked: true });
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = parseInt(req.body.userId);
    if (isNaN(postId) || isNaN(userId)) return res.status(400).json({ error: "Invalid IDs" });
    try {
        db.prepare('INSERT INTO comments (user_id, publication_id, content) VALUES (?, ?, ?)').run(userId, postId, req.body.content);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/posts/:id/has-liked/:userId', (req, res) => {
    try {
        const liked = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND publication_id = ?').get(parseInt(req.params.userId), parseInt(req.params.id));
        res.json({ hasLiked: !!liked });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- PERFIS E NAVEGAÇÃO DE REDE REAL ---
app.get('/api/users', (req, res) => {
    try {
        res.json(db.prepare('SELECT id, name FROM users').all());
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    try {
        const user = db.prepare(`
            SELECT id, name, username, bio, profile_picture_url, created_at,
            (SELECT COUNT(*) FROM followers WHERE follower_id = users.id) as followingCount,
            (SELECT COUNT(*) FROM followers WHERE followed_id = users.id) as followersCount
            FROM users WHERE id = ?
        `).get(userId);
        
        if (!user) return res.status(404).json({ error: "User not found" });
        
        const interests = db.prepare(`
            SELECT s.name FROM user_interests ui JOIN subjects s ON ui.subject_id = s.id WHERE ui.user_id = ?
        `).all(userId).map(i => i.name);
        
        res.json({ ...user, interests });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/followers', (req, res) => {
    const viewerId = req.query.viewerId ? parseInt(req.query.viewerId) : -1;
    try {
        const followers = db.prepare(`
            SELECT u.id, u.name, u.username, u.profile_picture_url as avatar,
            EXISTS(SELECT 1 FROM followers fw WHERE fw.follower_id = ? AND fw.followed_id = u.id) as isFollowedByViewer
            FROM followers f JOIN users u ON f.follower_id = u.id WHERE f.followed_id = ?
        `).all(viewerId, req.params.id);
        res.json(followers);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/following', (req, res) => {
    try {
        const following = db.prepare(`
            SELECT u.id, u.name, u.username, u.profile_picture_url as avatar
            FROM followers f JOIN users u ON f.followed_id = u.id WHERE f.follower_id = ?
        `).all(req.params.id);
        res.json(following);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/is-following/:targetId', (req, res) => {
    const { id, targetId } = req.params;
    try {
        const rel = db.prepare('SELECT 1 FROM followers WHERE follower_id = ? AND followed_id = ?').get(id, targetId);
        res.json({ isFollowing: !!rel });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/follow', (req, res) => {
    const { followerId } = req.body;
    const targetId = req.params.id;
    try {
        if(parseInt(followerId) === parseInt(targetId)) return res.status(400).json({error: "Self-follow not allowed na arquitetura de rede real."});
        
        const existing = db.prepare('SELECT 1 FROM followers WHERE follower_id = ? AND followed_id = ?').get(followerId, targetId);
        
        if (existing) {
            db.prepare('DELETE FROM followers WHERE follower_id = ? AND followed_id = ?').run(followerId, targetId);
            res.json({ following: false });
        } else {
            db.prepare('INSERT INTO followers (follower_id, followed_id) VALUES (?, ?)').run(followerId, targetId);
            res.json({ following: true });
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/remove-follower', (req, res) => {
    const { followerId } = req.body;
    const targetId = req.params.id;
    try {
        db.prepare('DELETE FROM followers WHERE follower_id = ? AND followed_id = ?').run(followerId, targetId);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`API Backend rodando nativamente na porta ${PORT}`);
});
