# HTML Timetable Manager

A purely client-side browser application for Principals and Administrators to design, generate, and manage school timetables seamlessly.

## Workflow for the Principal

The application stores all imported setup data securely in your browser's `localStorage`. To set up and generate a timetable from scratch, the Principal or Administrator should follow these exact steps and import the respective files in order:

### 1. Setup the Foundation (Master Data)
Navigate to the **Setup** section in the sidebar to define the core structural data of the school. You will need to import the following three files:
*   **Step 1.1: Bulk Classes & Sections**
    *   **File to Import:** `class-sections.csv`
    *   **Action:** Upload your CSV to establish the grades and sections in your school (e.g., Grade-I-A, Grade-I-B). You can also add them manually.
*   **Step 1.2: Bulk Subjects**
    *   **File to Import:** `subjects-code.csv`
    *   **Action:** Upload your CSV to establish all available subjects and their codes.
*   **Step 1.3: Teacher List**
    *   **File to Import:** `teacher-list.csv`
    *   **Action:** Upload your CSV to register all faculty members with their basic contact details and class teacher assignments.

### 2. Configure the Timetable Parameters
In the **Timetable Configuration** panel under Setup, set your scheduling constraints:
*   **School Days:** Select the operating days (e.g., Monday to Saturday).
*   **Periods per Day:** Set how many periods are in a standard day.
*   **Max Periods Per Teacher:** Determine the maximum workload any individual teacher can be assigned per week.

### 3. Define Lab Blocks (Optional)
If your school has continuous practical/lab sessions that span multiple periods:
*   **File to Import:** `lab-blocks.csv`
*   **Action:** Go to the **Lab Blocks** panel in the Setup section and upload the CSV to define which subjects require block periods and how long they should be.

### 4. Import Teacher-Subject Mappings (Crucial Step)
Go to the **Teacher Grade-Section Subject Mapping** panel. This step tells the system who teaches what, where, and how often.
*   **File to Import:** `teacher-mapping.csv` (or `teacher-mapping-combined.csv` for shared classes)
*   **Action:** Upload the CSV mapping file. This file contains:
    *   Which Teacher teaches which Subject to which Grade-Section.
    *   **Periods Per Week:** How many periods this mapping requires.
    *   **Fixed Periods:** Specific locked periods (e.g., `1` for P1, `5,6` for P5 and P6).
    *   **Mode:** Whether the class is Individual (`0`) or Combined (`1`) (where multiple classes share the same teacher simultaneously).

### 5. Save and Generate
*   Once all data is imported from the CSV files and looks correct in the UI tables, click **Save Changes** at the top right.
*   Click **Generate Timetable**. The built-in scheduling engine will automatically construct a complete, conflict-free timetable honoring your mappings, fixed periods, lab blocks, and combined classes.

### 6. Review and Refine
Navigate to the **View** section to visually inspect the results:
*   **Teacher View:** Ensure no teacher is double-booked and verify their workloads.
*   **Class View:** Ensure all periods are filled correctly for every class.
*   **Subject View:** Track subject distributions across the week.

*(Optional Alternative)*: If you prefer to generate the timetable externally, you can use the **AI Prompt** tab to copy a prompt to feed into an LLM (like ChatGPT or Claude), and then use **Upload Timetable** to import the generated CSV.

---

## Required CSV Formats

### 1. Class Sections CSV
```csv
Class,Section,Teaching Mode,Combined Group
Grade-I,A,,
Grade-I,B,,
```

### 2. Subjects CSV
```csv
Subject Code,Subject Name
MTH,Maths
ENG,English
SCI,Science
```

### 3. Teacher List CSV
```csv
Teacher ID,Teacher Name,Class Teacher Subject,Class Teacher Grade,Class Teacher Section,Phone,Email
T001,Indira,MTH,Grade-I,A,9876543210,indira@school.com
T002,Sai Priya,EVS,Grade-I,B,,
```

### 4. Teacher Grade-Section Subject Mapping CSV
```csv
Teacher ID,Grade-Section,Subject,Periods Per Week,Fixed Periods,Mode
T001,Grade-I-A,MTH,5,,0
T002,Grade-I-A,EVS,4,1,0
T003,Grade-V-A;Grade-V-B,PT,2,,1
```

---

## Output CSV Format
If you choose to upload a manually generated timetable or one from an AI, ensure it follows this strict CSV format:

```csv
Class-Section,Day,P1,P2,P3,P4,P5,P6,P7,P8
Grade-I-A,Monday,T001:Indira:MTH,T002:Sai:EVS,,,,,,,
```

### Cell Separator Rules (Important)
*   Use this structure strictly: `TeacherID:TeacherName:Subject`
*   `:` separates TeacherID and TeacherName
*   `:` separates TeacherName and Subject
*   `-` separates Class and Section (e.g., `Grade-I-A`)

## Excel Upload Formats
Supported Excel formats for uploading existing timetables:
*   `Standard (Sheet-per-Class)`: One sheet per class, row-wise day timetable.
*   `STATE TIME TABLE (19.07.2025)`: Teacher-wise matrix with day blocks and period numbers.

Before uploading an Excel file, choose the matching format from the Excel Format dropdown in the Upload section.
