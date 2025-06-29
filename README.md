# AWS-Lambda-Hackathon: Real-time Global Leaderboards on AWS Lambda

## 🏆 Unleash the Competition: Instant Leaderboard Updates for Your Game! 🏆

This project provides a robust, scalable, and cost-effective serverless backend solution for integrating real-time leaderboards into any game. Built entirely on AWS Lambda, DynamoDB, and Valkey (Redis), it offers immediate score updates and lightning-fast leaderboard retrieval, motivating players with dynamic ranking and encouraging messages.

---

## Table of Contents

1.  [Introduction](#1-introduction)
2.  [Features](#2-features)
3.  [AWS Architecture](#3-aws-architecture)
4.  [How It Works: Leveraging AWS Lambda](#4-how-it-works-leveraging-aws-lambda)
    * [Score Submission (`saveScore` Lambda)](#score-submission-savescore-lambda)
    * [Leaderboard Retrieval (`getLeaderboard` Lambda)](#leaderboard-retrieval-getleaderboard-lambda)
    * [Why AWS Lambda?](#why-aws-lambda)
5.  [AWS Tools Used](#5-aws-tools-used)
6.  [Setup & Deployment Guide](#6-setup--deployment-guide)
    * [Prerequisites](#prerequisites)
    * [Project Structure](#project-structure)
    * [Configuration](#configuration)
    * [Deployment Steps](#deployment-steps)
    * [Testing the API Endpoints](#testing-the-api-endpoints)
7.  [Future Enhancements](#7-future-enhancements)

---

## 1. Introduction

In competitive gaming, instant feedback on performance is key to player engagement. Traditional leaderboard systems can be complex to set up, scale, and maintain. AWS-Lambda-Hackathon tackles this by offering a fully serverless, highly performant, and cost-efficient backend. Players submit their scores, and within milliseconds, their position on the global leaderboard is updated, complete with encouraging messages if they don't hit the very top!

---

## 2. Features

* **Real-time Score Submission:** Players can submit their game scores via a REST API endpoint.
* **Persistent High Score Tracking:** Stores players' best scores reliably in a serverless NoSQL database.
* **Dynamic Top 10 Leaderboard:** Maintains and updates a live top 10 global leaderboard using an in-memory data store.
* **Motivational Feedback:** Provides instant feedback to players, including their rank if they make the top 10, or the 10th place score with an encouraging message if they don't.
* **Fast Leaderboard Retrieval:** Quickly fetches the current global top 10 for display in-game or on a web client.
* **Serverless Architecture:** Highly scalable, cost-effective (pay-per-execution), and requires zero server management.

---

## 3. AWS Architecture

The backbone of this project is a serverless architecture designed for high availability and low latency.

![Screenshot from 2025-06-29 11-47-02](https://github.com/user-attachments/assets/4fd79f95-8a71-4e5e-8424-0a81285170bc)


**Diagram Explanation:**

1.  **Client Application:** A game or web frontend interacts with the system.
2.  **Amazon API Gateway:** Acts as the single entry point for all API requests. It exposes RESTful endpoints for score submission and leaderboard retrieval.
3.  **AWS Lambda:**
    * `saveScore` Lambda function: Triggered by `POST /score` requests.
    * `getLeaderboard` Lambda function: Triggered by `GET /leaderboard` requests.
4.  **Amazon DynamoDB (`game-scores-table`):** A fully managed NoSQL database used for persistent storage of each player's individual highest score. This ensures data durability and accuracy over time.
5.  **Amazon ElastiCache for Redis (Valkey) (`realtime-leaderboard`):** A high-performance, in-memory data store used to maintain the real-time global top 10 leaderboard. Valkey's sorted sets are ideal for this ranking functionality, providing extremely fast read/write operations.
6.  **Amazon VPC:** Lambda functions are configured within a VPC to securely connect to the ElastiCache cluster.
7.  **Amazon CloudWatch Logs:** Provides logging and monitoring for all Lambda function executions.

---

## 4. How It Works: Leveraging AWS Lambda

AWS Lambda is at the core of this project, providing the serverless compute that orchestrates all interactions.

### Score Submission (`saveScore` Lambda)

* **Purpose:** Handles the submission of a player's score after a game.
* **Trigger:** An HTTP `POST` request to `/score` via API Gateway.
* **Flow:**
    1.  The Lambda receives `username` and `score` from the request body.
    2.  It calls an internal helper function (`updatePlayerHighScore`) to **persistently store the user's high score in DynamoDB (`game-scores-table`)**. This operation uses a conditional update to ensure that only a new, higher score is recorded.
    3.  It then calls another internal helper function (`updateLB`) to **update the real-time leaderboard in Valkey (`realtime-leaderboard`)**:
        * The player's score is added/updated in Valkey's sorted set.
        * The sorted set is immediately **trimmed to ensure only the top 10 scores** are maintained.
        * The player's new rank is determined.
        * A custom message is generated:
            * If the player makes it into the top 10, they receive a congratulatory message with their rank.
            * If they do not make the top 10, they receive a motivational message along with the score of the 10th place player, encouraging them to try again.
    4.  A JSON response is returned, indicating the success of the submission and the outcome on both DynamoDB and the Valkey leaderboard.

### Leaderboard Retrieval (`getLeaderboard` Lambda)

* **Purpose:** Provides the current global top 10 leaderboard to any requesting client.
* **Trigger:** An HTTP `GET` request to `/leaderboard` via API Gateway.
* **Flow:**
    1.  The Lambda directly queries the Valkey (`realtime-leaderboard`) sorted set for the top 10 entries (usernames and scores).
    2.  It then formats this raw data into a clean JSON array, including each player's username, score, and their 1-based rank.
    3.  This formatted leaderboard data is returned in the API response.
    * *(Note: For this simplified version, no additional user details are fetched from DynamoDB for the leaderboard display.)*

### Why AWS Lambda?

We chose AWS Lambda for its inherent benefits in a hackathon context and beyond:
* **Serverless:** No servers to provision, manage, or patch, allowing us to focus purely on game logic.
* **Scalability:** Automatically scales to handle any number of concurrent score submissions or leaderboard requests, perfect for fluctuating game traffic.
* **Cost-Effective:** Pay only for the compute time consumed, making it highly efficient for intermittent workloads.
* **Rapid Development:** Facilitates quick iteration and deployment, crucial for a hackathon.

---

## 5. AWS Tools Used

* **AWS Lambda:** Serverless compute for `saveScore` and `getLeaderboard` functions.
* **Amazon API Gateway:** RESTful API endpoints.
* **Amazon DynamoDB:** Persistent NoSQL database (`game-scores-table`).
* **Amazon ElastiCache for Redis (Valkey):** High-performance, in-memory data store for real-time leaderboard (`realtime-leaderboard`).
* **Amazon VPC:** Enables secure network connectivity between Lambda and ElastiCache.
* **AWS Identity and Access Management (IAM):** Manages permissions for Lambda to access other AWS services.
* **Amazon CloudWatch Logs:** Centralized logging and monitoring for Lambda functions.

---

## 6. Setup & Deployment Guide

Follow these steps to deploy and test the AWS-Lambda-Hackathon backend in your AWS account.

### Prerequisites

* An AWS Account
* AWS CLI configured with appropriate credentials
* Node.js (v20 or higher recommended) and npm installed
* An existing **DynamoDB Table** (e.g., `game-scores-table`)
    * Primary Key: `PK` (String)
    * Sort Key: `SK` (String)
* An existing **Amazon ElastiCache for Redis (Valkey) Cluster** (e.g., `realtime-leaderboard`)
    * Ensure it's in a VPC and accessible from the subnets/security groups where your Lambda functions will reside.
    * Make a note of its endpoint.

### Project Structure

The repository is structured as follows:
```
├── AWS-Lambda-Hackathon/
│   ├── saveScore/
│   │   ├── index.js          # saveScore Lambda handler
│   │   ├── ddbClient.js      # DynamoDB client initialization
│   │   ├── valKeyClient.js   # Valkey client initialization
│   │   └── package.json
│   └── getLeaderboard/
│       ├── index.js          # getLeaderboard Lambda handler
│       └── valKeyClient.js   # Valkey client initialization (reused)
│       └── package.json
├── README.md
└── .gitignore
```

### Configuration

You need to set up Environment Variables for your Lambda functions:

1.  **`DYNAMODB_TABLE`**: The exact name of your DynamoDB table (e.g., `game-scores-table`).
2.  **`VALKEY_URL`**: The endpoint (host) of your ElastiCache (Valkey) cluster (e.g., `my-cluster.xxxxx.0001.usw2.cache.amazonaws.com`).
3.  **`LEADERBOARD_ID`**: The identifier for your leaderboard (e.g., `GlobalLeaderboard`). This must match in both `saveScore` and `getLeaderboard`.
4.  **`AWS_REGION`**: The AWS region where you are deploying your resources (e.g., `ap-southeast-1`).

You can set these via the AWS Lambda console, AWS SAM templates, or CloudFormation.

### Deployment Steps

1.  **Clone the repository:**
    ```bash
    git clone [Your Repository URL]
    cd [Your Project Name]
    ```

2.  **Install Node.js dependencies for each Lambda function:**
    ```bash
    cd saveScore
    npm install
    cd ../getLeaderboard
    npm install
    ```

3.  **Package and Deploy Lambdas (Manual via AWS Console/CLI):**
    * For each Lambda (`saveScore`, `getLeaderboard`):
        * Zip the contents of its folder (e.g., for `saveScore`, zip `index.js`, `ddbClient.js`, `valKeyClient.js`, and the `node_modules` folder).
        * Upload the zip file to a new Lambda function in the AWS Console.
        * Configure the Runtime (Node.js 20.x recommended), Handler (`index.handler`).
        * Configure Environment Variables as described above.
        * **Crucially:** Set up appropriate IAM roles with permissions to `dynamodb:UpdateItem`, `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:BatchGetItem` (if added later), `elasticache:Connect` (or broader Redis permissions), and CloudWatch Logs.
        * **VPC Configuration:** For Lambdas to connect to ElastiCache, they MUST be configured within the same VPC and appropriate subnets/security groups as your ElastiCache cluster.
    * **Create API Gateway Endpoints:**
        * Create a new REST API in API Gateway.
        * Create a `POST /score` method pointing to your `saveScore` Lambda.
        * Create a `GET /leaderboard` method pointing to your `getLeaderboard` Lambda.
        * Enable CORS for both methods.
        * Deploy the API. Note down the Invoke URL.
          

### Testing the API Endpoints

Once deployed, you can test your API endpoints using `curl`, Postman, Insomnia, or your frontend application.

1.  **Submit a Score (POST request to `/score`):**
    ```bash
    curl -X POST \
      -H "Content-Type: application/json" \
      -d '{
        "username": "playerOne",
        "score": 1500
      }' \
      [Your API Gateway Invoke URL]/score
    ```
    Expected Response:
    ```json
    {
      "message": "Score submitted successfully!",
      "highScoreStatus": "NEW_HIGHSCORE", // or NOT_HIGHSCORE
      "leaderboardOutcome": {
        "madeTopN": true, // or false
        "rank": 1, // or null
        "tenthPlaceScore": null, // or a score if not in top 10
        "message": "Congratulations! You are #1 on the leaderboard!" // or a motivational message
      }
    }
    ```

2.  **Get Leaderboard (GET request to `/leaderboard`):**
    ```bash
    curl -X GET \
      [Your API Gateway Invoke URL]/leaderboard
    ```
    Expected Response:
    ```json
    [
      { "username": "playerOne", "score": 1500, "rank": 1 },
      { "username": "playerTwo", "score": 1200, "rank": 2 }
      // ... up to 10 entries
    ]
    ```

---

## 7. Future Enhancements

* **User Authentication:** Integrate AWS Cognito for secure player authentication and authorization.
* **Richer Player Profiles:** Store additional player metadata (avatar, display name, achievements) in DynamoDB and fetch them for the leaderboard.
* **Historical Leaderboards:** Implement daily/weekly/monthly leaderboards in addition to the all-time high score.
* **Admin Dashboard:** Create a separate frontend for game administrators to manage leaderboards or ban users.
* **Game State Validation:** Implement server-side validation of submitted scores against expected game states to prevent cheating.
* **WebSockets for Live Updates:** Use AWS IoT Core or API Gateway WebSockets to push live leaderboard updates to connected clients.
