require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path'); // Added for serving static files

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
async function startServer() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables.");
    }
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');

    if (!SESSION_SECRET) {
      throw new Error("SESSION_SECRET is not defined in environment variables.");
    }

    // Session Middleware
    app.use(
      session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          mongoUrl: MONGO_URI,
        }),
        cookie: {
          maxAge: 1000 * 60 * 60 * 24,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        },
      })
    );

    // Serve static files (HTML, CSS, JS)
    app.use(express.static(path.join(__dirname))); // Serve files from the current directory

    // Sample Route
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'index.html')); // Serve your HTML file
    });

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Socket.IO Logic
    const roomMembers = {
      Crown: [],
      Plexiden: [],
    };

    io.on('connection', (socket) => {
      console.log('A user connected');

      socket.on('join request', ({ username, room }) => {
        if (room === 'Crown' || room === 'Plexiden') {
          io.emit('join request', { username, room, socketId: socket.id });
        }
      });

      socket.on('approve join', ({ username, room, socketId }) => {
        roomMembers[room].push(username);
        io.to(socketId).emit('join approved', { room });
        io.emit('chat message', {username : "Server", message: `${username} has joined ${room}`})
      });

      socket.on('deny join', ({ username, room, socketId }) => {
        io.to(socketId).emit('join denied', { room });
      });

      socket.on('chat message', ({ username, message, room }) => {
        if (room === 'Public' || roomMembers[room].includes(username)) {
          io.emit('chat message', { username, message });
        }
      });

      socket.on('disconnect', () => {
        console.log('A user disconnected');
      });
    });
  } catch (err) {
    console.error('Server error:', err);
  }
}

startServer();