import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, User, Loader2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  getDocs,
  writeBatch
} from 'firebase/firestore';

interface DirectMessage {
  id: string;
  chatId: string;
  participantIds: string[];
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: any;
}

interface FriendChatProps {
  friendId: string;
  friendName: string;
  friendPhoto?: string;
  onClose: () => void;
}

export default function FriendChat({ friendId, friendName, friendPhoto, onClose }: FriendChatProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  // Generate a consistent chatId for the pair
  const chatId = [user.uid, friendId].sort().join('_');

  useEffect(() => {
    // Filter by participantIds to satisfy security rules and get all user's messages.
    // Memory-based chatId filtering avoids composite index (chatId + participantIds + createdAt).
    const q = query(
      collection(db, 'direct_messages'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DirectMessage[];
      
      // Deduplicate by ID
      const msgs = Array.from(new Map(allMsgs.map(item => [item.id, item])).values());
      
      // Filter by chatId in memory
      const chatMsgs = msgs.filter(m => m.chatId === chatId);

      // Sort in memory. Put messages with null createdAt (just sent) at the end.
      const sortedMsgs = chatMsgs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeA - timeB;
      });

      setMessages(sortedMsgs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, user.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'direct_messages'), {
        chatId,
        participantIds: [user.uid, friendId],
        senderId: user.uid,
        receiverId: friendId,
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
      setError(null);
    } catch (error: any) {
      if (error.message?.includes('quota') || error.message?.includes('exhausted')) {
        setError(t('errorQuotaExceededFirestore' as any));
      } else {
        handleFirestoreError(error, OperationType.CREATE, 'direct_messages');
      }
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm(t('confirmClearChat') || 'Are you sure you want to clear this chat for both users?')) return;
    
    setClearing(true);
    try {
      const q = query(collection(db, 'direct_messages'), where('chatId', '==', chatId));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'direct_messages');
    } finally {
      setClearing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className={cn(
        "fixed bottom-20 right-6 z-50 w-full max-w-sm h-[500px] flex flex-col shadow-2xl rounded-3xl overflow-hidden border transition-colors",
        user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
      )}
    >
      {/* Header */}
      <div className={cn(
        "px-6 py-4 border-b flex items-center justify-between transition-colors",
        user.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            {friendPhoto ? (
              <img src={friendPhoto} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User size={20} />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <h3 className={cn("font-bold text-sm leading-tight transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
              {friendName}
            </h3>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{t('online')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleClearChat}
            disabled={clearing || messages.length === 0}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
            title={t('clearChat')}
          >
            {clearing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-600 flex items-center gap-2 mb-4">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <Send size={20} className="text-gray-400 -rotate-45" />
            </div>
            <p className="text-xs font-medium">{t('startConversation') || "Start a conversation!"}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.senderId === user.uid ? "ml-auto items-end" : "items-start"
              )}
            >
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm transition-colors shadow-sm",
                msg.senderId === user.uid 
                  ? "bg-primary text-white rounded-br-none" 
                  : (user.settings?.isDarkMode ? "bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700" : "bg-gray-100 text-gray-800 rounded-bl-none")
              )}>
                {msg.text}
              </div>
              <span className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">
                {msg.createdAt?.toDate ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(msg.createdAt.toDate()) : '...'}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className={cn(
        "p-4 border-t transition-colors",
        user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-100"
      )}>
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('typeMessage') || 'Type a message...'}
            className={cn(
              "flex-1 pl-4 pr-12 py-3 rounded-2xl text-sm border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all",
              user.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-100 text-gray-900"
            )}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="absolute right-2 p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
