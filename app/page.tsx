import { redirect } from 'next/navigation'

export default function WikiPage() {
  return (
    <div className="h-screen w-full bg-neutral-900 overflow-hidden flex p-6 gap-6">
      {/* Sidebar */}
      <div className="w-72 h-full bg-neutral-900 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="text-2xl font-bold mb-2">Wiki</h2>
        {/* Tabs */}
        <div className="flex gap-2 mb-2">
          <button className="px-4 py-1 rounded bg-neutral-800 text-white">Shared</button>
          <button className="px-4 py-1 rounded bg-red-700 text-white">Private</button>
        </div>
        <button className="bg-red-700 text-white rounded px-4 py-2 mb-2">+ New Document</button>
        {/* Document List */}
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          <button className="bg-neutral-800 text-red-500 rounded px-4 py-2 text-left">Private document 1</button>
          <button className="bg-neutral-800 text-white rounded px-4 py-2 text-left">Private document 2</button>
        </div>
      </div>
      {/* Main Panel */}
      <div className="flex-1 h-full bg-neutral-900 rounded-xl p-6 flex flex-col">
        <div className="bg-neutral-800 rounded-xl p-6 flex-1 overflow-y-auto">
          <h3 className="text-xl font-bold mb-2">Private document 1</h3>
          <p>Document content will go here.</p>
        </div>
      </div>
    </div>
  );
}
