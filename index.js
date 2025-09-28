import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://frontendvideo.vercel.app", 
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ New Connection:", socket.id);

  socket.on("room:join-ready", async () => {
    const roomName = "main-room";
    
    const otherSockets = await io.in(roomName).fetchSockets();
    otherSockets.forEach(otherSocket => {
        socket.to(otherSocket.id).emit("user-joined", { socketId: socket.id });
    });
    
    socket.join(roomName);
  });

  socket.on("call-user", ({ to, offer }) => {
    socket.to(to).emit("incoming-call", { from: socket.id, offer });
  });

  socket.on("call-accepted", ({ to, answer }) => {
    socket.to(to).emit("call-accepted", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    socket.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
    io.to("main-room").emit("user-left", { socketId: socket.id });
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));