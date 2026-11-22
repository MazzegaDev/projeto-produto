//importando os packages instalados
require("dotenv").config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs');
const ociService = require('./services/ociStorageService');

const HomeRoute = require('./routes/homeRoute');
const ProdutoRoute = require('./routes/produtoRoute');
const MarcaRoute = require('./routes/marcaRoute');
const CategoriaRoute = require('./routes/categoriaRoute');
const VitrineRoute = require('./routes/vitrineRoute');
const UsuariosRoute = require('./routes/usuariosRoute');
const LoginRoute = require('./routes/loginRoute');
const Autenticacao = require('./middlewares/autenticacao');
const cookieParser = require('cookie-parser');
const PedidoRoute = require('./routes/pedidoRoute');

const app = express();

global.PRODUTO_IMG_CAMINHO = "/img/Produtos/";
global.RAIZ_PROJETO = __dirname;

// Rota para servir imagens a partir do Bucket OCI (com fallback para imagens locais)
app.get('/img/Produtos/:nome', async function(req, res) {
    const nome = req.params.nome;
    try {
        const imgObj = await ociService.getImageStream(nome);
        if (imgObj && imgObj.stream) {
            if (imgObj.contentType) res.setHeader('Content-Type', imgObj.contentType);
            if (imgObj.contentLength) res.setHeader('Content-Length', imgObj.contentLength);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return imgObj.stream.pipe(res);
        }
    } catch (err) {
        console.error(`[OCI] Erro ao buscar imagem '${nome}' do bucket:`, err.message);
    }

    // Fallback local caso o arquivo exista fisicamente em public/img/Produtos
    const localPath = path.join(__dirname, 'public', 'img', 'Produtos', nome);
    if (fs.existsSync(localPath)) {
        return res.sendFile(localPath);
    }

    // Fallback padrão se não encontrar
    const fallbackPath = path.join(__dirname, 'public', 'img', 'Produtos', 'sem-imagem.png');
    if (fs.existsSync(fallbackPath)) {
        return res.sendFile(fallbackPath);
    }

    res.status(404).send('Imagem não encontrada');
});

//configurando a nossa pasta public como o nosso repositorio de arquivos estáticos (css, js, imagens)
app.use(express.static(__dirname + "/public"));
app.use(cookieParser());
//configuração das nossas views para utilizar a ferramenta EJS
app.set('view engine', 'ejs');
//Configuração de onde ficará nossas views
app.set('views', './views');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//configuração da nossa página de layout
app.set('layout', './layout');
app.use(expressLayouts);

//definindo as rotas que o nosso sistema vai reconhecer através da url do navegador
//rotas publicas
let vitrineRota = new VitrineRoute();
app.use('/', vitrineRota.router);
let loginRota = new LoginRoute();
app.use('/login', loginRota.router);

//essa rota é privada mas será definido separadamente dentro da produtoroute
let produtoRota = new ProdutoRoute();
app.use('/admin/produto', produtoRota.router);

let auth = new Autenticacao();

app.use(auth.usuarioIsAdmin);

//rotas privadas
let homeRota = new HomeRoute();
app.use('/admin', homeRota.router);
let marcaRota = new MarcaRoute();
app.use("/admin/marcas", marcaRota.router);
let categoriaRota = new CategoriaRoute();
app.use("/admin/categorias", categoriaRota.router);
let usuarioRota = new UsuariosRoute();
app.use("/admin/usuarios", usuarioRota.router);
let pedidoRota = new PedidoRoute();
app.use("/admin/pedidos", pedidoRota.router);

//ponto de inicio do nosso servidor web
const server = app.listen('5000', async function() {
    console.log('Servidor web iniciado na porta 5000');
    // Inicializa o serviço do Bucket OCI e sincroniza imagens locais iniciais
    await ociService.init();
    await ociService.syncLocalFolder(path.join(__dirname, 'public', 'img', 'Produtos'));
});
