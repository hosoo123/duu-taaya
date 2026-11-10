import type { Metadata } from "next";
import Link from "next/link";

// Холбоо барих имэйлээ энд бич (хоосон бол хэсэг нь харагдахгүй)
const CONTACT_EMAIL = "";
const UPDATED = "2026-11-10";

export const metadata: Metadata = {
  title: "Нууцлалын бодлого",
  description: "Дуугаа Таа тоглоом ямар мэдээлэл цуглуулж, хэрхэн ашигладаг тухай.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <Link href="/" className="legal-back">
          ← Дуугаа Таа
        </Link>
        <h1>Нууцлалын бодлого</h1>
        <p className="legal-meta">Сүүлд шинэчилсэн: {UPDATED}</p>

        <p>
          Дуугаа Таа (duutaay.xyz) нь дууны хэсэг сонсоод нэрийг нь таах үнэгүй
          тоглоом. Энэ хуудсанд бид ямар мэдээлэл цуглуулж, хэрхэн ашигладгийг
          тайлбарлав.
        </p>

        <h2>Цуглуулдаг мэдээлэл</h2>
        <ul>
          <li>
            <strong>Google-ээр нэвтрэх үед:</strong> нэр, имэйл хаяг, профайл
            зураг. Нэвтрэлтийг Clerk үйлчилгээ хариуцдаг.
          </li>
          <li>
            <strong>Тоглоомын өгөгдөл:</strong> таны оруулсан тоглогчийн нэр,
            оноо, challenge болон party өрөөний үр дүн, бичсэн сэтгэгдэл.
          </li>
          <li>
            <strong>Хэрэглээний статистик:</strong> Vercel Analytics-аар
            хуудас үзэлтийн нэргүй (хувь хүнийг тодорхойлохгүй) тоо баримт.
          </li>
          <li>
            <strong>Таны төхөөрөмж дээр:</strong> тоглоомын тохиргоог
            хөтчийн localStorage-д хадгалж болно.
          </li>
        </ul>

        <h2>Хэрхэн ашигладаг вэ</h2>
        <ul>
          <li>Нэвтрэх, party mode болон leaderboard-ыг ажиллуулахад</li>
          <li>Оноо, сэтгэгдлийг бусад тоглогчдод харуулахад</li>
          <li>Сайтыг сайжруулахад</li>
        </ul>
        <p>
          Бид таны мэдээллийг зарахгүй, сурталчилгааны зорилгоор бусдад
          дамжуулахгүй.
        </p>

        <h2>Гуравдагч талын үйлчилгээ</h2>
        <ul>
          <li>Clerk — нэвтрэлт</li>
          <li>Google — OAuth нэвтрэлт</li>
          <li>Vercel — hosting, analytics</li>
          <li>Neon / PostgreSQL — оноо, сэтгэгдэл хадгалах</li>
          <li>Spotify, YouTube — дууны холбоос (тэдний сайт руу шилжихэд тэдний бодлого үйлчилнэ)</li>
        </ul>

        <h2>Таны эрх</h2>
        <p>
          Та өөрийн бүртгэл, оноо, сэтгэгдлээ устгуулах хүсэлт гаргаж болно.
          Google бүртгэлийнхээ хандалтыг myaccount.google.com → Security
          хэсгээс хүссэн үедээ цуцалж болно.
        </p>

        {CONTACT_EMAIL && (
          <>
            <h2>Холбоо барих</h2>
            <p>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </>
        )}
      </article>
    </main>
  );
}
