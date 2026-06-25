'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

type Comment = {
  id: string;
  expense_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  users?: { name: string };
};

export default function ExpenseComments({ expenseId, userId, currentUserName }: { expenseId: string, userId: string | null, currentUserName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchComments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('expense_comments')
        .select(`*, users (name)`)
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setComments(data);
      }
      setLoading(false);
      scrollToBottom();
    };

    fetchComments();

    // Subscribe to new comments
    const channel = supabase
      .channel(`comments-${expenseId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expense_comments', filter: `expense_id=eq.${expenseId}` },
        async (payload) => {
          // Fetch user name for the new comment
          const { data: userData } = await supabase.from('users').select('name').eq('id', payload.new.user_id).maybeSingle();
          const newMsg = { ...payload.new, users: { name: userData?.name || 'Pirate' } } as Comment;
          setComments(prev => [...prev, newMsg]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, expenseId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userId) return;

    const tempComment = newComment;
    setNewComment('');

    await supabase.from('expense_comments').insert([
      { expense_id: expenseId, user_id: userId, comment: tempComment }
    ]);
  };

  return (
    <div className="w-full mt-3">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-bold text-secondary hover:text-primary transition-colors px-3 py-1.5 rounded-full bg-secondary-container/20 border border-secondary/20"
      >
        <span className="material-symbols-outlined text-[16px]">{isOpen ? 'expand_less' : 'chat_bubble'}</span>
        {isOpen ? 'Close Chat' : 'Message in a Bottle (Comments)'}
      </button>

      {isOpen && (
        <div className="mt-3 bg-surface-container-low border border-outline-variant/40 rounded-xl overflow-hidden flex flex-col h-[300px]">
          <div className="bg-surface-container border-b border-outline-variant/40 p-3 text-xs font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[16px]">forum</span>
            Crew Chat
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 relative">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <span className="material-symbols-outlined animate-spin text-secondary">sync</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="flex justify-center items-center h-full text-center text-on-surface-variant text-xs italic opacity-70">
                No messages yet. Throw a bottle into the sea!
              </div>
            ) : (
              comments.map(c => {
                const isMe = c.user_id === userId;
                return (
                  <div key={c.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                    <span className="text-[10px] text-on-surface-variant mb-0.5 px-1 font-bold">
                      {isMe ? 'You' : (c.users?.name || 'Crew Member')}
                    </span>
                    <div className={`px-3 py-2 rounded-2xl text-sm ${
                      isMe 
                        ? 'bg-secondary text-white rounded-br-sm' 
                        : 'bg-surface-container-high text-on-surface border border-outline-variant/30 rounded-bl-sm'
                    }`}>
                      {c.comment}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 bg-surface border-t border-outline-variant/40 flex gap-2">
            <input 
              type="text" 
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
            <button 
              type="submit"
              disabled={!newComment.trim() || !userId}
              className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
