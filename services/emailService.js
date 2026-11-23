const nodemailer = require("nodemailer");

class EmailService {
    getTransporter() {
        const host = process.env.SMTP_HOST || "smtp.email.sa-saopaulo-1.oci.oraclecloud.com";
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (!user || !pass) {
            throw new Error("[Email Service] Credenciais SMTP ausentes. Configure SMTP_USER e SMTP_PASS nas variáveis de ambiente.");
        }

        if (!host || !port) {
            throw new Error("[Email Service] Configurações de host/porta SMTP inválidas. Verifique SMTP_HOST e SMTP_PORT.");
        }

        return nodemailer.createTransport({
            host: host,
            port: port,
            secure: false, // STARTTLS na porta 587
            auth: {
                user: user,
                pass: pass
            },
            authMethod: 'PLAIN',
            tls: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true
            }
        });
    }

    async enviarEmailConfirmacaoPedido(pedido) {
        if (!pedido || typeof pedido !== "object") {
            throw new Error("[Email Service] Objeto de pedido inválido ou não fornecido.");
        }

        const destinatario = pedido.email ? pedido.email.trim() : "";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!destinatario || !emailRegex.test(destinatario)) {
            throw new Error(`[Email Service] Endereço de e-mail do destinatário inválido: '${destinatario}'.`);
        }

        const fromEmail = process.env.SMTP_FROM || "naoresponda@lojafullstacksistemas.com.br";
        const transporter = this.getTransporter();

        // Monta tabela de itens em HTML
        let linhasTabela = "";
        let itensTexto = "";
        if (Array.isArray(pedido.itens)) {
            pedido.itens.forEach(item => {
                const precoFormatado = Number(item.preco || 0).toFixed(2).replace('.', ',');
                const subtotalFormatado = Number(item.subtotal || (item.preco * item.quantidade) || 0).toFixed(2).replace('.', ',');
                linhasTabela += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.nome} ${item.marca ? `(${item.marca})` : ''}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantidade}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${precoFormatado}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${subtotalFormatado}</td>
                    </tr>
                `;
                itensTexto += `- ${item.nome} (Qtd: ${item.quantidade}) - R$ ${subtotalFormatado}\n`;
            });
        }

        const totalFormatado = Number(pedido.valorTotal || 0).toFixed(2).replace('.', ',');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #212529; color: #ffffff; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">Lojinha Fullstack</h1>
                    <p style="margin: 5px 0 0 0; color: #adb5bd;">Confirmação de Pedido</p>
                </div>
                <div style="padding: 25px;">
                    <h2 style="color: #28a745; margin-top: 0;">Pedido #${pedido.numeroPedido} Confirmado!</h2>
                    <p>Olá,</p>
                    <p>Recebemos o seu pedido com sucesso! Abaixo estão os detalhes dos produtos adquiridos:</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Item</th>
                                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Qtd</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Unitário</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasTabela}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="padding: 12px; font-weight: bold; text-align: right; border-top: 2px solid #212529;">Valor Total:</td>
                                <td style="padding: 12px; font-weight: bold; text-align: right; border-top: 2px solid #212529; color: #0d6efd; font-size: 18px;">R$ ${totalFormatado}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin-top: 20px;">
                        <p style="margin: 0; font-size: 14px; color: #495057;">
                            <strong>Data do pedido:</strong> ${new Date(pedido.data || Date.now()).toLocaleString('pt-BR')}<br>
                            <strong>Status:</strong> Em processamento
                        </p>
                    </div>

                    <p style="margin-top: 25px; font-size: 14px; color: #6c757d; text-align: center;">
                        Obrigado por comprar conosco! Qualquer dúvida responda a este e-mail.
                    </p>
                </div>
            </div>
        `;

        const text = `
Confirmação do Pedido #${pedido.numeroPedido} - Lojinha Fullstack

Olá! Recebemos o seu pedido com sucesso.

Detalhes dos itens:
${itensTexto}
Valor Total: R$ ${totalFormatado}
Data: ${new Date(pedido.data || Date.now()).toLocaleString('pt-BR')}

Obrigado por comprar conosco!
        `;

        try {
            const info = await transporter.sendMail({
                from: `"Lojinha Fullstack" <${fromEmail}>`,
                to: destinatario,
                subject: `Confirmação do Pedido #${pedido.numeroPedido} - Lojinha Fullstack`,
                text: text,
                html: html
            });

            if (!info || !info.messageId) {
                throw new Error("[Email Service] Resposta do servidor SMTP sem confirmação (messageId ausente).");
            }

            console.log(`[Email Service] E-mail enviado com sucesso para ${destinatario}! MessageId: ${info.messageId}`);
            return info;
        } catch (error) {
            console.error(`[Email Service] Erro ao enviar e-mail para ${destinatario}:`, error.message);
            throw error;
        }
    }
}

const instance = new EmailService();
module.exports = instance;
