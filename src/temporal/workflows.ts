// @@@SNIPSTART typescript-hello-workflow
import { proxyActivities } from '@temporalio/workflow';
// Only import the activity types
import type * as activities from './activities';


// WA.makeConnection()

const { greet, sendMessage } = proxyActivities<typeof activities>({
    startToCloseTimeout: '1 minute',
});

/** A workflow that simply calls an activity */
export async function example(name: string): Promise<string> {
    return await greet(name);
}

export async function sendMsg(number: string, text: string): Promise<any> {
    return await sendMessage(number, text);
}
// @@@SNIPEND
