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
    '          {!selectedSession ? (\n'
]

# 2. Session List
session_list = lines[l_session_start:l_tasks_start] + [
    '          ) : (\n',
    '            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">\n'
]

# 3. Timer Inner
# Look for <div className="w-full flex flex-col items-center gap-6"> inside the timer section
l_timer_inner_start = -1
for i in range(l_timer_start, len(lines)):
    if '<div className="w-full flex flex-col items-center gap-6">' in lines[i]:
        l_timer_inner_start = i
        break

# Look for the end of the timer inner block. It ends with:
#                 </div>
#               )}
#             </div>
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
# Ends at the } before the chat section.
#               </div>
#             </div>
#           )}
#         </div>
l_tasks_inner_end = l_chat_start - 3

tasks_inner = lines[l_tasks_inner_start : l_tasks_inner_end]
tasks_block = ['              <div className="flex-shrink-0">\n'] + tasks_inner + [
    '              </div>\n',
    '            </div>\n',
    '          )}\n',
    '        </div>\n\n'
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
