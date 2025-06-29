import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

import { ddbClient } from "./ddbClient.js";
import { valKeyClient } from "./valKeyClient.js";

// --- Constants ---
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE;
const LEADERBOARD_ID = "GlobalLeaderboard";
const TOP_N_LIMIT = 10;

// HighScoreStates for DynamoDB update outcome
const HighScoreStates = Object.freeze({
    FAILED: "FAILED",
    NOT_HIGHSCORE: "NOT_HIGHSCORE",
    NEW_HIGHSCORE: "NEW_HIGHSCORE",
});

export const handler = async (event) => {
    try {
        const payload = JSON.parse(event.body);
        const { username, score } = payload;

        if (typeof username === 'undefined' || typeof score === 'undefined') {
            throw new Error("Username and score are required.");
        }

        const scoreInt = parseInt(score);
        if (isNaN(scoreInt)) {
            throw new Error("Score must be a valid number.");
        }

        // console.log("valkey client: ", valKeyClient);

        // Update player's high score in DynamoDB
        const highScoreUpdatedState = await updatePlayerHighScore(LEADERBOARD_ID, username, scoreInt);
        if (highScoreUpdatedState.state === HighScoreStates.FAILED) {
            throw new Error(highScoreUpdatedState.message || "Failed to update high score in DynamoDB.");
        }

        // Update Valkey leaderboard and get status
        const leaderboardStatus = await updateLB(LEADERBOARD_ID, username, scoreInt, TOP_N_LIMIT);

        const responseBody = {
            message: "Score submitted successfully!",
            highScoreStatus: highScoreUpdatedState.state,
            leaderboardOutcome: leaderboardStatus
        };

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(responseBody)
        };

    } catch (error) {
        console.error("Error processing request:", error);
        const errorMessage = error.message || "An unexpected error occurred.";
        const statusCode = (error.message && (error.message.includes("required") || error.message.includes("number"))) ? 400 : 500;

        return {
            statusCode: statusCode,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: errorMessage })
        };
    }
};


/**
 * Updates a player's high score in DynamoDB.
 */
async function updatePlayerHighScore(leaderboardId, username, score) {
    const returnValue = { state: HighScoreStates.FAILED, message: null };

    try {
        const PK = `LB#${leaderboardId}`;
        const SK = `USER#${username}`;

        const input = {
            Key: marshall({ PK, SK }),
            ExpressionAttributeNames: { "#score": "HighScore", "#lastUpdated": "LastUpdated" },
            ExpressionAttributeValues: marshall({ ":newScore": score, ":currentTime": Date.now() }),
            ConditionExpression: "#score < :newScore OR attribute_not_exists(#score)",
            UpdateExpression: "SET #score = :newScore, #lastUpdated = :currentTime",
            TableName: DYNAMODB_TABLE_NAME
        };

        const command = new UpdateItemCommand(input);
        await ddbClient.send(command);

        returnValue.state = HighScoreStates.NEW_HIGHSCORE;
    } catch (error) {
        console.error(`Error in updatePlayerHighScore for ${username}:`, error);
        const errorType = error["__type"];
        if (errorType && errorType.includes("ConditionalCheckFailedException")) {
            returnValue.state = HighScoreStates.NOT_HIGHSCORE;
            returnValue.message = "Score was not a new high score.";
        } else {
            returnValue.state = HighScoreStates.FAILED;
            returnValue.message = error.message || "An error occurred while updating high score in DDB.";
        }
    }
    return returnValue;
}

/**
 * Updates the Valkey leaderboard and determines the user's outcome (top N, rank, message).
 */
async function updateLB(leaderBoardID, username, score, limit) {
    const leaderboardKey = `leaderboard:${leaderBoardID}`;
    let outcome = {
        madeTopN: false,
        rank: null,
        tenthPlaceScore: null,
        message: "Keep practicing! You can do it!"
    };

    try {
        await valKeyClient.zadd(leaderboardKey, score, username);

        // Trim the leaderboard to keep only the top 'limit' entries
        await valKeyClient.zremrangebyrank(leaderboardKey, 0, -(limit + 1));

        // Get the player's current rank (0-based)
        const currentRank = await valKeyClient.zrevrank(leaderboardKey, username);

        if (currentRank !== null && currentRank < limit) {
            outcome.madeTopN = true;
            outcome.rank = currentRank + 1; // Convert to 1-based rank
            outcome.message = `Congratulations! You are #${outcome.rank} on the leaderboard!`;

            const topNthPlayerRaw = await valKeyClient.zrange(leaderboardKey, limit - 1, limit - 1, "WITHSCORES");
            if (topNthPlayerRaw && topNthPlayerRaw.length >= 2) {
                outcome.tenthPlaceScore = parseInt(topNthPlayerRaw[1]);
            }

        } else {
            outcome.madeTopN = false;
            outcome.rank = null;

            const tenthPlayerRaw = await valKeyClient.zrange(leaderboardKey, -limit, -limit, "WITHSCORES");
            if (tenthPlayerRaw && tenthPlayerRaw.length >= 2) {
                outcome.tenthPlaceScore = parseInt(tenthPlayerRaw[1]);
                outcome.message = `Great effort! The ${limit}th place score is ${outcome.tenthPlaceScore}. Keep going!`;
            } else {
                outcome.tenthPlaceScore = 0;
                outcome.message = `The leaderboard is still filling up! Be the first to reach the top!`;
            }
        }
        return outcome;

    } catch (error) {
        console.error(`Error in updateLB for ${username}:`, error);
        return {
            madeTopN: false,
            rank: null,
            tenthPlaceScore: null,
            message: "Failed to update leaderboard. Please try again.",
            error: error.message
        };
    }
}