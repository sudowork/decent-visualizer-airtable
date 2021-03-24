import * as util from "util";
import Airtable from "airtable";
import Table from "airtable/lib/table";
import AirtableRecord from "airtable/lib/record";
import { getShots, getShot, Shot, getExtractionTime, getPreviewImage } from "./lib/visualizer";

const SHOTS_PER_BATCH = 5;
const LOG_TABLE = "Decent Espresso Log";
const FIELD_NAMES = {
    ID: "Shot Id",
    DATETIME: "Date/Time",
    URL: "Visualizer URL",
    PROFILE: "Decent Espresso Profile",
    YIELD: "Yield (g)",
    EXTRACTION_TIME: "Total Extraction Time",
    MACHINE: "Coffee Machine",
    GRINDER: "Grinder",
    ATTACHMENTS: "Attachments",
};

module.exports.coffeeSync = async (event: string) => {
    if (process.env.TEST_SHOT) {
        const testRecord = (await uploadShots([process.env.TEST_SHOT]))[0];
        console.log(JSON.stringify({ id: testRecord.getId(), fields: testRecord.fields }, null, 2));
        return createResponse(200, "ok", event);
    }

    try {
        const missingShotIds = await findMissingShots();
        if (missingShotIds.length === 0) {
            console.log("Found no missing shots. Exiting.");
            return createResponse(200, "Shots are synchronized.", event);
        }

        const uploadedRecords = await uploadShots(missingShotIds);
        const uploadedShotIds = uploadedRecords.map(
            (record) => `${record.get(FIELD_NAMES.ID)} (${record.getId()})`
        );
        const message = `Uploaded ${uploadedShotIds.length} shots:\n${uploadedShotIds.join("\n")}`;
        console.log(message);
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
        fields: [FIELD_NAMES.ID],
        sort: [{ field: FIELD_NAMES.DATETIME, direction: "desc" }],
    });
    const runQuery = util.promisify(query.firstPage);
    return runQuery().then((records) => records?.map((record) => record.get(FIELD_NAMES.ID)) ?? []);
}

async function uploadShots(shotIds: string[]): Promise<AirtableRecord[]> {
    const shots = await Promise.all(shotIds.map(getShot));
    const previewImages = await Promise.all(shotIds.map(getPreviewImage));
    const shotRecords = shots.map((shot, i) => shotToRecord(shot, previewImages[i]));
    if (process.env.DEBUG) {
        console.log(`Would create the following records: ${JSON.stringify(shotRecords, null, 2)}`);
        return shotRecords.map(
            (shotRecord) => new AirtableRecord(logTable(), "fake_id", shotRecord)
        );
    }
    const createRecords: (
        rows: {
            fields: Record<string, any>;
        }[]
    ) => Promise<AirtableRecord[]> = util.promisify(logTable().create);
    return createRecords(shotRecords);
}

function shotToRecord(shot: Shot, previewImage: string | null): { fields: Record<string, any> } {
    const { VISUALIZER_BASE_URL, FIELD_COFFEE_MACHINE, FIELD_GRINDER } = process.env;
    const record: { fields: Record<string, any> } = {
        // These map to Airtable fields
        fields: {
            [FIELD_NAMES.ID]: shot.id,
            [FIELD_NAMES.URL]: `${VISUALIZER_BASE_URL}/shots/${shot.id}`,
            [FIELD_NAMES.PROFILE]: shot.profile_title,
            [FIELD_NAMES.DATETIME]: shot.start_time,
            [FIELD_NAMES.YIELD]: shot.drink_weight,
            [FIELD_NAMES.EXTRACTION_TIME]: getExtractionTime(shot),
            [FIELD_NAMES.MACHINE]: [FIELD_COFFEE_MACHINE],
            [FIELD_NAMES.GRINDER]: [FIELD_GRINDER],
        },
    };
    if (previewImage) {
        const imageId = previewImage.split("/").pop();
        record.fields[FIELD_NAMES.ATTACHMENTS] = [
            { filename: `${imageId}.png`, url: previewImage },
        ];
    }
    return record;
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
