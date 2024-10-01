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
import { PrismaClient, TypeAutoReplyMessage } from "@prisma/client";
import myMethod, { generalMethod } from "./MethodReply";
import { parseExpression } from "cron-parser";

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
                        this.executeAutoReply(msg);
                        // jika group id
                        // const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
                        // if (msg.key.remoteJid?.includes("@g.us")) {
                        //     try {
                        //         if (text === "!groupid") {
                        //             const slid = "====="
                        //             const replyMSG = `${slid}\nGroupID: ${msg.key.remoteJid}\n${slid}`;
                        //             console.log("reply msg ", replyMSG);
                        //             try {
                        //                 if (msg.key.remoteJid) await this.sendGroupMessage(
                        //                     msg!.key!.remoteJid,
                        //                     replyMSG
                        //                 );
                        //             } catch (error) {
                        //                 console.error(error);
                        //             }
                        //         }
                        //         this.addingToMsgDatabase(msg, true)
                        //     } catch (error) {
                        //         console.error(error);
                        //     }
                        // } else {
                        //     try {
                        //         if (text === "!groupid") {
                        //             if (msg.key.remoteJid) await this.client.sendText(
                        //                 msg.key.remoteJid,
                        //                 "You are not in a group, but this is your id " + msg.key.remoteJid
                        //             );
                        //         }
                        //         this.addingToMsgDatabase(msg, false)
                        //     } catch (error) {
                        //         console.error(error);
                        //     }
                        // }
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
        await this.client.presenceSubscribe(number)
        await new Promise((resolve) => { setTimeout(resolve, 500) })

        await this.client.sendPresenceUpdate('composing', number)
        await new Promise((resolve) => { setTimeout(resolve, 2000) })

        await this.client.sendPresenceUpdate('paused', number)
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

    async addingQueueMessage(number: string, text: string) {
        const newMessage = await this.prisma.queueMessages.create({
            data: {
                number: number,
                text: text
            }
        })
        return newMessage
    }

    async addingScheduleMessage(number: string, text: string, cron: string) {
        const newMessage = await this.prisma.scheduledMessages.create({
            data: {
                number: number,
                text: text,
                cron: cron
            }
        })
        return newMessage
    }

    async executeScheduleMessage() {
        while (true) {
            // console.log("executeScheduleMessage")
            const messages = await this.prisma.scheduledMessages.findMany({
                where: {
                    // status: false,
                    deleted_at: null
                }
            })
            const filterMessages = messages.filter((msg) => {
                const lastSuccess = msg.last_success
                const cron = generalMethod.cronParser(msg.cron, lastSuccess ? lastSuccess : new Date())
                const nextExecution = cron.next().toDate()
                const nextExecutionTimeStamp = nextExecution.getTime()
                const now = new Date()
                const nowTimeStamp = now.getTime()

                const gracePeriod = 1000;

                // console.log(nextExecutionTimeStamp <= nowTimeStamp, nextExecution, now)

                return nextExecutionTimeStamp <= nowTimeStamp + gracePeriod

                // if (!lastSuccess) {
                //     console.log('null cron', generalMethod.cronParser(msg.cron), new Date())
                //     console.log('last success null', nextExecution <= now)
                //     return nextExecution <= now
                // }
                // if (lastSuccess) {
                //     console.log('not null cron', generalMethod.cronParser(msg.cron), new Date())
                //     console.log('last success not null', nextExecution > now && nextExecution >= lastSuccess)
                //     return nextExecution > now && nextExecution >= lastSuccess
                // }
                // return generalMethod.cronParser(msg.cron) <= new Date()
            })
            // console.log('filter message', filterMessages)
            for (const msg of filterMessages) {
                let r;
                try {
                    r = await this.sendGroupMessage(msg.number, msg.text)
                    await this.prisma.scheduledMessages.update({
                        where: {
                            id: msg.id
                        },
                        data: {
                            // status: true,
                            // count_retry: msg.count_retry + 1,
                            last_success: new Date(),
                            last_response: JSON.stringify(r),
                            updated_at: new Date()
                        }
                    })
                } catch (error) {
                    await this.prisma.scheduledMessages.update({
                        where: {
                            id: msg.id
                        },
                        data: {
                            // count_retry: msg.count_retry + 1,
                            last_response: JSON.stringify(error),
                            updated_at: new Date()
                        }
                    })
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }

    async executeQueueMessage() {
        while (true) {
            // console.log("executeQueueMessage")
            const messages = await this.prisma.queueMessages.findMany({
                where: {
                    status: false
                }
            })
            const filterMessages = messages.filter((msg) => {
                return msg.count_retry < msg.max_retry
            })
            for (const msg of filterMessages) {
                try {
                    const r = await this.sendGroupMessage(msg.number, msg.text)
                    await this.prisma.queueMessages.update({
                        where: {
                            id: msg.id
                        },
                        data: {
                            status: true,
                            count_retry: msg.count_retry + 1,
                            last_response: JSON.stringify(r),
                            updated_at: new Date()
                        }
                    })
                } catch (error) {
                    await this.prisma.queueMessages.update({
                        where: {
                            id: msg.id
                        },
                        data: {
                            count_retry: msg.count_retry + 1,
                            last_response: JSON.stringify(error),
                            updated_at: new Date()
                        }
                    })
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }

    async executeAutoReply(msg: WAMessage) {
        const autoReplyMessage = await this.prisma.autoReplyMessage.findMany();
        const allPrefixAutoReply = autoReplyMessage.map((msg) => {
            return msg.prefix
        })

        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text) ?? ""
        const textSplit = text.split(" ")
        const command = textSplit[0]

        if (allPrefixAutoReply.includes(command)) {
            const indexPrefix = allPrefixAutoReply.indexOf(command)
            const autoReplyOpt = autoReplyMessage[indexPrefix]
            let typeAutoReply: TypeAutoReplyMessage | null = null
            if (autoReplyOpt) {
                typeAutoReply = await this.prisma.typeAutoReplyMessage.findUnique({
                    where: {
                        id: autoReplyOpt.type_id
                    }
                })
            }

            if (typeAutoReply && typeAutoReply.option_as === "text") {
                await generalMethod.sendText(this.client, msg.key.remoteJid!, autoReplyOpt.option)
            } else if (typeAutoReply && typeAutoReply.option_as === "function") {
                if (typeof myMethod[autoReplyOpt.option] === 'function') {
                    await myMethod[autoReplyOpt.option](this.client, msg, this.prisma)
                } else {
                    console.error(`Function ${autoReplyOpt.option} not found`)
                }
            }
        }

    }

    async getQrCode() {
        return this.qrCode
    }

}