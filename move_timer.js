const fs = require('fs');
const file = '/Users/apple/studyplanner/src/app/(dashboard)/today/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove isTimerCollapsed
content = content.replace(/const \[isTimerCollapsed, setIsTimerCollapsed\] = useState\(false\);\n/, '');

// 2. Replace the Left Column Header
const leftHeaderRegex = /\{\!isSidebarCollapsed && \([\s\S]*?<h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 whitespace-nowrap">\s*Today's Sessions\s*<\/h2>[\s\S]*?\)\]/m;
content = content.replace(/\{\!isSidebarCollapsed && \(\s*<h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 whitespace-nowrap">\s*Today's Sessions\s*<\/h2>\s*\)\}/, 
`{!isSidebarCollapsed && (
              selectedSession ? (
                <button
                  onClick={() => setSelectedSession(null)}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
              ) : (
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 whitespace-nowrap">
                  Today's Sessions
                </h2>
              )
            )}`);

// 3. Extract the timer view (Expanded View only, we don't need collapsed view logic anymore)
const timerBlockRegex = /\{!\isTimerCollapsed && \(\s*<div className="flex-1 flex flex-col items-center justify-center overflow-y-auto px-6 py-8">([\s\S]*?)\s*<\/div>\s*\)\}/;
const match = content.match(timerBlockRegex);
if (!match) {
  console.log('Failed to find timer expanded view');
  process.exit(1);
}
let timerUI = match[1];
// We don't need the !selectedSession fallback inside the timer anymore because we only show it when selectedSession is true
timerUI = timerUI.replace(/\{!selectedSession \? \([\s\S]*?\) : \([\s\S]*?<div className="w-full flex flex-col items-center gap-6">/, '<div className="w-full flex flex-col items-center gap-6">');
timerUI = timerUI.replace(/\s*<\/div>\s*$/, ''); // Remove the closing div of the `) : (` block

// 4. Find the Session List and Tasks section in the Left Column
const sessionListStart = `              {/* Session list */}`;
const sessionListCodeRegex = /\{\/\* Session list \*\/\}[\s\S]*?(?=\{\/\* Tasks section \*\/})/;
const sessionListMatch = content.match(sessionListCodeRegex);
if (!sessionListMatch) {
  console.log('Failed to find session list');
  process.exit(1);
}
const sessionListCode = sessionListMatch[0];

const tasksStart = `          {/* Tasks section */}`;
const tasksCodeRegex = /\{\/\* Tasks section \*\/\}[\s\S]*?\{selectedSession && \([\s\S]*?<div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">([\s\S]*?)\s*<\/div>\s*\)\}/;
const tasksMatch = content.match(tasksCodeRegex);
if (!tasksMatch) {
  console.log('Failed to find tasks code');
  process.exit(1);
}
let tasksUI = `<div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">` + tasksMatch[1] + `</div>`;

// 5. Replace the entire body of the left column
const leftColumnBodyRegex = /\{\!isSidebarCollapsed && \(\s*<>[\s\S]*?<\/>\s*\)\}/;
const newLeftColumnBody = `{!isSidebarCollapsed && (
            <>
              {!selectedSession ? (
${sessionListCode}
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6">
                    ${timerUI}
                  </div>
                  ${tasksUI}
                </div>
              )}
            </>
          )}`;
content = content.replace(leftColumnBodyRegex, newLeftColumnBody);

// 6. Delete the Right Timer Column completely
const rightTimerColumnRegex = /\{\/\* ── RIGHT: Timer ────────────────────────────────────────────────────── \*\/\}[\s\S]*?\}\s*<\/div>\s*\)\}/;
content = content.replace(rightTimerColumnRegex, '');

fs.writeFileSync(file, content);
console.log('Success');
