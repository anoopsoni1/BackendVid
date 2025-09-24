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
    methods: ["GET", "POST"]
  }
});

// Map: socket.id -> { email, room }
const userMap = new Map();

io.on("connection", (socket) => {
  console.log("✅ New Connection:", socket.id);

  socket.on("join-room", ({ roomid, emailid }) => {
    console.log(`📩 ${emailid} joined room ${roomid}`);
    socket.join(roomid);
    userMap.set(socket.id, { email: emailid, room: roomid });

    // Notify existing users about the new user
    socket.to(roomid).emit("user-joined", { socketId: socket.id, emailid });

    // Send list of existing participants to new user
    const existingUsers = Array.from(io.sockets.adapter.rooms.get(roomid) || [])
      .filter((id) => id !== socket.id);
    socket.emit("all-users", existingUsers);
  });

  // Handle WebRTC Offer
  socket.on("send-offer", ({ to, offer }) => {
    socket.to(to).emit("receive-offer", { from: socket.id, offer });
  });

  // Handle WebRTC Answer
  socket.on("send-answer", ({ to, answer }) => {
    socket.to(to).emit("receive-answer", { from: socket.id, answer });
  });

  // Handle ICE Candidates
  socket.on("ice-candidate", ({ to, candidate }) => {
    socket.to(to).emit("receive-ice-candidate", { from: socket.id, candidate });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const userData = userMap.get(socket.id);
    if (userData) {
      const { room } = userData;
      console.log(`❌ ${userData.email} left room ${room}`);
      socket.to(room).emit("user-left", { socketId: socket.id });
      userMap.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
