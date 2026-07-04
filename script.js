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
    editedCells: {},
    lastEdit: null,
    unresolvedMappings: [],
    consumedCslMappings: [],
    stagedTimetableData: null,
    assignmentReverseMap: new Map(),
    config: {
        schoolDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        periodsPerDay: 7,
        periodsPerTeacher: 35,
        aiPromptStyle: 'compact',
        maxSwapAttempts: 200
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
document.addEventListener( 'DOMContentLoaded', function () {
    // Load data from localStorage if available
    loadFromLocalStorage();

    // Set up tab navigation
    setupTabs();

    // Set up event listeners
    setupEventListeners();

    // Initialize the UI
    initUI();
} );

// Load data from localStorage
function loadFromLocalStorage() {
    const storedTimetable = localStorage.getItem( 'schoolTimetable' );
    const storedHolidays = localStorage.getItem( 'schoolHolidays' );
    const storedPeriodTimes = localStorage.getItem( 'periodTimes' );
    const storedTeacherSubjectMap = localStorage.getItem( 'teacherSubjectMap' );
    const storedTeachers = localStorage.getItem( 'teacherMasterList' );
    const storedTeacherMappings = localStorage.getItem( 'teacherGradeSubjectMappings' );
    const storedConfig = localStorage.getItem( 'timetableConfig' );
    const storedClassSections = localStorage.getItem( 'classSections' );
    let parsedTimetable = null;

    if ( storedTimetable ) {
        try {
            parsedTimetable = JSON.parse( storedTimetable );
        } catch ( e ) {
            parsedTimetable = null;
        }
    }

    if ( storedHolidays ) {
        state.holidays = JSON.parse( storedHolidays );
    } else {
        // Use sample holidays if none stored
        state.holidays = sampleHolidays;
        saveHolidaysToStorage();
    }

    if ( storedPeriodTimes ) {
        // Clear out old period times to force the new default timetable structure
        state.periodTimes = {};
        localStorage.removeItem( 'periodTimes' );
    }

    if ( storedTeacherSubjectMap ) {
        state.teacherSubjectMap = JSON.parse( storedTeacherSubjectMap );
    }

    if ( storedTeachers ) {
        state.teachers = JSON.parse( storedTeachers );
    }

    if ( storedTeacherMappings ) {
        state.teacherMappings = JSON.parse( storedTeacherMappings );
    }

    const storedSubjects = localStorage.getItem( 'subjects' );
    if ( storedClassSections ) {
        try {
            const parsed = JSON.parse( storedClassSections ) || [];
            state.classSections = ( parsed || [] ).map( item => {
                // support legacy string entries and object entries
                if ( !item ) return null;
                if ( typeof item === 'string' ) {
                    // expected formats: 'Class-10-A' or '10-A' or '10:A'
                    const s = item.trim();
                    const parts = s.split( /[-:]/ ).filter( Boolean );
                    if ( parts.length >= 3 && parts[0].toLowerCase() === 'class' ) {
                        return { className: `Class-${parts[1]}-${parts[2]}`, class: parts[1], section: parts[2] };
                    } else if ( parts.length >= 2 ) {
                        return { className: `Class-${parts[0]}-${parts[1]}`, class: parts[0], section: parts[1] };
                    }
                    return null;
                }
                if ( typeof item === 'object' ) {
                    // already structured
                    if ( item.className && item.section ) return item;
                    const cls = item.class || item.grade || item.gradeSection || '';
                    const sec = item.section || item.sec || '';
                    if ( cls && sec ) return { className: `Class-${cls}-${sec}`, class: cls, section: sec };
                    return null;
                }
                return null;
            } ).filter( Boolean );
        } catch ( e ) {
            state.classSections = [];
        }
    }
    if ( storedSubjects ) {
        try {
            const parsedSubjects = JSON.parse( storedSubjects ) || [];
            state.subjects = ( parsedSubjects || [] )
                .map( item => {
                    if ( typeof item === 'string' ) return { code: toCleanString( item ), name: toCleanString( item ) };
                    if ( item && typeof item === 'object' ) return { code: toCleanString( item.code || item.name ), name: toCleanString( item.name || item.code ) };
                    return null;
                } )
                .filter( s => s && s.code )
                .sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );
        } catch ( e ) {
            state.subjects = [];
        }
    }

    if ( storedConfig ) {
        const parsedConfig = JSON.parse( storedConfig );
        // Force migration for teachers limit if it was saved as 30
        if ( parsedConfig.periodsPerTeacher === 30 ) {
            parsedConfig.periodsPerTeacher = 35;
            localStorage.setItem( 'timetableConfig', JSON.stringify( parsedConfig ) );
        }
        state.config = {
            ...state.config,
            ...parsedConfig
        };
    }

    // Normalize timetable after config is loaded so period/day counts are correct.
    if ( parsedTimetable ) {
        state.timetableData = normalizeLoadedTimetableData( parsedTimetable );
        if ( !state.timetableData ) {
            console.warn( 'Ignoring invalid schoolTimetable data in localStorage.' );
        } else if ( state.timetableData !== parsedTimetable ) {
            saveTimetableToStorage();
        }
    }

    // Remove obsolete parallel keys written by earlier generator versions.
    try {
        localStorage.removeItem( 'generatedTimetable' );
        localStorage.removeItem( 'generatedTimetableUnscheduled' );
    } catch ( e ) {
        // Ignore storage cleanup failures in restricted browser modes.
    }
}

// Save timetable to localStorage
function saveTimetableToStorage() {
    if ( state.timetableData ) {
        localStorage.setItem( 'schoolTimetable', JSON.stringify( state.timetableData ) );
    }
}

// Save holidays to localStorage
function saveHolidaysToStorage() {
    localStorage.setItem( 'schoolHolidays', JSON.stringify( state.holidays ) );
}

// Save period times to localStorage
function savePeriodTimesToStorage() {
    localStorage.setItem( 'periodTimes', JSON.stringify( state.periodTimes ) );
}

function saveTeacherSubjectMapToStorage() {
    localStorage.setItem( 'teacherSubjectMap', JSON.stringify( state.teacherSubjectMap || {} ) );
}

function saveMasterDataToStorage() {
    localStorage.setItem( 'teacherMasterList', JSON.stringify( state.teachers || [] ) );
    localStorage.setItem( 'teacherGradeSubjectMappings', JSON.stringify( state.teacherMappings || [] ) );
    localStorage.setItem( 'timetableConfig', JSON.stringify( state.config || {} ) );
    localStorage.setItem( 'classSections', JSON.stringify( state.classSections || [] ) );
    localStorage.setItem( 'subjects', JSON.stringify( state.subjects || [] ) );
}

// Set up tab navigation
function setupTabs() {
    const tabs = document.querySelectorAll( '.tab' );
    tabs.forEach( tab => {
        tab.addEventListener( 'click', function () {
            const targetId = this.getAttribute( 'data-target' );

            // Remove active class from all tabs and sections
            tabs.forEach( t => t.classList.remove( 'active' ) );
            document.querySelectorAll( '.content-section' ).forEach( section => {
                section.classList.remove( 'active' );
            } );

            // Add active class to clicked tab and corresponding section
            this.classList.add( 'active' );
            document.getElementById( targetId ).classList.add( 'active' );
        } );
    } );
}

// Set up event listeners
function setupEventListeners() {
    // Dashboard button
    document.getElementById( 'dashboardBtn' ).addEventListener( 'click', function () {
        alert( "Redirecting to Dashboard..." );
    } );

    // Local setup and AI prompt
    document.getElementById( 'teacherListFileInput' ).addEventListener( 'change', handleTeacherListUpload );
    const exportBtn = document.getElementById( 'exportTeachersBtn' );
    if ( exportBtn ) exportBtn.addEventListener( 'click', exportTeacherList );
    document.getElementById( 'teacherMappingFileInput' ).addEventListener( 'change', handleTeacherMappingUpload );
    document.getElementById( 'addTeacherRowBtn' ).addEventListener( 'click', addTeacherRow );
    const clearTeachersBtn = document.getElementById( 'clearTeachersBtn' );
    if ( clearTeachersBtn ) clearTeachersBtn.addEventListener( 'click', clearTeachers );
    document.getElementById( 'addMappingRowBtn' ).addEventListener( 'click', addMappingRow );
    const clearTeacherMappingsBtn = document.getElementById( 'clearTeacherMappingsBtn' );
    if ( clearTeacherMappingsBtn ) clearTeacherMappingsBtn.addEventListener( 'click', clearTeacherMappings );
    const exportMappingBtn = document.getElementById( 'exportMappingBtn' );
    if ( exportMappingBtn ) exportMappingBtn.addEventListener( 'click', exportTeacherMappingCSV );

    const teacherMappingSearch = document.getElementById( 'teacherMappingSearch' );
    if ( teacherMappingSearch ) {
        teacherMappingSearch.addEventListener( 'input', function ( e ) {
            const query = e.target.value.trim();
            const searchTerms = query.toLowerCase().split( /\s+/ ).filter( Boolean );

            const exactGrade = e.target.dataset.exactGrade || '';
            const exactSubject = e.target.dataset.exactSubject || '';
            const isExactMatch = exactGrade && exactSubject && query === `${exactGrade} ${exactSubject}`;

            if ( !isExactMatch ) {
                e.target.dataset.exactGrade = '';
                e.target.dataset.exactSubject = '';
            }

            const rows = document.querySelectorAll( '#teacherMappingTable tbody tr' );
            rows.forEach( row => {
                const teacherIdSelect = row.querySelector( '[data-field="teacherId"]' );
                let teacherText = teacherIdSelect && teacherIdSelect.selectedOptions.length > 0 ? teacherIdSelect.selectedOptions[0].text.toLowerCase() : '';

                const gradeSelect = row.querySelector( '[data-field="gradeSection"]' );
                let gradeText = gradeSelect ? Array.from( gradeSelect.selectedOptions ).map( o => o.value.toLowerCase() ).join( ' ' ) : '';
                let rawGradeText = gradeSelect ? Array.from( gradeSelect.selectedOptions ).map( o => o.value ).join( ' ' ) : '';

                const subjectSelect = row.querySelector( '[data-field="subject"]' );
                let subjectText = subjectSelect && subjectSelect.selectedOptions.length > 0 ? subjectSelect.selectedOptions[0].value.toLowerCase() : '';
                let rawSubjectText = subjectSelect && subjectSelect.selectedOptions.length > 0 ? subjectSelect.selectedOptions[0].value : '';

                if ( isExactMatch ) {
                    if ( rawGradeText.includes( exactGrade ) && rawSubjectText === exactSubject ) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                } else {
                    const rowText = `${teacherText} ${gradeText} ${subjectText}`;
                    if ( searchTerms.length === 0 || searchTerms.every( term => rowText.includes( term ) ) ) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            } );
        } );
    }

    window.filterTeacherMapping = function ( gradeSection, subject ) {
        const searchInput = document.getElementById( 'teacherMappingSearch' );
        if ( searchInput ) {
            searchInput.dataset.exactGrade = gradeSection;
            searchInput.dataset.exactSubject = subject;
            searchInput.value = `${gradeSection} ${subject}`;
            searchInput.dispatchEvent( new Event( 'input' ) );
            searchInput.scrollIntoView( { behavior: 'smooth', block: 'center' } );
        }
    };
    const genClassesBtn = document.getElementById( 'generateClassSectionsBtn' );
    if ( genClassesBtn ) genClassesBtn.addEventListener( 'click', generateClassSectionsFromInput );
    const clearClassesBtn = document.getElementById( 'clearClassSectionsBtn' );
    if ( clearClassesBtn ) clearClassesBtn.addEventListener( 'click', clearClassSections );
    const exportClassesBtn = document.getElementById( 'exportClassSectionsBtn' );
    if ( exportClassesBtn ) exportClassesBtn.addEventListener( 'click', exportClassSectionsCSV );
    const importClassesInput = document.getElementById( 'importClassSectionsFile' );
    if ( importClassesInput ) importClassesInput.addEventListener( 'change', handleImportClassSectionsCSV );
    const addSubjectBtn = document.getElementById( 'addSubjectRowBtn' );
    if ( addSubjectBtn ) addSubjectBtn.addEventListener( 'click', addSubjectRow );
    const clearSubjectsBtn = document.getElementById( 'clearSubjectsBtn' );
    if ( clearSubjectsBtn ) clearSubjectsBtn.addEventListener( 'click', clearSubjects );
    const exportSubjectsBtn = document.getElementById( 'exportSubjectsBtn' );
    if ( exportSubjectsBtn ) exportSubjectsBtn.addEventListener( 'click', exportSubjectsCSV );
    const importSubjectsInput = document.getElementById( 'importSubjectsFile' );
    if ( importSubjectsInput ) importSubjectsInput.addEventListener( 'change', handleImportSubjectsCSV );
    document.getElementById( 'saveMasterDataBtn' ).addEventListener( 'click', saveMasterDataFromTables );
    document.getElementById( 'downloadDataTemplatesBtn' ).addEventListener( 'click', downloadMasterDataTemplates );
    const quickAddMappingSubmitBtn = document.getElementById( 'quickAddMappingSubmitBtn' );
    if ( quickAddMappingSubmitBtn ) quickAddMappingSubmitBtn.addEventListener( 'click', handleQuickAddMappingSubmit );
    createGenerateButton();
    document.getElementById( 'generatePromptBtn' ).addEventListener( 'click', renderAIPrompt );
    document.getElementById( 'copyPromptBtn' ).addEventListener( 'click', copyAIPrompt );
    document.getElementById( 'downloadPromptBtn' ).addEventListener( 'click', downloadAIPrompt );
    ['schoolDaysInput', 'periodsPerDayInput', 'periodsPerTeacherInput', 'aiPromptStyleInput', 'maxSwapAttemptsInput'].forEach( id => {
        document.getElementById( id ).addEventListener( 'change', function () {
            syncConfigFromInputs();
            saveMasterDataToStorage();
            updateSetupSummary();
            renderAIPrompt();
        } );
    } );

    // Holiday management
    document.getElementById( 'addHolidayBtn' ).addEventListener( 'click', openAddHolidayModal );
    document.getElementById( 'addFirstHolidayBtn' ).addEventListener( 'click', openAddHolidayModal );
    document.getElementById( 'exportHolidaysBtn' ).addEventListener( 'click', exportHolidays );
    document.getElementById( 'yearSelect' ).addEventListener( 'change', function () {
        state.currentYear = this.value;
        renderHolidays();
    } );

    // Holiday modal
    document.getElementById( 'closeHolidayModal' ).addEventListener( 'click', closeAddHolidayModal );
    document.getElementById( 'cancelHolidayBtn' ).addEventListener( 'click', closeAddHolidayModal );
    document.getElementById( 'saveHolidayBtn' ).addEventListener( 'click', saveHoliday );

    // File type selector
    document.querySelectorAll( '.file-type-btn' ).forEach( btn => {
        btn.addEventListener( 'click', function () {
            document.querySelectorAll( '.file-type-btn' ).forEach( b => b.classList.remove( 'active' ) );
            this.classList.add( 'active' );
            state.fileType = this.getAttribute( 'data-type' );

            // Show/hide appropriate upload areas
            document.getElementById( 'excelUploadArea' ).style.display = state.fileType === 'excel' ? 'block' : 'none';
            document.getElementById( 'csvUploadArea' ).style.display = state.fileType === 'csv' ? 'block' : 'none';
        } );
    } );

    // View timetable
    document.querySelectorAll( '.view-option' ).forEach( option => {
        option.addEventListener( 'click', function () {
            document.querySelectorAll( '.view-option' ).forEach( o => o.classList.remove( 'active' ) );
            this.classList.add( 'active' );
            state.currentView = this.getAttribute( 'data-view' );

            // Show/hide appropriate filters
            const classFilter = document.getElementById( 'classFilter' );
            const teacherFilter = document.getElementById( 'teacherFilter' );
            const subjectFilter = document.getElementById( 'subjectFilter' );

            classFilter.style.display = state.currentView === 'class' ? 'block' : 'none';
            teacherFilter.style.display = state.currentView === 'teacher' ? 'block' : 'none';
            subjectFilter.style.display = state.currentView === 'subject' ? 'block' : 'none';

            renderTimetable();
        } );
    } );

    document.getElementById( 'applyFilterBtn' ).addEventListener( 'click', renderTimetable );
    document.getElementById( 'checkOverlapsBtn' ).addEventListener( 'click', runOverlapCheckWithProgress );
    document.getElementById( 'exportOverlapsBtn' ).addEventListener( 'click', exportOverlapsCSV );
    document.getElementById( 'exportTimetableBtn' ).addEventListener( 'click', exportTimetable );
    document.getElementById( 'goToUploadBtn' ).addEventListener( 'click', function () {
        document.querySelector( '.tab[data-target="upload-timetable-section"]' ).click();
    } );

    // Upload timetable
    document.getElementById( 'excelFormatSelect' ).addEventListener( 'change', function () {
        state.excelFormat = this.value;
    } );
    document.getElementById( 'excelFileInput' ).addEventListener( 'change', handleExcelUpload );
    document.getElementById( 'csvFileInput' ).addEventListener( 'change', handleCSVUpload );
    document.getElementById( 'subjectMappingFileInput' ).addEventListener( 'change', handleSubjectMappingUpload );
    document.getElementById( 'downloadTemplateBtn' ).addEventListener( 'click', downloadTemplate );

    // Time modal
    document.getElementById( 'closeTimeModal' ).addEventListener( 'click', closeTimeInputModal );
    document.getElementById( 'cancelTimeBtn' ).addEventListener( 'click', closeTimeInputModal );
    document.getElementById( 'saveTimeBtn' ).addEventListener( 'click', savePeriodTimes );

    // Modify timetable
    document.getElementById( 'rescheduleModeBtn' ).addEventListener( 'click', toggleRescheduleMode );
    document.getElementById( 'loadTimetableBtn' ).addEventListener( 'click', loadTimetableForModification );
    document.getElementById( 'saveAllChangesBtn' ).addEventListener( 'click', saveAllModifiedChanges );
    document.getElementById( 'cancelAllChangesBtn' ).addEventListener( 'click', cancelAllModifiedChanges );
    document.getElementById( 'undoEditBtn' ).addEventListener( 'click', undoLastCellEdit );

    // Edit Modal controls
    document.getElementById( 'closeEditCellModal' ).addEventListener( 'click', closeEditCellModal );
    document.getElementById( 'cancelEditCellBtn' ).addEventListener( 'click', closeEditCellModal );
    document.getElementById( 'saveEditCellBtn' ).addEventListener( 'click', saveCellEditFromModal );

    // Teacher schedule
    document.getElementById( 'loadTeacherScheduleBtn' ).addEventListener( 'click', loadTeacherSchedule );
    document.getElementById( 'exportTeacherScheduleBtn' ).addEventListener( 'click', exportTeacherSchedule );

    // Reschedule modal
    document.getElementById( 'closeRescheduleModal' ).addEventListener( 'click', closeRescheduleModal );
    document.getElementById( 'cancelRescheduleBtn' ).addEventListener( 'click', closeRescheduleModal );
    document.getElementById( 'confirmRescheduleBtn' ).addEventListener( 'click', confirmReschedule );
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
    if ( state.timetableData ) {
        state.timetableData = normalizeLoadedTimetableData( state.timetableData );
        if ( state.timetableData ) {
            const updatedPeriods = autoFillMissingSubjectsFromTeacherMap();
            if ( updatedPeriods > 0 ) {
                saveTimetableToStorage();
            }
            updateTimetableSummary();
            renderTimetable();
        }
    }
    updateClassFilters();
}

function syncConfigInputs() {
    document.getElementById( 'schoolDaysInput' ).value = ( state.config.schoolDays || [] ).join( ',' );
    document.getElementById( 'periodsPerDayInput' ).value = state.config.periodsPerDay || 7;
    document.getElementById( 'periodsPerTeacherInput' ).value = state.config.periodsPerTeacher || 35;
    document.getElementById( 'aiPromptStyleInput' ).value = state.config.aiPromptStyle || 'compact';
    const swapInput = document.getElementById( 'maxSwapAttemptsInput' );
    if ( swapInput ) swapInput.value = state.config.maxSwapAttempts || 200;
}

function syncConfigFromInputs() {
    const days = document.getElementById( 'schoolDaysInput' ).value
        .split( ',' )
        .map( day => toCleanString( day ) )
        .filter( Boolean );
    state.config.schoolDays = days.length > 0 ? days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    state.config.periodsPerDay = Math.max( 1, Number( document.getElementById( 'periodsPerDayInput' ).value ) || 7 );
    state.config.periodsPerTeacher = Math.max( 1, Number( document.getElementById( 'periodsPerTeacherInput' ).value ) || 35 );
    state.config.aiPromptStyle = document.getElementById( 'aiPromptStyleInput' ).value || 'compact';
    const swapInput = document.getElementById( 'maxSwapAttemptsInput' );
    if ( swapInput ) {
        state.config.maxSwapAttempts = Math.max( 10, Number( swapInput.value ) || 200 );
    }
}

function updateSetupSummary() {
    document.getElementById( 'masterTeachersCount' ).textContent = ( state.teachers || [] ).length;
    document.getElementById( 'masterMappingsCount' ).textContent = ( state.teacherMappings || [] ).length;
    document.getElementById( 'configDaysCount' ).textContent = ( state.config.schoolDays || [] ).length;
    document.getElementById( 'configPeriodsCount' ).textContent = state.config.periodsPerDay || 0;
    updateQuickAddDropdowns();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCSVRows( csvData ) {
    return csvData
        .split( /\r?\n/ )
        .filter( line => line.trim() !== '' )
        .map( line => parseCSVLine( line ).map( cell => toCleanString( cell ) ) );
}

function findHeaderIndex( headers, names ) {
    return headers.findIndex( header => {
        const cleanedHeader = toCleanString( header ).toLowerCase();
        return names.includes( cleanedHeader );
    } );
}

function parseFileRows( file, callback ) {
    const isExcel = file.name.match( /\.(xlsx|xls)$/i );
    const reader = new FileReader();

    if ( isExcel ) {
        reader.onload = function ( e ) {
            try {
                const data = new Uint8Array( e.target.result );
                const workbook = XLSX.read( data, { type: 'array' } );
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                let rows = XLSX.utils.sheet_to_json( sheet, { header: 1, defval: '' } );

                // Find the actual header row (first non-empty row)
                let startIdx = 0;
                for ( let i = 0; i < rows.length; i++ ) {
                    if ( rows[i].some( cell => typeof cell === 'string' && cell.trim() !== '' ) ) {
                        startIdx = i;
                        break;
                    }
                }
                callback( rows.slice( startIdx ) );
            } catch ( error ) {
                console.error( error );
                alert( "Error reading Excel file." );
            }
        };
        reader.readAsArrayBuffer( file );
    } else {
        reader.onload = function ( e ) {
            callback( parseCSVRows( e.target.result ) );
        };
        reader.readAsText( file );
    }
}

function handleTeacherListUpload( event ) {
    const file = event.target.files[0];
    if ( !file ) return;

    parseFileRows( file, function ( rows ) {
        if ( rows.length < 2 ) {
            alert( "Teacher file is empty or invalid." );
            return;
        }

        const headers = rows[0].map( header => toCleanString( header ).toLowerCase() );
        const idIndex = findHeaderIndex( headers, ['teacher id', 'teacherid', 'id'] );
        const nameIndex = findHeaderIndex( headers, ['teacher name', 'teachername', 'name', 'teacher'] );
        const subjectsIndex = findHeaderIndex( headers, ['class teacher subject', 'subjects', 'subject', 'subject taught'] );
        const gradeIndex = findHeaderIndex( headers, ['class teacher grade', 'class grade', 'grade'] );
        const sectionIndex = findHeaderIndex( headers, ['class teacher section', 'section'] );
        const phoneIndex = findHeaderIndex( headers, ['phone', 'mobile'] );
        const emailIndex = findHeaderIndex( headers, ['email'] );

        if ( nameIndex === -1 ) {
            alert( "Teacher CSV must include Teacher Name column." );
            return;
        }

        const imported = rows.slice( 1 )
            .map( ( cells, index ) => ( {
                id: toCleanString( cells[idIndex] ) || `T${String( ( state.teachers || [] ).length + index + 1 ).padStart( 4, '0' )}`,
                name: toCleanString( cells[nameIndex] ),
                classTeacherSubject: subjectsIndex >= 0 ? toCleanString( cells[subjectsIndex] ) : '',
                classTeacherGrade: gradeIndex >= 0 ? toCleanString( cells[gradeIndex] ) : '',
                classTeacherSection: sectionIndex >= 0 ? toCleanString( cells[sectionIndex] ) : '',
                phone: phoneIndex >= 0 ? toCleanString( cells[phoneIndex] ) : '',
                email: emailIndex >= 0 ? toCleanString( cells[emailIndex] ) : ''
            } ) )
            .filter( row => row.name );

        state.teachers = mergeTeachers( state.teachers || [], imported );
        rebuildTeacherSubjectMapFromMasterData();
        saveMasterDataToStorage();
        saveTeacherSubjectMapToStorage();
        renderTeacherMasterTable();
        renderTeacherMappingTable();
        updateSetupSummary();
        updateClassFilters();
        renderAIPrompt();
        event.target.value = '';
    } );
}

function handleTeacherMappingUpload( event ) {
    const file = event.target.files[0];
    if ( !file ) return;

    parseFileRows( file, function ( rows ) {
        if ( rows.length < 2 ) {
            alert( "Mapping file is empty or invalid." );
            return;
        }

        const headers = rows[0].map( header => toCleanString( header ).toLowerCase() );
        const teacherIdIndex = findHeaderIndex( headers, ['teacher id', 'teacherid', 'id'] );
        const teacherNameIndex = findHeaderIndex( headers, ['teacher name', 'teachername', 'name', 'teacher'] );
        const gradeIndex = findHeaderIndex( headers, ['grade-section', 'class-section', 'class', 'grade section', 'classes'] );
        const subjectIndex = findHeaderIndex( headers, ['subject', 'course', 'class'] );
        const periodsIndex = findHeaderIndex( headers, ['periods per week', 'periods/week', 'periods', 'classes'] );
        const fixedPeriodsIndex = findHeaderIndex( headers, ['fixed periods', 'fixedperiods', 'fixed period', 'fixedperiod', 'fixed', 'block the periods', 'block periods', 'block period', 'blockperiods', 'blockperiod', 'block'] );
        const modeIndex = findHeaderIndex( headers, ['mode', 'teaching mode', 'type'] );
        const combinedGroupIndex = findHeaderIndex( headers, ['combined group', 'combinedgroup', 'group id'] );

        if ( gradeIndex === -1 || subjectIndex === -1 ) {
            alert( "Mapping CSV must include Grade-Section and Subject columns." );
            return;
        }

        const imported = rows.slice( 1 )
            .flatMap( ( cells, index ) => {
                const teacherId = teacherIdIndex >= 0 ? toCleanString( cells[teacherIdIndex] ) : '';
                const teacherName = teacherNameIndex >= 0 ? toCleanString( cells[teacherNameIndex] ) : findTeacherNameById( teacherId );

                const rawClasses = toCleanString( cells[gradeIndex] );
                let normalizedClasses = rawClasses;
                if ( rawClasses.includes( ',' ) || rawClasses.includes( ';' ) ) {
                    normalizedClasses = rawClasses.split( /[,;]/ )
                        .map( p => normalizeSingleClassSectionLabel( p.trim() ) )
                        .filter( Boolean )
                        .join( ', ' );
                } else {
                    normalizedClasses = normalizeSingleClassSectionLabel( rawClasses );
                }

                return [{
                    id: `M${Date.now()}-${index}`,
                    teacherId,
                    teacherName,
                    gradeSection: normalizedClasses,
                    subject: toCleanString( cells[subjectIndex] ),
                    periodsPerWeek: periodsIndex >= 0 ? toCleanString( cells[periodsIndex] ) : '',
                    fixedPeriods: fixedPeriodsIndex >= 0 ? normalizeFixedPeriods( cells[fixedPeriodsIndex] ) : '',
                    mode: modeIndex >= 0 ? toCleanString( cells[modeIndex] ) : '',
                    combinedGroupId: combinedGroupIndex >= 0 ? toCleanString( cells[combinedGroupIndex] ) : ''
                }];
            } )
            .filter( row => row.gradeSection && row.subject && ( row.teacherId || row.teacherName ) );

        state.teacherMappings = mergeTeacherMappings( state.teacherMappings || [], imported );
        rebuildTeacherSubjectMapFromMasterData();
        saveMasterDataToStorage();
        saveTeacherSubjectMapToStorage();
        renderTeacherMappingTable();
        updateSetupSummary();
        updateClassFilters();
        renderAIPrompt();
        event.target.value = '';
    } );
}

function mergeTeachers( existing, imported ) {
    const map = new Map();
    existing.concat( imported ).forEach( teacher => {
        const key = toCleanString( teacher.id ).toLowerCase() || toCleanString( teacher.name ).toLowerCase();
        if ( !key ) return;
        map.set( key, { ...( map.get( key ) || {} ), ...teacher } );
    } );
    return Array.from( map.values() ).sort( ( a, b ) => safeLocaleCompare( a.name, b.name ) );
}

function mergeTeacherMappings( existing, imported ) {
    const map = new Map();
    existing.concat( imported ).forEach( mapping => {
        const key = [
            toCleanString( mapping.teacherId ).toLowerCase(),
            toCleanString( mapping.teacherName ).toLowerCase(),
            toCleanString( mapping.gradeSection ).toLowerCase(),
            toCleanString( mapping.subject ).toLowerCase()
        ].join( '|' );
        if ( !key.replace( /\|/g, '' ) ) return;
        map.set( key, { ...( map.get( key ) || {} ), ...mapping, id: mapping.id || key } );
    } );
    return Array.from( map.values() ).sort( ( a, b ) =>
        safeLocaleCompare( a.gradeSection, b.gradeSection ) || safeLocaleCompare( a.teacherName, b.teacherName )
    );
}

function findTeacherNameById( teacherId ) {
    if ( toCleanString( teacherId ).toUpperCase() === 'UNASSIGNED' ) return 'Unassigned';
    const teacher = ( state.teachers || [] ).find( item => toCleanString( item.id ).toLowerCase() === toCleanString( teacherId ).toLowerCase() );
    return teacher ? teacher.name : '';
}

function renderTeacherMasterTable() {
    const table = document.getElementById( 'teacherMasterTable' );
    if (!table) return;

    const rows = state.teachers || [];
    const classSectionOptions = getClassSectionOptions();
    const baseSubjectOptions = getSubjectOptions(); // array of { code, name }

    const tbodyHtml = rows.map( ( teacher, index ) => {
        const selectedValue = teacher.classTeacherGrade && teacher.classTeacherSection
            ? `${teacher.classTeacherGrade}|${teacher.classTeacherSection}`
            : '';
        const subjectValue = teacher.classTeacherSubject || teacher.subjects || '';

        // Dynamically ensure the current value is part of the dropdown options
        const rowSubjectOptions = [...baseSubjectOptions];
        if ( subjectValue && !rowSubjectOptions.find( o => o.code === subjectValue ) ) {
            rowSubjectOptions.push( { code: subjectValue, name: `${subjectValue} (Unmapped)` } );
        }
        rowSubjectOptions.sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );

        const subjectOptionsHtml = rowSubjectOptions.map( option => 
            `<option value="${escapeHtmlAttribute( option.code )}"${option.code === subjectValue ? ' selected' : ''}>${escapeHtml( option.code )} - ${escapeHtml( option.name )}</option>`
        ).join( '' );

        const classSectionOptionsHtml = classSectionOptions.map( option => 
            `<option value="${escapeHtmlAttribute( option.value )}"${option.value === selectedValue ? ' selected' : ''}>${escapeHtml( option.label )}</option>`
        ).join( '' );

        return `
            <tr data-index="${index}">
                <td><input value="${escapeHtmlAttribute( teacher.id )}" data-field="id"></td>
                <td><input value="${escapeHtmlAttribute( teacher.name )}" data-field="name"></td>
                <td>
                    <select data-field="classTeacherSubject">
                        <option value=""></option>
                        ${subjectOptionsHtml}
                    </select>
                </td>
                <td>
                    <select data-field="classTeacherGrade" onchange="syncTeacherGradeSection(this)">
                        <option value=""></option>
                        ${classSectionOptionsHtml}
                    </select>
                    <input type="hidden" value="${escapeHtmlAttribute( teacher.classTeacherSection )}" data-field="classTeacherSection">
                </td>
                <td><input value="${escapeHtmlAttribute( teacher.phone )}" data-field="phone"></td>
                <td><input value="${escapeHtmlAttribute( teacher.email )}" data-field="email"></td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteTeacherRow(${index})"><i class="fas fa-trash"></i></button></td>
            </tr>
        `;
    } ).join( '' );

    table.innerHTML = `
        <thead>
            <tr><th>Teacher ID</th><th>Teacher Name</th><th>Class Teacher Subject</th><th>Class Teacher Grade/Section</th><th>Phone</th><th>Email</th><th>Action</th></tr>
        </thead>
        <tbody>
            ${tbodyHtml}
        </tbody>
    `;

    const searchInput = document.getElementById( 'teacherMappingSearch' );
    if ( searchInput && searchInput.value ) {
        searchInput.dispatchEvent( new Event( 'input' ) );
    }
}

function renderTeacherMappingTable() {
    const table = document.getElementById( 'teacherMappingTable' );
    if (!table) return;

    const rows = state.teacherMappings || [];

    // Sort rows alphabetically by teacher ID, then by grade-section
    rows.sort( ( a, b ) => {
        const tComp = safeLocaleCompare( a.teacherId, b.teacherId );
        if ( tComp !== 0 ) return tComp;
        return compareGradeSection( a.gradeSection, b.gradeSection );
    } );

    const classOptions = getClassSectionOptions();
    const baseSubjectOptions = getSubjectOptions();
    const periodOptions = getPeriodOptions();
    
    const tbodyHtml = rows.map( ( mapping, index ) => {
        const gradeValues = mapping.gradeSection ? mapping.gradeSection.split( /[,;]/ ).map( s => s.trim() ) : [];
        const subjectValue = mapping.subject || '';
        const fixedPeriodsValues = mapping.fixedPeriods ? mapping.fixedPeriods.split( ',' ).map( s => s.trim() ) : [];

        const rowSubjectOptions = [...baseSubjectOptions];
        if ( subjectValue && !rowSubjectOptions.find( o => o.code === subjectValue ) ) {
            rowSubjectOptions.push( { code: subjectValue, name: `${subjectValue} (Unmapped)` } );
        }
        rowSubjectOptions.sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );

        const teacherOptionsHtml = ( state.teachers || [] ).map( t => 
            `<option value="${escapeHtmlAttribute( t.id )}"${t.id === mapping.teacherId ? ' selected' : ''}>${escapeHtml( t.id )} - ${escapeHtml( t.name )}</option>` 
        ).join( '' );

        const rowClassOptions = [...classOptions];
        gradeValues.forEach(g => {
            if (g && !rowClassOptions.find(o => o.label === g)) {
                rowClassOptions.push({ label: g, value: g });
            }
        });
        rowClassOptions.sort((a, b) => compareGradeSection(a.label, b.label));

        const gradeOptionsHtml = rowClassOptions.map( option => 
            `<option value="${escapeHtmlAttribute( option.label )}"${gradeValues.includes( option.label ) ? ' selected' : ''}>${escapeHtml( option.label )}</option>`
        ).join( '' );

        const subjectOptionsHtml = rowSubjectOptions.map( option => 
            `<option value="${escapeHtmlAttribute( option.code )}"${option.code === subjectValue ? ' selected' : ''}>${escapeHtml( option.code )} - ${escapeHtml( option.name )}</option>`
        ).join( '' );

        const fixedPeriodsOptionsHtml = periodOptions.map( option => 
            `<option value="${escapeHtmlAttribute( option.value )}"${fixedPeriodsValues.includes( option.value ) ? ' selected' : ''}>${escapeHtml( option.label )}</option>`
        ).join( '' );

        return `
            <tr data-index="${index}">
                <td>
                    <select data-field="teacherId">
                        <option value=""></option>
                        <option value="UNASSIGNED"${mapping.teacherId === 'UNASSIGNED' ? ' selected' : ''}>Unassigned</option>
                        ${teacherOptionsHtml}
                    </select>
                </td>
                <td>
                    <select data-field="gradeSection" multiple>
                        ${gradeOptionsHtml}
                    </select>
                </td>
                <td>
                    <select data-field="subject">
                        <option value=""></option>
                        ${subjectOptionsHtml}
                    </select>
                </td>
                <td><input type="number" min="0" value="${escapeHtmlAttribute( mapping.periodsPerWeek )}" data-field="periodsPerWeek"></td>
                <td>
                    <select data-field="fixedPeriods" multiple>
                        ${fixedPeriodsOptionsHtml}
                    </select>
                </td>
                <td>
                    <select data-field="mode">
                        <option value=""${!mapping.mode || mapping.mode === '' ? ' selected' : ''}>Auto</option>
                        <option value="0"${mapping.mode === '0' || mapping.mode === 'individual' ? ' selected' : ''}>0 - Individual</option>
                        <option value="1"${mapping.mode === '1' || mapping.mode === 'combined' ? ' selected' : ''}>1 - Combined</option>
                    </select>
                </td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteMappingRow(${index})"><i class="fas fa-trash"></i></button></td>
            </tr>
        `;
    } ).join( '' );

    table.innerHTML = `
        <thead>
            <tr><th>Teacher ID</th><th>Grade-Section</th><th>Subject</th><th>Periods / Week</th><th>Fixed Periods</th><th>Mode</th><th>Action</th></tr>
        </thead>
        <tbody>
            ${tbodyHtml}
        </tbody>
    `;

    // Apply checkbox dropdowns to all multi-selects in the table
    const tableSelects = table.querySelectorAll( 'select[multiple]' );
    tableSelects.forEach( select => {
        createCheckboxDropdown( select, 'Select...' );
    } );

    renderMappingStatsTable();
}

function renderMappingStatsTable() {
    const tableBody = document.querySelector( '#mappingStatsTable tbody' );
    if ( !tableBody ) return;

    const rows = state.teacherMappings || [];
    const stats = {};

    // Initialize with all existing class sections
    if ( state.classSections ) {
        state.classSections.forEach( secObj => {
            if ( secObj && secObj.className ) {
                const cleanSec = normalizeClassSectionLabel( secObj.className.replace( '|', '-' ) );
                stats[cleanSec] = { total: 0, subjects: {} };
            }
        } );
    }

    rows.forEach( mapping => {
        if ( !mapping.gradeSection ) return;

        const sections = mapping.gradeSection.split( /[,;]/ );
        const periods = parseInt( mapping.periodsPerWeek ) || 0;

        sections.forEach( sec => {
            let cleanSec = sec.trim();
            if ( !cleanSec ) return;

            cleanSec = normalizeClassSectionLabel( cleanSec.replace( '|', '-' ) );

            if ( !stats[cleanSec] ) {
                stats[cleanSec] = { total: 0, subjects: {} };
            }
            stats[cleanSec].total += periods;

            const subject = mapping.subject || 'Unknown';
            if ( !stats[cleanSec].subjects[subject] ) {
                stats[cleanSec].subjects[subject] = 0;
            }
            stats[cleanSec].subjects[subject] += periods;
        } );
    } );

    const sortedSections = Object.keys( stats ).sort( compareGradeSection );

    tableBody.innerHTML = sortedSections.map( ( sec, i ) => {
        const data = stats[sec];
        const subjectDetails = Object.entries( data.subjects )
            .sort( ( a, b ) => safeLocaleCompare( a[0], b[0] ) )
            .map( ( [sub, p] ) => `
                        <div style="background: white; padding: 5px 10px; border-radius: 4px; border: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;" 
                             onmouseover="this.style.background='#e2e8f0'" 
                             onmouseout="this.style.background='white'"
                             onclick="window.filterTeacherMapping('${escapeHtml( sec )}', '${escapeHtml( sub )}'); event.stopPropagation();">
                            ${escapeHtml( sub )}: <strong>${p}</strong>
                        </div>
                    `)
            .join( '' );

        return `
                    <tr style="cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" onclick="document.getElementById('stats-detail-${i}').style.display = document.getElementById('stats-detail-${i}').style.display === 'none' ? 'table-row' : 'none'">
                        <td>
                            <i class="fas fa-chevron-down" style="font-size: 0.8em; margin-right: 8px; color: #64748b;"></i>
                            <strong>${escapeHtml( sec )}</strong>
                        </td>
                        <td><strong>${data.total}</strong></td>
                    </tr>
                    <tr id="stats-detail-${i}" style="display: none; background: #f8fafc;">
                        <td colspan="2" style="padding: 15px;">
                            <div style="font-size: 0.9em; color: #334155; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
                                ${subjectDetails}
                            </div>
                        </td>
                    </tr>
                `;
    } ).join( '' );
}

function getPeriodOptions() {
    const periodsPerDay = state.config.periodsPerDay || 7;
    const options = [];

    // Individual periods
    for ( let i = 1; i <= periodsPerDay; i++ ) {
        options.push( { value: `P${i}`, label: `P${i}` } );
    }

    // Combined periods (P1-P2, P2-P3, etc.)
    for ( let i = 1; i < periodsPerDay; i++ ) {
        options.push( { value: `P${i}-P${i + 1}`, label: `P${i}-P${i + 1}` } );
    }

    return options;
}

function getClassSectionOptions() {
    const sections = state.classSections || [];
    const options = sections.map( item => {
        const classValue = item.class || '';
        const sectionValue = item.section || '';
        const label = normalizeClassSectionLabel( `${classValue}-${sectionValue}` );
        const value = `${classValue}|${sectionValue}`;
        return { label, value };
    } );
    return options.sort( ( a, b ) => compareGradeSection( a.label, b.label ) );
}

function syncTeacherGradeSection( select ) {
    const row = select.closest( 'tr' );
    if ( !row ) return;
    const hiddenSection = row.querySelector( 'input[data-field="classTeacherSection"]' );
    const selected = toCleanString( select.value );
    if ( !hiddenSection ) return;
    if ( !selected ) {
        hiddenSection.value = '';
        // Ensure classTeacherGrade field is cleared as well
        select.value = '';
        return;
    }
    const [gradePart, sectionPart] = selected.split( '|' );
    // Update hidden section input
    hiddenSection.value = sectionPart || '';
    // Preserve combined value in the select for proper rendering
    select.value = `${gradePart}|${hiddenSection.value}`;
}

function readTableRows( tableId, fields ) {
    return Array.from( document.querySelectorAll( `#${tableId} tbody tr` ) ).map( row => {
        const item = {};
        fields.forEach( field => {
            const input = row.querySelector( `[data-field="${field}"]` );
            if ( !input ) {
                item[field] = '';
                return;
            }

            // Handle multi-select dropdowns
            if ( input.multiple && input.tagName === 'SELECT' ) {
                const selectedOptions = Array.from( input.options || [] ).filter( opt => opt.selected ).map( opt => opt.value );
                item[field] = selectedOptions.join( ',' );
            } else {
                item[field] = toCleanString( input.value );
            }
        } );
        return item;
    } );
}

function normalizeTeacherGradeSection( teacher ) {
    const combined = toCleanString( teacher.classTeacherGrade || '' );
    const splitMatch = combined.split( '|' );
    if ( splitMatch.length === 2 ) {
        teacher.classTeacherGrade = splitMatch[0];
        teacher.classTeacherSection = splitMatch[1];
    }
    return teacher;
}

function saveMasterDataFromTables() {
    syncConfigFromInputs();

    // Read table data
    const rawTeachers = readTableRows( 'teacherMasterTable', ['id', 'name', 'classTeacherSubject', 'classTeacherGrade', 'classTeacherSection', 'phone', 'email'] );
    const rawMappings = readTableRows( 'teacherMappingTable', ['teacherId', 'gradeSection', 'subject', 'periodsPerWeek', 'fixedPeriods', 'mode'] );
    const rawClassSections = readTableRows( 'classSectionsTable', ['className', 'class', 'section', 'teachingMode', 'combinedGroupId'] );
    const rawSubjects = readTableRows( 'subjectsTable', ['code', 'name'] );

    if ( rawClassSections && rawClassSections.length > 0 ) {
        state.classSections = rawClassSections.map( c => ( {
            ...c,
            className: c.className || `Class-${c.class}-${c.section}`
        } ) ).sort( ( a, b ) => compareGradeSection( a.className, b.className ) );
    }

    if ( rawSubjects ) {
        const uniques = new Map();
        rawSubjects.forEach( s => {
            if ( s.code ) uniques.set( toCleanString( s.code ), s );
        } );
        state.subjects = Array.from( uniques.values() ).sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );
    }

    duplicateCheckCache.clear();

    // Validate and process teachers
    const validationResults = { teachers: [], mappings: [], warnings: [] };

    state.teachers = rawTeachers
        .map( ( teacher, index ) => {
            const normalized = normalizeTeacherGradeSection( teacher );

            // Skip empty rows
            if ( !toCleanString( normalized.name ) ) {
                return null;
            }

            // Validate teacher name
            if ( !toCleanString( normalized.name ) ) {
                validationResults.warnings.push( `Row ${index + 1}: Skipped teacher with empty name` );
                return null;
            }

            return normalized;
        } )
        .filter( Boolean );

    // Validate and process mappings
    state.teacherMappings = rawMappings
        .map( ( mapping, index ) => {
            // Skip empty rows
            if ( !toCleanString( mapping.gradeSection ) && !toCleanString( mapping.subject ) ) {
                return null;
            }

            // Validate required fields
            const classValidation = validateClassSection( mapping.gradeSection );
            const subjectValidation = validateSubjectSelection( mapping.subject );
            const teacherValidation = validateTeacherSelection( mapping.teacherId, '' );

            if ( !classValidation.valid ) {
                validationResults.warnings.push( `Row ${index + 1}: ${classValidation.error}` );
                return null;
            }

            if ( !subjectValidation.valid ) {
                validationResults.warnings.push( `Row ${index + 1}: ${subjectValidation.error}` );
                return null;
            }

            if ( !teacherValidation.valid ) {
                validationResults.warnings.push( `Row ${index + 1}: ${teacherValidation.error}` );
                return null;
            }

            const processedMapping = {
                ...mapping,
                id: `M${index + 1}`,
                teacherId: teacherValidation.teacherId,
                teacherName: findTeacherNameById( mapping.teacherId ),
                gradeSection: normalizeClassSectionLabel( mapping.gradeSection ),
                subject: subjectValidation.normalized,
                fixedPeriods: normalizeFixedPeriods( mapping.fixedPeriods || '' )
            };

            // Check for duplicates
            const duplicateCheck = checkForDuplicateMapping( processedMapping );
            if ( duplicateCheck.isDuplicate ) {
                validationResults.warnings.push( `Row ${index + 1}: Duplicate mapping detected (${processedMapping.gradeSection}, ${processedMapping.subject})` );
            }

            return processedMapping;
        } )
        .filter( Boolean );

    rebuildTeacherSubjectMapFromMasterData();
    saveMasterDataToStorage();
    saveTeacherSubjectMapToStorage();

    const updatedPeriods = autoFillMissingSubjectsFromTeacherMap();
    if ( updatedPeriods > 0 ) saveTimetableToStorage();

    renderTeacherMasterTable();
    renderTeacherMappingTable();
    updateSetupSummary();
    updateClassFilters();
    renderAIPrompt();

    // Show results
    let message = 'Local setup data saved successfully.';
    if ( validationResults.warnings.length > 0 ) {
        message += `\n\nValidation warnings (${validationResults.warnings.length}):\n`;
        message += validationResults.warnings.slice( 0, 5 ).join( '\n' );
        if ( validationResults.warnings.length > 5 ) {
            message += `\n... and ${validationResults.warnings.length - 5} more`;
        }
    }

    alert( message );
}

// Save master data without showing an alert (used by add row functions)
function saveMasterDataFromTablesWithoutAlert() {
    syncConfigFromInputs();
    state.teachers = readTableRows( 'teacherMasterTable', ['id', 'name', 'classTeacherSubject', 'classTeacherGrade', 'classTeacherSection', 'phone', 'email'] )
        .map( normalizeTeacherGradeSection )
        .filter( teacher => teacher.name );
    state.teacherMappings = readTableRows( 'teacherMappingTable', ['teacherId', 'gradeSection', 'subject', 'periodsPerWeek', 'fixedPeriods', 'mode'] )
        .map( ( mapping, index ) => ( {
            ...mapping,
            id: `M${index + 1}`,
            teacherName: findTeacherNameById( mapping.teacherId ),
            gradeSection: normalizeClassSectionLabel( mapping.gradeSection )
        } ) )
        .filter( mapping => mapping.gradeSection && mapping.subject && mapping.teacherId );

    const rawSubjects = readTableRows( 'subjectsTable', ['code', 'name'] );
    if ( rawSubjects ) {
        const uniques = new Map();
        rawSubjects.forEach( s => {
            if ( s.code ) uniques.set( toCleanString( s.code ), s );
        } );
        state.subjects = Array.from( uniques.values() ).sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );
    }
    rebuildTeacherSubjectMapFromMasterData();
    saveMasterDataToStorage();
    saveTeacherSubjectMapToStorage();
    const updatedPeriods = autoFillMissingSubjectsFromTeacherMap();
    if ( updatedPeriods > 0 ) saveTimetableToStorage();
    renderTeacherMasterTable();
    renderTeacherMappingTable();
    updateSetupSummary();
    updateClassFilters();
    renderAIPrompt();
    // No alert here
}

function addTeacherRow() {
    saveMasterDataFromTablesWithoutAlert();
    state.teachers.push( { id: '', name: '', classTeacherSubject: '', classTeacherGrade: '', classTeacherSection: '', phone: '', email: '' } );
    renderTeacherMasterTable();
    updateSetupSummary();
}

function addMappingRow() {
    // Save current table data without filtering incomplete rows
    syncConfigFromInputs();
    state.teachers = readTableRows( 'teacherMasterTable', ['id', 'name', 'classTeacherSubject', 'classTeacherGrade', 'classTeacherSection', 'phone', 'email'] )
        .map( normalizeTeacherGradeSection )
        .filter( teacher => teacher.name );
    state.teacherMappings = readTableRows( 'teacherMappingTable', ['teacherId', 'gradeSection', 'subject', 'periodsPerWeek', 'fixedPeriods', 'mode'] )
        .map( ( mapping, index ) => ( {
            ...mapping,
            id: mapping.id || `M${index + 1}`,
            teacherName: findTeacherNameById( mapping.teacherId ),
            gradeSection: normalizeClassSectionLabel( mapping.gradeSection )
        } ) );

    // Add new empty row
    state.teacherMappings.push( { id: '', teacherId: '', teacherName: '', gradeSection: '', subject: '', periodsPerWeek: '', fixedPeriods: '' } );

    rebuildTeacherSubjectMapFromMasterData();
    saveMasterDataToStorage();
    saveTeacherSubjectMapToStorage();
    renderTeacherMappingTable();
    updateSetupSummary();
}

// --- Bulk Classes & Sections functions ---
function generateClassSectionsFromInput() {
    const idInput = document.getElementById( 'bulkClassesIdInput' );
    const detailsInput = document.getElementById( 'bulkClassesDetailsInput' );
    if ( !idInput || !detailsInput ) return;
    const idLines = idInput.value.split( /\r?\n/ ).map( l => l.trim() );
    const detailsLines = detailsInput.value.split( /\r?\n/ ).map( l => l.trim() );
    const lines = [];
    const maxLen = Math.max( idLines.length, detailsLines.length );
    for ( let i = 0; i < maxLen; i++ ) {
        if ( idLines[i] ) {
            lines.push( idLines[i] + ':' + ( detailsLines[i] || 'A' ) );
        }
    }
    const parsed = parseBulkClassesInput( lines );
    // merge parsed (objects) with existing, dedupe by className
    const existing = ( state.classSections || [] ).filter( Boolean );
    const mergedMap = new Map();
    existing.forEach( e => {
        if ( typeof e === 'string' ) return; // legacy will be normalized elsewhere
        if ( e.className ) mergedMap.set( e.className, e );
    } );
    parsed.forEach( p => {
        // p is {className, class, section}
        if ( p && p.className ) mergedMap.set( p.className, p );
    } );
    state.classSections = Array.from( mergedMap.values() ).sort( ( a, b ) => compareGradeSection( a.className, b.className ) );
    saveMasterDataToStorage();
    renderClassSectionsTable();
    updateClassFilters();
    alert( 'Generated ' + parsed.length + ' class-section entries.' );
}

function parseBulkClassesInput( lines ) {
    const out = [];
    lines.forEach( line => {
        // Expect formats like "10:A,B" or "5:A" or "10:A" or "10-A,B"
        const parts = line.split( ':' );
        const left = parts[0] ? toCleanString( parts[0] ) : '';
        const right = parts[1] ? parts[1] : '';
        if ( !left ) return;
        const classPart = left.replace( /^Grade\s*/i, '' ).replace( /^Class\s*/i, '' );
        const sections = right ? right.split( ',' ).map( s => toCleanString( s ) ).filter( Boolean ) : ['A'];
        sections.forEach( sec => {
            const cls = classPart;
            const s = sec;
            const className = `Class-${cls}-${s}`;
            out.push( { className, class: cls, section: s } );
        } );
    } );
    return out;
}

function renderClassSectionsTable() {
    const table = document.getElementById( 'classSectionsTable' );
    if ( !table ) return;
    const rows = state.classSections || [];
    table.innerHTML = `
        <thead><tr><th>Class</th><th>Section</th><th>Mode</th><th>Combined Group</th><th>Action</th></tr></thead>
        <tbody>
            ${rows.map( ( c, i ) => `
                <tr data-index="${i}">
                    <td>${escapeHtml( c.class || '' )}<input type="hidden" data-field="class" value="${escapeHtml( c.class || '' )}"><input type="hidden" data-field="className" value="${escapeHtml( c.className || '' )}"></td>
                    <td>${escapeHtml( c.section || '' )}<input type="hidden" data-field="section" value="${escapeHtml( c.section || '' )}"></td>
                    <td>
                        <select data-field="teachingMode">
                            <option value="0"${normalizeTeachingMode( c.teachingMode ) !== 'combined' ? ' selected' : ''}>0 - Individual</option>
                            <option value="1"${normalizeTeachingMode( c.teachingMode ) === 'combined' ? ' selected' : ''}>1 - Combined</option>
                        </select>
                    </td>
                    <td><input type="text" data-field="combinedGroup" value="${escapeHtml( c.combinedGroup || '' )}" placeholder="e.g. Gr11-Sci"></td>
                    <td><button class="btn btn-danger btn-sm" onclick="deleteClassSection(${i})"><i class="fas fa-trash"></i></button></td>
                </tr>
            `).join( '' )}
        </tbody>
    `;
}

function renderSubjectsTable() {
    const table = document.getElementById( 'subjectsTable' );
    if ( !table ) return;
    const rows = state.subjects || [];
    table.innerHTML = `
                <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Action</th></tr></thead>
                <tbody>
                    ${rows.map( ( subject, i ) => `
                        <tr data-index="${i}">
                            <td><input type="text" data-field="code" value="${escapeHtml( subject.code )}" placeholder="e.g. MATH"></td>
                            <td><input type="text" data-field="name" value="${escapeHtml( subject.name )}" placeholder="e.g. Mathematics"></td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteSubject(${i})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join( '' )}
                </tbody>
            `;
}

function addSubjectRow() {
    saveMasterDataFromTablesWithoutAlert();
    if ( !state.subjects ) state.subjects = [];
    state.subjects.push( { code: '', name: '' } );
    renderSubjectsTable();
    updateSetupSummary();
}

function deleteSubject( index ) {
    const table = document.getElementById( 'subjectsTable' );
    if ( !table ) return;
    const row = table.querySelector( `tr[data-index="${index}"]` );
    if ( row ) {
        row.remove();
    }
    saveMasterDataFromTablesWithoutAlert();
    renderSubjectsTable();
    updateSetupSummary();
}

function getSubjectOptions() {
    return ( state.subjects || [] ).slice().sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );
}

function clearSubjects() {
    if ( !confirm( 'Clear all subjects?' ) ) return;
    state.subjects = [];
    saveMasterDataToStorage();
    renderSubjectsTable();
    renderTeacherMasterTable();
    renderTeacherMappingTable();
}

function exportSubjectsCSV() {
    const rows = state.subjects || [];
    if ( rows.length === 0 ) { alert( 'No subjects to export.' ); return; }
    const csv = 'Subject Code,Subject Name\n' + rows.map( s => `${escapeCsvField( s.code )},${escapeCsvField( s.name )}` ).join( '\n' );
    const blob = new Blob( [csv], { type: 'text/csv' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'subjects.csv';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

function handleImportSubjectsCSV( event ) {
    const file = event.target.files && event.target.files[0];
    if ( !file ) return;
    const reader = new FileReader();
    reader.onload = function ( e ) {
        try {
            const rows = parseCSVRows( e.target.result );
            if ( !rows || rows.length === 0 ) {
                alert( 'Empty or invalid CSV' );
                return;
            }

            let start = 0;
            let cIdx = 0;
            let nIdx = 1;

            const header = rows[0].map( c => toCleanString( c ).toLowerCase() );
            const codeMatch = header.findIndex( h => h.includes( 'code' ) || h.includes( 'id' ) || h === 'subject' );
            const nameMatch = header.findIndex( h => h.includes( 'name' ) || h === 'subject' );

            // If headers are found
            if ( codeMatch >= 0 || nameMatch >= 0 ) {
                start = 1;
                cIdx = codeMatch >= 0 ? codeMatch : 0;
                nIdx = nameMatch >= 0 ? nameMatch : ( rows[0].length > 1 ? ( cIdx === 0 ? 1 : 0 ) : cIdx );

                // If they both matched the same index (e.g. both matched 'subject'), adjust
                if ( cIdx === nIdx && rows[0].length > 1 ) {
                    const otherIdx = header.findIndex( ( h, idx ) => idx !== cIdx && ( h.includes( 'subject' ) || h.includes( 'name' ) || h.includes( 'code' ) || h.includes( 'id' ) ) );
                    if ( otherIdx >= 0 ) {
                        nIdx = otherIdx;
                    } else {
                        nIdx = cIdx === 0 ? 1 : 0;
                    }
                }
            } else if ( rows[0] && rows[0].length > 1 ) {
                // Guess by length
                const len0 = toCleanString( rows[0][0] ).length;
                const len1 = toCleanString( rows[0][1] ).length;
                if ( len0 > len1 ) {
                    cIdx = 1;
                    nIdx = 0;
                } else {
                    cIdx = 0;
                    nIdx = 1;
                }
            }

            const parsed = [];
            for ( let i = start; i < rows.length; i++ ) {
                if ( !rows[i] || rows[i].length === 0 ) continue;
                let code = toCleanString( rows[i][cIdx] || '' );
                let name = toCleanString( rows[i][nIdx] || code );

                // Smart swap
                if ( code.length > name.length && name.length > 0 ) {
                    const tmp = code;
                    code = name;
                    name = tmp;
                }

                if ( code ) parsed.push( { code, name } );
            }

            if ( parsed.length === 0 ) {
                alert( 'No valid subject rows found in CSV.' );
                return;
            }
            const uniques = new Map();
            ( state.subjects || [] ).forEach( s => uniques.set( toCleanString( s.code ), s ) );
            parsed.forEach( s => uniques.set( toCleanString( s.code ), s ) );
            state.subjects = Array.from( uniques.values() ).sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );
            saveMasterDataToStorage();
            renderSubjectsTable();
            renderTeacherMasterTable();
            renderTeacherMappingTable();
            alert( 'Imported ' + parsed.length + ' subject rows.' );
        } catch ( err ) {
            console.error( err );
            alert( 'Failed to import CSV' );
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText( file );
}

function deleteClassSection( index ) {
    state.classSections = state.classSections || [];
    if ( index < 0 || index >= state.classSections.length ) return;
    state.classSections.splice( index, 1 );
    saveMasterDataToStorage();
    renderClassSectionsTable();
    updateClassFilters();
}

function exportClassSectionsCSV() {
    const rows = state.classSections || [];
    if ( rows.length === 0 ) { alert( 'No class sections to export.' ); return; }
    const header = 'Class,Section,Teaching Mode,Combined Group\n';
    const lines = rows.map( r => `${escapeCsvField( r.class || '' )},${escapeCsvField( r.section || '' )},${escapeCsvField( normalizeTeachingMode( r.teachingMode ) === 'combined' ? '1' : '0' )},${escapeCsvField( r.combinedGroupId || '' )}` );
    const csv = header + lines.join( '\n' );
    const blob = new Blob( [csv], { type: 'text/csv' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'class-sections.csv';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

function clearTeachers() {
    if ( !confirm( 'Clear all teacher entries?' ) ) return;
    state.teachers = [];
    saveMasterDataToStorage();
    renderTeacherMasterTable();
}

function clearTeacherMappings() {
    if ( !confirm( 'Clear all teacher mapping entries?' ) ) return;
    state.teacherMappings = [];
    saveMasterDataToStorage();
    renderTeacherMappingTable();
}

function clearClassSections() {
    if ( !confirm( 'Clear all generated class-section entries?' ) ) return;
    state.classSections = [];
    saveMasterDataToStorage();
    renderClassSectionsTable();
    updateClassFilters();
}

function handleImportClassSectionsCSV( event ) {
    const file = event.target.files && event.target.files[0];
    if ( !file ) return;
    const reader = new FileReader();
    reader.onload = function ( e ) {
        try {
            const rows = parseCSVRows( e.target.result );
            if ( !rows || rows.length === 0 ) {
                alert( 'Empty or invalid CSV' );
                return;
            }

            // Detect header
            let start = 0;
            const first = rows[0].map( c => toCleanString( c ).toLowerCase() );
            const hasHeader = first.includes( 'class' ) || first.includes( 'section' ) || first.includes( 'class-section' ) || first.includes( 'class section' );
            if ( hasHeader ) start = 1;

            const parsed = [];
            for ( let i = start; i < rows.length; i++ ) {
                const cols = rows[i];
                if ( !cols || cols.length === 0 ) continue;
                if ( cols.length === 1 ) {
                    const cell = toCleanString( cols[0] );
                    if ( !cell ) continue;
                    // try formats like 10-A or 10:A or Class-10-A
                    const parts = cell.split( /[-:]/ ).filter( Boolean );
                    if ( parts.length >= 2 ) {
                        const cls = parts[0].replace( /^class|^grade\s*/i, '' ).trim();
                        const sec = parts[1].trim();
                        parsed.push( { className: `Class-${cls}-${sec}`, class: cls, section: sec } );
                    }
                    continue;
                }

                // use first two columns
                const rawClass = toCleanString( cols[0] );
                const rawSection = toCleanString( cols[1] );
                const mode = cols.length > 2 ? toCleanString( cols[2] ) : 'individual';
                const combinedGroup = cols.length > 3 ? toCleanString( cols[3] ) : '';
                if ( !rawClass || !rawSection ) continue;
                const cls = rawClass.replace( /^class|^grade\s*/i, '' );
                const sec = rawSection;
                parsed.push( { className: `Class-${cls}-${sec}`, class: cls, section: sec, teachingMode: mode || 'individual', combinedGroupId: combinedGroup } );
            }

            if ( parsed.length === 0 ) {
                alert( 'No valid class-section rows found in CSV.' );
                return;
            }

            // merge with existing
            const existing = ( state.classSections || [] ).filter( Boolean );
            const mergedMap = new Map();
            existing.forEach( e => { if ( e && e.className ) mergedMap.set( e.className, e ); } );
            parsed.forEach( p => { if ( p && p.className ) mergedMap.set( p.className, p ); } );
            state.classSections = Array.from( mergedMap.values() ).sort( ( a, b ) => compareGradeSection( a.className, b.className ) );
            saveMasterDataToStorage();
            renderClassSectionsTable();
            updateClassFilters();
            alert( 'Imported ' + parsed.length + ' class-section rows.' );
        } catch ( err ) {
            console.error( err );
            alert( 'Failed to import CSV' );
        } finally {
            // reset input so same file can be reselected
            event.target.value = '';
        }
    };
    reader.readAsText( file );
}

function deleteTeacherRow( index ) {
    saveMasterDataFromTablesWithoutAlert();
    state.teachers.splice( index, 1 );
    rebuildTeacherSubjectMapFromMasterData();
    saveMasterDataToStorage();
    saveTeacherSubjectMapToStorage();
    renderTeacherMasterTable();
    updateSetupSummary();
    renderAIPrompt();
}

function deleteMappingRow( index ) {
    saveMasterDataFromTablesWithoutAlert();
    state.teacherMappings.splice( index, 1 );
    rebuildTeacherSubjectMapFromMasterData();
    saveMasterDataToStorage();
    saveTeacherSubjectMapToStorage();
    renderTeacherMappingTable();
    updateSetupSummary();
    renderAIPrompt();
}

function handleQuickAddMappingSubmit() {
    const className = document.getElementById( 'quickAddClass' ).value;
    const subject = document.getElementById( 'quickAddSubject' ).value;
    const periods = parseInt( document.getElementById( 'quickAddPeriods' ).value ) || 5;

    // Read fixed periods (multiple select)
    const fixedPeriodsSelect = document.getElementById( 'quickAddFixedPeriods' );
    const fixedPeriods = Array.from( fixedPeriodsSelect.options || [] ).filter( opt => opt.selected ).map( opt => opt.value ).join( ',' );

    const teacherId = document.getElementById( 'quickAddTeacher' ).value;

    if ( !className || !subject ) {
        alert( "Please select a Class and Subject first. (You might need to add Classes and Subjects in the panels above)." );
        return;
    }

    saveMasterDataFromTablesWithoutAlert();
    state.teacherMappings = state.teacherMappings || [];

    // Check if mapping already exists
    const exists = state.teacherMappings.some( m =>
        toCleanString( m.gradeSection ) === toCleanString( className ) &&
        toCleanString( m.subject ) === toCleanString( subject ) &&
        toCleanString( m.teacherId ) === toCleanString( teacherId || "UNASSIGNED" )
    );

    if ( exists ) {
        if ( !confirm( "A similar mapping already exists. Add anyway?" ) ) return;
    }

    state.teacherMappings.push( {
        id: `M${state.teacherMappings.length + 1}`,
        teacherId: teacherId || "UNASSIGNED",
        teacherName: teacherId ? findTeacherNameById( teacherId ) : "Unassigned",
        gradeSection: className,
        subject: subject,
        periodsPerWeek: periods,
        fixedPeriods: fixedPeriods,
        mode: "0"
    } );

    rebuildTeacherSubjectMapFromMasterData();
    saveMasterDataToStorage();
    saveTeacherSubjectMapToStorage();
    renderTeacherMappingTable();
    updateSetupSummary();
    renderAIPrompt();
}

function updateQuickAddDropdowns() {
    const classSelect = document.getElementById( 'quickAddClass' );
    const subjectSelect = document.getElementById( 'quickAddSubject' );
    const teacherSelect = document.getElementById( 'quickAddTeacher' );
    const fixedPeriodsSelect = document.getElementById( 'quickAddFixedPeriods' );
    if ( !classSelect || !subjectSelect || !teacherSelect ) return;

    const selectedClass = classSelect.value;
    const selectedSubject = subjectSelect.value;
    const selectedTeacher = teacherSelect.value;

    // Preserve selected fixed periods
    const selectedFixedPeriods = fixedPeriodsSelect ? Array.from( fixedPeriodsSelect.selectedOptions || [] ).map( opt => opt.value ) : [];

    const classOptions = getClassSectionOptions();
    classSelect.innerHTML = classOptions.map( c =>
        `<option value="${escapeHtml( c.label )}">${escapeHtml( c.label )}</option>`
    ).join( '' );

    subjectSelect.innerHTML = ( state.subjects || [] ).map( s =>
        `<option value="${escapeHtml( s.code )}">${escapeHtml( s.name )} (${escapeHtml( s.code )})</option>`
    ).join( '' );

    teacherSelect.innerHTML = '<option value="">Unassigned</option>' + ( state.teachers || [] ).map( t =>
        `<option value="${escapeHtml( t.id )}">${escapeHtml( t.name )} (${escapeHtml( t.id )})</option>`
    ).join( '' );

    if ( fixedPeriodsSelect ) {
        const periodOptions = getPeriodOptions();
        fixedPeriodsSelect.innerHTML = periodOptions.map( opt =>
            `<option value="${escapeHtml( opt.value )}">${escapeHtml( opt.label )}</option>`
        ).join( '' );
        // Restore selections
        Array.from( fixedPeriodsSelect.options ).forEach( opt => {
            if ( selectedFixedPeriods.includes( opt.value ) ) opt.selected = true;
        } );

        // Re-apply checkbox dropdown if it exists, or create it
        if ( fixedPeriodsSelect.nextElementSibling && fixedPeriodsSelect.nextElementSibling.classList.contains( 'checkbox-dropdown-container' ) ) {
            fixedPeriodsSelect.nextElementSibling.remove();
        }
        createCheckboxDropdown( fixedPeriodsSelect, 'Select Periods' );
    }

    if ( selectedClass ) classSelect.value = selectedClass;
    if ( selectedSubject ) subjectSelect.value = selectedSubject;
    if ( selectedTeacher ) teacherSelect.value = selectedTeacher;
}

function rebuildTeacherSubjectMapFromMasterData() {
    const nextMap = { ...( state.teacherSubjectMap || {} ) };

    ( state.teachers || [] ).forEach( teacher => {
        const subject = toCleanString( teacher.classTeacherSubject || teacher.subjects || '' ).split( /[;/,]/ ).map( item => toCleanString( item ) ).filter( Boolean )[0] || '';
        if ( !subject ) return;
        const byId = buildTeacherSubjectMapKey( '', teacher.id );
        const byName = buildTeacherSubjectMapKey( teacher.name, '' );
        if ( byId ) nextMap[byId] = subject;
        if ( byName ) nextMap[byName] = subject;
    } );

    ( state.teacherMappings || [] ).forEach( mapping => {
        if ( !mapping.subject ) return;
        const byId = buildTeacherSubjectMapKey( '', mapping.teacherId );
        const byName = buildTeacherSubjectMapKey( mapping.teacherName, '' );
        if ( byId ) nextMap[byId] = mapping.subject;
        if ( byName ) nextMap[byName] = mapping.subject;
    } );

    state.teacherSubjectMap = nextMap;
}
function makePeriodHeaders() {
    return Array.from( { length: state.config.periodsPerDay || 7 }, ( _, index ) => `P${index + 1}` );
}

function buildAIPrompt() {
    syncConfigFromInputs();
    const days = state.config.schoolDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periodHeaders = makePeriodHeaders();

    // Read directly from the DOM to capture any un-saved manual edits or new rows the user added
    const uiMappings = readTableRows( 'teacherMappingTable', ['teacherId', 'gradeSection', 'subject', 'periodsPerWeek', 'fixedPeriods', 'mode'] );

    const mappings = uiMappings.map( ( uiRow, index ) => {
        const stateRow = ( state.teacherMappings && state.teacherMappings[index] ) || {};

        // Use teacherId from UI, or fallback to state's teacherName if it's imported without an ID
        const teacherIdentifier = uiRow.teacherId || stateRow.teacherId || stateRow.teacherName || '-';

        return {
            teacherId: teacherIdentifier,
            gradeSection: uiRow.gradeSection || stateRow.gradeSection || '-',
            subject: uiRow.subject || stateRow.subject || '-',
            periodsPerWeek: uiRow.periodsPerWeek || stateRow.periodsPerWeek || 'as needed',
            fixedPeriods: uiRow.fixedPeriods || stateRow.fixedPeriods || '-',
            mode: uiRow.mode || stateRow.mode || '0',
            combinedGroupId: uiRow.combinedGroupId || stateRow.combinedGroupId || '-'
        };
    } ).filter( row => row.gradeSection !== '-' && row.subject !== '-' ); // Only include valid rows

    let detailedData = '';
    if ( state.config.aiPromptStyle === 'detailed' ) {
        let csv = 'Teacher ID,Grade-Section,Subject,Periods / Week,Fixed Periods,Mode\n';
        mappings.forEach( mapping => {
            csv += [mapping.teacherId, mapping.gradeSection, mapping.subject, mapping.periodsPerWeek, mapping.fixedPeriods, mapping.mode].map( escapeCsvField ).join( ',' ) + '\n';
        } );
        detailedData = `\nTeacher Grade-Section Subject Mapping:\n${csv}\n`;
    } else {
        const compactMappings = mappings.map( row =>
            `${row.teacherId} | ${row.gradeSection} | ${row.subject} | ${row.periodsPerWeek} | ${row.fixedPeriods} | ${row.mode}`
        );
        detailedData = `\nTeacher Grade-Section Subject Mapping:\n${compactMappings.join( '\n' ) || 'No mappings imported yet.'}\n`;
    }

    return `You are generating a school timetable from local principal-provided data.

Config:
- Days: ${days.join( ', ' )}
- Periods per day: ${state.config.periodsPerDay}
- Max periods per teacher per week: ${state.config.periodsPerTeacher}
- Output columns: Class-Section,Day,${periodHeaders.join( ',' )}
- Period cell format: TeacherName:Subject
- Use an empty cell for free/break periods.

Hard constraints:
- Use only teachers and class-subject mappings listed below.
- A teacher cannot be assigned to two classes in the same Day and Period.
- Keep each teacher at or below the configured max periods per week.
- Fill every listed class-section for every configured day.
- Respect Periods Per Week from mapping rows when provided.
-If 'Fixed Periods' is specified for a mapping (e.g., P1, P1-P2), you MUST schedule those periods exactly as specified. A value like 'P1-P2' indicates a consecutive double period that must span P1 and P2.
- If Mode is 1 (or 'combined'), the listed class-sections are taught together as one combined class.
- Return only CSV text, with no explanation before or after.

${detailedData}
Return CSV now.`;
}

function toTeacherCSV( teachers ) {
    let csv = 'Teacher ID,Teacher Name,Class Teacher Subject,Class Teacher Grade,Class Teacher Section,Phone,Email\n';
    teachers.forEach( teacher => {
        csv += [teacher.id, teacher.name, teacher.classTeacherSubject || teacher.subjects || '', teacher.classTeacherGrade || '', teacher.classTeacherSection || '', teacher.phone, teacher.email].map( escapeCsvField ).join( ',' ) + '\n';
    } );
    return csv.trim();
}

function toMappingCSV( mappings ) {
    let csv = 'Teacher ID,Teacher Name,Grade-Section,Subject,Periods Per Week,Fixed Periods,Mode\n';
    mappings.forEach( mapping => {
        const modeVal = mapping.mode === '1' || mapping.mode === 'combined' ? '1' : ( mapping.mode === '0' || mapping.mode === 'individual' ? '0' : '' );
        csv += [mapping.teacherId, mapping.teacherName, mapping.gradeSection, mapping.subject, mapping.periodsPerWeek, mapping.fixedPeriods || '', modeVal].map( escapeCsvField ).join( ',' ) + '\n';
    } );
    return csv.trim();
}

function renderAIPrompt() {
    const output = document.getElementById( 'aiPromptOutput' );
    if ( output ) output.value = buildAIPrompt();
}

function copyAIPrompt() {
    const output = document.getElementById( 'aiPromptOutput' );
    output.select();
    document.execCommand( 'copy' );
}

function downloadAIPrompt() {
    const blob = new Blob( [buildAIPrompt()], { type: 'text/plain' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'ai_timetable_prompt.txt';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

function downloadMasterDataTemplates() {
    const teachersCsv = 'Teacher ID,Teacher Name,Class Teacher Subject,Class Teacher Grade,Class Teacher Section,Phone,Email\nT001,Indira,Maths,I,A,9876543210,indira@school.com\nT002,Sai Priya,EVS,II,A,9876543211,sai@school.com\n';
    const mappingsCsv = 'Teacher ID,Teacher Name,Grade-Section,Subject,Periods Per Week\nT001,Indira,Grade-I-A,Maths,5\nT002,Sai Priya,Grade-I-A,EVS,4\n';
    const blob = new Blob( [`Teacher List Template\n${teachersCsv}\n\nMapping Template\n${mappingsCsv}`], { type: 'text/plain' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'timetable_master_data_templates.txt';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

function exportTeacherList() {
    const csv = toTeacherCSV( state.teachers || [] );
    if ( !csv || csv.trim() === '' ) {
        alert( 'No teachers to export.' );
        return;
    }
    const blob = new Blob( [csv], { type: 'text/csv;charset=utf-8;' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'teacher-list.csv';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

function exportTeacherMappingCSV() {
    const mappings = state.teacherMappings || [];
    if ( mappings.length === 0 ) {
        alert( 'No teacher mappings to export.' );
        return;
    }

    const headers = ['Teacher ID', 'Grade-Section', 'Subject', 'Periods Per Week', 'Fixed Periods', 'Mode'];
    const csvRows = [headers.join( ',' )];

    mappings.forEach( mapping => {
        const row = [
            escapeCsvField( mapping.teacherId || '' ),
            escapeCsvField( mapping.gradeSection || '' ),
            escapeCsvField( mapping.subject || '' ),
            escapeCsvField( mapping.periodsPerWeek || '' ),
            escapeCsvField( mapping.fixedPeriods || '' ),
            escapeCsvField( mapping.mode === '1' || mapping.mode === 'combined' ? '1' : ( mapping.mode === '0' || mapping.mode === 'individual' ? '0' : '' ) )
        ];
        csvRows.push( row.join( ',' ) );
    } );

    const csv = csvRows.join( '\n' );
    const blob = new Blob( [csv], { type: 'text/csv;charset=utf-8;' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'teacher-mapping.csv';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

function escapeCsvField( value ) {
    const cleaned = toCleanString( value );
    // Quote field if it contains comma, quote, or newline
    if ( cleaned.includes( ',' ) || cleaned.includes( '"' ) || cleaned.includes( '\n' ) ) {
        return `"${cleaned.replace( /"/g, '""' )}"`;
    }
    return cleaned;
}

// Render holidays list
function renderHolidays() {
    const holidaysList = document.getElementById( 'holidaysList' );
    const yearHolidays = state.holidays.filter( h => h.date.startsWith( state.currentYear ) );

    // Update summary counts
    document.getElementById( 'totalHolidays' ).textContent = yearHolidays.length;
    document.getElementById( 'publicHolidays' ).textContent = yearHolidays.filter( h => h.type === 'public' ).length;
    document.getElementById( 'schoolHolidays' ).textContent = yearHolidays.filter( h => h.type === 'school' ).length;
    document.getElementById( 'optionalHolidays' ).textContent = yearHolidays.filter( h => h.type === 'optional' ).length;

    if ( yearHolidays.length === 0 ) {
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
        document.getElementById( 'addFirstHolidayBtn' ).addEventListener( 'click', openAddHolidayModal );
        return;
    }

    let html = '<div class="holiday-cards">';

    yearHolidays.forEach( holiday => {
        const typeClass = `${holiday.type}-holiday`;
        const typeLabel = holiday.type === 'public' ? 'Public Holiday' :
            holiday.type === 'school' ? 'School Holiday' : 'Optional Holiday';

        html += `
                    <div class="holiday-card ${typeClass}">
                        <div class="holiday-date">${formatDate( holiday.date )}</div>
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
    } );

    html += '</div>';
    holidaysList.innerHTML = html;
}

// Format date for display
function formatDate( dateString ) {
    const date = new Date( dateString );
    return date.toLocaleDateString( 'en-US', { day: 'numeric', month: 'short' } );
}

// Open add holiday modal
function openAddHolidayModal() {
    document.getElementById( 'addHolidayModal' ).classList.add( 'active' );
    document.getElementById( 'holidayDate' ).value = `${state.currentYear}-01-01`;
}

// Close add holiday modal
function closeAddHolidayModal() {
    document.getElementById( 'addHolidayModal' ).classList.remove( 'active' );
    // Clear form
    document.getElementById( 'holidayName' ).value = '';
    document.getElementById( 'holidayDescription' ).value = '';
}

// Save holiday
function saveHoliday() {
    const name = document.getElementById( 'holidayName' ).value;
    const date = document.getElementById( 'holidayDate' ).value;
    const type = document.getElementById( 'holidayType' ).value;
    const description = document.getElementById( 'holidayDescription' ).value;

    if ( !name || !date ) {
        alert( "Please fill in all required fields." );
        return;
    }

    const newHoliday = {
        id: state.holidays.length > 0 ? Math.max( ...state.holidays.map( h => h.id ) ) + 1 : 1,
        name,
        date,
        type,
        description
    };

    state.holidays.push( newHoliday );
    saveHolidaysToStorage();
    renderHolidays();
    closeAddHolidayModal();
}

// Delete holiday
function deleteHoliday( id ) {
    if ( confirm( "Are you sure you want to delete this holiday?" ) ) {
        state.holidays = state.holidays.filter( h => h.id !== id );
        saveHolidaysToStorage();
        renderHolidays();
    }
}

// Export holidays
function exportHolidays() {
    // In a real app, this would generate an Excel or PDF file
    alert( "Exporting holidays to Excel file..." );

    // For demo, we'll create a simple CSV
    const yearHolidays = state.holidays.filter( h => h.date.startsWith( state.currentYear ) );
    let csv = "Name,Date,Type,Description\n";

    yearHolidays.forEach( holiday => {
        csv += `"${holiday.name}","${holiday.date}","${holiday.type}","${holiday.description || ''}"\n`;
    } );

    // Create download link
    const blob = new Blob( [csv], { type: 'text/csv' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = `holidays_${state.currentYear}.csv`;
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

// Handle Excel file upload
function handleExcelUpload( event ) {
    const file = event.target.files[0];
    if ( !file ) return;

    document.getElementById( 'selectedExcelFileName' ).textContent = `Selected file: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function ( e ) {
        try {
            const data = new Uint8Array( e.target.result );
            const workbook = XLSX.read( data, { type: 'array' } );

            // Process the workbook
            processExcelWorkbook( workbook );
        } catch ( error ) {
            console.error( "Error reading Excel file:", error );
            alert( "Error reading Excel file. Please make sure it's in the correct format." );
        }
    };

    reader.readAsArrayBuffer( file );
}

// Handle CSV file upload
function handleCSVUpload( event ) {
    const file = event.target.files[0];
    if ( !file ) return;

    document.getElementById( 'selectedCSVFileName' ).textContent = `Selected file: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function ( e ) {
        try {
            const csvData = e.target.result;
            // Process the CSV
            processCSVData( csvData, file.name );
        } catch ( error ) {
            console.error( "Error reading CSV file:", error );
            alert( "Error reading CSV file. Please make sure it's in the correct format." );
        }
    };

    reader.readAsText( file );
}

function handleSubjectMappingUpload( event ) {
    const file = event.target.files[0];
    if ( !file ) return;

    document.getElementById( 'selectedSubjectMappingFileName' ).textContent = `Selected file: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function ( e ) {
        try {
            const csvData = e.target.result;
            processSubjectMappingCSV( csvData, file.name );
        } catch ( error ) {
            console.error( "Error reading subject mapping CSV file:", error );
            alert( "Error reading subject mapping CSV file. Please make sure it's in the correct format." );
        }
    };

    reader.readAsText( file );
}

// Process uploaded Excel workbook
function processExcelWorkbook( workbook ) {
    // Clear previous data
    state.timetableData = {};
    let processedCount = 0;

    if ( state.excelFormat === 'teacher_wise' ) {
        processedCount = processStateTimetableWorkbook( workbook );
    } else {
        // Process each sheet
        workbook.SheetNames.forEach( sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json( worksheet, { header: 1 } );

            // Process the data based on the template format
            processExcelSheetData( sheetName, jsonData );
        } );
        processedCount = Object.keys( state.timetableData ).length;
    }

    if ( processedCount === 0 ) {
        return;
    }

    assignTeacherIdsInTimetableData();
    autoFillMissingSubjectsFromTeacherMap();

    // Save to localStorage
    saveTimetableToStorage();

    // Update UI
    updateTimetableSummary();
    renderTimetable();
    updateClassFilters();

    // Show upload status
    document.getElementById( 'uploadStatus' ).style.display = 'block';
    document.getElementById( 'uploadDetails' ).innerHTML = `
                <p><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Timetable uploaded successfully!</p>
                <p>Processed ${processedCount} classes.</p>
            `;

    document.getElementById( 'timetableDataInfo' ).style.display = 'block';
}

function toCleanString( value ) {
    return String( value || '' )
        .replace( /\s+/g, ' ' )
        .trim();
}

function safeLocaleCompare( a, b ) {
    return String( a ?? '' ).localeCompare( String( b ?? '' ), undefined, { sensitivity: 'base' } );
}

function compareGradeSection( a, b ) {
    const parseGrade = ( str ) => {
        const sStr = String( str || '' ).trim();
        const match = sStr.match( /Grade-([IVX\d]+)-([A-Z0-9]+)/i ) || sStr.match( /([IVX\d]+)-([A-Z0-9]+)/i ) || sStr.match( /^([IVX\d]+)$/i ) || sStr.match( /^Grade-([IVX\d]+)$/i );

        if ( !match ) return { num: 999, section: sStr };

        const g = match[1].toUpperCase();
        const s = match[2] ? match[2].toUpperCase() : '';
        let num = parseInt( g, 10 );
        if ( isNaN( num ) ) {
            const romanToNum = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12 };
            num = romanToNum[g] || 999;
        }
        return { num, section: s };
    };

    const parsedA = parseGrade( a );
    const parsedB = parseGrade( b );

    if ( parsedA.num !== parsedB.num ) {
        return parsedA.num - parsedB.num;
    }
    return safeLocaleCompare( parsedA.section, parsedB.section );
}

const duplicateCheckCache = new Set();

function validateClassSection( value ) {
    const cleaned = toCleanString( value );
    if ( !cleaned ) {
        return { valid: false, error: 'Class-Section is empty' };
    }

    // Handle comma-separated values from multi-select
    const values = cleaned.split( ',' ).map( v => v.trim() ).filter( Boolean );

    // Validate each class-section individually
    for ( const singleValue of values ) {
        const normalized = normalizeClassSectionLabel( singleValue );
        // Format validation: Grade-Class-Section (e.g., Grade-I-A or Grade-10-A)
        const match = normalized.match( /^Grade-([IVX\d]+)-([A-Z])$/i );
        if ( !match ) {
            return { valid: false, error: `Invalid Class-Section format: "${singleValue}". Expected format like "Grade-I-A"` };
        }
    }

    // Return normalized comma-separated values
    const normalizedValues = values.map( v => normalizeClassSectionLabel( v ) );
    return { valid: true, normalized: normalizedValues.join( ',' ) };
}

function validateSubjectSelection( subject ) {
    const cleaned = toCleanString( subject );
    if ( !cleaned ) {
        return { valid: false, error: 'Subject is empty' };
    }

    const subjectOptions = getSubjectOptions() || [];
    // Try to match by code or name
    const found = subjectOptions.find( s =>
        safeLocaleCompare( s.code, cleaned ) === 0 ||
        safeLocaleCompare( s.name, cleaned ) === 0
    );
    if ( !found ) {
        return { valid: false, error: `Subject "${subject}" is not defined in subjects list` };
    }
    return { valid: true, normalized: found.code };
}

function validateTeacherSelection( teacherId, teacherName ) {
    const id = toCleanString( teacherId );
    const name = toCleanString( teacherName );

    if ( !id && !name ) {
        return { valid: false, error: 'Both Teacher ID and Teacher Name are empty' };
    }

    if ( id.toUpperCase() === 'UNASSIGNED' || name.toLowerCase() === 'unassigned' ) {
        return { valid: true, teacherId: 'UNASSIGNED', teacherName: 'Unassigned' };
    }

    const teachers = state.teachers || [];
    let foundTeacher = null;

    if ( id ) {
        foundTeacher = teachers.find( t => toCleanString( t.id ).toLowerCase() === id.toLowerCase() );
        if ( !foundTeacher ) {
            return { valid: false, error: `Teacher ID "${teacherId}" not found in teachers list` };
        }
    } else if ( name ) {
        foundTeacher = teachers.find( t => toCleanString( t.name ).toLowerCase() === name.toLowerCase() );
        if ( !foundTeacher ) {
            return { valid: false, error: `Teacher Name "${teacherName}" not found in teachers list` };
        }
    }

    return {
        valid: true,
        teacherId: foundTeacher.id,
        teacherName: foundTeacher.name
    };
}

function checkForDuplicateMapping( mapping ) {
    const key = `${toCleanString( mapping.gradeSection ).toLowerCase()}|${toCleanString( mapping.subject ).toLowerCase()}`;
    if ( duplicateCheckCache.has( key ) ) {
        return { isDuplicate: true };
    }
    duplicateCheckCache.add( key );
    return { isDuplicate: false };
}

function assignTeacherIdsInTimetableData() {
    if ( !state.timetableData ) return;

    const teacherIdMap = new Map();
    let nextId = 1;

    Object.values( state.timetableData ).forEach( classData => {
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const teacherName = toCleanString( period.teacherName );
                const teacherId = toCleanString( period.teacherId );
                if ( !teacherName ) return;

                if ( teacherId ) {
                    teacherIdMap.set( teacherName, teacherId );
                    return;
                }

                if ( !teacherIdMap.has( teacherName ) ) {
                    teacherIdMap.set( teacherName, `T${String( nextId ).padStart( 4, '0' )}` );
                    nextId += 1;
                }
            } );
        } );
    } );

    Object.values( state.timetableData ).forEach( classData => {
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const teacherName = toCleanString( period.teacherName );
                if ( !teacherName ) return;
                period.teacherId = teacherIdMap.get( teacherName ) || toCleanString( period.teacherId );
            } );
        } );
    } );
}

function normalizeClassSectionLabel( value ) {
    const cleaned = toCleanString( value );
    if ( !cleaned ) return '';

    if ( cleaned.includes( ',' ) || cleaned.includes( ';' ) ) {
        const parts = cleaned.split( /[,;]/ ).map( p => p.trim() ).filter( Boolean );
        return parts.map( p => normalizeSingleClassSectionLabel( p ) ).join( ',' );
    }

    return normalizeSingleClassSectionLabel( cleaned );
}

function normalizeSingleClassSectionLabel( cleaned ) {
    const hyphenated = cleaned.replace( /\s*-\s*/g, '-' );

    const arabicToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
    function toRoman( numStr ) {
        return arabicToRoman[numStr] || numStr;
    }

    // Handle hyphenated format without GRADE prefix (e.g., "I-A", "10-A")
    const hyphenMatchNoPrefix = hyphenated.match( /^([IVX]+|\d+)-([A-Z])$/i );
    if ( hyphenMatchNoPrefix ) {
        return `Grade-${toRoman( hyphenMatchNoPrefix[1].toUpperCase() )}-${hyphenMatchNoPrefix[2].toUpperCase()}`;
    }

    // Handle hyphenated format with GRADE or CLASS prefix (e.g., "GRADE-I-A", "Class-I-A")
    const hyphenMatch = hyphenated.match( /^(?:GRADE|CLASS)-?([IVX]+|\d+)-([A-Z])$/i );
    if ( hyphenMatch ) {
        return `Grade-${toRoman( hyphenMatch[1].toUpperCase() )}-${hyphenMatch[2].toUpperCase()}`;
    }

    const raw = cleaned;

    const compact = raw.replace( /\s+/g, '' );
    const match = compact.match( /^(?:GRADE|CLASS)?([IVX]+|\d+)([A-Z])$/i );
    if ( match ) {
        return `Grade-${toRoman( match[1].toUpperCase() )}-${match[2].toUpperCase()}`;
    }

    // Allow standalone numeric/roman grades without section (e.g. "10", "VII")
    const standaloneGradeMatch = compact.match( /^(?:GRADE|CLASS)?([IVX]+|\d+)$/i );
    if ( standaloneGradeMatch ) {
        return `Grade-${toRoman( standaloneGradeMatch[1].toUpperCase() )}`;
    }

    const parts = raw.split( /\s+/ ).filter( Boolean );
    if ( parts.length >= 3 && parts[0].toUpperCase() === 'GRADE' ) {
        return `Grade-${toRoman( parts[1].toUpperCase() )}-${parts[2].toUpperCase()}`;
    }
    if ( parts.length >= 2 ) {
        return `Grade-${toRoman( parts[0].toUpperCase() )}-${parts[1].toUpperCase()}`;
    }

    return raw;
}

function getStandardDayOrder( className = null ) {
    const baseDays = ( state.config && state.config.schoolDays && state.config.schoolDays.length > 0 )
        ? state.config.schoolDays
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    if ( className ) {
        const isTenth = className.includes('Grade-X') || className.includes('Grade-10') || className.includes('Class-10') || className.includes('-10-') || className.startsWith('10-') || className === '10';
        if ( isTenth && !baseDays.includes('Saturday') ) {
            return [...baseDays, 'Saturday'];
        }
    }

    return baseDays;
}

function getAllActiveDays() {
    const days = [...getStandardDayOrder()];
    const daySet = new Set( days );

    let hasTenthGrade = false;
    if (state.classSections && state.classSections.some(c => {
        const str = typeof c === 'string' ? c : (c.className || '');
        return str.includes('Grade-X') || str.includes('Grade-10') || str.includes('Class-10') || str.includes('-10-') || str.startsWith('10-') || str === '10';
    })) {
        hasTenthGrade = true;
    } else if (state.timetableData && Object.keys(state.timetableData).some(c => c.includes('Grade-X') || c.includes('Grade-10') || c.includes('Class-10') || c.includes('-10-') || c.startsWith('10-') || c === '10')) {
        hasTenthGrade = true;
    }
    if (hasTenthGrade && !daySet.has('Saturday')) {
        days.push('Saturday');
        daySet.add('Saturday');
    }

    if ( typeof CSL_FIXED_SCHEDULE !== 'undefined' ) {
        Object.values( CSL_FIXED_SCHEDULE ).forEach( slots => {
            slots.forEach( slot => {
                if ( !daySet.has( slot.day ) ) {
                    days.push( slot.day );
                    daySet.add( slot.day );
                }
            } );
        } );
    }
    const chronological = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.sort( ( a, b ) => chronological.indexOf( a ) - chronological.indexOf( b ) );
}

/** True when a class entry matches the canonical days/periods structure. */
function isValidTimetableClassData( classData ) {
    if ( !classData || typeof classData !== 'object' || !Array.isArray( classData.days ) ) {
        return false;
    }

    return classData.days.every( day =>
        day &&
        typeof day.dayName === 'string' &&
        Array.isArray( day.periods ) &&
        day.periods.every( period => period && typeof period.period === 'number' )
    );
}

/** Detect older generator output shaped as { Monday: { P1: {...} } }. */
function isLegacyFlatTimetableEntry( classData ) {
    if ( !classData || typeof classData !== 'object' || Array.isArray( classData.days ) ) {
        return false;
    }

    const standardDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return Object.keys( classData ).some( key => standardDays.includes( key ) );
}

/** Convert legacy flat timetable entries into the canonical app structure. */
function migrateLegacyFlatTimetableEntry( className, classData ) {
    const schoolDays = getStandardDayOrder( className );
    const periodsPerDay = state.config.periodsPerDay || 7;

    return {
        className,
        days: schoolDays.map( dayName => ( {
            dayName,
            periods: Array.from( { length: periodsPerDay }, ( _, index ) => {
                const periodNumber = index + 1;
                const periodKey = `P${periodNumber}`;
                const slot = classData[dayName] && classData[dayName][periodKey];
                return {
                    period: periodNumber,
                    subject: slot ? toCleanString( slot.subject ) : '',
                    teacherName: slot ? toCleanString( slot.teacherName || slot.teacher ) : '',
                    teacherId: slot ? toCleanString( slot.teacherId ) : '',
                    time: getPeriodTime( periodNumber ),
                    type: 'Regular',
                    breakAfter: 0
                };
            } )
        } ) )
    };
}

/**
 * Accept canonical timetable data as-is, migrate legacy flat data, or reject invalid blobs.
 * Keeps View/Modify/Teacher Schedule tabs from crashing on old localStorage values.
 */
function normalizeLoadedTimetableData( data ) {
    if ( !data || typeof data !== 'object' ) return null;

    const classNames = Object.keys( data );
    if ( classNames.length === 0 ) return null;

    const normalized = {};
    let changed = false;

    classNames.forEach( className => {
        const classData = data[className];
        if ( isValidTimetableClassData( classData ) ) {
            normalized[className] = classData;
            return;
        }

        if ( isLegacyFlatTimetableEntry( classData ) ) {
            normalized[className] = migrateLegacyFlatTimetableEntry( className, classData );
            changed = true;
            return;
        }

        changed = true;
    } );

    if ( Object.keys( normalized ).length === 0 ) return null;

    if ( changed ) {
        return normalized;
    }

    return data;
}

// --- Generate Timetable (greedy scheduler) ---

let teacherBusyTracker = {};
let currentUnscheduledList = [];

function getLabSubjectCode() {
    return 'CSL';
}

function getLabBlocks() {
    const blocks = state.labBlocks && Array.isArray( state.labBlocks.periodPairs )
        ? state.labBlocks.periodPairs
        : [[1, 2], [6, 7]];
    return blocks;
}

function parseSectionsValue( raw ) {
    return String( raw || '' ).split( /[;,]/ ).map( s => s.trim() ).filter( Boolean );
}

/** Wire the Generate Timetable button in the Setup tab. */
function createGenerateButton() {
    const btn = document.getElementById( 'generateTimetableBtn' );
    if ( !btn ) return;
    btn.addEventListener( 'click', function () {
        syncSetupStateFromTablesForGeneration();
        generateTimetable();
    } );
}

/** Read latest Setup tab values into state before scheduling. */
function syncSetupStateFromTablesForGeneration() {
    syncConfigFromInputs();
    mergeBulkClassSectionsFromInput();

    const previousFixedPeriods = new Map();
    ( state.teacherMappings || [] ).forEach( mapping => {
        const key = [
            toCleanString( mapping.teacherId ),
            toCleanString( mapping.gradeSection ),
            toCleanString( mapping.subject )
        ].join( '|' ).toLowerCase();
        const fixed = toCleanString( mapping.fixedPeriods );
        if ( fixed ) previousFixedPeriods.set( key, fixed );
    } );

    state.teachers = readTableRows( 'teacherMasterTable', ['id', 'name', 'classTeacherSubject', 'classTeacherGrade', 'classTeacherSection', 'phone', 'email'] )
        .map( normalizeTeacherGradeSection )
        .filter( teacher => toCleanString( teacher.name ) );

    state.teacherMappings = readTableRows( 'teacherMappingTable', ['teacherId', 'gradeSection', 'subject', 'periodsPerWeek', 'fixedPeriods', 'mode'] )
        .map( ( mapping, index ) => {
            const lookupKey = [
                toCleanString( mapping.teacherId ),
                parseGradeSectionParts( mapping.gradeSection )
                    .map( part => normalizeClassSectionLabel( part ) )
                    .filter( Boolean )
                    .join( ',' ),
                toCleanString( mapping.subject )
            ].join( '|' ).toLowerCase();
            const tableFixed = toCleanString( mapping.fixedPeriods );
            const fixedPeriods = tableFixed || previousFixedPeriods.get( lookupKey ) || '';

            return {
                ...mapping,
                id: mapping.id || `M${index + 1}`,
                teacherId: toCleanString( mapping.teacherId ),
                teacherName: findTeacherNameById( mapping.teacherId ),
                subject: ( () => {
                    const validation = validateSubjectSelection( mapping.subject );
                    return validation.valid ? validation.normalized : toCleanString( mapping.subject );
                } )(),
                periodsPerWeek: Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ),
                gradeSection: parseGradeSectionParts( mapping.gradeSection )
                    .map( part => normalizeClassSectionLabel( part ) )
                    .filter( Boolean )
                    .join( ',' ),
                fixedPeriods
            };
        } )
        .filter( mapping => mapping.gradeSection && mapping.subject && mapping.teacherId && mapping.periodsPerWeek > 0 );
}

/** Parse bulk class input (if present) and merge into state.classSections. */
function mergeBulkClassSectionsFromInput() {
    const idInput = document.getElementById( 'bulkClassesIdInput' );
    const detailsInput = document.getElementById( 'bulkClassesDetailsInput' );
    if ( !idInput || !detailsInput ) return;

    const idLines = idInput.value.split( /\r?\n/ ).map( l => l.trim() );
    const detailsLines = detailsInput.value.split( /\r?\n/ ).map( l => l.trim() );
    const lines = [];
    const maxLen = Math.max( idLines.length, detailsLines.length );
    for ( let i = 0; i < maxLen; i++ ) {
        if ( idLines[i] ) {
            lines.push( idLines[i] + ':' + ( detailsLines[i] || 'A' ) );
        }
    }

    const parsed = parseBulkClassesInput( lines );
    if ( parsed.length === 0 ) return;

    const mergedMap = new Map();
    ( state.classSections || [] ).forEach( item => {
        if ( item && item.className ) mergedMap.set( item.className, item );
    } );
    parsed.forEach( item => {
        if ( item && item.className ) mergedMap.set( item.className, item );
    } );
    state.classSections = Array.from( mergedMap.values() ).sort( ( a, b ) => compareGradeSection( a.className, b.className ) );
}

/** Map Grade-10-A / 10-A labels to Class-10-A keys used by state.timetableData. */
function mappingGradeSectionToClassName( gradeSectionLabel ) {
    const normalized = normalizeClassSectionLabel( gradeSectionLabel );
    const gradeMatch = normalized.match( /^Grade-([IVX\d]+)-([A-Z])$/i );
    if ( gradeMatch ) return `Class-${gradeMatch[1]}-${gradeMatch[2]}`;

    const classMatch = toCleanString( gradeSectionLabel ).match( /^Class-([IVX\d]+)-([A-Z])$/i );
    if ( classMatch ) return `Class-${classMatch[1]}-${classMatch[2]}`;

    const compact = toCleanString( gradeSectionLabel ).replace( /^Grade-?/i, '' ).replace( /^Class-?/i, '' );
    const hyphenMatch = compact.match( /^([IVX\d]+)-([A-Z])$/i );
    if ( hyphenMatch ) return `Class-${hyphenMatch[1]}-${hyphenMatch[2]}`;

    return toCleanString( gradeSectionLabel );
}

/** Look up a single period entry inside the canonical timetable shape. */
function getClassDayPeriod( timetable, className, dayName, periodNumber ) {
    const classData = timetable[className];
    if ( !classData || !Array.isArray( classData.days ) ) return null;

    const dayData = classData.days.find( day => day.dayName === dayName );
    if ( !dayData || !Array.isArray( dayData.periods ) ) return null;

    return dayData.periods.find( period => period.period === periodNumber ) || null;
}

/** True when a period cell has not yet been assigned subject/teacher data. */
function isPeriodSlotEmpty( periodEntry ) {
    if ( !periodEntry ) return false;
    return !toCleanString( periodEntry.subject ) &&
        !toCleanString( periodEntry.teacherId ) &&
        !toCleanString( periodEntry.teacherName );
}

/**
 * Build an empty timetable in the same shape used across the app:
 * state.timetableData[className] = { className, days: [{ dayName, periods: [...] }] }
 */
function createEmptyTimetable() {
    const schoolDays = getAllActiveDays();
    const periodsPerDay = state.config.periodsPerDay || 7;
    const timetable = {};
    const classNameSet = new Set();

    ( state.classSections || [] ).forEach( item => {
        if ( !item ) return;
        if ( item.className ) {
            classNameSet.add( item.className );
        } else if ( item.class && item.section ) {
            classNameSet.add( `Class-${item.class}-${item.section}` );
        }
    } );

    ( state.teacherMappings || [] ).forEach( mapping => {
        parseGradeSectionParts( mapping.gradeSection )
            .flatMap( part => resolveMappingToClassNames( part ) )
            .forEach( className => classNameSet.add( className ) );
    } );

    classNameSet.forEach( className => {
        timetable[className] = {
            className,
            days: schoolDays.map( dayName => ( {
                dayName,
                periods: Array.from( { length: periodsPerDay }, ( _, index ) => ( {
                    period: index + 1,
                    subject: '',
                    teacherName: '',
                    teacherId: '',
                    time: getPeriodTime( index + 1 ),
                    type: 'Regular',
                    breakAfter: 0
                } ) )
            } ) )
        };
    } );

    return timetable;
}

function resetGenerationTrackers() {
    teacherBusyTracker = {};
    classDailySubjectCount = {};
    teacherAssignments = {};
    state.unresolvedMappings = [];
    state.consumedCslMappings = [];
    state.stagedTimetableData = null;
    if ( state.assignmentReverseMap ) state.assignmentReverseMap.clear();
}

// Tracks how many times each subject appears per class per day (for spread constraint).
let classDailySubjectCount = {};
let teacherAssignments = {};

/** Normalize subject to canonical code (PT, CSC, SOC, etc.). */
function normalizeSubjectCode( subject ) {
    const cleaned = toCleanString( subject );
    if ( !cleaned ) return '';

    const options = getSubjectOptions() || [];
    const found = options.find( item =>
        safeLocaleCompare( item.code, cleaned ) === 0 ||
        safeLocaleCompare( item.name, cleaned ) === 0
    );
    return found ? found.code : cleaned.toUpperCase();
}



/** Split mapping grade-section cells on comma or semicolon (CSV uses both). */
function parseGradeSectionParts( gradeSectionStr ) {
    return toCleanString( gradeSectionStr )
        .split( /[,;]/ )
        .map( part => part.trim() )
        .filter( Boolean );
}

/**
 * Resolve a mapping grade-section label to Class-* keys in state.timetableData.
 * Handles Grade-VII-A, Class-VII-A, and grade-only labels like Grade-VII.
 */
function resolveMappingToClassNames( gradeSectionLabel ) {
    const label = toCleanString( gradeSectionLabel );
    if ( !label ) return [];

    const withSection = mappingGradeSectionToClassName( label );
    if ( /^Class-[IVX\d]+-[A-Z]$/i.test( withSection ) ) {
        return [withSection];
    }

    const gradeOnlyPatterns = [
        label.match( /^Grade-([IVX\d]+)$/i ),
        normalizeClassSectionLabel( label ).match( /^Grade-([IVX\d]+)$/i ),
        withSection.match( /^Grade-([IVX\d]+)$/i ),
        label.match( /^([IVX\d]+)$/i )
    ];

    for ( const match of gradeOnlyPatterns ) {
        if ( !match ) continue;
        const grade = match[1].toUpperCase();
        const fromSections = ( state.classSections || [] )
            .filter( item => toCleanString( item.class ).toUpperCase() === grade )
            .map( item => item.className || `Class-${item.class}-${item.section}` )
            .filter( Boolean );

        if ( fromSections.length > 0 ) return fromSections;
        return [];
    }

    if ( withSection.startsWith( 'Class-' ) ) {
        const isValid = ( state.classSections || [] ).some( item =>
            ( item.className || `Class-${item.class}-${item.section}` ) === withSection
        );
        if ( isValid ) return [withSection];
    }

    return [];
}

function getDailySubjectCount( className, dayName, subject ) {
    const subjectKey = normalizeSubjectCode( subject );
    const classCounts = classDailySubjectCount[className];
    if ( !classCounts || !classCounts[dayName] ) return 0;
    return classCounts[dayName][subjectKey] || 0;
}

function incrementDailySubjectCount( className, dayName, subject, amount ) {
    const subjectKey = normalizeSubjectCode( subject );
    if ( !classDailySubjectCount[className] ) classDailySubjectCount[className] = {};
    if ( !classDailySubjectCount[className][dayName] ) classDailySubjectCount[className][dayName] = {};
    classDailySubjectCount[className][dayName][subjectKey] =
        ( classDailySubjectCount[className][dayName][subjectKey] || 0 ) + amount;
}

function getPreviousPeriodSubject( timetable, className, dayName, periodNumber ) {
    if ( periodNumber <= 1 ) return '';
    const previous = getClassDayPeriod( timetable, className, dayName, periodNumber - 1 );
    return previous ? normalizeSubjectCode( previous.subject ) : '';
}

/** Enforce max 1–2 periods of the same subject per class per day. */
function exceedsDailySubjectLimit( className, dayName, subject, additionalPeriods, options ) {
    let maxPerDay = options.isLabBlock ? 2 : 1;
    if ( options.totalPeriodsNeeded > getStandardDayOrder( className ).length ) {
        maxPerDay = 2;
    }
    const current = getDailySubjectCount( className, dayName, subject );
    return current + additionalPeriods > maxPerDay;
}

/**
 * Phase 3 — Slot Scorer
 * Score a candidate slot — higher is better.
 * Formula updated per architecture plan.
 */
function scoreCandidateSlot( timetable, task, dayName, periodNumbers, options ) {
    let score = 100;
    const subjectKey = normalizeSubjectCode( task.subject );
    const schoolDays = getStandardDayOrder( task.className );
    const dailyCount = getDailySubjectCount( task.className, dayName, task.subject );

    // Subject spread: reward days that don't already have this subject
    if ( dailyCount === 0 )      score += 40;
    else if ( dailyCount === 1 ) score += 10;
    else                         score -= 50;

    // Prefer the day with the fewest occurrences of this subject (even distribution)
    const weeklyCounts = schoolDays.map( day => getDailySubjectCount( task.className, day, task.subject ) );
    const minWeeklyDayCount = Math.min( ...weeklyCounts );
    if ( dailyCount === minWeeklyDayCount ) score += 25;

    // Penalise adjacent same-subject periods (before / after)
    periodNumbers.forEach( periodNumber => {
        const previousSubject = getPreviousPeriodSubject( timetable, task.className, dayName, periodNumber );
        if ( previousSubject && previousSubject === subjectKey ) score -= 60; // adjacent duplicate — strongly penalise
        const nextPeriod = getClassDayPeriod( timetable, task.className, dayName, periodNumber + 1 );
        if ( nextPeriod && normalizeSubjectCode( nextPeriod.subject ) === subjectKey ) score -= 30;
    } );

    // Fixed-period preference bonus
    if ( options.preferFixedPeriods ) score += 15;

    // Phase 3: Preferred early periods (P1–P4)
    const minPeriod = Math.min( ...periodNumbers );
    if ( minPeriod <= 4 ) score += 10;

    // Phase 5: Teacher slack — tight teachers (low slack) get boost to be scheduled first
    const teacherSlack = options.teacherSlack !== undefined ? options.teacherSlack : 10;
    if ( teacherSlack < 3 )       score += 20;
    else if ( teacherSlack < 8 )  score += 10;
    else                          score -= 5;  // comfortable teacher — deprioritise slightly

    // Phase 5: Class slack — tight class gets boost
    const classSlack = options.classSlack !== undefined ? options.classSlack : 10;
    if ( classSlack < 3 )  score += 15;

    // Phase 3: Prefer slots that leave more future empty slots in this class (preserve flexibility)
    const classData = timetable[task.className];
    if ( classData ) {
        const dayData = classData.days.find( d => d.dayName === dayName );
        if ( dayData ) {
            let emptySlotsToday = dayData.periods.filter( p => !p.isLocked && isPeriodSlotEmpty( p ) ).length;
            score += emptySlotsToday * 2; // more empty slots remaining = more flexible = reward
        }
    }

    // Lab block preferred positions
    if ( options.isLabBlock && periodNumbers.length === 2 ) {
        const blockKey = periodNumbers.join( '-' );
        if ( blockKey === '1-2' || blockKey === '6-7' ) score += 20;
    }

    return score;
}

/** Find the highest-scoring valid slot for a task. */
function findBestCandidateSlot( timetable, task, periodNumbers, options, maxTeacherPeriods, labBlockList, searchAllPeriods ) {
    const candidates = [];
    const periodsPerDay = state.config.periodsPerDay || 7;
    const schoolDays = getStandardDayOrder( task.className );
    const slotPatterns = [];

    if ( labBlockList && labBlockList.length > 0 ) {
        schoolDays.forEach( dayName => {
            labBlockList.forEach( block => slotPatterns.push( { dayName, periodNumbers: block } ) );
        } );
    } else if ( searchAllPeriods ) {
        schoolDays.forEach( dayName => {
            for ( let periodNumber = 1; periodNumber <= periodsPerDay; periodNumber++ ) {
                slotPatterns.push( { dayName, periodNumbers: [periodNumber] } );
            }
        } );
    } else if ( periodNumbers && periodNumbers.length > 0 ) {
        schoolDays.forEach( dayName => slotPatterns.push( { dayName, periodNumbers } ) );
    }

    slotPatterns.forEach( ( { dayName, periodNumbers: nums } ) => {
        const validation = validateSlot(
            timetable,
            task.className,
            dayName,
            nums,
            task.teacherId,
            maxTeacherPeriods
        );
        if ( !validation.valid ) return;

        if ( exceedsDailySubjectLimit(
            task.className,
            dayName,
            task.subject,
            nums.length,
            options
        ) ) {
            return;
        }

        candidates.push( {
            dayName,
            periodNumbers: nums,
            score: scoreCandidateSlot( timetable, task, dayName, nums, options )
        } );
    } );

    if ( candidates.length === 0 ) return null;
    candidates.sort( ( a, b ) => b.score - a.score );
    return candidates[0];
}

/** Assign slot and update daily subject distribution trackers. */
function assignSlotWithTracking( timetable, className, dayName, periodNumbers, teacherId, subject, teacherName, assignmentId = null ) {
    if ( !assignmentId ) {
        // Fallback to a deterministic assignmentId using teacher, class, day, and periods
        assignmentId = `auto-${toCleanString( teacherId )}-${className}-${dayName}-P${periodNumbers.join( '-' )}`;
    }
    const success = assignSlot( timetable, className, dayName, periodNumbers, teacherId, subject, teacherName, assignmentId );
    if ( success ) {
        incrementDailySubjectCount( className, dayName, subject, periodNumbers.length );
        assertTeacherBusyTrackerMatchesTimetable(timetable, 'assignSlotWithTracking', teacherId, dayName, periodNumbers);
    }
    return success;
}

function unassignSlotWithTracking( timetable, className, dayName, periodNumbers, teacherId, subject, assignmentId ) {
    const tid = toCleanString( teacherId );
    const resolvedSubject = toCleanString( subject );
    periodNumbers.forEach( periodNumber => {
        const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
        if ( !periodEntry ) return;

        let resolvedAssignmentId = assignmentId || periodEntry.assignmentId;
        // Reorder atomic teardown: delete reverse map first, then set, then clear cell.
        if ( resolvedAssignmentId && teacherAssignments[tid] && teacherAssignments[tid].has( resolvedAssignmentId ) ) {
            if ( state.assignmentReverseMap ) state.assignmentReverseMap.delete( resolvedAssignmentId );
            teacherAssignments[tid].delete( resolvedAssignmentId );
        }

        periodEntry.teacherId = '';
        periodEntry.teacherName = '';
        periodEntry.subject = '';
        periodEntry.assignmentId = null;

        if ( teacherBusyTracker[tid] ) {
            teacherBusyTracker[tid][`${dayName}-P${periodNumber}`] = false;
        }
    } );

    if ( classDailySubjectCount[className] && classDailySubjectCount[className][dayName] ) {
        const currentCount = classDailySubjectCount[className][dayName][resolvedSubject] || 0;
        classDailySubjectCount[className][dayName][resolvedSubject] = Math.max( 0, currentCount - periodNumbers.length );
    }
    assertTeacherBusyTrackerMatchesTimetable(timetable, 'unassignSlotWithTracking', teacherId, dayName, periodNumbers);
}

function assertTeacherBusyTrackerMatchesTimetable(timetable, callerName, latestTid, latestDayName, latestPeriodNumber) {
    const trueBusy = {};
    for (const [className, classData] of Object.entries(timetable)) {
        (classData.days || []).forEach(day => {
            (day.periods || []).forEach(period => {
                if (period.teacherId) {
                    const tid = toCleanString(period.teacherId);
                    if (!trueBusy[tid]) trueBusy[tid] = {};
                    trueBusy[tid][`${day.dayName}-P${period.period}`] = {
                        className,
                        subject: period.subject
                    };
                }
            });
        });
    }

    // Compare teacherBusyTracker to trueBusy
    for (const [tid, days] of Object.entries(teacherBusyTracker)) {
        for (const [dayPeriod, isBusy] of Object.entries(days)) {
            if (isBusy) {
                if (!trueBusy[tid] || !trueBusy[tid][dayPeriod]) {
                    console.error(`ASSERTION FAILED [${callerName}]: Tracker says teacher ${tid} is busy on ${dayPeriod}, but no such assignment exists in timetable.`);
                    console.error('Latest attempted assignment:', latestTid, latestDayName, latestPeriodNumber);
                    throw new Error(`ASSERTION FAILED [${callerName}]: Tracker says teacher ${tid} is busy on ${dayPeriod}, but no such assignment exists in timetable.`);
                }
            }
        }
    }

    // Check the other direction
    for (const [tid, days] of Object.entries(trueBusy)) {
        for (const [dayPeriod, details] of Object.entries(days)) {
            if (!teacherBusyTracker[tid] || !teacherBusyTracker[tid][dayPeriod]) {
                console.error(`ASSERTION FAILED [${callerName}]: Timetable has teacher ${tid} assigned to ${details.className} for ${details.subject} on ${dayPeriod}, but tracker says they are free.`);
                console.error('Latest attempted assignment:', latestTid, latestDayName, latestPeriodNumber);
                throw new Error(`ASSERTION FAILED [${callerName}]: Timetable has teacher ${tid} assigned to ${details.className} for ${details.subject} on ${dayPeriod}, but tracker says they are free.`);
            }
        }
    }
}

function getTeacherLoad( teacherId ) {
    const tid = toCleanString( teacherId );
    if ( !teacherAssignments[tid] || !state.assignmentReverseMap ) return 0;

    let load = 0;
    for ( const assignmentId of teacherAssignments[tid] ) {
        const assignment = state.assignmentReverseMap.get( assignmentId );
        if ( assignment && Array.isArray( assignment.periods ) ) {
            load += assignment.periods.length;
        }
    }
    return load;
}

function isTeacherBusy( teacherId, dayName, periodNumber ) {
    const tid = toCleanString( teacherId );
    if ( !tid || !teacherBusyTracker[tid] ) return false;
    return !!teacherBusyTracker[tid][`${dayName}-P${periodNumber}`];
}

/** Check whether a class period cell can receive this teacher assignment. */
function validateSlot( timetable, className, dayName, periodNumbers, teacherId, maxTeacherPeriods ) {
    const tid = toCleanString( teacherId );
    if ( !tid || !className || !dayName || !periodNumbers || periodNumbers.length === 0 ) {
        return { valid: false, reason: 'Missing slot data' };
    }

    const classData = timetable[className];
    if ( !classData || !Array.isArray( classData.days ) ) {
        return { valid: false, reason: `Unknown class ${className}` };
    }

    for ( const periodNumber of periodNumbers ) {
        const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
        if ( !periodEntry ) {
            return { valid: false, reason: `Invalid period P${periodNumber}` };
        }
        if ( periodEntry.isLocked ) {
            return { valid: false, reason: `Slot locked (${className}, ${dayName}, P${periodNumber})` };
        }
        if ( !isPeriodSlotEmpty( periodEntry ) ) {
            return { valid: false, reason: `Class slot occupied (${className}, ${dayName}, P${periodNumber})` };
        }
        if ( isTeacherBusy( tid, dayName, periodNumber ) ) {
            return { valid: false, reason: `Teacher busy (${tid}, ${dayName}, P${periodNumber})` };
        }
    }

    if ( getTeacherLoad( tid ) + periodNumbers.length > maxTeacherPeriods ) {
        return { valid: false, reason: `Teacher ${tid} exceeds max weekly periods` };
    }

    return { valid: true };
}

/** Write subject + teacher into the canonical days/periods structure.
 * ATOMIC: if the teacher is already busy in ANY of the target periods,
 * the entire write is rejected with no partial mutation — UNLESS the
 * busy slot already carries the same assignmentId (valid clubbed expansion).
 */
function assignSlot( timetable, className, dayName, periodNumbers, teacherId, subject, teacherName, assignmentId = null ) {
    const tid = toCleanString( teacherId );
    const resolvedTeacherName = teacherName || findTeacherNameById( tid );
    const resolvedSubject = toCleanString( subject );

    // Atomic pre-check: reject if teacher is busy in any target period,
    // unless this is a clubbed expansion of the same assignmentId.
    for ( const periodNumber of periodNumbers ) {
        if ( isTeacherBusy( tid, dayName, periodNumber ) ) {
            // Check whether this is a valid clubbed expansion
            const isClubbedExpansion = assignmentId && ( () => {
                for ( const otherClass of Object.keys( timetable ) ) {
                    if ( otherClass === className ) continue;
                    const p = getClassDayPeriod( timetable, otherClass, dayName, periodNumber );
                    if ( p && toCleanString( p.teacherId ) === tid && p.assignmentId === assignmentId ) {
                        return true;
                    }
                }
                return false;
            } )();

            if ( !isClubbedExpansion ) {
                console.warn(
                    `assignSlot BLOCKED: Teacher ${tid} already busy on ${dayName} P${periodNumber}` +
                    ` (attempted for ${className} / ${resolvedSubject}, assignmentId=${assignmentId})`
                );
                return false;
            }
        }
        const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
        if ( periodEntry && !isPeriodSlotEmpty( periodEntry ) ) {
            console.warn(
                `assignSlot BLOCKED: ${className} ${dayName} P${periodNumber} already occupied` +
                ` by ${periodEntry.teacherId}/${periodEntry.subject}`
            );
            return false;
        }
    }

    periodNumbers.forEach( periodNumber => {
        const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
        if ( !periodEntry ) return;

        periodEntry.teacherId = tid;
        periodEntry.teacherName = resolvedTeacherName;
        periodEntry.subject = resolvedSubject;
        periodEntry.assignmentId = assignmentId;

        if ( !teacherBusyTracker[tid] ) teacherBusyTracker[tid] = {};
        teacherBusyTracker[tid][`${dayName}-P${periodNumber}`] = true;
    } );

    if ( assignmentId ) {
        if ( !teacherAssignments[tid] ) teacherAssignments[tid] = new Set();
        if ( !teacherAssignments[tid].has( assignmentId ) ) {
            teacherAssignments[tid].add( assignmentId );
            if ( state.assignmentReverseMap ) {
                state.assignmentReverseMap.set( assignmentId, {
                    teacherId: tid,
                    className,
                    dayName,
                    periods: [...periodNumbers],
                    subject: resolvedSubject
                } );
            }
        }
    }
    return true;
}

/** Expand fixed-period values: P1, P1-P2, bare 1, or lab-block pairs like 0-1 / 5-6. */
function expandFixedPeriodEntry( fixedEntry ) {
    let cleaned = toCleanString( fixedEntry );
    if ( !cleaned ) return [];

    // Strip decimal suffix (e.g., "1.0" -> "1")
    cleaned = cleaned.replace( /\.0+$/, '' );

    const pRangeMatch = cleaned.match( /^P(\d+)-P(\d+)$/i );
    if ( pRangeMatch ) {
        const start = Number( pRangeMatch[1] );
        const end = Number( pRangeMatch[2] );
        const periodNumbers = [];
        for ( let i = start; i <= end; i++ ) periodNumbers.push( i );
        return periodNumbers;
    }

    if ( /^P(\d+)$/i.test( cleaned ) ) {
        return [Number( cleaned.match( /\d+/ )[0] )];
    }

    if ( /^\d+$/.test( cleaned ) ) {
        return [Number( cleaned )];
    }

    const indexRangeMatch = cleaned.match( /^(\d+)-(\d+)$/ );
    if ( indexRangeMatch ) {
        const start = Number( indexRangeMatch[1] );
        const end = Number( indexRangeMatch[2] );
        const periodNumbers = [];
        if ( start === 0 ) {
            for ( let i = start; i <= end; i++ ) periodNumbers.push( i + 1 );
        } else {
            for ( let i = start; i <= end; i++ ) periodNumbers.push( i );
        }
        return periodNumbers;
    }

    return [];
}

function parseFixedPeriodGroups( fixedPeriodsStr ) {
    const groups = [];
    const errors = [];
    const maxPeriods = state.config.periodsPerDay || 7;
    toCleanString( fixedPeriodsStr )
        .split( /[,;]/ )
        .map( part => part.trim() )
        .filter( Boolean )
        .forEach( part => {
            const expanded = expandFixedPeriodEntry( part );
            if ( expanded.length > 0 ) {
                if ( expanded.some( p => p > maxPeriods || p < 1 ) ) {
                    errors.push( `Invalid period ${part} (max is ${maxPeriods})` );
                } else {
                    groups.push( expanded );
                }
            }
        } );
    return { groups, errors };
}

/** True when a task requires Period 1 only (bare "1", "P1", etc.). */
function taskRequiresFixedPeriodOne( task ) {
    return ( task.fixedPeriodGroups || [] ).some(
        group => group.length === 1 && group[0] === 1
    );
}

/** Lock empty P1 slots so later schedulers cannot place other subjects there. */
function reserveClassP1Slots( timetable, tasks ) {
    const reservedClasses = new Set();

    tasks.forEach( task => {
        if ( !task.hasFixedPeriods || !taskRequiresFixedPeriodOne( task ) ) return;

        // Skip broad P1 reservation for CSL tasks because their specific slots are already locked
        if ( typeof isCslSubject === 'function' ? isCslSubject( task.subject ) : normalizeSubjectCode( task.subject ) === 'CSL' ) return;

        if ( reservedClasses.has( task.className ) ) return;
        reservedClasses.add( task.className );

        const schoolDays = getStandardDayOrder( task.className );
        schoolDays.forEach( dayName => {
            const periodEntry = getClassDayPeriod( timetable, task.className, dayName, 1 );
            if ( periodEntry && isPeriodSlotEmpty( periodEntry ) ) {
                periodEntry.isLocked = true;
            }
        } );
    } );
}

function isCslSubject( subject ) {
    return normalizeSubjectCode( subject ) === 'CSL';
}

function isClassTeacherP1Task( task ) {
    return task.hasFixedPeriods && task.fixedPeriodGroups.some( group => group.length === 1 && group[0] === 1 );
}

function isCslLabTask( task ) {
    return normalizeSubjectCode( task.subject ) === 'CSL';
}

function classHasP1P2LabOnDay( timetable, className, dayName ) {
    const p1 = getClassDayPeriod( timetable, className, dayName, 1 );
    const p2 = getClassDayPeriod( timetable, className, dayName, 2 );
    if ( !p1 || !p2 ) return false;

    const s1 = normalizeSubjectCode( p1.subject );
    const s2 = normalizeSubjectCode( p2.subject );

    return s1 === 'CSL' && s2 === 'CSL';
}

function getUniqueFixedGroups( task ) {
    const seen = new Set();
    return ( task.fixedPeriodGroups || [] ).filter( group => {
        const key = group.join( '-' );
        if ( seen.has( key ) ) return false;
        seen.add( key );
        return true;
    } );
}

function canPlaceClassTeacherP1( timetable, className, dayName, teacherId, maxTeacherPeriods ) {
    if ( classHasP1P2LabOnDay( timetable, className, dayName ) ) return false;

    const p1 = getClassDayPeriod( timetable, className, dayName, 1 );
    if ( !p1 ) return false;
    if ( !isPeriodSlotEmpty( p1 ) ) return false;
    if ( isTeacherBusy( teacherId, dayName, 1 ) ) return false;
    if ( getTeacherLoad( teacherId ) + 1 > maxTeacherPeriods ) return false;

    return true;
}

/** Validation for fixed P1 assignment — allows reserved-but-empty locked slots. */
function canAssignFixedP1Slot( timetable, className, dayName, periodNumber, teacherId, maxTeacherPeriods ) {
    const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
    if ( !periodEntry || !isPeriodSlotEmpty( periodEntry ) ) return false;
    if ( isTeacherBusy( teacherId, dayName, periodNumber ) ) return false;
    if ( getTeacherLoad( teacherId ) + 1 > maxTeacherPeriods ) return false;
    return true;
}

/** Enumerate day/period combinations, optionally prioritising fixed period numbers. */
function getSlotCandidates( className, preferredPeriodNumbers ) {
    const schoolDays = getStandardDayOrder( className );
    const periodsPerDay = state.config.periodsPerDay || 7;
    const candidates = [];
    const seen = new Set();

    const pushCandidate = ( dayName, periodNumbers ) => {
        const key = `${className}|${dayName}|${periodNumbers.join( '-' )}`;
        if ( seen.has( key ) ) return;
        seen.add( key );
        candidates.push( { dayName, periodNumbers } );
    };

    if ( preferredPeriodNumbers && preferredPeriodNumbers.length > 0 ) {
        schoolDays.forEach( dayName => pushCandidate( dayName, preferredPeriodNumbers ) );
    }

    schoolDays.forEach( dayName => {
        for ( let periodNumber = 1; periodNumber <= periodsPerDay; periodNumber++ ) {
            pushCandidate( dayName, [periodNumber] );
        }
    } );

    return candidates;
}

function normalizeTeachingMode( value ) {
    const v = toCleanString( value ).toLowerCase();
    if ( v === "1" || v === "combined" ) return "combined";
    return "individual";
}

function getClassMetaMap() {
    const map = {};
    ( state.classSections || [] ).forEach( item => {
        if ( !item ) return;
        const key = normalizeClassSectionLabel( item.className || `${item.class}-${item.section}` );
        map[key] = {
            teachingMode: normalizeTeachingMode( item.teachingMode ),
            combinedGroupId: toCleanString( item.combinedGroupId || "" )
        };
    } );
    return map;
}

function resolveCombinedTeaching( mapping, classNames ) {
    const classMetaMap = getClassMetaMap();
    const normalizedClassNames = [...new Set( ( classNames || [] ).map( c => normalizeClassSectionLabel( c ) ).filter( Boolean ) )];

    const rawMode = toCleanString( mapping.mode ).toLowerCase();
    const isExplicitlyCombined = rawMode === "1" || rawMode === "combined";
    const isExplicitlyIndividual = rawMode === "0" || rawMode === "individual";
    const mappingGroupId = toCleanString( mapping.combinedGroupId );

    if ( isExplicitlyCombined && mappingGroupId && normalizedClassNames.length > 0 ) {
        return {
            isCombined: true,
            combinedGroupId: mappingGroupId,
            classNames: normalizedClassNames
        };
    }

    if ( isExplicitlyIndividual ) {
        return {
            isCombined: false,
            combinedGroupId: "",
            classNames: normalizedClassNames
        };
    }

    const grouped = normalizedClassNames.filter( className => {
        const meta = classMetaMap[className];
        return meta && meta.teachingMode === "combined" && meta.combinedGroupId;
    } );

    if ( grouped.length > 0 ) {
        const firstMeta = classMetaMap[grouped[0]];
        const sameGroup = normalizedClassNames.filter( className => {
            const meta = classMetaMap[className];
            return meta && meta.teachingMode === "combined" && meta.combinedGroupId === firstMeta.combinedGroupId;
        } );

        if ( sameGroup.length > 0 ) {
            return {
                isCombined: true,
                combinedGroupId: firstMeta.combinedGroupId,
                classNames: sameGroup
            };
        }
    }

    return {
        isCombined: false,
        combinedGroupId: "",
        classNames: normalizedClassNames
    };
}

function buildCslTasks( mappings ) {
    const tasks = [];
    const removedMappingIndices = new Set();
    const combinedGroups = new Map();

    mappings.forEach( ( mapping, mappingIndex ) => {
        const subjectCode = normalizeSubjectCode( mapping.subject );
        if ( !isCslSubject( subjectCode ) ) return; // Skip non-CSL

        const classNames = [];
        let hasUnresolvedPart = false;
        parseGradeSectionParts( mapping.gradeSection ).forEach( part => {
            const resolved = resolveMappingToClassNames( part );
            if ( resolved.length > 0 ) {
                classNames.push( ...resolved );
            } else {
                hasUnresolvedPart = true;
                if ( state.unresolvedMappings ) {
                    state.unresolvedMappings.push( {
                        mappingIndex,
                        teacherId: mapping.teacherId,
                        subject: subjectCode,
                        rawGradeSection: part,
                        severity: 'fatal'
                    } );
                }
            }
        } );

        if ( hasUnresolvedPart ) return;

        let uniqueClassNames = [...new Set( classNames )];
        if ( uniqueClassNames.length === 0 ) {
            if ( state.unresolvedMappings ) {
                state.unresolvedMappings.push( {
                    mappingIndex,
                    teacherId: mapping.teacherId,
                    subject: subjectCode,
                    rawGradeSection: mapping.gradeSection,
                    severity: 'fatal'
                } );
            }
            return;
        }

        removedMappingIndices.add( mappingIndex ); // Consume it!

        const teacherId = mapping.teacherId;
        const teacherName = mapping.teacherName || findTeacherNameById( teacherId ) || '';

        let remainingClasses = new Set( uniqueClassNames );
        let matchedRules = [];

        const teacherIdUpper = ( teacherId || '' ).toUpperCase();
        const teacherNameUpper = ( teacherName || '' ).toUpperCase();

        if ( typeof CSL_FIXED_SCHEDULE !== 'undefined' ) {
            for ( const key of Object.keys( CSL_FIXED_SCHEDULE ) ) {
                if ( remainingClasses.size === 0 ) break;

                const [teacherPrefix, classStr] = key.split( '|' );
                const teacherPrefixUpper = teacherPrefix.toUpperCase();

                const ruleClassNames = classStr.split( ';' ).map( c => mappingGradeSectionToClassName( c ) );

                const isSubset = ruleClassNames.length > 0 && ruleClassNames.every( c => remainingClasses.has( c ) );
                const teacherMatch = teacherPrefixUpper === 'ANY' ||
                    teacherIdUpper === teacherPrefixUpper ||
                    teacherNameUpper.startsWith( teacherPrefixUpper );

                if ( isSubset && teacherMatch ) {
                    matchedRules.push( { key, classes: ruleClassNames } );
                    ruleClassNames.forEach( c => remainingClasses.delete( c ) );
                }
            }
        }

        if ( remainingClasses.size > 0 ) {
            // No fixed CSL schedule rule matched — undo consumption so the
            // mapping falls through to the regular scheduler as a normal subject.
            removedMappingIndices.delete( mappingIndex );
            console.warn(
                `CSL mapping for teacher ${teacherId} has no matching fixed schedule rule for classes ` +
                `${Array.from( remainingClasses ).join( ',' )}. Scheduling as a regular subject.`
            );
            return;
        }

        let parsedFixed = parseFixedPeriodGroups( mapping.fixedPeriods );
        let fixedGroups = parsedFixed.groups;
        if ( parsedFixed.errors.length > 0 && state.unresolvedMappings ) {
            parsedFixed.errors.forEach( err => {
                state.unresolvedMappings.push( {
                    mappingIndex,
                    teacherId,
                    subject: subjectCode,
                    rawGradeSection: `FixedPeriods: ${err}`,
                    severity: 'fatal'
                } );
            } );
            return;
        }

        matchedRules.forEach( match => {
            const resolved = resolveCombinedTeaching( mapping, match.classes );

            if ( resolved.isCombined ) {
                const groupKey = `${resolved.combinedGroupId}-${subjectCode}-${teacherId}-${match.key}`;
                if ( !combinedGroups.has( groupKey ) ) {
                    combinedGroups.set( groupKey, {
                        mappingIndex,
                        classNames: [...resolved.classNames],
                        className: resolved.classNames[0],
                        teacherId,
                        teacherName: mapping.teacherName || findTeacherNameById( teacherId ),
                        subject: subjectCode,
                        periodsNeeded: Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ),
                        fixedPeriodGroups: fixedGroups,
                        isClubbed: true,
                        clubbedClasses: new Set( resolved.classNames ),
                        taskType: 'fixed-csl',
                        fixedScheduleKey: match.key
                    } );
                } else {
                    const group = combinedGroups.get( groupKey );
                    resolved.classNames.forEach( c => group.clubbedClasses.add( c ) );
                    group.periodsNeeded = Math.max( group.periodsNeeded, Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ) );
                }
            } else {
                tasks.push( {
                    taskType: 'fixed-csl',
                    mappingIndex,
                    classNames: match.classes,
                    className: match.classes[0],
                    teacherId: mapping.teacherId,
                    teacherName: mapping.teacherName || findTeacherNameById( mapping.teacherId ),
                    subject: subjectCode,
                    periodsNeeded: Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ),
                    fixedPeriodGroups: fixedGroups,
                    isClubbed: match.classes.length > 1,
                    clubbedClasses: match.classes.length > 1 ? match.classes : undefined,
                    fixedScheduleKey: match.key
                } );
            }
        } );

        if ( state.consumedCslMappings ) {
            state.consumedCslMappings.push( {
                mappingIndex,
                teacherId,
                subject: subjectCode,
                classNames: uniqueClassNames,
                fixedScheduleKeys: matchedRules.map( m => m.key )
            } );
        }
    } );

    combinedGroups.forEach( group => {
        group.clubbedClasses = Array.from( group.clubbedClasses );
        group.classNames = group.clubbedClasses;
        group.className = group.clubbedClasses[0];
        tasks.push( group );
    } );

    return { tasks, removedMappingIndices };
}

function buildLabTasks( labGroupClassesOut ) {
    const tasks = [];
    const labGroups = state.labBlocks && Array.isArray( state.labBlocks.groups ) ? state.labBlocks.groups : [];

    labGroups.forEach( group => {
        let sections = group.sections;
        if ( typeof sections === 'string' ) sections = parseSectionsValue( sections );
        if ( !Array.isArray( sections ) || sections.length === 0 ) return;

        sections.forEach( c => labGroupClassesOut.add( c ) );

        let tId = String( group.teacher ).trim();
        let tName = String( group.teacher ).trim();
        const matchingTeacher = ( state.teachers || [] ).find( t => t.name.toLowerCase() === tName.toLowerCase() || t.id === tId );
        if ( matchingTeacher ) {
            tId = matchingTeacher.id;
            tName = matchingTeacher.name;
        }

        tasks.push( {
            taskType: 'lab',
            mappingIndex: -1,
            classNames: sections,
            className: sections[0], // Keep for backward compatibility
            teacherId: tId,
            teacherName: tName,
            subject: getLabSubjectCode(),
            periodsNeeded: ( Number( group.blocksPerWeek || group.blocks || 1 ) ) * 2,
            fixedPeriodGroups: [],
            isClubbed: sections.length > 1,
            clubbedClasses: sections.length > 1 ? sections : undefined
        } );
    } );
    return tasks;
}

function buildCombinedAndRegularTasks( mappings, removedMappingIndices, labGroupClasses, unresolvedOut ) {
    const tasks = [];
    const combinedGroups = new Map();

    mappings.forEach( ( mapping, mappingIndex ) => {
        if ( removedMappingIndices.has( mappingIndex ) ) return;

        const subjectCode = normalizeSubjectCode( mapping.subject );

        const classNames = [];
        let hasUnresolvedPart = false;
        parseGradeSectionParts( mapping.gradeSection ).forEach( part => {
            const resolved = resolveMappingToClassNames( part );
            if ( resolved.length > 0 ) {
                classNames.push( ...resolved );
            } else {
                hasUnresolvedPart = true;
                if ( state.unresolvedMappings ) {
                    state.unresolvedMappings.push( {
                        mappingIndex,
                        teacherId: mapping.teacherId,
                        subject: subjectCode,
                        rawGradeSection: part,
                        severity: 'fatal'
                    } );
                }
            }
        } );

        if ( hasUnresolvedPart ) return;

        let uniqueClassNames = [...new Set( classNames )];

        if ( uniqueClassNames.length === 0 ) {
            if ( state.unresolvedMappings ) {
                state.unresolvedMappings.push( {
                    mappingIndex,
                    teacherId: mapping.teacherId,
                    subject: subjectCode,
                    rawGradeSection: mapping.gradeSection,
                    severity: 'fatal'
                } );
            }
            return;
        }

        // Do not infer CSL from generic lab structures again later
        if ( subjectCode === getLabSubjectCode() && !isCslSubject( subjectCode ) ) {
            const filteredClasses = uniqueClassNames.filter( c => !labGroupClasses.has( c ) );
            if ( filteredClasses.length === 0 ) return;
            uniqueClassNames = filteredClasses;
        }

        const teacherId = mapping.teacherId;
        const resolved = resolveCombinedTeaching( mapping, uniqueClassNames );
        let parsedFixed = parseFixedPeriodGroups( mapping.fixedPeriods );
        let fixedGroups = parsedFixed.groups;
        if ( parsedFixed.errors.length > 0 && state.unresolvedMappings ) {
            parsedFixed.errors.forEach( err => {
                state.unresolvedMappings.push( {
                    mappingIndex,
                    teacherId,
                    subject: subjectCode,
                    rawGradeSection: `FixedPeriods: ${err}`,
                    severity: 'fatal'
                } );
            } );
            return;
        }

        if ( resolved.isCombined ) {
            const groupKey = `${resolved.combinedGroupId}-${subjectCode}-${teacherId}`;
            if ( !combinedGroups.has( groupKey ) ) {
                combinedGroups.set( groupKey, {
                    mappingIndex,
                    classNames: [...resolved.classNames],
                    className: resolved.classNames[0],
                    teacherId,
                    teacherName: mapping.teacherName || findTeacherNameById( teacherId ),
                    subject: subjectCode,
                    periodsNeeded: Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ),
                    fixedPeriodGroups: fixedGroups,
                    isClubbed: true,
                    clubbedClasses: new Set( resolved.classNames )
                } );
            } else {
                const group = combinedGroups.get( groupKey );
                resolved.classNames.forEach( c => group.clubbedClasses.add( c ) );
                group.periodsNeeded = Math.max( group.periodsNeeded, Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ) );
            }
            return;
        }

        uniqueClassNames.forEach( className => {
            tasks.push( {
                taskType: fixedGroups.length > 0 ? 'fixed' : 'normal',
                mappingIndex,
                classNames: [className],
                className,
                teacherId: mapping.teacherId,
                teacherName: mapping.teacherName || findTeacherNameById( mapping.teacherId ),
                subject: subjectCode,
                periodsNeeded: Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ),
                fixedPeriodGroups: fixedGroups,
                isClubbed: false,
                clubbedClasses: undefined
            } );
        } );
    } );

    combinedGroups.forEach( group => {
        group.clubbedClasses = Array.from( group.clubbedClasses );
        group.classNames = group.clubbedClasses;
        group.className = group.clubbedClasses[0];

        if ( group.fixedPeriodGroups.length > 0 ) {
            group.taskType = 'fixed-combined';
        } else {
            group.taskType = 'combined';
        }
        tasks.push( group );
    } );

    return tasks;
}

/** Flatten teacher mappings into schedulable tasks (one per resolved class name). */
function buildSchedulingTasks( unresolvedOut = [] ) {
    const mappings = state.teacherMappings || [];
    const labGroupClasses = new Set();

    // 1. Extract CSL tasks early and remove from pool
    const cslResult = buildCslTasks( mappings );
    const cslTasks = cslResult.tasks;
    const removedMappingIndices = cslResult.removedMappingIndices;

    // 2. Extract explicit lab blocks
    const labTasks = buildLabTasks( labGroupClasses );

    // 3. Build remaining combined and regular tasks
    const regularTasks = buildCombinedAndRegularTasks( mappings, removedMappingIndices, labGroupClasses, unresolvedOut );

    // 4. Combine all tasks
    const allTasks = [...cslTasks, ...labTasks, ...regularTasks];

    // 5. Compute backward compatibility and teacher counts
    const teacherTaskCounts = {};
    allTasks.forEach( t => {
        const tid = toCleanString( t.teacherId );
        teacherTaskCounts[tid] = ( teacherTaskCounts[tid] || 0 ) + 1;

        t.isLabSubject = isCslSubject( t.subject ) || t.taskType === 'lab' || t.taskType === 'fixed-csl';
        t.hasFixedPeriods = t.fixedPeriodGroups && t.fixedPeriodGroups.length > 0;
        t.alreadyScheduled = false;
    } );
    allTasks.forEach( t => {
        const tid = toCleanString( t.teacherId );
        t.teacherTaskCount = teacherTaskCounts[tid] || 0;
    } );

    return allTasks;
}

// ─────────────────────────────────────────────────────────────────────────────
// MRV SCHEDULER ENGINE  (Phases 1–7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 2 — Scheduler Context
 * Creates a lightweight view object pointing at the existing global trackers.
 * No data is copied — mutations via assignSlotWithTracking are reflected here.
 */
function prepareSchedulerContext( timetable ) {
    return {
        timetable,
        teacherBusy: teacherBusyTracker,          // existing global
        teacherLoad: teacherAssignments,           // existing global
        assignmentMap: state.assignmentReverseMap, // existing global
        teacherSlack: {},   // Phase 5 — populated by computeSlack()
        classSlack: {},     // Phase 5 — populated by computeSlack()
        taskCandidates: new Map() // Phase 1 — task → [{dayName, periodNumbers}]
    };
}

/**
 * Phase 1 — Candidate List Pre-computation
 * For every normal/combined task that has not yet been fully scheduled,
 * enumerate all (day, period) pairs that are currently legal.
 * Stores result in ctx.taskCandidates and as task.candidates.
 */
function buildCandidateLists( tasks, ctx ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    const timetable = ctx.timetable;

    tasks.forEach( task => {
        if ( task.alreadyScheduled ) return;
        const candidates = [];
        const schoolDays = getStandardDayOrder( task.className );
        const periodsPerDay = state.config.periodsPerDay || 7;

        if ( task.isClubbed && Array.isArray( task.clubbedClasses ) ) {
            // Combined task: every class must have an empty slot on the same day/period
            schoolDays.forEach( dayName => {
                for ( let p = 1; p <= periodsPerDay; p++ ) {
                    const nums = [p];
                    const tid = toCleanString( task.teacherId );
                    if ( isTeacherBusy( tid, dayName, p ) ) continue;
                    if ( getTeacherLoad( tid ) + 1 > maxTeacherPeriods ) continue;
                    let allClear = true;
                    for ( const cls of task.clubbedClasses ) {
                        const v = validateSlot( timetable, cls, dayName, nums, tid, maxTeacherPeriods );
                        if ( !v.valid ) { allClear = false; break; }
                        if ( exceedsDailySubjectLimit( cls, dayName, task.subject, 1, { isLabBlock: false, totalPeriodsNeeded: task._originalPeriods || task.periodsNeeded } ) ) { allClear = false; break; }
                    }
                    if ( allClear ) candidates.push( { dayName, periodNumbers: nums } );
                }
            } );
        } else {
            schoolDays.forEach( dayName => {
                for ( let p = 1; p <= periodsPerDay; p++ ) {
                    const nums = [p];
                    const v = validateSlot( timetable, task.className, dayName, nums, task.teacherId, maxTeacherPeriods );
                    if ( !v.valid ) continue;
                    if ( exceedsDailySubjectLimit( task.className, dayName, task.subject, 1, { isLabBlock: false, totalPeriodsNeeded: task._originalPeriods || task.periodsNeeded } ) ) continue;
                    candidates.push( { dayName, periodNumbers: nums } );
                }
            } );
        }

        task.candidates = candidates;
        ctx.taskCandidates.set( task, candidates );
    } );
}

/**
 * Phase 5 — Slack Calculation
 * teacherSlack[tid]   = maxPeriods - sum(periodsNeeded for tid)
 * classSlack[cls]     = totalSlots - sum(periodsNeeded for cls)
 */
function computeSlack( tasks, ctx ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    const periodsPerDay = state.config.periodsPerDay || 7;

    const teacherDemand = {};
    const classDemand = {};

    tasks.forEach( task => {
        if ( task.alreadyScheduled ) return;
        const tid = toCleanString( task.teacherId );
        teacherDemand[tid] = ( teacherDemand[tid] || 0 ) + ( task.periodsNeeded || 0 );
        const classes = ( task.isClubbed && task.clubbedClasses ) ? task.clubbedClasses : [task.className];
        classes.forEach( cls => {
            classDemand[cls] = ( classDemand[cls] || 0 ) + ( task.periodsNeeded || 0 );
        } );
    } );

    Object.entries( teacherDemand ).forEach( ( [tid, demand] ) => {
        ctx.teacherSlack[tid] = Math.max( 0, maxTeacherPeriods - demand );
    } );

    Object.entries( classDemand ).forEach( ( [cls, demand] ) => {
        const days = getStandardDayOrder( cls );
        const totalSlots = days.length * periodsPerDay;
        ctx.classSlack[cls] = Math.max( 0, totalSlots - demand );
    } );
}

/**
 * Phase 1/4 — Incremental Candidate Refresh
 * After assigning a slot, only re-compute candidates for tasks that share
 * the same teacher (tid) OR the same class (className) on the affected day.
 * This keeps the candidate lists accurate without full recomputation.
 */
function updateCandidatesAfterAssign( tid, className, dayName, periodNumber, tasks, ctx ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    const timetable = ctx.timetable;

    tasks.forEach( task => {
        if ( task.alreadyScheduled || task.periodsNeeded <= 0 ) return;
        const taskTid = toCleanString( task.teacherId );
        const sharesTeacher = ( taskTid === tid );
        const sharesClass = task.isClubbed
            ? ( task.clubbedClasses || [] ).includes( className )
            : task.className === className;

        if ( !sharesTeacher && !sharesClass ) return;

        // Rebuild only entries that involve the affected day/period
        if ( !task.candidates ) task.candidates = [];
        task.candidates = task.candidates.filter( c => {
            if ( c.dayName !== dayName ) return true;
            if ( !c.periodNumbers.includes( periodNumber ) ) return true;

            // Re-validate this specific slot
            if ( task.isClubbed && Array.isArray( task.clubbedClasses ) ) {
                for ( const cls of task.clubbedClasses ) {
                    const v = validateSlot( timetable, cls, dayName, c.periodNumbers, taskTid, maxTeacherPeriods );
                    if ( !v.valid ) return false;
                }
                return true;
            }
            const v = validateSlot( timetable, task.className, dayName, c.periodNumbers, taskTid, maxTeacherPeriods );
            return v.valid;
        } );
        ctx.taskCandidates.set( task, task.candidates );
    } );
}

/**
 * Phase 4 — Forward Checking
 * Before committing an assignment, check: would this assignment reduce
 * any other unfinished task's candidates to zero?
 * Returns true if safe to proceed, false if this slot should be skipped.
 */
function forwardCheck( tid, className, dayName, periodNumber, allMrvTasks ) {
    for ( const other of allMrvTasks ) {
        if ( other.alreadyScheduled || other.periodsNeeded <= 0 ) continue;
        const otherTid = toCleanString( other.teacherId );
        const sharesTeacher = ( otherTid === tid );
        const sharesClass = other.isClubbed
            ? ( other.clubbedClasses || [] ).includes( className )
            : other.className === className;

        if ( !sharesTeacher && !sharesClass ) continue;

        // How many current candidates would survive after this assignment?
        const surviving = ( other.candidates || [] ).filter( c => {
            if ( sharesTeacher && c.dayName === dayName && c.periodNumbers.includes( periodNumber ) ) return false;
            if ( sharesClass && !other.isClubbed && c.dayName === dayName && c.periodNumbers.includes( periodNumber ) ) return false;
            return true;
        } );

        // If this other task would have 0 candidates but still needs periods → reject
        if ( surviving.length === 0 && other.periodsNeeded > 0 ) {
            return false;
        }
    }
    return true;
}

/**
 * Phase 6 — Recursive Repair (depth-limited DFS)
 * When a task has no valid candidates, try to move one blocking assignment
 * away to open a slot. Recurse up to maxDepth levels.
 * Returns true if repair succeeded and the task was placed.
 */
function recursiveRepair( task, allMrvTasks, ctx, depth, maxDepth ) {
    if ( depth > maxDepth ) return false;
    const timetable = ctx.timetable;
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    const tid = toCleanString( task.teacherId );
    const schoolDays = getStandardDayOrder( task.className );
    const periodsPerDay = state.config.periodsPerDay || 7;

    for ( const dayName of schoolDays ) {
        for ( let p = 1; p <= periodsPerDay; p++ ) {
            // Find the period entry for this task's class
            const cell = getClassDayPeriod( timetable, task.className, dayName, p );
            if ( !cell || cell.isLocked ) continue;

            if ( isPeriodSlotEmpty( cell ) ) {
                // Slot is empty but teacher is busy — teacher conflict
                if ( !isTeacherBusy( tid, dayName, p ) ) continue; // already clean, would have been in candidates
                // Teacher is busy on this (day, period) for another class — try to find an alternate slot for that other class
                // Find which class has this teacher blocked
                let conflictClass = null;
                let conflictCell = null;
                for ( const cls of Object.keys( timetable ) ) {
                    if ( cls === task.className ) continue;
                    const c = getClassDayPeriod( timetable, cls, dayName, p );
                    if ( c && toCleanString( c.teacherId ) === tid && !isPeriodSlotEmpty( c ) ) {
                        if ( c.isLocked ) continue; // DO NOT evict locked slots!
                        conflictClass = cls;
                        conflictCell = c;
                        break;
                    }
                }
                if ( !conflictClass ) continue;

                // Save conflict slot state
                const savedSubject = conflictCell.subject;
                const savedTeacher = conflictCell.teacherName;
                const savedId = conflictCell.assignmentId;

                // Build a temporary displaced task to find an alternate home
                const displacedTask = {
                    className: conflictClass,
                    teacherId: tid,
                    teacherName: savedTeacher,
                    subject: savedSubject,
                    periodsNeeded: 1,
                    isClubbed: false, isLabSubject: false, hasFixedPeriods: false,
                    fixedPeriodGroups: [],
                    candidates: null,
                    _originalPeriods: (function() {
                        if (!conflictClass) return 1;
                        const t = allMrvTasks.find(x => x.className === conflictClass && toCleanString(x.subject) === toCleanString(savedSubject));
                        return t ? (t._originalPeriods || t.periodsNeeded) : 1;
                    })()
                };

                // Unassign conflicting slot
                unassignSlotWithTracking( timetable, conflictClass, dayName, [p], tid, savedSubject, savedId );

                // Re-check if task can now go into this slot
                const v = validateSlot( timetable, task.className, dayName, [p], tid, maxTeacherPeriods );
                if ( v.valid && !exceedsDailySubjectLimit( task.className, dayName, task.subject, 1, { isLabBlock: false, totalPeriodsNeeded: task._originalPeriods || task.periodsNeeded } ) ) {
                    // Find alternate home for displaced task
                    const altDays = getStandardDayOrder( conflictClass );
                    let displaced = false;
                    let altSlotAssigned = null;
                    for ( const altDay of altDays ) {
                        for ( let ap = 1; ap <= periodsPerDay; ap++ ) {
                            if ( altDay === dayName && ap === p ) continue;
                            const av = validateSlot( timetable, conflictClass, altDay, [ap], tid, maxTeacherPeriods );
                            if ( !av.valid ) continue;
                            if ( exceedsDailySubjectLimit( conflictClass, altDay, savedSubject, 1, { isLabBlock: false, totalPeriodsNeeded: displacedTask._originalPeriods || displacedTask.periodsNeeded } ) ) continue;
                            assignSlotWithTracking( timetable, conflictClass, altDay, [ap], tid, savedSubject, savedTeacher, savedId );
                            displaced = true;
                            altSlotAssigned = { day: altDay, period: ap };
                            break;
                        }
                        if ( displaced ) break;
                    }

                    if ( displaced ) {
                        // Place the original task
                        const ok = assignSlotWithTracking( timetable, task.className, dayName, [p], tid, task.subject, task.teacherName );
                        if ( ok ) {
                            updateCandidatesAfterAssign( tid, task.className, dayName, p, allMrvTasks, ctx );
                            return true;
                        } else {
                            // Rollback the displaced task assignment because the original task STILL couldn't fit!
                            unassignSlotWithTracking( timetable, conflictClass, altSlotAssigned.day, [altSlotAssigned.period], tid, savedSubject, savedId );
                            displaced = false;
                        }
                    }

                    // Repair of displaced failed — recurse deeper
                    if ( !displaced && depth < maxDepth ) {
                        displacedTask.candidates = null;
                        buildCandidateLists( [displacedTask], ctx );
                        const deeper = recursiveRepair( displacedTask, allMrvTasks, ctx, depth + 1, maxDepth );
                        if ( deeper ) {
                            const ok2 = assignSlotWithTracking( timetable, task.className, dayName, [p], tid, task.subject, task.teacherName );
                            if ( ok2 ) {
                                updateCandidatesAfterAssign( tid, task.className, dayName, p, allMrvTasks, ctx );
                                return true;
                            }
                        }
                    }
                }

                // Restore conflict slot (repair failed)
                assignSlotWithTracking( timetable, conflictClass, dayName, [p], tid, savedSubject, savedTeacher, savedId );

            } else {
                // Slot is occupied by someone else — teacher is free but class slot is full
                const occupantTid = toCleanString( cell.teacherId );
                if ( occupantTid === tid ) continue; // same teacher, different block — not a repairable conflict here
                const savedSubject = cell.subject;
                const savedName = cell.teacherName;
                const savedId = cell.assignmentId;
                
                const displacedTask2 = {
                    className: task.className,
                    teacherId: occupantTid,
                    teacherName: savedName,
                    subject: savedSubject,
                    periodsNeeded: 1,
                    isClubbed: false, isLabSubject: false, hasFixedPeriods: false,
                    fixedPeriodGroups: [], candidates: null,
                    _originalPeriods: (function() {
                        const t = allMrvTasks.find(x => x.className === task.className && toCleanString(x.subject) === toCleanString(savedSubject));
                        return t ? (t._originalPeriods || t.periodsNeeded) : 1;
                    })()
                };

                if ( !isTeacherBusy( tid, dayName, p ) ) {
                    // Teacher IS free but class slot is occupied — evict occupant
                    unassignSlotWithTracking( timetable, task.className, dayName, [p], occupantTid, savedSubject, savedId );

                    const v = validateSlot( timetable, task.className, dayName, [p], tid, maxTeacherPeriods );
                    if ( v.valid && !exceedsDailySubjectLimit( task.className, dayName, task.subject, 1, { isLabBlock: false, totalPeriodsNeeded: task._originalPeriods || task.periodsNeeded } ) ) {
                        // Find alternate home for evicted occupant
                        const altDays = getStandardDayOrder( task.className );
                        let evicted = false;
                        let altSlotAssigned = null;
                        for ( const altDay of altDays ) {
                            for ( let ap = 1; ap <= periodsPerDay; ap++ ) {
                                if ( altDay === dayName && ap === p ) continue;
                                const av = validateSlot( timetable, task.className, altDay, [ap], occupantTid, maxTeacherPeriods );
                                if ( !av.valid ) continue;
                                if ( exceedsDailySubjectLimit( task.className, altDay, savedSubject, 1, { isLabBlock: false, totalPeriodsNeeded: displacedTask2._originalPeriods || displacedTask2.periodsNeeded } ) ) continue;
                                assignSlotWithTracking( timetable, task.className, altDay, [ap], occupantTid, savedSubject, savedName, savedId );
                                evicted = true;
                                altSlotAssigned = { day: altDay, period: ap };
                                break;
                            }
                            if ( evicted ) break;
                        }

                        if ( evicted ) {
                            const ok = assignSlotWithTracking( timetable, task.className, dayName, [p], tid, task.subject, task.teacherName );
                            if ( ok ) {
                                updateCandidatesAfterAssign( tid, task.className, dayName, p, allMrvTasks, ctx );
                                return true;
                            } else {
                                // Rollback the displaced task assignment because the original task STILL couldn't fit!
                                unassignSlotWithTracking( timetable, task.className, altSlotAssigned.day, [altSlotAssigned.period], occupantTid, savedSubject, savedId );
                                evicted = false;
                            }
                        }

                        if ( !evicted && depth < maxDepth ) {
                            displacedTask2.candidates = null;
                            buildCandidateLists( [displacedTask2], ctx );
                            evicted = recursiveRepair( displacedTask2, allMrvTasks, ctx, depth + 1, maxDepth );
                            if ( evicted ) {
                                const ok2 = assignSlotWithTracking( timetable, task.className, dayName, [p], tid, task.subject, task.teacherName );
                                if ( ok2 ) {
                                    updateCandidatesAfterAssign( tid, task.className, dayName, p, allMrvTasks, ctx );
                                    return true;
                                }
                            }
                        }
                    }
                    // Restore evicted slot
                    assignSlotWithTracking( timetable, task.className, dayName, [p], occupantTid, savedSubject, savedName, savedId );
                }
            }
        }
    }
    return false;
}

/**
 * Phase 2 — MRV Scheduler Main Loop
 * Schedules all normal + combined tasks using:
 *   1. Dynamic MRV ordering (fewest candidates first)
 *   2. Forward checking before each assignment
 *   3. Candidate list update after each assignment
 *   4. Recursive repair when no candidates remain
 *
 * Fixed/CSL/Lab tasks must already be scheduled before calling this.
 */
function runMRVScheduler( tasks, ctx, unscheduled ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    const timetable = ctx.timetable;
    const REPAIR_DEPTH = 3;

    // Filter to only tasks this scheduler handles (normal + combined, not fixed/lab/csl)
    const mrvTasks = tasks.filter( t =>
        !t.alreadyScheduled &&
        t.taskType !== 'fixed-csl' &&
        t.taskType !== 'lab' &&
        t.taskType !== 'fixed' &&
        t.taskType !== 'fixed-combined'
    );

    // Phase 1: Build initial candidate lists
    buildCandidateLists( mrvTasks, ctx );

    // Phase 5: Compute slack
    computeSlack( mrvTasks, ctx );

    const mrvStats = {
        total: mrvTasks.reduce((s, t) => s + (t._originalPeriods || t.periodsNeeded || 0), 0),
        directly: 0,
        bySwap: 0,
        failed: 0,
        reasons: {}
    };

    let maxIterations = mrvTasks.reduce( ( s, t ) => s + ( t.periodsNeeded || 0 ), 0 ) * 3;
    let iterations = 0;

    while ( iterations++ < maxIterations ) {
        // Find tasks still needing periods
        const pending = mrvTasks.filter( t => ( t.periodsNeeded || 0 ) > 0 && !t.alreadyScheduled );
        if ( pending.length === 0 ) break;

        // MRV sort: fewest candidates first, with slack as tiebreaker
        pending.sort( ( a, b ) => {
            const aCandCount = ( a.candidates || [] ).length;
            const bCandCount = ( b.candidates || [] ).length;
            if ( aCandCount !== bCandCount ) return aCandCount - bCandCount;
            // Tiebreak: lab/combined/fixed bonus, then teacher slack (tight teacher first)
            return taskDifficultyScore( b ) - taskDifficultyScore( a );
        } );

        const task = pending[0];
        const tid = toCleanString( task.teacherId );
        let placed = false;

        // Score all candidates and try in order (Phase 3)
        const scoredCandidates = ( task.candidates || [] )
            .map( c => ( {
                ...c,
                score: scoreCandidateSlot( timetable, task, c.dayName, c.periodNumbers, {
                    preferFixedPeriods: false,
                    isLabBlock: task.isLabSubject,
                    teacherSlack: ctx.teacherSlack[tid] || 0,
                    classSlack: ctx.classSlack[task.className] || 0
                } )
            } ) )
            .sort( ( a, b ) => b.score - a.score );

        for ( const candidate of scoredCandidates ) {
            const { dayName, periodNumbers } = candidate;

            // Phase 4: Forward check
            const safe = forwardCheck( tid, task.className, dayName, periodNumbers[0], mrvTasks );
            if ( !safe ) continue;

            // Validate once more (state may have changed since candidate was built)
            let vOk = true;
            if ( task.isClubbed && task.clubbedClasses ) {
                for ( const cls of task.clubbedClasses ) {
                    const v = validateSlot( timetable, cls, dayName, periodNumbers, tid, maxTeacherPeriods );
                    if ( !v.valid ) { vOk = false; break; }
                }
            } else {
                const v = validateSlot( timetable, task.className, dayName, periodNumbers, tid, maxTeacherPeriods );
                if ( !v.valid ) vOk = false;
            }
            if ( !vOk ) continue;
            
            if ( exceedsDailySubjectLimit( task.className, dayName, task.subject, 1, { isLabBlock: task.isLabSubject, totalPeriodsNeeded: task._originalPeriods || task.periodsNeeded } ) ) continue;

            // Check locked/break cells for combined tasks
            if ( task.isClubbed && task.clubbedClasses ) {
                const blockHasLocked = periodNumbers.some( pn =>
                    ( task.clubbedClasses || [] ).some( cls => {
                        const pe = getClassDayPeriod( timetable, cls, dayName, pn );
                        return pe && pe.isLocked;
                    } )
                );
                if ( blockHasLocked ) continue;

                const assignmentId = `mrv-c-${tid}-${dayName}-${periodNumbers[0]}`;
                let allOk = true;
                let classNamesAssigned = [];
                for ( const cls of task.clubbedClasses ) {
                    const ok = assignSlotWithTracking( timetable, cls, dayName, periodNumbers, tid, task.subject, task.teacherName, assignmentId );
                    if ( !ok ) { 
                        allOk = false; 
                        // ROLLBACK partial assignments!
                        for ( const rollbackCls of classNamesAssigned ) {
                            unassignSlotWithTracking( timetable, rollbackCls, dayName, periodNumbers, tid, task.subject, assignmentId );
                        }
                        break; 
                    }
                    classNamesAssigned.push(cls);
                }
                if ( allOk ) {
                    // Lock clubbed tasks to prevent recursiveRepair from splitting them and causing tracker drift!
                    for ( const cls of task.clubbedClasses ) {
                        periodNumbers.forEach( pn => {
                            const pe = getClassDayPeriod( timetable, cls, dayName, pn );
                            if ( pe ) pe.isLocked = true;
                        });
                    }
                    task.periodsNeeded -= 1;
                    if ( task.periodsNeeded <= 0 ) task.alreadyScheduled = true;
                    updateCandidatesAfterAssign( tid, task.className, dayName, periodNumbers[0], mrvTasks, ctx );
                    placed = true;
                    mrvStats.directly++;
                    break;
                }
            } else {
                const ok = assignSlotWithTracking( timetable, task.className, dayName, periodNumbers, tid, task.subject, task.teacherName );
                if ( ok ) {
                    task.periodsNeeded -= 1;
                    if ( task.periodsNeeded <= 0 ) task.alreadyScheduled = true;
                    updateCandidatesAfterAssign( tid, task.className, dayName, periodNumbers[0], mrvTasks, ctx );
                    placed = true;
                    mrvStats.directly++;
                    break;
                }
            }
        }

        if ( !placed ) {
            // Phase 6: Recursive repair
            const repaired = recursiveRepair( task, mrvTasks, ctx, 0, REPAIR_DEPTH );
            if ( repaired ) {
                task.periodsNeeded -= 1;
                mrvStats.bySwap++;
                if ( task.periodsNeeded <= 0 ) task.alreadyScheduled = true;
            } else {
                // Phase 7: Structured diagnostics
                const blockedSlots = [];
                const reasonCounts = {};
                const schoolDays = getStandardDayOrder( task.className );
                const periodsPerDay = state.config.periodsPerDay || 7;
                const attemptNum = ( task._originalPeriods || task.periodsNeeded ) - task.periodsNeeded + 1;
                console.warn(`\n--- MRV SCHEDULING FAILURE DIAGNOSTICS ---`);
                console.warn(`Teacher: ${tid} (${task.teacherName})`);
                console.warn(`Subject: ${task.subject}`);
                console.warn(`Class: ${task.isClubbed ? ( task.clubbedClasses || [] ).join( ';' ) : task.className}`);
                console.warn(`Attempt #${attemptNum}`);
                console.warn(`\nRejected:`);

                schoolDays.forEach( dayName => {
                    for ( let p = 1; p <= periodsPerDay; p++ ) {
                        const v = validateSlot( timetable, task.className, dayName, [p], tid, maxTeacherPeriods );
                        let reason = "";
                        if ( !v.valid ) {
                            reason = v.reason;
                        } else if ( exceedsDailySubjectLimit( task.className, dayName, task.subject, 1, { isLabBlock: task.isLabSubject, totalPeriodsNeeded: task._originalPeriods || task.periodsNeeded } ) ) {
                            reason = "Subject spread limit reached";
                        } else {
                            reason = "Locked or blocked by forward-checking";
                        }
                        blockedSlots.push( `${dayName}-P${p}: ${reason}` );
                        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
                        console.warn(`${dayName} P${p} -> ${reason}`);
                    }
                } );
                console.warn(`\nCandidates left = 0`);
                console.warn(`------------------------------------------\n`);

                unscheduled.push( {
                    className: task.isClubbed ? ( task.clubbedClasses || [] ).join( ';' ) : task.className,
                    teacherId: tid,
                    teacherName: task.teacherName,
                    subject: task.subject,
                    periodsNeeded: task.periodsNeeded,
                    periodsScheduled: ( task._originalPeriods || task.periodsNeeded ) - task.periodsNeeded,
                    periodsUnscheduled: task.periodsNeeded,
                    reason: 'No valid candidate slots after MRV + forward checking + repair',
                    candidateCount: ( task.candidates || [] ).length,
                    blockedSlots: blockedSlots.slice( 0, 10 ),
                    diagnostics: blockedSlots.slice( 0, 10 )
                } );
                task.alreadyScheduled = true; // prevent infinite loop
                mrvStats.failed++;

                let dominantReason = "No candidates";
                let maxC = 0;
                Object.entries(reasonCounts).forEach(([r, c]) => {
                    if (c > maxC) { maxC = c; dominantReason = r; }
                });
                
                if (dominantReason.includes("Teacher busy")) dominantReason = "Teacher busy";
                else if (dominantReason.includes("Locked")) dominantReason = "Locked slot";
                else if (dominantReason.includes("occupied")) dominantReason = "Class slot occupied";
                
                mrvStats.reasons[dominantReason] = (mrvStats.reasons[dominantReason] || 0) + 1;
            }
        }
    }

    console.log(`\nTasks total: ${mrvStats.total}`);
    console.log(`Scheduled directly: ${mrvStats.directly}`);
    console.log(`Scheduled by swap: ${mrvStats.bySwap}`);
    console.log(`Failed: ${mrvStats.failed}`);
    if (mrvStats.failed > 0) {
        console.log(`Reason:`);
        Object.entries(mrvStats.reasons).forEach(([reason, count]) => {
            console.log(`${reason}: ${count}`);
        });
    }
    console.log(`\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// END MRV ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function findBestClubbedCandidateSlot( timetable, task, maxTeacherPeriods, labBlockList ) {
    const candidates = [];
    const schoolDays = getStandardDayOrder( task.className );
    const slotPatterns = [];

    if ( labBlockList && labBlockList.length > 0 ) {
        schoolDays.forEach( dayName => {
            labBlockList.forEach( block => slotPatterns.push( { dayName, periodNumbers: block } ) );
        } );
    } else {
        const periodsPerDay = state.config.periodsPerDay || 7;
        schoolDays.forEach( dayName => {
            for ( let periodNumber = 1; periodNumber <= periodsPerDay; periodNumber++ ) {
                slotPatterns.push( { dayName, periodNumbers: [periodNumber] } );
            }
        } );
    }

    slotPatterns.forEach( ( { dayName, periodNumbers: nums } ) => {
        const tid = toCleanString( task.teacherId );
        let valid = true;

        if ( getTeacherLoad( tid ) + nums.length > maxTeacherPeriods ) {
            valid = false;
        }

        if ( valid ) {
            for ( const periodNumber of nums ) {
                if ( isTeacherBusy( tid, dayName, periodNumber ) ) {
                    valid = false;
                    break;
                }
            }
        }

        if ( valid ) {
            for ( const className of task.clubbedClasses ) {
                const classData = timetable[className];
                if ( !classData || !Array.isArray( classData.days ) ) {
                    valid = false;
                    break;
                }

                for ( const periodNumber of nums ) {
                    const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
                    if ( !periodEntry || periodEntry.isLocked || !isPeriodSlotEmpty( periodEntry ) ) {
                        valid = false;
                        break;
                    }
                }
                if ( !valid ) break;

                if ( exceedsDailySubjectLimit(
                    className,
                    dayName,
                    task.subject,
                    nums.length,
                    { isLabBlock: true }
                ) ) {
                    valid = false;
                    break;
                }
            }
        }

        if ( valid ) {
            let totalScore = 0;
            task.clubbedClasses.forEach( className => {
                const tempTask = { ...task, className };
                totalScore += scoreCandidateSlot( timetable, tempTask, dayName, nums, { isLabBlock: true } );
            } );

            candidates.push( {
                dayName,
                periodNumbers: nums,
                score: totalScore
            } );
        }
    } );

    if ( candidates.length === 0 ) return null;
    candidates.sort( ( a, b ) => b.score - a.score );
    return candidates[0];
}

const CSL_FIXED_SCHEDULE = {
    'PRA|Class-IV-A;Class-IV-B': [
        { day: 'Monday', periods: [1, 2] },
        { day: 'Tuesday', periods: [6, 7] }
    ],
    'SMR|Class-V-A;Class-V-B': [
        { day: 'Tuesday', periods: [1, 2] },
        { day: 'Wednesday', periods: [6, 7] }
    ],
    'SMR|Class-VI-A;Class-VI-B': [
        { day: 'Wednesday', periods: [1, 2] },
        { day: 'Thursday', periods: [6, 7] }
    ],
    'SMR|Class-VII-A': [
        { day: 'Thursday', periods: [1, 2] },
        { day: 'Friday', periods: [6, 7] }
    ],
    'SMR|Class-VIII-A': [
        { day: 'Friday', periods: [1, 2] }
    ],
    'SMR|Class-IX-A': [
        { day: 'Monday', periods: [6, 7] }
    ],
    'SMR|Class-X-A': [
        { day: 'Saturday', periods: [1, 2] }
    ]
};

function scheduleFixedCslLabs( timetable, cslTasks, unscheduled ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;

    Object.entries( CSL_FIXED_SCHEDULE ).forEach( ( [key, slots] ) => {
        const [teacherPrefix, classStr] = key.split( '|' );
        const classNamesRaw = classStr.split( ';' );
        const classNames = classNamesRaw.map( c => mappingGradeSectionToClassName( c ) );

        const ruleClassNamesSorted = [...classNames].sort().join( ';' );

        const matchingTasks = cslTasks.filter( t => {
            if ( t.alreadyScheduled ) return false;
            return t.fixedScheduleKey === key;
        } );

        if ( matchingTasks.length === 0 ) return;

        // Mark ALL matching tasks as already scheduled so they are totally excluded from later fallback phases
        matchingTasks.forEach( t => t.alreadyScheduled = true );

        // Verify the canonical class set against the rule before assignment
        const allClassesMatch = matchingTasks.every( t => {
            const taskClassNamesSorted = [...( t.classNames || [t.className] )].sort().join( ';' );
            return taskClassNamesSorted === ruleClassNamesSorted;
        } );

        if ( !allClassesMatch ) {
            console.error( `CSL canonical class mismatch for key ${key}. Task classes do not match rule classes. Skipping fixed assignment.` );

            const matchingTask = matchingTasks[0];
            unscheduled.push( {
                className: classNamesRaw.join( ';' ),
                teacherId: matchingTask.teacherId,
                teacherName: matchingTask.teacherName,
                subject: matchingTask.subject,
                periodsNeeded: slots.length * 2,
                periodsScheduled: 0,
                periodsUnscheduled: slots.length * 2,
                reason: 'CSL canonical class mismatch (stale key binding)',
                isFixedSlotTask: true
            } );
            return;
        }

        const matchingTask = matchingTasks[0];
        const teacherId = matchingTask.teacherId;
        const teacherName = matchingTask.teacherName;
        const subject = matchingTask.subject;

        let successCount = 0;
        slots.forEach( slotInfo => {
            const dayName = slotInfo.day;
            const periodNumbers = slotInfo.periods;

            let allFree = true;
            for ( const cls of classNames ) {
                const validation = validateSlot( timetable, cls, dayName, periodNumbers, teacherId, maxTeacherPeriods );
                if ( !validation.valid ) {
                    allFree = false;
                    break;
                }
            }

            if ( allFree ) {
                const assignmentId = `csl-${key}-${successCount}`;
                let blockSuccess = true;

                classNames.forEach( ( cls, idx ) => {
                    if ( !blockSuccess ) return;
                    const success = assignSlotWithTracking( timetable, cls, dayName, periodNumbers, teacherId, subject, teacherName, assignmentId );
                    if ( !success ) {
                        blockSuccess = false;
                        for ( let i = 0; i < idx; i++ ) {
                            unassignSlotWithTracking( timetable, classNames[i], dayName, periodNumbers, teacherId, subject, assignmentId );
                        }
                    }
                } );

                if ( blockSuccess ) {
                    classNames.forEach( ( cls ) => {
                        periodNumbers.forEach( p => {
                            const cell = getClassDayPeriod( timetable, cls, dayName, p );
                            if ( cell ) cell.isLocked = true;
                        } );
                    } );
                    successCount++;
                }
            }
        } );

        if ( successCount < slots.length ) {
            unscheduled.push( {
                className: classNamesRaw.join( ';' ),
                teacherId: teacherId,
                teacherName: teacherName,
                subject: subject,
                periodsNeeded: slots.length * 2,
                periodsScheduled: successCount * 2,
                periodsUnscheduled: ( slots.length - successCount ) * 2,
                reason: 'Fixed combined CSL conflict',
                isFixedSlotTask: true
            } );
        }
    } );
}

function scheduleLabBlock( timetable, task, unscheduled ) {
    if ( task.alreadyScheduled ) return;
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    let remaining = task.periodsNeeded;

    const preferredBlocks = getLabBlocks();

    for ( const block of preferredBlocks ) {
        if ( remaining < 2 ) break;

        let best = null;

        if ( task.isClubbed ) {
            best = findBestClubbedCandidateSlot( timetable, task, maxTeacherPeriods, [block] );
        } else {
            best = findBestCandidateSlot(
                timetable,
                task,
                null,
                { isLabBlock: true, preferFixedPeriods: true },
                maxTeacherPeriods,
                [block]
            );
        }

        if ( !best ) continue;

        if ( task.isClubbed ) {
            const blockHasLockedSlot = best.periodNumbers.some( periodNumber =>
                task.clubbedClasses.some( className => {
                    const period = getClassDayPeriod( timetable, className, best.dayName, periodNumber );
                    return period && period.isLocked;
                } )
            );

            if ( blockHasLockedSlot ) continue;

            const assignmentId = `lab-${task.mappingIndex}-${best.dayName}`;
            let blockSuccess = true;
            task.clubbedClasses.forEach( ( className, idx ) => {
                if ( !blockSuccess ) return;
                const success = assignSlotWithTracking(
                    timetable,
                    className,
                    best.dayName,
                    best.periodNumbers,
                    task.teacherId,
                    'CSL',
                    task.teacherName,
                    assignmentId
                );
                if ( !success ) {
                    blockSuccess = false;
                    for ( let i = 0; i < idx; i++ ) {
                        unassignSlotWithTracking( timetable, task.clubbedClasses[i], best.dayName, best.periodNumbers, task.teacherId, 'CSL', assignmentId );
                    }
                }
            } );

            if ( blockSuccess ) {
                best.periodNumbers.forEach( periodNumber => {
                    task.clubbedClasses.forEach( className => {
                        const p = getClassDayPeriod( timetable, className, best.dayName, periodNumber );
                        if ( p ) p.isLocked = true;
                    } );
                } );
                remaining -= best.periodNumbers.length;
            }
        } else {
            const blockHasLockedSlot = best.periodNumbers.some( periodNumber => {
                const period = getClassDayPeriod( timetable, task.className, best.dayName, periodNumber );
                return period && period.isLocked;
            } );

            if ( blockHasLockedSlot ) continue;

            const success = assignSlotWithTracking(
                timetable,
                task.className,
                best.dayName,
                best.periodNumbers,
                task.teacherId,
                'CSL',
                task.teacherName
            );

            if ( success ) {
                best.periodNumbers.forEach( periodNumber => {
                    const p = getClassDayPeriod( timetable, task.className, best.dayName, periodNumber );
                    if ( p ) p.isLocked = true;
                } );
                remaining -= best.periodNumbers.length;
            }
        }
    }

    while ( remaining >= 2 ) {
        let best = null;

        if ( task.isClubbed ) {
            best = findBestClubbedCandidateSlot( timetable, task, maxTeacherPeriods, getLabBlocks() );
        } else {
            best = findBestCandidateSlot(
                timetable,
                task,
                null,
                { isLabBlock: true },
                maxTeacherPeriods,
                getLabBlocks()
            );
        }

        if ( !best ) break;

        if ( task.isClubbed ) {
            const assignmentId = `lab-${task.mappingIndex}-${best.dayName}`;
            let blockSuccess = true;
            task.clubbedClasses.forEach( ( className, idx ) => {
                if ( !blockSuccess ) return;
                const success = assignSlotWithTracking(
                    timetable,
                    className,
                    best.dayName,
                    best.periodNumbers,
                    task.teacherId,
                    'CSL',
                    task.teacherName,
                    assignmentId
                );
                if ( !success ) {
                    blockSuccess = false;
                    for ( let i = 0; i < idx; i++ ) {
                        unassignSlotWithTracking( timetable, task.clubbedClasses[i], best.dayName, best.periodNumbers, task.teacherId, 'CSL', assignmentId );
                    }
                }
            } );
            if ( blockSuccess ) {
                best.periodNumbers.forEach( periodNumber => {
                    task.clubbedClasses.forEach( className => {
                        const p = getClassDayPeriod( timetable, className, best.dayName, periodNumber );
                        if ( p ) p.isLocked = true;
                    } );
                } );
                remaining -= 2;
            }
        } else {
            const success = assignSlotWithTracking(
                timetable,
                task.className,
                best.dayName,
                best.periodNumbers,
                task.teacherId,
                'CSL',
                task.teacherName
            );
            if ( success ) {
                best.periodNumbers.forEach( periodNumber => {
                    const p = getClassDayPeriod( timetable, task.className, best.dayName, periodNumber );
                    if ( p ) p.isLocked = true;
                } );
                remaining -= 2;
            }
        }
    }

    if ( remaining > 0 ) {
        unscheduled.push( {
            className: task.isClubbed ? task.clubbedClasses.join( ';' ) : task.className,
            teacherId: task.teacherId,
            teacherName: task.teacherName,
            subject: 'CSL',
            periodsNeeded: task.periodsNeeded,
            periodsScheduled: task.periodsNeeded - remaining,
            periodsUnscheduled: remaining,
            reason: 'CSL lab block could not be fully scheduled due to conflicts or missing slots'
        } );
    }
}

function scheduleClassTeacherP1AfterLabs( timetable, tasks, unscheduled ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    tasks.forEach( task => {
        const schoolDays = getStandardDayOrder( task.className );
        if ( task.alreadyScheduled ) return;
        if ( !isClassTeacherP1Task( task ) ) return;
        if ( task.isClubbed ) return;

        let remaining = task.periodsNeeded;

        schoolDays.forEach( dayName => {
            if ( remaining <= 0 ) return;

            if ( !canPlaceClassTeacherP1( timetable, task.className, dayName, task.teacherId, maxTeacherPeriods ) ) {
                return;
            }

            assignSlotWithTracking(
                timetable,
                task.className,
                dayName,
                [1],
                task.teacherId,
                task.subject,
                task.teacherName
            );

            const p1 = getClassDayPeriod( timetable, task.className, dayName, 1 );
            if ( p1 ) p1.isLocked = true;

            remaining -= 1;
        } );

        if ( remaining > 0 ) {
            unscheduled.push( {
                className: task.className,
                teacherId: task.teacherId,
                teacherName: task.teacherName,
                subject: task.subject,
                periodsNeeded: task.periodsNeeded,
                periodsScheduled: task.periodsNeeded - remaining,
                periodsUnscheduled: remaining,
                reason: 'Class teacher P1 could not be placed on all non-lab days'
            } );
        }
    } );
}

/** Schedule all fixed-period mappings first (class-teacher P1 slots, etc.). */
function scheduleFixedTasks( timetable, tasks, deferredTasks, unscheduled ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    tasks.forEach( task => {
        const schoolDays = getStandardDayOrder( task.className );
        if ( task.alreadyScheduled ) return;
        console.log( 'Scheduling fixed task', task );

        if ( !task.hasFixedPeriods ) {
            deferredTasks.push( task );
            return;
        }

        if ( isClassTeacherP1Task( task ) ) {
            deferredTasks.push( task );
            return;
        }

        let remaining = task.periodsNeeded;
        let groupOffset = 0;
        const uniqueGroups = getUniqueFixedGroups( task );

        while ( remaining > 0 ) {
            let assignedThisRound = false;

            for ( let i = 0; i < uniqueGroups.length; i++ ) {
                const periodNumbers = uniqueGroups[( i + groupOffset ) % uniqueGroups.length];
                if ( periodNumbers.length === 1 ) {
                    const periodNumber = periodNumbers[0];

                    for ( const dayName of schoolDays ) {
                        if ( remaining <= 0 ) break;

                        const periodEntry = getClassDayPeriod( timetable, task.className, dayName, periodNumber );
                        if ( !periodEntry || periodEntry.isLocked || !isPeriodSlotEmpty( periodEntry ) ) continue;

                        const validation = validateSlot(
                            timetable,
                            task.className,
                            dayName,
                            [periodNumber],
                            task.teacherId,
                            maxTeacherPeriods
                        );

                        if ( !validation.valid ) continue;

                        const success = assignSlotWithTracking(
                            timetable,
                            task.className,
                            dayName,
                            [periodNumber],
                            task.teacherId,
                            task.subject,
                            task.teacherName
                        );

                        if ( success ) {
                            periodEntry.isLocked = true;
                            remaining -= 1;
                            assignedThisRound = true;
                        }
                    }
                } else {
                    const best = findBestCandidateSlot(
                        timetable,
                        task,
                        periodNumbers,
                        { preferFixedPeriods: true, isLabBlock: periodNumbers.length > 1 },
                        maxTeacherPeriods
                    );

                    if ( !best ) continue;

                    const success = assignSlotWithTracking(
                        timetable,
                        task.className,
                        best.dayName,
                        best.periodNumbers,
                        task.teacherId,
                        task.subject,
                        task.teacherName
                    );

                    if ( success ) {
                        best.periodNumbers.forEach( periodNumber => {
                            const periodEntry = getClassDayPeriod( timetable, task.className, best.dayName, periodNumber );
                            if ( periodEntry ) periodEntry.isLocked = true;
                        } );

                        remaining -= best.periodNumbers.length;
                        assignedThisRound = true;
                    }
                }

                if ( assignedThisRound ) {
                    groupOffset = ( groupOffset + i + 1 ) % uniqueGroups.length;
                    break;
                }
            }

            if ( !assignedThisRound ) break;
        }

        if ( remaining > 0 ) {
            unscheduled.push( {
                className: task.className,
                teacherId: task.teacherId,
                teacherName: task.teacherName,
                subject: task.subject,
                periodsNeeded: task.periodsNeeded,
                periodsScheduled: task.periodsNeeded - remaining,
                periodsUnscheduled: remaining,
                reason: 'Fixed period constraint could not be fully satisfied'
            } );
        }
    } );
}

/** Schedule fixed-period tasks that are also combined classes. */
function scheduleFixedCombinedTasks( timetable, tasks, deferredTasks, unscheduled ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    tasks.forEach( task => {
        const schoolDays = getStandardDayOrder( task.className );
        if ( task.alreadyScheduled ) return;
        console.log( "Scheduling fixed combined task:", task );

        if ( !task.hasFixedPeriods || !task.isClubbed ) {
            deferredTasks.push( task );
            return;
        }

        let remaining = task.periodsNeeded;

        while ( remaining > 0 ) {
            let assignedThisRound = false;

            for ( const periodNumbers of task.fixedPeriodGroups ) {
                if ( periodNumbers.length === 1 && periodNumbers[0] === 1 ) {
                    for ( const dayName of schoolDays ) {
                        if ( remaining <= 0 ) break;

                        const allAvailable = task.clubbedClasses.every( className => {
                            const periodEntry = getClassDayPeriod( timetable, className, dayName, 1 );
                            return periodEntry && !periodEntry.isLocked && isPeriodSlotEmpty( periodEntry );
                        } );

                        if ( !allAvailable ) continue;

                        if ( !canAssignFixedP1Slot( timetable, task.clubbedClasses[0], dayName, 1, task.teacherId, maxTeacherPeriods ) ) {
                            continue;
                        }

                        const assignmentId = `fc-${task.mappingIndex}-${dayName}-P1`;
                        let blockSuccess = true;
                        task.clubbedClasses.forEach( ( className, idx ) => {
                            if ( !blockSuccess ) return;
                            const success = assignSlotWithTracking( timetable, className, dayName, [1], task.teacherId, task.subject, task.teacherName, assignmentId );
                            if ( !success ) {
                                blockSuccess = false;
                                for ( let i = 0; i < idx; i++ ) {
                                    unassignSlotWithTracking( timetable, task.clubbedClasses[i], dayName, [1], task.teacherId, task.subject, assignmentId );
                                }
                            }
                        } );

                        if ( blockSuccess ) {
                            task.clubbedClasses.forEach( className => {
                                const periodEntry = getClassDayPeriod( timetable, className, dayName, 1 );
                                if ( periodEntry ) periodEntry.isLocked = true;
                            } );
                            console.log( "Fixed combined period assigned", task.clubbedClasses, dayName, "P1", task.subject );
                            remaining -= 1;
                            assignedThisRound = true;
                        }
                    }
                } else if ( periodNumbers.length === 1 ) {
                    const periodNumber = periodNumbers[0];
                    for ( const dayName of schoolDays ) {
                        if ( remaining <= 0 ) break;

                        const allAvailable = task.clubbedClasses.every( className => {
                            const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
                            return periodEntry && !periodEntry.isLocked && isPeriodSlotEmpty( periodEntry );
                        } );

                        if ( !allAvailable ) continue;

                        const validation = validateSlot( timetable, task.clubbedClasses[0], dayName, [periodNumber], task.teacherId, maxTeacherPeriods );
                        if ( !validation.valid ) continue;

                        const assignmentId = `fc-${task.mappingIndex}-${dayName}-P${periodNumber}`;
                        let blockSuccess = true;
                        task.clubbedClasses.forEach( ( className, idx ) => {
                            if ( !blockSuccess ) return;
                            const success = assignSlotWithTracking( timetable, className, dayName, [periodNumber], task.teacherId, task.subject, task.teacherName, assignmentId );
                            if ( !success ) {
                                blockSuccess = false;
                                for ( let i = 0; i < idx; i++ ) {
                                    unassignSlotWithTracking( timetable, task.clubbedClasses[i], dayName, [periodNumber], task.teacherId, task.subject, assignmentId );
                                }
                            }
                        } );

                        if ( blockSuccess ) {
                            task.clubbedClasses.forEach( className => {
                                const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
                                if ( periodEntry ) periodEntry.isLocked = true;
                            } );
                            console.log( "Fixed combined period assigned", task.clubbedClasses, dayName, `P${periodNumber}`, task.subject );
                            remaining -= 1;
                            assignedThisRound = true;
                        }
                    }
                } else {
                    const best = findBestClubbedCandidateSlot(
                        timetable,
                        task,
                        maxTeacherPeriods,
                        [periodNumbers]
                    );

                    if ( !best ) continue;

                    const assignmentId = `fc-${task.mappingIndex}-${best.dayName}`;
                    let blockSuccess = true;
                    task.clubbedClasses.forEach( ( className, idx ) => {
                        if ( !blockSuccess ) return;
                        const success = assignSlotWithTracking( timetable, className, best.dayName, best.periodNumbers, task.teacherId, task.subject, task.teacherName, assignmentId );
                        if ( !success ) {
                            blockSuccess = false;
                            for ( let i = 0; i < idx; i++ ) {
                                unassignSlotWithTracking( timetable, task.clubbedClasses[i], best.dayName, best.periodNumbers, task.teacherId, task.subject, assignmentId );
                            }
                        }
                    } );

                    if ( blockSuccess ) {
                        task.clubbedClasses.forEach( className => {
                            best.periodNumbers.forEach( periodNumber => {
                                const periodEntry = getClassDayPeriod( timetable, className, best.dayName, periodNumber );
                                if ( periodEntry ) periodEntry.isLocked = true;
                            } );
                        } );
                        console.log( "Fixed combined period assigned", task.clubbedClasses, best.dayName, best.periodNumbers.map( n => `P${n}` ).join( '-' ), task.subject );
                        remaining -= best.periodNumbers.length;
                        assignedThisRound = true;
                    }
                }

                if ( assignedThisRound ) break;
            }

            if ( !assignedThisRound ) {
                console.warn( "Failed fixed combined scheduling", task );
                break;
            }
        }

        if ( remaining > 0 ) {
            if ( taskRequiresFixedPeriodOne( task ) ) {
                console.warn( "Fixed combined class teacher period failed", task );
            } else {
                console.warn( "Failed fixed combined scheduling", task );
            }
            unscheduled.push( {
                className: task.clubbedClasses.join( ';' ),
                teacherId: task.teacherId,
                teacherName: task.teacherName,
                subject: task.subject,
                periodsNeeded: task.periodsNeeded,
                periodsScheduled: task.periodsNeeded - remaining,
                periodsUnscheduled: remaining,
                reason: 'Fixed combined period constraint could not be fully satisfied'
            } );
        }
    } );
}

function scheduleCombinedTask( timetable, task, unscheduled ) {
    if ( task.alreadyScheduled ) return;
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    let remaining = task.periodsNeeded;

    while ( remaining > 0 ) {
        let best = findBestClubbedCandidateSlot(
            timetable,
            task,
            maxTeacherPeriods,
            [] // empty list generates 1-period slots
        );

        if ( !best ) break;

        const blockHasLockedSlot = best.periodNumbers.some( periodNumber => {
            return task.clubbedClasses.some( className => {
                const period = getClassDayPeriod( timetable, className, best.dayName, periodNumber );
                return period && period.isLocked;
            } );
        } );
        if ( blockHasLockedSlot ) continue;

        const assignmentId = `c-${task.mappingIndex}-${remaining}`;
        task.clubbedClasses.forEach( ( className, idx ) => {
            assignSlotWithTracking(
                timetable,
                className,
                best.dayName,
                best.periodNumbers,
                task.teacherId,
                task.subject,
                task.teacherName,
                assignmentId
            );
        } );

        remaining -= best.periodNumbers.length;
    }

    if ( remaining > 0 ) {
        unscheduled.push( {
            className: task.isClubbed ? task.clubbedClasses.join( ';' ) : task.className,
            subject: task.subject,
            teacherId: task.teacherId,
            periodsUnscheduled: remaining
        } );
    }
}

/** Score-based scheduling for regular (non-lab) subjects. */
function scheduleNormalTask( timetable, task, unscheduled ) {
    if ( task.alreadyScheduled ) return;
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    let remaining = task.periodsNeeded;

    while ( remaining > 0 ) {
        const best = findBestCandidateSlot(
            timetable,
            task,
            null,
            {},
            maxTeacherPeriods,
            null,
            true
        );

        if ( !best ) {
            const attemptNum = task.periodsNeeded - remaining + 1;
            console.warn(`\n--- SCHEDULING FAILURE DIAGNOSTICS ---`);
            console.warn(`Teacher: ${task.teacherId} (${task.teacherName})`);
            console.warn(`Subject: ${task.subject}`);
            console.warn(`Class: ${task.className}`);
            console.warn(`Attempt #${attemptNum}`);
            console.warn(`\nRejected:`);
            
            const schoolDays = getStandardDayOrder(task.className);
            const periodsPerDay = state.config.periodsPerDay || 7;
            schoolDays.forEach(dayName => {
                for(let p = 1; p <= periodsPerDay; p++) {
                    const validation = validateSlot(timetable, task.className, dayName, [p], task.teacherId, maxTeacherPeriods);
                    if (!validation.valid) {
                        console.warn(`${dayName} P${p} -> ${validation.reason}`);
                    } else if (exceedsDailySubjectLimit(task.className, dayName, task.subject, 1, { isLabBlock: false })) {
                        console.warn(`${dayName} P${p} -> Subject spread limit reached`);
                    } else {
                        const cell = getClassDayPeriod(timetable, task.className, dayName, p);
                        if (cell && cell.isLocked) {
                            console.warn(`${dayName} P${p} -> Cell is locked`);
                        } else {
                            console.warn(`${dayName} P${p} -> Unknown rejection (check forward check or MRV logic)`);
                        }
                    }
                }
            });
            console.warn(`\nCandidates left = 0`);
            console.warn(`--------------------------------------\n`);
            break;
        }

        const slotHasLockedPeriod = best.periodNumbers.some( periodNumber => {
            const period = getClassDayPeriod( timetable, task.className, best.dayName, periodNumber );
            return period && period.isLocked;
        } );
        if ( slotHasLockedPeriod ) continue;

        assignSlotWithTracking(
            timetable,
            task.className,
            best.dayName,
            best.periodNumbers,
            task.teacherId,
            task.subject,
            task.teacherName
        );
        remaining -= 1;
    }

    if ( remaining > 0 ) {
        unscheduled.push( {
            className: task.className,
            teacherId: task.teacherId,
            teacherName: task.teacherName,
            subject: task.subject,
            periodsNeeded: task.periodsNeeded,
            periodsScheduled: task.periodsNeeded - remaining,
            periodsUnscheduled: remaining
        } );
    }
}

function saveGeneratedTimetable( timetable, unscheduled ) {
    state.stagedTimetableData = timetable;
    currentUnscheduledList = unscheduled || [];
}

function promoteStagedTimetable() {
    if ( !state.stagedTimetableData ) return;
    state.timetableData = state.stagedTimetableData;
    assignTeacherIdsInTimetableData();
    saveTimetableToStorage();
    rebuildTeacherSubjectMapFromMasterData();
    saveTeacherSubjectMapToStorage();
    state.stagedTimetableData = null;
}

/** Show generation success in the Upload Timetable summary cards. */
function showTimetableGenerationStatus( classCount, unscheduled ) {
    const uploadStatus = document.getElementById( 'uploadStatus' );
    const uploadDetails = document.getElementById( 'uploadDetails' );
    const timetableDataInfo = document.getElementById( 'timetableDataInfo' );

    if ( uploadStatus && uploadDetails ) {
        uploadStatus.style.display = 'block';
        let detailsHtml = `<p><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Timetable generated for ${classCount} class section(s).</p>`;
        if ( ( unscheduled || [] ).length > 0 ) {
            detailsHtml += `<p><i class="fas fa-exclamation-triangle" style="color: var(--warning-color);"></i> ${unscheduled.length} mapping(s) could not be fully scheduled.</p>`;
        }
        uploadDetails.innerHTML = detailsHtml;
    }

    if ( timetableDataInfo ) {
        timetableDataInfo.style.display = 'block';
    }
}

function trySwapAndPlace( timetable, retryTask, maxTeacherPeriods, attemptContext ) {
    attemptContext.count++;
    if ( attemptContext.count > attemptContext.max ) {
        attemptContext.diagnostics.push( `Aborted for ${retryTask.teacherId} (${retryTask.className}): max swap attempts reached (${attemptContext.max}).` );
        return false;
    }

    const classData = timetable[retryTask.className];
    if ( !classData || !Array.isArray( classData.days ) ) return false;

    const validDays = new Set( getAllActiveDays() );
    const daysToEvaluate = classData.days.filter( d => validDays.has( d.dayName ) );

    // Strategy 1: Find an occupied slot in this class where retryTask's teacher is free.
    // Move the current teacher of that slot to a new home.
    for ( const day of daysToEvaluate ) {
        for ( const slot of day.periods ) {
            if ( !slot || slot.isLocked || slot.type === 'Break' ) continue;

            const currentTeacherId = toCleanString( slot.teacherId );
            const currentSubject = toCleanString( slot.subject );
            if ( !currentTeacherId || !currentSubject ) continue;

            const canPlaceRetry = validateSlot(
                timetable,
                retryTask.className,
                day.dayName,
                [slot.period],
                retryTask.teacherId,
                maxTeacherPeriods
            );

            // If the only reason it's invalid is because it's occupied, we can try to move the current occupant!
            if ( !canPlaceRetry.valid && !String( canPlaceRetry.reason || '' ).includes( 'occupied' ) ) continue;

            const displacedTask = {
                className: retryTask.className,
                teacherId: currentTeacherId,
                teacherName: toCleanString( slot.teacherName ),
                subject: currentSubject,
                periodsNeeded: 1,
                isClubbed: false,
                isLabSubject: typeof isCslSubject === 'function' ? isCslSubject( currentSubject ) : normalizeSubjectCode( currentSubject ) === 'CSL',
                hasFixedPeriods: false,
                fixedPeriodGroups: []
            };

            const savedTeacherName = toCleanString( slot.teacherName );
            const savedAssignmentId = slot.assignmentId;

            // Unassign correctly to clear trackers
            unassignSlotWithTracking( timetable, retryTask.className, day.dayName, [slot.period], currentTeacherId, currentSubject, savedAssignmentId );
            slot.isLocked = true;

            const newHome = findBestCandidateSlot(
                timetable,
                displacedTask,
                null,
                { preferFixedPeriods: false, isLabBlock: false },
                maxTeacherPeriods,
                null,
                true
            );

            let success = false;
            if ( newHome ) {
                attemptContext.diagnostics.push( `Success! Displaced ${currentTeacherId} to ${newHome.dayName}-P${newHome.periodNumbers.join( '-' )}` );
                assignSlotWithTracking(
                    timetable,
                    displacedTask.className,
                    newHome.dayName,
                    newHome.periodNumbers,
                    displacedTask.teacherId,
                    displacedTask.subject,
                    displacedTask.teacherName
                );
                success = true;
            } else if ( trySwapAndPlace( timetable, displacedTask, maxTeacherPeriods, attemptContext ) ) {
                success = true;
            }

            slot.isLocked = false;

            if ( success ) {
                assignSlotWithTracking(
                    timetable,
                    retryTask.className,
                    day.dayName,
                    [slot.period],
                    retryTask.teacherId,
                    retryTask.subject,
                    retryTask.teacherName
                );
                return true;
            }

            // Restore if failed
            assignSlotWithTracking( timetable, retryTask.className, day.dayName, [slot.period], currentTeacherId, currentSubject, savedTeacherName, savedAssignmentId );
        }
    }

    // Strategy 2: We have an empty slot, but retryTask's teacher is busy in another class.
    // Move the teacher's other class to a new slot!
    for ( const day of daysToEvaluate ) {
        for ( const slot of day.periods ) {
            if ( !slot || slot.isLocked || slot.type === 'Break' ) continue;
            const currentTeacherId = toCleanString( slot.teacherId );
            if ( currentTeacherId ) continue; // Only look at empty slots

            const tid = toCleanString( retryTask.teacherId );
            if ( !isTeacherBusy( tid, day.dayName, slot.period ) ) continue;

            // Teacher is busy in another class. Find where.
            let conflictingClass = null;
            let conflictingSlot = null;

            for ( const otherClass of Object.keys( timetable ) ) {
                if ( otherClass === retryTask.className ) continue;
                const p = getClassDayPeriod( timetable, otherClass, day.dayName, slot.period );
                if ( p && toCleanString( p.teacherId ) === tid ) {
                    if ( p.isLocked ) continue; // DO NOT swap out locked slots!
                    conflictingClass = otherClass;
                    conflictingSlot = p;
                    break;
                }
            }

            if ( !conflictingClass || !conflictingSlot ) continue;

            const displacedTask = {
                className: conflictingClass,
                teacherId: tid,
                teacherName: toCleanString( conflictingSlot.teacherName ),
                subject: toCleanString( conflictingSlot.subject ),
                periodsNeeded: 1,
                isClubbed: false, // We assume simple swap for now
                isLabSubject: typeof isCslSubject === 'function' ? isCslSubject( conflictingSlot.subject ) : normalizeSubjectCode( conflictingSlot.subject ) === 'CSL',
                hasFixedPeriods: false,
                fixedPeriodGroups: []
            };

            const savedSubject = toCleanString( conflictingSlot.subject );
            const savedName = toCleanString( conflictingSlot.teacherName );
            const savedAssignmentId = conflictingSlot.assignmentId;

            unassignSlotWithTracking( timetable, conflictingClass, day.dayName, [slot.period], tid, savedSubject, savedAssignmentId );
            conflictingSlot.isLocked = true;

            const newHome = findBestCandidateSlot(
                timetable,
                displacedTask,
                null,
                { preferFixedPeriods: false, isLabBlock: false },
                maxTeacherPeriods,
                null,
                true
            );

            let success = false;
            if ( newHome ) {
                assignSlotWithTracking(
                    timetable,
                    displacedTask.className,
                    newHome.dayName,
                    newHome.periodNumbers,
                    displacedTask.teacherId,
                    displacedTask.subject,
                    displacedTask.teacherName
                );
                success = true;
            } else if ( trySwapAndPlace( timetable, displacedTask, maxTeacherPeriods, attemptContext ) ) {
                success = true;
            }

            conflictingSlot.isLocked = false;

            if ( success ) {
                assignSlotWithTracking(
                    timetable,
                    retryTask.className,
                    day.dayName,
                    [slot.period],
                    retryTask.teacherId,
                    retryTask.subject,
                    retryTask.teacherName
                );
                return true;
            }

            // Restore
            assignSlotWithTracking( timetable, conflictingClass, day.dayName, [slot.period], tid, savedSubject, savedName, savedAssignmentId );
        }
    }

    return false;
}

function fillRemainingEmptyTeachingSlots( timetable, unscheduled ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
    const stillUnscheduled = [];

    unscheduled.forEach( item => {
        let remaining = Number( item.periodsUnscheduled || 0 );
        if ( remaining <= 0 ) return;

        if ( item.isFixedSlotTask ) {
            stillUnscheduled.push( item );
            return;
        }

        const retryTask = {
            className: item.className,
            teacherId: item.teacherId,
            teacherName: item.teacherName,
            subject: item.subject,
            periodsNeeded: remaining,
            isClubbed: false,
            isLabSubject: typeof isCslSubject === 'function' ? isCslSubject( item.subject ) : normalizeSubjectCode( item.subject ) === 'CSL',
            hasFixedPeriods: false,
            fixedPeriodGroups: []
        };

        const attemptContext = { count: 0, max: state.config.maxSwapAttempts || 200, diagnostics: [] };

        while ( remaining > 0 ) {
            const best = findBestCandidateSlot(
                timetable,
                retryTask,
                null,
                { preferFixedPeriods: false, isLabBlock: false },
                maxTeacherPeriods,
                null,
                true
            );

            if ( !best ) {
                if ( trySwapAndPlace( timetable, retryTask, maxTeacherPeriods, attemptContext ) ) {
                    remaining -= 1;
                    continue;
                }
                break;
            }

            const periodEntry = getClassDayPeriod(
                timetable,
                retryTask.className,
                best.dayName,
                best.periodNumbers[0]
            );

            if ( !periodEntry || periodEntry.isLocked || periodEntry.type === 'Break' ) {
                if ( trySwapAndPlace( timetable, retryTask, maxTeacherPeriods, attemptContext ) ) {
                    remaining -= 1;
                    continue;
                }
                break;
            }

            assignSlotWithTracking(
                timetable,
                retryTask.className,
                best.dayName,
                best.periodNumbers,
                retryTask.teacherId,
                retryTask.subject,
                retryTask.teacherName
            );

            remaining -= best.periodNumbers.length;
        }

        if ( remaining > 0 ) {
            stillUnscheduled.push( {
                ...item,
                periodsScheduled: Number( item.periodsNeeded || 0 ) - remaining,
                periodsUnscheduled: remaining,
                reason: 'Could not fill all teaching slots after final retry',
                diagnostics: attemptContext.diagnostics
            } );
        }
    } );

    return stillUnscheduled;
}

function findBestCandidateForSingleCell(timetable, className, dayName, period, tasks) {
  const maxTeacherPeriods = state.config.periodsPerTeacher || 35;
  let best = null;
  let bestScore = -Infinity;

  for (const task of tasks) {
    if (!task || task.periodsUnscheduled <= 0) continue;
    if (task.isFixedSlotTask) continue;
    if (task.className !== className) continue;

    const valid = validateSlot(timetable, className, dayName, [period], task.teacherId, maxTeacherPeriods);
    if (!valid.valid) continue;
    if (exceedsDailySubjectLimit(className, dayName, task.subject, 1, { isLabBlock: false })) continue;

    const score = task.periodsUnscheduled * 10 - getTeacherLoad(task.teacherId);
    if (score > bestScore) {
      bestScore = score;
      best = task;
    }
  }

  return best;
}

function fillAllEmptyPeriods( timetable, remainingTasks ) {
    const periodsPerDay = state.config.periodsPerDay || 7;

    for ( const className of Object.keys( timetable ) ) {
        const classDays = getStandardDayOrder( className );
        for ( const dayName of classDays ) {
            for ( let p = 1; p <= periodsPerDay; p++ ) {
                const cell = getClassDayPeriod( timetable, className, dayName, p );
                if ( !cell || cell.isLocked || !isPeriodSlotEmpty( cell ) ) continue;

                const candidate = findBestCandidateForSingleCell(
                    timetable,
                    className,
                    dayName,
                    p,
                    remainingTasks
                );

                if ( !candidate ) continue;

                const ok = assignSlotWithTracking(
                    timetable,
                    className,
                    dayName,
                    [p],
                    candidate.teacherId,
                    candidate.subject,
                    candidate.teacherName,
                    candidate.assignmentId || null
                );

                if ( ok ) {
                    candidate.periodsScheduled = ( candidate.periodsScheduled || 0 ) + 1;
                    candidate.periodsUnscheduled = ( candidate.periodsUnscheduled || 1 ) - 1;
                }
            }
        }
    }

    return remainingTasks.filter( t => t.periodsUnscheduled > 0 );
}

function showTimetableAuditFailure(auditErrors) {
  const overlay = document.createElement('div');
  overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
  const modal = document.createElement('div');
  modal.style = 'background:white;padding:20px;border-radius:8px;max-width:600px;width:90%;max-height:90vh;overflow-y:auto;font-family:sans-serif;';
  const errorSummary = auditErrors.slice(0, 5).map(e => `<li style="margin-bottom:8px;"><strong>${e.code}</strong>: ${e.message}</li>`).join('');
  modal.innerHTML = `
    <h3 style="color:#d32f2f;margin-top:0;">Timetable Audit Failed</h3>
    <p>Generation completed, but critical integrity checks failed. The live timetable has NOT been overwritten.</p>
    <ul style="background:#ffebee;padding:15px 15px 15px 30px;border-radius:4px;font-size:14px;">${errorSummary}</ul>
    ${auditErrors.length > 5 ? `<p style="font-size:14px;">...and ${auditErrors.length - 5} more issues.</p>` : ''}
    <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
      <button id="btnAbortAudit" class="btn btn-secondary" style="padding:8px 16px;">Abort</button>
      <button id="btnDownloadAudit" class="btn btn-primary" style="padding:8px 16px;">Download Report</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('btnAbortAudit').onclick = () => {
    state.stagedTimetableData = null;
    document.body.removeChild(overlay);
  };

  document.getElementById('btnDownloadAudit').onclick = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' + ['Code,Message', ...auditErrors.map(e => `${e.code},${e.message.replace(/,/g, ' ')}`)].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'audit-conflict-report.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
}

function auditTimetableIntegrity( timetable ) {
    const errors = [];
    // blockKey -> array of { className, subject } entries
    const teacherBlockOccupants = new Map();
    const teacherLoadActual = {};

    Object.entries( timetable ).forEach( ( [className, classData] ) => {
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                if ( !period.teacherId ) return;

                const tid = toCleanString( period.teacherId );
                const blockKey = `${tid}-${day.dayName}-${period.period}`;
                const subject = toCleanString( period.subject );

                // Count each teacher-day-period once for load tracking
                if ( !teacherBlockOccupants.has( blockKey ) ) {
                    teacherBlockOccupants.set( blockKey, [] );
                    teacherLoadActual[tid] = ( teacherLoadActual[tid] || 0 ) + 1;
                }
                teacherBlockOccupants.get( blockKey ).push( { className, subject } );
            } );
        } );
    } );

    // Detect double bookings: same teacher, same day-period, different subjects
    // (same teacher + same day-period + SAME subject across different classes = valid clubbed)
    teacherBlockOccupants.forEach( ( occupants, blockKey ) => {
        if ( occupants.length < 2 ) return;
        const subjects = [...new Set( occupants.map( o => o.subject ) )];
        if ( subjects.length > 1 ) {
            // Multiple subjects => real double-booking
            const parts = blockKey.split( '-' );
            // blockKey format: tid-DayName-period
            const period = parts[parts.length - 1];
            const dayName = parts.slice( 1, -1 ).join( '-' );
            const tid = parts[0];
            occupants.forEach( o => {
                errors.push( {
                    code: 'DUPLICATE_CLASS_ASSIGNMENT',
                    message: `Double booking: Teacher ${tid} assigned ${o.subject} in ${o.className} on ${dayName} P${period} (conflicts with: ${occupants.filter( x => x !== o ).map( x => `${x.subject}@${x.className}` ).join( ', ' )})`
                } );
            } );
        }
    } );

    // Tracker drift check removed per user request

    // Check strict fixed-slot adherence (Disabled for generic generation)
    /*
    if ( typeof CSL_FIXED_SCHEDULE !== 'undefined' ) {
        Object.entries( CSL_FIXED_SCHEDULE ).forEach( ( [key, slots] ) => {
            const [teacherPrefix, classStr] = key.split( '|' );
            const classNamesRaw = classStr.split( ';' );
            const classNames = classNamesRaw.map( c => mappingGradeSectionToClassName( c ) );

            slots.forEach( slotInfo => {
                const dayName = slotInfo.day;
                const periodNumbers = slotInfo.periods;

                classNames.forEach( cls => {
                    if ( !timetable[cls] ) return;

                    periodNumbers.forEach( p => {
                        const cell = getClassDayPeriod( timetable, cls, dayName, p );
                        if ( !cell || !cell.teacherId ) {
                            errors.push( {
                                code: 'CSL_SLOT_EMPTY',
                                message: `Missing fixed slot: ${cls} ${dayName} P${p} is empty`
                            } );
                        } else if ( teacherPrefix !== 'ANY' && cell.teacherId !== teacherPrefix && !cell.teacherName.startsWith( teacherPrefix ) ) {
                            errors.push( {
                                code: 'INVALID_FIXED_PERIOD',
                                message: `Fixed slot violation: ${cls} on ${dayName} P${p} has wrong teacher ${cell.teacherName} (expected ${teacherPrefix})`
                            } );
                        } else if ( normalizeSubjectCode( cell.subject ) !== 'CSL' ) {
                            errors.push( {
                                code: 'INVALID_FIXED_PERIOD',
                                message: `Fixed slot violation: ${cls} on ${dayName} P${p} has wrong subject ${cell.subject} (expected CSL)`
                            } );
                        }
                    } );
                } );
            } );
        } );
    }
    */

    return errors;
}

function validateFeasibilityBeforeGeneration( allTasks ) {
    const teacherDemand = {};
    const issues = [];

    if ( state.unresolvedMappings && state.unresolvedMappings.length > 0 ) {
        state.unresolvedMappings.forEach( um => {
            issues.push( {
                type: 'unresolved-mapping',
                reason: `Unresolved class section '${um.rawGradeSection}' for teacher ${um.teacherId} (subject: ${um.subject}) in mapping row ${um.mappingIndex + 1}.`,
                severity: 'fatal'
            } );
        } );
    }

    allTasks.forEach( task => {
        const tid = toCleanString( task.teacherId );
        if ( !tid ) return;

        if ( !teacherDemand[tid] ) {
            teacherDemand[tid] = { total: 0, breakdown: {} };
        }

        teacherDemand[tid].total += Number( task.periodsNeeded || 0 );

        const cName = task.className || 'Unknown Class';
        teacherDemand[tid].breakdown[cName] = ( teacherDemand[tid].breakdown[cName] || 0 ) + Number( task.periodsNeeded || 0 );
    } );

    const maxTeacherPeriods = state.config.periodsPerTeacher || 35;

    Object.entries( teacherDemand ).forEach( ( [teacherId, data] ) => {
        if ( data.total > maxTeacherPeriods ) {
            issues.push( {
                type: 'teacher-overload',
                teacherId,
                teacherName: findTeacherNameById( teacherId ),
                demand: data.total,
                breakdown: data.breakdown,
                max: maxTeacherPeriods,
                excess: data.total - maxTeacherPeriods,
                severity: 'fatal'
            } );
        }
    } );

    const totalSlots = ( state.config.schoolDays || [] ).length * ( state.config.periodsPerDay || 7 );
    const classDemand = {};
    allTasks.forEach( task => {
        const targets = task.isClubbed && task.clubbedClasses ? task.clubbedClasses : task.classNames;
        targets.forEach( cls => {
            classDemand[cls] = ( classDemand[cls] || 0 ) + ( task.periodsNeeded || 0 );
        } );
    } );
    Object.entries( classDemand ).forEach( ( [className, demand] ) => {
        if ( demand > totalSlots ) {
            issues.push( { type: 'class-overload', className, demand, max: totalSlots, excess: demand - totalSlots, severity: 'fatal' } );
        }
    } );

    return issues;
}

/**
 * Task difficulty score — used as tiebreaker in MRV sort and as primary sort
 * for the legacy fixed/lab bucket ordering.
 * Phase 3/5: candidate count dominates when available.
 */
function taskDifficultyScore( task ) {
    let score = 0;

    // Dominant term: inverse of remaining candidate count (MRV core)
    const candCount = ( task.candidates || [] ).length;
    if ( candCount > 0 ) {
        score += 10000 / candCount;
    } else if ( candCount === 0 && !task.alreadyScheduled ) {
        score += 20000; // zero candidates — schedule immediately or mark failed
    }

    // Structural bonuses (tiebreakers)
    if ( task.hasFixedPeriods ) score += 1000;
    if ( task.isLabSubject )    score += 800;
    if ( task.isClubbed )       score += 600;
    score += ( task.fixedPeriodGroups?.length || 0 ) * 100;
    score += Number( task.periodsNeeded || 0 ) * 20;
    score += ( task.teacherTaskCount || 0 ) * 10;

    return score;
}

/** Show inline generation status in the Setup tab header area. */
function showGenerationStatus( type, html ) {
    const el = document.getElementById( 'generationStatus' );
    if ( !el ) { console.warn( 'generationStatus element not found' ); return; }
    el.style.display = 'block';
    el.innerHTML = html;
    if ( type === 'error' ) {
        el.style.background = '#fdecea';
        el.style.color = '#b71c1c';
        el.style.border = '1px solid #f5c6cb';
    } else if ( type === 'success' ) {
        el.style.background = '#e8f5e9';
        el.style.color = '#1b5e20';
        el.style.border = '1px solid #c8e6c9';
    } else {
        el.style.background = '#e3f2fd';
        el.style.color = '#0d47a1';
        el.style.border = '1px solid #bbdefb';
    }
}

/** Main entry: fixed tasks → CSL lab blocks → score-based normal scheduling. */
function generateTimetable() {
    const teacherCount = ( state.teacherMappings || [] ).length;
    const classCount = ( state.classSections || [] ).length;
    console.log('[GenerateTimetable] Starting. teachers:', (state.teachers||[]).length, 'mappings:', teacherCount, 'classSections:', classCount);

    if ( !teacherCount ) {
        showGenerationStatus( 'error',
            '<i class="fas fa-exclamation-triangle"></i> <strong>Cannot generate:</strong> No teacher-subject mappings found. ' +
            'Add mappings in the <strong>Teacher-Subject Mapping</strong> table below, then click <strong>Save Changes</strong> before generating.'
        );
        return;
    }

    resetGenerationTrackers();
    const timetable = createEmptyTimetable();
    console.log('[GenerateTimetable] Empty timetable classes:', Object.keys(timetable).length);

    if ( Object.keys( timetable ).length === 0 ) {
        showGenerationStatus( 'error',
            '<i class="fas fa-exclamation-triangle"></i> <strong>Cannot generate:</strong> No class sections defined. ' +
            'Add classes via <strong>Bulk Classes & Sections</strong> or include grade-sections in your mappings first.'
        );
        return;
    }

    showGenerationStatus( 'info',
        '<i class="fas fa-spinner fa-spin"></i> Generating timetable for ' + Object.keys( timetable ).length + ' class section(s)...'
    );

    const allTasks = buildSchedulingTasks();
    console.log('[GenerateTimetable] Tasks built:', allTasks.length, 'unresolved:', (state.unresolvedMappings||[]).length);
    const feasibilityIssues = validateFeasibilityBeforeGeneration( allTasks );
    const fatalIssues = feasibilityIssues.filter( i => i.severity === 'fatal' );
    console.log('[GenerateTimetable] fatalIssues:', fatalIssues.length, fatalIssues.map(i=>i.reason||i.type));
    const warningIssues = feasibilityIssues.filter( i => i.severity !== 'fatal' );

    if ( fatalIssues.length > 0 ) {
        const issueLines = fatalIssues
            .slice( 0, 8 )
            .map( i => {
                if ( i.type === 'teacher-overload' ) {
                    const breakdownStr = Object.entries( i.breakdown )
                        .map( ( [cls, count] ) => `${cls}: ${count}` )
                        .join( ', ' );
                    return `<li>${escapeHtml(i.teacherId)} (${escapeHtml(i.teacherName)}): needs ${i.demand}, max ${i.max}, excess ${i.excess} [${escapeHtml(breakdownStr)}]</li>`;
                } else if ( i.type === 'class-overload' ) {
                    return `<li>Class ${escapeHtml(i.className)}: needs ${i.demand}, max slots ${i.max}</li>`;
                } else {
                    return `<li>${escapeHtml(i.type)}: ${escapeHtml(i.reason || JSON.stringify( i ))}</li>`;
                }
            } )
            .join( '' );

        showGenerationStatus( 'error',
            '<i class="fas fa-times-circle"></i> <strong>Generation aborted — fatal data errors:</strong><ul style="margin:6px 0 0 18px;">' + issueLines + '</ul>'
        );
        return;
    }

    if ( warningIssues.length > 0 ) {
        console.warn( "Feasibility Warnings:", warningIssues );
        // We can choose to alert warnings here but not block, or just log them.
    }

    const unscheduled = [];
    const deferredTasks = [];

    const buckets = {
        'fixed-csl': [],
        'lab': [],
        'fixed': [],
        'fixed-combined': [],
        'combined': [],
        'normal': []
    };

    allTasks.forEach( task => {
        if ( buckets[task.taskType] ) buckets[task.taskType].push( task );
    } );

    // Legacy sort for fixed/lab/CSL buckets (candidate count not yet built)
    Object.values( buckets ).forEach( bucket => {
        bucket.sort( ( a, b ) => taskDifficultyScore( b ) - taskDifficultyScore( a ) );
    } );

    function validatePhase(phaseName) {
        const errors = auditTimetableIntegrity( timetable );
        if ( errors.length > 0 ) {
            console.error(`Validation failed after ${phaseName}!`, errors);
        } else {
            console.log(`Phase ${phaseName} passed validation.`);
        }
    }

    // ── PHASE A: Fixed/CSL/Lab (unchanged legacy scheduling) ──────────────────
    scheduleFixedCslLabs( timetable, buckets['fixed-csl'], unscheduled );

    reserveClassP1Slots( timetable, allTasks.filter( t => t.hasFixedPeriods && taskRequiresFixedPeriodOne( t ) ) );

    buckets['lab'].forEach( task => {
        if ( !task.alreadyScheduled ) scheduleLabBlock( timetable, task, unscheduled );
    } );

    scheduleFixedTasks( timetable, buckets['fixed'], deferredTasks, unscheduled );

    scheduleFixedCombinedTasks( timetable, buckets['fixed-combined'], deferredTasks, unscheduled );

    const classTeacherP1Tasks = deferredTasks.filter( task => isClassTeacherP1Task( task ) );
    const otherDeferredTasks  = deferredTasks.filter( task => !isClassTeacherP1Task( task ) );
    scheduleClassTeacherP1AfterLabs( timetable, classTeacherP1Tasks, unscheduled );
    validatePhase("Fixed Tasks & Labs");

    // ── PHASE B: MRV Scheduler (normal + combined + deferred normal) ──────────
    const ctx = prepareSchedulerContext( timetable );

    // Stamp original periods needed for diagnostics
    allTasks.forEach( t => { t._originalPeriods = t.periodsNeeded; } );

    // Collect all tasks the MRV scheduler will handle
    const mrvInputTasks = [
        ...buckets['combined'],
        ...buckets['normal'],
        ...otherDeferredTasks.filter( t => !t.isLabSubject )
    ];

    runMRVScheduler( mrvInputTasks, ctx, unscheduled );
    validatePhase("MRV Scheduler");

    // ── PHASE C: Fill remaining empty slots (last resort) ─────────────────────
    let finalUnscheduled = fillAllEmptyPeriods( timetable, unscheduled );
    finalUnscheduled = finalUnscheduled.filter( t => t.periodsUnscheduled > 0 );
    validatePhase("Fill Empty Periods");

    saveGeneratedTimetable( timetable, finalUnscheduled );

    const auditErrors = auditTimetableIntegrity( timetable );
    if ( auditErrors.length > 0 ) {
        console.warn( 'Timetable integrity audit warnings (non-blocking):', auditErrors );
    }

    promoteStagedTimetable();
    updateTimetableSummary();
    updateClassFilters();
    renderTimetable();
    showTimetableGenerationStatus( Object.keys( timetable ).length, finalUnscheduled );

    const viewTab = document.querySelector( '.tab[data-target="view-timetable-section"]' );
    if ( viewTab ) viewTab.click();

    renderGenerationReport();

    let message = `Timetable generated for ${Object.keys( timetable ).length} class section(s).`;
    if ( finalUnscheduled.length > 0 ) {
        message += `\n\n${finalUnscheduled.length} mapping(s) could not be fully scheduled:`;
        message += '\n' + finalUnscheduled.slice( 0, 5 ).map( item =>
            `${item.className} / ${item.subject} (${item.teacherId}): ${item.periodsUnscheduled} period(s) remaining`
        ).join( '\n' );
        if ( finalUnscheduled.length > 5 ) {
            message += `\n... and ${finalUnscheduled.length - 5} more.`;
        }
    }

    if ( state.consumedCslMappings && state.consumedCslMappings.length > 0 ) {
        message += `\n\nConsumed ${state.consumedCslMappings.length} fixed CSL mapping(s) successfully.`;
    }

    let statusHtml = `<i class="fas fa-check-circle"></i> <strong>Success!</strong> Timetable generated for ${Object.keys( timetable ).length} class section(s).`;
    if ( finalUnscheduled.length > 0 ) {
        statusHtml += ` <span style="color:#e67e22;">(${finalUnscheduled.length} mapping(s) could not be fully scheduled)</span>`;
    }
    showGenerationStatus( 'success', statusHtml );
    alert( message );
}

function processStateTimetableWorkbook( workbook ) {
    const firstSheetName = workbook.SheetNames[0];
    if ( !firstSheetName ) return 0;

    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json( worksheet, { header: 1, defval: '' } );
    if ( data.length < 4 ) {
        alert( "Selected STATE format file appears invalid (expected day and period headers in rows 2 and 3)." );
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
    for ( let c = 0; c < dayHeaderRow.length; c++ ) {
        const dayText = toCleanString( dayHeaderRow[c] ).toUpperCase();
        if ( dayNamesMap[dayText] ) {
            dayStarts.push( { dayName: dayNamesMap[dayText], startCol: c } );
        }
    }

    if ( dayStarts.length === 0 ) {
        alert( "Could not detect day blocks in selected STATE format file." );
        return 0;
    }

    const dayBlocks = [];
    for ( let i = 0; i < dayStarts.length; i++ ) {
        const { dayName, startCol } = dayStarts[i];
        const nextStart = i < dayStarts.length - 1 ? dayStarts[i + 1].startCol : periodHeaderRow.length;
        const periodColumns = [];

        for ( let c = startCol; c < nextStart; c++ ) {
            const periodText = toCleanString( periodHeaderRow[c] );
            const periodMatch = periodText.match( /(\d+)/ );
            const periodNo = periodMatch ? Number( periodMatch[1] ) : NaN;
            if ( Number.isInteger( periodNo ) && periodNo > 0 ) {
                periodColumns.push( { col: c, period: periodNo } );
            }
        }

        if ( periodColumns.length > 0 ) {
            dayBlocks.push( { dayName, periodColumns } );
        }
    }

    if ( dayBlocks.length === 0 ) {
        alert( "Could not detect period columns in selected STATE format file." );
        return 0;
    }

    const maxPeriods = dayBlocks.reduce( ( maxVal, block ) => {
        const blockMax = block.periodColumns.reduce( ( m, p ) => Math.max( m, p.period ), 0 );
        return Math.max( maxVal, blockMax );
    }, 0 );

    const classMap = {};
    const ensureClass = ( className ) => {
        if ( !classMap[className] ) {
            const days = getAllActiveDays().map( dayName => ( {
                dayName,
                periods: Array.from( { length: maxPeriods }, ( _, idx ) => ( {
                    period: idx + 1,
                    subject: '',
                    teacherName: '',
                    teacherId: '',
                    time: getPeriodTime( idx + 1 ),
                    type: 'Regular',
                    breakAfter: 0
                } ) )
            } ) );
            classMap[className] = { className, days };
        }
        return classMap[className];
    };

    for ( let r = 3; r < data.length; r++ ) {
        const row = data[r] || [];
        const teacherName = toCleanString( row[0] );
        if ( !teacherName ) continue;

        dayBlocks.forEach( block => {
            const dayEntryForClass = ( className ) => ensureClass( className ).days.find( d => d.dayName === block.dayName );

            block.periodColumns.forEach( ( { col, period } ) => {
                const classValue = normalizeClassSectionLabel( row[col] );
                if ( !classValue ) return;

                const dayEntry = dayEntryForClass( classValue );
                if ( !dayEntry ) return;

                const periodEntry = dayEntry.periods[period - 1];
                if ( !periodEntry ) return;

                if ( periodEntry.teacherName && periodEntry.teacherName !== teacherName ) {
                    periodEntry.teacherName = `${periodEntry.teacherName} / ${teacherName}`;
                } else {
                    periodEntry.teacherName = teacherName;
                }
            } );
        } );
    }

    state.timetableData = classMap;
    return Object.keys( state.timetableData ).length;
}

// Process Excel sheet data
function processExcelSheetData( sheetName, data ) {
    // Skip header rows
    if ( data.length < 3 ) return;

    const classData = {
        className: sheetName,
        days: []
    };

    // Process each row starting from row 2 (0-indexed)
    for ( let i = 2; i < data.length; i++ ) {
        const row = data[i];
        if ( !row || row.length === 0 ) continue;

        const day = {
            dayName: row[0],
            periods: []
        };

        // Process each period (8 periods in the template)
        for ( let p = 0; p < 8; p++ ) {
            const baseIndex = p * 5;
            const period = {
                period: p + 1,
                subject: row[baseIndex + 1] || '',
                teacherName: row[baseIndex + 2] || '',
                teacherId: row[baseIndex + 3] || '',
                time: row[baseIndex + 4] || getPeriodTime( p + 1 ),
                type: row[baseIndex + 5] || 'Regular'
            };

            day.periods.push( period );
        }

        classData.days.push( day );
    }

    // Store in state
    state.timetableData[sheetName] = classData;
}

// Process CSV data
function processCSVData( csvData, fileName ) {
    // Clear previous data
    state.timetableData = {};

    // Parse CSV
    const lines = csvData.split( '\n' );
    if ( lines.length < 2 ) {
        alert( "CSV file is empty or has invalid format." );
        return;
    }

    // Get headers
    const headers = lines[0].split( ',' );

    // Check if it's the new format
    if ( headers[0] !== 'Class-Section' || headers[1] !== 'Day' ) {
        alert( "CSV format not recognized. Expected format: Class-Section,Day,P1,P2,..." );
        return;
    }

    // Get period columns (P1, P2, etc.)
    const periodColumns = headers.filter( h => h.startsWith( 'P' ) );
    const numPeriods = periodColumns.length;

    // Store period count for time input
    state.tempPeriodCount = numPeriods;
    state.tempCSVData = {};

    // Process each data line
    for ( let i = 1; i < lines.length; i++ ) {
        const line = lines[i].trim();
        if ( !line ) continue;

        const cells = parseCSVLine( line );
        if ( cells.length < 2 ) continue;

        const classSection = cells[0];
        const day = cells[1];

        // Create class data structure if not exists
        if ( !state.tempCSVData[classSection] ) {
            state.tempCSVData[classSection] = {
                className: classSection,
                days: []
            };
        }

        // Find or create day entry
        let dayEntry = state.tempCSVData[classSection].days.find( d => d.dayName === day );
        if ( !dayEntry ) {
            dayEntry = {
                dayName: day,
                periods: []
            };
            state.tempCSVData[classSection].days.push( dayEntry );
        }

        // Process each period
        for ( let p = 0; p < numPeriods; p++ ) {
            const periodData = cells[2 + p] || '';

            let teacherId = '';
            let teacherName = '';
            let subject = '';

            if ( periodData && periodData.includes( ':' ) ) {
                const parts = periodData.split( ':' );
                teacherId = parts[0] || '';
                teacherName = parts[1] || '';
                subject = parts[2] || '';
            } else if ( periodData ) {
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

            dayEntry.periods.push( period );
        }
    }

    // Convert to array and show time input modal
    state.tempCSVData = Object.values( state.tempCSVData );
    openTimeInputModal( numPeriods );
}

// Parse CSV line considering quoted values
function parseCSVLine( line ) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for ( let i = 0; i < line.length; i++ ) {
        const char = line[i];

        if ( char === '"' ) {
            inQuotes = !inQuotes;
        } else if ( char === ',' && !inQuotes ) {
            result.push( current );
            current = '';
        } else {
            current += char;
        }
    }

    result.push( current );
    return result;
}

function buildTeacherSubjectMapKey( teacherName, teacherId ) {
    const id = toCleanString( teacherId ).toLowerCase();
    const name = toCleanString( teacherName ).toLowerCase();
    if ( id ) return `id:${id}`;
    if ( name ) return `name:${name}`;
    return '';
}

function getMappedSubjectForPeriod( period ) {
    if ( !state.teacherSubjectMap ) return '';
    const keyById = buildTeacherSubjectMapKey( '', period.teacherId );
    if ( keyById && state.teacherSubjectMap[keyById] ) {
        return toCleanString( state.teacherSubjectMap[keyById] );
    }

    const keyByName = buildTeacherSubjectMapKey( period.teacherName, '' );
    if ( keyByName && state.teacherSubjectMap[keyByName] ) {
        return toCleanString( state.teacherSubjectMap[keyByName] );
    }

    return '';
}

function autoFillMissingSubjectsFromTeacherMap() {
    if ( !state.timetableData || !state.teacherSubjectMap ) return 0;

    let updatedCount = 0;
    Object.values( state.timetableData ).forEach( classData => {
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const hasSubject = toCleanString( period.subject ) !== '';
                if ( hasSubject ) return;
                const mappedSubject = getMappedSubjectForPeriod( period );
                if ( !mappedSubject ) return;
                period.subject = mappedSubject;
                updatedCount += 1;
            } );
        } );
    } );

    return updatedCount;
}

function processSubjectMappingCSV( csvData, fileName ) {
    const lines = csvData.split( '\n' ).filter( line => line.trim() !== '' );
    if ( lines.length < 2 ) {
        alert( "Subject mapping CSV is empty or has invalid format." );
        return;
    }

    const headerCells = parseCSVLine( lines[0] ).map( cell => toCleanString( cell ).toLowerCase() );
    const teacherNameIndex = headerCells.findIndex( h => h === 'teacher name' || h === 'teachername' );
    const teacherIdIndex = headerCells.findIndex( h => h === 'teacher id' || h === 'teacherid' || h === 'id' );
    const subjectIndex = headerCells.findIndex( h => h === 'subject' );

    if ( teacherNameIndex === -1 && teacherIdIndex === -1 ) {
        alert( "Subject mapping CSV must include Teacher Name or Teacher ID column." );
        return;
    }
    if ( subjectIndex === -1 ) {
        alert( "Subject mapping CSV must include Subject column." );
        return;
    }

    const parsedMap = {};
    let importedRows = 0;
    for ( let i = 1; i < lines.length; i++ ) {
        const cells = parseCSVLine( lines[i] );
        const teacherName = toCleanString( cells[teacherNameIndex] );
        const teacherId = toCleanString( cells[teacherIdIndex] );
        const subject = toCleanString( cells[subjectIndex] );
        if ( !subject ) continue;

        const key = buildTeacherSubjectMapKey( teacherName, teacherId );
        if ( !key ) continue;

        parsedMap[key] = subject;
        importedRows += 1;
    }

    if ( importedRows === 0 ) {
        alert( "No valid rows found in subject mapping CSV." );
        return;
    }

    state.teacherSubjectMap = {
        ...( state.teacherSubjectMap || {} ),
        ...parsedMap
    };
    saveTeacherSubjectMapToStorage();

    const updatedPeriods = autoFillMissingSubjectsFromTeacherMap();
    if ( updatedPeriods > 0 ) {
        saveTimetableToStorage();
        updateTimetableSummary();
        renderTimetable();
    }

    document.getElementById( 'uploadStatus' ).style.display = 'block';
    document.getElementById( 'uploadDetails' ).innerHTML = `
                <p><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Subject mapping uploaded successfully!</p>
                <p>Imported ${importedRows} teacher-subject mappings from ${fileName}. Auto-filled ${updatedPeriods} missing subjects.</p>
            `;
}

// Open time input modal
function openTimeInputModal( numPeriods ) {
    const container = document.getElementById( 'timeInputContainer' );
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

    for ( let i = 1; i <= numPeriods; i++ ) {
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
        document.getElementById( 'p1StartTime' ),
        document.getElementById( 'regularDuration' )
    ];
    commonInputs.forEach( input => {
        input.addEventListener( 'input', function () {
            refreshGeneratedPeriodTimes( numPeriods );
        } );
    } );

    for ( let i = 1; i <= numPeriods; i++ ) {
        const typeSelect = document.getElementById( `periodType-P${i}` );
        const specialDurationInput = document.getElementById( `specialDuration-P${i}` );
        const breakAfterInput = document.getElementById( `breakAfter-P${i}` );
        const specialWrap = document.getElementById( `specialDurationWrap-P${i}` );

        typeSelect.addEventListener( 'change', function () {
            specialWrap.style.display = this.value === 'special' ? 'block' : 'none';
            refreshGeneratedPeriodTimes( numPeriods );
        } );

        specialDurationInput.addEventListener( 'input', function () {
            refreshGeneratedPeriodTimes( numPeriods );
        } );

        breakAfterInput.addEventListener( 'input', function () {
            refreshGeneratedPeriodTimes( numPeriods );
        } );
    }

    refreshGeneratedPeriodTimes( numPeriods );
    document.getElementById( 'timeInputModal' ).classList.add( 'active' );
}

// Close time input modal
function closeTimeInputModal() {
    document.getElementById( 'timeInputModal' ).classList.remove( 'active' );
    state.tempCSVData = null;
    state.tempPeriodCount = 0;
}

function parseTimeToMinutes( value ) {
    if ( !value || typeof value !== 'string' || !value.includes( ':' ) ) return null;
    const parts = value.split( ':' );
    if ( parts.length !== 2 ) return null;

    const hours = Number( parts[0] );
    const minutes = Number( parts[1] );

    if ( !Number.isInteger( hours ) || !Number.isInteger( minutes ) ) return null;
    if ( hours < 0 || hours > 23 || minutes < 0 || minutes > 59 ) return null;

    return ( hours * 60 ) + minutes;
}

function formatMinutesToTime( totalMinutes ) {
    const normalized = ( ( totalMinutes % 1440 ) + 1440 ) % 1440;
    const hours = Math.floor( normalized / 60 );
    const minutes = normalized % 60;
    return `${hours.toString().padStart( 2, '0' )}:${minutes.toString().padStart( 2, '0' )}`;
}

function buildGeneratedPeriodPlan( numPeriods ) {
    const p1Start = document.getElementById( 'p1StartTime' ).value;
    const regularDuration = Number( document.getElementById( 'regularDuration' ).value );
    const startMinutes = parseTimeToMinutes( p1Start );

    if ( startMinutes === null ) {
        return { error: 'Please set a valid P1 start time.' };
    }

    if ( !Number.isFinite( regularDuration ) || regularDuration <= 0 ) {
        return { error: 'Regular period duration must be greater than 0.' };
    }

    const periodTimes = {};
    const periodTypes = {};
    const periodBreaks = {};
    let cursor = startMinutes;

    for ( let i = 1; i <= numPeriods; i++ ) {
        const periodKey = `P${i}`;
        const typeValue = document.getElementById( `periodType-${periodKey}` ).value;
        const isSpecial = typeValue === 'special';
        let duration = regularDuration;

        if ( isSpecial ) {
            const specialDuration = Number( document.getElementById( `specialDuration-${periodKey}` ).value );
            if ( !Number.isFinite( specialDuration ) || specialDuration <= 0 ) {
                return { error: `Special duration for ${periodKey} must be greater than 0.` };
            }
            duration = specialDuration;
        }

        const breakAfter = Number( document.getElementById( `breakAfter-${periodKey}` ).value );
        if ( !Number.isFinite( breakAfter ) || breakAfter < 0 ) {
            return { error: `Break after ${periodKey} must be 0 or greater.` };
        }

        const periodStart = cursor;
        const periodEnd = cursor + duration;

        periodTimes[periodKey] = `${formatMinutesToTime( periodStart )}-${formatMinutesToTime( periodEnd )}`;
        periodTypes[periodKey] = isSpecial ? 'Special' : 'Regular';
        periodBreaks[periodKey] = breakAfter;
        cursor = periodEnd + breakAfter;
    }

    return { periodTimes, periodTypes, periodBreaks };
}

function refreshGeneratedPeriodTimes( numPeriods ) {
    const plan = buildGeneratedPeriodPlan( numPeriods );

    for ( let i = 1; i <= numPeriods; i++ ) {
        const preview = document.getElementById( `timePreview-P${i}` );
        const periodKey = `P${i}`;
        if ( !preview ) continue;
        preview.textContent = plan.periodTimes ? plan.periodTimes[periodKey] : '--:--';
    }
}

// Save period times
function savePeriodTimes() {
    const numPeriods = state.tempPeriodCount;
    const plan = buildGeneratedPeriodPlan( numPeriods );

    if ( plan.error ) {
        alert( plan.error );
        return;
    }

    for ( let i = 1; i <= numPeriods; i++ ) {
        const periodKey = `P${i}`;
        state.periodTimes[periodKey] = plan.periodTimes[periodKey];
    }

    savePeriodTimesToStorage();

    // Now process the CSV data with times
    if ( state.tempCSVData ) {
        // Convert temp data to final format
        state.timetableData = {};

        state.tempCSVData.forEach( classData => {
            const className = classData.className;
            state.timetableData[className] = {
                className: className,
                days: []
            };

            classData.days.forEach( day => {
                const dayEntry = {
                    dayName: day.dayName,
                    periods: []
                };

                day.periods.forEach( period => {
                    const periodKey = `P${period.period}`;
                    const periodTime = state.periodTimes[periodKey] || getDefaultPeriodTime( period.period );
                    const periodType = plan.periodTypes[periodKey] || 'Regular';
                    const breakAfter = plan.periodBreaks[periodKey] || 0;

                    dayEntry.periods.push( {
                        period: period.period,
                        subject: period.subject,
                        teacherName: period.teacherName,
                        teacherId: period.teacherId,
                        time: periodTime,
                        type: periodType,
                        breakAfter: breakAfter
                    } );
                } );

                state.timetableData[className].days.push( dayEntry );
            } );
        } );

        assignTeacherIdsInTimetableData();
        autoFillMissingSubjectsFromTeacherMap();

        // Save to localStorage
        saveTimetableToStorage();

        // Update UI
        updateTimetableSummary();
        renderTimetable();

        // Show upload status
        document.getElementById( 'uploadStatus' ).style.display = 'block';
        document.getElementById( 'uploadDetails' ).innerHTML = `
                    <p><i class="fas fa-check-circle" style="color: var(--success-color);"></i> CSV Timetable uploaded successfully!</p>
                    <p>Processed ${state.tempCSVData.length} classes.</p>
                `;

        document.getElementById( 'timetableDataInfo' ).style.display = 'block';
    }

    // Update class filters
    updateClassFilters();

    // Close modal
    closeTimeInputModal();
}

// Get default period time
function getDefaultPeriodTime( periodNumber ) {
    const defaultTimings = [
        "09:40-10:20",
        "10:30-11:10",
        "11:10-11:50",
        "11:50-12:30",
        "13:00-13:40",
        "13:40-14:20",
        "14:20-15:00"
    ];

    if ( periodNumber >= 1 && periodNumber <= defaultTimings.length ) {
        return defaultTimings[periodNumber - 1];
    }

    const startHour = 15;
    const periodDuration = 40;

    let totalMinutes = ( startHour * 60 ) + ( ( periodNumber - 8 ) * periodDuration );

    const startHours = Math.floor( totalMinutes / 60 );
    const startMinutes = totalMinutes % 60;
    const endHours = Math.floor( ( totalMinutes + periodDuration ) / 60 );
    const endMinutes = ( totalMinutes + periodDuration ) % 60;

    return `${startHours.toString().padStart( 2, '0' )}:${startMinutes.toString().padStart( 2, '0' )}-${endHours.toString().padStart( 2, '0' )}:${endMinutes.toString().padStart( 2, '0' )}`;
}

// Get period time from stored times or default
function getPeriodTime( periodNumber ) {
    const periodKey = `P${periodNumber}`;
    if ( state.periodTimes && state.periodTimes[periodKey] ) {
        return state.periodTimes[periodKey];
    }
    return getDefaultPeriodTime( periodNumber );
}

function normalizeSubjectName( subject ) {
    return toCleanString( subject ).toLowerCase();
}

function normalizeFixedPeriods( fp ) {
    if ( !fp ) return '';
    return toCleanString( fp ).split( ',' ).map( s => {
        let trimmed = s.trim().toUpperCase();
        if ( /^\d+$/.test( trimmed ) ) return `P${trimmed}`;
        if ( /^\d+-\d+$/.test( trimmed ) ) {
            const parts = trimmed.split( '-' );
            return `P${parts[0]}-P${parts[1]}`;
        }
        // Also handle "P1 - P2" or "1 - 2"
        if ( /^[P]?\d+\s*-\s*[P]?\d+$/.test( trimmed ) ) {
            const parts = trimmed.split( '-' );
            const p1 = parts[0].trim().replace( /^P/, '' );
            const p2 = parts[1].trim().replace( /^P/, '' );
            return `P${p1}-P${p2}`;
        }
        return trimmed;
    } ).filter( Boolean ).join( ',' );
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

function getUniqueSubjectMap() {
    const subjectMap = new Map();
    if ( !state.timetableData ) return subjectMap;

    Object.keys( state.timetableData ).forEach( className => {
        const classData = state.timetableData[className];
        if ( !isValidTimetableClassData( classData ) ) return;

        classData.days.forEach( day => {
            day.periods.forEach( period => {
                const label = toCleanString( period.subject );
                const key = normalizeSubjectName( label );
                if ( key && !subjectMap.has( key ) ) {
                    subjectMap.set( key, label );
                }
            } );
        } );
    } );

    return subjectMap;
}

function getMultiSelectValues( selectId ) {
    const select = document.getElementById( selectId );
    if ( !select ) return [];
    return Array.from( select.selectedOptions )
        .map( option => option.value )
        .filter( value => value && value.trim() !== '' );
}

function createCheckboxDropdown( selectElement, placeholder = "Select options..." ) {
    const select = typeof selectElement === 'string' ? document.getElementById( selectElement ) : selectElement;
    if ( !select ) return;

    // Hide original select
    select.style.display = 'none';

    // Remove existing container if it exists
    if ( select.nextElementSibling && select.nextElementSibling.classList.contains( 'checkbox-dropdown-container' ) ) {
        select.nextElementSibling.remove();
    }

    // Create container
    const container = document.createElement( 'div' );
    container.className = 'checkbox-dropdown-container';
    container.style.position = 'relative';
    container.style.display = 'inline-block';
    container.style.width = '100%';

    // Create button
    const button = document.createElement( 'button' );
    button.type = 'button';
    button.className = 'form-control dropdown-toggle';
    button.style.width = '100%';
    button.style.textAlign = 'left';
    button.style.display = 'flex';
    button.style.justifyContent = 'space-between';
    button.style.alignItems = 'center';
    button.style.whiteSpace = 'nowrap';
    button.style.overflow = 'hidden';
    button.style.textOverflow = 'ellipsis';

    const updateButtonText = () => {
        const selectedOptions = Array.from( select.options ).filter( opt => opt.selected && opt.value );
        button.querySelector( 'span' ).textContent = selectedOptions.length > 0 ? selectedOptions.length + ' selected' : placeholder;
    };

    button.innerHTML = `<span></span> <i class="fas fa-chevron-down"></i>`;
    updateButtonText();

    const dropdown = document.createElement( 'div' );
    dropdown.className = 'multiselect-dropdown-content';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.right = '0';
    dropdown.style.background = '#fff';
    dropdown.style.border = '1px solid #ddd';
    dropdown.style.borderTop = 'none';
    dropdown.style.maxHeight = '250px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.zIndex = '1000';
    dropdown.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';

    Array.from( select.options ).forEach( opt => {
        if ( !opt.value ) return;
        const label = document.createElement( 'label' );
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.padding = '8px 12px';
        label.style.cursor = 'pointer';
        label.style.borderBottom = '1px solid #eee';
        label.style.gap = '8px';
        label.style.margin = '0';

        const checkbox = document.createElement( 'input' );
        checkbox.type = 'checkbox';
        checkbox.value = opt.value;
        checkbox.checked = opt.selected;

        checkbox.addEventListener( 'change', ( e ) => {
            opt.selected = e.target.checked;
            updateButtonText();
            select.dispatchEvent( new Event( 'change' ) );
        } );

        label.appendChild( checkbox );
        label.appendChild( document.createTextNode( opt.text ) );
        dropdown.appendChild( label );

        label.addEventListener( 'mouseenter', () => label.style.background = '#f8fafc' );
        label.addEventListener( 'mouseleave', () => label.style.background = '#fff' );
    } );

    button.addEventListener( 'click', ( e ) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        document.querySelectorAll( '.multiselect-dropdown-content' ).forEach( d => d.style.display = 'none' );

        if ( !isOpen ) {
            const rect = button.getBoundingClientRect();
            dropdown.style.top = ( rect.bottom + window.scrollY ) + 'px';
            dropdown.style.left = ( rect.left + window.scrollX ) + 'px';
            dropdown.style.width = rect.width + 'px';
            dropdown.style.display = 'block';
        }
    } );

    dropdown.addEventListener( 'click', ( e ) => {
        e.stopPropagation();
    } );

    // Remove the old dropdown if it was appended to the body before
    if ( select._checkboxDropdown ) {
        select._checkboxDropdown.remove();
    }
    select._checkboxDropdown = dropdown;

    container.appendChild( button );
    document.body.appendChild( dropdown );

    select.parentNode.insertBefore( container, select.nextSibling );
}

document.addEventListener( 'click', () => {
    document.querySelectorAll( '.multiselect-dropdown-content' ).forEach( d => d.style.display = 'none' );
} );

// Close dropdowns when scrolling inside the table wrapper or the window
window.addEventListener( 'scroll', ( e ) => {
    // Do not close if the scroll event originated from within the dropdown itself
    if ( e.target && e.target.classList && e.target.classList.contains( 'multiselect-dropdown-content' ) ) {
        return;
    }
    document.querySelectorAll( '.multiselect-dropdown-content' ).forEach( d => d.style.display = 'none' );
}, true ); // Use capture phase to catch scrolls on any element

// Update timetable summary
function updateTimetableSummary() {
    if ( !state.timetableData ) return;

    const classes = Object.keys( state.timetableData );
    let periodsCount = 0;
    const teachers = new Set();
    const subjects = new Set();

    classes.forEach( className => {
        const classData = state.timetableData[className];
        if ( classData && classData.days ) {
            classData.days.forEach( day => {
                ( day.periods || [] ).forEach( period => {
                    const hasSubject = toCleanString( period.subject ) !== '';
                    const hasTeacher = toCleanString( period.teacherName ) !== '';
                    const hasTeacherId = String( period.teacherId || '' ).trim() !== '';

                    if ( hasSubject || hasTeacher || hasTeacherId ) {
                        periodsCount++;
                    }
                    if ( hasTeacher ) {
                        teachers.add( toCleanString( period.teacherName ) );
                    }
                    if ( hasSubject ) {
                        subjects.add( toCleanString( period.subject ) );
                    }
                } );
            } );
        }
    } );

    document.getElementById( 'classesCount' ).textContent = classes.length;
    document.getElementById( 'periodsCount' ).textContent = periodsCount;
    document.getElementById( 'teachersCount' ).textContent = teachers.size;
    document.getElementById( 'subjectsCount' ).textContent = subjects.size;

    // Update class filters
    updateClassFilters();
}

// Update class filters
function updateClassFilters() {
    if ( !state.timetableData ) return;

    // 1. Collect class names
    const classSet = new Set();
    Object.keys( state.timetableData ).forEach( c => classSet.add( c ) );
    ( state.classSections || [] ).forEach( c => {
        if ( !c ) return;
        classSet.add( c.className || ( typeof c === 'string' ? c : `${c.class || ''}-${c.section || ''}` ) );
    } );
    const classes = Array.from( classSet ).sort( ( a, b ) => compareGradeSection( a, b ) );

    // 2. Populate classFilter, modifyClassFilter, and teacherScheduleFilter
    const classFilter = document.getElementById( 'classFilter' );
    const modifyClassFilter = document.getElementById( 'modifyClassFilter' );
    const teacherScheduleFilter = document.getElementById( 'teacherScheduleFilter' );
    
    const selectedClasses = getMultiSelectValues( 'classFilter' );

    classFilter.innerHTML = classes.map( className => {
        const isSelected = selectedClasses.includes( className ) ? ' selected' : '';
        return `<option value="${escapeHtmlAttribute(className)}"${isSelected}>${escapeHtml(className)}</option>`;
    } ).join( '' );
    
    if ( selectedClasses.length === 0 ) {
        classFilter.selectedIndex = -1;
    }

    modifyClassFilter.innerHTML = '<option value="">Select Class</option>' + classes.map( className => 
        `<option value="${escapeHtmlAttribute(className)}">${escapeHtml(className)}</option>`
    ).join( '' );

    // Wait, the user grouped teacherScheduleFilter with classFilter! Are they sure they meant classes for teacherScheduleFilter?
    // In the previous version, teacherScheduleFilter was populated with teachers. I'll populate it with teachers, but keep it in the same logical block if needed.
    // Let's populate teacherScheduleFilter with teachers as it was before, otherwise it breaks its purpose.

    // 3. Populate teacherFilter and subjectFilter (and teacherScheduleFilter with teachers)
    const teachers = new Set();
    Object.keys( state.timetableData ).forEach( className => {
        const classData = state.timetableData[className];
        if ( classData && classData.days ) {
            classData.days.forEach( day => {
                ( day.periods || [] ).forEach( period => {
                    const teacherLabel = toCleanString( period.teacherName );
                    if ( teacherLabel ) teachers.add( teacherLabel );
                } );
            } );
        }
    } );
    const sortedTeachers = Array.from( teachers ).sort( ( a, b ) => safeLocaleCompare( a, b ) );

    const teacherFilter = document.getElementById( 'teacherFilter' );
    const selectedTeachers = getMultiSelectValues( 'teacherFilter' );
    teacherFilter.innerHTML = sortedTeachers.map( teacher => {
        const isSelected = selectedTeachers.includes( teacher ) ? ' selected' : '';
        return `<option value="${escapeHtmlAttribute(teacher)}"${isSelected}>${escapeHtml(teacher)}</option>`;
    } ).join( '' );
    if ( selectedTeachers.length === 0 ) {
        teacherFilter.selectedIndex = -1;
    }

    teacherScheduleFilter.innerHTML = '<option value="">Select Teacher</option>' + sortedTeachers.map( teacher => 
        `<option value="${escapeHtmlAttribute(teacher)}">${escapeHtml(teacher)}</option>`
    ).join( '' );

    const subjectFilter = document.getElementById( 'subjectFilter' );
    const selectedSubjects = getMultiSelectValues( 'subjectFilter' );
    const uniqueSubjects = Array.from( getUniqueSubjectMap().entries() ).sort( ( a, b ) => safeLocaleCompare( a[1], b[1] ) );
    
    subjectFilter.innerHTML = uniqueSubjects.map( ( [subjectKey, subjectLabel] ) => {
        const isSelected = selectedSubjects.includes( subjectKey ) ? ' selected' : '';
        return `<option value="${escapeHtmlAttribute(subjectKey)}"${isSelected}>${escapeHtml(subjectLabel)}</option>`;
    } ).join( '' );
    
    if ( selectedSubjects.length === 0 ) {
        subjectFilter.selectedIndex = -1;
    }

    // 4. Call createCheckboxDropdown() afterward
    createCheckboxDropdown( 'classFilter', 'Select Classes' );
    createCheckboxDropdown( 'teacherFilter', 'Select Teachers' );
    createCheckboxDropdown( 'subjectFilter', 'Select Subjects' );
}

// Render timetable
function renderTimetable() {
    const timetableDisplay = document.getElementById( 'timetableDisplay' );

    if ( !state.timetableData || Object.keys(state.timetableData).length === 0 ) {
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
        document.getElementById( 'goToUploadBtn' )?.addEventListener( 'click', () => {
            document.querySelector( '.tab[data-target="upload-timetable-section"]' )?.click();
        } );
        return;
    }

    let html = '';

    switch ( state.currentView ) {
        case 'class':
            const classFilters = getMultiSelectValues( 'classFilter' );
            const classesToShow = classFilters.length > 0 ? classFilters : Object.keys( state.timetableData );
            html = classesToShow.map( className => {
                const classData = state.timetableData[className];
                if ( !isValidTimetableClassData( classData ) ) return '';
                return `
                    <h3 style="margin: 20px 0 10px 15px;">${escapeHtml(className)}</h3>
                    ${generateTimetableHTML( classData )}
                `;
            }).join('');
            break;
            
        case 'teacher':
            const teacherFilters = getMultiSelectValues( 'teacherFilter' );
            html = renderTeacherTimetableHTML( teacherFilters );
            break;
            
        case 'subject':
            const subjectFilters = getMultiSelectValues( 'subjectFilter' );
            html = renderSubjectTimetableHTML( subjectFilters );
            break;
            
        default:
            html = '<div class="empty-state"><p>Please select a valid view mode.</p></div>';
            break;
    }

    timetableDisplay.innerHTML = html;
    
    if ( typeof addEditListeners === 'function' ) {
        addEditListeners();
    }
}

function isRealBreakPeriod( periodEntry ) {
    return periodEntry && periodEntry.type === 'Break';
}

// Generate timetable HTML
function generateTimetableHTML( classData ) {
    if ( !classData || !classData.days || classData.days.length === 0 ) {
        return '<p>No timetable data for this class.</p>';
    }

    // Determine number of periods from the first day
    const numPeriods = classData.days[0].periods.length;
    const headerDay = classData.days[0];
    const showBreakAfterPeriod = {};

    for ( let i = 0; i < numPeriods; i++ ) {
        const period = headerDay.periods[i];
        showBreakAfterPeriod[i + 1] = i < numPeriods - 1 && Number( period?.breakAfter || 0 ) > 0;
    }

    let html = '<table class="timetable">';

    // Header row
    html += '<thead><tr><th>Day/Period</th>';
    for ( let i = 1; i <= numPeriods; i++ ) {
        const periodTime = toCleanString( headerDay.periods[i - 1]?.time );
        const periodTimeHtml = periodTime ? `<div class="period-header-time">${periodTime}</div>` : '';
        html += `<th><div>P${i}</div>${periodTimeHtml}</th>`;
        if ( showBreakAfterPeriod[i] ) {
            html += `<th class="break-header">Break</th>`;
        }
    }
    html += '</tr></thead><tbody>';

    // Data rows - sort days in correct order
    const dayOrder = getAllActiveDays();

    dayOrder.forEach( dayName => {
        const dayData = classData.days.find( d => d.dayName === dayName );

        if ( !dayData ) return;

        html += `<tr><td style="font-weight: 600; background-color: #f9f9f9;">${dayName}</td>`;

        dayData.periods.forEach( period => {
            // Check if this is a holiday
            const isHoliday = isDateHoliday( dayName );
            const hasSubject = toCleanString( period.subject ) !== '';
            const hasTeacher = toCleanString( period.teacherName ) !== '';

            const cellKey = `${classData.className}|${dayName}|${period.period}`;
            const isEdited = state.editedCells && state.editedCells[cellKey];
            const editedClass = isEdited ? 'edited-cell' : '';
            const editedIndicator = isEdited ? '<div class="edited-indicator">Edited</div>' : '';
            const editIconHtml = `<div class="cell-edit-icon"><i class="fas fa-edit"></i></div>`;

            if ( isHoliday ) {
                html += `<td class="holiday-cell">HOLIDAY</td>`;
            } else {
                const overlapClass = period.overlap ? 'overlap' : '';
                const overlapTooltip = period.overlapInfo || 'Teacher overlap detected.';
                const overlapWarningHtml = period.overlap
                    ? `<div class="overlap-warning" title="${escapeHtmlAttribute( overlapTooltip )}" aria-label="${escapeHtmlAttribute( overlapTooltip )}"><i class="fas fa-exclamation-triangle"></i></div>`
                    : '';

                let subjectHtmlText;
                let teacherHtmlText;
                let cellClassExtension = '';

                if ( isRealBreakPeriod( period ) ) {
                    subjectHtmlText = `<div class="period-subject">BREAK</div>`;
                    teacherHtmlText = `<div class="period-teacher">No Teacher</div>`;
                    cellClassExtension = 'break-cell';
                } else if ( !hasSubject && !hasTeacher ) {
                    subjectHtmlText = `<div class="period-subject">UNFILLED</div>`;
                    teacherHtmlText = `<div class="period-teacher">No Teacher</div>`;
                } else {
                    subjectHtmlText = hasSubject
                        ? `<div class="period-subject">${period.subject}</div>`
                        : `<div class="period-subject subject-missing" title="No subject assigned" aria-label="No subject assigned">🟡</div>`;
                    teacherHtmlText = hasTeacher
                        ? `<div class="period-teacher">${period.teacherName}</div>`
                        : `<div class="period-teacher">No Teacher</div>`;
                }

                html += `
                            <td class="period-cell ${cellClassExtension} ${overlapClass} ${editedClass}" data-class="${classData.className}" data-day="${dayName}" data-period="${period.period}">
                                ${editIconHtml}
                                ${overlapWarningHtml}
                                ${editedIndicator}
                                ${subjectHtmlText}
                                ${teacherHtmlText}
                            </td>
                        `;
            }

            if ( showBreakAfterPeriod[period.period] ) {
                const breakAfter = Number( period.breakAfter || 0 );
                const breakCellHtml = breakAfter > 0
                    ? `<div class="break-cell-title">BREAK</div><div class="break-cell-time">${breakAfter} min</div>`
                    : `<div class="break-cell-title">-</div>`;
                html += `<td class="inter-period-break-cell">${breakCellHtml}</td>`;
            }
        } );

        html += '</tr>';
    } );

    html += '</tbody></table>';
    return html;
}

// Generate teacher timetable HTML
function renderTeacherTimetableHTML( teacherFilters ) {
    if ( !teacherFilters || teacherFilters.length === 0 ) {
        return '<div class="empty-state"><p>Please select one or more teachers to view their schedules.</p></div>';
    }

    if ( !state.timetableData ) return '<p>No timetable data.</p>';

    return teacherFilters.map( teacherFilter => {
        const dayOrder = getAllActiveDays();
        const teacherGrid = {};
        dayOrder.forEach( day => { teacherGrid[day] = {}; } );

        let maxPeriods = 0;
        let hasAnyEntry = false;

        Object.keys( state.timetableData ).forEach( className => {
            const classData = state.timetableData[className];
            classData.days.forEach( day => {
                maxPeriods = Math.max( maxPeriods, day.periods.length );
                day.periods.forEach( period => {
                    if ( period.teacherName === teacherFilter ) {
                        hasAnyEntry = true;
                        if ( !teacherGrid[day.dayName] ) teacherGrid[day.dayName] = {};
                        if ( !teacherGrid[day.dayName][period.period] ) teacherGrid[day.dayName][period.period] = [];
                        teacherGrid[day.dayName][period.period].push( {
                            className,
                            subject: toCleanString( period.subject )
                        } );
                    }
                } );
            } );
        } );

        if ( !hasAnyEntry ) {
            return `<div class="empty-state"><p>No schedule found for teacher: ${escapeHtml(teacherFilter)}</p></div>`;
        }

        let maxPeriodsArray = Array.from({length: maxPeriods}, (_, i) => i + 1);

        const headerHtml = maxPeriodsArray.map( i => {
            const headerTime = getPeriodTime( i );
            return `<th><div>P${i}</div><div class="period-header-time">${headerTime}</div></th>`;
        }).join('');

        const bodyHtml = dayOrder.map( dayName => {
            const rowCells = maxPeriodsArray.map( p => {
                const entries = ( teacherGrid[dayName] && teacherGrid[dayName][p] ) ? teacherGrid[dayName][p] : [];
                let periodInfo = '';

                if ( entries.length > 0 ) {
                    const periodText = entries.map( entry =>
                        `${escapeHtml(entry.className)}: ${entry.subject ? escapeHtml(entry.subject) : `<span class="no-subject-marker" title="No subject assigned" aria-label="No subject assigned">🟡</span>`}`
                    ).join( '<br>' );

                    periodInfo = `<div class="period-subject">${periodText}</div>`;
                }

                return `<td class="period-cell">${periodInfo}</td>`;
            }).join('');

            return `<tr><td style="font-weight: 600; background-color: #f9f9f9;">${dayName}</td>${rowCells}</tr>`;
        }).join('');

        return `
            <h3 style="margin: 20px 0 10px 15px;">Schedule for ${escapeHtml(teacherFilter)}</h3>
            <table class="timetable">
                <thead><tr><th>Day/Period</th>${headerHtml}</tr></thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        `;
    } ).join('');
}

// Generate subject timetable HTML
function renderSubjectTimetableHTML( subjectFilterKeys ) {
    if ( !subjectFilterKeys || subjectFilterKeys.length === 0 ) {
        return '<div class="empty-state"><p>Please select one or more subjects to view schedules.</p></div>';
    }

    if ( !state.timetableData ) return '<p>No timetable data.</p>';

    return subjectFilterKeys.map( subjectFilterKey => {
        const subjectLabel = getUniqueSubjectMap().get( subjectFilterKey ) || subjectFilterKey;
        const subjectClasses = {};
        const classNames = Object.keys( state.timetableData );

        classNames.forEach( className => {
            const classData = state.timetableData[className];
            classData.days.forEach( day => {
                day.periods.forEach( period => {
                    if ( normalizeSubjectName( period.subject ) === subjectFilterKey ) {
                        if ( !subjectClasses[className] ) subjectClasses[className] = {};
                        if ( !subjectClasses[className][day.dayName] ) subjectClasses[className][day.dayName] = [];
                        subjectClasses[className][day.dayName].push( period );
                    }
                } );
            } );
        } );

        const classes = Object.keys( subjectClasses );
        if ( classes.length === 0 ) {
            return `<div class="empty-state"><p>No schedule found for subject: ${escapeHtml(subjectLabel)}</p></div>`;
        }

        const headerHtml = classes.map( className => `<th>${escapeHtml(className)}</th>` ).join('');
        const dayOrder = getAllActiveDays();

        const bodyHtml = dayOrder.map( dayName => {
            const rowCells = classes.map( className => {
                const dayPeriods = subjectClasses[className][dayName] || [];
                let periodInfo = '';

                if ( dayPeriods.length > 0 ) {
                    const periodText = dayPeriods.map( p => `P${p.period}: ${escapeHtml(p.teacherName)}` ).join( '<br>' );
                    periodInfo = `<div class="period-subject">${periodText}</div>`;
                }

                return `<td class="period-cell">${periodInfo}</td>`;
            }).join('');

            return `<tr><td style="font-weight: 600; background-color: #f9f9f9;">${dayName}</td>${rowCells}</tr>`;
        }).join('');

        return `
            <h3 style="margin: 20px 0 10px 15px;">Schedule for ${escapeHtml(subjectLabel)}</h3>
            <table class="timetable">
                <thead><tr><th>Day/Period</th>${headerHtml}</tr></thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        `;
    } ).join('');
}

// Check if a date is a holiday
function isDateHoliday( dayName ) {
    // Only use configured holiday data; do not auto-mark weekends.
    const normalizedDay = toCleanString( dayName ).toLowerCase();
    return state.holidays.some( holiday => {
        if ( !holiday ) return false;
        const holidayDayName = toCleanString( holiday.dayName || holiday.weekday || '' ).toLowerCase();
        return holidayDayName && holidayDayName === normalizedDay;
    } );
}

function updateOverlapProgress( label, percent, visible ) {
    const progressWrap = document.getElementById( 'overlapProgress' );
    const progressLabel = document.getElementById( 'overlapProgressLabel' );
    const progressBar = document.getElementById( 'overlapProgressBar' );

    if ( visible ) {
        progressWrap.style.display = 'block';
        progressLabel.textContent = label;
        progressBar.style.width = `${Math.max( 0, Math.min( 100, percent ) )}%`;
    } else {
        progressWrap.style.display = 'none';
        progressBar.style.width = '0%';
    }
}

function delayFrame() {
    return new Promise( resolve => setTimeout( resolve, 0 ) );
}

// Check for overlaps in the timetable with visible progress
async function checkForOverlaps() {
    if ( !state.timetableData ) return 0;

    const records = [];
    Object.keys( state.timetableData ).forEach( className => {
        const classData = state.timetableData[className];
        classData.days.forEach( day => {
            day.periods.forEach( period => {
                records.push( {
                    className,
                    dayName: day.dayName,
                    periodNumber: period.period,
                    period
                } );
            } );
        } );
    } );

    const totalRecords = records.length;
    if ( totalRecords === 0 ) return 0;

    const chunkSize = 250;
    const teacherSchedule = new Map();

    updateOverlapProgress( 'Preparing overlap scan...', 0, true );

    for ( let i = 0; i < totalRecords; i++ ) {
        const { period } = records[i];
        period.overlap = false;
        period.overlapInfo = '';

        if ( ( i + 1 ) % chunkSize === 0 || i === totalRecords - 1 ) {
            const progress = ( ( i + 1 ) / totalRecords ) * 35;
            updateOverlapProgress( 'Preparing overlap scan...', progress, true );
            await delayFrame();
        }
    }

    for ( let i = 0; i < totalRecords; i++ ) {
        const current = records[i];
        const period = current.period;

        if ( period.teacherName && period.teacherName !== '' && period.subject ) {
            const key = `${current.dayName}-${period.time}-${period.teacherName}`;
            if ( !teacherSchedule.has( key ) ) {
                teacherSchedule.set( key, [] );
            }
            teacherSchedule.get( key ).push( current );
        }

        if ( ( i + 1 ) % chunkSize === 0 || i === totalRecords - 1 ) {
            const progress = 35 + ( ( ( i + 1 ) / totalRecords ) * 45 );
            updateOverlapProgress( 'Analyzing teacher schedules...', progress, true );
            await delayFrame();
        }
    }

    const overlapGroups = Array.from( teacherSchedule.values() ).filter( group => {
        if ( group.length <= 1 ) return false;
        const distinctKeys = new Set();
        group.forEach( item => {
            const classMeta = ( state.classSections || [] ).find( c => c.className === item.className );
            const mapping = ( state.teacherMappings || [] ).find( m =>
                m.teacherName === item.period.teacherName &&
                m.subject === item.period.subject &&
                ( m.gradeSection === item.className || ( m.gradeSection && m.gradeSection.includes( item.className ) ) )
            );

            let keyToUse = item.className;
            if ( mapping && mapping.mode === 'combined' && mapping.combinedGroupId ) {
                keyToUse = mapping.combinedGroupId;
            } else if ( classMeta && classMeta.teachingMode === 'combined' && classMeta.combinedGroupId ) {
                keyToUse = classMeta.combinedGroupId;
            }
            item.schedulingKey = keyToUse;
            distinctKeys.add( keyToUse );
        } );
        return distinctKeys.size > 1;
    } );
    const totalGroups = overlapGroups.length;
    let overlapCount = 0;

    if ( totalGroups === 0 ) {
        updateOverlapProgress( 'No overlaps found.', 100, true );
        await delayFrame();
        return 0;
    }

    for ( let i = 0; i < totalGroups; i++ ) {
        const group = overlapGroups[i];

        group.forEach( item => {
            item.period.overlap = true;
            overlapCount++;

            const otherConflicts = group
                .filter( other => other.schedulingKey !== item.schedulingKey )
                .map( other => `${other.className} (${other.dayName} P${other.periodNumber})` );

            item.period.overlapInfo = `Teacher ${item.period.teacherName} also has ${otherConflicts.join( ', ' )} at ${item.period.time}.`;
        } );

        if ( ( i + 1 ) % 20 === 0 || i === totalGroups - 1 ) {
            const progress = 80 + ( ( ( i + 1 ) / totalGroups ) * 20 );
            updateOverlapProgress( 'Marking overlaps...', progress, true );
            await delayFrame();
        }
    }

    updateOverlapProgress( `Overlap scan complete. ${overlapCount} conflicting periods found.`, 100, true );
    await delayFrame();
    return overlapCount;
}

async function runOverlapCheckWithProgress() {
    if ( !state.timetableData ) {
        alert( "No timetable data loaded." );
        return;
    }

    if ( state.overlapCheckInProgress ) return;
    state.overlapCheckInProgress = true;

    const checkBtn = document.getElementById( 'checkOverlapsBtn' );
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
        setTimeout( () => updateOverlapProgress( '', 0, false ), 900 );
    }
}


async function exportOverlapsCSV() {
    if ( !state.timetableData ) {
        alert( "No timetable data loaded." );
        return;
    }

    if ( state.overlapCheckInProgress ) return;
    state.overlapCheckInProgress = true;

    const exportBtn = document.getElementById( 'exportOverlapsBtn' );
    const originalLabel = exportBtn.innerHTML;
    const checkBtn = document.getElementById( 'checkOverlapsBtn' );
    const originalCheckLabel = checkBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
    checkBtn.disabled = true;
    checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

    try {
        await checkForOverlaps();
        renderTimetable();

        const overlapRows = [];
        Object.keys( state.timetableData ).forEach( className => {
            const classData = state.timetableData[className];
            classData.days.forEach( day => {
                day.periods.forEach( period => {
                    if ( period.overlap ) {
                        overlapRows.push( {
                            className,
                            day: day.dayName,
                            period: `P${period.period}`,
                            teacher: period.teacherName || '',
                            subject: period.subject || '',
                            time: period.time || '',
                            overlapInfo: period.overlapInfo || ''
                        } );
                    }
                } );
            } );
        } );

        if ( overlapRows.length === 0 ) {
            alert( "No overlaps found to export." );
            return;
        }

        let csv = 'Class,Day,Period,Teacher,Subject,Time,Conflict Details\n';
        overlapRows.forEach( row => {
            csv += [
                escapeCsvField( row.className ),
                escapeCsvField( row.day ),
                escapeCsvField( row.period ),
                escapeCsvField( row.teacher ),
                escapeCsvField( row.subject ),
                escapeCsvField( row.time ),
                escapeCsvField( row.overlapInfo )
            ].join( ',' ) + '\n';
        } );

        const blob = new Blob( [csv], { type: 'text/csv' } );
        const url = URL.createObjectURL( blob );
        const a = document.createElement( 'a' );
        a.href = url;
        a.download = 'timetable_overlaps.csv';
        document.body.appendChild( a );
        a.click();
        document.body.removeChild( a );
        URL.revokeObjectURL( url );
    } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalLabel;
        checkBtn.disabled = false;
        checkBtn.innerHTML = originalCheckLabel;
        state.overlapCheckInProgress = false;
        setTimeout( () => updateOverlapProgress( '', 0, false ), 900 );
    }
}

// Export timetable
function exportTimetable() {
    if ( !state.timetableData ) {
        alert( "No timetable data to export." );
        return;
    }

    // Ask for export format
    const format = prompt( "Export as Excel or CSV? (Enter 'excel' or 'csv')", "excel" );

    if ( !format || ( format !== 'excel' && format !== 'csv' ) ) {
        alert( "Invalid format selected." );
        return;
    }

    if ( format === 'excel' ) {
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
    Object.keys( state.timetableData ).forEach( className => {
        const classData = state.timetableData[className];

        // Create header row
        const header = ['Day'];
        const numPeriods = classData.days[0].periods.length;

        for ( let i = 1; i <= numPeriods; i++ ) {
            header.push( `P${i} Subject`, `P${i} Teacher Name`, `P${i} Teacher ID`, `P${i} Time`, `P${i} Type` );
        }

        const data = [header];

        // Add each day's data
        const dayOrder = getAllActiveDays();

        dayOrder.forEach( dayName => {
            const dayData = classData.days.find( d => d.dayName === dayName );
            if ( !dayData ) return;

            const row = [dayName];

            dayData.periods.forEach( period => {
                row.push( period.subject || '' );
                row.push( period.teacherName || '' );
                row.push( period.teacherId || '' );
                row.push( period.time || '' );
                row.push( period.type || 'Regular' );
            } );

            data.push( row );
        } );

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet( data );
        XLSX.utils.book_append_sheet( wb, ws, className );
    } );

    let maxPeriods = 0;
    Object.keys( state.timetableData ).forEach( className => {
        state.timetableData[className].days.forEach( dayData => {
            maxPeriods = Math.max( maxPeriods, dayData.periods.length );
        });
    });
    const dayOrder = getAllActiveDays();

    // Teacher-wise Master Sheet
    const teacherGrid = {};
    Object.keys( state.timetableData ).forEach( className => {
        state.timetableData[className].days.forEach( dayData => {
            dayData.periods.forEach( period => {
                if (period.teacherName) {
                    const t = period.teacherName;
                    if (!teacherGrid[t]) teacherGrid[t] = {};
                    if (!teacherGrid[t][dayData.dayName]) teacherGrid[t][dayData.dayName] = {};
                    if (!teacherGrid[t][dayData.dayName][period.period]) teacherGrid[t][dayData.dayName][period.period] = [];
                    teacherGrid[t][dayData.dayName][period.period].push(`${className} (${period.subject || 'No Subject'})`);
                }
            });
        });
    });
    
    const teacherMasterData = [['Teacher', 'Day']];
    for ( let i = 1; i <= maxPeriods; i++ ) teacherMasterData[0].push(`P${i}`);
    
    Object.keys(teacherGrid).sort().forEach(teacher => {
        let addedTeacher = false;
        dayOrder.forEach( dayName => {
            const row = [teacher, dayName];
            let hasData = false;
            for (let i = 1; i <= maxPeriods; i++) {
                if (teacherGrid[teacher][dayName] && teacherGrid[teacher][dayName][i]) {
                    row.push(teacherGrid[teacher][dayName][i].join(' & '));
                    hasData = true;
                } else {
                    row.push('');
                }
            }
            if (hasData) {
                teacherMasterData.push(row);
                addedTeacher = true;
            }
        });
        if (addedTeacher) {
            teacherMasterData.push([]); // Gap between sections
        }
    });
    XLSX.utils.book_append_sheet( wb, XLSX.utils.aoa_to_sheet( teacherMasterData ), "All Teachers" );

    // Subject-wise Master Sheet
    const subjectGrid = {};
    Object.keys( state.timetableData ).forEach( className => {
        state.timetableData[className].days.forEach( dayData => {
            dayData.periods.forEach( period => {
                if (period.subject) {
                    const s = period.subject;
                    if (!subjectGrid[s]) subjectGrid[s] = {};
                    if (!subjectGrid[s][dayData.dayName]) subjectGrid[s][dayData.dayName] = {};
                    if (!subjectGrid[s][dayData.dayName][period.period]) subjectGrid[s][dayData.dayName][period.period] = [];
                    subjectGrid[s][dayData.dayName][period.period].push(`${className} (${period.teacherName || 'No Teacher'})`);
                }
            });
        });
    });
    
    const subjectMasterData = [['Subject', 'Day']];
    for ( let i = 1; i <= maxPeriods; i++ ) subjectMasterData[0].push(`P${i}`);
    
    Object.keys(subjectGrid).sort().forEach(subject => {
        let addedSubject = false;
        dayOrder.forEach( dayName => {
            const row = [subject, dayName];
            let hasData = false;
            for (let i = 1; i <= maxPeriods; i++) {
                if (subjectGrid[subject][dayName] && subjectGrid[subject][dayName][i]) {
                    row.push(subjectGrid[subject][dayName][i].join(' & '));
                    hasData = true;
                } else {
                    row.push('');
                }
            }
            if (hasData) {
                subjectMasterData.push(row);
                addedSubject = true;
            }
        });
        if (addedSubject) {
            subjectMasterData.push([]); // Gap between sections
        }
    });
    XLSX.utils.book_append_sheet( wb, XLSX.utils.aoa_to_sheet( subjectMasterData ), "All Subjects" );

    // Generate and download file
    XLSX.writeFile( wb, 'school_timetable_export.xlsx' );
}

// Export to CSV (new format)
function exportToCSV() {
    let csv = 'Class-Section,Day';

    // Get number of periods from first class
    const firstClass = Object.keys( state.timetableData ).find( className =>
        isValidTimetableClassData( state.timetableData[className] )
    );
    if ( !firstClass ) return;

    const numPeriods = state.timetableData[firstClass].days[0].periods.length;

    // Add period headers
    for ( let i = 1; i <= numPeriods; i++ ) {
        csv += `,P${i}`;
    }
    csv += '\n';

    // Add data for each class
    Object.keys( state.timetableData ).forEach( className => {
        const classData = state.timetableData[className];
        if ( !isValidTimetableClassData( classData ) ) return;

        const dayOrder = getAllActiveDays();

        dayOrder.forEach( dayName => {
            const dayData = classData.days.find( d => d.dayName === dayName );
            if ( !dayData ) return;

            csv += `${className},${dayName}`;

            dayData.periods.forEach( period => {
                if ( period.subject || period.teacherName || period.teacherId ) {
                    csv += `,${period.teacherId || ''}:${period.teacherName}:${period.subject}`;
                } else {
                    csv += ',';
                }
            } );

            csv += '\n';
        } );
    } );

    // Create download link
    const blob = new Blob( [csv], { type: 'text/csv' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'school_timetable.csv';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

// Download template
function downloadTemplate() {
    if ( state.fileType === 'excel' ) {
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

    classes.forEach( className => {
        // Create header row
        const header = [
            'Day', 'P1 Subject', 'P1 Teacher Name', 'P1 Teacher ID', 'P1 Time', 'P1 Type',
            'P2 Subject', 'P2 Teacher Name', 'P2 Teacher ID', 'P2 Time', 'P2 Type',
            'P3 Subject', 'P3 Teacher Name', 'P3 Teacher ID', 'P3 Time', 'P3 Type',
            'P4 Subject', 'P4 Teacher Name', 'P4 Teacher ID', 'P4 Time', 'P4 Type',
            'P5 Subject', 'P5 Teacher Name', 'P5 Teacher ID', 'P5 Time', 'P5 Type',
            'P6 Subject', 'P6 Teacher Name', 'P6 Teacher ID', 'P6 Time', 'P6 Type',
            'P7 Subject', 'P7 Teacher Name', 'P7 Teacher ID', 'P7 Time', 'P7 Type'
        ];

        const data = [header];

        // Add days
        const days = getAllActiveDays();

        days.forEach( day => {
            const row = [day];

            // Add sample periods
            for ( let i = 1; i <= 7; i++ ) {
                if ( i === 4 ) {
                    // Break period
                    row.push( 'BREAK', '', '', '11:50-12:30', 'Regular' );
                } else {
                    const timeStr = getPeriodTime(i);
                    row.push( 'Mathematics', 'John Doe', '17PVSS0001', timeStr, 'Regular' );
                }
            }

            data.push( row );
        } );

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet( data );
        XLSX.utils.book_append_sheet( wb, ws, className );
    } );

    // Generate and download file
    XLSX.writeFile( wb, 'timetable_template.xlsx' );
}

// Download CSV template
function downloadCSVTemplate() {
    // Create CSV template with sample data
    const periodHeaders = makePeriodHeaders();
    let csv = `Class-Section,Day,${periodHeaders.join( ',' )}\n`;
    const samplePeriods = ['T001:Indira:MATHS', 'T001:Indira:ENGLISH', 'T002:Sai Priya:EVS', 'T003:Uma Rani:Hindi', 'T004:Pravalika:Maths'];
    getAllActiveDays().slice( 0, 3 ).forEach( day => {
        const periodCells = periodHeaders.map( ( _, index ) => samplePeriods[index] || '' );
        csv += `Grade-I-A,${day},${periodCells.join( ',' )}\n`;
    } );

    // Create download link
    const blob = new Blob( [csv], { type: 'text/csv' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'timetable_template.csv';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
}

// Toggle reschedule mode
function toggleRescheduleMode() {
    state.rescheduleMode = !state.rescheduleMode;
    state.selectedPeriods = [];

    const rescheduleControls = document.getElementById( 'rescheduleControls' );
    const rescheduleBtn = document.getElementById( 'rescheduleModeBtn' );

    if ( state.rescheduleMode ) {
        rescheduleControls.style.display = 'flex';
        rescheduleBtn.innerHTML = '<i class="fas fa-times"></i> Exit Reschedule Mode';
        rescheduleBtn.classList.add( 'btn-danger' );
        rescheduleBtn.classList.remove( 'btn-primary' );

        // Remove click listeners for editing
        removeEditListeners();

        // Add click listeners to timetable cells
        addRescheduleListeners();
    } else {
        rescheduleControls.style.display = 'none';
        rescheduleBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Reschedule Mode';
        rescheduleBtn.classList.remove( 'btn-danger' );
        rescheduleBtn.classList.add( 'btn-primary' );

        // Remove highlight from selected cells
        document.querySelectorAll( '.swap-highlight' ).forEach( cell => {
            cell.classList.remove( 'swap-highlight' );
        } );

        // Remove click listeners
        removeRescheduleListeners();

        // Add click listeners for editing
        addEditListeners();
    }
}

// Add reschedule listeners
function addRescheduleListeners() {
    const cells = document.querySelectorAll( '.period-cell' );
    cells.forEach( cell => {
        cell.addEventListener( 'click', handlePeriodSelection );
    } );
}

// Remove reschedule listeners
function removeRescheduleListeners() {
    const cells = document.querySelectorAll( '.period-cell' );
    cells.forEach( cell => {
        cell.removeEventListener( 'click', handlePeriodSelection );
    } );
}

// Handle period selection for rescheduling
function handlePeriodSelection( event ) {
    const cell = event.currentTarget;
    const className = cell.getAttribute( 'data-class' );
    const dayName = cell.getAttribute( 'data-day' );
    const periodNum = parseInt( cell.getAttribute( 'data-period' ) );

    // Check if already selected
    const isSelected = state.selectedPeriods.some( p =>
        p.className === className && p.dayName === dayName && p.period === periodNum
    );

    if ( isSelected ) {
        // Deselect
        cell.classList.remove( 'swap-highlight' );
        state.selectedPeriods = state.selectedPeriods.filter( p =>
            !( p.className === className && p.dayName === dayName && p.period === periodNum )
        );
    } else {
        // Select (max 2 periods)
        if ( state.selectedPeriods.length < 2 ) {
            cell.classList.add( 'swap-highlight' );
            state.selectedPeriods.push( {
                className,
                dayName,
                period: periodNum
            } );

            // If 2 periods selected, enable swap button
            if ( state.selectedPeriods.length === 2 ) {
                document.getElementById( 'confirmSwapBtn' ).disabled = false;
            }
        }
    }
}

// Load timetable for modification
function loadTimetableForModification(silent = false) {
    const classFilter = document.getElementById( 'modifyClassFilter' ).value;

    if ( !classFilter ) {
        if (!silent) alert( "Please select a class to load." );
        return;
    }

    if ( !state.timetableData || !state.timetableData[classFilter] ) {
        if (!silent) alert( "No timetable data found for this class." );
        return;
    }

    const modifyTimetableDisplay = document.getElementById( 'modifyTimetableDisplay' );
    const classData = state.timetableData[classFilter];

    modifyTimetableDisplay.innerHTML = `
                <h3 style="margin: 20px 0 10px 15px;">${classData.className}</h3>
                ${generateTimetableHTML( classData )}
            `;

    // Add click listeners if in reschedule mode
    if ( state.rescheduleMode ) {
        addRescheduleListeners();
    } else {
        addEditListeners();
    }
    updateModifyActionsState();
}

// Load teacher schedule
function loadTeacherSchedule() {
    const teacherFilter = document.getElementById( 'teacherScheduleFilter' ).value;

    if ( !teacherFilter ) {
        alert( "Please select a teacher to load schedule." );
        return;
    }

    const teacherScheduleDisplay = document.getElementById( 'teacherScheduleDisplay' );
    teacherScheduleDisplay.innerHTML = renderTeacherTimetableHTML( [teacherFilter] );
}

// Export teacher schedule
function exportTeacherSchedule() {
    const teacherFilter = document.getElementById( 'teacherScheduleFilter' ).value;

    if ( !teacherFilter ) {
        alert( "Please select a teacher to export schedule." );
        return;
    }

    alert( `Exporting schedule for ${teacherFilter}...` );
    // In a real app, this would generate an Excel or PDF file
}

// Open reschedule modal
function openRescheduleModal() {
    if ( state.selectedPeriods.length !== 2 ) {
        alert( "Please select exactly two periods to swap." );
        return;
    }

    // Get period details
    const period1 = getPeriodDetails( state.selectedPeriods[0] );
    const period2 = getPeriodDetails( state.selectedPeriods[1] );

    document.getElementById( 'period1Info' ).innerHTML = `
                <strong>${period1.className} - ${period1.dayName} - Period ${period1.period}</strong><br>
                Subject: ${period1.subject}<br>
                Teacher: ${period1.teacherName}<br>
                Time: ${period1.time}
            `;

    document.getElementById( 'period2Info' ).innerHTML = `
                <strong>${period2.className} - ${period2.dayName} - Period ${period2.period}</strong><br>
                Subject: ${period2.subject}<br>
                Teacher: ${period2.teacherName}<br>
                Time: ${period2.time}
            `;

    document.getElementById( 'rescheduleModal' ).classList.add( 'active' );
}

// Close reschedule modal
function closeRescheduleModal() {
    document.getElementById( 'rescheduleModal' ).classList.remove( 'active' );
}

// Confirm reschedule
function confirmReschedule() {
    if ( state.selectedPeriods.length !== 2 ) {
        alert( "Please select exactly two periods to swap." );
        return;
    }

    const period1 = state.selectedPeriods[0];
    const period2 = state.selectedPeriods[1];

    // Swap the periods
    swapPeriods( period1, period2 );

    // Save to storage
    saveTimetableToStorage();

    // Update UI
    loadTimetableForModification();
    closeRescheduleModal();

    // Reset selection
    state.selectedPeriods = [];
    document.querySelectorAll( '.swap-highlight' ).forEach( cell => {
        cell.classList.remove( 'swap-highlight' );
    } );

    alert( "Periods swapped successfully!" );
}

// Get period details
function getPeriodDetails( periodInfo ) {
    const classData = state.timetableData[periodInfo.className];
    const dayData = classData.days.find( d => d.dayName === periodInfo.dayName );
    const periodData = dayData.periods.find( p => p.period === periodInfo.period );

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
function swapPeriods( period1, period2 ) {
    const classData1 = state.timetableData[period1.className];
    const dayData1 = classData1.days.find( d => d.dayName === period1.dayName );
    const periodData1 = dayData1.periods.find( p => p.period === period1.period );

    const classData2 = state.timetableData[period2.className];
    const dayData2 = classData2.days.find( d => d.dayName === period2.dayName );
    const periodData2 = dayData2.periods.find( p => p.period === period2.period );

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
document.getElementById( 'confirmSwapBtn' ).addEventListener( 'click', openRescheduleModal );
document.getElementById( 'cancelSwapBtn' ).addEventListener( 'click', function () {
    toggleRescheduleMode();
} );

// --- Interactive Timetable Editing ---

function addEditListeners() {
    const icons = document.querySelectorAll( '.cell-edit-icon' );
    icons.forEach( icon => {
        icon.removeEventListener( 'click', handlePeriodEditClick );
        icon.addEventListener( 'click', handlePeriodEditClick );
    } );
}

function removeEditListeners() {
    const icons = document.querySelectorAll( '.cell-edit-icon' );
    icons.forEach( icon => {
        icon.removeEventListener( 'click', handlePeriodEditClick );
    } );
}

function handlePeriodEditClick( event ) {
    event.stopPropagation();
    const cell = event.currentTarget.closest('.period-cell');
    if (!cell) return;
    
    const className = cell.getAttribute( 'data-class' );
    const dayName = cell.getAttribute( 'data-day' );
    const periodNum = parseInt( cell.getAttribute( 'data-period' ) );

    openEditCellModal( className, dayName, periodNum );
}

function openEditCellModal( className, dayName, periodNum ) {
    const classData = state.timetableData[className];
    if ( !classData ) return;
    const dayData = classData.days.find( d => d.dayName === dayName );
    if ( !dayData ) return;
    const periodData = dayData.periods.find( p => p.period === periodNum );
    if ( !periodData ) return;

    document.getElementById( 'editModalClass' ).textContent = classData.className || className;
    document.getElementById( 'editModalDay' ).textContent = dayName;
    document.getElementById( 'editModalPeriod' ).textContent = `Period ${periodNum}`;
    document.getElementById( 'editModalCurrentSubject' ).textContent = periodData.subject || 'UNFILLED';
    document.getElementById( 'editModalCurrentTeacher' ).textContent = periodData.teacherName || 'No Teacher';

    const modal = document.getElementById( 'editCellModal' );
    modal.dataset.class = className;
    modal.dataset.day = dayName;
    modal.dataset.period = periodNum;

    const subjectSelect = document.getElementById( 'editModalSubjectSelect' );
    subjectSelect.innerHTML = '<option value="">Select Subject (Clear / Break)</option>';

    const subjects = state.subjects || [];
    subjects.forEach( sub => {
        const option = document.createElement( 'option' );
        option.value = sub.code;
        option.textContent = `${sub.code} - ${sub.name}`;
        if ( sub.code === periodData.subject ) {
            option.selected = true;
        }
        subjectSelect.appendChild( option );
    } );

    subjectSelect.removeEventListener( 'change', handleSubjectChange );
    subjectSelect.addEventListener( 'change', handleSubjectChange );

    const initialTeacherId = periodData.teacherId || findTeacherIdByName( periodData.teacherName );
    populateTeacherDropdownForSubject( periodData.subject, initialTeacherId );

    modal.classList.add( 'active' );
}

function closeEditCellModal() {
    document.getElementById( 'editCellModal' ).classList.remove( 'active' );
}

function handleSubjectChange( event ) {
    const selectedSubject = event.target.value;
    const modal = document.getElementById( 'editCellModal' );
    const className = modal.dataset.class;

    let mappedTeacherId = '';
    if ( selectedSubject ) {
        const mapping = ( state.teacherMappings || [] ).find( m =>
            toCleanString( m.subject ).toLowerCase() === toCleanString( selectedSubject ).toLowerCase() &&
            m.gradeSection.split( ',' ).map( s => s.trim().toLowerCase() ).includes( className.toLowerCase() )
        );
        if ( mapping ) {
            mappedTeacherId = mapping.teacherId;
        }
    }

    populateTeacherDropdownForSubject( selectedSubject, mappedTeacherId );
}

function populateTeacherDropdownForSubject( subjectCode, selectedTeacherId ) {
    const teacherSelect = document.getElementById( 'editModalTeacherSelect' );
    teacherSelect.innerHTML = '<option value="">Select Teacher (None)</option>';

    if ( !subjectCode ) {
        teacherSelect.disabled = true;
        return;
    }

    teacherSelect.disabled = false;

    const capableTeachers = getCapableTeachersForSubject( subjectCode );

    capableTeachers.forEach( teacher => {
        const option = document.createElement( 'option' );
        option.value = teacher.id;
        option.textContent = `${teacher.id} - ${teacher.name}`;
        if ( toCleanString( teacher.id ).toLowerCase() === toCleanString( selectedTeacherId ).toLowerCase() ) {
            option.selected = true;
        }
        teacherSelect.appendChild( option );
    } );
}

function getCapableTeachersForSubject( subjectName ) {
    const cleanSubject = toCleanString( subjectName ).toLowerCase();
    const capableTeacherIds = new Set();
    const result = [];

    ( state.teacherMappings || [] ).forEach( m => {
        if ( toCleanString( m.subject ).toLowerCase() === cleanSubject && m.teacherId ) {
            capableTeacherIds.add( toCleanString( m.teacherId ).toLowerCase() );
        }
    } );

    ( state.teachers || [] ).forEach( t => {
        const subjects = toCleanString( t.classTeacherSubject || t.subjects || '' )
            .split( /[;/,]/ )
            .map( s => toCleanString( s ).toLowerCase() )
            .filter( Boolean );
        if ( subjects.includes( cleanSubject ) && t.id ) {
            capableTeacherIds.add( toCleanString( t.id ).toLowerCase() );
        }
    } );

    capableTeacherIds.forEach( id => {
        const teacherObj = ( state.teachers || [] ).find( t => toCleanString( t.id ).toLowerCase() === id );
        if ( teacherObj ) {
            result.push( { id: teacherObj.id, name: teacherObj.name } );
        } else {
            const mappingObj = ( state.teacherMappings || [] ).find( m => toCleanString( m.teacherId ).toLowerCase() === id );
            if ( mappingObj ) {
                result.push( { id: mappingObj.teacherId, name: mappingObj.teacherName || mappingObj.teacherId } );
            } else {
                result.push( { id: id.toUpperCase(), name: id.toUpperCase() } );
            }
        }
    } );

    return result.sort( ( a, b ) => safeLocaleCompare( a.name, b.name ) );
}

function findTeacherIdByName( teacherName ) {
    const cleanName = toCleanString( teacherName ).toLowerCase();
    if ( !cleanName ) return '';
    const teacher = ( state.teachers || [] ).find( item => toCleanString( item.name ).toLowerCase() === cleanName );
    if ( teacher ) return teacher.id;

    const mapping = ( state.teacherMappings || [] ).find( item => toCleanString( item.teacherName ).toLowerCase() === cleanName );
    if ( mapping ) return mapping.teacherId;

    return '';
}

function checkTeacherConflict( teacherId, teacherName, currentClass, dayName, periodNum ) {
    const cleanId = toCleanString( teacherId ).toLowerCase();
    const cleanName = toCleanString( teacherName ).toLowerCase();

    if ( !cleanId && !cleanName ) return null;

    for ( const [className, classData] of Object.entries( state.timetableData ) ) {
        if ( className === currentClass ) continue;

        const dayData = ( classData.days || [] ).find( d => d.dayName === dayName );
        if ( !dayData ) continue;

        const periodData = ( dayData.periods || [] ).find( p => p.period === periodNum );
        if ( !periodData ) continue;

        const pTeacherId = toCleanString( periodData.teacherId ).toLowerCase();
        const pTeacherName = toCleanString( periodData.teacherName ).toLowerCase();

        const matchesId = cleanId && pTeacherId && ( cleanId === pTeacherId );
        const matchesName = cleanName && pTeacherName && ( cleanName === pTeacherName );

        if ( matchesId || matchesName ) {
            return {
                className: classData.className || className,
                dayName: dayName,
                period: periodNum
            };
        }
    }
    return null;
}

function saveCellEditFromModal() {
    const modal = document.getElementById( 'editCellModal' );
    const className = modal.dataset.class;
    const dayName = modal.dataset.day;
    const periodNum = parseInt( modal.dataset.period );

    const selectedSubject = document.getElementById( 'editModalSubjectSelect' ).value;
    const selectedTeacherId = document.getElementById( 'editModalTeacherSelect' ).value;
    const selectedTeacherName = selectedTeacherId ? findTeacherNameById( selectedTeacherId ) : '';

    const classData = state.timetableData[className];
    const dayData = classData.days.find( d => d.dayName === dayName );
    const periodData = dayData.periods.find( p => p.period === periodNum );

    // Validation conflict check
    if ( selectedTeacherId ) {
        const conflict = checkTeacherConflict( selectedTeacherId, selectedTeacherName, className, dayName, periodNum );
        if ( conflict ) {
            const proceed = confirm( `This teacher is already assigned to ${conflict.className} on ${conflict.dayName} Period ${conflict.period}.\n\nDo you want to continue anyway?` );
            if ( !proceed ) {
                return;
            }
        }
    }

    const cellKey = `${className}|${dayName}|${periodNum}`;
    const wasPreviouslyEdited = !!( state.editedCells && state.editedCells[cellKey] );

    // Store previous value for one-level Undo
    state.lastEdit = {
        className: className,
        dayName: dayName,
        periodNum: periodNum,
        subject: periodData.subject || '',
        teacherId: periodData.teacherId || '',
        teacherName: periodData.teacherName || '',
        wasEdited: wasPreviouslyEdited
    };

    // Apply temporary save in memory
    periodData.subject = selectedSubject;
    periodData.teacherId = selectedTeacherId;
    periodData.teacherName = selectedTeacherName;

    // Mark as edited
    if ( !state.editedCells ) {
        state.editedCells = {};
    }
    state.editedCells[cellKey] = true;

    closeEditCellModal();
    loadTimetableForModification(true);
    if (typeof renderTimetable === 'function') {
        renderTimetable();
    }
}

function undoLastCellEdit() {
    if ( !state.lastEdit ) return;

    const { className, dayName, periodNum, subject, teacherId, teacherName, wasEdited } = state.lastEdit;

    const classData = state.timetableData[className];
    const dayData = classData.days.find( d => d.dayName === dayName );
    const periodData = dayData.periods.find( p => p.period === periodNum );

    // Revert values
    periodData.subject = subject;
    periodData.teacherId = teacherId;
    periodData.teacherName = teacherName;

    // Revert edit state
    const cellKey = `${className}|${dayName}|${periodNum}`;
    if ( !wasEdited ) {
        delete state.editedCells[cellKey];
    }

    state.lastEdit = null;
    loadTimetableForModification(true);
    if (typeof renderTimetable === 'function') {
        renderTimetable();
    }
}

function saveAllModifiedChanges() {
    if ( !state.editedCells || Object.keys( state.editedCells ).length === 0 ) {
        alert( "No changes to save." );
        return;
    }

    // Save to localStorage
    saveTimetableToStorage();

    // Clear highlights
    state.editedCells = {};
    state.lastEdit = null;

    loadTimetableForModification();

    // Update View Timetable too if it's currently rendered
    if ( typeof renderTimetable === 'function' ) {
        renderTimetable();
    }

    alert( "All timetable changes saved successfully!" );
}

function cancelAllModifiedChanges() {
    const hasEdits = state.editedCells && Object.keys( state.editedCells ).length > 0;
    if ( hasEdits ) {
        const confirmCancel = confirm( "Are you sure you want to discard all unsaved edits?" );
        if ( !confirmCancel ) return;
    }

    const storedTimetable = localStorage.getItem( 'schoolTimetable' );
    if ( storedTimetable ) {
        state.timetableData = normalizeLoadedTimetableData( JSON.parse( storedTimetable ) );
    }

    state.editedCells = {};
    state.lastEdit = null;

    loadTimetableForModification(true);
    if (typeof renderTimetable === 'function') {
        renderTimetable();
    }
}

function updateModifyActionsState() {
    const hasEdits = state.editedCells && Object.keys( state.editedCells ).length > 0;
    const saveBtn = document.getElementById( 'saveAllChangesBtn' );
    const cancelBtn = document.getElementById( 'cancelAllChangesBtn' );
    const undoBtn = document.getElementById( 'undoEditBtn' );

    if ( saveBtn ) saveBtn.disabled = !hasEdits;
    if ( cancelBtn ) cancelBtn.disabled = !hasEdits;
    if ( undoBtn ) undoBtn.disabled = !state.lastEdit;
}

// --- Caveat Detection Engine ---

function checkTeacherConflicts() {
    const conflicts = [];
    if ( !state.timetableData ) return conflicts;

    const teacherSchedule = new Map(); // key: day|period|teacherName/Id -> list of { className, schedulingKey, period }

    for ( const [className, classData] of Object.entries( state.timetableData ) ) {
        const classMeta = ( state.classSections || [] ).find( c => c.className === className );
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const teacherName = toCleanString( period.teacherName );
                const teacherId = toCleanString( period.teacherId || findTeacherIdByName( teacherName ) );
                if ( !teacherName ) return;

                // Resolve combined key to group combined classes
                const mapping = ( state.teacherMappings || [] ).find( m =>
                    m.teacherName === period.teacherName &&
                    m.subject === period.subject &&
                    ( m.gradeSection === className || ( m.gradeSection && m.gradeSection.includes( className ) ) )
                );

                let schedulingKey = className;
                if ( mapping && mapping.mode === 'combined' && mapping.combinedGroupId ) {
                    schedulingKey = mapping.combinedGroupId;
                } else if ( classMeta && classMeta.teachingMode === 'combined' && classMeta.combinedGroupId ) {
                    schedulingKey = classMeta.combinedGroupId;
                }

                const key = `${day.dayName}|${period.period}|${teacherName.toLowerCase()}`;
                if ( !teacherSchedule.has( key ) ) {
                    teacherSchedule.set( key, [] );
                }
                teacherSchedule.get( key ).push( { className, schedulingKey, period } );
            } );
        } );
    }

    for ( const [key, list] of teacherSchedule.entries() ) {
        if ( list.length <= 1 ) continue;

        // Check if there are different scheduling keys
        const distinctKeys = new Set( list.map( item => item.schedulingKey ) );
        if ( distinctKeys.size <= 1 ) continue;

        // Report conflict for each item in the list
        list.forEach( item => {
            const day = key.split( '|' )[0];
            const periodNum = parseInt( key.split( '|' )[1] );
            const teacherName = list[0].period.teacherName;
            const teacherId = list[0].period.teacherId || findTeacherIdByName( teacherName );

            const otherClasses = list
                .filter( other => other.schedulingKey !== item.schedulingKey )
                .map( other => other.className );

            conflicts.push( {
                type: "teacher_conflict",
                class: item.className,
                day: day,
                period: `P${periodNum}`,
                teacherId: teacherId,
                teacherName: teacherName,
                severity: "critical",
                message: `Teacher ${teacherName} (${teacherId}) is simultaneously assigned to ${otherClasses.join( ', ' )} on ${day} Period P${periodNum}.`
            } );
        } );
    }

    return conflicts;
}

function checkMissingSubjectPeriods() {
    const violations = [];
    if ( !state.timetableData || !state.teacherMappings ) return violations;

    const scheduledCounts = {}; // className -> subject -> count

    for ( const [className, classData] of Object.entries( state.timetableData ) ) {
        scheduledCounts[className] = {};
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const subject = toCleanString( period.subject );
                if ( !subject ) return;
                scheduledCounts[className][subject] = ( scheduledCounts[className][subject] || 0 ) + 1;
            } );
        } );
    }

    ( state.teacherMappings || [] ).forEach( mapping => {
        const expectedCount = Math.max( 0, Number( mapping.periodsPerWeek ) || 0 );
        if ( expectedCount === 0 ) return;

        const classNames = parseGradeSectionParts( mapping.gradeSection )
            .flatMap( part => resolveMappingToClassNames( part ) )
            .filter( Boolean );
        const uniqueClassNames = [...new Set( classNames )];

        uniqueClassNames.forEach( className => {
            if ( !state.timetableData[className] ) return;

            const subjectCode = mapping.subject;
            const actualCount = ( scheduledCounts[className] && scheduledCounts[className][subjectCode] ) || 0;

            if ( actualCount < expectedCount ) {
                violations.push( {
                    type: "missing_subject_periods",
                    class: className,
                    subject: subjectCode,
                    teacherId: mapping.teacherId,
                    teacherName: mapping.teacherName || findTeacherNameById( mapping.teacherId ),
                    expected: expectedCount,
                    actual: actualCount,
                    severity: "warning",
                    message: `Class ${className} has only ${actualCount} of ${expectedCount} expected periods scheduled for subject ${subjectCode}.`
                } );
            }
        } );
    } );

    return violations;
}

function checkTeacherWorkload() {
    const violations = [];
    if ( !state.timetableData ) return violations;

    const limit = state.config.periodsPerTeacher || 35;
    const teacherAssignments = {}; // teacherName/Id -> Set of day|period

    for ( const [className, classData] of Object.entries( state.timetableData ) ) {
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const teacherName = toCleanString( period.teacherName );
                const teacherId = toCleanString( period.teacherId || findTeacherIdByName( teacherName ) );
                if ( !teacherName ) return;

                const key = `${teacherId || teacherName}`;
                if ( !teacherAssignments[key] ) {
                    teacherAssignments[key] = {
                        teacherId: teacherId,
                        teacherName: teacherName,
                        slots: new Set(),
                        breakdown: {}
                    };
                }
                teacherAssignments[key].slots.add( `${day.dayName}|${period.period}` );
                teacherAssignments[key].breakdown[className] = ( teacherAssignments[key].breakdown[className] || 0 ) + 1;
            } );
        } );
    }

    for ( const [key, info] of Object.entries( teacherAssignments ) ) {
        const actualCount = info.slots.size;
        if ( actualCount > limit ) {
            const breakdownStr = Object.entries( info.breakdown ).map( ( [cls, count] ) => `${cls}: ${count}` ).join( ', ' );
            violations.push( {
                type: "teacher_workload",
                teacherId: info.teacherId,
                teacherName: info.teacherName,
                limit: limit,
                actual: actualCount,
                severity: "warning",
                message: `Teacher ${info.teacherName} (${info.teacherId || 'N/A'}) teaches ${actualCount} periods per week, exceeding the limit of ${limit}. Breakdown: [${breakdownStr}]`
            } );
        }
    }

    return violations;
}

function checkLabViolations() {
    const violations = [];
    if ( !state.timetableData ) return violations;

    for ( const [className, classData] of Object.entries( state.timetableData ) ) {
        ( classData.days || [] ).forEach( day => {
            const cslPeriods = ( day.periods || [] ).filter( p => toCleanString( p.subject ).toUpperCase() === 'CSL' );
            if ( cslPeriods.length === 0 ) return;

            cslPeriods.forEach( p => {
                const periodNum = p.period;
                let isValid = false;

                if ( periodNum === 1 ) {
                    const p2 = day.periods.find( x => x.period === 2 );
                    if ( p2 && toCleanString( p2.subject ).toUpperCase() === 'CSL' ) {
                        isValid = true;
                    }
                } else if ( periodNum === 2 ) {
                    const p1 = day.periods.find( x => x.period === 1 );
                    if ( p1 && toCleanString( p1.subject ).toUpperCase() === 'CSL' ) {
                        isValid = true;
                    }
                } else if ( periodNum === 5 ) {
                    const p6 = day.periods.find( x => x.period === 6 );
                    if ( p6 && toCleanString( p6.subject ).toUpperCase() === 'CSL' ) {
                        isValid = true;
                    }
                } else if ( periodNum === 6 ) {
                    const p5 = day.periods.find( x => x.period === 5 );
                    if ( p5 && toCleanString( p5.subject ).toUpperCase() === 'CSL' ) {
                        isValid = true;
                    }
                }

                if ( !isValid ) {
                    const teacherId = p.teacherId || findTeacherIdByName( p.teacherName );
                    violations.push( {
                        type: "lab_violation",
                        class: className,
                        day: day.dayName,
                        period: `P${periodNum}`,
                        teacherId: teacherId,
                        teacherName: p.teacherName,
                        subject: p.subject,
                        severity: "critical",
                        message: `Lab subject ${p.subject} for class ${className} on ${day.dayName} Period P${periodNum} violates the constraint of using consecutive blocks of P1-P2 or P5-P6.`
                    } );
                }
            } );
        } );
    }

    return violations;
}

function checkFixedPeriodViolations() {
    const violations = [];
    if ( !state.timetableData || !state.teacherMappings ) return violations;

    for ( const [className, classData] of Object.entries( state.timetableData ) ) {
        const relevantMappings = ( state.teacherMappings || [] ).filter( m => {
            if ( !m.fixedPeriods ) return false;
            const classNames = parseGradeSectionParts( m.gradeSection )
                .flatMap( part => resolveMappingToClassNames( part ) )
                .filter( Boolean );
            return classNames.includes( className );
        } );

        if ( relevantMappings.length === 0 ) continue;

        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const subject = toCleanString( period.subject );
                if ( !subject ) return;

                const matchingMapping = relevantMappings.find( m => {
                    const matchesSubject = toCleanString( m.subject ).toLowerCase() === subject.toLowerCase();
                    const cleanTeacherId = toCleanString( m.teacherId ).toLowerCase();
                    const cellTeacherId = toCleanString( period.teacherId || findTeacherIdByName( period.teacherName ) ).toLowerCase();
                    const matchesTeacher = cleanTeacherId && cellTeacherId && ( cleanTeacherId === cellTeacherId );
                    return matchesSubject && matchesTeacher;
                } );

                if ( !matchingMapping ) return;

                const allowedGroups = parseFixedPeriodGroups( matchingMapping.fixedPeriods ).groups;
                const allowedPeriods = [...new Set( allowedGroups.flat() )];

                if ( allowedPeriods.length > 0 && !allowedPeriods.includes( period.period ) ) {
                    const teacherId = period.teacherId || findTeacherIdByName( period.teacherName );
                    violations.push( {
                        type: "fixed_period_violation",
                        class: className,
                        day: day.dayName,
                        period: `P${period.period}`,
                        teacherId: teacherId,
                        teacherName: period.teacherName,
                        subject: period.subject,
                        allowedPeriods: matchingMapping.fixedPeriods,
                        severity: "warning",
                        message: `Subject ${period.subject} for class ${className} is scheduled on ${day.dayName} at Period P${period.period}, violating the fixed period constraint of ${matchingMapping.fixedPeriods}.`
                    } );
                }
            } );
        } );
    }

    return violations;
}

function generateGenerationReport() {
    const criticalIssues = [];
    const warnings = [];
    const passedChecks = [];

    // Run checks
    const conflicts = checkTeacherConflicts();
    const missingPeriods = checkMissingSubjectPeriods();
    const workloads = checkTeacherWorkload();
    const labViolations = checkLabViolations();
    const fixedViolations = checkFixedPeriodViolations();

    criticalIssues.push( ...conflicts );
    criticalIssues.push( ...labViolations );

    warnings.push( ...missingPeriods );
    warnings.push( ...workloads );
    warnings.push( ...fixedViolations );

    // Determine passed checks
    if ( conflicts.length === 0 ) {
        passedChecks.push( "Teacher conflict check passed: No teacher overlaps detected." );
    }
    if ( labViolations.length === 0 ) {
        passedChecks.push( "Lab block validation passed: All CSL periods scheduled in valid consecutive blocks." );
    }
    if ( workloads.length === 0 ) {
        passedChecks.push( "Teacher workload check passed: No teachers exceed their workload limits." );
    }
    if ( fixedViolations.length === 0 ) {
        passedChecks.push( "Fixed period check passed: All fixed period assignments satisfy mapping constraints." );
    }
    if ( missingPeriods.length === 0 ) {
        passedChecks.push( "Class subject requirements check passed: No classes are missing their required subject periods." );
    }

    return {
        criticalIssues,
        warnings,
        passedChecks,
        summary: {
            critical: criticalIssues.length,
            warning: warnings.length,
            passed: passedChecks.length
        }
    };
}

// --- Caveat Detection UI Dashboard ---

function renderGenerationReport() {
    const container = document.getElementById( 'generationReportContainer' );
    if ( !container ) return;

    if ( !state.timetableData ) {
        container.style.display = 'none';
        return;
    }

    const report = generateGenerationReport();

    const criticalCount = report.summary.critical;
    const warningCount = report.summary.warning;
    const passedCount = report.summary.passed;

    const teacherConflictsCount = report.criticalIssues.filter( i => i.type === 'teacher_conflict' ).length;
    const missingSubjectCount = report.warnings.filter( i => i.type === 'missing_subject_periods' ).length;
    const overloadedTeachersCount = report.warnings.filter( i => i.type === 'teacher_workload' ).length;

    let html = `
        <div class="report-section">
            <div class="report-section-title">
                <i class="fas fa-chart-bar" style="color: var(--primary-color);"></i>
                Timetable Generation Report
                <button class="btn btn-primary btn-sm" style="margin-left: auto; margin-right: 10px;" onclick="exportGenerationReport()">
                    <i class="fas fa-file-export"></i> Export Report
                </button>
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('generationReportContainer').style.display='none'">
                    <i class="fas fa-times"></i> Dismiss Report
                </button>
            </div>

            <!-- Report Summary Cards Grid -->
            <div class="report-summary-grid">
                <div class="report-summary-card critical">
                    <h4>Critical Issues</h4>
                    <div class="count">${criticalCount}</div>
                </div>
                <div class="report-summary-card warning">
                    <h4>Warnings</h4>
                    <div class="count">${warningCount}</div>
                </div>
                <div class="report-summary-card success">
                    <h4>Passed Checks</h4>
                    <div class="count">${passedCount}</div>
                </div>
                <div class="report-summary-card">
                    <h4>Teacher Conflicts</h4>
                    <div class="count">${teacherConflictsCount}</div>
                </div>
                <div class="report-summary-card">
                    <h4>Missing Subjects</h4>
                    <div class="count">${missingSubjectCount}</div>
                </div>
                <div class="report-summary-card">
                    <h4>Overloaded Teachers</h4>
                    <div class="count">${overloadedTeachersCount}</div>
                </div>
            </div>
    `;

    // 1. Critical Issues Section
    html += `
        <div class="report-subtitle-header" onclick="toggleReportSection(this)">
            <span class="chevron-icon"><i class="fas fa-chevron-down"></i></span>
            <span class="title-text"><i class="fas fa-times-circle" style="color: #ef4444;"></i> Critical Issues (${criticalCount})</span>
        </div>
        <div class="collapsible-content">
    `;
    if ( report.criticalIssues.length === 0 ) {
        html += `<p style="color: #64748b; font-size: 0.9rem; padding: 10px 0;"><i class="fas fa-check-circle" style="color: #10b981;"></i> No critical issues found.</p>`;
    } else {
        html += `
            <div class="carousel-wrapper">
                <button class="carousel-btn" onclick="scrollCarousel(this, -1)"><i class="fas fa-chevron-left"></i></button>
                <div class="carousel-container">
        `;
        report.criticalIssues.forEach( i => {
            const classLabel = i.class;
            const dayLabel = i.day;
            const periodLabel = i.period;
            const teacherName = i.teacherName;
            const message = i.message;

            html += `
                <div class="caveat-card critical">
                    <div>
                        <div class="caveat-card-header">
                            <i class="fas fa-exclamation-circle"></i> ${i.type === 'teacher_conflict' ? 'Teacher Conflict' : 'Lab Block Violation'}
                        </div>
                        <div class="caveat-details-grid">
                            <div><strong>Teacher:</strong> ${teacherName}</div>
                            <div><strong>Class:</strong> ${classLabel}</div>
                            <div><strong>Day:</strong> ${dayLabel}</div>
                            <div><strong>Period:</strong> ${periodLabel}</div>
                        </div>
                        <div class="caveat-reason">${message}</div>
                    </div>
                    <button class="btn btn-primary btn-sm caveat-action-btn" onclick="openCellInModifyTimetable('${escapeHtmlJS( classLabel )}', '${escapeHtmlJS( dayLabel )}', ${parseInt( periodLabel.replace( 'P', '' ) )})">
                        <i class="fas fa-external-link-alt"></i> Open in Modify Timetable
                    </button>
                </div>
            `;
        } );
        html += `
                </div>
                <button class="carousel-btn" onclick="scrollCarousel(this, 1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        `;
    }
    html += `</div>`;

    // 2. Warnings Section
    html += `
        <div class="report-subtitle-header" onclick="toggleReportSection(this)">
            <span class="chevron-icon"><i class="fas fa-chevron-down"></i></span>
            <span class="title-text"><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Warnings (${warningCount})</span>
        </div>
        <div class="collapsible-content">
    `;
    if ( report.warnings.length === 0 ) {
        html += `<p style="color: #64748b; font-size: 0.9rem; padding: 10px 0;"><i class="fas fa-check-circle" style="color: #10b981;"></i> No warnings found.</p>`;
    } else {
        html += `
            <div class="carousel-wrapper">
                <button class="carousel-btn" onclick="scrollCarousel(this, -1)"><i class="fas fa-chevron-left"></i></button>
                <div class="carousel-container">
        `;
        report.warnings.forEach( i => {
            const classLabel = i.class || 'All Classes';
            const dayLabel = i.day || 'N/A';
            const periodLabel = i.period || 'N/A';
            const teacherName = i.teacherName;
            const message = i.message;

            let actionBtnHtml = '';
            if ( i.class && i.day && i.period && i.period !== 'N/A' ) {
                actionBtnHtml = `
                    <button class="btn btn-primary btn-sm caveat-action-btn" onclick="openCellInModifyTimetable('${escapeHtmlJS( classLabel )}', '${escapeHtmlJS( dayLabel )}', ${parseInt( periodLabel.replace( 'P', '' ) )})">
                        <i class="fas fa-external-link-alt"></i> Open in Modify Timetable
                    </button>
                `;
            } else if ( i.class ) {
                actionBtnHtml = `
                    <button class="btn btn-primary btn-sm caveat-action-btn" onclick="openCellInModifyTimetable('${escapeHtmlJS( classLabel )}', 'Monday', 1)">
                        <i class="fas fa-external-link-alt"></i> Open Class in Modify
                    </button>
                `;
            }

            html += `
                <div class="caveat-card warning">
                    <div>
                        <div class="caveat-card-header">
                            <i class="fas fa-exclamation-triangle"></i> ${i.type === 'teacher_workload' ? 'Workload Warning' : i.type === 'fixed_period_violation' ? 'Fixed Period Violation' : 'Subject Periods Shortage'}
                        </div>
                        <div class="caveat-details-grid">
                            <div><strong>Teacher:</strong> ${teacherName}</div>
                            <div><strong>Class:</strong> ${classLabel}</div>
                            ${i.day && i.day !== 'N/A' ? `<div><strong>Day:</strong> ${dayLabel}</div>` : ''}
                            ${i.period && i.period !== 'N/A' ? `<div><strong>Period:</strong> ${periodLabel}</div>` : ''}
                        </div>
                        <div class="caveat-reason">${message}</div>
                    </div>
                    ${actionBtnHtml}
                </div>
            `;
        } );
        html += `
                </div>
                <button class="carousel-btn" onclick="scrollCarousel(this, 1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        `;
    }
    html += `</div>`;

    // 3. Passed Checks Section
    html += `
        <div class="report-subtitle-header" onclick="toggleReportSection(this)">
            <span class="chevron-icon"><i class="fas fa-chevron-down"></i></span>
            <span class="title-text"><i class="fas fa-check-circle" style="color: #10b981;"></i> Passed Checks (${passedCount})</span>
        </div>
        <div class="collapsible-content">
    `;
    if ( report.passedChecks.length === 0 ) {
        html += `<p style="color: #64748b; font-size: 0.9rem; padding: 10px 0;">No passed checks recorded.</p>`;
    } else {
        html += `
            <div class="carousel-wrapper">
                <button class="carousel-btn" onclick="scrollCarousel(this, -1)"><i class="fas fa-chevron-left"></i></button>
                <div class="carousel-container">
        `;
        report.passedChecks.forEach( c => {
            html += `
                <div class="passed-check-card">
                    <div class="passed-check-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="passed-check-text">${c}</div>
                </div>
            `;
        } );
        html += `
                </div>
                <button class="carousel-btn" onclick="scrollCarousel(this, 1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        `;
    }
    html += `</div>`;

    // 4. Subject Completion Summary Section
    html += `
        <div class="report-subtitle-header" onclick="toggleReportSection(this)">
            <span class="chevron-icon"><i class="fas fa-chevron-down"></i></span>
            <span class="title-text"><i class="fas fa-tasks"></i> Subject Completion Summary</span>
        </div>
        <div class="collapsible-content">
            ${setupSubjectCompletionSelector()}
        </div>
    `;

    // 5. Teacher Workload Section
    html += `
        <div class="report-subtitle-header" onclick="toggleReportSection(this)">
            <span class="chevron-icon"><i class="fas fa-chevron-down"></i></span>
            <span class="title-text"><i class="fas fa-user-clock"></i> Teacher Workload Summary</span>
        </div>
        <div class="collapsible-content">
            ${renderTeacherWorkloadSummary()}
        </div>
    `;

    html += `</div>`;

    container.innerHTML = html;
    container.style.display = 'block';

    // Populate initial Subject Completion table data
    if ( state.reportClassesList && state.reportClassesList.length > 0 ) {
        updateReportClassTable( state.reportClassesList[0] );
    }
}

function setupSubjectCompletionSelector() {
    if ( !state.timetableData || !state.teacherMappings ) {
        return '<p style="color: #64748b; font-size: 0.9rem; padding: 10px 0;">No timetable data or teacher mappings loaded.</p>';
    }

    const scheduledCounts = {};

    for ( const [className, classData] of Object.entries( state.timetableData ) ) {
        scheduledCounts[className] = {};
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const subject = toCleanString( period.subject );
                if ( !subject ) return;
                scheduledCounts[className][subject] = ( scheduledCounts[className][subject] || 0 ) + 1;
            } );
        } );
    }

    const expectedMap = {};
    ( state.teacherMappings || [] ).forEach( mapping => {
        const expectedCount = Math.max( 0, Number( mapping.periodsPerWeek ) || 0 );
        if ( expectedCount === 0 ) return;

        const classNames = parseGradeSectionParts( mapping.gradeSection )
            .flatMap( part => resolveMappingToClassNames( part ) )
            .filter( Boolean );
        const uniqueClassNames = [...new Set( classNames )];

        uniqueClassNames.forEach( className => {
            if ( !expectedMap[className] ) {
                expectedMap[className] = {};
            }
            expectedMap[className][mapping.subject] = {
                expected: expectedCount,
                teacherName: mapping.teacherName || findTeacherNameById( mapping.teacherId )
            };
        } );
    } );

    const sortedClasses = Object.keys( state.timetableData ).sort( compareGradeSection );
    if ( sortedClasses.length === 0 ) {
        return '<p style="color: #64748b; font-size: 0.9rem; padding: 10px 0;">No classes to show.</p>';
    }

    state.reportClassData = expectedMap;
    state.reportScheduledCounts = scheduledCounts;
    state.reportClassesList = sortedClasses;
    state.currentReportClassIndex = 0;

    let optionsHtml = '';
    sortedClasses.forEach( className => {
        optionsHtml += `<option value="${className}">${className}</option>`;
    } );

    let html = `
        <div class="class-nav-container">
            <button class="btn btn-secondary btn-sm" onclick="navigateClass(-1)">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            <select id="reportClassSelector" class="form-control" style="width: 240px; display: inline-block;" onchange="updateReportClassTable(this.value)">
                ${optionsHtml}
            </select>
            <button class="btn btn-secondary btn-sm" onclick="navigateClass(1)">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        <div id="reportClassTableContainer"></div>
    `;

    return html;
}

function updateReportClassTable( className ) {
    const tableContainer = document.getElementById( 'reportClassTableContainer' );
    if ( !tableContainer ) return;

    if ( state.reportClassesList ) {
        const idx = state.reportClassesList.indexOf( className );
        if ( idx !== -1 ) {
            state.currentReportClassIndex = idx;
        }
    }

    const classData = state.timetableData[className];
    if ( !classData ) {
        tableContainer.innerHTML = '';
        return;
    }

    const classExpected = ( state.reportClassData && state.reportClassData[className] ) || {};
    const classActual = ( state.reportScheduledCounts && state.reportScheduledCounts[className] ) || {};

    const subjects = new Set( [
        ...Object.keys( classExpected ),
        ...Object.keys( classActual )
    ] );

    let html = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Subject</th>
                    <th>Teacher</th>
                    <th>Required</th>
                    <th>Completed</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    if ( subjects.size === 0 ) {
        html += `<tr><td colspan="5" style="text-align: center; color: #64748b;">No subjects mapped for this class.</td></tr>`;
    } else {
        Array.from( subjects ).sort().forEach( subject => {
            const expInfo = classExpected[subject] || { expected: 0, teacherName: 'N/A' };
            const actCount = classActual[subject] || 0;
            const reqCount = expInfo.expected;
            const teacherName = expInfo.teacherName;

            let statusClass = 'ok';
            let statusText = '✓ OK';

            if ( actCount < reqCount ) {
                statusClass = 'warning';
                statusText = '⚠ Shortage';
            } else if ( actCount > reqCount ) {
                statusClass = 'error';
                statusText = '⚠ Excess';
            }

            html += `
                <tr>
                    <td><strong>${subject}</strong></td>
                    <td>${teacherName}</td>
                    <td>${reqCount}</td>
                    <td>${actCount}</td>
                    <td><span class="status-badge ${statusClass}">${actCount} / ${reqCount} ${statusText}</span></td>
                </tr>
            `;
        } );
    }

    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
}

function navigateClass( direction ) {
    if ( !state.reportClassesList || state.reportClassesList.length <= 1 ) return;

    let index = state.currentReportClassIndex + direction;

    if ( index < 0 ) {
        index = state.reportClassesList.length - 1;
    } else if ( index >= state.reportClassesList.length ) {
        index = 0;
    }

    state.currentReportClassIndex = index;
    const className = state.reportClassesList[index];

    const selector = document.getElementById( 'reportClassSelector' );
    if ( selector ) {
        selector.value = className;
    }

    updateReportClassTable( className );
}

function renderTeacherWorkloadSummary() {
    if ( !state.timetableData ) return '';

    const limit = state.config.periodsPerTeacher || 35;
    const teacherAssignments = {};

    for ( const [className, classData] of Object.entries( state.timetableData ) ) {
        ( classData.days || [] ).forEach( day => {
            ( day.periods || [] ).forEach( period => {
                const teacherName = toCleanString( period.teacherName );
                const teacherId = toCleanString( period.teacherId || findTeacherIdByName( teacherName ) );
                if ( !teacherName ) return;

                const key = teacherId || teacherName;
                if ( !teacherAssignments[key] ) {
                    teacherAssignments[key] = {
                        teacherId: teacherId,
                        teacherName: teacherName,
                        slots: new Set()
                    };
                }
                teacherAssignments[key].slots.add( `${day.dayName}|${period.period}` );
            } );
        } );
    }

    ( state.teachers || [] ).forEach( t => {
        if ( !teacherAssignments[t.id] && !teacherAssignments[t.name] ) {
            teacherAssignments[t.id || t.name] = {
                teacherId: t.id,
                teacherName: t.name,
                slots: new Set()
            };
        }
    } );

    const sortedTeachers = Object.values( teacherAssignments ).sort( ( a, b ) => safeLocaleCompare( a.teacherName, b.teacherName ) );

    let html = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Teacher ID</th>
                    <th>Teacher Name</th>
                    <th>Assigned</th>
                    <th>Maximum</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    sortedTeachers.forEach( info => {
        const assignedCount = info.slots.size;
        const isOverloaded = assignedCount > limit;
        const statusClass = isOverloaded ? 'error' : 'ok';
        const statusText = isOverloaded ? '⚠ Overloaded' : '✓ OK';

        html += `
            <tr>
                <td><strong>${info.teacherId || 'N/A'}</strong></td>
                <td>${info.teacherName}</td>
                <td>${assignedCount}</td>
                <td>${limit}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    } );

    html += `</tbody></table>`;
    return html;
}

function scrollCarousel( button, direction ) {
    const wrapper = button.closest( '.carousel-wrapper' );
    if ( !wrapper ) return;
    const container = wrapper.querySelector( '.carousel-container' );
    if ( !container ) return;

    const scrollAmount = 336;
    container.scrollBy( {
        left: direction * scrollAmount,
        behavior: 'smooth'
    } );
}

function toggleReportSection( header ) {
    header.classList.toggle( 'collapsed' );
    const content = header.nextElementSibling;
    if ( content ) {
        content.classList.toggle( 'collapsed' );
    }
}

function openCellInModifyTimetable( className, dayName, periodNum ) {
    const tab = document.querySelector( '.tab[data-target="modify-timetable-section"]' );
    if ( tab ) tab.click();

    const classFilter = document.getElementById( 'modifyClassFilter' );
    if ( classFilter ) {
        classFilter.value = className;
    }

    loadTimetableForModification();

    setTimeout( () => {
        const targetCell = document.querySelector( `#modifyTimetableDisplay td.period-cell[data-day="${dayName}"][data-period="${periodNum}"]` );
        if ( targetCell ) {
            targetCell.scrollIntoView( { behavior: 'smooth', block: 'center' } );

            targetCell.classList.add( 'cell-focus-highlight' );
            setTimeout( () => {
                targetCell.classList.remove( 'cell-focus-highlight' );
            }, 5000 );
        }
    }, 150 );
}

function escapeHtmlJS( str ) {
    if ( !str ) return '';
    return str.replace( /'/g, "\\'" ).replace( /"/g, '\\"' );
}

function exportGenerationReport() {
    const report = generateGenerationReport();
    let content = "Timetable Generation Report\n===========================\n\n";
    
    content += `Summary:\n`;
    content += `- Critical Issues: ${report.summary.critical}\n`;
    content += `- Warnings: ${report.summary.warning}\n`;
    content += `- Passed Checks: ${report.summary.passed}\n\n`;
    
    if (report.criticalIssues.length > 0) {
        content += `CRITICAL ISSUES:\n----------------\n`;
        report.criticalIssues.forEach(i => {
            content += `Type: ${i.type === 'teacher_conflict' ? 'Teacher Conflict' : 'Lab Block Violation'}\n`;
            content += `Teacher: ${i.teacherName}\n`;
            content += `Class: ${i.class}\n`;
            content += `Day: ${i.day}\n`;
            content += `Period: ${i.period}\n`;
            content += `Message: ${i.message}\n\n`;
        });
    }
    
    if (report.warnings.length > 0) {
        content += `WARNINGS:\n---------\n`;
        report.warnings.forEach(i => {
            content += `Type: ${i.type === 'teacher_workload' ? 'Workload Warning' : i.type === 'fixed_period_violation' ? 'Fixed Period Violation' : 'Subject Periods Shortage'}\n`;
            content += `Teacher: ${i.teacherName}\n`;
            content += `Class: ${i.class || 'All Classes'}\n`;
            if (i.day && i.day !== 'N/A') content += `Day: ${i.day}\n`;
            if (i.period && i.period !== 'N/A') content += `Period: ${i.period}\n`;
            content += `Message: ${i.message}\n\n`;
        });
    }
    
    if (report.passedChecks.length > 0) {
        content += `PASSED CHECKS:\n--------------\n`;
        report.passedChecks.forEach(c => {
            content += `- ${c}\n`;
        });
        content += `\n`;
    }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'timetable_generation_report.txt';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

