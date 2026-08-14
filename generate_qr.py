#!/usr/bin/env python3
"""
Generate one unique QR code per student.

The QR contains plain text only:

    SIS1|<ROLL NO>|<RANDOM TOKEN>

The token is randomly generated and stored in tokens.csv.
The attendance scanner validates the token by checking it against
the Students sheet.

Usage:
    pip install -r requirements.txt
    python generate_qr.py students.csv

Input students.csv format (header row required):

    roll_no,name
    CS21-014,Aarav Sharma
    CS21-015,Diya Menon

Outputs:
    qr_codes/<ROLL>.png   -> one QR image per student
    tokens.csv            -> roll_no,name,token
    print_sheet.html      -> printable QR card sheet
"""

import csv
import html
import os
import secrets
import string
import sys


PREFIX = "SIS1"
OUT_DIR = "qr_codes"


def make_token(roll_no: str) -> str:
    """
    Generate a unique random token for a student.

    Example:
        SIS1|CS21-014|A7K92X4PQM8Z3N5T
    """

    roll_no = roll_no.strip().upper()

    alphabet = string.ascii_uppercase + string.digits
    random_part = "".join(secrets.choice(alphabet) for _ in range(16))

    return f"{PREFIX}|{roll_no}|{random_part}"


def read_students(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    students = []
    seen = set()

    for row in rows:
        roll = (row.get("roll_no") or "").strip().upper()
        name = (row.get("name") or "").strip()

        if not roll:
            continue

        if roll in seen:
            print(f"Duplicate roll number skipped: {roll}")
            continue

        seen.add(roll)

        students.append(
            {
                "roll_no": roll,
                "name": name,
                "token": make_token(roll),
            }
        )

    return students


def write_qr_images(students):
    import qrcode
    from qrcode.constants import ERROR_CORRECT_Q

    os.makedirs(OUT_DIR, exist_ok=True)

    for student in students:
        qr = qrcode.QRCode(
            version=None,
            error_correction=ERROR_CORRECT_Q,
            box_size=10,
            border=3,
        )

        qr.add_data(student["token"])
        qr.make(fit=True)

        img = qr.make_image(
            fill_color="black",
            back_color="white",
        )

        safe_roll = "".join(
            c if c.isalnum() or c in "-_" else "_"
            for c in student["roll_no"]
        )

        output_path = os.path.join(
            OUT_DIR,
            f"{safe_roll}.png",
        )

        img.save(output_path)


def write_tokens_csv(students):
    with open(
        "tokens.csv",
        "w",
        newline="",
        encoding="utf-8",
    ) as f:
        writer = csv.writer(f)

        writer.writerow(
            [
                "roll_no",
                "name",
                "token",
            ]
        )

        for student in students:
            writer.writerow(
                [
                    student["roll_no"],
                    student["name"],
                    student["token"],
                ]
            )


def write_print_sheet(students):
    cards = []

    for student in students:
        safe_roll = "".join(
            c if c.isalnum() or c in "-_" else "_"
            for c in student["roll_no"]
        )

        cards.append(
            f"""
            <div class="card">
                <img
                    src="{OUT_DIR}/{safe_roll}.png"
                    alt="QR Code"
                >

                <div class="roll">
                    {html.escape(student["roll_no"])}
                </div>

                <div class="name">
                    {html.escape(student["name"])}
                </div>
            </div>
            """
        )

    document = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Attendance QR Cards</title>

    <style>
        @page {{
            margin: 12mm;
        }}

        body {{
            font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                sans-serif;

            margin: 0;
        }}

        .grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6mm;
        }}

        .card {{
            border: 1px dashed #999;
            border-radius: 4px;
            padding: 6mm 4mm;
            text-align: center;
            break-inside: avoid;
        }}

        .card img {{
            width: 38mm;
            height: 38mm;
        }}

        .roll {{
            font-family:
                ui-monospace,
                Menlo,
                Consolas,
                monospace;

            font-size: 11pt;
            font-weight: 700;
            margin-top: 3mm;
            letter-spacing: 0.04em;
        }}

        .name {{
            font-size: 9pt;
            margin-top: 1mm;
        }}
    </style>
</head>

<body>

    <div class="grid">
        {"".join(cards)}
    </div>

</body>
</html>
"""

    with open(
        "print_sheet.html",
        "w",
        encoding="utf-8",
    ) as f:
        f.write(document)


def main():
    if len(sys.argv) < 2:
        sys.exit(
            "Usage: python generate_qr.py students.csv"
        )

    students = read_students(sys.argv[1])

    if not students:
        sys.exit(
            "No students found. "
            "Check that the CSV contains roll_no and name columns."
        )

    write_qr_images(students)
    write_tokens_csv(students)
    write_print_sheet(students)

    print(f"{len(students)} students processed.")
    print()
    print(f"QR images   -> {OUT_DIR}/")
    print("Token list  -> tokens.csv")
    print("Print cards -> print_sheet.html")
    print()
    print(
        "Copy the contents of tokens.csv into "
        "the Students sheet of the course spreadsheet."
    )


if __name__ == "__main__":
    main()