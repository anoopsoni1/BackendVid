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
    origin: 'https://frontendvideo.vercel.app',
        methods: ['GET', 'POST']
  }
});

const emailTosocketmapping = new Map();
const sockettoemailmapping = new Map();

io.on("connection", (socket) => {
  console.log("New Connection Build", socket.id);

  socket.on("join-room", (data) => {
    const { roomid, emailid } = data;
    console.log(" joined the server:", emailid);

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
    if (!socketid) return console.log(` User ${emailid} not found`);
    socket.to(socketid).emit("incoming-call", { from: fromEmail, offer });
  });

  socket.on("Call-accepted", data => {
    const { emailid, answer } = data;
    const socketid = emailTosocketmapping.get(emailid);
    if (!socketid) return;
    socket.to(socketid).emit("Call-accepted", { answer });
  });

  socket.on("disconnect", () => {
    console.log(" Socket disconnected:", socket.id);
    const email = sockettoemailmapping.get(socket.id);
    if (email) {
      emailTosocketmapping.delete(email);
      sockettoemailmapping.delete(socket.id);
    }
  });
socket.on("chat-message", ({ message , from }) => {
    socket.broadcast.emit("chat-message", { message  , from});
    console.log(message);
    
  });

});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
