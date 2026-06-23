        // Application state
        const state = {
            timetableData: null,
            holidays: [],
            currentView: 'class',
            selectedPeriods: [],
            rescheduleMode: false,
            currentYear: '2026',
            periodTimes: {},
            fileType: 'excel',
            excelFormat: 'legacy',
            overlapCheckInProgress: false,
            teacherSubjectMap: {},
            teachers: [],
            teacherMappings: [],
            classSections: [],
            subjects: [],
            config: {
                schoolDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                periodsPerDay: 8,
                periodsPerTeacher: 30,
                aiPromptStyle: 'compact'
            }
        };
        
        // Sample data for demonstration
        const sampleHolidays = [
            { id: 1, name: "New Year's Day", date: "2026-01-01", type: "public", description: "Celebration of the new year" },
            { id: 2, name: "Republic Day", date: "2026-01-26", type: "public", description: "Celebration of the adoption of the Constitution" },
            { id: 3, name: "Summer Break", date: "2026-05-15", type: "school", description: "Summer vacation for students" },
            { id: 4, name: "Independence Day", date: "2026-08-15", type: "public", description: "Celebration of India's independence" },
            { id: 5, name: "Diwali", date: "2026-10-29", type: "optional", description: "Festival of lights" },
            { id: 6, name: "Christmas", date: "2026-12-25", type: "public", description: "Celebration of Christmas" }
        ];
        
        // Initialize the application
        document.addEventListener('DOMContentLoaded', function() {
            // Load data from localStorage if available
            loadFromLocalStorage();
            
            // Set up tab navigation
            setupTabs();
            
            // Set up event listeners
            setupEventListeners();
            
            // Initialize the UI
            initUI();
        });
        
        // Load data from localStorage
        function loadFromLocalStorage() {
            const storedTimetable = localStorage.getItem('schoolTimetable');
            const storedHolidays = localStorage.getItem('schoolHolidays');
            const storedPeriodTimes = localStorage.getItem('periodTimes');
            const storedTeacherSubjectMap = localStorage.getItem('teacherSubjectMap');
            const storedTeachers = localStorage.getItem('teacherMasterList');
            const storedTeacherMappings = localStorage.getItem('teacherGradeSubjectMappings');
            const storedConfig = localStorage.getItem('timetableConfig');
            const storedClassSections = localStorage.getItem('classSections');
            
            if (storedTimetable) {
                state.timetableData = JSON.parse(storedTimetable);
            }
            
            if (storedHolidays) {
                state.holidays = JSON.parse(storedHolidays);
            } else {
                // Use sample holidays if none stored
                state.holidays = sampleHolidays;
                saveHolidaysToStorage();
            }
            
            if (storedPeriodTimes) {
                state.periodTimes = JSON.parse(storedPeriodTimes);
            }
            
            if (storedTeacherSubjectMap) {
                state.teacherSubjectMap = JSON.parse(storedTeacherSubjectMap);
            }

            if (storedTeachers) {
                state.teachers = JSON.parse(storedTeachers);
            }

            if (storedTeacherMappings) {
                state.teacherMappings = JSON.parse(storedTeacherMappings);
            }

            const storedSubjects = localStorage.getItem('subjects');
            if (storedClassSections) {
                try {
                    const parsed = JSON.parse(storedClassSections) || [];
                    state.classSections = (parsed || []).map(item => {
                        // support legacy string entries and object entries
                        if (!item) return null;
                        if (typeof item === 'string') {
                            // expected formats: 'Class-10-A' or '10-A' or '10:A'
                            const s = item.trim();
                            const parts = s.split(/[-:]/).filter(Boolean);
                            if (parts.length >= 3 && parts[0].toLowerCase() === 'class') {
                                return { className: `Class-${parts[1]}-${parts[2]}`, class: parts[1], section: parts[2] };
                            } else if (parts.length >= 2) {
                                return { className: `Class-${parts[0]}-${parts[1]}`, class: parts[0], section: parts[1] };
                            }
                            return null;
                        }
                        if (typeof item === 'object') {
                            // already structured
                            if (item.className && item.section) return item;
                            const cls = item.class || item.grade || item.gradeSection || '';
                            const sec = item.section || item.sec || '';
                            if (cls && sec) return { className: `Class-${cls}-${sec}`, class: cls, section: sec };
                            return null;
                        }
                        return null;
                    }).filter(Boolean);
                } catch(e) {
                    state.classSections = [];
                }
            }
            if (storedSubjects) {
                try {
                    const parsedSubjects = JSON.parse(storedSubjects) || [];
                    state.subjects = (parsedSubjects || [])
                        .map(item => {
                            if (typeof item === 'string') return { code: toCleanString(item), name: toCleanString(item) };
                            if (item && typeof item === 'object') return { code: toCleanString(item.code || item.name), name: toCleanString(item.name || item.code) };
                            return null;
                        })
                        .filter(s => s && s.code)
                        .sort((a, b) => safeLocaleCompare(a.code, b.code));
                } catch(e) {
                    state.subjects = [];
                }
            }

            if (storedConfig) {
                state.config = {
                    ...state.config,
                    ...JSON.parse(storedConfig)
                };
            }
        }
        
        // Save timetable to localStorage
        function saveTimetableToStorage() {
            if (state.timetableData) {
                localStorage.setItem('schoolTimetable', JSON.stringify(state.timetableData));
            }
        }
        
        // Save holidays to localStorage
        function saveHolidaysToStorage() {
            localStorage.setItem('schoolHolidays', JSON.stringify(state.holidays));
        }
        
        // Save period times to localStorage
        function savePeriodTimesToStorage() {
            localStorage.setItem('periodTimes', JSON.stringify(state.periodTimes));
        }
        
        function saveTeacherSubjectMapToStorage() {
            localStorage.setItem('teacherSubjectMap', JSON.stringify(state.teacherSubjectMap || {}));
        }

        function saveMasterDataToStorage() {
            localStorage.setItem('teacherMasterList', JSON.stringify(state.teachers || []));
            localStorage.setItem('teacherGradeSubjectMappings', JSON.stringify(state.teacherMappings || []));
            localStorage.setItem('timetableConfig', JSON.stringify(state.config || {}));
            localStorage.setItem('classSections', JSON.stringify(state.classSections || []));
            localStorage.setItem('subjects', JSON.stringify(state.subjects || []));
        }
        
        // Set up tab navigation
        function setupTabs() {
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    const targetId = this.getAttribute('data-target');
                    
                    // Remove active class from all tabs and sections
                    tabs.forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.content-section').forEach(section => {
                        section.classList.remove('active');
                    });
                    
                    // Add active class to clicked tab and corresponding section
                    this.classList.add('active');
                    document.getElementById(targetId).classList.add('active');
                });
            });
        }
        
        // Set up event listeners
        function setupEventListeners() {
            // Dashboard button
            document.getElementById('dashboardBtn').addEventListener('click', function() {
                alert("Redirecting to Dashboard...");
            });

            // Local setup and AI prompt
            document.getElementById('teacherListFileInput').addEventListener('change', handleTeacherListUpload);
            const exportBtn = document.getElementById('exportTeachersBtn');
            if (exportBtn) exportBtn.addEventListener('click', exportTeacherList);
            document.getElementById('teacherMappingFileInput').addEventListener('change', handleTeacherMappingUpload);
            document.getElementById('addTeacherRowBtn').addEventListener('click', addTeacherRow);
            document.getElementById('addMappingRowBtn').addEventListener('click', addMappingRow);
            const genClassesBtn = document.getElementById('generateClassSectionsBtn');
            if (genClassesBtn) genClassesBtn.addEventListener('click', generateClassSectionsFromInput);
            const clearClassesBtn = document.getElementById('clearClassSectionsBtn');
            if (clearClassesBtn) clearClassesBtn.addEventListener('click', clearClassSections);
            const exportClassesBtn = document.getElementById('exportClassSectionsBtn');
            if (exportClassesBtn) exportClassesBtn.addEventListener('click', exportClassSectionsCSV);
            const importClassesInput = document.getElementById('importClassSectionsFile');
            if (importClassesInput) importClassesInput.addEventListener('change', handleImportClassSectionsCSV);
            const genSubjectsBtn = document.getElementById('generateSubjectsBtn');
            if (genSubjectsBtn) genSubjectsBtn.addEventListener('click', generateSubjectsFromInput);
            const clearSubjectsBtn = document.getElementById('clearSubjectsBtn');
            if (clearSubjectsBtn) clearSubjectsBtn.addEventListener('click', clearSubjects);
            const exportSubjectsBtn = document.getElementById('exportSubjectsBtn');
            if (exportSubjectsBtn) exportSubjectsBtn.addEventListener('click', exportSubjectsCSV);
            const importSubjectsInput = document.getElementById('importSubjectsFile');
            if (importSubjectsInput) importSubjectsInput.addEventListener('change', handleImportSubjectsCSV);
            document.getElementById('saveMasterDataBtn').addEventListener('click', saveMasterDataFromTables);
            document.getElementById('downloadDataTemplatesBtn').addEventListener('click', downloadMasterDataTemplates);
            document.getElementById('generatePromptBtn').addEventListener('click', renderAIPrompt);
            document.getElementById('copyPromptBtn').addEventListener('click', copyAIPrompt);
            document.getElementById('downloadPromptBtn').addEventListener('click', downloadAIPrompt);
            ['schoolDaysInput', 'periodsPerDayInput', 'periodsPerTeacherInput', 'aiPromptStyleInput'].forEach(id => {
                document.getElementById(id).addEventListener('change', function() {
                    syncConfigFromInputs();
                    saveMasterDataToStorage();
                    updateSetupSummary();
                    renderAIPrompt();
                });
            });
            
            // Holiday management
            document.getElementById('addHolidayBtn').addEventListener('click', openAddHolidayModal);
            document.getElementById('addFirstHolidayBtn').addEventListener('click', openAddHolidayModal);
            document.getElementById('exportHolidaysBtn').addEventListener('click', exportHolidays);
            document.getElementById('yearSelect').addEventListener('change', function() {
                state.currentYear = this.value;
                renderHolidays();
            });
            
            // Holiday modal
            document.getElementById('closeHolidayModal').addEventListener('click', closeAddHolidayModal);
            document.getElementById('cancelHolidayBtn').addEventListener('click', closeAddHolidayModal);
            document.getElementById('saveHolidayBtn').addEventListener('click', saveHoliday);
            
            // File type selector
            document.querySelectorAll('.file-type-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.file-type-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    state.fileType = this.getAttribute('data-type');
                    
                    // Show/hide appropriate upload areas
                    document.getElementById('excelUploadArea').style.display = state.fileType === 'excel' ? 'block' : 'none';
                    document.getElementById('csvUploadArea').style.display = state.fileType === 'csv' ? 'block' : 'none';
                });
            });
            
            // View timetable
            document.querySelectorAll('.view-option').forEach(option => {
                option.addEventListener('click', function() {
                    document.querySelectorAll('.view-option').forEach(o => o.classList.remove('active'));
                    this.classList.add('active');
                    state.currentView = this.getAttribute('data-view');
                    
                    // Show/hide appropriate filters
                    const classFilter = document.getElementById('classFilter');
                    const teacherFilter = document.getElementById('teacherFilter');
                    const subjectFilter = document.getElementById('subjectFilter');
                    
                    classFilter.style.display = state.currentView === 'class' ? 'block' : 'none';
                    teacherFilter.style.display = state.currentView === 'teacher' ? 'block' : 'none';
                    subjectFilter.style.display = state.currentView === 'subject' ? 'block' : 'none';
                    
                    renderTimetable();
                });
            });
            
            document.getElementById('applyFilterBtn').addEventListener('click', renderTimetable);
            document.getElementById('checkOverlapsBtn').addEventListener('click', runOverlapCheckWithProgress);
            document.getElementById('exportOverlapsBtn').addEventListener('click', exportOverlapsCSV);
            document.getElementById('exportTimetableBtn').addEventListener('click', exportTimetable);
            document.getElementById('goToUploadBtn').addEventListener('click', function() {
                document.querySelector('.tab[data-target="upload-timetable-section"]').click();
            });
            
            // Upload timetable
            document.getElementById('excelFormatSelect').addEventListener('change', function() {
                state.excelFormat = this.value;
            });
            document.getElementById('excelFileInput').addEventListener('change', handleExcelUpload);
            document.getElementById('csvFileInput').addEventListener('change', handleCSVUpload);
            document.getElementById('subjectMappingFileInput').addEventListener('change', handleSubjectMappingUpload);
            document.getElementById('downloadTemplateBtn').addEventListener('click', downloadTemplate);
            
            // Time modal
            document.getElementById('closeTimeModal').addEventListener('click', closeTimeInputModal);
            document.getElementById('cancelTimeBtn').addEventListener('click', closeTimeInputModal);
            document.getElementById('saveTimeBtn').addEventListener('click', savePeriodTimes);
            
            // Modify timetable
            document.getElementById('rescheduleModeBtn').addEventListener('click', toggleRescheduleMode);
            document.getElementById('loadTimetableBtn').addEventListener('click', loadTimetableForModification);
            
            // Teacher schedule
            document.getElementById('loadTeacherScheduleBtn').addEventListener('click', loadTeacherSchedule);
            document.getElementById('exportTeacherScheduleBtn').addEventListener('click', exportTeacherSchedule);
            
            // Reschedule modal
            document.getElementById('closeRescheduleModal').addEventListener('click', closeRescheduleModal);
            document.getElementById('cancelRescheduleBtn').addEventListener('click', closeRescheduleModal);
            document.getElementById('confirmRescheduleBtn').addEventListener('click', confirmReschedule);
        }
        
        // Initialize the UI
        function initUI() {
            syncConfigInputs();
            renderTeacherMasterTable();
            renderTeacherMappingTable();
            renderClassSectionsTable();
            renderSubjectsTable();
            updateSetupSummary();
            renderAIPrompt();
            renderHolidays();
            
            // If timetable data exists, show it
            if (state.timetableData) {
                const updatedPeriods = autoFillMissingSubjectsFromTeacherMap();
                if (updatedPeriods > 0) {
                    saveTimetableToStorage();
                }
                updateTimetableSummary();
                renderTimetable();
            }
        }

        function syncConfigInputs() {
            document.getElementById('schoolDaysInput').value = (state.config.schoolDays || []).join(',');
            document.getElementById('periodsPerDayInput').value = state.config.periodsPerDay || 8;
            document.getElementById('periodsPerTeacherInput').value = state.config.periodsPerTeacher || 30;
            document.getElementById('aiPromptStyleInput').value = state.config.aiPromptStyle || 'compact';
        }

        function syncConfigFromInputs() {
            const days = document.getElementById('schoolDaysInput').value
                .split(',')
                .map(day => toCleanString(day))
                .filter(Boolean);
            state.config.schoolDays = days.length > 0 ? days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            state.config.periodsPerDay = Math.max(1, Number(document.getElementById('periodsPerDayInput').value) || 8);
            state.config.periodsPerTeacher = Math.max(1, Number(document.getElementById('periodsPerTeacherInput').value) || 30);
            state.config.aiPromptStyle = document.getElementById('aiPromptStyleInput').value || 'compact';
        }

        function updateSetupSummary() {
            document.getElementById('masterTeachersCount').textContent = (state.teachers || []).length;
            document.getElementById('masterMappingsCount').textContent = (state.teacherMappings || []).length;
            document.getElementById('configDaysCount').textContent = (state.config.schoolDays || []).length;
            document.getElementById('configPeriodsCount').textContent = state.config.periodsPerDay || 0;
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function parseCSVRows(csvData) {
            return csvData
                .split(/\r?\n/)
                .filter(line => line.trim() !== '')
                .map(line => parseCSVLine(line).map(cell => toCleanString(cell)));
        }

        function findHeaderIndex(headers, names) {
            return headers.findIndex(header => names.includes(toCleanString(header).toLowerCase()));
        }

        function handleTeacherListUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const rows = parseCSVRows(e.target.result);
                if (rows.length < 2) {
                    alert("Teacher CSV is empty or invalid.");
                    return;
                }

                const headers = rows[0].map(header => toCleanString(header).toLowerCase());
                const idIndex = findHeaderIndex(headers, ['teacher id', 'teacherid', 'id']);
                const nameIndex = findHeaderIndex(headers, ['teacher name', 'teachername', 'name']);
                const subjectsIndex = findHeaderIndex(headers, ['class teacher subject', 'subjects', 'subject', 'subject taught']);
                const gradeIndex = findHeaderIndex(headers, ['class teacher grade', 'class grade', 'grade']);
                const sectionIndex = findHeaderIndex(headers, ['class teacher section', 'section']);
                const phoneIndex = findHeaderIndex(headers, ['phone', 'mobile']);
                const emailIndex = findHeaderIndex(headers, ['email']);

                if (nameIndex === -1) {
                    alert("Teacher CSV must include Teacher Name column.");
                    return;
                }

                const imported = rows.slice(1)
                    .map((cells, index) => ({
                        id: toCleanString(cells[idIndex]) || `T${String((state.teachers || []).length + index + 1).padStart(4, '0')}`,
                        name: toCleanString(cells[nameIndex]),
                        classTeacherSubject: subjectsIndex >= 0 ? toCleanString(cells[subjectsIndex]) : '',
                        classTeacherGrade: gradeIndex >= 0 ? toCleanString(cells[gradeIndex]) : '',
                        classTeacherSection: sectionIndex >= 0 ? toCleanString(cells[sectionIndex]) : '',
                        phone: phoneIndex >= 0 ? toCleanString(cells[phoneIndex]) : '',
                        email: emailIndex >= 0 ? toCleanString(cells[emailIndex]) : ''
                    }))
                    .filter(row => row.name);

                state.teachers = mergeTeachers(state.teachers || [], imported);
                rebuildTeacherSubjectMapFromMasterData();
                saveMasterDataToStorage();
                saveTeacherSubjectMapToStorage();
                renderTeacherMasterTable();
                renderTeacherMappingTable();
                updateSetupSummary();
                updateClassFilters();
                renderAIPrompt();
            };
            reader.readAsText(file);
        }

        function handleTeacherMappingUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const rows = parseCSVRows(e.target.result);
                if (rows.length < 2) {
                    alert("Mapping CSV is empty or invalid.");
                    return;
                }

                const headers = rows[0].map(header => toCleanString(header).toLowerCase());
                const teacherIdIndex = findHeaderIndex(headers, ['teacher id', 'teacherid', 'id']);
                const teacherNameIndex = findHeaderIndex(headers, ['teacher name', 'teachername', 'name']);
                const gradeIndex = findHeaderIndex(headers, ['grade-section', 'class-section', 'class', 'grade section']);
                const subjectIndex = findHeaderIndex(headers, ['subject']);
                const periodsIndex = findHeaderIndex(headers, ['periods per week', 'periodsperweek', 'periods', 'weekly periods']);

                if (gradeIndex === -1 || subjectIndex === -1) {
                    alert("Mapping CSV must include Grade-Section and Subject columns.");
                    return;
                }

                const imported = rows.slice(1)
                    .map((cells, index) => {
                        const teacherId = teacherIdIndex >= 0 ? toCleanString(cells[teacherIdIndex]) : '';
                        const teacherName = teacherNameIndex >= 0 ? toCleanString(cells[teacherNameIndex]) : findTeacherNameById(teacherId);
                        return {
                            id: `M${Date.now()}-${index}`,
                            teacherId,
                            teacherName,
                            gradeSection: normalizeClassSectionLabel(cells[gradeIndex]),
                            subject: toCleanString(cells[subjectIndex]),
                            periodsPerWeek: periodsIndex >= 0 ? toCleanString(cells[periodsIndex]) : ''
                        };
                    })
                    .filter(row => row.gradeSection && row.subject && (row.teacherId || row.teacherName));

                state.teacherMappings = mergeTeacherMappings(state.teacherMappings || [], imported);
                rebuildTeacherSubjectMapFromMasterData();
                saveMasterDataToStorage();
                saveTeacherSubjectMapToStorage();
                renderTeacherMappingTable();
                updateSetupSummary();
                updateClassFilters();
                renderAIPrompt();
            };
            reader.readAsText(file);
        }

        function mergeTeachers(existing, imported) {
            const map = new Map();
            existing.concat(imported).forEach(teacher => {
                const key = toCleanString(teacher.id).toLowerCase() || toCleanString(teacher.name).toLowerCase();
                if (!key) return;
                map.set(key, { ...(map.get(key) || {}), ...teacher });
            });
            return Array.from(map.values()).sort((a, b) => safeLocaleCompare(a.name, b.name));
        }

        function mergeTeacherMappings(existing, imported) {
            const map = new Map();
            existing.concat(imported).forEach(mapping => {
                const key = [
                    toCleanString(mapping.teacherId).toLowerCase(),
                    toCleanString(mapping.teacherName).toLowerCase(),
                    toCleanString(mapping.gradeSection).toLowerCase(),
                    toCleanString(mapping.subject).toLowerCase()
                ].join('|');
                if (!key.replace(/\|/g, '')) return;
                map.set(key, { ...(map.get(key) || {}), ...mapping, id: mapping.id || key });
            });
            return Array.from(map.values()).sort((a, b) =>
                safeLocaleCompare(a.gradeSection, b.gradeSection) || safeLocaleCompare(a.teacherName, b.teacherName)
            );
        }

        function findTeacherNameById(teacherId) {
            const teacher = (state.teachers || []).find(item => toCleanString(item.id).toLowerCase() === toCleanString(teacherId).toLowerCase());
            return teacher ? teacher.name : '';
        }

        function renderTeacherMasterTable() {
            const table = document.getElementById('teacherMasterTable');
            const rows = state.teachers || [];
            const classSectionOptions = getClassSectionOptions();
            const baseSubjectOptions = getSubjectOptions(); // array of { code, name }
            table.innerHTML = `
                <thead>
                    <tr><th>Teacher ID</th><th>Teacher Name</th><th>Class Teacher Subject</th><th>Class Teacher Grade/Section</th><th>Phone</th><th>Email</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${rows.map((teacher, index) => {
                        const selectedValue = teacher.classTeacherGrade && teacher.classTeacherSection
                            ? `${escapeHtml(teacher.classTeacherGrade)}|${escapeHtml(teacher.classTeacherSection)}`
                            : '';
                        const subjectValue = teacher.classTeacherSubject || teacher.subjects || '';
                        
                        // Dynamically ensure the current value is part of the dropdown options
                        const rowSubjectOptions = [...baseSubjectOptions];
                        const found = rowSubjectOptions.find(o => o.code === subjectValue);
                        if (subjectValue && !found) {
                            rowSubjectOptions.push({ code: subjectValue, name: `${subjectValue} (Unmapped)` });
                        }
                        rowSubjectOptions.sort((a, b) => safeLocaleCompare(a.code, b.code));
                        
                        return `
                        <tr data-index="${index}">
                            <td><input value="${escapeHtml(teacher.id)}" data-field="id"></td>
                            <td><input value="${escapeHtml(teacher.name)}" data-field="name"></td>
                            <td>
                                <select data-field="classTeacherSubject">
                                    <option value=""></option>
                                    ${rowSubjectOptions.map(option => `
                                        <option value="${escapeHtml(option.code)}"${option.code === subjectValue ? ' selected' : ''}>${escapeHtml(option.code)} - ${escapeHtml(option.name)}</option>
                                    `).join('')}
                                </select>
                            </td>
                            <td>
                                <select data-field="classTeacherGrade" onchange="syncTeacherGradeSection(this)">
                                    <option value=""></option>
                                    ${classSectionOptions.map(option => `
                                        <option value="${escapeHtml(option.value)}"${option.value === selectedValue ? ' selected' : ''}>${escapeHtml(option.label)}</option>
                                    `).join('')}
                                </select>
                                <input type="hidden" value="${escapeHtml(teacher.classTeacherSection || '')}" data-field="classTeacherSection">
                            </td>
                            <td><input value="${escapeHtml(teacher.phone)}" data-field="phone"></td>
                            <td><input value="${escapeHtml(teacher.email)}" data-field="email"></td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteTeacherRow(${index})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `}).join('')}
                </tbody>
            `;
        }

        function renderTeacherMappingTable() {
            const table = document.getElementById('teacherMappingTable');
            const rows = state.teacherMappings || [];
            const classOptions = getClassSectionOptions();
            const baseSubjectOptions = getSubjectOptions(); // array of { code, name }
            table.innerHTML = `
                <thead>
                    <tr><th>Teacher ID</th><th>Teacher Name</th><th>Grade-Section</th><th>Subject</th><th>Periods / Week</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${rows.map((mapping, index) => {
                        const gradeValue = mapping.gradeSection ? escapeHtml(mapping.gradeSection) : '';
                        const subjectValue = mapping.subject ? escapeHtml(mapping.subject) : '';
                        
                        // Dynamically ensure the current value is part of the dropdown options
                        const rowSubjectOptions = [...baseSubjectOptions];
                        const found = rowSubjectOptions.find(o => o.code === subjectValue);
                        if (subjectValue && !found) {
                            rowSubjectOptions.push({ code: subjectValue, name: `${subjectValue} (Unmapped)` });
                        }
                        rowSubjectOptions.sort((a, b) => safeLocaleCompare(a.code, b.code));
                        
                        return `
                        <tr data-index="${index}">
                            <td><input value="${escapeHtml(mapping.teacherId)}" data-field="teacherId"></td>
                            <td><input value="${escapeHtml(mapping.teacherName)}" data-field="teacherName"></td>
                            <td>
                                <select data-field="gradeSection">
                                    <option value=""></option>
                                    ${classOptions.map(option => `
                                        <option value="${escapeHtml(option.label)}"${option.label === gradeValue ? ' selected' : ''}>${escapeHtml(option.label)}</option>
                                    `).join('')}
                                </select>
                            </td>
                            <td>
                                <select data-field="subject">
                                    <option value=""></option>
                                    ${rowSubjectOptions.map(option => `
                                        <option value="${escapeHtml(option.code)}"${option.code === subjectValue ? ' selected' : ''}>${escapeHtml(option.code)} - ${escapeHtml(option.name)}</option>
                                    `).join('')}
                                </select>
                            </td>
                            <td><input type="number" min="0" value="${escapeHtml(mapping.periodsPerWeek)}" data-field="periodsPerWeek"></td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteMappingRow(${index})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `}).join('')}
                </tbody>
            `;
        }

        function getClassSectionOptions() {
            const sections = state.classSections || [];
            const options = sections.map(item => {
                const classValue = item.class || '';
                const sectionValue = item.section || '';
                const label = `${classValue}-${sectionValue}`;
                const value = `${classValue}|${sectionValue}`;
                return { label, value };
            });
            return options.sort((a, b) => safeLocaleCompare(a.label, b.label));
        }

        function syncTeacherGradeSection(select) {
            const row = select.closest('tr');
            if (!row) return;
            const hiddenSection = row.querySelector('input[data-field="classTeacherSection"]');
            const selected = toCleanString(select.value);
            if (!hiddenSection) return;
            if (!selected) {
                hiddenSection.value = '';
                // Ensure classTeacherGrade field is cleared as well
                select.value = '';
                return;
            }
            const [gradePart, sectionPart] = selected.split('|');
            // Update hidden section input
            hiddenSection.value = sectionPart || '';
            // Preserve combined value in the select for proper rendering
            select.value = `${gradePart}|${hiddenSection.value}`;
        }

        function readTableRows(tableId, fields) {
            return Array.from(document.querySelectorAll(`#${tableId} tbody tr`)).map(row => {
                const item = {};
                fields.forEach(field => {
                    const input = row.querySelector(`[data-field="${field}"]`);
                    item[field] = input ? toCleanString(input.value) : '';
                });
                return item;
            });
        }

        function normalizeTeacherGradeSection(teacher) {
            const combined = toCleanString(teacher.classTeacherGrade || '');
            const splitMatch = combined.split('|');
            if (splitMatch.length === 2) {
                teacher.classTeacherGrade = splitMatch[0];
                teacher.classTeacherSection = splitMatch[1];
            }
            return teacher;
        }

        function saveMasterDataFromTables() {
            syncConfigFromInputs();
            
            // Read table data
            const rawTeachers = readTableRows('teacherMasterTable', ['id', 'name', 'classTeacherSubject', 'classTeacherGrade', 'classTeacherSection', 'phone', 'email']);
            const rawMappings = readTableRows('teacherMappingTable', ['teacherId', 'teacherName', 'gradeSection', 'subject', 'periodsPerWeek']);
            
            duplicateCheckCache.clear();
            
            // Validate and process teachers
            const validationResults = { teachers: [], mappings: [], warnings: [] };
            
            state.teachers = rawTeachers
                .map((teacher, index) => {
                    const normalized = normalizeTeacherGradeSection(teacher);
                    
                    // Skip empty rows
                    if (!toCleanString(normalized.name)) {
                        return null;
                    }
                    
                    // Validate teacher name
                    if (!toCleanString(normalized.name)) {
                        validationResults.warnings.push(`Row ${index + 1}: Skipped teacher with empty name`);
                        return null;
                    }
                    
                    return normalized;
                })
                .filter(Boolean);
            
            // Validate and process mappings
            state.teacherMappings = rawMappings
                .map((mapping, index) => {
                    // Skip empty rows
                    if (!toCleanString(mapping.gradeSection) && !toCleanString(mapping.subject)) {
                        return null;
                    }
                    
                    // Validate required fields
                    const classValidation = validateClassSection(mapping.gradeSection);
                    const subjectValidation = validateSubjectSelection(mapping.subject);
                    const teacherValidation = validateTeacherSelection(mapping.teacherId, mapping.teacherName);
                    
                    if (!classValidation.valid) {
                        validationResults.warnings.push(`Row ${index + 1}: ${classValidation.error}`);
                        return null;
                    }
                    
                    if (!subjectValidation.valid) {
                        validationResults.warnings.push(`Row ${index + 1}: ${subjectValidation.error}`);
                        return null;
                    }
                    
                    if (!teacherValidation.valid) {
                        validationResults.warnings.push(`Row ${index + 1}: ${teacherValidation.error}`);
                        return null;
                    }
                    
                    const processedMapping = {
                        ...mapping,
                        id: `M${index + 1}`,
                        teacherId: teacherValidation.teacherId,
                        teacherName: teacherValidation.teacherName || findTeacherNameById(mapping.teacherId),
                        gradeSection: normalizeClassSectionLabel(mapping.gradeSection),
                        subject: subjectValidation.normalized
                    };
                    
                    // Check for duplicates
                    const duplicateCheck = checkForDuplicateMapping(processedMapping);
                    if (duplicateCheck.isDuplicate) {
                        validationResults.warnings.push(`Row ${index + 1}: Duplicate mapping detected (${processedMapping.gradeSection}, ${processedMapping.subject})`);
                    }
                    
                    return processedMapping;
                })
                .filter(Boolean);

            rebuildTeacherSubjectMapFromMasterData();
            saveMasterDataToStorage();
            saveTeacherSubjectMapToStorage();
            
            const updatedPeriods = autoFillMissingSubjectsFromTeacherMap();
            if (updatedPeriods > 0) saveTimetableToStorage();
            
            renderTeacherMasterTable();
            renderTeacherMappingTable();
            updateSetupSummary();
            updateClassFilters();
            renderAIPrompt();
            
            // Show results
            let message = 'Local setup data saved successfully.';
            if (validationResults.warnings.length > 0) {
                message += `\n\nValidation warnings (${validationResults.warnings.length}):\n`;
                message += validationResults.warnings.slice(0, 5).join('\n');
                if (validationResults.warnings.length > 5) {
                    message += `\n... and ${validationResults.warnings.length - 5} more`;
                }
            }
            
            alert(message);
        }

        // Save master data without showing an alert (used by add row functions)
        function saveMasterDataFromTablesWithoutAlert() {
            syncConfigFromInputs();
            state.teachers = readTableRows('teacherMasterTable', ['id', 'name', 'classTeacherSubject', 'classTeacherGrade', 'classTeacherSection', 'phone', 'email'])
                .map(normalizeTeacherGradeSection)
                .filter(teacher => teacher.name);
            state.teacherMappings = readTableRows('teacherMappingTable', ['teacherId', 'teacherName', 'gradeSection', 'subject', 'periodsPerWeek'])
                .map((mapping, index) => ({
                    ...mapping,
                    id: `M${index + 1}`,
                    teacherName: mapping.teacherName || findTeacherNameById(mapping.teacherId),
                    gradeSection: normalizeClassSectionLabel(mapping.gradeSection)
                }))
                .filter(mapping => mapping.gradeSection && mapping.subject && (mapping.teacherId || mapping.teacherName));
            rebuildTeacherSubjectMapFromMasterData();
            saveMasterDataToStorage();
            saveTeacherSubjectMapToStorage();
            const updatedPeriods = autoFillMissingSubjectsFromTeacherMap();
            if (updatedPeriods > 0) saveTimetableToStorage();
            renderTeacherMasterTable();
            renderTeacherMappingTable();
            updateSetupSummary();
            updateClassFilters();
            renderAIPrompt();
            // No alert here
        }

        function addTeacherRow() {
            saveMasterDataFromTablesWithoutAlert();
            state.teachers.push({ id: '', name: '', classTeacherSubject: '', classTeacherGrade: '', classTeacherSection: '', phone: '', email: '' });
            renderTeacherMasterTable();
            updateSetupSummary();
        }

        function addMappingRow() {
            saveMasterDataFromTablesWithoutAlert();
            state.teacherMappings.push({ id: '', teacherId: '', teacherName: '', gradeSection: '', subject: '', periodsPerWeek: '' });
            renderTeacherMappingTable();
            updateSetupSummary();
        }

        // --- Bulk Classes & Sections functions ---
        function generateClassSectionsFromInput() {
            const input = document.getElementById('bulkClassesInput');
            if (!input) return;
            const lines = input.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const parsed = parseBulkClassesInput(lines);
            // merge parsed (objects) with existing, dedupe by className
            const existing = (state.classSections || []).filter(Boolean);
            const mergedMap = new Map();
            existing.forEach(e => {
                if (typeof e === 'string') return; // legacy will be normalized elsewhere
                if (e.className) mergedMap.set(e.className, e);
            });
            parsed.forEach(p => {
                // p is {className, class, section}
                if (p && p.className) mergedMap.set(p.className, p);
            });
            state.classSections = Array.from(mergedMap.values()).sort((a,b)=>safeLocaleCompare(a.className, b.className));
            saveMasterDataToStorage();
            renderClassSectionsTable();
            updateClassFilters();
            alert('Generated ' + parsed.length + ' class-section entries.');
        }

        function parseBulkClassesInput(lines) {
            const out = [];
            lines.forEach(line => {
                // Expect formats like "10:A,B" or "5:A" or "10:A" or "10-A,B"
                const parts = line.split(':');
                const left = parts[0] ? toCleanString(parts[0]) : '';
                const right = parts[1] ? parts[1] : '';
                if (!left) return;
                const classPart = left.replace(/^Grade\s*/i, '').replace(/^Class\s*/i, '');
                const sections = right ? right.split(',').map(s => toCleanString(s)).filter(Boolean) : ['A'];
                sections.forEach(sec => {
                    const cls = classPart;
                    const s = sec;
                    const className = `Class-${cls}-${s}`;
                    out.push({ className, class: cls, section: s });
                });
            });
            return out;
        }

        function renderClassSectionsTable() {
            const table = document.getElementById('classSectionsTable');
            if (!table) return;
            const rows = state.classSections || [];
            table.innerHTML = `
                <thead><tr><th>Class</th><th>Section</th><th>Action</th></tr></thead>
                <tbody>
                    ${rows.map((c, i) => `
                        <tr data-index="${i}">
                            <td>${escapeHtml(c.class || '')}</td>
                            <td>${escapeHtml(c.section || '')}</td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteClassSection(${i})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
        }

        function renderSubjectsTable() {
            const table = document.getElementById('subjectsTable');
            if (!table) return;
            const rows = state.subjects || [];
            table.innerHTML = `
                <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Action</th></tr></thead>
                <tbody>
                    ${rows.map((subject, i) => `
                        <tr data-index="${i}">
                            <td>${escapeHtml(subject.code)}</td>
                            <td>${escapeHtml(subject.name)}</td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteSubject(${i})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
        }

        function getSubjectOptions() {
            return (state.subjects || []).slice().sort((a, b) => safeLocaleCompare(a.code, b.code));
        }

        function generateSubjectsFromInput() {
            const input = document.getElementById('bulkSubjectsInput');
            if (!input) return;
            const lines = input.value.split(/\r?\n/).map(l => toCleanString(l)).filter(Boolean);
            const uniques = new Map();
            (state.subjects || []).forEach(s => uniques.set(toCleanString(s.code), s));
            
            lines.forEach(line => {
                const parts = line.split(/[,:]/);
                let code = toCleanString(parts[0]);
                let name = parts.length > 1 ? toCleanString(parts.slice(1).join(line.includes(',') ? ',' : ':')) : code;
                
                // Smart swap: Subject Codes are typically shorter than Names.
                if (code.length > name.length && name.length > 0) {
                    const tmp = code;
                    code = name;
                    name = tmp;
                }
                
                if (code) {
                    uniques.set(toCleanString(code), { code, name });
                }
            });
            state.subjects = Array.from(uniques.values()).sort((a, b) => safeLocaleCompare(a.code, b.code));
            saveMasterDataToStorage();
            renderSubjectsTable();
            renderTeacherMasterTable();
            renderTeacherMappingTable();
            alert('Generated ' + lines.length + ' subject entries.');
        }

        function clearSubjects() {
            if (!confirm('Clear all subjects?')) return;
            state.subjects = [];
            saveMasterDataToStorage();
            renderSubjectsTable();
            renderTeacherMasterTable();
            renderTeacherMappingTable();
        }

        function exportSubjectsCSV() {
            const rows = state.subjects || [];
            if (rows.length === 0) { alert('No subjects to export.'); return; }
            const csv = 'Subject Code,Subject Name\n' + rows.map(s => `${escapeCSVField(s.code)},${escapeCSVField(s.name)}`).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'subjects.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function handleImportSubjectsCSV(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const rows = parseCSVRows(e.target.result);
                    if (!rows || rows.length === 0) {
                        alert('Empty or invalid CSV');
                        return;
                    }
                    
                    let start = 0;
                    let cIdx = 0;
                    let nIdx = 1;

                    const header = rows[0].map(c => toCleanString(c).toLowerCase());
                    const codeMatch = header.findIndex(h => h.includes('code') || h.includes('id') || h === 'subject');
                    const nameMatch = header.findIndex(h => h.includes('name') || h === 'subject');

                    // If headers are found
                    if (codeMatch >= 0 || nameMatch >= 0) {
                        start = 1;
                        cIdx = codeMatch >= 0 ? codeMatch : 0;
                        nIdx = nameMatch >= 0 ? nameMatch : (rows[0].length > 1 ? (cIdx === 0 ? 1 : 0) : cIdx);
                        
                        // If they both matched the same index (e.g. both matched 'subject'), adjust
                        if (cIdx === nIdx && rows[0].length > 1) {
                            const otherIdx = header.findIndex((h, idx) => idx !== cIdx && (h.includes('subject') || h.includes('name') || h.includes('code') || h.includes('id')));
                            if (otherIdx >= 0) {
                                nIdx = otherIdx;
                            } else {
                                nIdx = cIdx === 0 ? 1 : 0;
                            }
                        }
                    } else if (rows[0] && rows[0].length > 1) {
                        // Guess by length
                        const len0 = toCleanString(rows[0][0]).length;
                        const len1 = toCleanString(rows[0][1]).length;
                        if (len0 > len1) {
                            cIdx = 1;
                            nIdx = 0;
                        } else {
                            cIdx = 0;
                            nIdx = 1;
                        }
                    }

                    const parsed = [];
                    for (let i = start; i < rows.length; i++) {
                        if (!rows[i] || rows[i].length === 0) continue;
                        let code = toCleanString(rows[i][cIdx] || '');
                        let name = toCleanString(rows[i][nIdx] || code);
                        
                        // Smart swap
                        if (code.length > name.length && name.length > 0) {
                            const tmp = code;
                            code = name;
                            name = tmp;
                        }
                        
                        if (code) parsed.push({ code, name });
                    }
                    
                    if (parsed.length === 0) {
                        alert('No valid subject rows found in CSV.');
                        return;
                    }
                    const uniques = new Map();
                    (state.subjects || []).forEach(s => uniques.set(toCleanString(s.code), s));
                    parsed.forEach(s => uniques.set(toCleanString(s.code), s));
                    state.subjects = Array.from(uniques.values()).sort((a, b) => safeLocaleCompare(a.code, b.code));
                    saveMasterDataToStorage();
                    renderSubjectsTable();
                    renderTeacherMasterTable();
                    renderTeacherMappingTable();
                    alert('Imported ' + parsed.length + ' subject rows.');
                } catch (err) {
                    console.error(err);
                    alert('Failed to import CSV');
                } finally {
                    event.target.value = ''; 
                }
            };
            reader.readAsText(file);
        }

        function deleteClassSection(index) {
            state.classSections = state.classSections || [];
            if (index < 0 || index >= state.classSections.length) return;
            state.classSections.splice(index, 1);
            saveMasterDataToStorage();
            renderClassSectionsTable();
            updateClassFilters();
        }

        function exportClassSectionsCSV() {
            const rows = state.classSections || [];
            if (rows.length === 0) { alert('No class sections to export.'); return; }
            const header = 'Class,Section\n';
            const lines = rows.map(r => `${escapeCSVField(r.class || '')},${escapeCSVField(r.section || '')}`);
            const csv = header + lines.join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'class-sections.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function clearClassSections() {
            if (!confirm('Clear all generated class-section entries?')) return;
            state.classSections = [];
            saveMasterDataToStorage();
            renderClassSectionsTable();
            updateClassFilters();
        }

        function handleImportClassSectionsCSV(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const rows = parseCSVRows(e.target.result);
                    if (!rows || rows.length === 0) {
                        alert('Empty or invalid CSV');
                        return;
                    }

                    // Detect header
                    let start = 0;
                    const first = rows[0].map(c => toCleanString(c).toLowerCase());
                    const hasHeader = first.includes('class') || first.includes('section') || first.includes('class-section') || first.includes('class section');
                    if (hasHeader) start = 1;

                    const parsed = [];
                    for (let i = start; i < rows.length; i++) {
                        const cols = rows[i];
                        if (!cols || cols.length === 0) continue;
                        if (cols.length === 1) {
                            const cell = toCleanString(cols[0]);
                            if (!cell) continue;
                            // try formats like 10-A or 10:A or Class-10-A
                            const parts = cell.split(/[-:]/).filter(Boolean);
                            if (parts.length >= 2) {
                                const cls = parts[0].replace(/^class|^grade\s*/i, '').trim();
                                const sec = parts[1].trim();
                                parsed.push({ className: `Class-${cls}-${sec}`, class: cls, section: sec });
                            }
                            continue;
                        }

                        // use first two columns
                        const rawClass = toCleanString(cols[0]);
                        const rawSection = toCleanString(cols[1]);
                        if (!rawClass || !rawSection) continue;
                        const cls = rawClass.replace(/^class|^grade\s*/i, '');
                        const sec = rawSection;
                        parsed.push({ className: `Class-${cls}-${sec}`, class: cls, section: sec });
                    }

                    if (parsed.length === 0) {
                        alert('No valid class-section rows found in CSV.');
                        return;
                    }

                    // merge with existing
                    const existing = (state.classSections || []).filter(Boolean);
                    const mergedMap = new Map();
                    existing.forEach(e => { if (e && e.className) mergedMap.set(e.className, e); });
                    parsed.forEach(p => { if (p && p.className) mergedMap.set(p.className, p); });
                    state.classSections = Array.from(mergedMap.values()).sort((a,b)=>safeLocaleCompare(a.className, b.className));
                    saveMasterDataToStorage();
                    renderClassSectionsTable();
                    updateClassFilters();
                    alert('Imported ' + parsed.length + ' class-section rows.');
                } catch (err) {
                    console.error(err);
                    alert('Failed to import CSV');
                } finally {
                    // reset input so same file can be reselected
                    event.target.value = '';
                }
            };
            reader.readAsText(file);
        }

        function saveMasterDataFromTablesWithoutAlert() {
            syncConfigFromInputs();
            state.teachers = readTableRows('teacherMasterTable', ['id', 'name', 'classTeacherSubject', 'classTeacherGrade', 'classTeacherSection', 'phone', 'email']);
            state.teacherMappings = readTableRows('teacherMappingTable', ['teacherId', 'teacherName', 'gradeSection', 'subject', 'periodsPerWeek']);
        }

        function deleteTeacherRow(index) {
            saveMasterDataFromTablesWithoutAlert();
            state.teachers.splice(index, 1);
            rebuildTeacherSubjectMapFromMasterData();
            saveMasterDataToStorage();
            saveTeacherSubjectMapToStorage();
            renderTeacherMasterTable();
            updateSetupSummary();
            renderAIPrompt();
        }

        function deleteMappingRow(index) {
            saveMasterDataFromTablesWithoutAlert();
            state.teacherMappings.splice(index, 1);
            rebuildTeacherSubjectMapFromMasterData();
            saveMasterDataToStorage();
            saveTeacherSubjectMapToStorage();
            renderTeacherMappingTable();
            updateSetupSummary();
            renderAIPrompt();
        }

        function rebuildTeacherSubjectMapFromMasterData() {
            const nextMap = { ...(state.teacherSubjectMap || {}) };

            (state.teachers || []).forEach(teacher => {
                const subject = toCleanString(teacher.classTeacherSubject || teacher.subjects || '').split(/[;/,]/).map(item => toCleanString(item)).filter(Boolean)[0] || '';
                if (!subject) return;
                const byId = buildTeacherSubjectMapKey('', teacher.id);
                const byName = buildTeacherSubjectMapKey(teacher.name, '');
                if (byId) nextMap[byId] = subject;
                if (byName) nextMap[byName] = subject;
            });

            (state.teacherMappings || []).forEach(mapping => {
                if (!mapping.subject) return;
                const byId = buildTeacherSubjectMapKey('', mapping.teacherId);
                const byName = buildTeacherSubjectMapKey(mapping.teacherName, '');
                if (byId) nextMap[byId] = mapping.subject;
                if (byName) nextMap[byName] = mapping.subject;
            });

            state.teacherSubjectMap = nextMap;
        }

        function makePeriodHeaders() {
            return Array.from({ length: state.config.periodsPerDay || 8 }, (_, index) => `P${index + 1}`);
        }

        function buildAIPrompt() {
            syncConfigFromInputs();
            const days = state.config.schoolDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const periodHeaders = makePeriodHeaders();
            const teachers = state.teachers || [];
            const mappings = state.teacherMappings || [];
            const compactMappings = mappings.map(row =>
                `${row.gradeSection} | ${row.subject} | ${row.teacherId || '-'} | ${row.teacherName || '-'} | ${row.periodsPerWeek || 'as needed'}`
            );

            const detailedData = state.config.aiPromptStyle === 'detailed'
                ? `\nTeacher CSV:\n${toTeacherCSV(teachers)}\n\nMapping CSV:\n${toMappingCSV(mappings)}\n`
                : `\nMappings:\n${compactMappings.join('\n') || 'No mappings imported yet.'}\n`;

            return `You are generating a school timetable from local principal-provided data.

Config:
- Days: ${days.join(', ')}
- Periods per day: ${state.config.periodsPerDay}
- Max periods per teacher per week: ${state.config.periodsPerTeacher}
- Output columns: Class-Section,Day,${periodHeaders.join(',')}
- Period cell format: TeacherID:TeacherName:Subject
- Use an empty cell for free/break periods.

Hard constraints:
- Use only teachers and class-subject mappings listed below.
- A teacher cannot be assigned to two classes in the same Day and Period.
- Keep each teacher at or below the configured max periods per week.
- Fill every listed class-section for every configured day.
- Respect Periods Per Week from mapping rows when provided.
- Return only CSV text, with no explanation before or after.

${detailedData}
Return CSV now.`;
        }

        function toTeacherCSV(teachers) {
            let csv = 'Teacher ID,Teacher Name,Class Teacher Subject,Class Teacher Grade,Class Teacher Section,Phone,Email\n';
            teachers.forEach(teacher => {
                csv += [teacher.id, teacher.name, teacher.classTeacherSubject || teacher.subjects || '', teacher.classTeacherGrade || '', teacher.classTeacherSection || '', teacher.phone, teacher.email].map(escapeCSVField).join(',') + '\n';
            });
            return csv.trim();
        }

        function toMappingCSV(mappings) {
            let csv = 'Teacher ID,Teacher Name,Grade-Section,Subject,Periods Per Week\n';
            mappings.forEach(mapping => {
                csv += [mapping.teacherId, mapping.teacherName, mapping.gradeSection, mapping.subject, mapping.periodsPerWeek].map(escapeCSVField).join(',') + '\n';
            });
            return csv.trim();
        }

        function renderAIPrompt() {
            const output = document.getElementById('aiPromptOutput');
            if (output) output.value = buildAIPrompt();
        }

        function copyAIPrompt() {
            const output = document.getElementById('aiPromptOutput');
            output.select();
            document.execCommand('copy');
        }

        function downloadAIPrompt() {
            const blob = new Blob([buildAIPrompt()], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ai_timetable_prompt.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function downloadMasterDataTemplates() {
            const teachersCsv = 'Teacher ID,Teacher Name,Class Teacher Subject,Class Teacher Grade,Class Teacher Section,Phone,Email\nT001,Indira,Maths,I,A,9876543210,indira@school.com\nT002,Sai Priya,EVS,II,A,9876543211,sai@school.com\n';
            const mappingsCsv = 'Teacher ID,Teacher Name,Grade-Section,Subject,Periods Per Week\nT001,Indira,Grade-I-A,Maths,5\nT002,Sai Priya,Grade-I-A,EVS,4\n';
            const blob = new Blob([`Teacher List Template\n${teachersCsv}\n\nMapping Template\n${mappingsCsv}`], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'timetable_master_data_templates.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function exportTeacherList() {
            const csv = toTeacherCSV(state.teachers || []);
            if (!csv || csv.trim() === '') {
                alert('No teachers to export.');
                return;
            }
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'teacher-list.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        // Render holidays list
        function renderHolidays() {
            const holidaysList = document.getElementById('holidaysList');
            const yearHolidays = state.holidays.filter(h => h.date.startsWith(state.currentYear));
            
            // Update summary counts
            document.getElementById('totalHolidays').textContent = yearHolidays.length;
            document.getElementById('publicHolidays').textContent = yearHolidays.filter(h => h.type === 'public').length;
            document.getElementById('schoolHolidays').textContent = yearHolidays.filter(h => h.type === 'school').length;
            document.getElementById('optionalHolidays').textContent = yearHolidays.filter(h => h.type === 'optional').length;
            
            if (yearHolidays.length === 0) {
                holidaysList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-umbrella-beach"></i>
                        <h3>No Holidays Added Yet</h3>
                        <p>Start by adding your first holiday. You can add public holidays, school holidays, or optional holidays.</p>
                        <button class="btn btn-primary" id="addFirstHolidayBtn">
                            <i class="fas fa-plus"></i> Add First Holiday
                        </button>
                    </div>
                `;
                document.getElementById('addFirstHolidayBtn').addEventListener('click', openAddHolidayModal);
                return;
            }
            
            let html = '<div class="holiday-cards">';
            
            yearHolidays.forEach(holiday => {
                const typeClass = `${holiday.type}-holiday`;
                const typeLabel = holiday.type === 'public' ? 'Public Holiday' : 
                                 holiday.type === 'school' ? 'School Holiday' : 'Optional Holiday';
                
                html += `
                    <div class="holiday-card ${typeClass}">
                        <div class="holiday-date">${formatDate(holiday.date)}</div>
                        <h3>${holiday.name}</h3>
                        <p><strong>Type:</strong> ${typeLabel}</p>
                        ${holiday.description ? `<p>${holiday.description}</p>` : ''}
                        <div style="margin-top: 15px;">
                            <button class="btn btn-danger btn-sm" onclick="deleteHoliday(${holiday.id})" style="padding: 5px 10px; font-size: 0.8rem;">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            holidaysList.innerHTML = html;
        }
        
        // Format date for display
        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        }
        
        // Open add holiday modal
        function openAddHolidayModal() {
            document.getElementById('addHolidayModal').classList.add('active');
            document.getElementById('holidayDate').value = `${state.currentYear}-01-01`;
        }
        
        // Close add holiday modal
        function closeAddHolidayModal() {
            document.getElementById('addHolidayModal').classList.remove('active');
            // Clear form
            document.getElementById('holidayName').value = '';
            document.getElementById('holidayDescription').value = '';
        }
        
        // Save holiday
        function saveHoliday() {
            const name = document.getElementById('holidayName').value;
            const date = document.getElementById('holidayDate').value;
            const type = document.getElementById('holidayType').value;
            const description = document.getElementById('holidayDescription').value;
            
            if (!name || !date) {
                alert("Please fill in all required fields.");
                return;
            }
            
            const newHoliday = {
                id: state.holidays.length > 0 ? Math.max(...state.holidays.map(h => h.id)) + 1 : 1,
                name,
                date,
                type,
                description
            };
            
            state.holidays.push(newHoliday);
            saveHolidaysToStorage();
            renderHolidays();
            closeAddHolidayModal();
        }
        
        // Delete holiday
        function deleteHoliday(id) {
            if (confirm("Are you sure you want to delete this holiday?")) {
                state.holidays = state.holidays.filter(h => h.id !== id);
                saveHolidaysToStorage();
                renderHolidays();
            }
        }
        
        // Export holidays
        function exportHolidays() {
            // In a real app, this would generate an Excel or PDF file
            alert("Exporting holidays to Excel file...");
            
            // For demo, we'll create a simple CSV
            const yearHolidays = state.holidays.filter(h => h.date.startsWith(state.currentYear));
            let csv = "Name,Date,Type,Description\n";
            
            yearHolidays.forEach(holiday => {
                csv += `"${holiday.name}","${holiday.date}","${holiday.type}","${holiday.description || ''}"\n`;
            });
            
            // Create download link
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `holidays_${state.currentYear}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        // Handle Excel file upload
        function handleExcelUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            document.getElementById('selectedExcelFileName').textContent = `Selected file: ${file.name}`;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Process the workbook
                    processExcelWorkbook(workbook);
                } catch (error) {
                    console.error("Error reading Excel file:", error);
                    alert("Error reading Excel file. Please make sure it's in the correct format.");
                }
            };
            
            reader.readAsArrayBuffer(file);
        }
        
        // Handle CSV file upload
        function handleCSVUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            document.getElementById('selectedCSVFileName').textContent = `Selected file: ${file.name}`;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const csvData = e.target.result;
                    // Process the CSV
                    processCSVData(csvData, file.name);
                } catch (error) {
                    console.error("Error reading CSV file:", error);
                    alert("Error reading CSV file. Please make sure it's in the correct format.");
                }
            };
            
            reader.readAsText(file);
        }
        
        function handleSubjectMappingUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            document.getElementById('selectedSubjectMappingFileName').textContent = `Selected file: ${file.name}`;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const csvData = e.target.result;
                    processSubjectMappingCSV(csvData, file.name);
                } catch (error) {
                    console.error("Error reading subject mapping CSV file:", error);
                    alert("Error reading subject mapping CSV file. Please make sure it's in the correct format.");
                }
            };
            
            reader.readAsText(file);
        }
        
        // Process uploaded Excel workbook
        function processExcelWorkbook(workbook) {
            // Clear previous data
            state.timetableData = {};
            let processedCount = 0;
            
            if (state.excelFormat === 'teacher_wise') {
                processedCount = processStateTimetableWorkbook(workbook);
            } else {
                // Process each sheet
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    // Process the data based on the template format
                    processExcelSheetData(sheetName, jsonData);
                });
                processedCount = Object.keys(state.timetableData).length;
            }
            
            if (processedCount === 0) {
                return;
            }
            
            assignTeacherIdsInTimetableData();
            autoFillMissingSubjectsFromTeacherMap();
            
            // Save to localStorage
            saveTimetableToStorage();
            
            // Update UI
            updateTimetableSummary();
            renderTimetable();
            
            // Show upload status
            document.getElementById('uploadStatus').style.display = 'block';
            document.getElementById('uploadDetails').innerHTML = `
                <p><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Timetable uploaded successfully!</p>
                <p>Processed ${processedCount} classes.</p>
            `;
            
            document.getElementById('timetableDataInfo').style.display = 'block';
        }
        
        function toCleanString(value) {
            return String(value || '')
                .replace(/\s+/g, ' ')
                .trim();
        }
        
        function safeLocaleCompare(a, b) {
            return String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' });
        }
        
        const duplicateCheckCache = new Set();

        function validateClassSection(value) {
            const cleaned = toCleanString(value);
            if (!cleaned) {
                return { valid: false, error: 'Class-Section is empty' };
            }
            const normalized = normalizeClassSectionLabel(cleaned);
            // Format validation: Grade-Class-Section (e.g., Grade-I-A or Grade-10-A)
            const match = normalized.match(/^Grade-([IVX\d]+)-([A-Z])$/i);
            if (!match) {
                return { valid: false, error: `Invalid Class-Section format: "${value}". Expected format like "Grade-I-A"` };
            }
            return { valid: true, normalized };
        }

        function validateSubjectSelection(subject) {
            const cleaned = toCleanString(subject);
            if (!cleaned) {
                return { valid: false, error: 'Subject is empty' };
            }
            
            const subjectOptions = getSubjectOptions() || [];
            // Try to match by code or name
            const found = subjectOptions.find(s => 
                safeLocaleCompare(s.code, cleaned) === 0 || 
                safeLocaleCompare(s.name, cleaned) === 0
            );
            if (!found) {
                return { valid: false, error: `Subject "${subject}" is not defined in subjects list` };
            }
            return { valid: true, normalized: found.code };
        }

        function validateTeacherSelection(teacherId, teacherName) {
            const id = toCleanString(teacherId);
            const name = toCleanString(teacherName);
            
            if (!id && !name) {
                return { valid: false, error: 'Both Teacher ID and Teacher Name are empty' };
            }
            
            const teachers = state.teachers || [];
            let foundTeacher = null;
            
            if (id) {
                foundTeacher = teachers.find(t => toCleanString(t.id).toLowerCase() === id.toLowerCase());
                if (!foundTeacher) {
                    return { valid: false, error: `Teacher ID "${teacherId}" not found in teachers list` };
                }
            } else if (name) {
                foundTeacher = teachers.find(t => toCleanString(t.name).toLowerCase() === name.toLowerCase());
                if (!foundTeacher) {
                    return { valid: false, error: `Teacher Name "${teacherName}" not found in teachers list` };
                }
            }
            
            return {
                valid: true,
                teacherId: foundTeacher.id,
                teacherName: foundTeacher.name
            };
        }

        function checkForDuplicateMapping(mapping) {
            const key = `${toCleanString(mapping.gradeSection).toLowerCase()}|${toCleanString(mapping.subject).toLowerCase()}`;
            if (duplicateCheckCache.has(key)) {
                return { isDuplicate: true };
            }
            duplicateCheckCache.add(key);
            return { isDuplicate: false };
        }
        
        function assignTeacherIdsInTimetableData() {
            if (!state.timetableData) return;
            
            const teacherIdMap = new Map();
            let nextId = 1;
            
            Object.values(state.timetableData).forEach(classData => {
                (classData.days || []).forEach(day => {
                    (day.periods || []).forEach(period => {
                        const teacherName = toCleanString(period.teacherName);
                        const teacherId = toCleanString(period.teacherId);
                        if (!teacherName) return;
                        
                        if (teacherId) {
                            teacherIdMap.set(teacherName, teacherId);
                            return;
                        }
                        
                        if (!teacherIdMap.has(teacherName)) {
                            teacherIdMap.set(teacherName, `T${String(nextId).padStart(4, '0')}`);
                            nextId += 1;
                        }
                    });
                });
            });
            
            Object.values(state.timetableData).forEach(classData => {
                (classData.days || []).forEach(day => {
                    (day.periods || []).forEach(period => {
                        const teacherName = toCleanString(period.teacherName);
                        if (!teacherName) return;
                        period.teacherId = teacherIdMap.get(teacherName) || toCleanString(period.teacherId);
                    });
                });
            });
        }
        
        function normalizeClassSectionLabel(value) {
            const cleaned = toCleanString(value);
            if (!cleaned) return '';

            const hyphenated = cleaned.replace(/\s*-\s*/g, '-');
            const hyphenMatch = hyphenated.match(/^GRADE-?([IVX]+|\d+)-([A-Z])$/i);
            if (hyphenMatch) {
                return `Grade-${hyphenMatch[1].toUpperCase()}-${hyphenMatch[2].toUpperCase()}`;
            }

            const raw = cleaned.toUpperCase();
            
            const compact = raw.replace(/\s+/g, '');
            const match = compact.match(/^(?:GRADE)?([IVX]+|\d+)([A-Z])$/);
            if (match) {
                return `Grade-${match[1]}-${match[2]}`;
            }
            
            const parts = raw.split(/\s+/).filter(Boolean);
            if (parts.length >= 3 && parts[0] === 'GRADE') {
                return `Grade-${parts[1]}-${parts[2]}`;
            }
            if (parts.length >= 2) {
                return `Grade-${parts[0]}-${parts[1]}`;
            }
            
            return raw;
        }
        
        function getStandardDayOrder() {
            return (state.config && state.config.schoolDays && state.config.schoolDays.length > 0)
                ? state.config.schoolDays
                : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        }
        
        function processStateTimetableWorkbook(workbook) {
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) return 0;
            
            const worksheet = workbook.Sheets[firstSheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            if (data.length < 4) {
                alert("Selected STATE format file appears invalid (expected day and period headers in rows 2 and 3).");
                return 0;
            }
            
            const dayHeaderRow = data[1] || [];
            const periodHeaderRow = data[2] || [];
            const dayNamesMap = {
                MONDAY: 'Monday',
                TUESDAY: 'Tuesday',
                WEDNESDAY: 'Wednesday',
                THURSDAY: 'Thursday',
                FRIDAY: 'Friday',
                SATURDAY: 'Saturday'
            };
            
            const dayStarts = [];
            for (let c = 0; c < dayHeaderRow.length; c++) {
                const dayText = toCleanString(dayHeaderRow[c]).toUpperCase();
                if (dayNamesMap[dayText]) {
                    dayStarts.push({ dayName: dayNamesMap[dayText], startCol: c });
                }
            }
            
            if (dayStarts.length === 0) {
                alert("Could not detect day blocks in selected STATE format file.");
                return 0;
            }
            
            const dayBlocks = [];
            for (let i = 0; i < dayStarts.length; i++) {
                const { dayName, startCol } = dayStarts[i];
                const nextStart = i < dayStarts.length - 1 ? dayStarts[i + 1].startCol : periodHeaderRow.length;
                const periodColumns = [];
                
                for (let c = startCol; c < nextStart; c++) {
                    const periodText = toCleanString(periodHeaderRow[c]);
                    const periodMatch = periodText.match(/(\d+)/);
                    const periodNo = periodMatch ? Number(periodMatch[1]) : NaN;
                    if (Number.isInteger(periodNo) && periodNo > 0) {
                        periodColumns.push({ col: c, period: periodNo });
                    }
                }
                
                if (periodColumns.length > 0) {
                    dayBlocks.push({ dayName, periodColumns });
                }
            }
            
            if (dayBlocks.length === 0) {
                alert("Could not detect period columns in selected STATE format file.");
                return 0;
            }
            
            const maxPeriods = dayBlocks.reduce((maxVal, block) => {
                const blockMax = block.periodColumns.reduce((m, p) => Math.max(m, p.period), 0);
                return Math.max(maxVal, blockMax);
            }, 0);
            
            const classMap = {};
            const ensureClass = (className) => {
                if (!classMap[className]) {
                    const days = getStandardDayOrder().map(dayName => ({
                        dayName,
                        periods: Array.from({ length: maxPeriods }, (_, idx) => ({
                            period: idx + 1,
                            subject: '',
                            teacherName: '',
                            teacherId: '',
                            time: getPeriodTime(idx + 1),
                            type: 'Regular',
                            breakAfter: 0
                        }))
                    }));
                    classMap[className] = { className, days };
                }
                return classMap[className];
            };
            
            for (let r = 3; r < data.length; r++) {
                const row = data[r] || [];
                const teacherName = toCleanString(row[0]);
                if (!teacherName) continue;
                
                dayBlocks.forEach(block => {
                    const dayEntryForClass = (className) => ensureClass(className).days.find(d => d.dayName === block.dayName);
                    
                    block.periodColumns.forEach(({ col, period }) => {
                        const classValue = normalizeClassSectionLabel(row[col]);
                        if (!classValue) return;
                        
                        const dayEntry = dayEntryForClass(classValue);
                        if (!dayEntry) return;
                        
                        const periodEntry = dayEntry.periods[period - 1];
                        if (!periodEntry) return;
                        
                        if (periodEntry.teacherName && periodEntry.teacherName !== teacherName) {
                            periodEntry.teacherName = `${periodEntry.teacherName} / ${teacherName}`;
                        } else {
                            periodEntry.teacherName = teacherName;
                        }
                    });
                });
            }
            
            state.timetableData = classMap;
            return Object.keys(state.timetableData).length;
        }
        
        // Process Excel sheet data
        function processExcelSheetData(sheetName, data) {
            // Skip header rows
            if (data.length < 3) return;
            
            const classData = {
                className: sheetName,
                days: []
            };
            
            // Process each row starting from row 2 (0-indexed)
            for (let i = 2; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;
                
                const day = {
                    dayName: row[0],
                    periods: []
                };
                
                // Process each period (8 periods in the template)
                for (let p = 0; p < 8; p++) {
                    const baseIndex = p * 5;
                    const period = {
                        period: p + 1,
                        subject: row[baseIndex + 1] || '',
                        teacherName: row[baseIndex + 2] || '',
                        teacherId: row[baseIndex + 3] || '',
                        time: row[baseIndex + 4] || getPeriodTime(p + 1),
                        type: row[baseIndex + 5] || 'Regular'
                    };
                    
                    day.periods.push(period);
                }
                
                classData.days.push(day);
            }
            
            // Store in state
            state.timetableData[sheetName] = classData;
        }
        
        // Process CSV data
        function processCSVData(csvData, fileName) {
            // Clear previous data
            state.timetableData = {};
            
            // Parse CSV
            const lines = csvData.split('\n');
            if (lines.length < 2) {
                alert("CSV file is empty or has invalid format.");
                return;
            }
            
            // Get headers
            const headers = lines[0].split(',');
            
            // Check if it's the new format
            if (headers[0] !== 'Class-Section' || headers[1] !== 'Day') {
                alert("CSV format not recognized. Expected format: Class-Section,Day,P1,P2,...");
                return;
            }
            
            // Get period columns (P1, P2, etc.)
            const periodColumns = headers.filter(h => h.startsWith('P'));
            const numPeriods = periodColumns.length;
            
            // Store period count for time input
            state.tempPeriodCount = numPeriods;
            state.tempCSVData = [];
            
            // Process each data line
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const cells = parseCSVLine(line);
                if (cells.length < 2) continue;
                
                const classSection = cells[0];
                const day = cells[1];
                
                // Create class data structure if not exists
                if (!state.tempCSVData[classSection]) {
                    state.tempCSVData[classSection] = {
                        className: classSection,
                        days: []
                    };
                }
                
                // Find or create day entry
                let dayEntry = state.tempCSVData[classSection].days.find(d => d.dayName === day);
                if (!dayEntry) {
                    dayEntry = {
                        dayName: day,
                        periods: []
                    };
                    state.tempCSVData[classSection].days.push(dayEntry);
                }
                
                // Process each period
                for (let p = 0; p < numPeriods; p++) {
                    const periodData = cells[2 + p] || '';
                    
                    let teacherId = '';
                    let teacherName = '';
                    let subject = '';
                    
                    if (periodData && periodData.includes(':')) {
                        const parts = periodData.split(':');
                        teacherId = parts[0] || '';
                        teacherName = parts[1] || '';
                        subject = parts[2] || '';
                    } else if (periodData) {
                        // Handle case where there's data but not in expected format
                        subject = periodData;
                    }
                    
                    const period = {
                        period: p + 1,
                        subject: subject,
                        teacherName: teacherName,
                        teacherId: teacherId,
                        time: '', // Will be set later
                        type: 'Regular'
                    };
                    
                    dayEntry.periods.push(period);
                }
            }
            
            // Convert to array and show time input modal
            state.tempCSVData = Object.values(state.tempCSVData);
            openTimeInputModal(numPeriods);
        }
        
        // Parse CSV line considering quoted values
        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            
            result.push(current);
            return result;
        }
        
        function buildTeacherSubjectMapKey(teacherName, teacherId) {
            const id = toCleanString(teacherId).toLowerCase();
            const name = toCleanString(teacherName).toLowerCase();
            if (id) return `id:${id}`;
            if (name) return `name:${name}`;
            return '';
        }
        
        function getMappedSubjectForPeriod(period) {
            if (!state.teacherSubjectMap) return '';
            const keyById = buildTeacherSubjectMapKey('', period.teacherId);
            if (keyById && state.teacherSubjectMap[keyById]) {
                return toCleanString(state.teacherSubjectMap[keyById]);
            }
            
            const keyByName = buildTeacherSubjectMapKey(period.teacherName, '');
            if (keyByName && state.teacherSubjectMap[keyByName]) {
                return toCleanString(state.teacherSubjectMap[keyByName]);
            }
            
            return '';
        }
        
        function autoFillMissingSubjectsFromTeacherMap() {
            if (!state.timetableData || !state.teacherSubjectMap) return 0;
            
            let updatedCount = 0;
            Object.values(state.timetableData).forEach(classData => {
                (classData.days || []).forEach(day => {
                    (day.periods || []).forEach(period => {
                        const hasSubject = toCleanString(period.subject) !== '';
                        if (hasSubject) return;
                        const mappedSubject = getMappedSubjectForPeriod(period);
                        if (!mappedSubject) return;
                        period.subject = mappedSubject;
                        updatedCount += 1;
                    });
                });
            });
            
            return updatedCount;
        }
        
        function processSubjectMappingCSV(csvData, fileName) {
            const lines = csvData.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2) {
                alert("Subject mapping CSV is empty or has invalid format.");
                return;
            }
            
            const headerCells = parseCSVLine(lines[0]).map(cell => toCleanString(cell).toLowerCase());
            const teacherNameIndex = headerCells.findIndex(h => h === 'teacher name' || h === 'teachername');
            const teacherIdIndex = headerCells.findIndex(h => h === 'teacher id' || h === 'teacherid' || h === 'id');
            const subjectIndex = headerCells.findIndex(h => h === 'subject');
            
            if (teacherNameIndex === -1 && teacherIdIndex === -1) {
                alert("Subject mapping CSV must include Teacher Name or Teacher ID column.");
                return;
            }
            if (subjectIndex === -1) {
                alert("Subject mapping CSV must include Subject column.");
                return;
            }
            
            const parsedMap = {};
            let importedRows = 0;
            for (let i = 1; i < lines.length; i++) {
                const cells = parseCSVLine(lines[i]);
                const teacherName = toCleanString(cells[teacherNameIndex]);
                const teacherId = toCleanString(cells[teacherIdIndex]);
                const subject = toCleanString(cells[subjectIndex]);
                if (!subject) continue;
                
                const key = buildTeacherSubjectMapKey(teacherName, teacherId);
                if (!key) continue;
                
                parsedMap[key] = subject;
                importedRows += 1;
            }
            
            if (importedRows === 0) {
                alert("No valid rows found in subject mapping CSV.");
                return;
            }
            
            state.teacherSubjectMap = {
                ...(state.teacherSubjectMap || {}),
                ...parsedMap
            };
            saveTeacherSubjectMapToStorage();
            
            const updatedPeriods = autoFillMissingSubjectsFromTeacherMap();
            if (updatedPeriods > 0) {
                saveTimetableToStorage();
                updateTimetableSummary();
                renderTimetable();
            }
            
            document.getElementById('uploadStatus').style.display = 'block';
            document.getElementById('uploadDetails').innerHTML = `
                <p><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Subject mapping uploaded successfully!</p>
                <p>Imported ${importedRows} teacher-subject mappings from ${fileName}. Auto-filled ${updatedPeriods} missing subjects.</p>
            `;
        }
        
        // Open time input modal
        function openTimeInputModal(numPeriods) {
            const container = document.getElementById('timeInputContainer');
            container.innerHTML = '';
            
            let html = `
                <div class="time-setup-controls">
                    <div class="time-setup-row">
                        <div class="time-setup-field">
                            <label for="p1StartTime">P1 Start Time</label>
                            <input type="time" id="p1StartTime" value="08:00">
                        </div>
                        <div class="time-setup-field">
                            <label for="regularDuration">Regular Period Duration (minutes)</label>
                            <input type="number" id="regularDuration" min="1" value="45">
                        </div>
                    </div>
                </div>
                <div class="time-period-config-grid">
            `;
            
            for (let i = 1; i <= numPeriods; i++) {
                html += `
                    <div class="time-period-row">
                        <div class="time-period-title">P${i}</div>
                        <div class="time-period-fields">
                            <label for="periodType-P${i}">Type</label>
                            <select id="periodType-P${i}" class="form-control">
                                <option value="regular">Regular</option>
                                <option value="special">Special</option>
                            </select>
                        </div>
                        <div class="time-period-fields time-special-duration-wrap" id="specialDurationWrap-P${i}" style="display: none;">
                            <label for="specialDuration-P${i}">Special Duration (minutes)</label>
                            <input type="number" id="specialDuration-P${i}" min="1" value="45">
                        </div>
                        <div class="time-period-fields">
                            <label for="breakAfter-P${i}">Break After P${i} (minutes)</label>
                            <input type="number" id="breakAfter-P${i}" min="0" value="0">
                        </div>
                        <div class="time-period-preview" id="timePreview-P${i}">--:--</div>
                    </div>
                `;
            }
            
            html += '</div>';
            container.innerHTML = html;
            
            const commonInputs = [
                document.getElementById('p1StartTime'),
                document.getElementById('regularDuration')
            ];
            commonInputs.forEach(input => {
                input.addEventListener('input', function() {
                    refreshGeneratedPeriodTimes(numPeriods);
                });
            });
            
            for (let i = 1; i <= numPeriods; i++) {
                const typeSelect = document.getElementById(`periodType-P${i}`);
                const specialDurationInput = document.getElementById(`specialDuration-P${i}`);
                const breakAfterInput = document.getElementById(`breakAfter-P${i}`);
                const specialWrap = document.getElementById(`specialDurationWrap-P${i}`);
                
                typeSelect.addEventListener('change', function() {
                    specialWrap.style.display = this.value === 'special' ? 'block' : 'none';
                    refreshGeneratedPeriodTimes(numPeriods);
                });
                
                specialDurationInput.addEventListener('input', function() {
                    refreshGeneratedPeriodTimes(numPeriods);
                });
                
                breakAfterInput.addEventListener('input', function() {
                    refreshGeneratedPeriodTimes(numPeriods);
                });
            }
            
            refreshGeneratedPeriodTimes(numPeriods);
            document.getElementById('timeInputModal').classList.add('active');
        }
        
        // Close time input modal
        function closeTimeInputModal() {
            document.getElementById('timeInputModal').classList.remove('active');
            state.tempCSVData = null;
            state.tempPeriodCount = 0;
        }
        
        function parseTimeToMinutes(value) {
            if (!value || typeof value !== 'string' || !value.includes(':')) return null;
            const parts = value.split(':');
            if (parts.length !== 2) return null;
            
            const hours = Number(parts[0]);
            const minutes = Number(parts[1]);
            
            if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
            
            return (hours * 60) + minutes;
        }
        
        function formatMinutesToTime(totalMinutes) {
            const normalized = ((totalMinutes % 1440) + 1440) % 1440;
            const hours = Math.floor(normalized / 60);
            const minutes = normalized % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        function buildGeneratedPeriodPlan(numPeriods) {
            const p1Start = document.getElementById('p1StartTime').value;
            const regularDuration = Number(document.getElementById('regularDuration').value);
            const startMinutes = parseTimeToMinutes(p1Start);
            
            if (startMinutes === null) {
                return { error: 'Please set a valid P1 start time.' };
            }
            
            if (!Number.isFinite(regularDuration) || regularDuration <= 0) {
                return { error: 'Regular period duration must be greater than 0.' };
            }
            
            const periodTimes = {};
            const periodTypes = {};
            const periodBreaks = {};
            let cursor = startMinutes;
            
            for (let i = 1; i <= numPeriods; i++) {
                const periodKey = `P${i}`;
                const typeValue = document.getElementById(`periodType-${periodKey}`).value;
                const isSpecial = typeValue === 'special';
                let duration = regularDuration;
                
                if (isSpecial) {
                    const specialDuration = Number(document.getElementById(`specialDuration-${periodKey}`).value);
                    if (!Number.isFinite(specialDuration) || specialDuration <= 0) {
                        return { error: `Special duration for ${periodKey} must be greater than 0.` };
                    }
                    duration = specialDuration;
                }
                
                const breakAfter = Number(document.getElementById(`breakAfter-${periodKey}`).value);
                if (!Number.isFinite(breakAfter) || breakAfter < 0) {
                    return { error: `Break after ${periodKey} must be 0 or greater.` };
                }
                
                const periodStart = cursor;
                const periodEnd = cursor + duration;
                
                periodTimes[periodKey] = `${formatMinutesToTime(periodStart)}-${formatMinutesToTime(periodEnd)}`;
                periodTypes[periodKey] = isSpecial ? 'Special' : 'Regular';
                periodBreaks[periodKey] = breakAfter;
                cursor = periodEnd + breakAfter;
            }
            
            return { periodTimes, periodTypes, periodBreaks };
        }
        
        function refreshGeneratedPeriodTimes(numPeriods) {
            const plan = buildGeneratedPeriodPlan(numPeriods);
            
            for (let i = 1; i <= numPeriods; i++) {
                const preview = document.getElementById(`timePreview-P${i}`);
                const periodKey = `P${i}`;
                if (!preview) continue;
                preview.textContent = plan.periodTimes ? plan.periodTimes[periodKey] : '--:--';
            }
        }
        
        // Save period times
        function savePeriodTimes() {
            const numPeriods = state.tempPeriodCount;
            const plan = buildGeneratedPeriodPlan(numPeriods);
            
            if (plan.error) {
                alert(plan.error);
                return;
            }
            
            for (let i = 1; i <= numPeriods; i++) {
                const periodKey = `P${i}`;
                state.periodTimes[periodKey] = plan.periodTimes[periodKey];
            }
            
            savePeriodTimesToStorage();
            
            // Now process the CSV data with times
            if (state.tempCSVData) {
                // Convert temp data to final format
                state.timetableData = {};
                
                state.tempCSVData.forEach(classData => {
                    const className = classData.className;
                    state.timetableData[className] = {
                        className: className,
                        days: []
                    };
                    
                    classData.days.forEach(day => {
                        const dayEntry = {
                            dayName: day.dayName,
                            periods: []
                        };
                        
                        day.periods.forEach(period => {
                            const periodKey = `P${period.period}`;
                            const periodTime = state.periodTimes[periodKey] || getDefaultPeriodTime(period.period);
                            const periodType = plan.periodTypes[periodKey] || 'Regular';
                            const breakAfter = plan.periodBreaks[periodKey] || 0;
                            
                            dayEntry.periods.push({
                                period: period.period,
                                subject: period.subject,
                                teacherName: period.teacherName,
                                teacherId: period.teacherId,
                                time: periodTime,
                                type: periodType,
                                breakAfter: breakAfter
                            });
                        });
                        
                        state.timetableData[className].days.push(dayEntry);
                    });
                });
                
                assignTeacherIdsInTimetableData();
                autoFillMissingSubjectsFromTeacherMap();
                
                // Save to localStorage
                saveTimetableToStorage();
                
                // Update UI
                updateTimetableSummary();
                renderTimetable();
                
                // Show upload status
                document.getElementById('uploadStatus').style.display = 'block';
                document.getElementById('uploadDetails').innerHTML = `
                    <p><i class="fas fa-check-circle" style="color: var(--success-color);"></i> CSV Timetable uploaded successfully!</p>
                    <p>Processed ${state.tempCSVData.length} classes.</p>
                `;
                
                document.getElementById('timetableDataInfo').style.display = 'block';
            }
            
            // Update class filters
            updateClassFilters();
            
            // Close modal
            closeTimeInputModal();
        }
        
        // Get default period time
        function getDefaultPeriodTime(periodNumber) {
            // Default times starting from 8:00 AM, 45-minute periods
            const startHour = 8;
            const periodDuration = 45;
            const breakDuration = 15;
            
            let totalMinutes = (startHour * 60) + ((periodNumber - 1) * (periodDuration + breakDuration));
            
            // Adjust for breaks (assume break after 4th period)
            if (periodNumber > 4) {
                totalMinutes += 30; // Long break
            }
            
            const startHours = Math.floor(totalMinutes / 60);
            const startMinutes = totalMinutes % 60;
            const endHours = Math.floor((totalMinutes + periodDuration) / 60);
            const endMinutes = (totalMinutes + periodDuration) % 60;
            
            return `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}-${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
        }
        
        // Get period time from stored times or default
        function getPeriodTime(periodNumber) {
            const periodKey = `P${periodNumber}`;
            if (state.periodTimes && state.periodTimes[periodKey]) {
                return state.periodTimes[periodKey];
            }
            return getDefaultPeriodTime(periodNumber);
        }
        
        function normalizeSubjectName(subject) {
            return toCleanString(subject).toLowerCase();
        }
        
        function escapeHtmlAttribute(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
        
        function getUniqueSubjectMap() {
            const subjectMap = new Map();
            if (!state.timetableData) return subjectMap;
            
            Object.keys(state.timetableData).forEach(className => {
                const classData = state.timetableData[className];
                classData.days.forEach(day => {
                    day.periods.forEach(period => {
                        const label = toCleanString(period.subject);
                        const key = normalizeSubjectName(label);
                        if (key && !subjectMap.has(key)) {
                            subjectMap.set(key, label);
                        }
                    });
                });
            });
            
            return subjectMap;
        }
        
        function getMultiSelectValues(selectId) {
            const select = document.getElementById(selectId);
            return Array.from(select.selectedOptions)
                .map(option => option.value)
                .filter(value => value && value.trim() !== '');
        }
        
        // Update timetable summary
        function updateTimetableSummary() {
            if (!state.timetableData) return;
            
            const classes = Object.keys(state.timetableData);
            let periodsCount = 0;
            const teachers = new Set();
            const subjects = new Set();
            
            classes.forEach(className => {
                const classData = state.timetableData[className];
                classData.days.forEach(day => {
                    day.periods.forEach(period => {
                        const hasSubject = toCleanString(period.subject) !== '';
                        const hasTeacher = toCleanString(period.teacherName) !== '';
                        const hasTeacherId = String(period.teacherId || '').trim() !== '';
                        
                        if (hasSubject || hasTeacher || hasTeacherId) {
                            periodsCount++;
                        }
                        if (hasTeacher) {
                            teachers.add(toCleanString(period.teacherName));
                        }
                        if (hasSubject) {
                            subjects.add(toCleanString(period.subject));
                        }
                    });
                });
            });
            
            document.getElementById('classesCount').textContent = classes.length;
            document.getElementById('periodsCount').textContent = periodsCount;
            document.getElementById('teachersCount').textContent = teachers.size;
            document.getElementById('subjectsCount').textContent = subjects.size;
            
            // Update class filters
            updateClassFilters();
        }
        
        // Update class filters
        function updateClassFilters() {
            if (!state.timetableData) return;
            
            // Combine classes from loaded timetable data and generated classSections
            const classSet = new Set();
            if (state.timetableData) Object.keys(state.timetableData).forEach(c => classSet.add(c));
            (state.classSections || []).forEach(c => {
                if (!c) return;
                classSet.add(c.className || (typeof c === 'string' ? c : `${c.class || ''}-${c.section || ''}`));
            });
            const classes = Array.from(classSet).sort((a, b) => safeLocaleCompare(a, b));
            
            // Update class filter in View Timetable
            const classFilter = document.getElementById('classFilter');
            const selectedClasses = getMultiSelectValues('classFilter');
            classFilter.innerHTML = '';
            classes.forEach(className => {
                const isSelected = selectedClasses.includes(className) ? ' selected' : '';
                classFilter.innerHTML += `<option value="${className}"${isSelected}>${className}</option>`;
            });
            if (selectedClasses.length === 0) {
                classFilter.selectedIndex = -1;
            }
            
            // Update class filter in Modify Timetable
            const modifyClassFilter = document.getElementById('modifyClassFilter');
            modifyClassFilter.innerHTML = '<option value="">Select Class</option>';
            classes.forEach(className => {
                modifyClassFilter.innerHTML += `<option value="${className}">${className}</option>`;
            });
            
            // Update teacher filter
            const teachers = new Set();
            classes.forEach(className => {
                const classData = state.timetableData[className];
                classData.days.forEach(day => {
                    day.periods.forEach(period => {
                        const teacherLabel = toCleanString(period.teacherName);
                        if (teacherLabel) teachers.add(teacherLabel);
                    });
                });
            });
            const sortedTeachers = Array.from(teachers)
                .sort((a, b) => safeLocaleCompare(a, b));
            
            const teacherFilter = document.getElementById('teacherFilter');
            const selectedTeachers = getMultiSelectValues('teacherFilter');
            teacherFilter.innerHTML = '';
            sortedTeachers.forEach(teacher => {
                const isSelected = selectedTeachers.includes(teacher) ? ' selected' : '';
                teacherFilter.innerHTML += `<option value="${teacher}"${isSelected}>${teacher}</option>`;
            });
            if (selectedTeachers.length === 0) {
                teacherFilter.selectedIndex = -1;
            }
            
            const teacherScheduleFilter = document.getElementById('teacherScheduleFilter');
            teacherScheduleFilter.innerHTML = '<option value="">Select Teacher</option>';
            sortedTeachers.forEach(teacher => {
                teacherScheduleFilter.innerHTML += `<option value="${teacher}">${teacher}</option>`;
            });
            
            const subjectFilter = document.getElementById('subjectFilter');
            const selectedSubjects = getMultiSelectValues('subjectFilter');
            subjectFilter.innerHTML = '';
            
            const uniqueSubjects = Array.from(getUniqueSubjectMap().entries())
                .sort((a, b) => safeLocaleCompare(a[1], b[1]));
            
            uniqueSubjects.forEach(([subjectKey, subjectLabel]) => {
                const isSelected = selectedSubjects.includes(subjectKey) ? ' selected' : '';
                subjectFilter.innerHTML += `<option value="${subjectKey}"${isSelected}>${subjectLabel}</option>`;
            });
            if (selectedSubjects.length === 0) {
                subjectFilter.selectedIndex = -1;
            }
        }
        
        // Render timetable
        function renderTimetable() {
            const timetableDisplay = document.getElementById('timetableDisplay');
            
            if (!state.timetableData) {
                timetableDisplay.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-calendar-alt"></i>
                        <h3>No Timetable Loaded</h3>
                        <p>Upload a timetable using the "Upload Timetable" tab to view it here.</p>
                        <button class="btn btn-primary" id="goToUploadBtn">
                            <i class="fas fa-file-upload"></i> Go to Upload
                        </button>
                    </div>
                `;
                document.getElementById('goToUploadBtn').addEventListener('click', function() {
                    document.querySelector('.tab[data-target="upload-timetable-section"]').click();
                });
                return;
            }
            
            // Get filter values
            const classFilters = getMultiSelectValues('classFilter');
            const teacherFilters = getMultiSelectValues('teacherFilter');
            const subjectFilters = getMultiSelectValues('subjectFilter');
            
            let html = '';
            
            if (state.currentView === 'class') {
                // Show class-wise timetable
                const classesToShow = classFilters.length > 0 ? classFilters : Object.keys(state.timetableData);
                
                classesToShow.forEach(className => {
                    const classData = state.timetableData[className];
                    
                    html += `<h3 style="margin: 20px 0 10px 15px;">${className}</h3>`;
                    html += generateTimetableHTML(classData);
                });
            } else if (state.currentView === 'teacher') {
                // Show teacher-wise timetable
                html = generateTeacherTimetableHTML(teacherFilters);
            } else if (state.currentView === 'subject') {
                // Show subject-wise timetable
                html = generateSubjectTimetableHTML(subjectFilters);
            }
            
            timetableDisplay.innerHTML = html;
        }
        
        // Generate timetable HTML
        function generateTimetableHTML(classData) {
            if (!classData || !classData.days || classData.days.length === 0) {
                return '<p>No timetable data for this class.</p>';
            }
            
            // Determine number of periods from the first day
            const numPeriods = classData.days[0].periods.length;
            const headerDay = classData.days[0];
            const showBreakAfterPeriod = {};
            
            for (let i = 0; i < numPeriods; i++) {
                const period = headerDay.periods[i];
                showBreakAfterPeriod[i + 1] = i < numPeriods - 1 && Number(period?.breakAfter || 0) > 0;
            }
            
            let html = '<table class="timetable">';
            
            // Header row
            html += '<thead><tr><th>Day/Period</th>';
            for (let i = 1; i <= numPeriods; i++) {
                const periodTime = toCleanString(headerDay.periods[i - 1]?.time);
                const periodTimeHtml = periodTime ? `<div class="period-header-time">${periodTime}</div>` : '';
                html += `<th><div>P${i}</div>${periodTimeHtml}</th>`;
                if (showBreakAfterPeriod[i]) {
                    html += `<th class="break-header">Break</th>`;
                }
            }
            html += '</tr></thead><tbody>';
            
            // Data rows - sort days in correct order
            const dayOrder = getStandardDayOrder();
            
            dayOrder.forEach(dayName => {
                const dayData = classData.days.find(d => d.dayName === dayName);
                
                if (!dayData) return;
                
                html += `<tr><td style="font-weight: 600; background-color: #f9f9f9;">${dayName}</td>`;
                
                dayData.periods.forEach(period => {
                    // Check if this is a holiday
                    const isHoliday = isDateHoliday(dayName);
                    const hasSubject = toCleanString(period.subject) !== '';
                    const hasTeacher = toCleanString(period.teacherName) !== '';
                    
                    if (!hasSubject && !hasTeacher) {
                        html += `<td class="break-cell">BREAK</td>`;
                    } else if (isHoliday) {
                        html += `<td class="holiday-cell">HOLIDAY</td>`;
                    } else {
                        const overlapClass = period.overlap ? 'overlap' : '';
                        const overlapTooltip = period.overlapInfo || 'Teacher overlap detected.';
                        const overlapWarningHtml = period.overlap
                            ? `<div class="overlap-warning" title="${escapeHtmlAttribute(overlapTooltip)}" aria-label="${escapeHtmlAttribute(overlapTooltip)}"><i class="fas fa-exclamation-triangle"></i></div>`
                            : '';
                        const subjectHtml = hasSubject
                            ? `<div class="period-subject">${period.subject}</div>`
                            : '<div class="period-subject subject-missing" title="No subject assigned" aria-label="No subject assigned">🟡</div>';
                        const teacherHtml = hasTeacher
                            ? `<div class="period-teacher">${period.teacherName}</div>`
                            : '<div class="period-teacher">No Teacher</div>';
                        html += `
                            <td class="period-cell ${overlapClass}" data-class="${classData.className}" data-day="${dayName}" data-period="${period.period}">
                                ${overlapWarningHtml}
                                ${subjectHtml}
                                ${teacherHtml}
                            </td>
                        `;
                    }
                    
                    if (showBreakAfterPeriod[period.period]) {
                        const breakAfter = Number(period.breakAfter || 0);
                        const breakCellHtml = breakAfter > 0
                            ? `<div class="break-cell-title">BREAK</div><div class="break-cell-time">${breakAfter} min</div>`
                            : `<div class="break-cell-title">-</div>`;
                        html += `<td class="inter-period-break-cell">${breakCellHtml}</td>`;
                    }
                });
                
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            return html;
        }
        
        // Generate teacher timetable HTML
        function generateTeacherTimetableHTML(teacherFilters) {
            if (!teacherFilters || teacherFilters.length === 0) {
                return '<div class="empty-state"><p>Please select one or more teachers to view their schedules.</p></div>';
            }
            
            if (!state.timetableData) return '<p>No timetable data.</p>';
            
            let html = '';
            teacherFilters.forEach(teacherFilter => {
                const dayOrder = getStandardDayOrder();
                const teacherGrid = {};
                dayOrder.forEach(day => {
                    teacherGrid[day] = {};
                });
                
                let maxPeriods = 0;
                let hasAnyEntry = false;
                
                Object.keys(state.timetableData).forEach(className => {
                    const classData = state.timetableData[className];
                    classData.days.forEach(day => {
                        maxPeriods = Math.max(maxPeriods, day.periods.length);
                        day.periods.forEach(period => {
                            if (period.teacherName === teacherFilter) {
                                hasAnyEntry = true;
                                if (!teacherGrid[day.dayName]) teacherGrid[day.dayName] = {};
                                if (!teacherGrid[day.dayName][period.period]) teacherGrid[day.dayName][period.period] = [];
                                teacherGrid[day.dayName][period.period].push({
                                    className,
                                    subject: toCleanString(period.subject)
                                });
                            }
                        });
                    });
                });
                
                if (!hasAnyEntry) {
                    html += `<div class="empty-state"><p>No schedule found for teacher: ${teacherFilter}</p></div>`;
                    return;
                }
                
                html += `<h3 style="margin: 20px 0 10px 15px;">Schedule for ${teacherFilter}</h3>`;
                html += '<table class="timetable">';
                html += '<thead><tr><th>Day/Period</th>';
                for (let i = 1; i <= maxPeriods; i++) {
                    const headerTime = getPeriodTime(i);
                    html += `<th><div>P${i}</div><div class="period-header-time">${headerTime}</div></th>`;
                }
                
                html += '</tr></thead><tbody>';
                
                dayOrder.forEach(dayName => {
                    html += `<tr><td style="font-weight: 600; background-color: #f9f9f9;">${dayName}</td>`;
                    
                    for (let p = 1; p <= maxPeriods; p++) {
                        const entries = (teacherGrid[dayName] && teacherGrid[dayName][p]) ? teacherGrid[dayName][p] : [];
                        let periodInfo = '';
                        
                        if (entries.length > 0) {
                            const periodText = entries.map(entry =>
                                `${entry.className}: ${entry.subject || '<span class="no-subject-marker" title="No subject assigned" aria-label="No subject assigned">🟡</span>'}`
                            ).join('<br>');
                            
                            periodInfo = `
                                <div class="period-subject">${periodText}</div>
                            `;
                        }
                        
                        html += `<td class="period-cell">${periodInfo}</td>`;
                    }
                    
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
            });
            
            return html;
        }
        
        // Generate subject timetable HTML
        function generateSubjectTimetableHTML(subjectFilterKeys) {
            if (!subjectFilterKeys || subjectFilterKeys.length === 0) {
                return '<div class="empty-state"><p>Please select one or more subjects to view schedules.</p></div>';
            }
            
            if (!state.timetableData) return '<p>No timetable data.</p>';
            
            let html = '';
            subjectFilterKeys.forEach(subjectFilterKey => {
                const subjectLabel = getUniqueSubjectMap().get(subjectFilterKey) || subjectFilterKey;
                
                // Find all classes where this subject is taught
                const subjectClasses = {};
                const classNames = Object.keys(state.timetableData);
                
                classNames.forEach(className => {
                    const classData = state.timetableData[className];
                    classData.days.forEach(day => {
                        day.periods.forEach(period => {
                            if (normalizeSubjectName(period.subject) === subjectFilterKey) {
                                if (!subjectClasses[className]) subjectClasses[className] = {};
                                if (!subjectClasses[className][day.dayName]) subjectClasses[className][day.dayName] = [];
                                subjectClasses[className][day.dayName].push(period);
                            }
                        });
                    });
                });
                
                if (Object.keys(subjectClasses).length === 0) {
                    html += `<div class="empty-state"><p>No schedule found for subject: ${subjectLabel}</p></div>`;
                    return;
                }
                
                html += `<h3 style="margin: 20px 0 10px 15px;">Schedule for ${subjectLabel}</h3>`;
                html += '<table class="timetable">';
                html += '<thead><tr><th>Day/Period</th>';
                
                // Get all classes where this subject is taught
                const classes = Object.keys(subjectClasses);
                
                classes.forEach(className => {
                    html += `<th>${className}</th>`;
                });
                
                html += '</tr></thead><tbody>';
                
                // Data rows
                const dayOrder = getStandardDayOrder();
                
                dayOrder.forEach(dayName => {
                    html += `<tr><td style="font-weight: 600; background-color: #f9f9f9;">${dayName}</td>`;
                    
                    classes.forEach(className => {
                        const dayPeriods = subjectClasses[className][dayName] || [];
                        let periodInfo = '';
                        
                        if (dayPeriods.length > 0) {
                            // Show all periods for this subject in this class on this day
                            const periodText = dayPeriods.map(p => 
                                `P${p.period}: ${p.teacherName}`
                            ).join('<br>');
                            
                            periodInfo = `
                                <div class="period-subject">${periodText}</div>
                            `;
                        }
                        
                        html += `<td class="period-cell">${periodInfo}</td>`;
                    });
                    
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
            });
            
            return html;
        }
        
        // Check if a date is a holiday
        function isDateHoliday(dayName) {
            // Only use configured holiday data; do not auto-mark weekends.
            const normalizedDay = toCleanString(dayName).toLowerCase();
            return state.holidays.some(holiday => {
                if (!holiday) return false;
                const holidayDayName = toCleanString(holiday.dayName || holiday.weekday || '').toLowerCase();
                return holidayDayName && holidayDayName === normalizedDay;
            });
        }
        
        function updateOverlapProgress(label, percent, visible) {
            const progressWrap = document.getElementById('overlapProgress');
            const progressLabel = document.getElementById('overlapProgressLabel');
            const progressBar = document.getElementById('overlapProgressBar');
            
            if (visible) {
                progressWrap.style.display = 'block';
                progressLabel.textContent = label;
                progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
            } else {
                progressWrap.style.display = 'none';
                progressBar.style.width = '0%';
            }
        }
        
        function delayFrame() {
            return new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Check for overlaps in the timetable with visible progress
        async function checkForOverlaps() {
            if (!state.timetableData) return 0;
            
            const records = [];
            Object.keys(state.timetableData).forEach(className => {
                const classData = state.timetableData[className];
                classData.days.forEach(day => {
                    day.periods.forEach(period => {
                        records.push({
                            className,
                            dayName: day.dayName,
                            periodNumber: period.period,
                            period
                        });
                    });
                });
            });
            
            const totalRecords = records.length;
            if (totalRecords === 0) return 0;
            
            const chunkSize = 250;
            const teacherSchedule = new Map();
            
            updateOverlapProgress('Preparing overlap scan...', 0, true);
            
            for (let i = 0; i < totalRecords; i++) {
                const { period } = records[i];
                period.overlap = false;
                period.overlapInfo = '';
                
                if ((i + 1) % chunkSize === 0 || i === totalRecords - 1) {
                    const progress = ((i + 1) / totalRecords) * 35;
                    updateOverlapProgress('Preparing overlap scan...', progress, true);
                    await delayFrame();
                }
            }
            
            for (let i = 0; i < totalRecords; i++) {
                const current = records[i];
                const period = current.period;
                
                if (period.teacherName && period.teacherName !== '' && period.subject) {
                    const key = `${current.dayName}-${period.time}-${period.teacherName}`;
                    if (!teacherSchedule.has(key)) {
                        teacherSchedule.set(key, []);
                    }
                    teacherSchedule.get(key).push(current);
                }
                
                if ((i + 1) % chunkSize === 0 || i === totalRecords - 1) {
                    const progress = 35 + (((i + 1) / totalRecords) * 45);
                    updateOverlapProgress('Analyzing teacher schedules...', progress, true);
                    await delayFrame();
                }
            }
            
            const overlapGroups = Array.from(teacherSchedule.values()).filter(group => group.length > 1);
            const totalGroups = overlapGroups.length;
            let overlapCount = 0;
            
            if (totalGroups === 0) {
                updateOverlapProgress('No overlaps found.', 100, true);
                await delayFrame();
                return 0;
            }
            
            for (let i = 0; i < totalGroups; i++) {
                const group = overlapGroups[i];
                
                group.forEach(item => {
                    item.period.overlap = true;
                    overlapCount++;
                    
                    const otherConflicts = group
                        .filter(other => !(other.className === item.className && other.dayName === item.dayName && other.periodNumber === item.periodNumber))
                        .map(other => `${other.className} (${other.dayName} P${other.periodNumber})`);
                    
                    item.period.overlapInfo = `Teacher ${item.period.teacherName} also has ${otherConflicts.join(', ')} at ${item.period.time}.`;
                });
                
                if ((i + 1) % 20 === 0 || i === totalGroups - 1) {
                    const progress = 80 + (((i + 1) / totalGroups) * 20);
                    updateOverlapProgress('Marking overlaps...', progress, true);
                    await delayFrame();
                }
            }
            
            updateOverlapProgress(`Overlap scan complete. ${overlapCount} conflicting periods found.`, 100, true);
            await delayFrame();
            return overlapCount;
        }
        
        async function runOverlapCheckWithProgress() {
            if (!state.timetableData) {
                alert("No timetable data loaded.");
                return;
            }
            
            if (state.overlapCheckInProgress) return;
            state.overlapCheckInProgress = true;
            
            const checkBtn = document.getElementById('checkOverlapsBtn');
            const originalLabel = checkBtn.innerHTML;
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
            
            try {
                await checkForOverlaps();
                renderTimetable();
            } finally {
                checkBtn.disabled = false;
                checkBtn.innerHTML = originalLabel;
                state.overlapCheckInProgress = false;
                setTimeout(() => updateOverlapProgress('', 0, false), 900);
            }
        }
        
        function escapeCSVField(value) {
            const stringValue = String(value ?? '');
            const escapedValue = stringValue.replace(/"/g, '""');
            return `"${escapedValue}"`;
        }
        
        async function exportOverlapsCSV() {
            if (!state.timetableData) {
                alert("No timetable data loaded.");
                return;
            }
            
            if (state.overlapCheckInProgress) return;
            state.overlapCheckInProgress = true;
            
            const exportBtn = document.getElementById('exportOverlapsBtn');
            const originalLabel = exportBtn.innerHTML;
            const checkBtn = document.getElementById('checkOverlapsBtn');
            const originalCheckLabel = checkBtn.innerHTML;
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
            
            try {
                await checkForOverlaps();
                renderTimetable();
                
                const overlapRows = [];
                Object.keys(state.timetableData).forEach(className => {
                    const classData = state.timetableData[className];
                    classData.days.forEach(day => {
                        day.periods.forEach(period => {
                            if (period.overlap) {
                                overlapRows.push({
                                    className,
                                    day: day.dayName,
                                    period: `P${period.period}`,
                                    teacher: period.teacherName || '',
                                    subject: period.subject || '',
                                    time: period.time || '',
                                    overlapInfo: period.overlapInfo || ''
                                });
                            }
                        });
                    });
                });
                
                if (overlapRows.length === 0) {
                    alert("No overlaps found to export.");
                    return;
                }
                
                let csv = 'Class,Day,Period,Teacher,Subject,Time,Conflict Details\n';
                overlapRows.forEach(row => {
                    csv += [
                        escapeCSVField(row.className),
                        escapeCSVField(row.day),
                        escapeCSVField(row.period),
                        escapeCSVField(row.teacher),
                        escapeCSVField(row.subject),
                        escapeCSVField(row.time),
                        escapeCSVField(row.overlapInfo)
                    ].join(',') + '\n';
                });
                
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'timetable_overlaps.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } finally {
                exportBtn.disabled = false;
                exportBtn.innerHTML = originalLabel;
                checkBtn.disabled = false;
                checkBtn.innerHTML = originalCheckLabel;
                state.overlapCheckInProgress = false;
                setTimeout(() => updateOverlapProgress('', 0, false), 900);
            }
        }
        
        // Export timetable
        function exportTimetable() {
            if (!state.timetableData) {
                alert("No timetable data to export.");
                return;
            }
            
            // Ask for export format
            const format = prompt("Export as Excel or CSV? (Enter 'excel' or 'csv')", "excel");
            
            if (!format || (format !== 'excel' && format !== 'csv')) {
                alert("Invalid format selected.");
                return;
            }
            
            if (format === 'excel') {
                exportToExcel();
            } else {
                exportToCSV();
            }
        }
        
        // Export to Excel
        function exportToExcel() {
            // Create a new workbook
            const wb = XLSX.utils.book_new();
            
            // Add each class as a sheet
            Object.keys(state.timetableData).forEach(className => {
                const classData = state.timetableData[className];
                
                // Create header row
                const header = ['Day'];
                const numPeriods = classData.days[0].periods.length;
                
                for (let i = 1; i <= numPeriods; i++) {
                    header.push(`P${i} Subject`, `P${i} Teacher Name`, `P${i} Teacher ID`, `P${i} Time`, `P${i} Type`);
                }
                
                const data = [header];
                
                // Add each day's data
                const dayOrder = getStandardDayOrder();
                
                dayOrder.forEach(dayName => {
                    const dayData = classData.days.find(d => d.dayName === dayName);
                    if (!dayData) return;
                    
                    const row = [dayName];
                    
                    dayData.periods.forEach(period => {
                        row.push(period.subject || '');
                        row.push(period.teacherName || '');
                        row.push(period.teacherId || '');
                        row.push(period.time || '');
                        row.push(period.type || 'Regular');
                    });
                    
                    data.push(row);
                });
                
                // Create worksheet
                const ws = XLSX.utils.aoa_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, className);
            });
            
            // Generate and download file
            XLSX.writeFile(wb, 'school_timetable_export.xlsx');
        }
        
        // Export to CSV (new format)
        function exportToCSV() {
            let csv = 'Class-Section,Day';
            
            // Get number of periods from first class
            const firstClass = Object.keys(state.timetableData)[0];
            if (!firstClass) return;
            
            const numPeriods = state.timetableData[firstClass].days[0].periods.length;
            
            // Add period headers
            for (let i = 1; i <= numPeriods; i++) {
                csv += `,P${i}`;
            }
            csv += '\n';
            
            // Add data for each class
            Object.keys(state.timetableData).forEach(className => {
                const classData = state.timetableData[className];
                
                const dayOrder = getStandardDayOrder();
                
                dayOrder.forEach(dayName => {
                    const dayData = classData.days.find(d => d.dayName === dayName);
                    if (!dayData) return;
                    
                    csv += `${className},${dayName}`;
                    
                    dayData.periods.forEach(period => {
                        if (period.subject || period.teacherName || period.teacherId) {
                            csv += `,${period.teacherId || ''}:${period.teacherName}:${period.subject}`;
                        } else {
                            csv += ',';
                        }
                    });
                    
                    csv += '\n';
                });
            });
            
            // Create download link
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'school_timetable.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        // Download template
        function downloadTemplate() {
            if (state.fileType === 'excel') {
                downloadExcelTemplate();
            } else {
                downloadCSVTemplate();
            }
        }
        
        // Download Excel template
        function downloadExcelTemplate() {
            // Create a simple template with sample data
            const wb = XLSX.utils.book_new();
            
            // Sample classes
            const classes = ['Class1A', 'Class1B', 'Class2A', 'Class2B'];
            
            classes.forEach(className => {
                // Create header row
                const header = [
                    'Day', 'P1 Subject', 'P1 Teacher Name', 'P1 Teacher ID', 'P1 Time', 'P1 Type',
                    'P2 Subject', 'P2 Teacher Name', 'P2 Teacher ID', 'P2 Time', 'P2 Type',
                    'P3 Subject', 'P3 Teacher Name', 'P3 Teacher ID', 'P3 Time', 'P3 Type',
                    'P4 Subject', 'P4 Teacher Name', 'P4 Teacher ID', 'P4 Time', 'P4 Type',
                    'P5 Subject', 'P5 Teacher Name', 'P5 Teacher ID', 'P5 Time', 'P5 Type',
                    'P6 Subject', 'P6 Teacher Name', 'P6 Teacher ID', 'P6 Time', 'P6 Type',
                    'P7 Subject', 'P7 Teacher Name', 'P7 Teacher ID', 'P7 Time', 'P7 Type',
                    'P8 Subject', 'P8 Teacher Name', 'P8 Teacher ID', 'P8 Time', 'P8 Type'
                ];
                
                const data = [header];
                
                // Add days
                const days = getStandardDayOrder();
                
                days.forEach(day => {
                    const row = [day];
                    
                    // Add sample periods
                    for (let i = 1; i <= 8; i++) {
                        if (i === 4) {
                            // Break period
                            row.push('BREAK', '', '', '11:00-11:30', 'Regular');
                        } else {
                            row.push('Mathematics', 'John Doe', '17PVSS0001', `${8+i}:00-${8+i}:45`, 'Regular');
                        }
                    }
                    
                    data.push(row);
                });
                
                // Create worksheet
                const ws = XLSX.utils.aoa_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, className);
            });
            
            // Generate and download file
            XLSX.writeFile(wb, 'timetable_template.xlsx');
        }
        
        // Download CSV template
        function downloadCSVTemplate() {
            // Create CSV template with sample data
            const periodHeaders = makePeriodHeaders();
            let csv = `Class-Section,Day,${periodHeaders.join(',')}\n`;
            const samplePeriods = ['T001:Indira:MATHS', 'T001:Indira:ENGLISH', 'T002:Sai Priya:EVS', 'T003:Uma Rani:Hindi', 'T004:Pravalika:Maths'];
            getStandardDayOrder().slice(0, 3).forEach(day => {
                const periodCells = periodHeaders.map((_, index) => samplePeriods[index] || '');
                csv += `Grade-I-A,${day},${periodCells.join(',')}\n`;
            });
            
            // Create download link
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'timetable_template.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        // Toggle reschedule mode
        function toggleRescheduleMode() {
            state.rescheduleMode = !state.rescheduleMode;
            state.selectedPeriods = [];
            
            const rescheduleControls = document.getElementById('rescheduleControls');
            const rescheduleBtn = document.getElementById('rescheduleModeBtn');
            
            if (state.rescheduleMode) {
                rescheduleControls.style.display = 'flex';
                rescheduleBtn.innerHTML = '<i class="fas fa-times"></i> Exit Reschedule Mode';
                rescheduleBtn.classList.add('btn-danger');
                rescheduleBtn.classList.remove('btn-primary');
                
                // Add click listeners to timetable cells
                addRescheduleListeners();
            } else {
                rescheduleControls.style.display = 'none';
                rescheduleBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Reschedule Mode';
                rescheduleBtn.classList.remove('btn-danger');
                rescheduleBtn.classList.add('btn-primary');
                
                // Remove highlight from selected cells
                document.querySelectorAll('.swap-highlight').forEach(cell => {
                    cell.classList.remove('swap-highlight');
                });
                
                // Remove click listeners
                removeRescheduleListeners();
            }
        }
        
        // Add reschedule listeners
        function addRescheduleListeners() {
            const cells = document.querySelectorAll('.period-cell');
            cells.forEach(cell => {
                cell.addEventListener('click', handlePeriodSelection);
            });
        }
        
        // Remove reschedule listeners
        function removeRescheduleListeners() {
            const cells = document.querySelectorAll('.period-cell');
            cells.forEach(cell => {
                cell.removeEventListener('click', handlePeriodSelection);
            });
        }
        
        // Handle period selection for rescheduling
        function handlePeriodSelection(event) {
            const cell = event.currentTarget;
            const className = cell.getAttribute('data-class');
            const dayName = cell.getAttribute('data-day');
            const periodNum = parseInt(cell.getAttribute('data-period'));
            
            // Check if already selected
            const isSelected = state.selectedPeriods.some(p => 
                p.className === className && p.dayName === dayName && p.period === periodNum
            );
            
            if (isSelected) {
                // Deselect
                cell.classList.remove('swap-highlight');
                state.selectedPeriods = state.selectedPeriods.filter(p => 
                    !(p.className === className && p.dayName === dayName && p.period === periodNum)
                );
            } else {
                // Select (max 2 periods)
                if (state.selectedPeriods.length < 2) {
                    cell.classList.add('swap-highlight');
                    state.selectedPeriods.push({
                        className,
                        dayName,
                        period: periodNum
                    });
                    
                    // If 2 periods selected, enable swap button
                    if (state.selectedPeriods.length === 2) {
                        document.getElementById('confirmSwapBtn').disabled = false;
                    }
                }
            }
        }
        
        // Load timetable for modification
        function loadTimetableForModification() {
            const classFilter = document.getElementById('modifyClassFilter').value;
            
            if (!classFilter) {
                alert("Please select a class to load.");
                return;
            }
            
            if (!state.timetableData || !state.timetableData[classFilter]) {
                alert("No timetable data found for this class.");
                return;
            }
            
            const modifyTimetableDisplay = document.getElementById('modifyTimetableDisplay');
            const classData = state.timetableData[classFilter];
            
            modifyTimetableDisplay.innerHTML = `
                <h3 style="margin: 20px 0 10px 15px;">${classData.className}</h3>
                ${generateTimetableHTML(classData)}
            `;
            
            // Add click listeners if in reschedule mode
            if (state.rescheduleMode) {
                addRescheduleListeners();
            }
        }
        
        // Load teacher schedule
        function loadTeacherSchedule() {
            const teacherFilter = document.getElementById('teacherScheduleFilter').value;
            
            if (!teacherFilter) {
                alert("Please select a teacher to load schedule.");
                return;
            }
            
            const teacherScheduleDisplay = document.getElementById('teacherScheduleDisplay');
            teacherScheduleDisplay.innerHTML = generateTeacherTimetableHTML([teacherFilter]);
        }
        
        // Export teacher schedule
        function exportTeacherSchedule() {
            const teacherFilter = document.getElementById('teacherScheduleFilter').value;
            
            if (!teacherFilter) {
                alert("Please select a teacher to export schedule.");
                return;
            }
            
            alert(`Exporting schedule for ${teacherFilter}...`);
            // In a real app, this would generate an Excel or PDF file
        }
        
        // Open reschedule modal
        function openRescheduleModal() {
            if (state.selectedPeriods.length !== 2) {
                alert("Please select exactly two periods to swap.");
                return;
            }
            
            // Get period details
            const period1 = getPeriodDetails(state.selectedPeriods[0]);
            const period2 = getPeriodDetails(state.selectedPeriods[1]);
            
            document.getElementById('period1Info').innerHTML = `
                <strong>${period1.className} - ${period1.dayName} - Period ${period1.period}</strong><br>
                Subject: ${period1.subject}<br>
                Teacher: ${period1.teacherName}<br>
                Time: ${period1.time}
            `;
            
            document.getElementById('period2Info').innerHTML = `
                <strong>${period2.className} - ${period2.dayName} - Period ${period2.period}</strong><br>
                Subject: ${period2.subject}<br>
                Teacher: ${period2.teacherName}<br>
                Time: ${period2.time}
            `;
            
            document.getElementById('rescheduleModal').classList.add('active');
        }
        
        // Close reschedule modal
        function closeRescheduleModal() {
            document.getElementById('rescheduleModal').classList.remove('active');
        }
        
        // Confirm reschedule
        function confirmReschedule() {
            if (state.selectedPeriods.length !== 2) {
                alert("Please select exactly two periods to swap.");
                return;
            }
            
            const period1 = state.selectedPeriods[0];
            const period2 = state.selectedPeriods[1];
            
            // Swap the periods
            swapPeriods(period1, period2);
            
            // Save to storage
            saveTimetableToStorage();
            
            // Update UI
            loadTimetableForModification();
            closeRescheduleModal();
            
            // Reset selection
            state.selectedPeriods = [];
            document.querySelectorAll('.swap-highlight').forEach(cell => {
                cell.classList.remove('swap-highlight');
            });
            
            alert("Periods swapped successfully!");
        }
        
        // Get period details
        function getPeriodDetails(periodInfo) {
            const classData = state.timetableData[periodInfo.className];
            const dayData = classData.days.find(d => d.dayName === periodInfo.dayName);
            const periodData = dayData.periods.find(p => p.period === periodInfo.period);
            
            return {
                className: periodInfo.className,
                dayName: periodInfo.dayName,
                period: periodInfo.period,
                subject: periodData.subject,
                teacherName: periodData.teacherName,
                time: periodData.time
            };
        }
        
        // Swap periods
        function swapPeriods(period1, period2) {
            const classData1 = state.timetableData[period1.className];
            const dayData1 = classData1.days.find(d => d.dayName === period1.dayName);
            const periodData1 = dayData1.periods.find(p => p.period === period1.period);
            
            const classData2 = state.timetableData[period2.className];
            const dayData2 = classData2.days.find(d => d.dayName === period2.dayName);
            const periodData2 = dayData2.periods.find(p => p.period === period2.period);
            
            // Swap the subject, teacher, and ID (keep time and type)
            const tempSubject = periodData1.subject;
            const tempTeacherName = periodData1.teacherName;
            const tempTeacherId = periodData1.teacherId;
            
            periodData1.subject = periodData2.subject;
            periodData1.teacherName = periodData2.teacherName;
            periodData1.teacherId = periodData2.teacherId;
            
            periodData2.subject = tempSubject;
            periodData2.teacherName = tempTeacherName;
            periodData2.teacherId = tempTeacherId;
        }
        
        // Set up reschedule controls
        document.getElementById('confirmSwapBtn').addEventListener('click', openRescheduleModal);
        document.getElementById('cancelSwapBtn').addEventListener('click', function() {
            toggleRescheduleMode();
        });
