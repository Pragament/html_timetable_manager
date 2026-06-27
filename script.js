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
        state.periodTimes = JSON.parse( storedPeriodTimes );
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
        state.config = {
            ...state.config,
            ...JSON.parse( storedConfig )
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
    const genSubjectsBtn = document.getElementById( 'generateSubjectsBtn' );
    if ( genSubjectsBtn ) genSubjectsBtn.addEventListener( 'click', generateSubjectsFromInput );
    const clearSubjectsBtn = document.getElementById( 'clearSubjectsBtn' );
    if ( clearSubjectsBtn ) clearSubjectsBtn.addEventListener( 'click', clearSubjects );
    const exportSubjectsBtn = document.getElementById( 'exportSubjectsBtn' );
    if ( exportSubjectsBtn ) exportSubjectsBtn.addEventListener( 'click', exportSubjectsCSV );
    const importSubjectsInput = document.getElementById( 'importSubjectsFile' );
    if ( importSubjectsInput ) importSubjectsInput.addEventListener( 'change', handleImportSubjectsCSV );
    document.getElementById( 'saveMasterDataBtn' ).addEventListener( 'click', saveMasterDataFromTables );
    document.getElementById( 'downloadDataTemplatesBtn' ).addEventListener( 'click', downloadMasterDataTemplates );
    createGenerateButton();
    document.getElementById( 'generatePromptBtn' ).addEventListener( 'click', renderAIPrompt );
    document.getElementById( 'copyPromptBtn' ).addEventListener( 'click', copyAIPrompt );
    document.getElementById( 'downloadPromptBtn' ).addEventListener( 'click', downloadAIPrompt );
    ['schoolDaysInput', 'periodsPerDayInput', 'periodsPerTeacherInput', 'aiPromptStyleInput'].forEach( id => {
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
    document.getElementById( 'periodsPerDayInput' ).value = state.config.periodsPerDay || 8;
    document.getElementById( 'periodsPerTeacherInput' ).value = state.config.periodsPerTeacher || 30;
    document.getElementById( 'aiPromptStyleInput' ).value = state.config.aiPromptStyle || 'compact';
}

function syncConfigFromInputs() {
    const days = document.getElementById( 'schoolDaysInput' ).value
        .split( ',' )
        .map( day => toCleanString( day ) )
        .filter( Boolean );
    state.config.schoolDays = days.length > 0 ? days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    state.config.periodsPerDay = Math.max( 1, Number( document.getElementById( 'periodsPerDayInput' ).value ) || 8 );
    state.config.periodsPerTeacher = Math.max( 1, Number( document.getElementById( 'periodsPerTeacherInput' ).value ) || 30 );
    state.config.aiPromptStyle = document.getElementById( 'aiPromptStyleInput' ).value || 'compact';
}

function updateSetupSummary() {
    document.getElementById( 'masterTeachersCount' ).textContent = ( state.teachers || [] ).length;
    document.getElementById( 'masterMappingsCount' ).textContent = ( state.teacherMappings || [] ).length;
    document.getElementById( 'configDaysCount' ).textContent = ( state.config.schoolDays || [] ).length;
    document.getElementById( 'configPeriodsCount' ).textContent = state.config.periodsPerDay || 0;
}

function escapeHtml( value ) {
    return String( value ?? '' )
        .replace( /&/g, '&amp;' )
        .replace( /</g, '&lt;' )
        .replace( />/g, '&gt;' )
        .replace( /"/g, '&quot;' )
        .replace( /'/g, '&#039;' );
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
        const periodsIndex = findHeaderIndex( headers, ['periods per week', 'periodsperweek', 'periods', 'weekly periods'] );
        const fixedPeriodsIndex = findHeaderIndex( headers, ['fixed periods', 'fixedperiods', 'fixed', 'block the periods', 'block'] );
        const modeIndex = findHeaderIndex( headers, ['mode', 'teaching mode'] );
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
                    fixedPeriods: fixedPeriodsIndex >= 0 ? toCleanString( cells[fixedPeriodsIndex] ) : '',
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
    const teacher = ( state.teachers || [] ).find( item => toCleanString( item.id ).toLowerCase() === toCleanString( teacherId ).toLowerCase() );
    return teacher ? teacher.name : '';
}

function renderTeacherMasterTable() {
    const table = document.getElementById( 'teacherMasterTable' );
    const rows = state.teachers || [];
    const classSectionOptions = getClassSectionOptions();
    const baseSubjectOptions = getSubjectOptions(); // array of { code, name }
    table.innerHTML = `
                <thead>
                    <tr><th>Teacher ID</th><th>Teacher Name</th><th>Class Teacher Subject</th><th>Class Teacher Grade/Section</th><th>Phone</th><th>Email</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${rows.map( ( teacher, index ) => {
        const selectedValue = teacher.classTeacherGrade && teacher.classTeacherSection
            ? `${escapeHtml( teacher.classTeacherGrade )}|${escapeHtml( teacher.classTeacherSection )}`
            : '';
        const subjectValue = teacher.classTeacherSubject || teacher.subjects || '';

        // Dynamically ensure the current value is part of the dropdown options
        const rowSubjectOptions = [...baseSubjectOptions];
        const found = rowSubjectOptions.find( o => o.code === subjectValue );
        if ( subjectValue && !found ) {
            rowSubjectOptions.push( { code: subjectValue, name: `${subjectValue} (Unmapped)` } );
        }
        rowSubjectOptions.sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );

        return `
                        <tr data-index="${index}">
                            <td><input value="${escapeHtml( teacher.id )}" data-field="id"></td>
                            <td><input value="${escapeHtml( teacher.name )}" data-field="name"></td>
                            <td>
                                <select data-field="classTeacherSubject">
                                    <option value=""></option>
                                    ${rowSubjectOptions.map( option => `
                                        <option value="${escapeHtml( option.code )}"${option.code === subjectValue ? ' selected' : ''}>${escapeHtml( option.code )} - ${escapeHtml( option.name )}</option>
                                    `).join( '' )}
                                </select>
                            </td>
                            <td>
                                <select data-field="classTeacherGrade" onchange="syncTeacherGradeSection(this)">
                                    <option value=""></option>
                                    ${classSectionOptions.map( option => `
                                        <option value="${escapeHtml( option.value )}"${option.value === selectedValue ? ' selected' : ''}>${escapeHtml( option.label )}</option>
                                    `).join( '' )}
                                </select>
                                <input type="hidden" value="${escapeHtml( teacher.classTeacherSection || '' )}" data-field="classTeacherSection">
                            </td>
                            <td><input value="${escapeHtml( teacher.phone )}" data-field="phone"></td>
                            <td><input value="${escapeHtml( teacher.email )}" data-field="email"></td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteTeacherRow(${index})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `} ).join( '' )}
                </tbody>
            `;

    const searchInput = document.getElementById( 'teacherMappingSearch' );
    if ( searchInput && searchInput.value ) {
        searchInput.dispatchEvent( new Event( 'input' ) );
    }
}

function renderTeacherMappingTable() {
    const table = document.getElementById( 'teacherMappingTable' );
    const rows = state.teacherMappings || [];

    // Sort rows alphabetically by teacher ID, then by grade-section
    rows.sort( ( a, b ) => {
        const tComp = safeLocaleCompare( a.teacherId, b.teacherId );
        if ( tComp !== 0 ) return tComp;
        return compareGradeSection( a.gradeSection, b.gradeSection );
    } );

    const classOptions = getClassSectionOptions();
    const baseSubjectOptions = getSubjectOptions(); // array of { code, name }
    const periodOptions = getPeriodOptions();
    table.innerHTML = `
                <thead>
                    <tr><th>Teacher ID</th><th>Grade-Section</th><th>Subject</th><th>Periods / Week</th><th>Fixed Periods</th><th>Mode</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${rows.map( ( mapping, index ) => {
        const gradeValue = mapping.gradeSection ? escapeHtml( mapping.gradeSection ) : '';
        const gradeValues = mapping.gradeSection ? mapping.gradeSection.split( /[,;]/ ).map( s => s.trim() ) : [];
        const subjectValue = mapping.subject ? escapeHtml( mapping.subject ) : '';
        const fixedPeriodsValue = mapping.fixedPeriods ? escapeHtml( mapping.fixedPeriods ) : '';
        const fixedPeriodsValues = mapping.fixedPeriods ? mapping.fixedPeriods.split( ',' ).map(s => s.trim()) : [];

        // Dynamically ensure the current value is part of the dropdown options
        const rowSubjectOptions = [...baseSubjectOptions];
        const found = rowSubjectOptions.find( o => o.code === subjectValue );
        if ( subjectValue && !found ) {
            rowSubjectOptions.push( { code: subjectValue, name: `${subjectValue} (Unmapped)` } );
        }
        rowSubjectOptions.sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );

        return `
                        <tr data-index="${index}">
                            <td><select data-field="teacherId"><option value=""></option>${( state.teachers || [] ).map( t => `<option value="${escapeHtml( t.id )}"${t.id === mapping.teacherId ? ' selected' : ''}>${escapeHtml( t.id )} - ${escapeHtml( t.name )}</option>` ).join( '' )}</select></td>
                            <td>
                                <select data-field="gradeSection" multiple>
                                    ${classOptions.map( option => `
                                        <option value="${escapeHtml( option.label )}"${gradeValues.includes( option.label ) ? ' selected' : ''}>${escapeHtml( option.label )}</option>
                                    `).join( '' )}
                                </select>
                            </td>
                            <td>
                                <select data-field="subject">
                                    <option value=""></option>
                                    ${rowSubjectOptions.map( option => `
                                        <option value="${escapeHtml( option.code )}"${option.code === subjectValue ? ' selected' : ''}>${escapeHtml( option.code )} - ${escapeHtml( option.name )}</option>
                                    `).join( '' )}
                                </select>
                            </td>
                            <td><input type="number" min="0" value="${escapeHtml( mapping.periodsPerWeek )}" data-field="periodsPerWeek"></td>
                            <td>
                                <select data-field="fixedPeriods" multiple>
                                    ${periodOptions.map( option => `
                                        <option value="${escapeHtml( option.value )}"${fixedPeriodsValues.includes( option.value ) ? ' selected' : ''}>${escapeHtml( option.label )}</option>
                                    `).join( '' )}
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
                    `} ).join( '' )}
                </tbody>
            `;

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
    const periodsPerDay = state.config.periodsPerDay || 8;
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
                const selectedOptions = Array.from( input.selectedOptions ).map( opt => opt.value );
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

    if ( rawClassSections && rawClassSections.length > 0 ) {
        state.classSections = rawClassSections.map( c => ( {
            ...c,
            className: c.className || `Class-${c.class}-${c.section}`
        } ) ).sort( ( a, b ) => compareGradeSection( a.className, b.className ) );
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
                fixedPeriods: mapping.fixedPeriods || ''
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
    const input = document.getElementById( 'bulkClassesInput' );
    if ( !input ) return;
    const lines = input.value.split( /\r?\n/ ).map( l => l.trim() ).filter( Boolean );
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
                                    <option value="0"${normalizeTeachingMode(c.teachingMode) !== 'combined' ? ' selected' : ''}>0 - Individual</option>
                                    <option value="1"${normalizeTeachingMode(c.teachingMode) === 'combined' ? ' selected' : ''}>1 - Combined</option>
                                </select>
                            </td>
                            
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
                            <td>${escapeHtml( subject.code )}</td>
                            <td>${escapeHtml( subject.name )}</td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteSubject(${i})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join( '' )}
                </tbody>
            `;
}

function getSubjectOptions() {
    return ( state.subjects || [] ).slice().sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );
}

function generateSubjectsFromInput() {
    const input = document.getElementById( 'bulkSubjectsInput' );
    if ( !input ) return;
    const lines = input.value.split( /\r?\n/ ).map( l => toCleanString( l ) ).filter( Boolean );
    const uniques = new Map();
    ( state.subjects || [] ).forEach( s => uniques.set( toCleanString( s.code ), s ) );

    lines.forEach( line => {
        const parts = line.split( /[,:]/ );
        let code = toCleanString( parts[0] );
        let name = parts.length > 1 ? toCleanString( parts.slice( 1 ).join( line.includes( ',' ) ? ',' : ':' ) ) : code;

        // Smart swap: Subject Codes are typically shorter than Names.
        if ( code.length > name.length && name.length > 0 ) {
            const tmp = code;
            code = name;
            name = tmp;
        }

        if ( code ) {
            uniques.set( toCleanString( code ), { code, name } );
        }
    } );
    state.subjects = Array.from( uniques.values() ).sort( ( a, b ) => safeLocaleCompare( a.code, b.code ) );
    saveMasterDataToStorage();
    renderSubjectsTable();
    renderTeacherMasterTable();
    renderTeacherMappingTable();
    alert( 'Generated ' + lines.length + ' subject entries.' );
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
    const csv = 'Subject Code,Subject Name\n' + rows.map( s => `${escapeCSVField( s.code )},${escapeCSVField( s.name )}` ).join( '\n' );
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
    const lines = rows.map( r => `${escapeCSVField( r.class || '' )},${escapeCSVField( r.section || '' )},${escapeCSVField( normalizeTeachingMode(r.teachingMode) === 'combined' ? '1' : '0' )},${escapeCSVField( r.combinedGroupId || '' )}` );
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
    return Array.from( { length: state.config.periodsPerDay || 8 }, ( _, index ) => `P${index + 1}` );
}

function buildAIPrompt() {
    syncConfigFromInputs();
    const days = state.config.schoolDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periodHeaders = makePeriodHeaders();

    // Read directly from the DOM to capture any un-saved manual edits or new rows the user added
    const uiMappings = readTableRows('teacherMappingTable', ['teacherId', 'gradeSection', 'subject', 'periodsPerWeek', 'fixedPeriods', 'mode']);

    const mappings = uiMappings.map((uiRow, index) => {
        const stateRow = (state.teacherMappings && state.teacherMappings[index]) || {};
        
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
    }).filter(row => row.gradeSection !== '-' && row.subject !== '-'); // Only include valid rows

    let detailedData = '';
    if (state.config.aiPromptStyle === 'detailed') {
        let csv = 'Teacher ID,Grade-Section,Subject,Periods / Week,Fixed Periods,Mode\n';
        mappings.forEach(mapping => {
            csv += [mapping.teacherId, mapping.gradeSection, mapping.subject, mapping.periodsPerWeek, mapping.fixedPeriods, mapping.mode].map(escapeCSVField).join(',') + '\n';
        });
        detailedData = `\nTeacher Grade-Section Subject Mapping:\n${csv}\n`;
    } else {
        const compactMappings = mappings.map(row =>
            `${row.teacherId} | ${row.gradeSection} | ${row.subject} | ${row.periodsPerWeek} | ${row.fixedPeriods} | ${row.mode}`
        );
        detailedData = `\nTeacher Grade-Section Subject Mapping:\n${compactMappings.join('\n') || 'No mappings imported yet.'}\n`;
    }

    return `You are generating a school timetable from local principal-provided data.

Config:
- Days: ${days.join(', ')}
- Periods per day: ${state.config.periodsPerDay}
- Max periods per teacher per week: ${state.config.periodsPerTeacher}
- Output columns: Class-Section,Day,${periodHeaders.join(',')}
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
        csv += [teacher.id, teacher.name, teacher.classTeacherSubject || teacher.subjects || '', teacher.classTeacherGrade || '', teacher.classTeacherSection || '', teacher.phone, teacher.email].map( escapeCSVField ).join( ',' ) + '\n';
    } );
    return csv.trim();
}

function toMappingCSV( mappings ) {
    let csv = 'Teacher ID,Teacher Name,Grade-Section,Subject,Periods Per Week,Fixed Periods,Mode\n';
    mappings.forEach( mapping => {
        const modeVal = mapping.mode === '1' || mapping.mode === 'combined' ? '1' : (mapping.mode === '0' || mapping.mode === 'individual' ? '0' : '');
        csv += [mapping.teacherId, mapping.teacherName, mapping.gradeSection, mapping.subject, mapping.periodsPerWeek, mapping.fixedPeriods || '', modeVal].map( escapeCSVField ).join( ',' ) + '\n';
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
            escapeCsvField( mapping.mode === '1' || mapping.mode === 'combined' ? '1' : (mapping.mode === '0' || mapping.mode === 'individual' ? '0' : '') )
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

function getStandardDayOrder() {
    return ( state.config && state.config.schoolDays && state.config.schoolDays.length > 0 )
        ? state.config.schoolDays
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
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
    const schoolDays = getStandardDayOrder();
    const periodsPerDay = state.config.periodsPerDay || 8;

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
let teacherLoadTracker = {};
let currentUnscheduledList = [];

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
    const input = document.getElementById( 'bulkClassesInput' );
    if ( !input || !toCleanString( input.value ) ) return;

    const lines = input.value.split( /\r?\n/ ).map( line => line.trim() ).filter( Boolean );
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
    const schoolDays = getStandardDayOrder();
    const periodsPerDay = state.config.periodsPerDay || 8;
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
    teacherLoadTracker = {};
    classDailySubjectCount = {};
}

// Tracks how many times each subject appears per class per day (for spread constraint).
let classDailySubjectCount = {};

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

function isCscSubject( subject ) {
    return normalizeSubjectCode( subject ) === 'CSC';
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
        return [`Class-${grade}-A`];
    }

    if ( withSection.startsWith( 'Class-' ) ) return [withSection];
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
    const maxPerDay = options.isLabBlock ? 2 : 2;
    const current = getDailySubjectCount( className, dayName, subject );
    return current + additionalPeriods > maxPerDay;
}

/** Score a candidate slot — higher is better. */
function scoreCandidateSlot( timetable, task, dayName, periodNumbers, options ) {
    let score = 100;
    const subjectKey = normalizeSubjectCode( task.subject );
    const schoolDays = getStandardDayOrder();
    const dailyCount = getDailySubjectCount( task.className, dayName, task.subject );

    if ( dailyCount === 0 ) score += 40;
    else if ( dailyCount === 1 ) score += 10;
    else score -= 50;

    const dayIndex = schoolDays.indexOf( dayName );
    const weeklyCounts = schoolDays.map( day => getDailySubjectCount( task.className, day, task.subject ) );
    const minWeeklyDayCount = Math.min( ...weeklyCounts );
    if ( dailyCount === minWeeklyDayCount ) score += 25;

    periodNumbers.forEach( periodNumber => {
        const previousSubject = getPreviousPeriodSubject( timetable, task.className, dayName, periodNumber );
        if ( previousSubject && previousSubject === subjectKey ) {
            score -= 60;
        }
        const nextPeriod = getClassDayPeriod( timetable, task.className, dayName, periodNumber + 1 );
        if ( nextPeriod && normalizeSubjectCode( nextPeriod.subject ) === subjectKey ) {
            score -= 30;
        }
    } );

    if ( options.preferFixedPeriods ) score += 15;

    const teacherLoad = getTeacherLoad( task.teacherId );
    score -= teacherLoad * 2;

    if ( options.isLabBlock && periodNumbers.length === 2 ) {
        const blockKey = periodNumbers.join( '-' );
        if ( blockKey === '1-2' || blockKey === '5-6' ) score += 20;
    }

    return score;
}

/** Find the highest-scoring valid slot for a task. */
function findBestCandidateSlot( timetable, task, periodNumbers, options, maxTeacherPeriods, labBlockList, searchAllPeriods ) {
    const candidates = [];
    const periodsPerDay = state.config.periodsPerDay || 8;
    const schoolDays = getStandardDayOrder();
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
function assignSlotWithTracking( timetable, className, dayName, periodNumbers, teacherId, subject, teacherName ) {
    assignSlot( timetable, className, dayName, periodNumbers, teacherId, subject, teacherName );
    incrementDailySubjectCount( className, dayName, subject, periodNumbers.length );
}

function getTeacherLoad( teacherId ) {
    return teacherLoadTracker[toCleanString( teacherId )] || 0;
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

/** Write subject + teacher into the canonical days/periods structure. */
function assignSlot( timetable, className, dayName, periodNumbers, teacherId, subject, teacherName ) {
    const tid = toCleanString( teacherId );
    const resolvedTeacherName = teacherName || findTeacherNameById( tid );
    const resolvedSubject = toCleanString( subject );

    periodNumbers.forEach( periodNumber => {
        const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
        if ( !periodEntry ) return;

        periodEntry.teacherId = tid;
        periodEntry.teacherName = resolvedTeacherName;
        periodEntry.subject = resolvedSubject;

        if ( !teacherBusyTracker[tid] ) teacherBusyTracker[tid] = {};
        teacherBusyTracker[tid][`${dayName}-P${periodNumber}`] = true;
    } );

    teacherLoadTracker[tid] = getTeacherLoad( tid ) + periodNumbers.length;
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
    toCleanString( fixedPeriodsStr )
        .split( /[,;]/ )
        .map( part => part.trim() )
        .filter( Boolean )
        .forEach( part => {
            const expanded = expandFixedPeriodEntry( part );
            if ( expanded.length > 0 ) groups.push( expanded );
        } );
    return groups;
}

/** True when a task requires Period 1 only (bare "1", "P1", etc.). */
function taskRequiresFixedPeriodOne( task ) {
    return ( task.fixedPeriodGroups || [] ).some(
        group => group.length === 1 && group[0] === 1
    );
}

/** Lock empty P1 slots so later schedulers cannot place other subjects there. */
function reserveClassP1Slots( timetable, tasks ) {
    const schoolDays = getStandardDayOrder();
    const reservedClasses = new Set();

    tasks.forEach( task => {
        if ( !task.hasFixedPeriods || !taskRequiresFixedPeriodOne( task ) ) return;
        if ( reservedClasses.has( task.className ) ) return;
        reservedClasses.add( task.className );

        schoolDays.forEach( dayName => {
            const periodEntry = getClassDayPeriod( timetable, task.className, dayName, 1 );
            if ( periodEntry && isPeriodSlotEmpty( periodEntry ) ) {
                periodEntry.isLocked = true;
            }
        } );
    } );
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
    const schoolDays = getStandardDayOrder();
    const periodsPerDay = state.config.periodsPerDay || 8;
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

function normalizeTeachingMode(value) {
    const v = toCleanString(value).toLowerCase();
    if (v === "1" || v === "combined") return "combined";
    return "individual";
}

function getClassMetaMap() {
    const map = {};
    (state.classSections || []).forEach(item => {
        if (!item) return;
        const key = normalizeClassSectionLabel(item.className || `${item.class}-${item.section}`);
        map[key] = {
            teachingMode: normalizeTeachingMode(item.teachingMode),
            combinedGroupId: toCleanString(item.combinedGroupId || "")
        };
    });
    return map;
}

function resolveCombinedTeaching(mapping, classNames) {
    const classMetaMap = getClassMetaMap();
    const normalizedClassNames = [...new Set((classNames || []).map(c => normalizeClassSectionLabel(c)).filter(Boolean))];

    const rawMode = toCleanString(mapping.mode).toLowerCase();
    const isExplicitlyCombined = rawMode === "1" || rawMode === "combined";
    const isExplicitlyIndividual = rawMode === "0" || rawMode === "individual";
    const mappingGroupId = toCleanString(mapping.combinedGroupId);

    if (isExplicitlyCombined && mappingGroupId && normalizedClassNames.length > 0) {
        return {
            isCombined: true,
            combinedGroupId: mappingGroupId,
            classNames: normalizedClassNames
        };
    }

    if (isExplicitlyIndividual) {
        return {
            isCombined: false,
            combinedGroupId: "",
            classNames: normalizedClassNames
        };
    }

    const grouped = normalizedClassNames.filter(className => {
        const meta = classMetaMap[className];
        return meta && meta.teachingMode === "combined" && meta.combinedGroupId;
    });

    if (grouped.length > 0) {
        const firstMeta = classMetaMap[grouped[0]];
        const sameGroup = normalizedClassNames.filter(className => {
            const meta = classMetaMap[className];
            return meta && meta.teachingMode === "combined" && meta.combinedGroupId === firstMeta.combinedGroupId;
        });

        if (sameGroup.length > 0) {
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

/** Flatten teacher mappings into schedulable tasks (one per resolved class name). */
function buildSchedulingTasks() {
    const tasks = [];
    const combinedGroups = new Map();

    ( state.teacherMappings || [] ).forEach( ( mapping, mappingIndex ) => {
        const classNames = parseGradeSectionParts( mapping.gradeSection )
            .flatMap( part => resolveMappingToClassNames( part ) )
            .filter( Boolean );

        const uniqueClassNames = [...new Set( classNames )];
        const subjectCode = normalizeSubjectCode( mapping.subject );
        const teacherId = mapping.teacherId;

        const resolved = resolveCombinedTeaching( mapping, uniqueClassNames );

        if ( resolved.isCombined ) {
            const groupKey = `${resolved.combinedGroupId}-${subjectCode}-${teacherId}`;
            if ( !combinedGroups.has( groupKey ) ) {
                combinedGroups.set( groupKey, {
                    mappingIndex,
                    className: resolved.classNames[0],
                    teacherId,
                    teacherName: mapping.teacherName || findTeacherNameById( teacherId ),
                    subject: subjectCode,
                    periodsNeeded: Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ),
                    fixedPeriodGroups: parseFixedPeriodGroups( mapping.fixedPeriods ),
                    isLabSubject: subjectCode === 'CSC',
                    hasFixedPeriods: parseFixedPeriodGroups( mapping.fixedPeriods ).length > 0,
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

        if ( subjectCode === 'CSC' && uniqueClassNames.length > 1 ) {
            tasks.push( {
                mappingIndex,
                className: uniqueClassNames[0],
                teacherId: mapping.teacherId,
                teacherName: mapping.teacherName || findTeacherNameById( mapping.teacherId ),
                subject: subjectCode,
                periodsNeeded: Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ),
                fixedPeriodGroups: parseFixedPeriodGroups( mapping.fixedPeriods ),
                isLabSubject: true,
                hasFixedPeriods: parseFixedPeriodGroups( mapping.fixedPeriods ).length > 0,
                isClubbed: true,
                clubbedClasses: uniqueClassNames
            } );
        } else {
            uniqueClassNames.forEach( className => {
                tasks.push( {
                    mappingIndex,
                    className,
                    teacherId: mapping.teacherId,
                    teacherName: mapping.teacherName || findTeacherNameById( mapping.teacherId ),
                    subject: subjectCode,
                    periodsNeeded: Math.max( 0, Number( mapping.periodsPerWeek ) || 0 ),
                    fixedPeriodGroups: parseFixedPeriodGroups( mapping.fixedPeriods ),
                    isLabSubject: subjectCode === 'CSC',
                    hasFixedPeriods: parseFixedPeriodGroups( mapping.fixedPeriods ).length > 0
                } );
            } );
        }
    } );

    combinedGroups.forEach( group => {
        group.clubbedClasses = Array.from( group.clubbedClasses );
        group.className = group.clubbedClasses[0];
        tasks.push( group );
    } );

    return tasks;
}

/** CSC must use consecutive 2-period blocks at P1–P2 or P5–P6 only. */
const CSC_LAB_BLOCKS = [[1, 2], [5, 6]];

function findBestClubbedCandidateSlot( timetable, task, maxTeacherPeriods, labBlockList ) {
    const candidates = [];
    const schoolDays = getStandardDayOrder();
    const slotPatterns = [];

    if ( labBlockList && labBlockList.length > 0 ) {
        schoolDays.forEach( dayName => {
            labBlockList.forEach( block => slotPatterns.push( { dayName, periodNumbers: block } ) );
        } );
    } else {
        const periodsPerDay = state.config.periodsPerDay || 8;
        schoolDays.forEach( dayName => {
            for ( let periodNumber = 1; periodNumber <= periodsPerDay; periodNumber++ ) {
                slotPatterns.push( { dayName, periodNumbers: [periodNumber] } );
            }
        });
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

function scheduleLabBlock( timetable, task, unscheduled ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 30;
    let remaining = task.periodsNeeded;

    while ( remaining >= 2 ) {
        let best = null;
        if ( task.isClubbed ) {
            best = findBestClubbedCandidateSlot(
                timetable,
                task,
                maxTeacherPeriods,
                CSC_LAB_BLOCKS
            );
        } else {
            best = findBestCandidateSlot(
                timetable,
                task,
                null,
                { isLabBlock: true },
                maxTeacherPeriods,
                CSC_LAB_BLOCKS
            );
        }

        if ( !best ) break;

        if ( task.isClubbed ) {
            const blockHasLockedSlot = best.periodNumbers.some( periodNumber => {
                return task.clubbedClasses.some( className => {
                    const period = getClassDayPeriod( timetable, className, best.dayName, periodNumber );
                    return period && period.isLocked;
                } );
            } );
            if ( blockHasLockedSlot ) break;

            task.clubbedClasses.forEach( ( className, idx ) => {
                assignSlotWithTracking(
                    timetable,
                    className,
                    best.dayName,
                    best.periodNumbers,
                    task.teacherId,
                    task.subject,
                    task.teacherName
                );
                if ( idx > 0 ) {
                    const tid = toCleanString( task.teacherId );
                    teacherLoadTracker[tid] = Math.max( 0, getTeacherLoad( tid ) - best.periodNumbers.length );
                }
            } );
        } else {
            const blockHasLockedSlot = best.periodNumbers.some( periodNumber => {
                const period = getClassDayPeriod( timetable, task.className, best.dayName, periodNumber );
                return period && period.isLocked;
            } );
            if ( blockHasLockedSlot ) break;

            assignSlotWithTracking(
                timetable,
                task.className,
                best.dayName,
                best.periodNumbers,
                task.teacherId,
                task.subject,
                task.teacherName
            );
        }
        remaining -= best.periodNumbers.length;
    }

    if ( remaining > 0 ) {
        unscheduled.push( {
            className: task.isClubbed ? task.clubbedClasses.join( ';' ) : task.className,
            teacherId: task.teacherId,
            teacherName: task.teacherName,
            subject: task.subject,
            periodsNeeded: task.periodsNeeded,
            periodsScheduled: task.periodsNeeded - remaining,
            periodsUnscheduled: remaining,
            reason: 'CSC lab block could not be fully scheduled'
        } );
    }
}

/** Schedule all fixed-period mappings first (class-teacher P1 slots, etc.). */
function scheduleFixedTasks( timetable, tasks, deferredTasks, unscheduled ) {
    const maxTeacherPeriods = state.config.periodsPerTeacher || 30;
    const schoolDays = getStandardDayOrder();

    reserveClassP1Slots( timetable, tasks );

    tasks.forEach( task => {
        console.log( "Scheduling fixed task:", task );

        if ( !task.hasFixedPeriods ) {
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

                        const periodEntry = getClassDayPeriod( timetable, task.className, dayName, 1 );
                        if ( !periodEntry || !isPeriodSlotEmpty( periodEntry ) ) {
                            continue;
                        }

                        if ( !canAssignFixedP1Slot(
                            timetable,
                            task.className,
                            dayName,
                            1,
                            task.teacherId,
                            maxTeacherPeriods
                        ) ) {
                            continue;
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
                        periodEntry.isLocked = true;
                        console.log(
                            "Fixed period assigned",
                            task.className,
                            dayName,
                            "P1",
                            task.subject
                        );
                        remaining -= 1;
                        assignedThisRound = true;
                    }
                } else if ( periodNumbers.length === 1 ) {
                    const periodNumber = periodNumbers[0];
                    for ( const dayName of schoolDays ) {
                        if ( remaining <= 0 ) break;

                        const periodEntry = getClassDayPeriod( timetable, task.className, dayName, periodNumber );
                        if ( !periodEntry || periodEntry.isLocked || !isPeriodSlotEmpty( periodEntry ) ) {
                            continue;
                        }

                        const validation = validateSlot(
                            timetable,
                            task.className,
                            dayName,
                            [periodNumber],
                            task.teacherId,
                            maxTeacherPeriods
                        );
                        if ( !validation.valid ) continue;

                        assignSlotWithTracking(
                            timetable,
                            task.className,
                            dayName,
                            [periodNumber],
                            task.teacherId,
                            task.subject,
                            task.teacherName
                        );
                        periodEntry.isLocked = true;
                        console.log(
                            "Fixed period assigned",
                            task.className,
                            dayName,
                            `P${periodNumber}`,
                            task.subject
                        );
                        remaining -= 1;
                        assignedThisRound = true;
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

                    assignSlotWithTracking(
                        timetable,
                        task.className,
                        best.dayName,
                        best.periodNumbers,
                        task.teacherId,
                        task.subject,
                        task.teacherName
                    );
                    best.periodNumbers.forEach( periodNumber => {
                        const periodEntry = getClassDayPeriod( timetable, task.className, best.dayName, periodNumber );
                        if ( periodEntry ) periodEntry.isLocked = true;
                    } );
                    console.log(
                        "Fixed period assigned",
                        task.className,
                        best.dayName,
                        best.periodNumbers.map( n => `P${n}` ).join( '-' ),
                        task.subject
                    );
                    remaining -= best.periodNumbers.length;
                    assignedThisRound = true;
                }
                break;
            }

            if ( !assignedThisRound ) {
                console.warn( "Failed fixed scheduling", task );
                break;
            }
        }

        if ( remaining > 0 ) {
            if ( taskRequiresFixedPeriodOne( task ) ) {
                console.warn( "Fixed class teacher period failed", task );
            } else {
                console.warn( "Failed fixed scheduling", task );
            }
            ( unscheduled || [] ).push( {
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
    const maxTeacherPeriods = state.config.periodsPerTeacher || 30;
    const schoolDays = getStandardDayOrder();

    tasks.forEach( task => {
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

                        task.clubbedClasses.forEach( ( className, idx ) => {
                            assignSlotWithTracking( timetable, className, dayName, [1], task.teacherId, task.subject, task.teacherName );
                            const periodEntry = getClassDayPeriod( timetable, className, dayName, 1 );
                            if ( periodEntry ) periodEntry.isLocked = true;

                            if ( idx > 0 ) {
                                const tid = toCleanString( task.teacherId );
                                teacherLoadTracker[tid] = Math.max( 0, getTeacherLoad( tid ) - 1 );
                            }
                        } );

                        console.log( "Fixed combined period assigned", task.clubbedClasses, dayName, "P1", task.subject );
                        remaining -= 1;
                        assignedThisRound = true;
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

                        task.clubbedClasses.forEach( ( className, idx ) => {
                            assignSlotWithTracking( timetable, className, dayName, [periodNumber], task.teacherId, task.subject, task.teacherName );
                            const periodEntry = getClassDayPeriod( timetable, className, dayName, periodNumber );
                            if ( periodEntry ) periodEntry.isLocked = true;

                            if ( idx > 0 ) {
                                const tid = toCleanString( task.teacherId );
                                teacherLoadTracker[tid] = Math.max( 0, getTeacherLoad( tid ) - 1 );
                            }
                        } );

                        console.log( "Fixed combined period assigned", task.clubbedClasses, dayName, `P${periodNumber}`, task.subject );
                        remaining -= 1;
                        assignedThisRound = true;
                    }
                } else {
                    const best = findBestClubbedCandidateSlot(
                        timetable,
                        task,
                        maxTeacherPeriods,
                        [periodNumbers]
                    );

                    if ( !best ) continue;

                    task.clubbedClasses.forEach( ( className, idx ) => {
                        assignSlotWithTracking( timetable, className, best.dayName, best.periodNumbers, task.teacherId, task.subject, task.teacherName );
                        best.periodNumbers.forEach( periodNumber => {
                            const periodEntry = getClassDayPeriod( timetable, className, best.dayName, periodNumber );
                            if ( periodEntry ) periodEntry.isLocked = true;
                        } );

                        if ( idx > 0 ) {
                            const tid = toCleanString( task.teacherId );
                            teacherLoadTracker[tid] = Math.max( 0, getTeacherLoad( tid ) - best.periodNumbers.length );
                        }
                    } );

                    console.log( "Fixed combined period assigned", task.clubbedClasses, best.dayName, best.periodNumbers.map( n => `P${n}` ).join( '-' ), task.subject );
                    remaining -= best.periodNumbers.length;
                    assignedThisRound = true;
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
            ( unscheduled || [] ).push( {
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
    const maxTeacherPeriods = state.config.periodsPerTeacher || 30;
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
        if ( blockHasLockedSlot ) break;

        task.clubbedClasses.forEach( ( className, idx ) => {
            assignSlotWithTracking(
                timetable,
                className,
                best.dayName,
                best.periodNumbers,
                task.teacherId,
                task.subject,
                task.teacherName
            );
            if ( idx > 0 ) {
                const tid = toCleanString( task.teacherId );
                // Revert the extra increment since it's the same teacher at the same time
                teacherLoadTracker[tid] = Math.max( 0, getTeacherLoad( tid ) - best.periodNumbers.length );
            }
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
    const maxTeacherPeriods = state.config.periodsPerTeacher || 30;
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

        if ( !best ) break;

        const slotHasLockedPeriod = best.periodNumbers.some( periodNumber => {
            const period = getClassDayPeriod( timetable, task.className, best.dayName, periodNumber );
            return period && period.isLocked;
        } );
        if ( slotHasLockedPeriod ) break;

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

/** Assign generated timetable to state and persist using existing storage helpers. */
function saveGeneratedTimetable( timetable, unscheduled ) {
    state.timetableData = timetable;
    assignTeacherIdsInTimetableData();
    saveTimetableToStorage();
    rebuildTeacherSubjectMapFromMasterData();
    saveTeacherSubjectMapToStorage();
    currentUnscheduledList = unscheduled || [];
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

/** Main entry: fixed tasks → CSC lab blocks → score-based normal scheduling. */
function generateTimetable() {
    if ( !( state.teacherMappings || [] ).length ) {
        alert( 'Add at least one teacher-subject mapping with periods per week before generating.' );
        return;
    }

    resetGenerationTrackers();
    const timetable = createEmptyTimetable();

    if ( Object.keys( timetable ).length === 0 ) {
        alert( 'Define class sections under Bulk Classes & Sections (or include grade-sections in mappings) first.' );
        return;
    }

    const unscheduled = [];
    const allTasks = buildSchedulingTasks();
    const deferredTasks = [];

    const fixedTasks = allTasks.filter( task => task.hasFixedPeriods && !task.isClubbed );
    const fixedCombinedTasks = allTasks.filter( task => task.hasFixedPeriods && task.isClubbed );
    const labTasks = allTasks.filter( task => task.isLabSubject && !task.hasFixedPeriods );
    const combinedNormalTasks = allTasks.filter( task => task.isClubbed && !task.hasFixedPeriods && !task.isLabSubject );
    const normalTasks = allTasks.filter( task => !task.hasFixedPeriods && !task.isLabSubject && !task.isClubbed );

    scheduleFixedTasks( timetable, fixedTasks, deferredTasks, unscheduled );
    scheduleFixedCombinedTasks( timetable, fixedCombinedTasks, deferredTasks, unscheduled );

    labTasks.forEach( task => scheduleLabBlock( timetable, task, unscheduled ) );
    
    combinedNormalTasks.forEach( task => scheduleCombinedTask( timetable, task, unscheduled ) );

    [...normalTasks, ...deferredTasks.filter( task => !task.isLabSubject )].forEach( task => {
        scheduleNormalTask( timetable, task, unscheduled );
    } );

    const classCount = Object.keys( timetable ).length;

    saveGeneratedTimetable( timetable, unscheduled );
    updateTimetableSummary();
    updateClassFilters();
    renderTimetable();
    showTimetableGenerationStatus( classCount, unscheduled );

    // Auto-switch to View Timetable tab so the user sees the report immediately
    const viewTab = document.querySelector( '.tab[data-target="view-timetable-section"]' );
    if ( viewTab ) viewTab.click();

    // Render report in the UI
    renderGenerationReport();

    let message = `Timetable generated for ${classCount} class section(s).`;
    if ( unscheduled.length > 0 ) {
        message += `\n\n${unscheduled.length} mapping(s) could not be fully scheduled:`;
        message += '\n' + unscheduled.slice( 0, 5 ).map( item =>
            `${item.className} / ${item.subject} (${item.teacherId}): ${item.periodsUnscheduled} period(s) remaining`
        ).join( '\n' );
        if ( unscheduled.length > 5 ) {
            message += `\n... and ${unscheduled.length - 5} more.`;
        }
    }
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
            const days = getStandardDayOrder().map( dayName => ( {
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
    // Default times starting from 8:00 AM, 45-minute periods
    const startHour = 8;
    const periodDuration = 45;
    const breakDuration = 15;

    let totalMinutes = ( startHour * 60 ) + ( ( periodNumber - 1 ) * ( periodDuration + breakDuration ) );

    // Adjust for breaks (assume break after 4th period)
    if ( periodNumber > 4 ) {
        totalMinutes += 30; // Long break
    }

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

function escapeHtmlAttribute( value ) {
    return String( value )
        .replace( /&/g, '&amp;' )
        .replace( /"/g, '&quot;' )
        .replace( /</g, '&lt;' )
        .replace( />/g, '&gt;' );
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
    return Array.from( select.selectedOptions )
        .map( option => option.value )
        .filter( value => value && value.trim() !== '' );
}

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

    // Combine classes from loaded timetable data and generated classSections
    const classSet = new Set();
    if ( state.timetableData ) Object.keys( state.timetableData ).forEach( c => classSet.add( c ) );
    ( state.classSections || [] ).forEach( c => {
        if ( !c ) return;
        classSet.add( c.className || ( typeof c === 'string' ? c : `${c.class || ''}-${c.section || ''}` ) );
    } );
    const classes = Array.from( classSet ).sort( ( a, b ) => compareGradeSection( a, b ) );

    // Update class filter in View Timetable
    const classFilter = document.getElementById( 'classFilter' );
    const selectedClasses = getMultiSelectValues( 'classFilter' );
    classFilter.innerHTML = '';
    classes.forEach( className => {
        const isSelected = selectedClasses.includes( className ) ? ' selected' : '';
        classFilter.innerHTML += `<option value="${className}"${isSelected}>${className}</option>`;
    } );
    if ( selectedClasses.length === 0 ) {
        classFilter.selectedIndex = -1;
    }

    // Update class filter in Modify Timetable
    const modifyClassFilter = document.getElementById( 'modifyClassFilter' );
    modifyClassFilter.innerHTML = '<option value="">Select Class</option>';
    classes.forEach( className => {
        modifyClassFilter.innerHTML += `<option value="${className}">${className}</option>`;
    } );

    // Update teacher filter from valid timetable entries only
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
    const sortedTeachers = Array.from( teachers )
        .sort( ( a, b ) => safeLocaleCompare( a, b ) );

    const teacherFilter = document.getElementById( 'teacherFilter' );
    const selectedTeachers = getMultiSelectValues( 'teacherFilter' );
    teacherFilter.innerHTML = '';
    sortedTeachers.forEach( teacher => {
        const isSelected = selectedTeachers.includes( teacher ) ? ' selected' : '';
        teacherFilter.innerHTML += `<option value="${teacher}"${isSelected}>${teacher}</option>`;
    } );
    if ( selectedTeachers.length === 0 ) {
        teacherFilter.selectedIndex = -1;
    }

    const teacherScheduleFilter = document.getElementById( 'teacherScheduleFilter' );
    teacherScheduleFilter.innerHTML = '<option value="">Select Teacher</option>';
    sortedTeachers.forEach( teacher => {
        teacherScheduleFilter.innerHTML += `<option value="${teacher}">${teacher}</option>`;
    } );

    const subjectFilter = document.getElementById( 'subjectFilter' );
    const selectedSubjects = getMultiSelectValues( 'subjectFilter' );
    subjectFilter.innerHTML = '';

    const uniqueSubjects = Array.from( getUniqueSubjectMap().entries() )
        .sort( ( a, b ) => safeLocaleCompare( a[1], b[1] ) );

    uniqueSubjects.forEach( ( [subjectKey, subjectLabel] ) => {
        const isSelected = selectedSubjects.includes( subjectKey ) ? ' selected' : '';
        subjectFilter.innerHTML += `<option value="${subjectKey}"${isSelected}>${subjectLabel}</option>`;
    } );
    if ( selectedSubjects.length === 0 ) {
        subjectFilter.selectedIndex = -1;
    }
}

// Render timetable
function renderTimetable() {
    const timetableDisplay = document.getElementById( 'timetableDisplay' );

    if ( !state.timetableData ) {
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
        document.getElementById( 'goToUploadBtn' ).addEventListener( 'click', function () {
            document.querySelector( '.tab[data-target="upload-timetable-section"]' ).click();
        } );
        return;
    }

    // Get filter values
    const classFilters = getMultiSelectValues( 'classFilter' );
    const teacherFilters = getMultiSelectValues( 'teacherFilter' );
    const subjectFilters = getMultiSelectValues( 'subjectFilter' );

    let html = '';

    if ( state.currentView === 'class' ) {
        // Show class-wise timetable
        const classesToShow = classFilters.length > 0 ? classFilters : Object.keys( state.timetableData );

        classesToShow.forEach( className => {
            const classData = state.timetableData[className];
            if ( !isValidTimetableClassData( classData ) ) return;

            html += `<h3 style="margin: 20px 0 10px 15px;">${className}</h3>`;
            html += generateTimetableHTML( classData );
        } );
    } else if ( state.currentView === 'teacher' ) {
        // Show teacher-wise timetable
        html = generateTeacherTimetableHTML( teacherFilters );
    } else if ( state.currentView === 'subject' ) {
        // Show subject-wise timetable
        html = generateSubjectTimetableHTML( subjectFilters );
    }

    timetableDisplay.innerHTML = html;
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
    const dayOrder = getStandardDayOrder();

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
            } else if ( !hasSubject && !hasTeacher ) {
                html += `
                            <td class="period-cell break-cell ${editedClass}" data-class="${classData.className}" data-day="${dayName}" data-period="${period.period}">
                                ${editIconHtml}
                                ${editedIndicator}
                                <div class="period-subject">BREAK</div>
                                <div class="period-teacher">No Teacher</div>
                            </td>
                        `;
            } else {
                const overlapClass = period.overlap ? 'overlap' : '';
                const overlapTooltip = period.overlapInfo || 'Teacher overlap detected.';
                const overlapWarningHtml = period.overlap
                    ? `<div class="overlap-warning" title="${escapeHtmlAttribute( overlapTooltip )}" aria-label="${escapeHtmlAttribute( overlapTooltip )}"><i class="fas fa-exclamation-triangle"></i></div>`
                    : '';
                const subjectHtml = hasSubject
                    ? `<div class="period-subject">${period.subject}</div>`
                    : '<div class="period-subject subject-missing" title="No subject assigned" aria-label="No subject assigned">🟡</div>';
                const teacherHtml = hasTeacher
                    ? `<div class="period-teacher">${period.teacherName}</div>`
                    : '<div class="period-teacher">No Teacher</div>';
                html += `
                            <td class="period-cell ${overlapClass} ${editedClass}" data-class="${classData.className}" data-day="${dayName}" data-period="${period.period}">
                                ${editIconHtml}
                                ${overlapWarningHtml}
                                ${editedIndicator}
                                ${subjectHtml}
                                ${teacherHtml}
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
function generateTeacherTimetableHTML( teacherFilters ) {
    if ( !teacherFilters || teacherFilters.length === 0 ) {
        return '<div class="empty-state"><p>Please select one or more teachers to view their schedules.</p></div>';
    }

    if ( !state.timetableData ) return '<p>No timetable data.</p>';

    let html = '';
    teacherFilters.forEach( teacherFilter => {
        const dayOrder = getStandardDayOrder();
        const teacherGrid = {};
        dayOrder.forEach( day => {
            teacherGrid[day] = {};
        } );

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
            html += `<div class="empty-state"><p>No schedule found for teacher: ${teacherFilter}</p></div>`;
            return;
        }

        html += `<h3 style="margin: 20px 0 10px 15px;">Schedule for ${teacherFilter}</h3>`;
        html += '<table class="timetable">';
        html += '<thead><tr><th>Day/Period</th>';
        for ( let i = 1; i <= maxPeriods; i++ ) {
            const headerTime = getPeriodTime( i );
            html += `<th><div>P${i}</div><div class="period-header-time">${headerTime}</div></th>`;
        }

        html += '</tr></thead><tbody>';

        dayOrder.forEach( dayName => {
            html += `<tr><td style="font-weight: 600; background-color: #f9f9f9;">${dayName}</td>`;

            for ( let p = 1; p <= maxPeriods; p++ ) {
                const entries = ( teacherGrid[dayName] && teacherGrid[dayName][p] ) ? teacherGrid[dayName][p] : [];
                let periodInfo = '';

                if ( entries.length > 0 ) {
                    const periodText = entries.map( entry =>
                        `${entry.className}: ${entry.subject || '<span class="no-subject-marker" title="No subject assigned" aria-label="No subject assigned">🟡</span>'}`
                    ).join( '<br>' );

                    periodInfo = `
                                <div class="period-subject">${periodText}</div>
                            `;
                }

                html += `<td class="period-cell">${periodInfo}</td>`;
            }

            html += '</tr>';
        } );

        html += '</tbody></table>';
    } );

    return html;
}

// Generate subject timetable HTML
function generateSubjectTimetableHTML( subjectFilterKeys ) {
    if ( !subjectFilterKeys || subjectFilterKeys.length === 0 ) {
        return '<div class="empty-state"><p>Please select one or more subjects to view schedules.</p></div>';
    }

    if ( !state.timetableData ) return '<p>No timetable data.</p>';

    let html = '';
    subjectFilterKeys.forEach( subjectFilterKey => {
        const subjectLabel = getUniqueSubjectMap().get( subjectFilterKey ) || subjectFilterKey;

        // Find all classes where this subject is taught
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

        if ( Object.keys( subjectClasses ).length === 0 ) {
            html += `<div class="empty-state"><p>No schedule found for subject: ${subjectLabel}</p></div>`;
            return;
        }

        html += `<h3 style="margin: 20px 0 10px 15px;">Schedule for ${subjectLabel}</h3>`;
        html += '<table class="timetable">';
        html += '<thead><tr><th>Day/Period</th>';

        // Get all classes where this subject is taught
        const classes = Object.keys( subjectClasses );

        classes.forEach( className => {
            html += `<th>${className}</th>`;
        } );

        html += '</tr></thead><tbody>';

        // Data rows
        const dayOrder = getStandardDayOrder();

        dayOrder.forEach( dayName => {
            html += `<tr><td style="font-weight: 600; background-color: #f9f9f9;">${dayName}</td>`;

            classes.forEach( className => {
                const dayPeriods = subjectClasses[className][dayName] || [];
                let periodInfo = '';

                if ( dayPeriods.length > 0 ) {
                    // Show all periods for this subject in this class on this day
                    const periodText = dayPeriods.map( p =>
                        `P${p.period}: ${p.teacherName}`
                    ).join( '<br>' );

                    periodInfo = `
                                <div class="period-subject">${periodText}</div>
                            `;
                }

                html += `<td class="period-cell">${periodInfo}</td>`;
            } );

            html += '</tr>';
        } );

        html += '</tbody></table>';
    } );

    return html;
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
                (m.gradeSection === item.className || (m.gradeSection && m.gradeSection.includes(item.className)))
            );
            
            let keyToUse = item.className;
            if ( mapping && mapping.mode === 'combined' && mapping.combinedGroupId ) {
                keyToUse = mapping.combinedGroupId;
            } else if ( classMeta && classMeta.teachingMode === 'combined' && classMeta.combinedGroupId ) {
                keyToUse = classMeta.combinedGroupId;
            }
            item.schedulingKey = keyToUse;
            distinctKeys.add( keyToUse );
        });
        return distinctKeys.size > 1;
    });
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

function escapeCSVField( value ) {
    const stringValue = String( value ?? '' );
    const escapedValue = stringValue.replace( /"/g, '""' );
    return `"${escapedValue}"`;
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
                escapeCSVField( row.className ),
                escapeCSVField( row.day ),
                escapeCSVField( row.period ),
                escapeCSVField( row.teacher ),
                escapeCSVField( row.subject ),
                escapeCSVField( row.time ),
                escapeCSVField( row.overlapInfo )
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
        const dayOrder = getStandardDayOrder();

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

        const dayOrder = getStandardDayOrder();

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
            'P7 Subject', 'P7 Teacher Name', 'P7 Teacher ID', 'P7 Time', 'P7 Type',
            'P8 Subject', 'P8 Teacher Name', 'P8 Teacher ID', 'P8 Time', 'P8 Type'
        ];

        const data = [header];

        // Add days
        const days = getStandardDayOrder();

        days.forEach( day => {
            const row = [day];

            // Add sample periods
            for ( let i = 1; i <= 8; i++ ) {
                if ( i === 4 ) {
                    // Break period
                    row.push( 'BREAK', '', '', '11:00-11:30', 'Regular' );
                } else {
                    row.push( 'Mathematics', 'John Doe', '17PVSS0001', `${8 + i}:00-${8 + i}:45`, 'Regular' );
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
    getStandardDayOrder().slice( 0, 3 ).forEach( day => {
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
function loadTimetableForModification() {
    const classFilter = document.getElementById( 'modifyClassFilter' ).value;

    if ( !classFilter ) {
        alert( "Please select a class to load." );
        return;
    }

    if ( !state.timetableData || !state.timetableData[classFilter] ) {
        alert( "No timetable data found for this class." );
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
    teacherScheduleDisplay.innerHTML = generateTeacherTimetableHTML( [teacherFilter] );
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
    const container = document.getElementById('modifyTimetableDisplay');
    if (!container) return;
    const cellsInModify = container.querySelectorAll( '.period-cell' );
    cellsInModify.forEach( cell => {
        cell.removeEventListener( 'click', handlePeriodEditClick );
        cell.addEventListener( 'click', handlePeriodEditClick );
    } );
}

function removeEditListeners() {
    const container = document.getElementById('modifyTimetableDisplay');
    if (!container) return;
    const cellsInModify = container.querySelectorAll( '.period-cell' );
    cellsInModify.forEach( cell => {
        cell.removeEventListener( 'click', handlePeriodEditClick );
    } );
}

function handlePeriodEditClick( event ) {
    const cell = event.currentTarget;
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
    document.getElementById( 'editModalCurrentSubject' ).textContent = periodData.subject || 'BREAK';
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
    if (!cleanName) return '';
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
    const wasPreviouslyEdited = !!(state.editedCells && state.editedCells[cellKey]);

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
    loadTimetableForModification();
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
    loadTimetableForModification();
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

    loadTimetableForModification();
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

    const limit = state.config.periodsPerTeacher || 30;
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
                        slots: new Set()
                    };
                }
                teacherAssignments[key].slots.add( `${day.dayName}|${period.period}` );
            } );
        } );
    }

    for ( const [key, info] of Object.entries( teacherAssignments ) ) {
        const actualCount = info.slots.size;
        if ( actualCount > limit ) {
            violations.push( {
                type: "teacher_workload",
                teacherId: info.teacherId,
                teacherName: info.teacherName,
                limit: limit,
                actual: actualCount,
                severity: "warning",
                message: `Teacher ${info.teacherName} (${info.teacherId || 'N/A'}) teaches ${actualCount} periods per week, exceeding the limit of ${limit}.`
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
            const cscPeriods = ( day.periods || [] ).filter( p => toCleanString( p.subject ).toUpperCase() === 'CSC' );
            if ( cscPeriods.length === 0 ) return;

            cscPeriods.forEach( p => {
                const periodNum = p.period;
                let isValid = false;

                if ( periodNum === 1 ) {
                    const p2 = day.periods.find( x => x.period === 2 );
                    if ( p2 && toCleanString( p2.subject ).toUpperCase() === 'CSC' ) {
                        isValid = true;
                    }
                } else if ( periodNum === 2 ) {
                    const p1 = day.periods.find( x => x.period === 1 );
                    if ( p1 && toCleanString( p1.subject ).toUpperCase() === 'CSC' ) {
                        isValid = true;
                    }
                } else if ( periodNum === 5 ) {
                    const p6 = day.periods.find( x => x.period === 6 );
                    if ( p6 && toCleanString( p6.subject ).toUpperCase() === 'CSC' ) {
                        isValid = true;
                    }
                } else if ( periodNum === 6 ) {
                    const p5 = day.periods.find( x => x.period === 5 );
                    if ( p5 && toCleanString( p5.subject ).toUpperCase() === 'CSC' ) {
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

                const allowedGroups = parseFixedPeriodGroups( matchingMapping.fixedPeriods );
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
        passedChecks.push( "Lab block validation passed: All CSC periods scheduled in valid consecutive blocks." );
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
                <button class="btn btn-secondary btn-sm" style="margin-left: auto;" onclick="document.getElementById('generationReportContainer').style.display='none'">
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
                    <button class="btn btn-primary btn-sm caveat-action-btn" onclick="openCellInModifyTimetable('${escapeHtmlJS(classLabel)}', '${escapeHtmlJS(dayLabel)}', ${parseInt(periodLabel.replace('P',''))})">
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
                    <button class="btn btn-primary btn-sm caveat-action-btn" onclick="openCellInModifyTimetable('${escapeHtmlJS(classLabel)}', '${escapeHtmlJS(dayLabel)}', ${parseInt(periodLabel.replace('P',''))})">
                        <i class="fas fa-external-link-alt"></i> Open in Modify Timetable
                    </button>
                `;
            } else if ( i.class ) {
                actionBtnHtml = `
                    <button class="btn btn-primary btn-sm caveat-action-btn" onclick="openCellInModifyTimetable('${escapeHtmlJS(classLabel)}', 'Monday', 1)">
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

    const subjects = new Set([
        ...Object.keys( classExpected ),
        ...Object.keys( classActual )
    ]);

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

    const limit = state.config.periodsPerTeacher || 30;
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

function openCellInModifyTimetable(className, dayName, periodNum) {
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

function escapeHtmlJS(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
