import { MessageCircle } from "lucide-react";

interface Props {
  phone: string;
  message: string;
  size?: "sm" | "md";
}

export default function WhatsAppButton({ phone, message, size = "sm" }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, "");
    // Ensure Yemen country code
    const fullPhone = cleanPhone.startsWith("967") ? cleanPhone : `967${cleanPhone}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${fullPhone}?text=${encoded}`, "_blank");
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-lg bg-emerald-500 text-white transition-all hover:bg-emerald-600 hover:scale-105 active:scale-95 ${
        size === "sm" ? "size-8" : "size-10"
      }`}
      aria-label="إرسال واتساب"
      title="فتح واتساب"
    >
      <MessageCircle className={size === "sm" ? "size-3.5" : "size-4.5"} />
    </button>
  );
}
