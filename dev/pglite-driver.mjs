/* The database driver for local testing: PGlite (Postgres in WebAssembly),
   with the same two calls as the Neon driver in api/_lib/db.js. */

import { PGlite } from "@electric-sql/pglite";

export async function makeDriver(dir = null) {
  const pg = dir ? new PGlite(dir) : new PGlite();
  await pg.waitReady;
  /* PGlite runs one statement at a time; queue calls so a transaction is
     never interleaved with another caller's statements (Neon gives every
     transaction its own connection). */
  let chain = Promise.resolve();
  const serial = fn => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  return {
    pg,
    query: (text, params = []) => serial(async () => (await pg.query(text, params)).rows),
    tx: queries => serial(() => pg.transaction(async t => {
      const out = [];
      for (const [text, params = []] of queries) out.push((await t.query(text, params)).rows);
      return out;
    }))
  };
}
