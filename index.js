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

// ✅ límite de 2MB por archivo
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 2 * 1024 * 1024 },
});

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

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

// ✅ limpieza periódica: borra archivos en uploads/ con más de 5 minutos
const cleanUploads = () => {
  const uploadsDir = "uploads/";
  if (!fs.existsSync(uploadsDir)) return;

  const now = Date.now();
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos

  fs.readdirSync(uploadsDir).forEach((file) => {
    const filePath = path.join(uploadsDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old file: ${file}`);
      }
    } catch (err) {
      // archivo ya borrado, ignorar
    }
  });
};

// corre la limpieza cada 5 minutos
setInterval(cleanUploads, 5 * 60 * 1000);

app.post("/upload", upload.single("file"), (req, res) => {
  // ✅ error de multer por tamaño
  if (req.fileValidationError || (!req.file && !res.headersSent)) {
    return res.status(400).json({ message: "No file uploaded" });
  }

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
    // borra el original siempre
    if (fs.existsSync(newPath)) fs.unlinkSync(newPath);

    if (error) {
      console.error("Error running milkify.py:", error);
      if (fs.existsSync(colorizedPath)) fs.unlinkSync(colorizedPath);
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

    // ✅ borra la imagen colorized después de 2 minutos
    // suficiente para que todos los clientes la carguen
    setTimeout(() => {
      if (fs.existsSync(colorizedPath)) {
        fs.unlinkSync(colorizedPath);
        console.log(`Deleted colorized file: colorized_${newFileName}`);
      }
    }, 2 * 60 * 1000);
  });
});

// ✅ manejo de error de multer por tamaño
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "El archivo no puede superar 2MB" });
  }
  next(err);
});

app.use("/uploads", express.static("uploads"));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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