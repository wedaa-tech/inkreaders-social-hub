import SettingsClient from "@/app/components/util/SettingsClient";

export const metadata = { title: "Settings · InkReaders" };

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 lg:px-6 py-6">
        <SettingsClient />
      </div>
    </main>
  );
}
