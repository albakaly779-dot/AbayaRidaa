export const APP_CONFIG = {
  name: "رداء",
  subtitle: "نظام إدارة المبيعات",
  currency: "ر.ي",
  currencyCode: "YER",
  locale: "ar-YE",
  version: "3.0.0",
  countryCode: "+967",
  fabricPricePerMeter: 1000,
  fabricMetersPerAbaya: 2.25,
  tarhaCost: 300,
  defaultExtrasCost: 200,
  // SAR exchange rate (1 SAR ≈ how many YER) — default, overridden by settings
  sarToYer: 140,
  ownerPhone: "+967779673273",
};

export const FABRIC_UNITS = [
  { value: "متر", label: "متر" },
  { value: "وار", label: "وار" },
  { value: "طاقة", label: "طاقة" },
];

export const GOVERNORATES = [
  "صنعاء", "عدن", "تعز", "إب", "الحديدة", "حضرموت", "ذمار", "المكلا",
  "عمران", "صعدة", "البيضاء", "لحج", "أبين", "المحويت", "حجة", "شبوة",
  "مأرب", "الضالع", "ريمة", "الجوف", "المهرة", "سقطرى",
];

export const CITIES = GOVERNORATES;

export const WHATSAPP_TEMPLATES = {
  paymentReminder: (name: string, amount: number) =>
    `السلام عليكم ${name}،\n\nنود تذكيركم بالمبلغ المستحق وقدره ${amount.toLocaleString("ar-YE")} ر.ي.\n\nنرجو التكرم بالسداد في أقرب وقت.\n\nشكراً لكم 🌸\nرداء`,
  orderReady: (name: string, orderNum: string) =>
    `السلام عليكم ${name}،\n\nيسعدنا إبلاغكم أن طلبكم رقم ${orderNum} أصبح جاهزاً للتسليم.\n\nنتطلع لخدمتكم 🌸\nرداء`,
  orderConfirmation: (name: string, orderNum: string, total: number) =>
    `السلام عليكم ${name}،\n\nتم تأكيد طلبكم رقم ${orderNum} بمبلغ ${total.toLocaleString("ar-YE")} ر.ي.\n\nسيتم إعلامكم عند جاهزية الطلب.\n\nشكراً لثقتكم 🌸\nرداء`,
  thankYou: (name: string) =>
    `السلام عليكم ${name}،\n\nشكراً لتعاملكم معنا في رداء.\n\nنتمنى أن تنال العباية إعجابكم.\n\nدائماً في خدمتكم 🌸`,
};

export const SMS_TEMPLATES = {
  statusChange: (name: string, orderNum: string, status: string) =>
    `${name}: طلبكم ${orderNum} تم تحديثه إلى "${status}". رداء`,
  paymentReceived: (name: string, amount: number, remaining: number) =>
    `${name}: تم استلام دفعة ${amount.toLocaleString("ar-YE")} ر.ي. المتبقي: ${remaining.toLocaleString("ar-YE")} ر.ي. رداء`,
  dueReminder: (name: string, orderNum: string, dueDate: string) =>
    `${name}: تذكير — طلبكم ${orderNum} موعد تسليمه ${dueDate}. رداء`,
};

export const FIXED_EXPENSES = {
  salaries: { label: "رواتب الموظفين", amount: 250000 },
  rent: { label: "إيجار المحل", amount: 20000 },
  electricity: { label: "الكهرباء", amount: 10000 },
  advertising: { label: "ميزانية الإعلانات", amount: 40000 },
};

export const PRODUCTS = [
  { name: "عباية كلاسيكية سوداء", price: 5000 },
  { name: "عباية مطرزة فاخرة", price: 9000 },
  { name: "عباية كريب إيطالي", price: 7600 },
  { name: "عباية شيفون مزينة", price: 6400 },
  { name: "عباية قطن يومية", price: 3600 },
  { name: "عباية سهرة مميزة", price: 13000 },
  { name: "عباية كاجوال عصرية", price: 4400 },
  { name: "شيلة حرير", price: 2400 },
  { name: "طرحة مطرزة", price: 1900 },
  { name: "عباية ملونة حديثة", price: 5600 },
  { name: "عباية مخملية", price: 10400 },
  { name: "عباية لينن صيفية", price: 4000 },
];
