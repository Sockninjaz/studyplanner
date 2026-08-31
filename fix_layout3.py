import re

with open('src/app/(dashboard)/today/page.tsx', 'r') as f:
    lines = f.readlines()

# 1. Header Replace (lines 412-416)
#           <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
#             <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
#               Today's Sessions
#             </h2>
#           </div>

# 2. Extract Timer (lines 651-760) -> lines[650:760]

# 3. Tasks section is lines 475-536 -> lines[474:536]
# 4. Session list is lines 418-473 -> lines[417:473]

header_new = """          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
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

timer_content = "".join(lines[650:760])
session_list_content = "".join(lines[417:474]) # includes `          {/* Session list */}`
tasks_content_inner = "".join(lines[476:536]) # inside `if (selectedSession)`

new_left_body = f"""
          {{!selectedSession ? (
            <>
{session_list_content}
            </>
          ) : (
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">
{timer_content}
              </div>
{tasks_content_inner}
            </div>
          )}}
"""

# Construct the new file
new_file_content = "".join(lines[:412]) + header_new + new_left_body + "".join(lines[538:640]) + "".join(lines[763:])

with open('src/app/(dashboard)/today/page.tsx', 'w') as f:
    f.write(new_file_content)

print("Success")
