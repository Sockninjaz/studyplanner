import re

with open('src/app/(dashboard)/today/page.tsx', 'r') as f:
    content = f.read()

# 1. Left header: add back button
header_pattern = r'(<h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">\s*Today\'s Sessions\s*</h2>)'
header_replacement = """{selectedSession ? (
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
            )}"""
content = re.sub(header_pattern, header_replacement, content, count=1)

# 2. Get the timer UI
# Find from `<div className="w-full flex flex-col items-center gap-6">` up to `)}` before `</div>` of the timer column
timer_inner_pattern = r'(<div className="w-full flex flex-col items-center gap-6">.*?)(?:  \{\/\* Timer controls \*\/\}.*?(?:Mark as Done\s*</button>\s*</div>\s*)}\s*</div>)'
timer_match = re.search(timer_inner_pattern, content, re.DOTALL)
if not timer_match:
    print("Could not find timer inner content")
    exit(1)
timer_inner_content = timer_match.group(1)

# Actually, the timer content ends right before the closing `}` of `{!selectedSession ? ... : ( ... )}`
# Let's extract the whole right column first to avoid regex greediness issues
right_col_block = re.search(r'\{\/\* ── RIGHT: Timer ────────────────────────────────────────────────────── \*\/\}[\s\S]*?(?=\s*<\/div>\s*<\/div>\s*<\/div>\s*\);)', content)
if not right_col_block:
    print("Could not find right column")
    exit(1)

right_col_str = right_col_block.group(0)

timer_content_match = re.search(r'(<div className="w-full flex flex-col items-center gap-6">[\s\S]*?)(\s*</div>\s*\)\s*</div>)', right_col_str)
if not timer_content_match:
    print("Could not find timer inside right column")
    exit(1)
timer_inner = timer_content_match.group(1)

# Remove the RIGHT column entirely from the file
content = content.replace(right_col_str, "")

# 3. Modify the LEFT Column Body
# Currently it's:
#           {/* Session list */}
#           <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
#             {loadingSessions ? (
#               ...
#           </div>
#
#           {/* Tasks section */}
#           {selectedSession && (
#             <div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
#               ...
#             </div>
#           )}

# We need to wrap Session list with `{!selectedSession ? (...) : (...) }`
# And inside the `:` we put the `timer_inner` and the `Tasks section`

left_body_pattern = r'(          \{\/\* Session list \*\/\}\s*)(<div className="flex-1 overflow-y-auto px-3 py-2 space-y-1\.5 min-h-0">[\s\S]*?</div>)(\s*\{\/\* Tasks section \*\/\}\s*\{selectedSession && \(\s*)(<div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">[\s\S]*?</div>)(\s*\)\})'

def replace_left_body(m):
    session_list_start = m.group(1)
    session_list_inner = m.group(2)
    tasks_start = m.group(3)
    tasks_inner = m.group(4)
    tasks_end = m.group(5)
    
    return f"""          {{!selectedSession ? (
            <>
              {session_list_start}{session_list_inner}
            </>
          ) : (
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">
                {timer_inner}
              </div>
              {tasks_inner}
            </div>
          )}}"""

content = re.sub(left_body_pattern, replace_left_body, content, count=1)

with open('src/app/(dashboard)/today/page.tsx', 'w') as f:
    f.write(content)

print("Success")
