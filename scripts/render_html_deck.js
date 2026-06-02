const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");

const DEFAULT_BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function parseArgs(argv) {
  const args = {
    width: 1920,
    height: 1080,
    scale: 2,
    waitMs: 300,
    strict: false,
    index: "index.html",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    if (key === "strict") {
      args.strict = true;
    } else {
      args[key] = argv[i + 1];
      i += 1;
    }
  }

  if (!args["deck-dir"]) {
    throw new Error("Missing required --deck-dir");
  }
  if (!args.out) {
    throw new Error("Missing required --out");
  }

  args.width = Number(args.width);
  args.height = Number(args.height);
  args.scale = Number(args.scale);
  args.waitMs = Number(args.waitMs);
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function findBrowser(explicitBrowser) {
  if (explicitBrowser && fs.existsSync(explicitBrowser)) return explicitBrowser;
  const found = DEFAULT_BROWSERS.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("No Chrome/Edge executable found. Pass --browser explicitly.");
  }
  return found;
}

function loadSlides(deckDir, indexName) {
  const indexFile = path.join(deckDir, indexName);
  const html = fs.readFileSync(indexFile, "utf8");
  const quotedSlideMatches = [...html.matchAll(/["']([^"']*slides\/[^"']+\.html)["']/g)];
  const slides = quotedSlideMatches.map((match) => match[1].replace(/\\/g, "/"));

  if (slides.length > 0) {
    return [...new Set(slides)];
  }

  const slidesDir = path.join(deckDir, "slides");
  if (fs.existsSync(slidesDir)) {
    return fs
      .readdirSync(slidesDir)
      .filter((name) => name.toLowerCase().endsWith(".html"))
      .sort()
      .map((name) => `slides/${name}`);
  }

  return [indexName];
}

function createStaticServer(rootDir) {
  const absoluteRoot = path.resolve(rootDir);
  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^[/\\]+/, "");
    const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(absoluteRoot, safePath);

    if (!filePath.startsWith(absoluteRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function waitForAssets(page, waitMs) {
  await page.evaluate(async (extraWait) => {
    if (document.fonts) await document.fonts.ready;

    const waitImage = (img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    };

    await Promise.all([...document.images].map(waitImage));

    const video = document.querySelector("video");
    if (video) {
      video.muted = true;
      try {
        await video.play();
        await new Promise((resolve) => setTimeout(resolve, 500));
        video.pause();
        if (Number.isFinite(video.duration) && video.duration > 0.2) video.currentTime = 0.2;
      } catch (_) {
        // Poster frame or browser controls are acceptable when autoplay is blocked.
      }
    }

    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, extraWait));
  }, waitMs);
}

async function collectBrokenImages(page) {
  return page.evaluate(() =>
    [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src || img.getAttribute("src") || "")
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deckDir = path.resolve(args["deck-dir"]);
  const serveRoot = path.resolve(args["serve-root"] || deckDir);
  const outDir = path.resolve(args.out);
  const manifestPath = path.resolve(args.manifest || path.join(path.dirname(outDir), "slide-manifest.json"));
  const browserPath = findBrowser(args.browser);
  const slides = loadSlides(deckDir, args.index);
  const deckWebRoot = path.relative(serveRoot, deckDir).replace(/\\/g, "/");

  ensureDir(outDir);
  ensureDir(path.dirname(manifestPath));

  const { server, origin } = await createStaticServer(serveRoot);
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--headless=new"],
  });

  const page = await browser.newPage({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: args.scale,
  });

  const failedAssets = [];
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (["image", "media"].includes(type) && !response.ok()) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const type = request.resourceType();
    if (["image", "media"].includes(type)) {
      failedAssets.push(`FAILED ${request.url()} ${request.failure()?.errorText || ""}`);
    }
  });

  const manifest = [];

  try {
    for (let i = 0; i < slides.length; i += 1) {
      const slidePath = slides[i];
      const number = String(i + 1).padStart(2, "0");
      const imageName = `${number}.png`;
      const outputPath = path.join(outDir, imageName);
      const url = `${origin}/${deckWebRoot ? `${deckWebRoot}/` : ""}${slidePath}`;

      await page.goto(url, { waitUntil: "networkidle" });
      await waitForAssets(page, args.waitMs);

      const brokenImages = await collectBrokenImages(page);
      if (args.strict && brokenImages.length > 0) {
        throw new Error(`Broken images on ${slidePath}: ${brokenImages.join(", ")}`);
      }

      await page.screenshot({ path: outputPath, type: "png" });
      manifest.push({
        index: i + 1,
        slide: slidePath,
        image: path.relative(path.dirname(manifestPath), outputPath).replace(/\\/g, "/"),
      });
    }
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  if (args.strict && failedAssets.length > 0) {
    throw new Error(`Failed media requests:\n${failedAssets.join("\n")}`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify({ slides: manifest }, null, 2), "utf8");
  console.log(`Rendered ${manifest.length} slides`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

