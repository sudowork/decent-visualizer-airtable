import { strict as assert } from "assert";
import { createHmac } from "crypto";

const HMAC_DELIMITER = "!";

export type HttpEvent = {
    body?: string;
    headers: { [k: string]: string };
    httpMethod: string;
    path: string;
    requestContext: {
        path: string;
        resourcePath: string;
    };
};

export function isHttpEvent(event: object | string): event is HttpEvent {
    return typeof event === "object" && "httpMethod" in event;
}

export function checkHMACAuth(event: HttpEvent): boolean {
    const authHeader = parseAuthHeader(event);
    if (!authHeader) {
        return false;
    }
    const { signature } = authHeader;
    const expectedSignature = hmacSignature(event);
    if (signature !== expectedSignature) {
        console.error(`HMAC signature did not match expected: ${signature}`);
        return false;
    }
    return true;
}

function hmacSignature(event: HttpEvent): string {
    const { HMAC_SECRET } = process.env;
    if (!HMAC_SECRET) {
        console.error("HMAC_SECRET not found in environment");
        return "";
    }
    const authHeader = parseAuthHeader(event);
    assert(!!authHeader);

    const hmac = createHmac("sha256", HMAC_SECRET);
    const { clock } = authHeader;
    const { body, requestContext } = event;
    const { resourcePath } = requestContext;
    const message = `${resourcePath}\n${clock}\n${body}`;
    hmac.update(message);
    return hmac.digest("hex");
}

function parseAuthHeader(event: HttpEvent): { clock: string; signature: string } | undefined {
    const { headers } = event;
    // Authorization: clock!SHA256(secret, `$path\n$clock\n$body`)
    const { Authorization: authHeader } = headers;
    if (!authHeader) {
        console.error("No Authorization Header found.");
        return;
    }
    const parts = authHeader.split(HMAC_DELIMITER);
    if (parts.length !== 2) {
        console.error("Invalid number of parts in Authorization header");
        return;
    }
    const [clock, signature] = parts;
    // eslint-disable-next-line consistent-return
    return { clock, signature };
}
