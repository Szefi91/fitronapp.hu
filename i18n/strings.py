# -*- coding: utf-8 -*-
"""FITRON landing forditasok. A KULCS a magyar forras-szoveg (index.html), pontos egyezessel.
   Szefi kerese 2026-08-21: a landing legyen magyarul, angolul es nemetul is, nyelvvalasztoval.
   FONTOS: ez a landing OLDAL nyelve. Maga az APP jelenleg magyarul es angolul tud."""

T = {
 # --- fejlec, hero ---
 "Letöltés": ("Download", "Download"),
 "Közösség × Edzés × Motiváció": ("Community × Training × Motivation", "Community × Training × Motivation"),
 "Nem csak edzel.": ("You do not just train.", "Du trainierst nicht nur."),
 "Szintet lépsz.": ("You level up.", "Du steigst auf."),
 "Edzésterv, makrók, receptek, lépésszám és egy közösség, aki tolja veled. Egy appban, magyarul. Androidra és iPhone-ra is.":
   ("Workout plans, macros, recipes, step count and a community that pushes with you. All in one app, on Android and iPhone.",
    "Trainingspläne, Makros, Rezepte, Schrittzähler und eine Community, die mitzieht. Alles in einer App, für Android und iPhone."),
 "Google Play, hamarosan": ("Google Play, coming soon", "Google Play, demnächst"),
 "Korai hozzáférés": ("Early access", "Früher Zugang"),
 "Androidon és iPhone-on is elérhető lesz. Most zárt tesztelés fut mindkettőn.":
   ("Coming to both Android and iPhone. Closed testing is running on both right now.",
    "Kommt für Android und iPhone. Aktuell läuft auf beiden ein geschlossener Test."),
 "Nyelv": ("Language", "Sprache"),
 "Nyelvválasztó": ("Language switcher", "Sprachauswahl"),
 "hamarosan": ("coming soon", "demnächst"),
 "Olvasd be a telefonoddal, és már töltődik is.": ("Scan it with your phone and the download starts.", "Mit dem Handy scannen, und der Download startet."),

 # --- funkcio-kartyak ---
 "Három ok, amiért bent maradsz": ("Three reasons you will stick with it", "Drei Gründe, warum du dranbleibst"),
 "Nem egyedül tolod": ("You are not doing it alone", "Du machst es nicht allein"),
 "Hírfolyam, közös kihívások, és a többiek eredménye a szemed előtt. Ez tart bent akkor is, amikor nincs kedved.":
   ("A feed, shared challenges and everyone else's results in front of you. That is what keeps you going on the days you do not feel like it.",
    "Ein Feed, gemeinsame Challenges und die Ergebnisse der anderen vor Augen. Genau das hält dich an den Tagen, an denen du keine Lust hast."),
 "A tervezést levesszük rólad": ("We take the planning off your hands", "Wir nehmen dir die Planung ab"),
 "Kész edzéstervek otthonra és terembe. Kiválasztod, elindítod, és csak az edzésre kell figyelned.":
   ("Ready-made plans for home and gym. Pick one, start it, and just focus on the training.",
    "Fertige Plaene für zu Hause und fürs Studio. Auswählen, starten, und du konzentrierst dich nur aufs Training."),
 "Számokban látod a fejlődést": ("You see progress in numbers", "Du siehst den Fortschritt in Zahlen"),
 "Lépés, kalória, testsúly, XP. Hetekre visszanézed, és látod, mi működött és mi nem.":
   ("Steps, calories, body weight, XP. Look back over weeks and see what worked and what did not.",
    "Schritte, Kalorien, Körpergewicht, XP. Schau Wochen zurück und sieh, was funktioniert hat und was nicht."),

 # --- elo szekcio ---
 "Így él az app a kezedben": ("This is the app in your hand", "So lebt die App in deiner Hand"),
 "Görgess lefelé, és a telefon veled együtt halad. Ezek nem rajzolt képek, hanem felvételek magáról a futó alkalmazásról.":
   ("Scroll down and the phone moves with you. These are not mockups, they are recordings of the running app itself.",
    "Scrolle nach unten, und das Handy geht mit. Das sind keine Mockups, sondern Aufnahmen der laufenden App."),
 "Egy képernyőn az egész napod": ("Your whole day on one screen", "Dein ganzer Tag auf einem Bildschirm"),
 "Szint és XP felül, alatta a szériád, a mai lépésszámod és a napi beviteled. Nem kell keresgélned, ez fogad, amikor megnyitod.":
   ("Level and XP on top, then your streak, today's steps and your daily intake. Nothing to search for, this is what greets you.",
    "Level und XP oben, darunter deine Serie, die heutigen Schritte und deine Tageszufuhr. Nichts zu suchen, das begrüßt dich sofort."),
 "Szint és XP": ("Level and XP", "Level und XP"),
 "Napi széria": ("Daily streak", "Tages-Serie"),
 "Lépésszám": ("Step count", "Schrittzähler"),
 "Napi bevitel": ("Daily intake", "Tageszufuhr"),
 "Szintet lépsz, és meg is mutatja": ("You level up, and it shows", "Du steigst auf, und es wird gezeigt"),
 "Mérföldkőnél az app megáll egy pillanatra: jön a rang, a jelvény és a jutalom. Ez a visszajelzés, amit egy sima naplótól nem kapsz meg.":
   ("At a milestone the app stops for a moment: rank, badge and reward. This is the feedback a plain logbook never gives you.",
    "Bei einem Meilenstein hält die App kurz inne: Rang, Abzeichen und Belohnung. Dieses Feedback bekommst du von einem einfachen Logbuch nie."),
 "Rangok": ("Ranks", "Ränge"),
 "Jelvények": ("Badges", "Abzeichen"),
 "XP jutalom": ("XP reward", "XP-Belohnung"),
 "Kalória és makrók, számolás nélkül": ("Calories and macros, without the math", "Kalorien und Makros, ohne Rechnerei"),
 "Beírod, mit ettél, és látod a napi keretet: mennyi maradt, és hogy áll a fehérje, a szénhidrát és a zsír. Étkezésenként bontva.":
   ("Log what you ate and see your daily budget: what is left, and how protein, carbs and fat are doing. Broken down by meal.",
    "Trag ein, was du gegessen hast, und sieh dein Tagesbudget: was übrig ist und wie Eiweiß, Kohlenhydrate und Fett stehen. Nach Mahlzeit aufgeschlüsselt."),
 "Napi kalóriakeret": ("Daily calorie budget", "Tages-Kalorienbudget"),
 "Fehérje, szénhidrát, zsír": ("Protein, carbs, fat", "Eiweiß, Kohlenhydrate, Fett"),
 "Reggeli, ebéd, vacsora": ("Breakfast, lunch, dinner", "Frühstück, Mittag, Abendessen"),
 "Receptek, kalóriával együtt": ("Recipes, with the calories", "Rezepte, mit Kalorien"),
 "Ha elfogyott az ötlet, van honnan választani. Minden fogásnál ott a kalória, és egy koppintással a naplódba kerül.":
   ("Out of ideas? There is plenty to pick from. Every dish shows its calories, and one tap adds it to your log.",
    "Keine Idee mehr? Es gibt genug zur Auswahl. Bei jedem Gericht stehen die Kalorien, ein Tipp und es landet im Tagebuch."),
 "Népszerű receptek": ("Popular recipes", "Beliebte Rezepte"),
 "Kalória fogásonként": ("Calories per dish", "Kalorien pro Gericht"),
 "Egy koppintás a naplóba": ("One tap into your log", "Ein Tipp ins Tagebuch"),
 "Közösség: hírfolyam, térkép, események": ("Community: feed, map, events", "Community: Feed, Karte, Events"),
 "Látod, mit csinálnak a többiek, hol edzenek a környékeden, milyen versenyek jönnek, és hol tartasz hozzájuk képest.":
   ("See what everyone else is doing, where they train near you, which competitions are coming, and where you stand.",
    "Sieh, was die anderen machen, wo sie in deiner Nähe trainieren, welche Wettkämpfe kommen und wo du stehst."),
 "Hírfolyam": ("Feed", "Feed"),
 "Térkép": ("Map", "Karte"),
 "Események": ("Events", "Events"),
 "Díjak": ("Awards", "Auszeichnungen"),

 # --- "Egy heted" ---
 "Egy heted a FITRON-nal": ("A week with FITRON", "Eine Woche mit FITRON"),
 "Nem képernyőket sorolunk fel. Végigmegyünk azon, mikor veszed elő, és mire jó.":
   ("We are not listing screens. We walk through when you reach for it and what it is good for.",
    "Wir zählen keine Screens auf. Wir gehen durch, wann du sie herausholst und wofür sie gut ist."),
 "Hétfő reggel": ("Monday morning", "Montagmorgen"),
 "Megvan, mit csinálsz ma": ("You know what you are doing today", "Du weißt, was du heute machst"),
 "Kész edzéstervek otthonra és terembe. Kiválasztod, és mehetsz. Nem a tervezéssel megy el az energiád.":
   ("Ready-made plans for home and gym. Pick one and go. Your energy does not go into planning.",
    "Fertige Plaene für zu Hause und fürs Studio. Auswählen und los. Deine Energie geht nicht in die Planung."),
 "Amikor elfogy az ötlet": ("When you run out of ideas", "Wenn dir die Ideen ausgehen"),
 "Van mit főzni": ("There is something to cook", "Es gibt was zu kochen"),
 "Receptek kalóriával és elkészítési idővel. Egy koppintás, és már a naplódban is ott van a bevitel.":
   ("Recipes with calories and cooking time. One tap and the intake is already in your log.",
    "Rezepte mit Kalorien und Zubereitungszeit. Ein Tipp, und die Zufuhr steht schon im Tagebuch."),
 "Hétvégén": ("On the weekend", "Am Wochenende"),
 "Számokban látod, mennyit léptél": ("You see in numbers how far you came", "Du siehst in Zahlen, wie weit du gekommen bist"),
 "Testsúly, testzsír, körfogatok, edzésszám. Nem homályos érzés, hanem adat, amit hetekre visszanézel.":
   ("Body weight, body fat, measurements, session count. Not a vague feeling but data you can look back on for weeks.",
    "Körpergewicht, Körperfett, Umfänge, Anzahl der Einheiten. Kein vages Gefuehl, sondern Daten, die du wochenlang zurückverfolgst."),

 # --- utemterv, zaras ---
 "Ütemterv": ("Roadmap", "Fahrplan"),
 "Android build kész, zárt teszt fut": ("Android build ready, closed test running", "Android-Build fertig, geschlossener Test läuft"),
 "iOS build fent a TestFlighten, tesztelők meghívva": ("iOS build on TestFlight, testers invited", "iOS-Build auf TestFlight, Tester eingeladen"),
 "Nyilvános megjelenés a Google Playen és az App Store-ban": ("Public release on Google Play and the App Store", "Öffentlicher Release bei Google Play und im App Store"),
 "A cél egyszerű: jobb forma, erősebb rutin, nagyobb közösség.": ("The goal is simple: better shape, stronger routine, bigger community.", "Das Ziel ist einfach: bessere Form, stärkere Routine, größere Community."),
 "A FITRON nem csak tracker. Egy olyan platform, ahol az app tényleg segít benne maradni a játékban, és közben összehoz olyan emberekkel, akik ugyanúgy fejlődni akarnak.":
   ("FITRON is not just a tracker. It is a platform where the app actually helps you stay in the game, and connects you with people who want to improve just as much.",
    "FITRON ist nicht nur ein Tracker. Es ist eine Plattform, die dir wirklich hilft dranzubleiben, und dich mit Menschen verbindet, die genauso besser werden wollen."),
 "Értesíts a rajtról": ("Notify me at launch", "Benachrichtige mich zum Start"),
 "Az adat ott van, ahol edzel": ("The data is right where you train", "Die Daten sind dort, wo du trainierst"),
 "Nem kell külön alkalmazást nyitogatnod sorozatok között. Beírod a súlyt, az app számolja az XP-t, a szintet és a heti terhelést, te meg mehetsz tovább.":
   ("No separate app to open between sets. Log the weight, the app counts the XP, the level and your weekly load, and you carry on.",
    "Keine zweite App zwischen den Sätzen. Trag das Gewicht ein, die App zählt XP, Level und deine Wochenlast, und du machst weiter."),
 "SZINT": ("LEVEL", "LEVEL"),
 "VAS HARCOS": ("IRON WARRIOR", "EISENKRIEGER"),
 "a jelenlegi rangod": ("your current rank", "dein aktueller Rang"),
 "a mérföldkőért": ("for the milestone", "für den Meilenstein"),

 # --- lablec ---
 "FITRON. Minden jog fenntartva.": ("FITRON. All rights reserved.", "FITRON. Alle Rechte vorbehalten."),
 "Adatvédelmi irányelvek": ("Privacy policy", "Datenschutz"),
 "Felhasználási feltételek": ("Terms of use", "Nutzungsbedingungen"),
 "Sütik": ("Cookies", "Cookies"),
 "Impresszum": ("Imprint", "Impressum"),
 "Jogi nyilatkozat": ("Disclaimer", "Haftungsausschluss"),
 "Összes jogi dokumentum": ("All legal documents", "Alle rechtlichen Dokumente"),

 # --- attributumok (alt / aria-label) ---
 "FITRON logó": ("FITRON logo", "FITRON Logo"),
 "Google Play letöltés": ("Download on Google Play", "Bei Google Play herunterladen"),
 "QR kód a Google Play letöltéshez": ("QR code for the Google Play download", "QR-Code für den Google-Play-Download"),
 "QR kód az App Store letöltéshez": ("QR code for the App Store download", "QR-Code für den App-Store-Download"),
 "FITRON kezdőképernyő felvétele": ("Recording of the FITRON home screen", "Aufnahme des FITRON-Startbildschirms"),
 "FITRON szintlépés képernyő felvétele": ("Recording of the FITRON level-up screen", "Aufnahme des FITRON-Level-up-Bildschirms"),
 "FITRON kalória és makró követő felvétele": ("Recording of the FITRON calorie and macro tracker", "Aufnahme des FITRON-Kalorien- und Makro-Trackers"),
 "FITRON receptek képernyő felvétele": ("Recording of the FITRON recipes screen", "Aufnahme des FITRON-Rezeptbildschirms"),
 "FITRON közösség és térkép felvétele": ("Recording of the FITRON community and map", "Aufnahme von FITRON-Community und Karte"),
 "FITRON kezdőképernyő": ("FITRON home screen", "FITRON-Startbildschirm"),
 "FITRON achievement képernyő": ("FITRON achievement screen", "FITRON-Erfolgsbildschirm"),
 "FITRON edzéstervek képernyő": ("FITRON workout plans screen", "FITRON-Trainingspläne"),
 "FITRON receptek képernyő": ("FITRON recipes screen", "FITRON-Rezeptbildschirm"),
 "FITRON testadatok képernyő": ("FITRON body stats screen", "FITRON-Körperdaten"),
 "Edzés a teremben": ("Training in the gym", "Training im Studio"),
}

HEAD = {
 "hu": {
   "title": "FITRON App, Közösségi fitness app | Android és iOS",
   "desc": "A FITRON közösségi fitness app: edzéstervek, makrók, receptek, lépésszám és közösség egy helyen. Android és iOS.",
   "ogt": "FITRON App, Közösségi fitness app",
   "ogd": "Edzés, közösség, fejlődés és motiváció. Csatlakozz a FITRON közösséghez.",
   "twd": "Közösségi fitness app valódi fejlődéshez.",
   "url": "https://fitronapp.hu/", "locale": "hu_HU",
 },
 "en": {
   "title": "FITRON App, social fitness app | Android and iOS",
   "desc": "FITRON is a social fitness app: workout plans, macros, recipes, step count and a community in one place. Android and iOS.",
   "ogt": "FITRON App, social fitness app",
   "ogd": "Training, community, progress and motivation. Join the FITRON community.",
   "twd": "A social fitness app for real progress.",
   "url": "https://fitronapp.hu/en/", "locale": "en_US",
 },
 "de": {
   "title": "FITRON App, Social-Fitness-App | Android und iOS",
   "desc": "FITRON ist eine Social-Fitness-App: Trainingspläne, Makros, Rezepte, Schrittzähler und Community an einem Ort. Android und iOS.",
   "ogt": "FITRON App, Social-Fitness-App",
   "ogd": "Training, Community, Fortschritt und Motivation. Werde Teil der FITRON-Community.",
   "twd": "Eine Social-Fitness-App für echten Fortschritt.",
   "url": "https://fitronapp.hu/de/", "locale": "de_DE",
 },
}
