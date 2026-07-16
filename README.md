<h1 align="center">
  <img src="https://img.shields.io/badge/DC-Gerenciador%20de%20Permissões-6C63FF?style=for-the-badge&logo=windows&logoColor=white" alt="DC Gerenciador de Permissões" />
</h1>

<p align="center">
  <strong>Sistema web completo para gerenciamento centralizado de usuários, grupos e permissões de pastas em servidores Windows</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-22-DD0031?style=flat-square&logo=angular&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?style=flat-square&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/PowerShell-AD%20Integration-5391FE?style=flat-square&logo=powershell&logoColor=white" />
  <img src="https://img.shields.io/badge/Design-Dark%20Mode%20Premium-1A1A2E?style=flat-square&logo=css3&logoColor=white" />
</p>

---

## 📋 Sobre o Projeto

O **DC — Gerenciador de Permissões** é uma plataforma web desenvolvida para simplificar e centralizar a administração de acessos em ambientes Windows com múltiplos servidores de arquivos.

### ❓ Qual problema resolve?

Em ambientes corporativos com Active Directory ou servidores de arquivo Windows, gerenciar **quem tem acesso a qual pasta** costuma ser uma tarefa manual, lenta e propensa a erros — feita diretamente no servidor, pasta por pasta.

Esta ferramenta resolve isso com uma interface web moderna que permite:

- ✅ Visualizar toda a **árvore de pastas** e permissões de um servidor num único lugar
- ✅ Gerenciar **usuários e grupos** sem precisar entrar no servidor
- ✅ **Sincronizar automaticamente** as permissões reais via Agente instalado no servidor
- ✅ **Exportar relatórios** de permissões em CSV ou PDF
- ✅ Suportar **múltiplos servidores** gerenciados de forma centralizada

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR (USUÁRIO)                  │
│              Angular 22 — Dark Mode Premium             │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / REST
┌────────────────────────▼────────────────────────────────┐
│                  BACKEND (Node.js + Express)             │
│              API REST  •  SQLite  •  JWT Auth            │
└───────────┬────────────────────────┬────────────────────┘
            │ HTTP (Agente)          │ HTTP (Agente)
┌───────────▼────────┐   ┌──────────▼────────────────────┐
│   SERVIDOR WINDOWS │   │        SERVIDOR WINDOWS        │
│   DC Manager Agent │   │       DC Manager Agent         │
│  (PowerShell + ACL)│   │     (PowerShell + ACL)         │
└────────────────────┘   └───────────────────────────────┘
```

O **Agente** é um serviço Node.js leve instalado em cada servidor que:
- Executa scripts PowerShell localmente para ler usuários (Active Directory ou SAM local), grupos e ACLs de pastas
- Expõe uma API REST protegida por token
- É invocado pelo Backend para sincronizar dados em segundo plano

---

## ✨ Funcionalidades

### 🖥️ Servidores
- Cadastro de múltiplos servidores Windows
- Teste de conectividade com o Agente antes de salvar
- Sincronização automática e manual de dados
- Status de sincronização em tempo real
- Exclusão em cascata (remove usuários, grupos, pastas e permissões vinculadas)

### 👥 Usuários
- Listagem de todos os usuários sincronizados dos servidores
- Visualização de grupos aos quais pertencem
- Indicadores de status (ativo / inativo)
- Filtro e busca por nome, username ou e-mail

### 🗂️ Grupos
- Gerenciamento de grupos de usuários por servidor
- Visualização de membros de cada grupo
- Adição e remoção de membros

### 📁 Pastas & Permissões
- Visualização em **árvore hierárquica** de pastas dos servidores
- Permissões detalhadas por usuário e grupo (leitura / escrita)
- Suporte a herança de permissões
- Exportação de relatórios em CSV e PDF

---

## 🚀 Como Iniciar

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Angular CLI](https://angular.io/cli) 22+
- Servidores Windows (para o Agente) — opcional para testes locais

### 1. Backend (API)

```bash
cd backend
npm install

# Iniciar em produção
npm start          # http://localhost:3010

# Iniciar com hot-reload (desenvolvimento)
npm run dev
```

### 2. Frontend (Angular)

```bash
cd frontend
npm install
npm start          # http://localhost:4200
```

### 3. Agente (nos servidores Windows)

```bash
cd agent
npm install
node index.js      # http://0.0.0.0:3050
```

> 💡 O Agente deve ser instalado **em cada servidor Windows** que deseja monitorar. Ele usa PowerShell para ler usuários do Active Directory (ou SAM local) e ACLs de pastas.

---

## 📁 Estrutura do Projeto

```
DC --- Gerenciador de permissões/
│
├── 📂 backend/                     # API REST (Node.js + Express)
│   └── src/
│       ├── server.js               # Entry point — Express + CORS + rotas
│       ├── routes/
│       │   ├── servers.js          # CRUD de servidores + sync trigger
│       │   ├── users.js            # CRUD de usuários
│       │   ├── groups.js           # CRUD de grupos + membros
│       │   └── folders.js          # Árvore de pastas + permissões
│       ├── middleware/
│       │   └── auth.js             # Middleware JWT (bypass mode por padrão)
│       └── utils/
│           ├── db.js               # SQLite — schema + helpers (run/all/get)
│           └── sync-manager.js     # Orquestra sincronização com o Agente
│
├── 📂 agent/                       # Agente leve instalado em cada servidor
│   └── index.js                    # Express + PowerShell (AD/SAM + ACLs)
│
└── 📂 frontend/                    # SPA Angular 22
    └── src/app/
        ├── core/                   # Guards, Interceptors, Services, Models
        ├── features/
        │   ├── servers/            # Tela de gerenciamento de servidores
        │   ├── users/              # Tela de usuários
        │   ├── folders/            # Tela de pastas e permissões
        │   └── dashboard/          # Painel principal
        ├── shared/                 # Componentes reutilizáveis (Sidebar, Header…)
        └── layout/                 # Shell/layout principal da aplicação
```

---

## 🔌 API Endpoints

### Servidores
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/servers` | Listar todos os servidores |
| `GET` | `/api/servers/:id` | Obter servidor por ID |
| `POST` | `/api/servers` | Cadastrar servidor (testa conexão com Agente) |
| `PUT` | `/api/servers/:id` | Editar servidor |
| `DELETE` | `/api/servers/:id` | Remover servidor e todos os dados vinculados |
| `POST` | `/api/servers/:id/sync` | Disparar sincronização em background |

### Usuários
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/users` | Listar usuários (com filtros) |
| `GET` | `/api/users/:id` | Obter usuário |
| `POST` | `/api/users` | Criar usuário |
| `PUT` | `/api/users/:id` | Editar usuário |
| `DELETE` | `/api/users/:id` | Remover usuário |

### Grupos
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/groups` | Listar grupos |
| `POST` | `/api/groups` | Criar grupo |
| `POST` | `/api/groups/:id/members` | Adicionar membro |
| `DELETE` | `/api/groups/:id/members/:userId` | Remover membro |

### Pastas & Permissões
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/folders` | Árvore de pastas por servidor |
| `GET` | `/api/folders/permissions` | Listar todas as permissões |
| `POST` | `/api/folders/permissions` | Criar / atualizar permissão |
| `DELETE` | `/api/folders/permissions/:id` | Remover permissão |

### Health
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Status da API |

---

## 🔒 Autenticação

A autenticação JWT está **implementada mas desativada por padrão** (bypass mode), ideal para uso em rede interna/intranet.

### Ativar no Backend

```bash
AUTH_ENABLED=true JWT_SECRET=seu-segredo-aqui npm start
```

### Ativar no Frontend

Em `src/app/core/guards/auth.guard.ts` e `src/app/core/interceptors/auth.interceptor.ts`:
```typescript
const AUTH_BYPASS = false; // mude para false
```

O interceptor injetará automaticamente o header:
```
Authorization: Bearer <token>
```

---

## ⚙️ Variáveis de Ambiente

### Backend

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3010` | Porta da API |
| `HOST` | `0.0.0.0` | Host de escuta |
| `AUTH_ENABLED` | `false` | Ativar validação JWT |
| `JWT_SECRET` | `dc-gerenciador-secret-key` | Chave secreta JWT |

### Agente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3050` | Porta do Agente |
| `SYNC_TOKEN` | `dc_manager_secret_token` | Token de autenticação |

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Angular 22, TypeScript 5, SCSS, RxJS |
| **Backend** | Node.js, Express 4, JWT, node-cron |
| **Banco de Dados** | SQLite (via sqlite3) |
| **Agente** | Node.js, PowerShell (AD/SAM, ACLs), SSH2 |
| **Design** | Dark Mode Premium, CSS Custom Properties |
| **IDs únicos** | UUID v4 |

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<p align="center">
  Feito com ☕ e muito PowerShell por <a href="https://github.com/jcdocebrinquedo">jcdocebrinquedo</a>
</p>
