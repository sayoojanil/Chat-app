const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// MongoDB connection with enhanced error handling
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Payingguest:alankarvp100@cluster0.tfrej4l.mongodb.net/Payingguest?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Timeout after 5 seconds
}).then(() => {
    console.log('Successfully connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection failed:', err.message);
    if (err.name === 'MongoServerSelectionError') {
        console.error('Ensure MongoDB is running on localhost:27017 or update MONGO_URI');
    } else if (err.name === 'MongoNetworkError') {
        console.error('Check your network connection or MongoDB server status');
    }
    process.exit(1); // Exit if MongoDB connection fails
});

// Message schema
const messageSchema = new mongoose.Schema({
    username: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));

io.on('connection', async (socket) => {
    console.log('New user connected:', socket.id);

    // Send stored messages to new user
    try {
        const messages = await Message.find().sort({ timestamp: 1 }).limit(50);
        socket.emit('loadMessages', messages);
        console.log(`Sent ${messages.length} stored messages to client ${socket.id}`);
    } catch (err) {
        console.error('Error fetching messages:', err.message);
        socket.emit('error', { message: 'Failed to load previous messages' });
    }

    socket.on('chatMessage', async ({ username, message }) => {
        const newMessage = new Message({
            username: username || socket.id,
            message,
            timestamp: new Date()
        });

        try {
            await newMessage.save();
            io.emit('message', {
                username: newMessage.username,
                message: newMessage.message,
                timestamp: newMessage.timestamp
            });
            console.log(`Message saved from ${newMessage.username}`);
        } catch (err) {
            console.error('Error saving message:', err.message);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));