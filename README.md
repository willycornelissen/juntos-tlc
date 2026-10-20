# Juntos.

**Juntos** é uma aplicação web estática (SPA em **React 19 + Vite + TypeScript**) projetada para ser hospedada no **GitHub Pages** e integrada ao **Firebase (Authentication + Cloud Firestore)**. Ela permite que professores façam o acompanhamento longitudinal das suas turmas e da ficha particular de cada aluno a partir da importação periódica das planilhas de chamada (`.xlsx`).

---

## Principais Funcionalidades

- **Importação de Planilhas de Chamada (`.xlsx`):**
  - Lê diretamente no navegador (via SheetJS) o formato padrão da aba `chamada` (ex.: `Turma Pampulha QUA.xlsx`), extraindo sugestão de cidade (`A1`), nome da turma (`A2`), curso (`G2+`), tema da aula (`G3+`), instrutor (`G4+`), datas (`G6+`) e alunos (`Linhas 7+`).
  - Calcula automaticamente **`% Trim`** (9 aulas mais recentes) e **`% Ano`** (todas as aulas) usando a mesma regra da planilha: $\text{round}\left(100 \times \frac{P + A + R}{P + A + R + F + J}\right)$.
- **Reimportação Inteligente e Baixa Automática de Inscrição:**
  - Exibe uma **pré-visualização do diff** antes de confirmar a reimportação (novas datas de aula, novos alunos matriculados, alunos ausentes e reativações).
  - Quando um aluno ativo deixa de constar em uma nova planilha importada, seu status passa automaticamente para **`Inscrição Baixada`** (preservando todo o histórico de presenças anteriores) e sua ficha recebe um comentário automático datado (`"Inscrição baixada: aluno não consta na planilha importada em DD/MM/AAAA."`), sem duplicar o aviso em importações futuras.
- **Ficha Particular do Aluno:**
  - Painel individual para cada aluno com indicadores de presença (`% Trim`, `% Ano`, contagem de `P`, `A`, `R`, `F`, `J`), tabela detalhada por aula (data, curso, tema e instrutor) e **linha do tempo de comentários** (eventos do sistema + observações pedagógicas do professor).
- **Gestão e Encerramento de Turmas:**
  - Edição de metadados da turma (nome, dia/horário, local e cátedras), comentários gerais na turma e fluxo para marcar a turma como **Encerrada** (bloqueando reimportações acidentais até que seja reaberta).
- **Modo Local / Demonstração Automático:**
  - Se as variáveis `VITE_FIREBASE_*` não estiverem configuradas, o aplicativo funciona automaticamente com persistência em `localStorage`, incluindo um botão para carregar a planilha de exemplo `Turma Pampulha (QUA)` com 1 clique.

---

## 1. Pré-requisitos

- **Node.js** `>= 20.x` e **npm** `>= 10.x`
- Uma conta no [Firebase Console](https://console.firebase.google.com/) (necessária apenas para persistência em nuvem; para testes locais o app roda sem configuração externa).

---

## 2. Como Rodar Localmente

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **(Opcional) Configure as variáveis de ambiente do Firebase:**
   Copie o arquivo `.env.example` para `.env.local` e preencha os dados do seu projeto Firebase:
   ```bash
   cp .env.example .env.local
   ```
   > **Dica:** Se você **não** criar o `.env.local` (ou deixar as variáveis em branco), o **Juntos** iniciará automaticamente em **Modo Demonstração Local** (`localStorage`). Nesse modo, você pode entrar com qualquer e-mail válido e senha de pelo menos 6 caracteres (ex.: `professor@escola.org` / `123456`) e testar todo o fluxo imediatamente.

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Abra o endereço exibido no terminal (geralmente `http://localhost:5173`).

4. **Execute a suíte de testes automatizados:**
   ```bash
   npm run test:run
   ```

5. **Gere e teste o build de produção localmente:**
   ```bash
   npm run build
   npm run preview
   ```

---

## 3. Configuração do Firebase (Produção)

Para usar autenticação real e sincronizar seus dados na nuvem com o Firebase (mesma arquitetura do `estante.willy.dev.br`):

### Passo 3.1 — Criar o projeto e o Web App no Firebase
1. Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto (ou utilize um projeto existente).
2. Em **Visão geral do projeto**, clique em **Adicionar app** → escolha **Web (`</>`)**, dê o apelido `juntos` e copie o objeto `firebaseConfig`.
3. Preencha os valores no seu `.env.local` (ou nos *Secrets* do GitHub):
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=seu-projeto
   VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
   ```

### Passo 3.2 — Ativar o Firebase Authentication
1. No menu lateral do Firebase Console, acesse **Build → Authentication → Sign-in method**.
2. Habilite o provedor **E-mail/senha** (*Email/Password*).
3. Na aba **Users**, clique em **Adicionar usuário** e cadastre o e-mail e a senha do professor.
4. Na aba **Settings → Authorized domains**, adicione o domínio onde o site ficará hospedado (ex.: `seu-usuario.github.io` ou seu domínio próprio como `juntos.willy.dev.br`).

### Passo 3.3 — Criar o banco Cloud Firestore e Configurar as Regras de Segurança
1. No menu lateral, acesse **Build → Firestore Database** e clique em **Criar banco de dados**.
2. Na aba **Regras (Rules)** do Firestore, publique a regra abaixo para garantir que cada professor autenticado acesse exclusivamente suas próprias turmas e fichas de alunos:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 4. Estrutura de Dados no Firestore

Os dados são armazenados de forma isolada sob o `uid` do professor autenticado:

```text
users/{uid}/
└── turmas/{turmaId}                  # Documento da Turma (nome, diaHorario, local, catedras[], status, lessons[], comentarios[])
    └── alunos/{studentKey}           # Subcoleção de Fichas de Alunos (externalId, nome, status, presencas{}, comentarios[])
```

---

## 5. Formato Esperado da Planilha Excel (`.xlsx`)

O parser lê a aba **`chamada`** (ou a primeira aba da planilha) seguindo o modelo `Turma Pampulha QUA.xlsx`:

| Linha / Célula | Conteúdo Esperado |
| :--- | :--- |
| **`A1`** | Cidade / Filial (usada como sugestão de *Local* na criação da turma) |
| **`A2`** | Nome da turma na planilha (usado como sugestão de *Nome da Turma*) |
| **`G2` em diante** | Nome do curso de cada aula (ex.: `Filosofia para viver`) |
| **`G3` em diante** | **Tema** ministrado na aula (`A3 = "Tema"`) |
| **`G4` em diante** | **Instrutor** da aula (`A4 = "Instrutores"`) |
| **Linha 6 (Cabeçalho)** | `A6 = ID`, `B6 = nº`, `C6 = Nome`, `D6 = Status`, `E6 = % Trim`, `F6 = % Ano`, `G6+ = Datas (DD/MM/AA ou DD/MM/AAAA)` |
| **Linhas 7+ (Alunos)** | `Coluna A` = ID único do aluno, `Coluna C` = Nome, `Coluna D` = Status, `Colunas G+` = Códigos de presença (`P`, `A`, `R`, `F`, `J`) |

- **Códigos contabilizados como presença:** `P` (Presente), `A` (Atraso/Assistida), `R` (Reposição).
- **Códigos contabilizados como falta:** `F` (Falta), `J` (Falta Justificada).

---

## 6. Deploy no GitHub Pages

O `vite.config.ts` já está configurado com `base: './'`, permitindo que o build funcione tanto em subcaminhos (`https://usuario.github.io/juntos/`) quanto em domínios customizados (`https://juntos.willy.dev.br/`).

### Passos para configurar o GitHub Actions:
1. No repositório do GitHub, vá em **Settings → Secrets and variables → Actions** e cadastre os *Repository secrets*:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
2. Em **Settings → Pages**, em *Build and deployment*, selecione **Source: GitHub Actions**.
3. Crie um workflow `.github/workflows/deploy.yml` que execute `npm ci && npm run build` injetando as variáveis `VITE_FIREBASE_*` e publique a pasta `./dist` usando `actions/deploy-pages@v4`.
