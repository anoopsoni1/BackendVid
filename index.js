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
    origin: "https://frontendvideo.vercel.app", // update if needed
    methods: ["GET", "POST"]
  }
});

const emailToSocket = new Map();
const socketToEmail = new Map();
const rooms = new Map(); // roomId -> [email list]

io.on("connection", (socket) => {
  console.log("New connection", socket.id);

  socket.on("join-room", ({ roomid, emailid }) => {
    console.log(`${emailid} joined room ${roomid}`);

    emailToSocket.set(emailid, socket.id);
    socketToEmail.set(socket.id, emailid);

    if (!rooms.has(roomid)) rooms.set(roomid, []);
    rooms.get(roomid).push(emailid);

    socket.join(roomid);
    socket.emit("joined-room", roomid);

    // Notify others that a new user joined
    socket.broadcast.to(roomid).emit("user-joined", { emailid });
  });

  socket.on("call-user", ({ emailid, offer }) => {
    const socketId = emailToSocket.get(emailid);
    if (socketId) {
      socket.to(socketId).emit("incoming-call", { from: socketToEmail.get(socket.id), offer });
    }
  });

  socket.on("call-accepted", ({ emailid, answer }) => {
    const socketId = emailToSocket.get(emailid);
    if (socketId) {
      socket.to(socketId).emit("call-accepted", { answer, from: socketToEmail.get(socket.id) });
    }
  });

  socket.on("ice-candidate", ({ emailid, candidate }) => {
    const socketId = emailToSocket.get(emailid);
    if (socketId) {
      socket.to(socketId).emit("ice-candidate", { candidate, from: socketToEmail.get(socket.id) });
    }
  });

  socket.on("disconnect", () => {
    const email = socketToEmail.get(socket.id);
    console.log("User disconnected:", email);

    socketToEmail.delete(socket.id);
    emailToSocket.delete(email);

    // Remove from all rooms
    rooms.forEach((users, roomid) => {
      rooms.set(roomid, users.filter(u => u !== email));
      socket.broadcast.to(roomid).emit("user-left", { emailid: email });
    });
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
