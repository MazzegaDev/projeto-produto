const common = require("oci-common");
const os = require("oci-objectstorage");
const path = require("path");
const fs = require("fs");
const stream = require("stream");

class OciStorageService {
    #client = null;
    #namespace = null;
    #bucketName = null;
    #isInitialized = false;

    constructor() {
        this.#bucketName = process.env.OCI_BUCKET_NAME || "bucket-ecommerce";
    }

    async init() {
        if (this.#isInitialized) return;

        try {
            // Caminho para o arquivo .oci/config
            let configPath = process.env.OCI_CONFIG_FILE || path.resolve(__dirname, "../.oci/config");
            if (!path.isAbsolute(configPath)) {
                configPath = path.resolve(process.cwd(), configPath);
            }

            if (!fs.existsSync(configPath)) {
                console.warn(`[OCI] Arquivo de configuração não encontrado em: ${configPath}. Verifique a variável OCI_CONFIG_FILE.`);
                return;
            }

            const profile = process.env.OCI_CONFIG_PROFILE || "DEFAULT";
            const provider = new common.ConfigFileAuthenticationDetailsProvider(configPath, profile);
            this.#client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });

            // Recupera o namespace
            if (process.env.OCI_NAMESPACE) {
                this.#namespace = process.env.OCI_NAMESPACE;
            } else {
                const nsResponse = await this.#client.getNamespace({});
                this.#namespace = nsResponse.value;
            }

            this.#bucketName = process.env.OCI_BUCKET_NAME || "bucket-ecommerce";
            this.#isInitialized = true;
            console.log(`[OCI] Object Storage conectado com sucesso! Namespace: ${this.#namespace}, Bucket: ${this.#bucketName}`);
        } catch (error) {
            console.error("[OCI] Erro ao inicializar conexão com OCI Object Storage:", error.message);
        }
    }

    getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        switch (ext) {
            case ".png":
                return "image/png";
            case ".jpg":
            case ".jpeg":
                return "image/jpeg";
            case ".gif":
                return "image/gif";
            case ".webp":
                return "image/webp";
            case ".svg":
                return "image/svg+xml";
            default:
                return "application/octet-stream";
        }
    }

    async uploadImage(filename, bufferOrStream, contentType) {
        await this.init();
        if (!this.#client || !this.#namespace) {
            throw new Error("[OCI] Cliente OCI Object Storage não inicializado");
        }

        const mime = contentType || this.getMimeType(filename);
        let readable;
        let contentLength;

        if (Buffer.isBuffer(bufferOrStream)) {
            contentLength = bufferOrStream.length;
            readable = new stream.Readable();
            readable.push(bufferOrStream);
            readable.push(null);
        } else if (typeof bufferOrStream.pipe === "function") {
            readable = bufferOrStream;
            contentLength = bufferOrStream.length || bufferOrStream.byteLength;
        } else {
            throw new Error("[OCI] Tipo de dados inválido para upload");
        }

        const putObjectRequest = {
            namespaceName: this.#namespace,
            bucketName: this.#bucketName,
            objectName: filename,
            putObjectBody: readable,
            contentType: mime,
            ...(contentLength ? { contentLength } : {})
        };

        const response = await this.#client.putObject(putObjectRequest);
        console.log(`[OCI] Imagem '${filename}' enviada para o bucket '${this.#bucketName}' com sucesso.`);
        return response;
    }

    async getImageStream(filename) {
        await this.init();
        if (!this.#client || !this.#namespace) {
            return null;
        }

        try {
            const getObjectRequest = {
                namespaceName: this.#namespace,
                bucketName: this.#bucketName,
                objectName: filename
            };

            const response = await this.#client.getObject(getObjectRequest);
            
            // Converte ReadableStream (web standard) em stream.Readable do Node se necessário
            let nodeStream = response.value;
            if (nodeStream && typeof nodeStream.pipe !== "function") {
                if (stream.Readable.fromWeb && typeof nodeStream.getReader === "function") {
                    nodeStream = stream.Readable.fromWeb(nodeStream);
                } else if (stream.Readable.from) {
                    nodeStream = stream.Readable.from(nodeStream);
                }
            }

            return {
                stream: nodeStream,
                contentType: response.contentType || this.getMimeType(filename),
                contentLength: response.contentLength
            };
        } catch (error) {
            if (error.statusCode === 404) {
                return null;
            }
            console.error(`[OCI] Erro ao buscar imagem '${filename}' do bucket:`, error.message);
            return null;
        }
    }

    async deleteImage(filename) {
        await this.init();
        if (!this.#client || !this.#namespace) {
            return false;
        }

        try {
            const deleteObjectRequest = {
                namespaceName: this.#namespace,
                bucketName: this.#bucketName,
                objectName: filename
            };

            await this.#client.deleteObject(deleteObjectRequest);
            console.log(`[OCI] Imagem '${filename}' excluída do bucket '${this.#bucketName}'.`);
            return true;
        } catch (error) {
            if (error.statusCode === 404) {
                return true;
            }
            console.error(`[OCI] Erro ao excluir imagem '${filename}' do bucket:`, error.message);
            return false;
        }
    }

    async listImages() {
        await this.init();
        if (!this.#client || !this.#namespace) {
            return [];
        }

        try {
            const listObjectsRequest = {
                namespaceName: this.#namespace,
                bucketName: this.#bucketName
            };

            const response = await this.#client.listObjects(listObjectsRequest);
            return (response.listObjects.objects || []).map(obj => obj.name);
        } catch (error) {
            console.error(`[OCI] Erro ao listar objetos do bucket:`, error.message);
            return [];
        }
    }

    async syncLocalFolder(folderPath) {
        await this.init();
        if (!this.#client || !this.#namespace) {
            return;
        }

        try {
            if (!fs.existsSync(folderPath)) return;
            const existingInBucket = new Set(await this.listImages());
            const localFiles = fs.readdirSync(folderPath);

            for (const file of localFiles) {
                const fullPath = path.join(folderPath, file);
                const stat = fs.statSync(fullPath);
                if (stat.isFile() && !existingInBucket.has(file)) {
                    const buffer = fs.readFileSync(fullPath);
                    await this.uploadImage(file, buffer);
                    console.log(`[OCI] Imagem local sincronizada com o bucket: ${file}`);
                }
            }
        } catch (error) {
            console.error("[OCI] Erro ao sincronizar pasta local com o bucket:", error.message);
        }
    }
}

// Singleton para reuso da conexão
const instance = new OciStorageService();
module.exports = instance;
