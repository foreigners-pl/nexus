import { getConversations } from '@/app/actions/chat'
import ChatContainer from './components/ChatContainer'

export default async function ChatPage() {
  const { conversations } = await getConversations()
  
  return (
    <div className="h-[calc(100vh-4rem+3rem)] -mx-6 -my-6">
      <ChatContainer initialConversations={conversations} />
    </div>
  )
}
