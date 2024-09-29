import { WAMessage, WASocket } from "@whiskeysockets/baileys";

interface MyMethod {
    // sendText: (client: WASocket, number: string, text: string) => Promise<void>;
    [key: string]: (client: WASocket, msg: WAMessage) => Promise<void>; // Index signature
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
    }
}

export default myMethod
export { generalMethod }