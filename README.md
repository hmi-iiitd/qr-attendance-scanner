# QR Attendance Scanner

QR attendance for one course: a Google Sheet, unique student QRs, and a GitHub Pages scanner. Anyone who will scan must sign in with Google and must have **Editor** access on that sheet. Students only receive their QR; they do not get the spreadsheet.

This copy is documented for **IIIT Delhi** (`@iiitd.ac.in`, Asia/Kolkata). Other universities and labs may fork it and change the domain, Drive, and timezone for their own non-commercial teaching or research.

Assume you already have the enrolled list (roll number and name).

**How long:** first course, about **45–90 minutes** if GitHub and Python are already available (Cloud Console + Pages are most of it). Later courses: about **20–40 minutes**, plus however long it takes to send QRs to students. Distributing QRs for a large class is separate from the technical setup.

You need: a Google account on your institution’s Workspace (at IIITD: `@iiitd.ac.in`), a GitHub account, and Python 3 on a laptop (`pip install -r requirements.txt`).

---

## 1. Create the spreadsheet

In IIITD Drive, create a spreadsheet with two tabs.

**Students**

```text
roll_no | name | token
```

**Attendance**

```text
timestamp | date | roll_no | name | status | session
```

**Share** the spreadsheet with every `@iiitd.ac.in` account that will take attendance, as **Editor**. Do not share it with students. Do not use “anyone with the link.”

Copy the spreadsheet ID from the URL into `config.js` later:

```text
https://docs.google.com/spreadsheets/d/THIS_PART/edit
```

---

## 2. Generate student QRs (once)

From the enrolled list, make `students.csv` with exactly these headers:

```csv
roll_no,name
PhD24103,Partha Chowdhury
MT24028,Chaitanya Ravindra Kulkarni
```

Drop extra ERP columns (serial number, type, batch, term, grade). `roll_no` is the unique key.

```bash
pip install -r requirements.txt
python generate_qr.py students.csv
```

This writes:

- `qr_codes/<ROLL>.png` — one QR per student
- `tokens.csv` — `roll_no,name,token`
- `print_sheet.html` — printable cards

Paste **all** of `tokens.csv` into the **Students** tab (keep the header).

Give each student **only their own** QR (`qr_codes/<ROLL>.png`, or print `print_sheet.html`). They reuse it for the term. Do not post the whole `qr_codes/` folder on a public link.

If students join later, keep `tokens.csv`, add rows to `students.csv`, and run the script again. Existing roll numbers reuse their tokens; only new rolls get new QRs. Append the new rows to the Students tab and send QRs only to the new students.

Do not commit `students.csv`, `tokens.csv`, `qr_codes/`, or `print_sheet.html` (they are gitignored).

---

## 3. Host the scanner on GitHub Pages

Create a GitHub repository from this project (fork, or clone and push). Keep `index.html`, `script.js`, `style.css`, and `config.js` at the **repository root**.

Repo → **Settings** → **Pages** → **Deploy from a branch** → `main` / `/ (root)` → Save.

Scanner URL:

```text
https://<github-username>.github.io/<repo-name>/
```

OAuth origin (used in the next step — **no** `/repo-name`):

```text
https://<github-username>.github.io
```

---

## 4. Google Cloud OAuth (not the same as Drive)

Drive holds the sheet. [Google Cloud Console](https://console.cloud.google.com/) registers the scanner page so **Sign in with Google** works. Use an `@iiitd.ac.in` account. First time: about 10–15 minutes.

1. Open Cloud Console → **New project** → name it like `cse123-attendance` → Create.
2. **APIs & Services** → **Library** → **Google Sheets API** → **Enable**.
3. **APIs & Services** → **OAuth consent screen**:
   - **Internal** (IIIT Delhi Workspace). If Internal is missing, stop and ask a Workspace admin. Do not use External.
   - App name: course code or `QR Attendance Scanner`.
   - Support and developer contact: your IIITD email.
   - Save.
4. **Credentials** → **Create credentials** → **OAuth client ID**:
   - Type: **Web application**.
   - **Authorized JavaScript origins** → Add:
     - `https://<github-username>.github.io`
     - optional: `http://localhost:8000` for local testing
   - Leave redirect URIs empty → Create.
5. Copy the **Client ID** only (`….apps.googleusercontent.com`). Do not create or commit a Client Secret.

If sign-in fails, the usual mistake is pasting the full Pages URL (with `/repo-name/`) as the origin. Origin has no path.

---

## 5. Edit `config.js` and push

```js
COURSE_NAME: "CSE123 – Course Name",
CLIENT_ID: "paste-the-client-id-here",
SPREADSHEET_ID: "paste-the-id-from-the-sheet-url",
HOSTED_DOMAIN: "iiitd.ac.in",
```

Commit and push `config.js`. Hard-refresh the Pages URL if an old config is cached.

---

## 6. Smoke test

1. Open the Pages URL on the phone that will scan.
2. **Sign in with Google** (`@iiitd.ac.in`).
3. Enter a session name, e.g. `Lecture 0`.
4. **Load Student Data** → **Start Camera** → scan one student QR.
5. Confirm a **Present** row in the Attendance tab.

---

## In class

1. Open the course Pages URL.
2. Sign in with `@iiitd.ac.in`.
3. Use the same session spelling every week (`Lecture 3`, not `Lec 3` one week and `Lecture 3` the next).
4. Load Student Data → Start Camera → scan.

Each successful scan appends timestamp, date (IST), roll number, name, Present, and session. Filter the Attendance tab by **date** or **session**. The same student is not marked twice for the same date + session. If login expires, use **Reconnect Google**.

---

## Notes

- Student lists and tokens belong in the course Drive file, not on public GitHub.
- A photo of a QR still counts as that student.
- Deleting `tokens.csv` and regenerating invalidates QRs already issued.

## FAQ

**Who is allowed to mark attendance?**  
Anyone whose `@iiitd.ac.in` (or your Workspace) account is on the spreadsheet **Share** list as **Editor**. They are not added as rows in the sheet.

**Should students get the spreadsheet?**  
No. Students only get their own QR.

**What is `students.csv`?**  
Two columns only: `roll_no,name`. Copy roll number and name from the enrolled list; drop other ERP columns.

**Google Drive vs Cloud Console?**  
Drive holds the attendance file. Cloud Console is a one-time step so **Sign in with Google** works on your GitHub Pages URL. It is not where student data lives.

**Sign-in fails after setup?**  
Authorized JavaScript origin must be `https://USERNAME.github.io` with **no** `/repo-name`. Confirm `config.js` is pushed and hard-refresh the Pages site.

**Login expired mid-lecture?**  
Use **Reconnect Google**, then Load Student Data again if needed.

**Can I run the QR script again?**  
Yes, if you keep `tokens.csv`. Existing roll numbers reuse the same QR. Only new rolls get new codes.

**How do I see who was present on a given day?**  
In the Attendance tab, filter the **date** column (IST). You can also filter **session**.

**Can another university use this?**  
Yes, for non-commercial teaching or research. Fork, then change domain / Drive / timezone as in *Other institutions* below. Commercial use is not allowed.

## Other institutions

Fork this repository and use it for non-commercial teaching or research. You will typically change:

- `HOSTED_DOMAIN` in `config.js` (your Google Workspace domain, or leave empty if you do not restrict it)
- OAuth consent screen (Internal on *your* Workspace, or the option your admin allows)
- Spreadsheet in your own Google Drive; share Editors only with people who take attendance
- Date/time in `script.js` if you are not on `Asia/Kolkata`

Commercial use is not allowed; see [LICENSE](LICENSE).

## Credits

Based on [PranavAggarwal422/qr-attendance-scanner](https://github.com/PranavAggarwal422/qr-attendance-scanner) (QR generation, GitHub Pages scanner, Google Sheets + OAuth).

This repository adds:

- Per-course `config.js` (no IDs hard-coded in `script.js`)
- Setup guide for a new course from an enrolled list
- Sign-in limited to `@iiitd.ac.in`, reconnect when Google login expires
- QR generation that reuses existing tokens so old cards stay valid
- `.gitignore` so student lists and QR tokens are not pushed to GitHub
- Non-commercial license with no warranty

## License

Non-commercial use only (teaching, research, internal institutional use). No warranty and no liability. See [LICENSE](LICENSE).
