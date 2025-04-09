const { exec } = require("child_process");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const users = {};
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
app.use(cors());

app.get("/", (req, res) => {
  res.send("MOABM Server is running.");
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const ext = path.extname(req.file.originalname);
  const newFileName = `${req.file.filename}${ext}`;
  const oldPath = req.file.path;
  const newPath = path.join("uploads", newFileName);

  fs.renameSync(oldPath, newPath);

  const fileUrl = `/uploads/colorized_${newFileName}`;
  const colorizedPath = path.join("uploads", `colorized_${newFileName}`);

  //call python
  const command = `python3 milkify.py "${newPath}" "${colorizedPath}"`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error running milkify.py:`, error);
      return res.status(500).json({ message: "Image processing failed" });
    }

    //returns edited img
    res.json({
      message: `${req.file.originalname} uploaded and milkified successfully!`,
      fileUrl,
      originalName: req.file.originalname,
    });

    io.emit("chatMessage", {
      username: "Server",
      text: `uploaded file: ${req.file.originalname}`,
      fileUrl,
    });
  });
});

app.use("/uploads", express.static("uploads"));

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
