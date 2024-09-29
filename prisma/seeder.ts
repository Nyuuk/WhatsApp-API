import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient()


const seed = async () => {
    await prisma.typeAutoReplyMessage.createMany({
        data: [
            {
                id: 1,
                name: "wildcard_text",
                description: "text reply with wildcard prefix",
                prefix_wildcard: true,
                option_as: "text"
            },
            {
                id: 2,
                name: "text_no_wildcard",
                description: "text reply without wildcard prefix",
                prefix_wildcard: false,
                option_as: "text"
            },
            {
                id: 3,
                name: "wildcard_function",
                description: "function reply with wildcard prefix",
                prefix_wildcard: true,
                option_as: "function"
            },
            {
                id: 4,
                name: "function_no_wildcard",
                description: "function reply without wildcard prefix",
                prefix_wildcard: false,
                option_as: "function"
            }
        ]
    })

    await prisma.autoReplyMessage.createMany({
        data: [
            {
                type_id: 4,
                prefix: "!groupid",
                description: "Sending Group ID",
                option: "groupId",
            },
            {
                type_id: 2,
                prefix: "!pong",
                description: "Reply Pong",
                option: "Pongg",
            }
        ]
    })
}
seed()