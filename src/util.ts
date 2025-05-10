import { inspect } from "util";

async function fetchTrackInfo(token: string, trackId: string): Promise<{ preview_url?: string, title: string } | 401> {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}?market=us`, {headers: {Authorization: `Bearer ${token}`}});
    if (!response.ok) {
        if (response.status == 401) {
            return 401;
        }
        throw new Error(`Failed to fetch track preview for ${trackId}: ${response.status}\n${await getErrorMessage(response)}`);
    }

    const json = await response.json() as { preview_url?: string, available_markets?: string, name: string };
    if (!json.preview_url) {
        console.debug("Null preview_url for " + trackId, json.available_markets);
    }
    return { preview_url: json.preview_url, title: json.name };
}

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<{token: string, expire_seconds: number}> {
    const body = new URLSearchParams();
    body.append("grant_type", "client_credentials");

    const headers = {
        method: "POST",
        headers: {
            "Authorization": "Basic " + (Buffer.from(clientId + ":" + clientSecret).toString("base64")),
            "content-type": "application/x-www-form-urlencoded"
        }
    };

    const response = await fetch("https://accounts.spotify.com/api/token", {...headers, body: body.toString()});

    if (!response.ok) {
        throw new Error(await getErrorMessage(response));
    }

    const res = await response.json() as { expires_in: number, access_token: string };
    
    console.info(`Obtained new spotify access token, expires in ${res.expires_in}s`);

    return { token: res.access_token, expire_seconds: res.expires_in };
}

async function getErrorMessage(response: Response) {
    return response.headers.get("content-type") === "application/json" ? inspect(await response.json()) : await response.text();
}

export { getErrorMessage, getSpotifyToken, fetchTrackInfo };