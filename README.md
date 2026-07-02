## First-Time Setup: Importing Data
1 Teacher List: Go to Teacher List, click Import Teachers CSV, and upload teacher-list.csv from the Sample Data folder.
2 Teacher Grade-Section Subject Mapping: Go to Teacher Grade-Section Subject Mapping, click Import Mapping CSV, and upload teacher-mapping-final.csv from the Sample Data folder.
3 Bulk Subjects: Go to Bulk Subjects and upload subject-code-final.csv from the Sample Data folder.

# HTML Timetable Manager

A browser-based timetable management app for school principals and administrators to create, generate, review, and modify class timetables.

## Overview

This project helps a school manage timetable data from setup to generation using only client-side files and browser storage. It supports class sections, subject master data, teacher master data, teacher-subject mappings, combined classes, fixed periods, and lab blocks.[1][2]

The timetable generator is designed to produce a conflict-free timetable by checking teacher clashes, class-slot clashes, fixed slots, lab-slot rules, and per-teacher weekly workload limits.[1][2]

## Features

- Import class sections, subjects, teachers, teacher mappings, lab blocks, and existing timetables.[1][2]
- Generate timetables using built-in scheduling logic.[1][2]
- Support fixed periods such as `P1` or `P1-P2`.[1][2]
- Support combined classes where multiple sections are taught together in the same slot.[1][2]
- Support lab-style consecutive allocations such as `P1-P2` and `P6-P7` for lab subjects.[3][2]
- Detect and report unscheduled mappings when all requested periods cannot be placed.[2]
- View timetable by class, teacher, or subject.[1][2]
- Modify timetable entries and export data files.[1][2]

## Setup workflow

Follow this order when preparing data:

1. Import or create class sections.
2. Import subject codes and names.
3. Import teacher master data.
4. Import teacher grade-section subject mappings.
5. Optionally import lab block rules.
6. Configure school days, periods per day, and maximum periods per teacher.
7. Save setup data.
8. Generate the timetable.[1][2]

## Required data files

### 1. Class sections

CSV columns:

```csv
Class,Section,Teaching Mode,Combined Group
Grade-I,A,,
Grade-I,B,,
```

### 2. Subjects

CSV columns:

```csv
Subject Code,Subject Name
MTH,Maths
ENG,English
SCI,Science
```

### 3. Teacher list

CSV columns:

```csv
Teacher ID,Teacher Name,Class Teacher Subject,Class Teacher Grade,Class Teacher Section,Phone,Email
T001,Indira,MTH,Grade-I,A,9876543210,indira@school.com
```

### 4. Teacher mappings

CSV columns:

```csv
Teacher ID,Grade-Section,Subject,Periods Per Week,Fixed Periods,Mode
T001,Grade-I-A,MTH,5,,0
T002,Grade-I-A,EVS,4,P1,0
T003,"Grade-V-A,Grade-V-B",PT,2,,1
```

### 5. Lab blocks

Use lab block data when a subject must be placed in consecutive periods such as `P1-P2` or `P6-P7`.[1][4]

## Scheduling rules

The generator follows these rules:

- A teacher cannot be assigned to two classes in the same day and period.[1][2]
- A class cannot receive more than one subject in the same slot.[2]
- Fixed periods must be respected exactly when provided in mappings.[1][2]
- Combined classes must share the same day and period for the mapped teacher and subject.[1][2]
- Lab subjects should be scheduled in consecutive blocks, based on configured lab logic.[3][4][2]
- Each teacher must stay within the configured weekly maximum load.[1][2]
- If a mapping cannot be fully scheduled, it is reported as unscheduled instead of being silently converted to a break period.[2]

## Generation flow

The current generation logic should follow this order:

1. Build an empty timetable.
2. Place fixed tasks first.
3. Place fixed combined tasks.
4. Place lab blocks.
5. Place class-teacher `P1` tasks after lab placement.
6. Place combined normal tasks.
7. Place normal tasks.
8. Retry remaining unscheduled periods in empty teaching slots.
9. Save the timetable and show any remaining shortages.[2]

This order improves fill rate because the most constrained tasks are scheduled before flexible ones.[2]

## Important implementation notes

- Empty teaching slots should not be displayed as `BREAK` unless they are actual configured break or lunch periods in the timetable structure.[5][6][2]
- `CSL` should be treated as a lab subject, while `CSC` should remain a normal subject unless explicitly configured otherwise.[3][2]
- Before generation, the app should validate teacher demand against the configured weekly load limit so impossible datasets are detected early.[3][2]
- If total subject demand for a teacher exceeds the allowed weekly periods, the timetable cannot be fully filled until the data or config is corrected.[3][2]

## Why unfilled periods happen

Unfilled periods usually happen for one of these reasons:

- Teacher weekly load is too low for the total assigned mappings.[3][2]
- Too many fixed slots reduce available placement options.[3][2]
- A combined class or lab block consumes limited shared slots.[1][2]
- The input data is not feasible with the current number of days, periods, and teachers.[2]

## Recommended validation checks

Before generating a timetable, verify:

- Every class has enough total periods available in the week.
- Every subject mapping has a valid teacher ID, class, subject, and periods-per-week value.
- Every fixed period refers to a valid period number.
- Combined mappings refer to compatible class groups.
- Teacher total requested periods do not exceed the configured maximum weekly load.[1][2]

## Output

Generated timetable CSV format:

```csv
Class-Section,Day,P1,P2,P3,P4,P5,P6,P7,P8
Grade-I-A,Monday,T001|Indira|MTH,T002|Sai Priya|EVS,,,,,,
```

Use the format `TeacherID|TeacherName|Subject` in each timetable cell.[1]

## Storage

The application stores working data in browser `localStorage`, including timetable data, configuration, teacher data, subject data, class sections, and holidays.[1][2]

## Current limitations

- The app is fully client-side and depends on browser storage.[1][2]
- If input data is infeasible, some mappings will remain unscheduled unless validation blocks generation first.[2]
- A strong final repair pass is needed to improve fill quality for difficult datasets.[2]

## Recommended next improvements

- Add a feasibility validator before generation.
- Sort tasks by difficulty before scheduling.
- Add swap-based repair logic for remaining unscheduled periods.
- Add explicit break/lunch configuration separate from teaching slots.
- Show a detailed generation report with overload reasons per teacher and per class.[2]
