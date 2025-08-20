import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kiosk - Club Attendance',
  description: 'NFC Attendance Kiosk',
};

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen bg-black text-white">
      {children}
    </div>
  );
}
