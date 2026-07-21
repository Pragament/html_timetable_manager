/**
 * manual-builder.js
 * Spreadsheet-style manual timetable builder for School Timetable Manager.
 * Reads from the main app's `state` object (teachers, classSections, teacherMappings)
 * and writes back via pushMBToMainApp().
 */

// ─── Module State ────────────────────────────────────────────────────────────
const mbState = {
    periodsPerDay: 7,
    activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    dayLabels: { Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'TH', Fri: 'F' },
    dayFull: { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' },
    grid: {},        // grid[className][day][period] = { subject, teacherName } | null
    initialized: false,
    activeCell: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get all class names from state, sorted */
function mbGetClasses() {
    const set = new Set();
    (state.classSections || []).forEach(c => {
        const name = c.className || (c.class && c.section ? `${c.class}-${c.section}` : null);
        if (name) set.add(name);
    });
    Object.keys(state.timetableData || {}).forEach(k => set.add(k));
    return Array.from(set).sort((a, b) => {
        if (typeof compareGradeSection === 'function') return compareGradeSection(a, b);
        return a.localeCompare(b);
    });
}

/** Get teacher-subject options available for a given class */
function mbGetOptionsForClass(className) {
    const options = [];
    const seen = new Set();
    (state.teacherMappings || []).forEach(m => {
        let grades = [];
        if (typeof parseGradeSectionParts === 'function' && typeof resolveMappingToClassNames === 'function') {
            grades = m.gradeSection ? parseGradeSectionParts(m.gradeSection).flatMap(part => resolveMappingToClassNames(part)).filter(Boolean) : [];
        } else {
            grades = m.gradeSection ? m.gradeSection.split(',').map(s => s.trim()) : [];
        }
        if (!grades.includes(className)) return;
        const key = `${m.teacherName}||${m.subject}`;
        if (seen.has(key)) return;
        seen.add(key);
        options.push({ teacherName: m.teacherName, subject: m.subject });
    });
    return options;
}

/** Ensure grid is initialized for all known classes / days / periods */
function mbEnsureGrid() {
    const classes = mbGetClasses();
    classes.forEach(cls => {
        if (!mbState.grid[cls]) mbState.grid[cls] = {};
        mbState.activeDays.forEach(day => {
            if (!mbState.grid[cls][day]) mbState.grid[cls][day] = {};
            for (let p = 1; p <= mbState.periodsPerDay; p++) {
                if (mbState.grid[cls][day][p] === undefined) {
                    mbState.grid[cls][day][p] = null;
                }
            }
        });
    });
}

/** Trim grid to current periods/days (remove extra slots) */
function mbTrimGrid() {
    Object.keys(mbState.grid).forEach(cls => {
        Object.keys(mbState.grid[cls]).forEach(day => {
            if (!mbState.activeDays.includes(day)) {
                delete mbState.grid[cls][day];
                return;
            }
            Object.keys(mbState.grid[cls][day]).forEach(p => {
                if (parseInt(p) > mbState.periodsPerDay) delete mbState.grid[cls][day][p];
            });
        });
    });
}

/** Detect teacher double-bookings: returns Map<"day|period|teacher", className[]> */
function mbGetConflicts() {
    const map = new Map();
    Object.keys(mbState.grid).forEach(cls => {
        mbState.activeDays.forEach(day => {
            for (let p = 1; p <= mbState.periodsPerDay; p++) {
                const slot = mbState.grid[cls]?.[day]?.[p];
                if (!slot || !slot.teacherName) return;
                const key = `${day}|${p}|${slot.teacherName}`;
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(cls);
            }
        });
    });
    // Only keep actual conflicts (more than 1 class)
    const conflicts = new Set();
    map.forEach((classes, key) => {
        if (classes.length > 1) conflicts.add(key);
    });
    return conflicts;
}

/** Get period time string from main app if available */
function mbGetPeriodTime(p) {
    if (typeof getPeriodTime === 'function') {
        return getPeriodTime(p) || '';
    }
    return '';
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderMBGrid() {
    const container = document.getElementById('mbGridWrap');
    if (!container) return;

    mbEnsureGrid();
    const classes = mbGetClasses();
    const conflicts = mbGetConflicts();

    if (classes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-table"></i>
                <h3>No Classes Found</h3>
                <p>Go to <strong>Setup</strong> and add class sections first.</p>
            </div>`;
        return;
    }

    // Build header
    let html = '<div style="overflow-x: auto;"><table class="timetable mb-table">';

    // Row 1: CLASS | P1 (colspan=days) | P2 (colspan=days) ...
    html += '<thead><tr>';
    html += '<th rowspan="2" style="min-width: 120px;">Class</th>';
    for (let p = 1; p <= mbState.periodsPerDay; p++) {
        const time = mbGetPeriodTime(p);
        html += `<th colspan="${mbState.activeDays.length}">
            <div>P${p}</div>
            ${time ? `<div class="period-header-time">${time}</div>` : ''}
        </th>`;
    }
    html += '</tr>';

    // Row 2: day sub-headers
    html += '<tr>';
    for (let p = 1; p <= mbState.periodsPerDay; p++) {
        mbState.activeDays.forEach(day => {
            html += `<th style="font-size: 11px; padding: 4px; min-width: 40px;">${mbState.dayLabels[day]}</th>`;
        });
    }
    html += '</tr></thead><tbody>';

    // Data rows
    classes.forEach(cls => {
        html += `<tr>`;
        html += `<td style="font-weight: 600; background-color: #f9f9f9; text-align: center;">${escapeHtml ? escapeHtml(cls) : cls}</td>`;
        for (let p = 1; p <= mbState.periodsPerDay; p++) {
            mbState.activeDays.forEach(day => {
                const slot = mbState.grid[cls]?.[day]?.[p];
                const conflictKey = slot?.teacherName ? `${day}|${p}|${slot.teacherName}` : null;
                const isConflict = conflictKey && conflicts.has(conflictKey);
                
                let cellStyle = 'cursor: pointer; text-align: center; position: relative; padding: 4px; font-size: 11px; border: 1px solid #eee;';
                if (slot) {
                    cellStyle += isConflict ? 'background-color: #ffebee;' : 'background-color: #e8f5e9;';
                }

                const display = slot
                    ? `<div style="font-weight: 600; color: #2c3e50; line-height: 1.1;">${escapeHtml ? escapeHtml(slot.subject || '') : slot.subject || ''}</div>
                       <div style="color: #7f8c8d; font-size: 10px; margin-top: 2px;">${escapeHtml ? escapeHtml(slot.teacherName || '') : slot.teacherName || ''}</div>`
                    : '<div style="color: #ccc;">—</div>';

                html += `<td style="${cellStyle}" 
                    data-class="${cls}" 
                    data-day="${day}" 
                    data-period="${p}"
                    title="${isConflict ? '⚠ Conflict: Teacher double-booked' : 'Click to assign'}"
                    onclick="mbOpenCellEditor(this, '${cls}', '${day}', ${p})">
                    ${display}
                </td>`;
            });
        }
        html += `</tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    renderMBStats();
}

function renderMBStats() {
    const sidebar = document.getElementById('mbStatsSidebar');
    if (!sidebar) return;

    const classes = mbGetClasses();
    const totalCells = mbState.periodsPerDay * mbState.activeDays.length;

    // By Class
    const byClass = {};
    classes.forEach(cls => {
        byClass[cls] = 0;
    });

    // By Teacher and Subject
    const byTeacher = {};
    const bySubject = {};

    Object.keys(mbState.grid).forEach(cls => {
        mbState.activeDays.forEach(day => {
            for (let p = 1; p <= mbState.periodsPerDay; p++) {
                const slot = mbState.grid[cls]?.[day]?.[p];
                if (!slot) return;
                byClass[cls] = (byClass[cls] || 0) + 1;
                if (slot.teacherName) byTeacher[slot.teacherName] = (byTeacher[slot.teacherName] || 0) + 1;
                if (slot.subject) bySubject[slot.subject] = (bySubject[slot.subject] || 0) + 1;
            }
        });
    });

    const totalFilled = Object.values(byClass).reduce((a, b) => a + b, 0);
    const totalPossible = classes.length * totalCells;

    let html = `
    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 15px; display: flex; justify-content: space-between;">
            <span><i class="fas fa-chart-bar"></i> Stats</span>
            <span style="color: #7f8c8d;">${totalFilled}/${totalPossible}</span>
        </div>

        <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: 600; color: #7f8c8d; margin-bottom: 8px; letter-spacing: 0.5px;"><i class="fas fa-school"></i> BY CLASS</div>`;

    classes.forEach(cls => {
        const filled = byClass[cls] || 0;
        const pct = totalCells > 0 ? Math.round((filled / totalCells) * 100) : 0;
        html += `
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
                <span>${cls}</span>
                <span style="color: ${filled === totalCells ? '#27ae60' : '#7f8c8d'}">${filled}/${totalCells}</span>
            </div>
            <div style="height: 4px; background: #ecf0f1; border-radius: 2px; margin-bottom: 8px; overflow: hidden;">
                <div style="height: 100%; background: ${filled === totalCells ? '#2ecc71' : '#3498db'}; width: ${pct}%"></div>
            </div>`;
    });

    html += `</div><div style="margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 600; color: #7f8c8d; margin-bottom: 8px; letter-spacing: 0.5px;"><i class="fas fa-chalkboard-teacher"></i> BY TEACHER</div>`;

    const sortedTeachers = Object.entries(byTeacher).sort((a, b) => b[1] - a[1]);
    if (sortedTeachers.length === 0) {
        html += `<div style="font-size: 12px; color: #bdc3c7; font-style: italic;">No teachers assigned</div>`;
    } else {
        sortedTeachers.forEach(([t, count]) => {
            html += `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; border-bottom: 1px solid #f1f2f6; padding-bottom: 2px;">
                <span>${t}</span><span style="color: #3498db; font-weight: 600;">${count}</span>
            </div>`;
        });
    }

    html += `</div><div>
        <div style="font-size: 11px; font-weight: 600; color: #7f8c8d; margin-bottom: 8px; letter-spacing: 0.5px;"><i class="fas fa-book"></i> BY SUBJECT</div>`;

    const sortedSubjects = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);
    if (sortedSubjects.length === 0) {
        html += `<div style="font-size: 12px; color: #bdc3c7; font-style: italic;">No subjects assigned</div>`;
    } else {
        sortedSubjects.forEach(([s, count]) => {
            html += `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; border-bottom: 1px solid #f1f2f6; padding-bottom: 2px;">
                <span>${s}</span><span style="color: #3498db; font-weight: 600;">${count}</span>
            </div>`;
        });
    }

    html += `</div></div>`;
    sidebar.innerHTML = html;
}

// ─── Cell Editor Popup ────────────────────────────────────────────────────────

function mbOpenCellEditor(tdEl, className, day, period) {
    // Remove any existing popup
    const existing = document.getElementById('mbCellPopup');
    if (existing) existing.remove();
    if (mbState.activeCell === `${className}|${day}|${period}`) {
        mbState.activeCell = null;
        return;
    }
    mbState.activeCell = `${className}|${day}|${period}`;

    const options = mbGetOptionsForClass(className);
    const current = mbState.grid[className]?.[day]?.[period];

    const popup = document.createElement('div');
    popup.id = 'mbCellPopup';
    popup.style.cssText = 'position: absolute; background: white; border: 1px solid #dcdde1; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); width: 280px; z-index: 1000; padding: 12px; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;';

    let optHtml = `<option value="">— Clear Slot —</option>`;
    let isCurrentCustom = false;
    
    if (current && (current.subject || current.teacherName)) {
        const found = options.some(opt => opt.teacherName === current.teacherName && opt.subject === current.subject);
        if (!found) isCurrentCustom = true;
    }

    options.forEach((opt, i) => {
        const val = JSON.stringify({ subject: opt.subject, teacherName: opt.teacherName });
        const selected = !isCurrentCustom && current && current.teacherName === opt.teacherName && current.subject === opt.subject ? ' selected' : '';
        optHtml += `<option value='${val}'${selected}>${opt.subject || '?'} (${opt.teacherName})</option>`;
    });

    if (options.length === 0) {
        optHtml += `<option disabled>No mappings found for ${className}</option>`;
    }
    
    optHtml += `<option value="custom"${isCurrentCustom ? ' selected' : ''}>— Custom Entry —</option>`;

    const applyAllChecked = document.getElementById('mbApplyAllDays')?.checked ? 'checked' : '';
    const customDisplay = isCurrentCustom ? 'block' : 'none';
    const customSubj = isCurrentCustom ? (current.subject || '') : '';
    const customTeach = isCurrentCustom ? (current.teacherName || '') : '';

    popup.innerHTML = `
        <div style="font-size: 12px; font-weight: 600; color: #2c3e50; margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>${className} — ${mbState.dayFull[day]}, P${period}</span>
            <button onclick="document.getElementById('mbCellPopup').remove(); mbState.activeCell=null;" style="background:none; border:none; color:#7f8c8d; cursor:pointer;">✕</button>
        </div>
        <select id="mbCellSelect" class="form-control" style="width: 100%; margin-bottom: 10px; font-size: 13px;" onchange="document.getElementById('mbCustomFields').style.display = this.value === 'custom' ? 'block' : 'none'">
            ${optHtml}
        </select>
        <div id="mbCustomFields" style="display: ${customDisplay}; margin-bottom: 10px;">
            <input type="text" id="mbCustomSubject" value="${escapeHtml ? escapeHtml(customSubj) : customSubj}" placeholder="Subject (e.g. English)" style="width: 100%; margin-bottom: 5px; font-size: 13px; padding: 4px; border: 1px solid #dcdde1; border-radius: 4px;">
            <input type="text" id="mbCustomTeacher" value="${escapeHtml ? escapeHtml(customTeach) : customTeach}" placeholder="Teacher Name" style="width: 100%; font-size: 13px; padding: 4px; border: 1px solid #dcdde1; border-radius: 4px;">
        </div>
        <label style="display: block; font-size: 12px; color: #34495e; margin-bottom: 12px; cursor: pointer;">
            <input type="checkbox" id="mbPopupApplyAll" ${applyAllChecked}> Apply to all days (this period)
        </label>
        <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" style="flex: 1; padding: 6px; font-size: 12px;" onclick="mbApplyCellSelection('${className}', '${day}', ${period})">
                <i class="fas fa-check"></i> Apply
            </button>
            <button class="btn btn-secondary" style="flex: 1; padding: 6px; font-size: 12px;" onclick="mbClearCell('${className}', '${day}', ${period}); document.getElementById('mbCellPopup').remove(); mbState.activeCell=null;">
                <i class="fas fa-eraser"></i> Clear
            </button>
        </div>
    `;

    // Position near cell
    const rect = tdEl.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // Check if we need to adjust position to keep it in viewport
    let top = rect.bottom + scrollTop + 4;
    let left = rect.left;
    
    // Check if too far right
    if (left + 280 > window.innerWidth) {
        left = window.innerWidth - 300;
    }
    
    popup.style.top = top + 'px';
    popup.style.left = left + 'px';
    document.body.appendChild(popup);

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function outsideClick(e) {
            if (!popup.contains(e.target) && !tdEl.contains(e.target)) {
                popup.remove();
                mbState.activeCell = null;
                document.removeEventListener('click', outsideClick);
            }
        });
    }, 10);
}

function mbApplyCellSelection(className, day, period) {
    const select = document.getElementById('mbCellSelect');
    const applyAll = document.getElementById('mbPopupApplyAll')?.checked;

    let value = null;
    if (select.value === 'custom') {
        const subj = document.getElementById('mbCustomSubject').value.trim();
        const teach = document.getElementById('mbCustomTeacher').value.trim();
        if (subj || teach) {
            value = { subject: subj, teacherName: teach };
        }
    } else if (select.value) {
        try { value = JSON.parse(select.value); } catch(e) {}
    }

    if (applyAll) {
        mbState.activeDays.forEach(d => {
            mbSetCell(className, d, period, value);
        });
        
        // Remember checkbox state
        const globalCheckbox = document.getElementById('mbApplyAllDays');
        if (globalCheckbox) globalCheckbox.checked = true;
    } else {
        mbSetCell(className, day, period, value);
    }

    document.getElementById('mbCellPopup')?.remove();
    mbState.activeCell = null;
    renderMBGrid();
}

function mbSetCell(className, day, period, value) {
    if (!mbState.grid[className]) mbState.grid[className] = {};
    if (!mbState.grid[className][day]) mbState.grid[className][day] = {};
    mbState.grid[className][day][period] = value;
}

function mbClearCell(className, day, period) {
    mbSetCell(className, day, period, null);
    renderMBGrid();
}

// ─── Toolbar Actions ──────────────────────────────────────────────────────────

function mbSetPeriods(count) {
    const n = parseInt(count);
    if (isNaN(n) || n < 1 || n > 15) return;
    mbState.periodsPerDay = n;
    mbTrimGrid();
    renderMBGrid();
}

function mbClearGrid() {
    if (!confirm('Clear all assignments in the manual builder? This action cannot be undone.')) return;
    mbState.grid = {};
    mbEnsureGrid();
    renderMBGrid();
}

// ─── Export ───────────────────────────────────────────────────────────────────

function mbExportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Excel export library not loaded.');
        return;
    }

    const classes = mbGetClasses();
    const wb = XLSX.utils.book_new();

    // Summary sheet: one row per class per day per period
    const rows = [['Class', 'Day', 'Period', 'Teacher', 'Subject']];
    classes.forEach(cls => {
        mbState.activeDays.forEach(day => {
            for (let p = 1; p <= mbState.periodsPerDay; p++) {
                const slot = mbState.grid[cls]?.[day]?.[p];
                rows.push([cls, mbState.dayFull[day] || day, `P${p}`, slot?.teacherName || '', slot?.subject || '']);
            }
        });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Add padding (styling)
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 25 }];
    ws['!rows'] = rows.map(() => ({ hpt: 25 }));
    
    XLSX.utils.book_append_sheet(wb, ws, 'All Data');

    // Per-class sheets
    classes.forEach(cls => {
        const headers = ['Period', ...mbState.activeDays.map(d => mbState.dayFull[d] || d)];
        const clsRows = [headers];
        for (let p = 1; p <= mbState.periodsPerDay; p++) {
            const row = [`P${p}`];
            mbState.activeDays.forEach(day => {
                const slot = mbState.grid[cls]?.[day]?.[p];
                row.push(slot ? `${slot.subject || ''}${slot.teacherName ? ` (${slot.teacherName})` : ''}` : '');
            });
            clsRows.push(row);
        }
        const clsWs = XLSX.utils.aoa_to_sheet(clsRows);
        
        const cols = [{ wch: 10 }];
        mbState.activeDays.forEach(() => cols.push({ wch: 25 }));
        clsWs['!cols'] = cols;
        clsWs['!rows'] = clsRows.map(() => ({ hpt: 35 }));
        
        XLSX.utils.book_append_sheet(wb, clsWs, cls.replace(/[\\/*?[\]]/g, '_').substring(0, 31));
    });

    XLSX.writeFile(wb, 'manual_timetable.xlsx');
}

/** Convert mbState.grid → state.timetableData format and push to main app */
function mbPushToMainApp() {
    const classes = mbGetClasses();
    let hasData = false;

    classes.forEach(cls => {
        mbState.activeDays.forEach(day => {
            for (let p = 1; p <= mbState.periodsPerDay; p++) {
                if (mbState.grid[cls]?.[day]?.[p]) { hasData = true; }
            }
        });
    });

    if (!hasData) {
        alert('The manual builder grid is empty. Fill in some periods first.');
        return;
    }

    if (!confirm('This will replace the current timetable data in the main app with the manually built timetable. Continue?')) return;

    // Convert grid format to state.timetableData format
    if (!state.timetableData) state.timetableData = {};

    classes.forEach(cls => {
        const days = mbState.activeDays.map(dayKey => {
            const dayName = mbState.dayFull[dayKey] || dayKey;
            const periods = [];
            for (let p = 1; p <= mbState.periodsPerDay; p++) {
                const slot = mbState.grid[cls]?.[dayKey]?.[p];
                periods.push({
                    period: p,
                    subject: slot?.subject || '',
                    teacherName: slot?.teacherName || '',
                    teacherId: '',
                    time: mbGetPeriodTime(p),
                    type: 'Teaching',
                    overlap: false,
                    overlapInfo: ''
                });
            }
            return { dayName, periods };
        });

        state.timetableData[cls] = {
            className: cls,
            days
        };
    });

    // Refresh main app
    if (typeof updateClassFilters === 'function') updateClassFilters();
    if (typeof renderTimetable === 'function') renderTimetable();

    // Switch to View Timetable tab
    const tabs = document.querySelectorAll('.tab');
    const sections = document.querySelectorAll('.content-section');
    
    tabs.forEach(t => t.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    
    const viewTab = document.querySelector('.tab[data-target="view-timetable-section"]');
    const viewSection = document.getElementById('view-timetable-section');
    
    if (viewTab) viewTab.classList.add('active');
    if (viewSection) viewSection.classList.add('active');

    setTimeout(() => alert('✅ Timetable pushed to the main app successfully!'), 100);
}

// ─── Initialisation ───────────────────────────────────────────────────────────

function initManualBuilder() {
    if (!mbState.initialized) {
        // Seed from main app's timetable data if available
        const classes = mbGetClasses();
        classes.forEach(cls => {
            if (!mbState.grid[cls]) mbState.grid[cls] = {};
            const classData = state.timetableData?.[cls];
            if (classData?.days) {
                classData.days.forEach(day => {
                    const dayKey = Object.keys(mbState.dayFull).find(k => mbState.dayFull[k] === day.dayName) || day.dayName;
                    if (!mbState.activeDays.includes(dayKey)) return;
                    if (!mbState.grid[cls][dayKey]) mbState.grid[cls][dayKey] = {};
                    (day.periods || []).forEach(period => {
                        if (period.period > mbState.periodsPerDay) return;
                        mbState.grid[cls][dayKey][period.period] = (period.subject || period.teacherName)
                            ? { subject: period.subject, teacherName: period.teacherName }
                            : null;
                    });
                });
            }
        });
        mbState.initialized = true;
    }
    
    // Sync periods spinner with main app config
    const configPeriods = state.periodsPerDay || state.config?.periodsPerDay;
    if (configPeriods) {
        const input = document.getElementById('mbPeriodsInput');
        if (input && parseInt(input.value) !== parseInt(configPeriods)) {
            mbState.periodsPerDay = parseInt(configPeriods) || 7;
            input.value = mbState.periodsPerDay;
        }
    }
    
    mbEnsureGrid();
    renderMBGrid();
}

// ─── Events ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Setup tab listener to initialize when clicked
    const tabContainer = document.querySelector('.tabs');
    if (tabContainer) {
        tabContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.tab');
            if (tab && tab.dataset.target === 'manual-builder-section') {
                setTimeout(initManualBuilder, 50);
            }
        });
    }

    const mbPeriodsInput = document.getElementById('mbPeriodsInput');
    if (mbPeriodsInput) {
        mbPeriodsInput.addEventListener('change', () => mbSetPeriods(mbPeriodsInput.value));
    }
    
    const mbExportBtn = document.getElementById('mbExportBtn');
    if (mbExportBtn) {
        mbExportBtn.addEventListener('click', mbExportToExcel);
    }
    
    const mbClearBtn = document.getElementById('mbClearBtn');
    if (mbClearBtn) {
        mbClearBtn.addEventListener('click', mbClearGrid);
    }
    
    const mbPushBtn = document.getElementById('mbPushBtn');
    if (mbPushBtn) {
        mbPushBtn.addEventListener('click', mbPushToMainApp);
    }
});
