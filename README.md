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

### 4. Configure the Scanner

Open `script.js` and change:

```js
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";
```

to the ID of the course's Google Spreadsheet.

### 5. Give TA Access

Give **Editor access** to the TAs who will be taking attendance.

TAs should use their **@iiitd.ac.in** Google accounts.

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
