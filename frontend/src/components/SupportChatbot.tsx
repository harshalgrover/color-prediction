import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Headset, X, Send, ChevronDown } from 'lucide-react';

/* ── Types ─── */
interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  quickReplies?: string[];
}

/* ── AI Response Engine ─── */
const FAQ_RESPONSES: { keywords: string[]; answer: string; followUpQuickReplies?: string[] }[] = [
  {
    keywords: ['deposit not credited', 'deposit not reflected', 'money deducted', 'amount deducted', 'paid but not credited'],
    answer: '💳 If your deposit wasn\'t credited:\n\n1️⃣ Double-check that you entered the correct 12-digit UTR number\n2️⃣ Wait 5-10 minutes — sometimes transactions take a moment to reflect\n3️⃣ Verify the payment went through in your UPI app\'s transaction history\n4️⃣ Make sure the amount entered matches exactly what you paid\n\nIf it\'s been more than 30 minutes, please share your UTR number and we\'ll escalate it.',
    followUpQuickReplies: ['Still not credited after 30 min', 'How to find UTR number?', 'Go back to main menu'],
  },
  {
    keywords: ['utr', 'utr number', 'find utr', 'transaction id', 'reference number'],
    answer: '🔍 How to find your UTR number:\n\n📱 **Google Pay**: Go to transaction → Tap on it → Look for "UPI transaction ID"\n📱 **PhonePe**: Go to History → Tap transaction → "Transaction ID"\n📱 **Paytm**: Go to Passbook → Tap transaction → "UTR/Reference No"\n\nThe UTR is always a 12-digit number. Enter it exactly as shown.',
    followUpQuickReplies: ['Deposit not credited', 'Go back to main menu'],
  },
  {
    keywords: ['deposit fail', 'deposit issue', 'deposit problem', 'deposit error', 'can\'t deposit', 'unable to deposit', 'deposit stuck'],
    answer: '⚠️ Common deposit issues & fixes:\n\n1️⃣ **QR code not scanning** — Try zooming in or using a different UPI app\n2️⃣ **Payment failed** — Check your bank balance and UPI daily limit\n3️⃣ **UTR rejected** — Ensure you entered all 12 digits correctly\n4️⃣ **Amount mismatch** — Enter the exact amount you paid, not more or less\n\nMost issues resolve by trying again with a different UPI app!',
    followUpQuickReplies: ['Deposit not credited', 'How to find UTR number?', 'Go back to main menu'],
  },
  {
    keywords: ['withdrawal fail', 'withdrawal issue', 'withdrawal problem', 'withdraw fail', 'withdraw issue', 'can\'t withdraw', 'unable to withdraw', 'withdraw error', 'withdrawal stuck', 'withdraw stuck'],
    answer: '🏦 Withdrawal troubleshooting:\n\n1️⃣ **Insufficient balance** — Make sure you have enough funds (check wallet balance)\n2️⃣ **Minimum withdrawal** — The minimum withdrawal amount is ₹100\n3️⃣ **Pending withdrawal** — If a previous withdrawal is still processing, wait for it to complete\n4️⃣ **Server error** — Try again after a few minutes\n\nWithdrawals typically process within 1-24 hours.',
    followUpQuickReplies: ['Withdrawal still pending', 'Check processing time', 'Go back to main menu'],
  },
  {
    keywords: ['withdrawal pending', 'withdraw pending', 'withdrawal still pending', 'when will i get', 'processing time', 'how long'],
    answer: '⏳ Withdrawal processing times:\n\n• **Standard**: 1-24 hours on business days\n• **Weekends/Holidays**: May take up to 48 hours\n• **Bank processing**: Your bank may take additional time to reflect the credit\n\nIf it\'s been more than 48 hours, please contact us with your withdrawal details and we\'ll investigate immediately.',
    followUpQuickReplies: ['Withdrawal failed', 'Go back to main menu'],
  },
  {
    keywords: ['how to deposit', 'deposit steps', 'deposit guide', 'how to add money', 'add funds'],
    answer: '📥 How to deposit:\n\n1️⃣ Go to **Wallet** → Select **Deposit**\n2️⃣ Scan the **QR code** with any UPI app (GPay, PhonePe, Paytm)\n3️⃣ Pay the amount you want to deposit\n4️⃣ After payment, enter the **exact amount** you paid\n5️⃣ Enter the **12-digit UTR number** from your UPI app\n6️⃣ Click **Submit Deposit**\n\nYour balance will update within a few minutes! 🎉',
    followUpQuickReplies: ['How to find UTR number?', 'Deposit not credited', 'Go back to main menu'],
  },
  {
    keywords: ['how to withdraw', 'withdraw steps', 'withdraw guide', 'how to get money', 'cash out'],
    answer: '📤 How to withdraw:\n\n1️⃣ Go to **Wallet** → Select **Withdraw**\n2️⃣ Enter the amount you want to withdraw (minimum ₹100)\n3️⃣ Click **Withdraw Now**\n4️⃣ Your request will be processed within 1-24 hours\n\nMake sure your bank details are correct for a smooth withdrawal! 💰',
    followUpQuickReplies: ['Withdrawal pending', 'Withdrawal failed', 'Go back to main menu'],
  },
  {
    keywords: ['still not credited', 'still pending deposit', '30 min', 'not received'],
    answer: '🚨 If your deposit hasn\'t been credited after 30 minutes:\n\nPlease provide us with:\n• Your **registered phone number**\n• The **UTR number**\n• The **exact amount** paid\n• **Screenshot** of the UPI transaction\n\nOur team will manually verify and credit your account within 2 hours. We apologize for the inconvenience! 🙏',
    followUpQuickReplies: ['Go back to main menu'],
  },
  {
    keywords: ['hello', 'hi', 'hey', 'help', 'support'],
    answer: '👋 Hello! Welcome to **color69 Support**!\n\nI can help you with:\n• 💳 Deposit issues & failures\n• 🏦 Withdrawal problems\n• 📖 How-to guides\n\nWhat do you need help with?',
    followUpQuickReplies: ['Deposit not credited', 'Withdrawal failed', 'How to deposit?', 'How to withdraw?'],
  },
];

const MAIN_QUICK_REPLIES = ['Deposit not credited', 'Withdrawal failed', 'How to deposit?', 'How to withdraw?'];

function getAIResponse(userMessage: string): { text: string; quickReplies: string[] } {
  const lower = userMessage.toLowerCase().trim();

  if (lower === 'go back to main menu' || lower === 'main menu' || lower === 'menu') {
    return {
      text: '👋 Sure! What else can I help you with?',
      quickReplies: MAIN_QUICK_REPLIES,
    };
  }

  for (const faq of FAQ_RESPONSES) {
    if (faq.keywords.some(kw => lower.includes(kw))) {
      return {
        text: faq.answer,
        quickReplies: faq.followUpQuickReplies || MAIN_QUICK_REPLIES,
      };
    }
  }

  return {
    text: '🤔 I\'m not sure I understand. Let me help you with some common topics:\n\nPlease select one of the options below, or try describing your issue with keywords like "deposit", "withdrawal", "UTR", or "pending".',
    quickReplies: MAIN_QUICK_REPLIES,
  };
}

/* ── Component ─── */
export default function SupportChatbot() {
  const location = useLocation();
  const hideOnRoutes = ['/login', '/register'];
  const shouldHide = hideOnRoutes.includes(location.pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: '👋 Hi there! I\'m your **color69** support assistant.\n\nHow can I help you today?',
      sender: 'bot',
      quickReplies: MAIN_QUICK_REPLIES,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(2);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: idCounter.current++, text: text.trim(), sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = getAIResponse(text);
      const botMsg: Message = {
        id: idCounter.current++,
        text: response.text,
        sender: 'bot',
        quickReplies: response.quickReplies,
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  /* ── Styles ─── */
  const S = {
    fabWrap: {
      position: 'fixed' as const,
      bottom: 80,
      right: 'max(calc((100vw - 480px) / 2 + 10px), 14px)',
      zIndex: 900,
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      border: 'none',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 24px rgba(102, 126, 234, 0.5)',
      cursor: 'pointer',
      position: 'relative' as const,
    },
    fabPulse: {
      position: 'absolute' as const,
      inset: -4,
      borderRadius: '50%',
      border: '2px solid rgba(102, 126, 234, 0.4)',
      animation: 'supportPulse 2s ease-in-out infinite',
    },
    badge: {
      position: 'absolute' as const,
      top: -2,
      right: -2,
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: '#40b83e',
      border: '2px solid #fff',
    },
    panel: {
      position: 'fixed' as const,
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      height: '75vh',
      maxHeight: 600,
      display: 'flex',
      flexDirection: 'column' as const,
      zIndex: 950,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      boxShadow: '0 -10px 60px rgba(0,0,0,0.25)',
    },
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: '#fff',
      flexShrink: 0,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 20,
    },
    headerTitle: { fontSize: 16, fontWeight: 800 },
    headerSub: { fontSize: 11, opacity: 0.8, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#4ade80',
      display: 'inline-block',
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.15)',
      border: 'none',
      borderRadius: '50%',
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      cursor: 'pointer',
    },
    body: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '16px 14px',
      background: '#f0f2f5',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 10,
    },
    msgRow: (isBot: boolean): React.CSSProperties => ({
      display: 'flex',
      justifyContent: isBot ? 'flex-start' : 'flex-end',
    }),
    bubble: (isBot: boolean): React.CSSProperties => ({
      maxWidth: '85%',
      padding: '10px 14px',
      borderRadius: isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
      background: isBot ? '#fff' : 'linear-gradient(135deg, #667eea, #764ba2)',
      color: isBot ? '#333' : '#fff',
      fontSize: 13,
      lineHeight: 1.5,
      fontWeight: 500,
      boxShadow: isBot ? '0 1px 3px rgba(0,0,0,0.06)' : '0 2px 8px rgba(102,126,234,0.3)',
      whiteSpace: 'pre-line' as const,
    }),
    quickReplies: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: 6,
      marginTop: 8,
    },
    qrBtn: {
      padding: '7px 12px',
      borderRadius: 18,
      border: '1.5px solid #667eea',
      background: 'rgba(102, 126, 234, 0.06)',
      color: '#667eea',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    typingWrap: {
      display: 'flex',
      justifyContent: 'flex-start',
    },
    typingBubble: {
      background: '#fff',
      borderRadius: '4px 16px 16px 16px',
      padding: '12px 18px',
      display: 'flex',
      gap: 4,
      alignItems: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    },
    dot: (i: number): React.CSSProperties => ({
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#aaa',
      animation: `typingBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
    }),
    inputWrap: {
      background: '#fff',
      padding: '10px 14px',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      borderTop: '1px solid #eee',
      flexShrink: 0,
    },
    input: {
      flex: 1,
      padding: '12px 16px',
      borderRadius: 24,
      border: '1.5px solid #e0e0e0',
      fontSize: 14,
      outline: 'none',
      background: '#f8f8f8',
      fontFamily: 'inherit',
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: '50%',
      border: 'none',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
    },
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      zIndex: 940,
    },
  };

  if (shouldHide) return null;

  return (
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes supportPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.4; }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        .support-qr-btn:hover {
          background: rgba(102, 126, 234, 0.15) !important;
          transform: scale(1.03);
        }
        .support-input:focus {
          border-color: #667eea !important;
          background: #fff !important;
        }
        .support-send:hover {
          opacity: 0.9;
          transform: scale(1.05);
        }
        .support-close:hover {
          background: rgba(255,255,255,0.25) !important;
        }
      `}</style>

      {/* FAB Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            style={S.fabWrap}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <button style={S.fab} onClick={() => setIsOpen(true)} aria-label="Open support chat">
              <div style={S.fabPulse} />
              <Headset size={26} strokeWidth={2.5} />
              <div style={S.badge} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              style={S.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              style={S.panel}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div style={S.header}>
                <div style={S.headerLeft}>
                  <div style={S.avatar}>🤖</div>
                  <div>
                    <div style={S.headerTitle}>Support Assistant</div>
                    <div style={S.headerSub}>
                      <span style={S.onlineDot} /> Online • Typically replies instantly
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="support-close" style={S.closeBtn} onClick={() => setIsOpen(false)} aria-label="Minimize chat">
                    <ChevronDown size={20} />
                  </button>
                  <button className="support-close" style={S.closeBtn} onClick={() => setIsOpen(false)} aria-label="Close chat">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={S.body}>
                {messages.map(msg => (
                  <div key={msg.id}>
                    <div style={S.msgRow(msg.sender === 'bot')}>
                      <div
                        style={S.bubble(msg.sender === 'bot')}
                        dangerouslySetInnerHTML={{
                          __html: msg.text
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    </div>
                    {msg.sender === 'bot' && msg.quickReplies && msg.quickReplies.length > 0 && (
                      <div style={S.quickReplies}>
                        {msg.quickReplies.map(qr => (
                          <button
                            key={qr}
                            className="support-qr-btn"
                            style={S.qrBtn}
                            onClick={() => sendMessage(qr)}
                          >
                            {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div style={S.typingWrap}>
                    <div style={S.typingBubble}>
                      <div style={S.dot(0)} />
                      <div style={S.dot(1)} />
                      <div style={S.dot(2)} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} style={S.inputWrap}>
                <input
                  ref={inputRef}
                  className="support-input"
                  style={S.input}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isTyping}
                />
                <button type="submit" className="support-send" style={S.sendBtn} disabled={isTyping || !input.trim()}>
                  <Send size={18} />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
