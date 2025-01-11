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
        const command = splitText[0]
        const typeName = splitText[1]
        const prefix = splitText[2]
        const option = splitText.slice(3).join(" ")
        if (command === "!addprefix" && splitText.length >= 4) {
            console.log("addPrefix", typeName, option)
            const re = await generalMethod.addPrefix(typeName, option, prefix, prisma)
            await generalMethod.sendText(client, jid!, re)
            return
        } else if (command === "!addprefix" && splitText.length < 4) {
            const replyMSG = "Usage: !addprefix <type> <prefix> <option>"
            await generalMethod.sendText(client, jid!, replyMSG)
            return
        }
        console.log("not recognized add prefix", command, typeName, option)
        await generalMethod.sendText(client, jid!, "Not recognized, i don't know what to do")
        return
    },
    listAllPrefixCommand: async (client: WASocket, msg: WAMessage, prisma?: PrismaClient) => {
        const jid = msg.key.remoteJid
        const dataPrefix = await generalMethod.listAllPrefixCommand(prisma)
        let replyMSG = ""
        if (dataPrefix && dataPrefix.length > 0) {
            for (let i = 0; i < dataPrefix.length; i++) {
                const typePrefix = await prisma?.typeAutoReplyMessage.findUnique({
                    where: {
                        id: dataPrefix[i].type_id
                    }
                })
                const newLine = i < dataPrefix.length - 1 ? "\n\n" : ""
                replyMSG += `Type: *${typePrefix?.name}*\nPrefix: *${dataPrefix[i].prefix}*\nOption: *${dataPrefix[i].option}*\nDescription: *${dataPrefix[i].description}*${newLine}`
            }
        } else {
            replyMSG = "No data found\n\n"
        }
        const text = generalMethod.beautyTextList("List All Prefix", replyMSG)
        await generalMethod.sendText(client, jid!, text)
    },
    listAllTypeCommand: async (client: WASocket, msg: WAMessage, prisma?: PrismaClient) => {
        const jid = msg.key.remoteJid
        const dataPrefix = await generalMethod.listAllTypeCommand(prisma)
        let replyMSG = ""
        if (dataPrefix && dataPrefix.length > 0) {
            for (let i = 0; i < dataPrefix.length; i++) {
                const newLine = i < dataPrefix.length - 1 ? "\n\n" : ""
                replyMSG += `Type: *${dataPrefix[i].name}*\nDescription: *${dataPrefix[i].description}*\nPrefix Wildcard: *${dataPrefix[i].prefix_wildcard}*\nOption As: *${dataPrefix[i].option_as}*${newLine}`
            }
        } else {
            replyMSG = "No data found"
        }
        const text = generalMethod.beautyTextList("List All Type", replyMSG)
        await generalMethod.sendText(client, jid!, text)
    },
    sendRandomArray: async (client: WASocket, msg: WAMessage) => {
        const jid = msg.key.remoteJid
        const textMsg = (msg.message?.conversation || msg.message?.extendedTextMessage?.text) ?? ""
        const splitText = textMsg.split(" ")
        /// looping split text
        for (let i = 1; i < splitText.length; i++) {
            // get prefix on autoReplyMessage
            const elementText = splitText[i]
            const prefix = await generalMethod.findElementPrefixOnAutoReplyMessage(elementText)
            if (prefix) {
                // get Description on typeAutoReplyMessage
                const arrToSendMessage = prefix.description?.split(",") ?? []
                const randomIndex = Math.floor(Math.random() * arrToSendMessage.length)
                const text = arrToSendMessage[randomIndex]
                text && await generalMethod.sendText(client, jid!, text)
                break
            }
        }
    }
}
const generalMethod = {
    beautyTextList: (title: string, text: string) => {
        const t = `**${title}**\n----\n\n${text}\n\n----`
        return t
    },
    findElementPrefixOnAutoReplyMessage: async (prefix: string, prisma?: PrismaClient) => {
        return await prisma?.autoReplyMessage.findFirst({
            where: {
                prefix: prefix
            }
        })
    },
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
    },
    addPrefix: async (typeName: string, option: string, prefix: string, prisma?: PrismaClient) => {
        const typePrefix = await prisma?.typeAutoReplyMessage.findUnique({
            where: {
                name: typeName
            }
        })

        if (typePrefix) {
            await prisma?.autoReplyMessage.create({
                data: {
                    prefix: prefix,
                    type_id: typePrefix.id,
                    option: option
                }
            })
            // validasi apakah di my method terdapat option jika typePrefix dengan id optios_as function
            if (typePrefix.option_as === "function" && typeof myMethod[option] !== 'function') {
                return `Sorry your option ${option} not found`
            }
            return `Success creating new command prefix\n\n-----\nprefix: ${prefix}\ntype: ${typeName}\noption: ${option}\n\n-----\n\n\`!listall\` to see all command`
        } else {
            return `Sorry your type name ${typeName} not found`
        }
    },
    deletePrifix: async (prefix: string, prisma?: PrismaClient) => {
        const deletePrefix = await prisma?.autoReplyMessage.updateMany({
            where: {
                prefix: prefix
            }, data: {
                deleted_at: new Date()
            }
        })
        if (deletePrefix) {
            return `Success delete command prefix ${prefix}\nTotal deleted: ${deletePrefix.count}\n\n-----\n\n\`!listall\` to see all command`
        } else {
            return `Sorry your command prefix ${prefix} not found`
        }
    },
    listAllPrefixCommand: async (prisma?: PrismaClient) => {
        const autoReplyMessage = await prisma?.autoReplyMessage.findMany({
            where: {
                deleted_at: null
            }
        })
        return autoReplyMessage
    },
    listAllTypeCommand: async (prisma?: PrismaClient) => {
        const typeAutoReplyMessage = await prisma?.typeAutoReplyMessage.findMany({
            where: {
                deleted_at: null
            }
        })
        return typeAutoReplyMessage
    }
}

export default myMethod
export { generalMethod }