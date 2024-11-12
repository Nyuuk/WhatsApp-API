// @@@SNIPSTART typescript-hello-worker
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

import dotenv from "dotenv";
dotenv.config();


async function run() {
  // Step 1: Establish a connection with Temporal server.
  //
  // Worker code uses `@temporalio/worker.NativeConnection`.
  // (But in your application code it's `@temporalio/client.Connection`.)
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS,
    // TLS and gRPC metadata configuration goes here.
  });
  // Step 2: Register Workflows and Activities with the Worker.
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE,
    taskQueue: process.env.TEMPORAL_TASKQUEUE || "whatsapp-adnan",
    // Workflows are registered using a path as they run in a separate JS context.
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  // Step 3: Start accepting tasks on the `hello-world` queue
  //
  // The worker runs until it encounters an unexpected error or the process receives a shutdown signal registered on
  // the SDK Runtime object.
  //
  // By default, worker logs are written via the Runtime logger to STDERR at INFO level.
  //
  // See https://typescript.temporal.io/api/classes/worker.Runtime#install to customize these defaults.
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
// @@@SNIPEND
