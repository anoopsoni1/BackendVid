import express from "express";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import cors from "cors";

const io = new Server({
  cors: true,
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

const emailTosocketmapping = new Map(); // email → socket.id
const sockettoemailmapping = new Map(); // socket.id → email

io.on("connection", (socket) => {
  console.log("✅ New Connection Build", socket.id);

  socket.on("join-room", (data) => {
    const { roomid, emailid } = data;

    console.log("📩 joined the server:", emailid);

    // Store both mappings
    emailTosocketmapping.set(emailid, socket.id);
    sockettoemailmapping.set(socket.id, emailid);

    socket.join(roomid);
    socket.emit("joined-room", roomid);
    socket.broadcast.to(roomid).emit("user-joined", { emailid });
  });

  socket.on("call-user", (data) => {
    const { emailid, offer } = data;

    const fromEmail = sockettoemailmapping.get(socket.id); // ✅ FIXED
    const socketid = emailTosocketmapping.get(emailid);    // ✅ FIXED

    if (!socketid) {
      console.log(`⚠️ User ${emailid} not found or not connected`);
      return;
    }

    console.log(`📞 ${fromEmail} is calling ${emailid}`);

    socket.to(socketid).emit("incoming-call", { from: fromEmail, offer });
  });

  socket.on("Call-accepted" , data =>{
    const {emailid , answer} = data
    const socketid = emailTosocketmapping.get(emailid)
      socket.to(socketid).emit("Call-accepted", {answer})
  })

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);


    const email = sockettoemailmapping.get(socket.id);
    if (email) {
      emailTosocketmapping.delete(email);
      sockettoemailmapping.delete(socket.id);
    }
  });
});

app.listen(8000, () => console.log("✅ Express server running on 8000"));
io.listen(8001, () => console.log("✅ Socket.io server running on 8001"));
