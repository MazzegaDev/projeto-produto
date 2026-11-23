const common = require("oci-common");
const queue = require("oci-queue");
const path = require("path");
const fs = require("fs");

class OciQueueService {
    #client = null;
    #queueId = null;
    #endpoint = null;
    #isInitialized = false;

    constructor() {
        this.#queueId = process.env.OCI_QUEUE_ID || "ocid1.queue.oc1.sa-saopaulo-1.amaaaaaafmxjc4qaul2xsqprlh3zccdgbue2r57n2mfs4vdzm6sl27qzwsra";
        this.#endpoint = process.env.OCI_QUEUE_ENDPOINT || "https://cell-1.queue.messaging.sa-saopaulo-1.oci.oraclecloud.com";
    }

    async init() {
        if (this.#isInitialized) return;

        try {
            let configPath = process.env.OCI_CONFIG_FILE || path.resolve(__dirname, "../.oci/config");
            if (!path.isAbsolute(configPath)) {
                configPath = path.resolve(process.cwd(), configPath);
            }

            if (!fs.existsSync(configPath)) {
                console.warn(`[OCI Queue] Arquivo de configuração não encontrado em: ${configPath}`);
                return;
            }

            const profile = process.env.OCI_CONFIG_PROFILE || "DEFAULT";
            const provider = new common.ConfigFileAuthenticationDetailsProvider(configPath, profile);

            this.#queueId = process.env.OCI_QUEUE_ID || this.#queueId;
            this.#endpoint = process.env.OCI_QUEUE_ENDPOINT || this.#endpoint;

            // Se endpoint ou queueId não estiverem preenchidos, auto-detecta a fila
            if (!this.#queueId || !this.#endpoint) {
                const adminClient = new queue.QueueAdminClient({ authenticationDetailsProvider: provider });
                const tenantId = provider.getTenantId();
                const list = await adminClient.listQueues({ compartmentId: tenantId });
                const q = list.queueCollection.items.find(item => item.displayName === 'queue-pedidos') || list.queueCollection.items[0];
                if (q) {
                    this.#queueId = q.id;
                    this.#endpoint = q.messagesEndpoint;
                }
            }

            this.#client = new queue.QueueClient({ authenticationDetailsProvider: provider });
            if (this.#endpoint) {
                this.#client.endpoint = this.#endpoint;
            }

            this.#isInitialized = true;
            console.log(`[OCI Queue] Conectado à fila com sucesso! Queue ID: ${this.#queueId}`);
        } catch (error) {
            console.error("[OCI Queue] Erro ao inicializar conexão com OCI Queue:", error.message);
        }
    }

    async publicarMensagem(conteudo) {
        await this.init();
        if (!this.#client || !this.#queueId) {
            throw new Error("[OCI Queue] Cliente OCI Queue não inicializado");
        }

        const msgString = typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo);
        const putRequest = {
            queueId: this.#queueId,
            putMessagesDetails: {
                messages: [{ content: msgString }]
            }
        };

        const res = await this.#client.putMessages(putRequest);
        return res.putMessages.messages;
    }

    async receberMensagens(limite = 1, timeout = 10) {
        await this.init();
        if (!this.#client || !this.#queueId) {
            return [];
        }

        try {
            const getRequest = {
                queueId: this.#queueId,
                limit: limite,
                timeoutInSeconds: timeout
            };

            const res = await this.#client.getMessages(getRequest);
            return res.getMessages.messages || [];
        } catch (error) {
            console.error("[OCI Queue] Erro ao ler mensagens:", error.message);
            return [];
        }
    }

    async deletarMensagem(receipt) {
        await this.init();
        if (!this.#client || !this.#queueId) {
            return false;
        }

        try {
            await this.#client.deleteMessage({
                queueId: this.#queueId,
                messageReceipt: receipt
            });
            return true;
        } catch (error) {
            console.error("[OCI Queue] Erro ao excluir mensagem:", error.message);
            return false;
        }
    }
}

const instance = new OciQueueService();
module.exports = instance;
