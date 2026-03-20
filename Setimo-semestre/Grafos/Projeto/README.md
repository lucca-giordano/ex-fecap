## 🛠️ Tecnologias
- **Frontend:** `React 18`, `Vite`, e `React Router DOM`
- **Backend:** `Node.js`
- **Graph Engine:** `Python 3`
- **Data Persistence:** `SQLite`

## ⚙️ Instalação
Esta infraestrutura exige `Node.js v18+` e `Python 3.9+` instalados nativamente na máquina.

### 1. Clonagem e Dependências
Na raiz desse repositório, abra terminais em janelas isoladas (Powershell / Bash).
```bash
# A. Dependências do Frontend
cd frontend
npm install

# B. Dependências do Backend
cd backend
npm install
```


## 🚀 Execução

Abra **dois Terminais paralelos**.

**Terminal 1 (Backend - Porta 3001)**
```bash
cd backend
node server.js
```


**Terminal 2**
```bash
cd frontend
npm run dev
```

Abra o seu navegador no endereço indicado no terminal