import fetch, { Response } from "node-fetch";
import * as querystring from "querystring";

type ShotData = {
    [K in
        | "espresso_flow"
        | "espresso_flow_goal"
        | "espresso_flow_weight"
        | "espresso_flow_weight_raw"
        | "espresso_weight"
        | "espresso_pressure"
        | "espresso_pressure_goal"
        | "espresso_resistance"
        | "espresso_resistance_weight"
        | "espresso_state_change"
        | "espresso_temperature_basket"
        | "espresso_temperature_goal"
        | "espresso_temperature_mix"
        | "espresso_water_dispensed"]: number[];
};

export interface ShotId {
    clock: number;
    id: string;
}

export interface Shot {
    id: string;
    start_time: string;
    profile_title: string;
    user_id: string;
    drink_weight: number;
    timeframe: number[];
    image_preview: string;
    data: ShotData;
}

export async function getShots(limit: number): Promise<ShotId[]> {
    const params = { limit: limit.toString() };
    return makeVisualizerRequest("/api/shots", params).then((resp) => resp.json());
}

export async function getShot(id: string): Promise<Shot> {
    const endpoint = `/api/shots/${id}/download`;
    return makeVisualizerRequest(endpoint)
        .then((resp) => resp.json())
        .then((body) => {
            const {
                timeframe,
                drink_weight: drinkWeight,
                data: espressoData,
            }: {
                timeframe: string[];
                drink_weight: string;
                data: { [k: string]: string[] };
            } = body;
            return {
                id,
                ...body,
                ...{
                    drink_weight: parseFloat(drinkWeight),
                    timeframe: parseStringTimeSeries(timeframe),
                    data: Object.entries(espressoData).reduce(
                        (acc: Record<string, number[]>, [key, value]) => {
                            acc[key] = parseStringTimeSeries(value);
                            return acc;
                        },
                        {}
                    ),
                },
            };
        });
}

export function getExtractionTime({ timeframe }: Shot): number {
    return timeframe?.pop() || 0;
}

function parseStringTimeSeries(data: string[]): number[] {
    return data.map((x) => parseFloat(x));
}

async function makeVisualizerRequest(
    endpoint: string,
    queryParams?: Record<string, string>
): Promise<Response> {
    const method = "GET";
    const { VISUALIZER_BASE_URL } = process.env;
    const qs = queryParams ? `?${querystring.stringify(queryParams)}` : "";
    const url = VISUALIZER_BASE_URL + endpoint + qs;
    const headers = { Authorization: authHeader() };
    return fetch(url, { method, headers }).then((resp) => {
        if (!resp.ok) {
            console.error(`${method} ${endpoint}: ${resp.status} ${resp.statusText}`);
        }
        return resp;
    });
}

function authHeader(): string {
    const { VISUALIZER_USER, VISUALIZER_PASSWORD } = process.env;
    const basicAuth = `${VISUALIZER_USER}:${VISUALIZER_PASSWORD}`;
    const token = Buffer.from(basicAuth).toString("base64");
    return `Basic ${token}`;
}
