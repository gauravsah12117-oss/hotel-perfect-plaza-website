/* A pretend ZKTeco fingerprint machine, for trying attendance.html on this
   computer: it talks to the site exactly as the real machine does.

     npm run dev                              (in one window)
     node dev/fake-machine.mjs                connect: appears in Settings, to approve
     node dev/fake-machine.mjs 5              staff no. 5 puts their finger on it now
     node dev/fake-machine.mjs 5 "2026-11-05 09:12:00"   …at that time
     node dev/fake-machine.mjs enroll 5 "Ram Sah"        a new person enrolled
     node dev/fake-machine.mjs demo           a week of punches for 6 people

   Options: SITE=https://… (default http://localhost:3000), SN=… */

const SITE = process.env.SITE || "http://localhost:" + (process.env.PORT || 3000);
const SN = process.env.SN || "TEST0000000001";
const nowNepal = () => new Date(Date.now() + 345 * 60000).toISOString().slice(0, 19).replace("T", " ");

async function send(op, query = {}, body) {
  const url = `${SITE}/iclock/${op}?` + new URLSearchParams({ SN, ...query });
  const res = await fetch(url, body ? { method: "POST", body, headers: { "Content-Type": "text/plain" } } : {});
  const text = await res.text();
  return { status: res.status, text };
}

const [cmd, a, b] = process.argv.slice(2);
const hello = await send("cdata", { options: "all", pushver: "2.4.1", language: "69" });
if (hello.status !== 200) { console.error("The site didn't answer:", hello.status, hello.text); process.exit(1); }

if (!cmd) {
  console.log(hello.text.trim());
  console.log(`\nMachine ${SN} has called in. Approve it on attendance.html → Settings.`);
} else if (cmd === "enroll") {
  const r = await send("cdata", { table: "OPERLOG", Stamp: String(Date.now()) }, `USER PIN=${a}\tName=${b || ""}\tPri=0\tPasswd=\tCard=\tGrp=1\n`);
  console.log(r.status, r.text);
} else if (cmd === "demo") {
  /* the last 7 days; 6 people; some late, some overtime, one absent day */
  const people = [["1", "Ram Sah"], ["2", "Sita Kumari"], ["3", "Hari Yadav"], ["4", "Gita Mandal"], ["5", "Mohan Jha"], ["6", "Night guard"]];
  for (const [pin, name] of people) await send("cdata", { table: "OPERLOG", Stamp: "1" }, `USER PIN=${pin}\tName=${name}\tPri=0\n`);
  const lines = [];
  const at = (d, h, m) => { const t = new Date(Date.now() + 345 * 60000 - d * 86400000); t.setUTCHours(h, m, Math.floor(Math.random() * 60)); return t.toISOString().slice(0, 19).replace("T", " "); };
  for (let d = 7; d >= 1; d--) {
    for (const [pin] of people.slice(0, 5)) {
      if (pin === "4" && d === 3) continue;                                    /* absent */
      const late = Math.random() < .25 ? 10 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 9);
      const extra = Math.random() < .3 ? 30 + Math.floor(Math.random() * 90) : Math.floor(Math.random() * 15);
      lines.push(`${pin}\t${at(d, 8, 52 + late)}\t0\t1\t0`, `${pin}\t${at(d, 18, extra % 60)}\t1\t1\t0`.replace(/ 18:/, ` ${String(18 + Math.floor(extra / 60)).padStart(2, "0")}:`));
    }
    lines.push(`6\t${at(d, 19, 55)}\t0\t1\t0`, `6\t${at(d - 1, 8, 5)}\t1\t1\t0`);   /* the night shift */
  }
  const now = nowNepal();
  const r = await send("cdata", { table: "ATTLOG", Stamp: "2" }, lines.filter(l => l.split("\t")[1] <= now).join("\n") + "\n");
  console.log(r.status, r.text, `(${lines.length} punches)`);
} else {
  const r = await send("cdata", { table: "ATTLOG", Stamp: String(Date.now()) }, `${cmd}\t${a || nowNepal()}\t0\t1\t0\t0\t0\n`);
  console.log(r.status === 403 ? "Not approved yet: approve the machine on attendance.html → Settings." : `${r.status} ${r.text}`);
}
