require("dotenv").config();
const ociQueue = require("./services/ociQueueService");
const emailService = require("./services/emailService");

let isRunning = true;
// Armazena recibos em processamento recente para evitar duplicidades
const processandoRecibos = new Set();

process.on("SIGINT", () => {
    console.log("\n[Consumer] Recebido SIGINT. Finalizando consumidor graciosamente...");
    isRunning = false;
});

process.on("SIGTERM", () => {
    console.log("\n[Consumer] Recebido SIGTERM. Finalizando consumidor graciosamente...");
    isRunning = false;
});

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startConsumer() {
    console.log("====================================================");
    console.log("  Iniciando Consumidor de Eventos OCI Queue (PM2)   ");
    console.log("====================================================");

    await ociQueue.init();

    while (isRunning) {
        try {
            // Processa 1 mensagem por lote para respeitar o visibility timeout de 30s da Queue
            // Timeout de long-polling de 10 segundos
            const mensagens = await ociQueue.receberMensagens(1, 10);

            if (mensagens && mensagens.length > 0) {
                for (const msg of mensagens) {
                    // Evita processamento duplicado caso a mensagem já esteja sendo tratada
                    if (processandoRecibos.has(msg.receipt)) {
                        continue;
                    }
                    processandoRecibos.add(msg.receipt);

                    let pedido = null;
                    try {
                        pedido = JSON.parse(msg.content);
                    } catch (parseErr) {
                        console.error("[Consumer] Erro ao interpretar JSON da mensagem:", parseErr.message, "Conteúdo:", msg.content);
                        processandoRecibos.delete(msg.receipt);
                        continue;
                    }

                    console.log(`[Consumer] Processando Pedido #${pedido.numeroPedido} para o cliente: ${pedido.email}`);

                    let enviado = false;
                    try {
                        // Envia o e-mail de confirmação real via OCI Email Delivery
                        await emailService.enviarEmailConfirmacaoPedido(pedido);
                        enviado = true;
                    } catch (emailErr) {
                        console.error(`[Consumer] Falha ao enviar e-mail do Pedido #${pedido.numeroPedido}:`, emailErr.message);
                    }

                    if (enviado) {
                        // Exclui a mensagem da fila SOMENTE após envio bem-sucedido
                        const deletado = await ociQueue.deletarMensagem(msg.receipt);
                        if (deletado) {
                            console.log(`[Consumer] Pedido #${pedido.numeroPedido} finalizado com sucesso. Mensagem removida da fila.`);
                        } else {
                            console.error(`[Consumer] Alerta: E-mail do Pedido #${pedido.numeroPedido} enviado, mas falha ao excluir da fila.`);
                        }
                    } else {
                        console.warn(`[Consumer] Pedido #${pedido.numeroPedido} NÃO foi excluído da fila. Será reprocessado após expirar o visibility timeout.`);
                    }

                    // Remove do controle de recibos em processamento
                    processandoRecibos.delete(msg.receipt);
                }
            } else {
                // Fila vazia, aguarda brevemente antes do próximo polling
                await delay(3000);
            }
        } catch (loopError) {
            console.error("[Consumer] Erro no loop de consumo:", loopError.message);
            await delay(5000);
        }
    }

    console.log("[Consumer] Consumidor finalizado.");
    process.exit(0);
}

startConsumer();
