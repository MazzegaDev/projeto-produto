const PedidoItemModel = require("../models/pedidoItemModel");
const PedidoModel = require("../models/pedidoModel");
const ProdutoModel = require("../models/produtoModel");
const ociQueue = require("../services/ociQueueService");

class VitrineController {

    async listarProdutosView(req, res) {
        let produto = new ProdutoModel();
        let listaProdutos = await produto.listarProdutos();

        res.render('vitrine/index', { produtos: listaProdutos, layout: 'vitrine/index' });
    }

    async gravarPedido(req, res){
        var ok = false;
        var msg = "";

        try {
            if(req.body != null && req.body != ""){
                let listaPedido = [];
                let emailCliente = "";

                if (Array.isArray(req.body)) {
                    listaPedido = req.body;
                } else if (req.body.itens && Array.isArray(req.body.itens)) {
                    listaPedido = req.body.itens;
                    emailCliente = req.body.email || "";
                }

                if(listaPedido.length > 0) {               
                    let pedido = new PedidoModel();
                    let listaErros = await pedido.validarPedido(listaPedido);
                    if(listaErros.length == 0){
                        await pedido.gravar();
                        if(pedido.pedidoId > 0){
                            for(let i = 0; i<listaPedido.length; i++){
                                let pedidoItem = new PedidoItemModel();
                                pedidoItem.pedidoId = pedido.pedidoId;
                                pedidoItem.produtoId = listaPedido[i].id;
                                pedidoItem.pedidoQuantidade = listaPedido[i].quantidade;

                                ok = await pedidoItem.gravar();
                                if(ok){
                                    pedido.debitarQuantidade(pedidoItem.produtoId, pedidoItem.pedidoQuantidade);
                                }
                            }

                            // Publica evento do pedido na Fila OCI Queue
                            try {
                                let valorTotal = 0;
                                for (let i = 0; i < listaPedido.length; i++) {
                                    valorTotal += (parseFloat(listaPedido[i].preco) || 0) * parseInt(listaPedido[i].quantidade || 1);
                                }

                                const pedidoPayload = {
                                    numeroPedido: pedido.pedidoId,
                                    email: emailCliente,
                                    data: new Date().toISOString(),
                                    valorTotal: valorTotal.toFixed(2),
                                    itens: listaPedido.map(item => ({
                                        id: item.id,
                                        nome: item.nome,
                                        marca: item.marcaNome || "",
                                        preco: parseFloat(item.preco || 0).toFixed(2),
                                        quantidade: item.quantidade,
                                        subtotal: ((parseFloat(item.preco) || 0) * parseInt(item.quantidade || 1)).toFixed(2)
                                    }))
                                };

                                await ociQueue.publicarMensagem(pedidoPayload);
                                console.log(`[OCI Queue] Pedido #${pedido.pedidoId} publicado na fila com sucesso para '${emailCliente}'!`);
                            } catch (queueErr) {
                                console.error("[OCI Queue] Aviso ao publicar na fila:", queueErr.message);
                            }
                        }
                        else{
                            msg = "Erro ao gerar pedido!";
                        }
                    }
                    else{
                        var msgErro = listaErros.join("\n");  
                        msgErro = msgErro.trim(",");
                        msg = "Os seguintes produtos não possuem a quantidade desejada: \n" + msgErro;  
                    }
                }
                else{
                    msg = "Carrinho vazio!";
                }
            }
            else{
                msg = "Parâmetros inválidos";
            }
        } catch (error) {
            console.error("Erro ao gravar pedido:", error);
            msg = "Erro interno ao processar pedido";
        }

        res.send({ok: ok, msg: msg});
    }
}

module.exports = VitrineController;
