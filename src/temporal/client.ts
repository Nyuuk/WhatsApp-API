// @@@SNIPSTART typescript-hello-client
import { Connection, Client } from '@temporalio/client';
import { example } from './workflows';
import { nanoid } from 'nanoid';

import dotenv from "dotenv";
dotenv.config();


async function run() {
  // Connect to the default Server location
  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS });
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
  });

  for (let i = 0; i < 100; i++) {
    const handle = client.workflow.start("sendMsg", {
      taskQueue: 'hello-world',
      args: ["6285156803524@s.whatsapp.net", `Temporal ${i}`],
      workflowId: 'testing-' + i + '-' + nanoid(),
    });
    console.log((await handle).workflowId)
  }
  // const handle = await client.workflow.start("sendMsg", {
  //   taskQueue: 'hello-world',
  //   // type inference works! args: [name: string]
  //   args: ["6285156803524@s.whatsapp.net", 'Temporal'],
  //   // in practice, use a meaningful business ID, like customerId or transactionId
  //   workflowId: 'workflow-' + nanoid(),
  // });
  // console.log(`Started workflow ${handle.workflowId}`);

  // optional: wait for client result
  // console.log(await handle.result()); // Hello, Temporal!
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
// @@@SNIPEND