import React, { useEffect, useState, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { Phone, PhoneOff, Mic, MicOff, User, History, Users, Settings, Activity, LayoutGrid } from 'lucide-react';
import { api, socket, Contact, Campaign, CallLog } from './services';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => (
  <div className="w-16 bg-zinc-900 flex flex-col items-center py-6 gap-6 border-r border-zinc-800">
    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
      <Phone className="text-white w-6 h-6" />
    </div>
    <NavIcon icon={<LayoutGrid />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
    <NavIcon icon={<Users />} active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} />
    <NavIcon icon={<History />} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
    <div className="mt-auto">
      <NavIcon icon={<Settings />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
    </div>
  </div>
);

const NavIcon = ({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`p-3 rounded-xl transition-all ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 20 })}
  </button>
);

const Dialer = ({ device, activeCall, setActiveCall, contacts }: { device: Device | null, activeCall: Call | null, setActiveCall: (c: Call | null) => void, contacts: Contact[] }) => {
  const [number, setNumber] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCall) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCall]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const handleCall = async () => {
    if (!device) return;
    try {
      setStatus('Dialing...');
      const call = await device.connect({ params: { To: number } });
      
      call.on('accept', () => {
        setStatus('In Call');
        setActiveCall(call);
      });
      
      call.on('disconnect', () => {
        setStatus('Ready');
        setActiveCall(null);
        // Log call
        const contact = contacts.find(c => c.phone === number);
        api.logCall({
          contact_id: contact?.id,
          direction: 'outbound',
          duration: duration, // Note: this will be 0 if captured here immediately, better to capture ref or use end time
          status: 'completed'
        });
      });

      call.on('error', (error) => {
        console.error('Call Error:', error);
        setStatus('Error');
        setTimeout(() => setStatus('Ready'), 2000);
      });

    } catch (err) {
      console.error(err);
      setStatus('Failed');
    }
  };

  const handleHangup = () => {
    if (activeCall) {
      activeCall.disconnect();
    }
  };

  const toggleMute = () => {
    if (activeCall) {
      activeCall.mute(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-800 w-full max-w-sm">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === 'Ready' ? 'bg-emerald-500' : status === 'In Call' ? 'bg-red-500' : 'bg-amber-500'}`} />
          <span className="text-zinc-400 text-sm font-medium">{status}</span>
        </div>
        {activeCall && <span className="text-zinc-100 font-mono">{formatTime(duration)}</span>}
      </div>

      <input
        type="text"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="+1 (555) 000-0000"
        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-2xl text-center text-white mb-6 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
        disabled={!!activeCall}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
          <button
            key={key}
            onClick={() => !activeCall && setNumber(prev => prev + key)}
            className="h-14 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 font-medium text-xl transition-colors active:scale-95"
            disabled={!!activeCall}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {activeCall ? (
          <>
            <button
              onClick={toggleMute}
              className={`flex-1 h-14 rounded-xl flex items-center justify-center transition-colors ${isMuted ? 'bg-white text-black' : 'bg-zinc-800 text-white'}`}
            >
              {isMuted ? <MicOff /> : <Mic />}
            </button>
            <button
              onClick={handleHangup}
              className="flex-1 h-14 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
            >
              <PhoneOff />
            </button>
          </>
        ) : (
          <button
            onClick={handleCall}
            disabled={!device || !number}
            className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors font-medium text-lg gap-2"
          >
            <Phone className="w-5 h-5" /> Call
          </button>
        )}
      </div>
    </div>
  );
};

const Dashboard = ({ campaigns, contacts, onCallContact }: { campaigns: Campaign[], contacts: Contact[], onCallContact: (phone: string) => void }) => (
  <div className="p-8 h-full overflow-y-auto">
    <header className="mb-8">
      <h1 className="text-3xl font-semibold text-zinc-100 mb-2">Agent Dashboard</h1>
      <p className="text-zinc-400">Welcome back, Agent 1. You have {campaigns.length} active campaigns.</p>
    </header>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {campaigns.map(camp => (
        <div key={camp.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-medium text-zinc-100">{camp.name}</h3>
              <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${camp.type === 'inbound' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                {camp.type.toUpperCase()}
              </span>
            </div>
            <div className={`w-2 h-2 rounded-full ${camp.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
          </div>
          <div className="flex justify-between items-end">
            <div className="text-zinc-400 text-sm">Target: 50 leads</div>
            <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">View Details</button>
          </div>
        </div>
      ))}
    </div>

    <h2 className="text-xl font-semibold text-zinc-100 mb-4">Priority Contacts</h2>
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase font-medium">
          <tr>
            <th className="px-6 py-4">Name</th>
            <th className="px-6 py-4">Type</th>
            <th className="px-6 py-4">Notes</th>
            <th className="px-6 py-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {contacts.map(contact => (
            <tr key={contact.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-6 py-4">
                <div className="font-medium text-zinc-200">{contact.name}</div>
                <div className="text-zinc-500 text-sm">{contact.phone}</div>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded text-xs ${contact.type === 'customer' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  {contact.type}
                </span>
              </td>
              <td className="px-6 py-4 text-zinc-400 text-sm">{contact.notes}</td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => onCallContact(contact.phone)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const CallHistory = ({ logs }: { logs: CallLog[] }) => (
  <div className="p-8 h-full overflow-y-auto">
    <h1 className="text-3xl font-semibold text-zinc-100 mb-8">Call History</h1>
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase font-medium">
          <tr>
            <th className="px-6 py-4">Contact</th>
            <th className="px-6 py-4">Direction</th>
            <th className="px-6 py-4">Duration</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {logs.map(log => (
            <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="px-6 py-4">
                <div className="font-medium text-zinc-200">{log.contact_name || 'Unknown'}</div>
              </td>
              <td className="px-6 py-4">
                <span className={`flex items-center gap-2 text-sm ${log.direction === 'inbound' ? 'text-blue-400' : 'text-purple-400'}`}>
                  {log.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                </span>
              </td>
              <td className="px-6 py-4 text-zinc-400 font-mono text-sm">
                {Math.floor(log.duration / 60)}:{(log.duration % 60).toString().padStart(2, '0')}
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-400 capitalize">
                  {log.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right text-zinc-500 text-sm">
                {new Date(log.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [device, setDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  // Initialize Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [c, camp, l] = await Promise.all([
          api.getContacts(),
          api.getCampaigns(),
          api.getLogs()
        ]);
        setContacts(c);
        setCampaigns(camp);
        setLogs(l);
      } catch (e) {
        console.error("Failed to load initial data", e);
      }
    };
    fetchData();

    socket.on('log_update', async () => {
      const l = await api.getLogs();
      setLogs(l);
    });

    return () => {
      socket.off('log_update');
    };
  }, []);

  // Initialize Twilio
  useEffect(() => {
    const initTwilio = async () => {
      try {
        const { token } = await api.getToken();
        const newDevice = new Device(token, {
          logLevel: 1,
          codecPreferences: ['opus', 'pcmu'] as any,
        });

        newDevice.on('ready', () => {
          console.log('Twilio Device Ready');
          setIsReady(true);
        });

        newDevice.on('error', (error) => {
          console.error('Twilio Device Error:', error);
        });

        newDevice.on('incoming', (call) => {
          setIncomingCall(call);
          call.on('disconnect', () => {
            setIncomingCall(null);
          });
        });

        await newDevice.register();
        setDevice(newDevice);
      } catch (err) {
        console.error('Failed to initialize Twilio:', err);
      }
    };

    initTwilio();

    return () => {
      if (device) {
        device.destroy();
      }
    };
  }, []);

  const handleAcceptIncoming = () => {
    if (incomingCall) {
      incomingCall.accept();
      setActiveCall(incomingCall);
      setIncomingCall(null);
    }
  };

  const handleRejectIncoming = () => {
    if (incomingCall) {
      incomingCall.reject();
      setIncomingCall(null);
    }
  };

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {activeTab === 'dashboard' && (
            <Dashboard 
              campaigns={campaigns} 
              contacts={contacts} 
              onCallContact={(phone) => {
                // In a real app, this would pre-fill the dialer or auto-dial
                // For now, we'll just switch to dialer view contextually if we had one
                console.log("Calling", phone);
              }} 
            />
          )}
          {activeTab === 'contacts' && <Dashboard campaigns={[]} contacts={contacts} onCallContact={() => {}} />}
          {activeTab === 'history' && <CallHistory logs={logs} />}
          {activeTab === 'settings' && (
            <div className="p-8">
              <h1 className="text-3xl font-semibold mb-4">Settings</h1>
              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                <h3 className="text-lg font-medium mb-2">Twilio Status</h3>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-zinc-400">{isReady ? 'Connected' : 'Disconnected (Check credentials)'}</span>
                </div>
                {!isReady && (
                  <p className="mt-4 text-sm text-amber-500 bg-amber-500/10 p-4 rounded-xl">
                    Note: To make calls, ensure TWILIO_ACCOUNT_SID and other credentials are set in .env. 
                    The app is currently in "Demo Mode" with mock data, but the Dialer requires valid credentials to connect.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Always visible Dialer */}
        <div className="w-96 bg-zinc-950 border-l border-zinc-800 p-6 flex flex-col gap-6">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Phone System</h2>
          <Dialer device={device} activeCall={activeCall} setActiveCall={setActiveCall} contacts={contacts} />
          
          <div className="flex-1 bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Active Scripts</h3>
            <div className="space-y-3">
              <div className="p-3 bg-zinc-800 rounded-lg text-sm text-zinc-300 cursor-pointer hover:bg-zinc-700 transition-colors">
                <span className="block text-xs text-zinc-500 mb-1">Greeting</span>
                "Hello, this is Agent 1 from [Company]. How can I help you today?"
              </div>
              <div className="p-3 bg-zinc-800 rounded-lg text-sm text-zinc-300 cursor-pointer hover:bg-zinc-700 transition-colors">
                <span className="block text-xs text-zinc-500 mb-1">Billing Inquiry</span>
                "I can certainly help with that. Could you please verify your account number?"
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 w-80 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl p-6 z-50"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
                <Phone className="text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Incoming Call</h3>
                <p className="text-zinc-400 text-sm">{incomingCall.parameters.From}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAcceptIncoming}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Accept
              </button>
              <button
                onClick={handleRejectIncoming}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Decline
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
