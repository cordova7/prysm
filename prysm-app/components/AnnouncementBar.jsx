export default function AnnouncementBar() {
  const canisterId = process.env.NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID

  if (!canisterId) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white text-center py-2 px-4 text-sm font-medium">
      Now live on BOB Launcher:{' '}
      <span className="font-mono font-semibold">{canisterId}</span>
    </div>
  )
}
