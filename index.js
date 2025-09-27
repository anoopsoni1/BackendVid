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
    origin: "https://frontendvideo.vercel.app",
    methods: ["GET", "POST"],
  },
});

// Track users in rooms
const rooms = new Map(); // roomId -> [{ emailid, socketid }]

const emailToSocket = new Map();
const socketToEmail = new Map();

io.on("connection", (socket) => {
  console.log("New Connection Build", socket.id);

  socket.on("join-room", ({ roomid, emailid }) => {
    console.log(`${emailid} joined room: ${roomid}`);

    emailToSocket.set(emailid, socket.id);
    socketToEmail.set(socket.id, emailid);

    // Track user in room
    if (!rooms.has(roomid)) rooms.set(roomid, []);
    rooms.get(roomid).push({ emailid, socketid: socket.id });

    socket.join(roomid);
    socket.emit("joined-room", roomid);

    // Get users in this room
    const usersInRoom = rooms.get(roomid);
    console.log("Users in room:", usersInRoom.map((u) => u.emailid));

    if (usersInRoom.length === 2) {
      // If exactly 2 users are in room, connect them
      const [u1, u2] = usersInRoom;
      console.log(`Pairing ${u1.emailid} with ${u2.emailid}`);
      io.to(u1.socketid).emit("ready-to-call", { peer: u2.emailid });
      io.to(u2.socketid).emit("ready-to-call", { peer: u1.emailid });
    } else if (usersInRoom.length > 2) {
      // Notify that room is full
      socket.emit("room-full", { message: "Two users already connected. Please wait." });
    } else {
      // Notify waiting for a partner
      socket.emit("waiting", { message: "Waiting for another user to join..." });
    }
  });

  socket.on("call-user", ({ emailid, offer }) => {
    const fromEmail = socketToEmail.get(socket.id);
    const targetSocketId = emailToSocket.get(emailid);
    if (!targetSocketId) return console.log(`User ${emailid} not found`);
    socket.to(targetSocketId).emit("incoming-call", { from: fromEmail, offer });
  });

  socket.on("Call-accepted", ({ emailid, answer }) => {
    const targetSocketId = emailToSocket.get(emailid);
    if (!targetSocketId) return;
    socket.to(targetSocketId).emit("Call-accepted", { answer });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    const email = socketToEmail.get(socket.id);
    if (email) {
      emailToSocket.delete(email);
      socketToEmail.delete(socket.id);

      // Remove user from any room they were in
      for (let [roomid, users] of rooms) {
        rooms.set(
          roomid,
          users.filter((u) => u.socketid !== socket.id)
        );
        if (rooms.get(roomid).length === 0) rooms.delete(roomid);
      }
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
