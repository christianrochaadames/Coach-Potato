# CouchPotato — App Store Connect Listing Copy

Everything below is ready to copy-paste into App Store Connect.

---

## App Information

| Field | Value |
|---|---|
| **App Name** | CouchPotato |
| **Subtitle** | Movie & TV Show Tracker |
| **Bundle ID** | com.couchpotato.ios |
| **SKU** | couchpotato-ios |
| **Primary Language** | English (U.S.) |
| **Primary Category** | Entertainment |
| **Secondary Category** | Lifestyle |

---

## Version Information

### Description
*(Paste into App Store Connect → Version Information → Description)*

```
CouchPotato is your personal movie and TV show companion. Log everything you've watched, track what you're currently watching, and build a watchlist of what's coming next — all in one place.

🎬 LOG WHAT YOU WATCH
• Quick-add movies and TV shows in seconds
• Rate titles from 1 to 5 stars
• Add notes and tags to remember what you thought
• Set the year you watched each title

📋 YOUR ENTIRE LIBRARY
• See your complete watch history organised by year
• Browse separately by Movies or TV Shows
• Mark shows as "Currently Watching" to track your progress

🔖 WATCHLIST
• Never forget what you want to watch next
• One tap to add directly from search results
• Quickly move titles from watchlist to watched

✨ PERSONALISED RECOMMENDATIONS
• Get suggestions based on your actual taste — not just what's trending
• Like or skip recommendations to fine-tune your picks
• Powered by TMDB (The Movie Database)

📊 YEARLY STATS
• See how many movies and shows you've watched
• Genre breakdown charts
• Monthly viewing activity
• Movies vs Shows split
• Filter by year to see your highlights

The TV shows and movies you're watching.
The ones you've already watched.
And what you'll watch next.
All in one place.
```

### Keywords
*(Max 100 characters, comma-separated — paste into Keywords field)*

```
movies,tv,shows,tracker,watchlist,ratings,films,series,log,watching,watched,catalog
```
Character count: 84/100 ✓

### Promotional Text
*(Optional — appears above description, can be updated without a new review)*

```
Track every movie and show you watch. Rate, review, and discover what to watch next.
```

### Support URL
*(Required — use your deployed web app URL)*

```
https://<your-deployed-domain>/cinelog
```

### Marketing URL
*(Optional)*

```
https://<your-deployed-domain>/cinelog
```

### Privacy Policy URL
*(Required — fill in your deployed domain)*

```
https://<your-deployed-domain>/cinelog/privacy
```
> The `/privacy` page is already live on the web app. Just replace `<your-deployed-domain>` with your actual Replit deployment domain.

---

## Age Rating Questionnaire

Go to App Store Connect → Your App → Age Rating → Edit.

Answer the questions as follows:

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes for Children | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| User Generated Content | **No** *(watch history is private, not shared publicly)* |
| Unrestricted Web Access | No |

**Result: 4+** *(All ages)*

---

## Screenshots

Apple requires **at least one screenshot** for each of these two sizes before you can submit:

| Device | Size | Notes |
|---|---|---|
| 6.5" iPhone (required) | 1284 × 2778 px | iPhone 14 Pro Max / 15 Plus |
| 5.5" iPhone (required) | 1242 × 2208 px | iPhone 8 Plus |

### How to capture screenshots

**Option A — Simulator (easiest):**
1. Open Xcode → Simulator → select iPhone 14 Pro Max
2. Run the app (`npx expo start --ios`)
3. Navigate to each screen and press `Cmd+S` to save a screenshot
4. Screenshots save to your Desktop at the correct resolution

**Option B — Use the web app preview:**
1. Open the web app in Chrome at full width
2. Take screenshots and resize to 1284×2778 px in any image editor

### Recommended screens to capture (5–10 screenshots):
1. **Home screen** — shows watch history, stats banner, and recommendations
2. **Search** — searching for a title with TMDB results showing
3. **Entry detail** — a movie or show's detail page with poster, rating, notes
4. **Stats tab** — genre breakdown charts and yearly stats
5. **Watchlist** — a filled watchlist
6. **Sign-in screen** — shows Google, Apple, Facebook options

---

## App Review Information

| Field | Value |
|---|---|
| **First Name** | *(your name)* |
| **Last Name** | *(your name)* |
| **Phone** | *(your phone)* |
| **Email** | *(your email)* |
| **Demo account credentials** | Create a test account at `/sign-up` on the web app — use the same credentials to log in on the iOS app |
| **Notes for reviewer** | "CouchPotato is a personal movie and TV show tracker. Sign in with the provided test credentials to explore the app. All data is private per user." |

---

## Checklist before hitting "Submit for Review"

- [ ] App name, subtitle, description, keywords filled in
- [ ] At least one screenshot uploaded for 6.5" iPhone
- [ ] At least one screenshot uploaded for 5.5" iPhone  
- [ ] Privacy Policy URL set (deployed `/cinelog/privacy`)
- [ ] Support URL set
- [ ] Age rating questionnaire completed (result: 4+)
- [ ] App Review contact info filled in
- [ ] Demo account credentials provided (or "No sign-in required" if using Apple reviewer account)
- [ ] Build selected from TestFlight
