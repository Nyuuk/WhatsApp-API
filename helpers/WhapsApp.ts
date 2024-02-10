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
import P from "pino";
import logger from "@whiskeysockets/baileys/lib/Utils/logger";
import NodeCache from "node-cache";
import readline from "readline";

dotenv.config()

export default class WhatsApp {
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