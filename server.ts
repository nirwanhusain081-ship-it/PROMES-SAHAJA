import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import mammoth from "mammoth";
import * as _pdfParse from "pdf-parse";
const pdfParse = (_pdfParse as any).default || _pdfParse;
import * as XLSX from "xlsx";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  TextRun, 
  BorderStyle, 
  Header, 
  Footer 
} from "docx";

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configure Multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Safe initializer for Gemini API client to prevent crash if key is missing or is standard placeholder
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    console.warn("GEMINI_API_KEY is not configured or is using placeholder. Falling back to offline heuristic engine.");
    return null;
  }
  return ai;
}

// Heuristic offline fallback parser for ATP documents
function parseAtpOffline(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5);
  const potentialTps: string[] = [];
  
  // Scan lines for objective indicator keywords
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    
    // Check if line indicates a Tujuan Pembelajaran or looks like a learning objective
    const hasObjectiveKeyword = lower.includes("tujuan pembelajaran") || 
                                 lower.includes("tp") || 
                                 lower.includes("peserta didik") || 
                                 lower.includes("siswa") || 
                                 lower.includes("kompetensi") ||
                                 lower.includes("memahami") || 
                                 lower.includes("mampu") || 
                                 lower.includes("menganalisis") || 
                                 lower.includes("mengidentifikasi") || 
                                 lower.includes("menjelaskan") ||
                                 lower.includes("mendeskripsikan") ||
                                 lower.includes("menerapkan");
                                 
    // Clean bullet symbols and numbers at start
    const cleanLine = line.replace(/^([0-9]+\.|[a-z]\.|•|\*|-|\s+)+/, "").trim();
    
    if (hasObjectiveKeyword && cleanLine.length > 20 && cleanLine.length < 300) {
      if (!potentialTps.includes(cleanLine)) {
        potentialTps.push(cleanLine);
      }
    }
  }

  // If we couldn't find enough, split by general bullet points or lines that are medium length
  if (potentialTps.length < 3) {
    lines.forEach(line => {
      const cleanLine = line.replace(/^([0-9]+\.|[a-z]\.|•|\*|-|\s+)+/, "").trim();
      const lower = cleanLine.toLowerCase();
      if ((line.startsWith("•") || line.startsWith("-") || /^[0-9]+\./.test(line) || /^[a-z]\./.test(line)) && 
          cleanLine.length > 25 && cleanLine.length < 250 && 
          (lower.includes("dan") || lower.includes("untuk") || lower.includes("dengan") || lower.includes("yang"))) {
        if (!potentialTps.includes(cleanLine)) {
          potentialTps.push(cleanLine);
        }
      }
    });
  }

  // Guess Jenjang, Fase, Kelas, Mapel from text
  let jenjang = "SD";
  let fase = "Fase B";
  let kelas = "Kelas IV";
  let mapel = "IPAS";
  let semester = 1;

  const fullTextLower = text.toLowerCase();
  if (fullTextLower.includes("paud") || fullTextLower.includes("taman kanak") || fullTextLower.includes("tk ")) {
    jenjang = "PAUD";
    fase = "Fondasi";
    kelas = "TK A";
    mapel = "Pendidikan Karakter & Jati Diri";
  } else if (fullTextLower.includes("smp") || fullTextLower.includes("kelas 7") || fullTextLower.includes("kelas vii") || fullTextLower.includes("kelas 8") || fullTextLower.includes("kelas viii") || fullTextLower.includes("kelas 9") || fullTextLower.includes("kelas ix")) {
    jenjang = "SMP";
    fase = "Fase D";
    if (fullTextLower.includes("vii") || fullTextLower.includes(" 7")) kelas = "Kelas VII";
    else if (fullTextLower.includes("viii") || fullTextLower.includes(" 8")) kelas = "Kelas VIII";
    else kelas = "Kelas IX";
  } else {
    jenjang = "SD";
    if (fullTextLower.includes("kelas 1") || fullTextLower.includes("kelas i") || fullTextLower.includes("kelas 2") || fullTextLower.includes("kelas ii")) {
      fase = "Fase A";
      kelas = fullTextLower.includes("2") || fullTextLower.includes("ii") ? "Kelas II" : "Kelas I";
    } else if (fullTextLower.includes("kelas 3") || fullTextLower.includes("kelas iii") || fullTextLower.includes("kelas 4") || fullTextLower.includes("kelas iv")) {
      fase = "Fase B";
      kelas = fullTextLower.includes("3") || fullTextLower.includes("iii") ? "Kelas III" : "Kelas IV";
    } else {
      fase = "Fase C";
      kelas = fullTextLower.includes("6") || fullTextLower.includes("vi") ? "Kelas VI" : "Kelas V";
    }
  }

  // Mapel detection
  if (fullTextLower.includes("pancasila") || fullTextLower.includes("pkn") || fullTextLower.includes("kewarganegaraan") || fullTextLower.includes("kewargaan")) {
    mapel = "Pendidikan Pancasila";
  } else if (fullTextLower.includes("bahasa indonesia")) {
    mapel = "Bahasa Indonesia";
  } else if (fullTextLower.includes("matematika")) {
    mapel = "Matematika";
  } else if (fullTextLower.includes("ipas") || fullTextLower.includes("sains") || fullTextLower.includes("alam")) {
    mapel = "IPAS";
  } else if (fullTextLower.includes("inggris")) {
    mapel = "Bahasa Inggris";
  } else if (fullTextLower.includes("seni")) {
    mapel = "Seni Rupa";
  } else if (fullTextLower.includes("pjok") || fullTextLower.includes("jasmani") || fullTextLower.includes("olahraga")) {
    mapel = "PJOK";
  } else if (fullTextLower.includes("agama")) {
    mapel = "Pendidikan Agama Islam";
  } else if (fullTextLower.includes("indonesia") && !fullTextLower.includes("pancasila")) {
    mapel = "Bahasa Indonesia";
  }

  // Semester detection
  if (fullTextLower.includes("semester 2") || fullTextLower.includes("semester ii") || fullTextLower.includes("semester genap")) {
    semester = 2;
  }

  let finalTps: any[] = [];
  if (potentialTps.length === 0) {
    const templates: Record<string, string[]> = {
      "Bahasa Indonesia": [
        "Menyimak dan memahami teks narasi pendek yang dibacakan guru atau teman dengan konsentrasi.",
        "Membaca kata-kata baru dengan lancar dan memahami maknanya dalam konteks kalimat sederhana.",
        "Menyampaikan gagasan, ide, dan perasaan secara lisan dengan santun dan percaya diri.",
        "Menulis kalimat lengkap menggunakan huruf tegak bersambung dan ejaan yang tepat sesuai EYD."
      ],
      "Matematika": [
        "Mengenal, membaca, menulis, dan membandingkan bilangan bulat hingga nilai yang sesuai.",
        "Melakukan operasi penjumlahan dan pengurangan bilangan bulat dalam kehidupan sehari-hari.",
        "Mengidentifikasi bentuk bangun datar dan bangun ruang berdasarkan karakteristik dasarnya.",
        "Membaca dan menyajikan data statistik sederhana dalam bentuk tabel atau grafik batang."
      ],
      "IPAS": [
        "Menganalisis siklus hidup makhluk hidup dan mengidentifikasi upaya pelestariannya di lingkungan sekitar.",
        "Mendeskripsikan bentuk-bentuk energi dan perubahan energi dalam kehidupan sehari-hari.",
        "Mengidentifikasi ragam gaya (gaya otot, gesek, magnet, gravitasi) serta pengaruhnya pada benda.",
        "Menjelaskan keragaman sosial budaya dan kearifan lokal di daerah tempat tinggal masing-masing."
      ],
      "Default": [
        "Memahami materi pokok bahasan pertama secara komprehensif melalui diskusi kelompok.",
        "Mengembangkan keterampilan praktis terkait materi inti pelajaran melalui penugasan individu.",
        "Menganalisis studi kasus nyata di lingkungan sekitar untuk merumuskan solusi kreatif.",
        "Menyajikan hasil laporan karya atau proyek kelas secara berkelompok dengan penuh tanggung jawab."
      ]
    };

    const chosenList = templates[mapel] || templates["Default"];
    chosenList.forEach((textTp, idx) => {
      finalTps.push({
        tp: textTp,
        semester: semester,
        indikatorList: [
          {
            indikator: `Mengidentifikasi konsep dasar dan teori pendukung untuk: ${textTp.split(" ").slice(0, 5).join(" ")}...`,
            jp: 4,
            materi: `Konsep Dasar ${mapel}`
          },
          {
            indikator: `Menerapkan dan menyelesaikan lembar kerja praktis tentang materi pokok tersebut.`,
            jp: 4,
            materi: `Penerapan Praktis ${mapel}`
          }
        ]
      });
    });
  } else {
    potentialTps.slice(0, 8).forEach((tpText, idx) => {
      finalTps.push({
        tp: tpText,
        semester: semester,
        indikatorList: [
          {
            indikator: `Memahami materi pokok dan mampu menjelaskan kembali gagasan utama ${tpText.split(" ").slice(0, 3).join(" ")}...`,
            jp: 4,
            materi: "Materi Pokok"
          },
          {
            indikator: `Menyelesaikan tugas/penilaian portofolio secara mandiri dan terukur terkait tujuan pembelajaran.`,
            jp: 4,
            materi: "Evaluasi Mandiri"
          }
        ]
      });
    });
  }

  return {
    jenjang,
    fase,
    kelas,
    mapel,
    semester,
    tps: finalTps,
    offline: true
  };
}

// Heuristic offline fallback parser for educational calendar text
function parseCalendarOffline(text: string) {
  const events = [];
  events.push({ namaEvent: "Masa Pengenalan Lingkungan Sekolah (MPLS)", bulan: "Juli", mingguKe: 3, isEfektif: false });
  events.push({ namaEvent: "Asesmen Tengah Semester (ASTS) Ganjil", bulan: "September", mingguKe: 3, isEfektif: false });
  events.push({ namaEvent: "Asesmen Akhir Semester (AAS) Ganjil", bulan: "Desember", mingguKe: 1, isEfektif: false });
  events.push({ namaEvent: "Pembagian Rapor Semester 1", bulan: "Desember", mingguKe: 3, isEfektif: false });
  events.push({ namaEvent: "Libur Semester Ganjil", bulan: "Desember", mingguKe: 4, isEfektif: false });
  
  events.push({ namaEvent: "Asesmen Tengah Semester (ASTS) Genap", bulan: "Maret", mingguKe: 2, isEfektif: false });
  events.push({ namaEvent: "Asesmen Akhir Tahun (AAT) / Kelulusan", bulan: "Juni", mingguKe: 1, isEfektif: false });
  events.push({ namaEvent: "Pembagian Rapor Semester 2", bulan: "Juni", mingguKe: 3, isEfektif: false });
  events.push({ namaEvent: "Libur Kenaikan Kelas / Akhir Tahun", bulan: "Juni", mingguKe: 4, isEfektif: false });
  events.push({ namaEvent: "Libur Kenaikan Kelas / Akhir Tahun", bulan: "Juli", mingguKe: 1, isEfektif: false });
  events.push({ namaEvent: "Libur Kenaikan Kelas / Akhir Tahun", bulan: "Juli", mingguKe: 2, isEfektif: false });

  const textLower = text.toLowerCase();
  if (textLower.includes("hut") || textLower.includes("kemerdekaan") || textLower.includes("17 agustus")) {
    events.push({ namaEvent: "HUT RI / Kemerdekaan", bulan: "Agustus", mingguKe: 3, isEfektif: false });
  }
  if (textLower.includes("lebaran") || textLower.includes("idul fitri")) {
    events.push({ namaEvent: "Prakiraan Libur Idul Fitri", bulan: "Maret", mingguKe: 4, isEfektif: false });
    events.push({ namaEvent: "Prakiraan Libur Idul Fitri", bulan: "April", mingguKe: 1, isEfektif: false });
  }

  return events;
}

// JSON Database Setup
const DATA_DIR = process.env.NODE_ENV === "production" ? "/tmp/data" : path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ promes: [] }, null, 2));
  }
}

function getDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    console.error("Error reading database:", e);
    return { promes: [] };
  }
}

function saveDb(data: any) {
  ensureDb();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error writing database:", e);
  }
}

// Ensure database on startup
ensureDb();

// API ROUTES

// 1. Get Saved PROMES List
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    res.json({ success: true, token: "promes_auth_token_xyz" });
  } else {
    res.status(401).json({ success: false, message: "Username atau password salah" });
  }
});

app.get("/api/promes", (req, res) => {
  try {
    const db = getDb();
    res.json({ success: true, data: db.promes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Save or Update PROMES
app.post("/api/promes", (req, res) => {
  try {
    const db = getDb();
    const payload = req.body;
    
    if (!payload.id) {
      payload.id = "promes_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      payload.createdAt = new Date().toISOString();
    }
    payload.updatedAt = new Date().toISOString();

    const existingIdx = db.promes.findIndex((item: any) => item.id === payload.id);
    if (existingIdx > -1) {
      db.promes[existingIdx] = payload;
    } else {
      db.promes.unshift(payload); // New items at the top
    }

    saveDb(db);
    res.json({ success: true, data: payload });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Delete PROMES
app.delete("/api/promes/:id", (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const initialLength = db.promes.length;
    db.promes = db.promes.filter((item: any) => item.id !== id);
    
    if (db.promes.length < initialLength) {
      saveDb(db);
      res.json({ success: true, message: "PROMES berhasil dihapus" });
    } else {
      res.status(404).json({ success: false, message: "PROMES tidak ditemukan" });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Parse ATP (PDF/DOCX/XLS/XLSX) menggunakan Gemini atau Offline Fallback
app.post("/api/parse-atp", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "File wajib diunggah" });
    }

    let rawText = "";
    const mimeType = req.file.mimetype;
    const buffer = req.file.buffer;

    // Parse DOCX, PDF or Excel
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || req.file.originalname.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else if (mimeType === "application/pdf" || req.file.originalname.endsWith(".pdf")) {
      const pdfData = await pdfParse(buffer);
      rawText = pdfData.text;
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      mimeType === "application/vnd.ms-excel" ||
      req.file.originalname.endsWith(".xlsx") ||
      req.file.originalname.endsWith(".xls")
    ) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      let excelText = "";
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        excelText += `Sheet: ${sheetName}\n`;
        excelText += XLSX.utils.sheet_to_txt(worksheet);
        excelText += "\n\n";
      });
      rawText = excelText;
    } else {
      return res.status(400).json({ success: false, message: "Format file tidak didukung. Gunakan Excel, Word, atau PDF." });
    }

    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Gagal membaca teks dari dokumen. Pastikan file tidak kosong atau rusak." });
    }

    // Limit text length to prevent token overflows (approx 150,000 characters)
    const truncatedText = rawText.slice(0, 150000);

    let resultData;
    const aiClient = getAiClient();
    
    if (!aiClient) {
      console.log("Gemini API Key tidak terdeteksi atau kosong. Menggunakan pengurai offline.");
      resultData = parseAtpOffline(truncatedText);
    } else {
      const prompt = `Anda adalah ahli kurikulum nasional Indonesia dan Kurikulum Merdeka.
Tugas Anda adalah membaca dan menganalisis teks Alur Tujuan Pembelajaran (ATP) berikut, lalu menyusun daftar Tujuan Pembelajaran (TP) secara berurutan dan terstruktur beserta masing-masing Indikator Ketercapaian (IKTP) di dalamnya.

Wajib patuhi aturan berikut:
1. JANGAN mengubah isi asli ATP.
2. JANGAN menghilangkan atau menambah Tujuan Pembelajaran (TP) yang tidak ada di dokumen.
3. JANGAN mengacak urutan TP. Harus sesuai urutan pembelajaran yang tertulis dalam dokumen ATP.
4. Identifikasi: Jenjang, Fase, Kelas, Mata Pelajaran, dan Semester yang dominan jika tertulis. Jika tidak tertulis jelas, buat tebakan terbaik berdasarkan materi pelajaran.
5. Untuk setiap TP, buatlah atau pecahlah menjadi beberapa Indikator Pembelajaran (IKTP) yang spesifik dan terukur (biasanya 1 sampai 3 indikator per TP).
6. Berikan alokasi JP (Jam Pelajaran) UNTUK MASING-MASING INDIKATOR secara rasional (misalnya 2, 3, 4, atau 6 JP per indikator, tergantung tingkat kesulitan materinya).

Berikut adalah teks ATP:
---
${truncatedText}
---`;

      try {
        const response = await aiClient.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: {
            systemInstruction: "Anda adalah asisten AI yang ahli dalam Kurikulum Merdeka di Indonesia. Anda selalu menghasilkan data JSON terstruktur sesuai skema yang diminta.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                jenjang: { type: Type.STRING, description: "PAUD, SD, atau SMP" },
                fase: { type: Type.STRING, description: "Fondasi, Fase A, Fase B, Fase C, atau Fase D" },
                kelas: { type: Type.STRING, description: "Misalnya 'TK A', 'Kelas I', 'Kelas VII', dll." },
                mapel: { type: Type.STRING, description: "Nama mata pelajaran lengkap" },
                semester: { type: Type.INTEGER, description: "1 atau 2" },
                tps: {
                  type: Type.ARRAY,
                  description: "Daftar Tujuan Pembelajaran yang dianalisis dari ATP",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      tp: { type: Type.STRING, description: "Deskripsi lengkap Tujuan Pembelajaran (TP)" },
                      semester: { type: Type.INTEGER, description: "Semester pelaksanaan (1 atau 2)" },
                      indikatorList: {
                        type: Type.ARRAY,
                        description: "Daftar Indikator Pembelajaran (IKTP) untuk TP ini. Setiap TP wajib memiliki minimal satu atau beberapa Indikator yang lebih rinci.",
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            indikator: { type: Type.STRING, description: "Indikator Pembelajaran / IKTP spesifik dan terukur" },
                            jp: { type: Type.INTEGER, description: "Alokasi Jam Pelajaran (JP) khusus untuk indikator ini saja. Harus berupa angka bulat (biasanya 2, 3, 4, atau 6 JP)." },
                            materi: { type: Type.STRING, description: "Materi pokok spesifik untuk indikator ini" }
                          },
                          required: ["indikator", "jp", "materi"]
                        }
                      }
                    },
                    required: ["tp", "semester", "indikatorList"]
                  }
                }
              },
              required: ["jenjang", "fase", "kelas", "mapel", "semester", "tps"]
            }
          }
        });

        const jsonText = response.text || "{}";
        resultData = JSON.parse(jsonText.trim());
      } catch (geminiError: any) {
        console.log("Catatan: Panggilan Gemini API beralih ke pengurai offline (layanan padat/kuota habis).");
        resultData = parseAtpOffline(truncatedText);
      }
    }

    res.json({ success: true, data: resultData });
  } catch (error: any) {
    console.error("Error parsing ATP:", error);
    res.status(500).json({ success: false, message: "Gagal memproses ATP: " + error.message });
  }
});

// 5. Parse Education Calendar menggunakan Gemini atau Offline Fallback
app.post("/api/parse-calendar", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "File kalender wajib diunggah" });
    }

    let rawText = "";
    const mimeType = req.file.mimetype;
    const buffer = req.file.buffer;

    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || req.file.originalname.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else if (mimeType === "application/pdf" || req.file.originalname.endsWith(".pdf")) {
      const pdfData = await pdfParse(buffer);
      rawText = pdfData.text;
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      mimeType === "application/vnd.ms-excel" ||
      req.file.originalname.endsWith(".xlsx") ||
      req.file.originalname.endsWith(".xls")
    ) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      let excelText = "";
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        excelText += `Sheet: ${sheetName}\n`;
        excelText += XLSX.utils.sheet_to_txt(worksheet);
        excelText += "\n\n";
      });
      rawText = excelText;
    } else {
      return res.status(400).json({ success: false, message: "Format kalender tidak didukung. Gunakan Excel, Word, atau PDF." });
    }

    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Gagal membaca teks kalender pendidikan." });
    }

    const truncatedText = rawText.slice(0, 100000);

    let events;
    const aiClient = getAiClient();
    
    if (!aiClient) {
      console.log("Gemini API Key tidak terdeteksi atau kosong. Menggunakan kalender offline.");
      events = parseCalendarOffline(truncatedText);
    } else {
      const prompt = `Menganalisis Kalender Pendidikan Sekolah di Indonesia dari teks berikut.
Identifikasi hari libur semester, libur nasional, jadwal penilaian/asesmen (ASTS/ASAS), proyek penguatan profil pelajar pancasila (P5), MPLS, pembagian rapor, dan kegiatan penting lainnya yang mempengaruhi keefektifan belajar mengajar.

Petakan informasi tersebut ke dalam format JSON yang berisi daftar event libur atau non-efektif beserta perkiraan bulan dan minggu terjadinya (misalnya: Juli Minggu 1, Juli Minggu 2, Desember Minggu 3, dll).

Teks Kalender Pendidikan:
---
${truncatedText}
---`;

      try {
        const response = await aiClient.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                events: {
                  type: Type.ARRAY,
                  description: "Daftar acara kalender yang diidentifikasi",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      namaEvent: { type: Type.STRING, description: "Nama acara atau hari libur (misal: 'Libur Semester 1', 'Asesmen Tengah Semester')" },
                      bulan: { type: Type.STRING, description: "Nama bulan terjadinya (misal: 'Juli', 'Agustus', 'Desember')" },
                      mingguKe: { type: Type.INTEGER, description: "Minggu keberapa (1-5) dalam bulan tersebut" },
                      isEfektif: { type: Type.BOOLEAN, description: "Apakah minggu ini efektif untuk KBM (Kegiatan Belajar Mengajar)? Bernilai false jika libur, asesmen penuh, atau jeda semester." }
                    },
                    required: ["namaEvent", "bulan", "mingguKe", "isEfektif"]
                  }
                }
              },
              required: ["events"]
            }
          }
        });

        const jsonText = response.text || "{}";
        const resultData = JSON.parse(jsonText.trim());
        events = resultData.events;
      } catch (geminiError: any) {
        console.log("Catatan: Panggilan Gemini Calendar API beralih ke kalender offline (layanan padat/kuota habis).");
        events = parseCalendarOffline(truncatedText);
      }
    }

    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error("Error parsing Calendar:", error);
    res.status(500).json({ success: false, message: "Gagal memproses Kalender Pendidikan: " + error.message });
  }
});

// 6. Export Word (.docx) PROMES
app.post("/api/export-docx", async (req, res) => {
  try {
    const { metadata, tps, weeks, grid } = req.body;
    
    if (!metadata || !tps || !weeks || !grid) {
      return res.status(400).json({ success: false, message: "Data PROMES tidak lengkap untuk diexport." });
    }

    const { jenjang, fase, kelas, mapel, semester, tahunPelajaran, guruNama, nip, kepalaSekolah, kepalaNip, namaSekolah, datumTanggal } = metadata;

    const tableRows = [];

    // Create Table Header Row
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 5, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "Tujuan Pembelajaran (TP)", bold: true, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "Indikator Pembelajaran (IKTP)", bold: true, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "Alokasi JP", bold: true, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "Tanggal/Waktu Pelaksanaan", bold: true, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
        }),
      ],
    });
    tableRows.push(headerRow);

    // Populate Table Rows
    let globalIndex = 1;
    tps.forEach((tp: any) => {
      const list = tp.indikatorList || [];
      if (list.length === 0) {
        const row = new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: String(globalIndex++), font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: tp.tp, font: "Times New Roman" })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "-", font: "Times New Roman" })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "0 JP", font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Belum Dijadwalkan", font: "Times New Roman" })] })],
            }),
          ],
        });
        tableRows.push(row);
      } else {
        list.forEach((ind: any, indIdx: number) => {
          const scheduledWeeks: string[] = [];
          weeks.forEach((w: any) => {
            const allocated = grid[ind.id]?.[w.id];
            if (allocated && allocated > 0) {
              scheduledWeeks.push(`${w.month} M${w.weekNum} (${allocated} JP)`);
            }
          });
          const pelaksanaan = scheduledWeeks.length > 0 ? scheduledWeeks.join(", ") : "Belum Dijadwalkan";

          const row = new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: indIdx === 0 ? String(globalIndex++) : "", font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: indIdx === 0 ? tp.tp : "", font: "Times New Roman" })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: ind.indikator || "-", font: "Times New Roman" })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: `${ind.jp} JP`, font: "Times New Roman" })], alignment: AlignmentType.CENTER })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: pelaksanaan, font: "Times New Roman" })] })],
              }),
            ],
          });
          tableRows.push(row);
        });
      }
    });

    // Create Table
    const promesTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    });

    // Create Document
    const doc = new Document({
      sections: [{
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "PROMES SAHAJA - Program Semester Kurikulum Merdeka", size: 16, font: "Times New Roman", color: "888888" })],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Halaman otomatis - Dicetak menggunakan PROMES SAHAJA", size: 16, font: "Times New Roman", color: "888888" })],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: "PROGRAM SEMESTER (PROMES)", bold: true, size: 28, font: "Times New Roman" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `TAHUN PELAJARAN: ${tahunPelajaran || "2026/2027"}`, bold: true, size: 24, font: "Times New Roman" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          // Metadata Grid
          new Paragraph({
            children: [
              new TextRun({ text: "Mata Pelajaran  : ", bold: true, font: "Times New Roman" }),
              new TextRun({ text: `${mapel || "-"}`, font: "Times New Roman" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Satuan Pendidikan: ", bold: true, font: "Times New Roman" }),
              new TextRun({ text: namaSekolah ? `${namaSekolah} (${jenjang || "-"}, Kelas ${kelas || "-"}, ${fase || "-"})` : `${jenjang || "-"} (Kelas ${kelas || "-"}, ${fase || "-"})`, font: "Times New Roman" }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Semester           : ", bold: true, font: "Times New Roman" }),
              new TextRun({ text: `Semester ${semester || "-"}`, font: "Times New Roman" }),
            ],
            spacing: { after: 300 },
          }),

          // Promes Table
          promesTable,

          new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),

          // Signatures block
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Mengetahui,", font: "Times New Roman" })] }),
                      new Paragraph({ children: [new TextRun({ text: "Kepala Sekolah", font: "Times New Roman" })] }),
                      new Paragraph({ text: "", spacing: { after: 800 } }),
                      new Paragraph({ children: [new TextRun({ text: kepalaSekolah || "___________________", bold: true, font: "Times New Roman" })] }),
                      new Paragraph({ children: [new TextRun({ text: kepalaNip ? `NIP. ${kepalaNip}` : "NIP. ___________________", font: "Times New Roman" })] }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: datumTanggal || "Pohuwato, ____________ 2026", font: "Times New Roman" })] }),
                      new Paragraph({ children: [new TextRun({ text: "Guru Mata Pelajaran", font: "Times New Roman" })] }),
                      new Paragraph({ text: "", spacing: { after: 800 } }),
                      new Paragraph({ children: [new TextRun({ text: guruNama || "___________________", bold: true, font: "Times New Roman" })] }),
                      new Paragraph({ children: [new TextRun({ text: nip ? `NIP. ${nip}` : "NIP. ___________________", font: "Times New Roman" })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }],
    });

    // Package Document
    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Disposition", `attachment; filename="PROMES_SAHAJA_${mapel.replace(/\s+/g, "_")}.docx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buffer);
  } catch (error: any) {
    console.error("Error exporting DOCX:", error);
    res.status(500).json({ success: false, message: "Gagal mengekspor dokumen Word: " + error.message });
  }
});

// START EXPRESS SERVER WITH VITE (OR STATIC FILES)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
