import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, 
  FileText, 
  Upload, 
  Calendar, 
  Clock, 
  History, 
  Download, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Plus, 
  BookOpen, 
  ChevronRight, 
  Save, 
  RefreshCw, 
  FileDown, 
  Eye, 
  Sparkles,
  Search,
  School,
  User,
  Hash,
  CalendarDays,
  ArrowLeft,
  Lock,
  LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

import { 
  Jenjang, 
  CURRICULUM_DATA, 
  TujuanPembelajaran, 
  IndikatorPembelajaran,
  Week, 
  Schedule, 
  PromesMetadata, 
  PromesDocument, 
  getDefaultWeeks 
} from "./types";

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("promes_auth") === "true";
  });
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");
    
    // Simulate API delay
    setTimeout(() => {
      if (loginUsername === "admin" && loginPassword === "admin123") {
        setIsAuthenticated(true);
        localStorage.setItem("promes_auth", "true");
      } else {
        setLoginError("Username atau password salah");
      }
      setIsLoggingIn(false);
    }, 600);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("promes_auth");
  };


  // Navigation & UI tabs
  const [activeTab, setActiveTab] = useState<"buat" | "riwayat" | "preview">("buat");

  // Stepper inside "Buat PROMES"
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form states - Step 1: Metadata & Jadwal
  const [metadata, setMetadata] = useState<PromesMetadata>({
    jenjang: "SD",
    fase: "Fase A",
    kelas: "Kelas I",
    mapel: "Bahasa Indonesia",
    semester: 1,
    tahunPelajaran: "2026/2027",
    guruNama: "Nirwan Husain, S.Pd",
    nip: "198908202024212050",
    kepalaSekolah: "Lukman Daud, S.Pd",
    kepalaNip: "196810202006041009",
    namaSekolah: "SD Negeri 04 Buntulia",
    datumTanggal: "Buntulia, 13 Juli 2026"
  });

  // Dropdown list options states with localStorage persistence and default values
  const [sekolahOptions, setSekolahOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("sekolah_options");
    return saved ? JSON.parse(saved) : ["SD Negeri 04 Buntulia", "SD Negeri 01 Marisa"];
  });

  const [guruOptions, setGuruOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("guru_options");
    return saved ? JSON.parse(saved) : ["Nirwan Husain, S.Pd", "Weli Darlamakaraka, S.Pd."];
  });

  const [nipOptions, setNipOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("nip_options");
    return saved ? JSON.parse(saved) : ["198908202024212050", "198905202015031002"];
  });

  const [kepalaOptions, setKepalaOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("kepala_options");
    return saved ? JSON.parse(saved) : ["Lukman Daud, S.Pd", "Drs. H. Mulyono, M.Pd."];
  });

  const [kepalaNipOptions, setKepalaNipOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("kepala_nip_options");
    return saved ? JSON.parse(saved) : ["196810202006041009", "197210151998031001"];
  });

  // Helper function to auto-accumulate typed values into lists
  const addToOptions = (type: "sekolah" | "guru" | "nip" | "kepala" | "kepalaNip", value: string) => {
    if (!value || value.trim() === "") return;
    const trimmed = value.trim();
    
    if (type === "sekolah") {
      setSekolahOptions(prev => {
        if (prev.includes(trimmed)) return prev;
        const next = [...prev, trimmed];
        localStorage.setItem("sekolah_options", JSON.stringify(next));
        return next;
      });
    } else if (type === "guru") {
      setGuruOptions(prev => {
        if (prev.includes(trimmed)) return prev;
        const next = [...prev, trimmed];
        localStorage.setItem("guru_options", JSON.stringify(next));
        return next;
      });
    } else if (type === "nip") {
      setNipOptions(prev => {
        if (prev.includes(trimmed)) return prev;
        const next = [...prev, trimmed];
        localStorage.setItem("nip_options", JSON.stringify(next));
        return next;
      });
    } else if (type === "kepala") {
      setKepalaOptions(prev => {
        if (prev.includes(trimmed)) return prev;
        const next = [...prev, trimmed];
        localStorage.setItem("kepala_options", JSON.stringify(next));
        return next;
      });
    } else if (type === "kepalaNip") {
      setKepalaNipOptions(prev => {
        if (prev.includes(trimmed)) return prev;
        const next = [...prev, trimmed];
        localStorage.setItem("kepala_nip_options", JSON.stringify(next));
        return next;
      });
    }
  };

  const [schedule, setSchedule] = useState<Schedule>({
    Senin: 2,
    Selasa: 2,
    Rabu: 0,
    Kamis: 0,
    Jumat: 0,
    Sabtu: 0
  });

  // Calculate total weekly JP
  const totalWeeklyJp = (Object.values(schedule) as number[]).reduce((sum, val) => sum + val, 0);

  // Step 2: Files Upload
  const [atpFile, setAtpFile] = useState<File | null>(null);
  const [calendarFile, setCalendarFile] = useState<File | null>(null);
  const [atpError, setAtpError] = useState<string>("");
  const [atpWarning, setAtpWarning] = useState<string>("");
  const [isParsingAtp, setIsParsingAtp] = useState<boolean>(false);
  const [isParsingCalendar, setIsParsingCalendar] = useState<boolean>(false);
  const [uploadType, setUploadType] = useState<"atp" | "calendar">("atp");

  // Parsed ATP data stored locally before confirming PROMES
  const [parsedTps, setParsedTps] = useState<TujuanPembelajaran[]>([]);
  const [rawParsedResult, setRawParsedResult] = useState<any>(null);

  // Step 3: Calendar Weeks Configuration (initialized with Default Semester 1 weeks)
  const [weeks, setWeeks] = useState<Week[]>([]);

  // Generator & Progress States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generateProgress, setGenerateProgress] = useState<number>(0);
  const [generateStatus, setGenerateStatus] = useState<string>("");

  // Result States (Step 4 & Edit Tab)
  const [activePromes, setActivePromes] = useState<PromesDocument | null>(null);
  const [editingParentTpId, setEditingParentTpId] = useState<string | null>(null);
  const [editingIndikatorId, setEditingIndikatorId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{ tp: string; indikator: string; jp: number }>({ tp: "", indikator: "", jp: 4 });

  // Database History State
  const [historyList, setHistoryList] = useState<PromesDocument[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>("");

  // Update Fase, Kelas, Mapel based on selected Jenjang (only if current values are not valid for the new Jenjang)
  useEffect(() => {
    const curOptions = CURRICULUM_DATA[metadata.jenjang];
    const isFaseValid = curOptions.fase.includes(metadata.fase);
    const isKelasValid = curOptions.kelas.includes(metadata.kelas);
    const isMapelValid = curOptions.mapel.includes(metadata.mapel);

    if (!isFaseValid || !isKelasValid || !isMapelValid) {
      setMetadata(prev => ({
        ...prev,
        fase: isFaseValid ? prev.fase : curOptions.fase[0],
        kelas: isKelasValid ? prev.kelas : curOptions.kelas[0],
        mapel: isMapelValid ? prev.mapel : curOptions.mapel[0]
      }));
    }
  }, [metadata.jenjang]);

  // Reset/Initialize calendar weeks based on Semester selection
  useEffect(() => {
    setWeeks(getDefaultWeeks(metadata.semester));
  }, [metadata.semester]);

  // Load history list on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch("/api/promes");
      const result = await res.json();
      if (result.success) {
        setHistoryList(result.data);
      }
    } catch (err) {
      console.error("Gagal memuat riwayat:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Multer file upload for ATP
  const handleAtpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAtpFile(file);
    setAtpError("");
    setAtpWarning("");
    setIsParsingAtp(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/parse-atp", {
        method: "POST",
        body: formData
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("Layanan pengurai dokumen sedang bersiap atau tidak merespon dengan benar. Silakan coba kembali beberapa saat lagi.");
      }

      const result = await response.json();
      if (result.success) {
        const { jenjang, fase, kelas, mapel, semester, tps, offline } = result.data;
        
        if (offline) {
          setAtpWarning("Catatan: Layanan AI (Gemini) sedang padat atau belum terkonfigurasi. Dokumen Alur Tujuan Pembelajaran (ATP) Anda berhasil dianalisis menggunakan Engine Offline SahaJA secara cerdas.");
        }

        // We respect and preserve the user's manual metadata selections (such as Class and Subject) made in Step 1.
        // We only use the parsed semester if not already set, but we keep other fields untouched.
        setMetadata(prev => ({
          ...prev,
          semester: prev.semester || semester || 1
        }));

        // Convert parsed TPs into TujuanPembelajaran format with nested indicators and temporary IDs
        const formattedTps: TujuanPembelajaran[] = tps.map((item: any, idx: number) => {
          const tpId = `tp_${Date.now()}_${idx}`;
          const parsedIndikatorList = Array.isArray(item.indikatorList) ? item.indikatorList : [];
          
          const formattedIndikatorList = parsedIndikatorList.map((ind: any, iIdx: number) => ({
            id: `ind_${Date.now()}_${idx}_${iIdx}`,
            indikator: ind.indikator || `Menguasai materi ${ind.materi || item.materi || ""}`,
            jp: Number(ind.jp) || 4,
            materi: ind.materi || ""
          }));

          // Fallback if list is empty
          if (formattedIndikatorList.length === 0) {
            formattedIndikatorList.push({
              id: `ind_${Date.now()}_${idx}_0`,
              indikator: item.indikator || `Menguasai materi ${item.materi || ""}`,
              jp: Number(item.jp) || 4,
              materi: item.materi || ""
            });
          }

          return {
            id: tpId,
            tp: item.tp,
            indikatorList: formattedIndikatorList,
            semester: Number(item.semester) || metadata.semester
          };
        });

        setParsedTps(formattedTps);
        setRawParsedResult(result.data);
      } else {
        setAtpError(result.message || "Gagal mengurai dokumen ATP.");
      }
    } catch (err: any) {
      setAtpError("Gagal menghubungi server untuk mengurai ATP: " + err.message);
    } finally {
      setIsParsingAtp(false);
    }
  };

  // Optional Education Calendar upload
  const handleCalendarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCalendarFile(file);
    setIsParsingCalendar(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/parse-calendar", {
        method: "POST",
        body: formData
      });

      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("Layanan kalender sedang bersiap atau tidak merespon dengan benar.");
      }

      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        // Overlay AI parsed events onto our default weeks list
        const updatedWeeks = [...weeks];
        result.data.forEach((parsedEvent: any) => {
          // Try to match parsed month and week to local calendar weeks
          const matchedWeek = updatedWeeks.find(
            w => w.month.toLowerCase() === parsedEvent.bulan.toLowerCase() && w.weekNum === parsedEvent.mingguKe
          );
          if (matchedWeek) {
            matchedWeek.isEffective = parsedEvent.isEfektif;
            matchedWeek.activity = parsedEvent.namaEvent;
          }
        });
        setWeeks(updatedWeeks);
      }
    } catch (err) {
      console.error("Gagal mengurai kalender:", err);
    } finally {
      setIsParsingCalendar(false);
    }
  };

  const handleClearAtp = () => {
    setAtpFile(null);
    setParsedTps([]);
    setAtpError("");
    setAtpWarning("");
    setRawParsedResult(null);
  };

  const handleClearCalendar = () => {
    setCalendarFile(null);
    setWeeks(getDefaultWeeks(metadata.semester));
  };

  // Run the scheduler algorithm locally to produce immediate, high-performance PROMES grid
  const runLocalScheduler = (meta: PromesMetadata, tpsList: TujuanPembelajaran[], weeksList: Week[], weeklyJp: number) => {
    const effectiveWeeks = weeksList.filter(w => w.isEffective);
    const grid: Record<string, Record<string, number>> = {};
    
    // Initialize empty grid for each Indikator
    tpsList.forEach(tp => {
      const list = tp.indikatorList || [];
      list.forEach(ind => {
        grid[ind.id] = {};
      });
    });

    if (effectiveWeeks.length === 0 || weeklyJp === 0) {
      return grid; // Return empty grid if no weeks or teaching hours
    }

    let weekIdx = 0;
    let currentWeekRemainingJp = weeklyJp;

    tpsList.forEach(tp => {
      const list = tp.indikatorList || [];
      list.forEach(ind => {
        let indRemainingJp = ind.jp;

        while (indRemainingJp > 0 && weekIdx < effectiveWeeks.length) {
          const currentWeekId = effectiveWeeks[weekIdx].id;
          const jpToAllocate = Math.min(indRemainingJp, currentWeekRemainingJp);

          if (!grid[ind.id]) grid[ind.id] = {};
          grid[ind.id][currentWeekId] = jpToAllocate;

          indRemainingJp -= jpToAllocate;
          currentWeekRemainingJp -= jpToAllocate;

          if (currentWeekRemainingJp === 0) {
            weekIdx++;
            if (weekIdx < effectiveWeeks.length) {
              currentWeekRemainingJp = weeklyJp; // Reset weekly hours for next week
            }
          }
        }
      });
    });

    return grid;
  };

  // Generate PROMES Trigger (triggers visual progress bar and saves to DB)
  const handleGeneratePromes = () => {
    if (parsedTps.length === 0) {
      alert("Harap unggah ATP terlebih dahulu untuk mendeteksi Tujuan Pembelajaran!");
      return;
    }
    if (totalWeeklyJp === 0) {
      alert("Harap atur jadwal mengajar terlebih dahulu (JP per minggu tidak boleh 0)!");
      return;
    }

    setIsGenerating(true);
    setGenerateProgress(10);
    setGenerateStatus("Membaca ATP...");

    setTimeout(() => {
      setGenerateProgress(35);
      setGenerateStatus("Menganalisis Tujuan Pembelajaran Kurikulum Merdeka...");

      setTimeout(() => {
        setGenerateProgress(65);
        setGenerateStatus("Menghitung Minggu Efektif Kalender Pendidikan...");

        setTimeout(() => {
          setGenerateProgress(90);
          setGenerateStatus("Menyusun Program Semester & Sinkronisasi Waktu...");

          setTimeout(async () => {
            // Run the layout planner
            const finalGrid = runLocalScheduler(metadata, parsedTps, weeks, totalWeeklyJp);
            
            const newDoc: PromesDocument = {
              id: "promes_" + Date.now(),
              metadata,
              tps: parsedTps,
              weeks,
              grid: finalGrid,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            // Save automatically to backend database
            try {
              const res = await fetch("/api/promes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newDoc)
              });
              const saved = await res.json();
              if (saved.success) {
                setActivePromes(saved.data);
                fetchHistory(); // Refresh library list
              } else {
                setActivePromes(newDoc); // Fallback to local state if server DB has issues
              }
            } catch (err) {
              console.error("Gagal auto-save ke server database:", err);
              setActivePromes(newDoc);
            }

            setGenerateProgress(100);
            setGenerateStatus("Selesai!");
            setIsGenerating(false);
            setActiveTab("preview");
            setCurrentStep(4);
          }, 800);
        }, 800);
      }, 800);
    }, 600);
  };

  // Delete document
  const handleDeletePromes = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Apakah Anda yakin ingin menghapus dokumen PROMES ini dari riwayat?")) return;

    try {
      const res = await fetch(`/api/promes/${id}`, {
        method: "DELETE"
      });
      const result = await res.json();
      if (result.success) {
        fetchHistory();
        if (activePromes?.id === id) {
          setActivePromes(null);
        }
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert("Gagal menghapus dokumen dari server.");
    }
  };

  // View historical document
  const handleSelectHistory = (doc: PromesDocument) => {
    setActivePromes(doc);
    setMetadata(doc.metadata);
    setWeeks(doc.weeks);
    setParsedTps(doc.tps);
    setActiveTab("preview");
    setCurrentStep(4);
  };

  // Update a single indicator in the PROMES table dynamically (Auto Saves back)
  const handleSaveCellEdit = async () => {
    if (!activePromes || !editingParentTpId || !editingIndikatorId) return;

    const updatedTps = activePromes.tps.map(tp => {
      if (tp.id === editingParentTpId) {
        const updatedList = (tp.indikatorList || []).map(ind => {
          if (ind.id === editingIndikatorId) {
            return {
              ...ind,
              indikator: editFields.indikator,
              jp: Number(editFields.jp) || 4
            };
          }
          return ind;
        });
        return {
          ...tp,
          tp: editFields.tp,
          indikatorList: updatedList
        };
      }
      return tp;
    });

    // Re-run scheduler with new values
    const finalGrid = runLocalScheduler(activePromes.metadata, updatedTps, activePromes.weeks, totalWeeklyJp || 4);

    const updatedDoc: PromesDocument = {
      ...activePromes,
      tps: updatedTps,
      grid: finalGrid,
      updatedAt: new Date().toISOString()
    };

    setActivePromes(updatedDoc);
    setEditingParentTpId(null);
    setEditingIndikatorId(null);

    // Sync to DB
    try {
      await fetch("/api/promes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedDoc)
      });
      fetchHistory();
    } catch (err) {
      console.error("Gagal melakukan sinkronisasi auto-save:", err);
    }
  };

  // Inline edits trigger
  const handleStartCellEdit = (tp: TujuanPembelajaran, ind: IndikatorPembelajaran) => {
    setEditingParentTpId(tp.id);
    setEditingIndikatorId(ind.id);
    setEditFields({
      tp: tp.tp,
      indikator: ind.indikator,
      jp: ind.jp
    });
  };

  // Export DOCX via Server Post
  const handleExportDocx = async () => {
    if (!activePromes) return;

    try {
      const response = await fetch("/api/export-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(activePromes)
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PROMES_SAHAJA_${activePromes.metadata.mapel.replace(/\s+/g, "_")}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const err = await response.json();
        alert("Gagal mengunduh dokumen Word: " + err.message);
      }
    } catch (error) {
      alert("Kesalahan koneksi ke server saat mengunduh Word.");
    }
  };

  // Generate and Download PDF completely on the client using jsPDF (instant and 100% reliable)
  const handleExportPdf = () => {
    if (!activePromes) return;

    const { metadata: meta, tps, weeks: wks, grid } = activePromes;
    const doc = new jsPDF("p", "mm", "a4");

    // Title & Header setup
    doc.setFont("Times", "bold");
    doc.setFontSize(14);
    doc.text("PROGRAM SEMESTER (PROMES)", 105, 15, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`TAHUN PELAJARAN: ${meta.tahunPelajaran}`, 105, 21, { align: "center" });

    // Metadata Block
    doc.setFont("Times", "bold");
    doc.text("Mata Pelajaran:", 15, 32);
    doc.setFont("Times", "normal");
    doc.text(meta.mapel, 55, 32);

    doc.setFont("Times", "bold");
    doc.text("Satuan Pendidikan:", 15, 38);
    doc.setFont("Times", "normal");
    doc.text(meta.namaSekolah ? `${meta.namaSekolah} (${meta.jenjang})` : `${meta.jenjang} (${meta.kelas}, ${meta.fase})`, 55, 38);

    doc.setFont("Times", "bold");
    doc.text("Semester:", 15, 44);
    doc.setFont("Times", "normal");
    doc.text(`Semester ${meta.semester}`, 55, 44);

    // Build Table Body
    const tableBody: any[] = [];
    let globalIndex = 1;
    tps.forEach((tp) => {
      const list = tp.indikatorList || [];
      if (list.length === 0) {
        tableBody.push([
          String(globalIndex++),
          tp.tp,
          "-",
          "0 JP",
          "Belum Dijadwalkan"
        ]);
      } else {
        list.forEach((ind, indIdx) => {
          const scheduledWeeks: string[] = [];
          wks.forEach(w => {
            const allocated = grid[ind.id]?.[w.id];
            if (allocated && allocated > 0) {
              scheduledWeeks.push(`${w.month} M${w.weekNum} (${allocated} JP)`);
            }
          });
          const pelaksanaan = scheduledWeeks.length > 0 ? scheduledWeeks.join(", ") : "Belum Dijadwalkan";

          tableBody.push([
            indIdx === 0 ? String(globalIndex++) : "",
            indIdx === 0 ? tp.tp : "",
            ind.indikator || "-",
            `${ind.jp} JP`,
            pelaksanaan
          ]);
        });
      }
    });

    // Draw Table
    (doc as any).autoTable({
      startY: 52,
      head: [["No", "Tujuan Pembelajaran (TP)", "Indikator Pembelajaran (IKTP)", "Alokasi", "Tanggal / Minggu Pelaksanaan"]],
      body: tableBody,
      styles: {
        font: "Times",
        fontSize: 10,
        cellPadding: 3,
        lineColor: [180, 180, 180],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [60, 60, 60],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: 60 },
        2: { cellWidth: 55 },
        3: { halign: "center", cellWidth: 15 },
        4: { cellWidth: 50 },
      },
      theme: "grid",
    });

    // Signature Block below Table
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Check page overflow for signatures
    if (finalY > 240) {
      doc.addPage();
    }

    const pageHeight = doc.internal.pageSize.height;
    const sigY = finalY > 240 ? 30 : finalY;

    doc.setFont("Times", "normal");
    doc.setFontSize(11);

    // Left Signature
    doc.text("Mengetahui,", 20, sigY);
    doc.text("Kepala Sekolah,", 20, sigY + 6);
    doc.setFont("Times", "bold");
    doc.text(meta.kepalaSekolah || "____________________", 20, sigY + 30);
    doc.setFont("Times", "normal");
    doc.text(meta.kepalaNip ? `NIP. ${meta.kepalaNip}` : "NIP. ____________________", 20, sigY + 36);

    // Right Signature
    doc.text(meta.datumTanggal || "Pohuwato, ________________ 2026", 130, sigY);
    doc.text("Guru Mata Pelajaran,", 130, sigY + 6);
    doc.setFont("Times", "bold");
    doc.text(meta.guruNama || "____________________", 130, sigY + 30);
    doc.setFont("Times", "normal");
    doc.text(meta.nip ? `NIP. ${meta.nip}` : "NIP. ____________________", 130, sigY + 36);

    // Save
    doc.save(`PROMES_SAHAJA_${meta.mapel.replace(/\s+/g, "_")}.pdf`);
  };

  // Fast forward default ATP and schedules for easy user demonstration if they don't upload a file
  const handleLoadDemoData = () => {
    setMetadata({
      jenjang: "SD",
      fase: "Fase B",
      kelas: "Kelas IV",
      mapel: "IPAS",
      semester: 1,
      tahunPelajaran: "2026/2027",
      guruNama: "Weli Darlamakaraka, S.Pd.",
      nip: "198905202015031002",
      kepalaSekolah: "Drs. H. Mulyono, M.Pd.",
      kepalaNip: "197210151998031001",
      namaSekolah: "SD Negeri 01 Marisa",
      datumTanggal: "Pohuwato, 13 Juli 2026"
    });

    setSchedule({
      Senin: 3,
      Selasa: 0,
      Rabu: 2,
      Kamis: 0,
      Jumat: 0,
      Sabtu: 0
    });

    const demoTps: TujuanPembelajaran[] = [
      {
        id: "demo_tp_1",
        tp: "Menganalisis hubungan antara bentuk serta fungsi bagian tubuh pada manusia.",
        indikatorList: [
          {
            id: "demo_ind_1",
            indikator: "Mengidentifikasi fungsi panca indera dan bagian tubuh manusia serta merawatnya.",
            jp: 6,
            materi: "Fungsi Bagian Tubuh"
          }
        ],
        semester: 1
      },
      {
        id: "demo_tp_2",
        tp: "Menganalisis siklus hidup makhluk hidup dan upaya pelestariannya.",
        indikatorList: [
          {
            id: "demo_ind_2",
            indikator: "Membuat bagan siklus hidup hewan di lingkungan sekitar sekolah.",
            jp: 4,
            materi: "Siklus Makhluk Hidup"
          }
        ],
        semester: 1
      },
      {
        id: "demo_tp_3",
        tp: "Mengidentifikasi ragam gaya (gaya otot, gaya gesek, gaya magnet, gaya gravitasi) di kehidupan sehari-hari.",
        indikatorList: [
          {
            id: "demo_ind_3",
            indikator: "Mempraktikkan pengaruh gaya gesek terhadap kecepatan gerak benda.",
            jp: 8,
            materi: "Ragam Gaya Fisika"
          }
        ],
        semester: 1
      },
      {
        id: "demo_tp_4",
        tp: "Mendeskripsikan keragaman budaya dan kearifan lokal di wilayah kabupaten/kota tempat tinggal.",
        indikatorList: [
          {
            id: "demo_ind_4",
            indikator: "Menyajikan laporan tertulis kebudayaan khas daerah masing-masing daerah.",
            jp: 6,
            materi: "Kearifan Lokal Nusantara"
          }
        ],
        semester: 1
      }
    ];

    setParsedTps(demoTps);
    setCurrentStep(3); // Progress directly to calendar configuration step
  };

  // Filtering history
  const filteredHistory = historyList.filter(doc => 
    doc.metadata.mapel.toLowerCase().includes(historySearch.toLowerCase()) ||
    doc.metadata.kelas.toLowerCase().includes(historySearch.toLowerCase()) ||
    doc.metadata.guruNama.toLowerCase().includes(historySearch.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-10 rounded-3xl shadow-xl w-full max-w-md border border-slate-100"
        >
          <div className="p-3 bg-sky-500 rounded-xl mx-auto w-fit mb-6 shadow-sm">
            <School className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center tracking-tight">PROMES SAHAJA</h1>
          <p className="text-sm text-slate-500 text-center mb-8">Program Semester Otomatis</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="text" 
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50 outline-none transition-all"
                  placeholder="Masukkan username..."
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-start">
                <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-70 transition-colors"
            >
              {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : "Masuk"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="promes_sahaja_app" className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      
      {/* Visual Navigation Bar */}
      <header id="header_rail" className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500 rounded-xl text-slate-900 shadow-inner flex items-center justify-center">
              <School className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display text-sky-400">
                PROMES SAHAJA
              </h1>
              <p className="text-xs text-slate-300">
                Penyusun Program Semester Otomatis Kurikulum Merdeka
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button 
              id="tab_btn_buat"
              onClick={() => setActiveTab("buat")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "buat" 
                  ? "bg-sky-500 text-slate-950 shadow-sm" 
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Buat PROMES
            </button>
            <button 
              id="tab_btn_riwayat"
              onClick={() => { setActiveTab("riwayat"); fetchHistory(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "riwayat" 
                  ? "bg-sky-500 text-slate-950 shadow-sm" 
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <History className="w-4 h-4" />
              Riwayat Dokumen
            </button>
            {activePromes && (
              <button 
                id="tab_btn_preview"
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "preview" 
                    ? "bg-sky-500 text-slate-950 shadow-sm" 
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Eye className="w-4 h-4" />
                Preview & Edit
              </button>
            )}
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-red-500 hover:border-red-500 transition-colors"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Dynamic Loading State overlay for overall generation progress */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
                <Loader2 className="w-12 h-12 text-sky-400 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white font-display mb-2">Sedang Menyusun PROMES...</h3>
                <p className="text-sm text-slate-400 mb-6">{generateStatus}</p>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: `${generateProgress}%` }}
                    className="bg-sky-500 h-full"
                  />
                </div>
                <span className="text-xs text-sky-400 mt-2 block font-mono font-medium">{generateProgress}% Selesai</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeTab === "buat" && (
            <motion.div
              key="buat_tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stepper Header */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  {currentStep > 1 && (
                    <button 
                      onClick={() => setCurrentStep(1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-600 transition shadow-sm border border-slate-200"
                      title="Kembali ke Info Dasar"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Info Dasar</span>
                    </button>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full uppercase tracking-wider self-start">
                      Asisten Pembuatan PROMES
                    </span>
                    <button 
                      onClick={handleLoadDemoData}
                      className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-medium px-3 py-1 rounded-full transition flex items-center gap-1 self-start"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Gunakan Demo Data Cepat
                    </button>
                  </div>
                </div>
                
                {/* Visual Step Dots */}
                <div className="flex items-center gap-3">
                  {[
                    { num: 1, label: "Info Dasar" },
                    { num: 2, label: "Unggah Dokumen" },
                    { num: 3, label: "Kalender & Jadwal" }
                  ].map((s) => (
                    <button 
                      key={s.num}
                      onClick={() => {
                        if (s.num === 1) setCurrentStep(1);
                        else if (s.num === 2) {
                          if (totalWeeklyJp > 0) setCurrentStep(2);
                        } else if (s.num === 3) {
                          if (parsedTps.length > 0) setCurrentStep(3);
                        }
                      }}
                      disabled={s.num === 2 ? totalWeeklyJp === 0 : s.num === 3 ? parsedTps.length === 0 : false}
                      className="flex items-center gap-1.5 focus:outline-none disabled:opacity-40 transition hover:opacity-85"
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        currentStep >= s.num ? "bg-sky-500 text-slate-950" : "bg-slate-100 text-slate-400"
                      }`}>
                        {s.num}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 hidden sm:inline">{s.label}</span>
                      {s.num < 3 && <ChevronRight className="w-3 h-3 text-slate-300 hidden sm:block" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 1: Metadata & Jadwal */}
              {currentStep === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Informational Profile */}
                  <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <School className="w-5 h-5 text-sky-500" />
                      <h2 className="text-lg font-bold text-slate-900 font-display">Identitas & Kurikulum Satuan Pendidikan</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Jenjang Sekolah</label>
                        <select 
                          value={metadata.jenjang}
                          onChange={(e) => setMetadata(prev => ({ ...prev, jenjang: e.target.value as Jenjang }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                        >
                          <option value="PAUD">PAUD (Pendidikan Anak Usia Dini)</option>
                          <option value="SD">SD (Sekolah Dasar)</option>
                          <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Fase Pembelajaran</label>
                        <select 
                          value={metadata.fase}
                          onChange={(e) => setMetadata(prev => ({ ...prev, fase: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                        >
                          {CURRICULUM_DATA[metadata.jenjang].fase.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Kelas / Kelompok</label>
                        <select 
                          value={metadata.kelas}
                          onChange={(e) => setMetadata(prev => ({ ...prev, kelas: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                        >
                          {CURRICULUM_DATA[metadata.jenjang].kelas.map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Mata Pelajaran</label>
                        <select 
                          value={metadata.mapel}
                          onChange={(e) => setMetadata(prev => ({ ...prev, mapel: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                        >
                          {CURRICULUM_DATA[metadata.jenjang].mapel.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Semester</label>
                        <select 
                          value={metadata.semester}
                          onChange={(e) => setMetadata(prev => ({ ...prev, semester: Number(e.target.value) }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                        >
                          <option value={1}>Semester I (Ganjil)</option>
                          <option value={2}>Semester II (Genap)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tahun Pelajaran</label>
                        <input 
                          type="text"
                          value={metadata.tahunPelajaran}
                          onChange={(e) => setMetadata(prev => ({ ...prev, tahunPelajaran: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                          placeholder="Contoh: 2026/2027"
                        />
                      </div>
                    </div>

                    {/* Teacher profiles for official signoff */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                      <span className="text-xs font-bold text-slate-500 uppercase block tracking-wider">Identitas Sekolah & Penandatangan Dokumen</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-200/50 pb-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 font-sans">Nama Satuan Pendidikan (Sekolah)</label>
                            <input 
                              type="text"
                              list="sekolah-list"
                              value={metadata.namaSekolah || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMetadata(prev => ({ ...prev, namaSekolah: val }));
                              }}
                              onBlur={(e) => addToOptions("sekolah", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-sans"
                              placeholder="SD Negeri 04 Buntulia"
                            />
                            <datalist id="sekolah-list">
                              {sekolahOptions.map((opt) => (
                                <option key={opt} value={opt} />
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 font-sans">Tanggal Dokumen / Datum (Contoh: Pohuwato, 13 Juli 2026)</label>
                            <input 
                              type="text"
                              value={metadata.datumTanggal || ""}
                              onChange={(e) => setMetadata(prev => ({ ...prev, datumTanggal: e.target.value }))}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-sans"
                              placeholder="Buntulia, 13 Juli 2026"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 font-sans">Nama Lengkap Guru</label>
                          <input 
                            type="text"
                            list="guru-list"
                            value={metadata.guruNama}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMetadata(prev => ({ ...prev, guruNama: val }));
                            }}
                            onBlur={(e) => addToOptions("guru", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-sans"
                            placeholder="Nirwan Husain, S.Pd"
                          />
                          <datalist id="guru-list">
                            {guruOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 font-sans">NIP Guru</label>
                          <input 
                            type="text"
                            list="nip-list"
                            value={metadata.nip}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMetadata(prev => ({ ...prev, nip: val }));
                            }}
                            onBlur={(e) => addToOptions("nip", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-sans"
                            placeholder="198908202024212050"
                          />
                          <datalist id="nip-list">
                            {nipOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 font-sans">Nama Kepala Sekolah</label>
                          <input 
                            type="text"
                            list="kepala-list"
                            value={metadata.kepalaSekolah}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMetadata(prev => ({ ...prev, kepalaSekolah: val }));
                            }}
                            onBlur={(e) => addToOptions("kepala", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-sans"
                            placeholder="Lukman Daud, S.Pd"
                          />
                          <datalist id="kepala-list">
                            {kepalaOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 font-sans">NIP Kepala Sekolah</label>
                          <input 
                            type="text"
                            list="kepala-nip-list"
                            value={metadata.kepalaNip}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMetadata(prev => ({ ...prev, kepalaNip: val }));
                            }}
                            onBlur={(e) => addToOptions("kepalaNip", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-sans"
                            placeholder="196810202006041009"
                          />
                          <datalist id="kepala-nip-list">
                            {kepalaNipOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Teaching Hours Grid */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                        <Clock className="w-5 h-5 text-sky-500" />
                        <h2 className="text-lg font-bold text-slate-900 font-display">Alokasi JP per Minggu</h2>
                      </div>

                      <p className="text-xs text-slate-500">
                        Isikan alokasi Jam Pelajaran (JP) mengajar Anda pada masing-masing hari efektif belajar sekolah.
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        {Object.keys(schedule).map((day) => (
                          <div key={day} className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-500 mb-1">{day}</span>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                min={0}
                                max={10}
                                value={schedule[day as keyof Schedule]}
                                onChange={(e) => setSchedule(prev => ({
                                  ...prev,
                                  [day]: Math.max(0, Number(e.target.value) || 0)
                                }))}
                                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                              <span className="text-xs text-slate-400">JP</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Beban Total</span>
                        <span className="text-xl font-black text-slate-900">{totalWeeklyJp} JP / Minggu</span>
                      </div>
                      <button 
                        onClick={() => setCurrentStep(2)}
                        disabled={totalWeeklyJp === 0}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow transition flex items-center gap-1.5 ${
                          totalWeeklyJp > 0 
                            ? "bg-slate-900 text-white hover:bg-slate-800" 
                            : "bg-slate-100 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        Berikutnya
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: ATP & Calendar File Upload */}
              {currentStep === 2 && (
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <Upload className="w-5 h-5 text-sky-500" />
                      <h2 className="text-lg font-bold text-slate-900 font-display">Unggah Berkas Baru</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Left Side: File Type Selector & Saved States */}
                      <div className="md:col-span-5 space-y-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pilih Tipe Berkas</span>
                        
                        <div className="space-y-2.5">
                          <button 
                            type="button"
                            onClick={() => setUploadType("atp")}
                            className={`w-full text-left p-3 rounded-xl border-2 transition flex items-center justify-between ${
                              uploadType === "atp" 
                                ? "border-sky-500 bg-sky-50/30 text-sky-950" 
                                : "border-slate-100 hover:border-slate-200 text-slate-700 bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <FileText className={`w-5 h-5 ${uploadType === "atp" ? "text-sky-500" : "text-slate-400"}`} />
                              <div>
                                <span className="text-xs font-extrabold block">Dokumen ATP</span>
                                <span className="text-[10px] text-slate-500 block leading-tight">Alur Tujuan Pembelajaran</span>
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">Wajib</span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => setUploadType("calendar")}
                            className={`w-full text-left p-3 rounded-xl border-2 transition flex items-center justify-between ${
                              uploadType === "calendar" 
                                ? "border-sky-500 bg-sky-50/30 text-sky-950" 
                                : "border-slate-100 hover:border-slate-200 text-slate-700 bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Calendar className={`w-5 h-5 ${uploadType === "calendar" ? "text-sky-500" : "text-slate-400"}`} />
                              <div>
                                <span className="text-xs font-extrabold block">Kalender Pendidikan</span>
                                <span className="text-[10px] text-slate-500 block leading-tight">Jadwal libur & agenda</span>
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Opsional</span>
                          </button>
                        </div>

                        {/* Summary status indicator */}
                        <div className="pt-4 border-t border-slate-100 space-y-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Ungguhan</span>
                          
                          {/* ATP status item */}
                          <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-700 block truncate leading-none">ATP Kurikulum Merdeka</span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {atpFile ? atpFile.name : "Belum ada berkas"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {atpFile && (
                                <button
                                  type="button"
                                  onClick={handleClearAtp}
                                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-rose-600 transition"
                                  title="Unggah Ulang ATP Baru"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 animate-hover" />
                                </button>
                              )}
                              {atpFile ? (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                                  {parsedTps.length} TP Terurai
                                </span>
                              ) : (
                                <span className="text-[9px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded-full">Wajib</span>
                              )}
                            </div>
                          </div>

                          {/* Calendar status item */}
                          <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <Calendar className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-700 block truncate leading-none">Kalender Pendidikan</span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {calendarFile ? calendarFile.name : "Menggunakan default"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {calendarFile && (
                                <button
                                  type="button"
                                  onClick={handleClearCalendar}
                                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-rose-600 transition"
                                  title="Reset ke Kalender Default"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 animate-hover" />
                                </button>
                              )}
                              {calendarFile ? (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">Tersinkron</span>
                              ) : (
                                <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded-full">Default</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: File Dropzone & Loading Indicators */}
                      <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Unggah Berkas</span>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            {uploadType === "atp" 
                              ? "Unggah dokumen Alur Tujuan Pembelajaran (ATP) dalam format Excel (.xlsx, .xls), Word (.docx) atau PDF. AI kami akan mengekstraksi seluruh Tujuan Pembelajaran secara runut."
                              : "Unggah Kalender Akademik Sekolah jika ingin mendeteksi hari libur, jadwal ujian lokal, atau MPLS secara otomatis. Mendukung Excel, Word, atau PDF."
                            }
                          </p>
                        </div>

                        <label className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-sky-400 hover:bg-sky-50/20 transition group text-center relative overflow-hidden min-h-[180px]">
                          <input 
                            type="file" 
                            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel"
                            onChange={uploadType === "atp" ? handleAtpUpload : handleCalendarUpload}
                            className="hidden"
                          />
                          
                          {/* Parsing ATP loader */}
                          {uploadType === "atp" && isParsingAtp && (
                            <div className="space-y-3">
                              <Loader2 className="w-8 h-8 text-sky-500 animate-spin mx-auto" />
                              <span className="text-sm font-semibold text-sky-600 block">AI membaca ATP dan mengekstrak materi...</span>
                            </div>
                          )}

                          {/* Parsing Calendar loader */}
                          {uploadType === "calendar" && isParsingCalendar && (
                            <div className="space-y-3">
                              <Loader2 className="w-8 h-8 text-sky-500 animate-spin mx-auto" />
                              <span className="text-sm font-semibold text-sky-600 block">AI memetakan jadwal libur sekolah...</span>
                            </div>
                          )}

                          {/* File successfully uploaded state for ATP */}
                          {uploadType === "atp" && !isParsingAtp && atpFile && (
                            <div className="space-y-2">
                              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                              <span className="text-sm font-bold text-slate-950 block">{atpFile.name}</span>
                              <span className="text-xs text-slate-400 block font-mono font-medium">Ukuran: {(atpFile.size/1024).toFixed(1)} KB</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold">
                                Berhasil Terurai: {parsedTps.length} TP Terdeteksi!
                              </span>
                            </div>
                          )}

                          {/* File successfully uploaded state for Calendar */}
                          {uploadType === "calendar" && !isParsingCalendar && calendarFile && (
                            <div className="space-y-2">
                              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                              <span className="text-sm font-bold text-slate-950 block">{calendarFile.name}</span>
                              <span className="text-xs text-slate-400 block font-mono font-medium">Ukuran: {(calendarFile.size/1024).toFixed(1)} KB</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold">
                                Sinkronisasi Kalender Berhasil!
                              </span>
                            </div>
                          )}

                          {/* Idle state */}
                          {((uploadType === "atp" && !isParsingAtp && !atpFile) || 
                            (uploadType === "calendar" && !isParsingCalendar && !calendarFile)) && (
                            <div className="space-y-2">
                              <Upload className="w-8 h-8 text-slate-400 group-hover:text-sky-500 group-hover:scale-105 transition mx-auto" />
                              <span className="text-sm font-bold text-slate-800 block">+ Unggah File Baru</span>
                              <span className="text-xs text-slate-400 block">Klik atau Seret Berkas Disini</span>
                              <span className="text-[10px] text-slate-400">Excel, Word, atau PDF hingga 20MB</span>
                            </div>
                          )}
                        </label>

                        {/* Warning/Offline state */}
                        {uploadType === "atp" && atpWarning && (
                          <div className="bg-amber-50 border border-amber-100 text-amber-800 p-3 rounded-xl flex items-start gap-2 text-xs font-semibold">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                            <span>{atpWarning}</span>
                          </div>
                        )}

                        {/* Error state */}
                        {uploadType === "atp" && atpError && (
                          <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl flex items-start gap-2 text-xs font-semibold">
                            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>{atpError}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
                      <button 
                        onClick={() => setCurrentStep(1)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-sm transition"
                      >
                        Kembali
                      </button>
                      <button 
                        onClick={() => setCurrentStep(3)}
                        disabled={parsedTps.length === 0}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow transition flex items-center gap-1.5 ${
                          parsedTps.length > 0 
                            ? "bg-slate-900 text-white hover:bg-slate-800" 
                            : "bg-slate-100 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        Atur Kalender & Jadwal
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Calendar Weeks & Generative trigger */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  {/* Calendar Metrics Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                      <span className="text-xs font-semibold text-slate-400 block">Total Minggu Terjadwal</span>
                      <span className="text-2xl font-extrabold text-slate-900">{weeks.length} Minggu</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                      <span className="text-xs font-bold text-emerald-600 block">Minggu Efektif Belajar (KBM)</span>
                      <span className="text-2xl font-extrabold text-emerald-800">{weeks.filter(w => w.isEffective).length} Minggu</span>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
                      <span className="text-xs font-bold text-rose-600 block">Minggu Non-Efektif / Libur</span>
                      <span className="text-2xl font-extrabold text-rose-800">{weeks.filter(w => !w.isEffective).length} Minggu</span>
                    </div>
                    <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl">
                      <span className="text-xs font-bold text-sky-600 block">Total Jam Belajar (JP) Tersedia</span>
                      <span className="text-2xl font-extrabold text-sky-800">
                        {weeks.filter(w => w.isEffective).length * totalWeeklyJp} JP
                      </span>
                    </div>
                  </div>

                  {/* Weeks grid with switches */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 font-display">Tinjau Keefektifan Minggu Semester</h3>
                        <p className="text-xs text-slate-500">Anda dapat mengubah status setiap minggu di bawah untuk mencocokkan kalender sekolah Anda secara presisi.</p>
                      </div>
                      <span className="text-xs bg-sky-50 text-sky-700 font-bold px-3 py-1 rounded-full border border-sky-100 flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Beban Belajar: {parsedTps.reduce((acc, curr) => acc + (curr.indikatorList || []).reduce((sum, ind) => sum + ind.jp, 0), 0)} JP Total ATP
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[350px] overflow-y-auto pr-2">
                      {weeks.map((w, index) => (
                        <div 
                          key={w.id} 
                          className={`p-3.5 rounded-xl border transition ${
                            w.isEffective 
                              ? "bg-white border-slate-200" 
                              : "bg-slate-50 border-rose-100"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="text-xs text-slate-400 block font-mono font-bold">M{w.weekNum} - {w.month}</span>
                              <span className="text-sm font-extrabold text-slate-900">{w.activity}</span>
                            </div>
                            
                            {/* Toggle Switch */}
                            <button
                              onClick={() => {
                                const updated = [...weeks];
                                updated[index].isEffective = !updated[index].isEffective;
                                updated[index].activity = updated[index].isEffective ? "KBM (Kegiatan Belajar Mengajar)" : "Libur / Agenda Khusus";
                                setWeeks(updated);
                              }}
                              className={`w-9 h-5 rounded-full p-0.5 transition ${
                                w.isEffective ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full transition shadow-sm ${
                                w.isEffective ? "translate-x-4" : "translate-x-0"
                              }`} />
                            </button>
                          </div>

                          <div className="mt-2.5">
                            <input 
                              type="text"
                              value={w.activity}
                              onChange={(e) => {
                                const updated = [...weeks];
                                updated[index].activity = e.target.value;
                                setWeeks(updated);
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                              placeholder="Deskripsi kegiatan..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Generate button bar */}
                    <div className="pt-4 flex flex-wrap gap-3 justify-end border-t border-slate-100">
                      <button 
                        onClick={() => setCurrentStep(1)}
                        className="px-4 py-2.5 rounded-xl border border-sky-200 hover:bg-sky-50 text-sky-700 font-bold text-sm transition flex items-center gap-1.5"
                        title="Kembali ke Info Dasar"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Info Dasar</span>
                      </button>
                      <button 
                        onClick={() => setCurrentStep(2)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-sm transition"
                      >
                        Kembali
                      </button>
                      <button 
                        onClick={handleGeneratePromes}
                        className="px-6 py-2.5 rounded-xl bg-sky-500 text-slate-950 hover:bg-sky-400 font-extrabold text-sm shadow transition flex items-center gap-1.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate PROMES Sekarang
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "riwayat" && (
            <motion.div
              key="riwayat_tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Search & Header bar */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 font-display">Daftar Arsip & Riwayat PROMES</h2>
                  <p className="text-xs text-slate-500">Seluruh dokumen Program Semester Anda tersimpan dengan aman.</p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input 
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Cari mapel, kelas, guru..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* History list card grids */}
              {isHistoryLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-2" />
                  <span className="text-sm font-semibold text-slate-500">Memuat berkas riwayat guru...</span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                  <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-700">Tidak ada PROMES ditemukan</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Mulai susun Program Semester pertama Anda dengan mengunggah ATP pada tab &apos;Buat PROMES&apos;.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredHistory.map((doc) => (
                    <div 
                      key={doc.id}
                      onClick={() => handleSelectHistory(doc)}
                      className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-sky-300 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between group relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-100">
                            {doc.metadata.jenjang} - {doc.metadata.kelas}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono font-medium">
                            {new Date(doc.updatedAt).toLocaleDateString("id-ID")}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-base font-bold text-slate-900 leading-snug group-hover:text-sky-600 transition">
                            {doc.metadata.mapel}
                          </h4>
                          <span className="text-xs text-slate-400 font-medium block">Semester {doc.metadata.semester} - {doc.metadata.tahunPelajaran}</span>
                        </div>

                        <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Guru: {doc.metadata.guruNama || "Belum diisi"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            <span>Beban: {doc.tps.length} TP ({doc.tps.reduce((a,c)=>a+(c.indikatorList || []).reduce((sum, ind)=>sum+ind.jp,0), 0)} JP)</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectHistory(doc);
                          }}
                          className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit / Tinjau
                        </button>

                        <button 
                          onClick={(e) => handleDeletePromes(doc.id, e)}
                          className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus Dokumen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "preview" && activePromes && (
            <motion.div
              key="preview_tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Toolbar */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/15 rounded-xl border border-sky-400/30 text-sky-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-sky-400 leading-none">PROMES BERHASIL DISUSUN</h3>
                    <span className="text-[10px] text-slate-300 font-medium">Beban total {activePromes.tps.reduce((a,c)=>a+(c.indikatorList || []).reduce((sum, ind)=>sum+ind.jp,0), 0)} JP terbagi rata dalam {activePromes.weeks.filter(w=>w.isEffective).length} Minggu efektif.</span>
                  </div>
                </div>

                {/* Instant Downloads */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleExportDocx}
                    className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh Word (.docx)
                  </button>
                  <button 
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Unduh PDF
                  </button>
                  <button 
                    onClick={() => setActiveTab("buat")}
                    className="flex items-center gap-1 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 font-semibold text-xs px-3 py-2 rounded-xl transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Baru
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Left Side: Editing Panel */}
                <div className="lg:col-span-1 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">Identitas Rapor & Dokumen</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">Tahun Pelajaran</label>
                      <input 
                        type="text"
                        value={activePromes.metadata.tahunPelajaran}
                        onChange={async (e) => {
                          const updated = {
                            ...activePromes,
                            metadata: { ...activePromes.metadata, tahunPelajaran: e.target.value }
                          };
                          setActivePromes(updated);
                          await fetch("/api/promes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(updated)
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">Nama Guru Pengampu</label>
                      <input 
                        type="text"
                        value={activePromes.metadata.guruNama}
                        onChange={async (e) => {
                          const updated = {
                            ...activePromes,
                            metadata: { ...activePromes.metadata, guruNama: e.target.value }
                          };
                          setActivePromes(updated);
                          await fetch("/api/promes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(updated)
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">NIP Guru</label>
                      <input 
                        type="text"
                        value={activePromes.metadata.nip}
                        onChange={async (e) => {
                          const updated = {
                            ...activePromes,
                            metadata: { ...activePromes.metadata, nip: e.target.value }
                          };
                          setActivePromes(updated);
                          await fetch("/api/promes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(updated)
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">Kepala Sekolah</label>
                      <input 
                        type="text"
                        value={activePromes.metadata.kepalaSekolah}
                        onChange={async (e) => {
                          const updated = {
                            ...activePromes,
                            metadata: { ...activePromes.metadata, kepalaSekolah: e.target.value }
                          };
                          setActivePromes(updated);
                          await fetch("/api/promes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(updated)
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">NIP Kepala Sekolah</label>
                      <input 
                        type="text"
                        value={activePromes.metadata.kepalaNip}
                        onChange={async (e) => {
                          const updated = {
                            ...activePromes,
                            metadata: { ...activePromes.metadata, kepalaNip: e.target.value }
                          };
                          setActivePromes(updated);
                          await fetch("/api/promes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(updated)
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                    <span className="font-bold text-slate-700 block mb-1">💡 Tips Edit Data</span>
                    Klik tombol <Edit3 className="w-3 h-3 text-sky-500 inline mx-0.5" /> di samping baris tabel untuk mengubah teks Tujuan Pembelajaran, Indikator, atau jumlah JP. Perubahan akan menghitung ulang jadwal otomatis!
                  </div>
                </div>

                {/* Right Side: Document Preview Canvas Mockup */}
                <div className="lg:col-span-3 space-y-4">
                  
                   {editingIndikatorId && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
                      <span className="text-xs font-bold text-amber-800 uppercase block tracking-wider">Sedang Mengedit Tujuan Pembelajaran & Indikator</span>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-6">
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Tujuan Pembelajaran (TP)</label>
                          <textarea 
                            value={editFields.tp}
                            onChange={(e) => setEditFields(prev => ({ ...prev, tp: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs h-16 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Indikator Pembelajaran (IKTP)</label>
                          <textarea 
                            value={editFields.indikator}
                            onChange={(e) => setEditFields(prev => ({ ...prev, indikator: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs h-16 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">Alokasi JP</label>
                          <input 
                            type="number"
                            value={editFields.jp}
                            onChange={(e) => setEditFields(prev => ({ ...prev, jp: Number(e.target.value) || 0 }))}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 text-center"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => {
                            setEditingParentTpId(null);
                            setEditingIndikatorId(null);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 transition"
                        >
                          Batal
                        </button>
                        <button 
                          onClick={handleSaveCellEdit}
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-extrabold transition"
                        >
                          Simpan Perubahan
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm overflow-x-auto">
                    
                    {/* A4 Paper mockup layout */}
                    <div className="min-w-[700px] font-serif p-4 border border-slate-200/60 shadow-inner">
                      
                      {/* Paper Document Header */}
                      <div className="text-center space-y-1 mb-8">
                        <span className="text-base font-extrabold tracking-wide uppercase block">
                          PROGRAM SEMESTER (PROMES)
                        </span>
                        <span className="text-sm font-bold tracking-wide uppercase block border-b-2 border-slate-900 pb-3 max-w-sm mx-auto">
                          TAHUN PELAJARAN: {activePromes.metadata.tahunPelajaran}
                        </span>
                      </div>

                      {/* Paper Document Metadata Info */}
                      <div className="grid grid-cols-2 gap-4 text-xs font-bold mb-6">
                        <div className="space-y-1">
                          {activePromes.metadata.namaSekolah && (
                            <div className="flex gap-2">
                              <span className="w-28 text-slate-500">Sekolah</span>
                              <span>: {activePromes.metadata.namaSekolah}</span>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <span className="w-28 text-slate-500">Mata Pelajaran</span>
                            <span>: {activePromes.metadata.mapel}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="w-28 text-slate-500">Fase / Kelas</span>
                            <span>: {activePromes.metadata.fase} / {activePromes.metadata.kelas}</span>
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <div className="inline-flex gap-2">
                            <span className="w-28 text-slate-500 text-left">Satuan Jenjang</span>
                            <span className="text-left">: {activePromes.metadata.jenjang}</span>
                          </div>
                          <br />
                          <div className="inline-flex gap-2">
                            <span className="w-28 text-slate-500 text-left">Semester</span>
                            <span className="text-left">: {activePromes.metadata.semester}</span>
                          </div>
                        </div>
                      </div>

                      {/* Real Paper Table Output */}
                      <table className="w-full border-collapse border border-slate-800 text-xs text-left">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-800 p-2 text-center w-8">No</th>
                            <th className="border border-slate-800 p-2 w-80">Tujuan Pembelajaran (TP)</th>
                            <th className="border border-slate-800 p-2 w-64">Indikator Ketercapaian (IKTP)</th>
                            <th className="border border-slate-800 p-2 text-center w-16">JP</th>
                            <th className="border border-slate-800 p-2 w-48">Waktu Pelaksanaan</th>
                            <th className="border border-slate-800 p-2 text-center w-12 font-sans text-[10px] text-slate-400">Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePromes.tps.flatMap((tp, idx) => {
                            const list = tp.indikatorList || [];
                            if (list.length === 0) {
                              return [
                                <tr key={tp.id} className="hover:bg-slate-50/40">
                                  <td className="border border-slate-800 p-2 text-center">1</td>
                                  <td className="border border-slate-800 p-2 leading-relaxed">{tp.tp}</td>
                                  <td className="border border-slate-800 p-2 leading-relaxed">-</td>
                                  <td className="border border-slate-800 p-2 text-center font-bold">0 JP</td>
                                  <td className="border border-slate-800 p-2">Belum Dijadwalkan</td>
                                  <td className="border border-slate-800 p-2 text-center"></td>
                                </tr>
                              ];
                            }

                            return list.map((ind, indIdx) => {
                              const scheduledWeeks: string[] = [];
                              activePromes.weeks.forEach(w => {
                                const allocated = activePromes.grid[ind.id]?.[w.id];
                                if (allocated && allocated > 0) {
                                  scheduledWeeks.push(`${w.month} M${w.weekNum} (${allocated} JP)`);
                                }
                              });
                              const pelaksanaan = scheduledWeeks.length > 0 ? scheduledWeeks.join(", ") : "Belum Dijadwalkan";

                              return (
                                <tr key={ind.id} className="hover:bg-slate-50/40">
                                  {indIdx === 0 && (
                                    <>
                                      <td className="border border-slate-800 p-2 text-center font-serif" rowSpan={list.length}>
                                        {idx + 1}
                                      </td>
                                      <td className="border border-slate-800 p-2 leading-relaxed font-serif" rowSpan={list.length}>
                                        {tp.tp}
                                      </td>
                                    </>
                                  )}
                                  <td className="border border-slate-800 p-2 leading-relaxed">{ind.indikator || "-"}</td>
                                  <td className="border border-slate-800 p-2 text-center font-bold">{ind.jp} JP</td>
                                  <td className="border border-slate-800 p-2">{pelaksanaan}</td>
                                  <td className="border border-slate-800 p-2 text-center">
                                    <button 
                                      onClick={() => handleStartCellEdit(tp, ind)}
                                      className="p-1 hover:bg-slate-100 rounded text-sky-500 hover:text-sky-600 font-sans"
                                      title="Edit Indicator Row"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            });
                          })}
                        </tbody>
                      </table>

                      {/* Paper Signatures */}
                      <div className="grid grid-cols-2 gap-8 text-xs mt-12 pt-6">
                        <div className="space-y-16">
                          <div>
                            <span className="block">Mengetahui,</span>
                            <span className="block font-bold">Kepala Sekolah</span>
                          </div>
                          <div>
                            <span className="block font-extrabold underline">{activePromes.metadata.kepalaSekolah || "_________________________"}</span>
                            <span className="block text-slate-500">NIP. {activePromes.metadata.kepalaNip || "_________________________"}</span>
                          </div>
                        </div>

                        <div className="space-y-16 text-right">
                          <div>
                            <span className="block">{activePromes.metadata.datumTanggal || "Pohuwato, ________________ 2026"}</span>
                            <span className="block font-bold">Guru Mata Pelajaran</span>
                          </div>
                          <div>
                            <span className="block font-extrabold underline">{activePromes.metadata.guruNama || "_________________________"}</span>
                            <span className="block text-slate-500 text-right">NIP. {activePromes.metadata.nip || "_________________________"}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

    </div>
  );
}
