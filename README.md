# Interview Assistant Interview Assistant (Ready-to-run)

This is a minimal React app with a unique AI-like interview assistant prototype.

## Quick start

1. Ensure Node.js >=16 is installed.
2. Extract the zip, then:
   ```
   cd interview_assistant_app
   npm install
   npm start
   ```
3. The app opens at http://localhost:3000

Notes:
- PDF resume parsing uses pdfjs (in-browser).
- The app stores state in `localStorage` under `crisp_unique_v1`.
- This prototype uses a rule-based question bank and scoring to avoid external APIs.
