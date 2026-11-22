require("dotenv").config();
const ociQueue = require("./services/ociQueueService");
const emailService = require("./services/emailService");

let isRunning = true;

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
            // Busca até 5 mensagens na fila com timeout de 10 segundos
            const mensagens = await ociQueue.receberMensagens(5, 10);

            if (mensagens && mensagens.length > 0) {
                console.log(`[Consumer] ${mensagens.length} mensagem(ns) recebida(s) da fila.`);

                for (const msg of mensagens) {
                    try {
                        const pedido = JSON.parse(msg.content);
                        console.log(`[Consumer] Processando Pedido #${pedido.numeroPedido} para o cliente: ${pedido.email}`);

                        // Envia o e-mail de confirmação via OCI Email Delivery
                        const enviado = await emailService.enviarEmailConfirmacaoPedido(pedido);

                        if (enviado) {
                            // Deleta a mensagem processada da fila
                            await ociQueue.deletarMensagem(msg.receipt);
                            console.log(`[Consumer] Pedido #${pedido.numeroPedido} finalizado com sucesso. Mensagem removida da fila.`);
                        } else {
                            console.warn(`[Consumer] Falha ao enviar e-mail do Pedido #${pedido.numeroPedido}. A mensagem permanecerá na fila.`);
                        }
                    } catch (err) {
                        console.error("[Consumer] Erro ao processar mensagem individual:", err.message);
                    }
                }
            } else {
                // Fila vazia, aguarda antes da próxima consulta
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
