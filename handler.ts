import * as util from "util";
import Airtable from "airtable";
import Table from "airtable/lib/table";
import { getShots } from "./lib/visualizer";

const SHOTS_PER_BATCH = 5;
const LOG_TABLE = "Decent Espresso Log";

module.exports.coffeeSync = async (event: string) => {
    try {
        const missingShotIds = await findMissingShots();
        const message = `Uploaded ${missingShotIds.length} shots:\n${missingShotIds.join("\n")}`;
        return createResponse(200, message, event);
    } catch (err) {
        console.error(err);
        return createResponse(500, err?.message || "An unknown error occurred.", event);
    }
};

async function findMissingShots(): Promise<string[]> {
    const visualizerShotIds = await (await getShots(SHOTS_PER_BATCH)).map(({ id }) => id);
    console.debug(`Found visualizer shots: ${visualizerShotIds}`);
    const airtableShotIds = await getAirtableShotIds(SHOTS_PER_BATCH * 2);
    console.debug(`Latest airtable shots: ${airtableShotIds}`);
    const found = new Set(airtableShotIds);
    return visualizerShotIds.filter((id) => !found.has(id));
}

async function getAirtableShotIds(last: number): Promise<string[]> {
    const query = logTable().select({
        maxRecords: last,
        fields: ["Shot Id"],
        sort: [{ field: "Date/Time", direction: "desc" }],
    });
    const runQuery = util.promisify(query.firstPage);
    return runQuery().then((records) => records?.map((record) => record.getId()) ?? []);
}

function logTable(): Table {
    return getCoffeeTable(LOG_TABLE);
}

function getCoffeeTable(tableName: string): Table {
    const { AIRTABLE_BASE } = process.env;
    if (!AIRTABLE_BASE) {
        throw new Error("AIRTABLE_BASE environment variable not defined.");
    }
    // Note: Auth is derived from env variable AIRTABLE_API_KEY automatically.
    return Airtable.base(AIRTABLE_BASE).table(tableName);
}

function createResponse(statusCode: number, message: string, event: any) {
    return { statusCode, body: JSON.stringify({ message, input: event }, null, 2) };
}
