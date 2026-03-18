import { createApp } from "./app";
import { env } from "./config/env";
import { initFirebaseAdmin } from "./config/firebase";

initFirebaseAdmin();

const app = createApp();

app.listen(env.port, () => {
  console.log(`gridbox-api running on port ${env.port}`);
});
