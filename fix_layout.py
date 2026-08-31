import re

with open('src/app/(dashboard)/today/page.tsx', 'r') as f:
    content = f.read()

# 1. Remove isTimerCollapsed
content = re.sub(r'  const \[isTimerCollapsed, setIsTimerCollapsed\] = useState\(false\);\n', '', content)

# 2. Replace Left Column Header
header_pattern = r'\{!isSidebarCollapsed && \(\s*<h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 whitespace-nowrap">\s*Today\'s Sessions\s*</h2>\s*\)\}'
header_replacement = """{!isSidebarCollapsed && (
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
            )}"""
content = re.sub(header_pattern, header_replacement, content, count=1)

# 3. Extract the right timer column and extract just the timer content
# Looking for `<div className="w-full flex flex-col items-center gap-6">` up to the closing `</div>` right before `{!isTimerCollapsed &&` ends.
timer_inner_pattern = r'(<div className="w-full flex flex-col items-center gap-6">.*?(?:Mark as Done\s*</button>\s*</div>\s*)}\s*</div>)'
timer_match = re.search(timer_inner_pattern, content, re.DOTALL)
if not timer_match:
    print("Could not find timer inner content")
    exit(1)
timer_inner_content = timer_match.group(1)

# Now extract the Left Column body: Session list and Tasks
left_col_pattern = r'(\{\!isSidebarCollapsed && \(\s*<>\s*\{\/\* Session list \*\/\})([\s\S]*?)(\{\/\* Tasks section \*\/\}\s*\{selectedSession && \([\s\S]*?<div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">)([\s\S]*?)(</>\s*\)\})'

def replace_left_col(match):
    session_list_inner = match.group(2)
    tasks_inner = match.group(4)
    # Tasks end with `</div>\s*)}`
    tasks_inner = re.sub(r'</div>\s*\)\}\s*$', '</div>', tasks_inner)
    
    return f"""{{!isSidebarCollapsed && (
            <>
              {{!selectedSession ? (
                {session_list_inner}
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">
                    {timer_inner_content}
                  </div>
                  <div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
                    {tasks_inner}
                  </div>
                </div>
              )}}
            </>
          )}}"""

content = re.sub(left_col_pattern, replace_left_col, content, count=1)

# 4. Remove the RIGHT Timer column entirely
right_col_pattern = r'\{\/\* ── RIGHT: Timer ────────────────────────────────────────────────────── \*\/\}.*?\}\s*</div>\s*\)\}\s*</div>\s*\)\}'
# We need to be careful with the trailing divs. The original file has:
#           )}
#         </div>
#       )}
#     </div>
#   </div>
# </div>
#   );
# }
# Let's just find the exact right column start and end.
# Starts at `{/* ── RIGHT: Timer`
# Ends at the closing div for `flex-shrink-0 flex flex-col border-l ...`

right_timer_block = re.search(r'\{\/\* ── RIGHT: Timer ────────────────────────────────────────────────────── \*\/\}[\s\S]*?</div>\s*\)\}\s*</div>', content)
if right_timer_block:
    content = content.replace(right_timer_block.group(0), '')
else:
    print("Could not find right timer block")

with open('src/app/(dashboard)/today/page.tsx', 'w') as f:
    f.write(content)

print("Success")
