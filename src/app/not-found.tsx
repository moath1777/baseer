import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <h1>الصفحة غير موجودة</h1>
      <p>تحقق من الرابط أو عد إلى مساحة العمل.</p>
      <Link href="/overview">العودة إلى الرئيسية</Link>
    </main>
  );
}
