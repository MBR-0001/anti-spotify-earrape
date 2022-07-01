"use strict";
const cwd = import.meta.url.replace("file://", "").replace(/\/index.(j|t)s/g, "");
process.chdir(cwd);

import Discord from "discord.js";
import "dotenv/config";
import fetch from "node-fetch";
import { fetchTrackInfo, getSpotifyToken } from "./util.js";

const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES"],
    partials: ["MESSAGE"]
});

if (!process.env.BOT_TOKEN) {
    console.error("No bot token");
    process.exit(1);
}

if (!process.env.SPOTIFY_CLIENT_ID) {
    console.error("No spotify client id");
    process.exit(1);
}

if (!process.env.SPOTIFY_CLIENT_SECRET) {
    console.error("No spotify client secret");
    process.exit(1);
}

client.login(process.env.BOT_TOKEN);

client.on("ready", c => console.log(c.user?.tag + " is ready!"));

let spotifyToken = "";
const handledMessages = [] as string[];

client.on("messageCreate", handleMessage);
client.on("messageUpdate", async (_, msg) => {
    if (msg.partial) msg = await msg.fetch();
    handleMessage(msg);
});

async function handleMessage(msg: Discord.Message) {
    if (!msg.guild?.me || (msg.channel.type != "GUILD_TEXT" && msg.channel.type != "GUILD_PUBLIC_THREAD")) return;

    const perms = msg.channel.permissionsFor(msg.guild.me);
    if (!perms.has("SEND_MESSAGES") || !perms.has("ATTACH_FILES")) return;

    if (!msg.content.match(/open.spotify.com\/track\//gi) || handledMessages.includes(msg.id)) return;
    
    const files = [] as Discord.MessageAttachment[];

    for (const embed of msg.embeds) {
        if (!embed.url?.startsWith("https://open.spotify.com/track/")) continue;

        // handle attachment limit and 8 MiB limit
        const max = 8 * 1024 * 1024 - 8192; // payload_json and stuff? shrug

        if (files.length == 10 || files.map(x => (x.attachment as Buffer)?.byteLength ?? 0).reduce((a, b) => a + b, 0) >= max) {
            continue;
        }
        
        const trackId = new URL(embed.url).pathname.replace("/track/", ""); // remove ?si= bs

        const info = await fetchTrackInfoSimple(trackId).catch(console.error);
        if (!info?.preview_url) continue;

        const res = await fetch(info.preview_url);
        if (!res.ok) {
            console.error(`Failed to fetch file from preview url for ${info.preview_url} for ${trackId}`);
            continue;
        }

        const ctype = res.headers.get("content-type");
        const ext = ctype == "audio/mpeg" ? "mp3" : null;

        if (ext == null) {
            console.error("Failed to identify extension for " + ctype + " from " + info.preview_url);
            continue;
        }

        const buff = Buffer.from(await res.arrayBuffer());
        files.push(new Discord.MessageAttachment(buff, `Preview_${info.title.substr(0, 30)}.${ext}`));
    }

    if (files.length == 0) return;

    msg.channel.send({
        files,
        reply: { messageReference: msg }
    });

    handledMessages.push(msg.id);
}

async function fetchTrackInfoSimple(track: string, secondAttempt = false): Promise<{ preview_url?: string, title: string }> {
    if (!spotifyToken) {
        await initSpotifyToken();
    }

    const res = await fetchTrackInfo(spotifyToken, track);
    if (res == 401) {
        if (!secondAttempt) {
            spotifyToken = "";
            return await fetchTrackInfoSimple(track, true);
        }
        throw new Error(`[Simple] Failed to fetch track preview for ${track}: 401`);
    }

    return res;
}

async function initSpotifyToken() {
    const d = await getSpotifyToken(process.env.SPOTIFY_CLIENT_ID!, process.env.SPOTIFY_CLIENT_SECRET!);
    spotifyToken = d.token;
    // I'm too cool to renew tokens 😎
    setTimeout(() => spotifyToken = "", d.expire_seconds * 1000);
}
initSpotifyToken();

process.on("uncaughtException", error => {
    console.error("Uncaught Exception", error);
    process.exit(2);
});

process.on("unhandledRejection", error => console.error("Unhandled Rejection", error));
