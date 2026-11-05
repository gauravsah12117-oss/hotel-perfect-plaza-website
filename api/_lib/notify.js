/* Every message about attendance goes out here: as an app notification
   (push.js) to the phones that turned them on, and on Telegram
   (telegram.js) if the bot is set up. Either, both, or neither. */

import { sendAll, telegramReady } from "./telegram.js";
import { pushAll, pushReady } from "./push.js";

export const notifyReady = () => telegramReady() || pushReady();

export async function notifyAll(text) {
  const [tg, push] = await Promise.all([
    sendAll(text).catch(e => { console.error("telegram", e); return 0; }),
    pushAll(text).catch(e => { console.error("push", e); return 0; })
  ]);
  return tg + push;
}
