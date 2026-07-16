# Guia de Utilização — DC Gerenciador de Permissões

Este guia explica detalhadamente como colocar a aplicação para rodar, configurar os agentes locais nos servidores Windows e realizar a sincronização de usuários e pastas no portal.

---

## 1. Arquitetura do Sistema

O sistema agora opera no modelo de **Agente-Coletor** para maior segurança e otimização:
*   **Servidor BI (`192.168.13.249`)**: Hospeda o painel visual (Frontend Angular e API Express). Ele lê tudo diretamente de um banco de dados local SQLite (`db.sqlite`).
*   **Servidores Windows (Ex: `192.168.1.12`)**: Cada servidor monitorado executa uma instância do **DC Manager Agent** (um serviço leve em Node.js). O Agente roda scripts locais do PowerShell para ler o Active Directory (NTDS) e as ACLs das pastas locais e expõe esses dados de forma segura.

---

## 2. Passo a Passo de Configuração

### Passo 2.1: Instalação do Agente no Servidor de Destino

Execute estas etapas no servidor Windows de onde você deseja coletar as pastas e usuários (Ex: `192.168.1.12`):

1.  **Copie a pasta `agent`** do projeto para este servidor (ex: salve em `C:\dc-agent`).
2.  Certifique-se de que o **Node.js** está instalado no servidor.
3.  Abra o **PowerShell** ou **Prompt de Comando** como **Administrador** e navegue até a pasta do agente:
    ```cmd
    cd C:\dc-agent
    ```
4.  Instale as dependências necessárias:
    ```cmd
    npm install
    ```
5.  Inicie o agente para testar:
    ```cmd
    npm start
    ```
    *O console exibirá que o agente está rodando na porta `3001`.*

#### Liberar Porta no Firewall
Para permitir que o Servidor BI consulte o agente, execute o seguinte comando no PowerShell do servidor monitorado (como Administrador) para abrir a porta `3001`:
```powershell
New-NetFirewallRule -DisplayName "DC Manager Agent" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001
```

---

### Passo 2.2: Cadastrar o Servidor no Painel (BI)

Com o agente rodando no servidor monitorado, acesse o portal do DC Manager:

1.  Acesse a aba **Servidores**.
2.  Clique no botão **Adicionar Servidor**.
3.  Preencha os campos do formulário:
    *   **Nome**: Um nome de identificação amigável (Ex: `Servidor de Arquivos P&G`).
    *   **IP / Hostname**: O endereço IP do servidor monitorado (Ex: `192.168.1.12`).
    *   **Porta do Agente**: A porta configurada no agente (padrão: `3001`).
    *   **Token de Sincronização**: O token de segurança configurado no agente (padrão: `dc_manager_secret_token`).
    *   **Pasta Raiz**: A pasta local no servidor de arquivos que você quer ler.
        *   Para ler o disco `D:\` inteiro: digite `D:\` ou `D:`.
        *   Para ler uma pasta específica no D: digite `D:\Dados`.
        *   Deixe em branco para ler o disco `C:\` completo.
4.  Clique em **Salvar Alterações**. O sistema fará um teste de conexão em tempo real com o agente. Se o teste passar, o servidor será salvo com sucesso.

---

## 3. Sincronização de Dados

*   **Sincronização Automática (Cron)**: O servidor do BI possui um agendador interno (Cron Job) que roda **todos os dias à meia-noite (00:00)**. Ele consulta automaticamente todos os agentes cadastrados, limpa os dados antigos correspondentes no SQLite e grava as informações atualizadas.
*   **Sincronização Manual**: No card de cada servidor na aba **Servidores**, você encontrará o botão **Sincronizar**. Clique nele a qualquer momento para forçar o coletor a ler as informações atualizadas em tempo real.

---

## 4. Visualização de Dados (Somente Leitura)

O portal é um painel otimizado de visualização:
*   **Painel de Usuários**: Lista todos os usuários coletados dos servidores (via Active Directory / LDAP local). Você pode filtrar por servidor no topo da página ou pesquisar pelo nome/username.
*   **Pastas & Permissões**: Apresenta a árvore de diretórios coletada. Ao clicar em qualquer pasta, o painel à direita exibe instantaneamente quais usuários ou grupos têm acesso de Leitura (Read) ou Escrita (Write) com base nas ACLs reais do Windows.

---

## 5. Dicas Extras para Produção

### Rodar o Agente como Serviço do Windows (Auto-start)
Para garantir que o agente inicie sozinho caso o servidor seja reiniciado, configure-o como um Serviço do Windows:

1.  No servidor de destino, abra o CMD como Administrador e instale o pacote global `qckwinsvc`:
    ```cmd
    npm install -g qckwinsvc
    ```
2.  Na pasta `agent`, execute o configurador do serviço:
    ```cmd
    qckwinsvc
    ```
3.  Preencha as perguntas solicitadas:
    *   *Service name*: `dc-manager-agent`
    *   *Service description*: `Coletor local do DC Gerenciador de Permissoes`
    *   *Node script path*: Caminho absoluto do `index.js` (Ex: `C:\dc-agent\index.js`)
4.  O serviço será criado e configurado para iniciar automaticamente junto com o Windows.

### Alterar o Token de Segurança
Para alterar o token padrão `dc_manager_secret_token` para uma chave de sua preferência:
1.  No arquivo `agent/index.js`, altere a variável `SYNC_TOKEN` ou defina a variável de ambiente `SYNC_TOKEN` no servidor de destino.
2.  No painel do BI, edite o cadastro do servidor correspondente informando a nova chave no campo **Token de Sincronização**.
