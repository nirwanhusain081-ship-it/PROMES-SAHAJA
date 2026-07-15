// TypeScript types and Indonesian curriculum definitions for PROMES SAHAJA

export type Jenjang = "PAUD" | "SD" | "SMP";

export interface CurriculumOption {
  fase: string[];
  kelas: string[];
  mapel: string[];
}

export const CURRICULUM_DATA: Record<Jenjang, CurriculumOption> = {
  PAUD: {
    fase: ["Fondasi"],
    kelas: ["Kelompok Bermain", "TK A", "TK B"],
    mapel: [
      "Nilai Agama dan Budi Pekerti",
      "Jati Diri",
      "Literasi dan STEAM"
    ]
  },
  SD: {
    fase: ["Fase A", "Fase B", "Fase C"],
    kelas: ["Kelas I", "Kelas II", "Kelas III", "Kelas IV", "Kelas V", "Kelas VI"],
    mapel: [
      "Pendidikan Agama",
      "Pendidikan Pancasila",
      "Bahasa Indonesia",
      "Matematika",
      "IPAS",
      "Seni Musik",
      "Seni Rupa",
      "Seni Tari",
      "Seni Teater",
      "Pendidikan Jasmani, Olahraga, dan Kesehatan",
      "Bahasa Inggris",
      "Muatan Lokal (opsional)"
    ]
  },
  SMP: {
    fase: ["Fase D"],
    kelas: ["Kelas VII", "Kelas VIII", "Kelas IX"],
    mapel: [
      "Pendidikan Agama",
      "Pendidikan Pancasila",
      "Bahasa Indonesia",
      "Matematika",
      "IPA",
      "IPS",
      "Bahasa Inggris",
      "Informatika",
      "PJOK",
      "Seni Musik",
      "Seni Rupa",
      "Seni Tari",
      "Seni Teater",
      "Prakarya",
      "Muatan Lokal (opsional)"
    ]
  }
};

export interface IndikatorPembelajaran {
  id: string;
  indikator: string;
  jp: number;
  materi: string;
}

export interface TujuanPembelajaran {
  id: string;
  tp: string;
  indikatorList: IndikatorPembelajaran[];
  semester: number;
}

export interface Week {
  id: string;
  month: string;
  weekNum: number;
  isEffective: boolean;
  activity: string; // e.g. "KBM", "MPLS", "ASTS", "ASAS", "Libur", "P5"
  notes?: string;
}

export interface Schedule {
  Senin: number;
  Selasa: number;
  Rabu: number;
  Kamis: number;
  Jumat: number;
  Sabtu: number;
}

export interface PromesMetadata {
  id?: string;
  jenjang: Jenjang;
  fase: string;
  kelas: string;
  mapel: string;
  semester: number;
  tahunPelajaran: string;
  guruNama: string;
  nip: string;
  kepalaSekolah: string;
  kepalaNip: string;
  namaSekolah?: string;
  datumTanggal?: string;
}

export interface PromesDocument {
  id: string;
  metadata: PromesMetadata;
  tps: TujuanPembelajaran[];
  weeks: Week[];
  grid: Record<string, Record<string, number>>; // indikatorId -> weekId -> jp
  createdAt: string;
  updatedAt: string;
}

// Default standard Indonesian school calendar (Semester 1: Juli - Desember, Semester 2: Januari - Juni)
export function getDefaultWeeks(semester: number): Week[] {
  const weeks: Week[] = [];
  
  if (semester === 1) {
    const months = [
      { name: "Juli", weeksCount: 4 },
      { name: "Agustus", weeksCount: 4 },
      { name: "September", weeksCount: 5 },
      { name: "Oktober", weeksCount: 4 },
      { name: "November", weeksCount: 4 },
      { name: "Desember", weeksCount: 4 }
    ];

    months.forEach((m) => {
      for (let w = 1; w <= m.weeksCount; w++) {
        const id = `${m.name.toLowerCase()}_w${w}`;
        let isEffective = true;
        let activity = "KBM (Kegiatan Belajar Mengajar)";
        let notes = "";

        // Customize defaults based on real Indonesian Education Calendar
        if (m.name === "Juli") {
          if (w === 1 || w === 2) {
            isEffective = false;
            activity = "Libur Akhir Tahun Pelajaran";
          } else if (w === 3) {
            isEffective = true;
            activity = "MPLS (Masa Pengenalan Lingkungan Sekolah)";
          }
        } else if (m.name === "September" && w === 4) {
          isEffective = false;
          activity = "Asesmen Sumatif Tengah Semester (ASTS)";
        } else if (m.name === "Desember") {
          if (w === 1) {
            isEffective = false;
            activity = "Asesmen Sumatif Akhir Semester (ASAS)";
          } else if (w === 2) {
            isEffective = false;
            activity = "Class Meeting & Pengolahan Rapor";
          } else if (w === 3 || w === 4) {
            isEffective = false;
            activity = "Libur Semester Ganjil";
          }
        }

        weeks.push({ id, month: m.name, weekNum: w, isEffective, activity, notes });
      }
    });
  } else {
    const months = [
      { name: "Januari", weeksCount: 4 },
      { name: "Februari", weeksCount: 4 },
      { name: "Maret", weeksCount: 4 },
      { name: "April", weeksCount: 5 },
      { name: "Mei", weeksCount: 4 },
      { name: "Juni", weeksCount: 4 }
    ];

    months.forEach((m) => {
      for (let w = 1; w <= m.weeksCount; w++) {
        const id = `${m.name.toLowerCase()}_w${w}`;
        let isEffective = true;
        let activity = "KBM (Kegiatan Belajar Mengajar)";
        let notes = "";

        // Semester 2 defaults
        if (m.name === "Maret" && w === 2) {
          isEffective = false;
          activity = "Asesmen Sumatif Tengah Semester (ASTS)";
        } else if (m.name === "April" && (w === 2 || w === 3)) {
          isEffective = false;
          activity = "Perkiraan Libur Hari Raya Idul Fitri";
        } else if (m.name === "Juni") {
          if (w === 1) {
            isEffective = false;
            activity = "Asesmen Sumatif Akhir Semester (ASAS)";
          } else if (w === 2) {
            isEffective = false;
            activity = "Class Meeting & Pengolahan Rapor";
          } else if (w === 3 || w === 4) {
            isEffective = false;
            activity = "Libur Akhir Tahun Pelajaran";
          }
        }

        weeks.push({ id, month: m.name, weekNum: w, isEffective, activity, notes });
      }
    });
  }

  return weeks;
}
