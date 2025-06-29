import { valKeyClient } from "./valKeyClient.js";

// --- Constants ---
const LEADERBOARD_ID = "GlobalLeaderboard"; 
const TOP_N_LIMIT = 10; 

export const handler = async (event) => {
    try {
        // 1. Construct the Valkey key for this specific leaderboard
        const leaderboardKey = `leaderboard:${LEADERBOARD_ID}`;

        // 2. Get top N scores from Valkey
        // ZREVRANGE to get elements in descending order (highest score first)
        // WITHSCORES to get both member (username) and score
        const rawLeaderboardData = await valKeyClient.zrevrange(leaderboardKey, 0, TOP_N_LIMIT - 1, "WITHSCORES");

        // 3. Format the data into an array of objects (username, score, rank)
        const formattedLeaderboard = [];
        for (let i = 0; i < rawLeaderboardData.length; i += 2) {
            formattedLeaderboard.push({
                username: rawLeaderboardData[i],         // The member from Valkey
                score: parseInt(rawLeaderboardData[i + 1]), // The score from Valkey
                rank: (i / 2) + 1                       // Calculate 1-based rank
            });
        }

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", 
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formattedLeaderboard)
        };

    } catch (error) {
        console.error("Error retrieving leaderboard:", error);
        const errorMessage = error.message || "An unexpected error occurred.";

        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: errorMessage })
        };
    }
};