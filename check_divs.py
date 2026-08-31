with open('src/app/(dashboard)/today/page.tsx') as f:
    code = f.read()
import re
div_opens = len(re.findall(r'<div\b[^>]*>', code))
div_closes = len(re.findall(r'</div>', code))
print(f"Opens: {div_opens}, Closes: {div_closes}")
