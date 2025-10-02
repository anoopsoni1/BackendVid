import express from "express";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";

const app = express();
app.use(bodyParser.json());
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const emailTosocketmapping = new Map();
const sockettoemailmapping = new Map();

// Track users in rooms for 1-on-1
const rooms = new Map(); // roomid => [email1, email2]

io.on("connection", (socket) => {
  console.log("New Connection Build", socket.id);

  socket.on("join-room", (data) => {
    const { roomid, emailid } = data;

    // Check if room exists
    if (!rooms.has(roomid)) {
      rooms.set(roomid, []);
    }

    const participants = rooms.get(roomid);

    // If room already has 2 users, block join
    if (participants.length >= 2) {
      socket.emit("room-full");
      return;
    }

    participants.push(emailid);
    rooms.set(roomid, participants);

    console.log(`${emailid} joined room ${roomid}`);

    emailTosocketmapping.set(emailid, socket.id);
    sockettoemailmapping.set(socket.id, emailid);

    socket.join(roomid);
    socket.emit("joined-room", roomid);
    socket.broadcast.to(roomid).emit("user-joined", { emailid });
  });

  socket.on("call-user", (data) => {
    const { emailid, offer } = data;
    const fromEmail = sockettoemailmapping.get(socket.id);
    const socketid = emailTosocketmapping.get(emailid);
    if (!socketid) return console.log(`User ${emailid} not found`);
    socket.to(socketid).emit("incoming-call", { from: fromEmail, offer });
  });

  socket.on("Call-accepted", data => {
    const { emailid, answer } = data;
    const socketid = emailTosocketmapping.get(emailid);
    if (!socketid) return;
    socket.to(socketid).emit("Call-accepted", { answer });
  });

  socket.on("chat-message", ({ message, from }) => {
    socket.broadcast.emit("chat-message", { message, from });
    console.log(message);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    const email = sockettoemailmapping.get(socket.id);
    if (email) {
      emailTosocketmapping.delete(email);
      sockettoemailmapping.delete(socket.id);

      // Remove user from room
      rooms.forEach((participants, roomid) => {
        const index = participants.indexOf(email);
        if (index !== -1) {
          participants.splice(index, 1);
          rooms.set(roomid, participants);
          // Notify remaining user
          socket.to(roomid).emit("user-left", { emailid: email });
        }
      });
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
