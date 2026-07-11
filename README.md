# Painel de Estudos

Site pessoal para planejamento e controle de estudos para concursos: dashboard, concursos, matérias, ciclo de estudos, cronograma, registro de estudos, revisões automáticas, questões, relatórios e simulados.

## Como funciona o acesso

Agora o painel tem **login por e-mail** (sem senha — você recebe um link de acesso) e os dados ficam salvos num banco de dados na nuvem (Supabase), não mais só no navegador. Isso quer dizer:

- ✅ Acesso de qualquer navegador ou dispositivo, com o mesmo e-mail.
- ✅ Não some se você limpar os dados do navegador.
- ✅ Cada pessoa só vê os próprios dados (mesmo que várias pessoas usem o mesmo site).
- O Supabase tem plano gratuito bem generoso para esse uso (uma pessoa ou poucas usando o painel).

Se você já tinha usado a versão anterior (só no navegador), na primeira vez que entrar logado o site detecta esses dados antigos e oferece importá-los para a sua conta.

---

## Passo 1 — Criar seu banco de dados (Supabase)

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e clique em "New project".
2. Dê um nome ao projeto e uma senha de banco de dados (guarde essa senha, mas ela não é usada no dia a dia — é só para acesso administrativo direto ao banco).
3. Espere o projeto terminar de ser criado (leva cerca de 1-2 minutos).
4. No menu lateral, vá em **SQL Editor** → **New query**, cole todo o conteúdo do arquivo `supabase_setup.sql` (incluído neste projeto) e clique em **Run**. Isso cria a tabela onde os dados ficam guardados, já configurada para que cada pessoa só acesse os próprios dados.
5. Vá em **Settings → API**. Você vai precisar de dois valores desta página:
   - **Project URL**
   - **anon public key** (a chave pública — não é a `service_role`, essa nunca deve ser usada no site)

### Configurar o link de login por e-mail

Ainda nas configurações do projeto, vá em **Authentication → URL Configuration** e defina:
- **Site URL**: a URL do seu site publicado (ex: `https://painel-estudos-seu-usuario.vercel.app`). Enquanto ainda não publicou, pode deixar `http://localhost:5173`.
- **Redirect URLs**: adicione tanto a URL de produção quanto `http://localhost:5173` (para poder testar localmente depois).

Você pode voltar aqui e atualizar a **Site URL** depois que publicar na Vercel (passo 3).

---

## Passo 2 — Configurar o projeto com suas chaves

Dentro da pasta do projeto, copie o arquivo `.env.example` para um novo arquivo chamado `.env`, e preencha com os valores que você pegou no Passo 1:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

Esse arquivo `.env` é só para uso local — ele não é enviado para o GitHub (o `.gitignore` já cuida disso). Ao publicar na Vercel, você vai colar esses mesmos dois valores lá (passo 3).

---

## Passo 3 — Publicar o site

**1. Crie uma conta no GitHub** (se ainda não tiver): [github.com/signup](https://github.com/signup)

**2. Crie um novo repositório** e envie todos os arquivos deste projeto (incluindo `supabase_setup.sql`, mas **sem** o arquivo `.env` — ele não deve ir para o GitHub, já que tem suas chaves).
   - Na página do repositório, clique em "uploading an existing file" e arraste os arquivos/pastas mantendo a estrutura (`src/` como pasta, etc.)

**3. Crie uma conta na Vercel:** [vercel.com/signup](https://vercel.com/signup) — escolha "Continue with GitHub".

**4. Importe o projeto:**
   - "Add New" → "Project" → selecione seu repositório
   - **Antes de clicar em Deploy**, abra a seção "Environment Variables" e adicione as duas variáveis:
     - `VITE_SUPABASE_URL` → cole a Project URL do Supabase
     - `VITE_SUPABASE_ANON_KEY` → cole a anon public key do Supabase
   - Clique em "Deploy"

Em cerca de 1 minuto você recebe uma URL tipo `painel-estudos-seu-usuario.vercel.app`.

**5. Volte ao Supabase** (Authentication → URL Configuration) e atualize a **Site URL** para essa URL da Vercel, se ainda não tinha feito isso.

Pronto — acesse a URL, digite seu e-mail, clique no link que chegar na sua caixa de entrada, e comece a usar.

**Para atualizar o site depois:** suba os arquivos atualizados no mesmo repositório do GitHub que a Vercel republica sozinha.

---

## Caminho alternativo: testar no seu computador primeiro

Com [Node.js](https://nodejs.org) instalado (versão 22 ou mais recente):

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Lembre-se de ter preenchido o `.env` (Passo 2) e de ter adicionado `http://localhost:5173` nas Redirect URLs do Supabase (Passo 1) antes de testar o login.

---

## Estrutura do projeto

```
painel-estudos/
├── index.html
├── package.json
├── vite.config.js
├── supabase_setup.sql     → script SQL para criar a tabela de dados
├── .env.example            → modelo do arquivo de configuração (copie para .env)
├── src/
│   ├── main.jsx             → ponto de entrada
│   ├── App.jsx               → o painel inteiro (login, dashboard, cronograma, etc.)
│   ├── supabaseClient.js     → conexão com o Supabase
│   └── index.css             → estilos (Tailwind CSS)
```
