const WebSocket = require('ws');
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://Payingguest:alankarvp100@cluster0.tfrej4l.mongodb.net/Payingguest?retryWrites=true&w=majority'; // Update with your MongoDB connection string if using cloud
const dbName = 'chatApp';
const collectionName = 'messages';
let db;

async function connectToMongoDB() {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db(dbName);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

async function startServer() {
    await connectToMongoDB();
    const wss = new WebSocket.Server({ port: 8080 });

    wss.on('connection', async (ws) => {
        console.log('New client connected');

        // Send chat history to the new client
        try {
            const messages = await db.collection(collectionName)
                .find()
                .sort({ timestamp: -1 })
                .limit(50)
                .toArray();
            ws.send(JSON.stringify({ type: 'history', messages }));
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data);
                console.log('Received:', message);

                if (message.type === 'join') {
                    console.log(`${message.username} joined the chat`);
                } else if (message.type === 'message') {
                    // Save message to MongoDB
                    await db.collection(collectionName).insertOne({
                        username: message.username,
                        message: message.message,
                        timestamp: new Date()
                    });

                    // Broadcast message to all clients
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'message',
                                username: message.username,
                                message: message.message
                            }));
                        }
                    });
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    wss.on('error', (error) => {
        console.error('Server error:', error);
    });

    console.log('WebSocket server running on ws://localhost:8080');
}

startServer();