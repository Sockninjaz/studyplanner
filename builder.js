const fs = require('fs');

const path = 'src/app/(dashboard)/today/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Find boundaries
const findLine = (str) => lines.findIndex(l => l.includes(str));

const lLeftHeaderStart = findLine("        {/* ── LEFT: Today's Sessions + Tasks ─────────────────────────────────── */}");
const lSessionListStart = findLine("          {/* Session list */}");
const lSessionListEnd = findLine("          {/* Tasks section */}"); // ends just before this
const lTasksStart = findLine("          {/* Tasks section */}");
const lTasksEnd = findLine("        {/* ── CENTER: AI Chat ─────────────────────────────────────────────────── */}"); // ends just before this
const lChatStart = findLine("        {/* ── CENTER: AI Chat ─────────────────────────────────────────────────── */}");
const lChatEnd = findLine("        {/* ── RIGHT: Timer ────────────────────────────────────────────────────── */}"); // ends just before this
const lTimerStart = findLine("        {/* ── RIGHT: Timer ────────────────────────────────────────────────────── */}");
const lTimerEnd = findLine("      </div>\n    </div>\n  );\n}"); // ends just before the final closing divs
// Actually the final closing divs are the last lines
const lEndStart = findLine("      </div>"); // We'll just grab the last 4 lines manually since it's predictable

// 1. Header
let header = lines.slice(0, lLeftHeaderStart).join('\n') + `
        {/* ── LEFT: Today's Sessions + Tasks + Timer ───────────────────────── */}
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
`;

// 2. Session List
let sessionListRaw = lines.slice(lSessionListStart, lSessionListEnd).join('\n');
// sessionListRaw ends with `          </div>` (line 483) and empty line 484.
let sessionList = sessionListRaw + '\n          ) : (\n            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">\n';

// 3. Timer Inner
let timerRaw = lines.slice(lTimerStart, lines.length).join('\n');
// We want everything from `<div className="w-full flex flex-col items-center gap-6">` up to `)}` before `</div>`
let timerInnerMatch = timerRaw.match(/(<div className="w-full flex flex-col items-center gap-6">[\s\S]*?)(\s*<\/div>\s*\)\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*})/);
let timerInner = timerInnerMatch[1] + "\n                </div>\n              )}\n            </div>";

let timerBlock = `              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">\n${timerInner}\n              </div>\n`;

// 4. Tasks Inner
let tasksRaw = lines.slice(lTasksStart, lChatEnd).join('\n');
// tasksRaw is:
//           {/* Tasks section */}
//           {selectedSession && (
//             <div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
//             ...
//               </div>
//             </div>
//           )}
//         </div>
// Let's extract the inner div:
let tasksInnerMatch = tasksRaw.match(/(<div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">[\s\S]*?)(<\/div>\s*<\/div>\s*\)\s*})/);
// Wait, the match might be greedy and get the wrong end.
// We can just extract lines.
let tasksInnerStart = lTasksStart + 2; // skips the comment and {selectedSession && (
let tasksInnerEnd = lChatEnd - 3; // skips the )}, </div>, and empty line
let tasksInnerLines = lines.slice(tasksInnerStart, tasksInnerEnd).join('\n');

let tasksBlock = `              <div className="flex-shrink-0">\n${tasksInnerLines}\n              </div>\n            </div>\n          )}\n        </div>\n`;

// 5. Chat Block
let chatBlock = lines.slice(lChatStart, lTimerStart).join('\n');

// 6. Final Footer
let footer = `      </div>\n    </div>\n  );\n}\n`;

let finalFile = header + sessionList + timerBlock + tasksBlock + chatBlock + footer;
fs.writeFileSync('src/app/(dashboard)/today/page.tsx', finalFile);
console.log("Built new page.tsx");
