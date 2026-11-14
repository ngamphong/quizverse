# QUIZVERSE

**Learn • Play • Challenge • Grow** — เว็บแอปเกมตอบคำถามส่งเสริมการเรียนรู้ด้วย AI

ต่อยอดแนวคิดจาก Kahoot! แต่เน้นให้ผู้เรียนรู้ว่าตัวเองอ่อนเรื่องใด และควรฝึกอะไรต่อ ผ่านวงจร
ทำ Quiz → วิเคราะห์ข้อผิดพลาด → อธิบาย → ปรับความยาก → ฝึกซ้ำ → วัดพัฒนาการ

## หน้าจอ

| เส้นทาง | หน้าจอ |
|---|---|
| `/` | หน้าแรก |
| `/studio` | AI Quiz Studio (สร้างเอง / ให้ AI ร่าง → ครูอนุมัติ → เผยแพร่พร้อม PIN) |
| `/join` | เข้าร่วมเกมด้วย PIN 6 หลัก (ห้องตัวอย่าง PIN `587421`) |
| `/play/[pin]` | Quiz Arena (Adaptive + Confidence) และผลการเล่น/อันดับ |
| `/play/practice` | โหมดฝึกทบทวน (Smart Revision) |
| `/dna` | Learning DNA: จุดแข็ง จุดอ่อน แผนทบทวน รางวัลจากพัฒนาการ |

## โครงสร้างโค้ด

```
app/          หน้าจอ (Next.js App Router)
components/   Topbar, Toast, RadarChart
lib/
  grading.ts    คิดคะแนน (ระยะ 3 ย้ายไปฝั่งเซิร์ฟเวอร์)
  adaptive.ts   ปรับระดับความยาก + เลือกข้อถัดไป
  profile.ts    Learning DNA + Smart Revision
  storage.ts    ที่เก็บข้อมูล (ตอนนี้ localStorage → ระยะ 3 เปลี่ยนเป็น Supabase)
  ai.ts         ทุกฟีเจอร์ AI ผ่านไฟล์นี้ (ระยะ 2 ต่อ Gemini)
```

## รันบนเครื่อง

```bash
npm install
npm run dev
```

แล้วเปิด http://localhost:3000

## ขึ้นออนไลน์ (GitHub → Vercel)

1. สร้าง repository ใหม่บน GitHub (ไม่ต้องติ๊กสร้าง README) แล้ว push:
   ```bash
   git remote add origin https://github.com/<ชื่อบัญชี>/quizverse.git
   git push -u origin main
   ```
2. เข้า [vercel.com](https://vercel.com) → ล็อกอินด้วย GitHub → **Add New → Project** → เลือก `quizverse` → **Deploy**
3. ทุกครั้งที่ push เข้า `main` เว็บจะอัปเดตเอง ส่วน Pull Request จะได้ลิงก์ Preview แยก

ห้าม commit ไฟล์ `.env*` หรือ API key (ถูกกันไว้ใน `.gitignore` แล้ว) ให้ใส่ key ใน Vercel → Settings → Environment Variables

## แผนพัฒนา

- [x] **ระยะ 1** Next.js + Vercel (ข้อมูลเก็บในเบราว์เซอร์, เพื่อนร่วมห้องเป็นผู้เล่นจำลอง)
- [ ] **ระยะ 2** AI ผ่าน Gemini API (`GEMINI_API_KEY`), อ่านไฟล์ PDF/DOCX, Mistake Explainer สร้างโจทย์ฝึก
- [ ] **ระยะ 3** Supabase: ล็อกอินครู/นักเรียน, ฐานข้อมูล, ตรวจคะแนนฝั่งเซิร์ฟเวอร์
- [ ] **ระยะ 4** Live Quiz หลายเครื่องพร้อมกัน (Supabase Realtime)
- [ ] **ระยะ 5** เครื่องมือครู: คลังข้อสอบ, รายงานผล, Teacher Early Alert, รูปประกอบคำถาม
