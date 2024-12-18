const express = require('express');
const mongoose = require('mongoose');
const { sendMail } = require('./util/mail-service');
const redis = require('redis');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

const redisClient = redis.createClient({
    socket: {
        host: 'redis-10587.c82.us-east-1-2.ec2.redns.redis-cloud.com',
        port: 10587,
    },
    password: '1nJOI3fX6GoVDgSolIved1I9X35h1PMt',
    username: 'default',
});

(async () => {
    await redisClient.connect();
    console.log('Connected to Redis');
})();


const THRESHOLD = 5;
const WINDOW = 10 * 60; // 10 minutes

app.use(bodyParser.json());

const url = "mongodb+srv://newuser:P2kSFyK8NBcwPQla@cluster0.e0b6htt.mongodb.net/academically?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const failedRequestSchema = new mongoose.Schema({
    ip: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, required: true },
});
const FailedRequest = mongoose.model('FailedRequest', failedRequestSchema);

app.post('/api/submit', async (req, res) => {
    const ip = req.ip;
    const accessToken = req.headers['authorization'];

    if (!accessToken || accessToken !== 'expected_token') {
        const failedRequest = new FailedRequest({
            ip,
            reason: 'Invalid access token or headers',
        });
        await failedRequest.save();

        const recentFailures = await FailedRequest.find({
            ip,
            timestamp: { $gte: new Date(Date.now() - WINDOW * 1000) },
        });

        const failedAttempts = recentFailures.length;
        console.log("Failed attempts for IP", ip, ":", failedAttempts);

        await redisClient.set(ip, failedAttempts, 'EX', WINDOW); 

        const emailSentKey = `${ip}-email-sent`;
        const emailSentTimestamp = await redisClient.get(emailSentKey);
        const currentTime = Date.now();
        const windowInMillis = WINDOW * 1000; 

        if (!emailSentTimestamp || currentTime - emailSentTimestamp > windowInMillis) {
            if (failedAttempts >= THRESHOLD) {
                sendMail(
                    'sureshk28591@gmail.com',
                    'Alert: Failed POST Requests Exceeded Threshold',
                    `The IP address ${ip} has exceeded the threshold of ${THRESHOLD} failed POST requests.`
                );

                await redisClient.set(emailSentKey, currentTime.toString(), 'EX', WINDOW); 
                console.log("Email sent!");

                await redisClient.del(ip); 
            } else {
                console.log("Threshold not reached. Email not sent.");
            }
        } else {
            console.log("Email already sent within the last 10 minutes.");
        }

        return res.status(400).json({ error: 'Invalid access token or headers' });
    }

    return res.status(200).json({ message: 'Request processed successfully' });
});

app.get('/metrics', async (req, res) => {
    try {
        const failedRequests = await FailedRequest.find();
        return res.status(200).json(failedRequests);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(5000, () => console.log('Server running on port 5000'));
