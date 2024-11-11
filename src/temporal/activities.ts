// import { QueueMessages } from "@prisma/client";
// import type * as Whatsapp from "../helpers/WhapsApp";
import WhatsApp from '../helpers/WhapsApp';

const WA = new WhatsApp();

WA.makeConnection()

// @@@SNIPSTART typescript-hello-activity
export async function greet(name: string): Promise<string> {
    return `Hello, ${name}!`;
}

export async function sendMessage(number: string, text: string): Promise<any> {
    const r = await WA.sendGroupMessage(number, text);

    return r
}
// @@@SNIPEND
