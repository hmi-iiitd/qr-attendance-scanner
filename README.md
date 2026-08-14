# QR Attendance Scanner

QR-based attendance system for IIIT Delhi courses.

## Setup for a New Course

### 1. Prepare Student List

Create a CSV file named `students.csv`:

```text
roll_no,name
CS21-014,Aarav Sharma
CS21-015,Diya Menon
```

### 2. Generate QR Codes

Install the required packages:

```bash
pip install -r requirements.txt
```

Run:

```bash
python generate_qr.py students.csv
```

This generates:

- `qr_codes/` → QR code image for each student
- `tokens.csv` → student details and QR tokens
- `print_sheet.html` → printable QR cards

### 3. Create Google Spreadsheet

Create a Google Spreadsheet with two sheets:

#### Students

```text
roll_no | name | token
```

Copy the contents of `tokens.csv` into this sheet.

#### Attendance

```text
timestamp | date | roll_no | name | status | session
```

### 4. Get the Spreadsheet ID

Open the Google Spreadsheet and look at its URL.

For example:

```text
https://docs.google.com/spreadsheets/d/1AbCDeFGhijkLMNopQRsTUVwxyz123456789/edit
```

The Spreadsheet ID is the part between `/d/` and `/edit`:

```text
1AbCDeFGhijkLMNopQRsTUVwxyz123456789
```

### 5. Create a Google OAuth Client ID

The scanner uses Google OAuth to allow TAs to sign in and access the Google Sheet.

#### Step 1: Open Google Cloud Console

Go to:

https://console.cloud.google.com/

Create a new Google Cloud project or select an existing project.

#### Step 2: Enable Google Sheets API

Go to **APIs & Services → Library**, search for **Google Sheets API**, and click **Enable**.

#### Step 3: Configure OAuth Consent Screen

Go to **APIs & Services → OAuth consent screen** and configure the application for the appropriate Google Workspace organization.

For IIIT Delhi courses, use the **Internal** option if it is available for the IIIT Delhi Google Workspace.

#### Step 4: Create OAuth Client ID

Go to **APIs & Services → Credentials** → **Create Credentials** → **OAuth client ID**.

Select **Web application**.

Add the GitHub Pages URL of the scanner under **Authorized JavaScript origins**. For example:

```text
https://YOUR_USERNAME.github.io
```

Google will provide a Client ID similar to:

```text
123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
```

Copy this Client ID.

> Do not share or commit a Google OAuth Client Secret. The Client ID is used by the frontend and is not a secret.

### 6. Configure the Scanner

Open `script.js`.

Find:

```js
const CLIENT_ID = "YOUR_CLIENT_ID";
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";
```

Replace `YOUR_CLIENT_ID` with the Client ID obtained from Google Cloud Console and `YOUR_SPREADSHEET_ID` with the ID of the course spreadsheet.

For example:

```js
const CLIENT_ID =
  "123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com";

const SPREADSHEET_ID =
  "1AbCDeFGhijkLMNopQRsTUVwxyz123456789";
```

### 7. Give TA Access

Give **Editor access** to the TAs who will be taking attendance.

TAs should use their **@iiitd.ac.in** Google accounts.

The OAuth Client ID does not automatically give a TA access to the spreadsheet. Each TA must also have permission to access the course spreadsheet.


### 8. Host `index.html` on GitHub Pages

**a. Push the project to GitHub**
 
Create a new repository on GitHub, then form the project folder.
Make sure `index.html`, `script.js`, and `style.css` are in the **root** of the
repository, not inside a subfolder.
 
**b. Enable GitHub Pages**
 
1. Go to the repository → **Settings** → **Pages**.
2. Under **Source**, choose **Deploy from a branch**.
3. Select branch **main** and folder **/ (root)**.
4. Click **Save**.
After a minute or two the site will be live at:
 
```text
https://<username>.github.io/<repo-name>/
```
 
**c. Test it**
 
Open the Pages URL on the phone or laptop that will be used for scanning and
check that the camera prompt appears and Google sign-in completes.
 
> Any later change to `script.js` (for example a new `SPREADSHEET_ID` for a new
> course) must be committed and pushed — GitHub Pages redeploys automatically
> within a minute. Hard-refresh the page if you still see the old version.

 
## Using the Scanner

1. Open the attendance scanner.
2. Sign in using the IIITD Google account.
3. Click **Load Student Data**.
4. Enter the lecture/session number.
5. Start scanning student QR codes.
6. Attendance will automatically be added to the `Attendance` sheet.

## Important

- Each student gets a unique QR token.
- Only present students are added to the `Attendance` sheet.
- Duplicate attendance is prevented for the same **date + student + session**.
- TAs must have **Editor access** to the course spreadsheet.
- Use an **@iiitd.ac.in** Google account.
- Never commit OAuth Client Secrets or other private credentials to GitHub.
