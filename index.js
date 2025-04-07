const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const users = {};

app.use(cors());


app.get("/", (req, res) => {
  res.send("MOABM Server is running.");
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("setUsername", (username) => {
    users[socket.id] = username;
    console.log(`Username set for ${socket.id}: ${username}`);
  });

  socket.on("chatMessage", (data) => {
    console.log("Received message:", data);
    socket.broadcast.emit("chatMessage", data);
  });

  socket.on("getUserList", () => {
    const userList = Object.values(users);
    socket.emit("userList", userList);
    console.log("List of users requested", userList);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    delete users[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`MOABM Server running on port ${PORT}`);
});
