import re

with open('src/app/(dashboard)/today/page.tsx', 'r') as f:
    content = f.read()

# 1. Timer content extraction
timer_start = '<div className="w-full flex flex-col items-center gap-6">'
timer_end = 'Mark as Done\n                  </button>\n                </div>\n              )}\n            </div>\n          )}'

start_idx = content.find(timer_start)
end_idx = content.find(timer_end) + len(timer_end)
if start_idx == -1 or end_idx == -1:
    print("Could not find timer bounds")
    exit(1)

timer_content = content[start_idx:end_idx]
# Since we removed `!selectedSession ?` from around the timer, we need to unindent it or just leave it.
# The timer_content includes `)}` at the end which was part of `{!selectedSession ? ... : ( ... )}`
# Let's fix that up manually.
# The timer content is literally inside `<div className="w-full flex flex-col items-center gap-6">` up to its closing `</div>`.
timer_content_clean = timer_content.replace('              )}\n            </div>\n          )}', '            </div>')

# 2. Left column modifications
session_list_marker = '          {/* Session list */}\n          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">'
session_list_new = '          {!selectedSession ? (\n            <>\n' + session_list_marker
content = content.replace(session_list_marker, session_list_new)

tasks_marker = '          {/* Tasks section */}\n          {selectedSession && (\n            <div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">'
tasks_new = f"""          </>\n          ) : (\n            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">\n              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">\n                {timer_content_clean}\n              </div>\n          {{/* Tasks section */}}\n            <div className="flex-shrink-0">"""
content = content.replace(tasks_marker, tasks_new)

tasks_end_marker = '              </div>\n            </div>\n          )}\n        </div>'
tasks_end_new = '              </div>\n            </div>\n            </div>\n          )}\n        </div>'
content = content.replace(tasks_end_marker, tasks_end_new)

# 3. Remove RIGHT Timer column completely
right_col_marker = '        {/* ── RIGHT: Timer ────────────────────────────────────────────────────── */}'
right_col_idx = content.find(right_col_marker)
if right_col_idx == -1:
    print("Could not find right col marker")
    exit(1)

# we just truncate the content before the right column, but we must keep the closing tags!
# The right column is the last element before the final closing divs of the 3-column layout.
# Let's just find where it ends.
# It ends right before:
#       </div>
#     </div>
#   );
# }

content = content[:right_col_idx] + '      </div>\n    </div>\n  );\n}\n'

with open('src/app/(dashboard)/today/page.tsx', 'w') as f:
    f.write(content)

print("Success")
