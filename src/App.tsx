import React, { useEffect, useState, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { Phone, PhoneOff, Mic, MicOff, User, History, Users, Settings, Activity, LayoutGrid, LogOut, Lock, Mail, AlertTriangle } from 'lucide-react';
import { api, socket, Contact, Campaign, CallLog, User as UserType } from './services';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';

// --- Error Boundary ---
export class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-red-500/20 rounded-2xl p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-zinc-400 mb-6">The application encountered an unexpected error. Our team has been notified.</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Auth Components ---

const AuthPage = ({ onLogin }: { onLogin: (u: UserType) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await api.register({ email, password, name, companyName });
        toast.success("Account created successfully!");
      } else {
        res = await api.login({ email, password });
        toast.success("Welcome back!");
      }
      localStorage.setItem('token', res.token);
      onLogin(res.user);
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Phone className="text-white w-8 h-8" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-2">Meti Call Center</h1>
        <p className="text-zinc-400 text-center mb-8">
          {isRegister ? 'Create your enterprise account' : 'Sign in to your dashboard'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Company Name</label>
                <div className="relative">
                  <LayoutGrid className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Acme Corp"
                    required
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};


// --- App Components ---

const Sidebar = ({ activeTab, setActiveTab, onLogout, user }: { activeTab: string, setActiveTab: (t: string) => void, onLogout: () => void, user: UserType }) => (
  <div className="w-16 bg-zinc-900 flex flex-col items-center py-6 gap-6 border-r border-zinc-800">
    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
      <Phone className="text-white w-6 h-6" />
    </div>
    <NavIcon icon={<LayoutGrid />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
    <NavIcon icon={<Users />} active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} />
    <NavIcon icon={<History />} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
    {user.role === 'admin' && (
      <NavIcon icon={<User />} active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
    )}
    <div className="mt-auto flex flex-col gap-4">
      <NavIcon icon={<Settings />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      <button
        onClick={onLogout}
        className="p-3 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-800/50 transition-all"
      >
        <LogOut size={20} />
      </button>
    </div>
  </div>
);

const NavIcon = ({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`p-3 rounded-xl transition-all ${active ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 20 })}
  </button>
);

const TeamManagement = () => {
  const [team, setTeam] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '', role: 'agent' });

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      const users = await api.getTeam();
      setTeam(users);
    } catch (err) {
      toast.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addTeamMember(newMember);
      toast.success("Team member added");
      setIsAdding(false);
      setNewMember({ name: '', email: '', password: '', role: 'agent' });
      loadTeam();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold text-zinc-100">Team Management</h1>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {isAdding ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl mb-8">
          <h3 className="text-lg font-medium text-zinc-100 mb-4">Add New Team Member</h3>
          <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Full Name"
              value={newMember.name}
              onChange={e => setNewMember({...newMember, name: e.target.value})}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white"
              required
            />
            <input
              type="email"
              placeholder="Email Address"
              value={newMember.email}
              onChange={e => setNewMember({...newMember, email: e.target.value})}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={newMember.password}
              onChange={e => setNewMember({...newMember, password: e.target.value})}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white"
              required
            />
            <select
              value={newMember.role}
              onChange={e => setNewMember({...newMember, role: e.target.value})}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
            <div className="md:col-span-2">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium">
                Create User
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase font-medium">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {team.map(member => (
              <tr key={member.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-200">{member.name}</td>
                <td className="px-6 py-4 text-zinc-400">{member.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs uppercase ${member.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500 text-sm">
                  {member.created_at ? new Date(member.created_at).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Dialer = ({ device, activeCall, setActiveCall, contacts }: { device: Device | null, activeCall: Call | null, setActiveCall: (c: Call | null) => void, contacts: Contact[] }) => {
  const [number, setNumber] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [duration, setDuration] = useState(0);
  
  // Refs for long press
  const longPressTimer = useRef<any>(null);
  const isLongPress = useRef(false);
  // Ref for duration to access in callbacks
  const durationRef = useRef(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCall) {
      interval = setInterval(() => {
        setDuration(d => {
            durationRef.current = d + 1;
            return d + 1;
        });
      }, 1000);
    } else {
      setDuration(0);
      durationRef.current = 0;
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
          duration: durationRef.current, 
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

  // Long press handlers
  const handleMouseDown = () => {
    if (activeCall) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setNumber(prev => prev + '+');
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (key: string | number) => {
    if (activeCall) return;
    if (key === 0) {
      if (isLongPress.current) {
        isLongPress.current = false;
        return;
      }
    }
    setNumber(prev => prev + key);
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
            onMouseDown={key === 0 ? handleMouseDown : undefined}
            onMouseUp={key === 0 ? handleMouseUp : undefined}
            onMouseLeave={key === 0 ? handleMouseUp : undefined}
            onTouchStart={key === 0 ? handleMouseDown : undefined}
            onTouchEnd={key === 0 ? handleMouseUp : undefined}
            onClick={() => handleClick(key)}
            className={`h-14 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 font-medium text-xl transition-colors active:scale-95 flex flex-col items-center justify-center ${key === 0 ? 'leading-none' : ''}`}
            disabled={!!activeCall}
          >
            {key}
            {key === 0 && <span className="text-[10px] text-zinc-500 font-normal">+</span>}
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

const IntegrationCard = ({ name, description, icon, onSync }: { name: string, description: string, icon: React.ReactNode, onSync: () => Promise<void> }) => {
  const [loading, setLoading] = useState(false);
  
  const handleSync = async () => {
    setLoading(true);
    try {
      await onSync();
    } catch (e) {
      console.error(e);
      alert('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
      <div className="flex items-center gap-4">
        {icon}
        <div>
          <div className="font-medium text-white">{name}</div>
          <div className="text-sm text-zinc-500">{description}</div>
        </div>
      </div>
      <button 
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

const Dashboard = ({ campaigns, contacts, onCallContact, user }: { campaigns: Campaign[], contacts: Contact[], onCallContact: (phone: string) => void, user: UserType }) => (
  <div className="p-8 h-full overflow-y-auto">
    <header className="mb-8">
      <h1 className="text-3xl font-semibold text-zinc-100 mb-2">Agent Dashboard</h1>
      <p className="text-zinc-400">Welcome back, {user.name}. You have {campaigns.length} active campaigns.</p>
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
            <th className="px-6 py-4">Agent</th>
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
                <div className="text-zinc-400 text-sm">{log.agent_name || 'System'}</div>
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
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [device, setDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  // Check Auth
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user } = await api.getMe();
        setUser(user);
      } catch (e) {
        // Not logged in
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Initialize Data (Only when logged in)
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Initialize Twilio (Only when logged in)
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

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

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setDevice(null);
    setIsReady(false);
  };

  if (loading) {
    return <div className="h-screen bg-black flex items-center justify-center text-zinc-500">Loading Meti Call Center...</div>;
  }

  if (!user) {
    return <AuthPage onLogin={setUser} />;
  }

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} user={user} />
      
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {activeTab === 'dashboard' && (
            <Dashboard 
              campaigns={campaigns} 
              contacts={contacts} 
              onCallContact={(phone) => {
                console.log("Calling", phone);
              }}
              user={user}
            />
          )}
          {activeTab === 'contacts' && <Dashboard campaigns={[]} contacts={contacts} onCallContact={() => {}} user={user} />}
          {activeTab === 'history' && <CallHistory logs={logs} />}
          {activeTab === 'team' && user.role === 'admin' && <TeamManagement />}
          {activeTab === 'settings' && (
            <div className="p-8">
              <h1 className="text-3xl font-semibold mb-4">Settings</h1>
              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 mb-6">
                <h3 className="text-lg font-medium mb-4">Profile</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-zinc-500 text-sm">{user.email}</div>
                  </div>
                  <div className="ml-auto flex flex-col items-end gap-1">
                    <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs uppercase tracking-wider text-zinc-400">
                      {user.role}
                    </span>
                    {user.company_name && (
                      <span className="text-xs text-zinc-500">
                        {user.company_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 mb-6">
                <h3 className="text-lg font-medium mb-4">Integrations</h3>
                <div className="space-y-4">
                  <IntegrationCard 
                    name="Google Sheets" 
                    description="Sync contacts from Google Sheets" 
                    icon={<div className="w-8 h-8 bg-green-500/20 text-green-500 rounded-lg flex items-center justify-center font-bold">G</div>}
                    onSync={async () => {
                      await api.syncGoogle();
                      window.location.reload(); // Refresh to show new contacts
                    }}
                  />
                  <IntegrationCard 
                    name="HubSpot" 
                    description="Import deals and contacts from HubSpot" 
                    icon={<div className="w-8 h-8 bg-orange-500/20 text-orange-500 rounded-lg flex items-center justify-center font-bold">H</div>}
                    onSync={async () => {
                      await api.syncHubSpot();
                      window.location.reload();
                    }}
                  />
                  <IntegrationCard 
                    name="Salesforce" 
                    description="Connect to Salesforce CRM" 
                    icon={<div className="w-8 h-8 bg-blue-500/20 text-blue-500 rounded-lg flex items-center justify-center font-bold">S</div>}
                    onSync={async () => {
                      await api.syncSalesforce();
                      window.location.reload();
                    }}
                  />
                </div>
              </div>

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
                "Hello, this is {user.name} from [Company]. How can I help you today?"
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
