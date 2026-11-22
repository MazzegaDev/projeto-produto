const express = require('express');
const multer = require("multer");
const path = require("path");
const ProdutoController = require('../controllers/produtoController');
const Autenticacao = require('../middlewares/autenticacao');

class ProdutoRoute {

    #router;
    get router() {
        return this.#router;
    }
    set router(router) {
        this.#router = router;
    }

    constructor() {
        this.#router = express.Router();

        const upload = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 }
        });

        const prepareFile = (req, res, next) => {
            if (req.file) {
                const ext = path.extname(req.file.originalname) || ('.' + req.file.originalname.split('.').pop());
                req.file.filename = Date.now().toString() + ext;
            }
            next();
        };

        let auth = new Autenticacao();
        let ctrl = new ProdutoController();

        this.#router.get('/', auth.usuarioIsAdmin, ctrl.listarView);
        this.#router.get('/cadastro', auth.usuarioIsAdmin, ctrl.cadastroView);
        this.#router.post("/cadastro", auth.usuarioIsAdmin, upload.single("inputImagem"), prepareFile, ctrl.cadastrarProduto);
        this.#router.post("/excluir", auth.usuarioIsAdmin, ctrl.excluirProduto);
        this.#router.get("/alterar/:id", auth.usuarioIsAdmin, ctrl.alterarView);
        this.#router.post("/alterar", auth.usuarioIsAdmin, upload.single("inputImagem"), prepareFile, ctrl.alterarProduto);
        this.#router.post("/buscar", ctrl.buscaProduto);
    }
}

module.exports = ProdutoRoute;
