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
    origin: ['https://frontendvideo.vercel.app', "http://localhost:5173"],
    methods: ['GET', 'POST']
  }
});

const emailTosocketmapping = new Map();
const sockettoemailmapping = new Map();


const rooms = new Map();

io.on("connection", (socket) => {
  console.log("New Connection Build", socket.id);

  socket.on("join-room", (data) => {
    const { roomid, emailid } = data;

  
    if (!rooms.has(roomid)) {
      rooms.set(roomid, []);
    }

    const participants = rooms.get(roomid);

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

      rooms.forEach((participants, roomid) => {
        const index = participants.indexOf(email);
        if (index !== -1) {
          participants.splice(index, 1);
          rooms.set(roomid, participants);
          socket.to(roomid).emit("user-left", { emailid: email });
        }
      });
    }
  });
});




import mongoose from "mongoose";
import { configDotenv } from "dotenv";
  
configDotenv() ;
 
mongoose.connect(`${process.env.MONGO_URI}/VIDEOCALL`);

const contactSchema = new mongoose.Schema({
  name: String,
  tel: [String],
  email: [String],
});

const Contact = mongoose.model("Contact", contactSchema);

app.post("/api/saveContacts", async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ message: "Invalid contact data" });
    }

    await Contact.insertMany(
      contacts.map((c) => ({
        name: c.name ? c.name[0] : "Unknown",
        tel: c.tel || [],
        email: c.email || [],
      }))
    );

    res.json({ message: "Contacts saved successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error saving contacts" });
  }
});

app.get("/api/getContacts", async (req, res) => {
  const allContacts = await Contact.find();
  res.json(allContacts);
});



const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
