const express = require('express');
     const http = require('http');
     const socketIo = require('socket.io');
     const mongoose = require('mongoose');
     const path = require('path');

     const app = express();
     const server = http.createServer(app);
     const io = socketIo(server, {
         cors: {
             origin: process.env.NODE_ENV === 'production' ? ['https://your-render-app.onrender.com'] : '*',
             methods: ['GET', 'POST']
         }
     });

     // MongoDB connection
     const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatApp';
     mongoose.connect(MONGO_URI, {
         useNewUrlParser: true,
         useUnifiedTopology: true,
         serverSelectionTimeoutMS: 5000
     }).then(() => {
         console.log('Successfully connected to MongoDB');
     }).catch(err => {
         console.error('MongoDB connection failed:', err.message);
         process.exit(1);
     });

     // Message schema
     const messageSchema = new mongoose.Schema({
         username: String,
         message: String,
         timestamp: { type: Date, default: Date.now }
     });
     const Message = mongoose.model('Message', messageSchema);

     // Serve static files
     app.use(express.static(path.join(__dirname, 'public')));

     // Serve index.html for root route
     app.get('/', (req, res) => {
         res.sendFile(path.join(__dirname, 'public', 'index.html'));
     });

     io.on('connection', async (socket) => {
         console.log('New user connected:', socket.id);

         // Send stored messages
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