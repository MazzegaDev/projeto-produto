const nodemailer = require("nodemailer");

class EmailService {
    getTransporter() {
        const host = process.env.SMTP_HOST || "smtp.email.sa-saopaulo-1.oci.oraclecloud.com";
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (!user || !pass) {
            return null;
        }

        return nodemailer.createTransport({
            host: host,
            port: port,
            secure: false, // STARTTLS
            auth: {
                user: user,
                pass: pass
            },
            authMethod: 'PLAIN'
        });
    }

    async enviarEmailConfirmacaoPedido(pedido) {
        const transporter = this.getTransporter();
        const fromEmail = process.env.SMTP_FROM || "naoresponda@sagesistemas.com.br";
        const destinatario = pedido.email;

        if (!destinatario) {
            console.warn(`[Email Service] Pedido #${pedido.numeroPedido} não possui e-mail de destinatário.`);
            return false;
        }

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

        if (!transporter) {
            console.log(`[Email Service - Simulação] SMTP não preenchido no .env. Simulação de e-mail enviado com sucesso para ${destinatario}:\nAssunto: Confirmação do Pedido #${pedido.numeroPedido}\nTotal: R$ ${totalFormatado}`);
            return true;
        }

        try {
            const info = await transporter.sendMail({
                from: `"Lojinha Fullstack" <${fromEmail}>`,
                to: destinatario,
                subject: `Confirmação do Pedido #${pedido.numeroPedido} - Lojinha Fullstack`,
                text: text,
                html: html
            });
            console.log(`[Email Service] E-mail enviado com sucesso para ${destinatario}! MessageId: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error(`[Email Service] Erro ao enviar e-mail para ${destinatario}:`, error.message);
            return false;
        }
    }
}

const instance = new EmailService();
module.exports = instance;
