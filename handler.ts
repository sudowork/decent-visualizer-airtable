import { getShots } from "./lib/visualizer";

const SHOTS_PER_BATCH = 5;

module.exports.coffeeSync = async (event: string) => {
    const shots = await getShots(SHOTS_PER_BATCH);
    console.log(shots);
    return {
        statusCode: 200,
        body: JSON.stringify(
            {
                message: "Go Serverless v1.0! Your function executed successfully!",
                input: event,
            },
            null,
            2
        ),
    };
};
