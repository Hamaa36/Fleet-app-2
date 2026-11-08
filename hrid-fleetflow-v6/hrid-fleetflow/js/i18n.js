// Language: English (default) and Kurdish Central / Sorani (کوردی), right-to-left.
// The app is written in English; in Kurdish every visible text is translated through KU (exact text)
// or PATTERNS (text with names/numbers). Edit the lists below to change any wording.
const KEY = "hrid_lang";
export const LANG = (() => { try { return localStorage.getItem(KEY) === "ku" ? "ku" : "en"; } catch { return "en"; } })();
export const IS_KU = LANG === "ku";

const KU = {
  // app & navigation
  "Dashboard": "سەرەکی", "Home": "سەرەکی", "Trips": "گەشتەکان", "Trip": "گەشت", "My trips": "گەشتەکانم", "Vehicles": "ئۆتۆمبێلەکان",
  "Reports": "ڕاپۆرتەکان", "Users": "بەکارهێنەران", "Profile": "پرۆفایل", "Checklist": "پشکنین", "Problem": "کێشە",
  "New request": "داواکاری نوێ", "My requests": "داواکارییەکانم", "Request": "داواکاری", "Main": "ڕێنیشاندەری سەرەکی",
  "Administrator": "بەڕێوەبەری سیستەم", "Driver": "شۆفێر", "Employee": "کارمەند", "Guest": "میوان", "HRID": "HRID",
  "← Back": "→ گەڕانەوە", "Reload": "دووبارە بارکردنەوە", "Something went wrong": "هەڵەیەک ڕوویدا",
  "You do not have access to that page": "دەسەڵاتی ئەو پەڕەیەت نییە",
  "Demo mode: data is saved only on this device. Connect Supabase in": "دۆخی تاقیکردنەوە: زانیارییەکان تەنها لەسەر ئەم ئامێرە پاشەکەوت دەکرێن. Supabase لە",
  "to share data between phones.": "ببەستەوە بۆ هاوبەشکردنی زانیاری لە نێوان مۆبایلەکاندا.",
  "A database table is missing. Run supabase/schema.sql again in the Supabase SQL Editor.": "خشتەیەکی بنکەدراوە نییە. فایلی supabase/schema.sql دووبارە لە SQL Editor ی Supabase جێبەجێ بکە.",
  "Hiwa Rauf for Investment & Development": "هیوا ڕەئوف بۆ وەبەرهێنان و گەشەپێدان", "Company transport": "گواستنەوەی کۆمپانیا",
  "Language": "زمان", "When": "کەی", "Vehicle use": "بەکارهێنانی ئۆتۆمبێل",

  // sign in
  "First-time setup": "ڕێکخستنی یەکەمجار", "Import employees from CSV": "هێنانی کارمەندان لە فایلی CSV",
  "Passwords are set to each person's date of birth (DDMMYYYY) and must be changed at first sign-in.": "وشەی نهێنی هەر کەسێک بەرواری لەدایکبوونیەتی (DDMMYYYY) و لە یەکەم چوونەژوورەوەدا دەبێت بیگۆڕێت.",
  "— or create one administrator manually —": "— یان بەڕێوەبەرێک بە دەست دروست بکە —", "Create administrator": "دروستکردنی بەڕێوەبەر",
  "Administrator created": "بەڕێوەبەر دروستکرا", "Employees imported – please sign in": "کارمەندان هێنران – تکایە بچۆ ژوورەوە",
  "Employee number or email": "ژمارەی کارمەند یان ئیمەیڵ", "Password": "وشەی نهێنی", "Confirm password": "دووپاتکردنەوەی وشەی نهێنی",
  "Sign in": "چوونەژوورەوە", "Sign out": "چوونەدەرەوە", "Incorrect employee number/email or password.": "ژمارەی کارمەند/ئیمەیڵ یان وشەی نهێنی هەڵەیە.",
  "First time? Your password is your date of birth as DDMMYYYY (for example 08/09/2003 → 08092003). You will be asked to change it.": "یەکەمجارە؟ وشەی نهێنییەکەت بەرواری لەدایکبوونتە بە شێوەی DDMMYYYY (بۆ نموونە 08/09/2003 ← 08092003). داوات لێدەکرێت بیگۆڕیت.",
  "Welcome,": "بەخێربێیت،", "Please choose your own password to continue.": "تکایە وشەی نهێنی تایبەت بە خۆت هەڵبژێرە.",
  "New password": "وشەی نهێنی نوێ", "Confirm new password": "دووپاتکردنەوەی وشەی نهێنی نوێ", "Current password": "وشەی نهێنی ئێستا",
  "Save password": "پاشەکەوتکردنی وشەی نهێنی", "Update password": "نوێکردنەوەی وشەی نهێنی", "Change password": "گۆڕینی وشەی نهێنی",
  "Password saved": "وشەی نهێنی پاشەکەوت کرا", "Password updated": "وشەی نهێنی نوێکرایەوە", "Passwords do not match": "وشە نهێنییەکان وەک یەک نین",
  "At least 8 characters": "لانیکەم 8 پیت", "At least 6 characters": "لانیکەم 6 پیت",
  "Use letters and numbers – not only digits (not your birthday)": "پیت و ژمارە بەکاربهێنە – نەک تەنها ژمارە (نەک بەرواری لەدایکبوونت)",
  "Current password is incorrect": "وشەی نهێنی ئێستا هەڵەیە",

  // common
  "Select…": "هەڵبژێرە…", "This field is required": "ئەم خانەیە پێویستە", "Please confirm": "تکایە پشتڕاستی بکەرەوە",
  "Enter a valid email": "ئیمەیڵێکی دروست بنووسە", "Enter a valid phone number": "ژمارە مۆبایلێکی دروست بنووسە",
  "Save": "پاشەکەوت", "Cancel": "هەڵوەشاندنەوە", "Edit": "دەستکاری", "Clear": "سڕینەوە", "Add": "زیادکردن", "View": "بینین",
  "Full name": "ناوی تەواو", "Email": "ئیمەیڵ", "Phone": "مۆبایل", "Department": "بەش", "Employee number": "ژمارەی کارمەند",
  "Role": "ڕۆڵ", "Status": "دۆخ", "Name": "ناو", "No.": "ژ.", "Notes": "تێبینی", "Details": "وردەکاری", "Location": "شوێن",
  "Map": "نەخشە", "No location": "شوێن نییە", "Total": "کۆ", "Search": "گەڕان", "Print / PDF": "چاپکردن / PDF",
  "Getting your location…": "دۆزینەوەی شوێنەکەت…", "Location not available": "شوێن بەردەست نییە",
  "Turn on Location (GPS) on your phone and allow this website to use it, then try again.": "Location (GPS) لە مۆبایلەکەت هەڵبکە و ڕێگە بەم ماڵپەڕە بدە بەکاری بهێنێت، پاشان دووبارە هەوڵ بدەرەوە.",
  "Try again": "دووبارە هەوڵ بدەرەوە", "Record without location": "تۆمارکردن بەبێ شوێن", "Location still not available": "هێشتا شوێن بەردەست نییە",

  // statuses
  "Pending approval": "چاوەڕێی پەسەندکردن", "Approved": "پەسەندکراو", "In progress": "لە ڕێگادایە", "Awaiting signature": "چاوەڕێی واژۆ",
  "Completed": "تەواوبوو", "Rejected": "ڕەتکراوە", "Cancelled": "هەڵوەشێنراوە", "Open": "کراوە", "Resolved": "چاککراوە",
  "Minor": "بچووک", "Major": "گەورە", "Unsafe": "مەترسیدار", "Active": "چالاک", "All": "هەمووی", "Available": "بەردەستە", "Disabled": "ناچالاک",

  // request form
  "Request transport": "داوای گواستنەوە", "Who is it for?": "بۆ کێیە؟", "HRID employee": "کارمەندی HRID",
  "Visitors – only admins can request": "میوانان – تەنها بەڕێوەبەر دەتوانێت داوا بکات", "Guest name": "ناوی میوان",
  "Company / organisation": "کۆمپانیا / ڕێکخراو", "Guest phone": "مۆبایلی میوان", "Guest email (optional)": "ئیمەیڵی میوان (ئارەزوومەندانە)",
  "HRID host": "خانەخوێ لە HRID", "What?": "چی؟", "People": "کەسەکان", "Documents & items": "بەڵگەنامە و کەلوپەل",
  "Where?": "بۆ کوێ؟", "From": "لە", "To": "بۆ", "e.g. HRID Head Office": "بۆ نموونە: نووسینگەی سەرەکی HRID", "Where to?": "بۆ کوێ؟",
  "Add another stop": "زیادکردنی وێستگەیەکی تر", "When?": "کەی؟", "Date": "بەروار", "Time": "کات", "Return time (optional)": "کاتی گەڕانەوە (ئارەزوومەندانە)",
  "Who is travelling?": "کێ گەشت دەکات؟", "I am travelling": "خۆم گەشت دەکەم", "The person above is travelling": "کەسەکەی سەرەوە گەشت دەکات",
  "The guest is travelling": "میوانەکە گەشت دەکات", "Add passenger": "زیادکردنی سەرنشین", "Non-HRID": "دەرەوەی HRID",
  "Select employee…": "کارمەند هەڵبژێرە…", "Company (optional)": "کۆمپانیا (ئارەزوومەندانە)", "What is being sent?": "چی دەنێردرێت؟",
  "What? e.g. Signed contracts": "چی؟ بۆ نموونە: گرێبەستی واژۆکراو", "Add item": "زیادکردنی کەلوپەل", "Receiver name": "ناوی وەرگر",
  "Receiver phone": "مۆبایلی وەرگر", "After delivery you confirm by signing on your own phone.": "دوای گەیاندن لە مۆبایلی خۆتەوە واژۆ دەکەیت بۆ پشتڕاستکردنەوە.",
  "The requester confirms the delivery by signing on their own phone.": "داواکار لە مۆبایلی خۆیەوە واژۆ دەکات بۆ پشتڕاستکردنەوەی گەیاندن.",
  "Purpose": "مەبەست", "e.g. Meeting at the bank": "بۆ نموونە: کۆبوونەوە لە بانک", "Notes (optional)": "تێبینی (ئارەزوومەندانە)",
  "Assign now (optional)": "ئێستا دیاری بکە (ئارەزوومەندانە)", "Choose a driver and vehicle to approve the request straight away.": "شۆفێر و ئۆتۆمبێل هەڵبژێرە بۆ پەسەندکردنی ڕاستەوخۆ.",
  "Vehicle": "ئۆتۆمبێل", "Send request": "ناردنی داواکاری", "Enter where to go": "شوێنی مەبەست بنووسە", "Date cannot be in the past": "بەروار نابێت ڕابردوو بێت",
  "Must be after the departure time": "دەبێت دوای کاتی ڕۆیشتن بێت", "Add at least one passenger": "لانیکەم یەک سەرنشین زیاد بکە",
  "Add at least one item": "لانیکەم یەک کەلوپەل زیاد بکە", "Maximum 60 passengers": "زۆرترین 60 سەرنشین",
  "Choose both driver and vehicle, or neither": "هەردوو شۆفێر و ئۆتۆمبێل هەڵبژێرە، یان هیچیان",
  "Request sent – the administrators have been notified": "داواکاری نێردرا – بەڕێوەبەران ئاگادارکرانەوە",

  // employee
  "Your delivery arrived – please sign": "گەیاندنەکەت گەیشت – تکایە واژۆ بکە", "Sign": "واژۆ", "Current requests": "داواکارییە ئێستاکان",
  "You have no current requests.": "هیچ داواکارییەکی ئێستات نییە.", "All my requests": "هەموو داواکارییەکانم",
  "You have not requested any transport yet.": "هێشتا داوای هیچ گواستنەوەیەکت نەکردووە.", "Your delivery arrived": "گەیاندنەکەت گەیشت",
  "Check the items and sign to confirm.": "کەلوپەلەکان بپشکنە و واژۆ بکە بۆ پشتڕاستکردنەوە.", "Cancel request": "هەڵوەشاندنەوەی داواکاری",
  "Cancel this request?": "ئەم داواکارییە هەڵدەوەشێنیتەوە؟", "Request cancelled": "داواکاری هەڵوەشێندرایەوە", "Confirm delivery": "پشتڕاستکردنەوەی گەیاندن",
  "Sign to confirm the documents/items were delivered.": "واژۆ بکە بۆ پشتڕاستکردنەوەی گەیاندنی بەڵگەنامە/کەلوپەلەکان.",
  "Thank you – delivery confirmed": "سوپاس – گەیاندن پشتڕاستکرایەوە",

  // trip details & timeline
  "Requested by": "داواکار", "Organisation": "ڕێکخراو", "Date & time": "بەروار و کات", "Route": "ڕێگا", "Items": "کەلوپەل", "Receiver": "وەرگر",
  "Admin comment": "تێبینی بەڕێوەبەر", "Cancel reason": "هۆکاری هەڵوەشاندنەوە", "Odometer": "کیلۆمەتر", "Handed over to": "درا بە",
  "Pick-up": "سوارکردن", "Destination": "شوێنی مەبەست", "Back at pick-up": "گەڕانەوە بۆ شوێنی سوارکردن", "Timeline": "ڕووداوەکان",
  "Requested": "داواکرا", "Trip finished": "گەشت تەواو بوو", "Requester signature": "واژۆی داواکار", "Not signed yet": "هێشتا واژۆ نەکراوە",
  "Passenger signatures": "واژۆی سەرنشینان", "Missing": "نییە", "Passengers": "سەرنشینان", "Passenger": "سەرنشین", "Trip report": "ڕاپۆرتی گەشت",

  // admin dashboard & trips
  "Approved – not started": "پەسەندکراو – دەستی پێنەکردووە", "Completed today": "تەواوبووی ئەمڕۆ", "Vehicle problems": "کێشەکانی ئۆتۆمبێل",
  "Status": "دۆخ", "Review": "پێداچوونەوە", "Nothing here.": "هیچ شتێک لێرە نییە.", "Today": "ئەمڕۆ", "No trips today.": "ئەمڕۆ هیچ گەشتێک نییە.",
  "Weekly checklists:": "پشکنینی هەفتانە:", "drivers done this week ·": "شۆفێر ئەم هەفتەیە تەواویان کردووە ·", "Active ": "چالاک",
  "Reference, name, place, driver…": "ژمارەی ئاماژە، ناو، شوێن، شۆفێر…", "No trips found.": "هیچ گەشتێک نەدۆزرایەوە.",
  "Approve & assign": "پەسەندکردن و دیاریکردن", "Change driver / vehicle": "گۆڕینی شۆفێر / ئۆتۆمبێل",
  "Comment (needed to reject or cancel)": "تێبینی (بۆ ڕەتکردنەوە یان هەڵوەشاندنەوە پێویستە)", "Approve": "پەسەندکردن", "Reject": "ڕەتکردنەوە",
  "Cancel trip": "هەڵوەشاندنەوەی گەشت", "Please write the reason": "تکایە هۆکارەکە بنووسە", "Reject this request?": "ئەم داواکارییە ڕەت دەکەیتەوە؟",
  "Cancel this trip?": "ئەم گەشتە هەڵدەوەشێنیتەوە؟", "Request rejected": "داواکاری ڕەتکرایەوە", "Trip cancelled": "گەشت هەڵوەشێندرایەوە",

  // driver
  "Weekly vehicle checklist is due": "کاتی پشکنینی هەفتانەی ئۆتۆمبێلە", "Every Sunday at 08:00": "هەموو یەکشەممەیەک کاتژمێر 08:00",
  "Do checklist": "پشکنین بکە", "Checklist done this week": "پشکنینی ئەم هەفتەیە کراوە", "Trip in progress": "گەشت لە ڕێگادایە",
  "Continue trip": "بەردەوامبوون لە گەشت", "My next trips": "گەشتەکانی داهاتووم", "No trips assigned to you right now.": "ئێستا هیچ گەشتێک بۆ تۆ دیاری نەکراوە.",
  "Report a vehicle problem": "ڕاپۆرتی کێشەی ئۆتۆمبێل", "My open problem reports": "ڕاپۆرتە کراوەکانی کێشەکانم", "No trips yet.": "هێشتا هیچ گەشتێک نییە.",
  "Start trip": "دەستپێکردنی گەشت", "Odometer now (km)": "کیلۆمەتری ئێستا (km)", "Start trip – record departure": "دەستپێکردنی گەشت – تۆمارکردنی ڕۆیشتن",
  "Your time and location are recorded when you start.": "کات و شوێنەکەت لە کاتی دەستپێکردندا تۆمار دەکرێن.", "Cannot be negative": "نابێت سالب بێت",
  "Trip started – departure recorded": "گەشت دەستیپێکرد – ڕۆیشتن تۆمارکرا", "Arrived": "گەیشتم", "Back": "گەڕامەوە",
  "Arrival recorded": "گەیشتن تۆمارکرا", "Arrival recorded without location": "گەیشتن بەبێ شوێن تۆمارکرا", "No passengers.": "هیچ سەرنشینێک نییە.",
  "Finish": "تەواوکردن", "Handed over to (name)": "درا بە (ناو)", "Odometer at the end (km)": "کیلۆمەتری کۆتایی (km)",
  "I confirm the details are correct and the items were handed over.": "پشتڕاستی دەکەمەوە زانیارییەکان دروستن و کەلوپەلەکان ڕادەستکران.",
  "I confirm the details are correct and every passenger signed personally.": "پشتڕاستی دەکەمەوە زانیارییەکان دروستن و هەموو سەرنشینێک خۆی واژۆی کردووە.",
  "Finish trip": "تەواوکردنی گەشت", "Record every location on the route first": "سەرەتا هەموو شوێنەکانی ڕێگا تۆمار بکە",
  "Every passenger must sign first": "سەرەتا دەبێت هەموو سەرنشینان واژۆ بکەن", "Must be greater than the start reading": "دەبێت لە کیلۆمەتری دەستپێک زیاتر بێت",
  "Trip finished": "گەشت تەواو بوو", "Passenger signature": "واژۆی سەرنشین", "Save signature": "پاشەکەوتکردنی واژۆ", "Signature saved": "واژۆ پاشەکەوت کرا",
  "Passenger added": "سەرنشین زیادکرا",

  // problems
  "The administrators are notified immediately.": "بەڕێوەبەران دەستبەجێ ئاگادار دەکرێنەوە.", "How serious?": "چەند گرنگە؟", "Describe it": "ڕوونی بکەرەوە",
  "Odometer (km, optional)": "کیلۆمەتر (ئارەزوومەندانە)", "Send report": "ناردنی ڕاپۆرت", "Problem reported – the administrators have been notified": "کێشەکە نێردرا – بەڕێوەبەران ئاگادارکرانەوە",
  "Minor – can still be driven": "بچووک – هێشتا دەتوانرێت لێبخوڕێت", "Major – needs repair soon": "گەورە – بەم زووانە پێویستی بە چاککردنە", "Unsafe – do not drive": "مەترسیدار – لێی مەخوڕە",
  "Engine": "بزوێنەر (ماتۆڕ)", "Brakes": "بریک", "Tyres": "تایە", "Lights & electrical": "گڵۆپ و کارەبا", "Air conditioning": "سپلیت / فێنککەرەوە",
  "Body damage / accident": "زیانی لەش / ڕووداو", "Warning light": "گڵۆپی ئاگاداری", "Weekly checklist": "پشکنینی هەفتانە", "Other": "هیتر",
  "Vehicle problem": "کێشەی ئۆتۆمبێل", "Reported by": "ڕاپۆرتکەر", "Reported": "کاتی ڕاپۆرت", "Driver report": "ڕاپۆرتی شۆفێر", "Resolved ": "چاککرا",
  "Repair / action": "چاککردنەوە / کار", "Mark as fixed": "وەک چاککراو دیاری بکە", "What was done?": "چی کرا؟", "Problem marked as fixed": "کێشەکە وەک چاککراو دیاری کرا",
  "Reopen problem": "کردنەوەی دووبارەی کێشە", "Problem reopened": "کێشەکە دووبارە کرایەوە", "No vehicle problems.": "هیچ کێشەیەکی ئۆتۆمبێل نییە.",

  // checklist
  "Odometer (km)": "کیلۆمەتر (km)", "Mark everything OK, then change what is not": "هەمووی وەک باش دیاری بکە، پاشان ئەوەی باش نییە بیگۆڕە",
  "OK": "باش", "N/A": "نایگرێتەوە", "What is wrong? (required)": "چی خراپە؟ (پێویستە)", "Problems found – how serious?": "کێشە دۆزرایەوە – چەند گرنگە؟",
  "The administrators are notified about every problem.": "بەڕێوەبەران دەربارەی هەموو کێشەیەک ئاگادار دەکرێنەوە.",
  "I checked this vehicle myself and the answers are correct.": "خۆم ئەم ئۆتۆمبێلەم پشکنیوە و وەڵامەکان دروستن.", "Submit checklist": "ناردنی پشکنین",
  "Choose OK, Problem or N/A": "باش، کێشە یان نایگرێتەوە هەڵبژێرە", "Write what is wrong": "بنووسە چی خراپە", "Please complete all checklist items": "تکایە هەموو خاڵەکانی پشکنین تەواو بکە",
  "Checklist sent": "پشکنین نێردرا", "Checklist sent – the administrators have been told about the problems": "پشکنین نێردرا – بەڕێوەبەران دەربارەی کێشەکان ئاگادارکرانەوە",
  "This week's checklist is done": "پشکنینی ئەم هەفتەیە کراوە", "Driver": "شۆفێر", "Submitted": "نێردراو", "Safety": "سەلامەتی", "Maintenance": "چاککردنەوە و چاودێری",
  "Needs attention": "پێویستی بە چاککردنە",
  "Tyres – condition & pressure": "تایەکان – دۆخ و پەستان (با)", "Spare tyre, jack & wheel spanner": "تایەی یەدەگ، جەک و سپانەی تایە", "Brakes & handbrake": "بریک و هاندبریک",
  "Headlights, indicators & brake lights": "گڵۆپی پێشەوە، ئیشارەت و گڵۆپی بریک", "Horn": "هۆڕن", "Wipers & washer fluid": "ماسیحە و ئاوی شووشەشۆر", "Mirrors": "ئاوێنەکان",
  "Seat belts (all seats)": "پشتێنی سەلامەتی (هەموو کورسییەکان)", "Windscreen & windows": "شووشەی پێشەوە و پەنجەرەکان", "First-aid kit": "جانتای فریاکەوتنی سەرەتایی",
  "Fire extinguisher (charged, in date)": "ئاگرکوژێنەوە (پڕ و بەسەرنەچوو)", "Warning triangle & reflective vest": "سێگۆشەی ئاگاداری و جلی ڕەنگدانەوە",
  "Engine oil level": "ئاستی ڕۆنی ماتۆڕ", "Coolant level": "ئاستی ئاوی ڕادیەیتەر", "Brake fluid level": "ئاستی ڕۆنی بریک", "Battery condition": "دۆخی پاتری",
  "Fuel level": "ئاستی سووتەمەنی", "No dashboard warning lights": "هیچ گڵۆپێکی ئاگاداری لەسەر داشبۆرد نییە", "No leaks under the vehicle": "هیچ دزەیەک لە ژێر ئۆتۆمبێلەکەدا نییە",
  "Service date / mileage not overdue": "کاتی سێرڤیس / کیلۆمەتر تێنەپەڕیوە", "Cleanliness inside & outside": "پاکوخاوێنی ناوەوە و دەرەوە",
  "Registration & insurance documents in vehicle": "سەنەوی و بەڵگەنامەی بیمە لە ئۆتۆمبێلەکەدایە",

  // vehicles (admin)
  "Fleet": "ئۆتۆمبێلەکان", "Plate": "ژمارەی تابلۆ", "Now": "ئێستا", "Problems": "کێشەکان", "Checked": "پشکنراوە", "Not checked": "نەپشکنراوە",
  "Done": "کراوە", "Not done": "نەکراوە", "Sent": "نێردرا", "No drivers": "هیچ شۆفێرێک نییە",

  // users
  "Add user": "زیادکردنی بەکارهێنەر", "Edit user": "دەستکاریکردنی بەکارهێنەر", "Import CSV": "هێنانی CSV", "Email log": "تۆماری ئیمەیڵەکان",
  "Name, number, email, role…": "ناو، ژمارە، ئیمەیڵ، ڕۆڵ…", "No users found": "هیچ بەکارهێنەرێک نەدۆزرایەوە", "Has not signed in yet": "هێشتا نەچووەتە ژوورەوە",
  "Usual vehicle (drivers)": "ئۆتۆمبێلی هەمیشەیی (شۆفێران)", "New temporary password (optional)": "وشەی نهێنی کاتی نوێ (ئارەزوومەندانە)",
  "Temporary password (e.g. birthday DDMMYYYY)": "وشەی نهێنی کاتی (بۆ نموونە بەرواری لەدایکبوون DDMMYYYY)", "Account active": "هەژمار چالاکە",
  "This employee number already exists": "ئەم ژمارەی کارمەندە پێشتر هەیە", "This email is already used": "ئەم ئیمەیڵە پێشتر بەکارهاتووە",
  "You cannot remove your own administrator role": "ناتوانیت ڕۆڵی بەڕێوەبەری خۆت لابەریت", "User saved": "بەکارهێنەر پاشەکەوت کرا", "The file is empty.": "فایلەکە بەتاڵە.",
  "CSV must have the columns: employee_no, full_name, birth_date, email, role": "فایلی CSV دەبێت ئەم ستوونانەی تێدابێت: employee_no, full_name, birth_date, email, role",
  "No emails yet.": "هێشتا هیچ ئیمەیڵێک نییە.", "No recipients with an email address.": "هیچ وەرگرێک ئیمەیڵی نییە.", "To:": "بۆ:",
  "Approved / assigned": "پەسەندکراو / دیاریکراو", "Trip started": "گەشت دەستیپێکرد", "Delivery – please sign": "گەیاندن – تکایە واژۆ بکە",
  "Delivery confirmed": "گەیاندن پشتڕاستکرایەوە", "demo (not sent)": "تاقیکردنەوە (نەنێردراوە)", "queued": "لە ڕیزدایە", "sent": "نێردرا", "failed": "سەرکەوتوو نەبوو",

  // reports
  "Month": "مانگ", "Print / Save as PDF": "چاپکردن / پاشەکەوت وەک PDF", "Fleet monthly report": "ڕاپۆرتی مانگانەی ئۆتۆمبێلەکان", "Overview": "پوختە",
  "Drivers": "شۆفێران", "Departments": "بەشەکان", "Export": "دەرهێنان", "Trips done": "گەشتی تەواوبوو", "Passengers carried": "سەرنشینی گوازراوە",
  "Deliveries": "گەیاندنەکان", "Km driven": "کیلۆمەتری لێخوڕین", "Driving hours": "کاتژمێری لێخوڕین", "Average trip (hours)": "تێکڕای گەشت (کاتژمێر)",
  "Requests": "داواکارییەکان", "Guest requests": "داواکاری میوان", "On-time departures": "ڕۆیشتن لە کاتی خۆیدا", "Average approval time (hours)": "تێکڕای کاتی پەسەندکردن (کاتژمێر)",
  "Locations with GPS": "شوێنی تۆمارکراو بە GPS", "Weekly checklists done": "پشکنینی هەفتانەی کراو", "Problems fixed": "کێشەی چاککراو",
  "Rejected requests": "داواکاری ڕەتکراوە", "No data last month": "مانگی پێشوو زانیاری نییە", "Trips per day": "گەشت بەپێی ڕۆژ",
  "Requests by status": "داواکاری بەپێی دۆخ", "People or items": "کەس یان کەلوپەل", "Trips by weekday": "گەشت بەپێی ڕۆژی هەفتە",
  "Trips by departure hour": "گەشت بەپێی کاتژمێری ڕۆیشتن", "Top destinations": "زۆرترین شوێنی مەبەست", "Requests by department": "داواکاری بەپێی بەش",
  "Ref.": "ئاماژە", "Driver / vehicle": "شۆفێر / ئۆتۆمبێل", "Route, times & locations": "ڕێگا، کات و شوێنەکان", "Departure": "ڕۆیشتن", "Duration": "ماوە",
  "Km": "کم", "On time": "لە کاتی خۆیدا", "No trips done this month.": "ئەم مانگە هیچ گەشتێک تەواو نەبووە.", "Km per vehicle": "کیلۆمەتر بەپێی ئۆتۆمبێل",
  "How much each vehicle was used (% of days)": "هەر ئۆتۆمبێلێک چەند بەکارهاتووە (% ی ڕۆژەکان)", "Vehicle summary": "پوختەی ئۆتۆمبێلەکان",
  "Hours": "کاتژمێر", "Days used": "ڕۆژی بەکارهێنان", "Use %": "بەکارهێنان %", "Checklists": "پشکنینەکان", "Open now": "ئێستا کراوە",
  "Trips per driver": "گەشت بەپێی شۆفێر", "Driving hours per driver": "کاتژمێری لێخوڕین بەپێی شۆفێر", "Driver summary": "پوختەی شۆفێران",
  "On time %": "لە کاتی خۆیدا %", "Problems reported": "کێشەی ڕاپۆرتکراو", "Department summary": "پوختەی بەشەکان", "Done ": "تەواوبوو",
  "No requests this month.": "ئەم مانگە هیچ داواکارییەک نییە.", "Fixed": "چاککراو", "Average time to fix (hours)": "تێکڕای کاتی چاککردن (کاتژمێر)",
  "Problems by type": "کێشە بەپێی جۆر", "How serious": "ئاستی مەترسی", "Problems per vehicle": "کێشە بەپێی ئۆتۆمبێل", "All problems": "هەموو کێشەکان",
  "Time to fix": "کاتی چاککردن", "No vehicle problems this month.": "ئەم مانگە هیچ کێشەیەکی ئۆتۆمبێل نییە.", "No data for this month.": "هیچ زانیارییەک بۆ ئەم مانگە نییە.",
  "Raw data (CSV for Excel)": "زانیاری خاو (CSV بۆ Excel)", "Trips ": "گەشتەکان", "Locations & times": "شوێن و کاتەکان", "Passengers & signatures": "سەرنشینان و واژۆکان",
  "All requests": "هەموو داواکارییەکان", "Vehicle problems ": "کێشەکانی ئۆتۆمبێل", "Weekly checklists": "پشکنینە هەفتانەکان", "10 files downloaded": "10 فایل داگیرا",
  "Sun": "یەکشەممە", "Mon": "دووشەممە", "Tue": "سێشەممە", "Wed": "چوارشەممە", "Thu": "پێنجشەممە", "Fri": "هەینی", "Sat": "شەممە",
  "Toyota Hilux": "تۆیۆتا هیلۆکس", "Toyota RAV4": "تۆیۆتا ڕاڤ ٤", "Toyota Corolla Cross": "تۆیۆتا کرۆلا کرۆس", "Nissan Patrol": "نیسان پاتڕۆڵ",
};
const KUP = (k) => (Object.prototype.hasOwnProperty.call(KU, k) ? KU[k] : null);

const WEEKDAYS = ["یەکشەممە", "دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە"];
const MONTHS = ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمموز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"];
export const kuDate = (y, m, d, wd) => `${WEEKDAYS[wd]} ${d} ی ${MONTHS[m - 1]} ${y}`;
export const kuMonth = (y, m) => `${MONTHS[m - 1]} ${y}`;

const PATTERNS = [
  [/^Destination (\d+)$/, (m) => `شوێنی مەبەست ${m[1]}`],
  [/^Passenger (\d+)$/, (m) => `سەرنشین ${m[1]}`],
  [/^Remove destination (\d+)$/, (m) => `لابردنی شوێنی مەبەست ${m[1]}`],
  [/^Remove passenger (\d+)$/, (m) => `لابردنی سەرنشین ${m[1]}`],
  [/^Remove item (\d+)$/, (m) => `لابردنی کەلوپەل ${m[1]}`],
  [/^Item (\d+) (description|quantity)$/, (m) => `${m[2] === "description" ? "وەسفی" : "ژمارەی"} کەلوپەل ${m[1]}`],
  [/^Passenger (\d+) type$/, (m) => `جۆری سەرنشین ${m[1]}`],
  [/^Passenger (\d+): select the HRID employee \(or remove the empty passenger\)$/, (m) => `سەرنشین ${m[1]}: کارمەندی HRID هەڵبژێرە (یان سەرنشینە بەتاڵەکە لابەرە)`],
  [/^Passenger (\d+): enter the full name \(or remove the empty passenger\)$/, (m) => `سەرنشین ${m[1]}: ناوی تەواو بنووسە (یان سەرنشینە بەتاڵەکە لابەرە)`],
  [/^Item (\d+): enter a description \(or remove the empty item\)$/, (m) => `کەلوپەل ${m[1]}: وەسفێک بنووسە (یان کەلوپەلە بەتاڵەکە لابەرە)`],
  [/^Item (\d+): quantity must be 1–999$/, (m) => `کەلوپەل ${m[1]}: ژمارە دەبێت 1 تا 999 بێت`],
  [/^(.+) is listed more than once$/, (m) => `${m[1]} زیاتر لە جارێک نووسراوە`],
  [/^Total passengers: (\d+)$/, (m) => `کۆی سەرنشینان: ${m[1]}`],
  [/^Passengers \((\d+)\)$/, (m) => `سەرنشینان (${m[1]})`],
  [/^(\d+) passenger\(s\)$/, (m) => `${m[1]} سەرنشین`],
  [/^(\d+) item\(s\)$/, (m) => `${m[1]} کەلوپەل`],
  [/^(.+) – sign with your finger\.$/, (m) => `${m[1]} – بە پەنجە واژۆ بکە.`],
  [/^Entered by (.+)$/, (m) => `تۆمارکرا لەلایەن ${m[1]}`],
  [/^Departed from (.+)$/, (m) => `ڕۆیشت لە ${m[1]}`],
  [/^Arrived at (.+)$/, (m) => `گەیشتە ${m[1]}`],
  [/^Back at (.+)$/, (m) => `گەڕایەوە بۆ ${m[1]}`],
  [/^Departed (.+)$/, (m) => `ڕۆیشت ${m[1]}`],
  [/^Arrived (.+)$/, (m) => `گەیشت ${m[1]}`],
  [/^Signed (.+)$/, (m) => `واژۆکرا ${m[1]}`],
  [/^(.+) signed$/, (m) => `${m[1]} واژۆی کرد`],
  [/^Delivery confirmed by (.+)$/, (m) => `${m[1]} گەیاندنی پشتڕاستکردەوە`],
  [/^Next: (.+)$/, (m) => `داهاتوو: ${m[1]}`],
  [/^Week of (.+)$/, (m) => `هەفتەی ${m[1]}`],
  [/^Checklist – (.+)$/, (m) => `پشکنین – ${tr(m[1])}`],
  [/^Weekly checklists \(from (.+)\)$/, (m) => `پشکنینی هەفتانە (لە ${m[1]}ەوە)`],
  [/^Request approved and assigned to (.+)$/, (m) => `داواکاری پەسەندکرا و درا بە ${m[1]}`],
  [/^Approved – (.+) has been notified$/, (m) => `پەسەندکرا – ${m[1]} ئاگادارکرایەوە`],
  [/^Delivery finished – (.+) has been asked to sign$/, (m) => `گەیاندن تەواو بوو – داوا لە ${m[1]} کرا واژۆ بکات`],
  [/^(.+) already has a trip at this time: (.+)$/, (m) => `${m[1]} لەم کاتەدا گەشتێکی تری هەیە: ${m[2]}`],
  [/^(.+) is already booked at this time\.$/, (m) => `${tr(m[1])} لەم کاتەدا پێشتر گیراوە.`],
  [/^(.+) has open problems: (.+)$/, (m) => `${tr(m[1])} کێشەی کراوەی هەیە: ${m[2]}`],
  [/^(\d+) vehicle\(s\) reported unsafe$/, (m) => `${m[1]} ئۆتۆمبێل وەک مەترسیدار ڕاپۆرت کراوە`],
  [/^(\d+) of (\d+) users · (\d+) admins · (\d+) drivers$/, (m) => `${m[1]} لە ${m[2]} بەکارهێنەر · ${m[3]} بەڕێوەبەر · ${m[4]} شۆفێر`],
  [/^All trips done \((\d+)\)$/, (m) => `هەموو گەشتە تەواوبووەکان (${m[1]})`],
  [/^(.+) \((\d+)\)$/, (m) => (KUP(m[1]) ? `${KUP(m[1])} (${m[2]})` : null)],
  [/^(.+): (\d+)$/, (m) => (KUP(m[1]) ? `${KUP(m[1])}: ${m[2]}` : null)],
  [/^(.+):$/, (m) => (KUP(m[1]) ? `${KUP(m[1])}:` : null)],
  [/^(\d+) row\(s\) exported$/, (m) => `${m[1]} ڕیز دەرهێنرا`],
  [/^([▲▼=]) ([\d.]+)(.*) vs last month$/, (m) => `${m[1]} ${m[2]}${m[3].replace(" km", " کم")} بەراورد بە مانگی پێشوو`],
  [/^\+(\d+) min$/, (m) => `+${m[1]} خولەک`],
  [/^(\d+(?:\.\d+)?) km$/, (m) => `${m[1]} کم`],
  [/^(\d+(?:\.\d+)?) h$/, (m) => `${m[1]} کاتژمێر`],
  [/^On time = left no more than (\d+) minutes after the planned time\.$/, (m) => `لە کاتی خۆیدا = زیاتر لە ${m[1]} خولەک دوای کاتی دیاریکراو نەڕۆیشتووە.`],
  [/^(.+) – opens in Excel, Kurdish text included\.$/, (m) => `${m[1]} – لە Excel دەکرێتەوە، دەقی کوردیش.`],
  [/^Download everything \((\d+) files\)$/, (m) => `داگرتنی هەمووی (${m[1]} فایل)`],
  [/^Import finished: (\d+) added, (\d+) updated \(existing passwords kept\)(.*)\.$/s, (m) => `هێنان تەواو بوو: ${m[1]} زیادکرا، ${m[2]} نوێکرایەوە${m[3] ? "، " + m[3] : ""}.`],
];
const MODELS = ["Toyota Corolla Cross", "Toyota Hilux", "Toyota RAV4", "Nissan Patrol"];
const SUBS = [[/ → /g, " ← "], [/(\d+) passenger\(s\)/g, "$1 سەرنشین"], [/(\d+) item\(s\)/g, "$1 کەلوپەل"], [/ – return /g, " – گەڕانەوە "], [/ km\b/g, " کم"], [/\+(\d+) more/g, "+$1 ی تر"], ...MODELS.map((m) => [new RegExp(m, "g"), KU[m]])];

export function tr(s) {
  if (!IS_KU || s == null) return s;
  const str = String(s), core = str.trim();
  if (!core || !/[A-Za-z]/.test(core)) return str.replace(/ → /g, " ← ");
  const i = str.indexOf(core);
  return str.slice(0, i) + trCore(core) + str.slice(i + core.length);
}
function trCore(core) {
  const k = KUP(core); if (k != null) return k;
  for (const [re, fn] of PATTERNS) { const m = core.match(re); if (m) { const r = fn(m); if (r != null) return r; } }
  if (core.includes(" · ")) return core.split(" · ").map((p) => KUP(p) ?? trSeg(p)).join(" · ");
  return trSeg(core);
}
function trSeg(p) {
  for (const [re, fn] of PATTERNS) { const m = p.match(re); if (m) { const r = fn(m); if (r != null) return r; } }
  let out = p; for (const [re, rep] of SUBS) out = out.replace(re, rep); return out;
}

/* ---------------- DOM translation ---------------- */
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "IFRAME", "CODE"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt"];
const trAttrs = (el) => { for (const a of ATTRS) if (el.hasAttribute?.(a)) { const v = el.getAttribute(a), t = tr(v); if (t !== v) el.setAttribute(a, t); } };
function translateText(node) {
  const p = node.parentNode;
  if (!p || SKIP.has(p.nodeName) || p.closest?.("[data-no-tr]")) return;
  const v = node.nodeValue, t = tr(v);
  if (t !== v) node.nodeValue = t;
}
function translateTree(root) {
  if (root.nodeType === 3) return translateText(root);
  if (root.nodeType !== 1 || root.closest?.("[data-no-tr]")) return;
  trAttrs(root);
  if (SKIP.has(root.nodeName)) return;
  root.querySelectorAll?.("textarea").forEach(trAttrs);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.nodeName) || n.hasAttribute("data-no-tr")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  let n; while ((n = w.nextNode())) n.nodeType === 3 ? translateText(n) : trAttrs(n);
}
export function langButton(extra = "") {
  return `<button type="button" class="lang-btn ${extra}" data-lang-toggle data-no-tr lang="${IS_KU ? "en" : "ckb"}" aria-label="${IS_KU ? "Switch to English" : "گۆڕین بۆ کوردی"}">${IS_KU ? "English" : "کوردی"}</button>`;
}
document.documentElement.lang = IS_KU ? "ckb" : "en";
document.documentElement.dir = IS_KU ? "rtl" : "ltr";
document.addEventListener("click", (e) => { if (e.target.closest?.("[data-lang-toggle]")) { try { localStorage.setItem(KEY, IS_KU ? "en" : "ku"); } catch { /* */ } location.reload(); } });
if (IS_KU) {
  const a = window.alert.bind(window), c = window.confirm.bind(window);
  window.alert = (m) => a(tr(m)); window.confirm = (m) => c(tr(m));
  const start = () => {
    translateTree(document.body);
    new MutationObserver((list) => { for (const m of list) { if (m.type === "characterData") translateText(m.target); else if (m.type === "attributes") trAttrs(m.target); else m.addedNodes.forEach(translateTree); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  document.body ? start() : document.addEventListener("DOMContentLoaded", start);
}
