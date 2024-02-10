import makeWASocket, {
    BaileysEventMap,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import dotenv from "dotenv";
import { Boom } from "@hapi/boom";
import P, { pino } from "pino";
import express from "express";
import logger from "@whiskeysockets/baileys/lib/Utils/logger";
import NodeCache from "node-cache";
import readline from "readline";

dotenv.config();

class waMake {
    private client: any;
    public constructor() {}

    public async makeConnection(): Promise<void> {
        const usePairingCode = false;
        const useStore = false;

        const lg = logger.child({});
        lg.level = "trace";

        const store = useStore ? makeInMemoryStore({ logger: lg }) : undefined;
        store?.readFromFile("./session");

        // Save every 1m
        setInterval(() => {
            store?.writeToFile("./session");
        }, 10000 * 6);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const question = (text: string) =>
            new Promise((resolve) => rl.question(text, resolve));

        const msgRetryCounterCache = new NodeCache();

        const { state, saveCreds } = await useMultiFileAuthState(
            process.env.SESSION_NAME || "session"
        );
        // fetch latest version of WA Web
        const { version, isLatest } = await fetchLatestBaileysVersion();
        this.client = makeWASocket({
            version,
            logger: P({ level: "silent" }),
            printQRInTerminal: !usePairingCode, // If you want to use scan, then change the value of this variable to false
            browser: ["chrome (linux)", "", ""], // If you change this then the pairing code will not work
            mobile: false,
            auth: {
                creds: state.creds,
                /** caching makes the store faster to send/recv messages */
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            msgRetryCounterCache,
            markOnlineOnConnect: false,
            // generateHighQualityLinkPreview: true,
        });
        store?.bind(this.client.ev);

        this.client.ev.on("creds.update", saveCreds); // to save creds

        // Pairing code for Web clients
        if (usePairingCode && !this.client.authState.creds.registered) {
            const phoneNumber = await question(
                "Enter your active whatsapp number: "
            );
            const code = await this.client.requestPairingCode(phoneNumber);
            console.log(`pairing with this code: ${code}`);
        }
        this.client.ev.process(async (events: BaileysEventMap) => {
            if (events["connection.update"]) {
                const update = events["connection.update"];
                const { connection, lastDisconnect } = update;
                const status = (update.lastDisconnect?.error as Boom)?.output
                    ?.statusCode;
                if (connection === "close") {
                    // reconnect if not logged out
                    if (status == DisconnectReason.restartRequired) {
                        console.log("Restart Required");
                        this.makeConnection();
                    } else {
                        console.log("Coba", DisconnectReason);
                        this.makeConnection();
                    }
                }

                console.log("connection update", update);
            }
            // credentials updated -- save them
            if (events["creds.update"]) {
                await saveCreds();
            }
        });
    }

    async sendText(number: number, text: string) {
        const r = await this.client.sendMessage(number + "@c.us", {
            text: text,
        });
        return r;
    }

    
}

const WA = new waMake();
WA.makeConnection();

const api = express();
api.use(express.json());
api.use(express.urlencoded({ extended: true }));

api.get("/ping", (req, res) => {
    res.send("pong");
});
api.post("/test", (req, res) => {
    const headers = req.headers;
    const body = req.body;
    res.send({
        headers,
        body,
    });
});

api.post("/send-message", async (req: express.Request, res) => {
    const now = Math.floor(Date.now() / 1000);
    const json = req.body;
    const headers = req.headers;
    if (!headers["x-api-key"]) {
        res.status(404).json({
            message: "x-api-key is required",
            status: "error",
        });
        return;
    }
    if (headers["x-api-key"] != process.env.X_API_KEY) {
        res.status(404).json({
            message: "x-api-key is invalid",
            status: "error",
        });
        return;
    }

    if (!Object.keys(json).includes("timestamp")) {
        res.status(404).json({
            message: "timestamp is required",
            timestamp: now,
            status: "error",
            body: json,
        });
        return;
    }
    if (json.timestamp != now) {
        res.status(404).json({
            message: "timestamp is invalid",
            timestamp: now,
            status: "error",
            body: json,
        });
        return;
    }
    if (!json.text) {
        res.status(404).json({
            message: "text is required",
            status: "error",
            body: json,
        });
        return;
    }
    if (!json.number) {
        res.status(404).json({
            message: "number is invalid && start with 62",
            status: "error",
            body: json,
        });
        return;
    }
    const r = await WA.sendText(json.number, json.text);
    res.json({ r });
});

api.listen(3000, async () => {
    console.log("Listening on port 3000");
});

const apps = async () => {
    const qrTerminal = process.env.QR_TERMINAL === "true";
    // const phoneNumber: string = process.env.PHONE_NUMBER || "6285156803524";
    // console.log(phoneNumber);
    const { state, saveCreds } = await useMultiFileAuthState(
        process.env.SESSION_NAME || "session"
    );

    const client = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: true,
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect =
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut;
            console.log(
                "connection closed due to ",
                lastDisconnect?.error,
                ", reconnecting ",
                shouldReconnect
            );
            // reconnect if not logged out
            if (shouldReconnect) {
                apps();
            }
        } else if (connection === "open") {
            console.log("opened connection");
            // const sntMsg = await client.sendMessage("6285156803524@c.us", {
            //     text: "Hello World!",
            // });
            // console.log(sntMsg);

            // make api
        }
    });

    client.ev.on("creds.update", saveCreds);
};
