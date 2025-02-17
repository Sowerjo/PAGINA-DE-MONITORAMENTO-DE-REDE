Node.js e npm instalados:
Verifique com os comandos:

node -v
npm -v
Se não estiverem instalados, em distribuições baseadas em Debian/Ubuntu você pode instalar com:


sudo apt update
sudo apt install nodejs npm
Para versões mais recentes, considere usar o NodeSource ou o NVM (Node Version Manager).

Dependências de compilação:
Alguns módulos nativos podem requerer ferramentas de build:


sudo apt install build-essential python3
2. Preparar o Projeto
Obtenha o código do projeto:

Se o código estiver em um repositório Git, clone-o:

git clone <URL_DO_REPOSITORIO>
cd monitoramento-rede
Se você já tem o código, copie todos os arquivos para uma pasta (por exemplo, monitoramento-rede).
Verifique a Estrutura de Pastas:
A estrutura recomendada é:


monitoramento-rede/
├── server.js
├── package.json
├── data/              ← Pasta para o banco de dados (será criada automaticamente)
├── uploads/           ← Pasta para armazenar os ícones enviados
└── public/            ← Contém HTML, CSS e JS (dashboard, login, etc.)
Criar Pastas Necessárias e Definir Permissões:
Se ainda não existirem, crie as pastas e ajuste as permissões:


mkdir -p data uploads
chmod -R 755 data uploads
3. Instalar as Dependências do Projeto
No diretório do projeto, execute:


npm install
Isso instalará todas as dependências listadas no arquivo package.json.

4. Configurar o Banco de Dados
Se for a primeira vez que você executa o projeto, o SQLite criará o banco de dados automaticamente na pasta data (conforme configurado no server.js).
Se estiver migrando de uma versão antiga, certifique-se de que as colunas necessárias foram criadas (o código possui uma rotina de migração para isso).
5. Iniciar a Aplicação
Você tem duas opções para iniciar a aplicação:

a) Usando o Node.js diretamente:

node server.js
Isso iniciará o servidor na porta 3000 (ou na porta configurada no seu server.js).

b) Usando o PM2 (recomendado para produção ou para manter o app rodando em background):
Instale o PM2 globalmente, se ainda não instalou:

sudo npm install -g pm2
Inicie o aplicativo com PM2:

pm2 start server.js
Para salvar o estado atual dos processos e configurá-los para reiniciar com o sistema, execute:

pm2 save
pm2 startup
Siga as instruções exibidas pelo comando pm2 startup para configurar o PM2 para iniciar na inicialização do sistema.
6. Acessar a Aplicação
Abra seu navegador e acesse:


http://localhost:3000/login.html
A partir daí, você pode:

Cadastrar um novo usuário (caso ainda não tenha).
Fazer login e acessar o dashboard de monitoramento.
Configurar os dispositivos, editar posições, ajustar as configurações e monitorar os status.
