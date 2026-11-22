const CategoriaModel = require("../models/categoriaModel");
const MarcaModel = require("../models/marcaModel");
const ProdutoModel = require("../models/produtoModel");
const fs = require('fs');
const path = require('path');
const ociService = require('../services/ociStorageService');

class ProdutoController {

    async listarView(req, res) {
        let prod = new ProdutoModel();
        let lista = await prod.listarProdutos();
        res.render('produto/listar', {lista: lista});
    }

    async buscaProduto(req, res) {
        var ok = true;
        var msg = ""
        var retorno = null;
        if(req.body.id != null && req.body.id != ""){
            let prod = new ProdutoModel();
            prod = await prod.buscarProduto(req.body.id);

            retorno = {
                nome: prod.produtoNome,
                preco: prod.produtoPreco,
                id: prod.produtoId,
                marcaNome: prod.marcaNome,
                categoriaNome: prod.categoriaNome,
                imagem: prod.produtoImagem
            };
        }
        else {
            ok = false;
            msg = "Parâmetro inválido!";
        }

        res.send({ ok: ok, msg: msg, retorno: retorno })
    }

    async excluirProduto(req, res){
        var ok = true;
        try {
            if(req.body.codigo != "") {
                let produto = new ProdutoModel();
                let prodAtual = await produto.buscarProduto(req.body.codigo);
                ok = await produto.excluir(req.body.codigo);
                if (ok && prodAtual && prodAtual.produtoImagem) {
                    const imgFilename = path.basename(prodAtual.produtoImagem);
                    if (imgFilename && imgFilename !== "sem-imagem.png") {
                        await ociService.deleteImage(imgFilename);
                    }
                }
            }
            else{
                ok = false;
            }
        } catch (error) {
            console.error("Erro ao excluir produto e sua imagem:", error);
            ok = false;
        }

        res.send({ok: ok});
    }

    async cadastrarProduto(req, res){
        var ok = true;
        try {
            if(req.body.codigo != "" && req.body.nome != "" && req.body.quantidade != "" && req.body.quantidade != '0' && req.body.marca != '0' && req.body.categoria != '0' && req.file != null && (req.file.filename.includes(".jpg") || req.file.filename.includes(".png")) && req.body.preco != '' && req.body.preco > '0' ) {
                
                // Upload para o Bucket OCI
                if (req.file.buffer) {
                    await ociService.uploadImage(req.file.filename, req.file.buffer, req.file.mimetype);
                }

                let produto = new ProdutoModel(0, req.body.codigo, req.body.nome, req.body.quantidade, req.body.categoria, req.body.marca, "", "", req.file.filename, req.body.preco);

                ok = await produto.gravar();
            }
            else{
                ok = false;
            }
        } catch (error) {
            console.error("Erro ao cadastrar produto com imagem no bucket:", error);
            ok = false;
        }

        res.send({ ok: ok })
    }

    async alterarView(req, res){
        let produto = new ProdutoModel();
        let marca = new MarcaModel();
        
        let categoria = new CategoriaModel();
        if(req.params.id != undefined && req.params.id != ""){
            produto = await produto.buscarProduto(req.params.id);
        }

        let listaMarca = await marca.listarMarcas();
        let listaCategoria = await categoria.listarCategorias();
        res.render("produto/alterar", {produtoAlter: produto, listaMarcas: listaMarca, listaCategorias: listaCategoria});
    }

    async alterarProduto(req, res) {
        var ok = true;
        try {
            if(req.body.codigo != "" && req.body.nome != "" && req.body.quantidade != "" && req.body.quantidade != '0' && req.body.marca != '0' && req.body.categoria != '0' && req.file != null && (req.file.filename.includes(".jpg") || req.file.filename.includes(".png")) && req.body.preco != '' && req.body.preco > '0' ) {

                let produto = new ProdutoModel(req.body.id, req.body.codigo, req.body.nome, req.body.quantidade, req.body.categoria, req.body.marca, "", "", req.file.filename, req.body.preco);
                
                let produtoOld = await produto.buscarProduto(req.body.id);

                if(produtoOld && produtoOld.produtoImagem) {
                    const imgOldFilename = path.basename(produtoOld.produtoImagem);
                    if (imgOldFilename && imgOldFilename !== "sem-imagem.png") {
                        await ociService.deleteImage(imgOldFilename);
                    }
                }

                // Upload da nova imagem para o Bucket OCI
                if (req.file.buffer) {
                    await ociService.uploadImage(req.file.filename, req.file.buffer, req.file.mimetype);
                }
                
                ok = await produto.gravar();
            }
            else{
                ok = false;
            }
        } catch (error) {
            console.error("Erro ao alterar produto com imagem no bucket:", error);
            ok = false;
        }

        res.send({ ok: ok })
    }

    async cadastroView(req, res) {

        let listaMarcas = [];
        let listaCategorias = [];

        let marca = new MarcaModel();
        listaMarcas = await marca.listarMarcas();

        let categoria = new CategoriaModel();
        listaCategorias = await categoria.listarCategorias();

        res.render('produto/cadastro', { listaMarcas: listaMarcas, listaCategorias: listaCategorias });
    }
}

module.exports = ProdutoController;
