const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('Restaurando banco de dados MASSIVO da Rede Acadêmica...');

db.exec(`
    PRAGMA foreign_keys = ON;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS likes;
    DROP TABLE IF EXISTS publications;
    DROP TABLE IF EXISTS followers;
    DROP TABLE IF EXISTS user_interests;
    DROP TABLE IF EXISTS subjects;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        bio TEXT,
        profile_picture_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE user_interests (
        user_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, subject_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE followers (
        follower_id INTEGER NOT NULL,
        followed_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_id, followed_id),
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE publications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
    );

    CREATE TABLE likes (
        user_id INTEGER NOT NULL,
        publication_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, publication_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE
    );

    CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        publication_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE
    );
`);

const rawNames = "Lucca Giordano, Vitor Locateli, Beatriz Ferreira, Lara Marina, Gustavo Marcello, João Trencher, Alan Souza, Arthur Medeiros, Bernardo Ramos, Caio Castro, Carlos Henrique, Daniel Farias, Davi Lucca, Diego Araújo, Eduardo Camargo, Enzo Gabriel, Felipe Dornelles, Fernando Pessoa, Gabriel Martins, Gael Fontes, Guilherme Farias, Gustavo Lima, Heitor Viana, Henrique Costa, Ian Cardoso, Igor Santana, João Pedro, Jorge Paiva, Lucas Moreira, Luís Otávio, Marcelo Silva, Marcos Paulo, Mateus Rocha, Miguel Soares, Nathan Alves, Noah Tavares, Paulo Ricardo, Pedro Henrique, Rafael Santos, Ravi Silva, Ricardo Mendes, Rodrigo Faro, Samuel Oliveira, Théo Ribeiro, Thiago Lopes, Vitor Hugo, William Souza, Yuri Farias, Alexandre Dias, Bruno Diniz, Carlos Eduardo, Diogo Pereira, Eduardo Costa, Fabio Junior, Guilherme Dias, Hugo Oliveira, Alice Borges, Ana Clara, Aurora Mendes, Beatriz Viana, Bianca Nunes, Camila Farias, Carolina Dias, Cecília Costa, Clara Souza, Daniela Santos, Eduarda Martins, Elisa Ramos, Eva Rodrigues, Fernanda Lima, Gabriela Paiva, Giovanna Rocha, Helena Maria, Isabella Nunes, Júlia Moreira, Kauane Dias, Larissa Silva, Letícia Alves, Luna Rodrigues, Maitê Costa, Manuela Viana, Maria Alice, Maria Cecília, Maria Clara, Maria Júlia, Mariana Soares, Marina Ferreira, Nicole Alves, Olívia Nunes, Pandora Rocha, Rafaela Farias, Raquel Tavares, Rúbia Mendes, Sophia Martins, Sophia Viana, Valentina Rocha, Ana Júlia, Beatriz Alves, Camila Rocha, Daniela Lima, Eduarda Moreira, Fernanda Farias, Gabriela Tavares, Helena Dias, Isabella Silva, Júlia Rodrigues";

const names = rawNames.split(',').map(n => n.trim()).filter(n => n);
console.log('Total de usuários:', names.length);

const subjects = [
    'Álgebra', 'Geometria', 'Física', 'Química', 
    'História', 'Geografia', 'Biologia', 'Filosofia', 'Sociologia'
];

const insertSubject = db.prepare('INSERT INTO subjects (name) VALUES (?)');
subjects.forEach(s => insertSubject.run(s));

const insertUser = db.prepare("INSERT INTO users (username, email, password_hash, name, bio, profile_picture_url) VALUES (?, ?, '123456', ?, ?, ?)");
const insertInterest = db.prepare("INSERT INTO user_interests (user_id, subject_id) VALUES (?, ?)");
const insertPost = db.prepare("INSERT INTO publications (user_id, subject_id, title, content) VALUES (?, ?, ?, ?)");
const insertFollow = db.prepare("INSERT INTO followers (follower_id, followed_id) VALUES (?, ?)");

const bios = [
   "Estudante focado em melhorar.", "Adoro compartilhar teorias abstratas.", 
   "Sempre lendo um bom artigo.", "Pesquisador iniciante.", 
   "Tentando sobreviver ao TCC.", "Amo exatas e café.", 
   "Se não compilar, tem bug.", "Humanas é a base de tudo.", 
   "Grafos são fascinantes.", "Pronto para os exames."
];

const postContents = [
    "<p>Acredito que a correlação abordada neste semestre redefiniu minha visão acadêmica.</p>",
    "<p>Alguém tem referências sólidas sobre a ontologia deste campo de pesquisa?</p>",
    "<p>Deixo aqui meu fichamento do último capítulo. A complexidade algorítmica é fenomenal!</p>",
    "<p>Revisando meus mapas mentais para o teste da próxima semana.</p>",
    "<p>É interessante notar como paradigmas antigos ainda sobrevivem em métodos modernos.</p>",
    "<p>Proponho um debate sobre as falhas no atual modelo teórico. Alguém disponível?</p>"
];

db.transaction(() => {
    // 1. INSERIR USUÁRIOS E INTERESSES E POSTS
    names.forEach((name, i) => {
        const username = name.toLowerCase().replace(/ /g, '_');
        const email = `${username}@instituto.edu`;
        const bio = bios[i % bios.length];
        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2ed573&color=fff`;
        
        insertUser.run(username, email, name, bio, avatar);
        const userId = i + 1;

        // 1 ou 2 interesses aleatórios
        const subjectIndexes = [];
        subjectIndexes.push(Math.floor(Math.random() * subjects.length) + 1);
        if(Math.random() > 0.5) {
            let s2 = Math.floor(Math.random() * subjects.length) + 1;
            if(s2 !== subjectIndexes[0]) subjectIndexes.push(s2);
        }

        subjectIndexes.forEach(sid => {
            insertInterest.run(userId, sid);
        });

        // 1 Post Aleatório
        const randomSubj = subjectIndexes[Math.floor(Math.random() * subjectIndexes.length)];
        const title = `Considerações sobre ${subjects[randomSubj-1]}`;
        const content = postContents[Math.floor(Math.random() * postContents.length)];
        insertPost.run(userId, randomSubj, title, content);
    });

    // 2. CRIAR TOPOLOGIA: BOLHAS E ILHAS
    const total = names.length;
    // Island indices (the last 15 users won't follow and won't be followed inside the loop, basically isolated)
    const islandCount = 15;
    const bubbleUsers = total - islandCount; 

    // Dividimos os primeiros 'bubbleUsers' em 8 clusters
    const numClusters = 8;
    const clusterSize = Math.floor(bubbleUsers / numClusters);

    for (let c = 0; c < numClusters; c++) {
        const startId = c * clusterSize + 1;
        const endId = (c === numClusters - 1) ? bubbleUsers : (startId + clusterSize - 1);
        
        // Conexões Densas (Grafo intra-cluster)
        for (let u = startId; u <= endId; u++) {
            for (let v = startId; v <= endId; v++) {
                if (u !== v && Math.random() < 0.65) {
                    insertFollow.run(u, v);
                }
            }
        }

        // Conexões Esparsas (Grafo inter-cluster)
        // 2% de probabilidade de conectar pessoas entre bolhas
        for (let u = startId; u <= endId; u++) {
            for (let v = 1; v <= bubbleUsers; v++) {
                if (v < startId || v > endId) {
                    if (Math.random() < 0.02) {
                        insertFollow.run(u, v);
                    }
                }
            }
        }
    }

    // Lucca Giordano tem ID 1, logo pertence ao Cluster 0. Tem várias conexões garantidas lá.
})();

console.log('Seed Topológico Concluído! Bolhas, Ilhas e Banco Limpo gerados com Sucesso.');
