import sys

with open('src/app/(dashboard)/today/page.tsx', 'r') as f:
    lines = f.readlines()

def get_block(start_marker, end_marker, start_index=0):
    start = -1
    for i, line in enumerate(lines[start_index:], start_index):
        if start_marker in line:
            start = i
            break
    if start == -1: raise Exception(f"Start marker not found: {start_marker}")
    
    end = -1
    for i, line in enumerate(lines[start:], start):
        if end_marker in line:
            end = i
            break
    if end == -1: raise Exception(f"End marker not found: {end_marker}")
    return start, end

# 1. Left header: line 412
h_start, h_end = get_block('<div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">', '          </div>', 400)
header_str = """          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
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
"""

# 2. Session List
sl_start, sl_end = get_block('          {/* Session list */}', '            )}\n          </div>\n', h_end)
session_list_lines = lines[sl_start:sl_end+2] # includes the closing </div>
# Add wrapper around session list
session_list_lines.insert(0, "          {!selectedSession ? (\n            <>\n")
session_list_lines.append("            </>\n          ) : (\n            <div className=\"flex-1 overflow-y-auto flex flex-col min-h-0\">\n")

# 3. Tasks section
t_start, t_end = get_block('          {/* Tasks section */}', '          )}\n        </div>\n', sl_end)
# Extract inner tasks:
# It starts at:
#           {/* Tasks section */}
#           {selectedSession && (
#             <div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
#
# and ends at:
#               </div>
#             </div>
#           )}
#         </div>

# Wait, `tasks_lines` should just be the inner part. Let's just grab the inner lines.
t_inner_start, t_inner_end = get_block('<div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">', '              </div>\n            </div>\n', t_start)
tasks_lines = lines[t_inner_start:t_inner_end+2]

# 4. Timer section
tm_start, tm_end = get_block('        {/* ── RIGHT: Timer', '      </div>\n    </div>\n', t_end)
# Extract inner timer:
# <div className="w-full flex flex-col items-center gap-6">
# ...
#             </div>
#           )}
#         </div>
tm_inner_start, tm_inner_end = get_block('<div className="w-full flex flex-col items-center gap-6">', '                </div>\n              )}\n            </div>\n', tm_start)

# Notice we must change the indentation of tm_lines? No, React doesn't care.
tm_lines = lines[tm_inner_start:tm_inner_end+3]

# Combine for Left body
# It goes: session list -> else -> timer -> tasks -> end
new_left_body = session_list_lines + [
    '              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">\n'
] + tm_lines + [
    '              </div>\n',
    '              <div className="flex-shrink-0">\n'
] + tasks_lines + [
    '              </div>\n',
    '            </div>\n',
    '          )}\n',
    '        </div>\n'
]

# The rest of the file
# from beginning to h_start
# + header_str
# + new_left_body
# + chat section (which is from t_end+2 to tm_start-1)
# + final closing divs (which is from tm_end to end)

chat_start = t_end + 2
chat_end = tm_start
chat_lines = lines[chat_start:chat_end]

final_closing_lines = lines[tm_end:]

final_lines = lines[:h_start] + [header_str] + new_left_body + chat_lines + final_closing_lines

with open('src/app/(dashboard)/today/page.tsx', 'w') as f:
    f.writelines(final_lines)

