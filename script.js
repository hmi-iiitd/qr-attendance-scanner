/* =========================================================
     CONFIGURATION
     ========================================================= */

const STUDENTS_RANGE = "Students!A:C";

const ATTENDANCE_RANGE = "Attendance!A:F";

const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

function getConfig() {
  const cfg = window.ATTENDANCE_CONFIG || {};

  return {
    CLIENT_ID: String(cfg.CLIENT_ID || "").trim(),
    SPREADSHEET_ID: String(cfg.SPREADSHEET_ID || "").trim(),
    COURSE_NAME: String(cfg.COURSE_NAME || "").trim(),
    HOSTED_DOMAIN: String(cfg.HOSTED_DOMAIN || "iiitd.ac.in").trim(),
  };
}

function isPlaceholder(value, marker) {
  return !value || value.toUpperCase().includes(marker);
}

function isConfigured() {
  const cfg = getConfig();

  return (
    !isPlaceholder(cfg.CLIENT_ID, "YOUR_CLIENT") &&
    !isPlaceholder(cfg.SPREADSHEET_ID, "YOUR_SPREADSHEET")
  );
}

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

function setConnectedUi() {
  const button = document.getElementById("authorizeBtn");

  button.textContent = "Reconnect Google";
  button.disabled = false;

  document.getElementById("loadBtn").disabled = false;
  document.getElementById("refreshBtn").disabled = false;
}

function resetAuthUi(message) {
  accessToken = null;

  const button = document.getElementById("authorizeBtn");

  button.textContent = "Sign in with Google";
  button.disabled = false;

  document.getElementById("loadBtn").disabled = true;
  document.getElementById("refreshBtn").disabled = true;

  if (message) {
    showAuthStatus(message, "error");
  }
}

function initializeGoogleAuth() {
  if (!isConfigured()) {
    resetAuthUi(
      "Edit config.js with this course CLIENT_ID and SPREADSHEET_ID, then reload.",
    );

    document.getElementById("authorizeBtn").disabled = true;

    return;
  }

  const cfg = getConfig();

  const clientConfig = {
    client_id: cfg.CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        resetAuthUi("Google authorization failed. Try signing in again.");

        return;
      }

      accessToken = response.access_token;

      setConnectedUi();

      showAuthStatus(
        "Google account connected. Load student data next.",
        "success-status",
      );
    },
    error_callback: () => {
      resetAuthUi("Google authorization was cancelled or failed.");
    },
  };

  if (cfg.HOSTED_DOMAIN) {
    clientConfig.hosted_domain = cfg.HOSTED_DOMAIN;
  }

  tokenClient = google.accounts.oauth2.initTokenClient(clientConfig);
}

function authorizeGoogle() {
  if (!isConfigured()) {
    resetAuthUi(
      "Edit config.js with this course CLIENT_ID and SPREADSHEET_ID, then reload.",
    );

    return;
  }

  if (!tokenClient) {
    initializeGoogleAuth();
  }

  if (!tokenClient) {
    return;
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

function describeSheetsError(status, fallbackPrefix, responseText) {
  if (status === 401) {
    resetAuthUi();

    return "Google authorization expired. Sign in again, then retry.";
  }

  if (status === 403) {
    return (
      "This Google account cannot access the course spreadsheet. " +
      "Ask the instructor to Share it with your @iiitd.ac.in account as Editor. " +
      "Do not share the sheet with students."
    );
  }

  if (status === 404) {
    return "Spreadsheet not found. Check SPREADSHEET_ID in config.js.";
  }

  return fallbackPrefix + (responseText || status);
}

async function sheetsGet(range) {
  if (!accessToken) {
    throw new Error("Google account is not authorized.");
  }

  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    getConfig().SPREADSHEET_ID +
    "/values/" +
    encodeURIComponent(range);

  const response = await fetch(url, {
    method: "GET",

    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(describeSheetsError(response.status, "Google Sheets error: ", text));
  }

  return await response.json();
}

async function sheetsAppend(rows) {
  if (!accessToken) {
    throw new Error("Google account is not authorized.");
  }

  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    getConfig().SPREADSHEET_ID +
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

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      describeSheetsError(response.status, "Unable to write attendance: ", text),
    );
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
     DATE NORMALIZATION
     ========================================================= */

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const str = String(value).trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Handle DD/MM/YYYY
  const slashMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (slashMatch) {
    const day = slashMatch[1];
    const month = slashMatch[2];
    const year = slashMatch[3];

    return `${year}-${month}-${day}`;
  }

  // Handle Google Sheets / Excel serial dates
  const serial = Number(str);

  if (!isNaN(serial) && serial > 0) {
    const date = new Date(
      Date.UTC(1899, 11, 30) + serial * 86400000
    );

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return str;
}


/* =========================================================
     ATTENDANCE KEY
     ========================================================= */

function makeAttendanceKey(date, roll, session) {
  return (
    normalizeDate(date) +
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

    const date = normalizeDate(row[1]);

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

function applyCourseBranding() {
  const courseName = getConfig().COURSE_NAME;

  if (!courseName || courseName.toUpperCase().includes("CSEXXX")) {
    return;
  }

  document.title = courseName + " – Attendance Scanner";

  const title = document.getElementById("pageTitle");
  const subtitle = document.getElementById("pageSubtitle");

  if (title) {
    title.textContent = courseName;
  }

  if (subtitle) {
    subtitle.textContent = "Scan student QR codes to record attendance";
  }
}

window.addEventListener("load", () => {
  applyCourseBranding();

  if (typeof google !== "undefined" && google.accounts) {
    initializeGoogleAuth();
  } else {
    setTimeout(initializeGoogleAuth, 1000);
  }
});
