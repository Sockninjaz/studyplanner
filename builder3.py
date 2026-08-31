import os

with open('src/app/(dashboard)/today/page.tsx', 'r') as f:
    lines = f.readlines()

def find_line(sub):
    for i, line in enumerate(lines):
        if sub in line: return i
    return -1

l_header_start = find_line("        {/* ── LEFT: Today's Sessions + Tasks")
l_session_start = find_line("          {/* Session list */}")
l_tasks_start = find_line("          {/* Tasks section */}")
l_chat_start = find_line("        {/* ── CENTER: AI Chat")
l_timer_start = find_line("        {/* ── RIGHT: Timer")

# 1. Header
header = lines[:l_header_start] + [
    "        {/* ── LEFT: Today's Sessions + Tasks + Timer ───────────────────────── */}\n",
    '        <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">\n',
    '          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">\n',
    '            {selectedSession ? (\n',
    '              <button\n',
    '                onClick={() => setSelectedSession(null)}\n',
    '                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap transition-colors"\n',
    '              >\n',
    '                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>\n',
    '                Back\n',
    '              </button>\n',
    '            ) : (\n',
    '              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">\n',
    "                Today's Sessions\n",
    '              </h2>\n',
    '            )}\n',
    '          </div>\n\n',
    '          {!selectedSession ? (\n',
    '            <>\n'
]

# 2. Session List
session_list = lines[l_session_start:l_tasks_start] + [
    '            </>\n',
    '          ) : (\n',
    '            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">\n'
]

# 3. Timer Inner
l_timer_inner_start = -1
for i in range(l_timer_start, len(lines)):
    if '<div className="w-full flex flex-col items-center gap-6">' in lines[i]:
        l_timer_inner_start = i
        break

l_timer_inner_end = -1
for i in range(l_timer_inner_start, len(lines)):
    if '              )}' in lines[i] and '            </div>' in lines[i+1]:
        l_timer_inner_end = i + 1
        break

timer_inner = lines[l_timer_inner_start : l_timer_inner_end + 1]
timer_block = ['              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">\n'] + timer_inner + ['              </div>\n']

# 4. Tasks Inner
# Skip the first two lines:
#           {/* Tasks section */}
#           {selectedSession && (
l_tasks_inner_start = l_tasks_start + 2
# It ends with:
#               </div>
#             </div>
#           )}
#         </div>
# We want to keep everything from `<div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">` down to its matching `</div>`
# That means we drop the `)}` and `</div>` at the very end of the left column block.
# Let's count divs down from l_tasks_inner_start.
tasks_inner = lines[l_tasks_inner_start : l_chat_start - 3]
# The `tasks_inner` block contains exactly `<div className="border-t ...">` and ends right before `)}`.
# Wait, let's look at the original source:
# 546:             </div>
# 547:           )}
# 548:         </div>
# The tasks block is fully closed inside tasks_inner, EXCEPT for the left column wrapper which we need to close.
tasks_block = ['              <div className="flex-shrink-0">\n'] + tasks_inner + [
    '              </div>\n', # Closes the `<div className="flex-shrink-0">` wrapper around tasks
    '            </div>\n', # Closes the `<div className="flex-1 overflow-y-auto flex flex-col min-h-0">` from the second branch of ternary
    '          )}\n', # Closes the ternary
    '        </div>\n\n' # Closes the left column
]

# 5. Chat Block
chat_block = lines[l_chat_start : l_timer_start]

# 6. Final closing
footer = [
    '      </div>\n',
    '    </div>\n',
    '  );\n',
    '}\n'
]

final_file = header + session_list + timer_block + tasks_block + chat_block + footer

with open('src/app/(dashboard)/today/page.tsx', 'w') as f:
    f.writelines(final_file)

print("Success")
