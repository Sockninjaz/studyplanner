const fs = require('fs');

const path = 'src/app/(dashboard)/today/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// The strategy is to extract the main components of the UI and then reassemble them.
// We can use simple indexOf/substring to extract blocks perfectly because they are well indented.

const extractBlock = (startMarker, endMarker) => {
  const start = code.indexOf(startMarker);
  if (start === -1) throw new Error("Could not find start marker: " + startMarker);
  const end = code.indexOf(endMarker, start);
  if (end === -1) throw new Error("Could not find end marker: " + endMarker);
  return code.substring(start, end + endMarker.length);
};

const topBarMarker = '      {/* Top bar */}';
const topBarEnd = '      </div>';
const topBar = extractBlock(topBarMarker, '      </div>\n');

// Extract Session List
const sessionListMarker = '          {/* Session list */}';
const sessionListEnd = '            )}'; // end of sessions.length === 0 ? ... : ... block
const sessionListStartIdx = code.indexOf(sessionListMarker);
const sessionListEndIdx = code.indexOf('          </div>', sessionListStartIdx);
const sessionListBlock = code.substring(sessionListStartIdx, sessionListEndIdx);

// Extract Tasks
const tasksMarker = '          {/* Tasks section */}';
const tasksEndIdx = code.indexOf('          )}', code.indexOf(tasksMarker));
// The tasks block includes the `selectedSession && (` wrapper. We want to strip that.
const rawTasksBlock = code.substring(code.indexOf(tasksMarker), tasksEndIdx + '          )}'.length);
const tasksInner = rawTasksBlock
  .replace('          {/* Tasks section */}\n          {selectedSession && (\n', '')
  .replace(/\n          \)\}$/, '');

// Extract Chat
const chatMarker = '        {/* ── CENTER: AI Chat ─────────────────────────────────────────────────── */}';
const chatEndIdx = code.indexOf('        {/* ── RIGHT: Timer', code.indexOf(chatMarker));
const chatBlock = code.substring(code.indexOf(chatMarker), chatEndIdx).trimRight();

// Extract Timer
const timerMarker = '        {/* ── RIGHT: Timer ────────────────────────────────────────────────────── */}';
const timerEndIdx = code.indexOf('      </div>\n    </div>\n  );\n}');
const rawTimerBlock = code.substring(code.indexOf(timerMarker), timerEndIdx).trimRight();
// Timer has a wrapper: `<div className="w-72 flex-shrink-0 flex flex-col items-center justify-center border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto px-6 py-8">\n          {!selectedSession ? (...`
// Let's grab the inner timer when selectedSession is true: `<div className="w-full flex flex-col items-center gap-6">` up to its matching `</div>`
const timerInnerStart = '<div className="w-full flex flex-col items-center gap-6">';
const timerInnerEnd = '                </div>\n              )}\n            </div>';
const startIdx = rawTimerBlock.indexOf(timerInnerStart);
const endIdx = rawTimerBlock.indexOf(timerInnerEnd) + '                </div>\n              )}\n            </div>'.length;
const timerInner = rawTimerBlock.substring(startIdx, endIdx);


const newRender = `  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-slate-950 overflow-hidden">
${topBar}
      {/* 3-column layout */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── LEFT: Today's Sessions + Timer + Tasks ─────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
            {selectedSession ? (
              <button
                onClick={() => setSelectedSession(null)}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
            ) : (
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
                Today's Sessions
              </h2>
            )}
          </div>

          {!selectedSession ? (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
${sessionListBlock.replace('          {/* Session list */}\n', '').replace('          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">\n', '')}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">
${timerInner}
              </div>
              <div className="flex-shrink-0">
${tasksInner}
              </div>
            </div>
          )}
        </div>

${chatBlock}

      </div>
    </div>
  );
}`;

const returnStart = code.indexOf('  return (');
code = code.substring(0, returnStart) + newRender + '\n}\n';

fs.writeFileSync(path, code);
console.log('Success');
