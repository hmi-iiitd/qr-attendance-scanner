/* =========================================================
     CONFIGURATION
     ========================================================= */

const CLIENT_ID = "YOUR_CLIENT_ID";

const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";

const STUDENTS_RANGE = "Students!A:C";

const ATTENDANCE_RANGE = "Attendance!A:F";

const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

/* =========================================================
     GLOBAL VARIABLES
     ========================================================= */

let accessToken = null;

let tokenClient = null;

let students = new Map();

/*
     Attendance key:

     DATE || ROLL_NO || SESSION

     Example:

     2026-08-13||2023009||LECTURE 0

     This means the same student can be marked again
     for Lecture 1 on the same date.
  */
let attendanceKeys = new Set();

/*
     Store attendance records so that the UI can calculate
     "Present This Session".
  */
let attendanceRecords = [];

let scanner = null;

let scannerRunning = false;

let processingScan = false;

/* =========================================================
     GOOGLE AUTHENTICATION
     ========================================================= */

function initializeGoogleAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,

    scope: SCOPES,

    callback: (response) => {
      if (response.error) {
        showAuthStatus("Google authorization failed.", "error");

        return;
      }

      accessToken = response.access_token;

      showAuthStatus(
        "Google account connected successfully.",
        "success-status",
      );

      document.getElementById("authorizeBtn").textContent =
        "Google Account Connected";

      document.getElementById("authorizeBtn").disabled = true;

      document.getElementById("loadBtn").disabled = false;

      document.getElementById("refreshBtn").disabled = false;
    },
  });
}

function authorizeGoogle() {
  if (!tokenClient) {
    initializeGoogleAuth();
  }

  tokenClient.requestAccessToken({
    prompt: "",
  });
}

function showAuthStatus(message, type) {
  const element = document.getElementById("authStatus");

  element.textContent = message;

  element.className = "status " + type;
}

/* =========================================================
     GOOGLE SHEETS API
     ========================================================= */

async function sheetsGet(range) {
  if (!accessToken) {
    throw new Error("Google account is not authorized.");
  }

  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    SPREADSHEET_ID +
    "/values/" +
    encodeURIComponent(range);

  const response = await fetch(url, {
    method: "GET",

    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (response.status === 401) {
    accessToken = null;

    throw new Error("Google authorization expired. Please sign in again.");
  }

  if (!response.ok) {
    const text = await response.text();

    throw new Error("Google Sheets error: " + text);
  }

  return await response.json();
}

async function sheetsAppend(rows) {
  if (!accessToken) {
    throw new Error("Google account is not authorized.");
  }

  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    SPREADSHEET_ID +
    "/values/" +
    encodeURIComponent(ATTENDANCE_RANGE) +
    ":append" +
    "?valueInputOption=USER_ENTERED" +
    "&insertDataOption=INSERT_ROWS";

  const response = await fetch(url, {
    method: "POST",

    headers: {
      Authorization: "Bearer " + accessToken,

      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      values: rows,
    }),
  });

  if (response.status === 401) {
    accessToken = null;

    throw new Error("Google authorization expired. Please sign in again.");
  }

  if (!response.ok) {
    const text = await response.text();

    throw new Error("Unable to write attendance: " + text);
  }

  return await response.json();
}

/* =========================================================
     DATE / TIME
     ========================================================= */

function getIndiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getIndiaTimestamp() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

/* =========================================================
     SESSION NORMALIZATION
     ========================================================= */

function normalizeSession(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function getSession() {
  return document.getElementById("sessionInput").value.trim();
}

/* =========================================================
     ATTENDANCE KEY
     ========================================================= */

function makeAttendanceKey(date, roll, session) {
  return (
    String(date).trim() +
    "||" +
    String(roll).trim().toUpperCase() +
    "||" +
    normalizeSession(session)
  );
}

/* =========================================================
     LOAD STUDENTS
     ========================================================= */

async function loadStudents() {
  const data = await sheetsGet(STUDENTS_RANGE);

  students.clear();

  const rows = data.values || [];

  /*
       Expected:

       roll_no | name | token

       Skip header.
    */

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (!row || row.length < 3) {
      continue;
    }

    const roll = String(row[0] || "")
      .trim()
      .toUpperCase();

    const name = String(row[1] || "").trim();

    const token = String(row[2] || "").trim();

    if (!roll || !token) {
      continue;
    }

    students.set(token, {
      roll,
      name,
    });
  }

  document.getElementById("studentCount").textContent = students.size;
}

/* =========================================================
     LOAD ATTENDANCE
     ========================================================= */

async function loadAttendanceData() {
  const data = await sheetsGet(ATTENDANCE_RANGE);

  attendanceKeys.clear();

  attendanceRecords = [];

  const rows = data.values || [];

  /*
       Expected:

       timestamp | date | roll_no | name | status | session

       Skip header.
    */

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (!row || row.length < 6) {
      continue;
    }

    const date = String(row[1] || "").trim();

    const roll = String(row[2] || "")
      .trim()
      .toUpperCase();

    const name = String(row[3] || "").trim();

    const status = String(row[4] || "").trim();

    const session = String(row[5] || "").trim();

    if (!date || !roll || !session) {
      continue;
    }

    /*
         Attendance contains only PRESENT rows.
      */

    const key = makeAttendanceKey(date, roll, session);

    attendanceKeys.add(key);

    attendanceRecords.push({
      date,
      roll,
      name,
      status,
      session,
    });
  }

  updateSessionStats();
}

/* =========================================================
     LOAD EVERYTHING
     ========================================================= */

async function loadData() {
  if (!accessToken) {
    alert("Please sign in with Google first.");

    return;
  }

  try {
    showAuthStatus("Loading student and attendance data...", "info");

    await loadStudents();

    await loadAttendanceData();

    showAuthStatus(
      "Student and attendance data loaded successfully.",
      "success-status",
    );

    document.getElementById("startBtn").disabled = false;
  } catch (error) {
    console.error(error);

    showAuthStatus(error.message, "error");
  }
}

async function reloadAttendance() {
  if (!accessToken) {
    return;
  }

  try {
    await loadAttendanceData();

    showAuthStatus("Attendance data refreshed.", "success-status");
  } catch (error) {
    console.error(error);

    showAuthStatus(error.message, "error");
  }
}

/* =========================================================
     SESSION STATISTICS
     ========================================================= */

function updateSessionStats() {
  const today = getIndiaDate();

  const session = normalizeSession(getSession());

  if (!session) {
    document.getElementById("presentCount").textContent = "0";

    return;
  }

  const presentRolls = new Set();

  for (const record of attendanceRecords) {
    if (record.date === today && normalizeSession(record.session) === session) {
      presentRolls.add(record.roll);
    }
  }

  document.getElementById("presentCount").textContent = presentRolls.size;
}

/* =========================================================
     QR SCANNER
     ========================================================= */

async function startScanner() {
  const session = getSession();

  if (!session) {
    showResult(
      "Please enter the lecture/session before starting the scanner.",
      "warning-result",
    );

    return;
  }

  if (students.size === 0) {
    showResult("Please load student data first.", "warning-result");

    return;
  }

  if (scannerRunning) {
    return;
  }

  scanner = new Html5Qrcode("reader");

  try {
    await scanner.start(
      {
        facingMode: "environment",
      },

      {
        fps: 10,

        qrbox: {
          width: 250,
          height: 250,
        },
      },

      handleQrScan,

      () => {
        // Ignore continuous QR scanning errors.
      },
    );

    scannerRunning = true;

    document.getElementById("startBtn").disabled = true;

    document.getElementById("stopBtn").disabled = false;

    showResult("Camera started. Scan a student's QR code.", "warning-result");
  } catch (error) {
    console.error(error);

    showResult("Unable to start camera: " + error.message, "error-result");
  }
}

async function stopScanner() {
  if (!scanner || !scannerRunning) {
    return;
  }

  try {
    await scanner.stop();

    await scanner.clear();
  } catch (error) {
    console.error(error);
  }

  scannerRunning = false;

  document.getElementById("startBtn").disabled = false;

  document.getElementById("stopBtn").disabled = true;
}

/* =========================================================
     QR SCAN HANDLER
     ========================================================= */

async function handleQrScan(decodedText) {
  if (processingScan) {
    return;
  }

  processingScan = true;

  try {
    await processToken(decodedText);
  } catch (error) {
    console.error(error);

    showResult(error.message, "error-result");
  }

  /*
       Prevent the same QR from triggering many
       times within milliseconds.
    */

  setTimeout(() => {
    processingScan = false;
  }, 1200);
}

/* =========================================================
     PROCESS QR TOKEN
     ========================================================= */

async function processToken(rawToken) {
  const token = String(rawToken || "").trim();

  /*
       Basic format check.

       Expected:

       SIS1|ROLL|SIGNATURE
    */

  if (!token.startsWith("SIS1|")) {
    showResult("Invalid QR code.", "error-result");

    return;
  }

  /*
       Find exact token in Students!C:C.

       We deliberately do NOT expose the HMAC secret
       in this frontend.
    */

  const student = students.get(token);

  if (!student) {
    showResult("QR code is not registered for this course.", "error-result");

    return;
  }

  const session = getSession();

  if (!session) {
    showResult("Please enter the lecture/session first.", "warning-result");

    return;
  }

  const date = getIndiaDate();

  const key = makeAttendanceKey(date, student.roll, session);

  /*
       IMPORTANT:

       Duplicate is ONLY:

       same date
       +
       same lecture/session
       +
       same student
    */

  if (attendanceKeys.has(key)) {
    showResult(
      `
          <div class="student-name">
            Already Marked
          </div>

          <div class="student-roll">
            ${escapeHtml(student.roll)}
          </div>

          <div>
            ${escapeHtml(student.name)}
          </div>

          <div style="margin-top:8px;">
            Session: ${escapeHtml(session)}
          </div>
        `,

      "warning-result",
    );

    return;
  }

  /*
       Add attendance to Google Sheet.
    */

  const timestamp = getIndiaTimestamp();

  await sheetsAppend([
    [timestamp, date, student.roll, student.name, "Present", session],
  ]);

  /*
       Update local state immediately.
    */

  attendanceKeys.add(key);

  attendanceRecords.push({
    date,
    roll: student.roll,
    name: student.name,
    status: "Present",
    session,
  });

  updateSessionStats();

  showResult(
    `
        <div class="student-name">
          ✓ Attendance Marked
        </div>

        <div class="student-roll">
          ${escapeHtml(student.roll)}
        </div>

        <div>
          ${escapeHtml(student.name)}
        </div>

        <div style="margin-top:8px;">
          Session: ${escapeHtml(session)}
        </div>
      `,

    "success-result",
  );
}

/* =========================================================
     DISPLAY RESULT
     ========================================================= */

function showResult(message, className) {
  const element = document.getElementById("scanResult");

  element.innerHTML = message;

  element.className = "result " + className;
}

/* =========================================================
     HTML ESCAPING
     ========================================================= */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
     INITIALIZATION
     ========================================================= */

window.addEventListener("load", () => {
  /*
         Wait for Google Identity Services
         to become available.
      */

  if (typeof google !== "undefined" && google.accounts) {
    initializeGoogleAuth();
  } else {
    setTimeout(initializeGoogleAuth, 1000);
  }
});
