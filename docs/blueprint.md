# **App Name**: Club Attendance

## Core Features:

- NFC Waiting Screen: Display 'Touch NFC tag' on Raspberry Pi screen for attendance logging.
- Attendance Logging: Process NFC tag input as HID keyboard input, automatically saving attendance records to Firestore.
- QR Code Display: Display a QR code linking to registration page upon entering registration mode via Raspberry Pi.
- GitHub Authentication: Implement registration flow with GitHub OAuth and organization membership verification.
- User Dashboard: Display dashboard on Vercel, providing user attendance info.
- Role Management: Role-based access control: Admin access for user management and attendance overview; user access limited to personal attendance history.
- Attendance Trend Analysis: Generative AI analyzes daily attendance trends for tool use, such as predicting peak activity times based on historical data to manage club resources better.

## Style Guidelines:

- Primary color: #4F709C, a muted blue evoking reliability and focus.
- Background color: #F0F4F8, a very light desaturated blue for a calm, uncluttered background.
- Accent color: #73A35B, a soft green used to highlight interactive elements.
- Body and headline font: 'Inter', a sans-serif font with a neutral, modern look suitable for all text elements.
- Consistent set of simple, outline-style icons for navigation and key actions.
- Clean, card-based layout to organize dashboard elements effectively.
- Subtle transitions and animations to provide feedback during interactions, like form submissions and data updates.