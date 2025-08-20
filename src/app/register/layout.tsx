import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register - Club Attendance',
  description: 'Register your NFC card',
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
