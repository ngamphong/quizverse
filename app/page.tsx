import Link from "next/link";
import FeaturedQuizzes from "@/components/home/Featured";
import JoinBox from "@/components/home/JoinBox";

const I = {
  ai: <path d="M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0" />,
  level: <path d="M5 20V13M12 20V8M19 20V4" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  dna: <path d="M7 3c0 6 10 6 10 12M17 3c0 6-10 6-10 12M7 21c0-2 1-3 2-4M17 21c0-2-1-3-2-4M8 7h8M8 17h8" />,
  quest: <path d="M4 20 10 8l4 6 2-3 4 9zM14 4h4v4" />,
  team: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 1 0 0-5M18 14c2 .6 3 2.8 3 6" />,
  calendar: <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14l2 2 4-4" />,
  alert: <path d="M12 4 2 20h20zM12 10v4M12 17h.01" />,
};
const Icon = ({ d }: { d: React.ReactNode }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const FEATURES = [
  { icon: I.ai, name: "AI Quiz Generator", desc: "ร่างข้อสอบจากหัวข้อ ข้อความ หรือไฟล์ PDF/DOCX ครูตรวจและอนุมัติก่อนใช้" },
  { icon: I.level, name: "Adaptive Quiz", desc: "ตอบถูกติดกันระดับขึ้น ตอบผิดระดับลง ได้โจทย์ที่พอดีกับตัวเอง" },
  { icon: I.bulb, name: "AI Mistake Explainer", desc: "อธิบายว่าทำไมผิด พร้อมโจทย์ใหม่ให้ฝึกแก้จุดอ่อนทันที" },
  { icon: I.dna, name: "Learning DNA", desc: "เห็นจุดแข็ง จุดอ่อน และพัฒนาการรายวิชาของตัวเอง" },
  { icon: I.quest, name: "Learning Quest", desc: "วิชาละ 5 ด่าน ปลดล็อก สะสมดาว ภารกิจแนะนำตามผลการเรียน" },
  { icon: I.team, name: "Collaborative Challenge", desc: "ห้องสดแบบทีม ตอบพร้อมเหตุผล และตัดสินใจร่วมกัน" },
  { icon: I.calendar, name: "Smart Revision", desc: "ข้อที่ผิดหรือเดาจะกลับมาให้ทบทวนตามช่วงเวลา" },
  { icon: I.alert, name: "Teacher Early Alert", desc: "บอกครูว่าหัวข้อไหนทั้งห้องยังไม่เข้าใจ ไม่ตัดสินจากคะแนนครั้งเดียว" },
];

const LOOP = ["ทำ Quiz", "วิเคราะห์ข้อผิดพลาด", "อธิบาย", "ปรับความยาก", "ฝึกซ้ำ", "วัดพัฒนาการ"];

export default function Home() {
  return (
    <section className="view home">
      {/* ── hero ── */}
      <div className="home-hero">
        <div className="home-hero-text">
          <span className="hero-eyebrow">เกมตอบคำถาม + AI เพื่อการเรียนรู้</span>
          <h1>QUIZVERSE</h1>
          <p className="lead">เล่นสนุกเหมือนเกม แต่จบเกมแล้ว<b> รู้ว่าตัวเองอ่อนเรื่องไหน </b>และควรฝึกอะไรต่อ</p>
          <JoinBox />
          <div className="hero-links">
            <Link href="/studio">สร้างข้อสอบด้วย AI</Link>
            <span aria-hidden="true">·</span>
            <Link href="/quest">เล่น Learning Quest</Link>
            <span aria-hidden="true">·</span>
            <Link href="#featured">ข้อสอบแนะนำ</Link>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-demo">
            <div className="meta"><span>ห้อง 587421 · วิทยาศาสตร์</span><span className="num">ข้อ 3/8</span></div>
            <div className="q">ข้อใดเป็นสาเหตุหลักที่ทำให้เกิดฤดูกาลบนโลก?</div>
            <div className="opts">
              <span className="ch0">A · ระยะห่างจากดวงอาทิตย์</span>
              <span className="ch1 picked">B · แกนโลกเอียง 23.5°</span>
              <span className="ch2">C · ดวงจันทร์บังแสง</span>
              <span className="ch3">D · โลกหมุนเร็วขึ้น</span>
            </div>
          </div>
          <span className="float-badge b1">ถูกต้อง! +870</span>
          <span className="float-badge b2">ข้อถัดไป: ระดับยาก ↑</span>
          <span className="float-badge b3">AI อธิบายข้อผิด</span>
        </div>
      </div>

      {/* ── who is it for ── */}
      <div className="who-grid">
        <div className="who-card">
          <span className="eyebrow">สำหรับนักเรียน</span>
          <h2>เล่น ฝึก และเห็นพัฒนาการ</h2>
          <ul>
            <li>เข้าเกมด้วย PIN ไม่ต้องสมัคร</li>
            <li>ผิดแล้วมี AI อธิบาย + โจทย์ให้ฝึกซ้ำ</li>
            <li>Learning DNA และ Quest วิชาละ 5 ด่าน</li>
          </ul>
          <div className="row"><Link className="btn btn-primary" href="/join">เข้าร่วมเกม</Link><Link className="btn btn-ghost" href="/dna">Learning DNA</Link></div>
        </div>
        <div className="who-card teacher">
          <span className="eyebrow">สำหรับครู</span>
          <h2>สร้างข้อสอบไว และรู้ว่าต้องสอนซ้ำตรงไหน</h2>
          <ul>
            <li>AI ร่างข้อสอบจากหัวข้อหรือไฟล์ ครูอนุมัติก่อนใช้</li>
            <li>ห้องสดหลายเครื่อง และโหมดทีม</li>
            <li>รายงานรายข้อ + Teacher Early Alert</li>
          </ul>
          <div className="row"><Link className="btn btn-primary" href="/studio">สร้างข้อสอบ</Link><Link className="btn btn-ghost" href="/teacher">แดชบอร์ดครู</Link></div>
        </div>
      </div>

      {/* ── featured quizzes ── */}
      <div id="featured" className="home-section">
        <div className="section-head">
          <div>
            <h2>ข้อสอบแนะนำ</h2>
            <p className="muted small">ชุดตัวอย่าง และผลงานที่ครูยินยอมแบ่งปัน เรียงตามจำนวนครั้งที่เล่น · เล่นเดี่ยวได้ทันที</p>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/join">ดูทั้งหมด / กรอก PIN</Link>
        </div>
        <FeaturedQuizzes />
      </div>

      {/* ── features ── */}
      <div className="home-section">
        <div className="section-head"><div><h2>ทำไม QUIZVERSE ต่างจากเกมตอบคำถามทั่วไป</h2><p className="muted small">ไม่ได้จบแค่การประกาศคะแนน แต่ช่วยให้ทุกคนพัฒนาต่อ</p></div></div>
        <div className="feat-grid">
          {FEATURES.map((f) => (
            <div key={f.name} className="feat-card">
              <span className="feat-ico"><Icon d={f.icon} /></span>
              <h3>{f.name}</h3>
              <p className="small muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── learning loop (a real sequence, so numbered) ── */}
      <div className="home-section">
        <div className="section-head"><div><h2>วงจรการเรียนรู้</h2><p className="muted small">ทุกเกมจะพาไปสู่การฝึกที่ตรงจุด</p></div></div>
        <ol className="loop-steps">
          {LOOP.map((s, i) => <li key={s}><span className="num">{i + 1}</span>{s}</li>)}
        </ol>
      </div>

      {/* ── teacher CTA ── */}
      <div className="cta-band">
        <div>
          <h2>พร้อมเปิดห้องเรียนแรกแล้วหรือยัง?</h2>
          <p>ให้ AI ร่างข้อสอบ ตรวจ อนุมัติ แล้วเปิดห้องสดให้ทั้งห้องเล่นพร้อมกันได้ในไม่กี่นาที</p>
        </div>
        <div className="row">
          <Link className="btn btn-white" href="/studio">เริ่มสร้างข้อสอบ</Link>
          <Link className="btn btn-outline" href="/login">สมัครบัญชีครู</Link>
        </div>
      </div>
    </section>
  );
}
