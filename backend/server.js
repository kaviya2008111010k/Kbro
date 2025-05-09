const express = require("express");
const { Boom } = require("@hapi/boom");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore, fetchLatestBaileysVersion, delay } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        getMessage: async () => ({})
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if(shouldReconnect) {
                connectToWhatsApp();
            }
        } else if(connection === "open") {
            console.log("Connected to WhatsApp");
        }
    });
}

connectToWhatsApp();

app.post("/api/send", async (req, res) => {
    const { group, message } = req.body;

    try {
        const groupMetadata = await sock.groupMetadata(group);
        const members = groupMetadata.participants;

        for (const member of members) {
            await sock.sendMessage(member.id, { text: message });
            await delay(500);
        }

        res.send("Broadcast sent to all group members.");
    } catch (e) {
        console.error("Broadcast Error:", e);
        res.status(500).send("Failed to send broadcast.");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});