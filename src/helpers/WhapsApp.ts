import makeWASocket, {
    AnyMessageContent,
    BaileysEventMap,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    MessageType,
    useMultiFileAuthState,
    WAMessage,
} from "@whiskeysockets/baileys";
import dotenv from "dotenv";
import { Boom } from "@hapi/boom";
import logger from "@whiskeysockets/baileys/lib/Utils/logger";
import NodeCache from "node-cache";
import readline from "readline";
import { PrismaClient } from "@prisma/client";

dotenv.config()

export default class WhatsApp {
    public prisma = new PrismaClient()
    public client: any;
    private phoneNumber: number
    private qrCode: string | undefined
    public constructor() {
        this.phoneNumber = parseInt(process.env.PHONE_NUMBER || "6285156803524", 10);
    }

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
            // logger: P({ level: "silent" }),
            printQRInTerminal: !usePairingCode, // If you want to use scan, then change the value of this variable to false
            browser: ["chrome (linux)", "", ""], // If you change this then the pairing code will not work
            auth: {
                creds: state.creds,
                /** caching makes the store faster to send/recv messages */
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            msgRetryCounterCache,
            mobile: false,
            markOnlineOnConnect: false,
            // generateHighQualityLinkPreview: true,
        });
        store?.bind(this.client.ev);

        this.client.ev.on("creds.update", saveCreds); // to save creds

        // Pairing code for Web clients
        if (usePairingCode && !this.client.authState.creds.registered) {
            // const phoneNumber =  await question(
            //     "Enter your active whatsapp number: "
            //  )
            setTimeout(async () => {
                console.log("Please scan the QR code above");
                const code = await this.client.requestPairingCode(`${this.phoneNumber}`);
                console.log(`pairing with this code: ${code}`);
            }, 3000)
        }
        this.client.ev.process(async (events: BaileysEventMap) => {
            console.log(events);
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
                this.qrCode = update.qr
            }
            // credentials updated -- save them
            if (events["creds.update"]) {
                await saveCreds();
            }

            // message received
            if (events["messages.upsert"]) {
                const upsert = events["messages.upsert"];
                console.log("upsert", JSON.stringify(upsert, undefined, 2));
                if (upsert.type === "notify") {
                    for (const msg of upsert.messages) {
                        console.log("msg", msg);
                        // jika group id
                        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
                        if (msg.key.remoteJid?.includes("@g.us")) {
                            try {
                                if (text === "!groupid") {
                                    const slid = "====="
                                    const replyMSG = `${slid}\nGroupID: ${msg.key.remoteJid}\n${slid}`;
                                    console.log("reply msg ", replyMSG);
                                    try {
                                        if (msg.key.remoteJid) await this.sendGroupMessage(
                                            msg!.key!.remoteJid,
                                            replyMSG
                                        );
                                    } catch (error) {
                                        console.error(error);
                                    }
                                }
                                this.addingToMsgDatabase(msg, true)
                            } catch (error) {
                                console.error(error);
                            }
                        } else {
                            try {
                                if (text === "!groupid") {
                                    if (msg.key.remoteJid) await this.client.sendText(
                                        msg.key.remoteJid,
                                        "You are not in a group, but this is your id " + msg.key.remoteJid
                                    );
                                }
                                this.addingToMsgDatabase(msg, false)
                            } catch (error) {
                                console.error(error);
                            }
                        }
                    }
                }
            }
        });

        // this.client.ev.on("messages.upsert", async (m: BaileysEventMap["messages.upsert"]) => {
        //     console.log(JSON.stringify(m, undefined, 2))

        //     console.log('replying to', m.messages[0].key.remoteJid)
        //     await this.client.sendMessage(m.messages[0].key.remoteJid!, { text: 'Hello there!' })
        // });
    }

    async sendText(number: number, text: string) {
        const r = await this.client.sendMessage(number + "@c.us", {
            text: text,
        });
        return r;
    }

    async sendGroupMessage(number: string, text: string) {
        // const groupID = number + "@g.us";
        // console.log("sendGroupMessage", number, text);
        const r = await this.client.sendMessage(number, {
            text: text,
        });
        // const r = {groupID, text}
        return r;
    }

    async addingToMsgDatabase(msg: WAMessage, isGroup: boolean) {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
        await this.prisma.message.create({
            data: {
                id_msg: msg.key.id!,
                remote_jid: msg.key.remoteJid!,
                msg_json: JSON.stringify(msg),
                from_me: (msg.key.fromMe ? true : false),
                push_name: msg.pushName ?? "",
                message_text: text ?? "",
                is_group: isGroup
            }
        })
    }

    async getQrCode() {
        return this.qrCode
    }

}