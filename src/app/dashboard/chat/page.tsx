'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type Group = {
  id: string;
  group_name: string;
};

type Message = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  users?: { name: string; email: string };
};

export default function ChatRoomPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user and groups
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { data: groupsData } = await supabase
        .from('shared_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupsData) {
        setGroups(groupsData);
        if (groupsData.length > 0) {
          setSelectedGroupId(groupsData[0].id);
        }
      }
      setLoadingGroups(false);
    };
    init();
  }, []);

  // Fetch messages and set up realtime when selected group changes
  useEffect(() => {
    if (!selectedGroupId) return;
    
    let isMounted = true;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      
      // 1. Fetch Member Map (for realtime messages that lack join data)
      const { data: memberData } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', selectedGroupId);
        
      if (memberData) {
        const userIds = memberData.map(m => m.user_id);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', userIds);
          
        if (usersData && isMounted) {
          const map: Record<string, string> = {};
          usersData.forEach(u => { map[u.id] = u.name || u.email || 'Unknown'; });
          setMemberMap(map);
        }
      }

      // 2. Fetch existing messages
      const { data: msgs } = await supabase
        .from('voyage_messages')
        .select('*, users(name, email)')
        .eq('group_id', selectedGroupId)
        .order('created_at', { ascending: true });

      if (msgs && isMounted) {
        setMessages(msgs);
        setLoadingMessages(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };

    fetchMessages();

    // 3. Set up Realtime Subscription
    const channel = supabase
      .channel(`chat_${selectedGroupId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'voyage_messages', 
        filter: `group_id=eq.${selectedGroupId}` 
      }, (payload) => {
        if (isMounted) {
          setMessages(prev => {
            // Prevent duplicates if we already inserted it locally
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedGroupId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedGroupId || !userId) return;

    const msgText = newMessage.trim();
    setNewMessage(''); // optimistic clear
    
    // Optimistic UI update
    const tempId = crypto.randomUUID();
    const tempMsg: Message = {
      id: tempId,
      user_id: userId,
      message: msgText,
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 10);

    const { error } = await supabase
      .from('voyage_messages')
      .insert([{ 
        id: tempId,
        group_id: selectedGroupId, 
        user_id: userId, 
        message: msgText 
      }]);

    if (error) {
      console.error("Failed to send message", error);
      // Revert optimistic update on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(msgText);
      alert("Failed to send message.");
    }
  };

  const getSenderName = (msg: Message) => {
    if (msg.user_id === userId) return 'You';
    if (msg.users && msg.users.name) return msg.users.name;
    if (msg.users && msg.users.email) return msg.users.email;
    return memberMap[msg.user_id] || 'Passenger';
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col md:flex-row selection:bg-secondary-container selection:text-on-secondary-container">
      {/* SideNavBar (Desktop Only) */}
      <nav 
        className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 w-72 border-r-2 border-double border-outline-variant bg-surface-container bg-cover bg-center shadow-[4px_0_15px_-3px_rgba(88,28,135,0.08)]"
        style={{ backgroundImage: "linear-gradient(rgba(26, 24, 32, 0.85), rgba(26, 24, 32, 0.85)), url('/retro_castle_bg.png')" }}
      >
        <div className="p-container-margin border-b border-outline-variant border-dashed">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">Wireless Room</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Global Comms
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-unit-8 flex flex-col gap-2 px-unit">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined" data-icon="anchor">anchor</span>
            <span className="font-label-sm text-label-sm">Home</span>
          </Link>
          <Link href="/dashboard/groups" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-secondary-container/50 transition-colors duration-300">
            <span className="material-symbols-outlined" data-icon="group">group</span>
            <span className="font-label-sm text-label-sm">Groups</span>
          </Link>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-secondary-container font-bold border-l-4 border-secondary bg-secondary-container/20 transform scale-[0.99] transition-all">
            <span className="material-symbols-outlined text-green-500 animate-pulse" data-icon="chat">chat</span>
            <span className="font-label-sm text-label-sm font-bold text-green-500">Global Chat</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen relative bg-surface-dim h-screen">
        <div className="flex-1 flex flex-col md:flex-row h-full">
          
          {/* Left Column: Voyage List */}
          <div className="w-full md:w-1/3 lg:w-1/4 border-r border-outline-variant bg-surface h-48 md:h-full overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-outline-variant bg-surface-container-high sticky top-0 z-10 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="self-start inline-flex items-center gap-1 px-2 py-1 rounded bg-surface border border-outline-variant text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-all shadow-sm group"
              >
                <span className="material-symbols-outlined text-[14px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
                Home
              </Link>
              <h3 className="font-display text-xl font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">explore</span>
                Active Voyages
              </h3>
            </div>
            
            {loadingGroups ? (
              <div className="p-8 text-center text-on-surface-variant animate-pulse">Scanning channels...</div>
            ) : groups.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm">
                No active voyages found. Join or create a voyage to start chatting!
              </div>
            ) : (
              <div className="flex flex-col">
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`text-left p-4 border-b border-outline-variant/50 transition-all hover:bg-surface-container-low ${selectedGroupId === group.id ? 'bg-secondary-container/30 border-l-4 border-l-secondary' : 'border-l-4 border-l-transparent'}`}
                  >
                    <h4 className={`font-bold ${selectedGroupId === group.id ? 'text-primary' : 'text-on-surface'}`}>{group.group_name}</h4>
                    <p className="text-xs text-on-surface-variant mt-1 font-mono uppercase tracking-wider">Secure Channel</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Chat Interface */}
          <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col h-[calc(100vh-12rem)] md:h-full bg-background relative">
            {/* Image Background */}
            <div className="absolute inset-0 z-0 opacity-[0.15] pointer-events-none" style={{ backgroundImage: "url('/image_1.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>

            {selectedGroupId ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-outline-variant bg-surface/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-primary">
                      {groups.find(g => g.id === selectedGroupId)?.group_name}
                    </h3>
                    <p className="text-xs text-secondary font-mono uppercase tracking-widest mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                      Encrypted Comms Live
                    </p>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 z-10 scroll-smooth">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full text-on-surface-variant">
                      <span className="material-symbols-outlined animate-spin text-4xl text-secondary mr-3">radar</span>
                      Tuning to frequency...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-on-surface-variant opacity-60">
                      <span className="material-symbols-outlined text-6xl mb-4">chat_bubble_outline</span>
                      <p className="font-mono text-sm uppercase tracking-widest font-bold">Frequency is silent</p>
                      <p className="text-sm mt-2">Be the first to transmit a message to the crew.</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe = msg.user_id === userId;
                      const showName = idx === 0 || messages[idx - 1].user_id !== msg.user_id;

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && showName && (
                            <span className="text-xs font-bold text-on-surface-variant ml-1 mb-1">{getSenderName(msg)}</span>
                          )}
                          <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? 'bg-primary text-on-primary rounded-br-sm shadow-md' : 'bg-surface-container text-on-surface border border-outline-variant rounded-bl-sm'}`}>
                            <p className="text-sm md:text-base leading-relaxed break-words">{msg.message}</p>
                          </div>
                          <span className="text-[10px] text-on-surface-variant mt-1 mx-1 font-mono">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 bg-surface-container-low border-t border-outline-variant z-10">
                  <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
                    <div className="flex-1 bg-background border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all p-1 flex items-end">
                      <textarea
                        className="w-full bg-transparent border-none focus:outline-none resize-none px-3 py-2 text-on-surface text-sm max-h-32 min-h-[44px]"
                        placeholder="Transmit message to crew..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e as unknown as React.FormEvent);
                          }
                        }}
                        rows={1}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-secondary text-white p-3 rounded-xl hover:bg-primary-container transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-[52px] w-[52px] flex-shrink-0"
                    >
                      <span className="material-symbols-outlined transform -rotate-45 ml-1">send</span>
                    </button>
                  </form>
                  <p className="text-[10px] text-center text-on-surface-variant mt-2 font-mono uppercase opacity-70">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-on-surface-variant opacity-60 z-10">
                <span className="material-symbols-outlined text-6xl mb-4 text-secondary animate-pulse">cell_tower</span>
                <p className="font-mono text-sm uppercase tracking-widest font-bold">Awaiting Connection</p>
                <p className="text-sm mt-2">Select a voyage from the manifest to tune in.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
