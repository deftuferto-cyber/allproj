const nodemailer = require('nodemailer');
const { ProxyAgent } = require('proxy-agent');
const fs = require('fs').promises;
const axios = require('axios');
require("dotenv").config();

// ====== CONFIG ======
// Proxy credentials (Smartproxy / Decodo)
const PROXY_USER = 'spogruejo6';
const PROXY_PASS = 'fio5=NQk9Tpwti6g2V';
const PROXY_HOST = 'gate.decodo.com';
const PROXY_PORT = 7000;

// Local Postfix SMTP details
const FROM_EMAIL = 'dankseID <info@kmbc-haarlem.nl>';
const SUBJECT = 'uusi viesti';
const LETTER_FILE = 'letter2.html';
const EMAILS_FILE = 'emails.txt';

// API to check IP through proxy
const IP_CHECK_URL = 'https://ip.decodo.com/json';

// ====== FUNCTIONS ======

// Fetch IP through proxy
async function fetchWithProxy(url, host, username, password, proxy_port) {
    while (true) {
        try {
            const response = await axios.get(url, {
                proxy: {
                    host: host,
                    port: proxy_port,
                    auth: { username, password }
                },
                timeout: 10000
            });

            if (response.status === 200) {
                return response.data;
            } else {
                await fs.appendFile('log.txt', `${new Date()} ---> Return with code ${response.status}\n`);
            }
        } catch (error) {
            await fs.appendFile('log.txt', `${new Date()} ---> ${error.message}\n`);
        }
    }
}

// Read file content
async function readFilePromise(filePath) {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (err) {
        throw err;
    }
}

// Send email via Postfix localhost using proxy
async function sendEmail(ip_address, recipient, proxyUser, proxyPass, proxyHost, proxyPort) {
    const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;

    const smtpConfig = {
        host: '127.0.0.1', // Postfix on localhost
        port: 25,          // Default Postfix port
        secure: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
        agent: new ProxyAgent(proxyUrl),
        name: ip_address || 'localhost.localdomain'
    };

    try {
        let transporter = nodemailer.createTransport(smtpConfig);
        let htmlContent = await readFilePromise(LETTER_FILE);

        const mailOptions = {
            from: FROM_EMAIL,
            to: recipient,
            subject: SUBJECT,
            html: htmlContent,
            date: new Date(),
            messageId: `<${Date.now()}@webfreelance.net>`,
            headers: {
                'List-Unsubscribe': '<mailto:unsubscribe@webfreelance.net>'
            },
        };

        await transporter.sendMail(mailOptions);
        return `✅ Sent to ${recipient} | Proxy IP: ${ip_address}`;
    } catch (error) {
        await fs.appendFile('log.txt', `${new Date()} ---> Failed to send to ${recipient}: ${error}\n`);
        return `❌ Error sending to ${recipient}: ${error.message}`;
    }
}

// ====== MAIN ======
(async () => {
    const emailData = await readFilePromise(EMAILS_FILE);
    const emails = emailData.split('\n').map(e => e.trim()).filter(Boolean);

    let numberOfEmailSend = 0;

    while (numberOfEmailSend < emails.length) {
        try {
            const filterEmail = emails[numberOfEmailSend];

            // Get fresh proxy IP before EACH email
            const proxyDetail = await fetchWithProxy(
                IP_CHECK_URL,
                PROXY_HOST,
                PROXY_USER,
                PROXY_PASS,
                PROXY_PORT
            );

            const status = await sendEmail(
                proxyDetail?.proxy?.ip,
                filterEmail,
                PROXY_USER,
                PROXY_PASS,
                PROXY_HOST,
                PROXY_PORT
            );

            console.log(status);
            numberOfEmailSend++;
        } catch (err) {
            await fs.appendFile('log.txt', `${new Date()} ---> ${err}\n`);
        }
    }

    console.log("🎯 All emails processed.");
})();
