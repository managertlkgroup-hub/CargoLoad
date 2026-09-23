/**
 * CargoPlanner — простой статический сервер для продакшн-сборки (папка out/).
 *
 * Чистый Node.js, только встроенные модули (http, fs, path, url).
 * Раздаёт статику, поддерживает SPA-фолбэк и защищён от path traversal.
 * Запуск:  node server.js   (порт: process.env.PORT или 3000; занят — 3001..3010)
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CJS-скрипт для node server.js */
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "out");
const BASE_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT = 3010;

/** MIME-типы по расширению файла. */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

/** Отдаёт файл (200) или 404, если его нет. */
function serveFile(res, absPath) {
  fs.readFile(absPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 — файл не найден");
      return;
    }
    const ext = path.extname(absPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
    });
    res.end(data);
  });
}

/** @returns путь внутри out/ после нормализации и проверки на «выход за пределы». */
function resolveInOut(pathname) {
  const rel = path.normalize(pathname).replace(/^[\\/]+/, "");
  const abs = path.join(OUT_DIR, rel);
  // защита от path traversal: ../.. снаружи out/ не пускаем
  if (abs !== OUT_DIR && !abs.startsWith(OUT_DIR + path.sep)) {
    return null;
  }
  return abs;
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  const abs = resolveInOut(pathname);
  if (!abs) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 — Forbidden");
    return;
  }

  fs.stat(abs, (err, st) => {
    if (!err && st.isDirectory()) {
      // каталог → index.html внутри него
      serveFile(res, path.join(abs, "index.html"));
      return;
    }
    if (!err && st.isFile()) {
      serveFile(res, abs);
      return;
    }
    // SPA-фолбэк: запрос без расширения = клиентский маршрут → index.html
    if (path.extname(pathname) === "") {
      serveFile(res, path.join(OUT_DIR, "index.html"));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 — Not Found");
  });
});

/** Слушаем порт; занят — пробуем следующий (до MAX_PORT). */
function start(port) {
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE" && port < MAX_PORT) {
      start(port + 1);
    } else {
      console.error(`Не удалось запустить сервер на порту ${port}: ${e.message}`);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log(`CargoPlanner готов: http://localhost:${port}`);
  });
}

// Валидация сборки: out/ должен существовать.
fs.access(OUT_DIR, fs.constants.F_OK, (err) => {
  if (err) {
    console.error("Папка out/ не найдена. Соберите проект: npm run build");
    process.exit(1);
  }
  start(BASE_PORT);
});