import { PrismaClient } from "@prisma/client";
import { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { CronExpression, parseExpression } from "cron-parser";

interface MyMethod {
    // sendText: (client: WASocket, number: string, text: string) => Promise<void>;
    [key: string]: (client: WASocket, msg: WAMessage, prisma?: PrismaClient) => Promise<void>; // Index signature
}

const myMethod: MyMethod = {
    groupId: async (client: WASocket, msg: WAMessage) => {
        const jid = msg.key.remoteJid
        if (jid?.endsWith("@g.us")) {
            const slid = "====="
            const replyMSG = `${slid}\nGroupID: ${jid}\n${slid}`;
            await generalMethod.sendText(client, jid, replyMSG)
        } else if (jid?.endsWith("@s.whatsapp.net")) {
            const replyMSG = "You are not in a group, but this is your id " + jid
            await generalMethod.sendText(client, jid, replyMSG)
        }
    },
    addPrefix: async (client: WASocket, msg: WAMessage, prisma?: PrismaClient) => {
        const jid = msg.key.remoteJid
        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text) ?? ""

        const splitText = text.split(" ")
        if (splitText[0] === "!addprefix") {
            console.log("addPrefix", splitText[1])
            const typePrefix = await prisma?.typeAutoReplyMessage.findMany({
                where: {
                    name: splitText[1]
                }
            })
        }
    }
}
const generalMethod = {
    sendText: async (client: WASocket, number: string, text: string) => {
        await client.presenceSubscribe(number)
        await new Promise((resolve) => { setTimeout(resolve, 500) })

        await client.sendPresenceUpdate('composing', number)
        await new Promise((resolve) => { setTimeout(resolve, 2000) })

        await client.sendPresenceUpdate('paused', number)
        // const groupID = number + "@g.us";
        // console.log("sendGroupMessage", number, text);
        await client.sendMessage(number, {
            text: text,
        });
    },
    cronParser: (cron: string, lastSuccess: Date): CronExpression => {
        const option = {
            currentDate: lastSuccess,
            tz: "Asia/Jakarta"
        }
        const interval = parseExpression(cron, option)

        return interval
    }
}

export default myMethod
export { generalMethod }