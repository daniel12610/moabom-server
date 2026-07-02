const { execFile } = require("child_process");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const users = {};
const upload = multer({ dest: "uploads/" });

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// ✅ FIX CORS: orígenes desde variable de entorno + localhost para desarrollo
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://moabom-my-pc.vercel.app",
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : []),
];

app.use(cors());

app.get("/", (req, res) => {
  res.send("MOABM Server is running.");
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const ext = path.extname(req.file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: "Solo se permiten imágenes (jpg, jpeg, png, webp)" });
  }

  const newFileName = `${req.file.filename}${ext}`;
  const oldPath = req.file.path;
  const newPath = path.join("uploads", newFileName);
  const colorizedPath = path.join("uploads", `colorized_${newFileName}`);
  const fileUrl = `/uploads/colorized_${newFileName}`;

  fs.renameSync(oldPath, newPath);

  execFile("python3", ["milkify.py", newPath, colorizedPath], (error, stdout, stderr) => {
    if (fs.existsSync(newPath)) fs.unlinkSync(newPath);

    if (error) {
      console.error("Error running milkify.py:", error);
      return res.status(500).json({ message: "Image processing failed" });
    }

    res.json({
      message: `uploaded ${req.file.originalname} successfully!`,
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
    origin: allowedOrigins, // ✅ solo permite orígenes definidos
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
    io.emit("chatMessage", data);
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
  console.log(`Allowed origins:`, allowedOrigins);
});