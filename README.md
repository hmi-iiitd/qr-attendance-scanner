# QR Attendance Scanner (IIIT Delhi)

QR attendance for one course: a Google Sheet in IIITD Drive, unique student QRs, and a GitHub Pages scanner. Anyone who will scan must sign in with `@iiitd.ac.in` and must have **Editor** access on that sheet. Students only receive their QR; they do not get the spreadsheet.

Assume you already have the enrolled list (roll number and name).

**How long:** first course, about **45–90 minutes** if GitHub and Python are already available (Cloud Console + Pages are most of it). Later courses: about **20–40 minutes**, plus however long it takes to send QRs to students. Distributing QRs for a large class is separate from the technical setup.

You need: an `@iiitd.ac.in` account, a GitHub account, and Python 3 on a laptop (`pip install -r requirements.txt`).

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
