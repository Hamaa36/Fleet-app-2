// Language support: English (default) and Kurdish Central / Sorani (کوردی), right-to-left.
// The app is written in English; when Kurdish is selected every rendered text, placeholder,
// label, toast, alert and confirm is translated through the dictionary below.
// To fix or add a translation, edit KU (exact text) or PATTERNS (text with names, numbers or dates).

const KEY = "hrid_lang";
export const LANG = (() => { try { return localStorage.getItem(KEY) === "ku" ? "ku" : "en"; } catch { return "en"; } })();
export const IS_KU = LANG === "ku";

const KU = {
  // ---- app / navigation ----
  "HRID FleetFlow": "HRID FleetFlow",
  "Driver Trip & Vehicle Management": "بەڕێوەبردنی گەشت و ئۆتۆمبێلی کۆمپانیا",
  "Hiwa Rauf for Investment & Development": "هیوا ڕەئوف بۆ وەبەرهێنان و گەشەپێدان",
  "Dashboard": "سەرەکی",
  "Admin dashboard": "داشبۆردی بەڕێوەبەر",
  "Requests": "داواکارییەکان",
  "Request": "داواکاری",
  "My requests": "داواکارییەکانم",
  "Trips": "گەشتەکان",
  "My trips": "گەشتەکانم",
  "All trips": "هەموو گەشتەکان",
  "New trip": "گەشتی نوێ",
  "Checklist": "پشکنین",
  "Checklists": "پشکنینەکان",
  "Users": "بەکارهێنەران",
  "Profile": "پرۆفایل",
  "Administrator": "بەڕێوەبەری سیستەم",
  "Driver": "شۆفێر",
  "Employee": "کارمەند",
  "Guest": "میوان",
  "HRID": "HRID",
  "← Back": "→ گەڕانەوە",
  "Back to sign in": "گەڕانەوە بۆ چوونەژوورەوە",
  "Reload": "دووبارە بارکردنەوە",
  "Something went wrong": "هەڵەیەک ڕوویدا",
  "You do not have access to that page": "دەسەڵاتی چوونە ئەو پەڕەیەت نییە",
  "Demo mode: data is saved only on this device. Connect Supabase in": "دۆخی تاقیکردنەوە: زانیارییەکان تەنها لەسەر ئەم ئامێرە پاشەکەوت دەکرێن. Supabase لە",
  "to share data between phones.": "ببەستەوە بۆ هاوبەشکردنی زانیاری لە نێوان مۆبایلەکاندا.",

  // ---- login / setup / password ----
  "First-time setup": "ڕێکخستنی یەکەمجار",
  "Import employees from CSV": "هێنانی کارمەندان لە فایلی CSV",
  "Use hrid-users-import.csv. Passwords are set to each person's date of birth (DDMMYYYY) and must be changed at first sign-in.": "فایلی hrid-users-import.csv بەکاربهێنە. وشەی نهێنی هەر کەسێک بەرواری لەدایکبوونیەتی (DDMMYYYY) و لە یەکەم چوونەژوورەوەدا دەبێت بیگۆڕێت.",
  "— or create one administrator manually —": "— یان بەڕێوەبەرێک بە دەست دروست بکە —",
  "Create administrator": "دروستکردنی بەڕێوەبەر",
  "Administrator created": "بەڕێوەبەر دروستکرا",
  "Employees imported – please sign in": "کارمەندان هێنران – تکایە بچۆ ژوورەوە",
  "Employee number or email": "ژمارەی کارمەند یان ئیمەیڵ",
  "Password": "وشەی نهێنی",
  "Confirm password": "دووپاتکردنەوەی وشەی نهێنی",
  "Sign in": "چوونەژوورەوە",
  "Sign out": "چوونەدەرەوە",
  "Incorrect employee number/email or password.": "ژمارەی کارمەند/ئیمەیڵ یان وشەی نهێنی هەڵەیە.",
  "First time? Your password is your date of birth as DDMMYYYY (for example 08/09/2003 → 08092003). You will be asked to change it.": "یەکەمجارە؟ وشەی نهێنییەکەت بەرواری لەدایکبوونتە بە شێوەی DDMMYYYY (بۆ نموونە 08/09/2003 ← 08092003). داوات لێدەکرێت بیگۆڕیت.",
  "Not an HRID employee? Request a trip as a guest": "کارمەندی HRID نیت؟ وەک میوان داوای گەشت بکە",
  "Please choose your own password to continue.": "تکایە وشەی نهێنی تایبەت بە خۆت هەڵبژێرە بۆ بەردەوامبوون.",
  "New password": "وشەی نهێنی نوێ",
  "Confirm new password": "دووپاتکردنەوەی وشەی نهێنی نوێ",
  "Current password": "وشەی نهێنی ئێستا",
  "Save password": "پاشەکەوتکردنی وشەی نهێنی",
  "Update password": "نوێکردنەوەی وشەی نهێنی",
  "Change password": "گۆڕینی وشەی نهێنی",
  "Password saved": "وشەی نهێنی پاشەکەوت کرا",
  "Password updated": "وشەی نهێنی نوێکرایەوە",
  "Passwords do not match": "وشە نهێنییەکان وەک یەک نین",
  "At least 8 characters": "لانیکەم 8 پیت",
  "At least 6 characters": "لانیکەم 6 پیت",
  "Use letters and numbers – not only digits (not your birthday)": "پیت و ژمارە بەکاربهێنە – نەک تەنها ژمارە (نەک بەرواری لەدایکبوونت)",
  "Current password is incorrect": "وشەی نهێنی ئێستا هەڵەیە",

  // ---- common form words ----
  "Select…": "هەڵبژێرە…",
  "This field is required": "ئەم خانەیە پێویستە",
  "Please fix the highlighted fields": "تکایە خانە دیاریکراوەکان ڕاست بکەرەوە",
  "Please confirm": "تکایە پشتڕاستی بکەرەوە",
  "Enter a valid email": "ئیمەیڵێکی دروست بنووسە",
  "Enter a valid phone number": "ژمارە مۆبایلێکی دروست بنووسە",
  "Save": "پاشەکەوت",
  "Cancel": "هەڵوەشاندنەوە",
  "Edit": "دەستکاری",
  "Clear": "سڕینەوە",
  "Done": "تەواو",
  "View": "بینین",
  "View all": "بینینی هەمووی",
  "Saving…": "پاشەکەوت دەکرێت…",
  "Full name": "ناوی تەواو",
  "Email": "ئیمەیڵ",
  "Phone": "مۆبایل",
  "Phone number": "ژمارەی مۆبایل",
  "Department": "بەش",
  "Your department": "بەشەکەت",
  "Employee number": "ژمارەی کارمەند",
  "Role": "ڕۆڵ",
  "Status": "دۆخ",
  "Name": "ناو",
  "No.": "ژ.",
  "Notes": "تێبینی",
  "Comment": "تێبینی",
  "Location": "شوێن",
  "Language": "زمان",
  "Main": "ڕێنیشاندەری سەرەکی",

  // ---- guest ----
  "Guest trip request": "داواکاری گەشتی میوان",
  "For visitors and partners of Hiwa Rauf for Investment & Development. Requests need approval from the HRID transport administrators.": "بۆ میوان و هاوبەشانی هیوا ڕەئوف بۆ وەبەرهێنان و گەشەپێدان. داواکارییەکان پێویستیان بە پەسەندکردنی بەڕێوەبەرانی گواستنەوەی HRID هەیە.",
  "Your details": "زانیارییەکانت",
  "Company / organisation": "کۆمپانیا / ڕێکخراو",
  "Email (to receive updates)": "ئیمەیڵ (بۆ وەرگرتنی ئاگادارییەکان)",
  "HRID contact person you are visiting": "ئەو کەسەی HRID کە سەردانی دەکەیت",
  "Purpose of visit / trip": "مەبەستی سەردان / گەشت",
  "I am a passenger on this trip": "من سەرنشینی ئەم گەشتەم",
  "Add anyone else travelling with you.": "هەر کەسێکی تر کە لەگەڵت دێت زیادی بکە.",
  "I confirm the information is correct and agree that HRID may contact me about this request.": "پشتڕاستی دەکەمەوە کە زانیارییەکان دروستن و ڕازیم HRID دەربارەی ئەم داواکارییە پەیوەندیم پێوە بکات.",
  "Request submitted": "داواکاری نێردرا",
  "Your reference number is": "ژمارەی ئاماژەکەت:",
  "Organisation": "ڕێکخراو",
  "HRID contact": "کەسی پەیوەندی لە HRID",

  // ---- request form ----
  "Request a trip": "داوای گەشت بکە",
  "Route": "ڕێگا",
  "Pick-up location": "شوێنی سوارکردن",
  "Pick-up": "سوارکردن",
  "Destinations": "شوێنەکانی مەبەست",
  "Destination": "شوێنی مەبەست",
  "Add another destination": "زیادکردنی شوێنێکی تر",
  "Enter at least one destination": "لانیکەم یەک شوێنی مەبەست بنووسە",
  "Date & time": "بەروار و کات",
  "Trip date": "بەرواری گەشت",
  "Departure time": "کاتی ڕۆیشتن",
  "Return time (if return trip)": "کاتی گەڕانەوە (ئەگەر گەڕانەوەی هەبێت)",
  "Return time": "کاتی گەڕانەوە",
  "Date cannot be in the past": "بەروار نابێت ڕابردوو بێت",
  "Must be after departure": "دەبێت دوای کاتی ڕۆیشتن بێت",
  "Passengers": "سەرنشینەکان",
  "Other passengers": "سەرنشینەکانی تر",
  "I,": "من،",
  ", am a passenger on this trip": "، سەرنشینی ئەم گەشتەم",
  "Add anyone else travelling – choose HRID employees from the list or enter non-HRID people.": "هەر کەسێکی تر کە دێت زیادی بکە – کارمەندانی HRID لە لیستەکە هەڵبژێرە یان ناوی کەسانی دەرەوەی HRID بنووسە.",
  "Add passenger": "زیادکردنی سەرنشین",
  "Remove": "لابردن",
  "HRID employee": "کارمەندی HRID",
  "Non-HRID": "دەرەوەی HRID",
  "Select employee…": "کارمەند هەڵبژێرە…",
  "No passengers added yet.": "هێشتا هیچ سەرنشینێک زیاد نەکراوە.",
  "Add at least one passenger": "لانیکەم یەک سەرنشین زیاد بکە",
  "Maximum 60 passengers": "زۆرترین 60 سەرنشین",
  "Purpose of trip": "مەبەستی گەشت",
  "Notes for the transport team": "تێبینی بۆ تیمی گواستنەوە",
  "Submit request": "ناردنی داواکاری",
  "Request submitted – you and the administrators have been emailed": "داواکاری نێردرا – ئیمەیڵ بۆ خۆت و بەڕێوەبەران نێردرا",

  // ---- request details / lists ----
  "Trip request": "داواکاری گەشت",
  "Trip requests": "داواکارییەکانی گەشت",
  "Request details": "وردەکاری داواکاری",
  "Reference": "ژمارەی ئاماژە",
  "Requested by": "داواکار",
  "Date": "بەروار",
  "Time": "کات",
  "Purpose": "مەبەست",
  "Vehicle": "ئۆتۆمبێل",
  "Reviewed by": "پێداچوونەوە لەلایەن",
  "Submitted": "نێردراو",
  "Cancel request": "هەڵوەشاندنەوەی داواکاری",
  "Cancel this trip request?": "ئەم داواکاری گەشتە هەڵدەوەشێنیتەوە؟",
  "Request cancelled": "داواکاری هەڵوەشێندرایەوە",
  "You have not requested any trips yet.": "هێشتا داوای هیچ گەشتێکت نەکردووە.",
  "Pending approval": "چاوەڕێی پەسەندکردن",
  "Approved upcoming": "پەسەندکراوی داهاتوو",
  "Next approved trip": "گەشتی پەسەندکراوی داهاتوو",
  "No upcoming approved trips.": "هیچ گەشتێکی پەسەندکراوی داهاتوو نییە.",
  "New request": "داواکاری نوێ",

  // ---- statuses ----
  "Pending": "چاوەڕوان",
  "Approved": "پەسەندکراو",
  "Rejected": "ڕەتکراوە",
  "Cancelled": "هەڵوەشێنراوە",
  "Completed": "تەواوبوو",
  "Draft": "ڕەشنووس",
  "All": "هەمووی",
  "Active": "چالاک",
  "Disabled": "ناچالاک",

  // ---- admin review ----
  "Review request": "پێداچوونەوەی داواکاری",
  "Approve & assign driver": "پەسەندکردن و دیاریکردنی شۆفێر",
  "Change assignment": "گۆڕینی دیاریکردن",
  "Comment (required when rejecting)": "تێبینی (لە کاتی ڕەتکردنەوەدا پێویستە)",
  "Approve": "پەسەندکردن",
  "Save assignment": "پاشەکەوتکردنی دیاریکردن",
  "Reject": "ڕەتکردنەوە",
  "Reject this request?": "ئەم داواکارییە ڕەت دەکەیتەوە؟",
  "Please give a reason for rejecting": "تکایە هۆکاری ڕەتکردنەوە بنووسە",
  "Request rejected – the requester has been emailed": "داواکاری ڕەتکرایەوە – ئیمەیڵ بۆ داواکار نێردرا",
  "Requests awaiting approval": "داواکاری چاوەڕێی پەسەندکردن",
  "Pending requests": "داواکارییە چاوەڕوانەکان",
  "No pending requests.": "هیچ داواکارییەکی چاوەڕوان نییە.",
  "Active drivers": "شۆفێری چالاک",
  "Checklists this week": "پشکنینەکانی ئەم هەفتەیە",
  "Vehicles with defects": "ئۆتۆمبێلی کەموکوڕیدار",
  "Weekly checklist status": "دۆخی پشکنینی هەفتانە",
  "No drivers yet. Add them under Users.": "هێشتا هیچ شۆفێرێک نییە. لە بەشی بەکارهێنەران زیادیان بکە.",
  "Defects reported": "کەموکوڕی تۆمارکراوە",
  "Not submitted": "نەنێردراوە",

  // ---- driver / trips ----
  "Weekly vehicle checklist due": "کاتی پشکنینی هەفتانەی ئۆتۆمبێلە",
  "Complete checklist": "تەواوکردنی پشکنین",
  "Checklist completed this week": "پشکنینی ئەم هەفتەیە تەواوکراوە",
  "Draft trips": "گەشتی ڕەشنووس",
  "Completed today": "تەواوبووی ئەمڕۆ",
  "Passengers today": "سەرنشینانی ئەمڕۆ",
  "Distance today": "مەودای ئەمڕۆ",
  "Assigned trips": "گەشتە دیاریکراوەکان",
  "No trips assigned to you right now.": "لە ئێستادا هیچ گەشتێک بۆ تۆ دیاری نەکراوە.",
  "Start trip": "دەستپێکردنی گەشت",
  "Search trips": "گەڕان لە گەشتەکان",
  "Driver, vehicle, place, passenger…": "شۆفێر، ئۆتۆمبێل، شوێن، سەرنشین…",
  "No trips found.": "هیچ گەشتێک نەدۆزرایەوە.",
  "Edit trip": "دەستکاریکردنی گەشت",
  "Driver & vehicle": "شۆفێر و ئۆتۆمبێل",
  "Driver name": "ناوی شۆفێر",
  "Driver employee number": "ژمارەی کارمەندی شۆفێر",
  "Odometer at start (km)": "کیلۆمەتری دەستپێک (km)",
  "Odometer at end (km)": "کیلۆمەتری کۆتایی (km)",
  "Odometer reading (km)": "خوێندنەوەی کیلۆمەتر (km)",
  "Odometer": "کیلۆمەتر",
  "Must be greater than the start reading": "دەبێت لە کیلۆمەتری دەستپێک زیاتر بێت",
  "Capture start GPS": "تۆمارکردنی شوێنی دەستپێک (GPS)",
  "Capture end GPS": "تۆمارکردنی شوێنی کۆتایی (GPS)",
  "Not captured": "تۆمار نەکراوە",
  "Locating…": "دۆزینەوەی شوێن…",
  "Location unavailable – allow location access": "شوێن بەردەست نییە – ڕێگە بە دەستگەیشتن بە شوێن بدە",
  "Passengers & signatures": "سەرنشینان و واژۆکان",
  "Collect signature": "وەرگرتنی واژۆ",
  "Re-sign": "واژۆی دووبارە",
  "Signature missing": "واژۆ نییە",
  "Passenger signature": "واژۆی سەرنشین",
  "Save signature": "پاشەکەوتکردنی واژۆ",
  "Signature saved": "واژۆ پاشەکەوت کرا",
  "Remove this signed passenger?": "ئەم سەرنشینە واژۆکراوە لادەبەیت؟",
  "Select or enter the passenger first": "سەرەتا سەرنشین هەڵبژێرە یان ناوی بنووسە",
  "I declare that the trip details above are correct and every passenger signed personally.": "ڕادەگەیەنم کە زانیارییەکانی سەرەوەی گەشت دروستن و هەموو سەرنشینێک خۆی واژۆی کردووە.",
  "Please confirm the driver declaration": "تکایە بەڵێننامەی شۆفێر پشتڕاست بکەرەوە",
  "Every passenger must sign before the trip can be submitted": "پێش ناردنی گەشت دەبێت هەموو سەرنشینان واژۆ بکەن",
  "Save draft": "پاشەکەوتکردن وەک ڕەشنووس",
  "Submit trip": "ناردنی گەشت",
  "Draft saved": "ڕەشنووس پاشەکەوت کرا",
  "Trip submitted": "گەشت نێردرا",
  "This trip is not assigned to you": "ئەم گەشتە بۆ تۆ دیاری نەکراوە",
  "Trip summary": "پوختەی گەشت",
  "Trip report": "ڕاپۆرتی گەشت",
  "Employee Transportation Trip Report": "ڕاپۆرتی گەشتی گواستنەوەی کارمەندان",
  "Export PDF": "دەرهێنان بە PDF",
  "Print / PDF": "چاپکردن / PDF",
  "Distance": "مەودا",
  "Departure": "ڕۆیشتن",
  "Return": "گەڕانەوە",
  "Start GPS": "شوێنی دەستپێک",
  "End GPS": "شوێنی کۆتایی",
  "Declaration": "بەڵێننامە",
  "Confirmed by driver": "لەلایەن شۆفێرەوە پشتڕاستکراوەتەوە",
  "Not confirmed": "پشتڕاست نەکراوەتەوە",
  "Passenger": "سەرنشین",
  "Signature": "واژۆ",

  // ---- weekly checklist ----
  "Weekly checklist": "پشکنینی هەفتانە",
  "Weekly checklists": "پشکنینە هەفتانەکان",
  "Complete one safety & maintenance checklist every Sunday at 08:00.": "هەموو یەکشەممەیەک کاتژمێر 08:00 یەک پشکنینی سەلامەتی و چاککردنەوە تەواو بکە.",
  "Additional notes": "تێبینی زیاتر",
  "I confirm that I personally inspected this vehicle and the information above is correct.": "پشتڕاستی دەکەمەوە کە خۆم ئەم ئۆتۆمبێلەم پشکنیوە و زانیارییەکانی سەرەوە دروستن.",
  "Please confirm the declaration": "تکایە بەڵێننامەکە پشتڕاست بکەرەوە",
  "Submit checklist": "ناردنی پشکنین",
  "Checklist submitted": "پشکنین نێردرا",
  "Please complete all checklist items": "تکایە هەموو خاڵەکانی پشکنین تەواو بکە",
  "Select OK, Needs attention or N/A": "باش، پێویستی بە چاککردنە یان نایگرێتەوە هەڵبژێرە",
  "Comment required": "تێبینی پێویستە",
  "Describe the problem (required)": "کێشەکە ڕوون بکەرەوە (پێویستە)",
  "Cannot be negative": "نابێت سالب بێت",
  "OK": "باش",
  "Needs attention": "پێویستی بە چاککردنە",
  "N/A": "نایگرێتەوە",
  "This week's checklist is complete": "پشکنینی ئەم هەفتەیە تەواوە",
  "Checklist details": "وردەکاری پشکنین",
  "Defects": "کەموکوڕی",
  "Checked": "پشکنراوە",
  "Not checked": "نەپشکنراوە",
  "Plate": "ژمارەی تابلۆ",
  "History": "مێژوو",
  "No checklists submitted yet.": "هێشتا هیچ پشکنینێک نەنێردراوە.",
  "No drivers": "هیچ شۆفێرێک نییە",
  "Fleet – this week": "ئۆتۆمبێلەکان – ئەم هەفتەیە",
  "Safety": "سەلامەتی",
  "Maintenance": "چاککردنەوە و چاودێری",
  "Tyres – condition & pressure": "تایەکان – دۆخ و پەستان (با)",
  "Spare tyre, jack & wheel spanner": "تایەی یەدەگ، جەک و سپانەی تایە",
  "Brakes & handbrake": "بریک و هاندبریک",
  "Headlights, indicators & brake lights": "گڵۆپی پێشەوە، ئیشارەت و گڵۆپی بریک",
  "Horn": "هۆڕن",
  "Wipers & washer fluid": "ماسیحە و ئاوی شووشەشۆر",
  "Mirrors": "ئاوێنەکان",
  "Seat belts (all seats)": "پشتێنی سەلامەتی (هەموو کورسییەکان)",
  "Windscreen & windows": "شووشەی پێشەوە و پەنجەرەکان",
  "First-aid kit": "جانتای فریاکەوتنی سەرەتایی",
  "Fire extinguisher (charged, in date)": "ئاگرکوژێنەوە (پڕ و بەسەرنەچوو)",
  "Warning triangle & reflective vest": "سێگۆشەی ئاگاداری و جلی ڕەنگدانەوە",
  "Engine oil level": "ئاستی ڕۆنی بزوێنەر (ماتۆڕ)",
  "Coolant level": "ئاستی ئاوی ساردکەرەوە (ڕادیەیتەر)",
  "Brake fluid level": "ئاستی ڕۆنی بریک",
  "Battery condition": "دۆخی پاتری",
  "Fuel level": "ئاستی سووتەمەنی",
  "No dashboard warning lights": "هیچ گڵۆپێکی ئاگاداری لەسەر داشبۆرد نییە",
  "No leaks under the vehicle": "هیچ دزەیەک لە ژێر ئۆتۆمبێلەکەدا نییە",
  "Air conditioning": "سپلیت / فێنککەرەوە",
  "Service date / mileage not overdue": "کاتی سێرڤیس / کیلۆمەتر تێنەپەڕیوە",
  "Cleanliness inside & outside": "پاکوخاوێنی ناوەوە و دەرەوە",
  "Registration & insurance documents in vehicle": "سەنەوی و بەڵگەنامەی بیمە لە ئۆتۆمبێلەکەدایە",

  // ---- users / admin ----
  "Add user": "زیادکردنی بەکارهێنەر",
  "Edit user": "دەستکاریکردنی بەکارهێنەر",
  "Import CSV": "هێنانی CSV",
  "Email log": "تۆماری ئیمەیڵەکان",
  "Search users": "گەڕان لە بەکارهێنەران",
  "Name, employee no., email, role…": "ناو، ژمارەی کارمەند، ئیمەیڵ، ڕۆڵ…",
  "No users found": "هیچ بەکارهێنەرێک نەدۆزرایەوە",
  "Has not signed in yet": "هێشتا نەچووەتە ژوورەوە",
  "Employee (requests trips)": "کارمەند (داوای گەشت دەکات)",
  "Email (for notifications)": "ئیمەیڵ (بۆ ئاگادارکردنەوە)",
  "Default vehicle (drivers)": "ئۆتۆمبێلی سەرەکی (بۆ شۆفێران)",
  "Set a temporary password (leave blank to keep)": "وشەی نهێنی کاتی دابنێ (بەتاڵی بهێڵەوە بۆ نەگۆڕین)",
  "Temporary password (e.g. birthday DDMMYYYY)": "وشەی نهێنی کاتی (بۆ نموونە بەرواری لەدایکبوون DDMMYYYY)",
  "The user must change a temporary password at their next sign-in.": "بەکارهێنەر دەبێت لە چوونەژوورەوەی داهاتوودا وشەی نهێنی کاتی بگۆڕێت.",
  "Account active": "هەژمار چالاکە",
  "This employee number already exists": "ئەم ژمارەی کارمەندە پێشتر هەیە",
  "This email is already used": "ئەم ئیمەیڵە پێشتر بەکارهاتووە",
  "You cannot remove your own administrator role": "ناتوانیت ڕۆڵی بەڕێوەبەری خۆت لابەریت",
  "User saved": "بەکارهێنەر پاشەکەوت کرا",
  "The file is empty.": "فایلەکە بەتاڵە.",
  "CSV must have the columns: employee_no, full_name, birth_date, email, role": "فایلی CSV دەبێت ئەم ستوونانەی تێدابێت: employee_no, full_name, birth_date, email, role",
  "Demo mode – emails are": "دۆخی تاقیکردنەوە – ئیمەیڵەکان",
  "not sent": "نانێردرێن",
  ". This log shows exactly what will be sent once Supabase and the Microsoft 365 mailbox are connected (see README).": ". ئەم تۆمارە ڕێک ئەوە پیشان دەدات کە دوای بەستنەوەی Supabase و پۆستی Microsoft 365 دەنێردرێت (سەیری README بکە).",
  "No emails yet.": "هێشتا هیچ ئیمەیڵێک نییە.",
  "No recipients with an email address.": "هیچ وەرگرێک ئیمەیڵی نییە.",
  "To:": "بۆ:",
  "Approved / assigned": "پەسەندکراو / دیاریکراو",
  "demo (not sent)": "تاقیکردنەوە (نەنێردراوە)",
  "queued": "لە ڕیزدایە",
  "sent": "نێردرا",
  "failed": "سەرکەوتوو نەبوو",

  // ---- vehicles ----
  "Toyota Hilux": "تۆیۆتا هیلۆکس",
  "Toyota RAV4": "تۆیۆتا ڕاڤ ٤",
  "Toyota Corolla Cross": "تۆیۆتا کرۆلا کرۆس",
  "Nissan Patrol": "نیسان پاتڕۆڵ",
};

const WEEKDAYS = ["یەکشەممە", "دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە"];
const MONTHS = ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمموز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"];
const tabNames = { Pending: "چاوەڕوان", Approved: "پەسەندکراو", Rejected: "ڕەتکراوە", Completed: "تەواوبوو", Cancelled: "هەڵوەشێنراوە", All: "هەمووی", Requests: "داواکارییەکان" };

// Whole-text patterns (texts that contain names, numbers or dates).
const PATTERNS = [
  [/^Destination (\d+)$/, (m) => `شوێنی مەبەست ${m[1]}`],
  [/^Passenger (\d+)$/, (m) => `سەرنشین ${m[1]}`],
  [/^Remove destination (\d+)$/, (m) => `لابردنی شوێنی مەبەست ${m[1]}`],
  [/^Remove passenger (\d+)$/, (m) => `لابردنی سەرنشین ${m[1]}`],
  [/^Passenger (\d+) type$/, (m) => `جۆری سەرنشین ${m[1]}`],
  [/^Passenger (\d+): select the HRID employee \(or remove the empty passenger\)$/, (m) => `سەرنشین ${m[1]}: کارمەندی HRID هەڵبژێرە (یان سەرنشینە بەتاڵەکە لابەرە)`],
  [/^Passenger (\d+): enter the full name \(or remove the empty passenger\)$/, (m) => `سەرنشین ${m[1]}: ناوی تەواو بنووسە (یان سەرنشینە بەتاڵەکە لابەرە)`],
  [/^(.+) is listed more than once$/, (m) => `${m[1]} زیاتر لە جارێک نووسراوە`],
  [/^Signature of (.+)$/, (m) => `واژۆی ${m[1]}`],
  [/^(.+) – sign inside the box with a finger or stylus\.$/, (m) => `${m[1]} – بە پەنجە یان قەڵەم لەناو چوارگۆشەکەدا واژۆ بکە.`],
  [/^Total passengers: (\d+)$/, (m) => `کۆی سەرنشینان: ${m[1]}`],
  [/^Passengers \((\d+)\)$/, (m) => `سەرنشینەکان (${m[1]})`],
  [/^Maximum (\d+) destinations\.$/, (m) => `زۆرترین ${m[1]} شوێنی مەبەست.`],
  [/^Welcome, (.+)$/, (m) => `بەخێربێیت، ${m[1]}`],
  [/^Due: (.+)$/, (m) => `کاتی دیاریکراو: ${m[1]}`],
  [/^Safety & maintenance check – due every Sunday at 08:00\. This week started (.+)\.$/, (m) => `پشکنینی سەلامەتی و چاککردنەوە – هەموو یەکشەممەیەک کاتژمێر 08:00. ئەم هەفتەیە دەستیپێکرد: ${m[1]}.`],
  [/^Submitted (.+)\. Next due (.+)\.$/, (m) => `نێردرا: ${m[1]}. پشکنینی داهاتوو: ${m[2]}.`],
  [/^Next checklist due (.+)$/, (m) => `پشکنینی داهاتوو: ${m[1]}`],
  [/^Signed (.+)$/, (m) => `واژۆکرا ${m[1]}`],
  [/^Week of (.+)$/, (m) => `هەفتەی ${m[1]}`],
  [/^Checklist – (.+)$/, (m) => `پشکنین – ${tr(m[1])}`],
  [/^Drivers – this week \(from (.+)\)$/, (m) => `شۆفێران – ئەم هەفتەیە (لە ${m[1]}ەوە)`],
  [/^Trip pre-filled from request (.*) by (.+)\.$/, (m) => `گەشتەکە لە داواکاری ${m[1]} ی ${m[2]} پڕکراوەتەوە.`],
  [/^Approved – (.+) and the requester have been emailed$/, (m) => `پەسەندکرا – ئیمەیڵ بۆ ${m[1]} و داواکار نێردرا`],
  [/^The HRID transport administrators will review your request and email you at (.+)\.$/, (m) => `بەڕێوەبەرانی گواستنەوەی HRID پێداچوونەوە بە داواکارییەکەتدا دەکەن و ئیمەیڵ بۆ ${m[1]} دەنێرن.`],
  [/^The HRID transport administrators will review your request\. They will contact you by phone\.$/, () => "بەڕێوەبەرانی گواستنەوەی HRID پێداچوونەوە بە داواکارییەکەتدا دەکەن و بە مۆبایل پەیوەندیت پێوە دەکەن."],
  [/^(\d+) of (\d+) users · (\d+) admins · (\d+) drivers$/, (m) => `${m[1]} لە ${m[2]} بەکارهێنەر · ${m[3]} بەڕێوەبەر · ${m[4]} شۆفێر`],
  [/^No (\w+) requests\.$/, (m) => `هیچ داواکارییەکی ${(tabNames[m[1][0].toUpperCase() + m[1].slice(1)] || m[1])} نییە.`],
  [/^No\s+requests\.$/, () => "هیچ داواکارییەک نییە."],
  [/^(Pending|Approved|Rejected|Completed|Cancelled|All|Requests) \((\d+)\)$/, (m) => `${tabNames[m[1]]} (${m[2]})`],
  [/^(\d+) passenger\(s\)$/, (m) => `${m[1]} سەرنشین`],
  [/^Requested by (.+)$/, (m) => `داواکار: ${m[1]}`],
  [/^By (.+)$/, (m) => `لەلایەن ${m[1]}`],
  [/^Driver: (.+)$/, (m) => `شۆفێر: ${m[1]}`],
  [/^(.+) already has (\d+) approved trip\(s\) at an overlapping time on this date: (.+)$/, (m) => `${m[1]} لەم بەروارەدا ${m[2]} گەشتی پەسەندکراوی هەیە لە هەمان کاتدا: ${m[3]}`],
  [/^(.+) is already booked at an overlapping time: (.+)$/, (m) => `${tr(m[1])} لە هەمان کاتدا پێشتر گیراوە: ${m[2]}`],
  [/^(\d+(?:\.\d+)?) km$/, (m) => `${m[1]} کم`],
  [/^Import finished: (\d+) added, (\d+) updated \(existing passwords kept\)(.*)\.$/s, (m) => `هێنان تەواو بوو: ${m[1]} زیادکرا، ${m[2]} نوێکرایەوە (وشە نهێنییەکانی پێشوو ماونەتەوە)${m[3] ? "، " + m[3].replace(/^, (\d+) skipped \(missing name, number or birth date\): /, "$1 تێپەڕێنرا (ناو، ژمارە یان بەرواری لەدایکبوون نییە): ") : ""}.`],
];

const MODELS = ["Toyota Corolla Cross", "Toyota Hilux", "Toyota RAV4", "Nissan Patrol"];
const SUBS = [
  [/ → /g, " ← "],
  [/(\d+) passenger\(s\)/g, "$1 سەرنشین"],
  [/–\s?return /g, "– گەڕانەوە "],
  [/ km\b/g, " کم"],
  [/\+(\d+) more/g, "+$1 ی تر"],
  ...MODELS.map((m) => [new RegExp(m, "g"), KU[m]]),
];

/** Translate one piece of English UI text (keeps surrounding spaces). */
export function tr(s) {
  if (!IS_KU || s == null) return s;
  const str = String(s);
  const core = str.trim();
  if (!core || !/[A-Za-z]/.test(core)) return str.replace(/ → /g, " ← ");
  const lead = str.slice(0, str.indexOf(core)), trail = str.slice(str.indexOf(core) + core.length);
  return lead + trCore(core) + trail;
}
function trCore(core) {
  if (Object.prototype.hasOwnProperty.call(KU, core)) return KU[core];
  for (const [re, fn] of PATTERNS) { const m = core.match(re); if (m) return fn(m); }
  if (core.includes(" · ")) return core.split(" · ").map((p) => (Object.prototype.hasOwnProperty.call(KU, p) ? KU[p] : trSeg(p))).join(" · ");
  return trSeg(core);
}
function trSeg(p) {
  for (const [re, fn] of PATTERNS) { const m = p.match(re); if (m) return fn(m); }
  let out = p;
  for (const [re, rep] of SUBS) out = out.replace(re, rep);
  return out;
}

/* ---------------- dates in Kurdish ---------------- */
export function kuDate(y, m, d, weekday) { return `${WEEKDAYS[weekday]} ${d} ی ${MONTHS[m - 1]} ${y}`; }

/* ---------------- DOM translation ---------------- */
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "IFRAME", "CODE"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt"];
function translateTree(root) {
  if (root.nodeType === 3) { translateText(root); return; }
  if (root.nodeType !== 1 || SKIP.has(root.nodeName) || root.closest?.("[data-no-tr]")) return;
  for (const a of ATTRS) if (root.hasAttribute?.(a)) { const v = root.getAttribute(a), t = tr(v); if (t !== v) root.setAttribute(a, t); }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.nodeName) || n.hasAttribute("data-no-tr")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  root.querySelectorAll?.("textarea").forEach((t) => { for (const a of ATTRS) if (t.hasAttribute(a)) { const v = t.getAttribute(a), x = tr(v); if (x !== v) t.setAttribute(a, x); } });
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 3) translateText(n);
    else for (const a of ATTRS) if (n.hasAttribute(a)) { const v = n.getAttribute(a), t = tr(v); if (t !== v) n.setAttribute(a, t); }
  }
}
function translateText(node) {
  const p = node.parentNode;
  if (!p || SKIP.has(p.nodeName) || p.closest?.("[data-no-tr]")) return;
  const v = node.nodeValue, t = tr(v);
  if (t !== v) node.nodeValue = t;
}

export function setLang(lang) {
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  location.reload();
}
export function langButton(extraClass = "") {
  return `<button type="button" class="lang-btn ${extraClass}" data-lang-toggle data-no-tr lang="${IS_KU ? "en" : "ckb"}" aria-label="${IS_KU ? "Switch to English" : "گۆڕین بۆ کوردی"}">${IS_KU ? "English" : "کوردی"}</button>`;
}

/* ---------------- start ---------------- */
document.documentElement.lang = IS_KU ? "ckb" : "en";
document.documentElement.dir = IS_KU ? "rtl" : "ltr";
document.addEventListener("click", (e) => {
  if (e.target.closest?.("[data-lang-toggle]")) setLang(IS_KU ? "en" : "ku");
});
if (IS_KU) {
  const nativeAlert = window.alert.bind(window), nativeConfirm = window.confirm.bind(window);
  window.alert = (m) => nativeAlert(tr(m));
  window.confirm = (m) => nativeConfirm(tr(m));
  const start = () => {
    translateTree(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") translateText(m.target);
        else if (m.type === "attributes") translateTree(m.target);
        else m.addedNodes.forEach(translateTree);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
}
