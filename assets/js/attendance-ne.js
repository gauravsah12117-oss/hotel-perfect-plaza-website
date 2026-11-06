/* attendance.html in Nepali: every word of the app, for the English ⇄ नेपाली
   button. attendance.js calls HPP_NE.translate(node) on the page and on
   everything it draws afterwards, and HPP_NE.tr(text) for its pop-up
   questions. To improve a translation, change the Nepali on the right.

   W         whole phrases, exactly as the English shows them
   PATTERNS  phrases with a name or a number in them
   BLOCKS    the longer instructions (data-ne="…" in attendance.html)
   inline()  what's left inside other text: times (दिउँसो 1:24), hours and
             minutes, days and months, Rs */

window.HPP_NE = (function () {
  "use strict";

  const W = {
    /* sign in */
    "Staff Attendance": "कर्मचारी हाजिरी",
    "For the owner and management. Staff sign in and out on the fingerprint machine at the staff entrance.": "मालिक र व्यवस्थापनका लागि। कर्मचारीहरू आउँदा र जाँदा कर्मचारी ढोकामा रहेको फिंगरप्रिन्ट मेसिनमा औँला लगाउँछन्।",
    "Password": "पासवर्ड",
    "Keep me signed in on this phone": "यो फोनमा साइन इन भइरहोस्",
    "Sign in": "साइन इन गर्नुहोस्",
    "Ramanand Chowk, Janakpurdham": "रामानन्द चोक, जनकपुरधाम",
    "Hotel Perfect Plaza, Janakpurdham · +977-41-590911": "होटल पर्फेक्ट प्लाजा, जनकपुरधाम · +977-41-590911",
    "Hotel Perfect Plaza, Janakpurdham": "होटल पर्फेक्ट प्लाजा, जनकपुरधाम",
    "Hotel Perfect Plaza": "होटल पर्फेक्ट प्लाजा",
    "Janakpurdham": "जनकपुरधाम",
    "Wrong password.": "पासवर्ड मिलेन।",
    "Signed out: the password was changed. Sign in with the new one.": "पासवर्ड फेरिएकाले साइन आउट भयो। नयाँ पासवर्डले साइन इन गर्नुहोस्।",
    "Attendance isn't set up yet: ATTENDANCE_PASSWORD or the database is missing in Vercel.": "हाजिरी प्रणाली अझै मिलाइएको छैन: Vercel मा ATTENDANCE_PASSWORD वा डाटाबेस छैन।",
    "No internet. Connect and try again.": "इन्टरनेट छैन। जोडेर फेरि प्रयास गर्नुहोस्।",
    "No internet on this phone. What you see may be out of date; it updates once you're back online.": "यो फोनमा इन्टरनेट छैन। देखिएको कुरा पुरानो हुन सक्छ; इन्टरनेट आएपछि आफैँ अद्यावधिक हुन्छ।",

    /* the sections */
    "Today": "आज", "Month": "महिना", "Punches": "रेकर्ड", "Staff": "कर्मचारी", "Leave": "बिदा", "Settings": "सेटिङ",
    "Daily attendance": "दैनिक हाजिरी", "Monthly report": "मासिक प्रतिवेदन", "Leave and holidays": "बिदा र पर्व",
    "Install the app": "एप इन्स्टल गर्नुहोस्", "Sign out": "साइन आउट", "Sign out of this phone": "यो फोनबाट साइन आउट",
    "Sections": "खण्डहरू",
    "Machine online": "मेसिन अनलाइन",
    "Namaste": "नमस्ते", "Good morning": "शुभ प्रभात", "Good afternoon": "नमस्कार", "Good evening": "शुभ सन्ध्या",

    /* today */
    "Still to set up": "मिलाउन बाँकी",
    "Open": "खोल्नुहोस्",
    "No fingerprint machine has connected yet. See \"How to connect the machine\".": "फिंगरप्रिन्ट मेसिन अझै जोडिएको छैन। “मेसिन कसरी जोड्ने” हेर्नुहोस्।",
    "No phone gets a notification when someone punches yet. Settings → Turn on notifications, on your father's phone.": "कसैले औँला लगाउँदा अझै कुनै फोनमा सूचना आउँदैन। बुबाको फोनमा: सेटिङ → सूचना खोल्नुहोस्।",
    "Notifications aren't set up on the website yet.": "वेबसाइटमा सूचना अझै मिलाइएको छैन।",
    "The machine's clock is fast. Set the right time on the machine (Menu → System → Date Time).": "मेसिनको घडी छिटो छ। मेसिनमा सही समय मिलाउनुहोस् (Menu → System → Date Time)।",
    "Day before": "अघिल्लो दिन", "Day after": "पछिल्लो दिन", "Date": "मिति",
    "Came today": "आज आएका", "Came": "आएका", "In the hotel now": "अहिले होटलमा", "Late": "ढिलो",
    "Not come": "नआएका", "Absent": "अनुपस्थित", "Overtime": "ओभरटाइम", "Everyone": "सबै जना", "No staff yet": "कर्मचारी छैनन्",
    "Who came, and when": "को कति बेला आयो", "Updates by itself every 30 seconds": "हरेक 30 सेकेन्डमा आफैँ अद्यावधिक हुन्छ",
    "Shift": "सिफ्ट", "At work": "काममा", "Now": "अहिले", "Added by hand": "हातैले थपिएको",
    "midnight": "मध्यरात", "noon": "मध्यान्ह",
    "No staff yet. Add them in Staff, or they appear here after their first punch.": "कर्मचारी छैनन्। ‘कर्मचारी’ मा थप्नुहोस्, वा पहिलो पटक औँला लगाएपछि आफैँ यहाँ देखिन्छन्।",
    "In now": "भित्र छन्", "Present": "उपस्थित", "Half day": "आधा दिन", "Paid leave": "तलबी बिदा", "Sick leave": "बिरामी बिदा",
    "Unpaid leave": "बेतलबी बिदा", "Day off": "साप्ताहिक बिदा", "Not yet due": "समय भएको छैन", "Not joined": "भर्ना भएको छैन",
    "Worked on day off": "बिदाको दिन काम", "No punch out": "जाँदा औँला छैन", "by hand": "हातैले",
    "Not come yet": "अझै आएका छैनन्", "On leave": "बिदामा", "Not joined yet": "भर्ना भएको छैन",
    "just arrived": "भर्खर आए", "no time worked": "काम गरेको समय छैन", "no punch out": "जाँदा औँला छैन",
    "still in": "अझै भित्र", "now": "अहिले",

    /* month */
    "From": "देखि", "To": "सम्म", "Register": "हाजिरी रजिस्टर", "Nepali month": "नेपाली महिना", "Nepali year": "नेपाली वर्ष",
    "present": "उपस्थित", "late": "ढिलो", "half day": "आधा दिन", "absent": "अनुपस्थित", "leave": "बिदा", "day off": "साप्ताहिक बिदा", "holiday": "पर्व बिदा",
    "Su": "आ", "Mo": "सो", "Tu": "मं", "We": "बु", "Th": "बि", "Fr": "शु", "Sa": "श",
    "No staff yet.": "कर्मचारी छैनन्।",
    "Totals and pay": "जम्मा र तलब", "Download for Excel": "एक्सेलका लागि डाउनलोड", "Print": "प्रिन्ट",
    "Off & holidays": "बिदा र पर्व", "Late (times)": "ढिलो (पटक)", "Late (total)": "ढिलो (जम्मा)", "Hours worked": "काम गरेको घण्टा",
    "Overtime (h)": "ओभरटाइम (घण्टा)", "Overtime pay": "ओभरटाइम रकम", "Unpaid days": "बेतलबी दिन", "Salary": "तलब", "Pay": "पाउने रकम", "Total": "जम्मा",
    "Pay = monthly salary − unpaid days × day rate (salary ÷ 30) + overtime pay. Absent, unpaid leave, half a day for a half day, and days before someone joined are unpaid. Days still to come aren't counted. Tap a name to see every day.":
      "पाउने रकम = मासिक तलब − बेतलबी दिन × दैनिक दर (तलब ÷ 30) + ओभरटाइम रकम। अनुपस्थित, बेतलबी बिदा, आधा दिनको आधा, र भर्ना हुनुअघिका दिन बेतलबी हुन्छन्। आउन बाँकी दिन गनिँदैनन्। हरेक दिन हेर्न नाममा थिच्नुहोस्।",
    "Close": "बन्द गर्नुहोस्", "In": "आएको", "Out": "गएको", "Worked": "काम", "Left early": "चाँडै गएको",
    "See every day": "हरेक दिन हेर्नुहोस्",

    /* punches */
    "Add a forgotten punch": "छुटेको हाजिरी थप्नुहोस्",
    "When someone forgot to put their finger on the machine. It shows as \"by hand\" everywhere, so it can always be told apart.": "कसैले मेसिनमा औँला लगाउन बिर्सेमा। यो जताततै “हातैले” भनेर देखिन्छ, त्यसैले सधैँ छुट्याउन सकिन्छ।",
    "Time": "समय", "Why": "किन", "e.g. forgot when leaving, told the manager": "जस्तै: जाँदा बिर्से, म्यानेजरलाई भने",
    "Add punch": "हाजिरी थप्नुहोस्", "Every punch": "सबै हाजिरी", "Choose…": "छान्नुहोस्…",
    "Exactly what the machine recorded. \"Leave out\" takes a wrong punch out of the sums without deleting it.": "मेसिनले जस्तो रेकर्ड गर्‍यो, ठ्याक्कै त्यस्तै। “हिसाबबाट हटाउनुहोस्” ले गलत हाजिरीलाई नमेटिकन हिसाबबाट हटाउँछ।",
    "When": "कहिले", "How": "कसरी", "Note": "टिप्पणी",
    "Fingerprint": "औँला", "Card": "कार्ड", "Face": "अनुहार", "Palm": "हत्केला", "Machine": "मेसिन",
    "Put back": "फिर्ता राख्नुहोस्", "Leave out": "हिसाबबाट हटाउनुहोस्", "Delete": "मेट्नुहोस्",
    "Delete this punch added by hand?": "हातैले थपिएको यो हाजिरी मेट्ने?",
    "Left out of the sums": "हिसाबबाट हटाइएको",
    "Showing the latest 3,000. Choose fewer days to see the rest.": "पछिल्ला 3,000 मात्र देखाइएको छ। बाँकी हेर्न थोरै दिन छान्नुहोस्।",
    "Added.": "थपियो।", "Saved.": "सेभ भयो।",

    /* staff */
    "Add staff": "कर्मचारी थप्नुहोस्",
    "\"Machine no.\" is the user ID the person was given when their finger was enrolled on the machine. Anyone who punches before being added here appears as \"Staff #\" and their number: fill in their name here.":
      "“मेसिन नं.” भनेको मेसिनमा औँला दर्ता गर्दा त्यो व्यक्तिलाई दिइएको नम्बर हो। यहाँ थप्नुअघि नै औँला लगाउने व्यक्ति “कर्मचारी #” र नम्बरमा देखिन्छन्: उनको नाम यहाँ भर्नुहोस्।",
    "Machine no.": "मेसिन नं.", "Name": "नाम", "Job": "काम", "e.g. Kitchen, Reception": "जस्तै: भान्सा, रिसेप्सन", "Phone": "फोन",
    "Shift starts": "सिफ्ट सुरु", "Shift ends": "सिफ्ट सकिने", "Weekly day off": "साप्ताहिक बिदा", "None": "छैन",
    "Joined": "भर्ना मिति", "Monthly salary (NPR)": "मासिक तलब (रु)", "Overtime per hour (NPR)": "प्रति घण्टा ओभरटाइम (रु)", "from salary": "तलबबाट",
    "Notify when this person punches": "यो व्यक्तिले औँला लगाउँदा सूचना पठाउने", "Still working here": "अझै यहाँ काम गर्छन्",
    "Leave the shift empty to use the hotel's usual hours (Settings). If overtime per hour is empty, it is worked out from the salary × the overtime rate in Settings.":
      "होटलको सामान्य समय (सेटिङ) प्रयोग गर्न सिफ्ट खाली छोड्नुहोस्। प्रति घण्टा ओभरटाइम खाली भए तलब × सेटिङको ओभरटाइम दरबाट हिसाब हुन्छ।",
    "Save": "सेभ गर्नुहोस्", "New person": "नयाँ व्यक्ति",
    "No.": "नं.", "Messages": "सूचना", "No name yet": "नाम छैन", "usual hours": "सामान्य समय", "On": "खुला", "Off": "बन्द", "Left": "छोडिसके", "Edit": "सम्पादन",

    /* leave */
    "Kind": "किसिम", "Sick leave (paid)": "बिरामी बिदा (तलबी)", "Remove leave": "बिदा हटाउनुहोस्", "Save leave": "बिदा सेभ गर्नुहोस्",
    "Holidays for everyone": "सबैका लागि पर्व बिदा",
    "Dashain, Tihar, Chhath… A holiday is paid; anyone who works on it gets the whole day as overtime.": "दशैँ, तिहार, छठ… पर्व बिदा तलबी हुन्छ; त्यो दिन काम गर्नेले पूरै दिन ओभरटाइम पाउँछन्।",
    "e.g. Tihar": "जस्तै: तिहार", "Add holiday": "पर्व बिदा थप्नुहोस्", "Booked": "राखिएका बिदा", "Holidays": "पर्व बिदा", "Holiday": "पर्व",
    "Remove": "हटाउनुहोस्", "Leave removed.": "बिदा हटाइयो।",

    /* settings */
    "Notifications on this phone": "यो फोनमा सूचना",
    "A notification the moment someone puts their finger on the machine: who, what time, and if they're late. Free; turn it on once on each phone that should get them.":
      "कसैले मेसिनमा औँला लगाउने बित्तिकै सूचना: को, कति बजे, र ढिलो भए कति। निःशुल्क; सूचना चाहिने हरेक फोनमा एक पटक खोल्नुहोस्।",
    "App notifications aren't switched on for the hotel's website yet.": "होटलको वेबसाइटमा एप सूचना अझै खोलिएको छैन।",
    "On iPhone: first put this app on the home screen (\"The app on a phone\" above), open it from there, then come back here.": "आईफोनमा: पहिले यो एपलाई होम स्क्रिनमा राख्नुहोस् (माथिको “फोनमा एप”), त्यहीँबाट खोल्नुहोस्, अनि यहाँ फर्कनुहोस्।",
    "This browser can't show notifications. Open the page in Chrome (Android) or Safari (iPhone).": "यो ब्राउजरले सूचना देखाउन सक्दैन। Chrome (एन्ड्रोइड) वा Safari (आईफोन) मा खोल्नुहोस्।",
    "Notifications are blocked for this app. Allow them in the phone's settings (Settings → Apps or Notifications → हाजिरी or Chrome), then come back.": "यो एपका सूचना रोकिएका छन्। फोनको सेटिङमा अनुमति दिनुहोस् (Settings → Apps वा Notifications → हाजिरी वा Chrome), अनि फर्कनुहोस्।",
    "On: this phone gets a notification every time someone punches.": "खुला: कसैले औँला लगाउँदा यो फोनमा सूचना आउँछ।",
    "Off on this phone.": "यो फोनमा बन्द छ।",
    "Turn on notifications": "सूचना खोल्नुहोस्", "Turn off on this phone": "यो फोनमा बन्द गर्नुहोस्", "Send a test": "परीक्षण पठाउनुहोस्",
    "Phones that get notifications": "सूचना आउने फोनहरू", "Turned on": "खोलेको मिति", "Last notification": "पछिल्लो सूचना", "this phone": "यो फोन",
    "Whose phone is this? (e.g. Father's phone)": "यो कसको फोन हो? (जस्तै: बुबाको फोन)",
    "Notifications weren't allowed. Press the button again and choose Allow.": "सूचनाको अनुमति दिइएन। बटन फेरि थिचेर Allow छान्नुहोस्।",
    "Couldn't turn them on. Try again.": "खोल्न सकिएन। फेरि प्रयास गर्नुहोस्।",
    "Turned on. Press \"Send a test\" to see one.": "खुल्यो। एउटा हेर्न “परीक्षण पठाउनुहोस्” थिच्नुहोस्।",
    "Turned off on this phone.": "यो फोनमा बन्द भयो।",
    "No phone to send to yet.": "पठाउने फोन अझै छैन।",
    "The app on a phone": "फोनमा एप",
    "This is the app: it's on this phone's home screen, and opens signed in.": "यही एप हो: यो फोनको होम स्क्रिनमा छ, र साइन इन भएरै खुल्छ।",
    "Then open it from the home screen and turn on notifications above.": "त्यसपछि होम स्क्रिनबाट खोलेर माथि सूचना खोल्नुहोस्।",
    "Install the app on this device": "यो उपकरणमा एप इन्स्टल गर्नुहोस्",
    "Fingerprint machines": "फिंगरप्रिन्ट मेसिन", "Machine (serial no.)": "मेसिन (सिरियल नं.)", "Status": "अवस्था",
    "Last connected": "पछिल्लो पटक जोडिएको", "Clock": "घडी", "Offline": "अफलाइन", "Online": "अनलाइन",
    "Waiting for approval": "स्वीकृति कुर्दै", "OK": "ठीक", "Stop": "रोक्नुहोस्", "Approve": "स्वीकृत गर्नुहोस्",
    "Stop taking punches from this machine?": "यो मेसिनबाट हाजिरी लिन बन्द गर्ने?",
    "A name for this machine (e.g. Staff entrance)": "यो मेसिनको नाम (जस्तै: कर्मचारी ढोका)",
    "Remove this machine from the list? It will appear again, waiting for approval, the next time it connects.": "यो मेसिन सूचीबाट हटाउने? अर्को पटक जोडिँदा फेरि स्वीकृति कुर्दै देखिन्छ।",
    "No machine has connected yet. Follow \"How to connect the machine\" below; it appears here within a minute.": "अझै कुनै मेसिन जोडिएको छैन। तलको “मेसिन कसरी जोड्ने” अनुसार गर्नुहोस्; एक मिनेटभित्र यहाँ देखिन्छ।",
    "How to connect the machine": "मेसिन कसरी जोड्ने",
    "The hotel's rules, and what gets notified": "होटलका नियम, र के-के सूचना आउँछ",
    "Notify when someone arrives": "कोही आउँदा सूचना", "Notify when someone leaves or comes back": "कोही जाँदा वा फर्कंदा सूचना",
    "The day's summary at about 9 pm": "राति करिब 9 बजे दिनभरको सारांश",
    "Language of the notifications": "सूचनाको भाषा",
    "Usual shift starts": "सामान्य सिफ्ट सुरु", "Usual shift ends": "सामान्य सिफ्ट सकिने",
    "Late after (minutes)": "यति मिनेटपछि ढिलो", "Overtime counts from (minutes)": "यति मिनेटदेखि ओभरटाइम",
    "Overtime rate (× hourly pay)": "ओभरटाइम दर (× प्रति घण्टा तलब)",
    "\"Late after 10\" means 9:10 is on time and 9:11 is 11 minutes late. \"Overtime from 30\" means staying 20 minutes extra isn't overtime, and 45 minutes is.":
      "“10 मिनेटपछि ढिलो” भनेको 9:10 समयमै हो र 9:11 मा 11 मिनेट ढिलो। “30 मिनेटदेखि ओभरटाइम” भनेको 20 मिनेट बढी बस्नु ओभरटाइम होइन, 45 मिनेट हो।",
    "Backup": "ब्याकअप",
    "A copy of every record on this device: the staff, their leave, the holidays, the settings and a year's punches. Download one every few months and keep it safe (email it to yourself, or a pen drive).":
      "सबै रेकर्डको प्रति यो उपकरणमा: कर्मचारी, उनीहरूको बिदा, पर्व बिदा, सेटिङ र एक वर्षको हाजिरी। केही महिनामा एक पटक डाउनलोड गरेर सुरक्षित राख्नुहोस् (आफैँलाई इमेल, वा पेन ड्राइभ)।",
    "Year": "वर्ष", "Download backup": "ब्याकअप डाउनलोड", "Preparing…": "तयार हुँदैछ…",
    "Telegram messages": "टेलिग्राम सन्देश", "optional": "ऐच्छिक",
    "Not needed: the app's own notifications above do the same. Only if someone prefers the messages in Telegram.": "आवश्यक छैन: माथिका एपका आफ्नै सूचनाले यही काम गर्छन्। कसैलाई टेलिग्राममै सन्देश चाहिएमा मात्र।",
    "Not in use. To use it: create a bot with @BotFather in Telegram and add its token in Vercel as TELEGRAM_BOT_TOKEN (ATTENDANCE.md).": "प्रयोगमा छैन। प्रयोग गर्न: टेलिग्राममा @BotFather बाट बोट बनाएर त्यसको टोकन Vercel मा TELEGRAM_BOT_TOKEN को रूपमा राख्नुहोस् (ATTENDANCE.md)।",
    "Bot:": "बोट:", "(couldn't reach Telegram)": "(टेलिग्राम पुग्न सकिएन)",
    ". Every phone below gets a message the moment someone punches.": "। तलका हरेक फोनमा कसैले औँला लगाउने बित्तिकै सन्देश आउँछ।",
    "Add a phone": "फोन थप्नुहोस्", "Send a test message": "परीक्षण सन्देश पठाउनुहोस्", "Copy": "कपी", "Check now": "अहिले जाँच्नुहोस्",
    "It works once, within an hour. After pressing Start, the phone appears in the list below.": "यो एक घण्टाभित्र एक पटक मात्र चल्छ। Start थिचेपछि फोन तलको सूचीमा देखिन्छ।",
    "Making a link…": "लिङ्क बनाउँदै…", "Link copied.": "लिङ्क कपी भयो।", "Couldn't copy. Press and hold the link instead.": "कपी भएन। बरु लिङ्कमा थिचिरहनुहोस्।",
    "Phone (Telegram name)": "फोन (टेलिग्राम नाम)", "Added": "थपेको", "Gets messages": "सन्देश आउँछ", "Paused": "रोकिएको",
    "Pause": "रोक्नुहोस्", "Resume": "फेरि सुरु गर्नुहोस्",

    /* the roster */
    "Weekly roster": "साप्ताहिक रोस्टर", "Week before": "अघिल्लो हप्ता", "Week after": "अर्को हप्ता", "Copy last week": "गएको हप्ता जस्तै",
    "Who works which shift each day. \"Usual\" is the person's own shift (below). Lateness and overtime follow the shift chosen here. The shifts themselves are set in Settings.":
      "हरेक दिन को कुन सिफ्टमा काम गर्छ। “सामान्य” भनेको त्यो व्यक्तिको आफ्नै सिफ्ट हो (तल)। ढिलो र ओभरटाइम यहाँ छानेको सिफ्ट अनुसार हुन्छ। सिफ्टहरू सेटिङमा मिलाइन्छन्।",
    "Usual": "सामान्य", "Usual: day off": "सामान्य: बिदा",
    "Copy last week's roster into this week? This week's choices are replaced.": "गएको हप्ताको रोस्टर यो हप्तामा सार्ने? यो हप्ताको छनोट बदलिन्छ।",
    "Copied.": "सारियो।", "Morning": "बिहान", "Day": "दिन", "Evening": "बेलुका", "Night": "राति",
    "Shifts for the roster": "रोस्टरका सिफ्टहरू", "Add a shift": "सिफ्ट थप्नुहोस्", "Shift name": "सिफ्टको नाम", "Starts": "सुरु", "Ends": "सकिने",
    "SSF from salary (%)": "तलबबाट SSF (%)", "SSF paid by the hotel (%)": "होटलले तिर्ने SSF (%)",
    "In the Social Security Fund (SSF)": "सामाजिक सुरक्षा कोष (SSF) मा आबद्ध", "SSF": "SSF", "Yes": "छ",

    /* payslips */
    "Payslip": "तलब पर्ची", "Print payslip": "तलब पर्ची प्रिन्ट", "Print all payslips": "सबै तलब पर्ची प्रिन्ट",
    "Added": "थपिएको", "Taken off": "कटाइएको",
    "Advances, bonuses and deductions this month": "यो महिनाको पेस्की, बोनस र कट्टी",
    "Salary advance (taken off)": "तलब पेस्की (कटाइने)", "Bonus (added)": "बोनस (थपिने)", "Allowance (added)": "भत्ता (थपिने)",
    "Tax (taken off)": "कर (कटाइने)", "Other deduction (taken off)": "अन्य कट्टी (कटाइने)",
    "Salary advance": "तलब पेस्की", "Bonus": "बोनस", "Allowance": "भत्ता", "Tax": "कर", "Other deduction": "अन्य कट्टी", "Other deductions": "अन्य कट्टी",
    "Amount (NPR)": "रकम (रु)", "Amount": "रकम", "e.g. advance for Dashain": "जस्तै: दशैँ पेस्की", "Add": "थप्नुहोस्",
    "Remove this entry?": "यो हटाउने?", "Nothing this month.": "यो महिना केही छैन।", "Choose what kind it is.": "किसिम छान्नुहोस्।",
    "Monthly salary": "मासिक तलब", "Days": "दिन", "Half days": "आधा दिन", "Days off & holidays": "बिदा र पर्व",
    "Earnings": "आम्दानी", "Deductions": "कट्टी", "Basic salary": "आधारभूत तलब", "Total earnings": "जम्मा आम्दानी", "Total deductions": "जम्मा कट्टी",
    "Net pay": "खुद तलब", "Received by": "बुझ्नेको सही", "For Hotel Perfect Plaza": "होटल पर्फेक्ट प्लाजाको तर्फबाट",
    "SSF paid by the hotel, on top of this pay": "यो तलबबाहेक होटलले तिर्ने SSF",
    "How to connect the machine: Hikvision": "मेसिन कसरी जोड्ने: Hikvision", "How to connect the machine: ZKTeco or eSSL": "मेसिन कसरी जोड्ने: ZKTeco वा eSSL",

    /* for the owner's father: the simple list, the person card, sharing, alerts */
    "How Today is shown": "आज कसरी देखाउने", "Simple": "सजिलो", "Timeline": "समयरेखा", "Share today": "आजको हाजिरी पठाउनुहोस्",
    "Not due yet": "अझै समय भएको छैन", "Gone home": "घर गए", "On leave or day off": "बिदा वा साप्ताहिक बिदामा",
    "Call": "फोन", "Quick actions": "छिटो काम", "On leave today": "आज बिदामा", "Add a forgotten punch today": "आजको छुटेको हाजिरी थप्नुहोस्",
    "Pay so far": "अहिलेसम्मको तलब", "added from the person card": "व्यक्तिको कार्डबाट थपिएको",
    "Copied. Paste it into WhatsApp or Viber.": "कपी भयो। WhatsApp वा Viber मा टाँस्नुहोस्।",
    "Notify when someone hasn't come": "कोही नआएमा सूचना", "…this many minutes after their shift starts": "…सिफ्ट सुरु भएको यति मिनेटपछि",
    "The month's summary on its last day": "महिनाको अन्तिम दिन महिनाभरिको सारांश",
    "Quiet hours from": "शान्त समय सुरु", "Quiet hours until": "शान्त समय सकिने",
    "No punch notifications during quiet hours (for example 22:00 to 06:00): the punches are still recorded, and the 9 pm summary still comes. Leave both empty for none.":
      "शान्त समयमा (जस्तै राति 22:00 देखि बिहान 06:00) हाजिरीको सूचना आउँदैन: हाजिरी भने रेकर्ड हुन्छ, र राति 9 बजेको सारांश आउँछ। नचाहिए दुवै खाली छोड्नुहोस्।",
    "Give both quiet-hours times, or leave both empty.": "शान्त समयका दुवै समय दिनुहोस्, वा दुवै खाली छोड्नुहोस्।",
    "On this phone": "यो फोनमा", "Only for this phone; each phone keeps its own.": "यो फोनका लागि मात्र; हरेक फोनको आफ्नै।",
    "Text size": "अक्षरको आकार", "Normal": "सामान्य", "Large": "ठूलो", "Extra large": "धेरै ठूलो",
    "Today shows": "आज देखाउने", "Simple list": "सजिलो सूची",

    /* errors (errText in attendance.js) */
    "Choose a staff member (or check the machine number).": "कर्मचारी छान्नुहोस् (वा मेसिन नम्बर जाँच्नुहोस्)।",
    "That date or time isn't right.": "मिति वा समय मिलेन।", "That time hasn't happened yet.": "त्यो समय अझै आएको छैन।",
    "There is already a punch at exactly that time.": "ठ्याक्कै त्यही समयमा हाजिरी पहिल्यै छ।",
    "Give both shift times, or leave both empty.": "सिफ्टका दुवै समय दिनुहोस्, वा दुवै खाली छोड्नुहोस्।",
    "Check the salary and overtime amounts.": "तलब र ओभरटाइम रकम जाँच्नुहोस्।",
    "Check the dates (at most 62 days at once).": "मिति जाँच्नुहोस् (एक पटकमा बढीमा 62 दिन)।",
    "TELEGRAM_BOT_TOKEN isn't set in Vercel yet (ATTENDANCE.md, step 2).": "Vercel मा TELEGRAM_BOT_TOKEN अझै राखिएको छैन (ATTENDANCE.md)।",
    "Turn on notifications on a phone first (Settings → Notifications on this phone).": "पहिले कुनै फोनमा सूचना खोल्नुहोस् (सेटिङ → यो फोनमा सूचना)।",
    "Telegram didn't accept the website's address. This only works on the real website, not on this computer.": "टेलिग्रामले वेबसाइटको ठेगाना स्वीकारेन। यो वास्तविक वेबसाइटमा मात्र चल्छ।",
    "Check the highlighted numbers.": "देखाइएका अङ्क जाँच्नुहोस्।",
    "Something went wrong. Try again.": "केही गडबड भयो। फेरि प्रयास गर्नुहोस्।",
    "Nothing here yet.": "अहिलेसम्म केही छैन।"
  };

  const LETTERS = { P: "उ", L: "ढि", A: "अ", Lv: "बि", H: "प" };
  const WEEK = { Sunday: "आइतबार", Monday: "सोमबार", Tuesday: "मंगलबार", Wednesday: "बुधबार", Thursday: "बिहीबार", Friday: "शुक्रबार", Saturday: "शनिबार" };
  const WK = { Sun: "आइत", Mon: "सोम", Tue: "मंगल", Wed: "बुध", Thu: "बिही", Fri: "शुक्र", Sat: "शनि" };
  const MONTH = { January: "जनवरी", February: "फेब्रुअरी", March: "मार्च", April: "अप्रिल", May: "मे", June: "जुन", July: "जुलाई",
    August: "अगस्ट", September: "सेप्टेम्बर", October: "अक्टोबर", November: "नोभेम्बर", December: "डिसेम्बर" };
  const BSM = { Baisakh: "बैशाख", Jestha: "जेठ", Asar: "असार", Shrawan: "साउन", Bhadra: "भदौ", Asoj: "असोज", Kartik: "कात्तिक",
    Mangsir: "मंसिर", Poush: "पुस", Magh: "माघ", Falgun: "फागुन", Chaitra: "चैत" };
  const MON = { Jan: "जनवरी", Feb: "फेब्रुअरी", Mar: "मार्च", Apr: "अप्रिल", Jun: "जुन", Jul: "जुलाई", Aug: "अगस्ट", Sep: "सेप्टेम्बर", Oct: "अक्टोबर", Nov: "नोभेम्बर", Dec: "डिसेम्बर" };
  const part = h => h < 4 ? "राति" : h < 12 ? "बिहान" : h < 16 ? "दिउँसो" : h < 20 ? "बेलुका" : "राति";
  const alt = o => new RegExp("\\b(" + Object.keys(o).join("|") + ")\\b", "g");

  function inline(s) {
    return s
      .replace(/\b(\d{1,2}):(\d{2}) (AM|PM)\b/g, (_, h, m, ap) => part(+h % 12 + (ap === "PM" ? 12 : 0)) + " " + h + ":" + m)
      .replace(/\b(\d+)h (\d+)m\b/g, "$1 घण्टा $2 मिनेट").replace(/\b(\d+)h\b/g, "$1 घण्टा").replace(/\b(\d+)m\b/g, "$1 मिनेट")
      .replace(alt(WEEK), w => WEEK[w]).replace(alt(MONTH), w => MONTH[w]).replace(alt(BSM), w => BSM[w])
      .replace(alt(WK), w => WK[w]).replace(alt(MON), w => MON[w])
      .replace(/\bRs\b/g, "रु").replace(/\(by hand\)/g, "(हातैले)").replace(/\b(\d+) on leave\b/g, "$1 जना बिदामा");
  }

  /* [pattern, (match) → Nepali] — tried in order, on the whole phrase */
  const PATTERNS = [
    [/^Today, (.+)$/, m => "आज, " + inline(m[1])],
    [/^Machine offline since (.+)$/, m => "मेसिन " + inline(m[1]) + " देखि अफलाइन"],
    [/^A fingerprint machine \((.+)\) is waiting for you to approve it\.$/, m => "फिंगरप्रिन्ट मेसिन (" + m[1] + ") तपाईंको स्वीकृति कुर्दै छ।"],
    [/^(\d+) staff members? (?:have|has) no name yet\.$/, m => m[1] + " जना कर्मचारीको नाम अझै राखिएको छैन।"],
    [/^Worked: (.+)$/, m => "काम गरे: " + m[1]],
    [/^Due at (.+)$/, m => inline(m[1]) + " मा आउनुपर्ने"],
    [/^(.+) worked$/, m => inline(m[1]) + " काम"],
    [/^left (.+) early$/, m => inline(m[1]) + " चाँडै गए"],
    [/^\+(.+) overtime$/, m => "+" + inline(m[1]) + " ओभरटाइम"],
    [/^([\d hm]+) late$/, m => inline(m[1]) + " ढिलो"],
    [/^(.+) – now$/, m => inline(m[1]) + " – अहिलेसम्म"],
    [/^(\d{1,2}) (am|pm)$/, m => { const h = +m[1] % 12 + (m[2] === "pm" ? 12 : 0); return part(h) + " " + m[1]; }],
    [/^(.+?) to (.+?), (\d+) days\.(.*)$/, m => {
      let out = `${inline(m[1])} देखि ${inline(m[2])} सम्म, ${m[3]} दिन।`;
      const n = /(\d+) late arrivals?, (\d+) days? absent, ([\d.]+) hours of overtime so far\./.exec(m[4]);
      if (n) out += ` ${n[1]} पटक ढिलो, ${n[2]} दिन अनुपस्थित, अहिलेसम्म ${n[3]} घण्टा ओभरटाइम।`;
      if (/Pay is only worked out for a whole month/.test(m[4])) out += " पाउने रकम पूरा महिनाको मात्र हिसाब हुन्छ।";
      return out;
    }],
    [/^, (\d+) absent$/, m => ", " + m[1] + " अनुपस्थित"],
    [/^(.+): every day$/, m => m[1] + ": हरेक दिन"],
    [/^(.+) \(no\. (\w+)\)$/, m => m[1] + " (नं. " + m[2] + ")"],
    [/^Staff #(\w+)$/, m => "कर्मचारी #" + m[1]],
    [/^Edit (.+)$/, m => m[1] + ": सम्पादन"],
    [/^Machine no\. (.+) is already in the list\. Use its Edit button\.$/, m => "मेसिन नं. " + m[1] + " पहिल्यै सूचीमा छ। त्यसको ‘सम्पादन’ बटन थिच्नुहोस्।"],
    [/^(\d+) min fast$/, m => m[1] + " मिनेट छिटो"],
    [/^Stop notifications on (.+)\?$/, m => m[1] + " मा सूचना बन्द गर्ने?"],
    [/^Stop sending messages to (.+)\?$/, m => m[1] + " लाई सन्देश पठाउन बन्द गर्ने?"],
    [/^Sent to (\d+) phones?\. It should appear in a few seconds\.$/, m => m[1] + " वटा फोनमा पठाइयो। केही सेकेन्डमा देखिनुपर्छ।"],
    [/^Sent to (\d+) phones?\.$/, m => m[1] + " वटा फोनमा पठाइयो।"],
    [/^Couldn't turn them on here \((.*)\)\.$/, m => "यहाँ खोल्न सकिएन (" + m[1] + ")।"],
    [/^Downloaded: (\d+) staff, (\d+) punches in (\d+)\. Keep the file somewhere safe\.$/, m => `डाउनलोड भयो: ${m[1]} कर्मचारी, ${m[3]} मा ${m[2]} हाजिरी। फाइल सुरक्षित ठाउँमा राख्नुहोस्।`],
    [/^Too many wrong passwords\. Try again in (\d+) minutes\.$/, m => "धेरै पटक गलत पासवर्ड। " + m[1] + " मिनेटपछि फेरि प्रयास गर्नुहोस्।"],
    [/^(.+) — Hotel Perfect Plaza$/, m => tr(m[1]) + " — होटल पर्फेक्ट प्लाजा"],
    [/^Payslip: (.+)$/, m => "तलब पर्ची: " + m[1]],
    [/^📞 Call (.+)$/, m => "📞 " + m[1] + " लाई फोन गर्नुहोस्"],
    [/^Call (.+)$/, m => m[1] + " लाई फोन"],
    [/^This month: (.+)$/, m => "यो महिना: " + inline(m[1])],
    [/^Shift (\d{1,2}:\d{2} [AP]M)$/, m => "सिफ्ट " + inline(m[1])],
    [/^([\d.]+) unpaid days × Rs ([\d,]+) taken off$/, m => `${m[1]} बेतलबी दिन × रु ${m[2]} कटाइयो`],
    [/^([\d.]+) hours × Rs ([\d,]+)$/, m => `${m[1]} घण्टा × रु ${m[2]}`],
    [/^([\d.]+)% of basic salary$/, m => `आधारभूत तलबको ${m[1]}%`],
    [/^(\S+) (\d{1,2}:\d{2} [AP]M–\d{1,2}:\d{2} [AP]M)$/, m => (W[m[1]] || m[1]) + " " + inline(m[2])]
  ];

  /* English → Nepali, or the English back if there's nothing to change.
     strict: only whole phrases and patterns (for tooltips), no partial mix. */
  function tr(text, strict) {
    const s = String(text).trim();
    if (!s || !/[A-Za-z]/.test(s)) return text;
    if (W[s] != null) return String(text).replace(s, W[s]);
    for (const [re, f] of PATTERNS) { const m = re.exec(s); if (m) return String(text).replace(s, f(m)); }
    return strict ? text : inline(String(text));
  }

  const BLOCKS = {
    "app-intro": 'यो पेजलाई फोनको होम स्क्रिनमा <strong lang="ne">हाजिरी</strong> नामको एपको रूपमा राख्नुहोस्। यो पूरा स्क्रिनमा खुल्छ र साइन इन भइरहन्छ। त्यो फोनमा <strong data-app-url>www.hotelperfectplaza.com/attendance.html</strong> खोल्नुहोस्, साइन इन गर्नुहोस्, अनि:',
    "app-steps": '<li><strong>एन्ड्रोइड:</strong> <strong>यो उपकरणमा एप इन्स्टल गर्नुहोस्</strong> थिच्नुहोस्। त्यो छैन भने: Chrome को <strong>⋮</strong> मेनु → <strong>Add to Home screen</strong> → <strong>Install</strong>।</li>' +
                 '<li><strong>आईफोन:</strong> Safari मा <strong>Share</strong> (तीर भएको बाकस) → <strong>Add to Home Screen</strong> → <strong>Add</strong> थिच्नुहोस्।</li>',
    "machine-steps": '<li>मेसिनलाई होटलको इन्टरनेटमा जोड्नुहोस्: राउटरबाट LAN तार। मेसिनमा: <strong>Menu → Comm. → Ethernet → DHCP: ON</strong>।</li>' +
                     '<li>मेसिनमा: <strong>Menu → Comm. → Cloud Server Setting</strong> (कुनै मोडेलमा <em>ADMS</em>)।</li>' +
                     '<li><strong>Enable Domain Name: ON</strong>, सर्भर ठेगाना <code data-dev-host>www.hotelperfectplaza.com</code> (www सहित)।</li>' +
                     '<li><strong>Server port: 443</strong>, <strong>HTTPS: ON</strong>, <strong>Proxy: OFF</strong>। सेभ गरेर मेसिन फेरि सुरु गर्नुहोस्।</li>' +
                     '<li>एक मिनेटभित्र माथिको तालिकामा मेसिन देखिन्छ। सिरियल नम्बर जाँच्नुहोस् (Menu → System Info → Device Info) र <strong>स्वीकृत गर्नुहोस्</strong> थिच्नुहोस्। त्यसपछि सबै हाजिरी आउँछ, मेसिनमा पहिले नै भएका पनि।</li>' +
                     '<li>मेसिनको मिति र समय जाँच्नुहोस् (Menu → System → Date Time)। देखिने सबै समय मेसिनकै घडीबाट आउँछ।</li>',
    "tg-open": '<strong>सन्देश चाहिने फोनमा</strong> (टेलिग्राम भएको), यो लिङ्क खोलेर <strong>Start</strong> थिच्नुहोस्:',
    "hik-steps": '<li>मेसिनलाई होटलको इन्टरनेटमा जोड्नुहोस्: राउटरबाट LAN तार (वा Wi-Fi भएको मोडेलमा Wi-Fi)।</li>' +
                 '<li>होटलको नेटवर्कमा भएको कम्प्युटरको ब्राउजरमा मेसिनको IP ठेगाना खोल्नुहोस् (मेसिनमा <strong>Communication → Network</strong> मा देखिन्छ) र <strong>admin</strong> ले साइन इन गर्नुहोस्। वा iVMS-4200 मा: <strong>Device Management → मेसिन → Remote Configuration</strong>।</li>' +
                 '<li><strong>Configuration → Network → Network Service → HTTP Listening</strong> मा जानुहोस् (कुनै फर्मवेयरमा <em>Event Alarm</em> वा <em>Alarm Server</em>)।</li>' +
                 '<li>Event alarm IP address / domain name: <code>www.hotelperfectplaza.com</code> · URL: <code>/api/hik</code> · Port: <strong>443</strong> · Protocol: <strong>HTTPS</strong>। सेभ गर्नुहोस्। MeroHajir को आफ्नै जडान प्रयोग बन्द नगरेसम्म रहन सक्छ।</li>' +
                 '<li>मेसिनमा औँला लगाउनुहोस्। एक मिनेटभित्र माथिको तालिकामा <strong>HIK-</strong> र MAC ठेगानासहित देखिन्छ। <strong>स्वीकृत गर्नुहोस्</strong> थिचेर फेरि एक पटक औँला लगाउनुहोस्: स्वीकृतिपछिका हाजिरी मात्र गनिन्छन्।</li>' +
                 '<li>मेसिनमा हरेक व्यक्तिको <strong>Employee No.</strong> नै ‘कर्मचारी’ मा उसको <strong>मेसिन नं.</strong> हो।</li>' +
                 '<li>समय: <strong>Configuration → System → Time Settings</strong>: time zone <strong>(GMT+05:45) Kathmandu</strong>, NTP खुला।</li>'
  };

  /* Translates a node and everything in it, in place. */
  function translate(node) {
    if (node.nodeType === 3) {
      const p = node.parentElement;
      if (!p || p.closest("[data-no-tr], [data-ne], script, style")) return;
      const s = node.nodeValue.trim();
      if (!s || !/[A-Za-z]/.test(s)) return;
      const out = p.classList.contains("r") && LETTERS[s] ? LETTERS[s] : tr(node.nodeValue);
      if (out !== node.nodeValue) node.nodeValue = out;
      return;
    }
    if (node.nodeType !== 1 || node.matches("script, style, svg, [data-no-tr]")) return;
    const key = node.getAttribute("data-ne");
    if (key && BLOCKS[key]) { if (!node.hasAttribute("data-ne-done")) { node.setAttribute("data-ne-done", ""); node.innerHTML = BLOCKS[key]; } return; }
    for (const a of ["placeholder", "aria-label", "title"]) {
      const v = node.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) { const out = tr(v, a === "title"); if (out !== v) node.setAttribute(a, out); }
    }
    for (const c of Array.from(node.childNodes)) translate(c);
  }

  return { tr, translate, inline };
})();
